// Matrix link handling strings (matrix.to and matrix: URIs) · Matrix bağlantıları metinleri (matrix.to ve matrix: adresleri)
import type { trBaglanti } from "./tr-baglanti";

export const enBaglanti: Record<keyof typeof trBaglanti, string> = {
  "matrisBaglanti.acilamadi": "Couldn't open this link",
  "matrisBaglanti.yukleniyor": "Loading room details…",
  "matrisBaglanti.onizlemeYok": "This server doesn't share a preview for this room.",
  "matrisBaglanti.paletAc": "Open link",
  "matrisBaglanti.ayarBaslik": "Open matrix.to links in rubychat",
};
