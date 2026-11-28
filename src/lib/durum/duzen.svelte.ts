// Desktop layout: is the window compact, is the list hidden, is the compact list drawer open, and right People panel state.
// Masaüstü düzeni: pencere kompakt mı, liste gizli mi, kompakt liste çekmecesi açık mı ve sağ Kişiler paneli durumu.
import { untrack } from "svelte";
import { gezinme } from "./gezinme.svelte";
import { tercihler } from "./tercihler.svelte";

// Below this, rail + list leave the room less than about 660px. · Bunun altında ray + liste odaya yaklaşık 660px'ten az bırakır.
const dar = window.matchMedia("(max-width: 1099px)");
// Above 1180px the People panel docks beside the timeline; below it slides over as an overlay. · 1180px üstünde Kişiler paneli çizelgenin yanına yerleşir; altında üstüne kaplama olarak kayar.
const genisMasaustu = window.matchMedia("(min-width: 1181px)");

class Duzen {
  #dar = $state(dar.matches);
  #genisMasaustu = $state(genisMasaustu.matches);
  cekmece = $state(false);
  #katman = 0;
  #kisilerKatman = 0;
  kompakt = $derived(gezinme.genis && (tercihler.d.kompakt === "acik" || (tercihler.d.kompakt === "otomatik" && this.#dar)));
  /** Wide window, list hidden; without an open room the list always shows. · Geniş pencere, liste gizli; açık oda yoksa liste hep görünür. */
  listeGizli = $derived(gezinme.genis && !this.kompakt && tercihler.d.listeGizli && !!gezinme.acikOdaId);
  /** Wide desktop (>1180px): People panel shrinks the room instead of overlaying it. · Geniş masaüstü (>1180px): Kişiler paneli odayı kaplamak yerine daraltır. */
  kisilerYanyana = $derived(gezinme.genis && this.#genisMasaustu);
  /** Right-side People panel is visible on wide screens with an open room. · Sağdaki Kişiler paneli geniş ekranda açık oda varken görünür. */
  kisilerAcik = $derived(gezinme.genis && !!gezinme.acikOdaId && tercihler.d.kisilerPaneli);
  /** Tablet / narrow desktop: People panel overlays the room with a scrim and back/Esc layer. · Tablet / dar masaüstü: Kişiler paneli perde ve geri/Esc katmanıyla odayı kaplar. */
  kisilerKaplama = $derived(this.kisilerAcik && !this.kisilerYanyana);

  constructor() {
    dar.addEventListener("change", (e) => (this.#dar = e.matches));
    genisMasaustu.addEventListener("change", (e) => (this.#genisMasaustu = e.matches));
    // A chosen room, or a layout without a drawer, closes it. · Seçilen oda ya da çekmecesiz düzen onu kapatır.
    $effect.root(() => {
      $effect(() => {
        void gezinme.acikOdaId;
        void this.kompakt;
        untrack(() => this.cekmeceKapat());
      });
      // Explore uses a permanent directory column in compact mode, so close any open drawer and drop its layer.
      // Keşfet kompakt kipte kalıcı dizin sütunu kullanır; açık çekmeceyi kapatıp katmanını bırak.
      $effect(() => {
        if (gezinme.sekme === "kesfet") untrack(() => this.cekmeceKapat());
      });
      // Register a layer only while the People panel is an overlay (tablet / narrow desktop). · Kişiler paneli yalnızca kaplama iken katman kaydet (tablet / dar masaüstü).
      $effect(() => {
        const kaplama = this.kisilerKaplama;
        untrack(() => {
          if (kaplama && !this.#kisilerKatman) {
            this.#kisilerKatman = gezinme.katmanAc(() => {
              this.#kisilerKatman = 0;
              tercihler.yaz("kisilerPaneli", false);
            });
          } else if (!kaplama && this.#kisilerKatman) {
            const k = this.#kisilerKatman;
            this.#kisilerKatman = 0;
            gezinme.katmanBirak(k);
          }
        });
      });
    });
  }

  cekmeceAc() {
    // Without a room/settings the list already fills the window, and Explore is a permanent column.
    // Oda/ayar yokken liste zaten pencereyi doldurur; Keşfet ise kalıcı sütundur.
    if (this.cekmece || gezinme.sekme === "kesfet" || (!gezinme.acikOdaId && !gezinme.odaAyar)) return;
    this.cekmece = true;
    this.#katman = gezinme.katmanAc(() => {
      this.#katman = 0;
      this.cekmece = false;
    });
  }
  cekmeceKapat() {
    if (!this.cekmece && !this.#katman) return;
    this.cekmece = false;
    if (!this.#katman) return;
    const k = this.#katman;
    this.#katman = 0;
    gezinme.katmanBirak(k);
  }

  /** The list is on screen (opens it when needed) · Liste ekranda olsun (gerekirse açar) */
  listeGoster() {
    if (this.kompakt) this.cekmeceAc();
    else if (this.listeGizli) tercihler.yaz("listeGizli", false);
  }
  degistir() {
    if (!gezinme.genis) return;
    if (this.kompakt) {
      if (gezinme.sekme === "kesfet") {
        gezinme.sekmeSec("sohbetler");
        this.cekmeceAc();
        return;
      }
      return this.cekmece ? this.cekmeceKapat() : this.cekmeceAc();
    }
    if (gezinme.acikOdaId) tercihler.yaz("listeGizli", !tercihler.d.listeGizli);
  }

  kisilerAc() {
    if (!gezinme.genis || !gezinme.acikOdaId) return;
    if (!tercihler.d.kisilerPaneli) tercihler.yaz("kisilerPaneli", true);
  }
  kisilerKapat() {
    if (!tercihler.d.kisilerPaneli) return;
    tercihler.yaz("kisilerPaneli", false);
    if (this.#kisilerKatman) {
      const k = this.#kisilerKatman;
      this.#kisilerKatman = 0;
      gezinme.katmanBirak(k);
    }
  }
  kisilerDegistir() {
    if (this.kisilerAcik) this.kisilerKapat();
    else this.kisilerAc();
  }
}
export const duzen = new Duzen();
