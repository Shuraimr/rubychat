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

use std::{sync::Arc, time::Duration};

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

fn durum_yayinla(app: &AppHandle, durum: EsitlemeDurumuAdi, mesaj: Option<String>) {
    let _ = app.emit(OLAY_DURUM, EsitlemeDurumu { durum, mesaj });
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
pub async fn baslat(app: AppHandle, client: Client) -> Sonuc<(Option<Arc<SyncService>>, Vec<JoinHandle<()>>)> {
    let mut gorevler = Vec::new();
    durum_yayinla(&app, EsitlemeDurumuAdi::Basliyor, None);

    let sliding = matches!(client.sliding_sync_version(), matrix_sdk::sliding_sync::Version::Native);
    let servis = if sliding {
        info!("sliding sync kullanılıyor");
        // `with_offline_mode`: when the network drops, the service goes `Offline` and retries by itself.
        // `with_offline_mode`: ağ kopunca servis `Offline` olur ve kendiliğinden yeniden dener.
        let servis = Arc::new(SyncService::builder(client.clone()).with_offline_mode().build().await?);
        servis.start().await;
        let mut durumlar = servis.state();
        let app2 = app.clone();
        gorevler.push(tokio::spawn(async move {
            while let Some(d) = durumlar.next().await {
                match d {
                    State::Idle => durum_yayinla(&app2, EsitlemeDurumuAdi::Basliyor, None),
                    State::Running => durum_yayinla(&app2, EsitlemeDurumuAdi::Calisiyor, None),
                    State::Offline | State::Terminated => durum_yayinla(&app2, EsitlemeDurumuAdi::Cevrimdisi, None),
                    State::Error(e) => durum_yayinla(&app2, EsitlemeDurumuAdi::Hata, Some(e.to_string())),
                }
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
