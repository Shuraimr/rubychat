//! Custom emoji and sticker packs (MSC2545 "image packs"). Read as raw JSON on purpose: it covers both the long-used
//! `im.ponies.*` event types (Element, Cinny, FluffyChat) and the stable `m.room.image_pack` / `m.image_pack` ones, which share one shape:
//! `{ "images": { "shortcode": { "url": "mxc://…", "body": "…", "info": {…}, "usage": ["emoticon","sticker"] } }, "pack": { "display_name", "avatar_url", "usage" } }`.
//! Özel emoji ve çıkartma paketleri (MSC2545 "image pack"). Bilerek ham JSON okunur: uzun süredir kullanılan `im.ponies.*` olay
//! türlerini (Element, Cinny, FluffyChat) ve kararlı `m.room.image_pack` / `m.image_pack` türlerini kapsar; ikisi aynı biçimi paylaşır.
//!
//! Where the packs live / Paketler nerede:
//!  - room state `im.ponies.room_emotes` / `m.room.image_pack` (state key = pack name)  · oda durumu
//!  - my account data `im.ponies.user_emotes` / `m.image_pack`                         · kendi hesap verim
//!  - my account data `im.ponies.emote_rooms` / `m.image_pack.rooms`: which room packs I enabled · hangi oda paketlerini açtığım
//! Sliding sync does not request these custom state types, so the store usually lacks them: when the store has none we ask the
//! server (`GET /state`, once per picker opening; the UI caches the answer).
//! Sliding sync bu özel durum türlerini istemez, bu yüzden depoda genelde yoktur: depoda yoksa sunucuya sorarız (`GET /state`,
//! seçici açılışı başına bir kez; arayüz cevabı önbelleğe alır).

use matrix_sdk::{
    deserialized_responses::RawAnySyncOrStrippedState,
    ruma::{
        api::client::state::get_state_events,
        events::{GlobalAccountDataEventType, StateEventType},
        RoomId,
    },
    Room,
};
use serde_json::Value;
use tauri::State;

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::odalar::oda_adi,
    tipler::{GorselPaketi, PaketGorseli},
};

const ODA_TURLERI: [&str; 2] = ["m.room.image_pack", "im.ponies.room_emotes"];
const KULLANICI_TURLERI: [&str; 2] = ["m.image_pack", "im.ponies.user_emotes"];
const ODA_LISTESI_TURLERI: [&str; 2] = ["m.image_pack.rooms", "im.ponies.emote_rooms"];

/// Rooms with more joined members than this are not asked for their state from the server (a `/state` of a huge room is megabytes).
/// Bu kadar üyeden fazlası olan odalar için sunucudan durum istenmez (dev bir odanın `/state`i megabaytlarca olur).
const BUYUK_ODA: u64 = 2000;

fn ham_json(o: &RawAnySyncOrStrippedState) -> Option<Value> {
    match o {
        RawAnySyncOrStrippedState::Sync(r) => r.deserialize_as_unchecked::<Value>().ok(),
        RawAnySyncOrStrippedState::Stripped(r) => r.deserialize_as_unchecked::<Value>().ok(),
    }
}

fn metin_dizisi(v: Option<&Value>) -> Option<Vec<String>> {
    v.and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_owned)).collect())
}

/// One pack content → UI pack. `None` = no usable images. · Bir paket içeriği → arayüz paketi. `None` = kullanılabilir görsel yok.
fn paket_coz(kaynak: &str, yedek_ad: &str, icerik: &Value) -> Option<GorselPaketi> {
    let gorseller = icerik.get("images")?.as_object()?;
    let meta = icerik.get("pack");
    let paket_kullanim = metin_dizisi(meta.and_then(|m| m.get("usage")));
    let mut liste = Vec::new();
    for (kod, g) in gorseller {
        let Some(url) = g.get("url").and_then(|u| u.as_str()).filter(|u| u.starts_with("mxc://")) else { continue };
        // The image's own `usage` wins over the pack's; absent everywhere = both emoji and sticker (spec default).
        // Görselin kendi `usage`ı paketinkine üstündür; hiçbir yerde yoksa = hem emoji hem çıkartma (spesifikasyon varsayılanı).
        let kullanim = metin_dizisi(g.get("usage")).or_else(|| paket_kullanim.clone()).filter(|k| !k.is_empty());
        let (emoji, cikartma) = match &kullanim {
            Some(k) => (k.iter().any(|x| x == "emoticon"), k.iter().any(|x| x == "sticker")),
            None => (true, true),
        };
        let bilgi = g.get("info");
        let sayi = |anahtar: &str| bilgi.and_then(|i| i.get(anahtar)).and_then(|v| v.as_u64()).and_then(|v| u32::try_from(v).ok());
        liste.push(PaketGorseli {
            kisa_kod: kod.clone(),
            mxc: url.to_owned(),
            metin: g.get("body").and_then(|b| b.as_str()).filter(|b| !b.is_empty()).unwrap_or(kod).to_owned(),
            genislik: sayi("w"),
            yukseklik: sayi("h"),
            mime: bilgi.and_then(|i| i.get("mimetype")).and_then(|m| m.as_str()).map(str::to_owned),
            emoji,
            cikartma,
        });
    }
    if liste.is_empty() {
        return None;
    }
    liste.sort_by(|a, b| a.kisa_kod.to_lowercase().cmp(&b.kisa_kod.to_lowercase()));
    let ad = meta.and_then(|m| m.get("display_name")).and_then(|d| d.as_str()).filter(|d| !d.is_empty()).unwrap_or(yedek_ad);
    Some(GorselPaketi {
        kaynak: kaynak.to_owned(),
        ad: ad.to_owned(),
        avatar_mxc: meta.and_then(|m| m.get("avatar_url")).and_then(|a| a.as_str()).map(str::to_owned),
        gorseller: liste,
    })
}

/// (state_key, content) of every image-pack state event of a room, from the store first, else from the server.
/// Bir odanın her görsel paketi durum olayının (state_key, içerik); önce depodan, yoksa sunucudan.
async fn oda_paket_olaylari(oda: &Room) -> Vec<(String, Value)> {
    let mut sonuc = Vec::new();
    for tur in ODA_TURLERI {
        if let Ok(liste) = oda.get_state_events(StateEventType::from(tur)).await {
            for o in &liste {
                if let Some(v) = ham_json(o) {
                    if let Some(c) = v.get("content") {
                        sonuc.push((v.get("state_key").and_then(|k| k.as_str()).unwrap_or("").to_owned(), c.clone()));
                    }
                }
            }
        }
    }
    if !sonuc.is_empty() || oda.joined_members_count() > BUYUK_ODA {
        return sonuc;
    }
    let Ok(yanit) = oda.client().send(get_state_events::v3::Request::new(oda.room_id().to_owned())).await else { return sonuc };
    for olay in yanit.room_state {
        let Ok(v) = olay.deserialize_as_unchecked::<Value>() else { continue };
        let tur = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if ODA_TURLERI.contains(&tur) {
            if let Some(c) = v.get("content") {
                sonuc.push((v.get("state_key").and_then(|k| k.as_str()).unwrap_or("").to_owned(), c.clone()));
            }
        }
    }
    sonuc
}

/// All packs usable in `oda_id`: its own room packs, my personal pack, and the room packs I enabled elsewhere.
/// `oda_id` odasında kullanılabilen bütün paketler: odanın kendi paketleri, kişisel paketim ve başka yerde açtığım oda paketleri.
#[tauri::command]
pub async fn emoji_paketleri(durum: State<'_, AppState>, oda_id: String) -> Sonuc<Vec<GorselPaketi>> {
    let client = durum.client().await?;
    let id = RoomId::parse(&oda_id)?;
    let oda = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    let mut paketler = Vec::new();

    for (anahtar, icerik) in oda_paket_olaylari(&oda).await {
        let yedek = if anahtar.is_empty() { oda_adi(&oda) } else { anahtar };
        if let Some(p) = paket_coz("oda", &yedek, &icerik) {
            paketler.push(p);
        }
    }

    for tur in KULLANICI_TURLERI {
        if let Ok(Some(ham)) = client.account().account_data_raw(GlobalAccountDataEventType::from(tur)).await {
            if let Ok(icerik) = ham.deserialize_as_unchecked::<Value>() {
                if let Some(p) = paket_coz("kullanici", "Kendi paketim", &icerik) {
                    paketler.push(p);
                    break;
                }
            }
        }
    }

    // Packs of other rooms I enabled: only rooms I am in (their state is in the store, no extra requests).
    // Başka odalardan açtığım paketler: yalnızca içinde olduğum odalar (durumları depoda, ek istek yok).
    for tur in ODA_LISTESI_TURLERI {
        let Ok(Some(ham)) = client.account().account_data_raw(GlobalAccountDataEventType::from(tur)).await else { continue };
        let Ok(icerik) = ham.deserialize_as_unchecked::<Value>() else { continue };
        let Some(odalar) = icerik.get("rooms").and_then(|r| r.as_object()) else { continue };
        for (oda_anahtari, anahtarlar) in odalar {
            let Ok(baska_id) = RoomId::parse(oda_anahtari) else { continue };
            if baska_id == id {
                continue;
            }
            let Some(baska) = client.get_room(&baska_id) else { continue };
            let istenen: Vec<&String> = anahtarlar.as_object().map(|o| o.keys().collect()).unwrap_or_default();
            for tur2 in ODA_TURLERI {
                for anahtar in &istenen {
                    if let Ok(Some(o)) = baska.get_state_event(StateEventType::from(tur2), anahtar).await {
                        if let Some(v) = ham_json(&o) {
                            if let Some(c) = v.get("content") {
                                let yedek = if anahtar.is_empty() { oda_adi(&baska) } else { (*anahtar).clone() };
                                if let Some(p) = paket_coz("baska_oda", &yedek, c) {
                                    paketler.push(p);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(paketler)
}
