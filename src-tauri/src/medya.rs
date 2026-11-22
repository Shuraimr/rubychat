//! `medya` URI scheme: serves Matrix avatar thumbnails to the webview as normal images.
//! `medya` URI şeması: Matrix avatar küçük resimlerini webview'e sıradan resim olarak sunar.
//!
//! URL: `medya://localhost/<server>/<mediaId>?b=96` (Android/Windows: `http://medya.localhost/...`).
//! The SDK downloads the thumbnail (cropped square, `b` px, 32..512) and keeps it in its media cache on disk.
//! Adres: `medya://localhost/<sunucu>/<medyaId>?b=96` (Android/Windows: `http://medya.localhost/...`).
//! SDK küçük resmi indirir (kare kırpılmış, `b` px, 32..512) ve diskteki medya önbelleğinde tutar.

use matrix_sdk::{
    media::{MediaFormat, MediaRequestParameters, MediaThumbnailSettings},
    ruma::{
        api::client::media::get_content_thumbnail::v3::Method, events::room::MediaSource, OwnedMxcUri,
    },
};
use tauri::{http::{Request, Response}, AppHandle, Manager};

use crate::durum::AppState;

fn yanit(kod: u16, tur: &str, govde: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(kod)
        .header("Content-Type", tur)
        .header("Cache-Control", "private, max-age=86400")
        .body(govde)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Guess the image type from magic bytes (the server may send anything). · Sihirli baytlardan resim türünü tahmin et.
fn tur_bul(b: &[u8]) -> &'static str {
    if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if b.starts_with(&[0xFF, 0xD8]) {
        "image/jpeg"
    } else if b.starts_with(b"GIF8") {
        "image/gif"
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

/// Only plain id characters: keeps weird input out of the mxc URI. · Yalnızca düz kimlik karakterleri: tuhaf girdi mxc adresine girmesin.
fn temiz(s: &str) -> bool {
    !s.is_empty() && s.len() < 256 && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'))
}

/// Magic-byte guess for videos (used when the event carries no mimetype). · Video için sihirli bayt tahmini (olayda mimetype yoksa).
fn video_tur_bul(b: &[u8]) -> Option<&'static str> {
    if b.len() > 12 && &b[4..8] == b"ftyp" {
        Some("video/mp4")
    } else if b.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) {
        Some("video/webm")
    } else {
        None
    }
}

/// `medya://localhost/m/<id>`: a full media file or a message thumbnail registered by the timeline mapper (see `durum::MedyaKayit`).
/// Works for encrypted media too (the SDK decrypts with the `EncryptedFile` it finds in the registry) and answers `Range`
/// requests, which the Android video player needs for seeking.
/// `medya://localhost/m/<id>`: zaman çizelgesi eşleyicisinin kaydettiği tam medya dosyası ya da mesaj küçük resmi (bkz. `durum::MedyaKayit`).
/// Şifreli medyada da çalışır (SDK, kayıttaki `EncryptedFile` ile çözer) ve Android video oynatıcının sarma için istediği `Range`
/// isteklerini yanıtlar.
async fn kayitli_sun(app: &AppHandle, istek: &Request<Vec<u8>>, id: &str) -> Response<Vec<u8>> {
    let state = app.state::<AppState>();
    let kayit = state.medya_kaynaklari.lock().ok().and_then(|k| k.harita.get(id).cloned());
    let Some(kayit) = kayit else { return yanit(404, "text/plain", vec![]) };
    let Ok(client) = state.client().await else { return yanit(401, "text/plain", vec![]) };
    let params = MediaRequestParameters { source: kayit.kaynak, format: MediaFormat::File };
    let bayt = match client.media().get_media_content(&params, true).await {
        Ok(b) => b,
        Err(_) => return yanit(404, "text/plain", vec![]),
    };
    let tur = kayit
        .mime
        .as_deref()
        .filter(|m| !m.is_empty() && *m != "application/octet-stream")
        .or_else(|| video_tur_bul(&bayt))
        .unwrap_or_else(|| tur_bul(&bayt))
        .to_owned();
    let toplam = bayt.len();
    // "bytes=START-END" (END optional). Anything else = send the whole body. · "bytes=BAŞ-SON" (SON isteğe bağlı). Başka her şey = tamamını gönder.
    let aralik = istek
        .headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("bytes="))
        .and_then(|v| v.split(',').next())
        .and_then(|v| {
            let (a, b) = v.split_once('-')?;
            let bas: usize = a.trim().parse().ok()?;
            let son: usize = if b.trim().is_empty() { toplam.saturating_sub(1) } else { b.trim().parse().ok()? };
            Some((bas, son.min(toplam.saturating_sub(1))))
        });
    match aralik {
        Some((bas, son)) if bas <= son && bas < toplam => Response::builder()
            .status(206)
            .header("Content-Type", tur)
            .header("Accept-Ranges", "bytes")
            .header("Content-Range", format!("bytes {bas}-{son}/{toplam}"))
            .header("Cache-Control", "private, max-age=86400")
            .body(bayt[bas..=son].to_vec())
            .unwrap_or_else(|_| Response::new(Vec::new())),
        Some(_) => Response::builder()
            .status(416)
            .header("Content-Range", format!("bytes */{toplam}"))
            .body(Vec::new())
            .unwrap_or_else(|_| Response::new(Vec::new())),
        None => Response::builder()
            .status(200)
            .header("Content-Type", tur)
            .header("Accept-Ranges", "bytes")
            .header("Cache-Control", "private, max-age=86400")
            .body(bayt)
            .unwrap_or_else(|_| Response::new(Vec::new())),
    }
}

pub async fn sun(app: &AppHandle, istek: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let parcalar: Vec<&str> = istek.uri().path().trim_matches('/').split('/').collect();
    if let ["m", id] = parcalar[..] {
        if !temiz(id) {
            return yanit(400, "text/plain", vec![]);
        }
        return kayitli_sun(app, &istek, id).await;
    }
    let [sunucu, medya_id] = parcalar[..] else { return yanit(400, "text/plain", vec![]) };
    if !temiz(sunucu) || !temiz(medya_id) {
        return yanit(400, "text/plain", vec![]);
    }
    let boyut = istek
        .uri()
        .query()
        .and_then(|q| q.split('&').find_map(|p| p.strip_prefix("b=")))
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(96)
        .clamp(32, 512);
    let Ok(client) = app.state::<AppState>().client().await else { return yanit(401, "text/plain", vec![]) };
    let params = MediaRequestParameters {
        source: MediaSource::Plain(OwnedMxcUri::from(format!("mxc://{sunucu}/{medya_id}"))),
        format: MediaFormat::Thumbnail(MediaThumbnailSettings::with_method(Method::Crop, boyut.into(), boyut.into())),
    };
    match client.media().get_media_content(&params, true).await {
        Ok(bayt) => yanit(200, tur_bul(&bayt), bayt),
        Err(_) => yanit(404, "text/plain", vec![]),
    }
}
