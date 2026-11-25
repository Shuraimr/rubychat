// The clipboard. Desktop Linux goes through GTK (masaustu_linux.rs), the rest through the webview.
// Pano. Masaüstü Linux GTK'den (masaustu_linux.rs), gerisi webview'den geçer.
import { panoResim, panoYaz } from "./api/komutlar";

export const masaustuLinux = /linux/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);

/** Throws when nothing could be written: the caller says so. · Hiçbir şey yazılamazsa hata atar: çağıran söyler. */
export async function panoyaYaz(metin: string): Promise<void> {
  if (masaustuLinux && (await panoYaz(metin).catch(() => false))) return;
  if (navigator.clipboard) return navigator.clipboard.writeText(metin);
  throw new Error("pano yok");
}

/** The picture on the clipboard when the paste event itself carried none · Yapıştırma olayı resim taşımadığında panodaki resim */
export async function panodakiResim(): Promise<File | null> {
  if (!masaustuLinux) return null;
  const bayt = await panoResim().catch(() => null);
  if (!bayt || bayt.byteLength === 0) return null;
  return new File([bayt], `pano-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`, { type: "image/png" });
}
