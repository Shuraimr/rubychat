# rubychat · Yapılacaklar (kullanıcının telefon testi, 2026-11-22)

İlk telefon denemesinden sonra kullanıcının bulduğu sorunlar. Sırayla, her adım telefonda denenerek ilerlenecek.

## 1. Çökme ve kırık akışlar (önce bunlar)
- Fotoğraf ekle → seçiciden **hiçbir şey seçmeden geri gelince uygulama çöküyor** (`src/lib/medya/MedyaAkisi.svelte`: boş/iptal edilen `<input type=file>` durumu; logcat `rubychat` etiketine bak).
- Dosya/medya ekranı açılıyor ama **kapanmıyor** (✕ / geri tuşu çalışmıyor; katman `src/lib/medya/katman.ts` → `gezinme` yığını).
- **Fotoğraf gönderilemiyor** (sıkıştırma → `medya_parca_yaz` → `medya_gonder` zincirinde nerede koptuğunu logcat ile bul).
- Ben/profil sayfası her girişte adı vb. **yeniden yüklüyor**; bir kez al, önbellekte tut.
- **Matrix profil fotoğrafı görünmüyor** (avatar mxc → `medya://` şeması; kendi avatarımız `ben` DTO'sunda yok olabilir).

## 2. Hız: açılış, oda açma, arka plan eşitleme
- Uygulama açılışı ve oda açılışı çok yavaş.
- Hedef: açılışta önbellekten ANINDA liste (SQLite durum deposu + sliding sync önbelleği), oda açınca son mesajlar anında (Timeline olay önbelleği / `event_cache` etkin mi kontrol et), arka planda eşitleme sürer.
- Arka planda eşitlemeyi canlı tutmak (Android ön plan servisi) ve ileride push (UnifiedPush) düşünülecek.

## 3. Anlık mesaj araması (binlerce mesaj)
- Bir sohbette ve tüm sohbetlerde binlerce mesaj içinde yazarken anlık arama + sonuca anında atlama.
- Öneri: Rust tarafında yerel tam metin dizini (SQLite FTS5 — bundled SQLite'ta zaten var; ya da tantivy, sormadan ekleme), şifreli odalar cihazda çözüldükten sonra dizine girer, arka planda geriye doğru sayfalayarak doldurulur. Türkçe karakter katlama (ı/i, ş/s…) + önek araması; sonuçlar yazdıkça (debounce ~50 ms).

## 4. Arayüz hâlâ kötü
- Kullanıcı: "UI hâlâ korkunç". Telefonda ekran görüntüleriyle tek tek ele alınacak; dosya yükleme ekranı öncelikli.
- Yeni APK'yı adb ile YÜKLEME: 190 MB aktarım USB internet paylaşımını düşürüyor. Bunun yerine: `cd src-tauri/target/apk-sun && python3 -m http.server 8765 --bind <USB ağ IP>` → telefonda tarayıcıdan indir.
