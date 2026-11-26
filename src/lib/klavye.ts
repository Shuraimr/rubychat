// Keeps the app exactly as tall as the visible area, so the composer stays above the on-screen keyboard.
// `interactive-widget=resizes-content` (index.html) does this in modern Android WebView; this is the fallback
// that also covers webviews which only shrink the *visual* viewport.
// Uygulamayı görünen alan kadar yüksek tutar; yazma alanı ekran klavyesinin üstünde kalır. `interactive-widget=resizes-content`
// (index.html) yeni Android WebView'da bunu yapar; bu, yalnızca *görsel* viewport'u küçülten webview'lar için yedektir.
// While the keyboard is open the WebView shrinks only the VISUAL viewport. A vertical drag that no box under the finger can scroll
// (the emoji tabs, the header, the composer bar) then pans that viewport and the whole app slides up. Such drags are cancelled, only
// while the keyboard is open: a non-passive touch listener makes the browser wait for script on every scroll, so it is not kept on.
// Klavye açıkken WebView yalnızca GÖRSEL viewport'u küçültür. Parmağın altındaki hiçbir kutunun kaydıramadığı dikey bir sürükleme
// (emoji sekmeleri, başlık, yazma çubuğu) o viewport'u kaydırır ve bütün uygulama yukarı kayar. Bu sürüklemeler yalnızca klavye
// açıkken iptal edilir: pasif olmayan dokunma dinleyicisi tarayıcıyı her kaydırmada betiği beklemeye zorlar, sürekli takılı kalmaz.
let koruma = false;
let basX = 0;
let basY = 0;
/** null = not decided yet for this touch, true = cancel its moves · null = bu dokunuş için henüz karar yok, true = hareketlerini iptal et */
let kilitle: boolean | null = null;

function kaydirabilirMi(hedef: EventTarget | null, dy: number): boolean {
  for (let el = hedef instanceof Element ? hedef : null; el && el !== document.body; el = el.parentElement) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable) return true;
    const st = getComputedStyle(el);
    if ((st.overflowY === "auto" || st.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      const sinirda = dy > 0 ? el.scrollTop <= 0 : el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      // It scrolls, or it stops the chain at its edge (overscroll-behavior), so nothing reaches the viewport.
      // Kayar ya da kenarında zinciri durdurur (overscroll-behavior); viewport'a bir şey ulaşmaz.
      if (!sinirda || st.overscrollBehaviorY === "contain" || st.overscrollBehaviorY === "none") return true;
    }
  }
  return false;
}
function dokunmaBasladi(e: TouchEvent) {
  kilitle = null;
  basX = e.touches[0]?.clientX ?? 0;
  basY = e.touches[0]?.clientY ?? 0;
}
function dokunmaOynadi(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  if (kilitle === null) {
    const dx = (e.touches[0]?.clientX ?? 0) - basX;
    const dy = (e.touches[0]?.clientY ?? 0) - basY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    // Sideways drags are the pagers' and swipe-to-reply's; they never pan the viewport vertically.
    // Yana sürüklemeler sayfalayıcıların ve kaydırarak yanıtın; viewport'u dikey kaydırmaz.
    kilitle = Math.abs(dy) > Math.abs(dx) && !kaydirabilirMi(e.target, dy);
  }
  if (kilitle && e.cancelable) e.preventDefault();
}
function surukleKoru(acik: boolean) {
  if (acik === koruma) return;
  koruma = acik;
  if (acik) {
    document.addEventListener("touchstart", dokunmaBasladi, { passive: true });
    document.addEventListener("touchmove", dokunmaOynadi, { passive: false });
  } else {
    document.removeEventListener("touchstart", dokunmaBasladi);
    document.removeEventListener("touchmove", dokunmaOynadi);
  }
}

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
    surukleKoru(k > 0);
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
    // If the visual viewport was panned anyway (the guard below missed a drag, or the browser revealed an input), the app follows it
    // instead of sliding off the screen. A transform only while it is needed: it would make the app a containing block for fixed layers.
    // Görsel viewport yine de kaydırıldıysa (aşağıdaki koruma bir sürüklemeyi kaçırdı ya da tarayıcı bir girdiyi gösterdi) uygulama
    // ekrandan kayıp gitmek yerine onu izler. Dönüşüm yalnızca gerektiğinde: sabit katmanlar için uygulamayı kapsayıcı yapardı.
    const uygulama = document.getElementById("uygulama");
    const ust = Math.round(vv.offsetTop);
    if (uygulama) uygulama.style.translate = ust > 0 ? `0 ${ust}px` : "";
  };
  vv.addEventListener("resize", guncelle);
  vv.addEventListener("scroll", guncelle);
  guncelle();
  return () => {
    vv.removeEventListener("resize", guncelle);
    vv.removeEventListener("scroll", guncelle);
    surukleKoru(false);
  };
}
