//! Smart preloading: builds the timelines of the rooms the user is likely to open next and keeps them warm, so opening is instant.
//! The UI ranks the rooms (visits, unread, pinned); this side only works through the list, two at a time, and stops whenever a newer
//! list arrives. The room the user taps never waits here: `zaman::ac` runs on its own.
//! Akıllı ön yükleme: kullanıcının açması muhtemel odaların çizelgelerini kurup sıcak tutar; açılış anında olur. Odaları arayüz sıralar
//! (ziyaret, okunmamış, sabit); bu taraf listeyi ikişer ikişer işler ve yeni liste gelince durur. Kullanıcının dokunduğu oda burada
//! hiç beklemez: `zaman::ac` kendi başına çalışır.

use std::{
    collections::VecDeque,
    sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Arc, Mutex},
    time::{Duration, Instant},
};

use matrix_sdk::{ruma::{OwnedRoomId, RoomId}, RoomState};
use matrix_sdk_ui::{timeline::RoomExt, Timeline};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Semaphore;
use tracing::{info, warn};

use super::zaman;
use crate::{durum::AppState, hata::Sonuc};

pub const OLAY_HAZIR: &str = "zaman-hazir";
/// Warm timelines kept in memory · Bellekte tutulan sıcak çizelge sayısı
const EN_COK: usize = 8;
/// A long scrolled-back timeline is cheaper to rebuild than to send whole · Uzun geri kaydırılmış çizelgeyi yeniden kurmak bütününü yollamaktan ucuz
const EN_COK_OGE: usize = 240;
const SAYFA: u16 = 50;
/// Enough to fill the viewport plus a comfortable scroll-up buffer · Görünümü ve rahat bir yukarı kaydırma tamponunu doldurmaya yeter
const YETER: usize = 40;

static IZIN: Semaphore = Semaphore::const_new(2);
static NESIL: AtomicU64 = AtomicU64::new(0);
/// Set at logout: nothing may enter the pool any more · Çıkışta kurulur: havuza artık hiçbir şey girmez
static SICAK_KAPALI: AtomicBool = AtomicBool::new(false);
static SICAK: Mutex<VecDeque<(OwnedRoomId, Arc<Timeline>)>> = Mutex::new(VecDeque::new());

fn sicak() -> std::sync::MutexGuard<'static, VecDeque<(OwnedRoomId, Arc<Timeline>)>> {
    SICAK.lock().unwrap_or_else(|e| e.into_inner())
}

/// Whether the room belongs to the account signed in right now. · Oda şu an girişli hesaba mı ait.
async fn ayni_hesap(app: &AppHandle, room: &matrix_sdk::Room) -> bool {
    match app.state::<AppState>().client().await {
        Ok(c) => c.user_id() == Some(room.own_user_id()),
        Err(_) => false,
    }
}

/// Takes the warm timeline of a room, if there is one. · Odanın sıcak çizelgesini (varsa) alır.
pub fn al(id: &RoomId) -> Option<Arc<Timeline>> {
    let mut s = sicak();
    let i = s.iter().position(|(r, _)| r == id)?;
    s.remove(i).map(|(_, z)| z)
}

/// Puts a timeline into the pool; the least recently used ones fall out. · Çizelgeyi havuza koyar; en eski kullanılanlar düşer.
fn koy(id: OwnedRoomId, z: Arc<Timeline>) {
    let mut s = sicak();
    s.retain(|(r, _)| *r != id);
    s.push_back((id, z));
    let dusen: Vec<_> = if s.len() > EN_COK { let n = s.len() - EN_COK; s.drain(..n).collect() } else { Vec::new() };
    drop(s);
    // Dropped outside the lock. · Kilidin dışında bırakılır.
    drop(dusen);
}

/// The room was closed: keep its timeline warm. · Oda kapandı: çizelgesini sıcak tut.
pub async fn geri_koy(id: OwnedRoomId, z: Arc<Timeline>) {
    if z.items().await.len() <= EN_COK_OGE && !SICAK_KAPALI.load(Ordering::SeqCst) {
        koy(id, z);
    }
}

/// Logout: stop everything, forget everything. · Çıkış: her şeyi durdur, unut.
pub fn bosalt() {
    SICAK_KAPALI.store(true, Ordering::SeqCst);
    NESIL.fetch_add(1, Ordering::SeqCst);
    let eski = std::mem::take(&mut *sicak());
    drop(eski);
}

/// The new list of rooms to keep ready, best first; replaces the previous one. Empty = pause. Returns at once.
/// Hazır tutulacak odaların yeni listesi, en iyi önce; öncekinin yerine geçer. Boş = duraklat. Hemen döner.
#[tauri::command]
pub async fn odalari_hazirla(app: AppHandle, durum: State<'_, AppState>, idler: Vec<String>) -> Sonuc<()> {
    let client = durum.client().await?;
    SICAK_KAPALI.store(false, Ordering::SeqCst);
    let nesil = NESIL.fetch_add(1, Ordering::SeqCst) + 1;
    let idler: Vec<OwnedRoomId> = idler.iter().take(EN_COK).filter_map(|i| RoomId::parse(i).ok()).collect();
    // Already warm: mark as recently wanted, worst first, so the best ones fall out last.
    // Zaten sıcak: yeni istenmiş say; en kötüden başla ki en iyiler en son düşsün.
    {
        let mut s = sicak();
        for id in idler.iter().rev() {
            if let Some(o) = s.iter().position(|(r, _)| r == id).and_then(|i| s.remove(i)) {
                s.push_back(o);
            }
        }
    }
    for id in idler {
        if sicak().iter().any(|(r, _)| *r == id) {
            continue;
        }
        let Some(room) = client.get_room(&id) else { continue };
        if room.state() != RoomState::Joined || room.is_space() {
            continue;
        }
        let app = app.clone();
        // The semaphore is fair: tasks start in the order of the list. · Semafor adildir: görevler listenin sırasıyla başlar.
        tokio::spawn(async move {
            let Ok(_izin) = IZIN.acquire().await else { return };
            let gecerli = || NESIL.load(Ordering::SeqCst) == nesil;
            if !gecerli() || app.state::<AppState>().zamanlar.lock().await.contains_key(&id) || sicak().iter().any(|(r, _)| *r == id) {
                return;
            }
            let bas = Instant::now();
            let zaman = match room.timeline().await {
                Ok(z) => Arc::new(z),
                Err(e) => {
                    warn!("ön yükleme: çizelge kurulamadı: {e}");
                    return;
                }
            };
            if gecerli() && zaman.items().await.len() < YETER {
                match tokio::time::timeout(Duration::from_secs(20), zaman.paginate_backwards(SAYFA)).await {
                    Ok(Ok(_)) => {}
                    // The network or the server is in trouble: leave the rest of this list alone. · Ağ ya da sunucu sıkıntıda: listenin kalanına dokunma.
                    _ => {
                        let _ = NESIL.compare_exchange(nesil, nesil + 1, Ordering::SeqCst, Ordering::SeqCst);
                        return;
                    }
                }
            }
            // Logged out, switched account or opened meanwhile. After an account switch the pool is open again for the NEW
            // account, so the closed flag alone is not enough: the timeline must belong to the account in use now.
            // Bu arada çıkıldı, hesap değişti ya da oda açıldı. Hesap değişince havuz YENİ hesap için yeniden açılır; yalnızca
            // kapalı bayrağı yetmez: çizelge şu an kullanılan hesaba ait olmalı.
            if SICAK_KAPALI.load(Ordering::SeqCst) || !ayni_hesap(&app, &room).await || app.state::<AppState>().zamanlar.lock().await.contains_key(&id) {
                return;
            }
            let hazir = zaman::hazir_kur(&app, &room, &zaman).await;
            if SICAK_KAPALI.load(Ordering::SeqCst) || !ayni_hesap(&app, &room).await {
                return;
            }
            koy(id, zaman);
            let _ = app.emit(OLAY_HAZIR, hazir);
            info!("ön yükleme: oda {} ms'de hazır", bas.elapsed().as_millis());
        });
    }
    Ok(())
}
