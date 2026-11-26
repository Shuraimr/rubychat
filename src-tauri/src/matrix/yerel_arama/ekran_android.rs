//! Android stand-in for `ekran.rs`: libwebrtc has no screen capture there (it would need MediaProjection), so a share ends at once
//! with an error. The UI does not offer sharing on Android; this only keeps the engine code the same on both systems.
//! `ekran.rs`'in Android karşılığı: orada libwebrtc ekran yakalamaz (MediaProjection gerekirdi); paylaşım hemen hatayla biter.
//! Arayüz Android'de paylaşım sunmaz; bu yalnızca motor kodunun iki sistemde aynı kalmasını sağlar.

use matrix_rtc_transport::VideoFrame;

pub enum YakalamaOlayi {
    #[allow(dead_code)]
    Hazir(u32, u32),
    Hata(String),
    #[allow(dead_code)]
    Bitti,
}

pub struct Yakalama;

impl Yakalama {
    pub fn baslat(_kare: impl Fn(VideoFrame) + Send + Sync + 'static, olay: impl Fn(YakalamaOlayi) + Send + Sync + 'static) -> Yakalama {
        olay(YakalamaOlayi::Hata("Android'de ekran paylaşımı henüz yok".into()));
        Yakalama
    }

    pub fn durdur(&self) {}
}
