// Links in messages. A tap opens at once, the way the site's rule / the general choice says; the sheet (BaglantiOnay) appears when the choice
// is "ask", when the visible text hides a different address, and on a long press (choose app, remember it for the site, copy, share).
// Mesajlardaki bağlantılar. Dokunmak sitenin kuralına / genel seçime göre hemen açar; sayfa (BaglantiOnay) seçim "sor" ise, görünen yazı
// başka bir adresi gizliyorsa ve uzun basınca gelir (uygulama seç, site için hatırla, kopyala, paylaş).
import { disariAc } from "../disAc";
import { uzunBasma } from "../dokunma";
import { t } from "../i18n";
import { baglantiTercihi, siteOf } from "./baglantiTercihi.svelte";
import { bildirim } from "./bildirim.svelte";

class BaglantiOnay {
  url = $state<string | null>(null);
  /** The text showed something else than this address · Yazı bu adresten başka bir şey gösteriyordu */
  supheli = $state(false);
}
export const baglantiOnay = new BaglantiOnay();

export function baglantiSayfasi(url: string, supheli = false) {
  baglantiOnay.supheli = supheli;
  baglantiOnay.url = url;
}
/** @param gorunen the text of the link, if it is not the address itself · bağlantının yazısı, adresin kendisi değilse */
export function baglantiAc(url: string, gorunen?: string) {
  const site = siteOf(url);
  // Only a text that itself looks like an address can lie about it ("github.com" → another site). · Yalnızca adres gibi duran yazı yalan söyleyebilir ("github.com" → başka site).
  const yazilan = gorunen?.match(/(?:https?:\/\/)?((?:[\p{L}\p{N}-]+\.)+\p{L}{2,})/iu)?.[1];
  const supheli = !!yazilan && siteOf(`https://${yazilan}`) !== site;
  if (supheli || (baglantiTercihi.genel === "sor" && !baglantiTercihi.siteler[site])) return baglantiSayfasi(url, supheli);
  disariAc(url).catch(() => bildirim.goster(t("baglanti.acilamadi"), 4000, { tur: "hata" }));
}

/** Long press on a link; the bubble under it must not open its own menu. · Bağlantıya uzun basma; altındaki balon kendi menüsünü açmamalı. */
export function baglantiBas(node: HTMLElement, url: string) {
  const dur = (e: Event) => e.stopPropagation();
  let adres = url;
  const u = uzunBasma(node, { ac: () => baglantiSayfasi(adres), sure: 380 });
  node.addEventListener("pointerdown", dur);
  node.addEventListener("contextmenu", dur);
  return {
    update(yeni: string) {
      adres = yeni;
    },
    destroy() {
      u.destroy();
      node.removeEventListener("pointerdown", dur);
      node.removeEventListener("contextmenu", dur);
    },
  };
}
