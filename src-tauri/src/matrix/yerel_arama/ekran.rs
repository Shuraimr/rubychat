//! Screen capture (xdg-desktop-portal + PipeWire), BGRA to I420 conversion, downscaling to 1080p30.
//! Ekran yakalama (xdg-desktop-portal + PipeWire), BGRA'dan I420'ye dönüştürme, 1080p30'a küçültme.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, TryLockError};
use std::thread;
use std::time::{Duration, Instant};

use libwebrtc::desktop_capturer::{
    CaptureError, DesktopCaptureSourceType, DesktopCapturer, DesktopCapturerOptions, DesktopFrame,
};
use libwebrtc::native::yuv_helper;
use libwebrtc::video_frame::{I420Buffer, VideoBuffer};
use matrix_rtc_transport::{VideoFrame, VideoRotation};

type KareAlici = Arc<dyn Fn(VideoFrame) + Send + Sync>;

// Maximum output dimensions required by the prototype specification (1080p cap).
// Prototip gereksinimlerinin belirledigi azami cikti boyutlari (1080p siniri).
const AZAMI_GENISLIK: u32 = 1920;
const AZAMI_YUKSEKLIK: u32 = 1080;

// Target frame interval for the 30 fps cap (~33.333 ms) and small jitter tolerance so paced
// 30 fps sources are not halved by OS timer wake jitter while 60+ Hz sources stay capped.
// 30 fps ust siniri icin hedef kare araligi (~33.333 ms) ve isletim sistemi zamanlayici
// sapmalarinin 30 fps kaynaklari yariya dusurmemesi, 60+ Hz kaynaklarin ise sinirlanmasi
// icin kucuk sapma toleransi.
const KARE_ARALIGI: Duration = Duration::from_nanos(33_333_333);
const KARE_SAPMA_TOLERANSI: Duration = Duration::from_millis(2);

// Re-send interval for static Wayland screens where the compositor emits no new frames.
// Bilesen yoneticisinin yeni kare gondermedigi duragan Wayland ekranlari icin tekrar suresi.
const DURAGAN_TEKRAR_ARALIGI: Duration = Duration::from_secs(1);

/// Lifecycle events emitted by a capture session.
/// Bir yakalama oturumunun urettigi yasam dongusu olaylari.
pub enum YakalamaOlayi {
    /// Sent once on the first valid converted frame, carrying its size.
    /// Ilk gecerli donusturulmus karede bir kez gonderilir ve boyutunu tasir.
    Hazir(u32, u32),
    /// Sent once on a permanent error (such as portal cancellation or missing PipeWire support).
    /// Kalici bir hatada (ornegin portal iptali veya PipeWire eksikligi) bir kez gonderilir.
    Hata(String),
    /// Sent once after the capture thread exits cleanly in response to `durdur` or `Drop`.
    /// `durdur` veya `Drop` sonrasinda yakalama is parcacigi temizce sonlaninca bir kez gonderilir.
    Bitti,
}

/// Handle to a single screen-capture session; `durdur` and `Drop` signal stop without blocking.
/// Tek bir ekran yakalama oturumu tutamaci; `durdur` ve `Drop` cagirani bloklamadan durdurur.
pub struct Yakalama {
    dur_sinyali: Arc<DurSinyali>,
}

impl Yakalama {
    /// Starts a capture session on a dedicated OS thread. `kare` is called for every converted frame.
    /// Ozel bir isletim sistemi is parcaciginda yakalama oturumu baslatir. `kare` donusturulen her karede cagrilir.
    pub fn baslat(kare: impl Fn(VideoFrame) + Send + Sync + 'static, olay: impl Fn(YakalamaOlayi) + Send + Sync + 'static) -> Yakalama {
        let dur_sinyali = Arc::new(DurSinyali::yeni());
        let olay_gonderici = Arc::new(OlayGonderici::yeni(Box::new(olay), Arc::clone(&dur_sinyali)));
        let (d, o, k) = (Arc::clone(&dur_sinyali), Arc::clone(&olay_gonderici), Arc::new(kare) as KareAlici);
        let baslatma = thread::Builder::new().name("yakalama-ekran".into()).spawn(move || gercek_yakalama_dongusu(k, d, o));
        if let Err(hata) = baslatma {
            olay_gonderici.hata_gonder(format!("Yakalama iş parçacığı başlatılamadı: {hata}"));
        }
        Yakalama { dur_sinyali }
    }

    /// Signals the capture thread to stop and returns immediately without blocking the caller.
    /// Yakalama is parcacigina durma isareti gonderir ve cagirani bloklamadan hemen doner.
    pub fn durdur(&self) {
        self.dur_sinyali.durdur();
    }
}

impl Drop for Yakalama {
    fn drop(&mut self) {
        // Dropping the session handle must never block the GTK main thread; signaling stop lets
        // the capture thread tear down DesktopCapturer on its creator thread.
        // Oturum tutamacini birakmak GTK ana is parcacigini asla bloklamamalidir; durma isareti
        // yakalama is parcaciginin DesktopCapturer nesnesini kendi olusturdugu parcacikta kapatmasini saglar.
        self.durdur();
    }
}

/// Non-blocking stop and permanent-error wakeup primitive shared between the handle and thread.
/// Tutamac ile yakalama is parcacigi arasinda paylasilan bloklamayan durma ve hata uyandirma yapisi.
struct DurSinyali {
    durduruldu: AtomicBool,
    kalici_hata: AtomicBool,
    kilit: Mutex<bool>,
    kosul: Condvar,
}

impl DurSinyali {
    fn yeni() -> Self {
        Self {
            durduruldu: AtomicBool::new(false),
            kalici_hata: AtomicBool::new(false),
            kilit: Mutex::new(false),
            kosul: Condvar::new(),
        }
    }

    fn durdur(&self) {
        self.durduruldu.store(true, Ordering::Release);
        let mut uyandir = self.kilit.lock().unwrap_or_else(|e| e.into_inner());
        *uyandir = true;
        self.kosul.notify_all();
    }

    fn kalici_hata_isaretle(&self) {
        self.kalici_hata.store(true, Ordering::Release);
        let mut uyandir = self.kilit.lock().unwrap_or_else(|e| e.into_inner());
        *uyandir = true;
        self.kosul.notify_all();
    }

    fn durduruldu_mu(&self) -> bool {
        self.durduruldu.load(Ordering::Acquire)
    }

    fn cikilmali_mi(&self) -> bool {
        self.durduruldu.load(Ordering::Acquire) || self.kalici_hata.load(Ordering::Acquire)
    }

    /// Waits until `hedef` or until stop/permanent-error is signaled; returns `true` if exiting.
    /// `hedef` anina kadar veya durma/kalici hata sinyaline kadar bekler; cikilacaksa `true` doner.
    fn kadar_bekle(&self, hedef: Instant) -> bool {
        let mut uyandir = self.kilit.lock().unwrap_or_else(|e| e.into_inner());
        loop {
            if *uyandir || self.cikilmali_mi() {
                return true;
            }
            let simdi = Instant::now();
            if simdi >= hedef {
                return false;
            }
            let kalan = hedef.saturating_duration_since(simdi);
            let (yeni_bekci, _) = match self.kosul.wait_timeout(uyandir, kalan) {
                Ok(sonuc) => sonuc,
                Err(zehir) => zehir.into_inner(),
            };
            uyandir = yeni_bekci;
        }
    }
}

struct OlayDurumu {
    hazir_gonderildi: bool,
    sonlandirildi: bool,
}

/// Serializes session events to enforce: Hazir at most once, Hata at most once, nothing after Bitti.
/// Olaylari siralar: Hazir en fazla bir kez, Hata en fazla bir kez, Bitti sonrasinda hicbir olay yok.
struct OlayGonderici {
    olay: Box<dyn Fn(YakalamaOlayi) + Send + Sync>,
    durum: Mutex<OlayDurumu>,
    dur_sinyali: Arc<DurSinyali>,
}

impl OlayGonderici {
    fn yeni(
        olay: Box<dyn Fn(YakalamaOlayi) + Send + Sync>,
        dur_sinyali: Arc<DurSinyali>,
    ) -> Self {
        Self {
            olay,
            durum: Mutex::new(OlayDurumu {
                hazir_gonderildi: false,
                sonlandirildi: false,
            }),
            dur_sinyali,
        }
    }

    fn hazir_gonder(&self, g: u32, y: u32) {
        let mut durum = self.durum.lock().unwrap_or_else(|e| e.into_inner());
        if durum.hazir_gonderildi || durum.sonlandirildi || self.dur_sinyali.durduruldu_mu() {
            return;
        }
        durum.hazir_gonderildi = true;
        (self.olay)(YakalamaOlayi::Hazir(g, y));
    }

    fn hazir_gonderildi_mi(&self) -> bool {
        self.durum
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .hazir_gonderildi
    }

    fn hata_gonder(&self, ileti: String) {
        let mut durum = self.durum.lock().unwrap_or_else(|e| e.into_inner());
        if durum.sonlandirildi {
            return;
        }
        durum.sonlandirildi = true;
        if self.dur_sinyali.durduruldu_mu() {
            // If stop was already requested, treat teardown as a normal stop rather than an error.
            // Durdurma zaten istendiyse kapanisi hata yerine normal durma olarak bildir.
            (self.olay)(YakalamaOlayi::Bitti);
        } else {
            (self.olay)(YakalamaOlayi::Hata(ileti));
        }
    }

    fn bitti_gonder(&self) {
        let mut durum = self.durum.lock().unwrap_or_else(|e| e.into_inner());
        if durum.sonlandirildi {
            return;
        }
        durum.sonlandirildi = true;
        (self.olay)(YakalamaOlayi::Bitti);
    }
}

/// Computes target dimensions within 1920x1080 preserving aspect ratio, even sizes, never upscaling.
/// En-boy oranini koruyarak 1920x1080 icinde cift ve buyutulmemis hedef boyutlari hesaplar.
fn hedef_boyut_hesapla(kaynak_genislik: u32, kaynak_yukseklik: u32) -> (u32, u32) {
    let sinir_g = (kaynak_genislik & !1).max(2);
    let sinir_y = (kaynak_yukseklik & !1).max(2);

    if kaynak_genislik <= AZAMI_GENISLIK && kaynak_yukseklik <= AZAMI_YUKSEKLIK {
        // Never upscale; simply ensure even I420 chroma dimensions by rounding down.
        // Asla buyutme yapma; I420 kroma boyutlarinin cift olmasi icin asagi yuvarla.
        return (sinir_g, sinir_y);
    }

    let w = u64::from(kaynak_genislik);
    let h = u64::from(kaynak_yukseklik);
    let max_w = u64::from(AZAMI_GENISLIK);
    let max_h = u64::from(AZAMI_YUKSEKLIK);

    if w * max_h >= h * max_w {
        // Width-limited: fit width to 1920 and round scaled height to the nearest even integer.
        // Genislik sinirli: genisligi 1920'ye oturt ve olcekli yuksekligi en yakin cift tam sayiya yuvarla.
        let pay = h * max_w;
        let cift_birim = (pay + w) / (2 * w);
        let hedef_y = ((cift_birim * 2) as u32)
            .min(AZAMI_YUKSEKLIK)
            .min(sinir_y)
            .max(2);
        (AZAMI_GENISLIK, hedef_y)
    } else {
        // Height-limited: fit height to 1080 and round scaled width to the nearest even integer.
        // Yukseklik sinirli: yuksekligi 1080'e oturt ve olcekli genisligi en yakin cift tam sayiya yuvarla.
        let pay = w * max_h;
        let cift_birim = (pay + h) / (2 * h);
        let hedef_g = ((cift_birim * 2) as u32)
            .min(AZAMI_GENISLIK)
            .min(sinir_g)
            .max(2);
        (hedef_g, AZAMI_YUKSEKLIK)
    }
}

/// Converts BGRA frames into immutable I420 buffers, enforces 30 fps cap, and supports 1 fps resend.
/// BGRA karelerini degistirilmez I420 tamponlarina cevirir, 30 fps siniri uygular ve 1 fps tekrari saglar.
struct Donusturucu {
    baslangic: Instant,
    son_zaman_us: i64,
    sonraki_izin_ani: Option<Instant>,
    son_teslim_ani: Option<Instant>,
    // Reusable scratch buffer used ONLY when downscaling; never handed directly to capture_frame.
    // Yalnizca kucultme sirasinda yeniden kullanilan gecici tampon; capture_frame'e dogrudan verilmez.
    gecici_i420: Option<I420Buffer>,
    // Last immutable I420 buffer sent to WebRTC, kept read-only for 1 fps static-screen keepalive.
    // WebRTC'ye gonderilen son degistirilmez I420 tamponu; duragan ekran 1 fps tekrari icin salt okunur tutulur.
    son_kare: Option<VideoFrame>,
    ilk: bool,
    alici: KareAlici,
}

impl Donusturucu {
    fn yeni(alici: KareAlici) -> Self {
        Self {
            baslangic: Instant::now(),
            son_zaman_us: 0,
            sonraki_izin_ani: None,
            son_teslim_ani: None,
            gecici_i420: None,
            son_kare: None,
            ilk: true,
            alici,
        }
    }

    fn sonraki_zaman_damgasi_us(&mut self) -> i64 {
        // Strictly positive monotonic microsecond timestamp avoids libwebrtc's SystemTime::now().unwrap()
        // fallback and keeps WebRTC's TimestampAligner immune to wall-clock jumps.
        // Kesinlikle pozitif monotonik mikrosaniye damgasi libwebrtc icindeki SystemTime::now().unwrap()
        // yolundan kacinir ve WebRTC TimestampAligner'ini saat sicramalarindan korur.
        let gecen = self.baslangic.elapsed().as_micros().min(i64::MAX as u128) as i64;
        let ts = gecen.max(self.son_zaman_us.saturating_add(1)).max(1);
        self.son_zaman_us = ts;
        ts
    }

    /// Converts one BGRA frame if within the 30 fps gate and pushes it to `NativeVideoSource`.
    /// Returns `Some(size)` once, on the first good frame.
    /// 30 fps siniri izin veriyorsa BGRA kareyi donusturup `NativeVideoSource`'a iletir.
    /// Ilk gecerli karede bir kez boyutu doner.
    fn isle_bgra(
        &mut self,
        bgra: &[u8],
        satir_adimi: u32,
        genislik: u32,
        yukseklik: u32,
    ) -> Option<(u32, u32)> {
        // Guard against malformed dimensions or buffers before calling libyuv (which asserts lengths).
        // libyuv uzunluk kontrollerinde paniklememek icin bozuk boyut ve tamponlari onceden ele.
        if genislik < 2 || yukseklik < 2 || satir_adimi > i32::MAX as u32 {
            return None;
        }
        let min_satir = genislik.checked_mul(4)?;
        if satir_adimi < min_satir {
            return None;
        }
        let gereken_bayt = satir_adimi.checked_mul(yukseklik)? as usize;
        if bgra.len() < gereken_bayt {
            return None;
        }

        let simdi = Instant::now();
        if let Some(izin_ani) = self.sonraki_izin_ani {
            if simdi + KARE_SAPMA_TOLERANSI < izin_ani {
                // Drop excess frames without queueing to enforce the 30 fps ceiling.
                // 30 fps tavanini korumak icin fazla kareleri kuyruklamadan at.
                return None;
            }
            if simdi >= izin_ani + KARE_ARALIGI {
                // Reset pacing after a pause so static-to-active transitions never burst.
                // Duraganliktan hareketlilige geciste patlama olmamasi icin zamanlamayi sifirla.
                self.sonraki_izin_ani = Some(simdi + KARE_ARALIGI);
            } else {
                self.sonraki_izin_ani = Some(izin_ani + KARE_ARALIGI);
            }
        } else {
            self.sonraki_izin_ani = Some(simdi + KARE_ARALIGI);
        }

        let (hedef_g, hedef_y) = hedef_boyut_hesapla(genislik, yukseklik);
        let cikti_tampon = if genislik <= AZAMI_GENISLIK && yukseklik <= AZAMI_YUKSEKLIK {
            // Fast path: convert directly into a fresh I420Buffer (1 copy total). Passing even
            // hedef_g/hedef_y with the original stride trims at most 1 odd edge pixel cleanly.
            // Hizli yol: dogrudan yeni bir I420Buffer'a donustur (toplam 1 kopya). Ozgun satir
            // adimiyla cift hedef_g/hedef_y vermek tek sayili kenarda en fazla 1 pikseli temizce kirpar.
            self.gecici_i420 = None;
            let mut cikti = I420Buffer::new(hedef_g, hedef_y);
            let (sy, su, sv) = cikti.strides();
            let (y_plan, u_plan, v_plan) = cikti.data_mut();
            yuv_helper::argb_to_i420(
                bgra,
                satir_adimi,
                y_plan,
                sy,
                u_plan,
                su,
                v_plan,
                sv,
                hedef_g as i32,
                hedef_y as i32,
            );
            cikti
        } else {
            // Downscale path: convert into reusable scratch I420, then scale into a fresh I420Buffer
            // so the buffer passed to WebRTC is never mutated after capture_frame.
            // Kucultme yolu: yeniden kullanilan gecici I420'ye donustur, sonra yeni bir I420Buffer'a
            // olcekle; boylece WebRTC'ye verilen tampon capture_frame sonrasinda asla degistirilmez.
            let yeniden_ayir = match self.gecici_i420.as_ref() {
                Some(mevcut) => mevcut.width() != genislik || mevcut.height() != yukseklik,
                None => true,
            };
            if yeniden_ayir {
                self.gecici_i420 = Some(I420Buffer::new(genislik, yukseklik));
            }
            let gecici = self.gecici_i420.as_mut()?;
            let (sy, su, sv) = gecici.strides();
            let (y_plan, u_plan, v_plan) = gecici.data_mut();
            yuv_helper::argb_to_i420(
                bgra,
                satir_adimi,
                y_plan,
                sy,
                u_plan,
                su,
                v_plan,
                sv,
                genislik as i32,
                yukseklik as i32,
            );
            gecici.scale(hedef_g as i32, hedef_y as i32)
        };

        let (sy, su, sv) = cikti_tampon.strides();
        let (y, u, v) = cikti_tampon.data();
        let kare = VideoFrame {
            buffer: matrix_rtc_transport::I420Buffer {
                width: hedef_g,
                height: hedef_y,
                data_y: y.to_vec(),
                stride_y: sy,
                data_u: u.to_vec(),
                stride_u: su,
                data_v: v.to_vec(),
                stride_v: sv,
            },
            rotation: VideoRotation::Deg0,
            timestamp_us: self.sonraki_zaman_damgasi_us(),
        };
        (self.alici)(kare.clone());
        self.son_kare = Some(kare);
        self.son_teslim_ani = Some(Instant::now());
        std::mem::take(&mut self.ilk).then_some((hedef_g, hedef_y))
    }

    /// Re-sends the last immutable I420 buffer as a fresh VideoFrame at 1 fps on static screens.
    /// Duragan ekranlarda son degistirilmez I420 tamponunu 1 fps hizinda taze VideoFrame olarak yineler.
    fn gerekirse_son_kareyi_tekrar_gonder(&mut self) {
        let tekrar_gerekli = match self.son_teslim_ani {
            Some(son_an) => son_an.elapsed() >= DURAGAN_TEKRAR_ARALIGI,
            None => false,
        };
        if !tekrar_gerekli {
            return;
        }
        let zaman = self.sonraki_zaman_damgasi_us();
        if let Some(kare) = self.son_kare.as_mut() {
            kare.timestamp_us = zaman;
            (self.alici)(kare.clone());
            self.son_teslim_ani = Some(Instant::now());
        }
    }
}

/// Validates a DesktopFrame before accessing `frame.data()`, which slices `stride * height` unchecked.
/// `stride * height` dilimini denetimsiz olusturan `frame.data()` oncesinde DesktopFrame'i dogrular.
fn gecerli_masaustu_karesi(kare: &DesktopFrame) -> Option<(u32, u32, u32)> {
    let g = kare.width();
    let y = kare.height();
    let adim = kare.stride();
    if g < 2 || y < 2 || adim > i32::MAX as u32 {
        return None;
    }
    let genislik = g as u32;
    let yukseklik = y as u32;
    let min_adim = genislik.checked_mul(4)?;
    if adim < min_adim {
        return None;
    }
    adim.checked_mul(yukseklik)?;
    Some((genislik, yukseklik, adim))
}

/// Runs real Wayland/portal capture on a single dedicated thread (create, start, poll, drop).
/// Gercek Wayland/portal yakalamasini tek bir ozel is parcaciginda calistirir (olustur, baslat, yokla, birak).
fn gercek_yakalama_dongusu(
    alici: KareAlici,
    dur_sinyali: Arc<DurSinyali>,
    olay_gonderici: Arc<OlayGonderici>,
) {
    if dur_sinyali.durduruldu_mu() {
        olay_gonderici.bitti_gonder();
        return;
    }

    let mut secenekler = DesktopCapturerOptions::new(DesktopCaptureSourceType::Generic);
    secenekler.set_include_cursor(true);

    let mut yakalayici = match DesktopCapturer::new(secenekler) {
        Some(y) => y,
        None => {
            if dur_sinyali.durduruldu_mu() {
                olay_gonderici.bitti_gonder();
            } else {
                olay_gonderici.hata_gonder(
                    "Ekran yakalayıcı başlatılamadı (PipeWire veya portal desteği kullanılamıyor)."
                        .to_string(),
                );
            }
            return;
        }
    };

    let donusturucu = Arc::new(Mutex::new(Donusturucu::yeni(alici)));
    let cb_donusturucu = Arc::clone(&donusturucu);
    let cb_dur = Arc::clone(&dur_sinyali);
    let cb_olay = Arc::clone(&olay_gonderici);

    let geri_cagirim = move |sonuc: Result<DesktopFrame, CaptureError>| {
        if cb_dur.cikilmali_mi() {
            return;
        }
        match sonuc {
            Ok(kare) => {
                let (genislik, yukseklik, satir_adimi) = match gecerli_masaustu_karesi(&kare) {
                    Some(boyut) => boyut,
                    None => return,
                };

                // Never block or queue when the converter is busy; drop this frame instead.
                // Donusturucu mesgulken asla bekleme veya kuyruklama yapma; bu kareyi at.
                let mut bekci = match cb_donusturucu.try_lock() {
                    Ok(b) => b,
                    Err(TryLockError::WouldBlock) => return,
                    Err(TryLockError::Poisoned(zehir)) => zehir.into_inner(),
                };
                let ilk_kaynak = bekci.isle_bgra(
                    kare.data(),
                    satir_adimi,
                    genislik,
                    yukseklik,
                );
                // Drop the converter lock before notifying the external event callback.
                // Dis olay geri cagirimini cagirmadan once donusturucu kilidini birak.
                drop(bekci);

                if let Some((g, y)) = ilk_kaynak {
                    cb_olay.hazir_gonder(g, y);
                }
            }
            Err(CaptureError::Temporary) => {
                // Expected while the portal dialog is open or when a frame is momentarily unavailable.
                // Portal penceresi acikken veya gecici kare yoklugunda beklenir; atlanir.
            }
            Err(CaptureError::Permanent) => {
                // Mark permanent error and wake the capture loop so DesktopCapturer drops cleanly
                // on its creator thread before Hata is delivered.
                // Kalici hatayi isaretle ve Hata iletilmeden once DesktopCapturer'in kendi is
                // parcaciginda temizce kapatilmasi icin donguyu hemen uyandir.
                cb_dur.kalici_hata_isaretle();
            }
        }
    };

    // Pass `None` so Linux/Wayland opens the xdg-desktop-portal picker on start_capture.
    // Linux/Wayland uzerinde xdg-desktop-portal secicisinin acilmasi icin `None` verilir.
    yakalayici.start_capture(None, geri_cagirim);

    let mut sonraki_tik = Instant::now();
    while !dur_sinyali.cikilmali_mi() {
        yakalayici.capture_frame();

        if dur_sinyali.cikilmali_mi() {
            break;
        }

        // On Wayland, static screens emit no new PipeWire frames; re-send the last converted frame
        // at 1 fps so a newly connected loopback receiver always gets a picture.
        // Wayland'de duragan ekranlar yeni PipeWire karesi uretmez; yeni baglanan alicinin goruntu
        // alabilmesi icin son donusturulmus kare 1 fps ile yinelenir.
        match donusturucu.try_lock() {
            Ok(mut bekci) => bekci.gerekirse_son_kareyi_tekrar_gonder(),
            Err(TryLockError::WouldBlock) => {}
            Err(TryLockError::Poisoned(zehir)) => {
                zehir.into_inner().gerekirse_son_kareyi_tekrar_gonder();
            }
        }

        let simdi = Instant::now();
        sonraki_tik = (sonraki_tik + KARE_ARALIGI).max(simdi);
        if dur_sinyali.kadar_bekle(sonraki_tik) {
            break;
        }
    }

    // Explicitly drop DesktopCapturer on its creator thread before sending terminal events so no
    // callback can run after Hata/Bitti and a subsequent share starts cleanly.
    // Hata/Bitti sonrasinda hicbir geri cagirimin calismamasi ve sonraki paylasimin temiz baslamasi
    // icin DesktopCapturer nesnesini olusturuldugu parcacikta acikca birak.
    drop(yakalayici);

    if dur_sinyali.durduruldu_mu() {
        olay_gonderici.bitti_gonder();
    } else {
        let ileti = if olay_gonderici.hazir_gonderildi_mi() {
            "Ekran paylaşımı sistem tarafından sonlandırıldı.".to_string()
        } else {
            "Ekran paylaşımı iptal edildi veya izin verilmedi.".to_string()
        };
        olay_gonderici.hata_gonder(ileti);
    }
}

