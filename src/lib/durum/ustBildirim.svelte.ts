// The in-app message banner (UstBildirim.svelte): one at a time. A second message of the same room updates the card in place (no new
// animation, only the counter); another room replaces it.
// Uygulama içi mesaj şeridi (UstBildirim.svelte): aynı anda tek. Aynı odanın ikinci mesajı kartı yerinde günceller (yeni animasyon yok,
// yalnızca sayaç); başka oda onun yerini alır.
import type { UygulamaIciBildirim } from "../api/tipler";

const SURE = 5000;

class UstBildirim {
  kart = $state<(UygulamaIciBildirim & { n: number }) | null>(null);
  #z: ReturnType<typeof setTimeout> | undefined;

  goster(b: UygulamaIciBildirim) {
    this.kart = { ...b, n: this.kart?.odaId === b.odaId ? this.kart.n + 1 : 1 };
    this.sur();
  }
  /** The finger is on it: wait. · Parmak üstünde: bekle. */
  bekle() {
    clearTimeout(this.#z);
  }
  sur() {
    clearTimeout(this.#z);
    this.#z = setTimeout(() => this.kapat(), SURE);
  }
  kapat() {
    clearTimeout(this.#z);
    this.kart = null;
  }
}
export const ustBildirim = new UstBildirim();
