# rubychat

A mobile-first Matrix chat client from the rubyyard family. Tauri 2 + [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk) + Svelte 5.
End-to-end encryption is on by default; keys stay on your device. Works with any Matrix homeserver.

**Version v0.1.0 (foundation):** password login, room list, room timeline with history paging, sending text, read receipts.
Planned: SSO/OIDC, device verification, media, spaces, push notifications, calls. See `docs/MIMARI.md` (Turkish).

## Develop

Everything runs inside the Nix dev shell (Rust with Android targets, Node 22, JDK, Android SDK/NDK, WebKitGTK, `cargo tauri`):

```sh
nix develop -c npm install
nix develop -c npm run tauri dev     # desktop app
nix develop -c npm run apk           # Android debug APK (arm64)
nix develop -c npm run check         # svelte-check
```

Türkçe: [README.tr.md](README.tr.md)

## License

AGPL-3.0-or-later (see `LICENSE`). Brand assets (name, logo) belong to the rubyyard project and are not covered by the AGPL.
