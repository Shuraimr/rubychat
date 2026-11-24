// Motion tokens read from JS. The CSS minifier of the release build rewrites `280ms` as `.28s`, so a bare parseFloat() gave 0.28 ms and
// every transition was skipped on the phone: the unit must be read. Values are cached (getComputedStyle forces a style pass every time).
// JS'ten okunan hareket değişkenleri. Yayın derlemesinin CSS küçültücüsü `280ms`i `.28s` yapar; düz parseFloat() 0,28 ms verir ve
// telefonda bütün geçişler atlanırdı: birim okunmalı. Değerler saklanır (getComputedStyle her seferinde stil hesabı zorlar).
const kayit = new Map<string, string>();
new MutationObserver(() => kayit.clear()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-az-animasyon", "data-tema", "class"] });
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => kayit.clear());

function jeton(ad: string): string {
  let v = kayit.get(ad);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    // Not cached until the style sheet is there · Stil dosyası gelene dek saklanmaz
    if (v) kayit.set(ad, v);
  }
  return v;
}
/** A duration token in milliseconds · Milisaniye olarak bir süre değişkeni */
export function sureMs(ad: string): number {
  const v = jeton(ad);
  const n = parseFloat(v);
  return Number.isFinite(n) ? (/\dms$|^ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n) : 0;
}
export const egri = (ad: string) => jeton(ad) || "ease";
export const hareketVar = () => parseFloat(jeton("--hareket")) > 0;
