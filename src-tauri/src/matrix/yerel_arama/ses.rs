//! Sound of native calls: microphone, playback mixer and capture of single applications.
//! Linux: everything goes through `parec` / `pacat` / `pactl` (in the GNOME runtime): the only tools that can record ONE application's stream.
//! Android: the microphone and the player are AudioRecord / AudioTrack (AramaSesi.kt, through android_jni); sharing an app's sound does not exist.
//! Yerel aramaların sesi: mikrofon, çalma karıştırıcısı ve tek tek uygulamaların yakalanması.
//! Linux: hepsi `parec` / `pacat` / `pactl` ile (GNOME çalışma ortamında var): TEK uygulamanın akışını kaydedebilen araçlar bunlar.
//! Android: mikrofon ve çalar AudioRecord / AudioTrack'tir (AramaSesi.kt, android_jni üzerinden); uygulama sesi paylaşımı yok.

use std::collections::{BTreeMap, HashMap, VecDeque};
#[cfg(target_os = "linux")]
use std::io::{Read, Write};
#[cfg(target_os = "linux")]
use std::os::fd::AsRawFd;
#[cfg(target_os = "linux")]
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::Relaxed};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;
#[cfg(target_os = "linux")]
use std::time::Instant;

use libwebrtc::native::apm::AudioProcessingModule;

pub const HIZ: u32 = 48_000;
/// Samples per channel in 10 ms, the unit of the engine and of the echo canceller. · 10 ms'deki kanal başına örnek; motorun ve yankı gidericinin birimi.
pub const KARE: usize = HIZ as usize / 100;
#[cfg(target_os = "linux")]
/// Our own streams are never offered or shared (that would send the call back into itself). · Kendi akışlarımız sunulmaz ve paylaşılmaz (arama kendine geri dönerdi).
const BIZ: &str = "rubychat";
/// A source that falls behind is cut back to this much, so delay cannot pile up. · Geride kalan kaynak buna indirilir; gecikme birikmesin.
const TAMPON_AZAMI: usize = HIZ as usize * 2 / 1000 * 200;
const TAMPON_HEDEF: usize = HIZ as usize * 2 / 1000 * 60;

pub fn kilitle<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// WebRTC's audio processing (echo, noise, gain) is internally locked; the binding only lacks the marker.
/// WebRTC'nin ses işlemesi (yankı, gürültü, kazanç) içeride kilitlidir; bağda yalnızca işaret eksik.
struct Apm(AudioProcessingModule);
// SAFETY: used only behind the Mutex below. · GÜVENLİK: yalnızca aşağıdaki Mutex'in arkasında kullanılır.
unsafe impl Send for Apm {}

#[derive(Clone, PartialEq, Eq)]
pub struct SesAyari {
    pub giris: Option<String>,
    pub cikis: Option<String>,
    pub gurultu: bool,
}

#[derive(Clone, Copy)]
pub struct AyarDegisimi {
    pub giris: bool,
    pub cikis: bool,
    pub gurultu: bool,
}

/// Process-wide audio preferences: read when a call opens and updated live if one is running.
/// Süreç geneli ses tercihleri: arama açılırken okunur ve süren varsa canlı güncellenir.
static AYAR: Mutex<SesAyari> = Mutex::new(SesAyari { giris: None, cikis: None, gurultu: true });

pub fn ayar_oku() -> SesAyari {
    kilitle(&AYAR).clone()
}

/// Stores the latest audio settings and returns which fields actually changed.
/// Son ses ayarlarını kaydeder ve gerçekten hangi alanların değiştiğini döndürür.
pub fn ayar_yaz(giris: Option<String>, cikis: Option<String>, gurultu: bool) -> AyarDegisimi {
    let yeni = SesAyari {
        giris: giris.filter(|s| !s.is_empty()),
        cikis: cikis.filter(|s| !s.is_empty()),
        gurultu,
    };
    let mut a = kilitle(&AYAR);
    let degisim = AyarDegisimi {
        giris: a.giris != yeni.giris,
        cikis: a.cikis != yeni.cikis,
        gurultu: a.gurultu != yeni.gurultu,
    };
    *a = yeni;
    degisim
}

/// Echo cancellation, gain control and high-pass filter stay enabled; only noise suppression is user-configurable.
/// Yankı giderme, kazanç denetimi ve yüksek geçiren süzgeç hep açıktır; yalnız gürültü engelleme kullanıcıya açıktır.
fn apm_kur(gurultu: bool) -> Apm {
    let mut apm = AudioProcessingModule::new(true, true, true, gurultu);
    let _ = apm.set_stream_delay_ms(80);
    Apm(apm)
}

#[cfg(target_os = "linux")]
/// Kills the child when dropped, so no recorder survives the call. · Düşünce süreci öldürür; aramadan sonra kayıtçı kalmasın.
struct Surec(Child);
#[cfg(target_os = "linux")]
type Calar = Surec;
#[cfg(target_os = "linux")]
impl Drop for Surec {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[cfg(target_os = "linux")]
fn komut(ad: &str, args: &[String]) -> Command {
    let mut k = Command::new(ad);
    // C locale: numbers with a dot, English messages. · C yerel ayarı: noktalı sayılar, İngilizce iletiler.
    k.args(args).env("LC_ALL", "C").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    k
}

#[cfg(target_os = "linux")]
fn bicim(kanal: u32, gecikme_ms: u32) -> Vec<String> {
    [
        "--raw".into(),
        format!("--rate={HIZ}"),
        format!("--channels={kanal}"),
        "--format=s16le".into(),
        format!("--latency-msec={gecikme_ms}"),
        format!("--client-name={BIZ}"),
        "--stream-name=rubychat".into(),
        "--property=application.id=dev.rubyyard.rubychat".into(),
        "--property=media.role=phone".into(),
    ]
    .into()
}

#[cfg(target_os = "linux")]
/// The same data as `pipe(2)` would buffer, but short: a full 64 KiB pipe would be a third of a second of delay.
/// `pipe(2)` tamponu, ama kısa: dolu 64 KiB'lik boru üçte bir saniye gecikme demekti.
fn boruyu_kisalt(fd: &impl AsRawFd) {
    // SAFETY: plain fcntl on an open descriptor. · GÜVENLİK: açık tanıtıcıda sıradan fcntl.
    unsafe { libc::fcntl(fd.as_raw_fd(), libc::F_SETPIPE_SZ, 4096) };
}

#[cfg(target_os = "linux")]
fn ornekler(b: &[u8]) -> impl Iterator<Item = i16> + '_ {
    b.chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]]))
}

/// Anything to two interleaved channels. · Her şeyi iki iç içe kanala çevirir.
pub fn stereoya(veri: &[i16], kanal: u32) -> Vec<i16> {
    match kanal {
        1 => veri.iter().flat_map(|&s| [s, s]).collect(),
        2 => veri.to_vec(),
        n => veri.chunks_exact(n.max(1) as usize).flat_map(|c| [c[0], c[1.min(c.len() - 1)]]).collect(),
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Mixer · Karıştırıcı
// ---------------------------------------------------------------------------------------------------------------------

#[derive(Default)]
struct Kaynak {
    tampon: VecDeque<i16>,
    /// Playing only after a small cushion, so network jitter does not crackle. · Küçük bir yastıktan sonra çalar; ağ dalgalanması çıtırdamasın.
    hazir: bool,
}

/// Every sound of the call by name, each with its own volume (1.0 = as sent). · Aramadaki her ses adıyla ve kendi düzeyiyle (1,0 = geldiği gibi).
#[derive(Default)]
pub struct Karistirici {
    kaynaklar: HashMap<String, Kaynak>,
    duzeyler: HashMap<String, f32>,
}

impl Karistirici {
    pub fn ekle(&mut self, ad: &str, stereo: &[i16]) {
        let k = self.kaynaklar.entry(ad.to_owned()).or_default();
        k.tampon.extend(stereo);
        if k.tampon.len() > TAMPON_AZAMI {
            let fazla = k.tampon.len() - TAMPON_HEDEF;
            k.tampon.drain(..fazla);
        }
    }

    pub fn sil(&mut self, ad: &str) {
        self.kaynaklar.remove(ad);
    }

    pub fn duzey_ver(&mut self, ad: &str, d: f32) {
        self.duzeyler.insert(ad.to_owned(), if d.is_finite() { d.clamp(0.0, 2.0) } else { 1.0 });
    }

    pub fn duzey(&self, ad: &str) -> f32 {
        self.duzeyler.get(ad).copied().unwrap_or(1.0)
    }

    /// The next 10 ms in stereo. · Sıradaki 10 ms, stereo.
    pub fn sonraki(&mut self) -> Vec<i16> {
        let mut toplam = vec![0.0f32; KARE * 2];
        for (ad, k) in &mut self.kaynaklar {
            if !k.hazir {
                k.hazir = k.tampon.len() >= KARE * 2 * 3;
            }
            if !k.hazir {
                continue;
            }
            let d = self.duzeyler.get(ad).copied().unwrap_or(1.0);
            let n = k.tampon.len().min(KARE * 2);
            for (t, s) in toplam.iter_mut().zip(k.tampon.drain(..n)) {
                *t += s as f32 * d;
            }
            k.hazir = n == KARE * 2;
        }
        toplam.into_iter().map(|t| t.clamp(i16::MIN as f32, i16::MAX as f32) as i16).collect()
    }
}

/// Plays the mix until dropped. Also the reference the echo canceller needs. · Düşene kadar karışımı çalar; yankı gidericinin başvurusu da budur.
pub struct Ses {
    pub karisim: Arc<Mutex<Karistirici>>,
    apm: Arc<Mutex<Apm>>,
    dur: Arc<AtomicBool>,
    /// The player, held here so dropping `Ses` kills it: a write stuck on a stalled sound server then wakes with an error.
    /// Çalar; burada tutulur ki `Ses` düşünce ölsün: takılan ses sunucusunda bekleyen yazma o zaman hatayla uyanır.
    calar: Arc<Mutex<Option<Calar>>>,
    /// Peak processed microphone level (f32 bits in 0..=1) since the last UI tick.
    /// Son arayüz tikinden bu yana işlenmiş en yüksek mikrofon seviyesi (0..=1 aralığında f32 bitleri).
    seviye: Arc<AtomicU32>,
}

impl Ses {
    pub fn baslat() -> Ses {
        let apm = apm_kur(ayar_oku().gurultu);
        let s = Ses {
            karisim: Arc::default(),
            apm: Arc::new(Mutex::new(apm)),
            dur: Arc::default(),
            calar: Arc::default(),
            seviye: Arc::default(),
        };
        let (karisim, apm, dur, calar) = (s.karisim.clone(), s.apm.clone(), s.dur.clone(), s.calar.clone());
        thread::spawn(move || {
            while !dur.load(Relaxed) {
                if let Err(e) = cal(&karisim, &apm, &dur, &calar) {
                    tracing::warn!("arama sesi çalınamadı: {e}");
                    thread::sleep(Duration::from_millis(500));
                }
            }
        });
        s
    }

    /// Applies a live audio-setting change to the running APM and (on Linux) output player.
    /// Canlı ses ayarı değişimini süren APM'ye ve (Linux'ta) çıkış çalarına uygular.
    pub fn ayar_uygula(&self, d: AyarDegisimi) {
        if d.gurultu {
            *kilitle(&self.apm) = apm_kur(ayar_oku().gurultu);
        }
        #[cfg(target_os = "linux")]
        if d.cikis {
            // Dropping the player breaks `pacat`'s pipe so `cal()` immediately reopens it with the new device.
            // Çaları düşürmek `pacat` borusunu keser; `cal()` yeni aygıtla hemen yeniden açar.
            *kilitle(&self.calar) = None;
        }
        #[cfg(not(target_os = "linux"))]
        let _ = d.cikis;
    }

    /// Opens the microphone; `al` gets 10 ms of processed mono at a time. · Mikrofonu açar; `al` her seferinde işlenmiş 10 ms mono alır.
    pub fn mikrofon(&self, al: impl FnMut(Vec<i16>) -> bool + Send + 'static) -> Kayit {
        let apm = self.apm.clone();
        let seviye = self.seviye.clone();
        let mut al = al;
        Kayit::baslat(vec![], 1, 20, false, move |mut v| {
            if let Err(e) = kilitle(&apm).0.process_stream(&mut v, HIZ as i32, 1) {
                tracing::debug!("ses işlemesi: {}", e.message);
            }
            let tepe = v.iter().map(|&s| s.unsigned_abs()).max().unwrap_or(0);
            let oran = (tepe as f32 / i16::MAX as f32).min(1.0);
            // Non-negative finite f32 bit patterns share u32 ordering, so fetch_max keeps the window's true peak.
            // Negatif olmayan sonlu f32 bitleri u32 sırasıyla aynıdır; fetch_max aralığın gerçek tepesini tutar.
            seviye.fetch_max(oran.to_bits(), Relaxed);
            al(v)
        })
    }

    /// Reads the peak microphone level (0..1) accumulated since the last call and resets it to 0.
    /// Son çağrıdan bu yana biriken en yüksek mikrofon seviyesini (0..1) okur ve 0'a çeker.
    pub fn seviye_al(&self) -> f32 {
        f32::from_bits(self.seviye.swap(0, Relaxed))
    }
}

impl Drop for Ses {
    fn drop(&mut self) {
        self.dur.store(true, Relaxed);
        *kilitle(&self.calar) = None;
    }
}

#[cfg(target_os = "linux")]
fn cal(karisim: &Mutex<Karistirici>, apm: &Mutex<Apm>, dur: &AtomicBool, calar: &Mutex<Option<Surec>>) -> std::io::Result<()> {
    let secili = ayar_oku().cikis;
    let mut args = bicim(2, 40);
    if let Some(cikis) = &secili {
        args.push(format!("--device={cikis}"));
    }
    let mut surec = Surec(komut("pacat", &args).stdin(Stdio::piped()).spawn()?);
    let mut giris = surec.0.stdin.take().ok_or(std::io::ErrorKind::BrokenPipe)?;
    boruyu_kisalt(&giris);
    *kilitle(calar) = Some(surec);
    // Dropped or switched output meanwhile: do not run a stale player. · Bu arada düştü ya da çıkış değişti: eski çaları sürdürme.
    if dur.load(Relaxed) || ayar_oku().cikis != secili {
        *kilitle(calar) = None;
        return Ok(());
    }
    // The write blocks until the sound card has played: the card sets the pace. · Yazma, ses kartı çalana kadar bekler: tempoyu kart belirler.
    while !dur.load(Relaxed) {
        let mut kare = kilitle(karisim).sonraki();
        let baytlar: Vec<u8> = kare.iter().flat_map(|s| s.to_le_bytes()).collect();
        let _ = kilitle(apm).0.process_reverse_stream(&mut kare, HIZ as i32, 2);
        if let Err(e) = giris.write_all(&baytlar) {
            return if dur.load(Relaxed) || ayar_oku().cikis != secili { Ok(()) } else { Err(e) };
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
/// A running recording; dropping it stops it. · Süren kayıt; düşünce durur.
pub struct Kayit {
    dur: Arc<AtomicBool>,
    surec: Arc<Mutex<Option<Surec>>>,
}

#[cfg(target_os = "linux")]
impl Kayit {
    fn baslat(ek: Vec<String>, kanal: u32, gecikme: u32, tekil: bool, mut al: impl FnMut(Vec<i16>) -> bool + Send + 'static) -> Kayit {
        let k = Kayit { dur: Arc::default(), surec: Arc::default() };
        let (dur, yuva) = (k.dur.clone(), k.surec.clone());
        thread::spawn(move || {
            while !dur.load(Relaxed) {
                let mut args = bicim(kanal, gecikme);
                args.extend(ek.iter().cloned());
                if !tekil {
                    if let Some(giris) = ayar_oku().giris {
                        args.push(format!("--device={giris}"));
                    }
                }
                match komut("parec", &args).stdout(Stdio::piped()).spawn() {
                    Ok(mut s) => {
                        let cikis = s.stdout.take();
                        *kilitle(&yuva) = Some(Surec(s));
                        // Stopped between the check and the store. · Denetimle kayıt arasında durduruldu.
                        if dur.load(Relaxed) {
                            break;
                        }
                        if let Some(mut c) = cikis {
                            let mut b = vec![0u8; KARE * kanal as usize * 2];
                            while !dur.load(Relaxed) && c.read_exact(&mut b).is_ok() {
                                if !al(ornekler(&b).collect()) {
                                    dur.store(true, Relaxed);
                                }
                            }
                        }
                        *kilitle(&yuva) = None;
                    }
                    Err(e) => tracing::warn!("ses kaydı açılamadı: {e}"),
                }
                // One application's stream that ended will not come back under the same number. · Biten uygulama akışı aynı numarayla geri gelmez.
                if tekil {
                    break;
                }
                thread::sleep(Duration::from_millis(300));
            }
            *kilitle(&yuva) = None;
        });
        k
    }
}

#[cfg(target_os = "linux")]
impl Drop for Kayit {
    fn drop(&mut self) {
        self.dur.store(true, Relaxed);
        *kilitle(&self.surec) = None;
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Sounds of applications · Uygulamaların sesleri
// ---------------------------------------------------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn akislari_oku(json: &str) -> BTreeMap<String, Vec<u32>> {
    let mut m: BTreeMap<String, Vec<u32>> = BTreeMap::new();
    let Ok(serde_json::Value::Array(l)) = serde_json::from_str(json) else { return m };
    for a in l {
        let Some(no) = a["index"].as_u64().and_then(|n| u32::try_from(n).ok()) else { continue };
        let oz = &a["properties"];
        let biz = ["application.name", "application.id", "application.process.binary", "pipewire.access.portal.app_id", "media.name"]
            .iter()
            .any(|k| oz[*k].as_str().is_some_and(|v| v.to_ascii_lowercase().contains(BIZ)));
        let ad = ["application.name", "application.process.binary", "media.name"].iter().find_map(|k| oz[*k].as_str().map(str::trim).filter(|v| !v.is_empty()));
        if let (false, Some(ad)) = (biz, ad) {
            m.entry(ad.chars().take(60).collect()).or_default().push(no);
        }
    }
    m
}

#[cfg(target_os = "linux")]
fn aygitlari_oku(json: &str, monitor_at: bool) -> Vec<super::SesAygiti> {
    let Ok(serde_json::Value::Array(l)) = serde_json::from_str(json) else { return vec![] };
    let mut cikis = vec![];
    for a in l {
        let Some(ad) = a["name"].as_str().map(str::trim).filter(|s| !s.is_empty()) else { continue };
        if monitor_at {
            // Exclude sink monitors so the user does not pick loopback audio as their microphone.
            // Çıkış monitörlerini hariç tut ki kullanıcı geri döngü sesini mikrofon diye seçmesin.
            let monitor = ad.ends_with(".monitor")
                || a.get("monitor_of_sink").is_some_and(|v| match v {
                    serde_json::Value::Null => false,
                    serde_json::Value::String(s) => !s.is_empty() && s != "n/a",
                    _ => true,
                });
            if monitor {
                continue;
            }
        }
        let aciklama = a["description"].as_str().map(str::trim).filter(|s| !s.is_empty()).unwrap_or(ad);
        cikis.push(super::SesAygiti { ad: ad.to_owned(), aciklama: aciklama.to_owned() });
    }
    cikis
}

#[cfg(target_os = "linux")]
fn pactl_cikti(args: &[&str]) -> Option<String> {
    let a: Vec<String> = args.iter().map(|s| (*s).to_owned()).collect();
    match komut("pactl", &a).stdout(Stdio::piped()).output() {
        Ok(c) if c.status.success() => Some(String::from_utf8_lossy(&c.stdout).into_owned()),
        Ok(c) => {
            tracing::warn!("pactl {:?}: çıkış {}", args, c.status);
            None
        }
        Err(e) => {
            tracing::warn!("pactl {:?}: {e}", args);
            None
        }
    }
}

#[cfg(target_os = "linux")]
/// Lists available PulseAudio / PipeWire input sources (excluding monitors) and output sinks.
/// Kullanılabilir PulseAudio / PipeWire giriş kaynaklarını (monitörler hariç) ve çıkış aygıtlarını listeler.
pub fn aygitlar() -> super::SesAygitlari {
    let girisler = pactl_cikti(&["-f", "json", "list", "sources"])
        .map(|j| aygitlari_oku(&j, true))
        .unwrap_or_default();
    let cikislar = pactl_cikti(&["-f", "json", "list", "sinks"])
        .map(|j| aygitlari_oku(&j, false))
        .unwrap_or_default();
    let varsayilan_giris = pactl_cikti(&["get-default-source"])
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty());
    let varsayilan_cikis = pactl_cikti(&["get-default-sink"])
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty());
    super::SesAygitlari { girisler, cikislar, varsayilan_giris, varsayilan_cikis }
}

#[cfg(target_os = "linux")]
/// Applications making sound now, with their streams. · Şu an ses çıkaran uygulamalar ve akışları.
pub fn uygulamalar() -> BTreeMap<String, Vec<u32>> {
    let args: Vec<String> = ["-f", "json", "list", "sink-inputs"].map(String::from).into();
    match komut("pactl", &args).stdout(Stdio::piped()).output() {
        Ok(c) => akislari_oku(&String::from_utf8_lossy(&c.stdout)),
        Err(e) => {
            tracing::warn!("pactl: {e}");
            BTreeMap::new()
        }
    }
}

#[cfg(target_os = "linux")]
/// One application's sound, following its streams as they come and go (a new song is a new stream). Dropping it stops it.
/// Bir uygulamanın sesi; akışları gelip gittikçe izler (yeni şarkı yeni akıştır). Düşünce durur.
pub struct UygulamaSesi {
    dur: Arc<AtomicBool>,
    /// Held here too so dropping stops the recorders at once, not after the watcher's next round.
    /// Burada da tutulur ki düşünce kayıtlar izleyicinin sonraki turunu beklemeden hemen dursun.
    kayitlar: Arc<Mutex<HashMap<u32, Kayit>>>,
}

#[cfg(target_os = "linux")]
impl UygulamaSesi {
    pub fn baslat(ad: String, mut al: impl FnMut(Vec<i16>) -> bool + Send + 'static) -> UygulamaSesi {
        let dur = Arc::new(AtomicBool::new(false));
        let d = dur.clone();
        let kayitlar_dis: Arc<Mutex<HashMap<u32, Kayit>>> = Arc::default();
        let izle_kayitlar = kayitlar_dis.clone();
        thread::spawn(move || {
            let karisim: Arc<Mutex<Karistirici>> = Arc::default();
            let izle_dur = d.clone();
            let izle_karisim = karisim.clone();
            thread::spawn(move || {
                while !izle_dur.load(Relaxed) {
                    let simdi = uygulamalar().remove(&ad).unwrap_or_default();
                    // Dropped while pactl ran: start nothing new. · pactl sürerken düştü: yeni bir şey başlatma.
                    if izle_dur.load(Relaxed) {
                        break;
                    }
                    let mut kayitlar = kilitle(&izle_kayitlar);
                    kayitlar.retain(|no, _| simdi.contains(no));
                    for no in simdi {
                        kayitlar.entry(no).or_insert_with(|| {
                            let (k, anahtar) = (izle_karisim.clone(), no.to_string());
                            Kayit::baslat(vec![format!("--monitor-stream={no}")], 2, 20, true, move |v| {
                                kilitle(&k).ekle(&anahtar, &v);
                                true
                            })
                        });
                    }
                    kilitle(&izle_karisim).kaynaklar.retain(|ad, _| ad.parse().is_ok_and(|no| kayitlar.contains_key(&no)));
                    drop(kayitlar);
                    for _ in 0..10 {
                        if izle_dur.load(Relaxed) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(100));
                    }
                }
            });
            let mut sira = Instant::now();
            while !d.load(Relaxed) {
                let kare = kilitle(&karisim).sonraki();
                if !al(kare) {
                    d.store(true, Relaxed);
                }
                sira += Duration::from_millis(10);
                let simdi = Instant::now();
                if sira > simdi {
                    thread::sleep(sira - simdi);
                } else if simdi - sira > Duration::from_millis(200) {
                    sira = simdi;
                }
            }
        });
        UygulamaSesi { dur, kayitlar: kayitlar_dis }
    }
}

#[cfg(target_os = "linux")]
impl Drop for UygulamaSesi {
    fn drop(&mut self) {
        self.dur.store(true, Relaxed);
        kilitle(&self.kayitlar).clear();
    }
}


// ---------------------------------------------------------------------------------------------------------------------
// Android: AudioTrack / AudioRecord (AramaSesi.kt) · Android: AudioTrack / AudioRecord (AramaSesi.kt)
// ---------------------------------------------------------------------------------------------------------------------

/// The open player; dropping it stops the track, which also wakes a write that is waiting. · Açık çalar; düşünce parça durur, bekleyen yazma da uyanır.
#[cfg(target_os = "android")]
struct Calar(i32);
#[cfg(target_os = "android")]
impl Drop for Calar {
    fn drop(&mut self) {
        // Closes only this player's own id: a newer call's player stays. · Yalnızca bu çalarınki: daha yeni aramanın çalarına dokunulmaz.
        crate::android_jni::arama_sesi_cal_kapat(self.0);
    }
}

#[cfg(target_os = "android")]
fn cal(karisim: &Mutex<Karistirici>, apm: &Mutex<Apm>, dur: &AtomicBool, calar: &Mutex<Option<Calar>>) -> std::io::Result<()> {
    let hata = |e: String| std::io::Error::other(e);
    let id = crate::android_jni::arama_sesi_cal_ac().map_err(hata)?;
    *kilitle(calar) = Some(Calar(id));
    if dur.load(Relaxed) {
        *kilitle(calar) = None;
        return Ok(());
    }
    // Same as pacat: the blocking write lets the device set the pace. · pacat gibi: bekleyen yazma tempoyu cihaza bıraktırır.
    let sonuc = crate::android_jni::arama_sesi_cal_dongusu(id, dur, || {
        let mut kare = kilitle(karisim).sonraki();
        let cikan = kare.clone();
        let _ = kilitle(apm).0.process_reverse_stream(&mut kare, HIZ as i32, 2);
        cikan
    });
    *kilitle(calar) = None;
    sonuc.map_err(hata)
}

/// The running microphone; dropping it stops it. · Süren mikrofon; düşünce durur.
#[cfg(target_os = "android")]
pub struct Kayit {
    dur: Arc<AtomicBool>,
    /// Id of the microphone the loop has open right now (0 = none); `drop` closes exactly that one.
    /// Döngünün şu an açık tuttuğu mikrofonun kimliği (0 = yok); `drop` tam onu kapatır.
    id: Arc<std::sync::atomic::AtomicI32>,
}

#[cfg(target_os = "android")]
impl Kayit {
    /// Only the microphone exists here (mono); `ek` (an application stream) is never asked for on Android. · Burada yalnız mikrofon var (mono).
    fn baslat(_ek: Vec<String>, _kanal: u32, _gecikme: u32, _tekil: bool, mut al: impl FnMut(Vec<i16>) -> bool + Send + 'static) -> Kayit {
        let k = Kayit { dur: Arc::default(), id: Arc::default() };
        let dur = k.dur.clone();
        let id = k.id.clone();
        thread::spawn(move || {
            while !dur.load(Relaxed) {
                // Fails while the microphone permission is not granted yet: try again shortly. · Mikrofon izni henüz yokken başarısız olur: az sonra yeniden dene.
                if let Err(e) = crate::android_jni::arama_sesi_kayit_dongusu(&dur, &id, KARE, &mut al) {
                    tracing::warn!("ses kaydı açılamadı: {e}");
                }
                if !dur.load(Relaxed) {
                    thread::sleep(Duration::from_millis(300));
                }
            }
        });
        k
    }
}

#[cfg(target_os = "android")]
impl Drop for Kayit {
    fn drop(&mut self) {
        self.dur.store(true, Relaxed);
        let id = self.id.swap(0, std::sync::atomic::Ordering::SeqCst);
        if id > 0 {
            crate::android_jni::arama_sesi_kayit_kapat(id);
        }
    }
}

/// Android routes audio through SesKoprusu in the UI, so no OS device list is exposed here.
/// Android sesi arayüzdeki SesKoprusu ile yönlendirir; burada aygıt listesi döndürülmez.
#[cfg(target_os = "android")]
pub fn aygitlar() -> super::SesAygitlari {
    super::SesAygitlari::default()
}

/// No per-application sound on Android. · Android'de uygulama başına ses yok.
#[cfg(target_os = "android")]
pub fn uygulamalar() -> BTreeMap<String, Vec<u32>> {
    BTreeMap::new()
}

#[cfg(target_os = "android")]
pub struct UygulamaSesi;

#[cfg(target_os = "android")]
impl UygulamaSesi {
    pub fn baslat(_ad: String, _al: impl FnMut(Vec<i16>) -> bool + Send + 'static) -> UygulamaSesi {
        UygulamaSesi
    }
}

#[cfg(target_os = "linux")]
#[cfg(test)]
mod testler {
    use super::*;

    #[test]
    fn duzeyler_ayridir() {
        let mut k = Karistirici::default();
        k.ekle("a", &vec![1000; KARE * 2 * 4]);
        k.ekle("b", &vec![100; KARE * 2 * 4]);
        assert!(k.sonraki().iter().all(|&s| s == 1100));
        k.duzey_ver("a", 0.0);
        assert!(k.sonraki().iter().all(|&s| s == 100));
        k.duzey_ver("b", 2.0);
        assert!(k.sonraki().iter().all(|&s| s == 200));
        k.duzey_ver("b", f32::NAN);
        assert_eq!(k.duzey("b"), 1.0);
    }

    #[test]
    fn gecikme_birikmez() {
        let mut k = Karistirici::default();
        for _ in 0..100 {
            k.ekle("a", &vec![1; KARE * 2]);
        }
        assert!(k.kaynaklar["a"].tampon.len() <= TAMPON_AZAMI);
    }

    #[test]
    fn kendi_sesimiz_listede_yok() {
        let j = r#"[{"index":4,"properties":{"application.name":"Firefox"}},{"index":5,"properties":{"application.name":"Firefox"}},
            {"index":6,"properties":{"application.name":"rubychat"}},{"index":7,"properties":{"application.name":"WebKit","pipewire.access.portal.app_id":"dev.rubyyard.rubychat"}}]"#;
        let m = akislari_oku(j);
        assert_eq!(m.len(), 1);
        assert_eq!(m["Firefox"], vec![4, 5]);
        assert!(akislari_oku("bozuk").is_empty());
    }

    #[test]
    fn aygit_listesi_monitorleri_atar() {
        let j = r#"[
            {"name":"alsa_input.mic","description":"USB Mic","monitor_of_sink":null},
            {"name":"alsa_input.mic2","description":"Internal Mic","monitor_of_sink":"n/a"},
            {"name":"alsa_output.spk.monitor","description":"Monitor of Speaker","monitor_of_sink":"alsa_output.spk"},
            {"name":"virtual.loop","description":"Loop","monitor_of_sink":"alsa_output.spk"}
        ]"#;
        let g = aygitlari_oku(j, true);
        assert_eq!(g.len(), 2);
        assert_eq!(g[0].ad, "alsa_input.mic");
        assert_eq!(g[0].aciklama, "USB Mic");
        assert_eq!(g[1].ad, "alsa_input.mic2");
    }
}
