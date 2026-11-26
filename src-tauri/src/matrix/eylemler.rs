//! Message actions that go beyond "send text": reactions, delete, edit, typing, pins, polls, forward, stickers, presence.
//! Each command is thin: the timeline work lives in `zaman.rs`, packs in `paketler.rs`.
//! "Metin gönder"in ötesindeki mesaj eylemleri: tepki, silme, düzenleme, yazıyor, sabitleme, anket, iletme, çıkartma, varlık.
//! Her komut ince: çizelge işi `zaman.rs`te, paketler `paketler.rs`te.

use matrix_sdk::{
    ruma::{
        api::client::presence::get_presence,
        events::{relation::{InReplyTo, Reply}, room::message::{Relation, RoomMessageEventContent}, room::ImageInfo, sticker::StickerEventContent, AnyMessageLikeEventContent},
        presence::PresenceState,
        EventId, OwnedMxcUri, RoomId, UInt, UserId,
    },
    Client, Room,
};
use tauri::{AppHandle, State};

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::zaman,
    tipler::{AnketIstegi, CikartmaIstegi, SabitMesaj, VarlikDurumu},
};

fn oda_bul(client: &Client, oda_id: &str) -> Sonuc<Room> {
    let id = RoomId::parse(oda_id)?;
    client.get_room(&id).ok_or(Hata::OdaBulunamadi)
}

/// Replaces (or adds) my reaction. `anahtar` is the emoji. Returns true when the reaction was added, false when removed.
/// Tepkimi ekler / kaldırır. `anahtar` emojidir. Eklendiyse true, kaldırıldıysa false döner.
#[tauri::command]
pub async fn tepki_degistir(durum: State<'_, AppState>, oda_id: String, olay_id: String, anahtar: String) -> Sonuc<bool> {
    zaman::tepki_degistir(&durum, &oda_id, &olay_id, &anahtar).await
}

#[tauri::command]
pub async fn mesaj_sil(durum: State<'_, AppState>, oda_id: String, olay_id: String) -> Sonuc<()> {
    zaman::mesaj_sil(&durum, &oda_id, &olay_id).await
}

#[tauri::command]
pub async fn mesaj_duzenle(
    durum: State<'_, AppState>,
    oda_id: String,
    olay_id: String,
    metin: String,
    html: Option<String>,
    bahsedilenler: Option<Vec<String>>,
    oda_bahset: Option<bool>,
) -> Sonuc<()> {
    let bahisler = bahsedilenler.unwrap_or_default();
    zaman::mesaj_duzenle(&durum, &oda_id, &olay_id, &metin, html.as_deref(), &bahisler, oda_bahset.unwrap_or(false)).await
}

/// Typing notice: the SDK throttles repeated `true` calls itself (one request per ~4 s), so the UI may call it on every keystroke.
/// Yazıyor bildirimi: SDK tekrarlanan `true` çağrılarını kendisi seyreltir (~4 sn'de bir istek); arayüz her tuşta çağırabilir.
#[tauri::command]
pub async fn yaziyor_bildir(durum: State<'_, AppState>, oda_id: String, yaziyor: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    oda.typing_notice(yaziyor).await?;
    Ok(())
}

// ---- Pinned messages · Sabit mesajlar ----

#[tauri::command]
pub async fn mesaj_sabitle(app: AppHandle, durum: State<'_, AppState>, oda_id: String, olay_id: String, sabitle: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let id = EventId::parse(&olay_id)?;
    if sabitle {
        oda.pin_event(&id).await?;
    } else {
        oda.unpin_event(&id).await?;
    }
    // The pinned list is state, not a timeline item: tell the open timeline to re-map. · Sabit listesi durumdur, çizelge öğesi değil: açık çizelgeye yeniden eşlemesini söyle.
    let _ = zaman::yeniden_yayinla(app, &durum, &oda_id).await;
    Ok(())
}

/// The pinned messages with a one-line text each, in pin order. Text comes from the open timeline when the event is loaded,
/// otherwise from the event cache / server (an undecryptable event shows no text).
/// Sabit mesajlar, her biri tek satır metinle, sabitlenme sırasıyla. Olay yüklüyse metin açık çizelgeden, değilse olay önbelleğinden /
/// sunucudan gelir (çözülemeyen olay metinsiz görünür).
#[tauri::command]
pub async fn sabit_mesajlar(durum: State<'_, AppState>, oda_id: String) -> Sonuc<Vec<SabitMesaj>> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let idler = match oda.pinned_event_ids() {
        Some(i) => i,
        None => oda.load_pinned_events().await?.unwrap_or_default(),
    };
    let zaman = zaman::acik_zaman(&durum, &oda_id).await.ok();
    let mut sonuc = Vec::with_capacity(idler.len());
    for id in idler {
        let mut m = SabitMesaj { olay_id: id.to_string(), gonderen_ad: None, metin: None };
        let yuklu = match &zaman {
            Some(z) => z.item_by_event_id(&id).await,
            None => None,
        };
        if let Some(oge) = yuklu {
            m.metin = zaman::icerik_metni(oge.content());
            m.gonderen_ad = Some(zaman::kisi_bilgisi(&oda, oge.sender()).await.ad);
        } else if let Ok(olay) = oda.load_or_fetch_event(&id, None).await {
            let ham = olay.raw();
            let tur = ham.get_field::<String>("type").ok().flatten();
            let icerik = ham.get_field::<serde_json::Value>("content").ok().flatten();
            m.metin = match tur.as_deref() {
                Some("m.room.message") => icerik.and_then(|c| c.get("body").and_then(|b| b.as_str()).map(|b| b.lines().next().unwrap_or("").chars().take(140).collect::<String>())),
                Some("m.room.encrypted") => Some("Şifreli mesaj".to_owned()),
                Some("m.sticker") => Some("Çıkartma".to_owned()),
                _ => None,
            };
            if let Some(g) = ham.get_field::<String>("sender").ok().flatten().and_then(|g| UserId::parse(&g).ok()) {
                m.gonderen_ad = Some(zaman::kisi_bilgisi(&oda, &g).await.ad);
            }
        }
        sonuc.push(m);
    }
    Ok(sonuc)
}

// ---- Polls · Anketler ----

#[tauri::command]
pub async fn anket_olustur(durum: State<'_, AppState>, istek: AnketIstegi) -> Sonuc<()> {
    zaman::anket_gonder(&durum, istek).await
}

#[tauri::command]
pub async fn anket_oy_ver(durum: State<'_, AppState>, oda_id: String, anket_olay_id: String, secenekler: Vec<String>) -> Sonuc<()> {
    zaman::anket_oy_ver(&durum, &oda_id, &anket_olay_id, secenekler).await
}

#[tauri::command]
pub async fn anket_bitir(durum: State<'_, AppState>, oda_id: String, anket_olay_id: String) -> Sonuc<()> {
    zaman::anket_bitir(&durum, &oda_id, &anket_olay_id).await
}

// ---- Forward · İletme ----

/// Sends a copy of a message to another room. Text, notices, emotes and media (the same `MediaSource` is reused: no re-upload;
/// encrypted media keeps working because the keys travel inside the new event) can be forwarded; polls, stickers and calls cannot.
/// Bir mesajın kopyasını başka odaya yollar. Metin, bildirim, emote ve medya iletilebilir (aynı `MediaSource` yeniden kullanılır:
/// yeniden yükleme yok; şifreli medya çalışmaya devam eder çünkü anahtarlar yeni olayın içinde gider); anket, çıkartma ve arama iletilemez.
#[tauri::command]
pub async fn mesaj_ilet(durum: State<'_, AppState>, kaynak_oda_id: String, olay_id: String, hedef_oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let hedef = oda_bul(&client, &hedef_oda_id)?;
    let zaman = zaman::acik_zaman(&durum, &kaynak_oda_id).await?;
    let id = EventId::parse(&olay_id)?;
    let oge = zaman.item_by_event_id(&id).await.ok_or_else(|| Hata::Diger("mesaj bulunamadı".into()))?;
    let mesaj = oge.content().as_message().ok_or_else(|| Hata::Diger("bu mesaj iletilemez".into()))?;
    // Encrypted media keeps its keys inside the event; an unencrypted room would publish them, and other clients cannot show
    // such a file there. So it is decrypted and uploaded again as an ordinary attachment of the target room.
    // Şifreli medyanın anahtarları olayın içinde durur; şifresiz oda onları açığa yazardı ve öteki istemciler orada böyle bir
    // dosyayı gösteremez. Bu yüzden çözülüp hedef odanın sıradan bir eki olarak yeniden yüklenir.
    if let Some((kaynak, tur, ad)) = sifreli_medya(mesaj.msgtype()) {
        if !hedef.latest_encryption_state().await.map(|d| d.is_encrypted()).unwrap_or(true) {
            use matrix_sdk::media::{MediaFormat, MediaRequestParameters};
            let params = MediaRequestParameters { source: kaynak, format: MediaFormat::File };
            let veri = client.media().get_media_content(&params, true).await.map_err(|e| Hata::Matrix(e.to_string()))?;
            crate::matrix::kuyruk::boyut_denetle(&client, veri.len()).await?;
            let tur: mime::Mime = tur.and_then(|m| m.parse().ok()).unwrap_or(mime::APPLICATION_OCTET_STREAM);
            hedef
                .send_queue()
                .send_attachment(ad, tur, veri, Default::default())
                .await
                .map_err(|e| Hata::Matrix(e.to_string()))?;
            return Ok(());
        }
    }
    let icerik = RoomMessageEventContent::new(mesaj.msgtype().clone());
    hedef
        .send_queue()
        .send(AnyMessageLikeEventContent::RoomMessage(icerik))
        .await
        .map_err(|e| Hata::Matrix(e.to_string()))?;
    Ok(())
}

/// Source, type and file name of an encrypted media message; None for anything else.
/// Şifreli bir medya mesajının kaynağı, türü ve dosya adı; başka her şey için None.
fn sifreli_medya(t: &matrix_sdk::ruma::events::room::message::MessageType) -> Option<(matrix_sdk::ruma::events::room::MediaSource, Option<String>, String)> {
    use matrix_sdk::ruma::events::room::{message::MessageType as M, MediaSource};
    let (kaynak, mime, ad) = match t {
        M::Image(c) => (&c.source, c.info.as_ref().and_then(|i| i.mimetype.clone()), c.filename().to_owned()),
        M::Video(c) => (&c.source, c.info.as_ref().and_then(|i| i.mimetype.clone()), c.filename().to_owned()),
        M::Audio(c) => (&c.source, c.info.as_ref().and_then(|i| i.mimetype.clone()), c.filename().to_owned()),
        M::File(c) => (&c.source, c.info.as_ref().and_then(|i| i.mimetype.clone()), c.filename().to_owned()),
        _ => return None,
    };
    matches!(kaynak, MediaSource::Encrypted(_)).then(|| (kaynak.clone(), mime, ad))
}

// ---- Stickers · Çıkartmalar ----

/// Sends an `m.sticker` event for an image of an MSC2545 pack (the image is already on the server: only its `mxc://` is sent).
/// MSC2545 paketinin bir görseli için `m.sticker` olayı yollar (görsel zaten sunucuda: yalnızca `mxc://` adresi gider).
#[tauri::command]
pub async fn cikartma_gonder(durum: State<'_, AppState>, istek: CikartmaIstegi) -> Sonuc<()> {
    if !istek.mxc.starts_with("mxc://") {
        return Err(Hata::Diger("geçersiz çıkartma adresi".into()));
    }
    let mut bilgi = ImageInfo::new();
    bilgi.width = istek.genislik.map(UInt::from);
    bilgi.height = istek.yukseklik.map(UInt::from);
    bilgi.mimetype = istek.mime.clone();
    let mut icerik = StickerEventContent::new(istek.metin.clone(), bilgi, OwnedMxcUri::from(istek.mxc.clone()));
    if let Some(yanit) = istek.yanit_olay_id.as_deref().filter(|y| !y.is_empty()) {
        icerik.relates_to = Some(Relation::Reply(Reply::new(InReplyTo::new(EventId::parse(yanit)?))));
    }
    let zaman = zaman::acik_zaman(&durum, &istek.oda_id).await?;
    zaman.send(AnyMessageLikeEventContent::Sticker(icerik)).await?;
    Ok(())
}

// ---- Presence · Varlık ----

/// Presence of one person (`GET /presence/{user}/status`). Many servers (matrix.org) disable presence and answer with an error;
/// the UI then simply shows nothing. Not live: the UI asks once when a DM opens.
/// Bir kişinin varlık durumu (`GET /presence/{user}/status`). Birçok sunucu (matrix.org) varlığı kapatır ve hata döner; arayüz
/// o zaman hiçbir şey göstermez. Canlı değil: arayüz DM açılınca bir kez sorar.
#[tauri::command]
pub async fn varlik_durumu(durum: State<'_, AppState>, kullanici_id: String) -> Sonuc<VarlikDurumu> {
    let client = durum.client().await?;
    let kisi = UserId::parse(&kullanici_id).map_err(|e| Hata::Diger(e.to_string()))?;
    let yanit = client.send(get_presence::v3::Request::new(kisi)).await?;
    let ad = match yanit.presence {
        PresenceState::Online => "cevrimici",
        PresenceState::Unavailable => "bosta",
        _ => "cevrimdisi",
    };
    Ok(VarlikDurumu { durum: ad.to_owned(), son_etkinlik_ms: yanit.last_active_ago.map(|d| d.as_millis() as u64) })
}
