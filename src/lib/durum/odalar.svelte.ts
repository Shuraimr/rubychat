// Room list state: filled by the "odalar-guncellendi" event, filtered locally (all filtering uses fields the backend already sends).
// Oda listesi durumu: "odalar-guncellendi" olayıyla dolar, yerelde süzülür (bütün süzme arka ucun zaten yolladığı alanları kullanır).
import { odalariAl } from "../api/komutlar";
import { esitlemeDurumu, odalarGuncellendi } from "../api/olaylar";
import type { EsitlemeDurumu, OdaOzeti } from "../api/tipler";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type Suzgec = "tumu" | "okunmamis" | "kisiler" | "gruplar" | "davetler";

class Odalar {
  liste = $state<OdaOzeti[]>([]);
  esitleme = $state<EsitlemeDurumu>({ durum: "basliyor", mesaj: null });
  /** true after the first room list arrived (to show a skeleton before) · ilk liste gelince true (öncesinde iskelet gösterilir) */
  ilkListeGeldi = $state(false);
  arama = $state("");
  suzgec = $state<Suzgec>("tumu");
  /** Unsent composer text per room (memory only, lost on restart) → "Taslak:" in the chat row. · Oda başına gönderilmemiş yazı (yalnızca bellek, yeniden başlatınca gider) → sohbet satırında "Taslak:". */
  taslaklar = $state<Record<string, string>>({});

  #abonelikler: UnlistenFn[] = [];

  davetler = $derived(this.liste.filter((o) => o.davet));
  /** Number of rooms with something unread (chip + nav badge) · Okunmamış bir şeyi olan oda sayısı (çip + menü rozeti) */
  okunmamisOda = $derived(this.liste.filter((o) => !o.davet && (o.okunmamis > 0 || o.bahsedilme > 0)).length);

  /** Invites are shown in their own card (and under the "Davetler" filter), so the main list excludes them. · Davetler kendi kartında (ve "Davetler" süzgecinde) gösterilir; ana liste onları içermez. */
  gorunen = $derived.by(() => {
    const aranan = this.arama.trim().toLocaleLowerCase("tr");
    return this.liste.filter((o) => {
      if (this.suzgec === "davetler") return o.davet && (!aranan || o.ad.toLocaleLowerCase("tr").includes(aranan));
      if (o.davet) return false;
      if (aranan && !o.ad.toLocaleLowerCase("tr").includes(aranan)) return false;
      if (this.suzgec === "okunmamis") return o.okunmamis > 0 || o.bahsedilme > 0;
      if (this.suzgec === "kisiler") return o.dm;
      if (this.suzgec === "gruplar") return !o.dm;
      return true;
    });
  });

  taslakYaz(odaId: string, metin: string) {
    if (metin.trim()) this.taslaklar[odaId] = metin;
    else delete this.taslaklar[odaId];
  }

  async baslat() {
    this.durdur();
    this.#abonelikler = [
      await odalarGuncellendi((odalar) => {
        this.liste = odalar;
        this.ilkListeGeldi = true;
      }),
      await esitlemeDurumu((d) => (this.esitleme = d)),
    ];
    // The event may have fired before we subscribed, so ask once too. · Olay biz abone olmadan önce gelmiş olabilir; bir kez de isteriz.
    try {
      const mevcut = await odalariAl();
      if (mevcut.length > 0) {
        this.liste = mevcut;
        this.ilkListeGeldi = true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  durdur() {
    for (const kapat of this.#abonelikler) kapat();
    this.#abonelikler = [];
    this.liste = [];
    this.ilkListeGeldi = false;
    this.taslaklar = {};
    this.esitleme = { durum: "basliyor", mesaj: null };
  }
}

export const odalar = new Odalar();
