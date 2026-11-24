// The filter chips above the chat list: the user can hide and reorder them (the "+" chip opens the editor). "Tümü" always stays, first.
// Stored in localStorage as an ordered list of ids; unknown ids are dropped and missing ones are appended (so new chips show up later).
// Sohbet listesinin üstündeki süzgeç çipleri: kullanıcı gizleyip sıralayabilir ("+" çipi düzenleyiciyi açar). "Tümü" hep ilk sırada kalır.
// localStorage'da sıralı kimlik listesi olarak saklanır; bilinmeyen kimlikler atılır, eksikler sona eklenir (yeni çipler sonradan görünsün).
import type { Suzgec } from "./odalar.svelte";

/**
 * A folder tab of the chat list: a room filter, or "alanlar" (the spaces overview). Joined top-level spaces get their own extra tabs
 * after "alanlar" (see `alanSekmeleri`); those follow the space list, so they are not part of this stored order.
 * Sohbet listesinin klasör sekmesi: bir oda süzgeci ya da "alanlar" (alanlara genel bakış). Katılınan üst düzey alanlar "alanlar"dan
 * sonra kendi ek sekmelerini alır (bkz. `alanSekmeleri`); onlar alan listesini izler, saklanan sıranın parçası değildir.
 */
export type SekmeId = Suzgec | "alanlar";
export const TUM_CIPLER: SekmeId[] = ["tumu", "kisiler", "gruplar", "alanlar", "okunmamis", "davetler"];
const ANAHTAR = "rubychat.sohbetCipleri";
const ANAHTAR_ALAN = "rubychat.alanSekmeleri";

interface Kayit {
  sira: SekmeId[];
  gizli: SekmeId[];
}

function oku(): Kayit {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Partial<Kayit>;
    const sira = (h.sira ?? []).filter((x): x is SekmeId => TUM_CIPLER.includes(x as SekmeId));
    for (const c of TUM_CIPLER) if (!sira.includes(c)) sira.push(c);
    const gizli = (h.gizli ?? []).filter((x): x is SekmeId => TUM_CIPLER.includes(x as SekmeId) && x !== "tumu");
    return { sira: ["tumu", ...sira.filter((x) => x !== "tumu")], gizli };
  } catch {
    return { sira: [...TUM_CIPLER], gizli: [] };
  }
}

function alanOku(): boolean {
  try {
    return localStorage.getItem(ANAHTAR_ALAN) !== "0"; // default ON · varsayılan AÇIK
  } catch {
    return true;
  }
}

function klasorOku(): boolean {
  try {
    return localStorage.getItem("rubychat.klasorKaydir") === "1"; // default OFF · varsayılan KAPALI
  } catch {
    return false;
  }
}

class SohbetChipleri {
  sira = $state<SekmeId[]>(oku().sira);
  gizli = $state<SekmeId[]>(oku().gizli);
  /** Show each joined top-level space as its own tab · Katılınan her üst düzey alanı kendi sekmesi olarak göster */
  alanSekmeleri = $state<boolean>(alanOku());

  /** Phone: a swipe over the list changes the folder (off = it changes the main page) · Telefon: listede kaydırma klasörü değiştirir (kapalı = ana sayfayı) */
  klasorKaydir = $state<boolean>(klasorOku());

  gorunur = $derived(this.sira.filter((c) => !this.gizli.includes(c)));

  #kaydet() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify({ sira: this.sira, gizli: this.gizli }));
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  alanSekmeleriYaz(acik: boolean) {
    this.alanSekmeleri = acik;
    try {
      localStorage.setItem(ANAHTAR_ALAN, acik ? "1" : "0");
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  klasorKaydirYaz(acik: boolean) {
    this.klasorKaydir = acik;
    try {
      localStorage.setItem("rubychat.klasorKaydir", acik ? "1" : "0");
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  goster(c: SekmeId, acik: boolean) {
    if (c === "tumu") return;
    this.gizli = acik ? this.gizli.filter((x) => x !== c) : [...this.gizli.filter((x) => x !== c), c];
    this.#kaydet();
  }
  tasi(c: SekmeId, yon: -1 | 1) {
    const i = this.sira.indexOf(c);
    const j = i + yon;
    // "Tümü" is pinned to the first place · "Tümü" ilk sıraya sabit
    if (i < 1 || j < 1 || j >= this.sira.length) return;
    const y = [...this.sira];
    [y[i], y[j]] = [y[j], y[i]];
    this.sira = y;
    this.#kaydet();
  }
}
export const sohbetChipleri = new SohbetChipleri();
