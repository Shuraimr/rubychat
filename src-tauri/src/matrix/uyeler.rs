//! Room members: list, invite, kick, ban / unban (optionally deleting the last 24 hours of the person's messages) and power levels.
//! The UI hides what the user may not do, but the server is the real judge: we also check here so the error is clear.
//! Oda üyeleri: listele, davet et, çıkar, yasakla / yasağı kaldır (isteğe bağlı kişinin son 24 saatteki mesajlarını silerek) ve yetki düzeyleri.
//! Arayüz yetkisiz olanı gizler ama gerçek hakem sunucudur: hata net olsun diye burada da denetleriz.

use matrix_sdk::{
    room::MessagesOptions,
    ruma::{
        events::{
            room::power_levels::UserPowerLevel,
            StateEventType,
        },
        Int, MilliSecondsSinceUnixEpoch, RoomId, UInt, UserId,
    },
    Client, Room, RoomMemberships,
};
use tauri::State;

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    tipler::{BenimYetkilerim, Uye},
};

/// A room creator on room version 12+ has "infinite" power; the UI only needs a number bigger than any real level.
/// Oda sürümü 12+'da oda kurucusunun gücü "sonsuz"dur; arayüzün gerçek düzeylerden büyük bir sayıya ihtiyacı var.
fn guc_sayisi(p: UserPowerLevel) -> i64 {
    match p {
        UserPowerLevel::Infinite => 1000,
        UserPowerLevel::Int(i) => i64::from(i),
        _ => 0,
    }
}

fn oda_bul(client: &Client, oda_id: &str) -> Sonuc<Room> {
    let id = RoomId::parse(oda_id)?;
    client.get_room(&id).ok_or(Hata::OdaBulunamadi)
}

fn kullanici(kullanici_id: &str) -> Sonuc<matrix_sdk::ruma::OwnedUserId> {
    UserId::parse(kullanici_id).map_err(|e| Hata::Diger(e.to_string()))
}

fn sebep_temizle(sebep: &Option<String>) -> Option<String> {
    sebep.as_ref().map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// Joined, invited and banned members with their power levels. · Katılmış, davetli ve yasaklı üyeler ve yetki düzeyleri.
#[tauri::command]
pub async fn uyeleri_listele(durum: State<'_, AppState>, oda_id: String) -> Sonuc<Vec<Uye>> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    // `members` loads the full list from the server when lazy loading left it incomplete. · `members`, tembel yükleme eksik bıraktıysa tam listeyi sunucudan alır.
    let uyeler = oda
        .members(RoomMemberships::JOIN | RoomMemberships::INVITE | RoomMemberships::BAN)
        .await
        .map_err(|e| Hata::Matrix(e.to_string()))?;
    let mut sonuc = Vec::with_capacity(uyeler.len());
    for m in uyeler {
        let uyelik = match m.membership() {
            matrix_sdk::ruma::events::room::member::MembershipState::Join => "join",
            matrix_sdk::ruma::events::room::member::MembershipState::Invite => "invite",
            matrix_sdk::ruma::events::room::member::MembershipState::Ban => "ban",
            _ => "leave",
        };
        let id = m.user_id().to_string();
        let ad = m
            .display_name()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_owned())
            .unwrap_or_else(|| id.trim_start_matches('@').split(':').next().unwrap_or("").to_owned());
        sonuc.push(Uye {
            kullanici_id: id,
            ad,
            avatar_mxc: m.avatar_url().map(|a| a.to_string()),
            guc: guc_sayisi(m.power_level()),
            uyelik: uyelik.to_owned(),
        });
    }
    Ok(sonuc)
}

/// What I may do in this room (the UI hides the rest). · Bu odada neler yapabilirim (arayüz gerisini gizler).
#[tauri::command]
pub async fn benim_yetkilerim(durum: State<'_, AppState>, oda_id: String) -> Sonuc<BenimYetkilerim> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let pl = oda.power_levels().await.map_err(|e| Hata::Matrix(e.to_string()))?;
    let ben = oda.own_user_id();
    let guc_esigi = i64::from(pl.for_state(StateEventType::RoomPowerLevels));
    Ok(BenimYetkilerim {
        guc: guc_sayisi(pl.for_user(ben)),
        atma_esigi: i64::from(pl.kick),
        yasaklama_esigi: i64::from(pl.ban),
        davet_esigi: i64::from(pl.invite),
        yazma_esigi: i64::from(pl.events_default),
        guc_esigi,
        atabilir: pl.user_can_kick(ben),
        yasaklayabilir: pl.user_can_ban(ben),
        davet_edebilir: pl.user_can_invite(ben),
        guc_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomPowerLevels),
        odayi_bildirebilir: pl.user_can_trigger_room_notification(ben),
    })
}

#[tauri::command]
pub async fn uye_davet_et(durum: State<'_, AppState>, oda_id: String, kullanici_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let hedef = kullanici(&kullanici_id)?;
    oda.invite_user_by_id(&hedef).await.map_err(|e| Hata::Matrix(e.to_string()))
}

#[tauri::command]
pub async fn uye_cikar(durum: State<'_, AppState>, oda_id: String, kullanici_id: String, sebep: Option<String>) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let hedef = kullanici(&kullanici_id)?;
    let pl = oda.power_levels().await.map_err(|e| Hata::Matrix(e.to_string()))?;
    if !pl.user_can_kick_user(oda.own_user_id(), &hedef) {
        return Err(Hata::Diger("bu kişiyi çıkarma yetkin yok".into()));
    }
    let sebep = sebep_temizle(&sebep);
    oda.kick_user(&hedef, sebep.as_deref()).await.map_err(|e| Hata::Matrix(e.to_string()))
}

/// Ban the person; with `mesajlari_sil` also redact their messages from the last 24 hours (up to 5 pages of 100 events).
/// Returns how many messages were deleted. A failed deletion never undoes the ban.
/// Kişiyi yasakla; `mesajlari_sil` ile son 24 saatteki mesajlarını da sil (en çok 5 sayfa x 100 olay). Silinen mesaj sayısını döndürür.
/// Silme başarısız olursa yasak geri alınmaz.
#[tauri::command]
pub async fn uye_yasakla(
    durum: State<'_, AppState>,
    oda_id: String,
    kullanici_id: String,
    sebep: Option<String>,
    mesajlari_sil: bool,
) -> Sonuc<u32> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let hedef = kullanici(&kullanici_id)?;
    let pl = oda.power_levels().await.map_err(|e| Hata::Matrix(e.to_string()))?;
    if !pl.user_can_ban_user(oda.own_user_id(), &hedef) {
        return Err(Hata::Diger("bu kişiyi yasaklama yetkin yok".into()));
    }
    let sebep = sebep_temizle(&sebep);
    oda.ban_user(&hedef, sebep.as_deref()).await.map_err(|e| Hata::Matrix(e.to_string()))?;

    let mut silinen = 0u32;
    if mesajlari_sil && pl.user_can_redact_event_of_other(oda.own_user_id()) {
        let simdi = u64::from(MilliSecondsSinceUnixEpoch::now().0);
        let sinir = simdi.saturating_sub(24 * 60 * 60 * 1000);
        let mut belirtec: Option<String> = None;
        'sayfalar: for _ in 0..5 {
            let mut secenek = MessagesOptions::backward();
            secenek.limit = UInt::from(100u32);
            secenek.from = belirtec.clone();
            let Ok(sayfa) = oda.messages(secenek).await else { break };
            if sayfa.chunk.is_empty() {
                break;
            }
            for olay in &sayfa.chunk {
                let Some(zaman) = olay.timestamp() else { continue };
                if u64::from(zaman.0) < sinir {
                    break 'sayfalar; // older than 24 h: the rest is older still · 24 saatten eski: kalanı daha da eski
                }
                if olay.sender().as_deref() != Some(&*hedef) {
                    continue;
                }
                let Some(id) = olay.event_id() else { continue };
                if oda.redact(id, Some("yasaklandı"), None).await.is_ok() {
                    silinen += 1;
                }
            }
            belirtec = sayfa.end;
            if belirtec.is_none() {
                break;
            }
        }
    }
    Ok(silinen)
}

#[tauri::command]
pub async fn yasak_kaldir(durum: State<'_, AppState>, oda_id: String, kullanici_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let hedef = kullanici(&kullanici_id)?;
    oda.unban_user(&hedef, None).await.map_err(|e| Hata::Matrix(e.to_string()))
}

/// Set a member's power level (100 admin, 50 moderator, 0 member, or any number). 
/// Bir üyenin yetki düzeyini ayarla (100 yönetici, 50 moderatör, 0 üye ya da herhangi bir sayı).
#[tauri::command]
pub async fn guc_ayarla(durum: State<'_, AppState>, oda_id: String, kullanici_id: String, guc: i64) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let hedef = kullanici(&kullanici_id)?;
    let seviye = Int::new(guc).ok_or_else(|| Hata::Diger("geçersiz yetki düzeyi".into()))?;
    let pl = oda.power_levels().await.map_err(|e| Hata::Matrix(e.to_string()))?;
    if !pl.user_can_change_user_power_level(oda.own_user_id(), &hedef) {
        return Err(Hata::Diger("bu kişinin yetkisini değiştirme yetkin yok".into()));
    }
    oda.update_power_levels(vec![(&*hedef, seviye)]).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    Ok(())
}

/// The DM room with this person: the existing one, or a new encrypted DM. Returns the room id so the UI can open it.
/// Bu kişiyle DM odası: varsa mevcut, yoksa yeni şifreli DM. Arayüz açabilsin diye oda kimliğini döndürür.
#[tauri::command]
pub async fn dm_ac(durum: State<'_, AppState>, kullanici_id: String) -> Sonuc<String> {
    let client = durum.client().await?;
    let hedef = kullanici(&kullanici_id)?;
    if let Some(oda) = client.get_dm_room(&hedef) {
        return Ok(oda.room_id().to_string());
    }
    let oda = client.create_dm(&hedef).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    Ok(oda.room_id().to_string())
}

/// Create a private room (encrypted group) or a space, invite-only. Returns the new room id.
/// Özel bir oda (şifreli grup) ya da alan oluştur; yalnızca davetle. Yeni oda kimliğini döndürür.
#[tauri::command]
pub async fn oda_olustur(durum: State<'_, AppState>, ad: String, alan: bool) -> Sonuc<String> {
    use matrix_sdk::ruma::{api::client::room::create_room::v3 as olustur, room::RoomType, serde::Raw};
    let ad = ad.trim().to_owned();
    if ad.is_empty() {
        return Err(Hata::Diger("oda adı boş".into()));
    }
    let client = durum.client().await?;
    let mut istek = olustur::Request::new();
    istek.name = Some(ad);
    istek.preset = Some(olustur::RoomPreset::PrivateChat);
    if alan {
        let mut icerik = olustur::CreationContent::new();
        icerik.room_type = Some(RoomType::Space);
        istek.creation_content = Some(Raw::new(&icerik).map_err(|e| Hata::Diger(e.to_string()))?);
    }
    let oda = client.create_room(istek).await.map_err(|e| Hata::Matrix(e.to_string()))?;
    if !alan {
        oda.enable_encryption().await.map_err(|e| Hata::Matrix(e.to_string()))?;
    }
    Ok(oda.room_id().to_string())
}

/// Leave the room (and forget the list entry once the server confirms). · Odadan ayrıl.
#[tauri::command]
pub async fn oda_ayril(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    oda.leave().await.map_err(|e| Hata::Matrix(e.to_string()))
}
