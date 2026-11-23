//! Spaces (`m.space` rooms): the top-level list, one space's children and joining a child.
//! Built on matrix-sdk-ui's `SpaceService` (joined spaces + the parent/child graph) and `SpaceRoomList` (the server's `/hierarchy`,
//! which also describes children I have NOT joined: name, topic, member count).
//! Alanlar (`m.space` odaları): üst düzey liste, bir alanın çocukları ve bir çocuğa katılma.
//! matrix-sdk-ui'nin `SpaceService`i (katıldığım alanlar + ebeveyn/çocuk grafiği) ve `SpaceRoomList`i (sunucunun `/hierarchy`si;
//! katılmadığım çocukları da anlatır: ad, konu, üye sayısı) üzerine kuruludur.

use std::sync::Arc;

use matrix_sdk::{
    ruma::{room::RoomType, OwnedServerName, RoomId, RoomOrAliasId, ServerName},
    Client, RoomState,
};
use matrix_sdk_ui::spaces::{room_list::SpaceRoomListPaginationState, SpaceRoom, SpaceService};
use tauri::State;

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::odalar::bas_harf,
    tipler::{AlanIcerigi, AlanOgesi},
};

/// The service is created once per session (it keeps a graph that follows room updates in the background).
/// Servis oturum başına bir kez kurulur (arka planda oda güncellemelerini izleyen bir grafik tutar).
async fn servis(durum: &AppState, client: &Client) -> Arc<SpaceService> {
    let mut kilit = durum.alan_servisi.lock().await;
    if let Some(s) = kilit.as_ref() {
        return s.clone();
    }
    let s = Arc::new(SpaceService::new(client.clone()).await);
    *kilit = Some(s.clone());
    s
}

fn alan_ogesi(s: &SpaceRoom) -> AlanOgesi {
    let ad = s.display_name.clone();
    AlanOgesi {
        id: s.room_id.to_string(),
        avatar_harf: bas_harf(&ad),
        ad,
        avatar_mxc: s.avatar_url.as_ref().map(|a| a.to_string()),
        konu: s.topic.clone().filter(|t| !t.trim().is_empty()),
        uye_sayisi: s.num_joined_members,
        alan: matches!(s.room_type, Some(RoomType::Space)),
        alt_sayisi: s.children_count,
        katildi: s.state == Some(RoomState::Joined),
        dm: s.is_direct.unwrap_or(false),
        onerilen: s.suggested,
        via: s.via.iter().map(|v| v.to_string()).collect(),
    }
}

/// The spaces I am in that are not inside another joined space (nested ones are reached through their parent).
/// İçinde olduğum ve başka bir katılmış alanın içinde olmayan alanlar (iç içe olanlara ebeveynleri üzerinden ulaşılır).
#[tauri::command]
pub async fn alanlari_al(durum: State<'_, AppState>) -> Sonuc<Vec<AlanOgesi>> {
    let client = durum.client().await?;
    let servis = servis(&durum, &client).await;
    Ok(servis.top_level_joined_spaces().await.iter().map(alan_ogesi).collect())
}

/// One space and its direct children (joined or not), in the order the space defines. Needs the network (`/hierarchy`).
/// Bir alan ve doğrudan çocukları (katılmış ya da katılmamış), alanın belirlediği sırayla. Ağ ister (`/hierarchy`).
#[tauri::command]
pub async fn alan_icerigi(durum: State<'_, AppState>, alan_id: String) -> Sonuc<AlanIcerigi> {
    let client = durum.client().await?;
    let id = RoomId::parse(&alan_id)?;
    let servis = servis(&durum, &client).await;
    let liste = servis.space_room_list(id).await;
    // The server pages the hierarchy; ten pages cover any realistic space. · Sunucu hiyerarşiyi sayfalar; on sayfa gerçekçi her alanı kapsar.
    for _ in 0..10 {
        liste.paginate().await?;
        if matches!(liste.pagination_state(), SpaceRoomListPaginationState::Idle { end_reached: true }) {
            break;
        }
    }
    let cocuklar = liste.rooms().await.iter().filter(|r| r.is_direct != Some(true)).map(alan_ogesi).collect();
    Ok(AlanIcerigi { alan: liste.space().map(|s| alan_ogesi(&s)), cocuklar })
}

/// Joins a room (or sub-space) by id or alias, asking the `via` servers named by the space. Returns the joined room id.
/// Bir odaya (ya da alt alana) kimlik ya da takma adla katılır; alanın belirttiği `via` sunucularına sorar. Katılınan oda kimliğini döndürür.
#[tauri::command]
pub async fn alana_katil(durum: State<'_, AppState>, kimlik: String, via: Vec<String>) -> Sonuc<String> {
    let client = durum.client().await?;
    let hedef = RoomOrAliasId::parse(&kimlik).map_err(|e| Hata::Diger(e.to_string()))?;
    let sunucular: Vec<OwnedServerName> = via.iter().filter_map(|v| ServerName::parse(v).ok()).collect();
    let oda = client.join_room_by_id_or_alias(&hedef, &sunucular).await?;
    Ok(oda.room_id().to_string())
}
