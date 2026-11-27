//! Room list: maps `matrix_sdk::Room` → `OdaOzeti` and builds the sorted list.
//! Oda listesi: `matrix_sdk::Room` → `OdaOzeti` dönüşümü ve sıralı liste.

use matrix_sdk::{latest_events::LatestEventValue, ruma::MilliSecondsSinceUnixEpoch, Client, Room, RoomMemberships, RoomState};

use crate::{dil::sec, tipler::OdaOzeti};

/// First letter/digit of the name, uppercase; "#" if there is none.
/// Adın ilk harfi/rakamı, büyük; yoksa "#".
pub fn bas_harf(ad: &str) -> String {
    ad.chars()
        .find(|c| c.is_alphanumeric())
        .map(|c| c.to_uppercase().collect())
        .unwrap_or_else(|| "#".to_owned())
}

/// Best available name without hitting the network: cached display name → id.
/// Ağa çıkmadan bulunabilen en iyi ad: önbellekteki görünen ad → kimlik.
pub fn oda_adi(room: &Room) -> String {
    room.cached_display_name().map(|a| a.to_string()).filter(|a| !a.trim().is_empty()).unwrap_or_else(|| room.room_id().to_string())
}

/// Text preview of the room's latest event. Reads the raw JSON on purpose: it keeps working across SDK versions.
/// Odanın son olayının metin önizlemesi. Ham JSON'u bilerek okur: SDK sürümleri arasında bozulmaz.
fn onizleme(deger: &LatestEventValue) -> Option<String> {
    match deger {
        LatestEventValue::Remote(olay) => {
            ham_onizleme(olay.raw())
        }
        LatestEventValue::LocalIsSending(v) | LatestEventValue::LocalCannotBeSent(v) | LatestEventValue::LocalHasBeenSent { value: v, .. } => {
            let json = serde_json::to_value(&v.content).ok()?;
            json.get("body").or_else(|| json.pointer("/content/body")).and_then(|b| b.as_str()).map(str::to_owned)
        }
        _ => None,
    }
}

/// The preview text of one raw event (None = not something a chat list shows).
/// Tek bir ham olayın önizleme metni (None = sohbet listesinin göstereceği bir şey değil).
pub(crate) fn ham_onizleme<T>(ham: &matrix_sdk::ruma::serde::Raw<T>) -> Option<String> {
    let tur = ham.get_field::<String>("type").ok().flatten()?;
    match tur.as_str() {
        "m.room.message" => {
            let icerik = ham.get_field::<serde_json::Value>("content").ok().flatten()?;
            match icerik.get("msgtype").and_then(|m| m.as_str()) {
                Some("m.image") => Some(sec("Fotoğraf", "Photo").to_owned()),
                Some("m.video") => Some("Video".to_owned()),
                Some("m.audio") => Some(sec("Ses", "Audio").to_owned()),
                Some("m.file") => Some(sec("Dosya", "File").to_owned()),
                _ => icerik.get("body").and_then(|b| b.as_str()).map(|b| b.lines().next().unwrap_or("").to_owned()),
            }
        }
        "m.room.encrypted" => Some(sec("Şifreli mesaj", "Encrypted message").to_owned()),
        "m.sticker" => Some(sec("Çıkartma", "Sticker").to_owned()),
        _ => None,
    }
}

/// The SDK has no latest event for some rooms (it starts empty, and it skips messages it cannot decrypt): then look at the newest
/// events the event cache already holds. Never goes to the network.
/// SDK bazı odalar için son olay tutmaz (boş başlar ve çözemediği mesajları atlar): o zaman olay önbelleğinin elindeki en yeni
/// olaylara bakılır. Ağa hiç çıkmaz.
async fn onbellekten(room: &Room) -> Option<(String, MilliSecondsSinceUnixEpoch)> {
    let (onbellek, _birak) = room.event_cache().await.ok()?;
    // Walks backwards and stops at the first hit; nothing is cloned (an empty room costs one short walk). · Sondan yürür, ilk bulunanda durur; hiçbir şey kopyalanmaz.
    let bul = onbellek.rfind_map_event_in_memory_by(|o| {
        let ham = o.raw();
        // An edit repeats the old message with a "* " prefix: skip it, the original is older in the list. · Düzenleme eski mesajı "* " önekiyle yineler: atla.
        let icerik = ham.get_field::<serde_json::Value>("content").ok().flatten()?;
        if icerik.pointer("/m.relates_to/rel_type").and_then(|r| r.as_str()) == Some("m.replace") {
            return None;
        }
        let zaman = ham.get_field::<MilliSecondsSinceUnixEpoch>("origin_server_ts").ok().flatten()?;
        Some((ham_onizleme(ham)?, zaman))
    });
    bul.await.ok()?
}

/// Room avatar `mxc://`; in a DM without its own avatar, the other person's avatar.
/// Oda avatarı (`mxc://`); kendi avatarı olmayan DM'de karşıdaki kişinin avatarı.
pub async fn avatar_mxc(room: &Room, dm: bool) -> Option<String> {
    if let Some(a) = room.avatar_url() {
        return Some(a.to_string());
    }
    if dm {
        return room.heroes().await.into_iter().find_map(|h| h.avatar_url).map(|a| a.to_string());
    }
    None
}

/// In a room with exactly 2 joined members: the other member's user id (the person a call would ring).
/// Tam 2 üyeli odada: öbür üyenin kimliği (arama çaldıracağı kişi).
pub async fn karsi_kullanici(room: &Room) -> Option<String> {
    if room.joined_members_count() != 2 {
        return None;
    }
    let ben = room.own_user_id();
    let uyeler = room.members_no_sync(RoomMemberships::JOIN).await.ok()?;
    uyeler.into_iter().map(|m| m.user_id().to_owned()).find(|u| u != ben).map(|u| u.to_string())
}

pub async fn ozetle(room: &Room) -> OdaOzeti {
    let ad = oda_adi(room);
    let davet = room.state() == RoomState::Invited;
    let mut son: Option<MilliSecondsSinceUnixEpoch> = room.latest_event_timestamp();
    let mut son_mesaj = onizleme(&room.latest_event());
    if son_mesaj.is_none() && !davet && !room.is_space() {
        if let Some((metin, zaman)) = onbellekten(room).await {
            son_mesaj = Some(metin);
            son = son.or(Some(zaman));
        }
    }
    let bahsedilme = room.num_unread_mentions();
    let mut okunmamis = room.num_unread_notifications().max(bahsedilme);
    if okunmamis == 0 {
        okunmamis = room.num_unread_messages();
    }
    if okunmamis == 0 && room.is_marked_unread() {
        okunmamis = 1;
    }
    let dm = room.is_direct().await.unwrap_or(false);
    OdaOzeti {
        id: room.room_id().to_string(),
        takma_ad: room.canonical_alias().map(|a| a.to_string()),
        avatar_mxc: avatar_mxc(room, dm).await,
        avatar_harf: bas_harf(&ad),
        ad,
        son_mesaj,
        son_zaman: son.map(|t| t.0.into()),
        okunmamis,
        bahsedilme,
        sifreli: room.encryption_state().is_encrypted(),
        dm,
        davet,
        alan: room.is_space(),
        sabit: room.is_favourite(),
    }
}

/// All joined + invited rooms, newest activity first (invites without a timestamp go on top).
/// Katıldığımız + davetli bütün odalar, en yeni etkinlik önce (zaman damgasız davetler üstte).
pub async fn liste(client: &Client) -> Vec<OdaOzeti> {
    use futures_util::StreamExt;
    // Several rooms at once: the first summary of each room reads the store (event cache, heroes), and one after the other
    // that was ~2.3 s for 38 rooms at startup. A small bound keeps the store from being flooded.
    // Aynı anda birkaç oda: her odanın ilk özeti depoyu okur (olay önbelleği, kahramanlar); art arda bu, açılışta 38 oda için
    // ~2,3 sn idi. Küçük bir sınır depoyu boğmamak için.
    let odalar: Vec<Room> = client.rooms().into_iter().filter(|r| matches!(r.state(), RoomState::Joined | RoomState::Invited)).collect();
    let mut sonuc: Vec<OdaOzeti> = futures_util::stream::iter(odalar).map(|r| async move { ozetle(&r).await }).buffer_unordered(8).collect().await;
    sonuc.sort_by(|a, b| {
        let (x, y) = (a.son_zaman.unwrap_or(u64::MAX), b.son_zaman.unwrap_or(u64::MAX));
        y.cmp(&x)
    });
    sonuc
}
