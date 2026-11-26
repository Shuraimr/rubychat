//! In-app sign-up page (desktop). matrix.org and other OAuth (MAS) servers do not let apps register accounts with their own form:
//! the account page does it (captcha, e-mail, terms). So the device login (matrix/cihaz_giris.rs) is started and its address is
//! opened here, in a separate window of the app instead of the browser. The first jump to `/login` (not signed in yet) is turned into
//! `/register` with the same query, so the person lands on "create account". When the login is approved the UI closes the window.
//! Android does the same with a native WebView dialog (KayitPenceresi.kt).
//! Uygulama içi kayıt sayfası (masaüstü). matrix.org ve diğer OAuth (MAS) sunucuları uygulamaların kendi formuyla hesap açmasına izin
//! vermez: bunu hesap sayfası yapar (captcha, e-posta, şartlar). Bu yüzden cihazla giriş (matrix/cihaz_giris.rs) başlatılır ve adresi
//! tarayıcı yerine uygulamanın ayrı bir penceresinde açılır. `/login`'e ilk sıçrayış (henüz oturum yok) aynı sorguyla `/register`'a
//! çevrilir; kişi doğrudan "hesap oluştur"a düşer. Giriş onaylanınca arayüz pencereyi kapatır. Android aynısını yerel bir WebView
//! penceresiyle yapar (KayitPenceresi.kt).

use tauri::AppHandle;

use crate::hata::{Hata, Sonuc};

#[cfg(desktop)]
const ETIKET: &str = "kayit";
/// Sent to the UI when the person closes the window themselves. · Kişi pencereyi kendisi kapatınca arayüze gönderilir.
#[cfg(desktop)]
pub const OLAY_KAPANDI: &str = "kayit-kapandi";

#[cfg(any(desktop, test))]
/// `/login?…` on the same host → `/register?…` (once). · Aynı sunucuda `/login?…` → `/register?…` (bir kez).
fn kayda_cevir(adres: &tauri::Url, ana: &str) -> Option<tauri::Url> {
    if adres.host_str() != Some(ana) || adres.path().trim_end_matches('/') != "/login" {
        return None;
    }
    let mut yeni = adres.clone();
    yeni.set_path("/register");
    Some(yeni)
}

#[tauri::command]
pub async fn kayit_penceresi_ac(app: AppHandle, adres: String, baslik: String) -> Sonuc<()> {
    #[cfg(mobile)]
    {
        // Android opens its own WebView dialog from the UI bridge. · Android kendi WebView penceresini arayüz köprüsünden açar.
        let _ = (app, adres, baslik);
        return Err(Hata::Diger("masaüstü değil".into()));
    }
    #[cfg(desktop)]
    ac(app, adres, baslik)
}

#[cfg(desktop)]
fn ac(app: AppHandle, adres: String, baslik: String) -> Sonuc<()> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

    let url: tauri::Url = adres.parse().map_err(|_| Hata::Diger("adres".into()))?;
    if url.scheme() != "https" {
        return Err(Hata::Diger("adres".into()));
    }
    if let Some(w) = app.get_webview_window(ETIKET) {
        let _ = w.close();
    }
    let ana = url.host_str().unwrap_or_default().to_owned();
    // Turned once: the register page links back to "sign in", which must then stay sign in.
    // Bir kez çevrilir: kayıt sayfası "giriş yap"a geri bağlantı verir; o zaman giriş olarak kalmalı.
    let cevrildi = Arc::new(AtomicBool::new(false));
    let uygulama = app.clone();
    let pencere = WebviewWindowBuilder::new(&app, ETIKET, WebviewUrl::External(url))
        .title(baslik)
        .inner_size(480.0, 760.0)
        .min_inner_size(360.0, 480.0)
        .on_navigation(move |adres| {
            if cevrildi.load(Ordering::SeqCst) {
                return true;
            }
            let Some(yeni) = kayda_cevir(adres, &ana) else { return true };
            cevrildi.store(true, Ordering::SeqCst);
            // Navigating from inside the callback is not allowed: do it right after. · Geri çağrının içinden gezinilmez: hemen sonra yapılır.
            let u = uygulama.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(w) = u.get_webview_window(ETIKET) {
                    let _ = w.navigate(yeni);
                }
            });
            false
        })
        .build()
        .map_err(|e| Hata::Diger(format!("kayıt penceresi: {e}")))?;
    let u = app.clone();
    pencere.on_window_event(move |olay| {
        if matches!(olay, WindowEvent::Destroyed) {
            let _ = u.emit(OLAY_KAPANDI, ());
        }
    });
    Ok(())
}

/// Closes it after a successful sign-up (no "closed" event matters then). · Başarılı kayıttan sonra kapatır.
#[tauri::command]
pub fn kayit_penceresi_kapat(app: AppHandle) {
    #[cfg(desktop)]
    if let Some(w) = tauri::Manager::get_webview_window(&app, ETIKET) {
        let _ = w.destroy();
    }
    #[cfg(mobile)]
    let _ = app;
}

#[cfg(test)]
mod testler {
    use super::kayda_cevir;

    #[test]
    fn yalnizca_ayni_sunucuda_login_cevrilir() {
        let a: tauri::Url = "https://account.matrix.org/login?kind=continue_device_code_grant&id=01X".parse().unwrap();
        assert_eq!(kayda_cevir(&a, "account.matrix.org").unwrap().as_str(), "https://account.matrix.org/register?kind=continue_device_code_grant&id=01X");
        assert!(kayda_cevir(&a, "baska.org").is_none());
        let b: tauri::Url = "https://account.matrix.org/link?code=AB".parse().unwrap();
        assert!(kayda_cevir(&b, "account.matrix.org").is_none());
    }
}
