//! Room timeline: open, stream to the UI, paginate backwards, send, mark as read.
//! Oda zaman çizelgesi: aç, arayüze akıt, geriye sayfala, gönder, okundu işaretle.
//!
//! Simplest robust approach: on every diff batch we apply the diffs to our own copy of the item list and then send the
//! WHOLE mapped list to the UI. Rooms are small enough for this; if it ever gets slow, switch to sending the diffs.
//! En basit sağlam yaklaşım: her değişiklik grubunda farkları kendi liste kopyamıza uygular, sonra eşlenmiş
//! TÜM listeyi arayüze yollarız. Odalar buna yetecek kadar küçük; yavaşlarsa farkları göndermeye geçilir.

use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use eyeball_im::Vector;
use futures_util::StreamExt;
use matrix_sdk::{
    room::edit::EditedContent,
    ruma::{
        api::client::receipt::create_receipt::v3::ReceiptType,
        events::{
            poll::{
                start::PollKind,
                unstable_end::UnstablePollEndEventContent,
                unstable_response::UnstablePollResponseEventContent,
                unstable_start::{
                    NewUnstablePollStartEventContent, UnstablePollAnswer, UnstablePollAnswers, UnstablePollStartContentBlock,
                    UnstablePollStartEventContent,
                },
            },
            room::message::{MessageFormat, MessageType, RoomMessageEventContent, RoomMessageEventContentWithoutRelation},
            AnyMessageLikeEventContent, StateEventType,
        },
        EventId, OwnedUserId, RoomId, UInt, UserId,
    },
    Client, Room,
};
use matrix_sdk_ui::timeline::{
    EventSendState, EventTimelineItem, InReplyToDetails, MsgLikeContent, MsgLikeKind, PollResult, RoomExt, TimelineDetails,
    TimelineEventItemId, TimelineItem, TimelineItemContent, VirtualTimelineItem,
};
use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;

use crate::{
    durum::{AcikZaman, AppState},
    hata::{Hata, Sonuc},
    matrix::odalar::{bas_harf, oda_adi},
    tipler::{
        AnketBilgisi, AnketSecenegi, AramaSatiri, AramaSonucu, GonderimDurumu, KisiBilgisi, MedyaIlerleme, MesajGonderIstegi,
        OdaBilgisi, Tepki, YanitBilgisi, YaziyorGuncelleme, ZamanGuncelleme, ZamanOgesi, ZamanTuru,
    },
};

pub const OLAY_ZAMAN: &str = "zaman-guncellendi";
pub const OLAY_YAZIYOR: &str = "yaziyor-guncellendi";

/// Everything `esle` needs besides the item itself, resolved once per publish (async lookups cannot run inside the sync mapper).
/// `esle`nin öğenin kendisi dışında ihtiyaç duyduğu her şey; yayın başına bir kez çözülür (async sorgular eşleyicinin içinde çalışamaz).
struct Baglam {
    ben: OwnedUserId,
    /// Names / avatars of everyone who reacted or has a read receipt · Tepki verenlerin ve okundu bilgisi olanların adı / avatarı
    profiller: HashMap<OwnedUserId, KisiBilgisi>,
    kendini_silebilir: bool,
    baskasini_silebilir: bool,
    sabitleyebilir: bool,
    sabitler: HashSet<String>,
    /// Read receipts are shown only in small rooms (a 500-person room would be noise) · Okundu bilgisi yalnızca küçük odalarda gösterilir (500 kişilik odada gürültü olurdu)
    okuyucu_goster: bool,
}

/// Name + avatar of a member from the local store (no network): display name → localpart.
/// Yerel depodan üyenin adı + avatarı (ağ yok): görünen ad → kullanıcı adı kısmı.
pub async fn kisi_bilgisi(room: &Room, id: &UserId) -> KisiBilgisi {
    let uye = room.get_member_no_sync(id).await.ok().flatten();
    let ad = uye
        .as_ref()
        .and_then(|m| m.display_name().map(str::to_owned))
        .filter(|a| !a.is_empty())
        .unwrap_or_else(|| id.localpart().to_owned());
    KisiBilgisi { id: id.to_string(), ad, avatar_mxc: uye.as_ref().and_then(|m| m.avatar_url().map(|a| a.to_string())) }
}

async fn baglam_kur(room: &Room, ogeler: &Vector<Arc<TimelineItem>>) -> Baglam {
    let ben = room.own_user_id().to_owned();
    // Power levels decide which "Sil" / "Sabitle" actions are offered; the server stays the real judge.
    // Yetki düzeyleri hangi "Sil" / "Sabitle" eylemlerinin sunulacağını belirler; gerçek hakem yine sunucudur.
    let (baskasini, kendini, sabitle) = match room.power_levels().await {
        Ok(pl) => (
            pl.user_can_redact_event_of_other(&ben),
            pl.user_can_redact_own_event(&ben),
            pl.user_can_send_state(&ben, StateEventType::RoomPinnedEvents),
        ),
        Err(_) => (false, true, false),
    };
    let sabitler = room.pinned_event_ids().unwrap_or_default().into_iter().map(|e| e.to_string()).collect();
    let okuyucu_goster = room.joined_members_count() <= 12;

    let mut idler: HashSet<OwnedUserId> = HashSet::new();
    for o in ogeler.iter() {
        let Some(e) = o.as_event() else { continue };
        if okuyucu_goster {
            idler.extend(e.read_receipts().keys().filter(|u| **u != ben).cloned());
        }
        if let Some(m) = e.content().as_msglike() {
            for (_, kimler) in m.reactions.iter() {
                idler.extend(kimler.keys().cloned());
            }
        }
    }
    let mut profiller = HashMap::new();
    for id in idler {
        let k = kisi_bilgisi(room, &id).await;
        profiller.insert(id, k);
    }
    Baglam { ben, profiller, kendini_silebilir: kendini, baskasini_silebilir: baskasini, sabitleyebilir: sabitle, sabitler, okuyucu_goster }
}

fn gonderen_adi(o: &EventTimelineItem) -> String {
    if let TimelineDetails::Ready(profil) = o.sender_profile() {
        if let Some(ad) = profil.display_name.as_ref().filter(|a| !a.is_empty()) {
            return ad.clone();
        }
    }
    // "@ayse:example.org" → "ayse"
    o.sender().localpart().to_owned()
}

/// A date divider / read marker row: no sender, no content, only the new fields at their empty values.
/// Tarih ayırıcı / okundu işareti satırı: gönderen yok, içerik yok; yeni alanlar boş değerlerinde.
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
        olay_id: None,
        html: None,
        duzenlendi: false,
        tepkiler: Vec::new(),
        yanit: None,
        okuyanlar: Vec::new(),
        anket: None,
        silinebilir: false,
        sabit: false,
        duzenlenebilir: false,
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

/// One-line text of a message-like item (reply quote, pinned bar): media get a label, long text is cut.
/// Mesaj benzeri öğenin tek satırlık metni (yanıt alıntısı, sabit çubuğu): medyaya etiket verilir, uzun metin kısaltılır.
pub fn icerik_metni(c: &TimelineItemContent) -> Option<String> {
    let m = c.as_msglike()?;
    let ham = match &m.kind {
        MsgLikeKind::Message(mesaj) => match mesaj.msgtype() {
            MessageType::Image(_) => "Fotoğraf".to_owned(),
            MessageType::Video(_) => "Video".to_owned(),
            MessageType::Audio(_) => "Ses".to_owned(),
            MessageType::File(_) => "Dosya".to_owned(),
            t => t.body().to_owned(),
        },
        MsgLikeKind::Sticker(_) => "Çıkartma".to_owned(),
        MsgLikeKind::Poll(p) => p.results().question,
        _ => return None,
    };
    Some(ham.lines().next().unwrap_or("").chars().take(140).collect())
}

fn yanit_bilgisi(y: &InReplyToDetails) -> YanitBilgisi {
    let olay_id = y.event_id.to_string();
    match &y.event {
        TimelineDetails::Ready(e) => {
            let ad = match &e.sender_profile {
                TimelineDetails::Ready(p) => p.display_name.clone().filter(|a| !a.is_empty()),
                _ => None,
            }
            .unwrap_or_else(|| e.sender.localpart().to_owned());
            YanitBilgisi { olay_id, gonderen: Some(e.sender.to_string()), gonderen_ad: Some(ad), metin: icerik_metni(&e.content), yukleniyor: false }
        }
        // Not fetched yet: the task asks the SDK for it (see `eksik_yanitlari_iste`); the UI shows a placeholder meanwhile.
        // Henüz getirilmedi: görev SDK'dan ister (bkz. `eksik_yanitlari_iste`); arayüz bu arada yer tutucu gösterir.
        TimelineDetails::Unavailable | TimelineDetails::Pending => {
            YanitBilgisi { olay_id, gonderen: None, gonderen_ad: None, metin: None, yukleniyor: true }
        }
        TimelineDetails::Error(_) => YanitBilgisi { olay_id, gonderen: None, gonderen_ad: None, metin: None, yukleniyor: false },
    }
}

fn kisi_yedek(b: &Baglam, id: &UserId) -> KisiBilgisi {
    b.profiller.get(id).cloned().unwrap_or_else(|| KisiBilgisi { id: id.to_string(), ad: id.localpart().to_owned(), avatar_mxc: None })
}

/// Reactions grouped by key (the SDK already aggregates them, one entry per sender). · Anahtara göre gruplu tepkiler (SDK zaten toplar, gönderen başına tek kayıt).
fn tepki_listesi(m: &MsgLikeContent, b: &Baglam) -> Vec<Tepki> {
    m.reactions
        .iter()
        .map(|(anahtar, kimler)| Tepki {
            anahtar: anahtar.clone(),
            sayi: kimler.len() as u32,
            benim: kimler.contains_key(&b.ben),
            kisiler: kimler.keys().map(|u| kisi_yedek(b, u)).collect(),
        })
        .collect()
}

fn anket_bilgisi(r: &PollResult, b: &Baglam, benim: bool) -> AnketBilgisi {
    let secenekler: Vec<AnketSecenegi> = r
        .answers
        .iter()
        .map(|a| {
            let veren = r.votes.get(&a.id);
            AnketSecenegi {
                id: a.id.clone(),
                metin: a.text.clone(),
                oy: veren.map(|v| v.len() as u32).unwrap_or(0),
                benim: veren.is_some_and(|v| v.iter().any(|u| u == b.ben.as_str())),
            }
        })
        .collect();
    AnketBilgisi {
        soru: r.question.clone(),
        toplam_oy: secenekler.iter().map(|s| s.oy).sum(),
        secenekler,
        bitti: r.end_time.is_some(),
        acik: matches!(r.kind, PollKind::Disclosed),
        maks_secim: r.max_selections as u32,
        benim_anketim: benim,
    }
}

/// The HTML body of a text-like message, only when the sender really used the HTML format. · Metin benzeri mesajın HTML gövdesi; yalnızca gönderen gerçekten HTML biçimini kullandıysa.
fn html_govde(t: &MessageType) -> Option<String> {
    let f = match t {
        MessageType::Text(m) => m.formatted.as_ref(),
        MessageType::Notice(m) => m.formatted.as_ref(),
        MessageType::Emote(m) => m.formatted.as_ref(),
        _ => None,
    }?;
    matches!(f.format, MessageFormat::Html).then(|| f.body.clone())
}

fn esle(app: &AppHandle, oge: &TimelineItem, b: &Baglam) -> Option<ZamanOgesi> {
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
    let mut anket = None;
    let mut html = None;
    let mut duzenlendi = false;
    let mut tepkiler = Vec::new();
    let mut yanit = None;
    let (tur, metin) = match o.content() {
        TimelineItemContent::CallInvite => {
            arama = Some(arama_satiri(app, o));
            (ZamanTuru::Arama, None)
        }
        TimelineItemContent::MsgLike(m) => {
            tepkiler = tepki_listesi(m, b);
            yanit = m.in_reply_to.as_ref().map(yanit_bilgisi);
            match &m.kind {
                MsgLikeKind::Message(mesaj) => {
                    duzenlendi = mesaj.is_edited();
                    match mesaj.msgtype() {
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
                        t @ (MessageType::Text(_) | MessageType::Notice(_) | MessageType::Emote(_)) => {
                            html = html_govde(t);
                            (ZamanTuru::Metin, Some(mesaj.body().to_owned()))
                        }
                        _ => (ZamanTuru::Diger, Some(mesaj.body().to_owned())),
                    }
                }
                // A sticker is only an image: no bubble, no text. · Çıkartma yalnızca resimdir: balon yok, metin yok.
                MsgLikeKind::Sticker(s) => {
                    medya = Some(crate::matrix::medya::cikartma_esle(app, s.content()));
                    (ZamanTuru::Cikartma, None)
                }
                MsgLikeKind::Poll(p) => {
                    anket = Some(anket_bilgisi(&p.results(), b, o.is_own()));
                    (ZamanTuru::Anket, None)
                }
                MsgLikeKind::Redacted => (ZamanTuru::Silindi, None),
                MsgLikeKind::UnableToDecrypt(_) => (ZamanTuru::SifreCozulemedi, None),
                _ => (ZamanTuru::Diger, None),
            }
        }
        // Membership / state changes are noise for now. · Üyelik / durum değişiklikleri şimdilik gürültü.
        _ => return None,
    };
    let durum = match o.send_state() {
        Some(EventSendState::NotSentYet { .. }) => GonderimDurumu::Gonderiliyor,
        Some(EventSendState::SendingFailed { .. }) => GonderimDurumu::Hata,
        Some(EventSendState::Sent { .. }) | None => GonderimDurumu::Gonderildi,
    };
    let olay_id = o.event_id().map(|e| e.to_string());
    let silinebilir = olay_id.is_some()
        && !matches!(tur, ZamanTuru::Silindi | ZamanTuru::Arama | ZamanTuru::SifreCozulemedi)
        && if o.is_own() { b.kendini_silebilir } else { b.baskasini_silebilir };
    let okuyanlar = if b.okuyucu_goster {
        o.read_receipts().keys().filter(|u| **u != b.ben).map(|u| kisi_yedek(b, u)).collect()
    } else {
        Vec::new()
    };
    Some(ZamanOgesi {
        id,
        gonderen: o.sender().to_string(),
        gonderen_ad: gonderen_adi(o),
        kendi: o.is_own(),
        zaman: o.timestamp().0.into(),
        duzenlenebilir: tur == ZamanTuru::Metin && olay_id.is_some() && o.is_editable(),
        sabit: olay_id.as_ref().is_some_and(|e| b.sabitler.contains(e)),
        tur,
        metin,
        durum,
        gonderen_avatar_mxc: match o.sender_profile() {
            TimelineDetails::Ready(p) => p.avatar_url.as_ref().map(|a| a.to_string()),
            _ => None,
        },
        arama,
        medya,
        olay_id,
        html,
        duzenlendi,
        tepkiler,
        yanit,
        okuyanlar,
        anket,
        silinebilir,
    })
}

/// Maps the whole item list and emits it. Async because the context (power levels, member names) comes from the store.
/// Bütün öğe listesini eşler ve yayınlar. Async: bağlam (yetki düzeyleri, üye adları) depodan gelir.
async fn yayinla(app: &AppHandle, room: &Room, ogeler: &Vector<Arc<TimelineItem>>, ek_basa_ulasildi: bool) {
    let basa = ek_basa_ulasildi || ogeler.iter().any(|o| matches!(o.as_virtual(), Some(VirtualTimelineItem::TimelineStart)));
    let baglam = baglam_kur(room, ogeler).await;
    let liste = ogeler.iter().filter_map(|o| esle(app, o, &baglam)).collect();
    let mut sabitler: Vec<String> = baglam.sabitler.iter().cloned().collect();
    sabitler.sort();
    let _ = app.emit(
        OLAY_ZAMAN,
        ZamanGuncelleme { oda_id: room.room_id().to_string(), ogeler: liste, basa_ulasildi: basa, sabitler, sabitleyebilir: baglam.sabitleyebilir },
    );
}

/// Asks the SDK for replied-to events it has not loaded (old replies): the answer arrives as a normal diff and re-publishes.
/// SDK'nın yüklemediği yanıtlanan olayları (eski yanıtlar) ister: cevap normal fark olarak gelir ve yeniden yayınlanır.
fn eksik_yanitlari_iste(zaman: &Arc<matrix_sdk_ui::Timeline>, ogeler: &Vector<Arc<TimelineItem>>, istenen: &mut HashSet<String>) {
    for o in ogeler.iter() {
        let Some(e) = o.as_event() else { continue };
        let (Some(id), Some(m)) = (e.event_id(), e.content().as_msglike()) else { continue };
        let Some(y) = &m.in_reply_to else { continue };
        if matches!(y.event, TimelineDetails::Unavailable) && istenen.insert(id.to_string()) {
            let (z, id) = (zaman.clone(), id.to_owned());
            tokio::spawn(async move {
                let _ = z.fetch_details_for_event(&id).await;
            });
        }
    }
}

/// Opens (or re-uses) the room's timeline and starts forwarding updates.
/// Odanın zaman çizelgesini açar (ya da var olanı kullanır) ve güncellemeleri iletmeye başlar.
pub async fn ac(app: AppHandle, durum: &AppState, client: &Client, oda_id: &str) -> Sonuc<OdaBilgisi> {
    let id = RoomId::parse(oda_id)?;
    let room = client.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    // A space has no message timeline (only state events): opening it as a chat used to leave an empty dark screen.
    // The UI routes spaces to the "Alanlar" view; this is the safety net for any other path (notification, link, search).
    // Alanın mesaj çizelgesi yoktur (yalnızca durum olayları): sohbet olarak açmak boş, karanlık bir ekran bırakıyordu.
    // Arayüz alanları "Alanlar" görünümüne yönlendirir; bu, öteki her yol (bildirim, bağlantı, arama) için güvenlik ağıdır.
    if room.is_space() {
        return Err(Hata::OdaTuru);
    }
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
    // Typing notices of the OTHER people arrive on this channel; the guard keeps the event handler alive while the task runs.
    // BAŞKALARININ yazıyor bildirimleri bu kanaldan gelir; koruma, görev çalıştığı sürece olay işleyicisini canlı tutar.
    let (yazan_koruma, mut yazan_rx) = room.subscribe_to_typing_notifications();

    let (app2, oda_id2, zaman2, room2) = (app.clone(), oda_id.to_owned(), zaman.clone(), room.clone());
    let gorev = tokio::spawn(async move {
        let _yazan_koruma = yazan_koruma;
        let mut yazan_kapali = false;
        let mut istenen_yanitlar: HashSet<String> = HashSet::new();
        let mut liste = baslangic;
        yayinla(&app2, &room2, &liste, false).await;
        eksik_yanitlari_iste(&zaman2, &liste, &mut istenen_yanitlar);
        // Load one page of history up front so a fresh room is not empty / nearly empty.
        // Yeni açılan oda boş kalmasın diye en baştan bir sayfa geçmiş yükle.
        if liste.len() < 20 {
            match zaman2.paginate_backwards(30).await {
                Ok(basa) => {
                    if basa {
                        yayinla(&app2, &room2, &liste, true).await;
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
                // Somebody started / stopped typing: tell the UI and leave the timeline alone. · Biri yazmaya başladı / bıraktı: arayüze söyle, çizelgeye dokunma.
                yazanlar = yazan_rx.recv(), if !yazan_kapali => {
                    match yazanlar {
                        Ok(idler) => {
                            let mut kisiler = Vec::with_capacity(idler.len());
                            for k in idler {
                                kisiler.push(kisi_bilgisi(&room2, &k).await);
                            }
                            let _ = app2.emit(OLAY_YAZIYOR, YaziyorGuncelleme { oda_id: oda_id2.clone(), kisiler });
                        }
                        // Lagged = we missed some updates; the next one carries the full list anyway. · Lagged = bazıları kaçtı; sonraki zaten tam listeyi taşır.
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {}
                        Err(_) => yazan_kapali = true,
                    }
                    continue;
                }
            }
            yayinla(&app2, &room2, &liste, false).await;
            eksik_yanitlari_iste(&zaman2, &liste, &mut istenen_yanitlar);
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
    yayinla(&app, zaman.room(), &ogeler, basa).await;
    Ok(())
}

/// How many backward pages `olaya_git` may load while looking for an event, and how many events per page.
/// `olaya_git`in bir olayı ararken yükleyebileceği geri sayfa sayısı ve sayfa başına olay sayısı.
const OLAYA_GIT_SAYFA: usize = 60;
const OLAYA_GIT_SAYFA_BOYU: u16 = 50;

/// Makes sure the live timeline contains `olay_id` (message search "jump to result"): paginates backwards until the event
/// shows up, the start of the room is reached, or the page limit is hit. Returns whether the event is now in the timeline.
/// Chosen over a focused timeline (`TimelineFocus::Event`) because the UI, the diff task and every command here assume ONE
/// live timeline per room; a second, temporary timeline would have touched all of them.
/// Canlı zaman çizelgesinin `olay_id`yi içerdiğinden emin olur (mesaj araması "sonuca atla"): olay görünene, odanın başına
/// ulaşılana ya da sayfa sınırına varılana dek geriye sayfalar. Olay artık çizelgede mi, onu döndürür.
/// Odaklı zaman çizelgesi (`TimelineFocus::Event`) yerine seçildi: arayüz, fark görevi ve buradaki her komut oda başına TEK
/// canlı çizelge varsayar; ikinci geçici çizelge hepsine dokunmayı gerektirirdi.
pub async fn olaya_git(app: AppHandle, durum: &AppState, oda_id: &str, olay_id: &str) -> Sonuc<bool> {
    let zaman = zaman_bul(durum, oda_id).await?;
    let var_mi = |ogeler: &Vector<Arc<TimelineItem>>| ogeler.iter().any(|o| o.as_event().and_then(|e| e.event_id()).is_some_and(|e| e.as_str() == olay_id));
    for _ in 0..OLAYA_GIT_SAYFA {
        let ogeler = zaman.items().await;
        if var_mi(&ogeler) {
            yayinla(&app, zaman.room(), &ogeler, false).await;
            return Ok(true);
        }
        let basa = zaman.paginate_backwards(OLAYA_GIT_SAYFA_BOYU).await?;
        if basa {
            let ogeler = zaman.items().await;
            yayinla(&app, zaman.room(), &ogeler, true).await;
            return Ok(var_mi(&ogeler));
        }
    }
    let ogeler = zaman.items().await;
    yayinla(&app, zaman.room(), &ogeler, false).await;
    Ok(var_mi(&ogeler))
}

/// Builds a text message: with `html` it carries a `formatted_body` (`org.matrix.custom.html`), `metin` is the plain fallback.
/// Metin mesajı kurar: `html` varsa `formatted_body` (`org.matrix.custom.html`) taşır, `metin` düz yedektir.
fn metin_icerigi(metin: &str, html: Option<&str>) -> RoomMessageEventContent {
    match html {
        Some(h) if !h.trim().is_empty() => RoomMessageEventContent::text_html(metin, h),
        _ => RoomMessageEventContent::text_plain(metin),
    }
}

/// The same without a relation (replies and edits add their own relation). · Aynısı ilişkisiz (yanıt ve düzenleme kendi ilişkisini ekler).
fn metin_icerigi_iliskisiz(metin: &str, html: Option<&str>) -> RoomMessageEventContentWithoutRelation {
    match html {
        Some(h) if !h.trim().is_empty() => RoomMessageEventContentWithoutRelation::text_html(metin, h),
        _ => RoomMessageEventContentWithoutRelation::text_plain(metin),
    }
}

/// Sends a text message (plain or HTML), optionally as a reply. The SDK encrypts automatically in encrypted rooms and shows
/// a local echo in the timeline. `send_reply` builds the `m.in_reply_to` relation and mentions the replied-to person.
/// Metin mesajı gönderir (düz ya da HTML), isteğe bağlı yanıt olarak. Şifreli odalarda SDK kendiliğinden şifreler ve çizelgede
/// yerel yankı gösterir. `send_reply`, `m.in_reply_to` ilişkisini kurar ve yanıtlanan kişiyi anar.
pub async fn mesaj_gonder(durum: &AppState, istek: MesajGonderIstegi) -> Sonuc<()> {
    let metin = istek.metin.trim();
    if metin.is_empty() {
        return Ok(());
    }
    let zaman = zaman_bul(durum, &istek.oda_id).await?;
    match istek.yanit_olay_id.as_deref().filter(|y| !y.is_empty()) {
        Some(yanit) => {
            let hedef = EventId::parse(yanit)?;
            zaman.send_reply(metin_icerigi_iliskisiz(metin, istek.html.as_deref()), hedef).await?;
        }
        None => {
            zaman.send(AnyMessageLikeEventContent::RoomMessage(metin_icerigi(metin, istek.html.as_deref()))).await?;
        }
    }
    Ok(())
}

/// Edits one of my text messages (`m.replace`). · Kendi metin mesajlarımdan birini düzenler (`m.replace`).
pub async fn mesaj_duzenle(durum: &AppState, oda_id: &str, olay_id: &str, metin: &str, html: Option<&str>) -> Sonuc<()> {
    let metin = metin.trim();
    if metin.is_empty() {
        return Err(Hata::Diger("boş mesaj".into()));
    }
    let zaman = zaman_bul(durum, oda_id).await?;
    let id = TimelineEventItemId::EventId(EventId::parse(olay_id)?);
    zaman.edit(&id, EditedContent::RoomMessage(metin_icerigi_iliskisiz(metin, html))).await?;
    Ok(())
}

/// Deletes (redacts) a message; the server decides whether my power level allows it. · Mesajı siler (redact); yetkimin yetip yetmediğine sunucu karar verir.
pub async fn mesaj_sil(durum: &AppState, oda_id: &str, olay_id: &str) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    zaman.redact(&TimelineEventItemId::EventId(EventId::parse(olay_id)?), None).await?;
    Ok(())
}

/// Adds my reaction, or removes it if I already reacted with the same key. Returns true when it was added.
/// Tepkimi ekler; aynı anahtarla zaten tepki verdiysem kaldırır. Eklendiyse true döner.
pub async fn tepki_degistir(durum: &AppState, oda_id: &str, olay_id: &str, anahtar: &str) -> Sonuc<bool> {
    let zaman = zaman_bul(durum, oda_id).await?;
    Ok(zaman.toggle_reaction(&TimelineEventItemId::EventId(EventId::parse(olay_id)?), anahtar).await?)
}

/// Re-sends the current item list (after a state change the timeline does not report itself, e.g. pins).
/// Geçerli öğe listesini yeniden yollar (çizelgenin kendiliğinden bildirmediği durum değişikliklerinden sonra, ör. sabitler).
pub async fn yeniden_yayinla(app: AppHandle, durum: &AppState, oda_id: &str) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    let ogeler = zaman.items().await;
    yayinla(&app, zaman.room(), &ogeler, false).await;
    Ok(())
}

/// The open room's timeline, for the other command modules. · Açık odanın çizelgesi; öteki komut modülleri için.
pub async fn acik_zaman(durum: &AppState, oda_id: &str) -> Sonuc<Arc<matrix_sdk_ui::Timeline>> {
    zaman_bul(durum, oda_id).await
}

/// Sends an MSC3381 poll (`org.matrix.msc3381.poll.start`; the SDK's timeline aggregates this form).
/// MSC3381 anketi gönderir (`org.matrix.msc3381.poll.start`; SDK'nın çizelgesi bu biçimi toplar).
pub async fn anket_gonder(durum: &AppState, istek: crate::tipler::AnketIstegi) -> Sonuc<()> {
    let soru = istek.soru.trim();
    let secenekler: Vec<UnstablePollAnswer> = istek
        .secenekler
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .enumerate()
        .map(|(i, s)| UnstablePollAnswer::new(format!("s{}", i + 1), s))
        .collect();
    if soru.is_empty() || secenekler.len() < 2 {
        return Err(Hata::Diger("anket için soru ve en az iki seçenek gerekir".into()));
    }
    let sayi = secenekler.len();
    let yedek = format!("{soru}\n{}", secenekler.iter().map(|s| format!("- {}", s.text)).collect::<Vec<_>>().join("\n"));
    let cevaplar = UnstablePollAnswers::try_from(secenekler).map_err(|e| Hata::Diger(e.to_string()))?;
    let mut blok = UnstablePollStartContentBlock::new(soru, cevaplar);
    blok.kind = if istek.acik { PollKind::Disclosed } else { PollKind::Undisclosed };
    if istek.coklu {
        blok.max_selections = UInt::from(sayi as u32);
    }
    let zaman = zaman_bul(durum, &istek.oda_id).await?;
    zaman
        .send(AnyMessageLikeEventContent::UnstablePollStart(UnstablePollStartEventContent::New(
            NewUnstablePollStartEventContent::plain_text(yedek, blok),
        )))
        .await?;
    Ok(())
}

/// Votes in a poll: `secenekler` are answer ids; sending again replaces my previous vote (latest response wins).
/// Ankette oy verir: `secenekler` cevap kimlikleridir; yeniden göndermek önceki oyumun yerine geçer (son cevap geçerli).
pub async fn anket_oy_ver(durum: &AppState, oda_id: &str, anket_olay_id: &str, secenekler: Vec<String>) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    let id = EventId::parse(anket_olay_id)?;
    zaman.send(AnyMessageLikeEventContent::UnstablePollResponse(UnstablePollResponseEventContent::new(secenekler, id))).await?;
    Ok(())
}

/// Ends a poll (only its creator can; the server enforces it). · Anketi bitirir (yalnızca oluşturan yapabilir; sunucu denetler).
pub async fn anket_bitir(durum: &AppState, oda_id: &str, anket_olay_id: &str) -> Sonuc<()> {
    let zaman = zaman_bul(durum, oda_id).await?;
    let id = EventId::parse(anket_olay_id)?;
    zaman.send(AnyMessageLikeEventContent::UnstablePollEnd(UnstablePollEndEventContent::new("Anket sona erdi", id))).await?;
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
