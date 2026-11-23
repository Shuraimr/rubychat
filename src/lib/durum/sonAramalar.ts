// Last searches of the chat-list search (device only, newest first, at most 8). · Sohbet listesi aramasının son aramaları (yalnızca cihazda, en yeni başta, en çok 8).
const ANAHTAR = "rubychat.sonAramalar";
const SINIR = 8;

export function sonAramalariOku(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]");
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(0, SINIR) : [];
  } catch {
    return [];
  }
}
export function sonAramaEkle(s: string): string[] {
  const t = s.trim();
  if ([...t].length < 2) return sonAramalariOku();
  const yeni = [t, ...sonAramalariOku().filter((x) => x !== t)].slice(0, SINIR);
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(yeni));
  } catch {
    /* not persisted · saklanamadı */
  }
  return yeni;
}
export function sonAramalariTemizle(): string[] {
  try {
    localStorage.removeItem(ANAHTAR);
  } catch {
    /* ignore · yok say */
  }
  return [];
}

/** Splits "kimden:ayse açılış" into the sender filter and the text to search. · "kimden:ayse açılış"ı gönderen süzgeci ve aranacak metne ayırır. */
export function sorguAyir(ham: string): { sorgu: string; kimden: string | null } {
  const m = ham.match(/(?:^|\s)kimden:(\S*)/i);
  if (!m) return { sorgu: ham, kimden: null };
  return { sorgu: ham.replace(m[0], " ").replace(/\s+/g, " ").trimStart(), kimden: m[1] || null };
}
