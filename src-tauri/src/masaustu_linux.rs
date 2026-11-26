//! Linux desktop glue over D-Bus, with the GIO bindings WebKitGTK already brings (no new dependency):
//!  - one running copy: two processes on the same crypto store would corrupt each other's keys; a second start shows the first window.
//!  - system notifications through the desktop portal, which needs no extra permission inside Flatpak.
//! Linux masaüstü bağları, D-Bus üzerinden, WebKitGTK'nin zaten getirdiği GIO ile (yeni bağımlılık yok):
//!  - tek çalışan kopya: aynı şifreleme deposundaki iki süreç birbirinin anahtarlarını bozardı; ikinci açılış ilk pencereyi gösterir.
//!  - masaüstü portalıyla sistem bildirimi; Flatpak içinde ek izin istemez.

use tauri::{AppHandle, Manager};
use tracing::warn;
use webkit2gtk::{
    gio::{self, BusType, Cancellable, DBusCallFlags, DBusConnection, DBusNodeInfo, DBusSignalFlags},
    glib::{self, ToVariant, Variant, VariantDict},
};

const KIMLIK: &str = "dev.rubyyard.rubychat";
const PENCERE_ARAYUZ: &str = "dev.rubyyard.rubychat.Pencere";
const FDO_UYGULAMA: &str = "org.freedesktop.Application";
/// Bus name; a second profile is a copy of its own. · Veri yolu adı; ikinci profil kendi başına bir kopyadır.
fn ad() -> String {
    format!("{KIMLIK}{}", crate::profil_eki())
}
const YOL: &str = "/dev/rubyyard/rubychat";
const PORTAL: &str = "org.freedesktop.portal.Desktop";
const PORTAL_YOL: &str = "/org/freedesktop/portal/desktop";
const PORTAL_BILDIRIM: &str = "org.freedesktop.portal.Notification";

const PENCERE_XML: &str = r#"
<node>
  <interface name="dev.rubyyard.rubychat.Pencere">
    <method name="Goster"/>
  </interface>
  <interface name="org.freedesktop.Application">
    <method name="Activate">
      <arg name="platform_data" type="a{sv}" direction="in"/>
    </method>
    <method name="Open">
      <arg name="uris" type="as" direction="in"/>
      <arg name="platform_data" type="a{sv}" direction="in"/>
    </method>
    <method name="ActivateAction">
      <arg name="action_name" type="s" direction="in"/>
      <arg name="parameter" type="av" direction="in"/>
      <arg name="platform_data" type="a{sv}" direction="in"/>
    </method>
  </interface>
</node>
"#;

pub(crate) fn veriyolu() -> Result<DBusConnection, glib::Error> {
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
        // Direct method call to our well-known name instead of a broadcast signal: Flatpak's xdg-dbus-proxy drops peer signals
        // from another unique name, while calls to our own app-id name are always allowed.
        // Yayın sinyali yerine iyi bilinen adımıza doğrudan yöntem çağrısı: Flatpak'ın xdg-dbus-proxy'si başka benzersiz addan gelen
        // yayın sinyallerini düşürür, oysa kendi uygulama kimliğimize yapılan çağrılara her zaman izin verilir.
        if let Err(e) = yol.call_sync(
            Some(&ad()),
            YOL,
            PENCERE_ARAYUZ,
            "Goster",
            None,
            None,
            DBusCallFlags::NONE,
            3000,
            Cancellable::NONE,
        ) {
            warn!("mevcut kopyaya Goster çağrısı başarısız: {e}");
        }
        return false;
    }
    // The name lives as long as the connection. · Ad, bağlantı yaşadıkça durur.
    std::mem::forget(yol);
    true
}

pub fn pencereyi_goster(app: &AppHandle) {
    app.state::<crate::durum::AppState>().arka_planda.store(false, std::sync::atomic::Ordering::Relaxed);
    if let Some(p) = app.get_webview_window("main") {
        let _ = p.unminimize();
        let _ = p.show();
        let _ = p.set_focus();
        // On Wayland, show()+set_focus() alone may leave the window behind others; GTK present() asks the compositor to raise it.
        // Wayland'da show()+set_focus() tek başına pencereyi arkada bırakabilir; GTK present() bileştiriciden pencereyi öne almasını ister.
        if let Ok(gtk_p) = p.gtk_window() {
            gtk::prelude::GtkWindowExt::present(&gtk_p);
        }
    }
}

/// Runs `pencereyi_goster` on the main GTK/GLib thread (safe from D-Bus callbacks and Tokio tasks).
/// `pencereyi_goster`i ana GTK/GLib iş parçacığında çalıştırır (D-Bus geri çağrılarından ve Tokio görevlerinden güvenli).
pub fn pencereyi_goster_ana_iplikte(app: &AppHandle) {
    let a = app.clone();
    let _ = app.run_on_main_thread(move || pencereyi_goster(&a));
}

/// Toggles the main window for the tray icon: hide if visible and focused, otherwise show and focus.
/// Tepsi simgesi için ana pencereyi değiştirir: görünür ve odaktaysa gizle, değilse göster ve odakla.
pub fn pencereyi_gecis(app: &AppHandle) {
    let gorunur_ve_odakta = app
        .get_webview_window("main")
        .map(|p| p.is_visible().unwrap_or(false) && p.is_focused().unwrap_or(false))
        .unwrap_or(false);
    if gorunur_ve_odakta {
        pencereyi_gizle(app);
    } else {
        pencereyi_goster(app);
    }
}

/// Exports the single-instance & org.freedesktop.Application D-Bus object, listens for tapped notifications, and prepares the tray.
/// Call on the main thread (setup).
/// Tek kopya ve org.freedesktop.Application D-Bus nesnesini dışa aktarır, dokunulan bildirimleri dinler ve tepsiyi hazırlar.
/// Ana iş parçacığında çağır (setup).
pub fn dinle(app: &AppHandle) {
    let Ok(yol) = veriyolu() else { return };
    match DBusNodeInfo::for_xml(PENCERE_XML) {
        Ok(dugum) => {
            if let Some(arayuz) = dugum.lookup_interface(PENCERE_ARAYUZ) {
                let a = app.clone();
                if let Err(e) = yol
                    .register_object(
                        YOL,
                        &arayuz,
                        move |_, _, _, _, yontem, _, cagri| match yontem {
                        "Goster" => {
                            pencereyi_goster_ana_iplikte(&a);
                            cagri.return_value(None);
                        }
                        _ => cagri.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", "bilinmeyen yöntem"),
                        },
                        // No properties on these interfaces (GDBus rejects unknown names before calling this).
                        // Bu arayüzlerde özellik yok (GDBus bilinmeyen adları bunu çağırmadan reddeder).
                        |_, _, _, _, _| "".to_variant(),
                        |_, _, _, _, _, _| false,
                    )
                {
                    warn!("pencere D-Bus nesnesi kaydedilemedi: {e}");
                }
            }
            if let Some(arayuz) = dugum.lookup_interface(FDO_UYGULAMA) {
                let a = app.clone();
                if let Err(e) = yol
                    .register_object(
                        YOL,
                        &arayuz,
                        move |_, _, _, _, yontem, _, cagri| match yontem {
                        "Activate" | "Open" | "ActivateAction" => {
                            pencereyi_goster_ana_iplikte(&a);
                            cagri.return_value(None);
                        }
                        _ => cagri.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", "bilinmeyen yöntem"),
                        },
                        // No properties on these interfaces (GDBus rejects unknown names before calling this).
                        // Bu arayüzlerde özellik yok (GDBus bilinmeyen adları bunu çağırmadan reddeder).
                        |_, _, _, _, _| "".to_variant(),
                        |_, _, _, _, _, _| false,
                    )
                {
                    warn!("org.freedesktop.Application kaydedilemedi: {e}");
                }
            }
        }
        Err(e) => warn!("pencere D-Bus XML'i çözülemedi: {e}"),
    }
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
    crate::tepsi_linux::baslat(app);
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
    match portal("AddNotification", &arg) {
        Ok(_) => {
            GOSTERILEN.lock().unwrap_or_else(|e| e.into_inner()).insert(oda_id.to_owned());
        }
        Err(e) => warn!("bildirim gösterilemedi: {e}"),
    }
}

/// Rooms with a notification on screen; the portal cannot list them back. · Ekranda bildirimi olan odalar; portal bunları geri listeleyemez.
static GOSTERILEN: std::sync::Mutex<std::collections::BTreeSet<String>> = std::sync::Mutex::new(std::collections::BTreeSet::new());

pub fn bildirim_temizle(oda_id: &str) {
    GOSTERILEN.lock().unwrap_or_else(|e| e.into_inner()).remove(oda_id);
    let _ = portal("RemoveNotification", &(oda_id,).to_variant());
}

pub fn bildirim_hepsini_temizle() {
    let odalar = std::mem::take(&mut *GOSTERILEN.lock().unwrap_or_else(|e| e.into_inner()));
    for oda in odalar {
        let _ = portal("RemoveNotification", &(oda.as_str(),).to_variant());
    }
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

// ---- Running in the background · Arka planda çalışma ----
// Closing the window only hides it while this is on: the process keeps syncing and the notifications keep coming, like other chat
// apps. The background portal tells the desktop about it (GNOME lists rubychat under "background apps", where it can also be quit)
// and, when asked, writes the autostart entry that starts rubychat hidden at login.
// Bu açıkken pencereyi kapatmak yalnızca gizler: süreç eşitlemeye devam eder, bildirimler gelir; öteki sohbet uygulamaları gibi.
// Arka plan portalı bunu masaüstüne söyler (GNOME rubychat'i "arka plan uygulamaları"nda listeler, oradan da kapatılabilir) ve
// istenirse oturum açılışında rubychat'i gizli başlatan otomatik başlatma kaydını yazar.

/// Off until a session starts and the UI applies its setting (tercihler.svelte.ts `arkaPlan`): the sign-in window closes for real.
/// Oturum başlayıp arayüz ayarını uygulayana dek kapalı (tercihler.svelte.ts `arkaPlan`): giriş penceresi gerçekten kapanır.
static ARKA_PLAN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
/// Started by the autostart entry: no window until the user asks for it. · Otomatik başlatma kaydıyla açıldı: kullanıcı istemeden pencere yok.
pub const GIZLI_BASLAT: &str = "--arka-planda";

pub fn arka_planda_kal() -> bool {
    ARKA_PLAN.load(std::sync::atomic::Ordering::Relaxed)
}

pub fn arka_plan_ayarla(acik: bool, acilista: bool) {
    ARKA_PLAN.store(acik, std::sync::atomic::Ordering::Relaxed);
    crate::tepsi_linux::etkin_ayarla(acik);
    let d = VariantDict::new(None);
    d.insert("reason", crate::dil::sec("Pencere kapalıyken mesajları eşitlemek ve bildirim göstermek için", "To sync messages and show notifications while the window is closed"));
    d.insert("autostart", acik && acilista);
    d.insert("commandline", vec!["rubychat".to_owned(), GIZLI_BASLAT.to_owned()]);
    d.insert("dbus-activatable", false);
    let arg = Variant::tuple_from_iter(["".to_variant(), d.end()]);
    // The answer comes later as a portal Request signal; nothing here depends on it. · Yanıt sonra portal Request sinyaliyle gelir; burada ona bağlı bir şey yok.
    let sonuc = veriyolu().and_then(|y| {
        y.call_sync(Some(PORTAL), PORTAL_YOL, "org.freedesktop.portal.Background", "RequestBackground", Some(&arg), None, DBusCallFlags::NONE, 5000, Cancellable::NONE)
    });
    if let Err(e) = sonuc {
        warn!("arka plan portalı yanıt vermedi: {e}");
    }
}

/// Updates the system tray unread-room count (called from Tokio sync tasks).
/// Sistem tepsisindeki okunmamış oda sayısını günceller (Tokio eşitleme görevlerinden çağrılır).
pub fn tepsi_okunmamis(sayi: usize) {
    crate::tepsi_linux::okunmamis_ayarla(sayi);
}

/// Hides the window instead of closing it (see `arka_planda_kal`). · Pencereyi kapatmak yerine gizler (bkz. `arka_planda_kal`).
pub fn pencereyi_gizle(app: &AppHandle) {
    if let Some(p) = app.get_webview_window("main") {
        let _ = p.hide();
    }
    // Hidden = system notifications, without waiting for the page to say so. · Gizli = sistem bildirimi; sayfanın söylemesini beklemeden.
    app.state::<crate::durum::AppState>().arka_planda.store(true, std::sync::atomic::Ordering::Relaxed);
}
