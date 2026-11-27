// Deterministic 1–6 gem colour index for a room or user id (djb2 hash), so the same person or room keeps one stable avatar and sender colour across screens.
// Bir oda ya da kullanıcı kimliği için kararlı 1–6 taş renk dizini (djb2 karması); aynı kişi veya oda tüm ekranlarda tek bir avatar ve gönderen rengini korur.

/** Maps a Matrix room or user id to a stable palette index (1..6) for `--kisi-N-*` tokens · Matrix oda veya kullanıcı kimliğini `--kisi-N-*` değişkenleri için kararlı bir renk dizinine (1..6) eşler */
export function kisiRenk(anahtar: string): number {
  let h = 5381;
  for (let i = 0; i < anahtar.length; i++) {
    // Unsigned 32-bit shift-add keeps the modulo non-negative for every string · İşaretsiz 32 bit kaydır-topla her dizgede mod sonucunu negatif olmayan aralıkta tutar
    h = (((h << 5) + h) + anahtar.charCodeAt(i)) >>> 0;
  }
  return (h % 6) + 1;
}
