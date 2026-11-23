// Recently used emoji, remembered on this device (localStorage). Failures (private mode, quota) are harmless: the list is just empty.
// Son kullanılan emojiler, bu cihazda hatırlanır (localStorage). Hatalar (gizli mod, kota) zararsız: liste yalnızca boş kalır.
const ANAHTAR = "rubychat.sonEmoji";
const SINIR = 24;

export function sonEmojiler(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, SINIR) : [];
  } catch {
    return [];
  }
}

/** Puts `emoji` first (no duplicates) and returns the new list · `emoji`yi başa koyar (yinelenmeden) ve yeni listeyi döndürür */
export function sonEmojiEkle(emoji: string): string[] {
  const yeni = [emoji, ...sonEmojiler().filter((e) => e !== emoji)].slice(0, SINIR);
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(yeni));
  } catch {
    /* storage unavailable · depolama yok */
  }
  return yeni;
}

// Skin tone chosen per emoji (long press), remembered on this device · Emoji başına seçilen ten rengi (uzun basma), bu cihazda hatırlanır
const TEN = "rubychat.tenRengi";
export function tenSecimleri(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(TEN) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
export function tenSecimiYaz(secim: Record<string, string>) {
  try {
    localStorage.setItem(TEN, JSON.stringify(secim));
  } catch {
    /* storage unavailable · depolama yok */
  }
}
