// Chat look: bubble style, text size, density, background, chat accent, timestamps/receipts and group avatars.
// One GLOBAL set (also edited in Ayarlar › Görünüm) plus optional per-room overrides (the customize sheet's "Yalnızca bu sohbet").
// Applied by writing CSS variables / data attributes on the room container (see `uygula`), so the bubbles only read variables.
// Sohbet görünümü: baloncuk stili, yazı boyutu, yoğunluk, arka plan, sohbet rengi, saat/okundu bilgisi ve gruplarda avatar.
// Bir GENEL set (Ayarlar › Görünüm'de de düzenlenir) ve isteğe bağlı oda başına ayarlar (özelleştir sayfasının "Yalnızca bu sohbet" seçeneği).
// Oda kapsayıcısına CSS değişkeni / data özniteliği yazılarak uygulanır (bkz. `uygula`); balonlar yalnızca değişken okur.
export type BalonStili = "yuvarlak" | "koseli" | "cizgisiz";
export type Yogunluk = "rahat" | "siki";
export type SohbetZemini = "varsayilan" | "amoled" | "mavi" | "kirmizi" | "yesil";
export type SohbetRengi = "vurgu" | "mor" | "mavi" | "yesil" | "sari" | "gri";

export interface OdaGorunumu {
  balon: BalonStili;
  /** text scale 0.85 .. 1.3 · yazı ölçeği 0.85 .. 1.3 */
  yazi: number;
  yogunluk: Yogunluk;
  zemin: SohbetZemini;
  renk: SohbetRengi;
  saat: boolean;
  avatar: boolean;
}

export const VARSAYILAN_GORUNUM: OdaGorunumu = { balon: "yuvarlak", yazi: 1, yogunluk: "rahat", zemin: "varsayilan", renk: "vurgu", saat: true, avatar: true };

/** Swatch colours (also used by the sheet) · Örnek renkleri (sayfa da kullanır) */
export const ZEMIN_RENKLERI: Record<SohbetZemini, string> = {
  varsayilan: "var(--zemin)",
  amoled: "#000000",
  mavi: "color-mix(in srgb, #3F6FD1 16%, var(--zemin))",
  kirmizi: "color-mix(in srgb, #D1475F 16%, var(--zemin))",
  yesil: "color-mix(in srgb, #3FA56B 16%, var(--zemin))",
};
export const SOHBET_RENKLERI: Record<Exclude<SohbetRengi, "vurgu">, string> = { mor: "#8A5CD6", mavi: "#3F7FC4", yesil: "#3FB27A", sari: "#E0B040", gri: "#8E8E96" };

const ANAHTAR = "rubychat.sohbetGorunum";
const BALONLAR = ["yuvarlak", "koseli", "cizgisiz"];
const ZEMINLER = ["varsayilan", "amoled", "mavi", "kirmizi", "yesil"];
const RENKLER = ["vurgu", "mor", "mavi", "yesil", "sari", "gri"];

function temizle(h: unknown): OdaGorunumu {
  const g = { ...VARSAYILAN_GORUNUM };
  const o = (h ?? {}) as Record<string, unknown>;
  if (BALONLAR.includes(o.balon as string)) g.balon = o.balon as BalonStili;
  if (typeof o.yazi === "number" && o.yazi >= 0.85 && o.yazi <= 1.3) g.yazi = o.yazi;
  if (o.yogunluk === "rahat" || o.yogunluk === "siki") g.yogunluk = o.yogunluk;
  if (ZEMINLER.includes(o.zemin as string)) g.zemin = o.zemin as SohbetZemini;
  if (RENKLER.includes(o.renk as string)) g.renk = o.renk as SohbetRengi;
  if (typeof o.saat === "boolean") g.saat = o.saat;
  if (typeof o.avatar === "boolean") g.avatar = o.avatar;
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

/** CSS variables + attributes for a look; spread on the room container · Bir görünüm için CSS değişkenleri + öznitelikler; oda kapsayıcısına verilir */
export function gorunumStili(g: OdaGorunumu): string {
  const r = g.balon === "koseli" ? "6px" : "16px";
  const bosluk = g.yogunluk === "siki" ? "5px 10px" : "8px 12px";
  const aralik = g.yogunluk === "siki" ? "1px" : "2px";
  const giden = g.renk === "vurgu" ? "" : `--giden-bg: color-mix(in srgb, ${SOHBET_RENKLERI[g.renk]} 34%, var(--zemin)); --giden-yazi: var(--yazi);`;
  return `--balon-r: ${r}; --balon-dolgu: ${bosluk}; --balon-aralik: ${aralik}; --sohbet-yazi: ${g.yazi}; --sohbet-zemin: ${ZEMIN_RENKLERI[g.zemin]}; ${giden}`;
}
