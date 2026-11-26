//! Desktop "keep running in the background" commands (the work itself is in masaustu_linux.rs; Android has its own service,
//! BaglantiServisi.kt, driven through the JS bridge). Elsewhere they do nothing, so the UI can call them everywhere.
//! Masaüstü "arka planda çalışmaya devam et" komutları (asıl iş masaustu_linux.rs'te; Android'in kendi servisi var, BaglantiServisi.kt,
//! JS köprüsüyle sürülür). Başka yerde hiçbir şey yapmazlar; arayüz her yerde çağırabilir.

use tauri::AppHandle;

/// `acik`: closing the window hides it. `acilista`: also start hidden at login (autostart entry through the portal).
/// `acik`: pencereyi kapatmak gizler. `acilista`: oturum açılınca da gizli başlat (portal üzerinden otomatik başlatma kaydı).
#[tauri::command]
pub async fn masaustu_arka_plan(acik: bool, acilista: bool) {
    #[cfg(target_os = "linux")]
    let _ = tauri::async_runtime::spawn_blocking(move || crate::masaustu_linux::arka_plan_ayarla(acik, acilista)).await;
    #[cfg(not(target_os = "linux"))]
    let _ = (acik, acilista);
}

/// Quits for real (Ctrl+Q, the settings button): the window's close button only hides it while running in the background.
/// Gerçekten çıkar (Ctrl+Q, ayarlardaki düğme): arka planda çalışırken pencerenin kapatma düğmesi yalnızca gizler.
#[tauri::command]
pub fn uygulamadan_cik(app: AppHandle) {
    app.exit(0);
}
