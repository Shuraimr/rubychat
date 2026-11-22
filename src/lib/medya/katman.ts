// Back-button layers for the media screens (crop screen → media flow → viewer). A thin adapter over the app's single layer stack
// (durum/gezinme.svelte.ts), so Android back / Escape always closes the TOP-most thing, whichever part of the app opened it.
// Medya ekranları için geri tuşu katmanları (kırpma ekranı → medya akışı → görüntüleyici). Uygulamanın tek katman yığını
// (durum/gezinme.svelte.ts) üzerinde ince bir uyarlayıcı; böylece Android geri / Escape, uygulamanın hangi parçası açmış olursa olsun
// her zaman EN ÜSTTEKİ şeyi kapatır.
import { gezinme } from "../durum/gezinme.svelte";

/** Opens a layer. `geriGelince` runs when the layer is closed by back/Escape OR by `kapat()`. */
/** Katman açar. `geriGelince`, katman geri/Escape ile YA DA `kapat()` ile kapanınca çalışır. */
export function katmanAc(_ad: string, geriGelince: () => void) {
  let acik = true;
  const id = gezinme.katmanAc(() => {
    acik = false;
    geriGelince();
  });
  return {
    /** Close it by hand: goes through history.back(), which then runs `geriGelince`. · Elle kapat: history.back() üzerinden gider, o da `geriGelince`yi çalıştırır. */
    kapat() {
      if (acik) gezinme.katmanKapat(id);
    },
    /** The component is going away: drop the layer without calling `geriGelince`. · Bileşen gidiyor: `geriGelince`yi çağırmadan katmanı bırak. */
    birak() {
      if (!acik) return;
      acik = false;
      gezinme.katmanBirak(id);
    },
  };
}
