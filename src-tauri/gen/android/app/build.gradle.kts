import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 37
    namespace = "dev.rubyyard.rubychat"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "dev.rubyyard.rubychat"
        minSdk = 24
        targetSdk = 37
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            // Debug symbols are NOT kept: with them the APK was 871 MB and timed out over USB (~190 MB without).
            // Hata ayıklama sembolleri tutulmuyor: onlarla APK 871 MB olup USB'de zaman aşımına uğruyordu (onlarsız ~190 MB).
        }
        getByName("release") {
            // R8 off: it broke rustls-platform-verifier's Kotlin half (every HTTPS cert came back "Revoked", login failed).
            // Our Java/Kotlin code is tiny next to the Rust library, so shrinking it saved almost nothing.
            // R8 kapalı: rustls-platform-verifier'ın Kotlin yarısını bozuyordu (her HTTPS sertifikası "iptal edilmiş" dönüyor,
            // giriş başarısız oluyordu). Java/Kotlin kodumuz Rust kütüphanesinin yanında çok küçük; küçültmek neredeyse hiç kazandırmıyordu.
            isMinifyEnabled = false
            optimization {
               enable = false
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

// Note: rustls-platform-verifier's Kotlin half is vendored as source in
// src/main/java/org/rustls/platformverifier/ (its Maven archive is no longer published). Update it together with the crate.
// Not: rustls-platform-verifier'ın Kotlin yarısı kaynak olarak src/main/java/org/rustls/platformverifier/ içinde
// (Maven arşivi artık yayımlanmıyor). Crate güncellenince bunu da birlikte güncelle.

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    // Video compression (Apache-2.0, approved by the project owner): hardware H.264 / AAC transcoding, trim, scale, mute.
    // Video sıkıştırma (Apache-2.0, proje sahibi onayladı): donanım H.264 / AAC dönüşümü, kesme, boyutlandırma, sessize alma.
    implementation("androidx.media3:media3-common:1.8.0")
    implementation("androidx.media3:media3-transformer:1.8.0")
    implementation("androidx.media3:media3-effect:1.8.0")
    // libwebrtc's Java half (BSD) for native calls: copied from LiveKit's prebuilt libwebrtc by araclar/apk.sh (not in git).
    // Yerel aramalar için libwebrtc'nin Java yarısı (BSD): araclar/apk.sh LiveKit'in hazır libwebrtc'sinden kopyalar (git'te yok).
    implementation(files("libs/libwebrtc.jar"))
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
