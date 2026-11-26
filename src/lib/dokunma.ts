// The tactile layer: ONE mechanism for every tappable thing (design 22/10), installed once with `dokunmaBaslat()`.
//  - Press: on pointerdown a state layer (8%) appears in 90ms; small controls also shrink to .985. On release both fade back (200ms, no overshoot).
//  - Ripple: elements marked `data-dalga` (rows, cards) get an accent circle (12%) spreading from the touch point in 350ms.
//  - Long press: the `uzunBasma` action (300ms) grows the element to 1.01, gives a heavy haptic and calls back.
// It listens on the document (event delegation), so new buttons get the behaviour with no per-component code. Opt out with `data-bas="yok"`.
// Reduced motion ("Animasyonları azalt" or the OS setting: --hareket is 0): no scale, no ripple, only the 8% surface change.
// Dokunsal katman: dokunulabilen HER şey için TEK mekanizma (tasarım 22/10), `dokunmaBaslat()` ile bir kez kurulur.
//  - Basma: pointerdown'da %8 durum katmanı gelir (90ms); küçük denetimler ayrıca .985'e iner. Bırakınca ikisi de söner (200ms, aşma yok).
//  - Dalga: `data-dalga` işaretli öğelerde (satır, kart) dokunulan noktadan yayılan vurgu daire (%12, 350ms).
//  - Uzun basma: `uzunBasma` eylemi (300ms) öğeyi 1.01'e büyütür, ağır titreşim verir ve geri çağırır.
// Belgeye dinler (olay delegasyonu); yeni düğmeler bileşen başına kod olmadan davranışı alır. `data-bas="yok"` ile kapatılır.
// Azaltılmış hareket (--hareket 0): ölçek yok, dalga yok, yalnızca %8 yüzey değişimi.
import { egri, hareketVar, sureMs } from "./hareket";
import { tercihler } from "./durum/tercihler.svelte";

const HEDEF = 'button, [role="button"], [role="menuitem"], [role="radio"], [role="switch"], a[href], [data-bas]';

/**
 * Haptic kinds. On Android they run on the vibration motor through the native bridge (RubyTitresim, MainActivity.kt) with the system's own
 * effects, so they feel like the rest of the phone; elsewhere `navigator.vibrate` with a short time.
 * Titreşim türleri. Android'de yerel köprüyle (RubyTitresim, MainActivity.kt) titreşim motorunda, sistemin kendi etkileriyle çalışır;
 * telefonun geri kalanı gibi hissettirir. Başka yerde kısa süreli `navigator.vibrate`.
 */
export type TitresimTuru = "tik" | "dokunus" | "agir" | "tamam" | "red";
const YEDEK: Record<TitresimTuru, number | number[]> = { tik: 5, dokunus: 10, agir: 18, tamam: [8, 40, 12], red: [20, 50, 20] };

/** Haptic feedback, if the user has not turned it off. A number (old calls) becomes the nearest kind. · Kullanıcı kapatmadıysa dokunsal geri bildirim. Sayı (eski çağrılar) en yakın türe çevrilir. */
export function titret(tur: TitresimTuru | number = "dokunus") {
  if (!tercihler.d.titresim) return;
  const t: TitresimTuru = typeof tur === "string" ? tur : tur <= 6 ? "tik" : tur <= 12 ? "dokunus" : "agir";
  try {
    const kopru = (window as unknown as { RubyTitresim?: { calis(tur: string): void } }).RubyTitresim;
    if (kopru) kopru.calis(t);
    else navigator.vibrate?.(YEDEK[t]);
  } catch {
    /* some webviews throw · bazı webview'lar hata fırlatır */
  }
}

/** Small controls move a hair (.985); wide surfaces (rows, cards) do not move at all, they only get the state layer. · Küçük denetimler kıl payı oynar (.985); geniş yüzeyler (satır, kart) hiç oynamaz, yalnızca durum katmanı alır. */
const olcek = (el: HTMLElement) => (el.offsetWidth > 120 ? 1 : 0.985);

let aktif: { el: HTMLElement; anim: Animation | null; olcek: number } | null = null;

function birak() {
  if (!aktif) return;
  const { el, anim, olcek: s } = aktif;
  aktif = null;
  el.removeAttribute("data-basili");
  anim?.cancel();
  if (!hareketVar() || s === 1) return;
  // Animate transform only (the 8% state layer comes from [data-basili] without per-frame box-shadow repaint).
  // Yalnızca transform canlanır (%8 durum katmanı kare başına box-shadow boyaması olmadan [data-basili] ile gelir).
  const sure = sureMs("--sure-orta");
  if (sure <= 0) return;
  el.style.willChange = "transform";
  const a = el.animate([{ transform: `scale(${s})` }, { transform: "scale(1)" }], { duration: sure, easing: egri("--egri-vurgulu") });
  const temizle = () => el.style.removeProperty("will-change");
  a.onfinish = temizle;
  a.oncancel = temizle;
}

function dalga(el: HTMLElement, x: number, y: number) {
  const sure = sureMs("--sure-yavas");
  if (sure <= 0) return;
  const r = el.getBoundingClientRect();
  const boy = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2;
  const n = document.createElement("span");
  n.setAttribute("aria-hidden", "true");
  n.style.cssText = `position:absolute;left:${x - r.left - boy / 2}px;top:${y - r.top - boy / 2}px;width:${boy}px;height:${boy}px;border-radius:50%;background:var(--vurgu);opacity:.16;pointer-events:none;will-change:transform,opacity;`;
  el.appendChild(n);
  const a = n.animate([{ transform: "scale(0)", opacity: 0.16 }, { transform: "scale(1)", opacity: 0 }], { duration: sure, easing: egri("--egri-cikis") });
  const sil = () => n.remove();
  a.onfinish = sil;
  a.oncancel = sil;
}

function bas(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const hedef = e.target instanceof Element ? e.target : null;
  if (!hedef) return;
  const el = hedef.closest<HTMLElement>(HEDEF);
  if (!el || el.matches(":disabled, [aria-disabled='true']") || el.dataset.bas === "yok") return;
  birak();
  el.setAttribute("data-basili", "");
  const hareket = hareketVar();
  const s = hareket ? olcek(el) : 1;
  let anim: Animation | null = null;
  if (hareket && s !== 1) {
    const sure = Math.min(90, sureMs("--sure-hizli"));
    if (sure > 0) {
      // fill: forwards keeps the pressed scale until `birak` cancels it · fill: forwards, `birak` iptal edene dek basılı ölçeği tutar
      anim = el.animate([{ transform: "scale(1)" }, { transform: `scale(${s})` }], { duration: sure, easing: egri("--egri-cikis"), fill: "forwards" });
    }
  }
  aktif = { el, anim, olcek: s };
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
      titret("agir");
      if (hareketVar()) {
        const sure = sureMs("--sure-orta");
        if (sure > 0) node.animate([{ transform: "scale(1)" }, { transform: "scale(1.01)" }, { transform: "scale(1)" }], { duration: sure, easing: egri("--egri-vurgulu") });
      }
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
