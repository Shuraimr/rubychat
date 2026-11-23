// The filter chips above the chat list: the user can hide and reorder them (the "+" chip opens the editor). "Tümü" always stays, first.
// Stored in localStorage as an ordered list of ids; unknown ids are dropped and missing ones are appended (so new chips show up later).
// Sohbet listesinin üstündeki süzgeç çipleri: kullanıcı gizleyip sıralayabilir ("+" çipi düzenleyiciyi açar). "Tümü" hep ilk sırada kalır.
// localStorage'da sıralı kimlik listesi olarak saklanır; bilinmeyen kimlikler atılır, eksikler sona eklenir (yeni çipler sonradan görünsün).
import type { Suzgec } from "./odalar.svelte";

export const TUM_CIPLER: Suzgec[] = ["tumu", "okunmamis", "kisiler", "gruplar", "davetler"];
const ANAHTAR = "rubychat.sohbetCipleri";

interface Kayit {
  sira: Suzgec[];
  gizli: Suzgec[];
}

function oku(): Kayit {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Partial<Kayit>;
    const sira = (h.sira ?? []).filter((x): x is Suzgec => TUM_CIPLER.includes(x as Suzgec));
    for (const c of TUM_CIPLER) if (!sira.includes(c)) sira.push(c);
    const gizli = (h.gizli ?? []).filter((x): x is Suzgec => TUM_CIPLER.includes(x as Suzgec) && x !== "tumu");
    return { sira: ["tumu", ...sira.filter((x) => x !== "tumu")], gizli };
  } catch {
    return { sira: [...TUM_CIPLER], gizli: [] };
  }
}

class SohbetChipleri {
  sira = $state<Suzgec[]>(oku().sira);
  gizli = $state<Suzgec[]>(oku().gizli);

  gorunur = $derived(this.sira.filter((c) => !this.gizli.includes(c)));

  #kaydet() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify({ sira: this.sira, gizli: this.gizli }));
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  goster(c: Suzgec, acik: boolean) {
    if (c === "tumu") return;
    this.gizli = acik ? this.gizli.filter((x) => x !== c) : [...this.gizli.filter((x) => x !== c), c];
    this.#kaydet();
  }
  tasi(c: Suzgec, yon: -1 | 1) {
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
