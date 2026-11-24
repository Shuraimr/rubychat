// Tiny translation helper: t("anahtar", { n: 3 }). Language is read once at load (reload to switch). Falls back tr → key.
// Küçük çeviri yardımcısı: t("anahtar", { n: 3 }). Dil açılışta bir kez okunur (değişince yeniden yüklenir). tr → anahtar yedeği.
import { emojiAdlari } from "./emoji-tr";
import { en } from "./en";
import { tr, type Anahtar } from "./tr";

export type Dil = "tr" | "en";
export type DilSecimi = "sistem" | "tr" | "en";

const DEPO = "rubychat.dil";

/** Saved choice ("sistem" by default). · Kayıtlı seçim (varsayılan "sistem"). */
export function dilSecimi(): DilSecimi {
  try {
    const v = localStorage.getItem(DEPO);
    if (v === "tr" || v === "en") return v;
  } catch { /* storage may be blocked · depo engelli olabilir */ }
  return "sistem";
}

function coz(): Dil {
  const s = dilSecimi();
  if (s !== "sistem") return s;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/** Active language, fixed for this page load. · Etkin dil, bu sayfa yüklemesi için sabit. */
export const dil: Dil = coz();
/** Locale for dates and numbers. · Tarih ve sayılar için yerel ayar. */
export const yerel: string = dil === "tr" ? "tr-TR" : "en-GB";

if (typeof document !== "undefined") document.documentElement.lang = dil;

/** Save the choice and reload so every string switches. · Seçimi kaydet, tüm metinler değişsin diye yeniden yükle. */
export function dilYaz(secim: DilSecimi): void {
  try { localStorage.setItem(DEPO, secim); } catch { /* ignore · yoksay */ }
  location.reload();
}

const tr_: Record<string, string> = tr;
const sozluk: Record<string, string> = dil === "en" ? en : tr_;

export function t(anahtar: Anahtar, degiskenler?: Record<string, string | number>): string {
  let metin = sozluk[anahtar] ?? tr_[anahtar] ?? anahtar;
  if (degiskenler) {
    for (const [k, v] of Object.entries(degiskenler)) metin = metin.replaceAll(`{${k}}`, String(v));
  }
  return metin;
}

export type { Anahtar };

/** Name of a SAS emoji from its English description (English stays as is). · SAS emojisinin adı (İngilizce olduğu gibi kalır). */
export const emojiAdi = (ad: string): string => (dil === "en" ? ad : emojiAdlari[ad] ?? ad);
