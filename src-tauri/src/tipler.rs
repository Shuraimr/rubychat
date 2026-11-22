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
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EsitlemeDurumuAdi {
    Basliyor,
    Calisiyor,
    Hata,
    Cevrimdisi,
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
