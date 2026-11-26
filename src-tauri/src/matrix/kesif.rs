//! Discovery: finding people (the server's user directory) and public rooms (a server's room directory, `/publicRooms`).
//! Joining a found room goes through `alanlar::alana_katil` (id + the directory's server as `via`); a "knock" room through
//! `istekler::katilma_istegi`.
//! Keşif: kişi bulma (sunucunun kullanıcı dizini) ve herkese açık odalar (bir sunucunun oda dizini, `/publicRooms`).
//! Bulunan odaya katılma `alanlar::alana_katil` (kimlik + dizinin sunucusu `via` olarak) ile, "kapı çal" odası
//! `istekler::katilma_istegi` ile olur.

use matrix_sdk::ruma::{
    api::client::directory::get_public_rooms_filtered::v3 as dizin,
    directory::{Filter, RoomTypeFilter},
    room::{JoinRuleKind, RoomType},
    ServerName, UInt,
};
use serde::Serialize;
use tauri::State;

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulunanKisi {
    pub kullanici_id: String,
    pub ad: Option<String>,
    pub avatar_mxc: Option<String>,
}

/// The server's user directory. Most servers only list people who share a room with you or are public on the server.
/// Sunucunun kullanıcı dizini. Çoğu sunucu yalnızca seninle bir odayı paylaşanları ya da sunucuda herkese açık olanları listeler.
#[tauri::command]
pub async fn kullanici_ara(durum: State<'_, AppState>, sorgu: String) -> Sonuc<Vec<BulunanKisi>> {
    let sorgu = sorgu.trim();
    if sorgu.chars().count() < 2 {
        return Ok(Vec::new());
    }
    let client = durum.client().await?;
    let yanit = client.search_users(sorgu, 20).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    Ok(yanit
        .results
        .into_iter()
        .map(|k| BulunanKisi { kullanici_id: k.user_id.to_string(), ad: k.display_name, avatar_mxc: k.avatar_url.map(|u| u.to_string()) })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulunanOda {
    pub oda_id: String,
    pub adres: Option<String>,
    pub ad: Option<String>,
    pub konu: Option<String>,
    pub avatar_mxc: Option<String>,
    pub uye_sayisi: u64,
    /// "acik" = anyone can join, "kapi" = knock (ask to join) · "acik" = herkes katılır, "kapi" = kapı çal (katılma isteği)
    pub katilim: &'static str,
    pub alan: bool,
    /// Already a member here · Zaten burada üyeyim
    pub uye: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KesifSayfasi {
    pub odalar: Vec<BulunanOda>,
    pub sonraki: Option<String>,
    /// The server whose directory this is (the `via` for joining). · Bu dizinin sunucusu (katılmada `via`).
    pub sunucu: String,
}

/// One page of a server's public rooms. `sunucu` empty = my own server; `tur`: "oda", "alan" or "" (both).
/// Bir sunucunun herkese açık odalarından bir sayfa. `sunucu` boş = kendi sunucum; `tur`: "oda", "alan" ya da "" (ikisi).
#[tauri::command]
pub async fn odalari_kesfet(
    durum: State<'_, AppState>,
    sunucu: String,
    sorgu: String,
    tur: String,
    sonraki: Option<String>,
) -> Sonuc<KesifSayfasi> {
    let client = durum.client().await?;
    let sunucu = sunucu.trim().trim_start_matches("https://").trim_end_matches('/').to_lowercase();
    let mut istek = dizin::Request::new();
    if !sunucu.is_empty() {
        istek.server = Some(ServerName::parse(&sunucu).map_err(|_| Hata::Diger("sunucu adı".into()))?);
    }
    istek.limit = Some(UInt::from(30u32));
    istek.since = sonraki;
    let mut suzgec = Filter::new();
    let sorgu = sorgu.trim();
    if !sorgu.is_empty() {
        suzgec.generic_search_term = Some(sorgu.to_owned());
    }
    suzgec.room_types = match tur.as_str() {
        "oda" => vec![RoomTypeFilter::Default],
        "alan" => vec![RoomTypeFilter::Space],
        _ => Vec::new(),
    };
    istek.filter = suzgec;
    let yanit = client.public_rooms_filtered(istek).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    let odalar = yanit
        .chunk
        .into_iter()
        // Only rooms one can actually enter from here. · Yalnızca buradan gerçekten girilebilen odalar.
        .filter(|o| matches!(o.join_rule, JoinRuleKind::Public | JoinRuleKind::Knock | JoinRuleKind::KnockRestricted))
        .map(|o| {
            let uye = client.get_room(&o.room_id).is_some_and(|r| r.state() == matrix_sdk::RoomState::Joined);
            BulunanOda {
                oda_id: o.room_id.to_string(),
                adres: o.canonical_alias.map(|a| a.to_string()),
                ad: o.name.filter(|a| !a.trim().is_empty()),
                konu: o.topic.filter(|k| !k.trim().is_empty()),
                avatar_mxc: o.avatar_url.map(|u| u.to_string()),
                uye_sayisi: u64::from(o.num_joined_members),
                katilim: if o.join_rule == JoinRuleKind::Public { "acik" } else { "kapi" },
                alan: o.room_type == Some(RoomType::Space),
                uye,
            }
        })
        .collect();
    let sunucu = if sunucu.is_empty() { client.user_id().map(|u| u.server_name().to_string()).unwrap_or_default() } else { sunucu };
    Ok(KesifSayfasi { odalar, sonraki: yanit.next_batch, sunucu })
}
