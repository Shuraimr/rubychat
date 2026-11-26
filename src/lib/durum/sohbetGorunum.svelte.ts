// Chat look, like WhatsApp: a wallpaper (solid colour or an own photo + dimming) and the message text size.
// One GLOBAL set plus optional per-room overrides ("Yalnızca bu sohbet"). Applied as CSS variables on the room container (`gorunumStili`).
// Sohbet görünümü, WhatsApp gibi: duvar kâğıdı (düz renk ya da kendi fotoğrafın + karartma) ve mesaj yazı boyutu.
// Bir GENEL set ve isteğe bağlı oda başına ayar ("Yalnızca bu sohbet"). Oda kapsayıcısına CSS değişkeni olarak uygulanır (`gorunumStili`).
export type SohbetZemini = "varsayilan" | "amoled" | "mavi" | "yesil" | "mor" | "kirmizi" | "kum" | "gri";

export interface OdaGorunumu {
  /** text scale 0.85 .. 1.3 · yazı ölçeği 0.85 .. 1.3 */
  yazi: number;
  zemin: SohbetZemini;
  /** a photo from the device (stored in IndexedDB by zeminResmi.ts, never uploaded) · cihazdan bir fotoğraf (zeminResmi.ts ile IndexedDB'de, asla yüklenmez) */
  resim: boolean;
  /** dim 0..80 % · karartma 0..80 % */
  karart: number;
}

export const VARSAYILAN_GORUNUM: OdaGorunumu = { yazi: 1, zemin: "varsayilan", resim: false, karart: 25 };

const karisim = (renk: string) => `color-mix(in srgb, ${renk} 18%, var(--zemin))`;
/** Swatch colours (also used by the sheet) · Örnek renkleri (sayfa da kullanır) */
export const ZEMIN_RENKLERI: Record<SohbetZemini, string> = {
  varsayilan: "var(--zemin)",
  amoled: "#000000",
  mavi: karisim("#3F6FD1"),
  yesil: karisim("#3FA56B"),
  mor: karisim("#8A5CD6"),
  kirmizi: karisim("#D1475F"),
  kum: karisim("#C79A4B"),
  gri: karisim("#8E8E96"),
};
export const ZEMINLER = Object.keys(ZEMIN_RENKLERI) as SohbetZemini[];

const ANAHTAR = "rubychat.sohbetGorunum";

function temizle(h: unknown): OdaGorunumu {
  const g = { ...VARSAYILAN_GORUNUM };
  const o = (h ?? {}) as Record<string, unknown>;
  if (typeof o.yazi === "number" && o.yazi >= 0.85 && o.yazi <= 1.3) g.yazi = o.yazi;
  if (ZEMINLER.includes(o.zemin as SohbetZemini)) g.zemin = o.zemin as SohbetZemini;
  if (typeof o.resim === "boolean") g.resim = o.resim;
  if (typeof o.karart === "number" && o.karart >= 0 && o.karart <= 80) g.karart = o.karart;
  return g;
}

function oku(): { genel: OdaGorunumu; odalar: Record<string, OdaGorunumu> } {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as { genel?: unknown; odalar?: Record<string, unknown> };
    const odalar: Record<string, OdaGorunumu> = {};
    for (const [k, v] of Object.entries(h.odalar ?? {})) odalar[k] = temizle(v);
    return { genel: temizle(h.genel), odalar };
  } catch {
    return { genel: { ...VARSAYILAN_GORUNUM }, odalar: {} };
  }
}

class SohbetGorunumu {
  genel = $state<OdaGorunumu>(oku().genel);
  odalar = $state<Record<string, OdaGorunumu>>(oku().odalar);

  /** The look of a room: its own override when there is one, else the global set · Bir odanın görünümü: varsa kendi ayarı, yoksa genel set */
  al(odaId: string | null): OdaGorunumu {
    return (odaId && this.odalar[odaId]) || this.genel;
  }
  ozelMi(odaId: string): boolean {
    return !!this.odalar[odaId];
  }

  #kaydet() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify({ genel: $state.snapshot(this.genel), odalar: $state.snapshot(this.odalar) }));
    } catch {
      /* not persisted · saklanamadı */
    }
  }

  /** Change one option; `odaId` = null → global, else only that room (it starts from the global set) · Bir seçeneği değiştir; `odaId` null → genel, yoksa yalnızca o oda (genel setten başlar) */
  yaz<K extends keyof OdaGorunumu>(odaId: string | null, anahtar: K, deger: OdaGorunumu[K]) {
    if (odaId) {
      this.odalar[odaId] = { ...(this.odalar[odaId] ?? this.genel), [anahtar]: deger };
    } else {
      this.genel[anahtar] = deger;
    }
    this.#kaydet();
  }
  /** Drop a room's override: it follows the global set again · Odanın özel ayarını sil: yeniden genel seti izler */
  odaSifirla(odaId: string) {
    delete this.odalar[odaId];
    this.#kaydet();
  }
  /** Give a room its own copy of the global set (the "Yalnızca bu sohbet" switch) · Odaya genel setin kendi kopyasını ver ("Yalnızca bu sohbet" anahtarı) */
  odaOzellestir(odaId: string) {
    if (!this.odalar[odaId]) this.odalar[odaId] = { ...this.genel };
    this.#kaydet();
  }
}
export const sohbetGorunumu = new SohbetGorunumu();

/** CSS variables for a look; spread on the room container. Bubble geometry comes from density tokens in tokens.css so density and chat zoom compose cleanly. */
/** Bir görünüm için CSS değişkenleri; oda kapsayıcısına verilir. Balon ölçüleri tokens.css yoğunluk değişkenlerinden gelir; yoğunluk ve sohbet ölçeği birlikte çalışır. */
export function gorunumStili(g: OdaGorunumu): string {
  return `--sohbet-yazi: ${g.yazi}; --sohbet-zemin: ${ZEMIN_RENKLERI[g.zemin]};`;
}
