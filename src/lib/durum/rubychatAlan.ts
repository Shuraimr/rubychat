// Single source of truth for the official rubychat community Matrix space (used in Explore and Ben › About).
// Resmi rubychat topluluk Matrix alanı için tek tanım noktası (Keşfet ve Ben › Hakkında'da kullanılır).
import { alanlar } from "./alanlar.svelte";
import { odalar } from "./odalar.svelte";

export const RUBYCHAT_ALAN_ID = "!uHysq67cvCecQPL8bCCzIiWLAEIE7LBiCobi0TrlxH4";
export const RUBYCHAT_ALAN_AD = "rubychat";

/** Candidate `via` servers for joining the rubychat space: the user's own homeserver first, then matrix.org. */
/** rubychat alanına katılırken kullanılacak `via` sunucuları: önce kullanıcının kendi sunucusu, sonra matrix.org. */
export function rubychatVia(kullaniciId?: string | null): string[] {
  const benim = kullaniciId ? kullaniciId.split(":").slice(1).join(":") : "";
  return [...new Set([benim, "matrix.org"].filter(Boolean))];
}

/** True when the current account is already a joined member of the rubychat space. */
/** Mevcut hesap rubychat alanının zaten katılmış bir üyesiyse true. */
export function rubychatUyeMi(): boolean {
  return (
    odalar.liste.some((o) => o.id === RUBYCHAT_ALAN_ID && !o.davet) ||
    (alanlar.grafik?.some((a) => a.id === RUBYCHAT_ALAN_ID) ?? false)
  );
}
