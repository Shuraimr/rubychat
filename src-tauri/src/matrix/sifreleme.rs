//! End-to-end encryption housekeeping that makes E2EE usable day to day:
//!  1. cross-signing: create it for a brand-new account, ask for the password when the server wants it (UIA)
//!  2. device verification: SAS emoji flow with another of our devices (we request it, or they request it from us)
//!  3. recovery: secret storage + key backup (create a recovery key, or enter it to unlock this device)
//!  4. a state stream so the UI always knows where we are (`sifreleme-durumu`, `dogrulama-guncellendi`)
//! Gündelik kullanımda uçtan uca şifrelemeyi kullanılabilir yapan işler:
//!  1. çapraz imza: yeni hesap için oluştur, sunucu isterse şifreyi sor (UIA)
//!  2. cihaz doğrulama: öteki cihazlarımızdan biriyle SAS emoji akışı (biz isteriz ya da onlar bizden ister)
//!  3. kurtarma: gizli depo + anahtar yedeği (kurtarma anahtarı oluştur ya da bu cihazın kilidini açmak için gir)
//!  4. arayüz hep nerede olduğumuzu bilsin diye durum akışı (`sifreleme-durumu`, `dogrulama-guncellendi`)
//!
//! Secrets rule: the recovery key and the account password are NEVER logged and never stored; they only pass through
//! as command arguments / the return value of `kurtarma_olustur`.
//! Sır kuralı: kurtarma anahtarı ve hesap şifresi ASLA günlüğe yazılmaz ve saklanmaz; yalnızca komut argümanı /
//! `kurtarma_olustur` dönüş değeri olarak geçer.

use std::{
    fmt::Display,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use futures_util::StreamExt;
use matrix_sdk::{
    encryption::{
        backups::BackupState,
        recovery::RecoveryState,
        verification::{SasState, SasVerification, VerificationRequest, VerificationRequestState},
    },
    ruma::{
        api::client::uiaa::{AuthData, AuthType, MatrixUserIdentifier, Password, UserIdentifier},
        events::key::verification::request::ToDeviceKeyVerificationRequestEvent,
    },
    Client,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::{
    durum::{AktifDogrulama, AppState},
    hata::{Hata, Sonuc},
    tipler::{
        CaprazImza, DogrulamaAsamasi, DogrulamaDurumu, KurtarmaDurumu, SasEmoji, SifrelemeDurumu, YedekDurumu,
    },
};

pub const OLAY_SIFRELEME: &str = "sifreleme-durumu";
pub const OLAY_DOGRULAMA: &str = "dogrulama-guncellendi";

fn hata(e: impl Display) -> Hata {
    Hata::Sifreleme(e.to_string())
}

fn simdi_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ---------------------------------------------------------------------------------------------------------------
// State · Durum
// ---------------------------------------------------------------------------------------------------------------

/// Builds the current encryption state from the SDK (no network calls). · SDK'dan güncel şifreleme durumunu kurar (ağ çağrısı yok).
pub async fn durum_hesapla(durum: &AppState, client: &Client) -> SifrelemeDurumu {
    let enc = client.encryption();
    let (kimlik_sorgulandi, parola_gerekli) = {
        let k = durum.sifreleme.lock().unwrap();
        (k.kimlik_sorgulandi, k.parola_gerekli)
    };
    let kimlik_var = match client.user_id() {
        Some(u) => enc.get_user_identity(u).await.ok().flatten().is_some(),
        None => false,
    };
    let capraz_imza = if kimlik_var {
        CaprazImza::Hazir
    } else if kimlik_sorgulandi {
        CaprazImza::Yok
    } else {
        CaprazImza::Bekliyor
    };
    let cihaz_dogrulandi = enc.get_own_device().await.ok().flatten().map(|d| d.is_verified()).unwrap_or(false);
    let yedek = match enc.backups().state() {
        BackupState::Enabled => YedekDurumu::Acik,
        BackupState::Creating | BackupState::Enabling | BackupState::Resuming | BackupState::Downloading => {
            YedekDurumu::Yukleniyor
        }
        _ => YedekDurumu::Kapali,
    };
    let kurtarma = match enc.recovery().state() {
        RecoveryState::Enabled => KurtarmaDurumu::Hazir,
        RecoveryState::Incomplete => KurtarmaDurumu::Eksik,
        RecoveryState::Disabled => KurtarmaDurumu::Kapali,
        RecoveryState::Unknown => KurtarmaDurumu::Bilinmiyor,
    };
    SifrelemeDurumu { capraz_imza, cihaz_dogrulandi, yedek, kurtarma, parola_gerekli: parola_gerekli && !kimlik_var }
}

/// Recomputes the state and emits it only when it really changed. · Durumu yeniden hesaplar, yalnızca gerçekten değiştiyse yayınlar.
pub async fn yayinla(app: &AppHandle, client: &Client) {
    let durum = app.state::<AppState>();
    let yeni = durum_hesapla(&durum, client).await;
    let degisti = {
        let mut k = durum.sifreleme.lock().unwrap();
        if k.son.as_ref() == Some(&yeni) {
            false
        } else {
            k.son = Some(yeni.clone());
            true
        }
    };
    if degisti {
        let _ = app.emit(OLAY_SIFRELEME, yeni);
    }
}

/// Starts everything encryption needs while logged in. The returned tasks are aborted on logout.
/// Giriş açıkken şifrelemenin ihtiyacı olan her şeyi başlatır. Dönen görevler çıkışta durdurulur.
pub fn baslat(app: AppHandle, client: Client, isleyici: bool) -> Vec<JoinHandle<()>> {
    // Another device asks to verify with us. The handler lives as long as the client.
    // Başka bir cihaz bizimle doğrulama istiyor. İşleyici istemci kadar yaşar.
    // `isleyici` = false: a client coming back still has it. · `isleyici` = false: dönen istemcide zaten var.
    if isleyici {
        dogrulama_isleyicisi(app.clone(), &client);
    }

    vec![izleyici(app.clone(), client.clone()), capraz_imza_hazirla(app, client)]
}

fn dogrulama_isleyicisi(a: AppHandle, client: &Client) {
    client.add_event_handler(move |ev: ToDeviceKeyVerificationRequestEvent, client: Client| {
        let app = a.clone();
        async move {
            // Only verification of our OWN devices is supported (no verifying other people yet).
            // Yalnızca KENDİ cihazlarımızın doğrulanması desteklenir (başkalarını doğrulama henüz yok).
            if Some(ev.sender.as_ref()) != client.user_id() {
                return;
            }
            // The spec says to ignore requests older than 10 minutes. · Şartname 10 dakikadan eski istekleri yok saymayı söyler.
            let ts: u64 = ev.content.timestamp.0.into();
            if simdi_ms().saturating_sub(ts) > 10 * 60 * 1000 {
                return;
            }
            let Some(istek) = client.encryption().get_verification_request(&ev.sender, &ev.content.transaction_id).await
            else {
                return;
            };
            // Do not interrupt a flow that is still running. · Süren bir akışı bölme.
            {
                let durum = app.state::<AppState>();
                let kilit = durum.dogrulama.lock().await;
                if let Some(a) = kilit.as_ref() {
                    if !matches!(
                        a.durum.asama,
                        DogrulamaAsamasi::Yok | DogrulamaAsamasi::Bitti | DogrulamaAsamasi::Iptal
                    ) {
                        return;
                    }
                }
            }
            izlemeyi_baslat(&app, istek).await;
        }
    });
}

/// Emits the state again whenever recovery / backup / verification state changes (plus a slow heartbeat for the rest,
/// e.g. the cross-signing identity that arrives with a key query).
/// Kurtarma / yedek / doğrulama durumu değişince durumu yeniden yayınlar (ayrıca diğerleri için yavaş bir nabız; ör. anahtar
/// sorgusuyla gelen çapraz imza kimliği).
fn izleyici(app: AppHandle, client: Client) -> JoinHandle<()> {
    tokio::spawn(async move {
        let enc = client.encryption();
        let mut kurtarma = Box::pin(enc.recovery().state_stream());
        let mut yedek = Box::pin(enc.backups().state_stream());
        let mut dogrulama = enc.verification_state();
        yayinla(&app, &client).await;
        loop {
            tokio::select! {
                r = kurtarma.next() => if r.is_none() { break },
                r = yedek.next() => if r.is_none() { break },
                r = dogrulama.next() => if r.is_none() { break },
                _ = tokio::time::sleep(Duration::from_secs(20)) => {}
            }
            yayinla(&app, &client).await;
        }
    })
}

/// A UIA failure means "the server wants more proof"; true when it accepts the account password.
/// UIA hatası "sunucu daha fazla kanıt istiyor" demektir; sunucu hesap şifresini kabul ediyorsa true.
fn parola_kabul_ediliyor(e: &matrix_sdk::Error) -> Option<bool> {
    e.as_uiaa_response().map(|i| i.flows.iter().any(|f| f.stages.contains(&AuthType::Password)))
}

/// Creates cross-signing for an account that has none. If the server wants the password the UI is told (`parolaGerekli`).
/// Çapraz imzası olmayan hesap için oluşturur. Sunucu şifre isterse arayüze haber verilir (`parolaGerekli`).
fn capraz_imza_hazirla(app: AppHandle, client: Client) -> JoinHandle<()> {
    tokio::spawn(async move {
        let enc = client.encryption();
        enc.wait_for_e2ee_initialization_tasks().await;
        for deneme in 1..=6u32 {
            match enc.bootstrap_cross_signing_if_needed(None).await {
                Ok(()) => {
                    let durum = app.state::<AppState>();
                    let mut k = durum.sifreleme.lock().unwrap();
                    k.kimlik_sorgulandi = true;
                    k.parola_gerekli = false;
                    break;
                }
                Err(e) => {
                    if let Some(parola) = parola_kabul_ediliyor(&e) {
                        let durum = app.state::<AppState>();
                        let mut k = durum.sifreleme.lock().unwrap();
                        k.kimlik_sorgulandi = true;
                        k.parola_gerekli = parola;
                        info!("çapraz imza için hesap şifresi gerekiyor (parola kabul: {parola})");
                        break;
                    }
                    // Probably offline: try again later. · Muhtemelen çevrimdışı: sonra yeniden dene.
                    warn!("çapraz imza kontrolü olmadı (deneme {deneme}): {e}");
                    tokio::time::sleep(Duration::from_secs(10 * u64::from(deneme))).await;
                }
            }
        }
        yayinla(&app, &client).await;
    })
}

/// UI → "create cross-signing with this password". The password is used for this one call and dropped.
/// Arayüz → "çapraz imzayı bu şifreyle oluştur". Şifre bu tek çağrıda kullanılır ve atılır.
pub async fn capraz_imza_kur(app: &AppHandle, client: &Client, parola: String) -> Sonuc<()> {
    let enc = client.encryption();
    let Some(kullanici) = client.user_id().map(|u| u.to_string()) else { return Err(Hata::OturumYok) };
    match enc.bootstrap_cross_signing(None).await {
        Ok(()) => {}
        Err(e) => match parola_kabul_ediliyor(&e) {
            Some(true) => {
                let mut p = Password::new(UserIdentifier::Matrix(MatrixUserIdentifier::new(kullanici)), parola);
                p.session = e.as_uiaa_response().and_then(|i| i.session.clone());
                if let Err(e2) = enc.bootstrap_cross_signing(Some(AuthData::Password(p))).await {
                    // Still a UIA response = the server rejected the password. · Hâlâ UIA yanıtı = sunucu şifreyi reddetti.
                    return Err(if e2.as_uiaa_response().is_some() { Hata::Giris("şifre kabul edilmedi".into()) } else { hata(e2) });
                }
            }
            Some(false) => return Err(hata("sunucu şifreyle onay kabul etmiyor (tarayıcıda onay gerekebilir)")),
            None => return Err(hata(e)),
        },
    }
    {
        let durum = app.state::<AppState>();
        let mut k = durum.sifreleme.lock().unwrap();
        k.kimlik_sorgulandi = true;
        k.parola_gerekli = false;
    }
    yayinla(app, client).await;
    Ok(())
}

// ---------------------------------------------------------------------------------------------------------------
// Recovery · Kurtarma
// ---------------------------------------------------------------------------------------------------------------

/// Creates secret storage + key backup and returns the new recovery key (shown ONCE by the UI).
/// Gizli depo + anahtar yedeğini oluşturur ve yeni kurtarma anahtarını döndürür (arayüz BİR KEZ gösterir).
pub async fn kurtarma_olustur(app: &AppHandle, client: &Client) -> Sonuc<String> {
    let anahtar = client.encryption().recovery().enable().await.map_err(hata)?;
    yayinla(app, client).await;
    Ok(anahtar)
}

/// Unlocks this device with the recovery key: imports cross-signing keys (the device becomes verified) and the backup key
/// (old room keys are then downloaded because of `BackupDownloadStrategy::OneShot`, see `oturum.rs`).
/// Bu cihazın kilidini kurtarma anahtarıyla açar: çapraz imza anahtarlarını (cihaz doğrulanır) ve yedek anahtarını içe aktarır
/// (eski oda anahtarları `BackupDownloadStrategy::OneShot` sayesinde indirilir, bkz. `oturum.rs`).
pub async fn kurtarma_kurtar(app: &AppHandle, client: &Client, anahtar: &str) -> Sonuc<()> {
    let anahtar = anahtar.trim();
    if anahtar.is_empty() {
        return Err(Hata::Sifreleme("kurtarma anahtarı boş".into()));
    }
    client.encryption().recovery().recover(anahtar).await.map_err(hata)?;
    yayinla(app, client).await;
    Ok(())
}

// ---------------------------------------------------------------------------------------------------------------
// Verification · Doğrulama
// ---------------------------------------------------------------------------------------------------------------

/// "Element Web (ABCDEF)" or just the device id. · "Element Web (ABCDEF)" ya da yalnızca cihaz kimliği.
fn cihaz_adi(gorunen: Option<&str>, kimlik: &str) -> String {
    match gorunen {
        Some(ad) => format!("{ad} ({kimlik})"),
        None => kimlik.to_owned(),
    }
}

/// Changes the active flow's state and tells the UI. · Etkin akışın durumunu değiştirir ve arayüze bildirir.
async fn guncelle(app: &AppHandle, f: impl FnOnce(&mut DogrulamaDurumu)) {
    let durum = app.state::<AppState>();
    let mut kilit = durum.dogrulama.lock().await;
    if let Some(a) = kilit.as_mut() {
        f(&mut a.durum);
        let _ = app.emit(OLAY_DOGRULAMA, a.durum.clone());
    }
}

/// Registers the request as the active flow and starts watching it (replacing an old finished one).
/// İsteği etkin akış olarak kaydeder ve izlemeye başlar (biten eskisinin yerine).
async fn izlemeyi_baslat(app: &AppHandle, istek: VerificationRequest) {
    let durum = app.state::<AppState>();
    let mut kilit = durum.dogrulama.lock().await;
    if let Some(eski) = kilit.take() {
        eski.gorev.abort();
    }
    let gorev = tokio::spawn(istegi_izle(app.clone(), istek.clone()));
    *kilit = Some(AktifDogrulama { istek, sas: None, gorev, durum: DogrulamaDurumu::default() });
}

/// Follows one verification request from "created/requested" to "done/cancelled". We start SAS ourselves only when we
/// made the request; when the other side asked, it picks the method and we just follow (we only offer SAS emoji).
/// Bir doğrulama isteğini "oluştu/istendi"den "bitti/iptal"e kadar izler. SAS'ı yalnızca isteği biz yaptıysak biz başlatırız;
/// öteki taraf istediyse yöntemi o seçer, biz izleriz (yalnızca SAS emoji sunarız).
async fn istegi_izle(app: AppHandle, istek: VerificationRequest) {
    // `changes()` may not repeat the current state, so we start from `state()` ourselves.
    // `changes()` güncel durumu tekrarlamayabilir; bu yüzden `state()`ten kendimiz başlarız.
    let mut siradaki = Some(istek.state());
    let mut akis = Box::pin(istek.changes());
    let mut sas_istendi = false;
    loop {
        let d = match siradaki.take() {
            Some(d) => d,
            None => match akis.next().await {
                Some(d) => d,
                None => break,
            },
        };
        match d {
            VerificationRequestState::Created { .. } => {
                guncelle(&app, |s| s.asama = DogrulamaAsamasi::IstekGonderildi).await;
            }
            VerificationRequestState::Requested { other_device_data, .. } => {
                let ad = cihaz_adi(other_device_data.display_name(), other_device_data.device_id().as_str());
                guncelle(&app, |s| {
                    s.asama = DogrulamaAsamasi::GelenIstek;
                    s.diger_cihaz = Some(ad);
                })
                .await;
            }
            VerificationRequestState::Ready { other_device_data, .. } => {
                let ad = cihaz_adi(other_device_data.display_name(), other_device_data.device_id().as_str());
                guncelle(&app, |s| {
                    s.asama = DogrulamaAsamasi::Hazir;
                    s.diger_cihaz = Some(ad);
                })
                .await;
                if istek.we_started() && !sas_istendi {
                    sas_istendi = true;
                    if let Err(e) = istek.start_sas().await {
                        warn!("SAS başlatılamadı: {e}");
                        guncelle(&app, |s| {
                            s.asama = DogrulamaAsamasi::Iptal;
                            s.neden = Some(e.to_string());
                        })
                        .await;
                        break;
                    }
                }
            }
            VerificationRequestState::Transitioned { verification } => {
                if let Some(sas) = verification.sas() {
                    sas_izle(&app, sas).await;
                }
                break;
            }
            VerificationRequestState::Done => {
                guncelle(&app, |s| s.asama = DogrulamaAsamasi::Bitti).await;
                break;
            }
            VerificationRequestState::Cancelled(bilgi) => {
                let neden = bilgi.reason().to_owned();
                guncelle(&app, |s| {
                    s.asama = DogrulamaAsamasi::Iptal;
                    s.neden = Some(neden);
                })
                .await;
                break;
            }
        }
    }
}

/// Follows the SAS part: accepts the other side's start, hands the seven emojis to the UI, reports the end.
/// SAS bölümünü izler: öteki tarafın başlatmasını kabul eder, yedi emojiyi arayüze verir, sonu bildirir.
async fn sas_izle(app: &AppHandle, sas: SasVerification) {
    {
        let durum = app.state::<AppState>();
        let mut kilit = durum.dogrulama.lock().await;
        if let Some(a) = kilit.as_mut() {
            a.sas = Some(sas.clone());
        }
    }
    let mut siradaki = Some(sas.state());
    let mut akis = Box::pin(sas.changes());
    loop {
        let s = match siradaki.take() {
            Some(s) => s,
            None => match akis.next().await {
                Some(s) => s,
                None => break,
            },
        };
        match s {
            SasState::Started { .. } => {
                if !sas.we_started() {
                    if let Err(e) = sas.accept().await {
                        warn!("SAS kabul edilemedi: {e}");
                    }
                }
                guncelle(app, |s| s.asama = DogrulamaAsamasi::Hazir).await;
            }
            SasState::Created { .. } | SasState::Accepted { .. } => {
                guncelle(app, |s| s.asama = DogrulamaAsamasi::Hazir).await;
            }
            SasState::KeysExchanged { emojis, .. } => {
                let liste: Vec<SasEmoji> = emojis
                    .map(|e| e.emojis.iter().map(|x| SasEmoji { simge: x.symbol.to_owned(), ad: x.description.to_owned() }).collect())
                    .unwrap_or_default();
                guncelle(app, |s| {
                    s.asama = DogrulamaAsamasi::Emoji;
                    s.emojiler = liste;
                })
                .await;
            }
            SasState::Confirmed => {
                guncelle(app, |s| s.asama = DogrulamaAsamasi::OnayBekleniyor).await;
            }
            SasState::Done { .. } => {
                guncelle(app, |s| {
                    s.asama = DogrulamaAsamasi::Bitti;
                    s.emojiler.clear();
                })
                .await;
                break;
            }
            SasState::Cancelled(bilgi) => {
                let neden = bilgi.reason().to_owned();
                guncelle(app, |s| {
                    s.asama = DogrulamaAsamasi::Iptal;
                    s.neden = Some(neden);
                    s.emojiler.clear();
                })
                .await;
                break;
            }
        }
    }
}

/// Asks our other devices to verify this one. · Öteki cihazlarımızdan bu cihazı doğrulamalarını ister.
pub async fn dogrulama_baslat(app: &AppHandle, client: &Client) -> Sonuc<()> {
    let Some(me) = client.user_id() else { return Err(Hata::OturumYok) };
    let kimlik = client
        .encryption()
        .request_user_identity(me)
        .await
        .map_err(hata)?
        .ok_or_else(|| Hata::Sifreleme("hesapta çapraz imza yok".into()))?;
    let istek = kimlik.request_verification().await.map_err(hata)?;
    izlemeyi_baslat(app, istek).await;
    Ok(())
}

/// A request that arrived from another device: accept it. · Başka cihazdan gelen isteği kabul et.
pub async fn dogrulama_kabul_et(app: &AppHandle) -> Sonuc<()> {
    let istek = {
        let durum = app.state::<AppState>();
        let kilit = durum.dogrulama.lock().await;
        kilit.as_ref().map(|a| a.istek.clone()).ok_or_else(|| Hata::Sifreleme("etkin doğrulama yok".into()))?
    };
    istek.accept().await.map_err(hata)
}

async fn etkin_sas(app: &AppHandle) -> Sonuc<SasVerification> {
    let durum = app.state::<AppState>();
    let kilit = durum.dogrulama.lock().await;
    kilit.as_ref().and_then(|a| a.sas.clone()).ok_or_else(|| Hata::Sifreleme("emoji doğrulaması etkin değil".into()))
}

/// "The emojis match" · "Emojiler eşleşiyor"
pub async fn dogrulama_onayla(app: &AppHandle) -> Sonuc<()> {
    etkin_sas(app).await?.confirm().await.map_err(hata)
}

/// "The emojis do NOT match" (cancels the flow with a mismatch). · "Emojiler eşleşmiyor" (akışı uyuşmazlıkla iptal eder).
pub async fn dogrulama_eslesmiyor(app: &AppHandle) -> Sonuc<()> {
    etkin_sas(app).await?.mismatch().await.map_err(hata)
}

/// Cancels the active flow if it is still running, then resets to "no flow" (also used to dismiss a finished one).
/// Etkin akış sürüyorsa iptal eder, sonra "akış yok"a sıfırlar (biteni kapatmak için de kullanılır).
pub async fn dogrulama_iptal(app: &AppHandle) -> Sonuc<()> {
    let durum = app.state::<AppState>();
    let eski = durum.dogrulama.lock().await.take();
    if let Some(a) = eski {
        a.gorev.abort();
        let bitti = matches!(a.durum.asama, DogrulamaAsamasi::Bitti | DogrulamaAsamasi::Iptal | DogrulamaAsamasi::Yok);
        if !bitti {
            // Best effort: the other side learns that we gave up. · Elinden geleni yapar: öteki taraf vazgeçtiğimizi öğrenir.
            let _ = match a.sas {
                Some(sas) => sas.cancel().await,
                None => a.istek.cancel().await,
            };
        }
    }
    let _ = app.emit(OLAY_DOGRULAMA, DogrulamaDurumu::default());
    Ok(())
}

/// Snapshot for the UI after it (re)loads. · Arayüz (yeniden) yüklenince anlık görüntü.
pub async fn dogrulama_durumu(app: &AppHandle) -> DogrulamaDurumu {
    let durum = app.state::<AppState>();
    let kilit = durum.dogrulama.lock().await;
    kilit.as_ref().map(|a| a.durum.clone()).unwrap_or_default()
}

/// Called on logout: stops a running flow without telling anybody. · Çıkışta çağrılır: süren akışı kimseye söylemeden durdurur.
pub async fn temizle(durum: &AppState) {
    if let Some(a) = durum.dogrulama.lock().await.take() {
        a.gorev.abort();
    }
    *durum.sifreleme.lock().unwrap() = Default::default();
}
