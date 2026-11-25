// Desktop layout: is the window compact, is the list hidden, is the compact list drawer open.
// Masaüstü düzeni: pencere kompakt mı, liste gizli mi, kompakt liste çekmecesi açık mı.
import { untrack } from "svelte";
import { gezinme } from "./gezinme.svelte";
import { tercihler } from "./tercihler.svelte";

// Below this, rail + list leave the room less than about 660px. · Bunun altında ray + liste odaya yaklaşık 660px'ten az bırakır.
const dar = window.matchMedia("(max-width: 1099px)");

class Duzen {
  #dar = $state(dar.matches);
  cekmece = $state(false);
  #katman = 0;
  kompakt = $derived(gezinme.genis && (tercihler.d.kompakt === "acik" || (tercihler.d.kompakt === "otomatik" && this.#dar)));
  /** Wide window, list hidden; without an open room the list always shows. · Geniş pencere, liste gizli; açık oda yoksa liste hep görünür. */
  listeGizli = $derived(gezinme.genis && !this.kompakt && tercihler.d.listeGizli && !!gezinme.acikOdaId);

  constructor() {
    dar.addEventListener("change", (e) => (this.#dar = e.matches));
    // A chosen room, or a layout without a drawer, closes it. · Seçilen oda ya da çekmecesiz düzen onu kapatır.
    $effect.root(() => {
      $effect(() => {
        void gezinme.acikOdaId;
        void this.kompakt;
        untrack(() => this.cekmeceKapat());
      });
    });
  }

  cekmeceAc() {
    // Without a room the list already fills the window. · Oda yokken liste zaten pencereyi doldurur.
    if (this.cekmece || !gezinme.acikOdaId) return;
    this.cekmece = true;
    this.#katman = gezinme.katmanAc(() => {
      this.#katman = 0;
      this.cekmece = false;
    });
  }
  cekmeceKapat() {
    if (!this.#katman) return;
    const k = this.#katman;
    this.#katman = 0;
    this.cekmece = false;
    gezinme.katmanBirak(k);
  }

  /** The list is on screen (opens it when needed) · Liste ekranda olsun (gerekirse açar) */
  listeGoster() {
    if (this.kompakt) this.cekmeceAc();
    else if (this.listeGizli) tercihler.yaz("listeGizli", false);
  }
  degistir() {
    if (!gezinme.genis) return;
    if (this.kompakt) return this.cekmece ? this.cekmeceKapat() : this.cekmeceAc();
    if (gezinme.acikOdaId) tercihler.yaz("listeGizli", !tercihler.d.listeGizli);
  }
}
export const duzen = new Duzen();
