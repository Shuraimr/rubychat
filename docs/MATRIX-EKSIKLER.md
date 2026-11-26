# Matrix özellik denetimi (2026-11-27)

rubychat'in Rust arka ucunda (`src-tauri/src/matrix`) karşılığı OLMAYAN Matrix özellikleri. matrix-sdk 0.19 hepsini destekliyor; yeni crate gerekmez.

## Önemli (her gün kullanılır)
| Özellik | Matrix | Not |
|---|---|---|
| Oda ayarları: ad, konu, avatar değiştirme | `m.room.name`, `m.room.topic`, `m.room.avatar` | Şu an oda/alan kurulduktan sonra düzenlenemiyor |
| Katılma kuralı, geçmiş görünürlüğü, sonradan şifreleme açma | `m.room.join_rules`, `m.room.history_visibility`, `m.room.encryption` | Alan yönetimi tasarımındaki ayarlarla birlikte |
| Oda adresi (alias) oluşturma / yayınlama | `m.room.canonical_alias`, directory | Keşfet'te yalnızca okunuyor |
| Alan çocuk/ebeveyn bağı | `m.space.child`, `m.space.parent` | Alan yönetimi (Figma 26 · pano 6) |
| Oda başına bildirim ayarı (sessize al, yalnızca bahsetmeler) | push rules / `NotificationSettings` | Yok |
| Konu dizileri (thread) | `m.thread` ilişkisi | Yok; gelen dizi yanıtları düz mesaj gibi görünüyor |
| Sesli mesaj | `m.audio` + MSC3245 dalga biçimi | Yok |
| Kullanıcıyı yok say (engelle) | `m.ignored_user_list` | Yok |
| İçerik şikâyeti | `/rooms/{id}/report/{event}` | Yok |
| Okunmadı olarak işaretle | `m.marked_unread` | Yok |
| Favori / düşük öncelik etiketleri | `m.favourite`, `m.lowpriority` | Sabitleme var, standart etiketler yok (başka istemcilerle eşitlenmez) |

## Orta
| Özellik | Matrix |
|---|---|
| Konum paylaşma (tek sefer / canlı) | `m.location`, `m.beacon_info` (MSC3488/3672) |
| Spoiler metni | `data-mx-spoiler` |
| Sunucu tarafı bağlantı önizlemesi | `/media/preview_url` |
| Oda yükseltme ve mezar taşı takibi | `m.room.tombstone`, `/upgrade` |
| Bilgi metni / duyuru görünümü (`m.notice`) ayrımı | `m.notice` |

## Düşük (yönetici / nadir)
Sunucu ACL (`m.room.server_acl`), widget'lar, üçüncü taraf davetleri (`m.room.third_party_invite`), hesap verisi dışa aktarma, oda anahtarlarını dosyaya dışa/içe aktarma.

## Zaten var
Mesaj gönder/düzenle/sil/ilet/sabitle, tepki, yanıt, anket, çıkartma ve paketleri, okundu bilgisi, yazıyor, varlık (presence), DM, davet/istek, katılma isteği (knock), üye davet/çıkar/yasakla/yetki, alanlar (okuma + katılma), keşif, oda önizleme, profil ad/avatar, cihazlar, SAS doğrulama, çapraz imza, kurtarma/yedek, OAuth ve cihazla giriş, Element Call, 1'e 1 arama, medya sıkıştırma.
