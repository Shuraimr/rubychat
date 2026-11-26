//! Managing a space and room settings: create a room/sub-space inside a space, add existing rooms, mark one as suggested,
//! take one out of the space, and read/write the common settings (name, topic, avatar, who can join, directory listing,
//! announcement mode). A space is just a room, so the same settings commands serve rooms and spaces.
//! Alan ve oda ayarlarının yönetimi: alanın içinde oda/alt alan oluşturma, var olan odaları ekleme, birini öne çıkarma,
//! alandan çıkarma ve ortak ayarları (ad, konu, avatar, kim katılabilir, dizinde listeleme, duyuru kipi) okuma/yazma.
//! Alan da bir odadır; bu yüzden aynı ayar komutları hem odalara hem alanlara hizmet eder.
//!
//! Spec: a space lists its children with `m.space.child` state events (state key = child room id, content `{via}`; empty
//! content = removed). The child may point back with `m.space.parent`. "Space members can join" is the `restricted` join rule
//! with an allow rule for the space's membership.
//! Belirtim: alan çocuklarını `m.space.child` durum olaylarıyla listeler (durum anahtarı = çocuk oda kimliği, içerik `{via}`;
//! boş içerik = kaldırıldı). Çocuk `m.space.parent` ile geri işaret edebilir. "Alan üyeleri katılabilir" = alanın üyeliğine izin
//! veren `restricted` katılma kuralı.

use matrix_sdk::{
    room::power_levels::RoomPowerLevelChanges,
    ruma::{
        api::client::room::{create_room::v3 as olustur, Visibility},
        events::{
            room::{
                encryption::RoomEncryptionEventContent,
                join_rules::RoomJoinRulesEventContent,
            },
            space::{child::SpaceChildEventContent, parent::SpaceParentEventContent},
            InitialStateEvent, StateEventType,
        },
        room::{AllowRule, JoinRule, Restricted, RoomType},
        serde::Raw,
        OwnedRoomId, OwnedServerName, RoomId,
    },
    Client, Room, RoomState,
};
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
    matrix::odalar::bas_harf,
};

/// What I may do in a space (drives whether the action row and long-press menu appear).
/// Bir alanda neler yapabileceğim (eylem satırının ve uzun bas menüsünün görünüp görünmeyeceğini belirler).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlanYetkim {
    /// Can add/remove/suggest children (send `m.space.child`) · Çocuk ekleyip çıkarabilir, öne çıkarabilir
    pub cocuk_yonetebilir: bool,
    /// Can change name/topic/avatar/join rule · Ad/konu/avatar/katılma kuralını değiştirebilir
    pub ayar_degistirebilir: bool,
    /// Can invite people · Kişi davet edebilir
    pub davet_edebilir: bool,
}

/// A joined room offered in "Add existing rooms" · "Var olan odayı ekle"de sunulan katılınmış oda
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EklenebilirOda {
    pub id: String,
    pub ad: String,
    pub avatar_harf: String,
    pub avatar_mxc: Option<String>,
    pub uye_sayisi: u64,
    pub sifreli: bool,
    pub alan: bool,
    /// I can write `m.space.parent` in it (otherwise it is listed but disabled: adding someone else's room is impolite)
    /// İçine `m.space.parent` yazabilirim (yoksa listelenir ama seçilemez: başkasının odasını eklemek kaba olur)
    pub yetkili: bool,
}

/// Settings shown on the room/space settings screen · Oda/alan ayarları ekranında gösterilen ayarlar
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OdaAyarlari {
    pub ad: String,
    pub konu: String,
    pub avatar_mxc: Option<String>,
    pub adres: Option<String>,
    /// "acik" | "alan" | "davet" | "istek" | "diger"
    pub katilim: String,
    /// The space whose members may join (when katilim = "alan") · Üyeleri katılabilen alan (katilim = "alan" ise)
    pub katilim_alani: Option<String>,
    pub dizinde: bool,
    /// Only moderators can post (events_default > users_default) · Yalnızca yöneticiler yazabilir
    pub duyuru: bool,
    pub sifreli: bool,
    pub alan: bool,
    pub ad_degistirebilir: bool,
    pub konu_degistirebilir: bool,
    pub avatar_degistirebilir: bool,
    pub katilim_degistirebilir: bool,
    pub guc_degistirebilir: bool,
}

fn oda_bul(client: &Client, oda_id: &str) -> Sonuc<Room> {
    let id = RoomId::parse(oda_id).map_err(|_| Hata::OdaBulunamadi)?;
    client.get_room(&id).ok_or(Hata::OdaBulunamadi)
}

fn mx(e: impl std::fmt::Display) -> Hata {
    Hata::Matrix(e.to_string())
}

/// Servers to route joins through: mine first (I am in the room, so my server can always reach it).
/// Katılmaları yönlendirecek sunucular: önce benimki (odadayım, sunucum ona her zaman ulaşır).
fn via_listesi(client: &Client) -> Vec<OwnedServerName> {
    client.user_id().map(|u| vec![u.server_name().to_owned()]).unwrap_or_default()
}

async fn yazabilir(oda: &Room, tur: StateEventType) -> bool {
    match oda.power_levels().await {
        Ok(pl) => pl.user_can_send_state(oda.own_user_id(), tur),
        Err(_) => false,
    }
}

fn katilma_kurali(katilim: &str, alan_id: Option<&RoomId>) -> Sonuc<JoinRule> {
    Ok(match katilim {
        "acik" => JoinRule::Public,
        "davet" => JoinRule::Invite,
        "istek" => JoinRule::Knock,
        "alan" => {
            let alan = alan_id.ok_or_else(|| Hata::Diger("alan kimliği gerekli".into()))?;
            JoinRule::Restricted(Restricted::new(vec![AllowRule::room_membership(alan.to_owned())]))
        }
        _ => return Err(Hata::Diger("bilinmeyen katılma kuralı".into())),
    })
}

/// My permissions in a space · Bir alandaki yetkilerim
#[tauri::command]
pub async fn alan_yetkim(durum: State<'_, AppState>, alan_id: String) -> Sonuc<AlanYetkim> {
    let client = durum.client().await?;
    // Not joined (only previewed): no management at all · Katılmamış (yalnızca önizleme): yönetim yok
    let Ok(alan) = oda_bul(&client, &alan_id) else {
        return Ok(AlanYetkim { cocuk_yonetebilir: false, ayar_degistirebilir: false, davet_edebilir: false });
    };
    if alan.state() != RoomState::Joined {
        return Ok(AlanYetkim { cocuk_yonetebilir: false, ayar_degistirebilir: false, davet_edebilir: false });
    }
    let pl = alan.power_levels().await.map_err(mx)?;
    let ben = alan.own_user_id();
    Ok(AlanYetkim {
        cocuk_yonetebilir: pl.user_can_send_state(ben, StateEventType::SpaceChild),
        ayar_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomName),
        davet_edebilir: pl.user_can_invite(ben),
    })
}

/// Creates a room (or sub-space) and links it into the space in both directions.
/// `katilim`: "alan" (space members, default) | "acik" (public, listed in the directory) | "davet" (invite only).
/// `duyuru`: only moderators can post (power level 50 to send messages) — the "Release notes" room is made this way.
/// Bir oda (ya da alt alan) oluşturur ve alana iki yönde bağlar.
/// `katilim`: "alan" (alan üyeleri, varsayılan) | "acik" (herkese açık, dizinde) | "davet" (yalnızca davetle).
/// `duyuru`: yalnızca yöneticiler yazar (mesaj göndermek için güç 50) — "Güncelleme notları" odası böyle kurulur.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn alanda_oda_olustur(
    durum: State<'_, AppState>,
    alan_id: String,
    ad: String,
    konu: Option<String>,
    katilim: String,
    duyuru: bool,
    sifreli: bool,
    alt_alan: bool,
) -> Sonuc<String> {
    let ad = ad.trim().to_owned();
    if ad.is_empty() || ad.chars().count() > 255 {
        return Err(Hata::Diger("oda adı boş ya da çok uzun".into()));
    }
    let client = durum.client().await?;
    let alan = oda_bul(&client, &alan_id)?;
    // Check first so we never leave an orphan room behind · Önce denetle; ortada sahipsiz oda kalmasın
    if !yazabilir(&alan, StateEventType::SpaceChild).await {
        return Err(Hata::Diger("bu alana oda ekleme yetkin yok".into()));
    }
    let via = via_listesi(&client);
    let alan_kimlik: OwnedRoomId = alan.room_id().to_owned();

    let mut istek = olustur::Request::new();
    istek.name = Some(ad);
    istek.topic = konu.map(|k| k.trim().to_owned()).filter(|k| !k.is_empty());
    istek.preset = Some(if katilim == "acik" { olustur::RoomPreset::PublicChat } else { olustur::RoomPreset::PrivateChat });
    if katilim == "acik" {
        istek.visibility = Visibility::Public;
    }
    if alt_alan {
        let mut icerik = olustur::CreationContent::new();
        icerik.room_type = Some(RoomType::Space);
        istek.creation_content = Some(Raw::new(&icerik).map_err(mx)?);
    }
    // Everything that defines the room goes into the creation request, so it never exists half-configured
    // (e.g. unencrypted, or joinable by anyone for a moment).
    // Odayı tanımlayan her şey oluşturma isteğinde; oda hiçbir an yarım ayarlı (ör. şifresiz ya da bir an herkese açık) var olmaz.
    let mut ilk = vec![
        InitialStateEvent::new(alan_kimlik.clone(), {
            let mut p = SpaceParentEventContent::new(via.clone());
            p.canonical = true;
            p
        })
        .to_raw_any(),
        InitialStateEvent::with_empty_state_key(RoomJoinRulesEventContent::new(katilma_kurali(&katilim, Some(&alan_kimlik))?)).to_raw_any(),
    ];
    if sifreli && !alt_alan {
        ilk.push(InitialStateEvent::with_empty_state_key(RoomEncryptionEventContent::with_recommended_defaults()).to_raw_any());
    }
    istek.initial_state = ilk;
    if duyuru && !alt_alan {
        let pl = serde_json::json!({ "events_default": 50 });
        istek.power_level_content_override = Some(Raw::from_json(serde_json::value::to_raw_value(&pl).map_err(mx)?));
    }

    let oda = client.create_room(istek).await.map_err(mx)?;
    let mut cocuk = SpaceChildEventContent::new(via);
    cocuk.suggested = duyuru;
    alan.send_state_event_for_key(oda.room_id(), cocuk).await.map_err(mx)?;
    Ok(oda.room_id().to_string())
}

/// Joined rooms that can be added to the space (not DMs, not the space itself, not already its children).
/// Alana eklenebilecek katılınmış odalar (DM değil, alanın kendisi değil, zaten çocuğu değil).
#[tauri::command]
pub async fn eklenebilir_odalar(durum: State<'_, AppState>, alan_id: String) -> Sonuc<Vec<EklenebilirOda>> {
    let client = durum.client().await?;
    let alan = oda_bul(&client, &alan_id)?;
    let mut mevcut = std::collections::HashSet::new();
    if let Ok(olaylar) = alan.get_state_events(StateEventType::SpaceChild).await {
        for o in olaylar {
            let ham = match &o {
                matrix_sdk::deserialized_responses::RawAnySyncOrStrippedState::Sync(r) => r.json().get(),
                matrix_sdk::deserialized_responses::RawAnySyncOrStrippedState::Stripped(r) => r.json().get(),
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(ham) else { continue };
            // An emptied child event (no via) means "removed" · Boşaltılmış çocuk olayı (via yok) "çıkarıldı" demektir
            let dolu = v.pointer("/content/via").and_then(|x| x.as_array()).is_some_and(|a| !a.is_empty());
            if let (true, Some(k)) = (dolu, v.get("state_key").and_then(|k| k.as_str())) {
                mevcut.insert(k.to_owned());
            }
        }
    }
    let mut sonuc = Vec::new();
    for oda in client.joined_rooms() {
        if oda.room_id() == alan.room_id() || mevcut.contains(oda.room_id().as_str()) {
            continue;
        }
        if oda.is_direct().await.unwrap_or(false) {
            continue;
        }
        let ad = oda.display_name().await.map(|d| d.to_string()).unwrap_or_else(|_| oda.room_id().to_string());
        sonuc.push(EklenebilirOda {
            id: oda.room_id().to_string(),
            avatar_harf: bas_harf(&ad),
            ad,
            avatar_mxc: oda.avatar_url().map(|a| a.to_string()),
            uye_sayisi: oda.joined_members_count(),
            sifreli: oda.encryption_state().is_encrypted(),
            alan: oda.is_space(),
            yetkili: yazabilir(&oda, StateEventType::SpaceParent).await,
        });
    }
    // Rooms I can add first, then by name · Önce ekleyebildiklerim, sonra ada göre
    sonuc.sort_by(|a, b| b.yetkili.cmp(&a.yetkili).then_with(|| a.ad.to_lowercase().cmp(&b.ad.to_lowercase())));
    Ok(sonuc)
}

/// Adds existing rooms to the space; also writes the parent link into each room I administer. Returns how many were added.
/// Var olan odaları alana ekler; yönettiğim her odaya ebeveyn bağını da yazar. Kaç tanesinin eklendiğini döndürür.
#[tauri::command]
pub async fn alana_oda_ekle(durum: State<'_, AppState>, alan_id: String, oda_idler: Vec<String>) -> Sonuc<u32> {
    let client = durum.client().await?;
    let alan = oda_bul(&client, &alan_id)?;
    if !yazabilir(&alan, StateEventType::SpaceChild).await {
        return Err(Hata::Diger("bu alana oda ekleme yetkin yok".into()));
    }
    let via = via_listesi(&client);
    let mut eklenen = 0;
    for id in oda_idler.iter().take(50) {
        let oda = oda_bul(&client, id)?;
        alan.send_state_event_for_key(oda.room_id(), SpaceChildEventContent::new(via.clone())).await.map_err(mx)?;
        eklenen += 1;
        if yazabilir(&oda, StateEventType::SpaceParent).await {
            // Best effort: the child link alone is enough for the space to list it · En iyi çaba: alanın listelemesi için çocuk bağı yeter
            let _ = oda.send_state_event_for_key(alan.room_id(), SpaceParentEventContent::new(via.clone())).await;
        }
    }
    Ok(eklenen)
}

/// Takes a room out of the space (the room itself is not deleted). · Odayı alandan çıkarır (odanın kendisi silinmez).
#[tauri::command]
pub async fn alandan_cikar(durum: State<'_, AppState>, alan_id: String, oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    let alan = oda_bul(&client, &alan_id)?;
    let hedef = RoomId::parse(&oda_id).map_err(|_| Hata::OdaBulunamadi)?;
    // Empty content is how the spec removes a child · Belirtimde çocuk boş içerikle kaldırılır
    alan.send_state_event_raw("m.space.child", hedef.as_str(), serde_json::json!({})).await.map_err(mx)?;
    if let Some(oda) = client.get_room(&hedef) {
        if oda.state() == RoomState::Joined && yazabilir(&oda, StateEventType::SpaceParent).await {
            let _ = oda.send_state_event_raw("m.space.parent", alan.room_id().as_str(), serde_json::json!({})).await;
        }
    }
    Ok(())
}

/// Marks a child as suggested ("Featured") or not, keeping its via/order. · Bir çocuğu öne çıkarır ya da geri alır; via/sırasını korur.
#[tauri::command]
pub async fn alan_one_cikar(durum: State<'_, AppState>, alan_id: String, oda_id: String, onerilen: bool) -> Sonuc<()> {
    let client = durum.client().await?;
    let alan = oda_bul(&client, &alan_id)?;
    let hedef = RoomId::parse(&oda_id).map_err(|_| Hata::OdaBulunamadi)?;
    // Read the current child event as JSON (works for joined and invited spaces alike) to keep its via/order.
    // Var olan çocuk olayını JSON olarak oku (katılmış ve davetli alanlarda aynı çalışır); via/sırası korunsun.
    let mut icerik = alan
        .get_state_event_static_for_key::<SpaceChildEventContent, _>(&hedef)
        .await
        .ok()
        .flatten()
        .and_then(|r| {
            let ham = match &r {
                matrix_sdk::deserialized_responses::RawSyncOrStrippedState::Sync(x) => x.json().get().to_owned(),
                matrix_sdk::deserialized_responses::RawSyncOrStrippedState::Stripped(x) => x.json().get().to_owned(),
            };
            let v: serde_json::Value = serde_json::from_str(&ham).ok()?;
            serde_json::from_value::<SpaceChildEventContent>(v.get("content")?.clone()).ok()
        })
        .unwrap_or_else(|| SpaceChildEventContent::new(via_listesi(&client)));
    if icerik.via.is_empty() {
        icerik.via = via_listesi(&client);
    }
    icerik.suggested = onerilen;
    alan.send_state_event_for_key(&hedef, icerik).await.map_err(mx)?;
    Ok(())
}

/// Current settings of a room or space plus what I may change. · Bir odanın ya da alanın ayarları ve neleri değiştirebileceğim.
#[tauri::command]
pub async fn oda_ayarlari(durum: State<'_, AppState>, oda_id: String) -> Sonuc<OdaAyarlari> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let pl = oda.power_levels().await.map_err(mx)?;
    let ben = oda.own_user_id();
    let (katilim, katilim_alani) = match oda.join_rule() {
        Some(JoinRule::Public) => ("acik", None),
        Some(JoinRule::Invite) | None => ("davet", None),
        Some(JoinRule::Knock) => ("istek", None),
        Some(JoinRule::Restricted(r)) | Some(JoinRule::KnockRestricted(r)) => (
            "alan",
            r.allow.iter().find_map(|a| match a {
                AllowRule::RoomMembership(m) => Some(m.room_id.to_string()),
                _ => None,
            }),
        ),
        Some(_) => ("diger", None),
    };
    let dizinde = matches!(oda.privacy_settings().get_room_visibility().await, Ok(Visibility::Public));
    let ad = oda.name().unwrap_or_default();
    Ok(OdaAyarlari {
        ad,
        konu: oda.topic().unwrap_or_default(),
        avatar_mxc: oda.avatar_url().map(|a| a.to_string()),
        adres: oda.canonical_alias().map(|a| a.to_string()),
        katilim: katilim.into(),
        katilim_alani,
        dizinde,
        duyuru: i64::from(pl.events_default) > i64::from(pl.users_default),
        sifreli: oda.encryption_state().is_encrypted(),
        alan: oda.is_space(),
        ad_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomName),
        konu_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomTopic),
        avatar_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomAvatar),
        katilim_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomJoinRules),
        guc_degistirebilir: pl.user_can_send_state(ben, StateEventType::RoomPowerLevels),
    })
}

/// Writes only the settings that are given (`None` = leave as is). `katilim_alani` is needed for katilim = "alan".
/// Yalnızca verilen ayarları yazar (`None` = olduğu gibi bırak). katilim = "alan" için `katilim_alani` gerekir.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn oda_ayarlarini_yaz(
    durum: State<'_, AppState>,
    oda_id: String,
    ad: Option<String>,
    konu: Option<String>,
    katilim: Option<String>,
    katilim_alani: Option<String>,
    dizinde: Option<bool>,
    duyuru: Option<bool>,
    sifrele: Option<bool>,
) -> Sonuc<()> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    if let Some(ad) = ad {
        let ad = ad.trim().to_owned();
        if ad.is_empty() || ad.chars().count() > 255 {
            return Err(Hata::Diger("ad boş ya da çok uzun".into()));
        }
        if oda.name().as_deref() != Some(ad.as_str()) {
            oda.set_name(ad).await.map_err(mx)?;
        }
    }
    if let Some(konu) = konu {
        let konu = konu.trim();
        if oda.topic().as_deref().unwrap_or("") != konu {
            oda.set_room_topic(konu).await.map_err(mx)?;
        }
    }
    if let Some(k) = katilim {
        let alan = katilim_alani.as_deref().map(RoomId::parse).transpose().map_err(|_| Hata::OdaBulunamadi)?;
        oda.privacy_settings().update_join_rule(katilma_kurali(&k, alan.as_deref())?).await.map_err(mx)?;
    }
    if let Some(d) = dizinde {
        oda.privacy_settings().update_room_visibility(if d { Visibility::Public } else { Visibility::Private }).await.map_err(mx)?;
    }
    if let Some(d) = duyuru {
        let pl = oda.power_levels().await.map_err(mx)?;
        let hedef = if d { 50 } else { i64::from(pl.users_default) };
        oda.apply_power_level_changes(RoomPowerLevelChanges { events_default: Some(hedef), ..Default::default() }).await.map_err(mx)?;
    }
    // Encryption can only be turned on, never off (spec) · Şifreleme yalnızca açılabilir, kapatılamaz (belirtim)
    if sifrele == Some(true) && !oda.encryption_state().is_encrypted() {
        oda.enable_encryption().await.map_err(mx)?;
    }
    Ok(())
}

/// Sets a room/space avatar from a temporary picked file (same flow as the profile avatar). Returns the mxc URI.
/// Seçilmiş geçici dosyadan oda/alan avatarı koyar (profil avatarıyla aynı akış). mxc adresini döndürür.
#[tauri::command]
pub async fn oda_avatar_ayarla(app: AppHandle, durum: State<'_, AppState>, oda_id: String, kimlik: String, mime: String) -> Sonuc<String> {
    let client = durum.client().await?;
    let oda = oda_bul(&client, &oda_id)?;
    let mime = crate::matrix::profil::mime_coz(&mime)?;
    let veri = crate::matrix::profil::gecici_oku(&app, &kimlik).await?;
    let yanit = client.media().upload(&mime, veri, None).await.map_err(mx)?;
    let mut icerik = matrix_sdk::ruma::events::room::avatar::RoomAvatarEventContent::new();
    icerik.url = Some(yanit.content_uri.clone());
    oda.send_state_event(icerik).await.map_err(mx)?;
    Ok(yanit.content_uri.to_string())
}

/// Removes a room/space avatar · Oda/alan avatarını kaldırır
#[tauri::command]
pub async fn oda_avatar_kaldir(durum: State<'_, AppState>, oda_id: String) -> Sonuc<()> {
    let client = durum.client().await?;
    oda_bul(&client, &oda_id)?.remove_avatar().await.map_err(mx)?;
    Ok(())
}
