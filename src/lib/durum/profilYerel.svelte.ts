// App-local profile decoration: a banner (picture or colour) and an accent colour for MY user card. Matrix has no profile banner,
// so this lives on this device only (localStorage for the colour, IndexedDB for the picture via zeminResmi.ts) and the UI says so.
// Uygulamaya yerel profil süsü: BENİM kullanıcı kartım için bir banner (resim ya da renk) ve vurgu rengi. Matrix'te profil banner'ı yok;
// bu yüzden yalnızca bu cihazda durur (renk localStorage'da, resim zeminResmi.ts ile IndexedDB'de) ve arayüz bunu söyler.
const ANAHTAR = "rubychat.profilYerel";

interface Kayit {
  renk: string;
  resim: boolean;
}
function oku(): Kayit {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Partial<Kayit>;
    return { renk: typeof h.renk === "string" && /^#[0-9a-f]{6}$/i.test(h.renk) ? h.renk : "", resim: h.resim === true };
  } catch {
    return { renk: "", resim: false };
  }
}

class ProfilYerel {
  /** "" = follow the theme accent · "" = tema vurgusunu izle */
  renk = $state(oku().renk);
  resim = $state(oku().resim);
  #kaydet() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify({ renk: this.renk, resim: this.resim }));
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  renkYaz(r: string) {
    this.renk = r;
    this.#kaydet();
  }
  resimYaz(v: boolean) {
    this.resim = v;
    this.#kaydet();
  }
}
export const profilYerel = new ProfilYerel();
