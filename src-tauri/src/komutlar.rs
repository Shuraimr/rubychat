//! Thin `#[tauri::command]` layer: validates nothing itself, just wires UI calls to `matrix::*`.
//! İnce `#[tauri::command]` katmanı: kendisi bir şey doğrulamaz, arayüz çağrılarını `matrix::*`a bağlar.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};
use tracing::warn;

use crate::{
    bildirim,
    durum::{AktifOturum, AppState},
    hata::{Hata, Sonuc},
    matrix::{arama, esitleme, medya, odalar, oturum, sifreleme, zaman},
    tipler::{
        AramaGonderIstegi, Ben, DogrulamaDurumu, GirisIstegi, MedyaGonderIstegi, MedyaYetenekleri, OdaBilgisi, OdaOzeti, SifrelemeDurumu,
        TurnSunucu, VideoSikistirIstegi, VideoSonucu,
    },
};

fn veri_dizini(app: &AppHandle) -> Sonuc<PathBuf> {
    Ok(app.path().app_data_dir()?)
}

/// Stores the client, starts syncing and the token watcher. Called after login and after restore.
/// İstemciyi saklar, eşitlemeyi ve belirteç izleyiciyi başlatır. Girişten ve geri yüklemeden sonra çağrılır.
async fn oturumu_baslat(app: &AppHandle, durum: &AppState, client: matrix_sdk::Client) -> Sonuc<()> {
    let veri = veri_dizini(app)?;
    arama::kaydet(app.clone(), &client);
    bildirim::kaydet(app.clone(), &client);
    let (servis, mut gorevler) = esitleme::baslat(app.clone(), client.clone()).await?;
    gorevler.push(oturum::token_izle(veri, client.clone()));
    gorevler.extend(sifreleme::baslat(app.clone(), client.clone()));
    *durum.oturum.write().await = Some(AktifOturum { client, esitleme: servis, gorevler });
    Ok(())
}

#[tauri::command]
pub async fn giris(app: AppHandle, durum: State<'_, AppState>, istek: GirisIstegi) -> Sonuc<Ben> {
    let _kilit = durum.kilit.lock().await;
    let veri = veri_dizini(&app)?;
    let (client, ben) = oturum::sifreyle_giris(&veri, &istek.sunucu, &istek.kullanici, &istek.sifre).await?;
    oturumu_baslat(&app, &durum, client).await?;
    Ok(ben)
}

#[tauri::command]
pub async fn oturumu_geri_yukle(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<Option<Ben>> {
    let _kilit = durum.kilit.lock().await;
    if durum.oturum.read().await.is_some() {
        // Already running (e.g. the page was reloaded in dev): just report who we are.
        // Zaten çalışıyor (ör. geliştirmede sayfa yenilendi): sadece kim olduğumuzu bildir.
        let veri = veri_dizini(&app)?;
        let client = durum.client().await?;
        return Ok(Some(oturum::ben_olustur(&client, &veri)));
    }
    let veri = veri_dizini(&app)?;
    match oturum::geri_yukle(&veri).await? {
        Some((client, ben)) => {
            oturumu_baslat(&app, &durum, client).await?;
            Ok(Some(ben))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn cikis(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<()> {
    let _kilit = durum.kilit.lock().await;
    let veri = veri_dizini(&app)?;
    zaman::hepsini_kapat(&durum).await;
    sifreleme::temizle(&durum).await;
    if let Some(o) = durum.oturum.write().await.take() {
        esitleme::durdur(o.esitleme, o.gorevler).await;
        oturum::cikis(&veri, &o.client).await;
    } else {
        warn!("çıkış istendi ama açık oturum yok");
    }
    Ok(())
}

#[tauri::command]
pub async fn ben(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<Ben> {
    let client = durum.client().await?;
    let mut ben = oturum::ben_olustur(&client, &veri_dizini(&app)?);
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
    Ok(ben)
}

#[tauri::command]
pub async fn odalari_al(durum: State<'_, AppState>) -> Sonuc<Vec<OdaOzeti>> {
    let client = durum.client().await?;
    Ok(odalar::liste(&client).await)
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

#[tauri::command]
pub async fn mesaj_gonder(durum: State<'_, AppState>, oda_id: String, metin: String) -> Sonuc<()> {
    zaman::mesaj_gonder(&durum, &oda_id, &metin).await
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
    medya::parca_yaz(&app, kimlik, &uzanti, &veri).await
}

#[tauri::command]
pub fn medya_temizle(app: AppHandle, kimlikler: Vec<String>) {
    medya::temizle(&app, &kimlikler);
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
    if !cfg!(target_os = "android") {
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
