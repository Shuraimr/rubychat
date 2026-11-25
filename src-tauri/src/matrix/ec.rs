//! Calls through Element Call (EC), embedded the way Element X does it: EC (a web app) runs inside an iframe in our webview and
//! talks to Matrix ONLY through the widget API. This file is the Matrix half: matrix-sdk's `WidgetDriver` answers the widget's
//! requests (read/send room events, OpenID token, delayed events, to-device keys), and we just carry its JSON messages
//! between the webview and the driver (`ec_gonder` in, `ec-gelen` event out).
//! Element Call (EC) ile aramalar; Element X'in yaptığı gibi gömülü: EC (bir web uygulaması) webview'imizde bir iframe içinde
//! çalışır ve Matrix ile YALNIZCA widget API'si üzerinden konuşur. Bu dosya Matrix yarısıdır: matrix-sdk'nın `WidgetDriver`'ı
//! widget'ın isteklerini yanıtlar (oda olaylarını okuma/gönderme, OpenID belirteci, gecikmeli olaylar, to-device anahtarları);
//! biz yalnızca onun JSON mesajlarını webview ile sürücü arasında taşırız (`ec_gonder` içeri, `ec-gelen` olayı dışarı).
//!
//! Also here: (1) the `ec` URI scheme that serves the bundled EC build with its OWN Content-Security-Policy (our app CSP would
//! break EC), (2) detection of rooms with a running MatrixRTC call (the "Katıl" banner), (3) the capability list EC needs.
//! Ayrıca burada: (1) paketlenmiş EC derlemesini KENDİ Content-Security-Policy'siyle sunan `ec` URI şeması (uygulamanın CSP'si
//! EC'yi bozardı), (2) MatrixRTC araması süren odaların bulunması ("Katıl" şeridi), (3) EC'nin istediği yetki listesi.

use std::{
    collections::HashMap,
    future::Future,
    sync::{Arc, Mutex, OnceLock},
};

use matrix_sdk::{
    ruma::{
        events::{
            call::member::OriginalSyncCallMemberEvent,
            MessageLikeEventType, StateEventType, ToDeviceEventType,
        },
        OwnedRoomId,
    },
    widget::{
        Capabilities, CapabilitiesProvider, ClientProperties, EncryptionSystem, Filter, Intent, MessageLikeEventFilter,
        StateEventFilter, ToDeviceEventFilter, VirtualElementCallWidgetConfig, VirtualElementCallWidgetProperties,
        WidgetDriver, WidgetDriverHandle, WidgetSettings,
    },
    Client, Room,
};
use serde::{Deserialize, Serialize};
use tauri::{
    http::{Request, Response},
    AppHandle, Emitter,
};

use crate::{
    durum::AppState,
    hata::{Hata, Sonuc},
};

/// Where the bundled copy of EC lives inside our frontend assets (public/element-call, copied from the npm package by vite.config.ts).
/// Paketlenmiş EC kopyasının ön yüz varlıkları içindeki yeri (public/element-call; vite.config.ts npm paketinden kopyalar).
const GOMULU_KLASOR: &str = "element-call";
/// Fallback when the bundled copy is missing or fails to load: the hosted EC. Pinned in ONE place; the UI asks for it with `yedek = true`.
/// Paketlenmiş kopya yoksa ya da yüklenmezse yedek: barındırılan EC. TEK yerde sabitlenir; arayüz `yedek = true` ile ister.
pub const EC_YEDEK_URL: &str = "https://call.element.io/";
/// matrix-sdk 0.19.1 knows EC widget capabilities up to this EC generation; newer ECs may ask for MSC4533 permissions we cannot grant.
/// matrix-sdk 0.19.1 EC yetkilerini bu EC kuşağına kadar bilir; daha yeni EC'ler verebileceğimizden fazlasını (MSC4533) isteyebilir.
pub const EC_SURUM: &str = "0.28.2";

/// Event names the UI listens to. · Arayüzün dinlediği olay adları.
pub const OLAY_GELEN: &str = "ec-gelen";
pub const OLAY_BITTI: &str = "ec-bitti";
pub const OLAY_ARAMA_DURUMU: &str = "ec-arama-durumu";

/// Base URL of the bundled EC. Custom schemes are `ec://localhost` on macOS/Linux and `http://ec.localhost` on Windows/Android (Tauri docs,
/// `register_asynchronous_uri_scheme_protocol`); WebKitGTK registers custom schemes as secure and Chromium treats `*.localhost` as secure,
/// so `getUserMedia` works in both.
/// Paketlenmiş EC'nin taban adresi. Özel şemalar macOS/Linux'ta `ec://localhost`, Windows/Android'de `http://ec.localhost`;
/// WebKitGTK özel şemaları güvenli kaydeder, Chromium `*.localhost`u güvenli sayar: ikisinde de `getUserMedia` çalışır.
fn gomulu_taban() -> String {
    #[cfg(any(target_os = "android", target_os = "windows"))]
    return format!("http://ec.localhost/{GOMULU_KLASOR}/index.html");
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    return format!("ec://localhost/{GOMULU_KLASOR}/index.html");
}

// ---------------------------------------------------------------------------------------------------------------------
// Sessions · Oturumlar
// ---------------------------------------------------------------------------------------------------------------------

/// One running widget: the driver task, the pump task (driver → webview) and the handle (webview → driver).
/// Çalışan tek widget: sürücü görevi, pompa görevi (sürücü → webview) ve tutamaç (webview → sürücü).
struct EcOturumu {
    handle: Arc<WidgetDriverHandle>,
    gorevler: Vec<tauri::async_runtime::JoinHandle<()>>,
}

/// widget_id → session. A static (not AppState) so this module stays self-contained. At most ONE call is active: `ec_ac` closes the old one.
/// widget_id → oturum. AppState yerine static: modül kendi içinde kalsın. En çok BİR arama etkin: `ec_ac` eskisini kapatır.
fn oturumlar() -> &'static Mutex<HashMap<String, EcOturumu>> {
    static T: OnceLock<Mutex<HashMap<String, EcOturumu>>> = OnceLock::new();
    T.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Stops one widget session (idempotent). · Bir widget oturumunu durdurur (tekrar çağrılabilir).
fn oturumu_kapat(widget_id: &str) {
    let o = oturumlar().lock().unwrap_or_else(|e| e.into_inner()).remove(widget_id);
    if let Some(o) = o {
        for g in o.gorevler {
            g.abort();
        }
    }
}

/// Stops every session: logout and before starting a new call. · Bütün oturumları durdurur: çıkışta ve yeni arama başlamadan önce.
pub fn hepsini_kapat() {
    let idler: Vec<String> = oturumlar().lock().unwrap_or_else(|e| e.into_inner()).keys().cloned().collect();
    for id in idler {
        oturumu_kapat(&id);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Capabilities · Yetkiler
// ---------------------------------------------------------------------------------------------------------------------

/// The permissions EC asks for. matrix-sdk does NOT ship this list (only its FFI crate does: `get_element_call_required_permissions`
/// in bindings/matrix-sdk-ffi/src/widget.rs), so we mirror it. Element X also grants this fixed list and ignores what was requested.
/// EC'nin istediği yetkiler. matrix-sdk bu listeyi VERMEZ (yalnızca FFI kasası verir), biz aynısını kurarız. Element X de istenene
/// bakmadan bu sabit listeyi verir.
struct EcYetkileri {
    kullanici_id: String,
    cihaz_id: String,
}

fn mesaj_turu(t: &str) -> MessageLikeEventType {
    MessageLikeEventType::from(t)
}

impl EcYetkileri {
    /// Events EC may both read and send. · EC'nin hem okuyup hem gönderebileceği olaylar.
    fn okuma_yazma() -> Vec<Filter> {
        let mesaj = |t: &str| Filter::MessageLike(MessageLikeEventFilter::WithType(mesaj_turu(t)));
        let cihaz = |t: &str| Filter::ToDevice(ToDeviceEventFilter::new(ToDeviceEventType::from(t)));
        vec![
            mesaj("org.matrix.rageshake_request"),
            cihaz("io.element.call.encryption_keys"),
            cihaz("m.rtc.encryption_key"),
            mesaj("io.element.call.encryption_keys"),
            mesaj("io.element.call.reaction"),
            Filter::MessageLike(MessageLikeEventFilter::WithType(MessageLikeEventType::Reaction)),
            Filter::MessageLike(MessageLikeEventFilter::WithType(MessageLikeEventType::RoomRedaction)),
            // RtcDecline exists in matrix-sdk's ruma (unstable-msc4310); the alias string covers a stable-named sender too.
            // RtcDecline matrix-sdk'nın ruma'sında var (unstable-msc4310); takma ad dizesi kararlı adla gönderene de yeter.
            Filter::MessageLike(MessageLikeEventFilter::WithType(MessageLikeEventType::RtcDecline)),
            mesaj("m.rtc.decline"),
        ]
    }
}

impl CapabilitiesProvider for EcYetkileri {
    fn acquire_capabilities(&self, _istenen: Capabilities) -> impl Future<Output = Capabilities> + Send {
        let kullanici = self.kullanici_id.clone();
        let cihaz = self.cihaz_id.clone();
        async move {
            let durum = |t: StateEventType| Filter::State(StateEventFilter::WithType(t));
            let mut oku = vec![
                durum(StateEventType::CallMember),
                durum(StateEventType::RoomName),
                durum(StateEventType::RoomMember),
                durum(StateEventType::RoomEncryption),
                durum(StateEventType::RoomCreate),
                durum(StateEventType::MemberHints),
            ];
            oku.extend(EcYetkileri::okuma_yazma());

            // Our own m.call.member state keys: the five spellings EC uses for old/new membership formats.
            // Kendi m.call.member durum anahtarlarımız: EC'nin eski/yeni üyelik biçimleri için kullandığı beş yazım.
            let anahtarlar =
                [kullanici.clone(), format!("{kullanici}_{cihaz}"), format!("{kullanici}_{cihaz}_m.call"), format!("_{kullanici}_{cihaz}"), format!("_{kullanici}_{cihaz}_m.call")];
            let mut gonder = vec![
                Filter::MessageLike(MessageLikeEventFilter::WithType(MessageLikeEventType::RtcNotification)),
                Filter::MessageLike(MessageLikeEventFilter::WithType(MessageLikeEventType::CallNotify)),
                mesaj_filtre("m.rtc.notification"),
                mesaj_filtre("m.call.notify"),
            ];
            for a in anahtarlar {
                gonder.push(Filter::State(StateEventFilter::WithTypeAndStateKey(StateEventType::CallMember, a)));
            }
            gonder.extend(EcYetkileri::okuma_yazma());

            Capabilities {
                read: oku,
                send: gonder,
                requires_client: true,
                update_delayed_event: true,
                send_delayed_event: true,
                download_file: true,
                rtc_transports: true,
            }
        }
    }
}

fn mesaj_filtre(t: &str) -> Filter {
    Filter::MessageLike(MessageLikeEventFilter::WithType(mesaj_turu(t)))
}

// ---------------------------------------------------------------------------------------------------------------------
// Commands · Komutlar
// ---------------------------------------------------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EcAcilis {
    pub url: String,
    pub widget_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EcGelen {
    widget_id: String,
    mesaj: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EcBitti {
    widget_id: String,
}

fn oda_bul(client: &Client, oda_id: &str) -> Sonuc<Room> {
    let id: OwnedRoomId = oda_id.parse().map_err(|_| Hata::OdaBulunamadi)?;
    client.get_room(&id).ok_or(Hata::OdaBulunamadi)
}

fn rastgele_kimlik() -> String {
    format!("{:032x}", rand::random::<u128>())
}

/// "baslat" = start a call (EC sends the ring/notification), "katil" = join the call that is already running.
/// "baslat" = arama başlat (EC çaldırma/bildirimi yollar), "katil" = zaten süren aramaya katıl.
#[derive(Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum EcTuru {
    Baslat,
    Katil,
}

/// Builds the widget URL, starts the driver and returns the URL for the iframe.
/// Widget adresini kurar, sürücüyü başlatır ve iframe için adresi döndürür.
///
/// `ust_url` = the page's `location.origin` (EC posts its widget messages to it); `tema` = "dark" | "light"; `yedek` = use the hosted EC.
/// `ust_url` = sayfanın `location.origin`i (EC widget mesajlarını ona gönderir); `tema` = "dark" | "light"; `yedek` = barındırılan EC'yi kullan.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ec_ac(
    app: AppHandle,
    durum: tauri::State<'_, AppState>,
    oda_id: String,
    tur: EcTuru,
    sesli_mi: bool,
    dm_mi: bool,
    ust_url: String,
    tema: Option<String>,
    yedek: bool,
) -> Sonuc<EcAcilis> {
    let client = durum.client().await?;
    let room = oda_bul(&client, &oda_id)?;
    // Only one call at a time. · Aynı anda tek arama.
    hepsini_kapat();

    // Intent follows Element X: it also sets the lobby/header/notification defaults inside EC, so we pass nothing else.
    // Intent Element X'i izler: EC içinde lobi/başlık/bildirim varsayılanlarını da belirler; bu yüzden başka bir şey vermeyiz.
    let intent = match (tur, dm_mi, sesli_mi) {
        (EcTuru::Katil, true, true) => Intent::JoinExistingDmVoice,
        (EcTuru::Katil, true, false) => Intent::JoinExistingDm,
        (EcTuru::Katil, false, _) => Intent::JoinExisting,
        (EcTuru::Baslat, true, true) => Intent::StartCallDmVoice,
        (EcTuru::Baslat, true, false) => Intent::StartCallDm,
        (EcTuru::Baslat, false, _) => Intent::StartCall,
    };
    // Media is end-to-end encrypted per participant in encrypted rooms (EC distributes the keys over to-device / room events).
    // Şifreli odalarda medya katılımcı başına uçtan uca şifrelenir (EC anahtarları to-device / oda olaylarıyla dağıtır).
    let sifreleme = if room.encryption_state().is_encrypted() { EncryptionSystem::PerParticipantKeys } else { EncryptionSystem::Unencrypted };

    let widget_id = rastgele_kimlik();
    let taban = if yedek { EC_YEDEK_URL.to_owned() } else { gomulu_taban() };
    let ozellikler = VirtualElementCallWidgetProperties {
        element_call_url: taban,
        widget_id: widget_id.clone(),
        parent_url: Some(ust_url),
        encryption: sifreleme,
        ..Default::default()
    };
    let ayar = VirtualElementCallWidgetConfig {
        intent: Some(intent),
        // On Android the OS routes audio (speaker/earpiece/bluetooth) and EC only shows what the app reports through `window.controls`.
        // Android'de sesi işletim sistemi yönlendirir; EC yalnızca uygulamanın `window.controls` ile bildirdiğini gösterir.
        controlled_audio_devices: Some(cfg!(target_os = "android")),
        ..Default::default()
    };
    let widget = WidgetSettings::new_virtual_element_call_widget(ozellikler, ayar).map_err(|e| Hata::Diger(format!("EC adresi: {e}")))?;

    // `None` language = en-US inside the SDK; we swap it for Turkish below (no `language-tags` dependency needed).
    // `None` dil = SDK içinde en-US; aşağıda Türkçe ile değiştiririz (`language-tags` bağımlılığı gerekmez).
    let mut url = widget.generate_webview_url(&room, ClientProperties::new("dev.rubyyard.rubychat", None, tema)).await.map_err(|e| Hata::Diger(format!("EC adresi: {e}")))?;
    // All parameters live in the URL fragment (never sent to a server). `echoCancellation` / `noiseSuppression` are in EC's UrlParams.ts
    // but not in the SDK's config struct, so we append them. They default to true in EC; we state it so a later EC default change cannot silently turn them off.
    // Bütün parametreler URL parçasında (sunucuya gitmez). `echoCancellation` / `noiseSuppression` EC'nin UrlParams.ts'inde var ama
    // SDK'nın yapılandırma yapısında yok; biz ekleriz. EC'de varsayılan true; EC'nin ileride varsayılanı değişip sessizce kapanmasın diye açıkça yazarız.
    let parca = url.fragment().unwrap_or("").replace("lang=en-US", "lang=tr").replace("lang=en-us", "lang=tr");
    url.set_fragment(Some(&format!("{parca}&echoCancellation=true&noiseSuppression=true")));

    let (surucu, handle) = WidgetDriver::new(widget);
    let handle = Arc::new(handle);
    let yetkiler = EcYetkileri {
        kullanici_id: room.own_user_id().to_string(),
        cihaz_id: client.device_id().map(|d| d.to_string()).unwrap_or_default(),
    };

    // Task 1: the driver itself. It ends when the widget disconnects or hits a terminal error; then the UI is told to close.
    // Görev 1: sürücünün kendisi. Widget ayrılınca ya da ölümcül hata olunca biter; sonra arayüze kapanması söylenir.
    let a1 = app.clone();
    let w1 = widget_id.clone();
    let g1 = tauri::async_runtime::spawn(async move {
        let sonuc = surucu.run(room, yetkiler).await;
        tracing::info!("EC sürücüsü bitti: {sonuc:?}");
        oturumlar().lock().unwrap_or_else(|e| e.into_inner()).remove(&w1);
        let _ = a1.emit(OLAY_BITTI, EcBitti { widget_id: w1 });
    });
    // Task 2: the pump. Driver → webview: every JSON message the driver wants the widget to see.
    // Görev 2: pompa. Sürücü → webview: sürücünün widget'a göstermek istediği her JSON mesajı.
    let a2 = app.clone();
    let w2 = widget_id.clone();
    let h2 = handle.clone();
    let g2 = tauri::async_runtime::spawn(async move {
        while let Some(mesaj) = h2.recv().await {
            let _ = a2.emit(OLAY_GELEN, EcGelen { widget_id: w2.clone(), mesaj });
        }
    });

    oturumlar().lock().unwrap_or_else(|e| e.into_inner()).insert(widget_id.clone(), EcOturumu { handle, gorevler: vec![g1, g2] });
    Ok(EcAcilis { url: url.to_string(), widget_id })
}

/// WebView → driver: one JSON message the widget posted. · WebView → sürücü: widget'ın gönderdiği bir JSON mesajı.
#[tauri::command]
pub fn ec_gonder(widget_id: String, mesaj: String) -> Sonuc<()> {
    let handle = oturumlar().lock().unwrap_or_else(|e| e.into_inner()).get(&widget_id).map(|o| o.handle.clone());
    match handle {
        Some(h) if h.send(mesaj) => Ok(()),
        _ => Err(Hata::Diger("arama oturumu yok".into())),
    }
}

/// Ends the widget session (the UI has already asked EC to hang up, or EC closed itself). · Widget oturumunu bitirir.
#[tauri::command]
pub fn ec_kapat(widget_id: String) {
    oturumu_kapat(&widget_id);
}

// ---------------------------------------------------------------------------------------------------------------------
// Running calls in rooms (the "Katıl" banner) · Odalarda süren aramalar ("Katıl" şeridi)
// ---------------------------------------------------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EcAramaDurumu {
    pub oda_id: String,
    /// Someone has a non-expired `m.call` / `m.room` membership. · Birinin süresi dolmamış `m.call` / `m.room` üyeliği var.
    pub aktif: bool,
    pub katilimcilar: Vec<String>,
    /// One of MY devices is in it (then there is nothing to join). · BENİM bir cihazım içinde (o zaman katılacak bir şey yok).
    pub ben_icinde: bool,
}

fn oda_durumu(client: &Client, room: &Room) -> EcAramaDurumu {
    let katilimcilar: Vec<String> = room.active_room_call_participants().iter().map(|u| u.to_string()).collect();
    let ben_icinde = match (client.user_id(), client.device_id()) {
        (Some(u), Some(d)) => room.is_device_in_active_room_call(u, d),
        _ => false,
    };
    EcAramaDurumu { oda_id: room.room_id().to_string(), aktif: room.has_active_room_call(), katilimcilar, ben_icinde }
}

/// Registers the m.call.member handler: any change of a room's call roster is pushed to the UI. Call once per logged-in client.
/// m.call.member işleyicisini kaydeder: bir odanın arama listesindeki her değişiklik arayüze iletilir. Giriş yapmış istemci başına bir kez çağır.
pub fn kaydet(app: AppHandle, client: &Client) {
    client.add_event_handler(move |_ev: OriginalSyncCallMemberEvent, room: Room, client: Client| {
        let app = app.clone();
        async move {
            let _ = app.emit(OLAY_ARAMA_DURUMU, oda_durumu(&client, &room));
        }
    });
}

/// Every joined room that has a call running right now (used at startup; later changes arrive as events).
/// Şu anda araması süren her katıldığım oda (açılışta kullanılır; sonraki değişiklikler olay olarak gelir).
#[tauri::command]
pub async fn ec_aktif_aramalar(durum: tauri::State<'_, AppState>) -> Sonuc<Vec<EcAramaDurumu>> {
    let client = durum.client().await?;
    Ok(client.joined_rooms().iter().filter(|r| r.has_active_room_call()).map(|r| oda_durumu(&client, r)).collect())
}

/// Does the homeserver publish a MatrixRTC backend (SFU)? Without one EC cannot connect: the UI then says so instead of a blank call.
/// Anasunucu bir MatrixRTC arka ucu (SFU) yayımlıyor mu? Yoksa EC bağlanamaz: arayüz boş bir arama yerine bunu söyler.
#[tauri::command]
pub async fn ec_sunucu_destekliyor(durum: tauri::State<'_, AppState>) -> Sonuc<bool> {
    let client = durum.client().await?;
    // Err = could not ask (offline): do not block the call on a guess. · Err = sorulamadı (çevrimdışı): tahminle aramayı engelleme.
    Ok(match client.discover_rtc_transports().await {
        Ok(Some(l)) => !l.is_empty(),
        Ok(None) => false,
        Err(_) => true,
    })
}

// ---------------------------------------------------------------------------------------------------------------------
// `ec` URI scheme: the bundled EC with its own CSP · `ec` URI şeması: kendi CSP'siyle paketlenmiş EC
// ---------------------------------------------------------------------------------------------------------------------

/// CSP for EC documents. Our app CSP (`default-src 'self'; connect-src ...`) would block EC's calls to the homeserver, the LiveKit SFU
/// (https + wss), its blob workers (E2EE) and WebAssembly; so EC is served by this scheme with a CSP written for EC, and may be framed only by our app.
/// EC belgeleri için CSP. Uygulamanın CSP'si EC'nin anasunucu, LiveKit SFU (https + wss), blob işçileri (E2EE) ve WebAssembly
/// çağrılarını engellerdi; bu yüzden EC bu şemayla EC için yazılmış bir CSP ile sunulur ve yalnızca bizim uygulama onu çerçeveleyebilir.
const EC_CSP: &str = "default-src 'self'; \
script-src 'self' 'wasm-unsafe-eval' blob:; \
style-src 'self' 'unsafe-inline'; \
img-src 'self' data: blob: https:; \
media-src 'self' blob: mediastream: data:; \
font-src 'self' data:; \
connect-src 'self' https: wss: blob: data:; \
worker-src 'self' blob:; \
frame-ancestors tauri://localhost http://tauri.localhost https://tauri.localhost http://localhost:1420";

fn yanit(kod: u16, tur: &str, govde: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(kod)
        .header("Content-Type", tur)
        .header("Content-Security-Policy", EC_CSP)
        .header("Cache-Control", "no-cache")
        .body(govde)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Serves `<scheme>://.../element-call/<file>` from the frontend assets (embedded in release; read from `dist/` in dev).
/// `<şema>://.../element-call/<dosya>` isteğini ön yüz varlıklarından sunar (yayın derlemesinde gömülü; geliştirmede `dist/`ten okunur).
pub async fn sun(app: &AppHandle, istek: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let yol = istek.uri().path().trim_matches('/').to_owned();
    // No `..` and nothing outside element-call/ (plus our one bridge script). · `..` yok; element-call/ dışı yok (bir köprü betiği hariç).
    if yol.contains("..") || yol.contains('\\') {
        return yanit(400, "text/plain", vec![]);
    }
    let varlik_yolu = if yol == "rubychat-kopru.js" {
        "ec-kopru/kopru.js".to_owned()
    } else if yol.starts_with(&format!("{GOMULU_KLASOR}/")) {
        yol.clone()
    } else {
        return yanit(404, "text/plain", vec![]);
    };
    let Some(varlik) = app.asset_resolver().get(varlik_yolu) else {
        return yanit(404, "text/plain", vec![]);
    };
    let mut bayt = varlik.bytes;
    // Inject the bridge script into EC's index.html (before the module scripts, which are deferred) so the parent can drive `window.controls`.
    // Köprü betiğini EC'nin index.html'ine ekle (ertelenen modül betiklerinden önce); üst sayfa `window.controls`u sürebilsin.
    if yol == format!("{GOMULU_KLASOR}/index.html") {
        if let Ok(metin) = String::from_utf8(bayt.clone()) {
            let eklenmis = metin.replacen("<head>", "<head><script src=\"/rubychat-kopru.js\"></script>", 1);
            bayt = eklenmis.into_bytes();
        }
    }
    yanit(200, &varlik.mime_type, bayt)
}

/// Linux only: WebKitGTK ships WebRTC / media capture OFF and denies `getUserMedia` unless the app answers the permission request.
/// Yalnızca Linux: WebKitGTK WebRTC / medya yakalamayı KAPALI getirir ve uygulama izin isteğini yanıtlamazsa `getUserMedia`yı reddeder.
#[cfg(target_os = "linux")]
pub fn linux_medya_ac(app: &AppHandle) {
    use webkit2gtk::{
        glib::ObjectExt, PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt,
    };
    let Some(pencere) = tauri::Manager::get_webview_window(app, "main") else {
        tracing::warn!("ana pencere yok: WebKitGTK medya ayarları açılamadı");
        return;
    };
    let sonuc = pencere.with_webview(|w| {
        let wv = w.inner();
        if let Some(ayar) = WebViewExt::settings(&wv) {
            // wry leaves these at WebKit's default (false). `enable-webrtc` also enables media-stream; both are set to be explicit.
            // wry bunları WebKit varsayılanında (false) bırakır. `enable-webrtc` media-stream'i de açar; açık olsun diye ikisi de yazılır.
            ayar.set_enable_webrtc(true);
            ayar.set_enable_media_stream(true);
            ayar.set_enable_mediasource(true);
            ayar.set_media_playback_requires_user_gesture(false);
            // Copy from script (document.execCommand) is refused otherwise. · Yoksa betikten kopyalama reddedilir.
            ayar.set_javascript_can_access_clipboard(true);
        }
        // Allow microphone / camera / screen capture requests. The signal does not tell us the requesting origin, but the app CSP
        // lets this webview load ONLY our own origins (app + `ec`), so every request comes from our code.
        // Mikrofon / kamera / ekran yakalama isteklerine izin ver. Sinyal isteyen kaynağı söylemez; ama uygulama CSP'si bu webview'in
        // YALNIZCA kendi kaynaklarımızı (uygulama + `ec`) yüklemesine izin verir; yani her istek bizim kodumuzdan gelir.
        wv.connect_permission_request(|_, istek| {
            if istek.is::<UserMediaPermissionRequest>() {
                istek.allow();
                true
            } else {
                false
            }
        });
    });
    if let Err(e) = sonuc {
        tracing::warn!("WebKitGTK medya ayarları açılamadı: {e}");
    }
}
