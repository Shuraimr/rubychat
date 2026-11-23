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
| `matrix/zaman.rs` | `Timeline`: aç, akıt, geriye sayfala, metin gönder (düz / HTML / yanıt), düzenle, sil, tepki, okundu işaretle, gönderilemeyeni yeniden dene; arama, "yeni mesajlar", tepki, yanıt, anket, çıkartma, okundu bilgisi eşlemesi |
| `matrix/eylemler.rs` | Mesaj eylemleri: tepki, silme, düzenleme, "yazıyor", sabitleme, anket, iletme, çıkartma gönderme, varlık durumu (komutlar burada; çizelge işi `zaman.rs`te) |
| `matrix/paketler.rs` | MSC2545 özel emoji / çıkartma paketleri (oda, kişisel, `emote_rooms`), ham JSON olarak |
| `matrix/alanlar.rs` | Alanlar (`m.space`): üst düzey liste (`SpaceService`), bir alanın çocukları (`SpaceRoomList` = `/hierarchy`), katılma |
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
- `lib/ekranlar/`: Giris, Sohbetler, Oda, Alanlar + AlanGorunumu, Ben.
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

## Mesaj araması (`matrix/dizin.rs`, `src/lib/arama-mesaj/`)

- Yerel tam metin dizini: **tantivy 0.26** (`<veri>/arama-dizini`, çıkışta silinir). Alanlar: `olay_id`, `oda_id`, `gonderen`, `gonderen_ad`, `zaman` (hızlı alan), `govde` ("tr" çözümleyicisi: küçük harf + Türkçe katlama ı/ş/ğ/ü/ö/ç + ASCII katlama).
- Besleme: (1) canlı: `add_event_handler` ile eşitlemenin getirdiği çözülmüş mesajlar (düzenleme = gövde değişir, silme = dizinden çıkar); (2) doldurma: `Room::messages` ile odaları geriye yürüyen yavaş arka plan görevi, ilerleme `ilerleme.json` (commit'ten sonra yazılır), oda başına 20 000 olay sınırı.
- Tek yazıcı iş parçacığı (15 MB bellek, 200 belge / 2 sn'de commit). Arama `spawn_blocking`; son sözcük önek sayılır (yazdıkça sonuç). Vurgu parçaları Rust'ta hesaplanır (`MesajParcasi`).
- Komutlar: `mesaj_ara`, `dizin_durumu`, `olaya_git` (açık odanın çizelgesine olay girene dek geriye sayfalar).
- Arayüz kendi klasöründe, yerleşimden bağımsız: `MesajAramaSonuclari` (sorgu → liste), `OdaAramasi` (oda başlığı düğmesi + katman + sonuca atlama), `durum.svelte.ts`, `vurgula.ts`.

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
6. **Alanlar (Spaces)**: YAPILDI (aşağıdaki "Mesajlaşma özellikleri ve Alanlar").
7. **1:1 görüşme**: YAPILDI (yukarıdaki "Sesli arama"). Sırada: görüntülü arama (aynı motor + video izi).
8. **Grup görüşmesi** (sonra): MatrixRTC + LiveKit (`m.rtc.*`); LiveKit sunucusu gerekir (ayrı maliyet).
9. **rubyyard bağlantısı**: rubyyard SSO ve rubyyard topluluklarıyla Matrix odaları arasında köprü (konu ↔ oda).

## Bilinen eksikler (v0.1.0)

(Eski not; çoğu sonradan eklendi.) Mesajlaşma özellikleri için aşağıdaki "Mesajlaşma özellikleri ve Alanlar" bölümüne bak. Sliding sync olmayan sunucuda zaman çizelgesi SDK'nın yedek yoluna bağlıdır (gerçek sunucuda sınanmadı).

## Yapılacaklar (v0.2'den)

- Arama zil sesi yok (ses dosyası yok); yalnızca titreşim (`navigator.vibrate`) ve arayüz. Anlık bildirim olmadan uygulama kapalıyken gelen arama çalmaz.
- Mesajdaki bağlantılar düz metin: tauri opener eklentisi yok; eklenince "bağlantıyı aç" onayıyla bağlanacak.
- Arama sonucu geçmişi yalnızca bellekte (yeniden başlatınca eski aramalar "Sesli arama" olur); kalıcı yapmak için veritabanı ya da `m.call.hangup`ları geri sayfalama sırasında okumak gerekir.
- Sürüm-0 (eski istemci) davetleri desteklenmiyor. Birden çok cihazımız aynı anda çalarsa "başka cihazda yanıtlandı" mantığı gerçek sunucuda sınanmadı.
- Hoparlör köprüsü (`RubySes`) ve mikrofon izni akışı gerçek Android cihazda sınanmadı.


## Mesajlaşma özellikleri ve Alanlar (2026-11-23)

**Durum: KODLANDI, DERLENMEDİ / cihazda denenmedi.** `npx svelte-check` 0 hata, `npx vite build` tamam; Rust yalnızca `rustfmt` ile söz dizimi
denetiminden geçti (cargo çalıştırılmadı). Kullandığımız her SDK API'si ruma/matrix-sdk kaynağında doğrulandı (liste: bu işin raporunda).

### Alanlar (Spaces)
- `OdaOzeti.alan` (`Room::is_space()`): alanlar sohbet listesinde GÖRÜNMEZ (`odalar.gorunen` süzer), "Alanlar" sekmesinde görünür.
- `alanlari_al` (üst düzey katılınmış alanlar, `SpaceService::top_level_joined_spaces`), `alan_icerigi` (bir alanın doğrudan çocukları,
  `SpaceRoomList::paginate` = sunucunun `/hierarchy`si; katılınmayan odalar da ad / konu / üye sayısıyla gelir), `alana_katil`
  (`join_room_by_id_or_alias` + `m.space.child`ın `via` sunucuları). `SpaceService` oturum başına bir kez kurulur (`AppState.alan_servisi`).
- Arayüz: `Alanlar.svelte` (liste; önce oda listesinden, sonra grafikle inceltilir), `AlanGorunumu.svelte` (bir alanın içi), `AlanSatiri.svelte`,
  `durum/alanlar.svelte.ts` (alan yığını; her düzey bir geri tuşu katmanı). Katılınmış oda `gezinme.odaAc(id, true)` ile sekme değişmeden açılır
  (geri → o alana döner). Alt alan aynı görünümü bir düzey derinde açar. Çevrimdışı / sunucu hatası: maskotlu hata durumu + "Tekrar dene".
- **Siyah ekran güvencesi**: `zaman::ac` alanı `Hata::OdaTuru` ("oda_turu") ile reddeder; `Oda.svelte` tamamı `<svelte:boundary>` içinde (çizim hatası →
  maskotlu hata + geri), 15 sn zaman aşımı → hata durumu, `zaman.hata` → hata durumu.

### Zaman çizelgesi ve eylemler
`ZamanOgesi`ye eklenenler: `html`, `duzenlendi`, `tepkiler`, `yanit`, `okuyanlar`, `anket`, `silinebilir`, `sabit`, `duzenlenebilir`; yeni türler
`silindi`, `cikartma`, `anket`. `ZamanGuncelleme`ye `sabitler` + `sabitleyebilir`. Yeni olay `yaziyor-guncellendi`. Hepsi `tipler.rs` ↔ `tipler.ts` birebir.
- **Tepki**: `Timeline::toggle_reaction`; tepkiler SDK'nın topladığı hâliyle (anahtar → kişiler) gelir. `TepkiSatiri` (dokun = aç/kapat, uzun bas = kimler),
  `TepkiCubugu` (menü üstünde hızlı çubuk + "+" tam emoji seçici).
- **Sil**: `Timeline::redact`; `silinebilir` = kendi mesajım ya da güç düzeyim yetiyorsa (`user_can_redact_*`). Silinen mesaj "Bu mesaj silindi" satırı olarak kalır.
- **Yanıt**: `Timeline::send_reply`; alıntı `in_reply_to` ayrıntısından (SDK getirmediyse görev `fetch_details_for_event` ister). Alıntıya dokunmak
  `lib/arama-mesaj/atla.ts` (arama atlamasıyla aynı adımlar: satırı bul → `olaya_git` → kaydır + vurgula). Sağa 48px kaydırma = yanıtla (`lib/kaydirYanit.ts`).
- **Düzenleme**: `Timeline::edit(EditedContent::RoomMessage)`; yalnızca kendi metin mesajım. "düzenlendi" etiketi.
- **Emoji seçici**: `EmojiSayfasi` (kategoriler, Türkçe + İngilizce arama, "Son" = `localStorage`), veri `lib/emoji/veri.ts` (paket yok, ~560 emoji).
- **Özel emoji ve çıkartma (MSC2545)**: `paketler.rs` ham JSON okur: `m.room.image_pack` + `im.ponies.room_emotes`, `m.image_pack` + `im.ponies.user_emotes`,
  `m.image_pack.rooms` + `im.ponies.emote_rooms`. Sliding sync bu özel durum olaylarını İSTEMEZ (`required_state` listesinde yok), bu yüzden depoda yoksa
  `GET /state` ile sunucudan alınır (2000 üyeden büyük odalarda atlanır; arayüz 5 dk önbellekler). `m.sticker` gönderme: `cikartma_gonder`; alınanlar balonsuz resim
  (`CikartmaGorsel`, `medya://localhost/m/<id>`). Satır içi özel emoji: gelen HTML'deki `<img data-mx-emoticon src="mxc://…">`; gönderirken `:kisakod:` → aynı etiket.
  Önizlemeler `medya://…?b=…&o=1` (oranı koruyan küçük resim; `o=1` Rust'ta `Method::Scale`).
- **Biçimli mesaj**: matrix-sdk/ruma'da `markdown` özelliği KAPALI (açmak yeni crate `pulldown-cmark` getirirdi), bu yüzden `lib/bicim/markdown.ts` küçük bir çevirici:
  **kalın**, *italik*, ~~çizili~~, `kod`, ```blok```, [bağlantı](url), ||spoiler||, `> alıntı`. `body` kullanıcının yazdığı metin, `formatted_body` HTML
  (`RoomMessageEventContent::text_html`). Alınan HTML: `lib/bicim/temizle.ts` DOMParser (etkisiz belge) → yalnızca beyaz listedeki etiket / özniteliklerden jeton ağacı →
  `BicimDugum.svelte` normal Svelte işaretlemesiyle çizer (`{@html}` / innerHTML YOK). matrix.to kullanıcı / oda bağlantıları hap (pill) olur; kullanıcı kartını açar.
- **Yazıyor**: `Room::typing_notice` (SDK ~4 sn'de bir isteğe seyreltir; arayüz ayrıca 3 sn seyreltir, 5 sn sessizlikte durdurur); gelenler
  `Room::subscribe_to_typing_notifications`, çizelge görevinin `select!`inde → `yaziyor-guncellendi`.
- **Okundu**: çizelgenin `read_receipts()`i. 1:1'de benim mesajlarım karşı kişinin okuduğu mesaja kadar çift tik; ≤12 üyeli grupta mesajın altında minik avatarlar.
  (Okundu GÖNDERME zaten `okundu_isaretle` ile vardı.)
- **Sabit mesajlar**: `Room::pin_event` / `unpin_event` (`m.room.pinned_events`), `Room::pinned_event_ids`; `sabit_mesajlar` metinleri çizelgeden, yoksa
  `load_or_fetch_event`ten getirir. `SabitCubugu` odanın üstünde, dokunmak mesaja atlar ve sonrakine ilerler.
- **Anket**: SDK çizelgesi yalnızca `org.matrix.msc3381.poll.*` (kararsız) biçimini üretir / toplar; gönderme / oy / bitirme de o biçimde. `AnketKarti`, `AnketOlustur` ("+" menüsü).
  `m.disclosed` (açık sonuç) / `m.undisclosed`, tek / çoklu seçim.
- **İlet**: `mesaj_ilet` mesajın `MessageType`ını başka odanın gönderim kuyruğuna koyar (medya aynı `MediaSource`la, yeniden yükleme yok). Anket / çıkartma iletilmez.
- **Varlık**: `varlik_durumu` (`GET /presence/{user}/status`) DM başlığında bir kez sorulur; sunucu kapalıysa hiçbir şey çizilmez. Canlı DEĞİL.

### Bilinen sınırlar
- Mention gönderme (`m.mentions`) yok; metindeki `@kişi` yalnızca düz metindir (alınan matrix.to bağlantıları hap olur).
- Sabit çubuğu ve tepki kimleri canlı güncellenir ama sabit metinleri yalnızca kimlik kümesi değişince yeniden getirilir.
- Özel emoji tepkisi (anahtar mxc://) gösterilir ama tepki olarak GÖNDERİLEMEZ (seçici tepki kipinde yalnızca standart emoji).
- Thread (konu) yanıtları ayrı çizelge olarak gösterilmez; `m.thread` ilişkili mesajlar normal yanıt gibi çıkar.

## Aramalar: Element Call (2026-11-23, KODLANDI, DERLENMEDİ / denenmedi)

Element X'in yaptığı gibi: **Element Call (EC) bir `<iframe>` içinde çalışır, Matrix tarafını matrix-sdk `WidgetDriver` yürütür.** Araştırma: `docs/arastirma/element-call.md`.

```
Svelte EcKatman (iframe: ec://localhost/element-call/index.html#?...)
   │ postMessage ▲                       src/lib/arama-ec/ec.svelte.ts  (süzgeç: fromWidget istek / toWidget yanıt)
   ▼             │ ec-gelen (olay)
 ec_gonder ──▶ Rust matrix/ec.rs ──▶ WidgetDriver::run(room, EcYetkileri)  ──▶ Matrix (oda olayları, OpenID, gecikmeli olaylar, to-device)
```

- **Rust (`src-tauri/src/matrix/ec.rs`)**: `ec_ac(oda_id, tur: baslat|katil, sesli_mi, dm_mi, ust_url, tema, yedek)` URL'yi kurar
  (`VirtualElementCallWidgetProperties/Config` + `generate_webview_url`; intent Element X gibi: `start_call` / `join_existing` / `*_dm` / `*_dm_voice`;
  `echoCancellation`/`noiseSuppression` URL'ye eklenir; Android'de `controlledAudioDevices`), `WidgetDriver::run`'ı görevde başlatır. `ec_gonder`, `ec_kapat`,
  `ec_aktif_aramalar`, `ec_sunucu_destekliyor` (MatrixRTC arka ucu var mı: `Client::discover_rtc_transports`). Olaylar: `ec-gelen`, `ec-bitti`, `ec-arama-durumu`.
  Aynı anda tek arama; çıkışta (`cikis`) kapatılır. Yetki listesi (`EcYetkileri`) matrix-sdk'da yok, FFI'daki `get_element_call_required_permissions` ile aynıdır.
- **Paketleme**: `@element-hq/element-call-embedded@0.28.2` (npm, devDependency, AGPL-3.0 seçeneği) `vite.config.ts` ile `public/element-call/` içine kopyalanır
  (git'e girmez) ve `ec` URI şemasıyla (`ec://localhost` Linux/macOS, `http://ec.localhost` Android/Windows) **kendi CSP'siyle** sunulur
  (uygulamanın CSP'si EC'yi bozardı). EC `index.html`'ine `public/ec-kopru/kopru.js` enjekte edilir (ses çıkışı için `window.controls` köprüsü).
  Yüklenmezse (15 sn `content_loaded` yok) bir kez `https://call.element.io/` yedeğiyle denenir (`EC_YEDEK_URL`, `ec.rs`); o da olmazsa hata ekranı.
- **Svelte (`src/lib/arama-ec/`)**: `ec.svelte.ts` (durum + köprü), `EcKatman` (tam ekran katman; geri/Escape = küçült, kapatmaz; iframe takılı kalır),
  `EcCubuk` (yeşil çubuk + kapat), `EcKatilSeridi` ("Katıl" şeridi: açık odada süren arama ya da çalan DM), `ses.ts` (Android köprüsü).
  Giriş noktası: `arama.ara()` (`durum/arama.svelte.ts`): DM = sesli, grup odası = görüntülü. MatrixRTC yoksa/başlamazsa DM'de **eski 1:1 WebRTC** (VoIP v1) yedek
  olarak kalır (MatrixRTC bilmeyen istemcilerle de çalışır); gelen v1 davetleri hâlâ alınır.
- **Linux**: `linux_medya_ac` (WebKitGTK `enable-webrtc`, `enable-media-stream`, `enable-mediasource`, kullanıcı hareketi şartı kapalı; `permission-request` →
  `UserMediaPermissionRequest` onaylanır). Çalışma zamanı: GStreamer `nice` eklentisi (`libnice-gstreamer1` / nixpkgs `libnice`), `gst-plugins-bad/good`.
  Paketlemede (AppImage / .deb / Flatpak) bu eklentiler dahil edilmeli ya da bağımlılık yazılmalı. flake.nix'e eklendi.
- **Android**: `MainActivity.kt` `SesKoprusu` (iletişim modu + ses odağı, çıkış aygıtları `cihazlar/cihazSec/varsayilanCihaz`, aygıt değişince olay),
  `AramaServisi.kt` (mikrofon ön plan servisi, "Arama sürüyor" + Kapat, wake lock; RECORD_AUDIO verilmeden başlatılmaz), manifest izinleri. WebView izinlerini
  Tauri'nin `RustWebChromeClient`'ı yönetir (mikrofon/kamera için çalışma anı izni sonrası verir; üretilmiş dosya, değiştirilmedi).
- **Ekran paylaşımı**: Linux'ta EC düğmeyi `getDisplayMedia` varsa gösterir (WebKitGTK ≥ 2.42, portal + PipeWire). Android WebView'de `getDisplayMedia` YOK: EC düğmeyi gizler;
  arayüz yükleme ekranında bunu söyler. Yerel çözüm planı: `docs/arastirma/element-call.md` "Sonraki adım".
- **Lisans**: EC AGPL-3.0; Ben › Hakkında'da lisans notu + kaynak bağlantısı var. Dağıtıma EC lisans metni ve kaynak bağlantısı konmalı.
