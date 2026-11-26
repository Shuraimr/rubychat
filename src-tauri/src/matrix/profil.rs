//! Profile editing, session (device) management, backup / recovery toggles and my personal sticker pack.
//! Every function here is a `#[tauri::command]`; `lib.rs` must register them (see the list in the hand-off report).
//! Profil düzenleme, oturum (cihaz) yönetimi, yedek / kurtarma anahtarları ve kişisel çıkartma paketim.
//! Buradaki her fonksiyon bir `#[tauri::command]`; `lib.rs` bunları kaydetmeli (devir raporundaki listeye bak).
//!
//! Secrets rule (as in `sifreleme.rs`): the account password only passes through `cihaz_cikis` and is never logged or stored.
//! Sır kuralı (`sifreleme.rs`teki gibi): hesap şifresi yalnızca `cihaz_cikis`ten geçer, günlüğe yazılmaz ve saklanmaz.

use matrix_sdk::{
    encryption::{backups::BackupState, recovery::RecoveryState},
    ruma::{
        api::client::uiaa::{AuthData, AuthType, MatrixUserIdentifier, Password, UserIdentifier},
        events::GlobalAccountDataEventType,
        thirdparty::Medium,
        serde::Raw,
        OwnedDeviceId,
    },
};
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::{medya, sifreleme},
    tipler::{EpostaAdresi, HesapBilgisi, OturumCihazi},
};

fn sifre_hatasi(e: impl std::fmt::Display) -> Hata {
    Hata::Sifreleme(e.to_string())
}

/// Reads an upload the UI wrote in chunks (`medya_parca_yaz`) and removes the temp file afterwards.
/// Arayüzün parça parça yazdığı yüklemeyi (`medya_parca_yaz`) okur ve ardından geçici dosyayı siler.
pub(crate) async fn gecici_oku(app: &AppHandle, kimlik: &str) -> Sonuc<Vec<u8>> {
    let yol = medya::dosya_yolu(app, kimlik)?;
    let veri = tokio::fs::read(&yol).await.map_err(|e| Hata::Depolama(e.to_string()))?;
    let _ = tokio::fs::remove_file(&yol).await;
    Ok(veri)
}

pub(crate) fn mime_coz(m: &str) -> Sonuc<mime::Mime> {
    // Only images are accepted here: an avatar / sticker must never be some other file type.
    // Burada yalnızca resim kabul edilir: avatar / çıkartma başka bir dosya türü olamaz.
    let mime: mime::Mime = m.parse().map_err(|_| Hata::Diger("geçersiz MIME".into()))?;
    if mime.type_() != mime::IMAGE {
        return Err(Hata::Diger("yalnızca resim".into()));
    }
    Ok(mime)
}

// ---------------------------------------------------------------------------------------------------------------
// Profile · Profil
// ---------------------------------------------------------------------------------------------------------------

/// Sets (or clears, with `None`) my display name. · Görünen adımı ayarlar (`None` ile siler).
#[tauri::command]
pub async fn profil_ad_ayarla(durum: State<'_, AppState>, ad: Option<String>) -> Sonuc<()> {
    let client = durum.client().await?;
    let ad = ad.map(|a| a.trim().to_owned()).filter(|a| !a.is_empty());
    if ad.as_deref().is_some_and(|a| a.chars().count() > 255) {
        return Err(Hata::Diger("ad çok uzun".into()));
    }
    client.account().set_display_name(ad.as_deref()).await?;
    Ok(())
}

/// Uploads the picture the UI prepared (cropped square, `kimlik` = temp file id) and makes it my avatar. Returns the new `mxc://`.
/// Arayüzün hazırladığı resmi (kare kırpılmış, `kimlik` = geçici dosya kimliği) yükler ve avatarım yapar. Yeni `mxc://` adresini döndürür.
#[tauri::command]
pub async fn profil_avatar_ayarla(app: AppHandle, durum: State<'_, AppState>, kimlik: String, mime: String) -> Sonuc<String> {
    let client = durum.client().await?;
    let mime = mime_coz(&mime)?;
    let veri = gecici_oku(&app, &kimlik).await?;
    let mxc = client.account().upload_avatar(&mime, veri).await?;
    Ok(mxc.to_string())
}

/// Removes my avatar. · Avatarımı kaldırır.
#[tauri::command]
pub async fn profil_avatar_kaldir(durum: State<'_, AppState>) -> Sonuc<()> {
    let client = durum.client().await?;
    client.account().set_avatar_url(None).await?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------------------------
// Sessions (devices) · Oturumlar (cihazlar)
// ---------------------------------------------------------------------------------------------------------------

/// All my sessions: name, last seen, and whether this device trusts them (cross-signed by me).
/// Bütün oturumlarım: ad, son görülme ve bu cihazın onlara güvenip güvenmediği (bana ait çapraz imzalı mı).
#[tauri::command]
pub async fn oturumlar_listele(durum: State<'_, AppState>) -> Sonuc<Vec<OturumCihazi>> {
    let client = durum.client().await?;
    let benim = client.device_id().map(|d| d.to_string()).unwrap_or_default();
    let yanit = client.devices().await?;
    // The crypto store knows the trust state; it can be missing for brand-new devices, then "not verified".
    // Güven durumunu şifreleme deposu bilir; yepyeni cihazlarda olmayabilir, o zaman "doğrulanmadı".
    let kullanici = client.user_id().map(|u| u.to_owned());
    let mut guvenli = std::collections::HashSet::new();
    if let Some(u) = kullanici {
        if let Ok(liste) = client.encryption().get_user_devices(&u).await {
            for d in liste.devices() {
                if d.is_verified() {
                    guvenli.insert(d.device_id().to_string());
                }
            }
        }
    }
    let mut sonuc: Vec<OturumCihazi> = yanit
        .devices
        .into_iter()
        .map(|d| {
            let id = d.device_id.to_string();
            OturumCihazi {
                dogrulandi: guvenli.contains(&id),
                bu_cihaz: id == benim,
                cihaz_id: id,
                ad: d.display_name,
                son_gorulme: d.last_seen_ts.map(|t| u64::from(t.0)),
                son_ip: d.last_seen_ip,
            }
        })
        .collect();
    // This device first, then most recently seen. · Önce bu cihaz, sonra en son görülen.
    sonuc.sort_by(|a, b| b.bu_cihaz.cmp(&a.bu_cihaz).then(b.son_gorulme.cmp(&a.son_gorulme)));
    Ok(sonuc)
}

/// Renames one of my sessions. · Oturumlarımdan birini yeniden adlandırır.
#[tauri::command]
pub async fn cihaz_yeniden_adlandir(durum: State<'_, AppState>, cihaz_id: String, ad: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let id: OwnedDeviceId = cihaz_id.as_str().into();
    client.rename_device(&id, ad.trim()).await?;
    Ok(())
}

/// Signs another session out (deletes the device). The server wants the password (UIA): without `parola` this fails with
/// `diger: parola_gerekli` and the UI asks for it, then calls again. The password is used once and dropped.
/// Başka bir oturumu kapatır (cihazı siler). Sunucu şifre ister (UIA): `parola` yoksa `diger: parola_gerekli` ile başarısız olur,
/// arayüz sorar ve yeniden çağırır. Şifre bir kez kullanılır ve atılır.
#[tauri::command]
pub async fn cihaz_cikis(durum: State<'_, AppState>, cihaz_id: String, parola: Option<String>) -> Sonuc<()> {
    let client = durum.client().await?;
    let Some(kullanici) = client.user_id().map(|u| u.to_string()) else { return Err(Hata::OturumYok) };
    let id: OwnedDeviceId = cihaz_id.as_str().into();
    if client.device_id().is_some_and(|d| d.as_str() == id.as_str()) {
        return Err(Hata::Diger("bu cihazdan çıkış 'Çıkış yap' ile yapılır".into()));
    }
    let hedefler = [id];
    match client.delete_devices(&hedefler, None).await {
        Ok(_) => Ok(()),
        Err(e) => {
            let Some(bilgi) = e.as_uiaa_response() else { return Err(e.into()) };
            if !bilgi.flows.iter().any(|f| f.stages.contains(&AuthType::Password)) {
                return Err(Hata::Diger("sunucu şifreyle onay kabul etmiyor (tarayıcıda onay gerekebilir)".into()));
            }
            let Some(parola) = parola.filter(|p| !p.is_empty()) else { return Err(Hata::Diger("parola_gerekli".into())) };
            let mut p = Password::new(UserIdentifier::Matrix(MatrixUserIdentifier::new(kullanici)), parola);
            p.session = bilgi.session.clone();
            match client.delete_devices(&hedefler, Some(AuthData::Password(p))).await {
                Ok(_) => Ok(()),
                // Still a UIA response = the password was wrong. · Hâlâ UIA yanıtı = şifre yanlış.
                Err(e2) if e2.as_uiaa_response().is_some() => Err(Hata::Giris("şifre kabul edilmedi".into())),
                Err(e2) => Err(e2.into()),
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Backup and recovery key · Yedek ve kurtarma anahtarı
// ---------------------------------------------------------------------------------------------------------------

/// Key backup on / off. On = create a backup if the server has none (needs recovery set up first); off = stop uploading keys.
/// Anahtar yedeği aç / kapa. Açık = sunucuda yoksa yedek oluştur (önce kurtarma kurulmalı); kapalı = anahtar yüklemeyi durdur.
#[tauri::command]
pub async fn yedek_ayarla(app: AppHandle, durum: State<'_, AppState>, acik: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let enc = client.encryption();
    if acik {
        if enc.backups().state() != BackupState::Enabled {
            enc.recovery().enable_backup().await.map_err(sifre_hatasi)?;
        }
    } else {
        enc.backups().disable().await.map_err(sifre_hatasi)?;
    }
    sifreleme::yayinla(&app, &client).await;
    Ok(())
}

/// Rotates the recovery key (secret storage key) and returns the NEW one, to be shown once. Only when recovery is on.
/// Kurtarma anahtarını (gizli depo anahtarı) yeniler ve YENİ olanı bir kez gösterilmek üzere döndürür. Yalnızca kurtarma açıkken.
#[tauri::command]
pub async fn kurtarma_sifirla(app: AppHandle, durum: State<'_, AppState>) -> Sonuc<String> {
    let client = durum.client().await?;
    let enc = client.encryption();
    if enc.recovery().state() != RecoveryState::Enabled {
        return Err(Hata::Sifreleme("kurtarma açık değil".into()));
    }
    let yeni = enc.recovery().reset_key().await.map_err(sifre_hatasi)?;
    sifreleme::yayinla(&app, &client).await;
    Ok(yeni)
}

// ---------------------------------------------------------------------------------------------------------------
// My personal sticker pack (MSC2545) · Kişisel çıkartma paketim (MSC2545)
// ---------------------------------------------------------------------------------------------------------------

/// Adds one image (a WebP the UI exported at 512px) to my personal pack `im.ponies.user_emotes`. `kisa_kod` is the shortcode;
/// a clash gets a number suffix. Existing pack fields are kept untouched (we only add under `images`).
/// Kişisel paketime (`im.ponies.user_emotes`) bir resim (arayüzün 512px dışa aktardığı WebP) ekler. `kisa_kod` kısa koddur;
/// çakışırsa sayı eki alır. Paketin mevcut alanlarına dokunulmaz (yalnızca `images` altına eklenir).
#[tauri::command]
pub async fn cikartma_paketine_ekle(
    app: AppHandle,
    durum: State<'_, AppState>,
    kimlik: String,
    mime: String,
    kisa_kod: String,
    genislik: u32,
    yukseklik: u32,
) -> Sonuc<String> {
    let client = durum.client().await?;
    let mime = mime_coz(&mime)?;
    let veri = gecici_oku(&app, &kimlik).await?;
    let boyut = veri.len();
    let yukleme = client.media().upload(&mime, veri, None).await.map_err(|e| Hata::Matrix(e.to_string()))?;

    let tur = GlobalAccountDataEventType::from("im.ponies.user_emotes");
    let mevcut: Value = match client.account().account_data_raw(tur.clone()).await {
        Ok(Some(ham)) => ham.deserialize_as_unchecked::<Value>().unwrap_or_else(|_| json!({})),
        _ => json!({}),
    };
    let mut icerik = if mevcut.is_object() { mevcut } else { json!({}) };
    if icerik.get("images").and_then(|i| i.as_object()).is_none() {
        icerik["images"] = json!({});
    }
    let temiz: String = kisa_kod.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').take(40).collect();
    let temel = if temiz.is_empty() { "cikartma".to_owned() } else { temiz };
    let mut kod = temel.clone();
    let mut n = 2;
    while icerik["images"].get(&kod).is_some() {
        kod = format!("{temel}{n}");
        n += 1;
    }
    icerik["images"][&kod] = json!({
        "url": yukleme.content_uri.to_string(),
        "body": temel,
        "usage": ["sticker"],
        "info": { "w": genislik, "h": yukseklik, "mimetype": mime.essence_str(), "size": boyut }
    });
    let ham: Raw<_> = Raw::from_json(serde_json::value::to_raw_value(&icerik).map_err(|e| Hata::Diger(e.to_string()))?);
    client.account().set_account_data_raw(tur, ham).await?;
    Ok(kod)
}

// ---------------------------------------------------------------------------------------------------------------
// Account management (Ben › Hesap) · Hesap yönetimi (Ben › Hesap)
// ---------------------------------------------------------------------------------------------------------------

/// What this server offers. `oidc` = the account lives behind an OAuth/OIDC provider (matrix.org + MAS): then password, e-mail, sessions
/// and deactivation exist ONLY on the provider's web page (`hesap_url` + `eylemler`), and the native UIA commands below do not apply.
/// Bu sunucunun sunduğu. `oidc` = hesap bir OAuth/OIDC sağlayıcının arkasında (matrix.org + MAS): o zaman şifre, e-posta, oturumlar ve hesap
/// kapatma YALNIZCA sağlayıcının web sayfasında vardır (`hesap_url` + `eylemler`); aşağıdaki yerel UIA komutları geçerli olmaz.
#[tauri::command]
pub async fn hesap_bilgisi(durum: State<'_, AppState>) -> Sonuc<HesapBilgisi> {
    let client = durum.client().await?;
    let sunucu = client.homeserver().to_string();
    let (oidc, hesap_url, eylemler) = match client.oauth().server_metadata().await {
        Ok(m) => (
            true,
            m.account_management_uri.as_ref().map(|u| u.to_string()),
            m.account_management_actions_supported.iter().map(|a| a.as_str().to_owned()).collect::<Vec<_>>(),
        ),
        Err(_) => (false, None, Vec::new()),
    };
    let surumler = match client.supported_versions().await {
        Ok(v) => v.versions.iter().map(|x| x.as_str().map(str::to_owned).unwrap_or_else(|| format!("{x:?}"))).collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    let sliding_sync = matches!(client.sliding_sync_version(), matrix_sdk::sliding_sync::Version::Native);
    Ok(HesapBilgisi { sunucu, oidc, hesap_url, eylemler, surumler, sliding_sync })
}

/// Legacy (non-OIDC) servers: runs a UIA request, first without auth, then once with the password stage. Never stores the password.
/// Eski (OIDC olmayan) sunucular: önce kimliksiz, sonra şifre aşamasıyla bir kez UIA isteği çalıştırır. Şifreyi saklamaz.
fn parola_yetkisi(kullanici: &str, parola: String, oturum: Option<String>) -> AuthData {
    let mut p = Password::new(UserIdentifier::Matrix(MatrixUserIdentifier::new(kullanici.to_owned())), parola);
    p.session = oturum;
    AuthData::Password(p)
}

/// Changes the password (legacy servers). The server asks for the old password through UIA. · Şifreyi değiştirir (eski sunucular). Sunucu eski şifreyi UIA ile ister.
#[tauri::command]
pub async fn sifre_degistir(durum: State<'_, AppState>, eski: String, yeni: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let Some(kullanici) = client.user_id().map(|u| u.to_string()) else { return Err(Hata::OturumYok) };
    if yeni.chars().count() < 8 {
        return Err(Hata::Diger("yeni şifre en az 8 karakter olmalı".into()));
    }
    let hesap = client.account();
    match hesap.change_password(&yeni, None).await {
        Ok(_) => Ok(()),
        Err(e) => {
            let Some(bilgi) = e.as_uiaa_response() else { return Err(e.into()) };
            let oturum = bilgi.session.clone();
            match hesap.change_password(&yeni, Some(parola_yetkisi(&kullanici, eski, oturum))).await {
                Ok(_) => Ok(()),
                Err(e2) if e2.as_uiaa_response().is_some() => Err(Hata::Giris("eski şifre kabul edilmedi".into())),
                Err(e2) => Err(e2.into()),
            }
        }
    }
}

/// E-mail addresses bound to the account (legacy servers). Adding one needs the e-mail token round trip, which is not built. · Hesaba bağlı e-posta adresleri (eski sunucular). Eklemek e-posta jetonu turu ister; yapılmadı.
#[tauri::command]
pub async fn epostalar_listele(durum: State<'_, AppState>) -> Sonuc<Vec<EpostaAdresi>> {
    let client = durum.client().await?;
    let yanit = client.account().get_3pids().await?;
    Ok(yanit
        .threepids
        .into_iter()
        .filter(|t| t.medium == Medium::Email)
        .map(|t| EpostaAdresi { adres: t.address, dogrulandi: true })
        .collect())
}

/// Removes an e-mail address. · Bir e-posta adresini kaldırır.
#[tauri::command]
pub async fn eposta_sil(durum: State<'_, AppState>, adres: String) -> Sonuc<()> {
    let client = durum.client().await?;
    client.account().delete_3pid(&adres, Medium::Email, None).await?;
    Ok(())
}

/// Deactivates the account for good (legacy servers; needs the password). `veriyi_sil` asks the server to erase the data too.
/// The UI puts a strong confirmation in front of this. · Hesabı kalıcı kapatır (eski sunucular; şifre ister). `veriyi_sil` sunucudan veriyi de silmesini ister.
/// Arayüz bunun önüne güçlü bir onay koyar.
#[tauri::command]
pub async fn hesap_kapat(durum: State<'_, AppState>, parola: String, veriyi_sil: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let Some(kullanici) = client.user_id().map(|u| u.to_string()) else { return Err(Hata::OturumYok) };
    let hesap = client.account();
    match hesap.deactivate(None, None, veriyi_sil).await {
        Ok(_) => Ok(()),
        Err(e) => {
            let Some(bilgi) = e.as_uiaa_response() else { return Err(e.into()) };
            let oturum = bilgi.session.clone();
            match hesap.deactivate(None, Some(parola_yetkisi(&kullanici, parola, oturum)), veriyi_sil).await {
                Ok(_) => Ok(()),
                Err(e2) if e2.as_uiaa_response().is_some() => Err(Hata::Giris("şifre kabul edilmedi".into())),
                Err(e2) => Err(e2.into()),
            }
        }
    }
}
