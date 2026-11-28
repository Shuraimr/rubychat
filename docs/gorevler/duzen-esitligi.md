# Görev: düzenler arası özellik eşitliği + masaüstünde düğmesinin yanında açılan pencereler

Figma K9YG3sSUj7x2vH97ZdiERK, kullanıcı onayı 2026-11-28.

**Kullanıcının kuralları**
- Arayüz düzene göre farklı olabilir ama her özellik her düzende erişilebilir olmalı.
- Aynı ekranda aynı eylem kalıcı arayüzde iki kez durmaz.
- **Masaüstünde bir düğmeyle açılan pencere ekranın ortasında açılmaz.** Düğmesinin yanında, açılır kart (dropdown) olarak açılır. Ortadaki pencere yalnızca birkaç büyük ve bağımsız akışta kalır (liste Parça A'da).
- Telefon (dikey ve yatay) bugünkü gibi kalır: alttan sayfa.

**Düzenler**
- dikey telefon
- yatay telefon: yükseklik ≤500, `gezinme.yatay`
- kompakt masaüstü: `duzen.kompakt`, `OdaSeridi`
- geniş masaüstü/tablet: `gezinme.genis`; `Ray` + liste + oda; 1180 px üstünde Kişiler sağda sabit

Parçalar sırayla, ayrı oturumlarda yapılır. Her oturum YALNIZCA kendisine söylenen parçayı yapar.

## Parça A — Düğmesinin yanında açılan pencereler (masaüstü)

**Dosyalar:**
- yeni `src/lib/capa.ts`
- `src/lib/bilesenler/AltSayfa.svelte`
- `src/lib/bilesenler/OdaPaleti.svelte`
- ortada kalacak pencerelerin dosyaları (yalnızca prop vermek için)
- `src/lib/bilesenler/MesajBalonu.svelte` (yalnızca `data-capa`)
- `src/App.svelte` (yalnızca başlatma çağrısı)

### 1. `capa.ts`
"Çapa", pencerenin tutunduğu düğmedir.
- Belgede yakalama aşamasında `pointerdown` dinle.
- Hedefin en yakın `button, a, [role=button], [role=menuitem], [data-capa]` öğesini ve işaretçinin koordinatını zaman damgasıyla sakla.
- Bir düğme klavyeyle (Enter/Space) etkinleşirse ve `document.activeElement` bir düğmeyse onu sakla. Yazı alanını ASLA çapa yapma.
- `sonCapa(enFazlaMs = 1000): DOMRect | null`:
  - öğe hâlâ DOM'daysa ve bir boyutu varsa onun dikdörtgenini döndürür;
  - yoksa işaretçi noktasından 0×0 bir dikdörtgen döndürür;
  - süre geçtiyse null döndürür.
- `capaBaslat()` dinleyiciyi kaldıran bir fonksiyon döndürür. App.svelte'deki `birak` listesine eklenir.

### 2. `AltSayfa.svelte`: açılır kart kipi
**Yeni prop'lar:**
- `yerlesim?: "otomatik" | "orta"`, varsayılanı "otomatik"
- isteğe bağlı `capa?: DOMRect | null`

**Ne zaman açılır kart olur:** `gezinme.genis` doğru, `yerlesim === "otomatik"` ve çapa (`capa ?? sonCapa()`, açılışta alınır) varsa.

**Görünüm:**
- `position: fixed`
- genişlik `min(420px, 100vw - 16px)`
- köşe 1.25rem (`.acilir` gibi)
- gölge `--kat-2`, zemin `--yuzey-1`

**Yer:**
- **Çapa sol rayda veya şeritteyse:** çapanın sağ kenarı 140px'ten küçükse ya da `closest("nav.ray, nav.serit")` tutuyorsa bu sayılır.
  - Kartın sol kenarı çapanın 8px sağında.
  - Çapa ekranın üst yarısındaysa kartın üstü çapanın üstüyle hizalanır (aşağı açılır).
  - Alt yarısındaysa kartın altı çapanın altıyla hizalanır (yukarı açılır).
- **Diğer çapalar:**
  - Altta yer varsa (en az 320px ya da üstteki yerden fazla) kart çapanın 8px altında açılır, yoksa 8px üstünde.
  - Sol kenar çapanın sol kenarıyla hizalanır. Sığmazsa sağ kenarlar hizalanır.
- **Her durumda** kart ekran kenarından en az 8px içeride kalır.

**Yükseklik:** `max-height` = o yönde kalan yer − 8px. `.icerik` zaten kayar. Pencere boyutu değişirse yer yeniden hesaplanır.

**Davranış:**
- Perde saydamdır ama dışarı tıklamak yine kapatır.
- Escape ve geri tuşu aynı katmanla kapatır.
- Odak bugünkü gibi kartın içine geçer.

**Hareket:**
- Açılış: `opacity` ve `scale(.96)`'dan başlar; `transform-origin` çapa tarafında; `--sure-orta` + `--egri-ac`.
- Kapanış daha hızlı: `--sure-hizli`.
- "Animasyonları azalt" açıkken süre 0 (`sureMs`). Yay ya da taşma yok.

**Çapa yoksa** (kısayolla ya da kendiliğinden açılan pencere): bugünkü ortadaki pencere.

### 3. Ortada kalan pencereler
Şunlara `yerlesim="orta"` ver:
- `SifrelemeKatmani` (doğrulama, kurtarma anahtarı)
- `GuncellemeSayfasi`
- `KareKirp`
- `KlavyeYardim`

Başka hiçbir çağırana dokunma. Geri kalanların hepsi kendiliğinden düğmesinin yanında açılır: kullanıcı kartı, klasörleri düzenle, yeni sohbet, oda oluştur, ilet, tepki kimler, okuyanlar, sil onayı, bildirim paneli, oda önizleme ve diğerleri.

### 4. `OdaPaleti.svelte`
- Ctrl+Space ile açılınca bugünkü yerinde (üstte ortada) açılır.
- Bir düğmeden açıldıysa (açılışta `sonCapa()` doluysa) aynı kurallarla düğmenin yanına hizalanır. Genişliği bugünkü gibi kalır, ekrana sığdırılır.

### 5. Kullanıcı kartı
Sohbette birinin adına veya avatarına tıklanınca kart adın yanında açılmalı. O ad ya da avatar `button` değilse `MesajBalonu.svelte`'de ona `data-capa` ekle. Davranışı değiştirme.

## Parça B — Keşfet ayrı bir bölüm

Figma: 07 · 18:1373, 06 · 16:1447, 05 · 15:1009, 04 · 9:1247.

Şimdi masaüstünde Keşfet ortada açılan bir pencere (OdaKesfet, AltSayfa). Tasarımda Keşfet bir BÖLÜM: liste sütununda oda dizini, oda sütununda seçilen odanın önizlemesi.

**Dosyalar:**
- `src/lib/durum/gezinme.svelte.ts`
- `src/App.svelte`
- `src/lib/bilesenler/OdaKesfet.svelte`
- `src/lib/bilesenler/OdaOnizlemeSayfasi.svelte`
- `src/lib/bilesenler/Ray.svelte` (yalnızca Keşfet düğmesi)
- `src/lib/ekranlar/Alanlar.svelte`
- `src/vitrin/kur.ts` + `src/vitrin/veri.ts` (dizin ve önizleme cevapları eksikse)

### 1. Sekme
- `Sekme` tipine `"kesfet"` ekle.
- Dikey telefonda Keşfet sekmesi YOK; üç sayfa aynı kalır.
- Dikey telefona geçilirken sekme "kesfet" ise "alanlar" yap.

### 2. `OdaKesfet.svelte`: `gomulu` prop
AltSayfa olmadan, bir sütun sayfası olarak çizilir. Yukarıdan aşağıya:
1. "Keşfet" başlığı; sağında sunucu hapı (bulut simgesi + sunucu adı, bugünkü sunucu seçimi).
2. Arama alanı: "Dizinde ara ya da #adres:sunucu yaz".
3. Tümü / Odalar / Alanlar sekmeleri.
4. Sonuç satırları: avatar (`anahtar` ile), ad, adres (mono), 2 satıra kadar açıklama, sağda üye sayısı, alansa "Alan" çipi.

Seçili satırın zemini `--yuzey-2`. Bugünkü işlevlerin hepsi korunur: sunucu seçme, adresle katılma, rubychat alanı tanıtım kartı, boş ve hata hâlleri.

### 3. Önizleme
- **Geniş ve kompakt masaüstünde** bir sonuca tıklamak oda sütununda gömülü önizlemeyi açar. `OdaOnizlemeSayfasi`'na yeni `gomulu` prop eklenir. Ortada, yukarıdan aşağıya:
  - büyük avatar, ad, adres
  - çipler: üye sayısı, Herkese açık, Geçmiş görülebilir
  - konu
  - Katıl ve kopyala düğmeleri
  - "SON MESAJLAR" kartı
- **Hangisi görünür:**
  - Keşfet bölümündeyken oda sütunu önizlemeyi gösterir.
  - Önizleme seçili değilse oda sütunu bugünkü odayı ya da boş hâli gösterir.
- Katılınca oda açılır ve Sohbetler'e dönülür.
- **Yatay telefonda** bir sonuca tıklamak bugünkü gibi alttan önizleme sayfasını açar.

### 4. App.svelte
- Liste sütununda `gezinme.sekme === "kesfet"` ise `<OdaKesfet gomulu />` gösterilir. Bu geniş, kompakt ve yatay telefon dallarının üçünde de geçerli.
- Kompaktta Keşfet açıkken liste sütunu çekmece değil kalıcı sütundur (16:1447: şerit + 400px dizin + önizleme).

### 5. `Ray.svelte`
- Keşfet düğmesi pencere açmaz, sekme seçer; sekme kesfet iken `aktif` olur.
- Ray artık `OdaKesfet`'i pencere olarak kullanmaz.

### 6. `Alanlar.svelte`
- Listenin en üstüne kalıcı bir "Odaları keşfet" satırı (pusula simgesi) ekle.
  - Telefonda bugünkü pencereyi açar.
  - Geniş ekranda Keşfet sekmesine geçer.
- Boş durumdaki düğme kalır.

## Parça C — Ray, liste altı, Yeni menüsü, yatay telefon

Figma: 07 · 18:555, 18:1820; 05 · 15:708.

**Dosyalar:**
- yeni `src/lib/bilesenler/YeniMenusu.svelte`
- `src/lib/bilesenler/AltDock.svelte` (yalnızca menüyü YeniMenusu'ya taşımak için)
- `src/lib/bilesenler/Ray.svelte`
- `src/lib/ekranlar/Sohbetler.svelte`
- `src/lib/ekranlar/SohbetAramasi.svelte`
- `src/lib/bilesenler/Zil.svelte` (gerekirse)
- `src/App.svelte` (telefon dalı)

### 1. `YeniMenusu.svelte`
AltDock'taki "+" menüsünün içeriği tek yerde toplanır. Tasarım 18:1820:
- "OLUŞTUR" başlığı: Yeni sohbet, Grup oluştur, Alan oluştur
- "KATIL" başlığı: Odaları keşfet, Adresle katıl, İstekler (bekleyen sayısı sağda)

`.acilir` ve `.acilir-satir` sınıflarını kullan. Seçimler bugünkü sayfaları açar:
- Yeni sohbet: `YeniSohbet`
- Grup oluştur / Alan oluştur: `OdaOlustur`
- İstekler: `istekler.ac()`
- Odaları keşfet: geniş ekranda Keşfet sekmesi, telefonda bugünkü pencere

AltDock bu bileşeni kullanır. Telefondaki görünüm DEĞİŞMEZ.

### 2. Ray (geniş masaüstü + yatay telefon; 18:555 / 15:708)
- Üstte: Sohbetler (rozetli), Alanlar, Keşfet.
- Altta:
  - **Bildirimler:** zil simgesi + okunmamış rozeti; bildirim panelini açar (Zil.svelte'nin açma mantığını kullan)
  - Görünüm
  - Profil
- Yatay telefonda da etiketler görünür (tasarımda var). Sığmazsa yalnız yatay telefonda etiket boyutu .6875rem.

### 3. Sohbetler başlığındaki zil
YALNIZCA dikey telefonda görünür. Diğer düzenlerde zil rayda ya da şeritte; iki kez durmamalı.

### 4. Liste altı
`SohbetAramasi`'nda zaten var: arama hapı + yeni düğmesi.
- "+" artık doğrudan YeniSohbet'i açmaz. 48px, yuvarlak, vurgu renkli bir düğmedir. YeniMenusu'nu düğmenin ÜSTÜNDE açar; menünün sol kenarı liste sütunuyla hizalıdır (18:1820). Menü açıkken düğme ✕ olur.
- Arama hapı bugünkü sohbet aramasını yapar.
- Liste altı yatay telefonda da görünür; dikey telefonda ve kompaktta görünmez.

### 5. Yatay telefon (15:708)
- Ray + liste (yaklaşık 300px) + oda YAN YANA durur. Oda açılınca liste gizlenmez.
- Oda yokken oda sütununda bugünkü boş hâl görünür.
- Geri kaydırma ve geri tuşu odayı bugünkü gibi kapatır.

## Parça D — Kompakt şerit

Figma: 06 · 16:648, 16:868.

**Dosyalar:**
- `src/lib/bilesenler/OdaSeridi.svelte`
- `src/lib/durum/duzen.svelte.ts`
- `src/App.svelte` (kompakt dalı)

Şerit yaklaşık 76px genişliğinde. Yukarıdan aşağıya:
1. **Ara:** 44px yuvarlak, `--yuzey-2`; OdaPaleti'ni düğmenin yanında açar.
2. **+:** 48px köşeli, vurgu dolgulu; YeniMenusu şeridin sağında açılır.
3. **Sohbetler:** simge + etiket + rozet; çekmeceyi açar ve kapatır (Ctrl+B).
4. **Alanlar**
5. **Keşfet** (Parça B'deki sekme)
6. ince ayırıcı
7. **Son 3 oda:** avatarlar; önce okunmamış ya da bahsetme olanlar, sonra en yeniler. Rozetler aynı kalır, seçili oda vurgulu.
8. boşluk
9. **Bildirimler:** zil + rozet + etiket
10. **Görünüm**
11. **Profil:** avatar + etiket; güvenlik noktası kalır

Etiketler .6875rem, tek satır, kesilmez. 40 oda avatarı kalkar; tam liste çekmecede.

**Çekmece (16:868):**
- Şeridin yanında açılır.
- Başlığın sağında çekmeceyi kapatan yan panel simgesi var.
- İkinci bir alt çubuk YOK.

## Her parça için kurallar
- docs/HARITA.md "Kurallar" bölümüne uy.
- Kod yorumu önce İngilizce, sonra Türkçe.
- Renk ve süre yalnızca token ile.
- Yeni paket yok.
- Yeni metinler `src/lib/i18n/tr-duzen.ts` + `en-duzen.ts` dosyalarına; `tr.ts` / `en.ts` içinde yayılır. Varsa mevcut metni yeniden kullan.
- Düğme, çip ve etiket yazıları hiçbir dilde 2 satıra kaymaz.
- Boşta animasyon, gradyan, blur yok.
- Dokunma hedefi ≥44px.
- Yeni bir komut gerekirse vitrin kipinde (`src/vitrin/kur.ts`) de cevapla.
- Başka parçanın işini yapma, başka dosyaya dokunma.

Bitince Türkçe kısa rapor yaz: değişen dosyalar, yapamadıkların, emin olmadıkların.

## Doğrulama (Claude yapar)
- `nix develop -c npm run check`
- Vitrin (`?vitrin`): 390×844, 844×390, 1024×720 ve 1440×900; koyu ve açık tema.
- Kontrol listesi:
  - Her düzende Keşfet, Ara, Yeni, Bildirimler, Kişiler, Görünüm ve Profil erişilebilir.
  - Masaüstünde düğmeyle açılan pencereler düğmenin yanında açılıyor.
  - Hiçbir eylem iki kez durmuyor.
  - Yatay taşma yok.
  - Konsolda hata yok.
