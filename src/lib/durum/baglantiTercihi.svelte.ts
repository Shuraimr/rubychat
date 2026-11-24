// How web links open (device only): one general choice + a rule per site ("sekme" = tab inside the app, "tarayici" = the browser app, else a package name).
// Web bağlantıları nasıl açılır (yalnızca cihazda): bir genel seçim + site başına kural ("sekme" = uygulama içi sekme, "tarayici" = tarayıcının kendisi, yoksa paket adı).
export type AcmaYolu = string;
export type GenelYol = "sekme" | "tarayici" | "sor";
interface Kural {
  yol: AcmaYolu;
  ad: string;
}
const ANAHTAR = "rubychat.baglantilar";

export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  } catch {
    return "";
  }
}

class BaglantiTercihi {
  genel = $state<GenelYol>("sekme");
  siteler = $state<Record<string, Kural>>({});

  constructor() {
    try {
      const h = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}");
      if (["sekme", "tarayici", "sor"].includes(h.genel)) this.genel = h.genel;
      for (const [s, k] of Object.entries(h.siteler ?? {})) {
        const r = k as Partial<Kural>;
        if (typeof r?.yol === "string" && typeof r?.ad === "string") this.siteler[s] = { yol: r.yol, ad: r.ad };
      }
    } catch {
      /* blocked or corrupt storage: defaults · depolama engelli ya da bozuk: varsayılanlar */
    }
  }
  #yaz() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify({ genel: this.genel, siteler: $state.snapshot(this.siteler) }));
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  genelYaz(g: GenelYol) {
    this.genel = g;
    this.#yaz();
  }
  siteYaz(site: string, k: Kural | null) {
    if (!site) return;
    if (k) this.siteler[site] = k;
    else delete this.siteler[site];
    this.#yaz();
  }
}
export const baglantiTercihi = new BaglantiTercihi();
