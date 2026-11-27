# Görev: matrix.to ve matrix: bağlantıları rubychat'te açılır

Kullanıcı isteği (2026-11-27): `https://matrix.to/#/!oda...` gibi bağlantılar tarayıcıdan / başka uygulamadan rubychat'e yönlensin.
Yeni paket/crate YOK (kullanıcıya soruldu; projede gereken altyapı zaten var: D-Bus tek kopya, Android `niyetIsle`).

## Desteklenen biçimler (tek ayrıştırıcı: src/lib/matrisBaglanti.ts, yeni)
- `https://matrix.to/#/<kimlik>[/<olay>][?via=a&via=b]` — kimlik `!oda:sunucu`, `#takma:sunucu`, `@kisi:sunucu` (URL kodlu olabilir).
- MSC2312 URI: `matrix:roomid/<id-öneksiz>[/e/<olay-öneksiz>][?via=...]`, `matrix:r/<takma-öneksiz>`, `matrix:u/<kisi-öneksiz>[?action=chat]`.
- Not: örnek bağlantıdaki gibi `!` + sunucusuz (oda sürümü 12, `!abc` tek başına) kimlikler de geçerli; sunucu kısmı ZORUNLU değil.
- Çıktı: `{ tur: "oda", kimlik, olay?, via[] } | { tur: "kullanici", kimlik } | null`. Var olan src/lib/bicim/temizle.ts `pillBul` bu
  ayrıştırıcıyı kullansın (tek kaynak).

## Açılınca ne olur (src/lib/durum/matrisBaglanti.svelte.ts, yeni: `baglantiAc(url)`)
1. Oturum yoksa / eşitleme hazır değilse bağlantı bekletilir, giriş bitince çalışır.
2. **Oda, katılmışım:** odayı aç (`gezinme.odaAc(id)`); takma ad ise listedeki odanın `takmaAd`/kanonik adıyla eşle. Olay varsa `olayaGit`.
3. **Oda, katılmamışım:** OdaKesfet'teki önizleme alt sayfasını (AltSayfa: ad, avatar, konu, üye sayısı, son mesajlar, Katıl / Katılma
   isteği) yeniden kullan: o bloğu `src/lib/bilesenler/OdaOnizlemeSayfasi.svelte`'ye çıkar, OdaKesfet de onu kullansın; App.svelte'de
   global olarak çizilir. Önizleme verisi: yeni Rust komutu `baglanti_onizle(kimlik, via)` → matrix-sdk `client.get_room_preview(...)`
   (ad, konu, avatar, üye sayısı, katılım kuralı, oda türü; alan ise `alana_katil` yolu). Katılınca odayı aç.
   Önizleme alınamazsa (sunucu izin vermiyor): sayfada yalnızca kimlik + "Katıl" (join_room_by_id_or_alias + via).
4. **Kullanıcı:** üye kartını aç (`kullaniciKartiAc(kimlik)`); `action=chat` ise doğrudan DM (`dm_ac`).
5. Ayrıştırılamayan bağlantı: kısa bildirim çubuğu "Bu bağlantı açılamadı".
6. Uygulama İÇİ: BicimDugum `pillAc`'ta katılmadığım oda artık tarayıcıya gitmez → `baglantiAc`. Mesajdaki düz matrix.to bağlantıları da
   (bağlantı açma onayından önce) `baglantiAc`'a gider.

## Android
- AndroidManifest MainActivity'ye iki intent-filter: (a) VIEW + BROWSABLE + DEFAULT, `scheme=https host=matrix.to` (autoVerify YOK,
  doğrulanamaz); (b) `scheme=matrix`.
- MainActivity.kt `niyetIsle`: `ACTION_VIEW` + data varsa `rubychat-baglanti` olayını (detail = url) mevcut `olayGonder`/evaluateJavascript
  kalıbıyla gönder; web hazır değilse bekletip hazır olunca gönder (soğuk açılış). Ön planda `onNewIntent` aynı yol.
- Android 12+ doğrulanmamış https bağlantıları varsayılan olarak tarayıcıda açar: Ayarlar › Genel'e tek satır
  "matrix.to bağlantılarını rubychat'te aç" → `Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS` (package uri) açar; yanında durum
  (DomainVerificationManager.getDomainVerificationUserState → matrix.to seçili mi: "Açık"/"Kapalı"). Android 11 ve altında satır gizli.
  Mevcut Ayarlar satır bileşenlerini kullan, yeni görsel öğe yok.

## Masaüstü (Linux/Flatpak)
- flatpak/dev.rubyyard.rubychat.desktop: `Exec=rubychat %u`, `MimeType=x-scheme-handler/matrix;`.
  (https://matrix.to masaüstünde tarayıcıdan ele geçirilemez; yalnızca `matrix:` bağlantıları ve elle yapıştırma.)
- src-tauri/src/masaustu_linux.rs `ilk_kopya_mi`: argv'de `matrix:` / `https://matrix.to/` ile başlayan argüman varsa çalışan kopyaya
  `Goster` yerine org.freedesktop.Application `Open` (uris) çağır; dinleyicide `Open` gelen her uri için pencereyi göster + ön yüze
  `rubychat-baglanti` olayı (Tauri `emit`). İlk kopya argv'de bağlantı ile açıldıysa ön yüz hazır olunca aynı olay (bekletilmiş).
- Ön yüz: `listen("rubychat-baglanti")` (Tauri) ve `window` CustomEvent (Android) → `baglantiAc`.

## Ek
- Oda paleti (Ctrl+Space) arama kutusuna matrix.to / matrix: bağlantısı yapıştırılırsa ilk satır "Bağlantıyı aç".
- Metinler src/lib/i18n/tr-baglanti.ts + en-baglanti.ts.

## Doğrulama
svelte-check 0 hata, cargo check temiz; ayrıştırıcı için örnekler (biçimlerin hepsi + bozuk); masaüstünde `xdg-open 'matrix:r/...'`
çalışan kopyaya düşer; Android'de başka uygulamadan matrix.to bağlantısı (ayar açıkken) rubychat'i açar: katılmışsam oda, değilsem önizleme.
