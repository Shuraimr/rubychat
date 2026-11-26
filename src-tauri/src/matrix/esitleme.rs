//! Sync: starts the background synchronisation and keeps the UI informed.
//! Eşitleme: arka plan eşitlemesini başlatır ve arayüzü haberdar eder.
//!
//! Two modes / İki kip:
//!  1. Sliding sync via matrix-sdk-ui `SyncService` (what Element X uses). Used when the server supports MSC4186.
//!     matrix-sdk-ui `SyncService` ile sliding sync (Element X'in kullandığı). Sunucu MSC4186 destekliyorsa kullanılır.
//!  2. Classic `client.sync()` loop as a fallback for older servers.
//!     Eski sunucular için yedek: klasik `client.sync()` döngüsü.
//! In both modes the room list is rebuilt from the client's room store whenever something notable changes
//! (simple and identical for both modes; the heavy lifting is done by the SDK's store).
//! İki kipte de oda listesi, kayda değer bir şey değiştikçe istemcinin oda deposundan yeniden kurulur
//! (iki kip için aynı ve basit; ağır işi SDK'nın deposu yapar).

use std::{sync::{Arc, Mutex}, time::Duration};

use futures_util::StreamExt;
use matrix_sdk::{config::SyncSettings, Client};
use matrix_sdk_ui::sync_service::{State, SyncService};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::{
    hata::Sonuc,
    matrix::odalar,
    tipler::{EsitlemeDurumu, EsitlemeDurumuAdi},
};

pub const OLAY_ODALAR: &str = "odalar-guncellendi";
pub const OLAY_DURUM: &str = "esitleme-durumu";

/// The last state we announced: the UI asks for it once, because the event can fire before it subscribes.
/// Duyurduğumuz son durum: olay arayüz abone olmadan önce gelebilir, bu yüzden arayüz bir kez de sorar.
static SON_DURUM: Mutex<Option<EsitlemeDurumu>> = Mutex::new(None);

pub fn son_durum() -> Option<EsitlemeDurumu> {
    SON_DURUM.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

fn durum_yayinla(app: &AppHandle, durum: EsitlemeDurumuAdi, mesaj: Option<String>) {
    let d = EsitlemeDurumu { durum, mesaj };
    *SON_DURUM.lock().unwrap_or_else(|e| e.into_inner()) = Some(d.clone());
    let _ = app.emit(OLAY_DURUM, d);
}

pub async fn odalari_yayinla(app: &AppHandle, client: &Client) {
    let liste = odalar::liste(client).await;
    // Ask the SDK to track the newest rooms' latest events so previews fill in (best effort).
    // SDK'dan en yeni odaların son olaylarını izlemesini iste; önizlemeler dolsun (elinden geleni yapar).
    let son_olaylar = client.latest_events().await;
    for oda in liste.iter().filter(|o| !o.davet).take(50) {
        if let Ok(id) = matrix_sdk::ruma::RoomId::parse(&oda.id) {
            let _ = son_olaylar.listen_to_room(&id).await;
        }
    }
    let _ = app.emit(OLAY_ODALAR, liste);
}

/// Starts syncing. Returns the `SyncService` (sliding-sync mode) and the background tasks to abort on logout.
/// Eşitlemeyi başlatır. `SyncService`i (sliding sync kipinde) ve çıkışta durdurulacak arka plan görevlerini döndürür.
/// Asks the server once (`whoami`) whether the session still exists. `Some(false)` only on a definite answer: a hard "unknown token"
/// or a refresh token the server called `invalid_grant`. A network error is `None` (unknown), so a bad connection never signs anyone out.
/// Oturumun hâlâ var olup olmadığını sunucuya bir kez sorar (`whoami`). `Some(false)` yalnızca kesin yanıtta: katı "bilinmeyen belirteç" ya
/// da sunucunun `invalid_grant` dediği yenileme belirteci. Ağ hatası `None`dır (bilinmiyor); kötü bağlantı kimseyi çıkarmaz.
async fn oturum_gecerli_mi(client: &Client) -> Option<bool> {
    use matrix_sdk::ruma::api::error::ErrorKind;
    match client.whoami().await {
        Ok(_) => Some(true),
        Err(e) => {
            if let Some(ErrorKind::UnknownToken(d)) = e.client_api_error_kind() {
                return Some(d.soft_logout);
            }
            if matches!(e, matrix_sdk::HttpError::RefreshToken(_)) && e.to_string().contains("invalid_grant") {
                return Some(false);
            }
            None
        }
    }
}

pub async fn baslat(app: AppHandle, client: Client) -> Sonuc<(Option<Arc<SyncService>>, Vec<JoinHandle<()>>)> {
    let mut gorevler = Vec::new();
    durum_yayinla(&app, EsitlemeDurumuAdi::Basliyor, None);

    // Before anything syncs: without this the classic mode stores no events until a room is opened, so the list has no previews.
    // Her şeyden önce: bu olmadan klasik kipte oda açılana dek olay saklanmaz; listede önizleme olmaz.
    if let Err(e) = client.event_cache().subscribe() {
        warn!("olay önbelleği başlatılamadı: {e}");
    }

    let sliding = matches!(client.sliding_sync_version(), matrix_sdk::sliding_sync::Version::Native);
    let servis = if sliding {
        info!("sliding sync kullanılıyor");
        // `with_offline_mode`: when the network drops, the service goes `Offline` and retries by itself.
        // `with_offline_mode`: ağ kopunca servis `Offline` olur ve kendiliğinden yeniden dener.
        let servis = Arc::new(SyncService::builder(client.clone()).with_offline_mode().build().await?);
        // Subscribe BEFORE starting and handle the current value too: `next()` only yields later changes, so a quick `Running` was missed
        // and the UI said "connecting" forever.
        // Başlatmadan ÖNCE abone ol ve şimdiki değeri de işle: `next()` yalnızca sonraki değişimleri verir; hızlı gelen `Running` kaçıyor,
        // arayüz sonsuza dek "bağlanıyor" diyordu.
        let mut durumlar = servis.state();
        servis.start().await;
        let (app2, servis2, client2) = (app.clone(), servis.clone(), client.clone());
        gorevler.push(tokio::spawn(async move {
            let mut sonraki = Some(durumlar.get());
            while let Some(d) = sonraki {
                // Offline mode only checks that the server answers, so a revoked session looked like "no connection" and retried
                // twice a second. Ask once; a definite "no" stops the service and says so.
                // Çevrimdışı kip yalnızca sunucunun yanıt verdiğine bakar; iptal edilmiş oturum "bağlantı yok" gibi görünüyor ve saniyede
                // iki kez yeniden deniyordu. Bir kez sor; kesin "hayır" servisi durdurur ve bunu söyler.
                if matches!(d, State::Offline | State::Error(_) | State::Terminated) && oturum_gecerli_mi(&client2).await == Some(false) {
                    warn!("sunucu oturumu kesin reddetti: eşitleme durduruldu");
                    servis2.stop().await;
                    durum_yayinla(&app2, EsitlemeDurumuAdi::OturumKapali, None);
                    break;
                }
                let dustu = matches!(d, State::Error(_) | State::Terminated);
                match d {
                    State::Idle => durum_yayinla(&app2, EsitlemeDurumuAdi::Basliyor, None),
                    State::Running => durum_yayinla(&app2, EsitlemeDurumuAdi::Calisiyor, None),
                    State::Offline | State::Terminated => durum_yayinla(&app2, EsitlemeDurumuAdi::Cevrimdisi, None),
                    State::Error(e) => durum_yayinla(&app2, EsitlemeDurumuAdi::Hata, Some(e.to_string())),
                }
                // A stopped service never comes back by itself. · Duran servis kendiliğinden geri gelmez.
                if dustu {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    servis2.start().await;
                }
                sonraki = durumlar.next().await;
            }
        }));
        Some(servis)
    } else {
        info!("sunucu sliding sync desteklemiyor: klasik sync yedeği");
        let (c, app2) = (client.clone(), app.clone());
        gorevler.push(tokio::spawn(async move {
            // First sync is awaited on its own so the room list fills quickly, then the endless loop runs.
            // İlk eşitleme ayrıca beklenir (liste çabuk dolsun), sonra sonsuz döngü çalışır.
            loop {
                let ilk = c.sync_once(SyncSettings::default()).await;
                match ilk {
                    Ok(yanit) => {
                        durum_yayinla(&app2, EsitlemeDurumuAdi::Calisiyor, None);
                        odalari_yayinla(&app2, &c).await;
                        let ayar = SyncSettings::default().token(yanit.next_batch);
                        if let Err(e) = c.sync(ayar).await {
                            warn!("klasik sync durdu: {e}");
                            durum_yayinla(&app2, EsitlemeDurumuAdi::Hata, Some(e.to_string()));
                        }
                    }
                    Err(e) => {
                        warn!("ilk sync başarısız: {e}");
                        if oturum_gecerli_mi(&c).await == Some(false) {
                            durum_yayinla(&app2, EsitlemeDurumuAdi::OturumKapali, None);
                            break;
                        }
                        durum_yayinla(&app2, EsitlemeDurumuAdi::Cevrimdisi, Some(e.to_string()));
                    }
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }));
        None
    };

    gorevler.push(liste_yayincisi(app, client));
    Ok((servis, gorevler))
}

/// Re-emits the room list whenever rooms change or something notable happens (new message, read receipt...).
/// Updates are coalesced: at most ~5 emits per second.
/// Odalar değişince ya da kayda değer bir şey olunca (yeni mesaj, okundu bilgisi...) oda listesini yeniden yayınlar.
/// Güncellemeler birleştirilir: saniyede en fazla ~5 yayın.
fn liste_yayincisi(app: AppHandle, client: Client) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut bildirimler = client.room_info_notable_update_receiver();
        let (_, oda_akisi) = client.rooms_stream();
        futures_util::pin_mut!(oda_akisi);
        odalari_yayinla(&app, &client).await;
        loop {
            tokio::select! {
                _ = oda_akisi.next() => {}
                r = bildirimler.recv() => {
                    // Lagged = we missed some updates, which is fine: we rebuild everything anyway.
                    // Lagged = bazı güncellemeler kaçtı; sorun değil, zaten her şeyi yeniden kuruyoruz.
                    if matches!(r, Err(tokio::sync::broadcast::error::RecvError::Closed)) { break; }
                }
            }
            odalari_yayinla(&app, &client).await;
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    })
}

/// Stops everything started by `baslat`.
/// `baslat`ın başlattığı her şeyi durdurur.
pub async fn durdur(servis: Option<Arc<SyncService>>, gorevler: Vec<JoinHandle<()>>) {
    for g in gorevler {
        g.abort();
    }
    if let Some(s) = servis {
        s.stop().await;
    }
}
