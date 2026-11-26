//! Application state managed by Tauri. Commands get it through `State<'_, AppState>`.
//! Tauri'nin yönettiği uygulama durumu. Komutlar ona `State<'_, AppState>` ile ulaşır.

use std::{collections::HashMap, sync::Arc};

use matrix_sdk::{ruma::OwnedRoomId, Client};
use matrix_sdk_ui::{spaces::SpaceService, sync_service::SyncService, Timeline};
use tokio::{sync::{Mutex, RwLock}, task::JoinHandle};

/// Everything that exists only while a user is logged in.
/// Yalnızca bir kullanıcı giriş yapmışken var olan her şey.
pub struct AktifOturum {
    pub client: Client,
    /// Some(..) when the server supports sliding sync; None in the classic `/sync` fallback.
    /// Sunucu sliding sync destekliyorsa Some(..); klasik `/sync` yedeğinde None.
    pub esitleme: Option<Arc<SyncService>>,
    /// Background tasks (classic sync loop, room-list emitter, token saver). Aborted on logout.
    /// Arka plan görevleri (klasik sync döngüsü, oda listesi yayıncısı, token kaydedici). Çıkışta durdurulur.
    pub gorevler: Vec<JoinHandle<()>>,
    /// Tasks that go on while another account is in use (token saver, send queue, search index); only logout stops them.
    /// Başka hesap kullanımdayken de süren görevler (belirteç kaydedici, gönderim kuyruğu, arama dizini); yalnızca çıkış durdurur.
    pub kalici: Vec<JoinHandle<()>>,
}

/// A signed-in account that is not in use now. Its client is kept: a second one on the same store would corrupt its encryption state.
/// Girişli ama şu an kullanılmayan hesap. İstemcisi tutulur: aynı depoda ikinci bir istemci şifreleme durumunu bozardı.
pub struct ParkliOturum {
    pub client: Client,
    pub dizin: Option<Arc<crate::matrix::dizin::Dizin>>,
    pub kalici: Vec<JoinHandle<()>>,
}

/// One open room: its timeline, the diff-forwarding task, pagination lock, publish-pause flag and explicit publish channel.
/// Açık bir oda: zaman çizelgesi, değişiklikleri ileten görev, sayfalama kilidi, yayın duraklatma bayrağı ve açık yayın kanalı.
pub struct AcikZaman {
    pub zaman: Arc<Timeline>,
    pub gorev: JoinHandle<()>,
    pub kilit: Arc<Mutex<()>>,
    pub yayin_duraklat: Arc<std::sync::atomic::AtomicBool>,
    pub yayin_iste: tokio::sync::mpsc::UnboundedSender<(bool, tokio::sync::oneshot::Sender<()>)>,
}

/// What we have seen of one call's life, used to label the timeline line ("3 dk", "Cevapsız"...).
/// Bir aramanın yaşamında gördüklerimiz; zaman çizelgesi satırını ("3 dk", "Cevapsız"...) etiketlemek için.
#[derive(Default, Clone, Debug)]
pub struct AramaKaydi {
    pub cevap_ms: Option<u64>,
    pub bitis_ms: Option<u64>,
    pub reddedildi: bool,
}

/// Cached TURN credentials with their expiry · Önbellekteki TURN bilgisi ve bitiş zamanı
pub struct TurnOnbellek {
    pub sunucular: Vec<crate::tipler::TurnSunucu>,
    pub gecerli_son: std::time::Instant,
}

/// Encryption bookkeeping shared by the monitor task and the commands.
/// İzleyici görev ile komutların paylaştığı şifreleme kayıtları.
#[derive(Default)]
pub struct SifrelemeKaydi {
    /// Last state sent to the UI (so we only emit real changes). · Arayüze gönderilen son durum (yalnızca gerçek değişiklik yayınlansın).
    pub son: Option<crate::tipler::SifrelemeDurumu>,
    /// The first identity query finished: only then "no cross-signing" really means "none". · İlk kimlik sorgusu bitti: ancak o zaman "çapraz imza yok" gerçekten "yok" demektir.
    pub kimlik_sorgulandi: bool,
    pub parola_gerekli: bool,
}

/// The one verification flow that can be active at a time (this device with one of our other devices).
/// Aynı anda yalnızca bir doğrulama akışı etkin olabilir (bu cihaz ile öteki cihazlarımızdan biri).
pub struct AktifDogrulama {
    pub istek: matrix_sdk::encryption::verification::VerificationRequest,
    pub sas: Option<matrix_sdk::encryption::verification::SasVerification>,
    pub gorev: JoinHandle<()>,
    pub durum: crate::tipler::DogrulamaDurumu,
}

/// One media source the UI may ask for through `medya://localhost/m/<id>`.
/// UI'nin `medya://localhost/m/<id>` ile isteyebileceği bir medya kaynağı.
#[derive(Clone)]
pub struct MedyaKaynagi {
    pub kaynak: matrix_sdk::ruma::events::room::MediaSource,
    pub mime: Option<String>,
    pub dosya_adi: String,
}

/// id → source registry. Needed because an encrypted file is described by a whole `EncryptedFile` (keys, hashes), which cannot
/// be put in a URL; the timeline mapper registers every media source here and hands the short id to the UI. FIFO-bounded.
/// id → kaynak kaydı. Şifreli dosya, URL'ye sığmayan bir `EncryptedFile` (anahtarlar, özetler) ile tanımlanır; zaman çizelgesi
/// eşleyicisi her medya kaynağını buraya kaydeder, arayüze kısa id verir. FIFO ile sınırlıdır.
#[derive(Default)]
pub struct MedyaKayit {
    pub harita: HashMap<String, MedyaKaynagi>,
    pub sira: std::collections::VecDeque<String>,
}

impl MedyaKayit {
    const SINIR: usize = 4000;

    pub fn ekle(&mut self, id: String, k: MedyaKaynagi) {
        if self.harita.insert(id.clone(), k).is_none() {
            self.sira.push_back(id);
            while self.sira.len() > Self::SINIR {
                if let Some(eski) = self.sira.pop_front() {
                    self.harita.remove(&eski);
                }
            }
        }
    }
}

#[derive(Default)]
pub struct AppState {
    pub medya_kaynaklari: std::sync::Mutex<MedyaKayit>,
    /// The webview reports when it is hidden (desktop; on Android the Kotlin lifecycle is asked instead). Inverted so the
    /// default `false` means "in the foreground".
    /// Webview gizlenince bildirir (masaüstü; Android'de bunun yerine Kotlin yaşam döngüsüne sorulur). Ters tutuldu ki
    /// varsayılan `false` "ön planda" anlamına gelsin.
    pub arka_planda: std::sync::atomic::AtomicBool,
    pub sifreleme: std::sync::Mutex<SifrelemeKaydi>,
    pub dogrulama: Mutex<Option<AktifDogrulama>>,
    /// call_id → outcome, filled by the call event handlers (memory only; lost on restart)
    /// arama_id → sonuç; arama olayı işleyicileri doldurur (yalnızca bellekte; yeniden başlatınca kaybolur)
    pub arama_gecmisi: std::sync::Mutex<HashMap<String, AramaKaydi>>,
    /// Wakes open timelines when `arama_gecmisi` changed so the system line can update
    /// `arama_gecmisi` değişince açık zaman çizelgelerini uyandırır; sistem satırı güncellensin
    pub arama_degisti: Arc<tokio::sync::Notify>,
    pub turn: Mutex<Option<TurnOnbellek>>,
    pub oturum: RwLock<Option<AktifOturum>>,
    /// By account id (see matrix/hesaplar.rs) · Hesap kimliğiyle (bkz. matrix/hesaplar.rs)
    pub parklar: Mutex<HashMap<String, ParkliOturum>>,
    /// Full-text message index of the logged-in account (None before login or if it failed to open).
    /// Girişli hesabın tam metin mesaj dizini (giriş öncesi ya da açılamadıysa None).
    pub dizin: std::sync::Mutex<Option<Arc<crate::matrix::dizin::Dizin>>>,
    pub zamanlar: Mutex<HashMap<OwnedRoomId, AcikZaman>>,
    /// matrix-sdk-ui's space graph, created on first use after login and dropped at logout.
    /// matrix-sdk-ui'nin alan grafiği; girişten sonra ilk kullanımda kurulur, çıkışta bırakılır.
    pub alan_servisi: Mutex<Option<Arc<SpaceService>>>,
    /// Serializes login / restore / logout so they cannot race each other.
    /// Giriş / geri yükleme / çıkışın birbiriyle yarışmaması için sıraya dizer.
    pub kilit: Mutex<()>,
    /// True while a saved session is being restored. The UI opens on the last account at once (oturum.svelte.ts), so its first
    /// commands may come before the client exists: they wait for the restore instead of failing with `OturumYok`.
    /// Kayıtlı oturum geri yüklenirken true. Arayüz son hesapla hemen açılır (oturum.svelte.ts); ilk komutları istemci oluşmadan
    /// gelebilir: `OturumYok` ile düşmek yerine geri yüklemeyi beklerler.
    pub geri_yukleniyor: std::sync::atomic::AtomicBool,
    pub geri_yukleme_bitti: tokio::sync::Notify,
}

impl AppState {
    /// A cheap clone of the current client, or `OturumYok`. Never hold the lock across awaits on the network.
    /// Mevcut istemcinin ucuz bir kopyası ya da `OturumYok`. Ağ beklerken kilidi tutma.
    pub async fn client(&self) -> Result<Client, crate::hata::Hata> {
        loop {
            // Created before the checks, so a restore that ends in between still wakes it. · Denetimlerden önce oluşturulur; arada biten geri yükleme de uyandırır.
            let bekle = self.geri_yukleme_bitti.notified();
            if let Some(c) = self.oturum.read().await.as_ref().map(|o| o.client.clone()) {
                return Ok(c);
            }
            if !self.geri_yukleniyor.load(std::sync::atomic::Ordering::SeqCst) {
                return Err(crate::hata::Hata::OturumYok);
            }
            if tokio::time::timeout(std::time::Duration::from_secs(60), bekle).await.is_err() {
                return Err(crate::hata::Hata::OturumYok);
            }
        }
    }

    /// Marks a restore as running until the returned guard is dropped (on every return path). · Dönen bekçi bırakılana dek (her dönüş yolunda) geri yüklemeyi sürüyor sayar.
    pub fn geri_yukleme_basladi(&self) -> GeriYuklemeBekcisi<'_> {
        self.geri_yukleniyor.store(true, std::sync::atomic::Ordering::SeqCst);
        GeriYuklemeBekcisi(self)
    }
}

pub struct GeriYuklemeBekcisi<'a>(&'a AppState);
impl Drop for GeriYuklemeBekcisi<'_> {
    fn drop(&mut self) {
        self.0.geri_yukleniyor.store(false, std::sync::atomic::Ordering::SeqCst);
        self.0.geri_yukleme_bitti.notify_waiters();
    }
}
