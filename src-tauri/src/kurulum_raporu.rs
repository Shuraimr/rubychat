//! Platform health & setup report (`kurulum_raporu`) and one-tap fix actions (`kurulum_duzelt`).
//! Platform sağlık ve kurulum raporu (`kurulum_raporu`) ile tek dokunuşluk düzeltme eylemleri (`kurulum_duzelt`).
//!
//! The backend returns machine-readable row ids, statuses and raw technical values only; all user-facing prose is
//! translated on the frontend from `kimlik`.
//! Arka uç yalnızca makinece okunan satır kimliklerini, durumları ve ham teknik değerleri döner; kullanıcıya gösterilen
//! bütün metinler ön yüzde `kimlik`ten çevrilir.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaporSatiri {
    pub kimlik: String,
    /// `"sistem"` | `"izinler"` | `"baglanti"`
    pub grup: String,
    /// `"tamam"` | `"uyari"` | `"eksik"`
    pub durum: String,
    pub deger: Option<String>,
    pub eylem: Option<String>,
}

fn satir(kimlik: &str, grup: &str, durum: &str, deger: Option<String>, eylem: Option<&str>) -> RaporSatiri {
    RaporSatiri {
        kimlik: kimlik.to_owned(),
        grup: grup.to_owned(),
        durum: durum.to_owned(),
        deger,
        eylem: eylem.map(str::to_owned),
    }
}

#[cfg(target_os = "linux")]
fn flatpak_calisma_ortami() -> Option<String> {
    let icerik = std::fs::read_to_string("/.flatpak-info").ok()?;
    for s in icerik.lines() {
        let Some(deger) = s.trim().strip_prefix("runtime=") else {
            continue;
        };
        let deger = deger.trim();
        let parcalar: Vec<&str> = deger.split('/').collect();
        if let (Some(ad), Some(surum)) = (parcalar.first(), parcalar.last()) {
            let kisa = match *ad {
                "org.gnome.Platform" => format!("GNOME {surum}"),
                "org.freedesktop.Platform" => format!("Freedesktop {surum}"),
                "org.kde.Platform" => format!("KDE {surum}"),
                _ => deger.to_owned(),
            };
            return Some(kisa);
        }
        if !deger.is_empty() {
            return Some(deger.to_owned());
        }
    }
    None
}

#[cfg(target_os = "linux")]
async fn webkit_surumu(app: &AppHandle) -> Option<(u32, u32, u32)> {
    // WebKitGTK version bindings assert the GTK main thread, so query them there and pass the tuple back.
    // WebKitGTK sürüm bağları GTK ana iş parçacığını zorunlu kılar; bu yüzden orada okuyup demeti geri iletiriz.
    let (yolla, al) = tokio::sync::oneshot::channel();
    if app
        .run_on_main_thread(move || {
            // webkit2gtk 2.0 has no safe wrapper for these; the C getters only read constants.
            // webkit2gtk 2.0'da bunların güvenli sarmalayıcısı yok; C okuyucuları yalnızca sabit okur.
            // SAFETY: plain getters without arguments, called on the GTK main thread. · GÜVENLİK: argümansız okuyucular, GTK ana iş parçacığında.
            let v = unsafe {
                (
                    webkit2gtk::ffi::webkit_get_major_version(),
                    webkit2gtk::ffi::webkit_get_minor_version(),
                    webkit2gtk::ffi::webkit_get_micro_version(),
                )
            };
            let _ = yolla.send(v);
        })
        .is_err()
    {
        return None;
    }
    tokio::time::timeout(std::time::Duration::from_secs(2), al).await.ok()?.ok()
}

#[cfg(target_os = "linux")]
fn linux_dbus_ve_sistem_satirlari(webkit: Option<(u32, u32, u32)>) -> Vec<RaporSatiri> {
    use webkit2gtk::{
        gio::{Cancellable, DBusCallFlags, DBusConnection},
        glib::{ToVariant, Variant},
    };

    let mut liste = Vec::new();

    // Runtime + WebKitGTK
    let rt = flatpak_calisma_ortami();
    let (durum, deger) = match webkit {
        Some((maj, min, mic)) => {
            let wk = format!("WebKitGTK {maj}.{min}.{mic}");
            let birlesik = match rt {
                Some(r) => format!("{r} · {wk}"),
                None => wk,
            };
            let d = if (maj, min) < (2, 44) { "uyari" } else { "tamam" };
            (d, Some(birlesik))
        }
        None => ("uyari", rt),
    };
    liste.push(satir("calisma_ortami", "sistem", durum, deger, None));

    let veriyolu = crate::masaustu_linux::veriyolu().ok();

    let portal_surum = |yol: &DBusConnection, arayuz: &str| -> Result<Option<u32>, ()> {
        let arg = (arayuz, "version").to_variant();
        let yanit = yol
            .call_sync(
                Some("org.freedesktop.portal.Desktop"),
                "/org/freedesktop/portal/desktop",
                "org.freedesktop.DBus.Properties",
                "Get",
                Some(&arg),
                None,
                DBusCallFlags::NONE,
                2000,
                Cancellable::NONE,
            )
            .map_err(|_| ())?;
        Ok(yanit.child_value(0).get::<Variant>().and_then(|ic| ic.get::<u32>()))
    };

    for (kimlik, arayuz) in [
        ("bildirim_portali", "org.freedesktop.portal.Notification"),
        ("arka_plan_portali", "org.freedesktop.portal.Background"),
        ("ekran_paylasimi_portali", "org.freedesktop.portal.ScreenCast"),
        ("kamera_portali", "org.freedesktop.portal.Camera"),
    ] {
        match veriyolu.as_ref().map(|y| portal_surum(y, arayuz)) {
            Some(Ok(surum)) => {
                liste.push(satir(kimlik, "sistem", "tamam", surum.map(|n| format!("v{n}")), None));
            }
            _ => {
                liste.push(satir(kimlik, "sistem", "uyari", None, None));
            }
        }
    }

    let sahip_var = |ad: &str| -> bool {
        let Some(y) = veriyolu.as_ref() else { return false };
        let arg = (ad,).to_variant();
        let yanit = y.call_sync(
            Some("org.freedesktop.DBus"),
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "NameHasOwner",
            Some(&arg),
            None,
            DBusCallFlags::NONE,
            2000,
            Cancellable::NONE,
        );
        matches!(yanit, Ok(v) if v.child_value(0).get::<bool>() == Some(true))
    };

    if sahip_var("org.kde.StatusNotifierWatcher") {
        liste.push(satir("tepsi", "sistem", "tamam", None, None));
    } else {
        liste.push(satir("tepsi", "sistem", "uyari", None, Some("tepsi_yardim")));
    }

    if sahip_var("org.freedesktop.secrets") {
        liste.push(satir("anahtar_deposu", "sistem", "tamam", None, None));
    } else {
        liste.push(satir("anahtar_deposu", "sistem", "eksik", None, None));
    }

    let pipewire_var = std::env::var_os("XDG_RUNTIME_DIR")
        .map(|d| std::path::Path::new(&d).join("pipewire-0").exists())
        .unwrap_or(false);
    liste.push(satir("pipewire", "izinler", if pipewire_var { "tamam" } else { "uyari" }, None, None));

    liste
}

/// Collects platform diagnostics and permission status without waiting on session restore.
/// Oturum geri yüklemesini beklemeden platform tanılarını ve izin durumlarını toplar.
#[tauri::command]
pub async fn kurulum_raporu(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<Vec<RaporSatiri>> {
    let mut satirlar = if cfg!(target_os = "android") {
        let _ = &app;
        let json = tokio::task::spawn_blocking(crate::android_jni::kurulum_raporu)
            .await
            .map_err(|e| Hata::Diger(e.to_string()))?
            .map_err(Hata::Diger)?;
        serde_json::from_str::<Vec<RaporSatiri>>(&json)?
    } else {
        #[cfg(target_os = "linux")]
        {
            let wk = webkit_surumu(&app).await;
            tokio::task::spawn_blocking(move || linux_dbus_ve_sistem_satirlari(wk))
                .await
                .map_err(|e| Hata::Diger(e.to_string()))?
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = &app;
            Vec::new()
        }
    };

    // Never call `durum.client().await` here: the setup report must stay instant even before/during login restore.
    // Burada asla `durum.client().await` çağırma: kurulum raporu giriş/geri yükleme sırasında da anında açılmalı.
    let sunucu = durum.oturum.try_read().ok().and_then(|o| {
        let istemci = &o.as_ref()?.client;
        let adres = istemci.homeserver();
        Some(adres.host_str().map(str::to_owned).unwrap_or_else(|| adres.to_string()))
    });
    if let Some(s) = sunucu {
        satirlar.push(satir("sunucu", "baglanti", "tamam", Some(s), None));
    }

    Ok(satirlar)
}

/// Runs the platform fix action advertised in a `RaporSatiri.eylem`.
/// `RaporSatiri.eylem` içinde bildirilen platform düzeltme eylemini çalıştırır.
#[tauri::command]
pub async fn kurulum_duzelt(eylem: String) -> Sonuc<()> {
    if cfg!(target_os = "android") {
        match eylem.as_str() {
            "bildirim_izni" => {
                let bas = std::time::Instant::now();
                let verildi = crate::bildirim::izin_iste().await;
                // On Android < 13 or after permanent denial, the runtime dialog does not appear and returns at once:
                // fall back to the app's notification settings screen.
                // Android < 13'te veya kalıcı reddedildikten sonra izin penceresi açılmaz ve hemen döner:
                // uygulamanın bildirim ayarları ekranına düş.
                if !verildi && bas.elapsed() < std::time::Duration::from_millis(600) {
                    crate::android_jni::bildirim_ayarlarini_ac();
                }
                Ok(())
            }
            "yukleme_izni" => crate::android_jni::guncelleme_izin_ac().map_err(Hata::Diger),
            "pil_muaf" | "mikrofon" | "kamera" => {
                let e = eylem.clone();
                let tamam = tokio::task::spawn_blocking(move || crate::android_jni::kurulum_duzelt(&e))
                    .await
                    .map_err(|err| Hata::Diger(err.to_string()))?
                    .map_err(Hata::Diger)?;
                if tamam {
                    Ok(())
                } else {
                    Err(Hata::Diger(format!("bilinmeyen eylem: {eylem}")))
                }
            }
            _ => Err(Hata::Diger(format!("bilinmeyen eylem: {eylem}"))),
        }
    } else if cfg!(target_os = "linux") {
        match eylem.as_str() {
            // The frontend displays the tray extension help text itself. · Tepsi eklentisi yardım metnini ön yüz kendisi gösterir.
            "tepsi_yardim" => Ok(()),
            _ => Err(Hata::Diger(format!("bilinmeyen eylem: {eylem}"))),
        }
    } else {
        Err(Hata::Diger(format!("bilinmeyen eylem: {eylem}")))
    }
}
