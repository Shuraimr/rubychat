// Tiny toast store. A toast has an optional kind (icon) and an optional action button ("Yeniden dene").
// Küçük bildirim (toast) deposu. Bir bildirimin isteğe bağlı türü (simge) ve eylem düğmesi ("Yeniden dene") olur.
export type BildirimTuru = "bilgi" | "tamam" | "hata";
export interface BildirimEylemi {
  etiket: string;
  calistir: () => void;
}

class Bildirimler {
  metin = $state<string | null>(null);
  tur = $state<BildirimTuru>("bilgi");
  eylem = $state<BildirimEylemi | null>(null);
  #zamanlayici: ReturnType<typeof setTimeout> | undefined;

  /** Old signature kept: goster("metin", 4000). · Eski imza korunur: goster("metin", 4000). */
  goster(metin: string, sureMs = 4000, secenek: { tur?: BildirimTuru; eylem?: BildirimEylemi } = {}) {
    this.metin = metin;
    this.tur = secenek.tur ?? "bilgi";
    this.eylem = secenek.eylem ?? null;
    clearTimeout(this.#zamanlayici);
    this.#zamanlayici = setTimeout(() => this.kapat(), sureMs);
  }

  kapat() {
    clearTimeout(this.#zamanlayici);
    this.metin = null;
    this.eylem = null;
  }
}
export const bildirim = new Bildirimler();
