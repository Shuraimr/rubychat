//! Linux system tray over StatusNotifierItem + com.canonical.dbusmenu using GIO from WebKitGTK (no new dependency,
//! works inside Flatpak without libappindicator).
//! WebKitGTK'nin getirdiği GIO ile StatusNotifierItem + com.canonical.dbusmenu üzerinden Linux sistem tepsisi
//! (yeni bağımlılık yok; Flatpak içinde libappindicator olmadan çalışır).

use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering},
    OnceLock,
};

use gtk::gdk_pixbuf::Pixbuf;
use tauri::AppHandle;
use tracing::warn;
use webkit2gtk::{
    gio::{Cancellable, DBusCallFlags, DBusConnection, DBusNodeInfo, DBusSignalFlags, MemoryInputStream},
    glib::{Bytes, ToVariant, Variant, VariantDict, VariantTy},
};

const SNI_ARAYUZ: &str = "org.kde.StatusNotifierItem";
const SNI_YOL: &str = "/StatusNotifierItem";
const MENU_ARAYUZ: &str = "com.canonical.dbusmenu";
const MENU_YOL: &str = "/MenuBar";
const IZLEYICI: &str = "org.kde.StatusNotifierWatcher";
const IZLEYICI_YOL: &str = "/StatusNotifierWatcher";

const SNI_XML: &str = r#"
<node>
  <interface name="org.kde.StatusNotifierItem">
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="WindowId" type="u" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="IconPixmap" type="a(iiay)" access="read"/>
    <property name="OverlayIconName" type="s" access="read"/>
    <property name="OverlayIconPixmap" type="a(iiay)" access="read"/>
    <property name="AttentionIconName" type="s" access="read"/>
    <property name="AttentionIconPixmap" type="a(iiay)" access="read"/>
    <property name="AttentionMovieName" type="s" access="read"/>
    <property name="IconThemePath" type="s" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <property name="ToolTip" type="(sa(iiay)ss)" access="read"/>
    <method name="ContextMenu">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Activate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="SecondaryActivate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Scroll">
      <arg name="delta" type="i" direction="in"/>
      <arg name="orientation" type="s" direction="in"/>
    </method>
    <signal name="NewTitle"/>
    <signal name="NewIcon"/>
    <signal name="NewAttentionIcon"/>
    <signal name="NewOverlayIcon"/>
    <signal name="NewToolTip"/>
    <signal name="NewStatus">
      <arg name="status" type="s"/>
    </signal>
  </interface>
</node>
"#;

const MENU_XML: &str = r#"
<node>
  <interface name="com.canonical.dbusmenu">
    <property name="Version" type="u" access="read"/>
    <property name="TextDirection" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconThemePath" type="as" access="read"/>
    <method name="GetLayout">
      <arg name="parentId" type="i" direction="in"/>
      <arg name="recursionDepth" type="i" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="revision" type="u" direction="out"/>
      <arg name="layout" type="(ia{sv}av)" direction="out"/>
    </method>
    <method name="GetGroupProperties">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="properties" type="a(ia{sv})" direction="out"/>
    </method>
    <method name="GetProperty">
      <arg name="id" type="i" direction="in"/>
      <arg name="name" type="s" direction="in"/>
      <arg name="value" type="v" direction="out"/>
    </method>
    <method name="Event">
      <arg name="id" type="i" direction="in"/>
      <arg name="eventId" type="s" direction="in"/>
      <arg name="data" type="v" direction="in"/>
      <arg name="timestamp" type="u" direction="in"/>
    </method>
    <method name="EventGroup">
      <arg name="events" type="a(isvu)" direction="in"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <method name="AboutToShow">
      <arg name="id" type="i" direction="in"/>
      <arg name="needUpdate" type="b" direction="out"/>
    </method>
    <method name="AboutToShowGroup">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="updatesNeeded" type="ai" direction="out"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <signal name="ItemsPropertiesUpdated">
      <arg name="updatedProps" type="a(ia{sv})"/>
      <arg name="removedProps" type="a(ias)"/>
    </signal>
    <signal name="LayoutUpdated">
      <arg name="revision" type="u"/>
      <arg name="parent" type="i"/>
    </signal>
    <signal name="ItemActivationRequested">
      <arg name="id" type="i"/>
      <arg name="timestamp" type="u"/>
    </signal>
  </interface>
</node>
"#;

static UYGULAMA: OnceLock<AppHandle> = OnceLock::new();
/// Cached ARGB32 icon pixmaps decoded once from the bundled PNGs so bars inside Flatpak do not depend on icon themes.
/// Paketli PNG'lerden bir kez çözülmüş önbellekli ARGB32 simgeleri; Flatpak içindeki çubuklar simge temasına bağlı kalmasın.
static SIMGELER: OnceLock<Vec<(i32, i32, Vec<u8>)>> = OnceLock::new();
static ETKIN: AtomicBool = AtomicBool::new(false);
static KAYITLI: AtomicBool = AtomicBool::new(false);
static OKUNMAMIS: AtomicUsize = AtomicUsize::new(0);
static MENU_REVIZYON: AtomicU32 = AtomicU32::new(1);
static SON_DIL_EN: AtomicBool = AtomicBool::new(false);

fn png_argb32(png: &'static [u8]) -> Option<(i32, i32, Vec<u8>)> {
    let akis = MemoryInputStream::from_bytes(&Bytes::from_static(png));
    let pb = Pixbuf::from_stream(&akis, Cancellable::NONE).ok()?;
    let (g, y) = (pb.width(), pb.height());
    let satir = pb.rowstride() as usize;
    let kanal = pb.n_channels() as usize;
    if g <= 0 || y <= 0 || kanal < 3 {
        return None;
    }
    let alfa = pb.has_alpha() && kanal >= 4;
    let ham = pb.read_pixel_bytes();
    let pikseller: &[u8] = &ham;
    let mut cikti = Vec::with_capacity((g as usize) * (y as usize) * 4);
    for sy in 0..y as usize {
        for sx in 0..g as usize {
            let o = sy * satir + sx * kanal;
            if o + kanal > pikseller.len() {
                return None;
            }
            let a = if alfa { pikseller[o + 3] } else { 255 };
            // SNI IconPixmap expects ARGB32 in network byte order (big-endian: A, R, G, B).
            // SNI IconPixmap, ağ bayt sırasında ARGB32 bekler (büyük uçlu: A, R, G, B).
            cikti.extend_from_slice(&[a, pikseller[o], pikseller[o + 1], pikseller[o + 2]]);
        }
    }
    Some((g, y, cikti))
}

fn bos_pixmap() -> Variant {
    Variant::array_from_iter_with_type(VariantTy::new("(iiay)").expect("iiay"), std::iter::empty::<Variant>())
}

fn simge_pixmap() -> Variant {
    let liste = SIMGELER.get_or_init(|| {
        let mut v = Vec::new();
        if let Some(p) = png_argb32(include_bytes!("../icons/32x32.png")) {
            v.push(p);
        }
        if let Some(p) = png_argb32(include_bytes!("../icons/64x64.png")) {
            v.push(p);
        }
        v
    });
    let ogeler = liste
        .iter()
        .map(|(g, y, bayt)| Variant::tuple_from_iter([g.to_variant(), y.to_variant(), bayt.to_variant()]));
    Variant::array_from_iter_with_type(VariantTy::new("(iiay)").expect("iiay"), ogeler)
}

fn durum_metni() -> &'static str {
    if !ETKIN.load(Ordering::Relaxed) {
        "Passive"
    } else if OKUNMAMIS.load(Ordering::Relaxed) > 0 {
        "NeedsAttention"
    } else {
        "Active"
    }
}

fn ipucu_variant() -> Variant {
    let n = OKUNMAMIS.load(Ordering::Relaxed);
    let aciklama = if n == 0 {
        String::new()
    } else if crate::dil::en() {
        if n == 1 {
            "1 unread chat".to_owned()
        } else {
            format!("{n} unread chats")
        }
    } else {
        format!("{n} okunmamış sohbet")
    };
    Variant::tuple_from_iter(["".to_variant(), bos_pixmap(), "rubychat".to_variant(), aciklama.to_variant()])
}

fn sni_sinyal(yol: &DBusConnection, ad: &str, arg: Option<&Variant>) {
    let _ = yol.emit_signal(None, SNI_YOL, SNI_ARAYUZ, ad, arg);
}

fn menu_ozellikleri(id: i32) -> Variant {
    let d = VariantDict::new(None);
    match id {
        0 => d.insert("children-display", "submenu"),
        1 => {
            d.insert("type", "standard");
            d.insert("label", crate::dil::sec("rubychat'i göster", "Show rubychat"));
            d.insert("enabled", true);
            d.insert("visible", true);
        }
        2 => {
            d.insert("type", "separator");
            d.insert("visible", true);
        }
        3 => {
            d.insert("type", "standard");
            d.insert("label", crate::dil::sec("Çık", "Quit"));
            d.insert("enabled", true);
            d.insert("visible", true);
        }
        _ => {}
    }
    d.end()
}

fn menu_ozellik_degeri(id: i32, ad: &str) -> Option<Variant> {
    match (id, ad) {
        (0, "children-display") => Some("submenu".to_variant()),
        (1, "type") | (3, "type") => Some("standard".to_variant()),
        (1, "label") => Some(crate::dil::sec("rubychat'i göster", "Show rubychat").to_variant()),
        (3, "label") => Some(crate::dil::sec("Çık", "Quit").to_variant()),
        (1, "enabled") | (3, "enabled") => Some(true.to_variant()),
        (1, "visible") | (2, "visible") | (3, "visible") => Some(true.to_variant()),
        (2, "type") => Some("separator".to_variant()),
        _ => None,
    }
}

fn bos_av() -> Variant {
    Variant::array_from_iter_with_type(VariantTy::VARIANT, std::iter::empty::<Variant>())
}

fn menu_dugum(id: i32, derinlik: i32) -> Variant {
    let cocuklar = if id == 0 && derinlik != 0 {
        let ogeler = [1i32, 2, 3].into_iter().map(|c| {
            let dugum = Variant::tuple_from_iter([c.to_variant(), menu_ozellikleri(c), bos_av()]);
            Variant::from_variant(&dugum)
        });
        Variant::array_from_iter_with_type(VariantTy::VARIANT, ogeler)
    } else {
        bos_av()
    };
    Variant::tuple_from_iter([id.to_variant(), menu_ozellikleri(id), cocuklar])
}

fn menu_tiklandi(app: &AppHandle, id: i32) {
    match id {
        1 => crate::masaustu_linux::pencereyi_goster_ana_iplikte(app),
        3 => {
            let a = app.clone();
            let _ = app.run_on_main_thread(move || a.exit(0));
        }
        _ => {}
    }
}

fn dil_degisti_mi() -> bool {
    let simdi = crate::dil::en();
    let degisti = SON_DIL_EN.swap(simdi, Ordering::Relaxed) != simdi;
    if degisti {
        MENU_REVIZYON.fetch_add(1, Ordering::Relaxed);
    }
    degisti
}

/// Exports `/StatusNotifierItem` and `/MenuBar` once on the main GLib thread.
/// `/StatusNotifierItem` ve `/MenuBar` nesnelerini ana GLib iş parçacığında bir kez dışa aktarır.
fn nesneleri_kaydet(yol: &DBusConnection, app: &AppHandle) {
    if KAYITLI.load(Ordering::Relaxed) {
        return;
    }
    let sni_tamam = match DBusNodeInfo::for_xml(SNI_XML) {
        Ok(dugum) => match dugum.lookup_interface(SNI_ARAYUZ) {
            Some(arayuz) => {
                let a = app.clone();
                match yol
                    .register_object(
                        SNI_YOL,
                        &arayuz,
                        move |_, _, _, _, yontem, _, cagri| match yontem {
                        "Activate" => {
                            let a2 = a.clone();
                            let _ = a.run_on_main_thread(move || crate::masaustu_linux::pencereyi_gecis(&a2));
                            cagri.return_value(None);
                        }
                        "SecondaryActivate" => {
                            crate::masaustu_linux::pencereyi_goster_ana_iplikte(&a);
                            cagri.return_value(None);
                        }
                        "ContextMenu" | "Scroll" => cagri.return_value(None),
                        _ => cagri.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", "bilinmeyen yöntem"),
                    },
                    // GDBus checks property names against the XML first, so the fallback arm is never reached.
                    // GDBus özellik adlarını önce XML'e göre denetler; son kol hiç çalışmaz.
                    |_, _, _, _, ozellik| match ozellik {
                        "Category" => "Communications".to_variant(),
                        "Id" | "Title" => "rubychat".to_variant(),
                        "Status" => durum_metni().to_variant(),
                        "WindowId" => 0u32.to_variant(),
                        "IconName" => "dev.rubyyard.rubychat".to_variant(),
                        "IconPixmap" => simge_pixmap(),
                        "OverlayIconName" | "AttentionIconName" | "AttentionMovieName" | "IconThemePath" => "".to_variant(),
                        "OverlayIconPixmap" | "AttentionIconPixmap" => bos_pixmap(),
                        "ItemIsMenu" => false.to_variant(),
                        "Menu" => Variant::parse(Some(VariantTy::OBJECT_PATH), "'/MenuBar'").expect("Menu yolu"),
                        "ToolTip" => ipucu_variant(),
                        _ => "".to_variant(),
                    },
                    |_, _, _, _, _, _| false,
                    )
                {
                    Ok(_) => true,
                    Err(e) => {
                        warn!("StatusNotifierItem kaydedilemedi: {e}");
                        false
                    }
                }
            }
            None => false,
        },
        Err(e) => {
            warn!("SNI XML çözülemedi: {e}");
            false
        }
    };

    let menu_tamam = match DBusNodeInfo::for_xml(MENU_XML) {
        Ok(dugum) => match dugum.lookup_interface(MENU_ARAYUZ) {
            Some(arayuz) => {
                let a = app.clone();
                match yol
                    .register_object(
                        MENU_YOL,
                        &arayuz,
                        move |_, _, _, _, yontem, arg, cagri| match yontem {
                        "GetLayout" => {
                            let ust = arg.child_value(0).get::<i32>().unwrap_or(0);
                            let derinlik = arg.child_value(1).get::<i32>().unwrap_or(-1);
                            let _ = dil_degisti_mi();
                            let rev = MENU_REVIZYON.load(Ordering::Relaxed);
                            let yanit = Variant::tuple_from_iter([rev.to_variant(), menu_dugum(ust, derinlik)]);
                            cagri.return_value(Some(&yanit));
                        }
                        "GetGroupProperties" => {
                            let mut kimlikler = arg.child_value(0).get::<Vec<i32>>().unwrap_or_default();
                            if kimlikler.is_empty() {
                                kimlikler = vec![0, 1, 2, 3];
                            }
                            let ogeler = kimlikler
                                .into_iter()
                                .filter(|id| (0..=3).contains(id))
                                .map(|id| Variant::tuple_from_iter([id.to_variant(), menu_ozellikleri(id)]));
                            let dizi = Variant::array_from_iter_with_type(VariantTy::new("(ia{sv})").expect("ia{sv}"), ogeler);
                            cagri.return_value(Some(&Variant::tuple_from_iter([dizi])));
                        }
                        "GetProperty" => {
                            let id = arg.child_value(0).get::<i32>().unwrap_or(-1);
                            let ad = arg.child_value(1).get::<String>().unwrap_or_default();
                            match menu_ozellik_degeri(id, &ad) {
                                Some(v) => cagri.return_value(Some(&Variant::tuple_from_iter([Variant::from_variant(&v)]))),
                                None => cagri.return_dbus_error("org.freedesktop.DBus.Error.InvalidArgs", "bilinmeyen özellik"),
                            }
                        }
                        "Event" => {
                            let id = arg.child_value(0).get::<i32>().unwrap_or(-1);
                            let olay = arg.child_value(1).get::<String>().unwrap_or_default();
                            if olay == "clicked" {
                                menu_tiklandi(&a, id);
                            }
                            cagri.return_value(None);
                        }
                        "EventGroup" => {
                            let olaylar = arg.child_value(0);
                            for i in 0..olaylar.n_children() {
                                let oge = olaylar.child_value(i);
                                let id = oge.child_value(0).get::<i32>().unwrap_or(-1);
                                let olay = oge.child_value(1).get::<String>().unwrap_or_default();
                                if olay == "clicked" {
                                    menu_tiklandi(&a, id);
                                }
                            }
                            cagri.return_value(Some(&(Vec::<i32>::new(),).to_variant()));
                        }
                        "AboutToShow" => {
                            let degisti = dil_degisti_mi();
                            cagri.return_value(Some(&(degisti,).to_variant()));
                        }
                        "AboutToShowGroup" => {
                            let guncelle = if dil_degisti_mi() { vec![0i32] } else { Vec::new() };
                            cagri.return_value(Some(&(guncelle, Vec::<i32>::new()).to_variant()));
                        }
                        _ => cagri.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", "bilinmeyen yöntem"),
                    },
                    // GDBus checks property names against the XML first, so the fallback arm is never reached.
                    // GDBus özellik adlarını önce XML'e göre denetler; son kol hiç çalışmaz.
                    |_, _, _, _, ozellik| match ozellik {
                        "Version" => 3u32.to_variant(),
                        "TextDirection" => "ltr".to_variant(),
                        "Status" => "normal".to_variant(),
                        "IconThemePath" => Vec::<String>::new().to_variant(),
                        _ => "".to_variant(),
                    },
                    |_, _, _, _, _, _| false,
                    )
                {
                    Ok(_) => true,
                    Err(e) => {
                        warn!("dbusmenu kaydedilemedi: {e}");
                        false
                    }
                }
            }
            None => false,
        },
        Err(e) => {
            warn!("dbusmenu XML çözülemedi: {e}");
            false
        }
    };

    if sni_tamam && menu_tamam {
        KAYITLI.store(true, Ordering::Relaxed);
    }
}

fn izleyiciye_kaydol(yol: &DBusConnection) {
    // Pass our object path: StatusNotifierWatcher (KDE, Waybar, etc.) pairs it with our bus unique name,
    // avoiding a separate org.kde.StatusNotifierItem-PID-N well-known name inside Flatpak.
    // Nesne yolumuzu ver: StatusNotifierWatcher (KDE, Waybar vb.) bunu benzersiz veri yolu adımızla eşler;
    // Flatpak içinde ayrı bir org.kde.StatusNotifierItem-PID-N iyi bilinen adı sahiplenmek gerekmez.
    let arg = (SNI_YOL,).to_variant();
    if let Err(e) = yol.call_sync(
        Some(IZLEYICI),
        IZLEYICI_YOL,
        IZLEYICI,
        "RegisterStatusNotifierItem",
        Some(&arg),
        None,
        DBusCallFlags::NONE,
        1000,
        Cancellable::NONE,
    ) {
        warn!("sistem tepsisi izleyiciye kaydedilemedi: {e}");
    }
}

/// Initializes watcher monitoring on the main GLib thread (called once from `masaustu_linux::dinle`).
/// Ana GLib iş parçacığında izleyici takibini başlatır (`masaustu_linux::dinle` içinden bir kez çağrılır).
pub fn baslat(app: &AppHandle) {
    let _ = UYGULAMA.set(app.clone());
    SON_DIL_EN.store(crate::dil::en(), Ordering::Relaxed);
    let Ok(yol) = crate::masaustu_linux::veriyolu() else { return };
    let a = app.clone();
    // Re-register if the tray watcher (panel/bar) starts or restarts after rubychat.
    // Tepsi izleyicisi (panel/çubuk) rubychat'ten sonra başlar ya da yeniden başlarsa yeniden kaydol.
    yol.signal_subscribe(
        Some("org.freedesktop.DBus"),
        Some("org.freedesktop.DBus"),
        Some("NameOwnerChanged"),
        Some("/org/freedesktop/DBus"),
        Some(IZLEYICI),
        DBusSignalFlags::NONE,
        move |_, _, _, _, _, p| {
            let yeni_sahip = p.child_value(2).get::<String>().unwrap_or_default();
            if !yeni_sahip.is_empty() && ETKIN.load(Ordering::Relaxed) {
                if let Ok(bag) = crate::masaustu_linux::veriyolu() {
                    nesneleri_kaydet(&bag, &a);
                    izleyiciye_kaydol(&bag);
                }
            }
        },
    );
    std::mem::forget(yol);
}

/// Shows or hides the tray icon according to session + "run in background" state. Safe from any thread.
/// Oturum ve "arka planda çalış" durumuna göre tepsi simgesini gösterir ya da gizler. Her iş parçacığından güvenli.
pub fn etkin_ayarla(acik: bool) {
    ETKIN.store(acik, Ordering::Relaxed);
    let Some(app) = UYGULAMA.get() else { return };
    let a = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Ok(yol) = crate::masaustu_linux::veriyolu() else { return };
        if acik {
            nesneleri_kaydet(&yol, &a);
            if KAYITLI.load(Ordering::Relaxed) {
                izleyiciye_kaydol(&yol);
                sinyal_durum_ve_ipucu(&yol);
            }
        } else if KAYITLI.load(Ordering::Relaxed) {
            sni_sinyal(&yol, "NewStatus", Some(&("Passive",).to_variant()));
        }
    });
}

fn sinyal_durum_ve_ipucu(yol: &DBusConnection) {
    sni_sinyal(yol, "NewStatus", Some(&(durum_metni(),).to_variant()));
    sni_sinyal(yol, "NewIcon", None);
    sni_sinyal(yol, "NewToolTip", None);
}

/// Updates the unread room count; skips all D-Bus work when the count did not change. Safe from Tokio tasks.
/// Okunmamış oda sayısını günceller; sayı değişmediyse hiçbir D-Bus işi yapmaz. Tokio görevlerinden güvenli.
pub fn okunmamis_ayarla(sayi: usize) {
    let eski = OKUNMAMIS.swap(sayi, Ordering::Relaxed);
    if eski == sayi {
        return;
    }
    if !ETKIN.load(Ordering::Relaxed) || !KAYITLI.load(Ordering::Relaxed) {
        return;
    }
    let Some(app) = UYGULAMA.get() else { return };
    let durum_degisti = (eski > 0) != (sayi > 0);
    let _ = app.run_on_main_thread(move || {
        let Ok(yol) = crate::masaustu_linux::veriyolu() else { return };
        if durum_degisti {
            sni_sinyal(&yol, "NewStatus", Some(&(durum_metni(),).to_variant()));
        }
        sni_sinyal(&yol, "NewToolTip", None);
    });
}
