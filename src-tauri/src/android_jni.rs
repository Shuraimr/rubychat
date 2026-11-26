//! Calls into our Kotlin helpers (`VideoSikistir`, `Bildirimci`, `MedyaDepo`) through JNI.
//! Kotlin yardımcılarımıza (`VideoSikistir`, `Bildirimci`, `MedyaDepo`) JNI ile yapılan çağrılar.
//!
//! Same pattern as `gizli_depo.rs`: `ndk-context` (filled by tao at startup) gives the JVM and the application Context, and the
//! Kotlin class is found through the Context's class loader because `FindClass` on a native thread only sees system classes.
//! The module compiles on every platform (so `cargo check` on the desktop type-checks it) but every function only works on Android;
//! elsewhere they return `Err` / a harmless default, and callers guard with `cfg!(target_os = "android")`.
//! `gizli_depo.rs` ile aynı kalıp: `ndk-context` (tao açılışta doldurur) JVM'i ve uygulama Context'ini verir; Kotlin sınıfı Context'in
//! sınıf yükleyicisiyle bulunur, çünkü yerel iş parçacığında `FindClass` yalnızca sistem sınıflarını görür.
//! Modül her platformda derlenir (masaüstündeki `cargo check` tip denetimi yapar) ama işlevler yalnızca Android'de çalışır;
//! başka yerde `Err` / zararsız varsayılan döner, çağıranlar `cfg!(target_os = "android")` ile korur.
//!
//! NOTE: never run on a device while writing this (no Android build allowed here). · NOT: yazılırken cihazda hiç çalıştırılmadı.

use jni::{
    objects::{JClass, JObject, JString, JValue},
    JNIEnv, JavaVM,
};

const PAKET: &str = "dev.rubyyard.rubychat";

/// Runs `f` with an attached env, the application Context and the named Kotlin class. Clears a pending Java exception.
/// `f`yi bağlı bir ortam, uygulama Context'i ve adı verilen Kotlin sınıfıyla çalıştırır. Bekleyen Java istisnasını temizler.
fn calistir<T>(sinif: &str, f: impl FnOnce(&mut JNIEnv, &JObject, &JClass) -> jni::errors::Result<T>) -> Result<T, String> {
    if !cfg!(target_os = "android") {
        return Err("yalnızca Android".into());
    }
    let ctx = ndk_context::android_context();
    // SAFETY: on Android the pointers are the live JavaVM and application Context set up by tao before our code runs.
    // GÜVENLİK: Android'de işaretçiler, kodumuz çalışmadan önce tao'nun kurduğu canlı JavaVM ve uygulama Context'idir.
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };
    let yukleyici = env
        .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
        .and_then(|v| v.l())
        .map_err(|e| e.to_string())?;
    let ad = env.new_string(format!("{PAKET}.{sinif}")).map_err(|e| e.to_string())?;
    let sinif_nesnesi = env
        .call_method(&yukleyici, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;", &[JValue::Object(&ad)])
        .and_then(|v| v.l())
        .map_err(|e| e.to_string())?;
    let sinif_nesnesi = JClass::from(sinif_nesnesi);
    let sonuc = f(&mut env, &context, &sinif_nesnesi);
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
        return Err("Java istisnası".into());
    }
    sonuc.map_err(|e| e.to_string())
}

fn metin(env: &mut JNIEnv, nesne: JObject) -> jni::errors::Result<String> {
    if nesne.is_null() {
        return Ok(String::new());
    }
    Ok(env.get_string(&JString::from(nesne))?.into())
}

// ---- VideoSikistir ----

/// Transcodes a video (blocks until done, call from a blocking thread). Returns "ok;<w>;<h>;<sureMs>" or "hata;<mesaj>".
/// Videoyu yeniden kodlar (bitene dek bekler, bloklayan iş parçacığından çağır). "ok;<w>;<h>;<sureMs>" ya da "hata;<mesaj>" döner.
pub fn video_sikistir(girdi: &str, cikti: &str, yukseklik: i32, bitrate: i32, basla_ms: i64, bitis_ms: i64, sessiz: bool) -> Result<String, String> {
    calistir("VideoSikistir", |env, ctx, sinif| {
        let g = env.new_string(girdi)?;
        let c = env.new_string(cikti)?;
        let r = env.call_static_method(
            sinif,
            "calistir",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;IIJJZ)Ljava/lang/String;",
            &[
                JValue::Object(ctx),
                JValue::Object(&g),
                JValue::Object(&c),
                JValue::Int(yukseklik),
                JValue::Int(bitrate),
                JValue::Long(basla_ms),
                JValue::Long(bitis_ms),
                JValue::Bool(sessiz as u8),
            ],
        )?;
        metin(env, r.l()?)
    })
}

pub fn video_ilerleme() -> i32 {
    calistir("VideoSikistir", |env, _, sinif| env.call_static_method(sinif, "ilerleme", "()I", &[])?.i()).unwrap_or(0)
}

pub fn video_iptal() {
    let _ = calistir("VideoSikistir", |env, _, sinif| env.call_static_method(sinif, "iptal", "()V", &[]).map(|_| ()));
}

// ---- Bildirimci ----

#[allow(clippy::too_many_arguments)]
pub fn bildirim_goster(oda_id: &str, oda_ad: &str, gonderen: &str, metni: &str, zaman: i64, arama: bool, olay_id: &str) -> Result<(), String> {
    calistir("Bildirimci", |env, ctx, sinif| {
        let (a, b, c, d, e) = (
            env.new_string(oda_id)?,
            env.new_string(oda_ad)?,
            env.new_string(gonderen)?,
            env.new_string(metni)?,
            env.new_string(olay_id)?,
        );
        env.call_static_method(
            sinif,
            "goster",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;JZLjava/lang/String;)V",
            &[
                JValue::Object(ctx),
                JValue::Object(&a),
                JValue::Object(&b),
                JValue::Object(&c),
                JValue::Object(&d),
                JValue::Long(zaman),
                JValue::Bool(arama as u8),
                JValue::Object(&e),
            ],
        )
        .map(|_| ())
    })
}

pub fn bildirim_temizle(oda_id: &str) {
    let _ = calistir("Bildirimci", |env, ctx, sinif| {
        let a = env.new_string(oda_id)?;
        env.call_static_method(sinif, "temizle", "(Landroid/content/Context;Ljava/lang/String;)V", &[JValue::Object(ctx), JValue::Object(&a)])
            .map(|_| ())
    });
}

/// Every notification of the app (see `Bildirimci.hepsiniTemizle`). · Uygulamanın bütün bildirimleri.
pub fn bildirim_hepsini_temizle() {
    let _ = calistir("Bildirimci", |env, ctx, sinif| {
        env.call_static_method(sinif, "hepsiniTemizle", "(Landroid/content/Context;)V", &[JValue::Object(ctx)]).map(|_| ())
    });
}

/// Is the Android activity started (visible)? Unknown = true, so we never swallow a notification by mistake in the wrong direction.
/// Android etkinliği başlamış (görünür) mı? Bilinmiyorsa true.
pub fn on_planda_mi() -> bool {
    calistir("Bildirimci", |env, _, sinif| env.call_static_method(sinif, "onPlandaMi", "()Z", &[])?.z()).unwrap_or(true)
}

pub fn bildirim_izni_var() -> bool {
    calistir("Bildirimci", |env, ctx, sinif| {
        env.call_static_method(sinif, "izinVar", "(Landroid/content/Context;)Z", &[JValue::Object(ctx)])?.z()
    })
    .unwrap_or(false)
}

pub fn bildirim_izni_iste() -> Result<(), String> {
    calistir("Bildirimci", |env, _, sinif| env.call_static_method(sinif, "izinIste", "()V", &[]).map(|_| ()))
}

/// 0 = waiting, 1 = granted, 2 = denied · 0 = bekliyor, 1 = verildi, 2 = reddedildi
pub fn bildirim_izni_sonuc() -> i32 {
    calistir("Bildirimci", |env, _, sinif| env.call_static_method(sinif, "izinSonuc", "()I", &[])?.i()).unwrap_or(2)
}

pub fn bildirim_ayarlarini_ac() {
    let _ = calistir("Bildirimci", |env, ctx, sinif| {
        env.call_static_method(sinif, "ayarlariAc", "(Landroid/content/Context;)V", &[JValue::Object(ctx)]).map(|_| ())
    });
}

/// The room a tapped notification asked for (cold start); also tells Kotlin the page is ready for live events.
/// Dokunulan bildirimin istediği oda (soğuk açılış); ayrıca Kotlin'e sayfanın canlı olaylara hazır olduğunu bildirir.
pub fn bekleyen_oda() -> Option<String> {
    let s = calistir("Bildirimci", |env, _, sinif| {
        let r = env.call_static_method(sinif, "bekleyenOdaAl", "()Ljava/lang/String;", &[])?;
        metin(env, r.l()?)
    })
    .ok()?;
    if s.is_empty() { None } else { Some(s) }
}

// ---- MedyaDepo ----

/// Saves a cached file to the phone's gallery / downloads. Returns "" on success, otherwise an error text.
/// Önbellekteki dosyayı telefonun galerisine / indirilenlere kaydeder. Başarıda "", yoksa hata metni döner.
pub fn medya_kaydet(yol: &str, ad: &str, mime: &str) -> Result<String, String> {
    calistir("MedyaDepo", |env, ctx, sinif| {
        let (a, b, c) = (env.new_string(yol)?, env.new_string(ad)?, env.new_string(mime)?);
        let r = env.call_static_method(
            sinif,
            "kaydet",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
            &[JValue::Object(ctx), JValue::Object(&a), JValue::Object(&b), JValue::Object(&c)],
        )?;
        metin(env, r.l()?)
    })
}

// ---- AramaSesi (native calls · yerel aramalar) ----
// The loops run inside one `calistir`: the thread stays attached and the class is looked up once, not 100 times a second.
// Döngüler tek bir `calistir` içinde döner: iş parçacığı bağlı kalır ve sınıf saniyede 100 kez değil, bir kez aranır.

/// Hands the JVM and the Context to libwebrtc (its Java helpers live in libwebrtc.jar). Once, before the first call.
/// JVM'i ve Context'i libwebrtc'ye verir (Java yardımcıları libwebrtc.jar'da). İlk aramadan önce bir kez.
#[cfg(all(feature = "yerel-arama", target_os = "android"))]
pub fn webrtc_baslat() {
    let ctx = ndk_context::android_context();
    // SAFETY: the live JavaVM and Context set up by tao. · GÜVENLİK: tao'nun kurduğu canlı JavaVM ve Context.
    let Ok(vm) = (unsafe { JavaVM::from_raw(ctx.vm().cast()) }) else { return };
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };
    if !libwebrtc::android::initialize_android_context(&vm, &context) {
        tracing::warn!("libwebrtc Android bağlamı kurulamadı");
    }
}

/// Opens the player (AudioTrack, 48 kHz stereo, voice call use); returns its id (generation). · Çaları açar (AudioTrack, 48 kHz stereo, sesli arama kullanımı); kimliğini (kuşağını) döndürür.
pub fn arama_sesi_cal_ac() -> Result<i32, String> {
    let id = calistir("AramaSesi", |env, ctx, s| env.call_static_method(s, "calAc", "(Landroid/content/Context;)I", &[JValue::Object(ctx)])?.i())?;
    if id > 0 { Ok(id) } else { Err("AudioTrack açılamadı".into()) }
}

/// Stops the player with this id (a newer one is left alone); a write that waits returns. · Bu kimlikli çaları durdurur (daha yeniye dokunmaz); bekleyen yazma döner.
pub fn arama_sesi_cal_kapat(id: i32) {
    let _ = calistir("AramaSesi", |env, _, s| env.call_static_method(s, "calKapat", "(I)V", &[JValue::Int(id)]).map(|_| ()));
}

/// Writes `sonraki()` (10 ms interleaved stereo) until `dur`; each write blocks until the device took it.
/// `dur` gelene dek `sonraki()`yi (10 ms iç içe stereo) yazar; her yazma cihaz alana dek bekler.
pub fn arama_sesi_cal_dongusu(id: i32, dur: &std::sync::atomic::AtomicBool, mut sonraki: impl FnMut() -> Vec<i16>) -> Result<(), String> {
    use std::sync::atomic::Ordering::Relaxed;
    calistir("AramaSesi", |env, _, s| {
        let mut dizi = None;
        let mut boy = 0;
        while !dur.load(Relaxed) {
            let kare = sonraki();
            if dizi.is_none() || boy != kare.len() {
                boy = kare.len();
                dizi = Some(env.new_short_array(boy as i32)?);
            }
            let d = dizi.as_ref().expect("dizi");
            env.set_short_array_region(d, 0, &kare)?;
            let n = env.call_static_method(s, "yaz", "(I[SI)I", &[JValue::Int(id), JValue::Object(d), JValue::Int(boy as i32)])?.i()?;
            if n < 0 && !dur.load(Relaxed) {
                return Ok(Err(format!("AudioTrack.write {n}")));
            }
        }
        Ok(Ok(()))
    })?
}

/// Opens the microphone (AudioRecord, voice communication source: the phone's own echo canceller) and hands `kare`-sample mono blocks to
/// `al` until `dur` or `al` says false. Closes it at the end.
/// Mikrofonu açar (AudioRecord, sesli iletişim kaynağı: telefonun kendi yankı gidericisi) ve `dur` ya da `al` false diyene dek `kare`
/// örneklik mono blokları `al`a verir. Sonunda kapatır.
pub fn arama_sesi_kayit_dongusu(dur: &std::sync::atomic::AtomicBool, id_yuvasi: &std::sync::atomic::AtomicI32, kare: usize, al: &mut impl FnMut(Vec<i16>) -> bool) -> Result<(), String> {
    use std::sync::atomic::Ordering::{Relaxed, SeqCst};
    let sonuc = calistir("AramaSesi", |env, ctx, s| {
        let id = env.call_static_method(s, "kayitAc", "(Landroid/content/Context;)I", &[JValue::Object(ctx)])?.i()?;
        if id <= 0 {
            return Ok(Err("AudioRecord açılamadı (izin?)".to_owned()));
        }
        // Published so the owner (`Kayit::drop`) can close exactly this microphone and wake the waiting read.
        // Yayınlanır ki sahibi (`Kayit::drop`) tam bu mikrofonu kapatıp bekleyen okumayı uyandırabilsin.
        id_yuvasi.store(id, SeqCst);
        let dizi = env.new_short_array(kare as i32)?;
        let mut v = vec![0i16; kare];
        let sonuc: jni::errors::Result<Result<(), String>> = (|| {
            while !dur.load(Relaxed) {
                let n = env.call_static_method(s, "oku", "(I[SI)I", &[JValue::Int(id), JValue::Object(&dizi), JValue::Int(kare as i32)])?.i()?;
                if n < 0 {
                    return Ok(if dur.load(Relaxed) { Ok(()) } else { Err(format!("AudioRecord.read {n}")) });
                }
                if n as usize != kare {
                    continue;
                }
                env.get_short_array_region(&dizi, 0, &mut v)?;
                if !al(v.clone()) {
                    dur.store(true, Relaxed);
                }
            }
            Ok(Ok(()))
        })();
        // Closed here whatever happened, but only this loop's own microphone. · Ne olursa olsun burada kapanır, ama yalnızca bu döngünün kendi mikrofonu.
        id_yuvasi.compare_exchange(id, 0, SeqCst, SeqCst).ok();
        let _ = env.call_static_method(s, "kayitKapat", "(I)V", &[JValue::Int(id)]);
        sonuc
    });
    sonuc?
}

/// Stops the microphone with this id; a read that waits returns. · Bu kimlikli mikrofonu durdurur; bekleyen okuma döner.
pub fn arama_sesi_kayit_kapat(id: i32) {
    let _ = calistir("AramaSesi", |env, _, s| env.call_static_method(s, "kayitKapat", "(I)V", &[JValue::Int(id)]).map(|_| ()));
}
