//! DTOs sent to the UI. They mirror `src/lib/api/tipler.ts` EXACTLY (camelCase). Change both together.
//! Arayüze giden veri yapıları. `src/lib/api/tipler.ts` ile BİREBİR aynıdır (camelCase). İkisini birlikte değiştir.

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Ben {
    pub kullanici_id: String,
    pub cihaz_id: String,
    pub gorunen_ad: Option<String>,
    /// mxc:// of our own avatar (fetched by the `ben` command) · kendi avatarımızın mxc:// adresi (`ben` komutu alır)
    pub avatar_mxc: Option<String>,
    pub sunucu: String,
    /// Where the session secrets live: "anahtarlik" (OS keyring), "android_kasa" (Android Keystore) or "dosya" (plain file fallback).
    /// Oturum gizli bilgilerinin yeri: "anahtarlik" (işletim sistemi), "android_kasa" (Android Keystore) ya da "dosya" (düz dosya yedeği).
    pub gizli_depo: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OdaOzeti {
    pub id: String,
    pub ad: String,
    pub avatar_harf: String,
    /// `mxc://` URI of the room avatar (for DMs: the other person's avatar). The UI turns it into a `medya` URL.
    /// Oda avatarının `mxc://` adresi (DM'de karşıdaki kişinin avatarı). Arayüz bunu `medya` adresine çevirir.
    pub avatar_mxc: Option<String>,
    pub son_mesaj: Option<String>,
    /// Milliseconds since the Unix epoch · Unix epoch'tan beri milisaniye
    pub son_zaman: Option<u64>,
    pub okunmamis: u64,
    pub bahsedilme: u64,
    pub sifreli: bool,
    pub dm: bool,
    pub davet: bool,
    /// The room is a space (`m.space`): it has no message timeline, so the UI shows it under "Alanlar" and never opens it as a chat.
    /// Oda bir alan (`m.space`): mesaj çizelgesi yoktur; arayüz onu "Alanlar"da gösterir, asla sohbet olarak açmaz.
    pub alan: bool,
    /// Pinned (`m.favourite` tag) · Sabitli (`m.favourite` etiketi)
    pub sabit: bool,
}

/// A room in the requests screen · İstekler ekranındaki bir oda
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IstekOdasi {
    pub id: String,
    pub ad: String,
    pub avatar_harf: String,
    pub avatar_mxc: Option<String>,
    pub konu: Option<String>,
    pub uye_sayisi: u64,
    pub alan: bool,
    pub sifreli: bool,
    pub dm: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DavetOgesi {
    pub oda: IstekOdasi,
    pub davet_eden: Option<KisiBilgisi>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OdaIstekleri {
    pub oda: IstekOdasi,
    pub kisiler: Vec<KisiBilgisi>,
}

/// Invitations for me, my own join requests, and people asking to enter my rooms.
/// Bana gelen davetler, kendi katılma isteklerim ve odalarıma girmek isteyenler.
#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Istekler {
    pub gelen: Vec<DavetOgesi>,
    pub giden: Vec<IstekOdasi>,
    pub odalar: Vec<OdaIstekleri>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EsitlemeDurumuAdi {
    Basliyor,
    Calisiyor,
    Hata,
    Cevrimdisi,
    /// The server rejected this device's session for good (signed out elsewhere, revoked). Not a network problem: sync stops.
    /// Sunucu bu cihazın oturumunu kesin reddetti (başka yerden kapatıldı, iptal edildi). Ağ sorunu değil: eşitleme durur.
    OturumKapali,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EsitlemeDurumu {
    pub durum: EsitlemeDurumuAdi,
    pub mesaj: Option<String>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ZamanTuru {
    Metin,
    Resim,
    /// Video message · Video mesajı
    Video,
    /// File / audio shown as a file card · Dosya kartı olarak gösterilen dosya / ses
    Dosya,
    SifreCozulemedi,
    Diger,
    TarihAyirici,
    /// "New messages" marker (the SDK's fully-read marker) · "Yeni mesajlar" işareti (SDK'nın okundu işareti)
    OkunmamisAyirici,
    /// A call (m.call.invite) shown as a system line · Sistem satırı olarak gösterilen arama (m.call.invite)
    Arama,
    /// A deleted (redacted) message: "Bu mesaj silindi" · Silinmiş (redact edilmiş) mesaj: "Bu mesaj silindi"
    Silindi,
    /// An `m.sticker` event: just the image, no bubble · `m.sticker` olayı: yalnızca resim, balon yok
    Cikartma,
    /// A poll (`m.poll.start`, MSC3381 unstable form) · Anket (`m.poll.start`, MSC3381 kararsız biçim)
    Anket,
}

/// How a call ended, as far as we know. `bilinmiyor` = we never saw its answer/hangup events (old history).
/// Bir aramanın nasıl bittiği (bildiğimiz kadarıyla). `bilinmiyor` = cevap/kapatma olaylarını hiç görmedik (eski geçmiş).
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AramaSonucu {
    Yapildi,
    Cevapsiz,
    Reddedildi,
    Bilinmiyor,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AramaSatiri {
    pub sonuc: AramaSonucu,
    /// Talk time in seconds when known · Biliniyorsa konuşma süresi (saniye)
    pub sure_sn: Option<u64>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GonderimDurumu {
    Gonderiliyor,
    Gonderildi,
    /// No connection: will be retried by itself · Bağlantı yok: kendiliğinden yeniden denenecek
    Bekliyor,
    Hata,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ZamanOgesi {
    pub id: String,
    pub gonderen: String,
    pub gonderen_ad: String,
    pub kendi: bool,
    /// Milliseconds since the Unix epoch · Unix epoch'tan beri milisaniye
    pub zaman: u64,
    pub tur: ZamanTuru,
    pub metin: Option<String>,
    pub durum: GonderimDurumu,
    /// Sender avatar `mxc://` · Gönderenin avatarı (`mxc://`)
    pub gonderen_avatar_mxc: Option<String>,
    /// Set when `tur == Arama` · `tur == Arama` iken dolu
    pub arama: Option<AramaSatiri>,
    /// Set for image / video / file messages (`metin` then holds the caption, if any).
    /// Resim / video / dosya mesajlarında dolu (`metin` bu durumda varsa açıklamayı taşır).
    pub medya: Option<MedyaBilgisi>,
    /// Matrix event id of a real (remote) event; `None` for local echoes and virtual rows. Message search jumps to it
    /// (`id` above is the SDK's unique id, which is NOT the event id).
    /// Gerçek (uzak) olayın Matrix olay kimliği; yerel yankı ve sanal satırlarda `None`. Mesaj araması buna atlar
    /// (yukarıdaki `id` SDK'nın benzersiz kimliğidir, olay kimliği DEĞİL).
    pub olay_id: Option<String>,
    /// Raw `formatted_body` (HTML) of a text / notice / emote message; the UI sanitizes it before drawing.
    /// Metin / bildirim / emote mesajının ham `formatted_body`si (HTML); arayüz çizmeden önce temizler.
    pub html: Option<String>,
    /// The message was edited ("düzenlendi") · Mesaj düzenlendi ("düzenlendi")
    pub duzenlendi: bool,
    pub tepkiler: Vec<Tepki>,
    /// The message this one replies to · Bu mesajın yanıtladığı mesaj
    pub yanit: Option<YanitBilgisi>,
    /// People whose latest read receipt is on this message (small rooms only; never me)
    /// Son okundu bilgisi bu mesajda olan kişiler (yalnızca küçük odalar; ben asla)
    pub okuyanlar: Vec<KisiBilgisi>,
    /// Set when `tur == Anket` · `tur == Anket` iken dolu
    pub anket: Option<AnketBilgisi>,
    /// I may delete it (own message, or others' when my power level allows) · Silebilirim (kendi mesajım, ya da yetkim varsa başkalarınınki)
    pub silinebilir: bool,
    /// It is in the room's pinned list · Odanın sabit listesinde
    pub sabit: bool,
    /// It can be edited (own text message) · Düzenlenebilir (kendi metin mesajım)
    pub duzenlenebilir: bool,
}

/// One person (reactor, reader, typer) · Bir kişi (tepki veren, okuyan, yazan)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KisiBilgisi {
    pub id: String,
    pub ad: String,
    pub avatar_mxc: Option<String>,
}

/// One reaction key under a message, aggregated · Bir mesajın altındaki toplanmış tek tepki anahtarı
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Tepki {
    /// The emoji (or an `mxc://` URI for a custom-emoji reaction) · Emoji (özel emoji tepkisinde `mxc://` adresi)
    pub anahtar: String,
    pub sayi: u32,
    /// I reacted with it · Ben bu tepkiyi verdim
    pub benim: bool,
    pub kisiler: Vec<KisiBilgisi>,
}

/// The quote of a reply. `yukleniyor`: the SDK has not fetched the replied-to event yet. · Yanıtın alıntısı. `yukleniyor`: SDK yanıtlanan olayı henüz getirmedi.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YanitBilgisi {
    pub olay_id: String,
    pub gonderen: Option<String>,
    pub gonderen_ad: Option<String>,
    pub metin: Option<String>,
    pub yukleniyor: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnketSecenegi {
    pub id: String,
    pub metin: String,
    pub oy: u32,
    pub benim: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnketBilgisi {
    pub soru: String,
    pub secenekler: Vec<AnketSecenegi>,
    pub toplam_oy: u32,
    /// The poll was ended · Anket bitirildi
    pub bitti: bool,
    /// `m.disclosed`: results are visible while voting · `m.disclosed`: oy verirken sonuçlar görünür
    pub acik: bool,
    pub maks_secim: u32,
    /// I created it (so I may end it) · Ben oluşturdum (bitirebilirim)
    pub benim_anketim: bool,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MedyaTuru {
    Resim,
    Video,
    Dosya,
}

/// Upload progress of a local echo, in bytes (the SDK counts encrypted bytes, so `toplam` can differ a little from the file size).
/// Yerel yankının yükleme ilerlemesi (bayt); SDK şifreli baytları sayar, bu yüzden `toplam` dosya boyutundan biraz farklı olabilir.
#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MedyaIlerleme {
    pub gecerli: u64,
    pub toplam: u64,
}

/// Everything the UI needs to draw a media message. `kaynakId` / `kucukId` are keys for the `medya` URI scheme
/// (see `medya.rs`: `medya://localhost/m/<id>`), because encrypted media cannot be addressed by a plain mxc URL.
/// Arayüzün bir medya mesajını çizmek için ihtiyacı olan her şey. `kaynakId` / `kucukId`, `medya` URI şemasının
/// anahtarlarıdır (bkz. `medya.rs`: `medya://localhost/m/<id>`); şifreli medya düz mxc adresiyle sunulamaz.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MedyaBilgisi {
    pub tur: MedyaTuru,
    pub kaynak_id: String,
    pub kucuk_id: Option<String>,
    pub genislik: Option<u32>,
    pub yukseklik: Option<u32>,
    pub sure_ms: Option<u64>,
    pub boyut: Option<u64>,
    pub dosya_adi: String,
    pub mime: Option<String>,
    /// Some(..) while this is our own message still being uploaded · Kendi mesajımız hâlâ yüklenirken dolu
    pub ilerleme: Option<MedyaIlerleme>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OdaBilgisi {
    pub id: String,
    pub ad: String,
    pub avatar_harf: String,
    pub sifreli: bool,
    pub uye_sayisi: u64,
    pub avatar_mxc: Option<String>,
    /// In a 2-member room: the other person's user id (callable). Otherwise None.
    /// 2 üyeli odada: karşıdaki kişinin kimliği (aranabilir). Değilse None.
    pub karsi_kullanici: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ZamanGuncelleme {
    pub oda_id: String,
    pub ogeler: Vec<ZamanOgesi>,
    /// True when the start of the room history was reached · Odanın geçmişinin başına ulaşıldıysa true
    pub basa_ulasildi: bool,
    /// Event ids in the room's `m.room.pinned_events` · Odanın `m.room.pinned_events` listesindeki olay kimlikleri
    pub sabitler: Vec<String>,
    /// May I pin / unpin here? · Burada sabitleyebilir / kaldırabilir miyim?
    pub sabitleyebilir: bool,
}

/// A preloaded room (event `zaman-hazir`) · Ön yüklenmiş oda (`zaman-hazir` olayı)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ZamanHazir {
    pub bilgi: OdaBilgisi,
    pub zaman: ZamanGuncelleme,
}

/// Who is typing in a room right now (me excluded) · Bir odada şu an kimler yazıyor (ben hariç)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YaziyorGuncelleme {
    pub oda_id: String,
    pub kisiler: Vec<KisiBilgisi>,
}

/// A pinned message as the pinned bar shows it · Sabit çubuğunun gösterdiği sabit mesaj
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SabitMesaj {
    pub olay_id: String,
    pub gonderen_ad: Option<String>,
    pub metin: Option<String>,
}

/// UI → Rust: send a text message, optionally as a reply, with an HTML body and/or mentions (`m.mentions`).
/// Arayüzden Rust'a: metin mesajı gönder; isteğe bağlı olarak yanıt, HTML gövde ve/veya bahsetme (`m.mentions`) ile.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MesajGonderIstegi {
    pub oda_id: String,
    pub metin: String,
    pub html: Option<String>,
    pub yanit_olay_id: Option<String>,
    /// Mentioned Matrix user ids in order of appearance · Mesajdaki görünme sırasıyla bahsedilen Matrix kullanıcı kimlikleri
    #[serde(default)]
    pub bahsedilenler: Vec<String>,
    /// Notify the whole room (`@room`) · Tüm odayı bildir (`@room`)
    #[serde(default)]
    pub oda_bahset: bool,
}

/// UI → Rust: create a poll · Arayüzden Rust'a: anket oluştur
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnketIstegi {
    pub oda_id: String,
    pub soru: String,
    pub secenekler: Vec<String>,
    /// true = `m.disclosed` (results visible while voting) · true = `m.disclosed` (oy verirken sonuçlar görünür)
    pub acik: bool,
    pub coklu: bool,
}

/// UI → Rust: send a sticker from an image pack · Arayüzden Rust'a: görsel paketinden çıkartma gönder
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CikartmaIstegi {
    pub oda_id: String,
    pub mxc: String,
    pub metin: String,
    pub genislik: Option<u32>,
    pub yukseklik: Option<u32>,
    pub mime: Option<String>,
    /// Replied-to event · Yanıtlanan olay
    #[serde(default)]
    pub yanit_olay_id: Option<String>,
}

/// One image of an MSC2545 pack · MSC2545 paketinin tek görseli
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PaketGorseli {
    pub kisa_kod: String,
    pub mxc: String,
    pub metin: String,
    pub genislik: Option<u32>,
    pub yukseklik: Option<u32>,
    pub mime: Option<String>,
    /// May be used as inline custom emoji / as a sticker (pack or image `usage`) · Satır içi özel emoji / çıkartma olarak kullanılabilir
    pub emoji: bool,
    pub cikartma: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GorselPaketi {
    /// "oda" (room pack), "kullanici" (my own pack) or "baska_oda" (a room pack I enabled in `emote_rooms`)
    /// "oda" (oda paketi), "kullanici" (kendi paketim) ya da "baska_oda" (`emote_rooms`ta açtığım oda paketi)
    pub kaynak: String,
    pub ad: String,
    pub avatar_mxc: Option<String>,
    pub gorseller: Vec<PaketGorseli>,
}

/// A child of a space, or the space itself · Bir alanın çocuğu ya da alanın kendisi
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlanOgesi {
    pub id: String,
    pub ad: String,
    pub avatar_harf: String,
    pub avatar_mxc: Option<String>,
    pub konu: Option<String>,
    pub uye_sayisi: u64,
    /// It is itself a space (can be opened as a space view) · Kendisi bir alan (alan görünümü olarak açılabilir)
    pub alan: bool,
    /// How many children it has (spaces only) · Kaç çocuğu var (yalnızca alanlar)
    pub alt_sayisi: u64,
    /// I am joined (opens normally); otherwise the "Katıl" button shows · Katılmışım (normal açılır); değilse "Katıl" düğmesi çıkar
    pub katildi: bool,
    pub dm: bool,
    pub onerilen: bool,
    /// Homeserver names to join through (the `via` of the `m.space.child` event) · Katılırken kullanılacak sunucu adları
    pub via: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlanIcerigi {
    pub alan: Option<AlanOgesi>,
    pub cocuklar: Vec<AlanOgesi>,
}

/// Presence of a person, when the server tells us · Sunucu söylerse bir kişinin varlık durumu
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VarlikDurumu {
    /// "cevrimici" | "bosta" | "cevrimdisi" · "cevrimici" | "bosta" | "cevrimdisi"
    pub durum: String,
    /// Milliseconds since the person was last active · Kişinin son etkinliğinden beri geçen milisaniye
    pub son_etkinlik_ms: Option<u64>,
}

/// Login request from the UI (the only DTO that goes UI → Rust).
/// Arayüzden gelen giriş isteği (arayüzden Rust'a giden tek veri yapısı).
#[derive(serde::Deserialize)]
pub struct GirisIstegi {
    pub sunucu: String,
    pub kullanici: String,
    pub sifre: String,
}

// ---- Calls · Aramalar ----

/// One TURN server as the browser's `RTCIceServer` wants it · Tarayıcının `RTCIceServer`ının istediği biçimde bir TURN sunucusu
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TurnSunucu {
    pub urls: Vec<String>,
    pub username: String,
    pub credential: String,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AramaOlayTuru {
    Davet,
    Adaylar,
    Cevap,
    CevapSec,
    Red,
    Kapat,
}

#[derive(Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AramaAday {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    pub sdp_m_line_index: Option<u32>,
}

/// An incoming `m.call.*` event, forwarded to the UI as `arama-olayi`.
/// Gelen bir `m.call.*` olayı; arayüze `arama-olayi` olarak iletilir.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AramaOlayi {
    pub oda_id: String,
    pub gonderen: String,
    /// true = sent by one of our own devices (other device answered/rejected, or our own echo)
    /// true = kendi cihazlarımızdan biri gönderdi (başka cihaz yanıtladı/reddetti ya da kendi yankımız)
    pub kendi: bool,
    pub zaman: u64,
    pub tur: AramaOlayTuru,
    pub arama_id: String,
    pub taraf_id: Option<String>,
    pub sdp: Option<String>,
    pub omur_ms: Option<u64>,
    pub adaylar: Vec<AramaAday>,
    pub secilen_taraf_id: Option<String>,
    pub neden: Option<String>,
}

/// UI → Rust: send one call event · Arayüzden Rust'a: bir arama olayı gönder
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AramaGonderIstegi {
    pub oda_id: String,
    pub tur: String,
    pub arama_id: String,
    pub taraf_id: String,
    pub sdp: Option<String>,
    pub omur_ms: Option<u64>,
    #[serde(default)]
    pub adaylar: Vec<AramaAday>,
    pub secilen_taraf_id: Option<String>,
    pub neden: Option<String>,
}

// ---- End-to-end encryption · Uçtan uca şifreleme ----

/// Cross-signing: `hazir` = this account has a cross-signing identity, `yok` = it has none yet, `bekliyor` = not checked yet.
/// Çapraz imza: `hazir` = hesabın çapraz imza kimliği var, `yok` = henüz yok, `bekliyor` = henüz denetlenmedi.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaprazImza {
    Hazir,
    Yok,
    Bekliyor,
}

/// Server-side key backup of room keys. · Oda anahtarlarının sunucudaki yedeği.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum YedekDurumu {
    Acik,
    Kapali,
    Yukleniyor,
}

/// Recovery (secret storage): `hazir` = set up and this device has the secrets, `eksik` = set up but this device lacks
/// them (enter the recovery key), `kapali` = never set up, `bilinmiyor` = state not known yet (before the first sync).
/// Kurtarma (gizli depo): `hazir` = kurulu ve bu cihazda sırlar var, `eksik` = kurulu ama bu cihazda sırlar yok
/// (kurtarma anahtarı gir), `kapali` = hiç kurulmadı, `bilinmiyor` = durum henüz bilinmiyor (ilk eşitlemeden önce).
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum KurtarmaDurumu {
    Hazir,
    Eksik,
    Kapali,
    Bilinmiyor,
}

/// Event `sifreleme-durumu`; also returned by the `sifreleme_durumu` command.
/// `sifreleme-durumu` olayı; `sifreleme_durumu` komutu da bunu döndürür.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SifrelemeDurumu {
    pub capraz_imza: CaprazImza,
    pub cihaz_dogrulandi: bool,
    pub yedek: YedekDurumu,
    pub kurtarma: KurtarmaDurumu,
    /// Cross-signing must be created but the server wants the account password (UIA): the UI asks for it.
    /// Çapraz imza kurulmalı ama sunucu hesap şifresini istiyor (UIA): arayüz şifreyi sorar.
    pub parola_gerekli: bool,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DogrulamaAsamasi {
    Yok,
    /// We sent a request and wait for the other device to accept. · İstek gönderdik, öteki cihazın kabulünü bekliyoruz.
    IstekGonderildi,
    /// Another device asks to verify with us. · Başka bir cihaz bizimle doğrulama istiyor.
    GelenIstek,
    /// Both sides agreed, SAS is about to start. · İki taraf anlaştı, SAS başlamak üzere.
    Hazir,
    /// Seven emojis are shown, waiting for our answer. · Yedi emoji gösteriliyor, cevabımız bekleniyor.
    Emoji,
    /// We confirmed, waiting for the other side. · Biz onayladık, öteki tarafı bekliyoruz.
    OnayBekleniyor,
    Bitti,
    Iptal,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SasEmoji {
    pub simge: String,
    /// The standard English description (the UI translates it). · Standart İngilizce açıklama (arayüz çevirir).
    pub ad: String,
}

/// Event `dogrulama-guncellendi`; also returned by the `dogrulama_durumu` command.
/// `dogrulama-guncellendi` olayı; `dogrulama_durumu` komutu da bunu döndürür.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DogrulamaDurumu {
    pub asama: DogrulamaAsamasi,
    /// "Element Web (ABCDEF)": the other device · öteki cihaz
    pub diger_cihaz: Option<String>,
    pub emojiler: Vec<SasEmoji>,
    /// Why it was cancelled (technical, English) · Neden iptal edildi (teknik, İngilizce)
    pub neden: Option<String>,
}

impl Default for DogrulamaDurumu {
    fn default() -> Self {
        Self { asama: DogrulamaAsamasi::Yok, diger_cihaz: None, emojiler: Vec::new(), neden: None }
    }
}

// ---- Media sending · Medya gönderme ----

/// UI → Rust: send a prepared file (already written to the cache with `medya_parca_yaz`).
/// Arayüzden Rust'a: hazırlanmış bir dosyayı gönder (`medya_parca_yaz` ile önbelleğe yazılmış olmalı).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MedyaGonderIstegi {
    pub oda_id: String,
    /// "resim" | "video" | "dosya"
    pub tur: String,
    pub kimlik: String,
    pub dosya_adi: String,
    pub mime: String,
    pub genislik: Option<u32>,
    pub yukseklik: Option<u32>,
    pub sure_ms: Option<u64>,
    pub kucuk_kimlik: Option<String>,
    pub kucuk_mime: Option<String>,
    pub kucuk_genislik: Option<u32>,
    pub kucuk_yukseklik: Option<u32>,
    pub aciklama: Option<String>,
}

/// UI → Rust: transcode a picked video (Android: Media3 Transformer). · Seçilen videoyu yeniden kodla (Android: Media3 Transformer).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSikistirIstegi {
    /// Local id the UI uses to match `medya-ilerleme` events · Arayüzün `medya-ilerleme` olaylarını eşlediği yerel kimlik
    pub yerel_id: String,
    pub kimlik: String,
    /// Target height in px (480 / 720); 0 = keep the original size · Hedef yükseklik (480 / 720); 0 = özgün boyut
    pub yukseklik: u32,
    pub bitrate_bps: u32,
    pub basla_ms: u64,
    /// 0 = until the end · 0 = sona kadar
    pub bitis_ms: u64,
    pub sessiz: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VideoSonucu {
    pub kimlik: String,
    pub boyut: u64,
    pub genislik: u32,
    pub yukseklik: u32,
    pub sure_ms: u64,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MedyaAsama {
    Sikistiriliyor,
    // No "yukleniyor": the upload phase is a local echo in the timeline and its progress is `ZamanOgesi.medya.ilerleme`.
    // "yukleniyor" yok: yükleme aşaması zaman çizelgesinde yerel yankıdır, ilerlemesi `ZamanOgesi.medya.ilerleme`dir.
}

/// Event `medya-ilerleme` · `medya-ilerleme` olayı
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MedyaIlerlemeOlayi {
    pub yerel_id: String,
    pub asama: MedyaAsama,
    /// 0..100
    pub yuzde: u32,
}

/// What this device can do for media / notifications · Bu cihazın medya / bildirim için yapabildikleri
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MedyaYetenekleri {
    /// Native video transcoding exists (Android) · Yerel video yeniden kodlama var (Android)
    pub video_sikistirma: bool,
    /// System notifications exist (Android) · Sistem bildirimleri var (Android)
    pub sistem_bildirimi: bool,
}

/// Event `uygulama-ici-bildirim`: a message arrived in a room that is not open; the UI shows an in-app banner.
/// `uygulama-ici-bildirim` olayı: açık olmayan bir odaya mesaj geldi; arayüz uygulama içi şerit gösterir.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UygulamaIciBildirim {
    pub oda_id: String,
    pub oda_ad: String,
    pub gonderen_ad: String,
    pub metin: String,
    pub avatar_mxc: Option<String>,
    pub arama: bool,
}

// ---- Message search · Mesaj araması ----

/// A piece of a result snippet; `vurgu` = it matched the query (the UI draws it highlighted).
/// Sending pieces instead of offsets avoids the UTF-8 byte vs UTF-16 index mismatch between Rust and JS.
/// Sonuç özetinin bir parçası; `vurgu` = sorguyla eşleşti (arayüz vurgulu çizer).
/// Konum yerine parça göndermek, Rust (UTF-8 bayt) ile JS (UTF-16) indeks uyuşmazlığını önler.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MesajParcasi {
    pub metin: String,
    pub vurgu: bool,
}

/// One message search hit. (Named `MesajAramaSonucu` because `AramaSonucu` already means "call outcome".)
/// Bir mesaj arama sonucu. (`AramaSonucu` zaten "arama (telefon) sonucu" olduğu için `MesajAramaSonucu` adı verildi.)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MesajAramaSonucu {
    pub olay_id: String,
    pub oda_id: String,
    pub gonderen: String,
    pub gonderen_ad: Option<String>,
    /// Milliseconds since the Unix epoch · Unix epoch'tan beri milisaniye
    pub zaman: i64,
    pub parcalar: Vec<MesajParcasi>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DizinDurumu {
    pub belge_sayisi: u64,
    /// The background backfill (walking old history) is still running · Arka plandaki geçmiş doldurma sürüyor
    pub dolduruluyor: bool,
}

// ---- Room members · Oda üyeleri ----

/// One member of a room. `uyelik` = "join" | "invite" | "ban" | "leave". `guc` = power level (room creators on v12+ report 1000).
/// Bir odanın üyesi. `uyelik` = "join" | "invite" | "ban" | "leave". `guc` = yetki düzeyi (v12+ oda kurucuları 1000 bildirir).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Uye {
    pub kullanici_id: String,
    pub ad: String,
    pub avatar_mxc: Option<String>,
    pub guc: i64,
    pub uyelik: String,
}

/// What the signed-in user may do in a room, plus the thresholds the UI needs to decide what to show.
/// Oturum sahibinin bir odada neler yapabileceği ve arayüzün neyi göstereceğine karar vermek için eşikler.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BenimYetkilerim {
    pub guc: i64,
    pub atma_esigi: i64,
    pub yasaklama_esigi: i64,
    pub davet_esigi: i64,
    /// Level needed to send messages (events_default); below it a member is "muted" · Mesaj göndermek için gereken düzey (events_default); altındaki üye "susturulmuş" sayılır
    pub yazma_esigi: i64,
    /// Level needed to change power levels · Yetki düzeylerini değiştirmek için gereken düzey
    pub guc_esigi: i64,
    pub atabilir: bool,
    pub yasaklayabilir: bool,
    pub davet_edebilir: bool,
    pub guc_degistirebilir: bool,
    /// May notify the whole room (`@room`) · Tüm odayı bildirebilir (`@room`)
    pub odayi_bildirebilir: bool,
}

/// One of my login sessions (device) for Ben › Güvenlik ve anahtarlar. `son_gorulme` = ms since epoch.
/// Ben › Güvenlik ve anahtarlar için oturum açtığım bir cihaz. `son_gorulme` = epoch'tan beri ms.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OturumCihazi {
    pub cihaz_id: String,
    pub ad: Option<String>,
    pub son_gorulme: Option<u64>,
    pub son_ip: Option<String>,
    /// Cross-signed by me (trusted) · Bana ait çapraz imzayla doğrulanmış (güvenilir)
    pub dogrulandi: bool,
    /// This very device · Şu an kullandığım cihaz
    pub bu_cihaz: bool,
}

/// Ben › Hesap: what the server offers (see `hesap_bilgisi`) · Ben › Hesap: sunucunun sunduğu (bkz. `hesap_bilgisi`)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HesapBilgisi {
    pub sunucu: String,
    /// account lives behind OAuth/OIDC (account web page) · hesap OAuth/OIDC'nin arkasında (hesap web sayfası)
    pub oidc: bool,
    pub hesap_url: Option<String>,
    /// `account_management_actions_supported`, e.g. "org.matrix.profile" · örn. "org.matrix.profile"
    pub eylemler: Vec<String>,
    pub surumler: Vec<String>,
    pub sliding_sync: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EpostaAdresi {
    pub adres: String,
    pub dogrulandi: bool,
}
