#!/usr/bin/env bash
# `cargo <args>` of the app with the native call engine, inside the GNOME SDK. · Uygulamanın yerel arama motorlu `cargo` komutları, GNOME SDK içinde.
#   nix develop -c ./flatpak/denetle.sh check --offline
set -euo pipefail
cd "$(dirname "$0")/.."
D="$PWD/src-tauri/target/flatpak"
# A libwebrtc already on disk saves the ~100 MB download. · Diskteki hazır libwebrtc, ~100 MB'lık indirmeyi önler.
WEBRTC="${LK_CUSTOM_WEBRTC:-}"; [ -d "$D/webrtc" ] && WEBRTC="$D/webrtc"
RUST="$(dirname "$(readlink -f "$(command -v rustc)")")"
[ -d "$D/sdk" ] || flatpak build-init --sdk-extension=org.freedesktop.Sdk.Extension.llvm23 "$D/sdk" dev.rubyyard.rubychat org.gnome.Sdk//51 org.gnome.Platform//51
KOMUT="$1"; shift
exec nice -n 19 ionice -c3 flatpak build --filesystem=/nix:ro --filesystem=home --share=network --socket=pulseaudio \
  --env=PATH="$RUST:/usr/lib/sdk/llvm23/bin:/usr/bin:/bin" ${WEBRTC:+--env=LK_CUSTOM_WEBRTC=$WEBRTC} --env=CC=clang --env=CXX=clang++ --env=CARGO_HOME="$HOME/.cargo" \
  --env=CARGO_TARGET_DIR="$D/hedef" --env=CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-3}" \
  "$D/sdk" cargo "$KOMUT" --release --features tauri/custom-protocol,yerel-arama --manifest-path "$PWD/src-tauri/Cargo.toml" "$@"
