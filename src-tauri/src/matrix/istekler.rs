//! Invitations and join requests ("knock"): what waits for me, what I asked for, and who asks to enter my rooms.
//! Davetler ve katılma istekleri ("knock"): beni bekleyenler, benim istediklerim ve odalarıma girmek isteyenler.

use matrix_sdk::{
    ruma::{OwnedServerName, RoomId, RoomOrAliasId, ServerName, UserId},
    Room, RoomMemberships, RoomState,
};
use tauri::State;

use super::odalar::{avatar_mxc, bas_harf, oda_adi};
use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    tipler::{DavetOgesi, IstekOdasi, Istekler, KisiBilgisi, OdaIstekleri},
};

fn oda_bul(client: &matrix_sdk::Client, oda_id: &str) -> Sonuc<Room> {
    let id = RoomId::parse(oda_id).map_err(|_| Hata::OdaBulunamadi)?;
    client.get_room(&id).ok_or(Hata::OdaBulunamadi)
}

async fn oda_ozeti(room: &Room, dm: bool) -> IstekOdasi {
    let ad = oda_adi(room);
    IstekOdasi {
        id: room.room_id().to_string(),
        avatar_harf: bas_harf(&ad),
        avatar_mxc: avatar_mxc(room, dm).await,
        ad,
        konu: room.topic().filter(|k| !k.trim().is_empty()),
        uye_sayisi: room.joined_members_count(),
        alan: room.is_space(),
        sifreli: room.encryption_state().is_encrypted(),
        dm,
    }
}

fn kisi(m: &matrix_sdk::room::RoomMember) -> KisiBilgisi {
    KisiBilgisi { id: m.user_id().to_string(), ad: m.name().to_owned(), avatar_mxc: m.avatar_url().map(|a| a.to_string()) }
}

/// People knocking on this room, when I may answer them. Local data only. · Yanıtlayabildiğim bir odanın kapısını çalanlar. Yalnızca yerel veri.
async fn kapidakiler(room: &Room) -> Vec<KisiBilgisi> {
    let Ok(uyeler) = room.members_no_sync(RoomMemberships::KNOCK).await else { return Vec::new() };
    if uyeler.is_empty() {
        return Vec::new();
    }
    let Ok(pl) = room.power_levels().await else { return Vec::new() };
    if !pl.user_can_invite(room.own_user_id()) {
        return Vec::new();
    }
    uyeler.iter().map(kisi).collect()
}

#[tauri::command]
pub async fn istekleri_al(durum: State<'_, AppState>) -> Sonuc<Istekler> {
    let client = durum.client().await?;
    let mut sonuc = Istekler::default();
    for room in client.rooms() {
        match room.state() {
            RoomState::Invited => {
                let dm = room.is_direct().await.unwrap_or(false);
                let davet = room.invite_details().await.ok();
                let davet_eden = davet.map(|d| match &d.inviter {
                    Some(m) => kisi(m),
                    None => KisiBilgisi { ad: d.inviter_id.localpart().to_owned(), id: d.inviter_id.to_string(), avatar_mxc: None },
                });
                sonuc.gelen.push(DavetOgesi { oda: oda_ozeti(&room, dm).await, davet_eden });
            }
            RoomState::Knocked => sonuc.giden.push(oda_ozeti(&room, false).await),
            RoomState::Joined => {
                let kisiler = kapidakiler(&room).await;
                if !kisiler.is_empty() {
                    sonuc.odalar.push(OdaIstekleri { oda: oda_ozeti(&room, false).await, kisiler });
                }
            }
            _ => {}
        }
    }
    Ok(sonuc)
}

#[tauri::command]
pub async fn davet_kabul(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    Ok(oda_bul(&client, &oda_id)?.join().await?)
}

/// Declines an invitation or takes back my own join request. · Daveti reddeder ya da kendi katılma isteğimi geri çeker.
#[tauri::command]
pub async fn davet_reddet(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    Ok(oda_bul(&client, &oda_id)?.leave().await?)
}

/// Asks to join a room I cannot enter directly. · Doğrudan giremediğim bir odaya katılma isteği gönderir.
#[tauri::command]
pub async fn katilma_istegi(durum: State<'_, AppState>, kimlik: String, via: Vec<String>, sebep: Option<String>) -> Sonuc<()> {
    let client = durum.client().await?;
    let hedef = RoomOrAliasId::parse(&kimlik).map_err(|e| Hata::Diger(e.to_string()))?;
    let sunucular: Vec<OwnedServerName> = via.iter().filter_map(|v| ServerName::parse(v).ok()).collect();
    let sebep = sebep.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty());
    client.knock(hedef, sebep, sunucular).await?;
    Ok(())
}

/// Lets a knocking person in (an invitation) or turns them away. · Kapıyı çalan kişiyi içeri alır (davet) ya da geri çevirir.
#[tauri::command]
pub async fn katilma_yanitla(durum: State<'_, AppState>, oda_id: String, kullanici_id: String, kabul: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let kim = UserId::parse(&kullanici_id).map_err(|e| Hata::Diger(e.to_string()))?;
    if kabul {
        oda.invite_user_by_id(&kim).await?;
    } else {
        oda.kick_user(&kim, None).await?;
    }
    Ok(())
}

/// The language of the native texts (previews, notifications). · Yerel metinlerin (önizlemeler, bildirimler) dili.
#[tauri::command]
pub fn dil_ayarla(en: bool) {
    crate::dil::ayarla(en);
}
