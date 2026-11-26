//! Lightweight room preview for the Ctrl+Space room palette: reads the newest cached events without hitting the network or opening a timeline.
//! Ctrl+Space oda paleti için hafif oda önizlemesi: ağa çıkmadan ve zaman çizelgesi açmadan önbellekteki en yeni olayları okur.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use matrix_sdk::{
    ruma::{MilliSecondsSinceUnixEpoch, RoomId, UserId},
    Room, RoomState,
};
use tauri::State;

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::odalar::ham_onizleme,
    tipler::OnizlemeMesaji,
};

struct HamSatir {
    olay_id: String,
    gonderen: String,
    zaman: u64,
    metin: String,
    tur: &'static str,
}

/// Strips legacy "> quoted line" reply fallbacks so previews show the actual reply text.
/// Eski istemcilerin "> alıntı satırı" yanıt yedeğini ayıklar; önizleme asıl yanıt metnini göstersin.
fn alintiyi_at(s: &str) -> &str {
    let mut kalan = s;
    while kalan.starts_with('>') {
        match kalan.split_once('\n') {
            Some((_, geri)) => kalan = geri,
            None => return "",
        }
    }
    kalan.trim_start_matches('\n')
}

/// Maps one raw cached event to a preview row; returns None for edits, reactions, state, redacted or unsupported events.
/// Önbellekteki tek ham olayı önizleme satırına çevirir; düzenleme, tepki, durum, silinmiş ve desteklenmeyen olaylarda None döner.
fn ham_satir<T>(ham: &matrix_sdk::ruma::serde::Raw<T>) -> Option<HamSatir> {
    // State events always carry `state_key`; skip them. · Durum olayları her zaman `state_key` taşır; atla.
    if ham.get_field::<serde_json::Value>("state_key").ok().flatten().is_some() {
        return None;
    }
    let olay_turu = ham.get_field::<String>("type").ok().flatten()?;
    // Keep only messages, undecrypted events and stickers; reactions, redactions, calls, etc. are skipped.
    // Yalnızca mesaj, çözülemeyen şifreli olay ve çıkartmaları al; tepkiler, silmeler, aramalar vb. atlanır.
    if !matches!(olay_turu.as_str(), "m.room.message" | "m.room.encrypted" | "m.sticker") {
        return None;
    }
    let icerik = ham.get_field::<serde_json::Value>("content").ok().flatten()?;
    // Edits (m.replace) duplicate the original with a "* " prefix: skip them. · Düzenlemeler (m.replace) özgün mesajı "* " önekiyle yineler: atla.
    if icerik.pointer("/m.relates_to/rel_type").and_then(|r| r.as_str()) == Some("m.replace") {
        return None;
    }
    let zaman: u64 = ham.get_field::<MilliSecondsSinceUnixEpoch>("origin_server_ts").ok().flatten()?.0.into();
    let gonderen = ham.get_field::<String>("sender").ok().flatten()?;
    let olay_id = ham.get_field::<String>("event_id").ok().flatten().unwrap_or_default();

    let (tur, metin) = match olay_turu.as_str() {
        "m.room.encrypted" => ("sifreli", ham_onizleme(ham)?),
        "m.sticker" => ("medya", ham_onizleme(ham)?),
        "m.room.message" => {
            let msgtype = icerik.get("msgtype").and_then(|m| m.as_str());
            if matches!(msgtype, Some("m.image" | "m.video" | "m.audio" | "m.file")) {
                ("medya", ham_onizleme(ham)?)
            } else {
                let yanit = icerik.pointer("/m.relates_to/m.in_reply_to").is_some();
                let ham_metin = if yanit {
                    let govde = icerik.get("body").and_then(|b| b.as_str())?;
                    let temiz = alintiyi_at(govde).lines().find(|l| !l.trim().is_empty()).unwrap_or("");
                    if temiz.is_empty() { ham_onizleme(ham)? } else { temiz.to_owned() }
                } else {
                    ham_onizleme(ham)?
                };
                let kirp: String = ham_metin.trim().chars().take(180).collect();
                if kirp.is_empty() {
                    return None;
                }
                ("metin", kirp)
            }
        }
        _ => return None,
    };

    Some(HamSatir { olay_id, gonderen, zaman, metin, tur })
}

/// Resolves a sender's display name strictly from the local store (no network), memoized per call.
/// Gönderenin görünen adını yalnızca yerel depodan (ağa çıkmadan) çözer, çağrı içinde önbellekler.
async fn gonderen_adi(room: &Room, gonderen: &str, adlar: &mut HashMap<String, String>) -> String {
    if let Some(ad) = adlar.get(gonderen) {
        return ad.clone();
    }
    let ad = match UserId::parse(gonderen) {
        Ok(uid) => room
            .get_member_no_sync(&uid)
            .await
            .ok()
            .flatten()
            .and_then(|m| m.display_name().map(str::to_owned))
            .filter(|a| !a.trim().is_empty())
            .unwrap_or_else(|| uid.localpart().to_owned()),
        Err(_) => gonderen.to_owned(),
    };
    adlar.insert(gonderen.to_owned(), ad.clone());
    ad
}

/// Returns up to `adet` newest previewable messages already in the room's local event cache (oldest → newest).
/// Never opens a timeline or hits the network.
/// Odanın yerel olay önbelleğinde zaten bulunan en yeni en çok `adet` önizlenebilir mesajı (eskiden yeniye) döndürür.
/// Asla zaman çizelgesi açmaz ya da ağa çıkmaz.
#[tauri::command]
pub async fn oda_onizleme(durum: State<'_, AppState>, oda_id: String, adet: u32) -> Sonuc<Vec<OnizlemeMesaji>> {
    let client = durum.client().await?;
    let id = RoomId::parse(&oda_id)?;
    let room = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    if room.is_space() || room.state() != RoomState::Joined {
        return Ok(Vec::new());
    }
    let sinir = usize::try_from(adet).unwrap_or(20).clamp(1, 50);
    let Ok((onbellek, _birak)) = room.event_cache().await else {
        return Ok(Vec::new());
    };

    // Walk backwards through the in-memory event cache and stop as soon as we have `sinir` rows: zero network, no full clone.
    // Bellek içi olay önbelleğinde sondan geriye yürür ve `sinir` satıra ulaşınca hemen durur: sıfır ağ, tam kopya yok.
    let toplanan = Arc::new(Mutex::new(Vec::<HamSatir>::with_capacity(sinir)));
    let hedef = toplanan.clone();
    let _ = onbellek
        .rfind_map_event_in_memory_by(move |o| {
            let satir = ham_satir(o.raw())?;
            let mut v = hedef.lock().unwrap_or_else(|e| e.into_inner());
            v.push(satir);
            (v.len() >= sinir).then_some(())
        })
        .await;
    drop(onbellek);
    drop(_birak);

    let mut satirlar = std::mem::take(&mut *toplanan.lock().unwrap_or_else(|e| e.into_inner()));
    satirlar.reverse();

    let ben = room.own_user_id().as_str();
    let mut adlar: HashMap<String, String> = HashMap::new();
    let mut sonuc = Vec::with_capacity(satirlar.len());
    for (i, s) in satirlar.into_iter().enumerate() {
        let gonderen_ad = gonderen_adi(&room, &s.gonderen, &mut adlar).await;
        let olay_id = if s.olay_id.is_empty() { format!("oniz-{}-{i}", s.zaman) } else { s.olay_id };
        let kendi = s.gonderen == ben;
        sonuc.push(OnizlemeMesaji {
            olay_id,
            gonderen: s.gonderen,
            gonderen_ad,
            kendi,
            zaman: s.zaman,
            metin: s.metin,
            tur: s.tur.to_owned(),
        });
    }
    Ok(sonuc)
}
