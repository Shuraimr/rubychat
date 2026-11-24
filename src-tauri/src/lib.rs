//! rubychat backend: a thin Tauri shell around matrix-rust-sdk.
//! rubychat arka ucu: matrix-rust-sdk'nın etrafında ince bir Tauri kabuğu.

mod android_jni;
mod bildirim;
mod dil;
mod durum;
mod gizli_depo;
mod hata;
mod komutlar;
mod matrix;
mod medya;
mod tipler;

use tauri::Manager;

/// Logs go to stdout on desktop and to logcat (tag "rubychat") on Android, where stdout is discarded.
/// Günlükler masaüstünde stdout'a, Android'de logcat'e ("rubychat" etiketi) gider; Android stdout'u atar.
fn gunlukleri_baslat() {
    let filtre = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "rubychat_lib=info,matrix_sdk=warn".into());
    #[cfg(target_os = "android")]
    {
        use tracing_logcat::{LogcatMakeWriter, LogcatTag};
        let yazici = LogcatMakeWriter::new(LogcatTag::Fixed("rubychat".to_owned())).expect("logcat");
        tracing_subscriber::fmt().with_env_filter(filtre).with_writer(yazici).with_ansi(false).without_time().init();
    }
    #[cfg(not(target_os = "android"))]
    tracing_subscriber::fmt().with_env_filter(filtre).init();

    // A panic inside an async command would otherwise vanish silently and leave the UI waiting forever.
    // Async bir komuttaki panik aksi hâlde sessizce kaybolur ve arayüz sonsuza dek bekler.
    std::panic::set_hook(Box::new(|bilgi| tracing::error!("panik: {bilgi}")));
}

/// Android only: hand the JVM + app context to rustls-platform-verifier before any HTTPS request.
/// Without this the first request (login) panics with "Expect rustls-platform-verifier to be initialized".
/// Yalnızca Android: herhangi bir HTTPS isteğinden önce JVM'i ve uygulama bağlamını rustls-platform-verifier'a ver.
/// Bu yapılmazsa ilk istek (giriş) "Expect rustls-platform-verifier to be initialized" paniğiyle çöker.
#[cfg(target_os = "android")]
fn android_tls_baslat() -> Result<(), String> {
    use jni22::{objects::JObject, JavaVM};
    let baglam = ndk_context::android_context();
    // SAFETY: ndk_context holds valid global pointers to the JavaVM and the Activity for the app's lifetime.
    // GÜVENLİK: ndk_context, uygulama boyunca geçerli JavaVM ve Activity işaretçilerini tutar.
    let vm = unsafe { JavaVM::from_raw(baglam.vm().cast()) };
    vm.attach_current_thread(|env| -> Result<(), jni22::errors::Error> {
        let ctx = unsafe { JObject::from_raw(env, baglam.context().cast()) };
        rustls_platform_verifier::android::init_with_env(env, ctx)
    })
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    gunlukleri_baslat();
    #[cfg(target_os = "android")]
    match android_tls_baslat() {
        Ok(()) => tracing::info!("TLS doğrulayıcı hazır"),
        Err(e) => tracing::error!("TLS doğrulayıcı başlatılamadı: {e}"),
    }

    tauri::Builder::default()
        // System browser for account pages (MAS). · Hesap sayfaları için sistem tarayıcısı (MAS).
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("medya", |ctx, istek, yanitci| {
            let app = ctx.app_handle().clone();
            tauri::async_runtime::spawn(async move { yanitci.respond(medya::sun(&app, istek).await) });
        })
        // Bundled Element Call, served with its own CSP (see matrix/ec.rs). · Paketlenmiş Element Call, kendi CSP'siyle sunulur (bkz. matrix/ec.rs).
        .register_asynchronous_uri_scheme_protocol("ec", |ctx, istek, yanitci| {
            let app = ctx.app_handle().clone();
            tauri::async_runtime::spawn(async move { yanitci.respond(matrix::ec::sun(&app, istek).await) });
        })
        .setup(|app| {
            app.manage(durum::AppState::default());
            // Linux: WebKitGTK ships WebRTC / media capture off; Element Call needs them. · Linux: WebKitGTK WebRTC / medya yakalamayı kapalı getirir; Element Call'un ihtiyacı var.
            #[cfg(target_os = "linux")]
            matrix::ec::linux_medya_ac(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            komutlar::giris,
            komutlar::oturumu_geri_yukle,
            komutlar::cikis,
            komutlar::ben,
            komutlar::odalari_al,
            komutlar::esitleme_durumu,
            komutlar::oda_sabitle,
            komutlar::odayi_ac,
            komutlar::odayi_kapat,
            komutlar::geri_sayfala,
            komutlar::mesaj_ara,
            komutlar::dizin_durumu,
            komutlar::olaya_git,
            komutlar::mesaj_gonder,
            komutlar::okundu_isaretle,
            komutlar::mesaj_yeniden_dene,
            komutlar::arama_turn_sunuculari,
            komutlar::arama_olayi_gonder,
            komutlar::sifreleme_durumu,
            komutlar::capraz_imza_kur,
            komutlar::kurtarma_olustur,
            komutlar::kurtarma_kurtar,
            komutlar::dogrulama_baslat,
            komutlar::dogrulama_kabul_et,
            komutlar::dogrulama_onayla,
            komutlar::dogrulama_eslesmiyor,
            komutlar::dogrulama_iptal,
            komutlar::dogrulama_durumu,
            komutlar::medya_yetenekleri,
            komutlar::medya_parca_yaz,
            komutlar::medya_temizle,
            komutlar::medya_gonder,
            komutlar::medya_gonderimi_iptal,
            komutlar::video_sikistir,
            komutlar::video_sikistirmayi_iptal,
            komutlar::medya_kaydet,
            komutlar::bildirim_izni_durumu,
            komutlar::bildirim_izni_iste,
            komutlar::bildirim_ayarlarini_ac,
            komutlar::bildirim_bekleyen_oda,
            komutlar::uygulama_arka_planda,
            matrix::uyeler::uyeleri_listele,
            matrix::uyeler::benim_yetkilerim,
            matrix::uyeler::uye_davet_et,
            matrix::uyeler::uye_cikar,
            matrix::uyeler::uye_yasakla,
            matrix::uyeler::yasak_kaldir,
            matrix::uyeler::guc_ayarla,
            matrix::uyeler::dm_ac,
            matrix::uyeler::oda_olustur,
            matrix::uyeler::oda_ayril,
            matrix::onyukle::odalari_hazirla,
            matrix::istekler::istekleri_al,
            matrix::istekler::davet_kabul,
            matrix::istekler::davet_reddet,
            matrix::istekler::katilma_istegi,
            matrix::istekler::katilma_yanitla,
            matrix::istekler::dil_ayarla,
            matrix::eylemler::tepki_degistir,
            matrix::eylemler::mesaj_sil,
            matrix::eylemler::mesaj_duzenle,
            matrix::eylemler::yaziyor_bildir,
            matrix::eylemler::mesaj_sabitle,
            matrix::eylemler::sabit_mesajlar,
            matrix::eylemler::anket_olustur,
            matrix::eylemler::anket_oy_ver,
            matrix::eylemler::anket_bitir,
            matrix::eylemler::mesaj_ilet,
            matrix::eylemler::cikartma_gonder,
            matrix::eylemler::varlik_durumu,
            matrix::paketler::emoji_paketleri,
            matrix::alanlar::alanlari_al,
            matrix::alanlar::alan_icerigi,
            matrix::alanlar::alana_katil,
            matrix::ec::ec_ac,
            matrix::ec::ec_gonder,
            matrix::ec::ec_kapat,
            matrix::ec::ec_aktif_aramalar,
            matrix::ec::ec_sunucu_destekliyor,
            matrix::profil::profil_ad_ayarla,
            matrix::profil::profil_avatar_ayarla,
            matrix::profil::profil_avatar_kaldir,
            matrix::profil::oturumlar_listele,
            matrix::profil::cihaz_yeniden_adlandir,
            matrix::profil::cihaz_cikis,
            matrix::profil::yedek_ayarla,
            matrix::profil::kurtarma_sifirla,
            matrix::profil::cikartma_paketine_ekle,
            matrix::profil::hesap_bilgisi,
            matrix::profil::sifre_degistir,
            matrix::profil::epostalar_listele,
            matrix::profil::eposta_sil,
            matrix::profil::hesap_kapat,
        ])
        .run(tauri::generate_context!())
        .expect("rubychat başlatılamadı");
}
