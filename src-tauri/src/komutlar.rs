//! Thin `#[tauri::command]` layer: validates nothing itself, just wires UI calls to `matrix::*`.
//! İnce `#[tauri::command]` katmanı: kendisi bir şey doğrulamaz, arayüz çağrılarını `matrix::*`a bağlar.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};
use tracing::warn;

use crate::{
    bildirim,
    durum::{AktifOturum, AppState, ParkliOturum},
    hata::{Hata, Sonuc},
    matrix::{arama, cihaz_giris, dizin, esitleme, hesaplar::Hesaplar, medya, odalar, oturum, sifreleme, zaman},
    tipler::{
        AramaGonderIstegi, Ben, DizinDurumu, DogrulamaDurumu, MesajAramaSonucu, GirisIstegi, MedyaGonderIstegi, MedyaYetenekleri, MesajGonderIstegi, OdaBilgisi, OdaOzeti, SifrelemeDurumu,
        TurnSunucu, VideoSikistirIstegi, VideoSonucu,
    },
};

/// Data folder of the app (all accounts) · Uygulamanın veri klasörü (bütün hesaplar)
fn kok_dizin(app: &AppHandle) -> Sonuc<PathBuf> {
    let d = app.path().app_data_dir()?;
    let ek = crate::profil_eki();
    Ok(if ek.is_empty() { d } else { d.join(format!("profil{ek}")) })
}

/// Data folder of the account in use · Kullanımdaki hesabın veri klasörü
fn veri_dizini(app: &AppHandle) -> Sonuc<PathBuf> {
    let kok = kok_dizin(app)?;
    Ok(Hesaplar::oku(&kok).klasor(&kok))
}

/// Puts the account in use on the list. A failure must not stop the login. · Kullanımdaki hesabı listeye koyar. Hata girişi durdurmamalı.
fn hesabi_kaydet(app: &AppHandle, ben: &Ben) {
    let sonuc = kok_dizin(app).and_then(|kok| {
        let mut h = Hesaplar::oku(&kok);
        h.kaydet(ben);
        h.yaz(&kok)
    });
    if let Err(e) = sonuc {
        warn!("hesap listesi yazılamadı: {e}");
    }
}

/// Async version of `hesabi_kaydet` so async commands do not block Tokio when writing `hesaplar.json`.
/// `hesabi_kaydet`'in async sürümü; async komutlar `hesaplar.json` yazarken Tokio'yu bloklamasın.
async fn hesabi_kaydet_async(app: &AppHandle, ben: Ben) {
    let app = app.clone();
    let _ = tokio::task::spawn_blocking(move || hesabi_kaydet(&app, &ben)).await;
}

/// Stores the client, starts syncing and the token watcher. Called after login, after restore and (with `parkli`) on return to an account.
/// İstemciyi saklar, eşitlemeyi ve belirteç izleyiciyi başlatır. Girişten, geri yüklemeden ve (`parkli` ile) hesaba dönüşte çağrılır.
async fn oturumu_baslat(app: &AppHandle, durum: &AppState, client: matrix_sdk::Client, parkli: &mut Option<ParkliOturum>) -> Sonuc<()> {
    let veri = veri_dizini(app)?;
    let donus = parkli.is_some();
    // Event handlers live as long as the client: a returning one still has them. · Olay işleyicileri istemci kadar yaşar: dönen istemcide hâlâ var.
    if !donus {
        arama::kaydet(app.clone(), &client);
        crate::matrix::ec::kaydet(app.clone(), &client);
        bildirim::kaydet(app.clone(), &client);
    }
    let (servis, mut gorevler) = esitleme::baslat(app.clone(), client.clone()).await?;
    gorevler.extend(sifreleme::baslat(app.clone(), client.clone(), !donus));
    // Taken only now: had syncing failed, the parked account would stay whole. · Ancak şimdi alınır: eşitleme başlamasaydı park edilmiş hesap bütün kalırdı.
    let (dizin, kalici) = match parkli.take() {
        Some(p) => (p.dizin, p.kalici),
        None => {
            let mut kalici = vec![oturum::token_izle(app.clone(), veri.clone(), client.clone()), crate::matrix::kuyruk::izle(client.clone())];
            // The search index is optional: a failure must not stop the login. · Arama dizini isteğe bağlıdır: hata girişi durdurmamalı.
            let d = match dizin::baslat(&client, &veri).await {
                Ok((d, g)) => {
                    kalici.extend(g);
                    Some(d)
                }
                Err(e) => {
                    warn!("mesaj arama dizini başlatılamadı: {e}");
                    None
                }
            };
            (d, kalici)
        }
    };
    *durum.dizin.lock().unwrap_or_else(|e| e.into_inner()) = dizin;
    *durum.oturum.write().await = Some(AktifOturum { client, esitleme: servis, gorevler, kalici });
    Ok(())
}

/// Closes everything tied to the account in use and hands out what is left of it. · Kullanımdaki hesaba bağlı her şeyi kapatır, ondan kalanı verir.
async fn oturumu_birak(durum: &AppState) -> Option<ParkliOturum> {
    zaman::hepsini_kapat(durum).await;
    // A running Element Call widget must not outlive the session. · Süren Element Call widget'ı oturumdan uzun yaşamamalı.
    crate::matrix::ec::hepsini_kapat();
    crate::matrix::yerel_arama::yerel_arama_kapat().await;
    *durum.alan_servisi.lock().await = None;
    *durum.turn.lock().await = None;
    sifreleme::temizle(durum).await;
    // Nothing of this account may leak into the next one: media keys, call history, notifications, the decrypted file.
    // Bu hesaba ait hiçbir şey sonrakine sızmamalı: medya anahtarları, arama geçmişi, bildirimler, çözülmüş dosya.
    *durum.medya_kaynaklari.lock().unwrap_or_else(|e| e.into_inner()) = Default::default();
    durum.arama_gecmisi.lock().unwrap_or_else(|e| e.into_inner()).clear();
    crate::medya::temizle();
    crate::bildirim::hepsini_temizle();
    let o = durum.oturum.write().await.take()?;
    esitleme::durdur(o.esitleme, o.gorevler).await;
    let dizin = durum.dizin.lock().unwrap_or_else(|e| e.into_inner()).take();
    Some(ParkliOturum { client: o.client, dizin, kalici: o.kalici })
}

/// A parked session of the account in use that failed to wake up must stop before its folder is reused or deleted
/// (a new login wipes it, a logout removes it). · Kullanımdaki hesabın uyanamamış park oturumu, klasörü yeniden kullanılmadan
/// ya da silinmeden önce durmalı (yeni giriş onu siler, çıkış kaldırır).
async fn aktif_parki_al(app: &AppHandle, durum: &AppState) -> Option<ParkliOturum> {
    let aktif = Hesaplar::oku(&kok_dizin(app).ok()?).aktif;
    durum.parklar.lock().await.remove(&aktif)
}

async fn parki_kapat(p: ParkliOturum) {
    for g in p.kalici {
        g.abort();
    }
    if let Some(d) = p.dizin {
        d.durdur().await;
    }
}

#[tauri::command]
pub fn hesaplari_al(app: AppHandle) -> Sonuc<Hesaplar> {
    Ok(Hesaplar::oku(&kok_dizin(&app)?))
}

/// Turns to another account (`id`), or to an empty place to sign in to a new one (`None`). The page reloads afterwards and restores it.
/// Başka bir hesaba (`id`) ya da yeni hesaba girmek için boş bir yere (`None`) döner. Sayfa ardından yenilenir ve onu geri yükler.
#[tauri::command]
pub async fn hesap_degistir(app: AppHandle, durum: State<'_, AppState>, id: Option<String>) -> Sonuc<()> {
    let _kilit = durum.kilit.lock().await;
    let kok = kok_dizin(&app)?;
    let mut h = Hesaplar::oku(&kok);
    let eski = h.aktif.clone();
    match id {
        Some(id) if id == eski => return Ok(()),
        Some(id) => {
            if !h.liste.iter().any(|x| x.id == id) {
                return Err(Hata::OturumYok);
            }
            h.aktif = id;
        }
        None => h.yeni_yer(),
    }
    cihaz_giris::iptal();
    if let Some(p) = oturumu_birak(&durum).await {
        durum.parklar.lock().await.insert(eski, p);
    }
    h.yaz_async(kok).await
}

#[tauri::command]
pub async fn giris(app: AppHandle, durum: State<'_, AppState>, istek: GirisIstegi) -> Sonuc<Ben> {
    let _kilit = durum.kilit.lock().await;
    if let Some(p) = aktif_parki_al(&app, &durum).await {
        parki_kapat(p).await;
    }
    let veri = veri_dizini(&app)?;
    let (client, ben) = oturum::sifreyle_giris(&veri, &istek.sunucu, &istek.kullanici, &istek.sifre).await?;
    // A phone login still waiting would otherwise go on asking the server. · Yoksa bekleyen telefonla giriş sunucuya sormayı sürdürürdü.
    cihaz_giris::iptal();
    oturumu_baslat(&app, &durum, client, &mut None).await?;
    hesabi_kaydet_async(&app, ben.clone()).await;
    Ok(ben)
}

/// Sign in with the phone (see matrix/cihaz_giris.rs). · Telefonla giriş (bkz. matrix/cihaz_giris.rs).
#[tauri::command]
pub async fn cihaz_girisi_baslat(sunucu: String) -> Sonuc<cihaz_giris::CihazKodu> {
    cihaz_giris::baslat(&sunucu).await
}

/// Returns when the user approved in the browser. · Kullanıcı tarayıcıda onaylayınca döner.
#[tauri::command]
pub async fn cihaz_girisi_bekle(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<Ben> {
    let onay = cihaz_giris::bekle().await?;
    let _kilit = durum.kilit.lock().await;
    // Cancelled (or restarted) while we waited for the lock: do not sign the person in. · Kilidi beklerken iptal edildi (ya da yeniden başlatıldı): kişiyi içeri alma.
    if !cihaz_giris::hala_gecerli(&onay) {
        return Err(Hata::Diger("iptal".into()));
    }
    // A password login may have won meanwhile: its data must not be wiped. · Bu arada şifreyle girilmiş olabilir: onun verisi silinmemeli.
    if durum.oturum.read().await.is_some() {
        return Err(Hata::Diger("iptal".into()));
    }
    if let Some(p) = aktif_parki_al(&app, &durum).await {
        parki_kapat(p).await;
    }
    let veri = veri_dizini(&app)?;
    let (client, ben) = cihaz_giris::bitir(&veri, onay).await?;
    oturumu_baslat(&app, &durum, client, &mut None).await?;
    hesabi_kaydet_async(&app, ben.clone()).await;
    Ok(ben)
}

#[tauri::command]
pub fn cihaz_girisi_iptal() {
    cihaz_giris::iptal();
}

static ILK_GERI_YUKLEME_YAPILDI: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub async fn oturumu_geri_yukle(app: AppHandle) -> Sonuc<Option<Ben>> {
    geri_yukle(app).await
}

/// The restore itself. The desktop also starts it from `setup`, before the page has even loaded (that alone took ~3.5 s), so the
/// page's own call usually finds the session already running and only reports who we are.
/// Geri yüklemenin kendisi. Masaüstü bunu sayfa daha yüklenmeden `setup`'tan da başlatır (yalnızca o ~3,5 sn sürüyordu); sayfanın
/// kendi çağrısı çoğu zaman oturumu zaten çalışır bulur ve yalnızca kim olduğumuzu bildirir.
pub async fn geri_yukle(app: AppHandle) -> Sonuc<Option<Ben>> {
    let durum = app.state::<AppState>();
    // Commands that come meanwhile wait for this (see AppState::client); the guard ends that on every return.
    // Bu arada gelen komutlar bunu bekler (bkz. AppState::client); bekçi her dönüşte bunu bitirir.
    let _bekci = durum.geri_yukleme_basladi();
    let bas = std::time::Instant::now();
    let _kilit = durum.kilit.lock().await;
    if durum.oturum.read().await.is_some() {
        // Already running (e.g. the page was reloaded in dev): just report who we are.
        // Zaten çalışıyor (ör. geliştirmede sayfa yenilendi): sadece kim olduğumuzu bildir.
        let veri = veri_dizini(&app)?;
        let client = durum.client().await?;
        return Ok(Some(oturum::ben_olustur(&client, &veri)));
    }
    // First start of the process on an empty place left by an unfinished "add account": go back to a real account.
    // Sürecin ilk açılışı, yarım kalmış "hesap ekle"nin boş yerinde: gerçek bir hesaba dön.
    if !ILK_GERI_YUKLEME_YAPILDI.swap(true, std::sync::atomic::Ordering::SeqCst) {
        let kok = kok_dizin(&app)?;
        let mut h = Hesaplar::oku(&kok);
        if !h.liste.is_empty() && !h.liste.iter().any(|x| x.id == h.aktif) {
            h.aktif = h.liste[0].id.clone();
            h.yaz(&kok)?;
        }
    }
    let veri = veri_dizini(&app)?;
    let aktif = Hesaplar::oku(&kok_dizin(&app)?).aktif;
    let parkli = durum.parklar.lock().await.remove(&aktif);
    if let Some(p) = parkli {
        let client = p.client.clone();
        let ben = oturum::ben_olustur(&client, &veri);
        let mut parkli = Some(p);
        let sonuc = oturumu_baslat(&app, &durum, client, &mut parkli).await;
        if let Some(p) = parkli {
            durum.parklar.lock().await.insert(aktif, p);
        }
        return sonuc.map(|()| Some(ben));
    }
    match oturum::geri_yukle(&veri).await? {
        Some((client, ben)) => {
            let yuklendi = bas.elapsed();
            oturumu_baslat(&app, &durum, client, &mut None).await?;
            tracing::info!(
                "açılış: geri yükleme isteği süreç başlangıcından {} ms sonra; oturum {} ms, eşitleme başladı {} ms",
                crate::calisma_suresi_ms() - bas.elapsed().as_millis(),
                yuklendi.as_millis(),
                bas.elapsed().as_millis()
            );
            hesabi_kaydet(&app, &ben);
            Ok(Some(ben))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn cikis(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<()> {
    let _kilit = durum.kilit.lock().await;
    let kok = kok_dizin(&app)?;
    let veri = veri_dizini(&app)?;
    let acik = oturumu_birak(&durum).await;
    let p = match acik {
        Some(p) => Some(p),
        None => aktif_parki_al(&app, &durum).await,
    };
    if let Some(p) = p {
        let client = p.client.clone();
        // The writer must release the index files before `oturum::cikis` deletes the folder. · Yazıcı, `oturum::cikis` klasörü silmeden önce dizin dosyalarını bırakmalı.
        parki_kapat(p).await;
        oturum::cikis(&veri, &client).await;
    } else {
        warn!("çıkış istendi ama açık oturum yok");
    }
    let mut h = Hesaplar::oku(&kok);
    h.aktifi_sil();
    h.yaz_async(kok).await
}

#[tauri::command]
pub async fn ben(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<Ben> {
    // Noted before the network wait: if the account changes meanwhile, this answer must not land on the other one's entry.
    // Ağ beklemesinden önce not edilir: bu arada hesap değişirse bu yanıt ötekinin kaydına yazılmamalı.
    let aktif_bas = Hesaplar::oku(&kok_dizin(&app)?).aktif;
    let client = durum.client().await?;
    let mut ben = oturum::ben_olustur_async(&client, veri_dizini(&app)?).await;
    // Display name needs the network; a short timeout keeps the screen responsive when offline.
    // Görünen ad ağ ister; kısa zaman aşımı, çevrimdışıyken ekranın takılmasını önler.
    // Name and avatar are fetched together; the avatar falls back to the SDK's cached value when offline.
    // Ad ve avatar birlikte alınır; çevrimdışıyken avatar SDK'nın önbellekteki değerine düşer.
    let hesap = client.account();
    let sure = std::time::Duration::from_secs(3);
    let (ad, avatar) = tokio::join!(tokio::time::timeout(sure, hesap.get_display_name()), tokio::time::timeout(sure, hesap.get_avatar_url()));
    ben.gorunen_ad = ad.ok().and_then(|r| r.ok()).flatten();
    let avatar = match avatar.ok().and_then(|r| r.ok()).flatten() {
        Some(a) => Some(a),
        None => hesap.get_cached_avatar_url().await.ok().flatten(),
    };
    ben.avatar_mxc = avatar.map(|a| a.to_string());
    if Hesaplar::oku(&kok_dizin(&app)?).aktif == aktif_bas && durum.client().await.is_ok_and(|c| c.user_id() == client.user_id()) {
        hesabi_kaydet_async(&app, ben.clone()).await;
    }
    Ok(ben)
}

#[tauri::command]
pub async fn odalari_al(durum: State<'_, AppState>) -> Sonuc<Vec<OdaOzeti>> {
    let client = durum.client().await?;
    Ok(odalar::liste(&client).await)
}

/// Last announced sync state (see `esitleme::son_durum`). · Duyurulan son eşitleme durumu.
#[tauri::command]
pub fn esitleme_durumu() -> Option<crate::tipler::EsitlemeDurumu> {
    esitleme::son_durum()
}

/// Pin / unpin a room: the Matrix `m.favourite` tag, so it follows the account to other clients.
/// Odayı sabitle / kaldır: Matrix `m.favourite` etiketi; hesapla birlikte öbür istemcilere de gider.
#[tauri::command]
pub async fn oda_sabitle(app: AppHandle, durum: State<'_, AppState>, oda_id: String, sabit: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let id = matrix_sdk::ruma::RoomId::parse(&oda_id)?;
    if let Some(oda) = client.get_room(&id) {
        oda.set_is_favourite(sabit, None).await?;
    }
    esitleme::odalari_yayinla(&app, &client).await;
    Ok(())
}

#[tauri::command]
pub async fn odayi_ac(app: AppHandle, durum: State<'_, AppState>, oda_id: String) -> Sonuc<OdaBilgisi> {
    let client = durum.client().await?;
    // Its system notification is no longer needed once the room is open. · Oda açılınca sistem bildirimine artık gerek yok.
    bildirim::oda_acildi(&oda_id);
    zaman::ac(app, &durum, &client, &oda_id).await
}

#[tauri::command]
pub async fn odayi_kapat(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    zaman::kapat(&durum, &oda_id).await
}

#[tauri::command]
pub async fn geri_sayfala(app: AppHandle, durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    zaman::geri_sayfala(app, &durum, &oda_id).await
}

/// Message search. `sinir` defaults to 50. Returns an empty list when the index is not ready.
/// Mesaj araması. `sinir` varsayılanı 50. Dizin hazır değilse boş liste döner.
#[tauri::command]
pub async fn mesaj_ara(durum: State<'_, AppState>, sorgu: String, oda_id: Option<String>, sinir: Option<u32>) -> Sonuc<Vec<MesajAramaSonucu>> {
    let d = durum.dizin.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let Some(d) = d else { return Ok(Vec::new()) };
    let sinir = sinir.unwrap_or(50) as usize;
    tokio::task::spawn_blocking(move || d.ara(&sorgu, oda_id.as_deref(), sinir)).await.map_err(|e| Hata::Diger(e.to_string()))?
}

#[tauri::command]
pub fn dizin_durumu(durum: State<'_, AppState>) -> DizinDurumu {
    let d = durum.dizin.lock().unwrap_or_else(|e| e.into_inner()).clone();
    DizinDurumu { belge_sayisi: d.as_ref().map(|d| d.belge_sayisi()).unwrap_or(0), dolduruluyor: d.is_some_and(|d| d.dolduruluyor()) }
}

/// Loads history until `olay_id` is in the open room's timeline (jump to a search result). `false` = not found within the limit.
/// `olay_id` açık odanın çizelgesine girene dek geçmişi yükler (arama sonucuna atlama). `false` = sınır içinde bulunamadı.
#[tauri::command]
pub async fn olaya_git(app: AppHandle, durum: State<'_, AppState>, oda_id: String, olay_id: String) -> Sonuc<bool> {
    zaman::olaya_git(app, &durum, &oda_id, &olay_id).await
}

#[tauri::command]
pub async fn mesaj_gonder(durum: State<'_, AppState>, istek: MesajGonderIstegi) -> Sonuc<()> {
    zaman::mesaj_gonder(&durum, istek).await
}

#[tauri::command]
pub async fn okundu_isaretle(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    zaman::okundu_isaretle(&durum, &oda_id).await
}

#[tauri::command]
pub async fn mesaj_yeniden_dene(durum: State<'_, AppState>, oda_id: String, oge_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    zaman::yeniden_dene(&client, &durum, &oda_id, &oge_id).await
}

#[tauri::command]
pub async fn arama_turn_sunuculari(durum: State<'_, AppState>) -> Sonuc<Vec<TurnSunucu>> {
    let client = durum.client().await?;
    arama::turn_sunuculari(&durum, &client).await
}

#[tauri::command]
pub async fn arama_olayi_gonder(durum: State<'_, AppState>, istek: AramaGonderIstegi) -> Sonuc<()> {
    let client = durum.client().await?;
    arama::gonder(&client, istek).await
}

// ---- End-to-end encryption · Uçtan uca şifreleme ----

#[tauri::command]
pub async fn sifreleme_durumu(durum: State<'_, AppState>) -> Sonuc<SifrelemeDurumu> {
    let client = durum.client().await?;
    Ok(sifreleme::durum_hesapla(&durum, &client).await)
}

#[tauri::command]
pub async fn capraz_imza_kur(app: AppHandle, durum: State<'_, AppState>, parola: String) -> Sonuc<()> {
    let client = durum.client().await?;
    sifreleme::capraz_imza_kur(&app, &client, parola).await
}

#[tauri::command]
pub async fn kurtarma_olustur(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<String> {
    let client = durum.client().await?;
    sifreleme::kurtarma_olustur(&app, &client).await
}

#[tauri::command]
pub async fn kurtarma_kurtar(app: AppHandle, durum: State<'_, AppState>, anahtar: String) -> Sonuc<()> {
    let client = durum.client().await?;
    sifreleme::kurtarma_kurtar(&app, &client, &anahtar).await
}

#[tauri::command]
pub async fn dogrulama_baslat(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<()> {
    let client = durum.client().await?;
    sifreleme::dogrulama_baslat(&app, &client).await
}

#[tauri::command]
pub async fn dogrulama_kabul_et(app: AppHandle) -> Sonuc<()> {
    sifreleme::dogrulama_kabul_et(&app).await
}

#[tauri::command]
pub async fn dogrulama_onayla(app: AppHandle) -> Sonuc<()> {
    sifreleme::dogrulama_onayla(&app).await
}

#[tauri::command]
pub async fn dogrulama_eslesmiyor(app: AppHandle) -> Sonuc<()> {
    sifreleme::dogrulama_eslesmiyor(&app).await
}

#[tauri::command]
pub async fn dogrulama_iptal(app: AppHandle) -> Sonuc<()> {
    sifreleme::dogrulama_iptal(&app).await
}

#[tauri::command]
pub async fn dogrulama_durumu(app: AppHandle) -> Sonuc<DogrulamaDurumu> {
    Ok(sifreleme::dogrulama_durumu(&app).await)
}

// ---- Media sending · Medya gönderme ----

#[tauri::command]
pub fn medya_yetenekleri() -> MedyaYetenekleri {
    MedyaYetenekleri { video_sikistirma: cfg!(target_os = "android"), sistem_bildirimi: cfg!(target_os = "android") }
}

/// Appends one base64 chunk to a cache file; `kimlik: null` starts a new one. Returns the file id.
/// Önbellek dosyasına bir base64 parçası ekler; `kimlik: null` yenisini başlatır. Dosya kimliğini döndürür.
#[tauri::command]
pub async fn medya_parca_yaz(app: AppHandle, kimlik: Option<String>, uzanti: String, veri: String) -> Sonuc<String> {
    medya::parca_yaz(&app, kimlik, &uzanti, veri).await
}

#[tauri::command]
pub async fn medya_temizle(app: AppHandle, kimlikler: Vec<String>) {
    medya::temizle_async(&app, kimlikler).await;
}

#[tauri::command]
pub async fn medya_gonder(app: AppHandle, durum: State<'_, AppState>, istek: MedyaGonderIstegi) -> Sonuc<()> {
    let client = durum.client().await?;
    medya::gonder(&app, &durum, &client, istek).await
}

#[tauri::command]
pub async fn medya_gonderimi_iptal(durum: State<'_, AppState>, oda_id: String, oge_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    medya::gonderimi_iptal(&durum, &client, &oda_id, &oge_id).await
}

#[tauri::command]
pub async fn video_sikistir(app: AppHandle, istek: VideoSikistirIstegi) -> Sonuc<VideoSonucu> {
    medya::video_sikistir(&app, istek).await
}

#[tauri::command]
pub fn video_sikistirmayi_iptal() {
    medya::video_iptal();
}

/// Saves a received media file to the gallery / downloads; returns the file name (Android) or the full path (desktop).
/// Alınan medya dosyasını galeriye / indirilenlere kaydeder; dosya adını (Android) ya da tam yolu (masaüstü) döndürür.
#[tauri::command]
pub async fn medya_kaydet(app: AppHandle, durum: State<'_, AppState>, kaynak_id: String) -> Sonuc<String> {
    medya::kaydet_telefona(&app, &durum, &kaynak_id).await
}

// ---- Notifications · Bildirimler ----

/// "verildi" | "verilmedi" | "desteklenmiyor" (desktop: no system notifications yet)
#[tauri::command]
pub fn bildirim_izni_durumu() -> &'static str {
    if cfg!(target_os = "linux") {
        "verildi"
    } else if !cfg!(target_os = "android") {
        "desteklenmiyor"
    } else if bildirim::izin_var() {
        "verildi"
    } else {
        "verilmedi"
    }
}

/// Shows the system permission dialog (Android 13+) and answers once the user chose.
/// Sistem izin penceresini gösterir (Android 13+) ve kullanıcı seçince cevap verir.
#[tauri::command]
pub async fn bildirim_izni_iste() -> &'static str {
    if !cfg!(target_os = "android") {
        "desteklenmiyor"
    } else if bildirim::izin_iste().await {
        "verildi"
    } else {
        "verilmedi"
    }
}

/// Opens the system notification settings of the app (for when the permission was denied for good).
/// Uygulamanın sistem bildirim ayarlarını açar (izin kalıcı reddedildiyse).
#[tauri::command]
pub fn bildirim_ayarlarini_ac() {
    if cfg!(target_os = "android") {
        crate::android_jni::bildirim_ayarlarini_ac();
    }
}

/// The room a tapped notification wants opened at cold start (consumed once). The UI calls it once at startup.
/// Dokunulan bildirimin soğuk açılışta açılmasını istediği oda (bir kez tüketilir). Arayüz açılışta bir kez çağırır.
#[tauri::command]
pub fn bildirim_bekleyen_oda() -> Option<String> {
    if cfg!(target_os = "android") { crate::android_jni::bekleyen_oda() } else { None }
}

/// The webview tells us when the window is hidden / shown again (desktop banner logic; Android uses its own lifecycle).
/// Webview pencere gizlenince / yeniden görününce bildirir (masaüstü şerit mantığı; Android kendi yaşam döngüsünü kullanır).
#[tauri::command]
pub fn uygulama_arka_planda(durum: State<'_, AppState>, arka_planda: bool) {
    durum.arka_planda.store(arka_planda, std::sync::atomic::Ordering::Relaxed);
}

// Keeps `Hata` imported for the `Sonuc` alias users above. · Yukarıdaki `Sonuc` kullanımı için `Hata` içe aktarımı.
#[allow(dead_code)]
type _Hata = Hata;

/// Desktop Linux clipboard (see masaustu_linux.rs); the other platforms use the webview's own. `false` = not written.
/// Masaüstü Linux panosu (bkz. masaustu_linux.rs); öteki platformlar webview'inkini kullanır. `false` = yazılmadı.
#[tauri::command]
pub fn pano_yaz(app: AppHandle, metin: String) -> bool {
    #[cfg(target_os = "linux")]
    return crate::masaustu_linux::pano_yaz(&app, metin);
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, metin);
        false
    }
}

/// PNG bytes of the picture on the clipboard; empty = there is none. · Panodaki resmin PNG baytları; boş = resim yok.
#[tauri::command]
pub async fn pano_resim(app: AppHandle) -> Result<tauri::ipc::Response, ()> {
    #[cfg(target_os = "linux")]
    let bayt = crate::masaustu_linux::pano_resim(&app).await.unwrap_or_default();
    #[cfg(not(target_os = "linux"))]
    let bayt = {
        let _ = app;
        Vec::<u8>::new()
    };
    Ok(tauri::ipc::Response::new(bayt))
}
