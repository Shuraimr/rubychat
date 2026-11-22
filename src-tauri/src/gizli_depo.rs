//! Secret storage behind a small trait, so session tokens and the SQLite store passphrase never sit in a plain file
//! when the platform offers something better.
//! Gizli bilgi deposu küçük bir trait'in arkasında: platform daha iyisini sunuyorsa oturum belirteçleri ve SQLite depo
//! parolası düz dosyada durmaz.
//!
//! Backends / Arka uçlar:
//!  - desktop (Linux Secret Service, macOS Keychain, Windows Credential Manager): `keyring` crate
//!    masaüstü (Linux Secret Service, macOS Anahtar Zinciri, Windows Kimlik Bilgisi Yöneticisi): `keyring` crate'i
//!  - Android: Android Keystore (AES-GCM key that never leaves the secure hardware/OS) through a Kotlin helper `GizliKasa`,
//!    called from Rust with JNI. Kotlin stores only the ciphertext in the app's private files folder.
//!    Android: Android Keystore (güvenli donanımdan/işletim sisteminden çıkmayan AES-GCM anahtarı); Kotlin yardımcısı
//!    `GizliKasa`, Rust'tan JNI ile çağrılır. Kotlin yalnızca şifreli metni uygulamanın özel dosya klasöründe tutar.
//!
//! If a backend is unavailable at runtime (for example no Secret Service daemon on a bare Linux session) the caller
//! (`matrix/oturum.rs`) falls back to the old file and the UI shows a note. The trait never decides that itself.
//! Bir arka uç çalışma anında kullanılamıyorsa (ör. yalın bir Linux oturumunda Secret Service yok) çağıran
//! (`matrix/oturum.rs`) eski dosyaya döner ve arayüz bir not gösterir. Trait bunu kendisi kararlaştırmaz.

use crate::hata::{Hata, Sonuc};

pub trait GizliDepo: Send + Sync {
    /// Stable name shown in the UI / saved next to the session ("anahtarlik", "android_kasa").
    /// Arayüzde gösterilen / oturumun yanına kaydedilen kararlı ad ("anahtarlik", "android_kasa").
    fn ad(&self) -> &'static str;
    /// `Ok(None)` = nothing stored under that key. · `Ok(None)` = o anahtarla bir şey saklı değil.
    fn oku(&self, anahtar: &str) -> Sonuc<Option<String>>;
    fn yaz(&self, anahtar: &str, deger: &str) -> Sonuc<()>;
    /// Deleting something that does not exist is not an error. · Olmayanı silmek hata değildir.
    fn sil(&self, anahtar: &str) -> Sonuc<()>;
}

/// The backend for this platform. · Bu platformun arka ucu.
pub fn varsayilan() -> Box<dyn GizliDepo> {
    #[cfg(target_os = "android")]
    {
        Box::new(android::AndroidKasasi)
    }
    #[cfg(not(target_os = "android"))]
    {
        Box::new(masaustu::Anahtarlik)
    }
}

/// Desktop backend: the OS keyring through the `keyring` crate.
/// Masaüstü arka ucu: `keyring` crate'i ile işletim sistemi anahtarlığı.
#[cfg(not(target_os = "android"))]
mod masaustu {
    use super::*;

    const SERVIS: &str = "dev.rubyyard.rubychat";

    pub struct Anahtarlik;

    fn giris(anahtar: &str) -> Sonuc<keyring::Entry> {
        keyring::Entry::new(SERVIS, anahtar).map_err(|e| Hata::Depolama(format!("anahtarlık: {e}")))
    }

    impl GizliDepo for Anahtarlik {
        fn ad(&self) -> &'static str {
            "anahtarlik"
        }

        fn oku(&self, anahtar: &str) -> Sonuc<Option<String>> {
            match giris(anahtar)?.get_password() {
                Ok(d) => Ok(Some(d)),
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(e) => Err(Hata::Depolama(format!("anahtarlık okunamadı: {e}"))),
            }
        }

        fn yaz(&self, anahtar: &str, deger: &str) -> Sonuc<()> {
            giris(anahtar)?.set_password(deger).map_err(|e| Hata::Depolama(format!("anahtarlığa yazılamadı: {e}")))
        }

        fn sil(&self, anahtar: &str) -> Sonuc<()> {
            match giris(anahtar)?.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(e) => Err(Hata::Depolama(format!("anahtarlıktan silinemedi: {e}"))),
            }
        }
    }
}

/// Android Keystore through JNI. The Kotlin side (`GizliKasa.kt`) owns the crypto and the file; Rust only passes strings.
/// Why JNI and not a Tauri plugin: a plugin needs its own crate + permissions + build wiring for three tiny calls, while
/// `ndk-context` (set up by tao at startup) already gives us the JVM and the application Context.
/// Android Keystore, JNI ile. Kotlin tarafı (`GizliKasa.kt`) şifrelemeyi ve dosyayı yönetir; Rust yalnızca metin geçirir.
/// Neden Tauri eklentisi değil: eklenti üç küçük çağrı için ayrı crate + izin + derleme kurulumu ister; `ndk-context`
/// (tao açılışta kurar) JVM'i ve uygulama Context'ini zaten verir.
///
/// NOTE: written without a device/emulator at hand: it type-checks (see docs/MIMARI.md) but has never run on Android.
/// NOT: elde cihaz/emülatör olmadan yazıldı: tip denetiminden geçer (bkz. docs/MIMARI.md) ama Android'de hiç çalışmadı.
#[cfg(target_os = "android")]
mod android {
    use super::*;
    use jni::{
        objects::{JObject, JString, JValue},
        JNIEnv, JavaVM,
    };

    pub struct AndroidKasasi;

    const SINIF: &str = "dev.rubyyard.rubychat.GizliKasa";

    fn hata(e: impl std::fmt::Display) -> Hata {
        Hata::Depolama(format!("android kasası: {e}"))
    }

    /// Runs `f` with an attached JNI env, the application Context and our Kotlin class.
    /// Class lookup goes through the Context's class loader: from a native (non-Java) thread `FindClass` would only see
    /// system classes, not the app's.
    /// `f`yi bağlı bir JNI ortamı, uygulama Context'i ve Kotlin sınıfımızla çalıştırır.
    /// Sınıf, Context'in sınıf yükleyicisiyle aranır: Java olmayan (yerel) iş parçacığında `FindClass` yalnızca sistem
    /// sınıflarını görür, uygulamanınkileri görmez.
    fn jni_calistir<T>(f: impl FnOnce(&mut JNIEnv, &JObject, &jni::objects::JClass) -> jni::errors::Result<T>) -> Sonuc<T> {
        let ctx = ndk_context::android_context();
        // SAFETY: the pointers come from `ndk_context`, which tao fills with the live JavaVM and the application Context
        // global reference before our code runs. · İşaretçiler `ndk_context`ten gelir; tao bunları kodumuz çalışmadan önce
        // canlı JavaVM ve uygulama Context'i global referansıyla doldurur.
        let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(hata)?;
        let mut env = vm.attach_current_thread().map_err(hata)?;
        let context = unsafe { JObject::from_raw(ctx.context().cast()) };
        let yukleyici = env
            .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
            .and_then(|v| v.l())
            .map_err(hata)?;
        let ad = env.new_string(SINIF).map_err(hata)?;
        let sinif = env
            .call_method(&yukleyici, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;", &[JValue::Object(&ad)])
            .and_then(|v| v.l())
            .map_err(hata)?;
        let sinif = jni::objects::JClass::from(sinif);
        let sonuc = f(&mut env, &context, &sinif);
        // A pending Java exception must be cleared, or the next JNI call on this thread would abort.
        // Bekleyen Java istisnası temizlenmeli; yoksa bu iş parçacığındaki sonraki JNI çağrısı çöker.
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
            return Err(hata("Java istisnası"));
        }
        sonuc.map_err(hata)
    }

    fn metin_al(env: &mut JNIEnv, nesne: JObject) -> jni::errors::Result<Option<String>> {
        if nesne.is_null() {
            return Ok(None);
        }
        let s: String = env.get_string(&JString::from(nesne))?.into();
        Ok(Some(s))
    }

    impl GizliDepo for AndroidKasasi {
        fn ad(&self) -> &'static str {
            "android_kasa"
        }

        fn oku(&self, anahtar: &str) -> Sonuc<Option<String>> {
            jni_calistir(|env, ctx, sinif| {
                let a = env.new_string(anahtar)?;
                let r = env.call_static_method(
                    sinif,
                    "oku",
                    "(Landroid/content/Context;Ljava/lang/String;)Ljava/lang/String;",
                    &[JValue::Object(ctx), JValue::Object(&a)],
                )?;
                metin_al(env, r.l()?)
            })
        }

        fn yaz(&self, anahtar: &str, deger: &str) -> Sonuc<()> {
            jni_calistir(|env, ctx, sinif| {
                let a = env.new_string(anahtar)?;
                let d = env.new_string(deger)?;
                env.call_static_method(
                    sinif,
                    "yaz",
                    "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;)V",
                    &[JValue::Object(ctx), JValue::Object(&a), JValue::Object(&d)],
                )?;
                Ok(())
            })
        }

        fn sil(&self, anahtar: &str) -> Sonuc<()> {
            jni_calistir(|env, ctx, sinif| {
                let a = env.new_string(anahtar)?;
                env.call_static_method(
                    sinif,
                    "sil",
                    "(Landroid/content/Context;Ljava/lang/String;)V",
                    &[JValue::Object(ctx), JValue::Object(&a)],
                )?;
                Ok(())
            })
        }
    }
}
