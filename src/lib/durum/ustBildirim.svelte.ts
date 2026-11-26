// The in-app banner (UstBildirim.svelte): one at a time, supporting both incoming messages and update alerts.
// A second message of the same room updates the card in place (no new animation, only the counter); another room or type replaces it.
// Auto-dismiss after 4000 ms signals the component to play the flight-to-bell animation; tap or swipe dismisses immediately.
// Uygulama içi şerit (UstBildirim.svelte): aynı anda tek; gelen mesajları ve güncelleme uyarılarını destekler.
// Aynı odanın ikinci mesajı kartı yerinde günceller (yeni animasyon yok, yalnızca sayaç); başka oda ya da tür onun yerini alır.
// 4000 ms dolunca kendiliğinden kapanış, bileşene zile uçuş animasyonunu başlatmasını bildirir; dokunma veya kaydırma hemen kapatır.
import type { UygulamaIciBildirim } from "../api/tipler";

const SURE = 4000;

export type UstBildirimKart =
  | (UygulamaIciBildirim & { tur: "mesaj"; n: number; anahtar: string })
  | { tur: "guncelleme"; surum: string; anahtar: string };

class UstBildirim {
  kart = $state<UstBildirimKart | null>(null);
  /** Increments when the 4000 ms timer fires naturally so UstBildirim.svelte can fly the card to the bell target. · 4000 ms kendiliğinden dolunca artar; UstBildirim.svelte kartı zil hedefine uçurur. */
  ucusIstegi = $state(0);
  #z: ReturnType<typeof setTimeout> | undefined;

  goster(b: UygulamaIciBildirim) {
    const onceki = this.kart;
    const n = onceki && onceki.tur === "mesaj" && onceki.odaId === b.odaId ? onceki.n + 1 : 1;
    this.kart = { ...b, tur: "mesaj", n, anahtar: `m:${b.odaId}` };
    this.sur();
  }

  guncellemeGoster(surum: string) {
    this.kart = { tur: "guncelleme", surum, anahtar: `g:${surum}` };
    this.sur();
  }

  /** The finger is on it: wait. · Parmak üstünde: bekle. */
  bekle() {
    clearTimeout(this.#z);
  }

  sur() {
    clearTimeout(this.#z);
    if (!this.kart) return;
    this.#z = setTimeout(() => {
      this.#z = undefined;
      if (this.kart) this.ucusIstegi++;
    }, SURE);
  }

  /** Immediate close (tap, swipe, room opened, logout): no flight animation. · Anında kapatma (dokunma, kaydırma, oda açıldı, çıkış): uçuş yok. */
  kapat() {
    clearTimeout(this.#z);
    this.#z = undefined;
    this.kart = null;
  }

  /** Called by UstBildirim.svelte after the flight / fade finishes for a specific card key. · Uçuş / solma bitince UstBildirim.svelte belirli kart anahtarı için çağırır. */
  bitir(anahtar: string) {
    if (this.kart?.anahtar !== anahtar) return;
    clearTimeout(this.#z);
    this.#z = undefined;
    this.kart = null;
  }
}

export const ustBildirim = new UstBildirim();
