# Görev: ekran paylaşırken paylaşanın kendi önizlemesi + "gerçekten yayında mı" göstergesi

Önce `docs/HARITA.md` dosyasının **Kurallar** bölümünü oku. KABUK KOMUTU ÇALIŞTIRMA (derleme, test, git yok); yalnızca dosya oku/yaz.
Kod yorumları önce İngilizce, sonra aynı anlamda Türkçe (` · ` ile ya da alt satırda), "neden"i anlatır. Arayüz metinleri i18n'den.

Kullanıcının sözü: "ekran paylaşabiliyor muyum emin değilim, paylaşılan ekran için bir önizleme yok".
Şu an paylaşan kendi ekranını hiçbir yerde görmüyor ve paylaşımın karşıya gidip gitmediğini bilemiyor.

Dokunulacak dosyalar YALNIZCA:
`src-tauri/src/matrix/yerel_arama/motor.rs`, `src/lib/arama-ec/YerelArama.svelte`, `src/lib/arama-ec/tipler.ts`,
`src/lib/i18n/tr-e.ts`, `src/lib/i18n/en-e.ts`, `src/vitrin/kur.ts` (vitrin örnek durumuna yeni alanlar).
Başka dosyaya (App.svelte, AltSayfa, Ray, gezinme vb.) DOKUNMA.

## Parça R — motor.rs

1. **Önizleme kanalı.** `paylas()` içindeki yakalama geri çağırımı (`move |f| { ... iz.capture_video(f) }`) kareyi yayına verir.
   Aynı yerde, kare yayına verilmeden ÖNCE, en fazla **5 kare/sn** (son gönderimden ≥200 ms geçtiyse) kareyi **yarı çözünürlüğe**
   küçültüp `kareler()` haritasında sabit anahtarlı bir `watch` kanalına koy: anahtar sabiti `const ONIZLEME: &str = "ben|ekran-onizleme";`.
   - Küçültme: `matrix_rtc_transport` `I420Buffer` (alanlar `width,height,data_y,stride_y,data_u,stride_u,data_v,stride_v`; renk
     düzlemleri `(w+1)/2 × (h+1)/2`, stride'lara uy). Her düzlemde her 2. satır ve her 2. sütun alınır (2×2 seyreltme). Yeni tampon
     sıkı paketli (stride = genişlik). Yeni genişlik `max(2, w/2)` çift sayı, yükseklik aynı biçimde. Küçük ve paniksiz olsun
     (`get` ile sınır denetimi; tutarsız tamponda o kareyi atla).
   - Kanal türü mevcut `KareKanali` (`watch::Sender<(u64, Option<Arc<VideoFrame>>)>`); `send_modify(|v| *v = (v.0 + 1, Some(...)))`.
     `kare()` komutu bu anahtarı zaten okuyabilir; YerelVideo.svelte değişmez.
   - Kanal `paylas()` başında oluşturulup haritaya konur; `paylasimi_birak()` içinde ve arama bittiğinde (Arama'nın kapanış yolu,
     `drop((kayit, paylasim, alicilar, ses))` olan yer) haritadan **silinir**.
   - Geri çağırım yakalama iş parçacığında çalışır: kilidi kısa tut, küçültmeyi kilit dışında yap.
2. **Yayın denetimi (gerçek WebRTC sayaçları).** `LocalTrackHandle::send_stats().await -> Option<SendStats>` var
   (`motor/crates/matrix-rtc-transport/src/stats.rs`; katmanlarda `bytes_sent`, `frames_encoded`, `frames_per_second`,
   `frame_width`, `frame_height`, `active`). Paylaşım "acik" iken her **2 saniyede bir** (döngüdeki 500 ms `tik`in her 4.'ünde ya da
   ayrı bir `interval`; `MissedTickBehavior::Skip`) ekran izinin istatistiğini oku, katmanların `bytes_sent` toplamının önceki okumaya
   göre farkından kbit/sn hesapla. Yeni yapı:
   ```rust
   #[derive(Serialize, Clone, PartialEq)] #[serde(rename_all = "camelCase")]
   pub struct YayinBilgisi { durum: &'static str /* "basliyor" | "yayinda" | "gitmiyor" */, kbps: u32, kare_hizi: u32, genislik: u32, yukseklik: u32 }
   ```
   - "basliyor": yayın yeni açıldı, henüz iki okuma yok ya da istatistik `None`.
   - "yayinda": son okumada `bytes_sent` arttı.
   - "gitmiyor": art arda 3 okumada (≈6 sn) `bytes_sent` artmadı (durağan ekranda bile 1 kare/sn tekrar var, yani artmalı).
   - `kare_hizi` = en yüksek `frames_per_second` (yoksa 0, yuvarla), `genislik/yukseklik` = en büyük katmanınki.
   - `YerelDurum`'a `onizleme: Option<String>` (paylaşım "seciliyor" ya da "acik" iken `Some(ONIZLEME)`) ve
     `yayin: Option<YayinBilgisi>` (yalnız "acik" iken) ekle. `bildir()` yalnızca değişince olay gönderir; kbps her okumada
     değişebilir, bu kabul (2 sn'de bir).
   - Durum değişiminde (`basliyor→yayinda`, `yayinda→gitmiyor` vb.) `tracing::info!` ile tek satır günlük: kbps, kare hızı, boyut.
     Yayın açılınca (`ekrani_yayinla` Ok) de `tracing::info!("ekran yayında: {g}x{y}")`.
   - Sayaç durumu `Paylasim` yapısında tutulur (önceki bytes, art arda sıfır sayısı), paylaşım bitince kendiliğinden gider.
   - İstatistik okumak `Paylasim.kare` içindeki `Arc<dyn LocalTrackHandle>`'ı klonlayıp kilidi bıraktıktan SONRA `await` eder
     (kilit `await` boyunca tutulmaz).

## Parça S — Svelte

1. `tipler.ts`: `YerelDurum`'a `onizleme: string | null` ve `yayin: { durum: "basliyor" | "yayinda" | "gitmiyor"; kbps: number; kareHizi: number; genislik: number; yukseklik: number } | null`.
2. `YerelArama.svelte`: `d?.onizleme` varken `.orta` içinde sağ altta (dock'un ÜSTÜNDE; dock `data-alt-cubuk`, üst üste binmesin)
   yüzen **önizleme kartı**:
   - 16:9 kutu, masaüstünde genişlik 240px, dar ekranda (genis değilken) 148px; `{#key d.onizleme}<YerelVideo anahtar={d.onizleme} />{/key}`.
     Köşe yarıçapı ve renkler mevcut CSS değişkenlerinden (dosyadaki `.kutu` stiline bak; yeni renk sabiti yazma). Hafif gölge mevcut
     değişkenle (`--kat-1`/`--golge` hangisi dosyada/projede varsa; yoksa gölge yok).
   - Kartın altında tek satır: nokta + metin. `paylasim === "seciliyor"` → "Sistem penceresinde ekranı seç…" (nötr).
     `yayin.durum === "basliyor"` → "Başlıyor…" (nötr); `"yayinda"` → "Ekranını paylaşıyorsun · {kbps→ "1,2 Mb/sn" ya da "850 kb/sn"} ·
     {kareHizi} kare/sn" (yeşil nokta: projede başarı rengi değişkeni varsa onu kullan, `src/app.css` / tema dosyasında ara;
     yoksa `--vurgu`); `"gitmiyor"` → "Görüntü karşıya gitmiyor" (uyarı/hata rengi değişkeni). `role="status"`.
   - Kartta küçük "Durdur" düğmesi (mevcut `durdur()` işlevi), dokunma hedefi ≥44px telefonda.
   - Tam ekran sahne (`tam`) açıkken kart gizli değil ama küçük kalır; `tam` sırasında da sağ altta.
   - "Animasyonları azalt" (`[data-az-animasyon]`) için kart girişinde animasyon kullanırsan kapat; en iyisi animasyonsuz.
   - Başlıktaki `altYazi` "Sen ekran paylaşıyorsun" mantığı aynen kalsın.
3. i18n `tr-e.ts` ve `en-e.ts` (`yerel.` altında, mevcut stile uy): `onizlemeSec`, `yayinBasliyor`, `yayinda` (parametreli: `{hiz}`, `{kare}`),
   `yayinGitmiyor`, `paylasimiDurdur` (zaten benzeri varsa onu kullan), `onizleme` (kart için aria-label: "Paylaştığın ekranın önizlemesi").
4. `src/vitrin/kur.ts`: vitrin örnek `YerelDurum`'larına yeni alanları (`onizleme: null, yayin: null`) ekle ki tip kontrolü geçsin;
   paylaşım "acik" örneği varsa ona `yayin: { durum: "yayinda", kbps: 1800, kareHizi: 30, genislik: 1920, yukseklik: 1080 }`.

## Bitti sayılır
Tüm alanlar Rust↔TS adlarıyla eşleşir (serde camelCase: `kare_hizi` → `kareHizi`), Android derlemesi (`ekran_android.rs`) etkilenmez
(önizleme kodu yalnız `motor.rs`'te, Android'de paylaşım hemen biter). İşin sonunda yaptığın değişiklikleri kısaca listele.
