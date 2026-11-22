# rubychat mimarisi

rubychat, rubyyard ailesinin Matrix istemcisidir: Tauri 2 (kabuk) + matrix-rust-sdk (Rust, ağ ve şifreleme) + Svelte 5 (arayüz).
Öncelik Android; masaüstü de çalışır. Sürüm: v0.1.0 (temel).

## Katmanlar

```
Svelte 5 arayüzü  ──invoke──▶  src-tauri/src/komutlar.rs  ──▶  src-tauri/src/matrix/*  ──▶  matrix-sdk / matrix-sdk-ui
       ▲                                                                                          │
       └──────────────── listen: "odalar-guncellendi" · "esitleme-durumu" · "zaman-guncellendi" ◀──┘
```

- Arayüz yalnızca `src/lib/api/komutlar.ts` içinden `invoke`, yalnızca `src/lib/api/olaylar.ts` içinden `listen` çağırır.
  Veri tipleri `src/lib/api/tipler.ts` ile `src-tauri/src/tipler.rs` arasında BİREBİR aynıdır (camelCase); biri değişirse ötekisi de değişir.
- Hatalar tek türdür (`hata.rs`): `{ tur, mesaj }`. Arayüz `tur`a göre Türkçe metin seçer (`hata.<tur>` anahtarı).
- Durum: `durum.rs` içindeki `AppState` (aktif `Client`, `SyncService`, açık zaman çizelgeleri, arka plan görevleri).

## Rust modülleri (`src-tauri/src/`)

| Dosya | Görev |
|---|---|
| `lib.rs` | Tauri kurulumu, komut kaydı |
| `komutlar.rs` | `#[tauri::command]` katmanı; yalnızca `matrix::*` çağırır |
| `matrix/oturum.rs` | Şifreyle giriş, oturumu diske yazma/geri yükleme, çıkış, belirteç yenileme izleyicisi |
| `matrix/esitleme.rs` | Eşitleme: sliding sync (`SyncService`) ya da klasik `sync` yedeği; oda listesi yayıncısı |
| `matrix/odalar.rs` | `Room` → `OdaOzeti` dönüşümü, sıralı liste |
| `matrix/zaman.rs` | `Timeline`: aç, akıt, geriye sayfala, metin gönder, okundu işaretle, gönderilemeyeni yeniden dene; arama ve "yeni mesajlar" satırları |
| `matrix/arama.rs` | 1:1 sesli arama sinyalleşmesi: TURN bilgisi, `m.call.*` gönder, gelen olayları `arama-olayi` ile ilet |
| `matrix/sifreleme.rs` | Uçtan uca şifreleme: çapraz imza kurulumu, SAS emoji doğrulaması, kurtarma anahtarı (gizli depo + yedek), `sifreleme-durumu` / `dogrulama-guncellendi` olayları |
| `gizli_depo.rs` | `GizliDepo` trait'i: masaüstünde `keyring` (anahtarlık), Android'de Keystore (JNI → `GizliKasa.kt`) |
| `medya.rs` | `medya` URI şeması: mxc avatar küçük resimleri (96px kare kırpma, SDK'nın disk önbelleği) |

### Oturum saklama
`app_data_dir/oturum.json` (sunucu adresi + gizli bilgilerin nerede durduğu: `gizli`) + `app_data_dir/depo/` (SQLite: durum, şifreleme
anahtarları, olay önbelleği; rastgele parolayla şifreli). **Parola ve belirteçler** (`MatrixSession`) tek JSON olarak `GizliDepo` içinde
"oturum" anahtarıyla saklanır: Linux Secret Service / macOS Anahtar Zinciri / Windows Kimlik Bilgisi Yöneticisi (`keyring` 3, MIT/Apache) ve
Android Keystore (AES-256-GCM anahtarı Keystore'dan çıkmaz; şifreli metin `filesDir/gizli/` altında). Arka uç çalışma anında başarısızsa
(ör. Secret Service yok) eski dosya yedeği kullanılır, uyarı günlüğe yazılır ve Ben ekranı "Gizli bilgiler dosyada tutuluyor" notunu gösterir
(`Ben.gizliDepo = "dosya"`). Eski, gizli bilgi içeren `oturum.json` bir sonraki açılışta arka uca taşınır (taşıma) ve gizli alanlar dosyadan silinir.
Dosyaya ve arka uca yalnızca `Kayit` (`matrix/oturum.rs`) dokunur.
**Android notu:** `gizli_depo.rs` içindeki `android` modülü + `GizliKasa.kt` bu makinede yalnızca tip denetiminden geçti (jni 0.21 ile ayrı
bir deneme crate'inde); gerçek cihazda/emülatörde ÇALIŞTIRILMADI. Kotlin sınıfı `Context.getClassLoader().loadClass` ile bulunur
(yerel iş parçacığında `FindClass` uygulama sınıflarını görmez). Çalışmazsa Rust dosya yedeğine düşer, uygulama yine açılır.

### Eşitleme
Sunucu sliding sync (MSC4186) bildiriyorsa `matrix-sdk-ui::SyncService` kullanılır (çevrimdışı kip açık); aksi hâlde `client.sync()` döngüsü.
İki kipte de oda listesi, istemcinin oda deposundan yeniden kurulur ve saniyede en çok ~5 kez yayınlanır.

### Zaman çizelgesi
Her değişiklikte tüm öğe listesi arayüze gönderilir (basit ve sağlam). Yavaşlarsa fark (diff) göndermeye geçilir.
Şifreli odalarda SDK mesajı kendisi şifreler; çözülemeyen mesaj `sifre_cozulemedi` olarak gelir.

## Arayüz (`src/`)

- `lib/durum/*.svelte.ts`: Svelte 5 rune durumları (oturum, odalar, zaman, gezinme, bildirim).
- `lib/ekranlar/`: Giris, Sohbetler, Oda, Alanlar (yer tutucu), Ben.
- `lib/bilesenler/`: Avatar, Ikon, SohbetSatiri, MesajBalonu, YazmaAlani, AltMenu (telefon), Ray (geniş), Bildirim.
- `lib/i18n`: `t()`; yalnızca Türkçe şimdilik, İngilizce için `tr.ts` aynı anahtarlarla kopyalanır.
- `styles/tokens.css`: rubyyard tasarım değişkenleri. Renk ve süre YALNIZCA bunlarla kullanılır.
- Düzen: telefon (≤800px) tek ekran + alt menü; geniş ekran Ray 88px | liste 360px | oda.

## Sesli arama (1:1, v0.2)

Yalnızca klasik Matrix VoIP v1 (`m.call.invite/candidates/answer/select_answer/reject/hangup`), WebRTC webview'de; ses, video yok, grup yok
(ücretli sunucu gerekmez). Yalnızca TAM 2 üyeli odalarda arama düğmesi görünür (`OdaBilgisi.karsiKullanici`).

- **Rust** (`matrix/arama.rs`): `arama_turn_sunuculari` (`/voip/turnServer`, TTL bitimine 1 dk kalana dek önbellek), `arama_olayi_gonder`
  (tek komut, `tur` ile hangi olay), `kaydet()` gelen olay işleyicileri. Şifreli DM'de çalışır (işleyiciler çözülmüş olay alır).
  Bayat davet (yaşı > `lifetime`) iletilmez. Kendi cihazlarımızın olayları `kendi: true` ile gelir (başka cihazda yanıtlandı için).
  Sürüm-0 (party_id'siz) davetler yok sayılır.
- **Arayüz**: `lib/arama/motor.ts` (RTCPeerConnection, mikrofon, adaylar 200 ms'de bir toplu), `lib/durum/arama.svelte.ts` (durum makinesi
  bos → ariyor/caliyor → baglaniyor → bagli → bitti; 60 sn çalma zaman aşımı → `invite_timeout`; çakışmada küçük `call_id` yaşar;
  meşgulken `user_busy`; ICE `failed` ya da 8 sn `disconnected` → `ice_failed`), `ekranlar/Arama.svelte` (tam ekran / geniş ekranda kart),
  `bilesenler/AramaCubugu.svelte` (arka plandaki arama çubuğu). Arama ekranı history girdisidir: Android geri tuşu onu çubuğa küçültür.
- **Gürültü engelleme**: Ben ekranındaki anahtar + arama ekranındaki çip; `localStorage` (`rubychat.gurultuEngelleme`, varsayılan açık);
  `getUserMedia({noiseSuppression, echoCancellation, autoGainControl})`, süren aramada `track.applyConstraints`.
- **Android**: manifestte `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`. wry'nin `RustWebChromeClient.onPermissionRequest`i mikrofon isteğini
  kendisi Android çalışma-anı izin penceresine bağlar (Rust tarafında işleyici kaydetmedik = varsayılan: izin iste). Hoparlör/kulaklık için
  `MainActivity.kt` içinde küçük `RubySes` köprüsü (`addJavascriptInterface`; `AudioManager`, `MODE_IN_COMMUNICATION`); köprü yoksa (masaüstü)
  düğme gizlenir.
- **Zaman çizelgesi**: `m.call.invite` tek sistem satırı olur ("Sesli arama · 3 dk", "Cevapsız arama", "Arama reddedildi"). Sonuç, canlı
  görülen answer/reject/hangup olaylarından `AppState.arama_gecmisi`nde (YALNIZCA bellekte) tutulur; görülmeyen eski aramalar yalnızca "Sesli arama" yazar.

## Uçtan uca şifreleme (v0.3)

Amaç: kullanıcı elle anahtar ya da başka istemci kurmadan şifreli odaları gündelik kullanabilsin. Her şey `matrix/sifreleme.rs`te; arayüz
durumu `lib/durum/sifreleme.svelte.ts`, sayfalar `bilesenler/SifrelemeKatmani.svelte` (+ `AltSayfa`, `GuvenlikSatiri`, `EmojiIzgara`).

**Durum olayları**
- `sifreleme-durumu` (`SifrelemeDurumu`): `caprazImza` (hazir / yok / bekliyor), `cihazDogrulandi`, `yedek` (acik / kapali / yukleniyor),
  `kurtarma` (hazir / eksik / kapali / bilinmiyor), `parolaGerekli`. Kurtarma / yedek / doğrulama akışlarına abone olan `izleyici` ve 20 sn
  nabız yayınlar; yalnızca gerçek değişiklikte. `sifreleme_durumu` komutu anlık görüntü verir.
- `dogrulama-guncellendi` (`DogrulamaDurumu`): `asama` (yok, istek_gonderildi, gelen_istek, hazir, emoji, onay_bekleniyor, bitti, iptal),
  `digerCihaz`, `emojiler` (7: `simge` + İngilizce `ad`; Türkçe adlar `i18n/emoji-tr.ts`), `neden`.

**Akışlar**
1. *Çapraz imza*: girişte/geri yüklemede `capraz_imza_hazirla` `bootstrap_cross_signing_if_needed(None)` çalıştırır (hesapta kimlik varsa hiçbir
   şey yapmaz). Sunucu UIA isterse ve şifre akışı varsa `parolaGerekli` olur; arayüz "parola" sayfasında şifreyi sorar, `capraz_imza_kur(parola)`
   bir kez kullanır (saklanmaz, günlüğe yazılmaz). Sunucu şifre kabul etmiyorsa (OAuth/MAS) açıklayıcı hata gösterilir.
2. *Cihaz doğrulama (SAS emoji)*: `dogrulama_baslat` kendi kimliğimize `request_verification()` gönderir (öteki cihaz Element vb. kabul eder); SAS'ı
   isteği biz yaptıysak biz başlatırız. Gelen istek (`ToDeviceKeyVerificationRequestEvent`, yalnızca kendi kullanıcımızdan, 10 dk'dan yeni) "gelen_istek"
   olur ve sayfayı açar; `dogrulama_kabul_et`. Emojiler → `dogrulama_onayla` ("Eşleşiyor") / `dogrulama_eslesmiyor`; `dogrulama_iptal` iptal eder ve sıfırlar.
   Yalnızca SAS emoji desteklenir (QR yok). Başkalarını doğrulama yok.
3. *Kurtarma*: `kurtarma_olustur` → `recovery().enable()` (gizli depo + yedek) ve YENİ anahtarı döndürür; arayüz tek bir kez gösterir, "Kopyala" +
   zorunlu "güvenli yere kaydettim" onayıyla; anahtar hiçbir yerde saklanmaz. `kurtarma_kurtar(anahtar)` → `recovery().recover()`: çapraz imza
   anahtarları içe aktarılır (cihaz doğrulanır) ve istemci `BackupDownloadStrategy::OneShot` ile ayarlı olduğundan yedek anahtarı gelince TÜM eski oda
   anahtarları indirilir; zaman çizelgesi çözemediği mesajları yeniden dener. `recover_and_fix_backup` BİLEREK kullanılmaz (uyuşmazlıkta eski yedeği siler).
4. *Çıkış uyarısı*: `kurtarma != hazir` ise Ben'deki "Çıkış yap" önce "Kurtarma anahtarın yok…" sayfasını gösterir ("Önce anahtar oluştur / gir" ya da "Yine de çık").
5. *Arayüz*: Ben › Güvenlik (cihaz doğrulama, kurtarma anahtarı, anahtar yedeği, gizli bilgilerin yeri); Ben sekmesinde (alt menü ve ray) cihaz doğrulanmamış
   ya da kurtarma eksikse vurgu renginde nokta; ilk girişte (cihaz başına bir kez, `localStorage`) eksik varsa "Şifrelemeyi tamamla" sayfası ("Sonra" ile
   geçilir, nokta kalır); çözülemeyen mesajda kurtarma `eksik` ise "Kurtarma anahtarı gir" bağlantısı.

**Sınanmayanlar / yapılacaklar**
- Gerçek sunucu olmadan yazıldı: hiçbir akış (bootstrap, SAS, enable/recover, gelen istek) canlı hesapla denenmedi; yalnızca derleme + sahte Tauri köprüsüyle arayüz görünümü.
- Android Keystore köprüsü cihazda çalıştırılmadı (yukarıya bak).
- Cihaz bulunamayan hesapta "Başka cihazla doğrula" istek gönderir ve bekler; `has_devices_to_verify_against` ile önceden uyarmak yapılabilir.
- Sunucuda yedek varken `enable()` `BackupExistsOnServer` verir: arayüz şimdilik genel şifreleme hatası gösterir (anahtar gir yolu kullanılmalı).
- Odalarda kullanıcı doğrulama / cihaz listesi / "güvenilmeyen cihaz" uyarıları, QR doğrulama ve anahtar dışa aktarma henüz yok.

## Medya şeması (`medya`)

`medya://localhost/<sunucu>/<medyaId>?b=96` (Android/Windows: `http://medya.localhost/...`). `lib/medya.ts` doğru biçimi kurar ve boyutu
2x ekrana göre 48'in katına yuvarlar. Rust `get_media_content(thumbnail, Crop)` ile indirir; SDK medya önbelleği diskte tutar. CSP `img-src`
`medya:` ve `http://medya.localhost` içerir. Avatar bileşeni hata/yüklenirken baş harfe düşer.

## Arayüz notları (v0.2)

- Telefonda oda, listenin üstüne sağdan kayar (`lib/gecis.ts`, süre/eğri token'larından; az harekette kapalı); açılış `history.pushState`,
  Android geri tuşu `popstate` ile kapatır.
- Klavye: `interactive-widget=resizes-content` + `lib/klavye.ts` (`visualViewport` → `--gorunen-yukseklik`).
- Zaman çizelgesi: gün gruplu yapışkan tarih hapı, 5 dk gönderen gruplama, "Yeni mesajlar" ayırıcısı (SDK okundu işareti; oda açıkken
  kilitlenir, okundu bildirimiyle `FullyRead` de ilerler), "aşağı in" düğmesi (+ sayı), gönderiliyor (saat), gönderilemedi → `mesaj_yeniden_dene`.
- `EsitlemeSeridi`: `esitleme-durumu` çevrimdışı/hata iken başlık altında sarı şerit. Sohbetler: göreli zaman, okunmamışta kalın ad/önizleme, `@` rozeti.

## Genişletme noktaları

1. **SSO / OIDC girişi**: `oturum.rs` içindeki `sifreyle_giris` "istemci kur → doğrula → kaydet" biçimindedir; yeni yöntem yalnızca
   "doğrula" adımını değiştirir (`matrix_auth().login_sso` ya da `client.oidc()`), `istemci_kur` ve `Kayit::kaydet` aynen kullanılır.
   Giriş ekranındaki devre dışı SSO düğmesi hazır. rubyyard hesabıyla tek oturum açma bu yoldan gelecek (rubyyard tarafında OIDC sağlayıcı gerekir).
2. **Anahtarlık**: YAPILDI (yukarıdaki "Oturum saklama"; `GizliDepo` trait'i). Yeni bir arka uç = `GizliDepo` uygulaması + `varsayilan()`.
3. **Anlık bildirim**: Android'de UnifiedPush (tercih; Google'sız) ya da FCM; sunucuda pusher (`client.pusher()`), uygulamada Tauri mobil eklentisi.
   Şifreli odalarda bildirim içeriği için bildirim istemcisi (matrix-sdk-ui `NotificationClient`) kullanılır.
4. **Cihaz doğrulama**: YAPILDI (yukarıdaki "Uçtan uca şifreleme"). Sırada: QR doğrulama, başkalarını doğrulama.
5. **Medya**: `Timeline::send_attachment`, `Media` API'si; depolama ve küçültme rubyyard'ın `yukleme` mantığına benzer. Şimdi resim yalnızca etiketle gösterilir.
6. **Alanlar (Spaces)**: `matrix-sdk-ui::spaces::SpaceService`; "Alanlar" sekmesi hazır.
7. **1:1 görüşme**: YAPILDI (yukarıdaki "Sesli arama"). Sırada: görüntülü arama (aynı motor + video izi).
8. **Grup görüşmesi** (sonra): MatrixRTC + LiveKit (`m.rtc.*`); LiveKit sunucusu gerekir (ayrı maliyet).
9. **rubyyard bağlantısı**: rubyyard SSO ve rubyyard topluluklarıyla Matrix odaları arasında köprü (konu ↔ oda).

## Bilinen eksikler (v0.1.0)

Yalnızca metin gönderilir/gösterilir; yeni sohbet başlatma, davet kabulü, doğrulama, medya, düzenleme/silme, tepki, yanıt, bildirim ve
kayıt yoktur. Sliding sync olmayan sunucuda zaman çizelgesi SDK'nın yedek yoluna bağlıdır (gerçek sunucuda sınanmadı).

## Yapılacaklar (v0.2'den)

- Arama zil sesi yok (ses dosyası yok); yalnızca titreşim (`navigator.vibrate`) ve arayüz. Anlık bildirim olmadan uygulama kapalıyken gelen arama çalmaz.
- Mesajdaki bağlantılar düz metin: tauri opener eklentisi yok; eklenince "bağlantıyı aç" onayıyla bağlanacak.
- Arama sonucu geçmişi yalnızca bellekte (yeniden başlatınca eski aramalar "Sesli arama" olur); kalıcı yapmak için veritabanı ya da `m.call.hangup`ları geri sayfalama sırasında okumak gerekir.
- Sürüm-0 (eski istemci) davetleri desteklenmiyor. Birden çok cihazımız aynı anda çalarsa "başka cihazda yanıtlandı" mantığı gerçek sunucuda sınanmadı.
- Hoparlör köprüsü (`RubySes`) ve mikrofon izni akışı gerçek Android cihazda sınanmadı.
