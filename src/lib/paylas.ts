// Structural sharing for lists the backend re-sends whole (room list, timeline). Every update arrives as fresh objects, so Svelte would
// re-render every row even when only one message changed. Items whose content is unchanged get their OLD object back: their rows keep
// the same props and do no work. When nothing changed at all, the old array itself comes back, so nothing downstream reacts.
// Arka ucun bütün olarak yeniden yolladığı listeler (oda listesi, zaman çizelgesi) için yapısal paylaşım. Her güncelleme yeni nesnelerle
// gelir; Svelte, yalnızca bir mesaj değişse bile her satırı yeniden çizerdi. İçeriği değişmeyen öğelere ESKİ nesneleri geri verilir:
// satırları aynı prop'ları alır ve iş yapmaz. Hiçbir şey değişmediyse eski dizinin kendisi döner; aşağıda hiçbir şey tepki vermez.

/** Serialized form of objects we already compared, so each old item is stringified once. · Karşılaştırılmış nesnelerin dizgi hâli; her eski öğe bir kez dizgiye çevrilir. */
const imzalar = new WeakMap<object, string>();

function imza(o: object): string {
  let s = imzalar.get(o);
  if (s === undefined) {
    s = JSON.stringify(o);
    imzalar.set(o, s);
  }
  return s;
}

/** `anahtar` must be unique within a list (duplicates simply fall back to the new object). · `anahtar` liste içinde benzersiz olmalı (yinelenenler yeni nesneye düşer). */
export function paylas<T extends object>(eski: readonly T[], yeni: T[], anahtar: (o: T) => string): T[] {
  if (eski.length === 0) return yeni;
  const eskiler = new Map<string, T>();
  for (const o of eski) eskiler.set(anahtar(o), o);
  let degisti = eski.length !== yeni.length;
  const sonuc = new Array<T>(yeni.length);
  for (let i = 0; i < yeni.length; i++) {
    const o = yeni[i];
    const e = eskiler.get(anahtar(o));
    if (e !== undefined && imza(e) === imza(o)) {
      sonuc[i] = e;
      if (eski[i] !== e) degisti = true;
    } else {
      sonuc[i] = o;
      degisti = true;
    }
  }
  return degisti ? sonuc : (eski as T[]);
}
