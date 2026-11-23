// Custom emoji / sticker packs (MSC2545) of the open room: the room's own packs, my personal pack and the room packs I enabled elsewhere.
// Cached per room for 5 minutes (the backend may have to ask the server, because sliding sync does not deliver these custom state events).
// Açık odanın özel emoji / çıkartma paketleri (MSC2545): odanın kendi paketleri, kişisel paketim ve başka yerde açtığım oda paketleri.
// Oda başına 5 dakika önbelleğe alınır (arka uç sunucuya sormak zorunda kalabilir; çünkü sliding sync bu özel durum olaylarını getirmez).
import { emojiPaketleri } from "../api/komutlar";
import type { GorselPaketi, PaketGorseli } from "../api/tipler";

const OMUR_MS = 5 * 60_000;

class Paketler {
  paketler = $state<GorselPaketi[]>([]);
  yukleniyor = $state(false);
  hata = $state(false);

  #onbellek = new Map<string, { zaman: number; paketler: GorselPaketi[] }>();
  #istek = 0;

  async yukle(odaId: string, zorla = false) {
    const eski = this.#onbellek.get(odaId);
    if (!zorla && eski && Date.now() - eski.zaman < OMUR_MS) {
      this.paketler = eski.paketler;
      this.hata = false;
      return;
    }
    // Show what we have (maybe stale) while refreshing. · Yenilerken elimizdekini (belki eski) göster.
    this.paketler = eski?.paketler ?? [];
    const bu = ++this.#istek;
    this.yukleniyor = true;
    this.hata = false;
    try {
      const p = await emojiPaketleri(odaId);
      this.#onbellek.set(odaId, { zaman: Date.now(), paketler: p });
      if (bu === this.#istek) this.paketler = p;
    } catch (e) {
      console.error(e);
      if (bu === this.#istek) this.hata = true;
    } finally {
      if (bu === this.#istek) this.yukleniyor = false;
    }
  }

  temizle() {
    this.#onbellek.clear();
    this.paketler = [];
  }
}
export const paketler = new Paketler();

/** The token that stands for a pack emoji in the composer text: `:blobcat_smile:`. Characters markdown.ts would not match become "_". · Bir paket emojisini yazma alanı metninde temsil eden jeton. markdown.ts'in eşleştirmeyeceği karakterler "_" olur. */
export const emojiJetonu = (g: PaketGorseli): string => g.kisaKod.replace(/[^A-Za-z0-9_+-]/g, "_").slice(0, 64);
