// The ONLY network code for link cards. Everything contacts a third party, so every call goes through `agIzni` (the user's setting
// "Bağlantı önizlemeleri" + "Şifreli odalarda da önizle"). Results are cached in memory and, for GitHub stars, in localStorage for 1 hour.
// Bağlantı kartlarının TEK ağ kodu. Hepsi üçüncü bir tarafa bağlanır; bu yüzden her çağrı `agIzni`den (kullanıcının "Bağlantı önizlemeleri" +
// "Şifreli odalarda da önizle" ayarı) geçer. Sonuçlar bellekte, GitHub yıldızı ise 1 saat boyunca localStorage'da önbelleklenir.
import { tercihler } from "../durum/tercihler.svelte";
import type { Baglanti } from "./bul";

/** May we contact YouTube / GitHub for this room? · Bu oda için YouTube / GitHub'a bağlanabilir miyiz? */
export function agIzni(sifreli: boolean): boolean {
  const d = tercihler.d;
  if (d.baglantiOnizleme === "kapali") return false;
  return !sifreli || d.sifreliOnizle;
}
/** Is a card shown at all (without any fetching)? · Kart hiç gösterilsin mi (ağa bağlanmadan)? */
export const kartGoster = (): boolean => tercihler.d.baglantiOnizleme !== "kapali";

export interface YoutubeBilgi {
  baslik: string;
  kanal: string;
}
const ytBellek = new Map<string, Promise<YoutubeBilgi | null>>();
export function youtubeBilgi(url: string): Promise<YoutubeBilgi | null> {
  let p = ytBellek.get(url);
  if (!p) {
    p = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && typeof j.title === "string" ? { baslik: j.title as string, kanal: String(j.author_name ?? "") } : null))
      .catch(() => null);
    ytBellek.set(url, p);
  }
  return p;
}
export const youtubeKucukResim = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeGomme = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;

export const githubGorsel = (b: Baglanti) =>
  `https://opengraph.githubassets.com/1/${b.sahip}/${b.depo}${b.alt ? `/${b.alt.tur === "pull" ? "pull" : "issues"}/${b.alt.no}` : ""}`;

const GH_SURE = 60 * 60 * 1000;
const ghBellek = new Map<string, Promise<number | null>>();
/** Star count of a repository (cached 1 h) · Bir deponun yıldız sayısı (1 saat önbellekli) */
export function githubYildiz(sahip: string, depo: string): Promise<number | null> {
  const anahtar = `rubychat.gh.${sahip}/${depo}`;
  let p = ghBellek.get(anahtar);
  if (!p) {
    try {
      const k = JSON.parse(localStorage.getItem(anahtar) ?? "null") as { y: number; z: number } | null;
      if (k && Date.now() - k.z < GH_SURE) p = Promise.resolve(k.y);
    } catch {
      /* ignore · yok say */
    }
  }
  if (!p) {
    p = fetch(`https://api.github.com/repos/${sahip}/${depo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const y = j && typeof j.stargazers_count === "number" ? (j.stargazers_count as number) : null;
        if (y !== null) {
          try {
            localStorage.setItem(anahtar, JSON.stringify({ y, z: Date.now() }));
          } catch {
            /* ignore · yok say */
          }
        }
        return y;
      })
      .catch(() => null);
  }
  ghBellek.set(anahtar, p);
  return p;
}
