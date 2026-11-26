#!/bin/sh
# Builds the APK with native calls. LiveKit's prebuilt libwebrtc for Android (BSD, ~160 MB zip) is downloaded once into
# src-tauri/target/webrtc and used from there (LK_CUSTOM_WEBRTC), so cargo does not fetch it again; its Java half (libwebrtc.jar)
# goes to the app's libs folder, where Gradle picks it up. The tag must match webrtc-sys-build's WEBRTC_TAG.
# Yerel aramalı APK'yi derler. LiveKit'in Android için hazır libwebrtc'si (BSD, ~160 MB zip) bir kez src-tauri/target/webrtc'ye
# indirilir ve oradan kullanılır (LK_CUSTOM_WEBRTC), cargo yeniden çekmez; Java yarısı (libwebrtc.jar) uygulamanın libs klasörüne
# gider, Gradle oradan alır. Etiket webrtc-sys-build'in WEBRTC_TAG'i ile aynı olmalı.
set -eu
KOK=$(cd "$(dirname "$0")/.." && pwd)
ETIKET=webrtc-a545de4
AD=webrtc-android-arm64-release
# The zip unpacks into a folder without the "webrtc-" prefix. · Zip, "webrtc-" öneki olmayan bir klasöre açılır.
IC=android-arm64-release
DIZIN="$KOK/src-tauri/target/webrtc/$ETIKET"

if [ ! -f "$DIZIN/$IC/lib/libwebrtc.a" ]; then
  mkdir -p "$DIZIN"
  curl -fL --retry 3 -C - -o "$DIZIN/$AD.zip" "https://github.com/livekit/rust-sdks/releases/download/$ETIKET/$AD.zip"
  (cd "$DIZIN" && unzip -q -o "$AD.zip")
fi
mkdir -p "$KOK/src-tauri/gen/android/app/libs"
cp "$DIZIN/$IC/libwebrtc.jar" "$KOK/src-tauri/gen/android/app/libs/libwebrtc.jar"

[ "${1:-}" = "--yalniz-hazirla" ] && exit 0
export LK_CUSTOM_WEBRTC="$DIZIN/$IC"
export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${NDK_HOME:-}}"
exec cargo tauri android build --apk --target aarch64 --features yerel-arama
