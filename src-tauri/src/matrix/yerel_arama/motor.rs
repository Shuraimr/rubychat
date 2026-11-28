//! One running native call. A single task owns the engine's call and applies requests; what the screen shows goes out as one snapshot event.
//! Süren tek yerel arama. Motorun araması tek görevdedir, istekleri o uygular; ekranın gösterdiği tek bir anlık görüntü olayıyla çıkar.

use std::collections::{BTreeMap, HashMap};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use matrix_rtc_call::{CallEnd, CallKind, CallStatus, GroupNotify, RingConfig};
use matrix_rtc_call_sdk::{CallEvent, ConnectionState, LiveKitCall, LiveKitCallOptions, Participant, UnableToDecrypt};
use matrix_rtc_core::compat::MembershipFormat;
use matrix_rtc_transport::{
    AudioFrame, AudioSourceConfig, I420Buffer, LocalTrackHandle, MediaStreamKind, PublishOptions, VideoEncodingLimits, VideoFrame, VideoSourceConfig,
};
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinHandle;

use super::ekran::{Yakalama, YakalamaOlayi};
use super::ses::{self, kilitle, Kayit, Ses, UygulamaSesi};
use super::*;

pub const VAR: bool = true;
const OLAY: &str = "yerel-arama";
const SEVIYE_OLAYI: &str = "yerel-arama-seviye";
/// Names of the shared applications, encrypted to each device (track names would be readable by the media server).
/// Paylaşılan uygulamaların adları, her cihaza şifreli (parça adlarını medya sunucusu okuyabilirdi).
const AD_OLAYI: &str = "dev.rubyyard.rubychat.app_audio";
/// Fixed frame-channel key for the sharer's own local screen preview. · Paylaşanın kendi yerel ekran önizlemesi için sabit kare kanalı anahtarı.
const ONIZLEME: &str = "ben|ekran-onizleme";

/// Keeps WebRTC's PeerConnectionFactory alive for the whole process after creating it on a clean OS thread.
/// On Android, `LkRuntime::instance()` initializes libwebrtc's JNI video encoder factory, which aborts with
/// `RTC_CHECK(!env->ExceptionCheck())` ("error during NewStringUTF") if run on a tokio worker that carries a
/// leftover Java exception. Holding a strong `Arc` stops the factory from dropping between calls and being
/// recreated later on a tokio thread.
/// WebRTC'nin PeerConnectionFactory'sini temiz bir işletim sistemi iş parçacığında kurup süreç boyunca canlı tutar.
/// Android'de `LkRuntime::instance()` libwebrtc'nin JNI video kodlayıcı fabrikasını başlatır; önceden kalmış bir
/// Java istisnası taşıyan bir tokio iş parçacığında çalışırsa `RTC_CHECK(!env->ExceptionCheck())` ("error during
/// NewStringUTF") ile süreci düşürür. Güçlü `Arc` saklanır ki fabrika aramalar arasında düşüp sonraki aramada
/// yeniden bir tokio iş parçacığında kurulmasın.
static CALISMA: OnceLock<Arc<livekit::rtc_engine::lk_runtime::LkRuntime>> = OnceLock::new();

fn webrtc_hazirla() {
    if CALISMA.get().is_some() {
        return;
    }
    // Android: the runtime is created on a Java thread that Kotlin starts (WebrtcKoprusu.calismaHazirla, android_jni.rs), so libwebrtc's
    // JNI calls run with the app's class loader and a clean JNI state. (The crash at call start itself was missing JNI symbols, see build.rs.)
    // Android: çalışma ortamı Kotlin'in açtığı bir Java iş parçacığında kurulur (WebrtcKoprusu.calismaHazirla, android_jni.rs); böylece libwebrtc'nin
    // JNI çağrıları uygulamanın sınıf yükleyicisiyle ve temiz JNI durumuyla çalışır. (Arama başında çökmenin asıl sebebi eksik JNI simgeleriydi, bkz. build.rs.)
    #[cfg(target_os = "android")]
    {
        if let Err(e) = crate::android_jni::webrtc_calisma_hazirla() {
            tracing::warn!("webrtc Java iş parçacığında hazırlanamadı: {e}");
        }
    }
    #[cfg(not(target_os = "android"))]
    match std::thread::Builder::new().name("rubychat-webrtc".into()).spawn(webrtc_kur) {
        Ok(h) => {
            if h.join().is_err() {
                tracing::warn!("webrtc hazırlama iş parçacığı panikledi");
            }
        }
        Err(e) => tracing::warn!("webrtc hazırlama iş parçacığı açılamadı: {e}"),
    };
}

/// Creates the runtime once and keeps it (see `CALISMA`). On Android this runs on a Java thread. · Çalışma ortamını bir kez kurar
/// ve saklar (bkz. `CALISMA`). Android'de bir Java iş parçacığında çalışır.
pub(crate) fn webrtc_kur() {
    CALISMA.get_or_init(livekit::rtc_engine::lk_runtime::LkRuntime::instance);
}

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SesDurumu {
    anahtar: String,
    /// "mikrofon" | "ekran" | "uygulama"
    tur: &'static str,
    ad: Option<String>,
    duzey: f32,
}

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Katilimci {
    uye: String,
    kullanici_id: String,
    ad: String,
    avatar_mxc: Option<String>,
    ben: bool,
    susturulmus: bool,
    konusuyor: bool,
    /// Keys for the pictures; None = not sent · Görüntülerin anahtarları; None = gönderilmiyor
    ekran: Option<String>,
    kamera: Option<String>,
    sesler: Vec<SesDurumu>,
    /// null | "baglaniyor" | "cozulemiyor" | "dogrulanmamis"
    sorun: Option<&'static str>,
}

/// Real WebRTC send-side health and bitrate of our own screen share. · Kendi ekran paylaşımımızın gerçek WebRTC gönderim durumu ve hızı.
#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct YayinBilgisi {
    /// "basliyor" | "yayinda" | "gitmiyor"
    durum: &'static str,
    kbps: u32,
    kare_hizi: u32,
    genislik: u32,
    yukseklik: u32,
}

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct YerelDurum {
    oda_id: String,
    /// "baglaniyor" | "caliyor" | "acik" | "koptu" | "bitti"
    asama: &'static str,
    /// Only with "bitti" · Yalnızca "bitti" ile: "biz" | "reddedildi" | "cevapsiz" | "ayrildilar" | "ag" | "hata"
    neden: Option<&'static str>,
    katilimcilar: Vec<Katilimci>,
    mikrofon_kapali: bool,
    /// "yok" | "seciliyor" | "acik"
    paylasim: &'static str,
    paylasilan: Vec<String>,
    /// Share ended by an error or by the system's picker · Paylaşım hatayla ya da sistem seçicisinde bitti
    paylasim_hatasi: bool,
    /// Local preview frame key while picking or sharing · Seçim ve paylaşım sırasında yerel önizleme kare anahtarı
    onizleme: Option<String>,
    /// Real send counters while sharing ("acik" only) · Paylaşım açıkken gerçek gönderim sayaçları (yalnız "acik")
    yayin: Option<YayinBilgisi>,
}

enum Istek {
    Kapat(oneshot::Sender<()>),
    Sustur(bool),
    Paylas(Vec<String>),
    Sesler(Vec<String>),
    PaylasimiDurdur,
    EkranHazir(u64, u32, u32),
    EkranBitti(u64, bool),
    MikrofonHazir(Result<Arc<dyn LocalTrackHandle>, String>),
    SesAyari(ses::AyarDegisimi),
    Adlar(String, String, HashMap<u32, String>),
}

struct Acik {
    tx: mpsc::UnboundedSender<Istek>,
    karisim: Arc<Mutex<ses::Karistirici>>,
}

fn acik() -> &'static Mutex<Option<Acik>> {
    static A: OnceLock<Mutex<Option<Acik>>> = OnceLock::new();
    A.get_or_init(Default::default)
}

type KareKanali = watch::Sender<(u64, Option<Arc<VideoFrame>>)>;
fn kareler() -> &'static Mutex<HashMap<String, Arc<KareKanali>>> {
    static K: OnceLock<Mutex<HashMap<String, Arc<KareKanali>>>> = OnceLock::new();
    K.get_or_init(Default::default)
}

fn iste(i: Istek) -> bool {
    kilitle(acik()).as_ref().is_some_and(|a| a.tx.send(i).is_ok())
}

// ---------------------------------------------------------------------------------------------------------------------
// Commands · Komutlar
// ---------------------------------------------------------------------------------------------------------------------

pub async fn baslat(app: AppHandle, oda: matrix_sdk::Room, dm: bool, ara: bool) -> Sonuc<()> {
    kapat().await;
    // Even tokio's blocking pool may carry JNI state from earlier calls, so `webrtc_hazirla` spawns its own fresh thread.
    // tokio'nun bloklayan havuzu da önceki çağrılardan JNI durumu taşıyabilir; `webrtc_hazirla` kendi yeni iş parçacığını açar.
    let _ = tokio::task::spawn_blocking(webrtc_hazirla).await;
    // The engine brings rustls with two crypto back ends. · Motor rustls'i iki şifreleme arka ucuyla getirir.
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    let ses = Ses::baslat();
    let (tx, rx) = mpsc::unbounded_channel();
    *kilitle(acik()) = Some(Acik { tx: tx.clone(), karisim: ses.karisim.clone() });
    tokio::spawn(yurut(app, oda, dm, ara, ses, tx, rx));
    Ok(())
}

pub async fn kapat() {
    let (b, bekle) = oneshot::channel();
    if iste(Istek::Kapat(b)) {
        // Leaving talks to the server; do not hang the window on it. · Ayrılma sunucuyla konuşur; pencere ona takılmasın.
        let _ = tokio::time::timeout(Duration::from_secs(8), bekle).await;
    }
}

pub fn sustur(kapali: bool) {
    iste(Istek::Sustur(kapali));
}

pub fn duzey(anahtar: String, d: f32) {
    if let Some(a) = kilitle(acik()).as_ref() {
        kilitle(&a.karisim).duzey_ver(&anahtar, d);
    }
}

pub async fn uygulamalar() -> Vec<String> {
    tokio::task::spawn_blocking(|| ses::uygulamalar().into_keys().collect()).await.unwrap_or_default()
}

pub async fn aygitlar() -> SesAygitlari {
    tokio::task::spawn_blocking(ses::aygitlar).await.unwrap_or_default()
}

pub fn ses_ayarla(giris: Option<String>, cikis: Option<String>, gurultu: bool) {
    let d = ses::ayar_yaz(giris, cikis, gurultu);
    if d.giris || d.cikis || d.gurultu {
        iste(Istek::SesAyari(d));
    }
}

pub fn paylas(u: Vec<String>) -> Sonuc<()> {
    if iste(Istek::Paylas(u)) { Ok(()) } else { Err(Hata::Diger("arama yok".into())) }
}

pub fn paylasilan_sesler(u: Vec<String>) {
    iste(Istek::Sesler(u));
}

pub fn paylasimi_durdur() {
    iste(Istek::PaylasimiDurdur);
}

pub async fn kare(anahtar: String, sonra: u64) -> Vec<u8> {
    let onizleme = anahtar == ONIZLEME;
    if onizleme {
        // At most 5 preview frames a second: the sharer only needs to see that it moves. · Saniyede en fazla 5 önizleme
        // karesi: paylaşanın yalnızca oynadığını görmesi yeter.
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let kanal = kilitle(kareler()).get(&anahtar).cloned();
    let Some(kanal) = kanal else {
        tokio::time::sleep(Duration::from_millis(200)).await;
        return vec![];
    };
    let mut rx = kanal.subscribe();
    let sonuc = tokio::time::timeout(Duration::from_secs(1), rx.wait_for(|(no, k)| *no > sonra && k.is_some()))
        .await
        .map(|r| r.map(|v| v.clone()).map_err(|_| ()));
    let bulunan = match sonuc {
        Ok(Ok(v)) => v,
        // No new frame in time (a still screen): 4 bytes = "keep your number". Only numbers that went backwards mean the
        // sharer started again; then the empty answer makes the viewer start from 0. Without this a still picture was sent
        // again every second. · Zamanında yeni kare yok (durağan ekran): 4 bayt = "numaranı koru". Yalnızca geriye giden numara
        // paylaşanın yeniden başladığı demektir; o zaman boş yanıt izleyiciyi 0'dan başlatır. Bu olmasa durağan görüntü her
        // saniye yeniden gönderilirdi.
        Ok(Err(_)) => return vec![],
        Err(_) => return if rx.borrow().0 < sonra { vec![] } else { vec![0; 4] },
    };
    let (no, Some(k)) = bulunan else { return vec![] };
    if onizleme {
        return kucult(&k).and_then(|k| paketle(no as u32, &k)).unwrap_or_else(|| vec![0; 4]);
    }
    paketle(no as u32, &k).unwrap_or_default()
}

fn paketle(no: u32, k: &VideoFrame) -> Option<Vec<u8>> {
    let b = &k.buffer;
    let (w, h) = (b.width as usize, b.height as usize);
    let (cw, ch) = (w.div_ceil(2), h.div_ceil(2));
    let mut o = Vec::with_capacity(12 + w * h + 2 * cw * ch);
    for n in [no, b.width, b.height] {
        o.extend_from_slice(&n.to_le_bytes());
    }
    for (d, adim, gw, gh) in [(&b.data_y, b.stride_y, w, h), (&b.data_u, b.stride_u, cw, ch), (&b.data_v, b.stride_v, cw, ch)] {
        for r in 0..gh {
            let i = r * adim as usize;
            o.extend_from_slice(d.get(i..i + gw)?);
        }
    }
    Some(o)
}

/// Downsamples one plane by 2×2 into a tightly packed buffer; returns None on inconsistent strides or lengths.
/// Bir düzlemi 2×2 seyrelterek sıkı paketli tampona küçültür; tutarsız adım veya uzunlukta None döner.
fn duzlem_kucult(kaynak: &[u8], adim: u32, kaynak_w: usize, kaynak_h: usize, hedef_w: usize, hedef_h: usize) -> Option<Vec<u8>> {
    let adim = adim as usize;
    if adim < kaynak_w || hedef_w == 0 || hedef_h == 0 {
        return None;
    }
    if (hedef_h - 1).checked_mul(2)? >= kaynak_h || (hedef_w - 1).checked_mul(2)? >= kaynak_w {
        return None;
    }
    let mut cikti = Vec::with_capacity(hedef_w.checked_mul(hedef_h)?);
    for y in 0..hedef_h {
        let bas = (y * 2).checked_mul(adim)?;
        let satir = kaynak.get(bas..bas.checked_add(kaynak_w)?)?;
        for x in 0..hedef_w {
            cikti.push(*satir.get(x * 2)?);
        }
    }
    Some(cikti)
}

/// Scales an I420 frame to half resolution (even dimensions, at least 2×2) for the local preview so decoding stays cheap.
/// Yerel önizlemenin hafif kalması için bir I420 kareyi yarı çözünürlüğe (en az 2×2 çift boyutlar) küçültür.
fn kucult(f: &VideoFrame) -> Option<VideoFrame> {
    let b = &f.buffer;
    let (w, h) = (b.width as usize, b.height as usize);
    let (cw, ch) = (w.div_ceil(2), h.div_ceil(2));
    let nw = ((b.width / 2) & !1).max(2);
    let nh = ((b.height / 2) & !1).max(2);
    let ncw = nw / 2;
    let nch = nh / 2;
    let data_y = duzlem_kucult(&b.data_y, b.stride_y, w, h, nw as usize, nh as usize)?;
    let data_u = duzlem_kucult(&b.data_u, b.stride_u, cw, ch, ncw as usize, nch as usize)?;
    let data_v = duzlem_kucult(&b.data_v, b.stride_v, cw, ch, ncw as usize, nch as usize)?;
    Some(VideoFrame {
        buffer: I420Buffer {
            width: nw,
            height: nh,
            data_y,
            stride_y: nw,
            data_u,
            stride_u: ncw,
            data_v,
            stride_v: ncw,
        },
        rotation: f.rotation,
        timestamp_us: f.timestamp_us,
    })
}

// ---------------------------------------------------------------------------------------------------------------------
// The call task · Arama görevi
// ---------------------------------------------------------------------------------------------------------------------

/// One received sound or picture; dropping it stops the reader and removes it. · Alınan tek ses ya da görüntü; düşünce okuyucu durur ve silinir.
struct Alici {
    gorev: JoinHandle<()>,
    anahtar: String,
    karisim: Option<Arc<Mutex<ses::Karistirici>>>,
}
impl Drop for Alici {
    fn drop(&mut self) {
        self.gorev.abort();
        match &self.karisim {
            Some(k) => kilitle(k).sil(&self.anahtar),
            None => {
                kilitle(kareler()).remove(&self.anahtar);
            }
        }
    }
}

struct PaylasilanUygulama {
    no: u32,
    iz: Arc<dyn LocalTrackHandle>,
    _ses: UygulamaSesi,
}

/// The running share. · Süren paylaşım.
struct Paylasim {
    no: u64,
    yakalama: Yakalama,
    kare: Arc<Mutex<Option<Arc<dyn LocalTrackHandle>>>>,
    istenen: Vec<String>,
    uygulamalar: BTreeMap<String, PaylasilanUygulama>,
    /// Previous `(bytes_sent, timestamp)` for delta bitrate calculation. · Fark bit hızı hesabı için önceki `(bytes_sent, zaman)`.
    onceki_bayt: Option<(u64, Instant)>,
    /// Consecutive stat samples with zero byte growth. · Bayt artışı olmayan art arda okuma sayısı.
    bos_okuma: u8,
    yayin: YayinBilgisi,
}

struct Arama {
    app: AppHandle,
    oda: matrix_sdk::Room,
    call: LiveKitCall,
    ses: Ses,
    tx: mpsc::UnboundedSender<Istek>,
    alicilar: HashMap<(String, MediaStreamKind), Alici>,
    konusan: Vec<String>,
    mikrofon: Option<Arc<dyn LocalTrackHandle>>,
    kayit: Option<Kayit>,
    kapali: bool,
    seviye_acikti: bool,
    paylasim: Option<Paylasim>,
    paylasim_hatasi: bool,
    paylasim_no: u64,
    uygulama_no: u32,
    /// (user, device) → names of their applications · (kullanıcı, cihaz) → uygulamalarının adları
    adlar: HashMap<(String, String), HashMap<u32, String>>,
    ad_gonderilen: Vec<(String, String)>,
    profiller: HashMap<String, (String, Option<String>)>,
    son: Option<YerelDurum>,
}

fn bitti(app: &AppHandle, oda_id: &str, neden: &'static str) {
    let d = YerelDurum {
        oda_id: oda_id.to_owned(), asama: "bitti", neden: Some(neden), katilimcilar: vec![], mikrofon_kapali: false,
        paylasim: "yok", paylasilan: vec![], paylasim_hatasi: false, onizleme: None, yayin: None,
    };
    let _ = app.emit(OLAY, d);
}

/// Hanging up while still connecting. The membership (and the ring) may already be on the server, and dropping the join would
/// leave it there until it expires, so the phone on the other side keeps ringing: let the join finish briefly, then leave.
/// Bağlanırken kapatmak. Üyelik (ve zil) sunucuya çoktan gitmiş olabilir; katılmayı düşürmek onu süresi dolana dek orada bırakır,
/// karşı tarafın telefonu çalmayı sürdürür: katılmanın kısaca bitmesini bekle, sonra ayrıl.
async fn katilmadan_ayril<F>(katilma: std::pin::Pin<&mut F>)
where
    F: std::future::Future<Output = Result<LiveKitCall, matrix_rtc_call_sdk::livekit::LiveKitCallError>>,
{
    if let Ok(Ok(call)) = tokio::time::timeout(Duration::from_secs(8), katilma).await {
        if let Ok(Err(e)) = tokio::time::timeout(Duration::from_secs(8), call.leave()).await {
            tracing::warn!("bağlanırken ayrılma: {e}");
        }
    }
}

async fn yurut(
    app: AppHandle, oda: matrix_sdk::Room, dm: bool, ara: bool, ses: Ses,
    tx: mpsc::UnboundedSender<Istek>, mut rx: mpsc::UnboundedReceiver<Istek>,
) {
    let oda_id = oda.room_id().to_string();
    let bizim = tx.clone();
    let son_neden = async {
        let kind = if dm {
            CallKind::Direct { ring: ara.then(RingConfig::default) }
        } else {
            CallKind::Group { notify: ara.then(|| GroupNotify { intent: Some("audio".into()), ..Default::default() }) }
        };
        // Keys from devices their owner has not cross-signed are accepted, as Element and Element Call do: friends who never
        // verified their sessions were heard by no one (and saw nothing) with the strict MSC4153 default. The sender is still
        // proven by Olm, and the tile keeps its "unverified" warning. (User decision, 2026-11-28.)
        // Sahibinin çapraz imzalamadığı cihazlardan gelen anahtarlar kabul edilir (Element ve Element Call da böyle yapar):
        // oturumlarını hiç doğrulamamış arkadaşlar katı MSC4153 varsayılanında kimseyi duymuyor, ekranı da görmüyordu. Gönderen
        // yine Olm ile kanıtlanır; kutudaki "doğrulanmamış" uyarısı kalır. (Kullanıcı kararı, 2026-11-28.)
        let encryption_config = Some(matrix_rtc_core::EncryptionConfig { require_confirmed_sender: false, ..Default::default() });
        let secenek = LiveKitCallOptions { format: MembershipFormat::RoomState, kind, encryption_config, ..Default::default() };
        let katilan = oda.clone();
        let katilma = LiveKitCall::join(&katilan, secenek);
        tokio::pin!(katilma);
        let mut kapali = false;
        // Requests keep being answered while we connect. · Bağlanırken istekler yanıtsız kalmaz.
        let call = loop {
            tokio::select! {
                r = &mut katilma => match r {
                    Ok(c) => break c,
                    Err(e) => {
                        tracing::warn!("aramaya katılınamadı: {e}");
                        return ("hata", None);
                    }
                },
                i = rx.recv() => match i {
                    Some(Istek::Kapat(b)) => {
                        katilmadan_ayril(katilma).await;
                        return ("biz", Some(b));
                    }
                    Some(Istek::Sustur(k)) => kapali = k,
                    Some(Istek::SesAyari(d)) => ses.ayar_uygula(d),
                    Some(_) => {}
                    None => {
                        katilmadan_ayril(katilma).await;
                        return ("biz", None);
                    }
                },
            }
        };
        let mut a = Arama {
            app: app.clone(), oda, call, ses, tx, alicilar: HashMap::new(), konusan: vec![], mikrofon: None, kayit: None, kapali,
            seviye_acikti: false, paylasim: None, paylasim_hatasi: false, paylasim_no: 0, uygulama_no: 0, adlar: HashMap::new(),
            ad_gonderilen: vec![], profiller: HashMap::new(), son: None,
        };
        let (neden, b) = a.dongu(&mut rx).await;
        let Arama { call, alicilar, kayit, paylasim, ses, seviye_acikti, .. } = a;
        // Microphone and screen first: nothing may be recorded while the leave travels. · Önce mikrofon ve ekran: ayrılma sürerken kayıt olmasın.
        drop((kayit, paylasim, alicilar, ses));
        kilitle(kareler()).remove(ONIZLEME);
        if seviye_acikti {
            let _ = app.emit(SEVIYE_OLAYI, 0.0_f32);
        }
        if let Ok(Err(e)) = tokio::time::timeout(Duration::from_secs(8), call.leave()).await {
            tracing::warn!("aramadan ayrılma: {e}");
        }
        (neden, b)
    };
    let (neden, b) = son_neden.await;
    {
        let mut y = kilitle(acik());
        // A newer call may already stand here. · Burada artık daha yeni bir arama olabilir.
        if y.as_ref().is_some_and(|a| a.tx.same_channel(&bizim)) {
            *y = None;
        }
    }
    bitti(&app, &oda_id, neden);
    if let Some(b) = b {
        let _ = b.send(());
    }
}

impl Arama {
    async fn dongu(&mut self, rx: &mut mpsc::UnboundedReceiver<Istek>) -> (&'static str, Option<oneshot::Sender<()>>) {
        let mut olaylar = self.call.subscribe_call_events();
        let mut durumlar = self.call.subscribe_status();
        let _ad_dinleyici = self.adlari_dinle();
        // Publishing waits for our own connection; it must not stop the loop. · Yayın kendi bağlantımızı bekler; döngüyü durdurmamalı.
        let mut tik = tokio::time::interval(Duration::from_millis(500));
        tik.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut seviye_tik = tokio::time::interval(Duration::from_millis(100));
        seviye_tik.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut yayin_tik = tokio::time::interval(Duration::from_secs(2));
        yayin_tik.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        // The screen shows the call before the microphone is published (that waits for the server). · Ekran, mikrofon yayınlanmadan
        // (sunucuyu bekler) önce aramayı gösterir.
        self.bildir().await;
        if let Some(son) = self.mikrofonu_yayinla(rx).await {
            return son;
        }
        loop {
            tokio::select! {
                i = rx.recv() => match i {
                    Some(Istek::Kapat(b)) => return ("biz", Some(b)),
                    Some(i) => self.uygula(i).await,
                    None => return ("biz", None),
                },
                // Unread it would grow for the whole call. · Okunmazsa arama boyunca büyürdü.
                _ = self.call.events().recv() => {}
                e = olaylar.recv() => if let Ok(CallEvent::ActiveSpeakers { speakers }) = e {
                    self.konusan = speakers.into_iter().map(|s| s.member_id).collect();
                },
                r = durumlar.changed() => if r.is_err() { return ("ag", None) },
                _ = seviye_tik.tick() => {
                    if self.kayit.is_some() {
                        let _ = self.app.emit(SEVIYE_OLAYI, self.ses.seviye_al());
                        self.seviye_acikti = true;
                    } else if self.seviye_acikti {
                        let _ = self.ses.seviye_al();
                        let _ = self.app.emit(SEVIYE_OLAYI, 0.0_f32);
                        self.seviye_acikti = false;
                    }
                    continue;
                }
                _ = yayin_tik.tick() => self.yayini_denetle().await,
                _ = tik.tick() => {}
            }
            if let CallStatus::Ended { reason } = self.call.status() {
                return (
                    match reason {
                        CallEnd::Left => "biz",
                        CallEnd::Declined => "reddedildi",
                        CallEnd::Unanswered => "cevapsiz",
                        CallEnd::OthersLeft | CallEnd::Empty => "ayrildilar",
                        CallEnd::ConnectionClosed { .. } => "ag",
                        _ => "hata",
                    },
                    None,
                );
            }
            self.alicilari_esitle();
            self.adlari_gonder().await;
            self.bildir().await;
        }
    }

    async fn uygula(&mut self, i: Istek) {
        match i {
            Istek::Kapat(_) => {}
            Istek::Sustur(k) => {
                self.kapali = k;
                self.mikrofonu_esitle();
            }
            Istek::MikrofonHazir(r) => match r {
                Ok(iz) => {
                    self.mikrofon = Some(iz);
                    self.mikrofonu_esitle();
                }
                Err(e) => tracing::warn!("mikrofon yayımlanamadı: {e}"),
            },
            Istek::SesAyari(d) => {
                self.ses.ayar_uygula(d);
                #[cfg(target_os = "linux")]
                if d.giris {
                    // Restart the recorder so `parec` opens the newly selected input device.
                    // Kaydı yeniden başlat ki `parec` yeni seçilen giriş aygıtını açsın.
                    self.kayit = None;
                    self.mikrofonu_esitle();
                }
            }
            Istek::Paylas(u) => self.paylas(u),
            Istek::Sesler(u) => self.sesleri_esitle(u).await,
            Istek::PaylasimiDurdur => self.paylasimi_birak().await,
            Istek::EkranHazir(no, g, y) => self.ekrani_yayinla(no, g, y).await,
            Istek::EkranBitti(no, hata) => {
                if self.paylasim.as_ref().is_some_and(|p| p.no == no) {
                    self.paylasimi_birak().await;
                    self.paylasim_hatasi = hata;
                }
            }
            Istek::Adlar(k, c, adlar) => {
                self.adlar.insert((k, c), adlar);
            }
        }
    }

    // ---------- microphone · mikrofon ----------

    /// Publishes the muted microphone track. While that waits for the server, hang-up (and every other request) is still listened to:
    /// `Some(..)` means "the call ended meanwhile" and the loop returns it. The track itself arrives later as `MikrofonHazir`.
    /// `self.call` cannot move into a background task (`leave` needs it by value), so the wait is raced against the request channel.
    /// Sessiz mikrofon parçasını yayınlar. Sunucuyu beklerken kapatma (ve diğer istekler) dinlenmeye devam eder: `Some(..)` "arama bu
    /// arada bitti" demektir, döngü onu döndürür. Parça sonra `MikrofonHazir` olarak gelir. `self.call` arka plan görevine taşınamaz
    /// (`leave` onu değer olarak ister); bu yüzden bekleme istek kanalıyla yarıştırılır.
    async fn mikrofonu_yayinla(&mut self, rx: &mut mpsc::UnboundedReceiver<Istek>) -> Option<(&'static str, Option<oneshot::Sender<()>>)> {
        let mut bekleyen: Vec<Istek> = vec![];
        let sonuc = {
            // Muted until the recorder runs, so there is no open-mic window. · Kayıt başlayana kadar sessiz; açık mikrofon aralığı olmasın.
            // Bounded: a stuck publish must not hold the call forever. · Sınırlı: takılan yayın aramayı sonsuza dek tutmamalı.
            let yayin = tokio::time::timeout(Duration::from_secs(10), self.call.publish(PublishOptions::microphone().muted()));
            tokio::pin!(yayin);
            loop {
                tokio::select! {
                    r = &mut yayin => break match r {
                        Ok(r) => r.map_err(|e| e.to_string()),
                        Err(_) => Err("zaman aşımı".to_owned()),
                    },
                    i = rx.recv() => match i {
                        Some(Istek::Kapat(b)) => return Some(("biz", Some(b))),
                        None => return Some(("biz", None)),
                        // Applied right after the publish, in order. · Yayından hemen sonra, sırayla uygulanır.
                        Some(i) => bekleyen.push(i),
                    },
                }
            }
        };
        let _ = self.tx.send(Istek::MikrofonHazir(sonuc));
        for i in bekleyen {
            self.uygula(i).await;
        }
        None
    }

    fn mikrofonu_esitle(&mut self) {
        let Some(iz) = self.mikrofon.clone() else { return };
        if let Err(e) = iz.set_muted(self.kapali) {
            tracing::warn!("mikrofon: {e}");
        }
        if self.kapali {
            // The recorder is closed, not just ignored. · Kayıt yok sayılmaz, kapatılır.
            self.kayit = None;
        } else if self.kayit.is_none() {
            let rt = tokio::runtime::Handle::current();
            self.kayit = Some(self.ses.mikrofon(move |v| {
                rt.block_on(iz.capture_audio(AudioFrame { data: v, sample_rate: ses::HIZ, num_channels: 1, samples_per_channel: ses::KARE as u32 })).is_ok()
            }));
        }
    }

    // ---------- share · paylaşım ----------

    fn paylas(&mut self, u: Vec<String>) {
        if self.paylasim.is_some() {
            return;
        }
        self.paylasim_hatasi = false;
        self.paylasim_no += 1;
        let no = self.paylasim_no;
        let kare: Arc<Mutex<Option<Arc<dyn LocalTrackHandle>>>> = Arc::default();
        let onizleme = Arc::new(watch::channel((0_u64, None)).0);
        kilitle(kareler()).insert(ONIZLEME.to_owned(), onizleme.clone());
        let (k, tx) = (kare.clone(), self.tx.clone());
        let yakalama = Yakalama::baslat(
            move |f| {
                // The preview keeps the NEWEST full frame; it is shrunk (and rate-limited) only when the screen asks for it.
                // Shrinking every 200 ms here dropped the last frame of a burst, so a still screen stayed on its first, empty
                // (green) frame. · Önizleme her zaman EN YENİ tam kareyi tutar; küçültme (ve hız sınırı) ancak ekran isteyince
                // yapılır. Burada 200 ms'de bir küçültmek bir kare dizisinin sonuncusunu atıyordu; durağan ekran ilk, boş (yeşil)
                // karede kalıyordu.
                onizleme.send_modify(|v| *v = (v.0 + 1, Some(Arc::new(f.clone()))));
                let iz = kilitle(&k).clone();
                if let Some(iz) = iz {
                    let _ = iz.capture_video(f);
                }
            },
            move |o| {
                let _ = tx.send(match o {
                    YakalamaOlayi::Hazir(g, y) => Istek::EkranHazir(no, g, y),
                    YakalamaOlayi::Hata(e) => {
                        tracing::warn!("ekran: {e}");
                        Istek::EkranBitti(no, true)
                    }
                    YakalamaOlayi::Bitti => Istek::EkranBitti(no, false),
                });
            },
        );
        self.paylasim = Some(Paylasim {
            no,
            yakalama,
            kare,
            istenen: u,
            uygulamalar: BTreeMap::new(),
            onceki_bayt: None,
            bos_okuma: 0,
            yayin: YayinBilgisi { durum: "basliyor", kbps: 0, kare_hizi: 0, genislik: 0, yukseklik: 0 },
        });
    }

    async fn ekrani_yayinla(&mut self, no: u64, g: u32, y: u32) {
        if self.paylasim.as_ref().is_none_or(|p| p.no != no) {
            return;
        }
        let mut s = PublishOptions::screen_share(VideoSourceConfig { width: g, height: y })
            .with_video_encoding(VideoEncodingLimits { max_bitrate_bps: Some(5_000_000), max_framerate: Some(30) });
        s.simulcast = false;
        match self.call.publish(s).await {
            Ok(iz) => {
                let Some(p) = self.paylasim.as_mut().filter(|p| p.no == no) else { return };
                tracing::info!("ekran yayında: {g}x{y}");
                *kilitle(&p.kare) = Some(iz);
                // The sounds only once the picture runs: a cancelled picker shares nothing. · Sesler ancak görüntü başlayınca: iptal edilen seçici hiçbir şey paylaşmaz.
                let u = std::mem::take(&mut p.istenen);
                self.sesleri_esitle(u).await;
            }
            Err(e) => {
                tracing::warn!("ekran yayımlanamadı: {e}");
                self.paylasimi_birak().await;
                self.paylasim_hatasi = true;
            }
        }
    }

    async fn paylasimi_birak(&mut self) {
        self.sesleri_esitle(vec![]).await;
        kilitle(kareler()).remove(ONIZLEME);
        if let Some(p) = self.paylasim.take() {
            p.yakalama.durdur();
            let iz = kilitle(&p.kare).take();
            if iz.is_some() {
                let _ = self.call.engine().unpublish(MediaStreamKind::ScreenShare).await;
            }
        }
    }

    /// Reads real WebRTC send counters for the active screen share without holding any lock across await.
    /// Etkin ekran paylaşımının gerçek WebRTC gönderim sayaçlarını await boyunca kilit tutmadan okur.
    async fn yayini_denetle(&mut self) {
        let Some((no, iz)) = self.paylasim.as_ref().and_then(|p| Some((p.no, kilitle(&p.kare).clone()?))) else {
            return;
        };
        let istatistik = iz.send_stats().await;
        let Some(p) = self.paylasim.as_mut().filter(|p| p.no == no) else {
            return;
        };
        let onceki_durum = p.yayin.durum;
        let simdi = Instant::now();
        let yeni = match istatistik {
            None => {
                p.onceki_bayt = None;
                p.bos_okuma = 0;
                YayinBilgisi { durum: "basliyor", kbps: 0, kare_hizi: 0, genislik: 0, yukseklik: 0 }
            }
            Some(st) => {
                let toplam_bayt: u64 = st.layers.iter().fold(0_u64, |t, l| t.saturating_add(l.bytes_sent));
                let kare_hizi = st
                    .layers
                    .iter()
                    .map(|l| l.frames_per_second)
                    .filter(|f| f.is_finite() && *f > 0.0)
                    .fold(0.0_f64, f64::max)
                    .round() as u32;
                let (genislik, yukseklik) = st
                    .layers
                    .iter()
                    .max_by_key(|l| u64::from(l.frame_width) * u64::from(l.frame_height))
                    .map(|l| (l.frame_width, l.frame_height))
                    .unwrap_or((0, 0));
                match p.onceki_bayt.replace((toplam_bayt, simdi)) {
                    None => {
                        p.bos_okuma = 0;
                        YayinBilgisi { durum: "basliyor", kbps: 0, kare_hizi, genislik, yukseklik }
                    }
                    Some((onceki, onceki_zaman)) => {
                        let fark = toplam_bayt.saturating_sub(onceki);
                        let sure_ms = simdi.duration_since(onceki_zaman).as_millis();
                        let kbps = if sure_ms > 0 {
                            ((u128::from(fark) * 8 + sure_ms / 2) / sure_ms).min(u128::from(u32::MAX)) as u32
                        } else {
                            0
                        };
                        let durum = if fark > 0 {
                            p.bos_okuma = 0;
                            "yayinda"
                        } else {
                            p.bos_okuma = p.bos_okuma.saturating_add(1);
                            if p.bos_okuma >= 3 { "gitmiyor" } else { onceki_durum }
                        };
                        YayinBilgisi { durum, kbps, kare_hizi, genislik, yukseklik }
                    }
                }
            }
        };
        p.yayin = yeni;
        if p.yayin.durum != onceki_durum {
            tracing::info!(
                "ekran yayını {onceki_durum}→{}: {} kbps, {} kare/sn, {}x{}",
                p.yayin.durum,
                p.yayin.kbps,
                p.yayin.kare_hizi,
                p.yayin.genislik,
                p.yayin.yukseklik,
            );
        }
    }

    async fn sesleri_esitle(&mut self, u: Vec<String>) {
        let Some(p) = self.paylasim.as_mut() else { return };
        // Still in the picker: remember. · Hâlâ seçicide: sakla.
        if kilitle(&p.kare).is_none() {
            p.istenen = u;
            return;
        }
        let gidecek: Vec<String> = p.uygulamalar.keys().filter(|a| !u.contains(a)).cloned().collect();
        let mut silinen = vec![];
        for a in gidecek {
            silinen.extend(p.uygulamalar.remove(&a));
        }
        let eklenecek: Vec<String> = u.into_iter().filter(|a| !p.uygulamalar.contains_key(a)).take(8).collect();
        for s in silinen {
            let _ = self.call.engine().unpublish(MediaStreamKind::AppAudio(s.no)).await;
            drop(s.iz);
        }
        for ad in eklenecek {
            // A number is never used twice, so a volume never moves to another application. · Numara iki kez kullanılmaz; düzey başka uygulamaya geçmez.
            let no = self.uygulama_no;
            self.uygulama_no += 1;
            let s = PublishOptions {
                kind: MediaStreamKind::AppAudio(no),
                audio: Some(AudioSourceConfig { sample_rate: ses::HIZ, num_channels: 2 }),
                ..PublishOptions::microphone()
            };
            match self.call.publish(s).await {
                Ok(iz) => {
                    let (rt, hedef) = (tokio::runtime::Handle::current(), iz.clone());
                    let kayit = UygulamaSesi::baslat(ad.clone(), move |v| {
                        rt.block_on(hedef.capture_audio(AudioFrame { data: v, sample_rate: ses::HIZ, num_channels: 2, samples_per_channel: ses::KARE as u32 })).is_ok()
                    });
                    tracing::info!("uygulama sesi yayında: {ad}");
                    if let Some(p) = self.paylasim.as_mut() {
                        p.uygulamalar.insert(ad, PaylasilanUygulama { no, iz, _ses: kayit });
                    }
                }
                Err(e) => tracing::warn!("{ad} sesi yayımlanamadı: {e}"),
            }
        }
        self.ad_gonderilen.clear();
    }

    // ---------- names · adlar ----------

    fn adlari_dinle(&self) -> matrix_sdk::event_handler::EventHandlerDropGuard {
        use matrix_sdk::{deserialized_responses::EncryptionInfo, ruma::{events::AnyToDeviceEvent, serde::Raw}};
        let (tx, oda) = (self.tx.clone(), self.oda.room_id().to_string());
        let client = self.oda.client();
        let h = client.add_event_handler(move |ev: Raw<AnyToDeviceEvent>, sifre: Option<EncryptionInfo>| {
            let (tx, oda) = (tx.clone(), oda.clone());
            async move {
                if ev.get_field::<String>("type").ok().flatten().as_deref() != Some(AD_OLAYI) {
                    return;
                }
                // Only encrypted ones count: the sender is then proven. · Yalnız şifreliler sayılır: gönderen o zaman kanıtlıdır.
                let Some(sifre) = sifre else { return };
                let Some(cihaz) = sifre.sender_device.as_ref().map(|d| d.to_string()) else { return };
                let Ok(Some(c)) = ev.get_field::<serde_json::Value>("content") else { return };
                if c["room_id"].as_str() != Some(&oda) {
                    return;
                }
                let adlar = c["names"].as_object().into_iter().flatten().take(16)
                    .filter_map(|(n, a)| Some((n.parse().ok()?, a.as_str()?.chars().filter(|c| !c.is_control()).take(60).collect())))
                    .collect();
                let _ = tx.send(Istek::Adlar(sifre.sender.to_string(), cihaz, adlar));
            }
        });
        client.event_handler_drop_guard(h)
    }

    /// Tells every device in the call what our application sounds are called, once each. · Aramadaki her cihaza uygulama seslerimizin adını bir kez söyler.
    async fn adlari_gonder(&mut self) {
        use matrix_sdk::{ruma::{events::AnyToDeviceEventContent, serde::Raw, DeviceId, UserId}};
        use matrix_sdk_base::crypto::CollectStrategy;
        let Some(p) = &self.paylasim else { return };
        let adlar: BTreeMap<String, &String> = p.uygulamalar.iter().map(|(a, s)| (s.no.to_string(), a)).collect();
        if adlar.is_empty() {
            return;
        }
        let hedefler: Vec<(String, String)> = self.call.participants().into_iter().filter(|k| !k.is_local)
            .filter_map(|k| Some((k.user_id, k.device_id?))).filter(|h| !self.ad_gonderilen.contains(h)).collect();
        if hedefler.is_empty() {
            return;
        }
        let icerik = serde_json::json!({ "room_id": self.oda.room_id(), "names": adlar });
        let Ok(ham) = Raw::new(&icerik).map(|r| r.cast_unchecked::<AnyToDeviceEventContent>()) else { return };
        let sifre = self.oda.client().encryption();
        // Only devices we know get the names, and only once it was really sent; the others are tried again on the next tick
        // (a newcomer's keys arrive a little later). · Adlar yalnızca bilinen cihazlara gider ve yalnızca gerçekten gönderilince
        // işaretlenir; ötekiler sonraki tikte yeniden denenir (yeni gelenin anahtarları biraz sonra gelir).
        let mut cihazlar = vec![];
        let mut bulunan = vec![];
        for (k, c) in &hedefler {
            if let Ok(ki) = UserId::parse(k) {
                if let Ok(Some(d)) = sifre.get_device(&ki, <&DeviceId>::from(c.as_str())).await {
                    cihazlar.push(d);
                    bulunan.push((k.clone(), c.clone()));
                }
            }
        }
        if cihazlar.is_empty() {
            return;
        }
        match sifre.encrypt_and_send_raw_to_device(cihazlar.iter().collect(), AD_OLAYI, ham, CollectStrategy::AllDevices).await {
            Ok(_) => self.ad_gonderilen.extend(bulunan),
            Err(e) => tracing::warn!("uygulama adları gönderilemedi: {e}"),
        }
    }

    // ---------- receiving · alma ----------

    fn alicilari_esitle(&mut self) {
        let olanlar: Vec<(String, MediaStreamKind)> = self.call.participants().iter().filter(|p| !p.is_local)
            .flat_map(|p| p.streams.iter().map(|s| (p.member_id.clone(), s.kind))).collect();
        self.alicilar.retain(|k, a| olanlar.contains(k) && !a.gorev.is_finished());
        for k in olanlar {
            if k.1 == MediaStreamKind::Data || self.alicilar.contains_key(&k) {
                continue;
            }
            // Announced but not subscribed yet: next tick. · Duyuruldu ama abonelik bekliyor: sonraki tik.
            let Some(iz) = self.call.remote_track(&k.0, k.1) else { continue };
            let anahtar = anahtar(&k.0, k.1);
            let alici = if let Some(mut akis) = iz.audio_frames() {
                let (karisim, ad) = (self.ses.karisim.clone(), anahtar.clone());
                let gorev = tokio::spawn(async move {
                    while let Some(f) = akis.next().await {
                        kilitle(&karisim).ekle(&ad, &ses::stereoya(&f.data, f.num_channels));
                    }
                });
                Alici { gorev, anahtar, karisim: Some(self.ses.karisim.clone()) }
            } else if let Some(mut akis) = iz.video_frames() {
                let kanal = Arc::new(watch::channel((0, None)).0);
                kilitle(kareler()).insert(anahtar.clone(), kanal.clone());
                let gorev = tokio::spawn(async move {
                    while let Some(f) = akis.next().await {
                        kanal.send_modify(|v| *v = (v.0 + 1, Some(Arc::new(f))));
                    }
                });
                Alici { gorev, anahtar, karisim: None }
            } else {
                continue;
            };
            self.alicilar.insert(k, alici);
        }
    }

    async fn profil(&mut self, id: &str) -> (String, Option<String>) {
        if let Some(p) = self.profiller.get(id) {
            return p.clone();
        }
        let uye = match matrix_sdk::ruma::UserId::parse(id) {
            Ok(u) => self.oda.get_member_no_sync(&u).await.ok().flatten(),
            Err(_) => None,
        };
        let p = match uye {
            Some(u) => (u.name().to_owned(), u.avatar_url().map(|a| a.to_string())),
            None => (id.trim_start_matches('@').split(':').next().unwrap_or(id).to_owned(), None),
        };
        self.profiller.insert(id.to_owned(), p.clone());
        p
    }

    fn sesleri(&self, p: &Participant) -> Vec<SesDurumu> {
        let k = kilitle(&self.ses.karisim);
        let adlar = p.device_id.clone().and_then(|c| self.adlar.get(&(p.user_id.clone(), c)));
        let mut l: Vec<_> = p.streams.iter().filter_map(|s| {
            let (tur, ad) = match s.kind {
                MediaStreamKind::Microphone => ("mikrofon", None),
                MediaStreamKind::ScreenShareAudio => ("ekran", None),
                MediaStreamKind::AppAudio(n) => ("uygulama", adlar.and_then(|a| a.get(&n)).cloned()),
                _ => return None,
            };
            let anahtar = anahtar(&p.member_id, s.kind);
            Some((s.kind, SesDurumu { duzey: k.duzey(&anahtar), anahtar, tur, ad }))
        }).collect();
        l.sort_by_key(|(t, _)| *t);
        l.into_iter().map(|(_, s)| s).collect()
    }

    async fn bildir(&mut self) {
        let mut katilimcilar = vec![];
        let uyeler = self.call.participants();
        let mut kopuk = false;
        for p in &uyeler {
            let (ad, avatar_mxc) = self.profil(&p.user_id).await;
            if p.is_local && p.connection == ConnectionState::Reconnecting {
                kopuk = true;
            }
            let var = |k| (!p.is_local && self.alicilar.contains_key(&(p.member_id.clone(), k))).then(|| anahtar(&p.member_id, k));
            let mik = p.streams.iter().find(|s| s.kind == MediaStreamKind::Microphone);
            katilimcilar.push(Katilimci {
                ekran: var(MediaStreamKind::ScreenShare),
                kamera: p.streams.iter().find(|s| s.kind == MediaStreamKind::Camera && !s.muted).and_then(|s| var(s.kind)),
                sesler: if p.is_local { vec![] } else { self.sesleri(p) },
                susturulmus: if p.is_local { self.kapali } else { mik.is_none_or(|s| s.muted) },
                konusuyor: self.konusan.contains(&p.member_id),
                sorun: match (p.is_local, p.unable_to_decrypt, p.connection) {
                    (true, ..) => None,
                    (_, Some(UnableToDecrypt::NotEncrypted), _) => Some("dogrulanmamis"),
                    (_, Some(_), _) => Some("cozulemiyor"),
                    (_, _, ConnectionState::Connected) => None,
                    _ => Some("baglaniyor"),
                },
                uye: p.member_id.clone(),
                kullanici_id: p.user_id.clone(),
                ad,
                avatar_mxc,
                ben: p.is_local,
            });
        }
        let asama = match self.call.status() {
            _ if kopuk => "koptu",
            CallStatus::Connected { .. } => "acik",
            CallStatus::Calling { .. } => "caliyor",
            _ if self.mikrofon.is_some() => "acik",
            _ => "baglaniyor",
        };
        let (paylasim, onizleme, yayin) = match &self.paylasim {
            None => ("yok", None, None),
            Some(p) if kilitle(&p.kare).is_some() => ("acik", Some(ONIZLEME.to_owned()), Some(p.yayin.clone())),
            Some(_) => ("seciliyor", Some(ONIZLEME.to_owned()), None),
        };
        let d = YerelDurum {
            oda_id: self.oda.room_id().to_string(), asama, neden: None, katilimcilar, mikrofon_kapali: self.kapali,
            paylasim,
            paylasilan: self.paylasim.iter().flat_map(|p| p.uygulamalar.keys().cloned()).collect(),
            paylasim_hatasi: self.paylasim_hatasi,
            onizleme,
            yayin,
        };
        if self.son.as_ref() != Some(&d) {
            let _ = self.app.emit(OLAY, &d);
            self.son = Some(d);
        }
    }
}

/// Name of one sound or picture, the same for the mixer, the screen and the commands. · Bir sesin ya da görüntünün adı; karıştırıcı, ekran ve komutlarda aynı.
fn anahtar(uye: &str, k: MediaStreamKind) -> String {
    match k {
        MediaStreamKind::AppAudio(n) => format!("{uye}|uygulama-{n}"),
        MediaStreamKind::Microphone => format!("{uye}|mikrofon"),
        MediaStreamKind::ScreenShareAudio => format!("{uye}|ekran-ses"),
        MediaStreamKind::ScreenShare => format!("{uye}|ekran"),
        MediaStreamKind::Camera => format!("{uye}|kamera"),
        MediaStreamKind::Data => format!("{uye}|veri"),
    }
}
