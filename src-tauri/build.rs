use std::{env, fs, path::PathBuf};

fn main() {
    jni_simgelerini_tut();
    tauri_build::build()
}

/// Android + native calls: keeps libwebrtc's JNI functions (`Java_livekit_org_webrtc_*`) in our library and exports them.
/// webrtc-sys prints the same linker flags, but `cargo:rustc-link-arg` only applies to the crate that prints it, never to
/// our final .so. Without them the linker drops these unused-looking functions, Java's `nativeCreateFactory` finds no
/// implementation (UnsatisfiedLinkError) and libwebrtc aborts the whole app as soon as a call starts.
/// Android + yerel aramalar: libwebrtc'nin JNI fonksiyonlarını (`Java_livekit_org_webrtc_*`) kütüphanemizde tutar ve dışa açar.
/// webrtc-sys aynı bağlayıcı bayraklarını yazar, ama `cargo:rustc-link-arg` yalnızca onu yazan paketin kendisine uygulanır,
/// bizim son .so'muza hiç geçmez. Bunlar olmadan bağlayıcı kullanılmıyor görünen bu fonksiyonları atar, Java'nın
/// `nativeCreateFactory`si karşılığını bulamaz (UnsatisfiedLinkError) ve libwebrtc arama başlar başlamaz bütün uygulamayı düşürür.
fn jni_simgelerini_tut() {
    println!("cargo:rerun-if-env-changed=LK_CUSTOM_WEBRTC");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("android") || env::var_os("CARGO_FEATURE_YEREL_ARAMA").is_none() {
        return;
    }
    // araclar/apk.sh sets it; without it webrtc-sys would fail first anyway. · araclar/apk.sh ayarlar; yoksa webrtc-sys zaten önce düşerdi.
    let Some(kok) = env::var_os("LK_CUSTOM_WEBRTC") else {
        println!("cargo:warning=LK_CUSTOM_WEBRTC yok: libwebrtc JNI simgeleri tutulamadı, Android'de aramalar çöker");
        return;
    };
    let arsiv = PathBuf::from(kok).join("lib/libwebrtc.a");
    println!("cargo:rerun-if-changed={}", arsiv.display());
    let veri = fs::read(&arsiv).expect("libwebrtc.a okunamadı");

    // The archive's symbol table holds every name as plain text, so a byte scan finds them without readelf.
    // Arşivin simge tablosu her adı düz metin olarak tutar; readelf gerekmeden bayt taramasıyla bulunur.
    const ON: &[u8] = b"Java_livekit_org_webrtc_";
    let mut adlar = std::collections::BTreeSet::new();
    let mut i = 0;
    while let Some(k) = veri[i..].windows(ON.len()).position(|p| p == ON) {
        let bas = i + k;
        let son = veri[bas..].iter().position(|b| !(b.is_ascii_alphanumeric() || *b == b'_')).map_or(veri.len(), |n| bas + n);
        adlar.insert(String::from_utf8_lossy(&veri[bas..son]).into_owned());
        i = son;
    }
    assert!(!adlar.is_empty(), "libwebrtc.a içinde JNI simgesi yok");

    for ad in &adlar {
        println!("cargo:rustc-link-arg-cdylib=-Wl,--undefined={ad}");
    }
    let betik = PathBuf::from(env::var("OUT_DIR").unwrap()).join("webrtc_jni.map");
    let liste = adlar.iter().map(String::as_str).collect::<Vec<_>>().join("; ");
    fs::write(&betik, format!("JNI_WEBRTC {{\n\tglobal: {liste};\n}};\n")).expect("sürüm betiği yazılamadı");
    println!("cargo:rustc-link-arg-cdylib=-Wl,--version-script={}", betik.display());
}
