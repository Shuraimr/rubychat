//! Login, session persistence, restore and logout.
//! Giriş, oturumu kaydetme, geri yükleme ve çıkış.
//!
//! Disk layout (inside Tauri's `app_data_dir`, which also works on Android):
//!   oturum.json   → homeserver URL + which secret backend holds the secrets (NO secrets when a backend works)
//!   secret store  → store passphrase + MatrixSession (access/refresh token, user & device id), as one JSON blob
//!                   under the key "oturum" in the OS keyring / Android Keystore (see `gizli_depo.rs`)
//!   depo/         → matrix-sdk SQLite stores (state, crypto keys, event cache), encrypted with the passphrase
//! Disk düzeni (Tauri'nin `app_data_dir` klasörü; Android'de de çalışır):
//!   oturum.json   → sunucu adresi + gizli bilgilerin hangi arka uçta durduğu (arka uç çalışıyorsa GİZLİ BİLGİ YOK)
//!   gizli depo    → depo parolası + MatrixSession (erişim/yenileme belirteci, kullanıcı ve cihaz kimliği), tek JSON olarak,
//!                   işletim sistemi anahtarlığında / Android Keystore'da "oturum" anahtarıyla (bkz. `gizli_depo.rs`)
//!   depo/         → matrix-sdk SQLite depoları (durum, şifreleme anahtarları, olay önbelleği), parolayla şifreli
//!
//! Fallback: if the secret backend fails at runtime (e.g. no Secret Service daemon) the secrets stay in `oturum.json`
//! (mode 0600) exactly like before, `gizli_depo = "dosya"` is reported to the UI and a warning is logged.
//! Migration: an old `oturum.json` that still contains the secrets is moved into the backend on the next start.
//! `Kayit` is the ONLY place that touches the file or the backend.
//! Yedek: gizli arka uç çalışma anında başarısız olursa (ör. Secret Service yok) gizli bilgiler eskisi gibi `oturum.json`da
//! (0600 izni) kalır, arayüze `gizli_depo = "dosya"` bildirilir ve uyarı günlüğe yazılır.
//! Taşıma: gizli bilgileri hâlâ içeren eski bir `oturum.json`, sonraki açılışta arka uca taşınır.
//! Dosyaya ve arka uca yalnızca `Kayit` dokunur.

use std::path::{Path, PathBuf};

use matrix_sdk::{
    authentication::{
        matrix::MatrixSession,
        oauth::{ClientId, OAuthSession, UserSession},
    },
    sliding_sync::VersionBuilder,
    store::RoomLoadSettings,
    encryption::{BackupDownloadStrategy, EncryptionSettings},
    Client, SessionChange,
};
use serde::{Deserialize, Serialize};
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::{
    gizli_depo,
    hata::{Hata, Sonuc},
    tipler::Ben,
};

const OTURUM_DOSYASI: &str = "oturum.json";
const DEPO_KLASORU: &str = "depo";
/// Message search index (see `dizin.rs`); decrypted text lives here, so it must go away with the session.
/// Mesaj arama dizini (bkz. `dizin.rs`); çözülmüş metin burada durur, bu yüzden oturumla birlikte silinmeli.
pub const DIZIN_KLASORU: &str = "arama-dizini";
/// Key under which the secrets blob is stored in the backend. · Gizli bilgi paketinin arka uçtaki anahtarı.
const GIZLI_ANAHTAR: &str = "oturum";
fn anahtar(veri: &Path) -> String {
    super::hesaplar::gizli_anahtar(veri, GIZLI_ANAHTAR)
}
/// `Dosya::gizli` value meaning "secrets are inside this file". · "Gizli bilgiler bu dosyanın içinde" anlamındaki değer.
const GIZLI_DOSYADA: &str = "dosya";

/// What `oturum.json` contains. `parola`/`oturum` are only filled in the fallback mode or in an old (pre-keyring) file.
/// `oturum.json`ın içeriği. `parola`/`oturum` yalnızca yedek kipte ya da eski (anahtarlık öncesi) dosyada dolu.
#[derive(Serialize, Deserialize)]
struct Dosya {
    sunucu_url: String,
    sunucu_adi: String,
    /// Where the secrets live: backend name or "dosya". Missing in old files → treated as "dosya".
    /// Gizli bilgilerin yeri: arka uç adı ya da "dosya". Eski dosyalarda yok → "dosya" sayılır.
    #[serde(default = "varsayilan_gizli")]
    gizli: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    parola: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    oturum: Option<MatrixSession>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    istemci_id: Option<String>,
}

fn varsayilan_gizli() -> String {
    GIZLI_DOSYADA.into()
}

/// The secrets blob stored in the backend. · Arka uçta saklanan gizli bilgi paketi.
#[derive(Serialize, Deserialize)]
struct Gizliler {
    parola: String,
    oturum: MatrixSession,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    istemci_id: Option<String>,
}

/// Everything about the saved session, secrets included (memory only).
/// Kayıtlı oturumla ilgili her şey, gizli bilgiler dahil (yalnızca bellekte).
struct Kayit {
    /// Final homeserver URL found by discovery (so restore works offline and skips discovery).
    /// Keşifle bulunan son sunucu adresi (geri yükleme çevrimdışı çalışsın, keşif atlansın diye).
    sunucu_url: String,
    /// Display form of what the user typed ("matrix.org"); shown on the Ben screen.
    /// Kullanıcının yazdığının gösterim biçimi ("matrix.org"); Ben ekranında gösterilir.
    sunucu_adi: String,
    parola: String,
    oturum: MatrixSession,
    /// Set = signed in through the browser (OAuth, see `cihaz_giris.rs`): tokens are refreshed at the authorization server with this id.
    /// Dolu = tarayıcıyla girilmiş (OAuth, bkz. `cihaz_giris.rs`): belirteçler yetkilendirme sunucusunda bu kimlikle yenilenir.
    istemci_id: Option<String>,
}

impl Kayit {
    fn yol(veri: &Path) -> PathBuf {
        veri.join(OTURUM_DOSYASI)
    }

    fn dosya_oku(veri: &Path) -> Sonuc<Option<Dosya>> {
        match std::fs::read(Self::yol(veri)) {
            Ok(b) => Ok(Some(serde_json::from_slice(&b)?)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    fn dosya_yaz(veri: &Path, d: &Dosya) -> Sonuc<()> {
        std::fs::create_dir_all(veri)?;
        let yol = Self::yol(veri);
        std::fs::write(&yol, serde_json::to_vec_pretty(d)?)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&yol, std::fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }

    /// Loads the session; moves secrets from the file into the backend when possible (migration).
    /// Returns `(Kayit, gizli_depo)` so callers already know the backend name without re-reading `oturum.json`.
    /// `Ok(None)` also when the file says the secrets are in the backend but the backend has lost them.
    /// Oturumu yükler; mümkünse gizli bilgileri dosyadan arka uca taşır (taşıma).
    /// Çağıranlar `oturum.json`'ı yeniden okumadan arka uç adını bilsin diye `(Kayit, gizli_depo)` döndürür.
    /// Dosya gizli bilgilerin arka uçta olduğunu söylüyor ama arka uç onları kaybetmişse de `Ok(None)`.
    fn yukle(veri: &Path) -> Sonuc<Option<(Kayit, String)>> {
        let Some(d) = Self::dosya_oku(veri)? else { return Ok(None) };
        let depo = gizli_depo::varsayilan();
        if let (Some(parola), Some(oturum)) = (d.parola.clone(), d.oturum.clone()) {
            // Secrets are in the file (old format or fallback mode): try the backend now.
            // Gizli bilgiler dosyada (eski biçim ya da yedek kip): şimdi arka ucu dene.
            let kayit = Kayit { sunucu_url: d.sunucu_url, sunucu_adi: d.sunucu_adi, parola, oturum, istemci_id: d.istemci_id };
            let mut gizli = d.gizli;
            if gizli == GIZLI_DOSYADA {
                match kayit.kaydet(veri) {
                    Ok(yeni_gizli) => {
                        if yeni_gizli != GIZLI_DOSYADA {
                            info!("gizli bilgiler dosyadan {} deposuna taşındı", depo.ad());
                        }
                        gizli = yeni_gizli;
                    }
                    Err(e) => warn!("gizli bilgiler taşınamadı, dosyada kalıyor: {e}"),
                }
            }
            return Ok(Some((kayit, gizli)));
        }
        match depo.oku(&anahtar(veri))? {
            Some(json) => {
                let g: Gizliler = serde_json::from_str(&json)?;
                Ok(Some((
                    Kayit { sunucu_url: d.sunucu_url, sunucu_adi: d.sunucu_adi, parola: g.parola, oturum: g.oturum, istemci_id: g.istemci_id },
                    d.gizli,
                )))
            }
            None => {
                warn!("oturum dosyası var ama {} deposunda gizli bilgi yok: yeniden giriş gerekir", depo.ad());
                Ok(None)
            }
        }
    }

    /// Writes secrets to the backend and the metadata to the file; falls back to the file for everything on failure.
    /// Returns the actual secret-store name written to `oturum.json`.
    /// Gizli bilgileri arka uca, üst bilgiyi dosyaya yazar; hata olursa her şeyi dosyaya yazar (yedek).
    /// `oturum.json`'a yazılan gerçek gizli depo adını döndürür.
    fn kaydet(&self, veri: &Path) -> Sonuc<String> {
        let depo = gizli_depo::varsayilan();
        let json = serde_json::to_string(&Gizliler { parola: self.parola.clone(), oturum: self.oturum.clone(), istemci_id: self.istemci_id.clone() })?;
        let mut d = Dosya {
            sunucu_url: self.sunucu_url.clone(),
            sunucu_adi: self.sunucu_adi.clone(),
            gizli: depo.ad().into(),
            parola: None,
            oturum: None,
            istemci_id: None,
        };
        if let Err(e) = depo.yaz(&anahtar(veri), &json) {
            // Never log the secrets themselves, only the reason. · Gizli bilgilerin kendisini değil, yalnızca nedeni günlüğe yaz.
            warn!("{} kullanılamıyor, gizli bilgiler dosyada tutulacak: {e}", depo.ad());
            d.gizli = GIZLI_DOSYADA.into();
            d.parola = Some(self.parola.clone());
            d.oturum = Some(self.oturum.clone());
            d.istemci_id = self.istemci_id.clone();
        }
        Self::dosya_yaz(veri, &d)?;
        Ok(d.gizli)
    }

    fn sil(veri: &Path) {
        let _ = std::fs::remove_file(Self::yol(veri));
        let _ = std::fs::remove_dir_all(veri.join(DEPO_KLASORU));
        let _ = std::fs::remove_dir_all(veri.join(DIZIN_KLASORU));
        let _ = std::fs::remove_file(veri.join(SLIDING_DOSYASI));
        if let Err(e) = gizli_depo::varsayilan().sil(&anahtar(veri)) {
            warn!("gizli depodan silinemedi: {e}");
        }
    }

    /// Runs `yukle` on the blocking pool because both file I/O and the OS secret backend (D-Bus / JNI) block.
    /// Hem dosya G/Ç hem de işletim sistemi gizli deposu (D-Bus / JNI) blokladığı için `yukle`'yi blocking havuzunda çalıştırır.
    async fn yukle_async(veri: PathBuf) -> Sonuc<Option<(Kayit, String)>> {
        tokio::task::spawn_blocking(move || Self::yukle(&veri))
            .await
            .map_err(|e| Hata::Depolama(e.to_string()))?
    }

    /// Runs `kaydet` on the blocking pool (keyring D-Bus / Android Keystore JNI + file I/O).
    /// `kaydet`'i blocking havuzunda çalıştırır (anahtarlık D-Bus / Android Keystore JNI + dosya G/Ç).
    async fn kaydet_async(self, veri: PathBuf) -> Sonuc<String> {
        tokio::task::spawn_blocking(move || self.kaydet(&veri))
            .await
            .map_err(|e| Hata::Depolama(e.to_string()))?
    }

    /// Runs `sil` on the blocking pool (`remove_dir_all` on SQLite + search index + secret backend delete).
    /// `sil`'i blocking havuzunda çalıştırır (SQLite + arama dizini `remove_dir_all` + gizli depodan silme).
    async fn sil_async(veri: PathBuf) {
        let _ = tokio::task::spawn_blocking(move || Self::sil(&veri)).await;
    }
}

/// 32 random bytes as hex: the passphrase that encrypts the SQLite stores.
/// 32 rastgele bayt (onaltılık): SQLite depolarını şifreleyen parola.
fn rastgele_parola() -> String {
    let bayt: [u8; 32] = rand::random();
    bayt.iter().map(|b| format!("{b:02x}")).collect()
}

/// Splits user input into (server, username). A full MXID "@ayse:example.org" overrides the server field.
/// Kullanıcı girdisini (sunucu, kullanıcı adı) olarak ayırır. Tam MXID "@ayse:example.org" sunucu alanını geçersiz kılar.
pub fn girdiyi_ayir(sunucu: &str, kullanici: &str) -> (String, String) {
    let kullanici = kullanici.trim();
    if let Some(rest) = kullanici.strip_prefix('@') {
        if let Some((yerel, sunucu_kismi)) = rest.split_once(':') {
            if !yerel.is_empty() && !sunucu_kismi.is_empty() {
                return (sunucu_kismi.to_owned(), yerel.to_owned());
            }
        }
    }
    (sunucu.trim().to_owned(), kullanici.to_owned())
}

/// Remembered answer of "does the server support sliding sync?", so a restore skips the `/versions` round trip (it made every
/// app start wait on the network). Not secret, so a plain file next to the session metadata.
/// "Sunucu sliding sync destekliyor mu?" sorusunun hatırlanan cevabı; geri yükleme `/versions` gidiş-dönüşünü atlar (her açılışı
/// ağa bekletiyordu). Gizli değil, oturum üst bilgisinin yanında düz bir dosya.
const SLIDING_DOSYASI: &str = "sliding-surumu";

fn sliding_oku(veri: &Path) -> VersionBuilder {
    match std::fs::read_to_string(veri.join(SLIDING_DOSYASI)).as_deref().map(str::trim) {
        Ok("native") => VersionBuilder::Native,
        Ok("none") => VersionBuilder::None,
        _ => VersionBuilder::DiscoverNative,
    }
}

async fn sliding_yaz_async(veri: PathBuf, client: &Client) {
    let s = if matches!(client.sliding_sync_version(), matrix_sdk::sliding_sync::Version::Native) { "native" } else { "none" };
    let _ = tokio::task::spawn_blocking(move || {
        if let Err(e) = std::fs::write(veri.join(SLIDING_DOSYASI), s) {
            warn!("sliding sync sürümü kaydedilemedi: {e}");
        }
    })
    .await;
}

/// Writes the remembered sliding-sync answer only if the file does not exist yet (off the async runtime).
/// Hatırlanan sliding-sync cevabını yalnızca dosya henüz yoksa yazar (async iş parçacığı dışında).
async fn sliding_eksikse_yaz_async(veri: PathBuf, client: &Client) {
    let s = if matches!(client.sliding_sync_version(), matrix_sdk::sliding_sync::Version::Native) { "native" } else { "none" };
    let _ = tokio::task::spawn_blocking(move || {
        let yol = veri.join(SLIDING_DOSYASI);
        if !yol.exists() {
            if let Err(e) = std::fs::write(yol, s) {
                warn!("sliding sync sürümü kaydedilemedi: {e}");
            }
        }
    })
    .await;
}

async fn istemci_kur(veri: &Path, parola: &str, sunucu: SunucuGirdisi<'_>) -> Sonuc<Client> {
    let veri_kopya = veri.to_owned();
    let oku = matches!(sunucu, SunucuGirdisi::Url(_));
    // Creating the store folder and reading the cached sliding-sync flag run on the blocking pool.
    // Depo klasörünü oluşturma ve önbellekteki sliding-sync bayrağını okuma blocking havuzunda çalışır.
    let (depo, surum) = tokio::task::spawn_blocking(move || -> Sonuc<(PathBuf, VersionBuilder)> {
        let depo = veri_kopya.join(DEPO_KLASORU);
        std::fs::create_dir_all(&depo)?;
        let surum = if oku { sliding_oku(&veri_kopya) } else { VersionBuilder::DiscoverNative };
        Ok((depo, surum))
    })
    .await
    .map_err(|e| Hata::Depolama(e.to_string()))??;
    let mut b = Client::builder()
        .sqlite_store(&depo, Some(parola))
        // Use sliding sync (MSC4186) when the server advertises it; otherwise `Version::None` → classic sync fallback.
        // Sunucu bildiriyorsa sliding sync (MSC4186); bildirmiyorsa `Version::None` → klasik sync yedeği.
        .sliding_sync_version_builder(surum)
        // Servers with expiring tokens (matrix.org via MAS) need refresh; we persist the new tokens in `token_izle`.
        // Süresi dolan belirteç kullanan sunucular (MAS'lı matrix.org) yenileme ister; yeni belirteçleri `token_izle` kaydeder.
        .handle_refresh_tokens()
        // E2EE: after the recovery key unlocks this device (or another device sends the backup key) download ALL old room
        // keys from the server backup once, so old messages decrypt. Cross-signing is created by `sifreleme.rs` (it may need
        // the password), and backups only together with a recovery key (a backup nobody can unlock is useless).
        // E2EE: kurtarma anahtarı bu cihazın kilidini açınca (ya da başka cihaz yedek anahtarını gönderince) sunucudaki yedekten
        // TÜM eski oda anahtarları bir kez indirilir; eski mesajlar çözülür. Çapraz imzayı `sifreleme.rs` oluşturur (şifre
        // gerekebilir); yedek yalnızca kurtarma anahtarıyla birlikte açılır (kimsenin açamadığı yedek işe yaramaz).
        .with_encryption_settings(EncryptionSettings {
            auto_enable_cross_signing: false,
            backup_download_strategy: BackupDownloadStrategy::OneShot,
            auto_enable_backups: false,
        });
    b = match sunucu {
        SunucuGirdisi::AdVeyaUrl(s) => b.server_name_or_homeserver_url(s),
        SunucuGirdisi::Url(u) => b.homeserver_url(u),
    };
    Ok(b.build().await?)
}

enum SunucuGirdisi<'a> {
    /// What the user typed: server name (discovery via .well-known) or a full URL.
    /// Kullanıcının yazdığı: sunucu adı (.well-known ile keşif) ya da tam adres.
    AdVeyaUrl(&'a str),
    /// Already-discovered URL from a saved session.
    /// Kayıtlı oturumdan gelen, daha önce bulunmuş adres.
    Url(&'a str),
}

/// Password login. The function is shaped as "build client → authenticate → persist" so a second method
/// (SSO / OIDC) can reuse `istemci_kur` + `kaydet` and only replace the authenticate step.
/// Şifreyle giriş. Fonksiyon "istemci kur → doğrula → kaydet" biçiminde; ikinci bir yöntem (SSO / OIDC)
/// `istemci_kur` + `kaydet`i yeniden kullanır, yalnızca "doğrula" adımını değiştirir.
pub async fn sifreyle_giris(veri: &Path, sunucu: &str, kullanici: &str, sifre: &str) -> Sonuc<(Client, Ben)> {
    let (sunucu, kullanici) = girdiyi_ayir(sunucu, kullanici);
    if sunucu.is_empty() || kullanici.is_empty() || sifre.is_empty() {
        return Err(Hata::Diger("sunucu, kullanıcı adı ve şifre gerekli".into()));
    }
    // A leftover store from an old session must not mix with the new account.
    // Eski oturumdan kalan depo yeni hesapla karışmasın.
    Kayit::sil_async(veri.to_owned()).await;
    let parola = rastgele_parola();
    let client = istemci_kur(veri, &parola, SunucuGirdisi::AdVeyaUrl(&sunucu)).await?;

    let auth = client.matrix_auth();
    let sonuc = auth
        .login_username(&kullanici, sifre)
        .initial_device_display_name("rubychat")
        .send()
        .await;
    if let Err(e) = sonuc {
        // Do not leave a half-created store behind. · Yarım kalmış depo bırakma.
        drop(client);
        Kayit::sil_async(veri.to_owned()).await;
        return Err(e.into());
    }

    let oturum = auth.session().ok_or(Hata::OturumYok)?;
    let gizli_depo = Kayit {
        sunucu_url: client.homeserver().to_string(),
        sunucu_adi: sunucu.clone(),
        parola,
        oturum,
        istemci_id: None,
    }
    .kaydet_async(veri.to_owned())
    .await?;
    sliding_yaz_async(veri.to_owned(), &client).await;
    info!("giriş başarılı");
    let ben = ben_kur(&client, sunucu, gizli_depo);
    Ok((client, ben))
}

/// Puts a session into a fresh client, through the API it was made with. · Oturumu yeni istemciye, yapıldığı API ile koyar.
async fn oturumu_ac(client: &Client, oturum: MatrixSession, istemci_id: Option<String>) -> Sonuc<()> {
    match istemci_id {
        Some(id) => {
            let o = OAuthSession { client_id: ClientId::new(id), user: UserSession { meta: oturum.meta, tokens: oturum.tokens } };
            client.oauth().restore_session(o, RoomLoadSettings::default()).await?;
        }
        None => client.matrix_auth().restore_session(oturum, RoomLoadSettings::default()).await?,
    }
    Ok(())
}

/// Discovery only: nothing is written to disk. · Yalnızca keşif: diske bir şey yazılmaz.
pub async fn kesif_istemcisi(sunucu: &str) -> Sonuc<Client> {
    Ok(Client::builder().server_name_or_homeserver_url(sunucu).build().await?)
}

/// Turns tokens approved in the browser into this device's session. · Tarayıcıda onaylanan belirteçleri bu cihazın oturumu yapar.
pub async fn oauth_giris(veri: &Path, sunucu_adi: &str, sunucu_url: &str, oturum: MatrixSession, istemci_id: String) -> Sonuc<(Client, Ben)> {
    Kayit::sil_async(veri.to_owned()).await;
    let parola = rastgele_parola();
    // The server's sliding sync support is asked again (see `istemci_kur`: the remembered answer was just deleted). · Sunucunun sliding sync desteği yeniden sorulur (hatırlanan cevap az önce silindi).
    let sonuc = async {
        let client = istemci_kur(veri, &parola, SunucuGirdisi::Url(sunucu_url)).await?;
        oturumu_ac(&client, oturum.clone(), Some(istemci_id.clone())).await?;
        Ok::<_, Hata>(client)
    }
    .await;
    let client = match sonuc {
        Ok(c) => c,
        Err(e) => {
            Kayit::sil_async(veri.to_owned()).await;
            return Err(e);
        }
    };
    // Tokens may already have been refreshed while starting. · Belirteçler açılırken yenilenmiş olabilir.
    let oturum = suanki_oturum(&client).unwrap_or(oturum);
    let gizli_depo = Kayit {
        sunucu_url: sunucu_url.to_owned(),
        sunucu_adi: sunucu_adi.to_owned(),
        parola,
        oturum,
        istemci_id: Some(istemci_id),
    }
    .kaydet_async(veri.to_owned())
    .await?;
    sliding_yaz_async(veri.to_owned(), &client).await;
    info!("tarayıcı onaylı giriş başarılı");
    let ben = ben_kur(&client, sunucu_adi.to_owned(), gizli_depo);
    Ok((client, ben))
}

/// The session as it is now, whichever API made it. · Hangi API ile yapıldıysa yapılsın, oturumun şimdiki hâli.
fn suanki_oturum(client: &Client) -> Option<MatrixSession> {
    Some(MatrixSession { meta: client.session_meta()?.to_owned(), tokens: client.session_tokens()? })
}

/// Restores the saved session on startup. `Ok(None)` = nothing saved (show the login screen).
/// Açılışta kayıtlı oturumu geri yükler. `Ok(None)` = kayıt yok (giriş ekranı gösterilir).
pub async fn geri_yukle(veri: &Path) -> Sonuc<Option<(Client, Ben)>> {
    let Some((kayit, gizli_depo)) = Kayit::yukle_async(veri.to_owned()).await? else { return Ok(None) };
    let sunucu_adi = kayit.sunucu_adi.clone();
    let client = istemci_kur(veri, &kayit.parola, SunucuGirdisi::Url(&kayit.sunucu_url)).await?;
    oturumu_ac(&client, kayit.oturum, kayit.istemci_id).await?;
    // Sessions from before this file existed learn it now (this start still asked the server). · Bu dosyadan önceki oturumlar şimdi öğrenir.
    sliding_eksikse_yaz_async(veri.to_owned(), &client).await;
    info!("oturum geri yüklendi");
    let ben = ben_kur(&client, sunucu_adi, gizli_depo);
    Ok(Some((client, ben)))
}

/// Server logout (best effort) and wipe everything on disk.
/// Sunucudan çıkış (elinden geleni yapar) ve diskteki her şeyi siler.
pub async fn cikis(veri: &Path, client: &Client) {
    if let Err(e) = client.logout().await {
        warn!("sunucudan çıkış başarısız (yerel veri yine de silinecek): {e}");
    }
    Kayit::sil_async(veri.to_owned()).await;
}

fn ben_kur(client: &Client, sunucu: String, gizli_depo: String) -> Ben {
    Ben {
        kullanici_id: client.user_id().map(|u| u.to_string()).unwrap_or_default(),
        cihaz_id: client.device_id().map(|d| d.to_string()).unwrap_or_default(),
        gorunen_ad: None,
        avatar_mxc: None,
        sunucu,
        gizli_depo,
    }
}

/// Identity info without network calls (display name is fetched lazily by the `ben` command).
/// Ağ çağrısı yapmayan kimlik bilgisi (görünen ad `ben` komutunda tembelce alınır).
pub fn ben_olustur(client: &Client, veri: &Path) -> Ben {
    // Only the metadata file is read here: no secrets, no keyring prompt. · Burada yalnızca üst bilgi dosyası okunur: gizli bilgi yok, anahtarlık sorusu yok.
    let dosya = Kayit::dosya_oku(veri).ok().flatten();
    let sunucu = dosya.as_ref().map(|d| d.sunucu_adi.clone()).unwrap_or_else(|| client.homeserver().to_string());
    let gizli_depo = dosya.map(|d| d.gizli).unwrap_or_else(varsayilan_gizli);
    ben_kur(client, sunucu, gizli_depo)
}

/// Async version of `ben_olustur` so async commands do not block Tokio while reading `oturum.json`.
/// `ben_olustur`'un async sürümü; async komutlar `oturum.json` okurken Tokio'yu bloklamasın.
pub async fn ben_olustur_async(client: &Client, veri: PathBuf) -> Ben {
    let dosya = tokio::task::spawn_blocking(move || Kayit::dosya_oku(&veri).ok().flatten()).await.ok().flatten();
    let sunucu = dosya.as_ref().map(|d| d.sunucu_adi.clone()).unwrap_or_else(|| client.homeserver().to_string());
    let gizli_depo = dosya.map(|d| d.gizli).unwrap_or_else(varsayilan_gizli);
    ben_kur(client, sunucu, gizli_depo)
}

pub const OLAY_OTURUM_GECERSIZ: &str = "oturum-gecersiz";

async fn belirtec_kaydet(veri: &Path, client: &Client) {
    let Some(yeni) = suanki_oturum(client) else { return };
    let veri = veri.to_owned();
    let sonuc = tokio::task::spawn_blocking(move || -> Sonuc<()> {
        if let Some((mut kayit, _)) = Kayit::yukle(&veri)? {
            kayit.oturum = yeni;
            kayit.kaydet(&veri)?;
        }
        Ok(())
    })
    .await;
    match sonuc {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!("yenilenen belirteç kaydedilemedi: {e}"),
        Err(e) => warn!("belirteç kaydetme görevi çöktü: {e}"),
    }
}

/// Persists refreshed tokens: without this a restart after a token refresh would log the user out.
/// Yenilenen belirteçleri kaydeder: bu olmazsa belirteç yenilendikten sonraki yeniden başlatma kullanıcıyı çıkış yaptırırdı.
pub fn token_izle(app: tauri::AppHandle, veri: PathBuf, client: Client) -> JoinHandle<()> {
    let mut rx = client.subscribe_to_session_changes();
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(SessionChange::TokensRefreshed) => {
                    belirtec_kaydet(&veri, &client).await;
                }
                // The device was signed out elsewhere (or deleted): syncing would retry forever and the screen would only say
                // "cannot connect". Tell the UI, which logs out locally. A soft logout keeps the data and is left alone.
                // Cihazın oturumu başka yerden kapatıldı (ya da silindi): eşitleme sonsuza dek yeniden dener, ekran yalnızca
                // "bağlanılamıyor" derdi. Arayüze söyle, o yerel çıkış yapar. Yumuşak çıkış veriyi korur, dokunulmaz.
                Ok(SessionChange::UnknownToken(d)) => {
                    warn!("sunucu oturumu geçersiz saydı (belirteç bilinmiyor, yumuşak: {})", d.soft_logout);
                    if !d.soft_logout {
                        use tauri::Emitter;
                        let _ = app.emit(OLAY_OTURUM_GECERSIZ, ());
                    }
                }
                // Missed broadcast events must not stop the watcher; save the current tokens in case a refresh was missed.
                // Kaçırılan yayın olayları izleyiciyi durdurmamalı; yenileme kaçtıysa diye güncel belirteçleri kaydet.
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    belirtec_kaydet(&veri, &client).await;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    })
}
