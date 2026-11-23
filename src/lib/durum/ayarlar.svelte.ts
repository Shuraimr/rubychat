// Local settings (per device), persisted in localStorage. Storage can be blocked, so every access is wrapped.
// Includes the appearance options (theme, AMOLED, accent, font, text size, reduced motion): they are applied as attributes on <html>
// (CSS in styles/tokens.css reacts to them), and `uygula()` runs at the very top of main.ts so the first paint already has them.
// Yerel ayarlar (cihaza özel), localStorage'da saklanır. Depolama engellenmiş olabilir; her erişim try/catch içindedir.
// Görünüm seçeneklerini (tema, AMOLED, vurgu, yazı tipi, yazı boyutu, azaltılmış hareket) de içerir: <html> üzerinde öznitelik olarak
// uygulanır (styles/tokens.css bunlara tepki verir); `uygula()` main.ts'nin en üstünde çalışır, böylece ilk çizimde hazır olur.
const ANAHTAR = "rubychat.gurultuEngelleme";
const GORUNUM_ANAHTARI = "rubychat.gorunum";

export type Tema = "sistem" | "koyu" | "acik";
export type VurguAdi = "safir" | "zumrut" | "kehribar" | "ametist" | "yakut" | "ozel";
export type YaziTipi = "inter" | "sistem" | "atkinson" | "nunito" | "mono" | "maple";
export type YaziBoyutu = "kucuk" | "normal" | "buyuk";
export type AzAnimasyon = "sistem" | "acik";

interface Gorunum {
  tema: Tema;
  amoled: boolean;
  vurgu: VurguAdi;
  ozelRenk: string;
  yaziTipi: YaziTipi;
  yaziBoyutu: YaziBoyutu;
  azAnimasyon: AzAnimasyon;
}

const VARSAYILAN: Gorunum = { tema: "sistem", amoled: false, vurgu: "safir", ozelRenk: "#9DB4FF", yaziTipi: "inter", yaziBoyutu: "normal", azAnimasyon: "sistem" };

function oku(): boolean {
  try {
    return localStorage.getItem(ANAHTAR) !== "0"; // default ON · varsayılan AÇIK
  } catch {
    return true;
  }
}

/** Read the saved appearance, accepting only known values (a bad/old value falls back to the default). · Kayıtlı görünümü oku; yalnızca bilinen değerler kabul edilir (bozuk/eski değer varsayılana düşer). */
function gorunumOku(): Gorunum {
  const g = { ...VARSAYILAN };
  try {
    const ham = JSON.parse(localStorage.getItem(GORUNUM_ANAHTARI) ?? "{}") as Partial<Gorunum>;
    if (ham.tema === "sistem" || ham.tema === "koyu" || ham.tema === "acik") g.tema = ham.tema;
    if (typeof ham.amoled === "boolean") g.amoled = ham.amoled;
    if (["safir", "zumrut", "kehribar", "ametist", "yakut", "ozel"].includes(ham.vurgu as string)) g.vurgu = ham.vurgu as VurguAdi;
    if (typeof ham.ozelRenk === "string" && /^#[0-9a-f]{6}$/i.test(ham.ozelRenk)) g.ozelRenk = ham.ozelRenk;
    if (["inter", "sistem", "atkinson", "nunito", "mono", "maple"].includes(ham.yaziTipi as string)) g.yaziTipi = ham.yaziTipi as YaziTipi;
    if (ham.yaziBoyutu === "kucuk" || ham.yaziBoyutu === "normal" || ham.yaziBoyutu === "buyuk") g.yaziBoyutu = ham.yaziBoyutu;
    if (ham.azAnimasyon === "sistem" || ham.azAnimasyon === "acik") g.azAnimasyon = ham.azAnimasyon;
  } catch {
    /* blocked or corrupt storage: defaults · depolama engelli ya da bozuk: varsayılanlar */
  }
  return g;
}

/** Black or white text, whichever is more readable on this colour (WCAG relative luminance). · Bu renkte hangisi daha okunaklıysa siyah ya da beyaz yazı (WCAG bağıl parlaklık). */
function okunakliUstRenk(hex: string): string {
  const k = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * k(1) + 0.7152 * k(3) + 0.0722 * k(5);
  // contrast with white = 1.05 / (l + .05), with black = (l + .05) / .05 · beyazla karşıtlık = 1.05 / (l + .05), siyahla = (l + .05) / .05
  return 1.05 / (l + 0.05) > (l + 0.05) / 0.05 ? "#FFFFFF" : "#0A0A0A";
}

class Ayarlar {
  gurultuEngelleme = $state(oku());

  tema = $state<Tema>(VARSAYILAN.tema);
  amoled = $state(VARSAYILAN.amoled);
  vurgu = $state<VurguAdi>(VARSAYILAN.vurgu);
  ozelRenk = $state(VARSAYILAN.ozelRenk);
  yaziTipi = $state<YaziTipi>(VARSAYILAN.yaziTipi);
  yaziBoyutu = $state<YaziBoyutu>(VARSAYILAN.yaziBoyutu);
  azAnimasyon = $state<AzAnimasyon>(VARSAYILAN.azAnimasyon);

  constructor() {
    const g = gorunumOku();
    this.tema = g.tema;
    this.amoled = g.amoled;
    this.vurgu = g.vurgu;
    this.ozelRenk = g.ozelRenk;
    this.yaziTipi = g.yaziTipi;
    this.yaziBoyutu = g.yaziBoyutu;
    this.azAnimasyon = g.azAnimasyon;
  }

  gurultuYaz(deger: boolean) {
    this.gurultuEngelleme = deger;
    try {
      localStorage.setItem(ANAHTAR, deger ? "1" : "0");
    } catch {
      /* not persisted; still applies for this session · saklanamadı; bu oturum için yine geçerli */
    }
  }

  /** Change one appearance option, save and apply at once. · Bir görünüm seçeneğini değiştir, kaydet ve hemen uygula. */
  gorunumYaz<K extends keyof Gorunum>(anahtar: K, deger: Gorunum[K]) {
    (this as unknown as Gorunum)[anahtar] = deger;
    try {
      const g: Gorunum = { tema: this.tema, amoled: this.amoled, vurgu: this.vurgu, ozelRenk: this.ozelRenk, yaziTipi: this.yaziTipi, yaziBoyutu: this.yaziBoyutu, azAnimasyon: this.azAnimasyon };
      localStorage.setItem(GORUNUM_ANAHTARI, JSON.stringify(g));
    } catch {
      /* not persisted; still applies for this session · saklanamadı; bu oturum için yine geçerli */
    }
    this.uygula();
  }

  /** Write the options as attributes / variables on <html>; CSS does the rest. · Seçenekleri <html> üzerine öznitelik / değişken olarak yaz; gerisini CSS yapar. */
  uygula() {
    const kok = document.documentElement;
    kok.dataset.tema = this.tema;
    // Attributes that mean "default" are removed so the base CSS rules apply. · "Varsayılan" anlamındaki öznitelikler kaldırılır; temel CSS kuralları geçerli olur.
    const ayarla = (ad: string, deger: string | null) => (deger === null ? kok.removeAttribute(ad) : kok.setAttribute(ad, deger));
    ayarla("data-amoled", this.amoled ? "" : null);
    ayarla("data-vurgu", this.vurgu === "safir" ? null : this.vurgu);
    ayarla("data-font", this.yaziTipi === "inter" ? null : this.yaziTipi);
    ayarla("data-boyut", this.yaziBoyutu === "normal" ? null : this.yaziBoyutu);
    ayarla("data-az-animasyon", this.azAnimasyon === "acik" ? "" : null);
    const ozel = ["--vurgu", "--vurgu-ustu", "--ton", "--ton-ustu"];
    if (this.vurgu === "ozel") {
      // Custom colour: tones are derived from it with color-mix, the text colour is picked by luminance.
      // Özel renk: tonlar color-mix ile ondan türetilir, yazı rengi parlaklığa göre seçilir.
      kok.style.setProperty("--vurgu", this.ozelRenk);
      kok.style.setProperty("--vurgu-ustu", okunakliUstRenk(this.ozelRenk));
      kok.style.setProperty("--ton", "color-mix(in srgb, var(--vurgu) 22%, var(--zemin))");
      kok.style.setProperty("--ton-ustu", "color-mix(in srgb, var(--vurgu) 28%, var(--yazi))");
    } else {
      for (const d of ozel) kok.style.removeProperty(d);
    }
  }
}
export const ayarlar = new Ayarlar();
