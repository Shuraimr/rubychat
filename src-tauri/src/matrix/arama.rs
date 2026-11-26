//! 1:1 voice calls, Matrix VoIP v1 (`m.call.*`). The media itself runs in the webview (WebRTC); this file only
//! (a) fetches TURN credentials, (b) sends call events, (c) forwards incoming call events to the UI.
//! 1:1 sesli arama, Matrix VoIP v1 (`m.call.*`). Medyanın kendisi webview'de (WebRTC) çalışır; bu dosya yalnızca
//! (a) TURN bilgisini alır, (b) arama olaylarını gönderir, (c) gelen arama olaylarını arayüze iletir.
//!
//! Handlers receive already-decrypted events, so calls work in encrypted DMs too.
//! İşleyiciler çözülmüş olayları alır; bu yüzden şifreli DM'lerde de arama çalışır.
//! Only VoIP version 1 (with `party_id`) is forwarded; version-0 invites from very old clients are ignored.
//! Yalnızca VoIP sürüm 1 (`party_id`li) iletilir; çok eski istemcilerin sürüm-0 davetleri yok sayılır.

use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use matrix_sdk::{
    ruma::{
        api::client::voip::get_turn_server_info::v3::Request as TurnIstegi,
        events::call::{
            answer::{CallAnswerEventContent, OriginalSyncCallAnswerEvent},
            candidates::{Candidate, CallCandidatesEventContent, OriginalSyncCallCandidatesEvent},
            hangup::{CallHangupEventContent, OriginalSyncCallHangupEvent, Reason},
            invite::{CallInviteEventContent, OriginalSyncCallInviteEvent},
            reject::{CallRejectEventContent, OriginalSyncCallRejectEvent},
            select_answer::{CallSelectAnswerEventContent, OriginalSyncCallSelectAnswerEvent},
            SessionDescription,
        },
        OwnedUserId, OwnedVoipId, RoomId, UInt, VoipVersionId,
    },
    Client, Room,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    durum::{AppState, TurnOnbellek},
    hata::{Hata, Sonuc},
    tipler::{AramaAday, AramaGonderIstegi, AramaOlayTuru, AramaOlayi, TurnSunucu},
};

pub const OLAY_ARAMA: &str = "arama-olayi";

pub(crate) fn simdi_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Updates the call history map and wakes timelines. · Arama geçmişini günceller ve zaman çizelgelerini uyandırır.
fn kayit_guncelle(app: &AppHandle, arama_id: &str, f: impl FnOnce(&mut crate::durum::AramaKaydi)) {
    let durum = app.state::<AppState>();
    if let Ok(mut m) = durum.arama_gecmisi.lock() {
        f(m.entry(arama_id.to_owned()).or_default());
    }
    durum.arama_degisti.notify_waiters();
}

fn yayinla(app: &AppHandle, client: &Client, room: &Room, gonderen: &OwnedUserId, zaman: u64, olay: impl FnOnce(&mut AramaOlayi)) {
    let mut o = AramaOlayi {
        oda_id: room.room_id().to_string(),
        gonderen: gonderen.to_string(),
        kendi: client.user_id().map(|u| u == gonderen).unwrap_or(false),
        zaman,
        tur: AramaOlayTuru::Kapat,
        arama_id: String::new(),
        taraf_id: None,
        sdp: None,
        omur_ms: None,
        adaylar: vec![],
        secilen_taraf_id: None,
        neden: None,
    };
    olay(&mut o);
    let _ = app.emit(OLAY_ARAMA, o);
}

/// Registers handlers for every call event type on the client. Call once per logged-in client.
/// İstemcide her arama olayı türü için işleyici kaydeder. Giriş yapmış istemci başına bir kez çağır.
pub fn kaydet(app: AppHandle, client: &Client) {
    let a = app.clone();
    client.add_event_handler(move |ev: OriginalSyncCallInviteEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            if ev.content.version != VoipVersionId::V1 {
                return;
            }
            let zaman: u64 = ev.origin_server_ts.0.into();
            let omur: u64 = ev.content.lifetime.into();
            // Stale invite: the ring time is over, do not ring. · Bayat davet: çalma süresi geçti, çaldırma.
            if simdi_ms().saturating_sub(zaman) > omur {
                return;
            }
            yayinla(&app, &client, &room, &ev.sender, zaman, |o| {
                o.tur = AramaOlayTuru::Davet;
                o.arama_id = ev.content.call_id.to_string();
                o.taraf_id = ev.content.party_id.as_ref().map(|p| p.to_string());
                o.sdp = Some(ev.content.offer.sdp.clone());
                o.omur_ms = Some(omur);
            });
        }
    });
    let a = app.clone();
    client.add_event_handler(move |ev: OriginalSyncCallCandidatesEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            if ev.content.version != VoipVersionId::V1 {
                return;
            }
            let adaylar = ev
                .content
                .candidates
                .iter()
                .map(|c| AramaAday {
                    candidate: c.candidate.clone(),
                    sdp_mid: c.sdp_mid.clone(),
                    sdp_m_line_index: c.sdp_m_line_index.map(|u| u64::from(u) as u32),
                })
                .collect();
            yayinla(&app, &client, &room, &ev.sender, ev.origin_server_ts.0.into(), |o| {
                o.tur = AramaOlayTuru::Adaylar;
                o.arama_id = ev.content.call_id.to_string();
                o.taraf_id = ev.content.party_id.as_ref().map(|p| p.to_string());
                o.adaylar = adaylar;
            });
        }
    });
    let a = app.clone();
    client.add_event_handler(move |ev: OriginalSyncCallAnswerEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            if ev.content.version != VoipVersionId::V1 {
                return;
            }
            let zaman: u64 = ev.origin_server_ts.0.into();
            let id = ev.content.call_id.to_string();
            kayit_guncelle(&app, &id, |k| k.cevap_ms = Some(zaman));
            yayinla(&app, &client, &room, &ev.sender, zaman, |o| {
                o.tur = AramaOlayTuru::Cevap;
                o.arama_id = id;
                o.taraf_id = ev.content.party_id.as_ref().map(|p| p.to_string());
                o.sdp = Some(ev.content.answer.sdp.clone());
            });
        }
    });
    let a = app.clone();
    client.add_event_handler(move |ev: OriginalSyncCallSelectAnswerEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            yayinla(&app, &client, &room, &ev.sender, ev.origin_server_ts.0.into(), |o| {
                o.tur = AramaOlayTuru::CevapSec;
                o.arama_id = ev.content.call_id.to_string();
                o.taraf_id = Some(ev.content.party_id.to_string());
                o.secilen_taraf_id = Some(ev.content.selected_party_id.to_string());
            });
        }
    });
    let a = app.clone();
    client.add_event_handler(move |ev: OriginalSyncCallRejectEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            let id = ev.content.call_id.to_string();
            kayit_guncelle(&app, &id, |k| k.reddedildi = true);
            yayinla(&app, &client, &room, &ev.sender, ev.origin_server_ts.0.into(), |o| {
                o.tur = AramaOlayTuru::Red;
                o.arama_id = id;
                o.taraf_id = Some(ev.content.party_id.to_string());
            });
        }
    });
    let a = app;
    client.add_event_handler(move |ev: OriginalSyncCallHangupEvent, room: Room, client: Client| {
        let app = a.clone();
        async move {
            let zaman: u64 = ev.origin_server_ts.0.into();
            let id = ev.content.call_id.to_string();
            kayit_guncelle(&app, &id, |k| k.bitis_ms = Some(zaman));
            yayinla(&app, &client, &room, &ev.sender, zaman, |o| {
                o.tur = AramaOlayTuru::Kapat;
                o.arama_id = id;
                o.taraf_id = ev.content.party_id.as_ref().map(|p| p.to_string());
                o.neden = Some(ev.content.reason.to_string());
            });
        }
    });
}

/// TURN servers from the homeserver, cached until shortly before the TTL ends.
/// Anasunucudan TURN sunucuları; TTL bitmeden kısa süre öncesine kadar önbellekte tutulur.
pub async fn turn_sunuculari(durum: &AppState, client: &Client) -> Sonuc<Vec<TurnSunucu>> {
    // Release the cache lock BEFORE the network call so a slow TURN request can never block logout or account switch.
    // Ağ çağrısından ÖNCE önbellek kilidini bırak; yavaş bir TURN isteği çıkış ya da hesap değişimini asla kilitlemesin.
    {
        let onbellek = durum.turn.lock().await;
        if let Some(o) = onbellek.as_ref() {
            if o.gecerli_son > Instant::now() {
                return Ok(o.sunucular.clone());
            }
        }
    }
    let yanit = client.send(TurnIstegi::new()).await?;
    let sunucular = vec![TurnSunucu { urls: yanit.uris, username: yanit.username, credential: yanit.password }];
    // Refresh a minute early so a call never starts with credentials about to expire.
    // Bir dakika erken yenile; arama bitmek üzere olan bir bilgiyle başlamasın.
    let omur = yanit.ttl.saturating_sub(Duration::from_secs(60));
    // Only cache if the same account is still active (never leak credentials across an account switch).
    // Yalnızca aynı hesap hâlâ etkinse önbelleğe al (hesap değişiminde bilgiler sızmasın).
    let ayni_hesap = durum.oturum.read().await.as_ref().is_some_and(|o| o.client.user_id() == client.user_id());
    if ayni_hesap {
        *durum.turn.lock().await = Some(TurnOnbellek { sunucular: sunucular.clone(), gecerli_son: Instant::now() + omur });
    }
    Ok(sunucular)
}

fn voip_id(s: &str) -> Sonuc<OwnedVoipId> {
    Ok(OwnedVoipId::from(s))
}

/// Sends one call event into the room. `istek.tur` picks which one.
/// Odaya bir arama olayı gönderir. Hangisi olduğunu `istek.tur` seçer.
pub async fn gonder(client: &Client, istek: AramaGonderIstegi) -> Sonuc<()> {
    let oda_id = RoomId::parse(&istek.oda_id)?;
    let room = client.get_room(&oda_id).ok_or(Hata::OdaBulunamadi)?;
    let arama = voip_id(&istek.arama_id)?;
    let taraf = voip_id(&istek.taraf_id)?;
    let sdp = |tur: &str| SessionDescription::new(tur.to_owned(), istek.sdp.clone().unwrap_or_default());
    match istek.tur.as_str() {
        "davet" => {
            let omur = UInt::try_from(istek.omur_ms.unwrap_or(60_000)).unwrap_or(UInt::from(60_000u32));
            let mut icerik = CallInviteEventContent::version_1(arama, taraf, omur, sdp("offer"));
            // Address the call to the only other member so other clients ring only them.
            // Aramayı tek öbür üyeye yönelt; diğer istemciler yalnızca onu çaldırsın.
            if let Some(k) = super::odalar::karsi_kullanici(&room).await {
                icerik.invitee = OwnedUserId::try_from(k).ok();
            }
            room.send(icerik).await?;
        }
        "adaylar" => {
            let liste = istek
                .adaylar
                .iter()
                .map(|a| {
                    let mut c = Candidate::new(a.candidate.clone());
                    c.sdp_mid = a.sdp_mid.clone();
                    c.sdp_m_line_index = a.sdp_m_line_index.map(UInt::from);
                    c
                })
                .collect();
            room.send(CallCandidatesEventContent::version_1(arama, taraf, liste)).await?;
        }
        "cevap" => {
            room.send(CallAnswerEventContent::version_1(sdp("answer"), arama, taraf)).await?;
        }
        "cevap_sec" => {
            let secilen = voip_id(istek.secilen_taraf_id.as_deref().unwrap_or_default())?;
            room.send(CallSelectAnswerEventContent::version_1(arama, taraf, secilen)).await?;
        }
        "red" => {
            room.send(CallRejectEventContent::version_1(arama, taraf)).await?;
        }
        "kapat" => {
            let neden = Reason::from(istek.neden.as_deref().unwrap_or("user_hangup"));
            room.send(CallHangupEventContent::version_1(arama, taraf, neden)).await?;
        }
        _ => return Err(Hata::Diger("bilinmeyen arama olayı".into())),
    }
    Ok(())
}
