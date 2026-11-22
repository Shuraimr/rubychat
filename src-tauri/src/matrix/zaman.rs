//! Room timeline: open, stream to the UI, paginate backwards, send, mark as read.
//! Oda zaman çizelgesi: aç, arayüze akıt, geriye sayfala, gönder, okundu işaretle.
//!
//! Simplest robust approach: on every diff batch we apply the diffs to our own copy of the item list and then send the
//! WHOLE mapped list to the UI. Rooms are small enough for this; if it ever gets slow, switch to sending the diffs.
//! En basit sağlam yaklaşım: her değişiklik grubunda farkları kendi liste kopyamıza uygular, sonra eşlenmiş
//! TÜM listeyi arayüze yollarız. Odalar buna yetecek kadar küçük; yavaşlarsa farkları göndermeye geçilir.

use std::sync::Arc;

use eyeball_im::Vector;
use futures_util::StreamExt;
use matrix_sdk::{
    ruma::{
        api::client::receipt::create_receipt::v3::ReceiptType,
        events::{
            room::message::{MessageType, RoomMessageEventContent},
            AnyMessageLikeEventContent,
        },
        RoomId,
    },
    Client,
};
use matrix_sdk_ui::timeline::{
    EventSendState, EventTimelineItem, MsgLikeKind, RoomExt, TimelineDetails, TimelineItem, TimelineItemContent,
    VirtualTimelineItem,
};
use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;

use crate::{
    durum::{AcikZaman, AppState},
    hata::{Hata, Sonuc},
    matrix::odalar::{bas_harf, oda_adi},
    tipler::{AramaSatiri, AramaSonucu, GonderimDurumu, MedyaIlerleme, OdaBilgisi, ZamanGuncelleme, ZamanOgesi, ZamanTuru},
};

pub const OLAY_ZAMAN: &str = "zaman-guncellendi";

fn gonderen_adi(o: &EventTimelineItem) -> String {
    if let TimelineDetails::Ready(profil) = o.sender_profile() {
        if let Some(ad) = profil.display_name.as_ref().filter(|a| !a.is_empty()) {
            return ad.clone();
        }
    }
    // "@ayse:example.org" → "ayse"
    o.sender().localpart().to_owned()
}

/// Maps one SDK timeline item to what the UI needs. `None` = not shown (read marker, membership changes, ...).
/// Bir SDK zaman çizelgesi öğesini arayüzün ihtiyacına eşler. `None` = gösterilmez (okundu işareti, üyelik değişiklikleri...).
fn sanal_oge(id: String, zaman: u64, tur: ZamanTuru) -> ZamanOgesi {
    ZamanOgesi {
        id,
        gonderen: String::new(),
        gonderen_ad: String::new(),
        kendi: false,
        zaman,
        tur,
        metin: None,
        durum: GonderimDurumu::Gonderildi,
        gonderen_avatar_mxc: None,
        arama: None,
        medya: None,
    }
}

/// Outcome of the call behind an `m.call.invite` item, from what the call handlers recorded.
/// Bir `m.call.invite` öğesinin ardındaki aramanın sonucu; arama işleyicilerinin kaydettiklerinden.
fn arama_satiri(app: &AppHandle, o: &EventTimelineItem) -> AramaSatiri {
    let arama_id = o
        .original_json()
        .and_then(|r| r.get_field::<serde_json::Value>("content").ok().flatten())
        .and_then(|c| c.get("call_id").and_then(|i| i.as_str()).map(str::to_owned));
    let kayit = arama_id.and_then(|id| app.state::<AppState>().arama_gecmisi.lock().ok().and_then(|m| m.get(&id).cloned()));
    let Some(k) = kayit else { return AramaSatiri { sonuc: AramaSonucu::Bilinmiyor, sure_sn: None } };
    if let Some(cevap) = k.cevap_ms {
        let sure = k.bitis_ms.map(|b| b.saturating_sub(cevap) / 1000);
        return AramaSatiri { sonuc: AramaSonucu::Yapildi, sure_sn: sure };
    }
    if k.reddedildi {
        return AramaSatiri { sonuc: AramaSonucu::Reddedildi, sure_sn: None };
    }
    if k.bitis_ms.is_some() {
        return AramaSatiri { sonuc: AramaSonucu::Cevapsiz, sure_sn: None };
    }
    AramaSatiri { sonuc: AramaSonucu::Bilinmiyor, sure_sn: None }
}

fn esle(app: &AppHandle, oge: &TimelineItem) -> Option<ZamanOgesi> {
    let id = oge.unique_id().0.clone();
    if let Some(sanal) = oge.as_virtual() {
        return match sanal {
            VirtualTimelineItem::DateDivider(ts) => Some(sanal_oge(id, ts.0.into(), ZamanTuru::TarihAyirici)),
            VirtualTimelineItem::ReadMarker => Some(sanal_oge(id, 0, ZamanTuru::OkunmamisAyirici)),
            _ => None,
        };
    }
    let o = oge.as_event()?;
    let mut arama = None;
    let mut medya = None;
    let (tur, metin) = match o.content() {
        TimelineItemContent::CallInvite => {
            arama = Some(arama_satiri(app, o));
            (ZamanTuru::Arama, None)
        }
        TimelineItemContent::MsgLike(m) => match &m.kind {
            MsgLikeKind::Message(mesaj) => match mesaj.msgtype() {
                // Image / video / file / audio: the UI draws `medya`; `metin` is only the caption.
                // Resim / video / dosya / ses: arayüz `medya`yı çizer; `metin` yalnızca açıklamadır.
                t @ (MessageType::Image(_) | MessageType::Video(_) | MessageType::File(_) | MessageType::Audio(_)) => {
                    let ilerleme = match o.send_state() {
                        Some(EventSendState::NotSentYet { progress: Some(p) }) => {
                            Some(MedyaIlerleme { gecerli: p.progress.current as u64, toplam: p.progress.total as u64 })
                        }
                        _ => None,
                    };
                    match crate::matrix::medya::esle(app, t, ilerleme) {
                        Some((zt, aciklama, bilgi)) => {
                            medya = Some(bilgi);
                            (zt, aciklama)
                        }
                        None => (ZamanTuru::Diger, Some(mesaj.body().to_owned())),
                    }
                }
                MessageType::Text(_) | MessageType::Notice(_) | MessageType::Emote(_) => {
                    (ZamanTuru::Metin, Some(mesaj.body().to_owned()))
                }
                _ => (ZamanTuru::Diger, Some(mesaj.body().to_owned())),
            },
            MsgLikeKind::UnableToDecrypt(_) => (ZamanTuru::SifreCozulemedi, None),
            _ => (ZamanTuru::Diger, None),
        },
        // Membership / state changes are noise for now. · Üyelik / durum değişiklikleri şimdilik gürültü.
        _ => return None,
    };
    let durum = match o.send_state() {
        Some(EventSendState::NotSentYet { .. }) => GonderimDurumu::Gonderiliyor,
        Some(EventSendState::SendingFailed { .. }) => GonderimDurumu::Hata,
        Some(EventSendState::Sent { .. }) | None => GonderimDurumu::Gonderildi,
    };
    Some(ZamanOgesi {
        id,
        gonderen: o.sender().to_string(),
        gonderen_ad: gonderen_adi(o),
        kendi: o.is_own(),
        zaman: o.timestamp().0.into(),
        tur,
        metin,
        durum,
        gonderen_avatar_mxc: match o.sender_profile() {
            TimelineDetails::Ready(p) => p.avatar_url.as_ref().map(|a| a.to_string()),
            _ => None,
        },
        arama,
        medya,
    })
}

fn yayinla(app: &AppHandle, oda_id: &str, ogeler: &Vector<Arc<TimelineItem>>, ek_basa_ulasildi: bool) {
    let basa = ek_basa_ulasildi || ogeler.iter().any(|o| matches!(o.as_virtual(), Some(VirtualTimelineItem::TimelineStart)));
    let liste = ogeler.iter().filter_map(|o| esle(app, o)).collect();
    let _ = app.emit(OLAY_ZAMAN, ZamanGuncelleme { oda_id: oda_id.to_owned(), ogeler: liste, basa_ulasildi: basa });
}

/// Opens (or re-uses) the room's timeline and starts forwarding updates.
/// Odanın zaman çizelgesini açar (ya da var olanı kullanır) ve güncellemeleri iletmeye başlar.
pub async fn ac(app: AppHandle, durum: &AppState, client: &Client, oda_id: &str) -> Sonuc<OdaBilgisi> {
    let id = RoomId::parse(oda_id)?;
    let room = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    let ad = oda_adi(&room);
    let bilgi = OdaBilgisi {
        id: oda_id.to_owned(),
        avatar_harf: bas_harf(&ad),
        ad,
        sifreli: room.encryption_state().is_encrypted(),
        uye_sayisi: room.joined_members_count(),
        avatar_mxc: crate::matrix::odalar::avatar_mxc(&room, room.is_direct().await.unwrap_or(false)).await,
        karsi_kullanici: crate::matrix::odalar::karsi_kullanici(&room).await,
    };

    let mut acik = durum.zamanlar.lock().await;
    if let Some(onceki) = acik.remove(&id) {
        onceki.gorev.abort();
    }

    let zaman = Arc::new(room.timeline().await?);
    let (baslangic, mut akis) = zaman.subscribe().await;

    let (app2, oda_id2, zaman2) = (app.clone(), oda_id.to_owned(), zaman.clone());
    let gorev = tokio::spawn(async move {
        let mut liste = baslangic;
        yayinla(&app2, &oda_id2, &liste, false);
        // Load one page of history up front so a fresh room is not empty / nearly empty.
        // Yeni açılan oda boş kalmasın diye en baştan bir sayfa geçmiş yükle.
        if liste.len() < 20 {
            match zaman2.paginate_backwards(30).await {
                Ok(basa) => {
                    if basa {
                        yayinla(&app2, &oda_id2, &liste, true);
                    }
                }
                Err(e) => warn!("ilk geri sayfalama başarısız: {e}"),
            }
        }
        let uyandir = app2.state::<AppState>().arama_degisti.clone();
        loop {
            tokio::select! {
                farklar = akis.next() => {
                    let Some(farklar) = farklar else { break };
                    for f in farklar {
                        f.apply(&mut liste);
                    }
                }
                // A call outcome arrived: re-map so the call line updates. · Arama sonucu geldi: satır güncellensin diye yeniden eşle.
                _ = uyandir.notified() => {}
            }
            yayinla(&app2, &oda_id2, &liste, false);
        }
    });
    acik.insert(id, AcikZaman { zaman, gorev });
    Ok(bilgi)
}

pub async fn kapat(durum: &AppState, oda_id: &str) -> Sonuc<()> {
    let id = RoomId::parse(oda_id)?;
    if let Some(a) = durum.zamanlar.lock().await.remove(&id) {
        a.gorev.abort();
    }
    Ok(())
}

/// Closes every open timeline (used on logout). · Açık bütün zaman çizelgelerini kapatır (çıkışta kullanılır).
pub async fn hepsini_kapat(durum: &AppState) {
    for (_, a) in durum.zamanlar.lock().await.drain() {
        a.gorev.abort();
    }
}

async fn zaman_bul(durum: &AppState, oda_id: &str) -> Sonuc<Arc<matrix_sdk_ui::Timeline>> {
    let id = RoomId::parse(oda_id)?;
    durum.zamanlar.lock().await.get(&id).map(|a| a.zaman.clone()).ok_or(Hata::OdaBulunamadi)
}

/// Loads older messages. Results arrive through the normal diff stream; we also push an explicit update so the UI
/// can stop its "loading" spinner even when no new item appeared (start of history).
/// Eski mesajları yükler. Sonuç normal fark akışıyla gelir; ayrıca açıkça güncelleme göndeririz ki yeni öğe
/// gelmese bile (geçmişin başı) arayüz "yükleniyor" göstergesini kapatabilsin.
pub async fn geri_sayfala(app: AppHandle, durum: &AppState, oda_id: &str) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    let basa = zaman.paginate_backwards(30).await?;
    let (ogeler, _) = zaman.subscribe().await;
    yayinla(&app, oda_id, &ogeler, basa);
    Ok(())
}

/// Sends plain text. The SDK encrypts automatically in encrypted rooms and shows a local echo in the timeline.
/// Düz metin gönderir. Şifreli odalarda SDK kendiliğinden şifreler ve zaman çizelgesinde yerel yankı gösterir.
pub async fn mesaj_gonder(durum: &AppState, oda_id: &str, metin: &str) -> Sonuc<()> {
    let metin = metin.trim();
    if metin.is_empty() {
        return Ok(());
    }
    let zaman = zaman_bul(durum, oda_id).await?;
    zaman.send(AnyMessageLikeEventContent::RoomMessage(RoomMessageEventContent::text_plain(metin))).await?;
    Ok(())
}

pub async fn okundu_isaretle(durum: &AppState, oda_id: &str) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    zaman.mark_as_read(ReceiptType::Read).await?;
    // Also move the fully-read marker so the "new messages" divider is gone next time; failure is harmless.
    // Okundu işaretini de ilerlet ki sonraki açılışta "yeni mesajlar" ayırıcısı çıkmasın; hata zararsız.
    let _ = zaman.mark_as_read(ReceiptType::FullyRead).await;
    Ok(())
}

/// Retries a message that failed to send: re-enables the room's send queue and un-wedges the local echo.
/// Gönderilemeyen mesajı yeniden dener: odanın gönderim kuyruğunu açar ve yerel yankıyı serbest bırakır.
pub async fn yeniden_dene(client: &Client, durum: &AppState, oda_id: &str, oge_id: &str) -> Sonuc<()> {
    let id = RoomId::parse(oda_id)?;
    let room = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    room.send_queue().set_enabled(true);
    let zaman = zaman_bul(durum, oda_id).await?;
    for oge in zaman.items().await.iter() {
        if oge.unique_id().0 == oge_id {
            if let Some(sh) = oge.as_event().and_then(|e| e.local_echo_send_handle()) {
                let _ = sh.unwedge().await;
            }
        }
    }
    Ok(())
}
