# rubychat · Yapılacaklar (kullanıcının telefon testi, 2026-11-22)

İlk telefon denemesinden sonra kullanıcının bulduğu sorunlar. Sırayla, her adım telefonda denenerek ilerlenecek.

## 1. Çökme ve kırık akışlar — KODDA DÜZELTİLDİ (2026-11-23), telefonda doğrulanacak
- Düzeltildi: seçiciden boş dönünce çökme, medya ekranı kapanmıyordu (gezinme `#geriGit`), profil her girişte yükleniyordu (önbellek), Matrix avatarı (`ben` DTO'sunda `avatar_mxc`), çıkışta "destroyed mutex" çökmesi, matrix.org girişinde yanlış "sertifika iptal edildi" (CertificateVerifier.kt).
- Doğrulanmadı: fotoğraf gönderme.
- Fotoğraf ekle → seçiciden **hiçbir şey seçmeden geri gelince uygulama çöküyor** (`src/lib/medya/MedyaAkisi.svelte`: boş/iptal edilen `<input type=file>` durumu; logcat `rubychat` etiketine bak).
- Dosya/medya ekranı açılıyor ama **kapanmıyor** (✕ / geri tuşu çalışmıyor; katman `src/lib/medya/katman.ts` → `gezinme` yığını).
- **Fotoğraf gönderilemiyor** (sıkıştırma → `medya_parca_yaz` → `medya_gonder` zincirinde nerede koptuğunu logcat ile bul).
- Ben/profil sayfası her girişte adı vb. **yeniden yüklüyor**; bir kez al, önbellekte tut.
- **Matrix profil fotoğrafı görünmüyor** (avatar mxc → `medya://` şeması; kendi avatarımız `ben` DTO'sunda yok olabilir).

## 2. Hız: açılış, oda açma, arka plan eşitleme
- Yapıldı (2026-11-23): yayın derlemesi (opt-level 2, strip), sliding sync sürümü ilk girişte keşfedilip dosyada saklanıyor. Telefonda ölçülmedi.
- Uygulama açılışı ve oda açılışı çok yavaş.
- Hedef: açılışta önbellekten ANINDA liste (SQLite durum deposu + sliding sync önbelleği), oda açınca son mesajlar anında (Timeline olay önbelleği / `event_cache` etkin mi kontrol et), arka planda eşitleme sürer.
- Arka planda eşitlemeyi canlı tutmak (Android ön plan servisi) ve ileride push (UnifiedPush) düşünülecek.

## 3. Anlık mesaj araması (binlerce mesaj) — KODLANDI (2026-11-23), DERLENMEDİ / telefonda denenmedi
- Yapıldı: tantivy 0.26 yerel dizin (`src-tauri/src/matrix/dizin.rs`), Türkçe katlama + önek araması, canlı besleme + geriye doğru doldurma (ilerleme diske yazılır, yeniden başlatınca sürer), komutlar `mesaj_ara` / `dizin_durumu` / `olaya_git`, arayüz `src/lib/arama-mesaj/` (sohbet listesinde "Mesajlar" bölümü, oda başlığında arama düğmesi + katman, sonuca atla + vurgula). Ayrıntı: `docs/MIMARI.md` "Mesaj araması".
- Sonuca atlama: odaklı çizelge DEĞİL; açık odanın çizelgesinde olay yoksa `olaya_git` en çok 60×50 olay geriye sayfalar, sonra kaydırır + vurgular. Daha eski mesajlar bulunamaz (uyarı gösterilir).
- Kalan / bilinen sınırlar: arama alanı ekranın altına taşınacak (bileşenler yerleşimden bağımsız yazıldı); kapalıyken kaçan mesajlar (doldurması bitmiş odalarda) dizine girmez; sonradan katılınan odalar sonraki açılışta doldurulur; oda başına 20 000 olay sınırı; sesli/konum mesajları dizinlenmez; kullanıcı adına göre arama / tarih süzgeci yok; Cargo.lock henüz güncellenmedi (ilk derlemede güncellenir).

## 4. Arayüz hâlâ kötü
- Kullanıcı: "UI hâlâ korkunç". Telefonda ekran görüntüleriyle tek tek ele alınacak; dosya yükleme ekranı öncelikli.
- Yeni APK'yı adb ile YÜKLEME: 190 MB aktarım USB internet paylaşımını düşürüyor. Bunun yerine: `cd src-tauri/target/apk-sun && python3 -m http.server 8765 --bind <USB ağ IP>` → telefonda tarayıcıdan indir.
