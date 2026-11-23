// Swipe-left-to-reply (right is "go back", see geriKaydir): a Svelte action for a message row. A leftward drag of 48px (mostly horizontal) fires `ac`; the row follows the finger
// (max 72px, slightly damped) while the CSS variables `--kay-x` (px) and `--kay-o` (0..1, for the hint icon) are set on the node. With reduced
// motion ("Animasyonları azalt": --hareket is 0) nothing moves or fades, but the 48px swipe still works and vibrates once at the threshold.
// Sola kaydırarak yanıtla (sağ "geri"dir, bkz. geriKaydir): bir mesaj satırı için Svelte eylemi. 48px sola sürükleme (çoğunlukla yatay) `ac`yi çalıştırır; satır parmağı
// izler (en çok 72px, hafif sönümlü); bu sırada düğümde `--kay-x` (px) ve `--kay-o` (0..1, ipucu simgesi için) CSS değişkenleri ayarlanır.
// Azaltılmış harekette (--hareket 0) hiçbir şey kaymaz ya da solmaz, ama 48px kaydırma yine çalışır ve eşikte bir kez titretir.
import { titret } from "./dokunma";

const ESIK = 48;
const EN_COK = 72;

export function kaydirYanit(node: HTMLElement, secenek: { ac: () => void; etkin: boolean }) {
  let ayar = secenek;
  let id = -1;
  let bx = 0;
  let by = 0;
  let dx = 0;
  // Direction is decided once, after 8px: "x" = a leftward swipe (ours), "y" = a scroll (leave it alone). · Yön 8px sonra bir kez belirlenir: "x" = sola kaydırma (bizim), "y" = kaydırma (dokunma).
  let kilit: "x" | "y" | null = null;
  let esikte = false;
  const hareketVar = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hareket")) > 0;

  const yaz = (x: number) => {
    const hareket = hareketVar();
    node.style.setProperty("--kay-x", hareket ? `${-x}px` : "0px");
    node.style.setProperty("--kay-o", hareket ? String(Math.min(1, x / ESIK)) : "0");
  };
  const sifirla = () => {
    // Spring back with a CSS transition on the moving part (set in the component). · Hareketli parçadaki CSS geçişiyle geri yaylan (bileşende tanımlı).
    node.classList.remove("kayiyor");
    node.style.removeProperty("--kay-x");
    node.style.removeProperty("--kay-o");
  };

  const asagi = (e: PointerEvent) => {
    if (!ayar.etkin || e.pointerType === "mouse") return;
    id = e.pointerId;
    bx = e.clientX;
    by = e.clientY;
    dx = 0;
    kilit = null;
    esikte = false;
  };
  const oyna = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - bx;
    const my = e.clientY - by;
    if (kilit === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      kilit = mx < 0 && Math.abs(mx) > Math.abs(my) * 1.5 ? "x" : "y";
      if (kilit === "x") node.classList.add("kayiyor");
    }
    if (kilit !== "x") return;
    dx = Math.max(0, Math.min(-mx, EN_COK * 1.6));
    // Damping after the threshold: the row keeps moving but gets heavier. · Eşikten sonra sönümleme: satır hareket eder ama ağırlaşır.
    const gorunen = dx <= ESIK ? dx : ESIK + (dx - ESIK) * 0.4;
    yaz(Math.min(gorunen, EN_COK));
    if (dx >= ESIK && !esikte) {
      esikte = true;
      titret(10);
    } else if (dx < ESIK) esikte = false;
  };
  const bitti = () => {
    if (id === -1) return;
    const tetik = kilit === "x" && dx >= ESIK;
    id = -1;
    kilit = null;
    sifirla();
    if (tetik) ayar.ac();
  };

  node.style.touchAction = "pan-y";
  node.addEventListener("pointerdown", asagi);
  node.addEventListener("pointermove", oyna);
  node.addEventListener("pointerup", bitti);
  node.addEventListener("pointercancel", bitti);
  return {
    update(yeni: typeof secenek) {
      ayar = yeni;
    },
    destroy() {
      node.removeEventListener("pointerdown", asagi);
      node.removeEventListener("pointermove", oyna);
      node.removeEventListener("pointerup", bitti);
      node.removeEventListener("pointercancel", bitti);
    },
  };
}
