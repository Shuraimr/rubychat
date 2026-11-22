# Called only from Rust through JNI, so R8 would remove it as unused.
# Yalnızca Rust'tan JNI ile çağrılır; R8 kullanılmıyor sanıp silmesin.
-keep, includedescriptorclasses class org.rustls.platformverifier.** { *; }
