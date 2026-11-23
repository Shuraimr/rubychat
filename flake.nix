{
  # rubychat development environment (Nix flake).
  #
  # Why: Tauri needs Rust (with Android targets), Node, the Linux WebKit libraries and, for the APK,
  # the Android SDK + NDK + JDK. Installing these by hand differs from machine to machine; here they are pinned.
  # The Android SDK license is accepted below (user decision, 2026-11-22).
  #
  # rubychat geliştirme ortamı (Nix flake).
  #
  # Neden: Tauri; Rust (Android hedefleriyle), Node, Linux WebKit kütüphaneleri ve APK için Android SDK + NDK + JDK ister.
  # Bunları elle kurmak makineden makineye değişir; burada sabitlenir.
  # Android SDK lisansı aşağıda kabul edilir (kullanıcı kararı, 2026-11-22).
  #
  # Kullanım / Usage:
  #   nix develop                       -> shell with every tool / bütün araçları içeren kabuk
  #   nix develop -c npm run tauri dev  -> desktop app / masaüstü uygulaması
  #   nix develop -c npm run apk        -> Android APK (arm64)
  description = "rubychat: Matrix istemcisi (Tauri 2 + matrix-rust-sdk + Svelte 5)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay = { url = "github:oxalica/rust-overlay"; inputs.nixpkgs.follows = "nixpkgs"; };
  };

  outputs = { self, nixpkgs, rust-overlay }:
    let
      sistem = "x86_64-linux";
      pkgs = import nixpkgs {
        system = sistem;
        overlays = [ rust-overlay.overlays.default ];
        config = { allowUnfree = true; android_sdk.accept_license = true; };
      };
      # Stable Rust + the targets Tauri builds for Android (phones are arm64; the others for emulators/old phones)
      # Kararlı Rust + Tauri'nin Android için derlediği hedefler (telefonlar arm64; diğerleri emülatör/eski telefon)
      rust = pkgs.rust-bin.stable.latest.default.override {
        extensions = [ "rust-src" "rust-analyzer" "clippy" ];
        targets = [ "aarch64-linux-android" "armv7-linux-androideabi" "x86_64-linux-android" "i686-linux-android" ];
      };
      android = pkgs.androidenv.composeAndroidPackages {
        platformVersions = [ "36" "37" ];
        buildToolsVersions = [ "36.0.0" "35.0.0" ];
        includeNDK = true;
      };
      sdk = "${android.androidsdk}/libexec/android-sdk";
    in {
      devShells.${sistem}.default = pkgs.mkShell {
        nativeBuildInputs = with pkgs; [ rust nodejs_22 pkg-config jdk17 android.androidsdk cargo-tauri gh jq ];
        # Linux desktop (WebKitGTK) libraries / Linux masaüstü (WebKitGTK) kütüphaneleri
        buildInputs = with pkgs; [
          webkitgtk_4_1 gtk3 libsoup_3 glib-networking librsvg openssl dbus
          # Calls (Element Call in WebKitGTK): WebKit's WebRTC runs on GStreamer's `webrtcbin`, whose ICE part is the `nice` plugin that ships
          # in `libnice` (lib/gstreamer-1.0/libgstnice.so); -bad has webrtcbin/dtls/srtp, -good the RTP + vpx/opus parts.
          # Aramalar (WebKitGTK'de Element Call): WebKit'in WebRTC'si GStreamer `webrtcbin` üzerinde çalışır; ICE kısmı `libnice` ile gelen
          # `nice` eklentisidir (lib/gstreamer-1.0/libgstnice.so); -bad webrtcbin/dtls/srtp, -good RTP + vpx/opus parçalarını taşır.
          libnice gst_all_1.gstreamer gst_all_1.gst-plugins-base gst_all_1.gst-plugins-good gst_all_1.gst-plugins-bad
        ];
        ANDROID_HOME = sdk;
        ANDROID_SDK_ROOT = sdk;
        NDK_HOME = "${sdk}/ndk-bundle";
        JAVA_HOME = "${pkgs.jdk17}";
        shellHook = ''
          # Gradle's own aapt2 works on Fedora; on NixOS use the SDK's / NixOS'ta SDK'nınkini kullan
          export GRADLE_OPTS="-Dorg.gradle.project.android.aapt2FromMavenOverride=${sdk}/build-tools/36.0.0/aapt2"
          export GIO_MODULE_DIR=${pkgs.glib-networking}/lib/gio/modules/
          # GStreamer finds its plugins through this variable inside the Nix shell (the `nice` plugin comes from libnice).
          # Nix kabuğunda GStreamer eklentilerini bu değişkenle bulur (`nice` eklentisi libnice'ten gelir).
          export GST_PLUGIN_SYSTEM_PATH_1_0="${pkgs.libnice}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-good}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-bad}/lib/gstreamer-1.0"
        '';
      };
    };
}
