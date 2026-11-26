// Room list state: filled by the "odalar-guncellendi" event, filtered locally (all filtering uses fields the backend already sends).
// Oda listesi durumu: "odalar-guncellendi" olayıyla dolar, yerelde süzülür (bütün süzme arka ucun zaten yolladığı alanları kullanır).
import { esitlemeDurumuAl, odalariAl } from "../api/komutlar";
import { esitlemeDurumu, odalarGuncellendi } from "../api/olaylar";
import type { EsitlemeDurumu, OdaOzeti } from "../api/tipler";
import type { BahisKaydi } from "../bicim/bahis";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { ODA_ONBELLEK_ANAHTARI } from "./oturum.svelte";
import { paylas } from "../paylas";

// The top of the room list is remembered between runs so the app opens on it at once, before the backend has restored the session.
// Message previews are left out: the Matrix store on disk is encrypted, this browser storage is not.
// Oda listesinin üst kısmı çalıştırmalar arasında hatırlanır; uygulama arka uç oturumu geri yüklemeden hemen onunla açılır.
// Mesaj önizlemeleri alınmaz: diskteki Matrix deposu şifreli, bu tarayıcı deposu değil.
const ONBELLEK_ODA = 80;
function onbellekOku(kullaniciId: string): OdaOzeti[] {
  try {
    const v = JSON.parse(localStorage.getItem(ODA_ONBELLEK_ANAHTARI) ?? "null") as { k: string; o: OdaOzeti[] } | null;
    return v?.k === kullaniciId && Array.isArray(v.o) ? v.o.filter((o) => o && typeof o.id === "string" && typeof o.ad === "string") : [];
  } catch {
    return [];
  }
}
function onbellekYaz(kullaniciId: string, liste: OdaOzeti[]) {
  try {
    const o = liste.slice(0, ONBELLEK_ODA).map((x) => ({ ...x, sonMesaj: null }));
    localStorage.setItem(ODA_ONBELLEK_ANAHTARI, JSON.stringify({ k: kullaniciId, o }));
  } catch {
    /* full or blocked storage: the next start is only slower · depo dolu ya da engelli: sonraki açılış yalnızca yavaşlar */
  }
}

export type Suzgec = "tumu" | "okunmamis" | "kisiler" | "gruplar" | "davetler";

class Odalar {
  // Raw: the list is only ever replaced whole, so a deep proxy over hundreds of rooms would be pure cost.
  // Ham: liste hep bütün olarak değiştirilir; yüzlerce oda üzerinde derin vekil saf maliyet olurdu.
  liste = $state.raw<OdaOzeti[]>([]);
  esitleme = $state<EsitlemeDurumu>({ durum: "basliyor", mesaj: null });
  /** true after the first room list arrived (to show a skeleton before) · ilk liste gelince true (öncesinde iskelet gösterilir) */
  ilkListeGeldi = $state(false);
  suzgec = $state<Suzgec>("tumu");
  /** Unsent composer text per room (memory only, lost on restart) → "Taslak:" in the chat row. · Oda başına gönderilmemiş yazı (yalnızca bellek, yeniden başlatınca gider) → sohbet satırında "Taslak:". */
  taslaklar = $state<Record<string, string>>({});
  /** Mention spans remembered per room's draft (never leaked across rooms, cleared with draft / logout) · Her oda taslağının hatırlanan bahsetmeleri (odalar arası sızmaz, taslakla / çıkışta silinir) */
  taslakBahisleri = $state<Record<string, BahisKaydi[]>>({});

  #abonelikler: UnlistenFn[] = [];
  #kullanici = "";
  #yazZamanlayici: ReturnType<typeof setTimeout> | null = null;
  /** Shown from the snapshot, the backend has not sent a list yet · Anlık görüntüden gösteriliyor, arka uç henüz liste yollamadı */
  onbellekten = $state(false);

  /** Writes the snapshot at most every few seconds: the list changes with every message. · Görüntüyü en çok birkaç saniyede bir yazar: liste her mesajla değişir. */
  #gelenListe(odalar: OdaOzeti[]) {
    // Unchanged rooms keep their objects: only the rows that really changed re-render. · Değişmeyen odalar nesnelerini korur: yalnızca gerçekten değişen satırlar yeniden çizilir.
    this.liste = paylas(this.liste, odalar, (o) => o.id);
    this.ilkListeGeldi = true;
    this.onbellekten = false;
    if (!this.#kullanici || this.#yazZamanlayici) return;
    const k = this.#kullanici;
    this.#yazZamanlayici = setTimeout(() => {
      this.#yazZamanlayici = null;
      if (k === this.#kullanici) onbellekYaz(k, $state.snapshot(this.liste) as OdaOzeti[]);
    }, 3000);
  }

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

  async baslat(kullaniciId = "") {
    this.durdur();
    this.#kullanici = kullaniciId;
    const onceki = kullaniciId ? onbellekOku(kullaniciId) : [];
    if (onceki.length > 0) {
      this.liste = onceki;
      this.ilkListeGeldi = true;
      this.onbellekten = true;
    }
    this.#abonelikler = [
      await odalarGuncellendi((odalar) => this.#gelenListe(odalar)),
      await esitlemeDurumu((d) => (this.esitleme = d)),
    ];
    // The event may have fired before we subscribed, so ask once too. · Olay biz abone olmadan önce gelmiş olabilir; bir kez de isteriz.
    void esitlemeDurumuAl().then((d) => d && (this.esitleme = d)).catch(() => {});
    try {
      const mevcut = await odalariAl();
      if (mevcut.length > 0) this.#gelenListe(mevcut);
    } catch (e) {
      console.error(e);
    }
  }

  durdur() {
    if (this.#yazZamanlayici) clearTimeout(this.#yazZamanlayici);
    this.#yazZamanlayici = null;
    this.#kullanici = "";
    this.onbellekten = false;
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
