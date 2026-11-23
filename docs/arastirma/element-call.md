# Element Call'u rubychat'e gömmek: araştırma (2026-11-23)

Amaç: şu anki elle yazılmış 1:1 WebRTC aramasını (`src/lib/durum/arama.svelte.ts`, `src/lib/arama/motor.ts`, `src-tauri/src/komutlar.rs` `arama_*`,
`MainActivity.kt` `SesKoprusu`) bırakıp Element X'in yaptığını yapmak: **Element Call (EC) widget'ını bir WebView/iframe içinde çalıştırmak,
Matrix tarafını matrix-sdk'nın `WidgetDriver`'ı ile köprülemek**. Bu belge yalnızca araştırmadır; kod değişmedi, derleme çalıştırılmadı.

## 0. Özet (önce bunu oku)

1. **Element X Android hâlâ EC'yi WebView'de çalıştırıyor** (varsayılan). EC, APK'nın içine gömülü paketten
   (`io.element.android:element-call-embedded`) `https://appassets.androidplatform.net/element-call/index.html` adresinden yüklenir; call.element.io'dan değil.
   Element X'te "yerel (native) MatrixRTC" yığını (`element-call-android` + `matrix-rust-rtc`) da var ama `feature.native_call` bayrağı
   **varsayılan kapalı, "experimental"**. Yani bizim izleyeceğimiz yol "Element X'in üretimdeki yolu".
2. **matrix-sdk 0.19.1'de widget desteği var**: Cargo özelliği `experimental-widgets` (şu an Cargo.toml'umuzda yok; yeni crate değil, mevcut crate'in özelliği).
   `VirtualElementCallWidgetProperties/Config`, `WidgetSettings::new_virtual_element_call_widget`, `WidgetSettings::generate_webview_url`, `WidgetDriver::run`
   hepsi `matrix_sdk::widget` altında. **Ama** FFI'deki `get_element_call_required_permissions` (EC'nin isteyeceği yetki listesi) `matrix-sdk` içinde DEĞİL;
   o listeyi kendimiz yazacağız (aşağıda tam liste). Ayrıca `main` dalında olan MSC4533 yetkileri (`rtc_livekit_get_token`, `rtc_livekit_delegate_delayed_leave`)
   0.19.1'de **yok**; EC 0.28.x bunları isteyebilir. Sürüm eşleşmesi bir risk (bölüm 1.7).
3. **Linux'ta "ses yok" büyük olasılıkla WebKitGTK'nin WebRTC'yi varsayılan KAPALI tutmasından**: `enable-webrtc` (2.38'den beri) ve `enable-media-stream`
   ikisi de varsayılan `FALSE`; wry bunları açmıyor (kaynakta `set_enable_webrtc`/`enable_media_stream` yok, yalnızca `set_enable_webgl/webaudio`).
   İkinci engel: bu makinede `libnice-gstreamer1` (GStreamer `nice` eklentisi, WebRTC'nin ICE'ı) **kurulu değil**; yalnız `libgstwebrtc.so` ve `libgstwebrtcdsp.so` var.
   Üçüncü: izin isteği (`permission-request`) ele alınmazsa WebKitGTK `getUserMedia`yı sessizce reddeder. Tauri 2.12.7 bunun için `Builder::on_permission_request` sunuyor (yeni paket gerekmez).
4. **Android'de bizim aramada ses yok** için somut şüpheler (bölüm 3): `MODE_IN_COMMUNICATION` açılıp varsayılan çıkış **ahize (earpiece)** kalıyor, `<audio>` öğesi
   DOM'a eklenmemiş, Android izin akışı. Element X'in `WebViewAudioManager`'ı ve EC'nin `controls` API'si bunu çözüyor.
5. **Ekran paylaşımı**: EC, `navigator.mediaDevices.getDisplayMedia` yoksa ekran paylaşma düğmesini kendisi gizliyor
   ([`CallViewModel.ts`](https://github.com/element-hq/element-call/blob/main/src/state/CallViewModel/CallViewModel.ts)). **Android WebView'de `getDisplayMedia` yok**, yani Element X Android (WebView yolu)
   başkasının paylaştığını **izler**, kendisi **paylaşamaz**. Paylaşma yalnızca yeni yerel yığında var (`ElementCallOptions(isScreenSharingEnabled = true)` + `mediaProjection` ön plan servisi).
   Linux'ta WebKitGTK ≥ 2.42 `getDisplayMedia`yı portal+PipeWire ile destekler (wry'nin izin kodu `is_for_display_device` 2.42'yi kullanıyor), pratikte denenmeli.
6. **Arka uç**: matrix.org `/.well-known/matrix/client` içinde `org.matrix.msc4143.rtc_foci` → `livekit_service_url: https://livekit-jwt.call.matrix.org` yayımlıyor.
   Kullanıcı matrix.org hesabıyla giriş yapıyorsa kendi sunucusunun SFU'sunu kullanır; **biz bir arka uç sabitlemiyoruz**. Üçüncü taraf istemciler için yayımlanmış bir şart/sınırlama bulamadım,
   ama Element bunu "geçici, LiveKit sponsorluğunda" diye anlatmış (bölüm 1.6).
7. **GIF**: **Tenor API 30 Haziran 2026'da kapandı** (yeni anahtar Ocak 2026'dan beri verilmiyordu). GIPHY ücretli/uygulamalı, KLIPY ücretsiz katmanlı ve Tenor benzeri. Öneri: **KLIPY**, kullanıcı kendi
   anahtarını getirebilsin (bölüm 5).
8. **Lisans**: EC ve gömülü paketi **AGPL-3.0 VEYA Element ticari lisansı** çift lisanslı; AGPL seçeneğini kullanırsak rubychat'in AGPL-3.0-or-later'ı ile uyumlu (bölüm 6).

## 1. Element X gömme mimarisi (gerçek kaynaktan)

Okunan dosyalar (hepsi `element-hq/element-x-android`, `develop` dalı):

- [`features/call/impl/.../ui/CallScreenView.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/ui/CallScreenView.kt)
- [`.../ui/CallScreenPresenter.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/ui/CallScreenPresenter.kt)
- [`.../ui/ElementCallActivity.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/ui/ElementCallActivity.kt)
- [`.../utils/DefaultCallWidgetProvider.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/utils/DefaultCallWidgetProvider.kt)
- [`.../utils/WebViewWidgetMessageInterceptor.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/utils/WebViewWidgetMessageInterceptor.kt)
- [`.../utils/WebViewAudioManager.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/utils/WebViewAudioManager.kt)
- [`.../services/CallForegroundService.kt`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/kotlin/io/element/android/features/call/impl/services/CallForegroundService.kt)
- [`.../AndroidManifest.xml`](https://github.com/element-hq/element-x-android/blob/develop/features/call/impl/src/main/AndroidManifest.xml)
- [`libraries/matrix/impl/.../widget/DefaultCallWidgetSettingsProvider.kt`](https://github.com/element-hq/element-x-android/blob/develop/libraries/matrix/impl/src/main/kotlin/io/element/android/libraries/matrix/impl/widget/DefaultCallWidgetSettingsProvider.kt)
- [`gradle/libs.versions.toml`](https://github.com/element-hq/element-x-android/blob/develop/gradle/libs.versions.toml) (`element_call_embedded = "io.element.android:element-call-embedded:0.28.2"`)
- [`FeatureFlags.kt`](https://github.com/element-hq/element-x-android/blob/develop/libraries/featureflag/api/src/main/kotlin/io/element/android/libraries/featureflag/api/FeatureFlags.kt) (`feature.native_call` varsayılan `false`)

### 1.1 Paketleme: gömülü mü, call.element.io mu?

`DefaultCallWidgetProvider.kt`: `EMBEDDED_CALL_WIDGET_BASE_URL = "https://appassets.androidplatform.net/element-call/index.html"`;
geliştirici ayarı "özel EC adresi" varsa o kullanılır, yoksa gömülü olan. WebView tarafında `WebViewAssetLoader` (`/` → `AssetsPathHandler`) ile APK `assets/` klasöründen servis edilir
(`WebViewWidgetMessageInterceptor.shouldInterceptRequest`). EC deposunun tavsiyesi de bu: README "Embedded packaging is recommended for Element Call in widget mode!"
([README](https://github.com/element-hq/element-call/blob/main/README.md), [docs/embedded_standalone.md](https://github.com/element-hq/element-call/blob/main/docs/embedded_standalone.md)).

Paket kaynakları (EC 0.28.2 sürümünün varlıkları, 2026-11-05): `element-call-embedded-0.28.2.tar.gz` (+ `.sha256`), npm `@element-hq/element-call-embedded`, Android AAR, SwiftPM.
Gömülü paketin farkı: yalnız widget modu; analitik onayı arayüzü yok; Posthog/Sentry/rageshake adreslerini URL parametresinden alır; **çalışma zamanı `config.json` gerekmez**.
(Tam paket bir `config.json` ister; ayrıca "LiveKit'i config.json'dan ayarlamak yalnız geliştirme içindir" uyarısı var: [self_hosting.md](https://github.com/element-hq/element-call/blob/main/docs/self_hosting.md).)

### 1.2 Widget URL'si nasıl kuruluyor

Rust SDK `WidgetSettings::new_virtual_element_call_widget(props, config)` (`~/.cargo/registry/src/*/matrix-sdk-0.19.1/src/widget/settings/element_call.rs` ([GitHub](https://github.com/matrix-org/matrix-rust-sdk/blob/main/crates/matrix-sdk/src/widget/settings/element_call.rs))):

- Taban URL = `element_call_url` (bizde gömülü `index.html`); **tüm parametreler URL'nin parçasına (fragment) `#?...` olarak** yazılır, sunucuya gitmez (parola sızmaz).
- Şablon parametreleri (`$matrix_user_id` vb. yer tutucular): `userId`, `roomId`, `widgetId`, `displayName`, `lang`, `theme`, `clientId`, `deviceId`, `baseUrl` (anasunucu).
  `generate_webview_url(room, ClientProperties)` bunları doldurur (kullanıcı profili `fetch_user_profile` ile alınır).
- `parentUrl` (zorunlu): postMessage'ın hedefi. Aynı WebView'de barındırılıyorsa o WebView'in URL'si/origin'i (belge: widget kendi mesajını da alır, `matrix-widget-api` bunu yok sayar).
- `perParticipantE2EE=true` (şifreli oda) veya `password=...` ya da şifresiz.
- `intent`: `start_call`, `join_existing`, `start_call_dm`, `join_existing_dm`, `start_call_dm_voice`, `join_existing_dm_voice` (`start_call_voice`/`join_existing_voice` de var).
  Element X: `direct && hasActiveCall` → `join_existing_dm[_voice]`; `hasActiveCall` → `join_existing`; `direct` → `start_call_dm[_voice]`; değilse `start_call`.
  **Intent, diğer ayarların varsayılanlarını belirler** (lobi atla, başlık, bildirim türü); yalnız sapmak istediğimiz parametreyi ayrıca vermeliyiz.
- Diğer: `header` = `standard` | `app_bar` | `none` (eski `hideHeader`), `confineToRoom` (varsayılan `true`), `preload` (true ise `io.element.join` eylemi gelene kadar bekler),
  `appPrompt`, `hideScreensharing`, `controlledAudioDevices`, `sendNotificationType` = `ring` | `notification`, `fontScale`, `font`, gömülüye özel `posthog*`, `rageshakeSubmitUrl`, `sentry*`.
  Element X yalnızca `intent`i verir (+ şifreleme, analitik); gerisi intent varsayılanları. Belge: [`docs/url_params.md`](https://github.com/element-hq/element-call/blob/main/docs/url_params.md).
  Belgede olmayıp kaynakta olan ses parametreleri: `echoCancellation`, `noiseSuppression` (varsayılan `true`) ([`UrlParams.ts`](https://github.com/element-hq/element-call/blob/main/src/UrlParams.ts)). Ayrıca `allowIceFallback`, `showControls`, `autoLeave`, `waitForCallPickup`, `background`.

### 1.3 postMessage ↔ Rust `WidgetDriver` akışı

SDK tarafı (`matrix_sdk::widget`): `WidgetDriver::new(settings) -> (WidgetDriver, WidgetDriverHandle)`. `handle.recv().await -> Option<String>` = **Matrix'ten widget'a giden JSON**, `handle.send(String)` =
**widget'tan gelen JSON'u içeri ver**. `driver.run(room, capabilities_provider).await` arka planda widget API makinesini (`WidgetMachine`) çalıştırır, OpenID token verir, olayları okur/yazar
(gecikmeli olaylar MSC4157 dahil), to-device gönderir, dosya indirir, RTC taşıma adreslerini (MSC4515, `Client::discover_rtc_transports`: `GET /_matrix/client/v1/rtc/transports`, yoksa well-known) döner.
`CapabilitiesProvider::acquire_capabilities(Capabilities) -> Capabilities` = widget'ın istediği yetkilerden hangisini vereceğimiz (Element X hepsini sabit listeyle veriyor).

Element X WebView tarafı (`WebViewWidgetMessageInterceptor`): sayfa başlarken iki JS enjekte eder:

1. `console.*`'u düzeltir (nesneleri log'a yazmak için).
2. `window.addEventListener('message', ...)`: `data.api == "fromWidget"` (istek) veya `data.api == "toWidget"` **ve** `response` varsa (yanıt) → `JSON.stringify(event.data)` → `elementX.postMessage(json)` (Kotlin `@JavascriptInterface`, ayrıca Chromium ≥ 119 ise `WebViewCompat.addWebMessageListener`). Diğerleri yok sayılır (kendi gönderdiğimiz toWidget).

Ters yön: `webView.evaluateJavascript("postMessage($message, '*')")`. `CallScreenPresenter`: `driver.incomingMessages → interceptor.sendMessage`, `interceptor.interceptedMessages → driver.send(it)`; `driver.run()` ayrı koşar.
Ayrıca: `fromWidget` + `action == "io.element.close"` → ekranı kapat; `content_loaded` → "yüklendi" (10 sn içinde gelmezse hata gösterir); kapatırken `toWidget` `im.vector.hangup` gönderip 2 sn bekler.

**Bizde eşleme**: Rust'ta `WidgetDriver` yaşar; Tauri komutu `widget_gonder(json)` → `handle.send`, Rust'tan arayüze `widget_gelen` olayı (Tauri event, `handle.recv()` döngüsü). Svelte'te iframe'in `window.addEventListener("message")` + `iframe.contentWindow.postMessage(json, origin)`. Köprü mantığı Element X'inkiyle aynı, yalnız `JavascriptInterface` yerine Tauri IPC.

### 1.4 Cargo özelliği

`matrix-sdk-0.19.1/Cargo.toml` satır 96: `experimental-widgets = ["dep:urlencoding", "dep:uuid", "experimental-send-custom-to-device"]` ve `lib.rs:64: #[cfg(feature = "experimental-widgets")] pub mod widget;`.
`experimental-send-custom-to-device` → `e2e-encryption` ister (bizde var). Yani Cargo.toml'da `matrix-sdk` özellik listesine **tek kelime** eklenir; yeni crate yok (`urlencoding`, `uuid` zaten bağımlılık ağacına girer; AGPL uyumlu: MIT/Apache).

### 1.5 SFU (LiveKit) odak keşfi

- Eski: `/.well-known/matrix/client` → `org.matrix.msc4143.rtc_foci`. matrix.org'un güncel dosyası (2026-11-23'te çekildi): 
  `"org.matrix.msc4143.rtc_foci":[{"type":"livekit","livekit_service_url":"https://livekit-jwt.call.matrix.org"}]` ([dosya](https://matrix.org/.well-known/matrix/client)).
- Yeni: `GET /_matrix/client/v1/rtc/transports` (MSC4515). SDK 0.19.1 her ikisini de bilir; widget yetkisi `org.matrix.msc4515.rtc_transports`.
- Akış: EC, LiveKit JWT servisine (`lk-jwt-service`, [repo](https://github.com/element-hq/lk-jwt-service)) OpenID token ile gider → JWT alır → LiveKit SFU'ya `wss` ile bağlanır. Medya şifrelemesi E2EE (oda anahtarları to-device ile: `io.element.call.encryption_keys` / `m.rtc.encryption_key`).
- **Gerekli**: Kullanıcının anasunucusu MatrixRTC arka ucunu yayımlamalı. Yayımlamıyorsa arama kurulamaz; biz "Sunucunuz sesli/görüntülü grup aramasını desteklemiyor" göstermeliyiz (SDK'da `discover_rtc_transports` → `None`).

### 1.6 matrix.org'un barındırdığı arka uç üçüncü taraf istemcilerde kullanılabilir mi?

- Teknik olarak: SFU'ya erişim anasunucu kimliğine (OpenID) bağlı; hangi istemcinin olduğu önemli değil. lk-jwt-service'in `LIVEKIT_FULL_ACCESS_HOMESERVERS` ayarı **anasunucu bazlı** izin verir, istemci bazlı değil
  ([README](https://github.com/element-hq/lk-jwt-service)). matrix.org hesabı olan herkes rtc_foci'yi okuyup kullanabilir; rubychat bunu **kendisi sabitlemez**, kullanıcının sunucusu ne yayımlıyorsa onu kullanır.
- Yayımlanmış açık bir "üçüncü taraf istemci" şartı/kotası **bulamadım**. Element blogu ve "This Week in Matrix" (2025-03) matrix.org SFU'sunu **"geçici, LiveKit sponsorluğunda"** olarak anlatıyor ve eski "Element sponsorlu yedek arka uç"un kaldırıldığını söylüyor
  ([blog](https://element.io/blog/end-to-end-encrypted-voice-and-video-for-self-hosted-community-users/), [TWIM 2025-03-21](https://matrix.org/blog/2025/03/21/this-week-in-matrix-2025-03-21/)). Yani **süreklilik riski var**; kendi sunucusunda SFU kuran kullanıcı sorunsuz çalışır.
- 2025 tarihli bir kaynak "EC'yi kullanabilen istemciler yalnız Element Web ve Element X" diyor; teknik bir engel değil, yalnızca o tarihteki durum.

### 1.7 Yetki listesi ve sürüm eşleşmesi

FFI `get_element_call_required_permissions` ([`bindings/matrix-sdk-ffi/src/widget.rs`](https://github.com/matrix-org/matrix-rust-sdk/blob/main/bindings/matrix-sdk-ffi/src/widget.rs)) EC'nin ihtiyaç duyduğu olay türlerini sabit listeler;
biz `matrix_sdk::widget::Capabilities` ile aynısını kurmalıyız:

- **okuma**: durum `m.call.member`, `m.room.name`, `m.room.member`, `m.room.encryption`, `m.room.create`, `m.member_hints`; ve aşağıdaki "okuma+yazma" kümesi.
- **yazma**: `m.rtc.notification`, `m.call.notify`; durum `m.call.member` (anahtarlar: `@kullanıcı`, `@kullanıcı_CİHAZ`, `@kullanıcı_CİHAZ_m.call`, `_@kullanıcı_CİHAZ`, `_@kullanıcı_CİHAZ_m.call`); ve okuma+yazma kümesi.
- **okuma+yazma**: `org.matrix.rageshake_request`, to-device `io.element.call.encryption_keys` ve `m.rtc.encryption_key`, mesaj `io.element.call.encryption_keys`, `io.element.call.reaction`, `m.reaction`, `m.room.redaction`, `m.rtc.decline`; (sticky/MSC4354 açıksa `org.matrix.msc4143.rtc.member`, `m.rtc.member`).
- bayraklar: `requires_client`, `update_delayed_event`, `send_delayed_event`, `download_file`, `rtc_transports` (+ main'de `rtc_livekit_get_token`, `rtc_livekit_delegate_delayed_leave`).

**Risk**: 0.19.1'de `Capabilities` yapısında `rtc_livekit_*` alanları yok (main'de var). EC 0.28.x bu yetkileri **isteyebilir**; vermezsek EC yedek yola (OpenID + JWT servisini doğrudan çağırma) düşmesi beklenir ama **doğrulanmadı**.
Çözümler: (a) EC sürümünü 0.19.1 ile çalışan en yeni sürüme sabitlemek (örn. Element X'in matrix-sdk sürümüne denk gelen), (b) matrix-sdk'yı sonraki sürüme yükseltmek. İlk denemede ilk iş: `cargo test` değil, gerçek bir aramayı `controls`/konsol günlüğüyle izlemek.

### 1.8 Android izinleri, WebChromeClient, ses yönlendirme, ön plan servisi

`features/call/impl/AndroidManifest.xml`: `INTERNET`, `POST_NOTIFICATIONS`, `RECORD_AUDIO`, `CAMERA`, `MODIFY_AUDIO_SETTINGS`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `USE_FULL_SCREEN_INTENT`;
`CallForegroundService` `foregroundServiceType="microphone"`; `ElementCallActivity` `supportsPictureInPicture`, `launchMode=singleTask`, kendi `taskAffinity`.
WebView ayarları (`CallScreenView.setup`): `javaScriptEnabled`, `domStorageEnabled`, `allowFileAccess`, `allowContentAccess`, `databaseEnabled`, **`mediaPlaybackRequiresUserGesture = false`**, özel user-agent;
`WebChromeClient.onPermissionRequest` → `ElementCallActivity` `registerPermissionResultLauncher`: `RECORD_AUDIO`/`CAMERA` çalışma anı izni istenir, verilenlerin karşılığı (`RESOURCE_AUDIO_CAPTURE`/`VIDEO_CAPTURE`) `request.grant(...)` ile WebView'e iletilir. Ekran açıkken `FLAG_KEEP_SCREEN_ON`.

Ses: `WebViewAudioManager` (470 satır) `AudioManager.MODE_IN_COMMUNICATION` ayarlar, `AudioDeviceCallback` ile aygıtları izler, EC'nin **`controls` API**'sine bağlanır
(`controls.setAvailableAudioDevices(...)`, `controls.onAudioDeviceSelect = id => androidNativeBridge.setAudioDevice(id)`, `controls.onAudioPlaybackStarted`; [docs/controls.md](https://github.com/element-hq/element-call/blob/main/docs/controls.md)),
Android 12+ `setCommunicationDevice`, Android < 12'de Bluetooth aygıtlarını kapatır. Bu, URL parametresi `controlledAudioDevices=true` ile açılır (EC kendi aygıt seçicisini göstermez, ses çıkışını işletim sistemi yönetir).

Ekran paylaşımı için bkz. 0 numaralı özet 5 (WebView yolunda yok).

## 2. Linux masaüstü (WebKitGTK)

Ortam (bu makine, Fedora 45): `webkit2gtk4.1-2.54.2`, `webkitgtk6.0-2.54.2`, `gstreamer1-plugins-bad-free-1.28.9`, `xdg-desktop-portal 1.22.1`, `pipewire 1.6.11`.
`/usr/lib64/gstreamer-1.0` içinde `libgstwebrtc`, `libgstwebrtcdsp`, `libgstrtpmanager`, `libgstsrtp`, `libgstdtls`, `libgstopus`, `libgstvpx`, `libgstpipewire` var; **`libgstnice.so` yok** (`libnice-gstreamer1` paketi kurulu değil, depoda mevcut).

Bulgular:

- `enable-media-stream` varsayılan **FALSE** ([Settings.enable-media-stream](https://webkitgtk.org/reference/webkit2gtk/stable/property.Settings.enable-media-stream.html)); `enable-webrtc` varsayılan **FALSE**, 2.38'den beri, "açınca enable-media-stream de açılır"
  ([Settings.enable-webrtc](https://webkitgtk.org/reference/webkit2gtk/stable/property.Settings.enable-webrtc.html)). wry 0.57.3 `webkitgtk/mod.rs` yalnız `set_enable_webgl(true)`, `set_enable_webaudio(true)` vb. ayarlar; bu ikisini **açmaz**.
  Sonuç: `RTCPeerConnection` büyük olasılıkla ya yok ya da çalışmıyor → şu anki 1:1 aramanın Linux'ta ses vermemesi için yeterli. (Doğrulamak için bölüm 2.3'teki konsol komutu.)
- İzin isteği: wry `connect_permission_request` bağlar **yalnızca** `permission_handler` verilmişse (`webkitgtk/mod.rs:595`); verilmezse WebKitGTK `getUserMedia`yı reddeder (tartışma: [tauri #8426](https://github.com/tauri-apps/tauri/discussions/8426)). Tauri 2.12.7: `tauri::Builder::on_permission_request` ve `WebviewBuilder::on_permission_request` var
  (`~/.cargo/registry/src/*/tauri-2.12.7/src/app.rs:1890`, `webview/mod.rs:703`), Linux'ta "tam destek"; `PermissionKind::DisplayCapture` ekran paylaşımı için ayrı gelir (`is_for_display_device`, WebKitGTK ≥ 2.42).
- Ayarları açmak: `WebviewWindow::with_webview(|w| ...)` ile `w.inner()` = `webkit2gtk::WebView`; `webkit2gtk::WebViewExt::settings()` → `SettingsExt::set_enable_webrtc(true)`, `set_enable_media_stream(true)`, `set_enable_mediasource(true)`.
  Trait'leri kullanmak için `webkit2gtk = "2.0.2"` (yalnız Linux) doğrudan bağımlılık olarak yazılmalı. **Yeni indirme yok** (zaten kilit dosyasında, tauri/wry'nin bağımlılığı, MIT) ama Cargo.toml'a satır eklemek `CLAUDE.md` kuralına göre onay ister.
  Alternatif: `glib::ObjectExt::set_property("enable-webrtc", true)`, yine glib trait'i ister. Sonra `with_webview` yalnız pencere açıldıktan sonra çalıştırılabilir (setup içinde `get_webview_window("main")`).
- Bilinen tuzaklar: bazı kullanıcılar yalnız X11 GDK arka ucunda çalıştırabilmiş (Wayland sorunu); `getUserMedia` çalışıp `PeerConnection` kurulamayabilir; bubblewrap (Flatpak) içinde kamera erişimi hataları ([WebKit #274711](https://bugs.webkit.org/show_bug.cgi?id=274711), [#274730](https://bugs.webkit.org/show_bug.cgi?id=274730)).
  WebKitGTK'nin WebRTC'si GStreamer'a (`webrtcbin`+`nice`) dayanır; **dağıtım paketlerinin** (AppImage'e GStreamer eklentileri dahil etmek, Flatpak'ta GNOME runtime) ayrıca düşünülmesi gerekir.
- Element Desktop: Electron/Chromium kullanır (`getDisplayMedia`, WebRTC, ses, hepsi Chromium'da hazır), dolayısıyla bizim için **geçerli bir örnek değil**; Linux WebKitGTK'de EC'yi çalıştıran ana akım Matrix istemcisi bilmiyorum. Bu yol **denenmemiş bölge**.

### 2.1 Önerilen Linux yolu

1. Önce en sağlam taktik: **WebKitGTK ayarlarını aç + izin isteğini otomatik ver** (yalnızca bizim EC origin'imize ve mikrofon/kamera/ekran türlerine), `libnice-gstreamer1` bağımlılığını README'ye ve flake'e yaz (`gst_all_1.gst-plugins-bad`, `libnice`).
2. Çalışırsa EC'yi aynen kullan. EC'nin LiveKit'i WebKitGTK'de `RTCPeerConnection`, `RTCRtpScriptTransform`/Insertable Streams (E2EE için) ister: **WebKitGTK'de Insertable Streams/`RTCRtpScriptTransform` desteği ayrıca doğrulanmalı**; EC E2EE'yi bununla yapıyor (LiveKit `e2ee` worker). Çalışmazsa şifreli odalarda medya şifrelenemez.
3. WebKitGTK yetersiz kalırsa **yedek**: yerel LiveKit yolu. Aday: Rust `livekit` crate'i (`livekit/rust-sdks`, **Apache-2.0**) + `libwebrtc` ön derlemeli ikili (Google WebRTC; binlerce MB indirir, derleme yükü büyük, Android'e de portu var ama ağır),
   ya da Element'in kendi `matrix-rust-rtc` (**AGPL-3.0**, Maven'de `io.element.android:matrix-rtc-android`; masaüstü için hazır paket görmedim). İkisi de büyük iş: ses yakalama/çalma (cpal), UI'ı kendimiz çizme, ekran yakalama (PipeWire). **Tavsiye edilmez**, ancak WebKitGTK engelliyse düşünülür.

### 2.2 Bizim şu anki aramanın Linux'ta sessiz olmasının olası nedenleri (sırayla)

1. `enable-webrtc`/`enable-media-stream` kapalı → `RTCPeerConnection` yok ya da `getUserMedia` reddedilir.
2. `on_permission_request` yok → mikrofon reddi (`MikrofonHatasi("izin")`; arama ekranında "mikrofon izni").
3. `libgstnice.so` yok → ICE adayı toplanamaz, bağlantı `failed` olur (gstreamer `nicesrc` bulunamadı).
4. Wayland'de ek tuhaflıklar.

### 2.3 Hızlı doğrulama (kullanıcı kendi makinesinde, geliştirici konsolu)

`typeof RTCPeerConnection`, `navigator.mediaDevices?.getUserMedia`, `navigator.mediaDevices?.getDisplayMedia`, `await navigator.mediaDevices.getUserMedia({audio:true})` sonuçları; `gst-inspect-1.0 nicesrc` (yoksa `sudo dnf install libnice-gstreamer1`).

## 3. Android WebView: bizim aramada ses neden olmayabilir

Okunan: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, `.../MainActivity.kt`, `.../generated/RustWebChromeClient.kt`, `.../generated/RustWebView.kt`, `src/lib/arama/motor.ts`, `src/lib/arama/ses-yolu.ts`.

Zaten doğru olanlar: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` manifestte; `RustWebView.kt:27` `mediaPlaybackRequiresUserGesture = false`; `RustWebChromeClient.onPermissionRequest` mikrofonu bilinen kaynak olarak çalışma anı izniyle verir (`filterKnownPermissions` içinde `RESOURCE_AUDIO_CAPTURE` var).

Şüpheliler ve somut düzeltmeler:

1. **Çıkış yolu ahize (earpiece)**: `SesKoprusu.aramaBasladi(true)` `MODE_IN_COMMUNICATION` yapar ama `hoparlor(false)` çıkışı kulaklık/ahizeye bırakır; telefon kulağa tutulmadıkça "ses yok" gibi duyulur. Düzeltme: arama başında varsayılanı **hoparlör** yap (Element X de aygıt listesinden seçtiriyor), Android 12+ `setCommunicationDevice` ile; `AudioFocus` iste (`AudioManager.requestAudioFocus(AUDIOFOCUS_GAIN_TRANSIENT, USAGE_VOICE_COMMUNICATION)`).
2. **Ses modu zamanlaması**: mod, `getUserMedia`dan **önce** ayarlanmalı (`ses-yolu.ts` `aramaSesiBasladi(true)` motor kurulmadan çağrılıyor; sıra doğrulanmalı). Element X ise `onAudioPlaybackStarted` geri çağrısını bekleyip aygıtları o zaman ayarlıyor.
3. **`<audio>` öğesi DOM'a eklenmemiş** (`new Audio()` benzeri, `motor.ts` `#ses`): Chromium Android'de uzak WebRTC sesi, DOM dışı öğede genelde çalar, ama bazı WebView sürümlerinde çalmayabilir. Düzeltme: gizli `<audio autoplay playsinline>` öğesini `document.body`'ye ekle.
4. **`MODE_IN_COMMUNICATION` için ön plan servisi yok**: Android 14+ ekran kapanınca/uygulama arka plana gidince mikrofon yakalama kesilir. Düzeltme: `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` izinleri ve `foregroundServiceType="microphone"` servis (Element X'inkiyle aynı) + `WAKE_LOCK`.
5. **`CAMERA` izni manifestte yok** (video aramalar için gerek; `uses-feature camera required=false`).
6. WebView ayarı eksiği: `RustWebView`'de `allowFileAccess` vb. yok; EC'yi `tauri://`/özel şemadan yükleyeceksek `WebViewAssetLoader` gerekmez (aşağıda).
7. Teşhis: `adb` kullanma yasağı bu araştırmada; kullanıcıya `chrome://inspect` ile WebView'i izleyip `pc.getStats()` içinde `inbound-rtp` `audioLevel`/`packetsReceived` bakması önerilir (paket geliyor ama ses yok = çıkış yolu; paket yok = ICE/TURN).

## 4. Sıkıştırma / "Discord seviyesi" kalite

LiveKit (EC'nin medya katmanı) seçenekleri: [`livekitOptions.ts`](https://github.com/element-hq/element-call/blob/main/sdk/src/media-backend/livekit/livekitOptions.ts), [`publishOptions.ts`](https://github.com/element-hq/element-call/blob/main/sdk/src/media-backend/livekit/publishOptions.ts), [`ConfigOptions.ts`](https://github.com/element-hq/element-call/blob/main/src/config/ConfigOptions.ts):

- **Simulcast**: kamera için varsayılan katmanlar 180p ve 360p (+ tam çözünürlük), ekran paylaşımı için ayrı katman listesi; `config.json` `simulcast_layers` ile ayarlanır (gömülü pakette çalışma zamanı config yok, yani katmanlar sabit varsayılan).
- **`adaptiveStream: true`** (alıcı tarafında karoya göre katman seçimi), **`dynacast: true`** (kimse izlemiyorsa katmanı durdur) → çok katılımcılı aramada bant genişliği tasarrufu.
- **Opus**: `dtx: true` (sessizlikte gönderme), ses ön ayarı `AudioPresets.music` (yüksek bit hızı, 48 kHz stereo-uyumlu), Opus FEC/RED'i LiveKit varsayılanı olarak açar (sürüm ayrıntısı doğrulanmadı).
- **Video codec**: `vp8`/`vp9`/`h264`/`av1` (`settings.ts`), kullanıcı ayarı.
- **Gürültü/yankı**: tarayıcının `echoCancellation`, `noiseSuppression` (varsayılan açık; URL parametresi, `UrlParams.ts`'te kaynakta var, belgede yok). Krisp tarzı ML gürültü engelleme yok (Discord'dan fark).
- URL ile yapılandırılabilenler: `echoCancellation`, `noiseSuppression`, `hideScreensharing`, `controlledAudioDevices`, `intent`, `header`, `theme`, `lang`, `font(Scale)`, `showControls`. Simulcast/codec URL ile **değil**, kullanıcı ayarı/`config.json` ile.
- Elde edilecek kalite SFU'ya da bağlı (matrix.org'unki ortak/sponsorlu; kendi SFU'da bant genişliği serbest).

## 5. GIF / çıkartma sağlayıcıları (FOSS, AGPL istemci)

| Sağlayıcı | Durum (2026-11-23) | Anahtar | Ücretsiz katman | Önemli şartlar |
|---|---|---|---|---|
| **Tenor (Google)** | **KAPANDI**: yeni anahtar 13 Ocak 2026'dan beri yok, API **30 Haziran 2026'da** kapatıldı ([9to5Google](https://9to5google.com/2026/06/30/google-tenor-api-gif-updates/)) | - | - | Kullanılamaz. |
| **GIPHY** | Çalışıyor, ücretli/uygulamalı model | Zorunlu (`api_key`, dashboard hesabı, her platform için ayrı anahtar) | Beta anahtar: **100 çağrı/saat**, `limit` ≤ 50; daha fazlası için başvuru ve fiyat | "Powered By GIPHY" zorunlu; **yanıtları/medya URL'lerini önbelleğe alma ve medya kopyası saklama yasak**; URL'leri değiştirme yasak; **proxy yasak** (istemciden doğrudan); sonuçları yeniden sıralama/filtreleme/başka sağlayıcıyla karıştırma yasak ([belge](https://developers.giphy.com/docs/api)). Açık kaynak için özel hüküm yok. |
| **KLIPY** | Çalışıyor, Tenor'dan geçiş için tasarlanmış (Tenor uyumlu uç noktalar: "Migrate from Tenor") | Zorunlu (Partner Panel) | Test modunda **100 istek/saat**; production erişimi isteyince "sınırsız" | KLIPY logosu/atıf; URL'leri değiştirme yok; medyayı **saklama/yeniden barındırma yok**; istek ve medya **son kullanıcı istemcisinden** gelmeli (sunucu/proxy önceden yazılı onayla); sonuç sırası/bileşimi değişmez; başka sağlayıcıyla aynı ızgarada karıştırma yok ([entegrasyon şartları](https://docs.klipy.com/integration-requirements.md), [hızlı başlangıç](https://docs.klipy.com/getting-started.md)). GIF, çıkartma, klip, meme, "AI emoji". `customer_id` ile kişiye özel "son kullanılanlar". Reklam API'si isteğe bağlı. |

Gizlilik: üçünde de istek doğrudan kullanıcının cihazından sağlayıcıya gider (IP, arama sözcüğü, isteğe bağlı `customer_id` sağlayıcıya sızar). `customer_id` olarak Matrix kullanıcı kimliğini **göndermemeli**, rastgele yerel kimlik kullanmalı.

**Matrix'e özgü çelişki**: Matrix'te bir GIF göndermek ya `m.image` olarak **yüklemek** (medya kopyası saklamak = KLIPY/GIPHY şartlarının "saklama/yeniden barındırma yok" maddesiyle çelişir; bu "özel uygulama onayı" ister: `developers@klipy.com`) ya da harici URL'yi mesaja koymaktır
(şifreli odada URL'yi sızdırmak, alıcı istemcilerde önizleme gerektirir). Element'in kendi yöntemi de eskiden Giphy entegrasyon yöneticisiydi. Bu nokta **KLIPY ile yazılı görüşme** gerektirir.

**Öneri**: **KLIPY**; (1) Tenor'un yerini alan en yakın API, (2) ücretsiz, (3) çıkartma+klip+meme de var. Uygulama içine **tek bir paylaşılan anahtar gömmek** AGPL açık kaynakta anahtarı herkesin görmesi demek ve kota (100/saat) tüm kullanıcılarla paylaşılır,
bu yüzden: **Ayarlar'da "kendi KLIPY anahtarını gir" (BYOK)** + isteğe bağlı proje anahtarı (production onayı alınırsa). Atıf (KLIPY logosu) arayüze konur; GIF paneli ayrı sekme (diğer içerikle karıştırılmaz). Sağlayıcıyı arkada soyutla (`GifSaglayici`), Tenor/GIPHY sonra eklenebilsin.

## 6. Lisanslar

- **Element Call**: [LICENSE](https://github.com/element-hq/element-call): "**AGPL-3.0 veya Element ticari lisansı**" çift lisans (README "Copyright & License"; `LICENSE-AGPL-3.0` ve `LICENSE-COMMERCIAL`). Gömülü paket (`element-call-embedded`) aynı kaynaktan derlenir, aynı lisans.
- **Element X Android** `AGPL-3.0-only OR LicenseRef-Element-Commercial` (dosya başlıkları). **element-call-android** ve **matrix-rust-rtc**: AGPL-3.0 (+ ticari).
- **matrix-rust-sdk (`matrix-sdk`)**: Apache-2.0. LiveKit JS: Apache-2.0.
- **Uyum**: rubychat **AGPL-3.0-or-later**; EC'yi **AGPL-3.0 seçeneğiyle** dağıtmak uyumlu (AGPL, AGPL ile birleşebilir; `-only` yalnızca 3.0 sürümünü seçer, `-or-later` projeye göre 3.0 kullanılır, sorun yok).
  Yükümlülükler: paketin lisans metnini ve **kaynağa bağlantıyı** (EC sürümü, GitHub etiketi) dağıtıma koy (README/`ucuncu-taraf` notu), EC'yi **değiştirirsek** değişiklikleri AGPL ile yayımla, ağ üzerinden kullanıcıya sunduğumuzda kaynak teklifi (APK/masaüstü dağıtımı zaten kaynağı açık depoda).
  Ticari seçeneği satın almamız gerekmiyor. **Logo/marka**: EC ve Element adı/logosu markadır; arayüzde "Element Call" görünürse atıf iyi olur, rubychat markasıyla karıştırılmamalı.

## 7. Uygulama planı (adım adım)

**Karar noktası (önce kullanıcıdan)**: yeni crate/özellik onayları ve "Linux'ta WebKitGTK deneyimi başarısızsa ne yapalım" (bölüm 2.1).

### A. Hazırlık ve doğrulama (kod yazmadan önce, 1 gün)
1. Linux'ta konsolla bölüm 2.3 testleri; `sudo dnf install libnice-gstreamer1`. (Kullanıcı yapar.)
2. EC sürümü seç: `@element-hq/element-call-embedded` / GitHub sürümü `element-call-embedded-0.28.2.tar.gz` (sha256 doğrula). matrix-sdk 0.19.1 ile uyumsuzluk riskini denemeyle ölç (bölüm 1.7).

### B. Rust tarafı (`src-tauri`)
1. `Cargo.toml`: `matrix-sdk` özelliklerine **`experimental-widgets`** ekle. (Yeni crate yok. **Onay gerekli** çünkü bağımlılık yapılandırması değişir.)
2. `src/matrix/widget.rs` (yeni): `WidgetOturumu { handle: WidgetDriverHandle, gorev: JoinHandle }` tablosu (oda başına bir tane). Komutlar:
   - `widget_ac(oda_id, ses_mi) -> { url, widget_id }`: odayı bul, şifreli mi/DM mi/aktif arama var mı (`Room::has_active_room_call`) ile intent seç, `VirtualElementCallWidgetProperties { element_call_url: "<gömülü adres>", widget_id: uuid, parent_url: <aynı origin>, encryption: şifreli ? PerParticipantKeys : Unencrypted, .. }` + `VirtualElementCallWidgetConfig { intent, controlled_audio_devices: Some(android), header: Some(None)/app_bar, hide_screensharing: Some(android) , ..}` → `WidgetSettings::new_virtual_element_call_widget` → `generate_webview_url(&room, ClientProperties::new("rubychat", dil, tema))`. `WidgetDriver::new(settings)` → `(driver, handle)`; `tokio::spawn(driver.run(room, YetkiSaglayici))`; ikinci görev `handle.recv()` → `app.emit("widget-gelen", {widget_id, json})`.
   - `widget_gonder(widget_id, json)` → `handle.send(json)`.
   - `widget_kapat(widget_id)` → görevleri iptal et.
   - `YetkiSaglayici: CapabilitiesProvider` → bölüm 1.7'deki sabit listeyi **olduğu gibi** döndür (hepsini ver); gelen istekle kesiştir.
3. Eski `arama_*` komutlarını **hemen silme**: önce EC yoluyla yan yana çalışsın, kullanıcı onaylayınca kaldır (yalnız 1:1 sinyalleşmesi yerine EC her şeyi yapar; **eski VoIP v1 aramayla birlikte çalışma kaybolur**: EC `m.rtc.*` MatrixRTC kullanır, eski istemcilerle (v1) konuşmaz).
4. `tauri.conf.json`: CSP. EC için `frame-src`'a gömülü origin, `connect-src` EC'nin kendi belgesinde **ayrı CSP** gerektirir: tavsiye `tauri::Builder::register_uri_scheme_protocol("ec", ...)` ile EC dosyalarını **kendi CSP başlığıyla** (`connect-src https: wss:; script-src 'self' 'wasm-unsafe-eval'; worker-src blob: 'self'; media-src blob: mediastream:`) sunmak. Böylece EC kendi origin'inde (`ec://localhost`) kalır, rubychat'in sıkı CSP'si bozulmaz. (Android'de özel şema desteği/güvenli bağlam (`isSecureContext`) mutlaka denenmeli: `getUserMedia` güvenli bağlam ister; `http://ec.localhost` benzeri kullanmak gerekebilir.) **Risk bölümüne bak.**
5. `lib.rs` Linux: `on_permission_request`: `PermissionKind::Microphone|Camera|DisplayCapture` ve yalnız `ec`/uygulama origin'i için `Allow`; diğerleri `Deny`. `with_webview` ile WebKitGTK ayarlarını aç (**onay gerekli: `webkit2gtk` doğrudan bağımlılık, yalnız Linux**).

### C. Kotlin (Android)
1. `AndroidManifest.xml`: `CAMERA`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `WAKE_LOCK`; `uses-feature camera required=false`; yeni `<service android:name=".AramaServisi" android:foregroundServiceType="microphone" android:exported="false"/>` (Element X'inkiyle aynı; ekran paylaşımı sonraya, `mediaProjection` Play incelemesi ister).
2. `AramaServisi.kt`: kalıcı bildirimli ön plan servisi (arama sürerken başlat/durdur; `Bildirimci.kt`'deki kanal yapısı yeniden kullanılır).
3. `SesKoprusu` yerine **`WebViewAudioManager` benzeri**: `controlledAudioDevices=true` verip EC'nin `controls` API'sine bağlan (`setAvailableAudioDevices`, `onAudioDeviceSelect`, `onAudioPlaybackStarted`); `MODE_IN_COMMUNICATION` + `requestAudioFocus`; varsayılan çıkış: kulaklık/Bluetooth varsa onu, yoksa **hoparlör** (görüntülü) veya ahize (sesli, kullanıcı değiştirebilir).
   Not: `controls` API'si EC'nin **ana belgesinde** `window.controls` olarak durur; iframe içindeyse `iframe.contentWindow.controls` (aynı origin değilse erişilemez!) → bu, EC'yi **ayrı bir WebView/Activity'de** çalıştırmanın (Element X gibi) artısıdır. Karar: aşağıdaki "Svelte" bölümüne bak.
4. `MainActivity`: kilit ekranı üstünde gelen arama zaten `USE_FULL_SCREEN_INTENT` ile var; arama bitince `MODE_NORMAL`'e dön, servisi durdur. PiP (resim içinde resim) sonraya.

### D. Svelte tarafı
1. İki seçenek:
   - **(1) iframe (önerilen başlangıç)**: `<iframe src="ec://localhost/index.html#?..." allow="microphone; camera; display-capture; autoplay">` tam ekran arama katmanında; aynı pencerede `message` dinleyicisi köprü.
   - **(2) ayrı WebView/pencere** (Element X yöntemi): Tauri `WebviewWindowBuilder` ile ikinci pencere/webview; masaüstünde işe yarar, **Android'de çoklu webview/Activity desteği Tauri'de zayıf**. Bu yüzden (1) ile başla; `controls` erişimi için EC `ec://` ile **aynı origin'de** (`parentUrl` ile aynı origin) servis edilirse `iframe.contentWindow.controls` çalışır.
2. `src/lib/durum/arama.svelte.ts`'i sadeleştir: durum `bos | baglaniyor | bagli | bitti`; `widget_ac` çağır → iframe `src`; `widget-gelen` olayını `iframe.contentWindow.postMessage(json, "*" | origin)`; `message` olayını (Element X'teki süzgeçle: `api=="fromWidget" && !response || api=="toWidget" && response`) `widget_gonder`e ilet; `content_loaded` → "bağlandı" göstergesi (10 sn zaman aşımı); `io.element.close` → kapat.
3. Odada "Arama" düğmesi: DM'de sesli/görüntülü, grup odalarında "Arama başlat/katıl" (`Room::has_active_room_call` ile "Katıl" göster); arama sürüyor çubuğu (mevcut `arama` üst çubuğu yeniden kullanılır). Gelen arama: `m.rtc.notification` `ring` olaylarından zil + bildirim (mevcut gelen arama bildirimi yeniden bağlanır).
4. Ekran paylaşma düğmesi EC'nin içinde; Android'de otomatik gizli (`getDisplayMedia` yok); Linux'ta WebKitGTK ≥ 2.42 + portal ile dener.
5. GIF paneli (KLIPY, BYOK) ayrı iş.

### E. Linux
`libnice-gstreamer1` + `gst-plugins-bad`/`-good`, `pipewire` bağımlılıklarını README'ye ve `flake.nix` `buildInputs`'a (`gst_all_1.gst-plugins-bad`, `libnice`) ekle. Wayland ve X11'de ayrı dene (`GDK_BACKEND=x11`). Dağıtım paketlemede GStreamer eklentilerini AppImage'e dahil et.

### Yeni paketler (kullanıcının onayı gerekli)
- Cargo: **`matrix-sdk` özelliği `experimental-widgets`** (yeni crate yok; dolaylı `urlencoding`, `uuid`).
- Cargo (yalnız Linux): **`webkit2gtk = "2.0.2"`** doğrudan bağımlılık (ağaçta zaten var, MIT).
- Varlık: **EC gömülü paketi** `element-call-embedded-0.28.2.tar.gz` (AGPL-3.0, npm `@element-hq/element-call-embedded` ile de gelir; npm yerine GitHub tarball + sha256 daha az bağımlılıktır). `public/` veya Tauri `resources` altına (≈ birkaç MB; boyutu ölç).
- Gradle: **yok** (WebView'e dosya veriyoruz, AAR gerekmez); Android `androidx.webkit` (`WebViewAssetLoader`, `WebMessageListener`) yalnız seçenek (2) için.

## 8. Açık riskler

1. **Linux WebKitGTK + LiveKit**: `RTCPeerConnection`, Insertable Streams (E2EE), `getDisplayMedia`, Wayland. Başarısız olabilir; yedek (yerel LiveKit) çok pahalı. Önce **hızlı Linux deneme** (A adımı) yapılıp karar verilmeli.
2. **EC 0.28.x ↔ matrix-sdk 0.19.1 yetki uyumsuzluğu** (MSC4533 `rtc_livekit_*`): EC yeni sürümde bunu şart koşabilir; gerekirse EC sürümünü düşür veya matrix-sdk'yı yükselt.
3. **Güvenli bağlam ve CSP**: EC'yi hangi origin'den sunacağımız (özel şema `ec://`, Android'de `http://ec.localhost`?) `getUserMedia` için güvenli bağlam sayılmalı; Tauri'nin genel CSP'si EC'yi bozar.
4. **Android'de ekran paylaşma yok** (WebView yolunda); yerel yığın (`element-call-android`) Rust/UniFFI + Kotlin Compose gerektirir, bizim Svelte arayüzüyle uyumsuz, **ayrı büyük iş**.
5. **Arka uç süreklilik**: matrix.org SFU'su "geçici sponsorlu"; kullanıcının sunucusunda MatrixRTC yoksa arama olmaz (net hata mesajı + belge gerekir). Üçüncü taraf istemci şartı yayımlanmamış.
6. **Eski 1:1 VoIP v1 uyumu kaybolur**: EC MatrixRTC (`m.rtc.*`) konuşur; eski istemcilerle (yalnız v1) arama kurulamaz.
7. **GIF**: KLIPY "saklama/yeniden barındırma yok" şartı Matrix'in GIF'i yükleyerek göndermesiyle çelişebilir; yazılı onay şart.
8. **Lisans**: AGPL yükümlülükleri (kaynak bağlantısı, değişiklik yayımı) dağıtım belgelerine eklenmeli.
9. **Aralıklı belirsizlikler** (doğrulanmadı): Opus FEC/RED varsayılanı, WebKitGTK `RTCRtpScriptTransform` desteği, `ec://` şemasının Android'de güvenli bağlam olması, Element X'in WebView'i `FOREGROUND_SERVICE_CAMERA` kullanıp kullanmadığı (manifestte yalnız `microphone`).

## 9. Sonraki adım: Android'de ekran paylaşımı (planlandı, YAPILMADI)

WebView'de `getDisplayMedia` yok. Yapılacaksa yerel yoldan: (1) `MediaProjectionManager.createScreenCaptureIntent()` ile kullanıcı izni (Activity sonucu),
(2) `foregroundServiceType="mediaProjection"` + `FOREGROUND_SERVICE_MEDIA_PROJECTION` izniyle ön plan servisi (Android 14+ şart; Play incelemesi ister),
(3) `VirtualDisplay` + `ImageReader` ile kareler; WebView içinde bu kareleri bir `MediaStreamTrack`'e çevirmenin yolu yok, bu yüzden ya EC'yi
Element X'in yerel yığınıyla (`element-call-android` + `matrix-rust-rtc`, UniFFI) değiştirmek ya da `RTCPeerConnection`'ı WebView dışında (libwebrtc) kurmak gerekir. İkisi de büyük iş.
Şimdilik arayüz yükleme ekranında "Android'de ekran paylaşımı yok, izleyebilirsin" der.

## 10. Uygulama notları (2026-11-23)

Bu araştırmaya göre kodlandı: `src-tauri/src/matrix/ec.rs`, `src/lib/arama-ec/*`. Kararlar: EC gömülü paketi (npm 0.28.2) kendi `ec` şemamızdan sunulur
(çapraz kaynak iframe: `window.controls` doğrudan erişilemez, bu yüzden EC'ye `public/ec-kopru/kopru.js` enjekte edilir); `call.element.io` yalnızca yedek.
