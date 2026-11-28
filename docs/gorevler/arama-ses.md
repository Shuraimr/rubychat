# Görev: grup aramalarında çökme + ses ayarları (2026-11-28)

Kullanıcı: "Arkadaşlarımın sesli aramasına katılınca sesim gitmiyor; ne onun sesi geliyor ne benim sesim ona gidiyor. Mobilde direkt
çöküyor." Ayrıca arama ekranına mikrofon ve hoparlör (çıkış) seçimi, mikrofon seviyesi, gürültü engelleme.

## Kanıtlar (Claude buldu, yeniden araştırma)

- **Android çökmesi (KESİN):** logcat crash tamponu, SIGABRT, `abort` çağıran işlev logcat'e `rtc` etiketiyle yazıyor = libwebrtc `RTC_CHECK`.
  Yığın (metin başvurularından): tokio iş parçacığı → `matrix_rtc_transport` havuzu → `livekit/src/rtc_engine/lk_runtime.rs`
  (`LkRuntime::instance()`, ilk aramada PeerConnectionFactory'yi kurar) → `peer_connection_factory.cpp` → `video_encoder_factory.cpp`
  (Android kodlayıcı fabrikası, JNI) → `class_loader.cc` → `java_types.cc`: `!env->ExceptionCheck()` "error during NewStringUTF".
  Yani fabrika, üzerinde önceden kalmış bir Java istisnası olan bir tokio iş parçacığında kuruluyor. Çözüm: fabrikayı temiz, yeni bir
  `std::thread`'de kur ve süreç boyunca canlı tut; ayrıca kendi JNI kodumuz hiçbir yolda bekleyen istisna bırakmasın.
- **Masaüstü:** Flatpak içinde `parec`/`pacat`/`pactl` çalışıyor (mikrofon 3 sn'de 282 KB verdi). Arama motorunun günlükleri
  `EnvFilter` (`rubychat_lib=info,matrix_sdk=warn`) yüzünden süzülüyor ve Flatpak süreci stdout'u `/dev/null`'a yazıyor: gerçek aramada
  ne olduğu kayıtta yok. Önce kanıt toplanacak (dosyaya günlük), sonra karar.

## Parça R — Rust (+ Kotlin gerekmez)

Dosyalar: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (yalnızca `gunlukleri_baslat` ve komut listesi), `src-tauri/src/android_jni.rs`
(yalnızca `calistir`), `src-tauri/src/matrix/yerel_arama.rs`, `src-tauri/src/matrix/yerel_arama/motor.rs`, `src-tauri/src/matrix/yerel_arama/ses.rs`.

1. **Fabrikayı temiz iş parçacığında kur (Android çökmesi).**
   - `Cargo.toml`: `[dependencies]`'e `livekit = { version = "0.9.7", default-features = false, optional = true }` ekle (yeni paket DEĞİL:
     zaten ağaçta, `[patch.crates-io]` onu `../motor/yama/livekit`'e çevirir); `yerel-arama` özelliğine `"dep:livekit"` ekle.
   - `motor.rs`: `static CALISMA: OnceLock<Arc<livekit::rtc_engine::lk_runtime::LkRuntime>>`. `fn webrtc_hazirla()`: boşsa
     `std::thread::Builder::new().name("rubychat-webrtc".into()).spawn(livekit::rtc_engine::lk_runtime::LkRuntime::instance)` →
     `join()` → `CALISMA.set(...)`. `baslat` içinde `kapat().await`'ten sonra `tokio::task::spawn_blocking(webrtc_hazirla).await` ile
     çağır (tokio'nun bloklayan havuzu da kirli olabilir; o yüzden kendi YENİ iş parçacığı). Güçlü `Arc` saklanır ki arama bitince fabrika
     düşüp sonraki aramada yeniden bir tokio iş parçacığında kurulmasın. Neden/nasıl yorumunu (İng + Tr) yaz: yukarıdaki kanıt.
   - `android_jni.rs` `calistir`: ortam bağlandıktan sonraki HER çıkış yolunda (getClassLoader/loadClass/new_string hataları dahil)
     `exception_check` → `exception_clear` yapılsın (şu an `?` ile erken dönüşler istisnayı bırakıyor; jni-rs hatada temizlemez, iş
     parçacığı webrtc'ce kalıcı bağlıysa sonraki webrtc JNI çağrısı süreci düşürür). En basit: gövdeyi iç bir kapanışa al, sonucu al,
     sonra tek yerde temizle.
2. **Günlük (kanıt için).**
   - `lib.rs` `gunlukleri_baslat`: varsayılan filtre
     `rubychat_lib=info,matrix_sdk=warn,matrix_rtc_core=info,matrix_rtc_call=info,matrix_rtc_call_sdk=info,matrix_rtc_livekit=info,matrix_rtc_transport=info,matrix_rtc_matrix_sdk=info,livekit=warn,libwebrtc=warn`.
   - Masaüstünde (Android değil) stdout'a EK olarak dosyaya da yaz: `$XDG_DATA_HOME` (yoksa `$HOME/.local/share`) +
     `/dev.rubyyard.rubychat{profil_eki()}/gunluk.txt`. Açılışta dosya 4 MB'den büyükse `gunluk.1.txt` olarak yeniden adlandır (eskisini sil).
     Yeni crate YOK: `std::sync::Mutex<std::fs::File>` tracing_subscriber'da `MakeWriter`'dır; `MakeWriterExt::and` ile stdout'la birleştir,
     dosyada `with_ansi(false)`. Dosya açılamazsa yalnız stdout.
3. **Ses ayarları komutları** (`yerel_arama.rs`; özellik kapalıyken boş `motor` modülüne de karşılıklarını ekle).
   - `#[derive(Serialize)] #[serde(rename_all = "camelCase")] struct SesAygiti { ad: String, aciklama: String }` ve
     `struct SesAygitlari { girisler: Vec<SesAygiti>, cikislar: Vec<SesAygiti>, varsayilan_giris: Option<String>, varsayilan_cikis: Option<String> }`.
   - `yerel_arama_aygitlar() -> SesAygitlari` (async, `spawn_blocking`): Linux'ta `pactl -f json list sources` / `list sinks`
     (`name`, `description`; monitör kaynakları hariç: adı `.monitor` ile biten ya da `monitor_of_sink` dolu olanlar) ve
     `pactl get-default-source` / `get-default-sink`. Var olan `komut()` yardımcısını kullan (C yerel ayarı). Android'de boş liste.
   - `yerel_arama_ses_ayarla(giris: Option<String>, cikis: Option<String>, gurultu: bool)`: `ses.rs`'te süreç geneli
     `static AYAR: Mutex<SesAyari { giris, cikis, gurultu }>` (varsayılan: None, None, true) yazar ve süren arama varsa hemen uygular:
     - çıkış değiştiyse çalar yeniden açılır (`pacat --device=<ad>`; `calar` düşürülünce yazma hata verir ve `cal` döngüsü yeni ayarla yeniden açar);
     - giriş değiştiyse mikrofon kaydı yeniden başlar (`parec --device=<ad>`; motor `kayit`'ı düşürür ve `kapali` değilse yeniden kurar —
       motor'a `Istek::SesAyari` ekle);
     - gürültü değiştiyse APM yeniden kurulur: `AudioProcessingModule::new(true, true, true, gurultu)` (yankı, kazanç, yüksek geçiren hep açık),
       `set_stream_delay_ms(80)`; aynı `Mutex<Apm>` içinde yerine konur.
     `Ses::baslat` ve `Kayit` açılırken `AYAR`'ı okur. `None` = sistem varsayılanı (`--device` verilmez). Android'de giriş/çıkış yok sayılır
     (yönlendirmeyi arayüz SesKoprusu ile yapar), gürültü uygulanır.
4. **Mikrofon seviyesi.** `Ses::mikrofon` kapanışında işlenmiş 10 ms'nin tepe değeri (0..1, `i16::MAX`'a bölünmüş) bir `AtomicU32`'ye
   (f32 bitleri) yazılır. `dongu`'ya 100 ms'lik ikinci bir `interval` ekle: mikrofon açıkken (`kayit.is_some()`) değeri okur, 0'a çeker ve
   `"yerel-arama-seviye"` olayıyla `f32` olarak yayar (kapalıyken bir kez 0 yayar, sonra susar). Kayıt yokken olay yok.
5. `lib.rs` komut listesine `yerel_arama_aygitlar`, `yerel_arama_ses_ayarla` ekle.

## Parça S — Svelte arayüzü

Dosyalar: `src/lib/arama-ec/YerelArama.svelte`, yeni `src/lib/arama-ec/sesAyarlari.svelte.ts`, yeni `src/lib/arama-ec/SesAyarlariSayfasi.svelte`,
`src/lib/arama-ec/ec.svelte.ts` (yalnızca `yerelAramaBaslat` çağrısından hemen önce), `src/lib/api/komutlar.ts`, `src/lib/api/olaylar.ts`,
`src/lib/arama-ec/tipler.ts`, `src/lib/i18n/tr-e.ts` + `en-e.ts` (yerel.* anahtarlarının yanına), `src/vitrin/kur.ts`.
Bunların DIŞINDA dosyaya dokunma (başka bir oturum App.svelte, AltSayfa, Ray, Sohbetler… üzerinde çalışıyor).

- `komutlar.ts`: `yerelAramaAygitlar = () => cagir<SesAygitlari>("yerel_arama_aygitlar")`,
  `yerelAramaSesAyarla = (giris: string | null, cikis: string | null, gurultu: boolean) => cagir<void>("yerel_arama_ses_ayarla", { giris, cikis, gurultu })`.
  `olaylar.ts`: `yerelAramaSeviye = (isle: (s: number) => void) => listen<number>("yerel-arama-seviye", …)`. Tipler `tipler.ts`'e
  (`SesAygiti { ad; aciklama }`, `SesAygitlari { girisler; cikislar; varsayilanGiris; varsayilanCikis }`).
- `sesAyarlari.svelte.ts`: `localStorage` anahtarları `rubychat.aramaGiris`, `rubychat.aramaCikis` (try/catch); gürültü için var olan
  `ayarlar.gurultuEngelleme` / `ayarlar.gurultuYaz` (`src/lib/durum/ayarlar.svelte.ts`) kullanılır, yeni anahtar YOK. Rune'lu sınıf:
  `giris`, `cikis`, `seviye` (olaydan), `gonder()` (= `yerelAramaSesAyarla(giris, cikis, ayarlar.gurultuEngelleme)`, hata yutulur),
  `girisSec(ad|null)`, `cikisSec(ad|null)`, `gurultuSec(b)` (her biri yazar + `gonder()`).
- `ec.svelte.ts`: yerel aramayı başlatmadan hemen önce `await sesAyarlari.gonder()`.
- `SesAyarlariSayfasi.svelte` (AltSayfa içinde, başlık "Ses ayarları"):
  - **Mikrofon** (yalnız masaüstü): "Sistem varsayılanı" + aygıtlar; radyo satırları (satır ≥48px, seçili satırda onay ikonu, `role="radio"`,
    `aria-checked`), uzun adlar tek satırda kısaltılır (`text-overflow: ellipsis`). Açılınca `yerelAramaAygitlar()` çağrılır.
  - **Seviye göstergesi**: mikrofon listesinin altında ince çubuk (yükseklik 6px, `--yuzey-3` zemin, dolgu `--vurgu`, genişlik = seviye;
    `transform: scaleX()` ile, geçiş `var(--sure-hizli)`; "Animasyonları azalt"ta geçiş yok). Mikrofon kapalıyken "Mikrofon kapalı" yazısı.
  - **Hoparlör / çıkış**: masaüstünde "Sistem varsayılanı" + `cikislar`; Android'de (`androidMi()`) `sesCihazlari()` listesi, seçince
    `sesCihaziSec(id)` (var olan `ses.ts`); seçili olan = son seçilen (yoksa `sesVarsayilan(...)`).
  - **Gürültü engelleme**: `Anahtar` satırı + kısa açıklama ("Arka plandaki uğultu ve klavye sesini azaltır").
- `YerelArama.svelte`: dock'a "Ses ayarları" düğmesi (`Ikon ad="ayar"`, aynı `.tus` biçimi), Sesler düğmesinin yanına; sayfayı açar.
  Android'deki hoparlör anahtarı kalır (hızlı geçiş). Başka davranışa dokunma.
- Metinler `t()` ile; tr + en. Vitrin (`src/vitrin/kur.ts`): `yerel_arama_aygitlar` için örnek 2 giriş 2 çıkış, `yerel_arama_ses_ayarla` boş.

## Her parça için kurallar
- KABUK KOMUTU YOK. Derleme/denetimi Claude yapar. Yeni npm paketi / crate YOK (livekit zaten ağaçta).
- Kod yorumu önce İngilizce sonra Türkçe, "neden"i anlatır. Renk/süre yalnızca CSS değişkeni. Dokunma hedefi ≥44px.
- Yalnızca adı geçen dosyalar. Bitince kısa Türkçe rapor: değişen dosyalar, yapamadıkların, emin olmadıkların.
