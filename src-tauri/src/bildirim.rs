//! Notifications: decides when a new message becomes a system notification (Android) or an in-app banner event.
//! Bildirimler: yeni bir mesajın ne zaman sistem bildirimi (Android) ya da uygulama içi şerit olayı olacağına karar verir.
//!
//! The decision uses the SDK's own push-rule evaluation (`Client::register_notification_handler`): the server's rules already
//! know about muted rooms, mentions, our own messages and calls (`.m.rule.call`), and events of encrypted rooms arrive decrypted.
//! Karar, SDK'nın kendi push kuralı değerlendirmesini kullanır (`Client::register_notification_handler`): sunucunun kuralları
//! sessize alınan odaları, bahsetmeleri, kendi mesajlarımızı ve aramaları (`.m.rule.call`) zaten bilir; şifreli odaların
//! olayları çözülmüş gelir.
//!
//! HONEST LIMIT: there is no push (FCM / UnifiedPush) yet, so this only works while the app process is alive and syncing.
//! DÜRÜST SINIR: henüz anlık bildirim (FCM / UnifiedPush) yok; yalnızca uygulama süreci canlı ve eşitlemedeyken çalışır.

use std::sync::OnceLock;

use matrix_sdk::{
    deserialized_responses::RawAnySyncOrStrippedTimelineEvent,
    ruma::{
        events::{room::message::MessageType, AnySyncMessageLikeEvent, AnySyncTimelineEvent},
        OwnedEventId, RoomId,
    },
    Client, Room,
};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use crate::{
    android_jni,
    durum::AppState,
    matrix::odalar,
    tipler::UygulamaIciBildirim,
};

pub const OLAY_UYGULAMA_ICI: &str = "uygulama-ici-bildirim";

/// The app handle for code that enters from Kotlin (inline reply / mark-read) with no Tauri context.
/// Kotlin'den giren (satır içi yanıt / okundu) ve elinde Tauri bağlamı olmayan kod için uygulama tutamacı.
static UYGULAMA: OnceLock<AppHandle> = OnceLock::new();

/// Registers the notification handler on a freshly logged-in client. Call once per client (see `komutlar::oturumu_baslat`).
/// Yeni giriş yapmış istemciye bildirim işleyicisini kaydeder. İstemci başına bir kez çağır (bkz. `komutlar::oturumu_baslat`).
pub fn kaydet(app: AppHandle, client: &Client) {
    let _ = UYGULAMA.set(app.clone());
    let c = client.clone();
    tauri::async_runtime::spawn(async move {
        c.register_notification_handler(move |bildirim, oda, client| {
            let app = app.clone();
            async move { isle(app, bildirim, oda, client).await }
        })
        .await;
    });
}

/// Is the app visible? Android asks the Kotlin lifecycle; the desktop trusts what the webview reported.
/// Uygulama görünür mü? Android, Kotlin yaşam döngüsüne sorar; masaüstü webview'in bildirdiğine güvenir.
fn on_planda(app: &AppHandle) -> bool {
    if cfg!(target_os = "android") {
        android_jni::on_planda_mi()
    } else {
        // On the desktop a window behind others is still "visible": the focus decides. · Masaüstünde arkadaki pencere de "görünür"dür: odak belirler.
        !app.state::<AppState>().arka_planda.load(std::sync::atomic::Ordering::Relaxed)
            && app.get_webview_window("main").and_then(|p| p.is_focused().ok()).unwrap_or(true)
    }
}

fn mesaj_metni(t: &MessageType) -> String {
    match t {
        MessageType::Text(m) => m.body.clone(),
        MessageType::Notice(m) => m.body.clone(),
        MessageType::Emote(m) => m.body.clone(),
        MessageType::Image(m) => m.caption().map(str::to_owned).unwrap_or_else(|| crate::dil::sec("Fotoğraf", "Photo").into()),
        MessageType::Video(m) => m.caption().map(str::to_owned).unwrap_or_else(|| crate::dil::sec("Video", "Video").into()),
        MessageType::Audio(_) => crate::dil::sec("Ses", "Audio").into(),
        MessageType::File(m) => format!("{}: {}", crate::dil::sec("Dosya", "File"), m.filename()),
        MessageType::Location(_) => crate::dil::sec("Konum", "Location").into(),
        other => other.body().to_owned(),
    }
}

async fn isle(app: AppHandle, bildirim: matrix_sdk::sync::Notification, oda: Room, client: Client) {
    // Invites etc. come stripped: not handled yet. · Davetler vb. sadeleştirilmiş gelir: henüz işlenmiyor.
    let RawAnySyncOrStrippedTimelineEvent::Sync(ham) = bildirim.event else { return };
    let Ok(olay) = ham.deserialize() else { return };
    if client.user_id().is_some_and(|ben| ben == olay.sender()) {
        return;
    }
    let AnySyncTimelineEvent::MessageLike(ml) = &olay else { return };
    let (metin, arama) = match ml {
        AnySyncMessageLikeEvent::RoomMessage(m) => match m.as_original() {
            Some(o) => (mesaj_metni(&o.content.msgtype), false),
            None => return,
        },
        // Could not be decrypted (yet): still tell the user something arrived. · Çözülemedi (henüz): yine de bir şey geldiğini söyle.
        AnySyncMessageLikeEvent::RoomEncrypted(_) => (crate::dil::sec("Yeni mesaj", "New message").into(), false),
        AnySyncMessageLikeEvent::CallInvite(c) => {
            let Some(o) = c.as_original() else { return };
            // Stale invite = the ring time is over. · Bayat davet = çalma süresi geçti.
            let zaman: u64 = o.origin_server_ts.0.into();
            if crate::matrix::arama::simdi_ms().saturating_sub(zaman) > u64::from(o.content.lifetime) {
                return;
            }
            (crate::dil::sec("Gelen sesli arama", "Incoming voice call").into(), true)
        }
        _ => return,
    };

    let durum = app.state::<AppState>();
    let oda_id = oda.room_id().to_owned();
    let acik = durum.zamanlar.lock().await.contains_key(&oda_id);
    let gonderen_ad = match oda.get_member_no_sync(olay.sender()).await {
        Ok(Some(u)) => u.display_name().map(str::to_owned).unwrap_or_else(|| olay.sender().localpart().to_owned()),
        _ => olay.sender().localpart().to_owned(),
    };
    let oda_ad = odalar::oda_adi(&oda);
    let zaman: u64 = olay.origin_server_ts().0.into();

    if on_planda(&app) {
        // The user is looking at the app: a banner, unless that room is already open (calls have their own screen).
        // Kullanıcı uygulamaya bakıyor: o oda zaten açık değilse şerit (aramaların kendi ekranı var).
        if !acik && !arama {
            let dm = oda.is_direct().await.unwrap_or(false);
            let _ = app.emit(
                OLAY_UYGULAMA_ICI,
                UygulamaIciBildirim {
                    oda_id: oda_id.to_string(),
                    oda_ad,
                    gonderen_ad,
                    metin,
                    avatar_mxc: odalar::avatar_mxc(&oda, dm).await,
                    arama: false,
                },
            );
        }
    } else if cfg!(target_os = "android") {
        let olay_id = olay.event_id().to_string();
        let o = oda_id.to_string();
        let sonuc = tokio::task::spawn_blocking(move || android_jni::bildirim_goster(&o, &oda_ad, &gonderen_ad, &metin, zaman as i64, arama, &olay_id)).await;
        match sonuc {
            Ok(Ok(())) => {}
            Ok(Err(e)) => warn!("bildirim gösterilemedi: {e}"),
            Err(e) => warn!("bildirim görevi çöktü: {e}"),
        }
    } else {
        #[cfg(target_os = "linux")]
        {
            let (baslik, govde) = if oda_ad == gonderen_ad { (oda_ad, metin) } else { (oda_ad, format!("{gonderen_ad}: {metin}")) };
            let _ = tokio::task::spawn_blocking(move || crate::masaustu_linux::bildirim_goster(oda_id.as_str(), &baslik, &govde)).await;
        }
    }
}

/// A room was opened in the app: its system notification is no longer needed. · Oda uygulamada açıldı: sistem bildirimi artık gerekmez.
pub fn oda_acildi(oda_id: &str) {
    if cfg!(target_os = "android") {
        android_jni::bildirim_temizle(oda_id);
    }
    #[cfg(target_os = "linux")]
    {
        let oda = oda_id.to_owned();
        tauri::async_runtime::spawn_blocking(move || crate::masaustu_linux::bildirim_temizle(&oda));
    }
}

/// Logout or account switch: no notification of the old account may stay (its text, or a reply sent as the next account).
/// Çıkış ya da hesap değişimi: eski hesabın hiçbir bildirimi kalmamalı (metni ya da sonraki hesap adına gönderilen yanıt).
pub fn hepsini_temizle() {
    if cfg!(target_os = "android") {
        android_jni::bildirim_hepsini_temizle();
    }
    #[cfg(target_os = "linux")]
    tauri::async_runtime::spawn_blocking(crate::masaustu_linux::bildirim_hepsini_temizle);
}

pub fn izin_var() -> bool {
    if cfg!(target_os = "android") { android_jni::bildirim_izni_var() } else { true }
}

/// Asks for the Android 13+ notification permission and waits (up to two minutes) for the user's answer.
/// Android 13+ bildirim iznini ister ve kullanıcının cevabını bekler (en çok iki dakika).
pub async fn izin_iste() -> bool {
    if !cfg!(target_os = "android") {
        return true;
    }
    if android_jni::bildirim_izni_var() {
        return true;
    }
    if android_jni::bildirim_izni_iste().is_err() {
        return false;
    }
    for _ in 0..480 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if android_jni::bildirim_izni_sonuc() != 0 {
            break;
        }
    }
    android_jni::bildirim_izni_var()
}

// ---------------------------------------------------------------------------------------------------------------------
// Entry points called FROM Kotlin (BroadcastReceiver for the notification actions)
// Kotlin'den ÇAĞRILAN giriş noktaları (bildirim eylemleri için BroadcastReceiver)
// ---------------------------------------------------------------------------------------------------------------------

/// Is there a logged-in session in this process? Without one the Kotlin side opens the app instead.
/// Bu süreçte giriş yapmış oturum var mı? Yoksa Kotlin tarafı bunun yerine uygulamayı açar.
fn oturum_var() -> Option<AppHandle> {
    let app = UYGULAMA.get()?;
    let var = app.state::<AppState>().oturum.try_read().map(|o| o.is_some()).unwrap_or(false);
    var.then(|| app.clone())
}

fn kotlin_metin(env: &mut jni::JNIEnv, s: &jni::objects::JString) -> Option<String> {
    env.get_string(s).ok().map(Into::into)
}

/// `YerelKoprusu.yanit(odaId, metin)`: inline reply from the notification. Returns false when no session lives in this process.
/// `YerelKoprusu.yanit(odaId, metin)`: bildirimden satır içi yanıt. Bu süreçte oturum yoksa false döner.
#[no_mangle]
pub extern "system" fn Java_dev_rubyyard_rubychat_YerelKoprusu_yanit(
    mut env: jni::JNIEnv,
    _sinif: jni::objects::JClass,
    oda: jni::objects::JString,
    metin: jni::objects::JString,
) -> jni::sys::jboolean {
    let (Some(oda), Some(metin)) = (kotlin_metin(&mut env, &oda), kotlin_metin(&mut env, &metin)) else { return 0 };
    let Some(app) = oturum_var() else { return 0 };
    tauri::async_runtime::spawn(async move {
        let sonuc: Result<(), String> = async {
            let client = app.state::<AppState>().client().await.map_err(|e| e.to_string())?;
            let id = RoomId::parse(&oda).map_err(|e| e.to_string())?;
            let room = client.get_room(&id).ok_or("oda yok")?;
            let icerik = matrix_sdk::ruma::events::AnyMessageLikeEventContent::RoomMessage(
                matrix_sdk::ruma::events::room::message::RoomMessageEventContent::text_plain(metin.trim()),
            );
            room.send_queue().send(icerik).await.map_err(|e| e.to_string())?;
            Ok(())
        }
        .await;
        match sonuc {
            Ok(()) => info!("bildirimden yanıt kuyruğa alındı"),
            Err(e) => warn!("bildirimden yanıt gönderilemedi: {e}"),
        }
    });
    1
}

/// `YerelKoprusu.okundu(odaId, olayId)`: "Okundu" action. · "Okundu" eylemi.
#[no_mangle]
pub extern "system" fn Java_dev_rubyyard_rubychat_YerelKoprusu_okundu(
    mut env: jni::JNIEnv,
    _sinif: jni::objects::JClass,
    oda: jni::objects::JString,
    olay: jni::objects::JString,
) -> jni::sys::jboolean {
    let (Some(oda), Some(olay)) = (kotlin_metin(&mut env, &oda), kotlin_metin(&mut env, &olay)) else { return 0 };
    let Some(app) = oturum_var() else { return 0 };
    tauri::async_runtime::spawn(async move {
        let sonuc: Result<(), String> = async {
            let client = app.state::<AppState>().client().await.map_err(|e| e.to_string())?;
            let id = RoomId::parse(&oda).map_err(|e| e.to_string())?;
            let olay_id: OwnedEventId = olay.parse().map_err(|e: matrix_sdk::IdParseError| e.to_string())?;
            let room = client.get_room(&id).ok_or("oda yok")?;
            let makbuz = matrix_sdk::room::Receipts::new().fully_read_marker(olay_id.clone()).public_read_receipt(olay_id);
            room.send_multiple_receipts(makbuz).await.map_err(|e| e.to_string())?;
            Ok(())
        }
        .await;
        if let Err(e) = sonuc {
            warn!("bildirimden okundu işaretlenemedi: {e}");
        }
    });
    1
}
