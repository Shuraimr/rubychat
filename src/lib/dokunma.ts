// The tactile layer: ONE mechanism for every tappable thing (design 22/10), installed once with `dokunmaBaslat()`.
//  - Press: on pointerdown the element scales to 0.97 and its surface lightens ~8% in 90ms; on release it springs back (220ms, overshoot).
//  - Ripple: elements marked `data-dalga` (rows, cards) get an accent circle (12%) spreading from the touch point in 350ms.
//  - Long press: the `uzunBasma` action (300ms) grows the element to 1.02, vibrates 10ms and calls back.
// It listens on the document (event delegation), so new buttons get the behaviour with no per-component code. Opt out with `data-bas="yok"`.
// Reduced motion ("Animasyonları azalt" or the OS setting: --hareket is 0): no scale, no ripple, only the 8% surface change.
// Dokunsal katman: dokunulabilen HER şey için TEK mekanizma (tasarım 22/10), `dokunmaBaslat()` ile bir kez kurulur.
//  - Basma: pointerdown'da öğe 0.97'ye küçülür ve yüzeyi ~%8 açılır (90ms); bırakınca yayla geri döner (220ms, aşma).
//  - Dalga: `data-dalga` işaretli öğelerde (satır, kart) dokunulan noktadan yayılan vurgu daire (%12, 350ms).
//  - Uzun basma: `uzunBasma` eylemi (300ms) öğeyi 1.02'ye büyütür, 10ms titretir ve geri çağırır.
// Belgeye dinler (olay delegasyonu); yeni düğmeler bileşen başına kod olmadan davranışı alır. `data-bas="yok"` ile kapatılır.
// Azaltılmış hareket (--hareket 0): ölçek yok, dalga yok, yalnızca %8 yüzey değişimi.
import { tercihler } from "./durum/tercihler.svelte";

const HEDEF = 'button, [role="button"], [role="menuitem"], [role="radio"], [role="switch"], a[href], [data-bas]';
const AYDINLIK = "inset 0 0 0 999px color-mix(in srgb, var(--yazi) 8%, transparent)";

const hareketVar = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hareket")) > 0;

/** Vibrate briefly if the device can and the user has not turned haptics off. · Cihaz destekliyorsa ve kullanıcı kapatmadıysa kısa titret. */
export function titret(ms = 10) {
  if (!tercihler.d.titresim) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* some webviews throw · bazı webview'lar hata fırlatır */
  }
}

let aktif: { el: HTMLElement; anim: Animation | null } | null = null;

function birak() {
  if (!aktif) return;
  const { el, anim } = aktif;
  aktif = null;
  const hareket = hareketVar();
  anim?.cancel();
  // Spring back: an overshoot curve gives the "alive" feel. · Yaya dönüş: aşan eğri "canlı" hissi verir.
  if (hareket) el.animate([{ transform: "scale(.97)" }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
}

function dalga(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  const boy = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2;
  const n = document.createElement("span");
  n.setAttribute("aria-hidden", "true");
  n.style.cssText = `position:absolute;left:${x - r.left - boy / 2}px;top:${y - r.top - boy / 2}px;width:${boy}px;height:${boy}px;border-radius:50%;background:var(--vurgu);opacity:.12;pointer-events:none;`;
  el.appendChild(n);
  const a = n.animate([{ transform: "scale(0)", opacity: 0.12 }, { transform: "scale(1)", opacity: 0 }], { duration: 350, easing: "cubic-bezier(.2,.8,.2,1)" });
  a.onfinish = () => n.remove();
}

function bas(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const hedef = e.target instanceof Element ? e.target : null;
  if (!hedef) return;
  const el = hedef.closest<HTMLElement>(HEDEF);
  if (!el || el.matches(":disabled, [aria-disabled='true']") || el.dataset.bas === "yok") return;
  birak();
  const hareket = hareketVar();
  const kare = hareket ? [{ transform: "scale(1)", boxShadow: "inset 0 0 0 0 transparent" }, { transform: "scale(.97)", boxShadow: AYDINLIK }] : [{ boxShadow: "inset 0 0 0 0 transparent" }, { boxShadow: AYDINLIK }];
  // fill: forwards keeps the pressed look until `birak` cancels it · fill: forwards, `birak` iptal edene dek basılı görünümü tutar
  const anim = el.animate(kare, { duration: hareket ? 90 : 60, easing: "ease-out", fill: "forwards" });
  aktif = { el, anim };
  const dalgali = el.closest<HTMLElement>("[data-dalga]");
  if (dalgali && hareket) dalga(dalgali, e.clientX, e.clientY);
}

/** Install once (App.svelte). Returns the undo function. · Bir kez kur (App.svelte). Geri alma fonksiyonunu döndürür. */
export function dokunmaBaslat(): () => void {
  const o = { capture: true, passive: true } as const;
  const kayma = (e: PointerEvent) => {
    // Pointer left the element (scroll / drag): release the press. · İşaretçi öğeden çıktı (kaydırma / sürükleme): basmayı bırak.
    if (aktif && e.target instanceof Node && !aktif.el.contains(e.target) && e.pointerType !== "mouse") birak();
  };
  document.addEventListener("pointerdown", bas, o);
  document.addEventListener("pointerup", birak, o);
  document.addEventListener("pointercancel", birak, o);
  document.addEventListener("pointermove", kayma, o);
  document.addEventListener("scroll", birak, o);
  return () => {
    document.removeEventListener("pointerdown", bas, o);
    document.removeEventListener("pointerup", birak, o);
    document.removeEventListener("pointercancel", birak, o);
    document.removeEventListener("pointermove", kayma, o);
    document.removeEventListener("scroll", birak, o);
  };
}

/**
 * Long-press action: after `sure` ms without moving more than 10px the element grows to 1.02, the phone vibrates 10ms and `ac(x, y)` runs.
 * A normal tap is untouched (the click still fires unless a long press happened: that click is swallowed).
 * Uzun basma eylemi: `sure` ms boyunca 10px'ten fazla oynamazsa öğe 1.02'ye büyür, telefon 10ms titrer ve `ac(x, y)` çalışır.
 * Normal dokunuşa karışmaz (uzun basma olduysa o tıklama yutulur).
 */
export function uzunBasma(node: HTMLElement, secenek: { ac: (x: number, y: number) => void; sure?: number }) {
  let ayar = secenek;
  let z: ReturnType<typeof setTimeout> | undefined;
  let bx = 0;
  let by = 0;
  let oldu = false;
  const iptal = () => clearTimeout(z);
  const asagi = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    oldu = false;
    bx = e.clientX;
    by = e.clientY;
    iptal();
    z = setTimeout(() => {
      oldu = true;
      titret(10);
      if (hareketVar()) node.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.34,1.56,.64,1)" });
      ayar.ac(bx, by);
    }, ayar.sure ?? 300);
  };
  const oyna = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - bx, e.clientY - by) > 10) iptal();
  };
  const yut = (e: Event) => {
    if (oldu) {
      e.stopPropagation();
      e.preventDefault();
      oldu = false;
    }
  };
  const sag = (e: MouseEvent) => {
    e.preventDefault();
    ayar.ac(e.clientX, e.clientY);
  };
  node.addEventListener("pointerdown", asagi);
  node.addEventListener("pointermove", oyna);
  node.addEventListener("pointerup", iptal);
  node.addEventListener("pointercancel", iptal);
  node.addEventListener("click", yut, true);
  node.addEventListener("contextmenu", sag);
  return {
    update(yeni: typeof secenek) {
      ayar = yeni;
    },
    destroy() {
      iptal();
      node.removeEventListener("pointerdown", asagi);
      node.removeEventListener("pointermove", oyna);
      node.removeEventListener("pointerup", iptal);
      node.removeEventListener("pointercancel", iptal);
      node.removeEventListener("click", yut, true);
      node.removeEventListener("contextmenu", sag);
    },
  };
}
