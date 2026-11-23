// Builds URLs for the Rust `medya` URI scheme (Matrix avatar thumbnails).
// Rust `medya` URI şeması için adres üretir (Matrix avatar küçük resimleri).
//
// Android and Windows serve custom schemes as http://<scheme>.localhost/…; macOS/Linux as <scheme>://localhost/….
// Android ve Windows özel şemaları http://<şema>.localhost/… olarak sunar; macOS/Linux <şema>://localhost/… olarak.
const OZEL_SUNUM = /android|windows/i.test(navigator.userAgent);
const KOK = OZEL_SUNUM ? "http://medya.localhost" : "medya://localhost";

/** mxc://server/id → URL of a square thumbnail, sized for `boyut` CSS px on a 2x screen. null if not a valid mxc. */
/** mxc://sunucu/id → kare küçük resmin adresi; `boyut` CSS px'i 2x ekran için boyutlanır. Geçerli mxc değilse null. */
export function avatarUrl(mxc: string | null | undefined, boyut: number): string | null {
  const m = mxc?.match(/^mxc:\/\/([^/]+)\/([^/?#]+)$/);
  if (!m) return null;
  // Round up to multiples of 48 so the disk cache is shared between similar sizes · Disk önbelleği benzer boyutlarda paylaşılsın diye 48'in katına yuvarla
  const px = Math.min(512, Math.ceil((boyut * 2) / 48) * 48);
  return `${KOK}/${m[1]}/${m[2]}?b=${px}`;
}

/** mxc://server/id → a thumbnail that keeps the aspect ratio (custom emoji, sticker pickers), `boyut` CSS px on a 2x screen. null if not a valid mxc. */
/** mxc://sunucu/id → oranı koruyan küçük resim (özel emoji, çıkartma seçicileri), 2x ekranda `boyut` CSS px. Geçerli mxc değilse null. */
export function gorselUrl(mxc: string | null | undefined, boyut: number): string | null {
  const m = mxc?.match(/^mxc:\/\/([^/]+)\/([^/?#]+)$/);
  if (!m) return null;
  const px = Math.min(512, Math.ceil((boyut * 2) / 48) * 48);
  // `o=1` asks the backend to SCALE (keep the ratio) instead of cropping to a square · `o=1` arka uçtan kare kırpmak yerine ÖLÇEKLEMESİNİ (oranı korumasını) ister
  return `${KOK}/${m[1]}/${m[2]}?b=${px}&o=1`;
}
