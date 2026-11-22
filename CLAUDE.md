# rubychat — Claude için proje rehberi

Matrix istemcisi (rubyyard ailesi): Android öncelikli, masaüstü de çalışır. Mimari ve genişletme noktaları: `docs/MIMARI.md`
(değişince güncelle). Kardeş proje: `~/Projeler/rubyyard` (forum; tasarım dili ve token'lar oradan).

## Teknoloji ve komutlar

- Tauri 2 + matrix-rust-sdk (`matrix-sdk` + `matrix-sdk-ui`, 0.19, rustls, SQLite) + Svelte 5 (rune'lar) + TypeScript + Vite.
- Her şey nix kabuğunda: `nix develop -c <komut>` (Rust + Android hedefleri, Node 22, JDK17, Android SDK/NDK, webkitgtk, `cargo tauri`).
  Aracı başka yoldan kurma; eksikse `flake.nix`'e ekle.
- Tauri CLI = `cargo tauri` (npm'de `@tauri-apps/cli` YOK). `npm run tauri dev` masaüstü geliştirme; `npm run apk` Android debug APK.
- Doğrulama: `nix develop -c npm run check` (0 hata), `nix develop -c npm run build`, `cd src-tauri && nix develop -c cargo check`,
  `nix develop -c cargo tauri build --debug --no-bundle` (masaüstü ikilisi bağlanmalı).
- Yeni npm/crate eklemeden önce kullanıcıya sor; lisans AGPL-3.0-or-later ile uyumlu olmalı (MIT, BSD, ISC, Apache-2.0, LGPL).
- Matrix SDK API'si sürümler arasında değişir: tahmin etme, `~/.cargo/registry/src/*/matrix-sdk-ui-*/` kaynağını oku.

## Yapı

```
src/main.ts, App.svelte      giriş + kabuk (telefon: tek ekran + alt menü; geniş: ray | liste | oda)
src/lib/arama/               motor.ts (WebRTC), ses-yolu.ts (Android hoparlör köprüsü)
src/lib/api/                 komutlar.ts (TEK invoke yeri), olaylar.ts (TEK listen yeri), tipler.ts (Rust DTO'larının aynısı)
src/lib/durum/               *.svelte.ts rune durumları (arama = 1:1 sesli arama durum makinesi, ayarlar = yerel ayarlar, sifreleme = E2EE: doğrulama, kurtarma anahtarı, açık sayfa)
src/lib/                     medya.ts (medya:// adresleri), gecis.ts (oda kayma geçişi), klavye.ts, alt-yer.ts, zaman-bicim.ts
src/lib/ekranlar/            Giris, Sohbetler, Oda, Alanlar, Ben, Arama
src/lib/bilesenler/          Avatar, Ikon, SohbetSatiri, MesajBalonu, YazmaAlani, AltMenu, Ray, Bildirim, AramaCubugu, EsitlemeSeridi,
                             AltSayfa (alttan sayfa/ortada pencere), SifrelemeKatmani (doğrulama/kurtarma/parola/çıkış sayfaları), GuvenlikSatiri, EmojiIzgara
src/lib/i18n/                t() + tr.ts
src/styles/                  tokens.css (rubyyard değişkenleri), temel.css
src-tauri/src/               lib, komutlar, durum, hata, tipler, gizli_depo (GizliDepo: keyring / Android Keystore), matrix/{oturum,esitleme,odalar,zaman,arama,sifreleme}, medya.rs (medya:// şeması)
src-tauri/gen/android/.../GizliKasa.kt  Android Keystore yardımcısı (Rust'tan JNI ile çağrılır; adı/imzası gizli_depo.rs ile eşleşmeli)
```

## Kodlama kuralları

- Yorumlar **İngilizce + Türkçe** (önce İngilizce) ve "neden"i anlatır; proje sahibi öğrenci. Arayüz metinleri Türkçe, `t()` ile (`tr.ts`).
- DTO değişince `tipler.rs` ve `tipler.ts` birlikte güncellenir.
- Renk/süre yalnızca `tokens.css` değişkenleriyle. Gradyan, parlama, reklam dili YOK. Açık/koyu tema ve `prefers-reduced-motion` çalışmalı.
- Sırlar (belirteç, parola, **kurtarma anahtarı**, hesap şifresi) günlüğe yazılmaz ve saklanmaz. Oturum depolama `matrix/oturum.rs` içindeki `Kayit` dışına dağılmaz; gizli bilgiler `GizliDepo` üzerinden gider (düz dosya yalnızca anahtarlık yoksa yedek).
- Şifreleme komutları/olayları `docs/MIMARI.md` › "Uçtan uca şifreleme"; SDK çağrısı yazmadan önce `~/.cargo/registry/src/*/matrix-sdk-0.19*/src/encryption/` kaynağını oku.

## Arayüz kuralları

Figma: https://www.figma.com/design/Bf4YZWhL8XfzEUx6H5ErfY sayfa "18 · rubychat" (107:2). Yeni ekran önce Figma'da çizilir, onaylanınca kodlanır.

- Telefon ≤800px: alt menü (Sohbetler/Alanlar/Ben, `data-alt-cubuk`, safe-area); odada alt menü yok. Geniş: Ray 88 | liste 360 | oda.
- Arayüz kendini tekrarlamaz (aynı hedef aynı ölçekte iki kez durmaz); hiçbir şey üst üste binmez (`--alt-yer`, toast üstte).
- Dokunma hedefleri ≥44px; 375px'te yatay taşma yok. Köşe yarıçapları 12/16, avatar yuvarlatılmış kare.

## Doğrulama (bitti demeden)

1. Yukarıdaki dört komut geçer.
2. Mümkünse masaüstü ikilisi gerçek bir Matrix hesabıyla: giriş → liste → oda → mesaj gönder (şifreli odada da).
3. 375 / 1075 genişlikte taşma yok, konsol hatasız.
4. Commit/push yalnızca kullanıcı isterse.
