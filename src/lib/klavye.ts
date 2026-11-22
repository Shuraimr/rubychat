// Keeps the app exactly as tall as the visible area, so the composer stays above the on-screen keyboard.
// `interactive-widget=resizes-content` (index.html) does this in modern Android WebView; this is the fallback
// that also covers webviews which only shrink the *visual* viewport.
// Uygulamayı görünen alan kadar yüksek tutar; yazma alanı ekran klavyesinin üstünde kalır. `interactive-widget=resizes-content`
// (index.html) yeni Android WebView'da bunu yapar; bu, yalnızca *görsel* viewport'u küçülten webview'lar için yedektir.
export function klavyeyiIzle(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const kok = document.documentElement;
  const guncelle = () => {
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
