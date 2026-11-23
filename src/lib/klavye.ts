// Keeps the app exactly as tall as the visible area, so the composer stays above the on-screen keyboard.
// `interactive-widget=resizes-content` (index.html) does this in modern Android WebView; this is the fallback
// that also covers webviews which only shrink the *visual* viewport.
// Uygulamayı görünen alan kadar yüksek tutar; yazma alanı ekran klavyesinin üstünde kalır. `interactive-widget=resizes-content`
// (index.html) yeni Android WebView'da bunu yapar; bu, yalnızca *görsel* viewport'u küçülten webview'lar için yedektir.
export function klavyeyiIzle(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const kok = document.documentElement;
  // Keyboard height now (--klavye-simdi) and last known (--klavye-son): the emoji panel takes exactly the keyboard's place.
  // Klavyenin şimdiki (--klavye-simdi) ve bilinen son (--klavye-son) yüksekliği: emoji paneli tam klavyenin yerini alır.
  const ANAHTAR = "rubychat.klavye";
  let enBuyuk = 0;
  let genislik = 0;
  let son = 0;
  try {
    son = Number(localStorage.getItem(ANAHTAR)) || 0;
  } catch { /* storage unavailable · depolama yok */ }
  if (son) kok.style.setProperty("--klavye-son", `${son}px`);
  function klavyeOlc(h: number, w: number) {
    if (w !== genislik) enBuyuk = 0;
    genislik = w;
    enBuyuk = Math.max(enBuyuk, h);
    const k = enBuyuk - h > 120 ? Math.round(enBuyuk - h) : 0;
    kok.style.setProperty("--klavye-simdi", `${k}px`);
    if (k > 180 && k !== son && w < 600) {
      son = k;
      kok.style.setProperty("--klavye-son", `${k}px`);
      try {
        localStorage.setItem(ANAHTAR, String(k));
      } catch { /* same · aynı */ }
    }
  }
  const guncelle = () => {
    klavyeOlc(vv.height, vv.width);
    kok.style.setProperty("--gorunen-yukseklik", `${Math.round(vv.height)}px`);
    // The browser may scroll the page to reveal the focused input; the app never scrolls as a page.
    // Tarayıcı odaktaki girdiyi göstermek için sayfayı kaydırabilir; uygulama hiç sayfa gibi kaymaz.
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };
  vv.addEventListener("resize", guncelle);
  vv.addEventListener("scroll", guncelle);
  guncelle();
  return () => {
    vv.removeEventListener("resize", guncelle);
    vv.removeEventListener("scroll", guncelle);
  };
}
