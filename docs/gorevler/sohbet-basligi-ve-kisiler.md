# Görev: sohbet başlığı yenileme + sağda Kişiler paneli

Tasarım: Figma sayfa "27 · rubychat pencere çubuğu ve menü çubuğu", pano "Sohbet başlığı: seçilen" (146:2); yönler 145:2.
Kullanıcı kararı (2026-11-27): **telefonda B (ayrık kapsüller)**, **masaüstü/tablette C (tek kart, iki kat) cilalı**; başlığa odadaki
kişileri açan bölüm; sol = odalar, sağ = bu odanın / DM'in kişileri.

## Ortak (src/lib/ekranlar/Oda.svelte `.tepe` / `.kart` / `header.ust`)
- Kilit adın yanında küçük simge kalır; "Şifresiz oda · " yazısı KALKAR (şifresizlik yalnızca oda bilgisinde).
- Alt satır: "62 üye · ● 5 çevrimiçi" (çevrimiçi sayısı biliniyorsa; yeşil nokta `--islendi`), DM'de varlık rozeti, biri yazıyorsa
  mevcut "yazıyor" metni (vurgu rengi). Ada dokun = oda bilgisi, uzun bas = özelleştir (değişmez).
- Eylemler her odada aynı sırada: **Kişiler** · (ince ayraç) · Ara · (DM'de) Telefon · Bilgi.
- **Kişiler düğmesi** = son konuşan 3 kişinin yüz yığını (24–26px, yuvarlatılmış kare, kenarlı) + üye sayısı. DM'de tek yüz (karşıdaki).
  Panel açıkken düğme `--ton` zeminli (aria-pressed). Bilgi: üye listesi zaten yüklüyse ondan, değilse son mesaj gönderenlerinden.

## Masaüstü/tablet (gezinme.genis): C cilalı
- Kart: `--yuzey-1`, 1px `--kenar-ince`, köşe 20px, **gölge yok**; üstteki zemin geçişi (`.tepe::before` gradyan) kalkar.
- Kimlik alanı yuvarlatılmış dokunma hedefi (üstüne gelince `--yuzey-2`).
- Sabit mesaj kartın **ikinci katı** (SabitCubugu'nun görünümü buraya taşınır/uyarlanır): üstte ince çizgi, iğne simgesi (vurgu),
  metin tek satır, sağda "1/3" (birden çok sabitte; tıkla = sıradakine geç). Sabit yoksa kat hiç yok.

## Telefon (!gezinme.genis): B ayrık kapsüller
- Tam genişlik kart yerine üç kapsül (`--yuzey-2`, 24px köşe): sol = geri (+ okunmamış rozeti, mevcut data-zil-hedef korunur),
  orta = kimlik (avatar 32 + ad + alt satır; içerik kadar genişler, taşarsa ad kısalır), sağ = yüz yığını (Kişiler) + Ara.
  Bilgi ayrı düğme değil: kimliğe dokunmak. Kapsüllerin arkasında mesajlar görünür (zemin geçişi yok).
- Kişiler telefonda mevcut tam ekran Üyeler ekranını açar.

## Sağ Kişiler paneli (yeni bileşen src/lib/bilesenler/KisilerPaneli.svelte, yalnızca geniş ekran)
- 300px, `--yuzey-1`, sol kenarda ince çizgi. Başlık "Kişiler" + "Ctrl+L" ipucu + kapat (✕).
- Arama kutusu (ada/kimliğe göre süz). Gruplar: **YÖNETİCİLER · n** (güç ≥ 50; rol çipi Yönetici/Moderatör), **ÇEVRİMİÇİ · n**,
  **DİĞERLERİ · n** (son görülme). Satır: avatar 36 + çevrimiçi yeşil nokta, ad (çevrimdışıysa soluk), alt satır kimlik / "yazıyor…" /
  son görülme. Tıkla = mevcut üye kartı. Büyük odalarda sanal liste ya da sayfalama (Uyeler.svelte'deki yükleme mantığını kullan).
- **DM'de** panel = karşıdaki kişinin profili: büyük avatar, ad, kimlik, varlık, ortak odalar, doğrulama durumu, Engelle (mevcut
  kullanıcı kartı içeriğini yeniden kullan).
- Geniş masaüstünde (>1180) mesaj alanını daraltır; tablet ve dar masaüstünde içeriğin üstüne kayar (kaplama + hafif karartma),
  Esc/dışarı tıkla kapatır. Açık/kapalı tercihi hatırlanır (`kisilerPaneli` tercihi). Açılış 200ms translateX, azaltılmış harekette anında.
- Yükleme hâli: satır iskeleti (docs/gorevler/yukleme-iskeletleri.md kuralları).

## Klavye (src/lib/klavyeKisayol.svelte.ts komut tablosu)
- Bugün: Ctrl+H = listeye odaklan, Ctrl+L = odaya odaklan (Vim pencere geçişi). Genişlet: **odadayken Ctrl+L** = Kişiler panelini aç ve
  ona odaklan; **paneldeyken Ctrl+H** = odaya dön; panelde j/k satır, Enter üye kartı, Esc kapat. Ctrl+Shift+L = paneli aç/kapat.
  Klavye yardım sayfası ve ipucu metinleri güncellenir.

## Doğrulama
svelte-check 0 hata; 375 / 1075 / 1440 genişlikte: telefonda üç kapsül sığar (uzun oda adında kesilir, taşma yok), tablette kaplama,
masaüstünde daraltma; DM ve grup odası; sabit mesaj 0/1/3; Ctrl+L/H zinciri; açık ve koyu tema; "Animasyonları azalt".
