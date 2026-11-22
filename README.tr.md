# rubychat

rubyyard ailesinden, telefon öncelikli bir Matrix sohbet istemcisi. Tauri 2 + [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk) + Svelte 5.
Uçtan uca şifreleme varsayılan olarak açıktır; anahtarların cihazında kalır. Her Matrix sunucusuyla çalışır.

**Sürüm v0.1.0 (temel):** şifreyle giriş, oda listesi, geçmiş sayfalamalı oda zaman çizelgesi, metin gönderme, okundu bilgisi.
Planlananlar: SSO/OIDC, cihaz doğrulama, medya, alanlar, anlık bildirim, görüşmeler. Ayrıntı: `docs/MIMARI.md`.

## Geliştirme

Her şey Nix geliştirme kabuğunda çalışır (Android hedefli Rust, Node 22, JDK, Android SDK/NDK, WebKitGTK, `cargo tauri`):

```sh
nix develop -c npm install
nix develop -c npm run tauri dev     # masaüstü uygulaması
nix develop -c npm run apk           # Android debug APK (arm64)
nix develop -c npm run check         # svelte-check
```

English: [README.md](README.md)

## Lisans

AGPL-3.0-or-later (`LICENSE`). Marka varlıkları (ad, logo) rubyyard projesine aittir ve AGPL kapsamında değildir.
