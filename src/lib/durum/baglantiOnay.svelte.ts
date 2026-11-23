// "You are leaving rubychat" confirm for external links. There is no system-browser plugin in the app yet, so the sheet offers
// "Tarayıcıda aç" (window.open, works where the webview allows it) and always "Kopyala".
// Dış bağlantılar için "rubychat'ten ayrılıyorsun" onayı. Uygulamada henüz sistem tarayıcısı eklentisi yok; sayfa
// "Tarayıcıda aç" (window.open, webview izin veriyorsa çalışır) ve her zaman "Kopyala" sunar.
class BaglantiOnay {
  url = $state<string | null>(null);
}
export const baglantiOnay = new BaglantiOnay();
export const baglantiAc = (url: string) => (baglantiOnay.url = url);
