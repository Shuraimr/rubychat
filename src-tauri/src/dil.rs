// App language for native texts (notifications). The webview tells us at start-up and after each change; default = Turkish.
// Yerel metinler (bildirimler) için uygulama dili. Web arayüzü açılışta ve her değişimde bildirir; varsayılan Türkçe.
use std::sync::atomic::{AtomicBool, Ordering};

static EN: AtomicBool = AtomicBool::new(false);

/// True when the app language is English. · Uygulama dili İngilizce mi.
pub fn en() -> bool {
    EN.load(Ordering::Relaxed)
}

/// Set the language (true = English). · Dili ayarla (true = İngilizce).
pub fn ayarla(en: bool) {
    EN.store(en, Ordering::Relaxed);
}

/// Pick the text for the current language. · Geçerli dile göre metni seç.
pub fn sec(tr: &'static str, en_metin: &'static str) -> &'static str {
    if en() { en_metin } else { tr }
}
