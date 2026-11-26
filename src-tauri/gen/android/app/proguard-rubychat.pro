# Kotlin classes that Rust reaches through JNI by name (release builds minify): keep their static methods.
# Rust'ın JNI ile adıyla çağırdığı Kotlin sınıfları (yayın derlemesi küçültür): static metotlarını koru.
-keep class dev.rubyyard.rubychat.GizliKasa { *; }
-keep class dev.rubyyard.rubychat.VideoSikistir { *; }
-keep class dev.rubyyard.rubychat.Bildirimci { *; }
-keep class dev.rubyyard.rubychat.MedyaDepo { *; }
-keep class dev.rubyyard.rubychat.YerelKoprusu { *; }
# Safety net: keep every app class (JNI names, inner classes, receivers referenced from the manifest).
# Emniyet ağı: uygulamanın bütün sınıflarını koru (JNI adları, iç sınıflar, manifestteki alıcılar).
-keep class dev.rubyyard.rubychat.** { *; }
# libwebrtc's Java helpers, reached from native code by name. · Yerel koddan adıyla çağrılan libwebrtc Java yardımcıları.
-keep class livekit.org.webrtc.** { *; }
