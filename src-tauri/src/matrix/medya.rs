//! Media messages: mapping SDK content to the UI, and sending photos / videos / files.
//! Medya mesajları: SDK içeriğini arayüze eşleme ve fotoğraf / video / dosya gönderme.
//!
//! Flow (see docs/MIMARI.md "Medya"): the webview prepares the bytes (image: canvas re-encode; video: native Media3 transcode),
//! writes them to the app cache in base64 chunks (`parca_yaz`), then `gonder` queues the attachment through the SDK send queue
//! (`Timeline::send_attachment(..).use_send_queue()`), which gives a local echo with upload progress and encrypts in encrypted rooms.
//! Akış (bkz. docs/MIMARI.md "Medya"): webview baytları hazırlar (resim: canvas ile yeniden kodlama; video: yerel Media3 dönüşümü),
//! base64 parçalarıyla uygulama önbelleğine yazar (`parca_yaz`), sonra `gonder` eki SDK gönderim kuyruğuyla sıraya koyar
//! (`Timeline::send_attachment(..).use_send_queue()`); bu, yükleme ilerlemeli yerel yankı verir ve şifreli odalarda şifreler.

use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    io::Write,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};

use base64::Engine;
use matrix_sdk::{
    attachment::{AttachmentInfo, BaseFileInfo, BaseImageInfo, BaseVideoInfo, Thumbnail},
    media::MediaEventContent,
    ruma::{
        events::room::{
            message::{MessageType, TextMessageEventContent},
            MediaSource,
        },
        RoomId, UInt,
    },
    Client,
};
use matrix_sdk_ui::timeline::{AttachmentConfig, AttachmentSource, RoomExt, Timeline};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use crate::{
    android_jni,
    durum::{AppState, MedyaKaynagi},
    hata::{Hata, Sonuc},
    tipler::{
        MedyaAsama, MedyaBilgisi, MedyaGonderIstegi, MedyaIlerleme, MedyaIlerlemeOlayi, MedyaTuru, VideoSikistirIstegi, VideoSonucu,
        ZamanTuru,
    },
};

pub const OLAY_ILERLEME: &str = "medya-ilerleme";

// ---------------------------------------------------------------------------------------------------------------------
// Timeline mapping · Zaman çizelgesi eşlemesi
// ---------------------------------------------------------------------------------------------------------------------

fn sayi(v: Option<UInt>) -> Option<u64> {
    v.map(u64::from)
}

/// Stable short id of a source (same source → same id on every re-map, so the UI does not reload images).
/// Bir kaynağın kararlı kısa kimliği (aynı kaynak → her yeniden eşlemede aynı kimlik; arayüz resmi yeniden yüklemesin).
fn kaynak_id(k: &MediaSource) -> String {
    let anahtar = match k {
        MediaSource::Plain(u) => u.to_string(),
        MediaSource::Encrypted(f) => f.url.to_string(),
    };
    let mut h = DefaultHasher::new();
    anahtar.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn kaydet(app: &AppHandle, kaynak: MediaSource, mime: Option<&str>, ad: &str) -> String {
    let id = kaynak_id(&kaynak);
    if let Ok(mut k) = app.state::<AppState>().medya_kaynaklari.lock() {
        k.ekle(id.clone(), MedyaKaynagi { kaynak, mime: mime.map(str::to_owned), dosya_adi: ad.to_owned() });
    }
    id
}

/// Maps an image / video / file / audio message. `None` = not a media message. The caption (if the user wrote one) is returned
/// separately; `ilerleme` is the SDK's upload progress for a local echo.
/// Resim / video / dosya / ses mesajını eşler. `None` = medya mesajı değil. Açıklama (kullanıcı yazdıysa) ayrı döner;
/// `ilerleme`, yerel yankı için SDK'nın yükleme ilerlemesidir.
pub fn esle(app: &AppHandle, tur: &MessageType, ilerleme: Option<MedyaIlerleme>) -> Option<(ZamanTuru, Option<String>, MedyaBilgisi)> {
    let (zt, mt, kaynak, kucuk, ad, aciklama, g, y, sure, boyut, mime) = match tur {
        MessageType::Image(c) => {
            let i = c.info.as_deref();
            (
                ZamanTuru::Resim,
                MedyaTuru::Resim,
                c.source.clone(),
                c.thumbnail_source(),
                c.filename().to_owned(),
                c.caption().map(str::to_owned),
                sayi(i.and_then(|i| i.width)),
                sayi(i.and_then(|i| i.height)),
                None,
                sayi(i.and_then(|i| i.size)),
                i.and_then(|i| i.mimetype.clone()),
            )
        }
        MessageType::Video(c) => {
            let i = c.info.as_deref();
            (
                ZamanTuru::Video,
                MedyaTuru::Video,
                c.source.clone(),
                c.thumbnail_source(),
                c.filename().to_owned(),
                c.caption().map(str::to_owned),
                sayi(i.and_then(|i| i.width)),
                sayi(i.and_then(|i| i.height)),
                i.and_then(|i| i.duration).map(|d| d.as_millis() as u64),
                sayi(i.and_then(|i| i.size)),
                i.and_then(|i| i.mimetype.clone()),
            )
        }
        MessageType::File(c) => {
            let i = c.info.as_deref();
            (
                ZamanTuru::Dosya,
                MedyaTuru::Dosya,
                c.source.clone(),
                None,
                c.filename().to_owned(),
                c.caption().map(str::to_owned),
                None,
                None,
                None,
                sayi(i.and_then(|i| i.size)),
                i.and_then(|i| i.mimetype.clone()),
            )
        }
        MessageType::Audio(c) => {
            let i = c.info.as_deref();
            (
                ZamanTuru::Dosya,
                MedyaTuru::Dosya,
                c.source.clone(),
                None,
                c.filename().to_owned(),
                c.caption().map(str::to_owned),
                None,
                None,
                i.and_then(|i| i.duration).map(|d| d.as_millis() as u64),
                sayi(i.and_then(|i| i.size)),
                i.and_then(|i| i.mimetype.clone()),
            )
        }
        _ => return None,
    };
    let bilgi = MedyaBilgisi {
        tur: mt,
        kaynak_id: kaydet(app, kaynak, mime.as_deref(), &ad),
        kucuk_id: kucuk.map(|k| kaydet(app, k, None, &ad)),
        genislik: g.and_then(|v| u32::try_from(v).ok()),
        yukseklik: y.and_then(|v| u32::try_from(v).ok()),
        sure_ms: sure,
        boyut,
        dosya_adi: ad,
        mime,
        ilerleme,
    };
    Some((zt, aciklama, bilgi))
}

/// Maps an `m.sticker` event to the same media description the UI already knows how to draw (image, registered for `medya://localhost/m/<id>`).
/// `m.sticker` olayını arayüzün zaten çizmeyi bildiği medya tarifine eşler (resim; `medya://localhost/m/<id>` için kaydedilir).
pub fn cikartma_esle(app: &AppHandle, s: &matrix_sdk::ruma::events::sticker::StickerEventContent) -> MedyaBilgisi {
    // `StickerMediaSource` → `MediaSource` (plain URL or, with compat-encrypted-stickers, an encrypted file).
    // `StickerMediaSource` → `MediaSource` (düz adres ya da compat-encrypted-stickers ile şifreli dosya).
    let kaynak: MediaSource = s.source.clone().into();
    let i = &s.info;
    let mime = i.mimetype.clone();
    MedyaBilgisi {
        tur: MedyaTuru::Resim,
        kaynak_id: kaydet(app, kaynak, mime.as_deref(), &s.body),
        kucuk_id: None,
        genislik: sayi(i.width).and_then(|v| u32::try_from(v).ok()),
        yukseklik: sayi(i.height).and_then(|v| u32::try_from(v).ok()),
        sure_ms: None,
        boyut: sayi(i.size),
        dosya_adi: s.body.clone(),
        mime,
        ilerleme: None,
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Chunked upload from the webview · Webview'den parçalı yükleme
// ---------------------------------------------------------------------------------------------------------------------
//
// Why base64 in JSON and not a raw request body: Tauri's raw `Request` bodies are not supported on Android (the body is dropped
// by the webview's request interception), and we want the same code on both. The webview slices the file (1.5 MB per call) so a
// 200 MB video never sits in memory twice.
// Neden JSON içinde base64, ham istek gövdesi değil: Tauri'nin ham `Request` gövdeleri Android'de desteklenmez (gövde webview'in
// istek yakalamasında düşer) ve iki platformda aynı kodu istiyoruz. Webview dosyayı dilimler (çağrı başına 1,5 MB); 200 MB'lık
// video bellekte iki kez durmaz.

/// Cache folder path without touching the filesystem (creation happens inside `spawn_blocking` only when writing).
/// Dosya sistemine dokunmadan önbellek klasör yolu (oluşturma yalnızca yazarken `spawn_blocking` içinde yapılır).
fn gecici_dizin_yolu(app: &AppHandle) -> Sonuc<PathBuf> {
    Ok(app.path().app_cache_dir()?.join("medya-giden"))
}

/// Only plain file names: nothing from the UI may point outside the cache folder. · Yalnızca düz dosya adları: arayüzden gelen hiçbir şey önbellek klasörünün dışını gösteremez.
fn temiz_kimlik(s: &str) -> bool {
    !s.is_empty() && s.len() < 80 && !s.starts_with('.') && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

pub fn dosya_yolu(app: &AppHandle, kimlik: &str) -> Sonuc<PathBuf> {
    if !temiz_kimlik(kimlik) {
        return Err(Hata::Diger("geçersiz dosya kimliği".into()));
    }
    Ok(gecici_dizin_yolu(app)?.join(kimlik))
}

/// Appends one base64 chunk. `kimlik: None` starts a new file (and sweeps cache files older than a day); returns the file id.
/// Bir base64 parçası ekler. `kimlik: None` yeni dosya başlatır (ve bir günden eski önbellek dosyalarını süpürür); dosya kimliğini döndürür.
pub async fn parca_yaz(app: &AppHandle, kimlik: Option<String>, uzanti: &str, veri: String) -> Sonuc<String> {
    let yeni = kimlik.is_none();
    let kimlik = match kimlik {
        Some(k) => k,
        None => {
            let uz: String = uzanti.chars().filter(|c| c.is_ascii_alphanumeric()).take(8).collect();
            format!("{:016x}.{}", rand::random::<u64>(), if uz.is_empty() { "bin".to_owned() } else { uz })
        }
    };
    let yol = dosya_yolu(app, &kimlik)?;
    // Base64 decode (up to ~2 MB) + folder creation + sweep + file append all run on the blocking pool so Tokio workers stay free.
    // Base64 çözme (~2 MB'a kadar) + klasör oluşturma + süpürme + dosyaya ekleme Tokio işçilerini boş tutmak için blocking havuzunda çalışır.
    tokio::task::spawn_blocking(move || -> Sonuc<()> {
        let baytlar = base64::engine::general_purpose::STANDARD
            .decode(&veri)
            .map_err(|e| Hata::Diger(format!("base64: {e}")))?;
        if let Some(dizin) = yol.parent() {
            std::fs::create_dir_all(dizin)?;
            if yeni {
                supur(dizin);
            }
        }
        let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&yol)?;
        f.write_all(&baytlar)?;
        Ok(())
    })
    .await
    .map_err(|e| Hata::Diger(e.to_string()))??;
    Ok(kimlik)
}

/// Removes leftovers (crashed sends) older than a day. · Bir günden eski artıkları (yarım kalan gönderimler) siler.
fn supur(dizin: &std::path::Path) {
    let Ok(girdiler) = std::fs::read_dir(dizin) else { return };
    for g in girdiler.flatten() {
        let eski = g
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .is_some_and(|e| e > Duration::from_secs(24 * 3600));
        if eski {
            let _ = std::fs::remove_file(g.path());
        }
    }
}

/// Deletes prepared temporary files on the blocking pool so async callers never block Tokio on `remove_file`.
/// Hazırlanan geçici dosyaları blocking havuzunda siler; async çağıranlar `remove_file` sırasında Tokio'yu bloklamasın.
pub async fn temizle_async(app: &AppHandle, kimlikler: Vec<String>) {
    let yollar: Vec<PathBuf> = kimlikler.iter().filter_map(|k| dosya_yolu(app, k).ok()).collect();
    if yollar.is_empty() {
        return;
    }
    let _ = tokio::task::spawn_blocking(move || {
        for y in yollar {
            let _ = std::fs::remove_file(y);
        }
    })
    .await;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sending · Gönderme
// ---------------------------------------------------------------------------------------------------------------------

/// The open timeline of a room, or a fresh one (the attach flow may run while the room view is closing).
/// Bir odanın açık zaman çizelgesi, yoksa yenisi (ek akışı oda görünümü kapanırken çalışabilir).
async fn zaman_al(durum: &AppState, client: &Client, oda_id: &str) -> Sonuc<Arc<Timeline>> {
    let id = RoomId::parse(oda_id)?;
    if let Some(a) = durum.zamanlar.lock().await.get(&id) {
        return Ok(a.zaman.clone());
    }
    let room = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    Ok(Arc::new(room.timeline().await?))
}

fn dosya_adi_temizle(ad: &str) -> String {
    let t: String = ad.rsplit(['/', '\\']).next().unwrap_or(ad).trim().chars().filter(|c| !c.is_control()).collect();
    if t.is_empty() { "dosya".to_owned() } else { t }
}

/// Queues the prepared file as a message. Returns as soon as it is in the send queue (the local echo then shows the upload).
/// Hazırlanan dosyayı mesaj olarak sıraya koyar. Gönderim kuyruğuna girer girmez döner (yükleme yerel yankıda görünür).
pub async fn gonder(app: &AppHandle, durum: &AppState, client: &Client, istek: MedyaGonderIstegi) -> Sonuc<()> {
    let zaman = zaman_al(durum, client, &istek.oda_id).await?;
    let yol = dosya_yolu(app, &istek.kimlik)?;
    let mut sil = vec![istek.kimlik.clone()];
    sil.extend(istek.kucuk_kimlik.clone());
    // Refuse here, from the size on disk (not after reading a file that is too big into memory): once queued, a file the
    // server rejects would hold up the whole room. The prepared files go too, nothing will send them.
    // Burada, diskteki boyuttan geri çevir (çok büyük dosyayı belleğe okuduktan sonra değil): kuyruğa girince, sunucunun
    // reddettiği dosya bütün odayı bekletirdi. Hazırlanan dosyalar da silinir, onları gönderecek bir şey yok.
    let disk_boyutu = tokio::fs::metadata(&yol).await?.len();
    if let Err(e) = crate::matrix::kuyruk::boyut_denetle(client, disk_boyutu).await {
        temizle_async(app, sil).await;
        return Err(e);
    }
    let baytlar = tokio::fs::read(&yol).await?;
    let boyut = UInt::new(baytlar.len() as u64);
    let mime: mime::Mime = istek.mime.parse().unwrap_or(mime::APPLICATION_OCTET_STREAM);
    let (g, y) = (istek.genislik.map(UInt::from), istek.yukseklik.map(UInt::from));
    let bilgi = match istek.tur.as_str() {
        "resim" => AttachmentInfo::Image(BaseImageInfo { width: g, height: y, size: boyut, ..Default::default() }),
        "video" => AttachmentInfo::Video(BaseVideoInfo {
            width: g,
            height: y,
            size: boyut,
            duration: istek.sure_ms.map(Duration::from_millis),
            ..Default::default()
        }),
        _ => AttachmentInfo::File(BaseFileInfo { size: boyut }),
    };
    // Thumbnail (images get one too: the bubble shows it first, the full image loads on tap).
    // Küçük resim (resimlere de konur: balon önce onu gösterir, tam resim dokununca yüklenir).
    let kucuk = match (&istek.kucuk_kimlik, istek.kucuk_genislik, istek.kucuk_yukseklik) {
        (Some(k), Some(kg), Some(ky)) => {
            let kucuk_yol = dosya_yolu(app, k)?;
            let veri = tokio::fs::read(&kucuk_yol).await?;
            let boyut = UInt::new(veri.len() as u64).unwrap_or_default();
            Some(Thumbnail {
                content_type: istek.kucuk_mime.as_deref().and_then(|m| m.parse().ok()).unwrap_or(mime::IMAGE_JPEG),
                width: UInt::from(kg),
                height: UInt::from(ky),
                size: boyut,
                data: veri,
            })
        }
        _ => None,
    };
    let aciklama = istek.aciklama.as_deref().map(str::trim).filter(|a| !a.is_empty()).map(TextMessageEventContent::plain);
    let ayar = AttachmentConfig { info: Some(bilgi), thumbnail: kucuk, caption: aciklama, ..Default::default() };
    let kaynak = AttachmentSource::Data { bytes: baytlar, filename: dosya_adi_temizle(&istek.dosya_adi) };
    zaman.send_attachment(kaynak, mime, ayar).use_send_queue().await?;
    // The SDK keeps its own copy in the media cache, ours can go. · SDK kendi kopyasını medya önbelleğinde tutar, bizimki silinebilir.
    temizle_async(app, sil).await;
    Ok(())
}

/// Aborts an upload that is still running (the local echo disappears). · Süren bir yüklemeyi iptal eder (yerel yankı kaybolur).
pub async fn gonderimi_iptal(durum: &AppState, client: &Client, oda_id: &str, oge_id: &str) -> Sonuc<()> {
    let zaman = zaman_al(durum, client, oda_id).await?;
    crate::matrix::kuyruk::vazgec(client, &zaman, oda_id, oge_id).await
}

// ---------------------------------------------------------------------------------------------------------------------
// Video transcoding (Android) · Video yeniden kodlama (Android)
// ---------------------------------------------------------------------------------------------------------------------

/// Transcodes the cached video on Android (Media3 Transformer, see `VideoSikistir.kt`) and emits `medya-ilerleme`.
/// Not available elsewhere: the UI checks `medya_yetenekleri` first and sends the original on the desktop.
/// TODO(desktop): transcode with ffmpeg (needs a bundled binary or a crate) · TODO(masaüstü): ffmpeg ile yeniden kodlama.
/// Önbellekteki videoyu Android'de yeniden kodlar (Media3 Transformer, bkz. `VideoSikistir.kt`) ve `medya-ilerleme` yayınlar.
/// Başka yerde yok: arayüz önce `medya_yetenekleri`ne bakar, masaüstünde özgün videoyu yollar.
pub async fn video_sikistir(app: &AppHandle, istek: VideoSikistirIstegi) -> Sonuc<VideoSonucu> {
    if !cfg!(target_os = "android") {
        return Err(Hata::Diger("video sıkıştırma yalnızca Android'de var".into()));
    }
    let girdi = dosya_yolu(app, &istek.kimlik)?;
    let cikti_kimlik = format!("{:016x}.mp4", rand::random::<u64>());
    let cikti = dosya_yolu(app, &cikti_kimlik)?;
    let (g, c) = (girdi.to_string_lossy().into_owned(), cikti.to_string_lossy().into_owned());
    let (yuk, bit, bas, son, ses) = (istek.yukseklik as i32, istek.bitrate_bps as i32, istek.basla_ms as i64, istek.bitis_ms as i64, istek.sessiz);
    let cikti_dizin = cikti.parent().map(std::path::Path::to_path_buf);
    let is = tokio::task::spawn_blocking(move || {
        if let Some(d) = cikti_dizin {
            let _ = std::fs::create_dir_all(d);
        }
        android_jni::video_sikistir(&g, &c, yuk, bit, bas, son, ses)
    });

    // Poll the Kotlin side for progress while the blocking call runs. · Bloklayan çağrı sürerken ilerlemeyi Kotlin'den sorgula.
    tokio::pin!(is);
    let mut son_yuzde = u32::MAX;
    let sonuc = loop {
        tokio::select! {
            r = &mut is => break r.map_err(|e| Hata::Diger(e.to_string()))?,
            _ = tokio::time::sleep(Duration::from_millis(350)) => {
                let y = tokio::task::spawn_blocking(android_jni::video_ilerleme).await.unwrap_or(0).clamp(0, 100) as u32;
                if y != son_yuzde {
                    son_yuzde = y;
                    let _ = app.emit(OLAY_ILERLEME, MedyaIlerlemeOlayi { yerel_id: istek.yerel_id.clone(), asama: MedyaAsama::Sikistiriliyor, yuzde: y });
                }
            }
        }
    };
    let metin = sonuc.map_err(Hata::Diger)?;
    let parcalar: Vec<&str> = metin.split(';').collect();
    match parcalar[..] {
        ["ok", w, h, sure] => {
            let boyut = tokio::fs::metadata(&cikti).await?.len();
            info!("video sıkıştırıldı: {boyut} bayt");
            Ok(VideoSonucu {
                kimlik: cikti_kimlik,
                boyut,
                genislik: w.parse().unwrap_or(0),
                yukseklik: h.parse().unwrap_or(0),
                sure_ms: sure.parse().unwrap_or(0),
            })
        }
        _ => {
            let _ = tokio::fs::remove_file(&cikti).await;
            warn!("video sıkıştırma başarısız: {metin}");
            Err(Hata::Diger(format!("video sıkıştırılamadı: {}", parcalar.get(1).copied().unwrap_or("bilinmeyen"))))
        }
    }
}

pub fn video_iptal() {
    if cfg!(target_os = "android") {
        android_jni::video_iptal();
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Save to the phone · Telefona kaydet
// ---------------------------------------------------------------------------------------------------------------------

/// Writes a received media file to the gallery / downloads (Android: MediaStore via Kotlin; desktop: the Downloads folder).
/// Returns where it went, for the toast.
/// Alınan medya dosyasını galeriye / indirilenlere yazar (Android: Kotlin ile MediaStore; masaüstü: İndirilenler klasörü).
/// Bildirim için nereye gittiğini döndürür.
pub async fn kaydet_telefona(app: &AppHandle, durum: &AppState, kaynak_id: &str) -> Sonuc<String> {
    let kayit = durum.medya_kaynaklari.lock().ok().and_then(|k| k.harita.get(kaynak_id).cloned()).ok_or(Hata::Diger("medya bulunamadı".into()))?;
    let client = durum.client().await?;
    let params = matrix_sdk::media::MediaRequestParameters { source: kayit.kaynak, format: matrix_sdk::media::MediaFormat::File };
    let baytlar = client.media().get_media_content(&params, true).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    let ad = dosya_adi_temizle(&kayit.dosya_adi);
    if cfg!(target_os = "android") {
        let mime = kayit.mime.unwrap_or_else(|| "application/octet-stream".into());
        let gecici_kok = gecici_dizin_yolu(app)?;
        let gecici = gecici_kok.join(format!("{:016x}-kayit", rand::random::<u64>()));
        let ad_kopya = ad.clone();
        // Writing the temp file, passing it through JNI MediaStore and deleting it all run on the blocking pool.
        // Geçici dosyayı yazma, JNI MediaStore ile kaydetme ve silme işlerinin tümü blocking havuzunda çalışır.
        let sonuc = tokio::task::spawn_blocking(move || -> Sonuc<Result<String, String>> {
            std::fs::create_dir_all(&gecici_kok)?;
            std::fs::write(&gecici, &baytlar)?;
            let g = gecici.to_string_lossy().into_owned();
            let r = android_jni::medya_kaydet(&g, &ad_kopya, &mime);
            let _ = std::fs::remove_file(&gecici);
            Ok(r)
        })
        .await
        .map_err(|e| Hata::Diger(e.to_string()))??;
        match sonuc {
            Ok(h) if h.is_empty() => Ok(ad),
            Ok(h) => Err(Hata::Depolama(h)),
            Err(h) => Err(Hata::Depolama(h)),
        }
    } else {
        let dizin = app.path().download_dir()?;
        tokio::task::spawn_blocking(move || -> Sonuc<String> {
            std::fs::create_dir_all(&dizin)?;
            let mut hedef = dizin.join(&ad);
            // Never overwrite: "foto.webp" → "foto (2).webp" · Asla üzerine yazma: "foto.webp" → "foto (2).webp"
            let mut n = 2;
            loop {
                match std::fs::OpenOptions::new().write(true).create_new(true).open(&hedef) {
                    Ok(mut f) => {
                        f.write_all(&baytlar)?;
                        return Ok(hedef.to_string_lossy().into_owned());
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                        let (govde, uz) = ad.rsplit_once('.').map(|(a, b)| (a.to_owned(), format!(".{b}"))).unwrap_or((ad.clone(), String::new()));
                        hedef = dizin.join(format!("{govde} ({n}){uz}"));
                        n += 1;
                    }
                    Err(e) => return Err(e.into()),
                }
            }
        })
        .await
        .map_err(|e| Hata::Diger(e.to_string()))?
    }
}
