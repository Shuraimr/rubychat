# Görev: yükleme hâlleri (ekran hiç boş durmaz)

Tasarım: Figma sayfa "27 · rubychat pencere çubuğu ve menü çubuğu", pano "Yükleme hâlleri" (144:2). Kullanıcı onayladı (2026-11-27).

## Kurallar (her yerde)
1. Yükleme **400 ms**'yi geçerse iskelet görünür; daha kısa sürerse hiçbir şey yanıp sönmez (Oda.svelte'deki `iskeletZamani` kalıbı).
   Bunu tek yardımcıya çıkar: `src/lib/iskelet.svelte.ts` → `gecikmeli(yukleniyor: () => boolean, ms = 400)`; var olan yerler de onu kullansın.
2. İskelet gerçek içeriğin **şeklindedir**; içerik gelince yerinde değişir, hiçbir şey kaymaz (yükseklikler aynı).
3. Var olan global `.parilti` sınıfı (yüzey-2 blok + tek yönlü parıltı; "Animasyonları azalt"ta durağan). Yeni animasyon yok.
4. Bilinen veri hemen çizilir (önbellekteki ad, avatar, üye sayısı); yalnızca bilinmeyen kısım iskelettir.
5. Dönen çember yalnızca bir düğmenin kendi işi için kalır (gönderiliyor, indiriliyor, katılıyor).

## Ekranlar
1. **Medya sayfası (Ctrl+V / bırakma):** src/lib/medya/MedyaAkisi.svelte `okunuyor && !oge` hâli: önizleme alanında, beklenen
   oranda (pano için ekran oranı `screen.width/screen.height`, yoksa 4:3) tek büyük `.parilti` blok + altta küçük resim şeridi için
   2 kare iskelet; açıklama kutusu ve gönder düğmesi zaten yerinde (gönder devre dışı).
2. **Oda – eski mesajlar:** yukarı kaydırınca geçmiş yüklenirken (geri sayfalama) en üstte dönen çember/boşluk yerine 3 balonluk
   iskelet (sol-sol-sağ, Oda.svelte ilk sayfa iskeletiyle aynı biçim); gelince kaydırma konumu korunur (mevcut çapa mantığı).
3. **Gelen medya:** mesajdaki resim/video, mesaj içeriğindeki `info.w/h` ile baştan doğru en-boy oranında yer kaplar
   (MesajBalonu / MedyaIcerik), yüklenene dek `.parilti` + ortada küçük tür simgesi; küçük önizleme (thumbnail) varsa önce o
   (bulanıklaştırma yok). Videoda süre çipi hemen görünür.
4. **Alan içeriği (AlanGorunumu) ve Keşfet (OdaKesfet):** alan adı/avatarı listeden bilindiği için hemen; çocuklar gelene dek
   6 satır iskeleti (44px avatar + iki çizgi). Keşfet aramasında da aynı satır iskeleti (dönen çember yerine).
5. **Üye kartı (KullaniciKarti):** ad ve avatar mesajdan bilinir → hemen; profil/çevrimiçi/ortak oda satırları iskelet.
   **Palet önizlemesi (OdaPaleti):** "yükleniyor" yazısı yerine gruplanmış balon iskeletleri.
6. Ayrıca: OdaAyarlari, Uyeler (varsa eksik), mesaj arama sonuçları (MesajAramaSonuclari) — satır iskeleti.

## Doğrulama
svelte-check 0 hata; masaüstünde yavaş ağda (ya da gecikme ekleyerek) her ekranı aç: 400 ms öncesi boş değil-yanıp sönmüyor,
sonrası iskelet, içerik gelince kayma yok; "Animasyonları azalt"ta parıltı duruyor.
