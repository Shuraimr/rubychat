# Görev: pencere çubuğu seçimi + Alt menü çubuğu (masaüstü)

Tasarım: Figma "27 · rubychat pencere çubuğu ve menü çubuğu" (sayfa 143:2), pano 143:3. Kullanıcı onayladı (2026-11-27).
Yalnızca masaüstü Linux (Flatpak). Telefon/tablet etkilenmez.

## 1. Ayarlar › Görünüm › Pencere
- "PENCERE ÇUBUĞU" iki seçenekli bölümlü düğme: **rubychat (çubuksuz)** (varsayılan, bugünkü hâl) / **Sistem çubuğu**.
  Tercih `pencereCubugu: "rubychat" | "sistem"` (src/lib/durum/tercihler.svelte.ts). Değişince hemen uygulanır:
  Tauri `getCurrentWindow().setDecorations(bool)`; açılışta da tercihe göre uygulanır (tauri.conf.json'daki decorations varsayılanı
  ilk karede yanıp sönmesin diye Rust tarafında pencere kurulurken tercihi okumak gerekebilir — yoksa ilk karede kısa titreme kabul).
  Sistem çubuğu seçiliyken rubychat'in kendi sürükleme alanı/pencere düğmeleri (varsa) gizlenir; çift tıkla büyütme sistemindir.
  Açıklama: "Sistem çubuğu: işletim sisteminin başlık çubuğu, kapat · büyüt · küçült düğmeleri ve pencere yöneticisinin kendi davranışı."
  Döşemeli pencere yöneticilerinde (Hyprland, Sway) çubuk hiç çıkmayabilir: normal, not düşülür.
- Anahtar **"Alt ile menü çubuğu"** (varsayılan açık): Alt'a basıp bırakınca menü çubuğu açılır.
- Anahtar **"Menü çubuğunu hep göster"** (varsayılan kapalı): açıkken çubuk sabit durur ve içerik 34px aşağı iner.

## 2. Menü çubuğu (yeni bileşen src/lib/bilesenler/MenuCubugu.svelte)
- 34px yükseklik, --yuzey-1, alt kenarda ince çizgi; menü adları Medium 13px; açık menü --ton zeminli.
- Menüler ve öğeler **yalnızca var olan komutlardan** (src/lib/klavyeKisayol.svelte.ts komut tablosu + var olan eylemler). Her öğenin
  sağında kısayolu (kbd) yazar; kısayolu olmayanda boş. Olmayan kısayol UYDURMA.
  - Dosya: Yeni sohbet · Oda oluştur · Alana katıl… | Hesap ekle · Ayarlar | Pencereyi kapat · rubychat'ten çık (Ctrl+Q)
  - Düzen: Kopyala · Yapıştır | Sohbette ara (Ctrl+F) · Mesaj ara (/)
  - Görünüm: Sohbet boyutu büyüt/küçült/sıfırla (Ctrl+= / Ctrl+- / Ctrl+0) · Listeyi gizle (Ctrl+B) · Tema (alt menü: Sistem/Koyu/Açık)
  - Git: Oda paleti (Ctrl+Space) · Sohbetler · Alanlar · Önceki/sonraki oda (gT / gt)
  - Yardım: Klavye kısayolları (?) · Kurulum raporu · Güncellemeleri denetle · rubychat hakkında
- Klavye: Alt tek başına basılıp BIRAKILINCA açılır (Alt'a basılıyken başka tuş geldiyse açılmaz → Alt+harf kısayolları bozulmaz;
  Vim Normal kipinde de çalışır). Açılınca ilk menü odaklı; ← → menüler, ↓ ↑ öğeler, Enter çalıştırır, Esc ya da Alt kapatır.
  Alt basılıyken menü adlarının erişim harfi altı çizili görünür; Alt+D/Ü/G/İ/Y ilgili menüyü doğrudan açar (çakışan kısayol varsa onu bozma).
- Fare: menü adına tıkla aç; menü açıkken diğer adın üstüne gelince geçer; dışarı tıkla kapanır.
- Çubuk mesajların ÜSTÜNE biner (hep göster kapalıyken), içeriği itmez. Bildirim çubuğu (toast) ve oda başlığıyla çakışmamalı.
- Erişilebilirlik: role="menubar"/"menu"/"menuitem", aria-expanded, odak tuzağı yok ama odak geri döner.
- Animasyon: açılış 120ms opacity+translateY(-4px), "Animasyonları azalt"ta anında.

## Doğrulama
svelte-check 0 hata; Flatpak'ta: iki çubuk kipi arasında geçiş (GNOME), Alt bas-bırak, Alt+harf, Vim Normal kipinde Alt, Esc.
