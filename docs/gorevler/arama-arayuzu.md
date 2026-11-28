# Görev: arama ekranının yeni tasarımı (Figma "08 · Arama")

Önce `docs/HARITA.md` dosyasının **Kurallar** bölümünü oku. KABUK KOMUTU ÇALIŞTIRMA (derleme, test, git yok); yalnızca dosya oku/yaz.
Kod yorumları önce İngilizce, sonra aynı anlamda Türkçe, "neden"i anlatır. Arayüz metinleri i18n'den (`tr-e.ts` VE `en-e.ts`, `yerel.` altında).
Renkler/süreler yalnız mevcut CSS değişkenleriyle (`--zemin`, `--yuzey-1..3`, `--vurgu`, `--ton`, `--ton-ustu`, `--cozum`, `--hata`, `--bekliyor`,
`--yazi`, `--yazi-2`, `--kenar-ince`, `--kat-1`, `--kat-2`, `--sure-*`, `--egri-*`). Gradyan, blur/backdrop-filter, boşta animasyon YOK.
Düğme metinleri asla 2 satıra kaymaz (`white-space: nowrap`). Telefonda dokunma hedefi ≥44px. Yeni paket YOK.

Dokunulacak dosyalar YALNIZCA: `src/lib/arama-ec/YerelArama.svelte`, `src/lib/arama-ec/SesAyarlariSayfasi.svelte` (gerekirse),
`src/lib/i18n/tr-e.ts`, `src/lib/i18n/en-e.ts`, `src/vitrin/kur.ts`. App.svelte, AltSayfa, gezinme, fareGezinme, ec.svelte.ts, Rust'a DOKUNMA.

Mevcut mantık (paylasAc, basla, durdur, uygulamaDegis, sesListesi, hoparlorDegis, duzey/ver/sustur, hizYaz, yayinMetni, tam, secilen) KORUNUR;
yalnızca yerleşim ve görünüm değişir. `AltSayfa` zaten masaüstünde son tıklanan düğmenin yanında kart, telefonda alt sayfa açılır (yerlesim="otomatik").

## 1. Başlık
- Solda ⌄ küçült (var), ad + durum satırı. Geniş ekranda (`genis`) durum satırının başında kilit simgesi (`Ikon ad="kilit"` ya da projede
  kilide en yakın ikon; `src/lib/bilesenler/Ikon.svelte`'deki adlara bak) `--cozum` renginde, metin: "Uçtan uca şifreli · {n} kişi · {süre}"
  (yeni anahtar `yerel.sifreliKisi` = "Uçtan uca şifreli · {n} kişi"). Paylaşım varken mevcut "X ekranını paylaşıyor" / "Sen ekran paylaşıyorsun" kalır.
- Geniş ekranda başlığın sağında en fazla 3 avatarlık yığın (Avatar boyut 28, üst üste -8px, `--zemin` 2px halka), fazlası "+N" çipi.
- `koptu` şeridi: başına `uyari` ikonu (`--bekliyor`), metin aynı (`yerel.koptu`), `display:flex; gap:8px; align-items:center`.

## 2. Kutular
- Konuşan: 2px `--vurgu` halka (var). Ad çipi sol altta `--yuzey-3` (var). Susturulmuş: mikrofonKapali ikonu `--hata` (var).
- `sorun` varsa çip SAĞ ÜSTE taşınır (uyari ikonu + metin, `--bekliyor`, `--yuzey-3` zemin, radius 10); küçük kutuda yalnız ikon (var olan gizli metinle).

## 3. Paylaşılan ekranı izleme
- Geniş: solda sahne (`flex:1`), SAĞDA dikey şerit (`.dizi` dikey, genişlik 220, kutular 220×140, `overflow-y:auto`).
- Dar: sahne üstte (16:9, tam genişlik), altında ipucu `yerel.tamEkranIpucu` = "Tam ekran için dokun; telefonu yatay çevirince sahne tüm ekranı kaplar."
  (`.not`, yalnız dar ekranda ve `tam` değilken), altında yatay şerit (kutular 112×112).
- Dar ekranda sahneye dokunmak `tam`'ı açar/kapar (sahne bir `button`; içindeki `.yuzen` düğmesi geniş ekranda kalır).

## 4. Kendi paylaşımın (yüzen `.onizleme-kart` KALKAR)
- `d.onizleme` varken, ızgarada / şeritte **ilk** kutu olarak "kendi paylaşımın" kutusu çizilir (sahnede değil; kendimizi izlemeyiz):
  - Kenar 2px `--cozum` (yayın "gitmiyor" ise `--hata`), içinde `{#key d.onizleme}<YerelVideo anahtar={d.onizleme} />{/key}`.
  - Sağ üstte "Durdur" çipi (`--hata` zemin, `--zemin` yazı, ≥44px dokunma alanı içinde; `durdur()`).
  - Alt kenarda `--yuzey-3` şerit: nokta (yayinda `--cozum`, gitmiyor `--hata`, diğer `--yazi-2`) + `yayinMetni` (tek satır, üç nokta), `role="status"`.
  - `d.paylasilan.length` ise ayrıca çip "Ses: {adlar virgülle}" (`yerel.sesCipi` = "Ses: {adlar}"), şeridin üstünde sol altta.
  - Kutu ızgaradaki büyük kutularla aynı boyutta; şeritte (izleme düzeninde) şerit kutusu boyutunda (metin yalnız nokta + kısa hız).
- Paylaşım "acik" iken başlık + bu kutu yeterli; `aria-label={t("yerel.onizleme")}`.

## 5. Dock — geniş ekran (genis)
Sıra: [mikrofon | ⌄] · [paylaş | ⌄] · Sesler · ayraç · Bitir.
- **Bölünmüş düğme** `.bolunmus`: tek kapsül (`--yuzey-3`, radius 18, yükseklik 52), solda 52px ana bölüm, sağda 24px `asagiOk` bölümü, aralarında 1px `--kenar-ince`.
  - Mikrofon: ana = sustur/aç (mevcut), ⌄ = `sesAyarAcik = true` (SesAyarlariSayfasi; tıklanan ⌄ düğmesinin yanında kart açılır). Susturulmuşken mevcut `.kapali` stili kapsüle.
  - Paylaş (Android değilse): ana ve ⌄ ikisi de `paylasAc()`; paylaşım açıkken kapsül `--cozum` zemin + `--zemin` yazı.
- Ayrı "ayar" (dişli) düğmesi KALKAR (mikrofon ⌄ ile aynı yer; arayüz kendini tekrarlamaz).
- Ayraç: 1px × 32px `--kenar-ince`. Bitir: genişlik 72, `--hata`.
- Her düğmede `title` + `aria-label`.

## 6. Dock — dar ekran (genis değil)
Etiketli düğmeler, eşit genişlik, her biri ikon (24) üstte + etiket (.75rem, nowrap) altta, min-height 60, genişlik ≥64:
Sessize al (`arama.sessiz`/`arama.sesAc`) · Hoparlör (Android) ya da Paylaş (Android değil) · Sesler · Daha fazla (`yerel.dahaFazla`) · Bitir (`yerel.bitir` = "Bitir", `--hata`).
Dock dar ekranda tam genişlik (yan boşluk 12px), radius 26.
- "Daha fazla" → `AltSayfa baslik={t("yerel.dahaFazla")}` içinde satırlar (her satır ≥52px, ikon + başlık + alt metin):
  1. "Mikrofon ve çıkış" (`yerel.mikrofonVeCikis`) alt metin = seçili giriş adı ya da "Sistem varsayılanı" → tıklayınca bu sayfa kapanır, `sesAyarAcik = true`.
  2. "Gürültü engelleme" + Anahtar (SesAyarlariSayfasi'ndaki aynı ayar/depo kullanılır; oradaki kodu oku, aynı işlevi çağır; yeni durum kaynağı yazma).
  3. "Şifreleme" bilgi satırı (tıklanmaz): kilit ikonu `--cozum`, metin `yerel.sifreli` = "Uçtan uca şifreli".
- Dar ekranda ayrı dişli düğmesi yok.

## 7. Paylaş kartı (mevcut AltSayfa içeriği)
- Başlık: "Ekranını paylaş" (`yerel.paylasBaslik`); paylaşım açıkken "Paylaşım" (`yerel.paylasimAyar` mevcut).
- Not: "Ekranla birlikte hangi uygulamaların sesi gitsin? Aramanın kendi sesi hiç gitmez." (`yerel.paylasNot` metnini bununla güncelle, iki dilde).
- Bölüm başlığı "ŞU AN SES ÇALANLAR" (`yerel.sesCalanlar` = "Şu an ses çalanlar", CSS `text-transform: uppercase; letter-spacing:.06em; font-size:.75rem; color: var(--yazi-2)`).
- Uygulama satırları (mevcut). Altlık: birincil "Ekranı seç ve paylaş" (`yerel.sec` metnini güncelle) + altında dipnot
  `yerel.secDipnot` = "Sonraki adımda sistem hangi ekranı ya da pencereyi paylaşacağını soracak." Paylaşım açıkken "Paylaşımı durdur" (`yerel.durdur` metni) tehlike düğmesi.
- Düğmeler tam genişlik, nowrap.

## 8. Vitrin önizlemesi (`src/vitrin/kur.ts`) — doğrulama için
URL `?vitrin&arama=izgara|izleme|paylasim|koptu` ise:
- `yerel_arama_var` → `true` (yalnız bu parametre varken; yoksa false kalır).
- `yerel_arama_baslat` çağrılınca (payload'daki oda kimliğiyle; argNesne ile oku, alan adını `src/lib/api/komutlar.ts` `yerelAramaBaslat`'tan bak)
  `queueMicrotask` içinde `emit("yerel-arama", durum)` gönder. `durum` (`YerelDurum`, `src/lib/arama-ec/tipler.ts`):
  - ortak: `asama:"acik"`, `neden:null`, `mikrofonKapali:false`, `paylasim:"yok"`, `paylasilan:[]`, `paylasimHatasi:false`, `onizleme:null`, `yayin:null`;
    katılımcılar: ben ("Sen", ben:true), "Ece" (konusuyor:true), "Mert" (susturulmus:true), "Deniz" (sorun:"dogrulanmamis"); kamera/ekran null, `sesler`
    her biri için bir mikrofon sesi (`YerelSes` alanlarına uy).
  - `izleme`: Ece'de `ekran:"vitrin|ekran"`, Ece'nin seslerine bir `uygulama` sesi (ad "Helium").
  - `paylasim`: `paylasim:"acik"`, `paylasilan:["Helium"]`, `onizleme:"ben|ekran-onizleme"`, `yayin:{durum:"yayinda",kbps:1400,kareHizi:30,genislik:1920,yukseklik:1080}`.
  - `koptu`: `asama:"koptu"` (ızgara düzeni).
- `yerel_arama_sustur` çağrılınca son durumu `mikrofonKapali` değiştirilmiş olarak yeniden yayınla (düğmenin çalıştığı görülsün).
- Arama kendiliğinden açılsın: dosyanın sonunda, parametre varsa `setTimeout(..., 1500)` ile `ec` (`../lib/arama-ec/ec.svelte`) içe aktarılıp
  `ec.ara({ id: <vitrin verisindeki ilk grup odasının id'si>, ad: <adı>, avatarHarf: <ilk harf>, avatarMxc: null, dm: false, sesli: false })` çağrılsın.
  (`ec.ara` başka bir ön koşul istiyorsa — oturum, `baslat()` — kodu oku ve vitrinde sağla; ec.svelte.ts'yi DEĞİŞTİRME.)

## Bitti sayılır
Mevcut davranışların hepsi çalışır (sustur, hoparlör, paylaş/durdur, uygulama sesi seçimi, Sesler paneli, ses ayarları, tam ekran, küçült, bitir),
yeni metinler iki dilde, tipler uyuşur. İşin sonunda değişiklikleri kısaca listele.
