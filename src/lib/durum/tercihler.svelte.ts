// Device preferences that are not "appearance" (those live in ayarlar.svelte.ts): chat, notifications, haptics, link previews, photo quality.
// One JSON blob in localStorage; every key is validated on read so a bad/old value falls back to its default. Only options that are
// really wired somewhere are listed here (see the settings screens).
// Görünüm dışındaki cihaz tercihleri (görünüm ayarlar.svelte.ts'te): sohbet, bildirim, titreşim, bağlantı önizleme, fotoğraf kalitesi.
// localStorage'da tek JSON; her anahtar okunurken doğrulanır, bozuk/eski değer varsayılana düşer. Burada yalnızca gerçekten bir yere
// bağlanmış seçenekler var (ayar ekranlarına bak).
import type { ResimKalitesi } from "../medya/isleme";

/** Side-by-side layout in narrow windows: room strip instead of rail + list · Dar pencerede yan yana düzen: ray + liste yerine oda şeridi */
export type Kompakt = "otomatik" | "acik" | "kapali";
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
  /** keep the sync alive in the background (Android foreground service) · eşitlemeyi arka planda canlı tut (Android ön plan servisi) */
  arkaPlan: boolean;
  /** KLIPY API key for the GIF tab: stored on this device only, never committed · GIF sekmesi için KLIPY API anahtarı: yalnızca bu cihazda, asla commit'lenmez */
  klipyAnahtar: string;
  kompakt: Kompakt;
  /** Rail and list hidden with Ctrl+E (wide window) · Ray ve liste Ctrl+E ile gizli (geniş pencere) */
  listeGizli: boolean;
  /** vim-style keys (lib/klavyeKisayol.ts) · vim tarzı tuşlar */
  vim: boolean;
}

const VARSAYILAN: TercihDeger = {
  titresim: true, saat24: true, enterGonder: true, baglantiOnizleme: "hepsi", sifreliOnizle: false, resimKalitesi: "standart",
  bildirimAcik: true, bildirimOnizleme: true, bildirimTitresim: true, arkaPlan: true,
  klipyAnahtar: "", kompakt: "otomatik", listeGizli: false, vim: false,
};
const ANAHTAR = "rubychat.tercihler";

function oku(): TercihDeger {
  const g = { ...VARSAYILAN };
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Record<string, unknown>;
    for (const k of ["titresim", "saat24", "enterGonder", "sifreliOnizle", "bildirimAcik", "bildirimOnizleme", "bildirimTitresim", "arkaPlan", "listeGizli", "vim"] as const) {
      if (typeof h[k] === "boolean") g[k] = h[k] as boolean;
    }
    if (["hepsi", "yt-gh", "kapali"].includes(h.baglantiOnizleme as string)) g.baglantiOnizleme = h.baglantiOnizleme as OnizlemeKipi;
    if (["standart", "yuksek", "orijinal"].includes(h.resimKalitesi as string)) g.resimKalitesi = h.resimKalitesi as ResimKalitesi;
    if (["otomatik", "acik", "kapali"].includes(h.kompakt as string)) g.kompakt = h.kompakt as Kompakt;
    if (typeof h.klipyAnahtar === "string" && h.klipyAnahtar.length < 200) g.klipyAnahtar = h.klipyAnahtar.trim();
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
}
export const tercihler = new Tercihler();
