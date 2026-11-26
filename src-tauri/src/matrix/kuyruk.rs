//! Keeps the rooms' send queues alive, and gets rid of messages that can never be sent.
//! Odaların gönderim kuyruklarını ayakta tutar ve hiç gönderilemeyecek mesajlardan kurtulmayı sağlar.
//!
//! The SDK switches a room's queue OFF after any error and leaves turning it on again to the app; a message it calls "wedged"
//! (file too large, forbidden...) additionally blocks everything queued behind it until it is retried or removed.
//! SDK her hatadan sonra odanın kuyruğunu KAPATIR, yeniden açmayı uygulamaya bırakır; "wedged" dediği mesaj (dosya çok büyük,
//! yasak...) ayrıca yeniden denenene ya da kaldırılana dek arkasındaki her şeyi bekletir.

use std::{sync::Arc, time::Duration};

use matrix_sdk::{ruma::RoomId, Client};
use matrix_sdk_ui::Timeline;
use tokio::task::JoinHandle;
use tracing::warn;

use crate::hata::{Hata, Sonuc};

/// Resumes what an earlier run left behind and re-opens a room's queue after a passing failure (network, server busy).
/// Önceki çalışmadan kalanı sürdürür; geçici hatadan (ağ, meşgul sunucu) sonra odanın kuyruğunu yeniden açar.
pub fn izle(client: Client) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut hatalar = client.send_queue().subscribe_errors();
        client.send_queue().enable_upload_progress(true);
        client.send_queue().respawn_tasks_for_rooms_with_unsent_requests().await;
        let mut bekleme = tokio::time::Duration::from_secs(5);
        let mut son = tokio::time::Instant::now();
        loop {
            let oda_id = match hatalar.recv().await {
                // A wedged message stays at the head, so re-opening is harmless: the rest goes out once it is removed. · Takılan mesaj başta
                // kalır; açmanın zararı yok, o kaldırılınca gerisi gider.
                Ok(h) => h.room_id,
                // Errors were missed, so some rooms may sit with their queue off: re-open all of them after a pause.
                // Hatalar kaçırıldı; bazı odaların kuyruğu kapalı kalmış olabilir: biraz sonra hepsini yeniden aç.
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    let c = client.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(10)).await;
                        c.send_queue().set_enabled(true).await;
                    });
                    continue;
                }
                Err(_) => break,
            };
            // Back off while it keeps failing, so a dead network is not hammered. · Hata sürdükçe aralığı aç; ölü ağ dövülmesin.
            bekleme = if son.elapsed() > Duration::from_secs(120) { Duration::from_secs(5) } else { (bekleme * 2).min(Duration::from_secs(60)) };
            son = tokio::time::Instant::now();
            let (c, sure) = (client.clone(), bekleme);
            tokio::spawn(async move {
                tokio::time::sleep(sure).await;
                if let Some(oda) = c.get_room(&oda_id) {
                    oda.send_queue().set_enabled(true);
                }
            });
        }
    })
}

/// Removes a message that was not sent (or stops one that is being sent) and lets the ones behind it go.
/// Gönderilmemiş mesajı kaldırır (ya da gönderilmekte olanı durdurur) ve arkasındakilerin önünü açar.
pub async fn vazgec(client: &Client, zaman: &Arc<Timeline>, oda_id: &str, oge_id: &str) -> Sonuc<()> {
    let oda = client.get_room(&RoomId::parse(oda_id)?).ok_or(Hata::OdaBulunamadi)?;
    let tutamac = zaman
        .items()
        .await
        .iter()
        .find(|o| o.unique_id().0 == oge_id)
        .and_then(|o| o.as_event().and_then(|e| e.local_echo_send_handle()));
    let sonuc = match tutamac {
        Some(t) => t.abort().await.map_err(|e| Hata::Diger(e.to_string())),
        // Already sent or already gone. · Çoktan gönderilmiş ya da gitmiş.
        None => Ok(false),
    };
    // Also when it failed: the rest must not stay locked. · Başarısız olsa da: gerisi kilitli kalmamalı.
    oda.send_queue().set_enabled(true);
    if !sonuc? {
        warn!("gönderim iptal edilemedi: mesaj artık kuyrukta değil");
    }
    Ok(())
}

/// Server's upload limit against a file about to be queued. A server that does not tell lets it through.
/// Kuyruğa girecek dosyayı sunucunun yükleme sınırıyla karşılaştırır. Sınırını söylemeyen sunucuda geçer.
pub async fn boyut_denetle(client: &Client, boyut: u64) -> Sonuc<()> {
    match tokio::time::timeout(Duration::from_secs(8), client.load_or_fetch_max_upload_size()).await {
        Ok(Ok(sinir)) if boyut > u64::from(sinir) => Err(Hata::DosyaBuyuk(u64::from(sinir) / 1_048_576)),
        _ => Ok(()),
    }
}
