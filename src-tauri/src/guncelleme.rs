//! In-app update check, verified download, and Android installer bridge (GitHub Releases).
//! Uygulama içi güncelleme denetimi, doğrulanmış indirme ve Android kurulum köprüsü (GitHub Releases).
//!
//! No new crates: HTTP uses `matrix_sdk::reqwest`, and SHA-256 uses GLib on Linux / `MessageDigest` on Android.
//! Yeni crate yok: HTTP için `matrix_sdk::reqwest`, SHA-256 için Linux'ta GLib, Android'de `MessageDigest` kullanılır.

use std::{
    cmp::Ordering,
    io::{BufWriter, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering as AtomicOrdering},
        OnceLock,
    },
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::hata::{Hata, Sonuc};

/// Real version of the app (Cargo.toml / tauri.conf.json stay at "0.1.0"; prerelease tags live here).
/// Bump this constant whenever cutting a new release.
/// Uygulamanın gerçek sürümü (Cargo.toml / tauri.conf.json "0.1.0" olarak kalır; ön sürüm etiketleri burada taşınır).
/// Yeni sürüm çıkarırken bu sabiti güncelle.
pub const SURUM: &str = "0.1.0-beta.11";

const SURUMLER_URL: &str = "https://api.github.com/repos/Shuraimr/rubychat/releases?per_page=15";
const INDIRME_ONEKI: &str = "https://github.com/Shuraimr/rubychat/releases/download/";
const OLAY_ILERLEME: &str = "guncelleme-ilerleme";

static IPTAL: AtomicBool = AtomicBool::new(false);
static INDIRME_KILIDI: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Varlik {
    pub ad: String,
    pub url: String,
    pub boyut: u64,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YeniSurum {
    pub surum: String,
    pub etiket: String,
    pub notlar: String,
    pub tarih: String,
    pub sayfa: String,
    pub apk: Option<Varlik>,
    pub flatpak: Option<Varlik>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuncellemeBilgisi {
    pub mevcut: String,
    pub yeni: Option<YeniSurum>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndirmeIlerleme {
    indirilen: u64,
    toplam: u64,
}

#[derive(Deserialize)]
struct GithubSurum {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    body: Option<String>,
    published_at: Option<String>,
    html_url: String,
    #[serde(default)]
    assets: Vec<GithubVarlik>,
}

#[derive(Deserialize)]
struct GithubVarlik {
    name: String,
    browser_download_url: String,
    size: u64,
    digest: Option<String>,
}

/// Parsed semantic version with an optional prerelease pair like `("beta", 9)`.
/// `("beta", 9)` gibi isteğe bağlı ön sürüm çifti içeren ayrıştırılmış anlamsal sürüm.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Surum {
    major: u64,
    minor: u64,
    patch: u64,
    on_surum: Option<(String, u64)>,
}

impl Surum {
    fn ayristir(metin: &str) -> Option<Self> {
        let s = metin.trim();
        let s = s.strip_prefix('v').or_else(|| s.strip_prefix('V')).unwrap_or(s);
        let (cekirdek, ek) = match s.split_once('-') {
            Some((c, e)) => (c, Some(e)),
            None => (s, None),
        };
        let mut parcalar = cekirdek.split('.');
        let major = parcalar.next()?.parse::<u64>().ok()?;
        let minor = parcalar.next()?.parse::<u64>().ok()?;
        let patch = parcalar.next()?.parse::<u64>().ok()?;
        if parcalar.next().is_some() {
            return None;
        }
        let on_surum = match ek {
            None => None,
            Some(e) => {
                if e.is_empty() {
                    return None;
                }
                match e.split_once('.') {
                    Some((ad, no_str)) => {
                        if ad.is_empty() {
                            return None;
                        }
                        let no = no_str.parse::<u64>().ok()?;
                        Some((ad.to_ascii_lowercase(), no))
                    }
                    None => Some((e.to_ascii_lowercase(), 0)),
                }
            }
        };
        Some(Self { major, minor, patch, on_surum })
    }
}

impl Ord for Surum {
    fn cmp(&self, other: &Self) -> Ordering {
        (self.major, self.minor, self.patch)
            .cmp(&(other.major, other.minor, other.patch))
            .then_with(|| match (&self.on_surum, &other.on_surum) {
                // Same core: stable outranks any prerelease; two prereleases compare name then number numerically.
                // Aynı çekirdekte kararlı, ön sürümden büyüktür; iki ön sürüm önce ad sonra sayısal no ile karşılaştırılır.
                (None, None) => Ordering::Equal,
                (None, Some(_)) => Ordering::Greater,
                (Some(_), None) => Ordering::Less,
                (Some((a_ad, a_no)), Some((b_ad, b_no))) => a_ad.cmp(b_ad).then_with(|| a_no.cmp(b_no)),
            })
    }
}

impl PartialOrd for Surum {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Validates a 64-character hex SHA-256 digest and normalizes it to lowercase.
/// 64 karakterlik onaltılık SHA-256 özetini doğrular ve küçük harfe çevirir.
fn gecerli_sha256(metin: &str) -> Option<String> {
    let s = metin.trim();
    if s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()) {
        Some(s.to_ascii_lowercase())
    } else {
        None
    }
}

/// Extracts hex SHA-256 from GitHub's `digest` field (`"sha256:<hex>"`).
/// GitHub'ın `digest` alanından (`"sha256:<hex>"`) onaltılık SHA-256 özetini çıkarır.
fn digest_sha256(deger: &str) -> Option<String> {
    let s = deger.trim();
    let (on, kalan) = s.split_once(':')?;
    if !on.eq_ignore_ascii_case("sha256") {
        return None;
    }
    gecerli_sha256(kalan)
}

/// Fallback SHA-256 parser for release notes (`APK: `<64 hex>`` / `Flatpak: `<64 hex>``) without pulling in a regex crate.
/// Regex crate eklemeden sürüm notlarından (`APK: `<64 hex>`` / `Flatpak: `<64 hex>``) yedek SHA-256 ayrıştırıcısı.
fn notlardan_sha256(notlar: &str, etiket: &str) -> Option<String> {
    let aranan = format!("{etiket}:");
    for satir in notlar.lines() {
        let temiz = satir
            .trim()
            .trim_start_matches(['-', '*', '•'])
            .trim();
        if temiz.len() <= aranan.len() {
            continue;
        }
        let Some((bas, devam)) = temiz.split_at_checked(aranan.len()) else {
            continue;
        };
        if !bas.eq_ignore_ascii_case(&aranan) {
            continue;
        }
        let kalan = devam.trim_start();
        let aday = if let Some(ic) = kalan.strip_prefix('`') {
            ic.split('`').next().unwrap_or("")
        } else {
            kalan.split_whitespace().next().unwrap_or("")
        };
        if let Some(ozet) = gecerli_sha256(aday) {
            return Some(ozet);
        }
    }
    None
}

fn varlik_yap(v: &GithubVarlik, notlar: &str, not_etiket: &str) -> Varlik {
    let sha256 = v
        .digest
        .as_deref()
        .and_then(digest_sha256)
        .or_else(|| notlardan_sha256(notlar, not_etiket));
    Varlik {
        ad: v.name.clone(),
        url: v.browser_download_url.clone(),
        boyut: v.size,
        sha256,
    }
}

/// Only GitHub Releases of this repo may be downloaded, and file names cannot traverse paths.
/// Yalnızca bu deponun GitHub Releases indirmeleri kabul edilir ve dosya adları yol geçişi yapamaz.
fn indirme_dogrula(url: &str, ad: &str) -> Sonuc<()> {
    if !url.starts_with(INDIRME_ONEKI) {
        return Err(Hata::Diger("güvenilmeyen indirme adresi".into()));
    }
    let ayrisik = url::Url::parse(url).map_err(|_| Hata::Diger("geçersiz indirme adresi".into()))?;
    if ayrisik.scheme() != "https"
        || ayrisik.host_str() != Some("github.com")
        || !ayrisik.path().starts_with("/Shuraimr/rubychat/releases/download/")
        || ayrisik.path().contains("..")
    {
        return Err(Hata::Diger("güvenilmeyen indirme adresi".into()));
    }
    let ad_gecerli = !ad.is_empty()
        && !ad.contains("..")
        && ad.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
        && (ad.ends_with(".apk") || ad.ends_with(".flatpak"));
    if !ad_gecerli {
        return Err(Hata::Diger("geçersiz dosya adı".into()));
    }
    Ok(())
}

/// Real app version string for the UI (including prerelease tags like `0.1.0-beta.9`).
/// Arayüz için gerçek uygulama sürümü (`0.1.0-beta.9` gibi ön sürüm etiketleriyle).
#[tauri::command]
pub fn uygulama_surumu() -> &'static str {
    SURUM
}

/// Checks GitHub Releases for a version newer than `SURUM`.
/// `SURUM`'dan daha yeni bir sürüm için GitHub Releases'ı denetler.
#[tauri::command]
pub async fn guncelleme_denetle(beta: bool) -> Sonuc<GuncellemeBilgisi> {
    let istemci = matrix_sdk::reqwest::Client::builder()
        .user_agent("rubychat")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| Hata::Ag(e.to_string()))?;

    let yanit = istemci
        .get(SURUMLER_URL)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| Hata::Ag(e.to_string()))?;

    if !yanit.status().is_success() {
        return Err(Hata::Ag(format!("GitHub HTTP {}", yanit.status().as_u16())));
    }

    let bayt = yanit.bytes().await.map_err(|e| Hata::Ag(e.to_string()))?;
    let liste: Vec<GithubSurum> = serde_json::from_slice(&bayt).map_err(|e| Hata::Ag(e.to_string()))?;

    let mevcut_surum = Surum::ayristir(SURUM).ok_or_else(|| Hata::Diger("mevcut sürüm ayrıştırılamadı".into()))?;
    let mut en_iyi: Option<(Surum, GithubSurum)> = None;

    for kayit in liste {
        if kayit.draft {
            continue;
        }
        let Some(s) = Surum::ayristir(&kayit.tag_name) else {
            continue;
        };
        if !beta && (kayit.prerelease || s.on_surum.is_some()) {
            continue;
        }
        if en_iyi.as_ref().is_none_or(|(eski, _)| s > *eski) {
            en_iyi = Some((s, kayit));
        }
    }

    let yeni = match en_iyi {
        Some((s, r)) if s > mevcut_surum => {
            let notlar = r.body.unwrap_or_default();
            let surum = r
                .tag_name
                .trim()
                .strip_prefix('v')
                .or_else(|| r.tag_name.trim().strip_prefix('V'))
                .unwrap_or(r.tag_name.trim())
                .to_owned();
            let apk = r
                .assets
                .iter()
                .find(|v| v.name.ends_with(".apk") && !v.name.ends_with(".idsig") && !v.name.contains(".idsig"))
                .map(|v| varlik_yap(v, &notlar, "APK"));
            let flatpak = r
                .assets
                .iter()
                .find(|v| v.name.ends_with("-x86_64.flatpak"))
                .map(|v| varlik_yap(v, &notlar, "Flatpak"));
            Some(YeniSurum {
                surum,
                etiket: r.tag_name,
                notlar,
                tarih: r.published_at.unwrap_or_default(),
                sayfa: r.html_url,
                apk,
                flatpak,
            })
        }
        _ => None,
    };

    Ok(GuncellemeBilgisi {
        mevcut: SURUM.to_owned(),
        yeni,
    })
}

/// Platform SHA-256 calculation without adding a digest crate: GLib on Linux, Android `MessageDigest` over JNI.
/// Özet crate'i eklemeden platforma özgü SHA-256 hesabı: Linux'ta GLib, Android'de JNI üzerinden `MessageDigest`.
fn dosya_sha256(yol: &std::path::Path) -> Sonuc<String> {
    if cfg!(target_os = "android") {
        let s = yol.to_string_lossy();
        return crate::android_jni::guncelleme_sha256(&s)
            .map(|h| h.to_ascii_lowercase())
            .map_err(Hata::Depolama);
    }
    #[cfg(target_os = "linux")]
    {
        use std::io::Read;
        use webkit2gtk::glib::{Checksum, ChecksumType};
        let mut f = std::fs::File::open(yol)?;
        let mut ozet = Checksum::new(ChecksumType::Sha256)
            .ok_or_else(|| Hata::Diger("SHA-256 başlatılamadı".into()))?;
        let mut tampon = [0u8; 64 * 1024];
        loop {
            let n = f.read(&mut tampon)?;
            if n == 0 {
                break;
            }
            ozet.update(&tampon[..n]);
        }
        ozet.string()
            .map(|s| s.to_string().to_ascii_lowercase())
            .ok_or_else(|| Hata::Diger("SHA-256 hesaplanamadı".into()))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = yol;
        Err(Hata::Diger("bu platformda özet doğrulama desteklenmiyor".into()))
    }
}

fn hedef_klasor(app: &AppHandle) -> Sonuc<PathBuf> {
    if cfg!(target_os = "android") {
        Ok(app.path().app_cache_dir()?.join("guncelleme"))
    } else {
        Ok(app.path().download_dir()?)
    }
}

/// Streams a release asset to a `.part` file, emits progress, verifies SHA-256, and atomically renames it into place.
/// Sürüm varlığını `.part` dosyasına akışla indirir, ilerleme yayınlar, SHA-256'yı doğrular ve yerine yeniden adlandırır.
#[tauri::command]
pub async fn guncelleme_indir(app: AppHandle, url: String, ad: String, sha256: Option<String>) -> Sonuc<String> {
    indirme_dogrula(&url, &ad)?;
    let beklenen = match sha256 {
        None => return Err(Hata::Diger("özet yok, güvenli değil".into())),
        Some(s) => gecerli_sha256(&s).ok_or_else(|| Hata::Diger("özet yok, güvenli değil".into()))?,
    };

    let kilit = INDIRME_KILIDI.get_or_init(|| tokio::sync::Mutex::new(()));
    let _bekci = kilit
        .try_lock()
        .map_err(|_| Hata::Diger("indirme zaten sürüyor".into()))?;

    IPTAL.store(false, AtomicOrdering::SeqCst);

    let klasor = hedef_klasor(&app)?;
    let gecici = klasor.join(format!("{ad}.part"));
    let hedef = klasor.join(&ad);

    let istemci = matrix_sdk::reqwest::Client::builder()
        .user_agent("rubychat")
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| Hata::Ag(e.to_string()))?;

    let mut yanit = istemci
        .get(&url)
        .send()
        .await
        .map_err(|e| Hata::Ag(e.to_string()))?;

    if !yanit.status().is_success() {
        return Err(Hata::Ag(format!("indirme HTTP {}", yanit.status().as_u16())));
    }

    let toplam = yanit.content_length().unwrap_or(0);
    let _ = app.emit(OLAY_ILERLEME, IndirmeIlerleme { indirilen: 0, toplam });

    // Write on a dedicated blocking task because `tokio` is compiled without its `fs` feature.
    // `tokio` `fs` özelliği olmadan derlendiği için dosya yazımı ayrı bir blocking görevinde yapılır.
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(8);
    let gecici_yaz = gecici.clone();
    let yazici = tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        if let Some(ust) = gecici_yaz.parent() {
            std::fs::create_dir_all(ust)?;
        }
        let mut cikis = BufWriter::new(std::fs::File::create(&gecici_yaz)?);
        while let Some(parca) = rx.blocking_recv() {
            cikis.write_all(&parca)?;
        }
        cikis.flush()?;
        Ok(())
    });

    let mut indirilen: u64 = 0;
    let mut son_yayin = Instant::now();
    let mut son_yuzde: u64 = 0;
    let mut akis_hatasi: Option<Hata> = None;

    loop {
        if IPTAL.load(AtomicOrdering::SeqCst) {
            akis_hatasi = Some(Hata::Diger("iptal".into()));
            break;
        }
        match tokio::time::timeout(Duration::from_secs(30), yanit.chunk()).await {
            Ok(Ok(Some(parca))) => {
                if IPTAL.load(AtomicOrdering::SeqCst) {
                    akis_hatasi = Some(Hata::Diger("iptal".into()));
                    break;
                }
                indirilen = indirilen.saturating_add(parca.len() as u64);
                if tx.send(parca.to_vec()).await.is_err() {
                    akis_hatasi = Some(Hata::Depolama("dosya yazılamadı".into()));
                    break;
                }
                let yuzde = if toplam > 0 { indirilen.saturating_mul(100) / toplam } else { 0 };
                if son_yayin.elapsed() >= Duration::from_millis(150) || (toplam > 0 && yuzde > son_yuzde) {
                    son_yayin = Instant::now();
                    son_yuzde = yuzde;
                    let _ = app.emit(OLAY_ILERLEME, IndirmeIlerleme { indirilen, toplam });
                }
            }
            Ok(Ok(None)) => break,
            Ok(Err(e)) => {
                akis_hatasi = Some(Hata::Ag(e.to_string()));
                break;
            }
            Err(_) => {
                akis_hatasi = Some(Hata::Ag("indirme zaman aşımına uğradı".into()));
                break;
            }
        }
    }

    // Close the channel first so the blocking writer flushes and drops the file handle before any remove/read.
    // Önce kanalı kapat ki blocking yazıcı boşaltıp dosya tutamacını silme/okumadan önce bıraksın.
    drop(tx);
    let yazma_sonucu = yazici.await;

    if let Some(hata) = akis_hatasi {
        let _ = std::fs::remove_file(&gecici);
        return Err(hata);
    }
    match yazma_sonucu {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            let _ = std::fs::remove_file(&gecici);
            return Err(e.into());
        }
        Err(e) => {
            let _ = std::fs::remove_file(&gecici);
            return Err(Hata::Depolama(e.to_string()));
        }
    }

    let _ = app.emit(OLAY_ILERLEME, IndirmeIlerleme { indirilen, toplam });

    // Verify digest BEFORE renaming so an unverified file never takes the final name.
    // Doğrulanmamış bir dosya asla son adı almasın diye özeti yeniden adlandırmadan ÖNCE denetle.
    let gecici_ozet = gecici.clone();
    let hesaplanan = tokio::task::spawn_blocking(move || dosya_sha256(&gecici_ozet))
        .await
        .map_err(|e| Hata::Depolama(e.to_string()))?;

    let hesaplanan = match hesaplanan {
        Ok(h) => h,
        Err(e) => {
            let _ = std::fs::remove_file(&gecici);
            return Err(e);
        }
    };

    if hesaplanan != beklenen {
        let _ = std::fs::remove_file(&gecici);
        return Err(Hata::Diger("özet eşleşmedi".into()));
    }

    if IPTAL.load(AtomicOrdering::SeqCst) {
        let _ = std::fs::remove_file(&gecici);
        return Err(Hata::Diger("iptal".into()));
    }

    let gecici_tasi = gecici.clone();
    let hedef_tasi = hedef.clone();
    let tasima = tokio::task::spawn_blocking(move || std::fs::rename(&gecici_tasi, &hedef_tasi))
        .await
        .map_err(|e| Hata::Depolama(e.to_string()))?;
    if let Err(e) = tasima {
        let _ = std::fs::remove_file(&gecici);
        return Err(e.into());
    }

    Ok(hedef.to_string_lossy().into_owned())
}

/// Signals an in-flight download to stop and delete its `.part` file.
/// Süren indirmeye durup `.part` dosyasını silmesi için işaret verir.
#[tauri::command]
pub fn guncelleme_iptal() {
    IPTAL.store(true, AtomicOrdering::SeqCst);
}

/// Whether the app is allowed to launch APK installs (always true on Linux desktop).
/// Uygulamanın APK kurulumu başlatma izni olup olmadığı (Linux masaüstünde her zaman true).
#[tauri::command]
pub fn guncelleme_izin_var() -> bool {
    if cfg!(target_os = "android") {
        crate::android_jni::guncelleme_izin_var()
    } else {
        true
    }
}

/// Opens Android's "install unknown apps" settings screen for rubychat.
/// Android'de rubychat için "bilinmeyen uygulamaları yükle" ayar ekranını açar.
#[tauri::command]
pub fn guncelleme_izin_ac() -> Sonuc<()> {
    if cfg!(target_os = "android") {
        crate::android_jni::guncelleme_izin_ac().map_err(Hata::Diger)
    } else {
        Err(Hata::Diger("yalnızca Android".into()))
    }
}

/// Launches the Android package installer for a verified APK inside our update cache directory.
/// Güncelleme önbellek klasöründeki doğrulanmış APK için Android paket yükleyicisini başlatır.
#[tauri::command]
pub fn guncelleme_kur(app: AppHandle, yol: String) -> Sonuc<bool> {
    if cfg!(target_os = "android") {
        let kok = std::fs::canonicalize(app.path().app_cache_dir()?.join("guncelleme"))
            .map_err(|_| Hata::Diger("güncelleme klasörü bulunamadı".into()))?;
        let dosya = std::fs::canonicalize(&yol)
            .map_err(|_| Hata::Diger("güncelleme dosyası bulunamadı".into()))?;
        // Refuse anything outside our own update cache folder so a caller cannot feed arbitrary paths to FileProvider.
        // Çağıranın FileProvider'a rastgele yol verememesi için kendi güncelleme önbellek klasörümüz dışındakileri reddet.
        if !dosya.starts_with(&kok) || dosya.extension().and_then(|e| e.to_str()) != Some("apk") {
            return Err(Hata::Diger("geçersiz güncelleme yolu".into()));
        }
        crate::android_jni::guncelleme_kur(&dosya.to_string_lossy()).map_err(Hata::Diger)
    } else {
        let _ = (app, yol);
        Err(Hata::Diger("flatpak: komutla kurulur".into()))
    }
}

#[cfg(test)]
mod testler {
    use super::*;

    #[test]
    fn surum_siralamasi() {
        let b9 = Surum::ayristir("v0.1.0-beta.9").unwrap();
        let b10 = Surum::ayristir("0.1.0-beta.10").unwrap();
        let rc1 = Surum::ayristir("v0.1.0-rc.1").unwrap();
        let kararli = Surum::ayristir("0.1.0").unwrap();
        let sonraki = Surum::ayristir("0.2.0-alpha.1").unwrap();

        assert!(b10 > b9, "beta.10 sayısal olarak beta.9'dan büyük olmalı");
        assert!(rc1 > b10, "rc > beta");
        assert!(kararli > rc1, "kararlı sürüm ön sürümden büyük olmalı");
        assert!(sonraki > kararli, "çekirdek sürüm farkı önce gelir");
        assert_eq!(Surum::ayristir("v0.1.0-beta.9"), Surum::ayristir("0.1.0-beta.9"));
    }

    #[test]
    fn gecersiz_surumler() {
        assert!(Surum::ayristir("").is_none());
        assert!(Surum::ayristir("0.1").is_none());
        assert!(Surum::ayristir("0.1.0.1").is_none());
        assert!(Surum::ayristir("0.1.0-beta.abc").is_none());
        assert!(Surum::ayristir("0.1.0-").is_none());
    }

    #[test]
    fn sha256_ayristirma() {
        let hex_apk = "A".repeat(64);
        let hex_fp = "0123456789abcdef".repeat(4);
        let notlar = format!("Değişiklikler\n- APK: `{hex_apk}`\nFlatpak: `{hex_fp}`\n");
        assert_eq!(notlardan_sha256(&notlar, "APK"), Some("a".repeat(64)));
        assert_eq!(notlardan_sha256(&notlar, "Flatpak"), Some(hex_fp.clone()));
        assert_eq!(digest_sha256(&format!("sha256:{hex_apk}")), Some("a".repeat(64)));
        assert_eq!(digest_sha256("md5:1234"), None);
    }

    #[test]
    fn indirme_guvenlik_denetimi() {
        assert!(indirme_dogrula(
            "https://github.com/Shuraimr/rubychat/releases/download/v0.1.0-beta.10/rubychat.apk",
            "rubychat-0.1.0-beta.10.apk"
        )
        .is_ok());
        assert!(indirme_dogrula("https://example.com/rubychat.apk", "rubychat.apk").is_err());
        assert!(indirme_dogrula(
            "https://github.com/Shuraimr/rubychat/releases/download/v1/a.apk",
            "../kotu.apk"
        )
        .is_err());
        assert!(indirme_dogrula(
            "https://github.com/Shuraimr/rubychat/releases/download/v1/a.sh",
            "betik.sh"
        )
        .is_err());
    }
}
