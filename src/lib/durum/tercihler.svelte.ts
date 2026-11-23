// Device preferences that are not "appearance" (those live in ayarlar.svelte.ts): chat, notifications, haptics, link previews, photo quality.
// One JSON blob in localStorage; every key is validated on read so a bad/old value falls back to its default. Only options that are
// really wired somewhere are listed here (see the settings screens).
// Görünüm dışındaki cihaz tercihleri (görünüm ayarlar.svelte.ts'te): sohbet, bildirim, titreşim, bağlantı önizleme, fotoğraf kalitesi.
// localStorage'da tek JSON; her anahtar okunurken doğrulanır, bozuk/eski değer varsayılana düşer. Burada yalnızca gerçekten bir yere
// bağlanmış seçenekler var (ayar ekranlarına bak).
import type { ResimKalitesi } from "../medya/isleme";

export type OnizlemeKipi = "hepsi" | "yt-gh" | "kapali";

export interface TercihDeger {
  titresim: boolean;
  saat24: boolean;
  enterGonder: boolean;
  baglantiOnizleme: OnizlemeKipi;
  sifreliOnizle: boolean;
  resimKalitesi: ResimKalitesi;
  bildirimAcik: boolean;
  bildirimOnizleme: boolean;
  bildirimTitresim: boolean;
  sessizSaatler: boolean;
  sessizBas: string;
  sessizBit: string;
}

const VARSAYILAN: TercihDeger = {
  titresim: true, saat24: true, enterGonder: true, baglantiOnizleme: "hepsi", sifreliOnizle: false, resimKalitesi: "standart",
  bildirimAcik: true, bildirimOnizleme: true, bildirimTitresim: true, sessizSaatler: false, sessizBas: "22:00", sessizBit: "07:00",
};
const ANAHTAR = "rubychat.tercihler";
const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

function oku(): TercihDeger {
  const g = { ...VARSAYILAN };
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Record<string, unknown>;
    for (const k of ["titresim", "saat24", "enterGonder", "sifreliOnizle", "bildirimAcik", "bildirimOnizleme", "bildirimTitresim", "sessizSaatler"] as const) {
      if (typeof h[k] === "boolean") g[k] = h[k] as boolean;
    }
    if (["hepsi", "yt-gh", "kapali"].includes(h.baglantiOnizleme as string)) g.baglantiOnizleme = h.baglantiOnizleme as OnizlemeKipi;
    if (["standart", "yuksek", "orijinal"].includes(h.resimKalitesi as string)) g.resimKalitesi = h.resimKalitesi as ResimKalitesi;
    if (typeof h.sessizBas === "string" && SAAT.test(h.sessizBas)) g.sessizBas = h.sessizBas;
    if (typeof h.sessizBit === "string" && SAAT.test(h.sessizBit)) g.sessizBit = h.sessizBit;
  } catch {
    /* blocked or corrupt storage: defaults · depolama engelli ya da bozuk: varsayılanlar */
  }
  return g;
}

class Tercihler {
  d = $state<TercihDeger>(oku());

  yaz<K extends keyof TercihDeger>(anahtar: K, deger: TercihDeger[K]) {
    this.d[anahtar] = deger;
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify($state.snapshot(this.d)));
    } catch {
      /* not persisted; still applies for this session · saklanamadı; bu oturum için yine geçerli */
    }
  }

  /** Is "now" inside the quiet hours (they may wrap past midnight)? · Şu an sessiz saatlerin içinde mi (gece yarısını aşabilir)? */
  sessizMi(simdi = new Date()): boolean {
    if (!this.d.sessizSaatler) return false;
    const dk = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const n = simdi.getHours() * 60 + simdi.getMinutes();
    const b = dk(this.d.sessizBas);
    const e = dk(this.d.sessizBit);
    return b <= e ? n >= b && n < e : n >= b || n < e;
  }
}
export const tercihler = new Tercihler();
