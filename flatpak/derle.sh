#!/usr/bin/env bash
# Builds the desktop app INSIDE the GNOME SDK (so it links the same WebKitGTK / glibc the users have) and packs one .flatpak file.
# The Rust toolchain comes from the Nix shell, the crates from ~/.cargo: nothing is downloaded. Low priority, few jobs.
# Masaüstü uygulamasını GNOME SDK'nın İÇİNDE derler (kullanıcılardaki WebKitGTK / glibc ile bağlanır) ve tek .flatpak dosyası yapar.
# Rust araçları Nix kabuğundan, crate'ler ~/.cargo'dan gelir: bir şey inmez. Düşük öncelik, az iş.
#
#   nix develop -c ./flatpak/derle.sh      (needs / gerekir: flatpak install --user flathub org.gnome.Sdk//51 org.gnome.Platform//51
#    org.freedesktop.Sdk.Extension.llvm23//26.08   clang: libwebrtc needs it / libwebrtc için)
set -euo pipefail
cd "$(dirname "$0")/.."
KIMLIK=dev.rubyyard.rubychat
SURUM=51
D="$PWD/src-tauri/target/flatpak"
CIKTI="${1:-$D/rubychat.flatpak}"
# A libwebrtc already on disk saves the ~100 MB download. · Diskteki hazır libwebrtc, ~100 MB'lık indirmeyi önler.
WEBRTC="${LK_CUSTOM_WEBRTC:-}"; [ -d "$D/webrtc" ] && WEBRTC="$D/webrtc"
RUST="$(dirname "$(readlink -f "$(command -v rustc)")")"
mkdir -p "$D"

npm run build
[ -d "$D/app" ] || flatpak build-init "$D/app" --sdk-extension=org.freedesktop.Sdk.Extension.llvm23 $KIMLIK org.gnome.Sdk//$SURUM org.gnome.Platform//$SURUM

# An earlier build-finish cannot be repeated: start the package folder again, the compiled crates stay in $D/hedef.
# Önceki build-finish yinelenemez: paket klasörü baştan kurulur, derlenmiş crate'ler $D/hedef'te kalır.
if [ -d "$D/app/export" ]; then
  mv "$D/app" "$D/app-eski-$(date +%s)"
  flatpak build-init "$D/app" --sdk-extension=org.freedesktop.Sdk.Extension.llvm23 $KIMLIK org.gnome.Sdk//$SURUM org.gnome.Platform//$SURUM
fi

nice -n 19 ionice -c3 flatpak build --filesystem=/nix:ro --filesystem=home --share=network \
  --env=PATH="$RUST:/usr/lib/sdk/llvm23/bin:/usr/bin:/bin" ${WEBRTC:+--env=LK_CUSTOM_WEBRTC=$WEBRTC} --env=CC=clang --env=CXX=clang++ --env=CARGO_HOME="$HOME/.cargo" --env=CARGO_TARGET_DIR="$D/hedef" --env=CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-3}" \
  "$D/app" cargo build --release --locked --offline --features tauri/custom-protocol,yerel-arama --bin rubychat --manifest-path "$PWD/src-tauri/Cargo.toml"

F="$D/app/files"
install -Dm755 "$D/hedef/release/rubychat" "$F/bin/rubychat"
install -Dm644 flatpak/$KIMLIK.desktop "$F/share/applications/$KIMLIK.desktop"
install -Dm644 flatpak/$KIMLIK.metainfo.xml "$F/share/metainfo/$KIMLIK.metainfo.xml"
install -Dm644 LICENSE "$F/share/licenses/$KIMLIK/LICENSE"
for b in 32 64 128; do install -Dm644 "src-tauri/icons/${b}x${b}.png" "$F/share/icons/hicolor/${b}x${b}/apps/$KIMLIK.png"; done
install -Dm644 src-tauri/icons/128x128@2x.png "$F/share/icons/hicolor/256x256/apps/$KIMLIK.png"
install -Dm644 src-tauri/icons/icon.png "$F/share/icons/hicolor/512x512/apps/$KIMLIK.png"
flatpak build "$D/app" desktop-file-validate /app/share/applications/$KIMLIK.desktop

# secrets = the login keys in the system keyring; xdg-download = "save media"; pulseaudio = calls.
# secrets = sistem anahtarlığındaki giriş anahtarları; xdg-download = "medyayı kaydet"; pulseaudio = aramalar.
flatpak build-finish "$D/app" --command=rubychat --share=network --share=ipc --socket=wayland --socket=fallback-x11 \
  --socket=pulseaudio --device=dri --talk-name=org.freedesktop.secrets --filesystem=xdg-download
flatpak build-export --disable-sandbox "$D/depo" "$D/app" beta
flatpak build-bundle --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo "$D/depo" "$CIKTI" $KIMLIK beta
ls -la "$CIKTI"
