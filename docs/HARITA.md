# rubychat arayüz haritası (ajanlar için)

**Amaç:** bir göreve başlarken projeyi baştan okumak yerine BU dosyayı oku, sonra yalnızca görevde adı geçen ve aşağıdaki
haritada işine yarayan dosyaları aç. Rust tarafı için docs/MIMARI.md (yalnızca görev Rust'a dokunuyorsa). Katalog bölümü dosyaların
kendi baş yorumlarından üretildi; yeni dosya eklersen baş yorumunu yaz, katalog yeniden üretilir.

## Kurallar (CLAUDE.md'nin özü)
- Svelte 5 rune'ları, TypeScript strict, yeni npm paketi/crate YOK. Kod yorumu: önce İngilizce, sonra aynı anlamda Türkçe, "neden"i anlatır.
- Rust çağrısı YALNIZCA `src/lib/api/komutlar.ts` (invoke) ve `src/lib/api/olaylar.ts` (listen) üzerinden; tipler `src/lib/api/tipler.ts`.
- Metinler `t("anahtar")` (`src/lib/i18n/index.ts`). Yeni özellik kendi dosya çiftine yazar: `src/lib/i18n/tr-<ad>.ts` + `en-<ad>.ts`
  (örnek: `tr-alan.ts`), `tr.ts` / `en.ts` içinde `...trAd` olarak yayılır.
- Renk/süre/eğri yalnızca CSS değişkeni (`src/styles/tokens.css`): `--zemin --yuzey-1..3 --kenar --kenar-ince --yazi --yazi-2 --vurgu
  --vurgu-ustu --ton --ton-ustu --bekliyor --cozum --hata --kat-1 --kat-2 --sure-hizli/orta/yavas/menu/sayfa --egri-ac/giris/cikis`.
  Gradyan, blur, boşta duran animasyon YOK; animasyon yalnızca transform/opacity, "Animasyonları azalt"ta süreler 0 (`sureMs()` `src/lib/hareket.ts`).
- Dokunma hedefi ≥44px. Yükleme: 400 ms sonra `.parilti` iskeleti (global sınıf), dönen çember yalnız düğmenin kendi işi için.

## Hazır yapı taşları (yeniden YAZMA, kullan)
| İhtiyaç | Kullan |
|---|---|
| Alttan sayfa / pencere | `bilesenler/AltSayfa.svelte` (telefonda alt sayfa, geniş ekranda pencere) |
| Sağ tık / uzun bas menüsü | `bilesenler/BaglamMenusu.svelte` + `uzunBasma` eylemi (`src/lib/dokunma.ts`) |
| Onay sorusu | `bilesenler/SilOnay.svelte` (baslik/metin/eylem/tehlike props) |
| Anahtar (switch), seçici | `bilesenler/Anahtar.svelte`, `bilesenler/Secici.svelte` |
| Avatar, ikon | `bilesenler/Avatar.svelte` (harf + mxc), `bilesenler/Ikon.svelte` (ad → `src/lib/ikonlar/material.ts`) |
| Boş/hata hâli + maskot | `bilesenler/BosDurum.svelte`, `bilesenler/Maskot.svelte` (pozlar public/maskot) |
| Üye satırı, kullanıcı kartı | `bilesenler/UyeSatiri.svelte`, `bilesenler/KullaniciKarti.svelte` |
| Kısa bildirim (toast) | `bildirim.goster(metin, ms, { tur })` (`src/lib/durum/bildirim.svelte.ts`) |
| Titreşim | `titret("tik" / "dokunus")` (`src/lib/dokunma.ts`) |
| Android geri tuşu / katman | `gezinme.katmanAc(kapat)` (`src/lib/durum/gezinme.svelte.ts`); medya için `src/lib/medya/katman.ts` |
| Ekran genişliği, alt ekranlar | `gezinme.genis` (tablet/masaüstü), `gezinme.odaKapat()`, Ben alt ekranları `gezinme.benAlt` |
| Liste paneli gizle/göster | `duzen.listeGizli`, `duzen.degistir()` (`src/lib/durum/duzen.svelte.ts`) |
| Kalıcı tercih | `tercihler.d.<ad>`, `tercihler.yaz("ad", değer)` (`src/lib/durum/tercihler.svelte.ts`: tipe, VARSAYILAN'a ve boolean ise `oku()` listesine ekle) |
| Klavye kısayolu | komut tablosu `src/lib/klavyeKisayol.svelte.ts` (tek kaynak: çalıştırma + ipucu + yardım) |
| Mesaj gruplama | `src/lib/gruplama.ts` (`ayniGrup`, `GRUP_ARALIGI`) |
| Dış bağlantı | `src/lib/disAc.ts` (onaylı açma) |

## Sık görev → dosyalar
| Görev | Önce bunları aç |
|---|---|
| Oda ekranı / başlık / zaman çizelgesi | `ekranlar/Oda.svelte` (başlık `.tepe`/`header.ust`, stiller dosya sonunda), `bilesenler/MesajBalonu.svelte`, `durum/zaman.svelte.ts` |
| Yazma alanı, ekler, yapıştırma | `bilesenler/YazmaAlani.svelte`, `medya/MedyaAkisi.svelte` |
| Sohbet listesi, klasörler | `ekranlar/Sohbetler.svelte`, `bilesenler/SohbetSatiri.svelte`, `durum/odalar.svelte.ts` |
| Üyeler, yetkiler | `ekranlar/Uyeler.svelte`, `bilesenler/UyeSatiri.svelte`, `bilesenler/KullaniciKarti.svelte` |
| Alanlar | `ekranlar/AlanGorunumu.svelte`, `durum/alanlar.svelte.ts`, `bilesenler/AlanOdaOlustur.svelte`, `ekranlar/OdaAyarlari.svelte` |
| Ayarlar (Ben) | `ekranlar/Ben.svelte` + alt ekran dosyası (`Gorunum`, `SohbetAyarlari`, `KlavyeAyarlari`, `Guvenlik`...) |
| Uygulama iskeleti, katmanlar | `src/App.svelte`, `durum/gezinme.svelte.ts`, `bilesenler/Ray.svelte`, `bilesenler/AltDock.svelte` |
| Bildirimler, güncelleme | `durum/bildirimMerkezi.svelte.ts`, `bilesenler/Zil.svelte`, `durum/guncelleme.svelte.ts` |

## Dosya kataloğu

### `src/lib/ekranlar/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `AlanGorunumu.svelte` | 503 | One space: its child rooms and sub-spaces from the server's `/hierarchy` (so rooms I have NOT joined are listed too, with name, topic and | `adim, gomulu = false` |
| `Alanlar.svelte` | 80 | Spaces tab. Lists the spaces I have joined that are not inside another joined space (sub-spaces are reached through their parent); | `gomulu = false` |
| `Arama.svelte` | 157 | Call screen (design section 11). Phone: full screen. Tablet: a centred card inside the room column (the parent is `position: relative`). |  |
| `Ben.svelte` | 316 | "Me": account card, a settings list (Görünüm, noise suppression, Güvenlik with a status chip, logout) and the account details. |  |
| `BildirimAyarlari.svelte` | 92 | Ben › Bildirimler: the system permission (card + link to Android settings) and the in-app banner options (on/off, preview, vibration). |  |
| `Giris.svelte` | 166 | Login screen (design 22/11 and 22/12): the waving raccoon on a soft accent halo, "rubychat'e hoş geldin", username + password with |  |
| `Gorunum.svelte` | 275 | Görünüm (appearance) page: live preview, theme, AMOLED black, accent (rubyyard gems + a custom colour), font, text size, reduced motion. |  |
| `Guncellemeler.svelte` | 186 | Ben › Güncellemeler: installed version, manual check, automatic-check toggle, locked beta switch (while on prerelease), |  |
| `Guvenlik.svelte` | 230 | Ben › Güvenlik (design section 12d): device verification, recovery key, key backup and where the secrets are kept, as one status card. |  |
| `Hakkinda.svelte` | 80 | Ben › Hakkında: the mascot, version, licenses (AGPL app, OFL fonts, matrix-rust-sdk) and the source link. |  |
| `Hesap.svelte` | 213 | Ben › Hesap. What you can do depends on the server: |  |
| `Istekler.svelte` | 144 | "İstekler": one card per invitation (who invites, what the room is, decline / accept), the people waiting at the door of my rooms, |  |
| `Kayit.svelte` | 164 | In-app sign-up. OAuth (MAS) servers such as matrix.org only allow sign-up on their own account page, so the device login is started |  |
| `KlavyeAyarlari.svelte` | 90 | Ben › Klavye kısayolları (desktop only): main switch for Vim & modeless Ctrl shortcuts, hint strip switch (when main is on), |  |
| `Oda.svelte` | 986 | One open room: header (back, avatar, name, encryption chip, call button in 1:1 rooms), timeline and the composer. | `odaId` |
| `OdaAyarlari.svelte` | 668 | Shared settings screen for both rooms and spaces (full-screen sub-screen on phones, side panel on wide screens where OdaBilgisi opens). | `hedef` |
| `OdaBilgisi.svelte` | 145 | Room info (design 22/03 → tap on the room header): avatar, name, encryption chip with the small lock mascot, quick actions, and the rows |  |
| `ProfilDuzenle.svelte` | 135 | Ben › Profil: change my display name, change / remove my avatar (pick a photo → square crop → upload → set as avatar), see my mxid and |  |
| `SohbetAramasi.svelte` | 233 | Smart search of the chat list (results panel + the field at the bottom). On phones (`dock`) the field stays hidden and grows out of the |  |
| `SohbetAyarlari.svelte` | 86 | Ben › Sohbet: Enter ile gönder, bağlantı önizlemeleri (+ şifreli odalarda önizle), fotoğraf gönderim kalitesi. Every option here is read by real code |  |
| `Sohbetler.svelte` | 301 | Chat list: title, folder tabs (Telegram style; hide / reorder with the sliders button) over a swipeable pager with one page per folder. On phones |  |
| `TelefonlaGiris.svelte` | 122 | Sign in with the phone: QR to the account page + short code; the app waits until it is approved in a browser (matrix/cihaz_giris.rs). |  |
| `Uyeler.svelte` | 163 | Members screen (design 22/06): filter chips (Tümü / Yöneticiler / Davetli / Yasaklı), an invite row, and the list (swipe left = Çıkar / Yasakla |  |

### `src/lib/bilesenler/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `Acilis.svelte` | 30 | Cold-start splash: the raccoon settles in, the wordmark follows, and the whole page fades into the app. Transform/opacity only, each |  |
| `AlanOdaOlustur.svelte` | 203 | Create a room or sub-space inside a space (bottom sheet on phones, 480px dialog on wide screens via AltSayfa). |  |
| `AlanSatiri.svelte` | 94 | One row of the space screens: a joined room / space opens when tapped; a room that is not joined shows its name, topic and member |  |
| `AlanaOdaEkle.svelte` | 189 | Add existing rooms to a space (bottom sheet on phones, 480px dialog on wide screens via AltSayfa). |  |
| `AltDock.svelte` | 259 | Phone dock (Figma 24 | `gizli` |
| `AltSayfa.svelte` | 167 | Modal sheet: a bottom sheet on phones (24px top corners, rises 280ms with a slight spring, drag the handle down >=30% to close) |  |
| `Anahtar.svelte` | 25 | Switch (design section 3): 52x32 track inside a 52x44 hit area. Used by Ben and Görünüm. |  |
| `AnketKarti.svelte` | 112 | A poll inside a message bubble (MSC3381). Rules: | `oge` |
| `AnketOlustur.svelte` | 103 | "Anket oluştur" sheet (composer "+" menu): a question, 2 to 10 options (each can be removed once there are more than two), and two |  |
| `AramaCubugu.svelte` | 33 | Pinned green bar at the top of the app while a call runs in the background: "ayse ile görüşme |  |
| `Avatar.svelte` | 47 | Rounded-square avatar (sized in rem so it grows with the text size / Android font scale; the image request still uses px): | `harf, boyut = 48, mxc = null, yaricap: ozelYaricap` |
| `BaglamMenusu.svelte` | 146 | Context menu for a message (design section 8): opens at the touch point (scales 0.92 → 1 from there, 180ms), the message stays lit and |  |
| `BaglantiKarti.svelte` | 88 | Rich link card under a message. YouTube: 16:9 thumbnail with a play button, title + channel (oEmbed), tap plays INLINE (youtube-nocookie). | `b, sifreli = false` |
| `BaglantiOnay.svelte` | 89 | Link sheet (mounted once in App.svelte): the full address, the ways to open it, "always for this site", copy and share. |  |
| `Baslik.svelte` | 31 | Screen header: 56px, title on the left (or a back arrow + title on sub-pages), optional actions on the right. |  |
| `BicimDugum.svelte` | 92 | One node of the sanitized message HTML tree (see bicim/temizle.ts). Every allowed tag is written out here as normal Svelte markup, so | `d, odaId` |
| `BicimliMetin.svelte` | 20 | A received formatted message body (HTML) drawn safely: the HTML goes through the whitelist sanitizer (bicim/temizle.ts) and the resulting | `html, odaId` |
| `Bildirim.svelte` | 36 | Toast (design section 8): sits above the fixed bottom bars (--alt-yer), 4 s, Material snackbar: grows up from the bottom, fades out. |  |
| `BildirimPaneli.svelte` | 425 | Notification center panel (mounted once in App.svelte): |  |
| `BosDurum.svelte` | 38 | Empty / error state (design section 13): the raccoon mascot (pose per situation), a title, one sentence and at most one primary action. |  |
| `CikartmaGorsel.svelte` | 32 | A received / sent sticker: just the image, no bubble (the time sits in a small chip over its corner). Size is limited to 160px and keeps | `oge` |
| `DurumIkonu.svelte` | 37 | Per-message delivery status, 14px, next to the time (design section 9). The normal state is NOT worded: only an icon. | `durum, okundu = false` |
| `EmojiIzgara.svelte` | 26 | The seven SAS emojis (design section 12b): 4 + 3 in 72px boxes, each with its Turkish name. Fits a 375px screen without sideways scrolling. | `emojiler` |
| `EmojiPaneli.svelte` | 560 | Emoji / sticker / GIF picker body, used in two places: |  |
| `EmojiSayfasi.svelte` | 19 | Reaction picker: the emoji panel inside a bottom sheet (standard emoji only, one tap reacts). The composer uses the panel directly. |  |
| `EsitlemeSeridi.svelte` | 37 | Sync strip under a header, ONLY when there is a problem (design section 8): offline (yellow), connecting (grey), stopped (red + "Tekrar dene"), |  |
| `GifSecici.svelte` | 182 | GIF tab of the picker: KLIPY search (debounced 400 ms) and trending (empty search). Tapping a result SENDS ITS LINK as a normal text message |  |
| `GonderilemediSayfasi.svelte` | 28 | "This message could not be sent": asks what to do with it. A message that cannot be sent holds up everything written after it, so the |  |
| `GuncellemeSayfasi.svelte` | 561 | In-app update sheet (mounted once in App.svelte, independent of login state). |  |
| `GuvenlikSatiri.svelte` | 49 | One row of the Security card / setup sheet (design section 12d): a status icon (green tick / yellow warning / grey info), title, short help, |  |
| `HesapListesi.svelte` | 51 | The other signed-in accounts as rows (one tap switches) and "Hesap ekle". The one in use is the profile card above, so it is not repeated. |  |
| `HizliGecis.svelte` | 46 | Popup of the quick switcher (see durum/hizliGecis.svelte.ts): pinned chats, or the most recent ones while nothing is pinned. |  |
| `Ikon.svelte` | 109 | Inline SVG icon set (24 viewBox, stroke currentColor, width 2). Paths copied from rubyyard's ikon.ejs. | `ad, boyut = 24, dolu = false` |
| `IletSayfasi.svelte` | 115 | "İlet" sheet: pick the room a message is forwarded to (joined chats, not spaces, not the current one), with a search box. Choosing a |  |
| `IstekKatmani.svelte` | 63 | Requests layer: the full-screen "İstekler" page (incoming invitations, people asking to enter my rooms, my own pending requests) |  |
| `KareKirp.svelte` | 183 | Square crop sheet: drag to move, slider to zoom, then "Kırp" exports a square image. Used for the avatar (JPEG/WebP, 512px, plain square) and for |  |
| `KisayolIpucu.svelte` | 130 | Thin one-line shortcut hint + Vim mode strip right under the composer while a message is selected. | `oge` |
| `KlasorSekmeleri.svelte` | 90 | Folder tabs of the chat list (Telegram style): a horizontally scrolling strip. The tinted pill behind the selected tab is ONE element that |  |
| `KlavyeDurum.svelte` | 363 | Compact Vim mode indicator (NORMAL / ARA / KOMUT), count prefix, pending leader ("g…") and the ":" mini command line. |  |
| `KlavyeListesi.svelte` | 315 | Grouped, searchable shortcut list driven by YARDIM_GRUPLARI / YARDIM_OGELERI. | `otoOdak = false` |
| `KlavyeYardim.svelte` | 11 | Keyboard shortcut help (? or Ctrl+/) |  |
| `KullaniciKarti.svelte` | 187 | The user card (design 22/07), mounted ONCE in App.svelte and opened from anywhere with `kullaniciKartiAc(kullaniciId, odaId?)`: |  |
| `KurulumRaporu.svelte` | 415 | Setup report modal (mounted in App.svelte outside session gating so it works right after the first-run tour too). |  |
| `Maskot.svelte` | 26 | The raccoon mascot (design 22/13). `poz` picks the pose: selam (welcome, empty chat list), yukleniyor (cold start / first sync), | `poz, boyut = 120, hale = false` |
| `MesajBalonu.svelte` | 388 | One message bubble (design section 6): others on the left (surface-2), own on the right (tone). Same sender within 5 min = a group: |  |
| `OdaKesfet.svelte` | 592 | "Odaları keşfet" sheet: a server's public room directory (`odalari_kesfet`), searchable, with Rooms / Spaces filter, a server |  |
| `OdaOlustur.svelte` | 61 | "Grup oluştur" / "Alan oluştur" / "Adresle odaya katıl" sheet: one field, one button. |  |
| `OdaPaleti.svelte` | 1006 | Ctrl+Space: multi-mode room, message and command palette with an optional side preview panel. |  |
| `OdaSeridi.svelte` | 61 | Compact window: one narrow strip takes the place of rail + list. Top: the list drawer; middle: chats as avatars; bottom: Alanlar and Ben. |  |
| `OkuyanAvatarlar.svelte` | 28 | Tiny avatars of the people whose latest read receipt is on this message (small group rooms only; the backend sends none for big rooms or |  |
| `OkuyanListesi.svelte` | 28 | Sheet listing who has read up to a message (opened from the tiny read avatars). Tapping a person opens their user card. |  |
| `OzellestirSayfasi.svelte` | 101 | Chat look sheet, like WhatsApp: scope, a tall live preview, wallpaper tiles (solid colours + own photo), dimming and message text size. |  |
| `Ray.svelte` | 83 | Side rail: the same destinations as the phone bottom menu. | `kompakt = false` |
| `SabitCubugu.svelte` | 65 | Pinned-messages bar at the top of a room (only when something is pinned). Shows the current pinned message (name + one line); tapping it jumps | `odaId, idler` |
| `Sayfalayici.svelte` | 110 | Horizontal pager on native scroll-snap: the page follows the finger 1:1, flicks, and never drops frames because the browser scrolls it. |  |
| `Secici.svelte` | 22 | Segmented selector (design section 3: "Sistem |  |
| `SifrelemeKatmani.svelte` | 302 | All encryption sheets in one place (opened through `sifreleme.katman`): |  |
| `SilOnay.svelte` | 46 | "Bu mesaj silinsin mi?" confirm sheet. Deleting is not undoable, so it asks once: Vazgeç / Sil (red). The deletion itself is the |  |
| `SohbetSatiri.svelte` | 82 | One 72px row in the chat list (design section 5). States: unread (bold name + preview, accent time, count badge), mention ("@" badge), |  |
| `SohbetZemini.svelte` | 32 | The chat wallpaper: an own photo (this device only) under a dimming layer. Solid colours come from --sohbet-zemin, so this renders nothing then. | `resim, resimAnahtari, karart` |
| `TepkiCubugu.svelte` | 28 | Quick reaction bar shown above the message context menu (❤️ 😂 👍 😮 😢 🙏 and "+" for the full emoji picker). The reactions I already |  |
| `TepkiKimler.svelte` | 47 | "Who reacted" sheet (opened by a long press on a reaction chip): the chips of the message as tabs-in-a-list, each group with the people |  |
| `TepkiMenusu.svelte` | 97 | Quick reaction popover opened from the keyboard (Ctrl+T): reuses TepkiCubugu inside a lightweight dialog layer. |  |
| `TepkiSatiri.svelte` | 55 | Reactions under a message: one chip per emoji with its count; mine are tinted (tonal + accent border). Tap = toggle my reaction, |  |
| `Tur.svelte` | 398 | First-run onboarding tour (6 cards explaining Matrix). Shown once on a clean install before Giris, and replayable from Ben › About rubychat. |  |
| `UstBildirim.svelte` | 295 | In-app heads-up banner for incoming messages and update alerts. |  |
| `UyeSatiri.svelte` | 116 | One member row (design 22/06): avatar, name, mxid, role pill. Swipe LEFT reveals "Çıkar" / "Yasakla" (only the ones my power allows: the |  |
| `VarlikRozeti.svelte` | 43 | Presence line for the other person of a DM ("çevrimiçi" / "son görülme ..."): asked from the server once when the room opens. Many servers | `kullaniciId` |
| `YanitAlintisi.svelte` | 34 | The quote at the top of a reply bubble: the replied-to person's name (accent), one line of their text and a thin accent bar on the left. |  |
| `YanitOnizleme.svelte` | 32 | The strip above the composer while replying ("<ad> kişisine yanıt") or editing ("Mesajı düzenle"): a short preview of the message and a ✕ |  |
| `YasaklaPenceresi.svelte` | 75 | Ban dialog (design 22/08): avatar, "<ad> yasaklansın mı?", optional reason, a toggle "Son 24 saatteki mesajlarını sil", Vazgeç (left) / |  |
| `YaziyorSatiri.svelte` | 36 | "X yazıyor…" line above the composer: one name, two names or "N kişi yazıyor…". It takes no room while nobody types (the row is not rendered), | `kisiler` |
| `YazmaAlani.svelte` | 707 | Composer bar: one floating pill (emoji / keyboard |  |
| `YeniSohbet.svelte` | 170 | "Yeni sohbet" sheet. Type a name, a username or a full Matrix id: the server's user directory is searched as you type |  |
| `Zil.svelte` | 131 | Notification center bell button (44px round target, sits left of the settings sliders button in Sohbetler). |  |

### `src/lib/durum/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `alanlar.svelte.ts` | 109 | Navigation inside the "Alanlar" tab: a stack of the spaces the user opened (a space can hold sub-spaces). Every level is a back-button |  |
| `arama.svelte.ts` | 380 | 1:1 voice call state machine: bos → ariyor/caliyor → baglaniyor → bagli → bitti (→ bos). |  |
| `ayarlar.svelte.ts` | 197 | Local settings (per device), persisted in localStorage. Storage can be blocked, so every access is wrapped. |  |
| `baglantiOnay.svelte.ts` | 49 | Links in messages. A tap opens at once, the way the site's rule / the general choice says; the sheet (BaglantiOnay) appears when the choice |  |
| `baglantiTercihi.svelte.ts` | 53 | How web links open (device only): one general choice + a rule per site ("sekme" = tab inside the app, "tarayici" = the browser app, else a package nam |  |
| `bildirim.svelte.ts` | 33 | Tiny toast store. A toast has an optional kind (icon) and an optional action button ("Yeniden dene"). |  |
| `bildirimMerkezi.svelte.ts` | 180 | Notification center store (bell): keeps up to 50 newest-first items across messages, mentions, invites, updates and setup checks. |  |
| `duzen.svelte.ts` | 58 | Desktop layout: is the window compact, is the list hidden, is the compact list drawer open. |  |
| `gezinme.svelte.ts` | 333 | Navigation state: which tab and which room are open, the screen SHAPE (phone / landscape phone / tablet), and the LAYER STACK |  |
| `guncelleme.svelte.ts` | 312 | In-app update store: checks GitHub Releases, handles Android unknown-sources permission and return resume, |  |
| `hizliGecis.svelte.ts` | 136 | Quick switcher: hold a search button, slide over the popup, release on a chat. `hizliGecis` is the action for such a button; HizliGecis.svelte |  |
| `istekler.svelte.ts` | 55 | Invitations and join requests (the "İstekler" screen). The numbers follow the room list, so a new invitation shows up by itself. |  |
| `kabuk.svelte.ts` | 47 | Shell state shared by the floating bottom dock and the chat-list search pill: they hide when the user scrolls down and come back when |  |
| `kullaniciKarti.svelte.ts` | 21 | The one place that opens the user card: `kullaniciKartiAc(kullaniciId, odaId?)` from ANY avatar / name / result row. |  |
| `kurulum.svelte.ts` | 328 | Setup diagnostics report store and onboarding tour replay toggle. |  |
| `medya.svelte.ts` | 262 | Media sending queue: prepares each chosen item (image re-encode, video transcode, thumbnail), uploads it to the Rust cache and |  |
| `odalar.svelte.ts` | 157 | Room list state: filled by the "odalar-guncellendi" event, filtered locally (all filtering uses fields the backend already sends). |  |
| `onYukle.svelte.ts` | 169 | Decides which rooms are kept warm. Score = how often and how recently the user visits (halves every 5 days) + unread / mention / pinned. |  |
| `oturum.svelte.ts` | 186 | Session state (Svelte 5 runes). Single source of truth for "who is logged in". |  |
| `rubychatAlan.ts` | 23 | Single source of truth for the official rubychat community Matrix space (used in Explore and Ben › About). |  |
| `sifreleme.svelte.ts` | 234 | End-to-end encryption UI state (Svelte 5 runes): verification, recovery key, cross-signing password, which sheet is open. |  |
| `sohbetChipleri.svelte.ts` | 101 | The filter chips above the chat list: the user can hide and reorder them (the "+" chip opens the editor). "Tümü" always stays, first. |  |
| `sohbetGorunum.svelte.ts` | 102 | Chat look, like WhatsApp: a wallpaper (solid colour or an own photo + dimming) and the message text size. |  |
| `sonAramalar.ts` | 38 | Last searches of the chat-list search (device only, newest first, at most 8). |  |
| `tercihler.svelte.ts` | 109 | Device preferences that are not "appearance" (those live in ayarlar.svelte.ts): chat, notifications, haptics, link previews, photo quality. |  |
| `ustBildirim.svelte.ts` | 63 | The in-app banner (UstBildirim.svelte): one at a time, supporting both incoming messages and update alerts. |  |
| `uyeler.svelte.ts` | 85 | Member lists and my permissions, cached per room (members screen, user card and ban dialog share it). The backend does the real checks; |  |
| `yazma.svelte.ts` | 24 | What the composer is doing with a message: replying to one, or editing one. Shared between the room screen (context menu, swipe) |  |
| `zaman.svelte.ts` | 191 | Open-room timeline state. Backend sends the FULL item list on every change (simple and robust); `paylas` keeps unchanged items. |  |
| `zeminResmi.ts` | 72 | Custom chat backgrounds picked from the device. Matrix has no such thing and the picture is personal, so it is NEVER uploaded: the |  |

### `src/lib/medya/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `Goruntuleyici.svelte` | 423 | Full-screen media viewer (design 10-medya, part 4). Photos: pinch to zoom, double tap = 2x, drag to pan when zoomed, swipe left / right |  |
| `IlerlemeHalkasi.svelte` | 73 | Round progress ring with a cancel cross in the middle (design 10-medya, part 5). `oran` null = unknown (slow spin). |  |
| `KameraCekim.svelte` | 479 | Desktop in-app camera capture dialog (photo only, no video recording): live getUserMedia preview (mirrored only in preview), |  |
| `MedyaAkisi.svelte` | 1322 | Full-screen media flow (design 10-medya): pick (gallery / camera / file) → preview + edit (crop, rotate, flip, quality with a size |  |
| `MedyaBekleyenler.svelte` | 117 | Our own media messages that are still being prepared (compressing / copying), drawn as right-aligned bubbles at the end of the room's | `odaId` |
| `MedyaIcerik.svelte` | 243 | The inside of a media bubble (designs 06 + 10): an image box (thumbnail first, full image in the viewer), a video poster with a play | `oge` |
| `isleme.ts` | 166 | Image and video preparation in the WebView (no packages): decode, crop / rotate / flip on a canvas, downscale, re-encode, thumbnails, |  |
| `katman.ts` | 28 | Back-button layers for the media screens (crop screen → media flow → viewer). A thin adapter over the app's single layer stack |  |
| `metin.ts` | 146 | Turkish texts of the media screens. Kept in one small local dictionary (like i18n/tr.ts) so the media work does not edit the |  |
| `url.ts` | 8 | URLs of the Rust `medya` scheme for message media: `medya://localhost/m/<id>` (Android/Windows: `http://medya.localhost/m/<id>`). |  |
| `video.ts` | 89 | Video helpers in the WebView: read metadata, draw frame thumbnails for the trim strip, grab a poster frame, estimate sizes. |  |

### `src/lib/arama-mesaj/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `MesajAramaSonuclari.svelte` | 109 | Message search results for a query (and an optional room). Self-contained: give it `sorgu`, it debounces, searches, shows the list |  |
| `OdaAramasi.svelte` | 64 | In-room search jump logic (no UI of its own any more: the search bar is OdaIciArama.svelte, shown in place of the composer). | `odaId` |
| `OdaIciArama.svelte` | 240 | In-chat search bar (design 22/04): replaces the composer. Shows "3/17" with ˄ ˅ to step between matches (the current bubble is outlined and |  |
| `atla.ts` | 43 | "Jump to a message in the open room": the same steps the search result jump uses (find the row, else load history until the event is in |  |
| `durum.svelte.ts` | 97 | Message search state: one `MesajAramasi` per search box (debounce + stale-response guard) and one shared `atlama` (jump to a result). |  |
| `vurgula.ts` | 43 | Scroll a message row into the middle of the timeline and flash it using an opacity-only overlay so the user sees which message matched. |  |

### `src/lib/arama-ec/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `EcCubuk.svelte` | 36 | Green bar at the top of the app while an Element Call call runs minimised: "ayse ile görüşme |  |
| `EcKatilSeridi.svelte` | 56 | "Katıl" strip, in the page flow (it pushes the content down, nothing overlaps): a DM call somebody started rings here wherever you are |  |
| `EcKatman.svelte` | 82 | Full-screen call layer: Element Call in an <iframe> under a slim header with the minimise button. Back (Android) / Escape / the chevron |  |
| `YerelArama.svelte` | 241 | Native call screen (Figma page 25): people as tiles, a shared screen as the stage, one dock, and a "Sesler" panel where the listener turns |  |
| `YerelVideo.svelte` | 112 | Picture of a native call: pulls the newest frame from Rust (raw I420) and draws it with WebGL. Independent of requestAnimationFrame, and | `anahtar` |
| `ec.svelte.ts` | 423 | Calls through Element Call (EC), the way Element X does it: EC runs in an <iframe> (EcKatman.svelte), the Rust `WidgetDriver` answers |  |
| `ses.ts` | 52 | Android side of a call: audio mode + audio focus, the microphone foreground service and output routing, through the Kotlin bridge |  |
| `tipler.ts` | 72 | Types of the Element Call (EC) bridge. They mirror src-tauri/src/matrix/ec.rs (serde camelCase). |  |

### `src/lib/api/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `komutlar.ts` | 275 | The ONLY place that calls invoke(). Every Rust command gets one typed wrapper here. |  |
| `olaylar.ts` | 67 | The ONLY place that calls listen(). Each backend event gets a typed subscription that returns an unsubscribe function. |  |
| `tipler.ts` | 682 | TypeScript types mirroring the Rust DTOs EXACTLY (serde rename_all = "camelCase"). |  |

### `src/lib/`

| Dosya | Satır | Ne yapar | Props |
|---|---|---|---|
| `alt-yer.ts` | 56 | Measures the total height of fixed bottom bars ([data-alt-cubuk]) and writes it to --alt-yer, |  |
| `bildirim-sistem.ts` | 94 | System notifications, UI side: permission helpers, the "tapped a notification" route, the foreground / background report and the |  |
| `ciftDokun.ts` | 31 | Double tap on a message: two taps within 280ms, at most 24px apart. Links, buttons and media inside the message keep their own tap. |  |
| `disAc.ts` | 57 | Opening a web address. On Android the native bridge (RubyBaglanti, MainActivity.kt) does it: a browser tab inside the app (Custom Tab, the |  |
| `dokunma.ts` | 186 | The tactile layer: ONE mechanism for every tappable thing (design 22/10), installed once with `dokunmaBaslat()`. |  |
| `gecis.ts` | 128 | Screen transition for the room (and Ben sub-pages): the whole page slides in from the right edge, going back is the reverse (the page |  |
| `geriKaydir.ts` | 136 | Swipe right anywhere to go back: the page follows the finger 1:1, the page under it (`altta`) comes along from -25%, and on release it |  |
| `gruplama.ts` | 17 | One grouping rule for every message list (room timeline, palette preview), so the same conversation never looks different |  |
| `hareket.ts` | 25 | Motion tokens read from JS. The CSS minifier of the release build rewrites `280ms` as `.28s`, so a bare parseFloat() gave 0.28 ms and |  |
| `kaydirYanit.ts` | 87 | Swipe-left-to-reply (right is "go back", see geriKaydir): a Svelte action for a message row. A leftward drag of 48px (mostly horizontal) fires `ac`; t |  |
| `klavye.ts` | 111 | Keeps the app exactly as tall as the visible area, so the composer stays above the on-screen keyboard. |  |
| `klavyeKisayol.svelte.ts` | 1391 | Desktop Vim + modeless Ctrl keyboard shortcuts: one command table drives dispatch, hint strip, help sheet and settings. |  |
| `medya.ts` | 27 | Builds URLs for the Rust `medya` URI scheme (Matrix avatar thumbnails). |  |
| `pano.ts` | 20 | The clipboard. Desktop Linux goes through GTK (masaustu_linux.rs), the rest through the webview. |  |
| `paylas.ts` | 39 | Structural sharing for lists the backend re-sends whole (room list, timeline). Every update arrives as fresh objects, so Svelte would |  |
| `qr.ts` | 187 | Small QR code maker (byte mode, error level M, versions 1-10 = up to 213 bytes): enough for a web address, without a package. |  |
| `zaman-bicim.ts` | 46 | Small date/time formatting helpers (locale follows the app language). |  |
