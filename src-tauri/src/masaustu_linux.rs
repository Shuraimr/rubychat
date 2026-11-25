//! Linux desktop glue over D-Bus, with the GIO bindings WebKitGTK already brings (no new dependency):
//!  - one running copy: two processes on the same crypto store would corrupt each other's keys; a second start shows the first window.
//!  - system notifications through the desktop portal, which needs no extra permission inside Flatpak.
//! Linux masaüstü bağları, D-Bus üzerinden, WebKitGTK'nin zaten getirdiği GIO ile (yeni bağımlılık yok):
//!  - tek çalışan kopya: aynı şifreleme deposundaki iki süreç birbirinin anahtarlarını bozardı; ikinci açılış ilk pencereyi gösterir.
//!  - masaüstü portalıyla sistem bildirimi; Flatpak içinde ek izin istemez.

use tauri::{AppHandle, Manager};
use tracing::warn;
use webkit2gtk::{
    gio::{self, BusType, Cancellable, DBusCallFlags, DBusConnection, DBusSignalFlags},
    glib::{self, ToVariant, Variant, VariantDict},
};

const KIMLIK: &str = "dev.rubyyard.rubychat";
/// Bus name; a second profile is a copy of its own. · Veri yolu adı; ikinci profil kendi başına bir kopyadır.
fn ad() -> String {
    format!("{KIMLIK}{}", crate::profil_eki())
}
const YOL: &str = "/dev/rubyyard/rubychat";
const PORTAL: &str = "org.freedesktop.portal.Desktop";
const PORTAL_YOL: &str = "/org/freedesktop/portal/desktop";
const PORTAL_BILDIRIM: &str = "org.freedesktop.portal.Notification";

fn veriyolu() -> Result<DBusConnection, glib::Error> {
    gio::bus_get_sync(BusType::Session, Cancellable::NONE)
}

/// Call first. `false` = another copy is running and was asked to show itself: exit.
/// Önce çağır. `false` = başka kopya çalışıyor ve kendini göstermesi istendi: çık.
pub fn ilk_kopya_mi() -> bool {
    // The Wayland app id; it must match the .desktop file, or the window has no icon. · Wayland uygulama kimliği; .desktop dosyasıyla aynı olmalı, yoksa pencerenin simgesi olmaz.
    glib::set_prgname(Some(KIMLIK));
    let Ok(yol) = veriyolu() else { return true };
    // 4 = do not wait in the queue; the answer 3 = somebody else owns the name. · 4 = sırada bekleme; 3 yanıtı = ad başkasında.
    let istek = (ad(), 4u32).to_variant();
    let yanit = yol.call_sync(
        Some("org.freedesktop.DBus"),
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus",
        "RequestName",
        Some(&istek),
        None,
        DBusCallFlags::NONE,
        3000,
        Cancellable::NONE,
    );
    let sahip_baska = matches!(yanit, Ok(v) if v.child_value(0).get::<u32>() == Some(3));
    if sahip_baska {
        let _ = yol.emit_signal(None, YOL, &ad(), "Goster", None);
        let _ = yol.flush_sync(Cancellable::NONE);
        return false;
    }
    // The name lives as long as the connection. · Ad, bağlantı yaşadıkça durur.
    std::mem::forget(yol);
    true
}

fn pencereyi_goster(app: &AppHandle) {
    if let Some(p) = app.get_webview_window("main") {
        let _ = p.unminimize();
        let _ = p.show();
        let _ = p.set_focus();
    }
}

/// Listens for "show yourself" and for tapped notifications. Call on the main thread (setup).
/// "Kendini göster"i ve dokunulan bildirimleri dinler. Ana iş parçacığında çağır (setup).
pub fn dinle(app: &AppHandle) {
    let Ok(yol) = veriyolu() else { return };
    let a = app.clone();
    yol.signal_subscribe(None, Some(&ad()), Some("Goster"), Some(YOL), None, DBusSignalFlags::NONE, move |_, _, _, _, _, _| pencereyi_goster(&a));
    let a = app.clone();
    yol.signal_subscribe(
        Some(PORTAL),
        Some(PORTAL_BILDIRIM),
        Some("ActionInvoked"),
        Some(PORTAL_YOL),
        None,
        DBusSignalFlags::NONE,
        move |_, _, _, _, _, p| {
            pencereyi_goster(&a);
            let Some(oda) = p.child_value(0).get::<String>() else { return };
            // The same window event Android uses (bildirim-sistem.ts). · Android'in kullandığı pencere olayının aynısı (bildirim-sistem.ts).
            if let (Some(w), Ok(metin)) = (a.get_webview_window("main"), serde_json::to_string(&oda)) {
                let _ = w.eval(format!("window.dispatchEvent(new CustomEvent('rubychat-oda-ac', {{ detail: {metin} }}))"));
            }
        },
    );
    std::mem::forget(yol);
}

fn portal(yontem: &str, arg: &Variant) -> Result<(), glib::Error> {
    veriyolu()?
        .call_sync(Some(PORTAL), PORTAL_YOL, PORTAL_BILDIRIM, yontem, Some(arg), None, DBusCallFlags::NONE, 3000, Cancellable::NONE)
        .map(|_| ())
}

/// One notification per room: a newer message replaces it. · Oda başına bir bildirim: yeni mesaj eskisinin yerine geçer.
pub fn bildirim_goster(oda_id: &str, baslik: &str, metin: &str) {
    let d = VariantDict::new(None);
    d.insert("title", baslik);
    d.insert("body", metin);
    d.insert("default-action", "ac");
    let arg = Variant::tuple_from_iter([oda_id.to_variant(), d.end()]);
    if let Err(e) = portal("AddNotification", &arg) {
        warn!("bildirim gösterilemedi: {e}");
    }
}

pub fn bildirim_temizle(oda_id: &str) {
    let _ = portal("RemoveNotification", &(oda_id,).to_variant());
}

// ---- Clipboard · Pano ----
// WebKitGTK gives our custom scheme no `navigator.clipboard`, and a pasted picture often reaches the page without its bytes: GTK's own
// clipboard has neither problem. It lives on the main thread; the answer comes back through a channel.
// WebKitGTK özel şemamıza `navigator.clipboard` vermez, yapıştırılan resim de çoğu kez sayfaya verisi olmadan gelir: GTK'nin kendi
// panosunda iki sorun da yok. Pano ana iş parçacığında yaşar; yanıt bir kanaldan döner.
fn pano() -> gtk::Clipboard {
    gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD)
}

pub fn pano_yaz(app: &AppHandle, metin: String) -> bool {
    app.run_on_main_thread(move || {
        let p = pano();
        p.set_text(&metin);
        // Survives the app closing, where a clipboard manager runs. · Pano yöneticisi varsa uygulama kapanınca da kalır.
        p.store();
    })
    .is_ok()
}

/// The picture on the clipboard as PNG. · Panodaki resim, PNG olarak.
pub async fn pano_resim(app: &AppHandle) -> Option<Vec<u8>> {
    let (yolla, al) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        pano().request_image(move |_, resim| {
            let _ = yolla.send(resim.and_then(|r| r.save_to_bufferv("png", &[]).ok()));
        });
    })
    .ok()?;
    tokio::time::timeout(std::time::Duration::from_secs(5), al).await.ok()?.ok()?
}
