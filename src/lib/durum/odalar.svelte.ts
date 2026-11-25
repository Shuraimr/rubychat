// Room list state: filled by the "odalar-guncellendi" event, filtered locally (all filtering uses fields the backend already sends).
// Oda listesi durumu: "odalar-guncellendi" olayıyla dolar, yerelde süzülür (bütün süzme arka ucun zaten yolladığı alanları kullanır).
import { esitlemeDurumuAl, odalariAl } from "../api/komutlar";
import { esitlemeDurumu, odalarGuncellendi } from "../api/olaylar";
import type { EsitlemeDurumu, OdaOzeti } from "../api/tipler";
import type { BahisKaydi } from "../bicim/bahis";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type Suzgec = "tumu" | "okunmamis" | "kisiler" | "gruplar" | "davetler";

class Odalar {
  liste = $state<OdaOzeti[]>([]);
  esitleme = $state<EsitlemeDurumu>({ durum: "basliyor", mesaj: null });
  /** true after the first room list arrived (to show a skeleton before) · ilk liste gelince true (öncesinde iskelet gösterilir) */
  ilkListeGeldi = $state(false);
  suzgec = $state<Suzgec>("tumu");
  /** Unsent composer text per room (memory only, lost on restart) → "Taslak:" in the chat row. · Oda başına gönderilmemiş yazı (yalnızca bellek, yeniden başlatınca gider) → sohbet satırında "Taslak:". */
  taslaklar = $state<Record<string, string>>({});
  /** Mention spans remembered per room's draft (never leaked across rooms, cleared with draft / logout) · Her oda taslağının hatırlanan bahsetmeleri (odalar arası sızmaz, taslakla / çıkışta silinir) */
  taslakBahisleri = $state<Record<string, BahisKaydi[]>>({});

  #abonelikler: UnlistenFn[] = [];

  davetler = $derived(this.liste.filter((o) => o.davet));
  /** Number of rooms with something unread (chip + nav badge) · Okunmamış bir şeyi olan oda sayısı (çip + menü rozeti) */
  okunmamisOda = $derived(this.liste.filter((o) => !o.davet && !o.alan && (o.okunmamis > 0 || o.bahsedilme > 0)).length);
  /** Joined spaces are not chats: they live under "Alanlar" and have no message timeline · Katılınan alanlar sohbet değildir: "Alanlar"da durur ve mesaj çizelgeleri yoktur */
  alanlar = $derived(this.liste.filter((o) => o.alan && !o.davet));

  /** Rooms of the quick switcher: pinned, filled up with the most recent ones · Hızlı geçişin odaları: sabitliler, yerini en yeniler doldurur */
  hizli = $derived.by(() => {
    const l = this.liste.filter((o) => !o.davet && !o.alan);
    const s = l.filter((o) => o.sabit);
    return s.length > 0 ? s.slice(0, 7) : l.slice(0, 6);
  });

  /** Invites are shown in their own card (and under the "Davetler" filter), so the other lists exclude them. · Davetler kendi kartında (ve "Davetler" süzgecinde) gösterilir; diğer listeler onları içermez. */
  suz(suzgec: Suzgec): OdaOzeti[] {
    const l = this.liste.filter((o) => {
      if (suzgec === "davetler") return o.davet;
      if (o.davet || o.alan) return false;
      if (suzgec === "okunmamis") return o.okunmamis > 0 || o.bahsedilme > 0;
      if (suzgec === "kisiler") return o.dm;
      if (suzgec === "gruplar") return !o.dm;
      return true;
    });
    // Pinned rooms stay on top, each half keeps its newest-first order. · Sabitliler üstte; iki yarı da en yeni önce sırasını korur.
    return [...l.filter((o) => o.sabit), ...l.filter((o) => !o.sabit)];
  }

  taslakYaz(odaId: string, metin: string, bahisler?: BahisKaydi[]) {
    if (metin.trim()) {
      this.taslaklar[odaId] = metin;
      if (bahisler !== undefined) {
        if (bahisler.length > 0) this.taslakBahisleri[odaId] = [...bahisler];
        else delete this.taslakBahisleri[odaId];
      }
    } else {
      delete this.taslaklar[odaId];
      delete this.taslakBahisleri[odaId];
    }
  }

  /** Appends an `@DisplayName ` mention to a room's draft and remembers its user id (used by KullaniciKarti › Bahset). · Oda taslağına `@GörünenAd ` bahsetmesi ekler ve kullanıcı kimliğini hatırlar (KullaniciKarti › Bahset kullanır). */
  taslakBahisEkle(odaId: string, kullaniciId: string, ad: string) {
    const eski = this.taslaklar[odaId] ?? "";
    const eskiBahisler = this.taslakBahisleri[odaId] ?? [];
    const ayirici = eski && !/\s$/.test(eski) ? " " : "";
    const bas = eski.length + ayirici.length;
    const etiket = `@${ad}`;
    const yeni = `${eski}${ayirici}${etiket} `;
    this.taslakYaz(odaId, yeni, [...eskiBahisler, { bas, son: bas + etiket.length, etiket, kullaniciId }]);
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
    void esitlemeDurumuAl().then((d) => d && (this.esitleme = d)).catch(() => {});
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
    this.taslakBahisleri = {};
    this.esitleme = { durum: "basliyor", mesaj: null };
  }
}

export const odalar = new Odalar();
