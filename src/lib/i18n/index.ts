// Tiny translation helper: t("anahtar", { n: 3 }). Only Turkish for now; add a language by importing another dictionary.
// Küçük çeviri yardımcısı: t("anahtar", { n: 3 }). Şimdilik yalnızca Türkçe; başka dil için başka sözlük içe aktarılır.
import { emojiAdlari } from "./emoji-tr";
import { tr, type Anahtar } from "./tr";

const sozluk: Record<string, string> = tr;

export function t(anahtar: Anahtar, degiskenler?: Record<string, string | number>): string {
  let metin = sozluk[anahtar] ?? anahtar;
  if (degiskenler) {
    for (const [k, v] of Object.entries(degiskenler)) metin = metin.replaceAll(`{${k}}`, String(v));
  }
  return metin;
}

export type { Anahtar };

/** Turkish name of a SAS emoji from its English description. · SAS emojisinin İngilizce açıklamasından Türkçe adı. */
export const emojiAdi = (ad: string): string => emojiAdlari[ad] ?? ad;
