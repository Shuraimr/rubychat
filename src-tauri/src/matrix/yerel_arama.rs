//! Calls inside the app (no Element Call): MatrixRTC + LiveKit through the engine in ../motor. Commands exist in every build; without the
//! `yerel-arama` feature `yerel_arama_var` says false and the UI keeps using Element Call.
//! Uygulama içi aramalar (Element Call'suz): ../motor'daki motorla MatrixRTC + LiveKit. Komutlar her derlemede vardır; `yerel-arama` özelliği
//! olmadan `yerel_arama_var` false döner ve arayüz Element Call'u kullanmayı sürdürür.

use tauri::{ipc::Response, AppHandle};

use crate::{durum::AppState, hata::{Hata, Sonuc}};

#[cfg(all(feature = "yerel-arama", target_os = "linux"))]
mod ekran;
// Android has no screen capture in libwebrtc: sharing says so and stops. · Android'de libwebrtc ekran yakalamaz: paylaşım bunu söyler ve durur.
#[cfg(all(feature = "yerel-arama", target_os = "android"))]
#[path = "yerel_arama/ekran_android.rs"]
mod ekran;
#[cfg(all(feature = "yerel-arama", any(target_os = "linux", target_os = "android")))]
mod motor;
#[cfg(all(feature = "yerel-arama", any(target_os = "linux", target_os = "android")))]
mod ses;

#[derive(serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SesAygiti {
    pub ad: String,
    pub aciklama: String,
}

#[derive(serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SesAygitlari {
    pub girisler: Vec<SesAygiti>,
    pub cikislar: Vec<SesAygiti>,
    pub varsayilan_giris: Option<String>,
    pub varsayilan_cikis: Option<String>,
}

#[cfg(not(all(feature = "yerel-arama", any(target_os = "linux", target_os = "android"))))]
mod motor {
    use super::*;
    pub const VAR: bool = false;
    fn yok<T>() -> Sonuc<T> {
        Err(Hata::Diger("bu derlemede yerel arama yok".into()))
    }
    pub async fn baslat(_: AppHandle, _: matrix_sdk::Room, _: bool, _: bool) -> Sonuc<()> { yok() }
    pub async fn kapat() {}
    pub fn sustur(_: bool) {}
    pub fn duzey(_: String, _: f32) {}
    pub async fn uygulamalar() -> Vec<String> { vec![] }
    pub fn paylas(_: Vec<String>) -> Sonuc<()> { yok() }
    pub fn paylasilan_sesler(_: Vec<String>) {}
    pub fn paylasimi_durdur() {}
    pub async fn kare(_: String, _: u64) -> Vec<u8> { vec![] }
    pub async fn aygitlar() -> SesAygitlari { SesAygitlari::default() }
    pub fn ses_ayarla(_: Option<String>, _: Option<String>, _: bool) {}
}

#[tauri::command]
pub fn yerel_arama_var() -> bool {
    motor::VAR
}

/// `ara` = we start the call (rings / notifies the room); false = we join one that runs. · `ara` = aramayı biz başlatırız (çalar / odaya haber verir).
#[tauri::command]
pub async fn yerel_arama_baslat(app: AppHandle, durum: tauri::State<'_, AppState>, oda_id: String, dm: bool, ara: bool) -> Sonuc<()> {
    let id = matrix_sdk::ruma::RoomId::parse(&oda_id).map_err(|_| Hata::OdaBulunamadi)?;
    let oda = durum.client().await?.get_room(&id).ok_or(Hata::OdaBulunamadi)?;
    motor::baslat(app, oda, dm, ara).await
}

/// Leaves the call (also on sign-out and account change). · Aramadan ayrılır (çıkışta ve hesap değişince de).
#[tauri::command]
pub async fn yerel_arama_kapat() {
    motor::kapat().await;
}

#[tauri::command]
pub fn yerel_arama_sustur(kapali: bool) {
    motor::sustur(kapali);
}

/// Volume of one sound, only for this listener: 0 = silent, 1 = as sent, 2 = twice. · Bir sesin düzeyi, yalnız bu dinleyici için.
#[tauri::command]
pub fn yerel_arama_duzey(anahtar: String, duzey: f32) {
    motor::duzey(anahtar, duzey);
}

/// Applications making sound now. · Şu an ses çıkaran uygulamalar.
#[tauri::command]
pub async fn yerel_arama_uygulamalar() -> Vec<String> {
    motor::uygulamalar().await
}

#[tauri::command]
pub fn yerel_arama_paylas(uygulamalar: Vec<String>) -> Sonuc<()> {
    motor::paylas(uygulamalar)
}

#[tauri::command]
pub fn yerel_arama_paylasilan_sesler(uygulamalar: Vec<String>) {
    motor::paylasilan_sesler(uygulamalar);
}

#[tauri::command]
pub fn yerel_arama_paylasimi_durdur() {
    motor::paylasimi_durdur();
}

/// The newest picture of `anahtar` after number `sonra`, waiting up to a second; empty = none. Bytes: number u32, width u32, height u32
/// (little endian), then tightly packed I420.
/// `anahtar`ın `sonra` numarasından yeni son görüntüsü, en çok bir saniye bekler; boş = yok. Baytlar: numara u32, genişlik u32, yükseklik u32
/// (küçük uçlu), sonra sıkı paketli I420.
#[tauri::command]
pub async fn yerel_arama_kare(anahtar: String, sonra: u32) -> Response {
    Response::new(motor::kare(anahtar, sonra.into()).await)
}

/// Available audio input/output devices (Linux; empty on Android where SesKoprusu routes audio).
/// Kullanılabilir ses giriş/çıkış aygıtları (Linux; Android'de yönlendirmeyi SesKoprusu yapar, boş döner).
#[tauri::command]
pub async fn yerel_arama_aygitlar() -> SesAygitlari {
    motor::aygitlar().await
}

/// Saves audio preferences for future calls and applies changes immediately if a call is running.
/// Ses tercihlerini sonraki aramalar için saklar ve süren arama varsa değişimleri hemen uygular.
#[tauri::command]
pub fn yerel_arama_ses_ayarla(giris: Option<String>, cikis: Option<String>, gurultu: bool) {
    motor::ses_ayarla(giris, cikis, gurultu);
}
