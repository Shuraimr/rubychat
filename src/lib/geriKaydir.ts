// Swipe right anywhere to go back: the page follows the finger 1:1, the page under it (`altta`) comes along from -25%, and on release it
// either flies out (far enough or fast enough) or springs back. Horizontal scrollers under the finger keep their own swipe.
// Her yerden sağa kaydırınca geri: sayfa parmağı birebir izler, alttaki sayfa (`altta`) -%25'ten birlikte gelir; bırakınca ya (yeterince
// uzak ya da hızlıysa) çıkar ya da geri yaylanır. Parmağın altındaki yatay kaydırılabilir öğeler kendi kaydırmasını korur.
import { hareketVar } from "./hareket";
import { titret } from "./dokunma";
import { cikisiAtla } from "./gecis";

interface Secenek {
  etkin: () => boolean;
  geri: () => void;
  altta?: () => HTMLElement | null | undefined;
}

function kendiKayar(hedef: EventTarget | null, kok: HTMLElement): boolean {
  for (let e = hedef instanceof Element ? hedef : null; e && e !== kok; e = e.parentElement) {
    if (e.matches('input, textarea, select, video, [role="slider"], [data-kaydirma-yok]')) return true;
    if (e.scrollWidth > e.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.scrollLeft > 0) return true;
  }
  return false;
}

export function geriKaydir(node: HTMLElement, secenek: Secenek) {
  let ayar = secenek;
  let id = -1;
  let bx = 0;
  let by = 0;
  let dx = 0;
  let sonX = 0;
  let sonT = 0;
  let hiz = 0;
  let suruyor = false;
  let ustte: HTMLElement | null = null;
  const yaz = (x: number) => {
    node.style.transform = `translate3d(${x}px,0,0)`;
    if (ustte) ustte.style.transform = `translate3d(${-25 + (x / node.clientWidth) * 25}%,0,0)`;
  };
  const temizle = () => {
    node.style.removeProperty("transform");
    node.style.removeProperty("transition");
    ustte?.style.removeProperty("transform");
    ustte?.style.removeProperty("transition");
    ustte = null;
  };

  const asagi = (e: PointerEvent) => {
    if (id !== -1 || e.pointerType === "mouse" || !e.isPrimary || !ayar.etkin() || kendiKayar(e.target, node)) return;
    id = e.pointerId;
    bx = sonX = e.clientX;
    by = e.clientY;
    sonT = e.timeStamp;
    dx = hiz = 0;
    suruyor = false;
  };
  const oyna = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - bx;
    const my = e.clientY - by;
    if (!suruyor) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      if (mx <= 0 || Math.abs(mx) < Math.abs(my) * 1.5) {
        id = -1;
        return;
      }
      suruyor = true;
      ustte = ayar.altta?.() ?? null;
      node.style.transition = "none";
      if (ustte) ustte.style.transition = "none";
      // The rest of the gesture is ours, wherever the finger goes. · Hareketin kalanı bizim, parmak nereye giderse gitsin.
      try {
        node.setPointerCapture(id);
      } catch {
        /* pointer already gone · işaretçi gitmiş */
      }
    }
    const dt = e.timeStamp - sonT;
    if (dt > 0) hiz = 0.7 * ((e.clientX - sonX) / dt) + 0.3 * hiz;
    sonX = e.clientX;
    sonT = e.timeStamp;
    dx = Math.max(0, mx - 10);
    if (hareketVar()) yaz(dx);
  };
  const bitti = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!suruyor) return;
    suruyor = false;
    const w = node.clientWidth;
    const cik = e.type === "pointerup" && (dx > w * 0.35 || (hiz > 0.5 && dx > 24));
    if (!hareketVar()) {
      temizle();
      if (cik) ayar.geri();
      return;
    }
    const sure = cik ? Math.max(120, Math.min(260, (w - dx) / Math.max(hiz, 1.2))) : 260;
    node.style.transition = `transform ${sure}ms cubic-bezier(.2,.8,.2,1)`;
    if (ustte) ustte.style.transition = node.style.transition;
    yaz(cik ? w : 0);
    if (cik) titret(8);
    setTimeout(() => {
      if (cik) {
        cikisiAtla();
        ayar.geri();
        // Keep the page off-screen until Svelte removes it. · Svelte kaldırana dek sayfa ekran dışında kalsın.
        const u = ustte;
        requestAnimationFrame(() => {
          u?.style.removeProperty("transform");
          u?.style.removeProperty("transition");
          if (node.isConnected) requestAnimationFrame(() => { if (node.isConnected && ayar.etkin()) temizle(); });
        });
      } else temizle();
    }, sure);
  };

  node.addEventListener("pointerdown", asagi);
  node.addEventListener("pointermove", oyna);
  node.addEventListener("pointerup", bitti);
  node.addEventListener("pointercancel", bitti);
  return {
    update(yeni: Secenek) {
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
