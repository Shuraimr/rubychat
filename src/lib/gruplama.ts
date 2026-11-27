// One grouping rule for every message list (room timeline, palette preview), so the same conversation never looks different
// in two places: consecutive messages from the same sender, less than five minutes apart and on the same day, form one group
// and only the first one shows the name.
// Bütün mesaj listeleri (oda akışı, palet önizlemesi) için tek gruplama kuralı; aynı konuşma iki yerde farklı görünmesin:
// aynı kişinin beş dakikadan kısa aralıkla ve aynı gün gönderdiği art arda mesajlar tek grup olur, adı yalnızca ilki gösterir.

/** Max gap between two messages of one group · Bir gruptaki iki mesaj arasındaki en uzun süre */
export const GRUP_ARALIGI = 5 * 60_000;

/** True when `sonra` continues the group started by `once` · `sonra`, `once`nin başlattığı grubu sürdürüyorsa true */
export function ayniGrup(once: { gonderen: string; zaman: number }, sonra: { gonderen: string; zaman: number }): boolean {
  return (
    once.gonderen === sonra.gonderen &&
    sonra.zaman - once.zaman < GRUP_ARALIGI &&
    new Date(once.zaman).toDateString() === new Date(sonra.zaman).toDateString()
  );
}
