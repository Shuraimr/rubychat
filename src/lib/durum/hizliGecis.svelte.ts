// Quick switcher: hold a search button, slide over the popup, release on a chat. `hizliGecis` is the action for such a button; HizliGecis.svelte
// (mounted once in App) draws the popup. Releasing without moving leaves the popup open, so it also works as a normal menu.
// Hızlı geçiş: arama düğmesini basılı tut, açılan listenin üstünde kaydır, bir sohbette bırak. `hizliGecis` o düğmenin eylemidir;
// HizliGecis.svelte (App'te bir kez) listeyi çizer. Kıpırdatmadan bırakmak listeyi açık bırakır; normal menü gibi de çalışır.
import { titret } from "../dokunma";
import { gezinme } from "./gezinme.svelte";

class HizliGecis {
  acik = $state(false);
  /** Button rectangle the popup hangs on · Listenin asıldığı düğme dikdörtgeni */
  yer = $state({ sag: 0, ust: 0, alt: 0 });
  asagi = $state(false);
  secili = $state<string | null>(null);
  #katman = 0;

  ac(r: DOMRect) {
    this.yer = { sag: Math.max(12, innerWidth - r.right - 4), ust: r.top, alt: r.bottom };
    this.asagi = r.top < innerHeight / 2;
    this.secili = null;
    this.acik = true;
    this.#katman = gezinme.katmanAc(() => {
      this.#katman = 0;
      this.acik = false;
      this.secili = null;
    });
  }
  kapat() {
    if (this.#katman) gezinme.katmanKapat(this.#katman);
  }
  git(id: string) {
    this.kapat();
    if (id !== gezinme.acikOdaId) gezinme.odaAc(id);
  }
}
export const hizli = new HizliGecis();

export function hizliGecis(node: HTMLElement) {
  let z: ReturnType<typeof setTimeout> | undefined;
  let kimlik = -1;
  let bx = 0;
  let by = 0;
  let acildi = false;
  let oynadi = false;
  let yut = false;
  node.style.touchAction = "none";
  node.setAttribute("data-kaydirma-yok", "");

  const altindaki = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-hizli]")?.dataset.hizli ?? null;
  const bas = (e: PointerEvent) => {
    if (kimlik !== -1 || (e.pointerType === "mouse" && e.button !== 0)) return;
    kimlik = e.pointerId;
    bx = e.clientX;
    by = e.clientY;
    acildi = oynadi = yut = false;
    z = setTimeout(() => {
      acildi = yut = true;
      titret("agir");
      hizli.ac(node.getBoundingClientRect());
      try {
        node.setPointerCapture(kimlik);
      } catch {
        /* pointer already gone · işaretçi gitmiş */
      }
    }, 260);
  };
  const oyna = (e: PointerEvent) => {
    if (e.pointerId !== kimlik) return;
    const uzak = Math.hypot(e.clientX - bx, e.clientY - by);
    if (!acildi) {
      if (uzak > 10) clearTimeout(z);
      return;
    }
    if (uzak > 12) oynadi = true;
    const id = oynadi ? altindaki(e.clientX, e.clientY) : null;
    if (id !== hizli.secili) {
      hizli.secili = id;
      if (id) titret("tik");
    }
  };
  const birak = (e: PointerEvent) => {
    if (e.pointerId !== kimlik) return;
    kimlik = -1;
    clearTimeout(z);
    if (!acildi) return;
    const id = e.type === "pointerup" ? hizli.secili : null;
    if (id) {
      titret("dokunus");
      hizli.git(id);
    } else if (oynadi) hizli.kapat();
  };
  // The click of the hold itself must not run the button. · Basılı tutmanın tıklaması düğmeyi çalıştırmamalı.
  const tik = (e: Event) => {
    if (!yut) return;
    yut = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  const sag = (e: Event) => e.preventDefault();
  node.addEventListener("pointerdown", bas);
  node.addEventListener("pointermove", oyna);
  node.addEventListener("pointerup", birak);
  node.addEventListener("pointercancel", birak);
  node.addEventListener("click", tik, true);
  node.addEventListener("contextmenu", sag);
  return {
    destroy() {
      clearTimeout(z);
      node.removeEventListener("pointerdown", bas);
      node.removeEventListener("pointermove", oyna);
      node.removeEventListener("pointerup", birak);
      node.removeEventListener("pointercancel", birak);
      node.removeEventListener("click", tik, true);
      node.removeEventListener("contextmenu", sag);
    },
  };
}
