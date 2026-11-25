//! Sign in with the phone: the OAuth 2.0 device authorization grant (RFC 8628). We ask the account server for a short code, the user approves
//! it in any browser (the phone's, through the QR code), and we poll until the tokens arrive. No password passes through the app.
//! matrix-sdk only offers this inside its QR login, which needs a rendezvous server most homeservers do not have; so the three plain
//! requests are made here and the result is restored as a normal OAuth session (`oturum::oauth_giris`).
//! Telefonla giriş: OAuth 2.0 cihaz yetkilendirmesi (RFC 8628). Hesap sunucusundan kısa bir kod isteriz, kullanıcı onu herhangi bir
//! tarayıcıda (QR ile telefonunkinde) onaylar, biz belirteçler gelene dek sorarız. Uygulamadan şifre geçmez.
//! matrix-sdk bunu yalnızca, çoğu sunucuda olmayan bir buluşma sunucusu isteyen QR girişinin içinde sunar; bu yüzden üç düz istek burada
//! yapılır ve sonuç normal bir OAuth oturumu olarak açılır (`oturum::oauth_giris`).

use std::{
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};

use matrix_sdk::{authentication::matrix::MatrixSession, ruma::OwnedDeviceId, ruma::OwnedUserId, Client, SessionMeta, SessionTokens};
use serde::{Deserialize, Serialize};
use tracing::warn;

use super::oturum;
use crate::{
    hata::{Hata, Sonuc},
    tipler::Ben,
};

const IZIN_TURU: &str = "urn:ietf:params:oauth:grant-type:device_code";
const EV: &str = "https://github.com/Shuraimr/rubychat";

/// What the login screen shows. · Giriş ekranının gösterdiği.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CihazKodu {
    kod: String,
    /// Page to open; with the code inside when the server offers that · Açılacak sayfa; sunucu sunuyorsa kod içindedir
    adres: String,
    /// The code still has to be typed there · Kod orada ayrıca yazılmalı
    kod_yazilir: bool,
    saniye: u64,
}

struct Bekleyen {
    sira: u64,
    client: Client,
    sunucu: String,
    istemci_id: String,
    cihaz_kodu: String,
    cihaz_id: String,
    belirtec_adresi: String,
    aralik: u64,
    bitis: Instant,
}

static SIRA: AtomicU64 = AtomicU64::new(0);
static BEKLEYEN: Mutex<Option<Bekleyen>> = Mutex::new(None);

#[derive(Deserialize)]
struct Kayitli {
    client_id: String,
}
#[derive(Deserialize)]
struct KodYaniti {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: Option<u64>,
}
#[derive(Deserialize)]
struct BelirtecYaniti {
    access_token: String,
    refresh_token: Option<String>,
}
#[derive(Deserialize)]
struct OAuthHatasi {
    error: String,
}
#[derive(Deserialize)]
struct Kimim {
    user_id: OwnedUserId,
    device_id: Option<OwnedDeviceId>,
}

fn ag(e: impl std::fmt::Display) -> Hata {
    Hata::Ag(e.to_string())
}

/// (status is ok, body) · (durum iyi mi, gövde)
async fn yolla(client: &Client, adres: &str, tur: &str, govde: String) -> Sonuc<(bool, Vec<u8>)> {
    let y = client.http_client().post(adres).header("content-type", tur).header("accept", "application/json").body(govde).send().await.map_err(ag)?;
    let iyi = y.status().is_success();
    Ok((iyi, y.bytes().await.map_err(ag)?.to_vec()))
}

fn form(alanlar: &[(&str, &str)]) -> String {
    url::form_urlencoded::Serializer::new(String::new()).extend_pairs(alanlar).finish()
}

const FORM: &str = "application/x-www-form-urlencoded";

/// Never log the bodies: they can carry tokens. · Gövdeler günlüğe yazılmaz: belirteç taşıyabilir.
fn coz<T: serde::de::DeserializeOwned>(iyi: bool, govde: &[u8]) -> Sonuc<T> {
    if !iyi {
        let neden = serde_json::from_slice::<OAuthHatasi>(govde).map(|h| h.error).unwrap_or_else(|_| "bilinmeyen".into());
        return Err(Hata::Matrix(format!("hesap sunucusu reddetti: {neden}")));
    }
    serde_json::from_slice(govde).map_err(|_| Hata::Matrix("hesap sunucusunun yanıtı anlaşılamadı".into()))
}

pub async fn baslat(sunucu: &str) -> Sonuc<CihazKodu> {
    let sira = SIRA.fetch_add(1, Ordering::SeqCst) + 1;
    let sunucu = sunucu.trim().to_owned();
    if sunucu.is_empty() {
        return Err(Hata::Diger("sunucu gerekli".into()));
    }
    let client = oturum::kesif_istemcisi(&sunucu).await?;
    let desteksiz = || Hata::Diger("desteklenmiyor".into());
    let m = client.oauth().server_metadata().await.map_err(|e| if e.is_not_supported() { desteksiz() } else { ag(e) })?;
    let (Some(kod_adresi), Some(kayit_adresi)) = (m.device_authorization_endpoint, m.registration_endpoint) else {
        return Err(desteksiz());
    };

    let bilgi = serde_json::json!({
        "application_type": "native",
        "client_name": "rubychat",
        "client_uri": EV,
        "grant_types": [IZIN_TURU, "refresh_token"],
        "token_endpoint_auth_method": "none",
    });
    let (iyi, g) = yolla(&client, kayit_adresi.as_str(), "application/json", bilgi.to_string()).await?;
    let kayitli: Kayitli = coz(iyi, &g)?;

    let cihaz_id: String = {
        let bayt: [u8; 10] = rand::random();
        bayt.iter().map(|b| char::from(b'A' + b % 26)).collect()
    };
    let kapsam = format!("urn:matrix:org.matrix.msc2967.client:api:* urn:matrix:org.matrix.msc2967.client:device:{cihaz_id}");
    let (iyi, g) = yolla(&client, kod_adresi.as_str(), FORM, form(&[("client_id", &kayitli.client_id), ("scope", &kapsam)])).await?;
    let k: KodYaniti = coz(iyi, &g)?;

    *BEKLEYEN.lock().unwrap_or_else(|e| e.into_inner()) = Some(Bekleyen {
        sira,
        client,
        sunucu,
        istemci_id: kayitli.client_id,
        cihaz_kodu: k.device_code,
        cihaz_id,
        belirtec_adresi: m.token_endpoint.to_string(),
        aralik: k.interval.unwrap_or(5).clamp(1, 60),
        bitis: Instant::now() + Duration::from_secs(k.expires_in),
    });
    let kod_yazilir = k.verification_uri_complete.is_none();
    Ok(CihazKodu { kod: k.user_code, adres: k.verification_uri_complete.unwrap_or(k.verification_uri), kod_yazilir, saniye: k.expires_in })
}

pub fn iptal() {
    SIRA.fetch_add(1, Ordering::SeqCst);
    *BEKLEYEN.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Approved tokens, ready for `bitir`. · Onaylanmış belirteçler, `bitir` için hazır.
pub struct Onay {
    sunucu: String,
    sunucu_url: String,
    istemci_id: String,
    oturum: MatrixSession,
}

/// Waits for the approval in the browser. Error texts "iptal" / "ret" / "sure" are read by the login screen.
/// Tarayıcıdaki onayı bekler. "iptal" / "ret" / "sure" hata metinlerini giriş ekranı okur.
pub async fn bekle() -> Sonuc<Onay> {
    let iptal = || Hata::Diger("iptal".into());
    let b = BEKLEYEN.lock().unwrap_or_else(|e| e.into_inner()).take().ok_or_else(iptal)?;
    let mut aralik = b.aralik;
    let govde = form(&[("grant_type", IZIN_TURU), ("device_code", &b.cihaz_kodu), ("client_id", &b.istemci_id)]);
    let belirtec: BelirtecYaniti = loop {
        tokio::time::sleep(Duration::from_secs(aralik)).await;
        if SIRA.load(Ordering::SeqCst) != b.sira {
            return Err(iptal());
        }
        if Instant::now() > b.bitis {
            return Err(Hata::Diger("sure".into()));
        }
        // A dropped connection is not the end: the code lives on until it expires. · Kopan bağlantı son değildir: kod süresi dolana dek yaşar.
        let (iyi, g) = match yolla(&b.client, &b.belirtec_adresi, FORM, govde.clone()).await {
            Ok(y) => y,
            Err(e) => {
                warn!("onay sorulamadı, yeniden denenecek: {e}");
                continue;
            }
        };
        if iyi {
            break coz(true, &g)?;
        }
        match serde_json::from_slice::<OAuthHatasi>(&g).map(|h| h.error).as_deref() {
            Ok("authorization_pending") => {}
            Ok("slow_down") => aralik += 5,
            Ok("access_denied") => return Err(Hata::Diger("ret".into())),
            Ok("expired_token") => return Err(Hata::Diger("sure".into())),
            // Not an OAuth answer (a proxy error page): keep asking. · OAuth yanıtı değil (vekil sunucu hata sayfası): sormaya devam.
            Err(_) => {}
            Ok(_) => break coz(false, &g)?,
        }
    };

    // Who are we? The token does not say. · Kimiz? Belirteç söylemez.
    let sunucu_url = b.client.homeserver().to_string();
    let adres = format!("{}/_matrix/client/v3/account/whoami", sunucu_url.trim_end_matches('/'));
    let mut deneme = 0;
    let g = loop {
        deneme += 1;
        let y = async {
            let y = b.client.http_client().get(&adres).header("authorization", format!("Bearer {}", belirtec.access_token)).send().await.map_err(ag)?;
            let y = y.error_for_status().map_err(ag)?;
            y.bytes().await.map_err(ag)
        }
        .await;
        match y {
            Ok(g) => break g,
            Err(_) if deneme < 4 => tokio::time::sleep(Duration::from_secs(2)).await,
            Err(e) => return Err(e),
        }
    };
    let kim: Kimim = coz(true, &g)?;
    let device_id = kim.device_id.unwrap_or_else(|| b.cihaz_id.as_str().into());
    if SIRA.load(Ordering::SeqCst) != b.sira {
        return Err(iptal());
    }
    Ok(Onay {
        sunucu: b.sunucu,
        sunucu_url,
        istemci_id: b.istemci_id,
        oturum: MatrixSession {
            meta: SessionMeta { user_id: kim.user_id, device_id },
            tokens: SessionTokens { access_token: belirtec.access_token, refresh_token: belirtec.refresh_token },
        },
    })
}

pub async fn bitir(veri: &Path, o: Onay) -> Sonuc<(Client, Ben)> {
    oturum::oauth_giris(veri, &o.sunucu, &o.sunucu_url, o.oturum, o.istemci_id).await
}
