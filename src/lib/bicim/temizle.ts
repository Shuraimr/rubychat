// Safe rendering of received `formatted_body` HTML. The HTML is parsed by DOMParser into an INERT document (no script runs, no image
// loads), walked once and copied into a plain token tree that contains ONLY whitelisted tags and attributes. The UI draws that tree
// with normal Svelte markup (BicimDugum.svelte): the received string is never given to innerHTML / {@html}, so a hostile message cannot
// inject anything. The backend (ruma's sanitizer) already cleans the body; this is the second, independent layer.
// Alınan `formatted_body` HTML'inin güvenli çizimi. HTML, DOMParser ile ETKİSİZ bir belgeye ayrıştırılır (betik çalışmaz, resim
// yüklenmez), bir kez gezilir ve YALNIZCA beyaz listedeki etiket ve öznitelikleri içeren düz bir jeton ağacına kopyalanır. Arayüz bu
// ağacı normal Svelte işaretlemesiyle çizer (BicimDugum.svelte): alınan metin asla innerHTML / {@html}'e verilmez, düşmanca bir mesaj
// hiçbir şey enjekte edemez. Arka uç (ruma'nın temizleyicisi) gövdeyi zaten temizler; bu ikinci, bağımsız katmandır.

import { matrisBaglantiCoz } from "../matrisBaglanti";

export type EtiketAdi =
  | "strong" | "em" | "u" | "del" | "code" | "pre" | "blockquote" | "ul" | "ol" | "li" | "br" | "p"
  | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "spoiler" | "a" | "emoji" | "span";

export interface Pill {
  tur: "kullanici" | "oda";
  /** @user:server, !room:server or #alias:server */
  kimlik: string;
}

export type Dugum =
  | { t: "m"; v: string }
  | { t: "e"; etiket: EtiketAdi; cocuk: Dugum[]; href?: string; pill?: Pill; mxc?: string; alt?: string };

/** tag → our tag name; `b`/`i`/`s`/`strike` are folded into the semantic ones · etiket → bizim etiket adı; `b`/`i`/`s`/`strike` anlamlı olanlara katlanır */
const IZINLI: Record<string, EtiketAdi> = {
  b: "strong", strong: "strong", i: "em", em: "em", u: "u", s: "del", del: "del", strike: "del",
  code: "code", pre: "pre", blockquote: "blockquote", ul: "ul", ol: "ol", li: "li", br: "br", p: "p",
  h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", a: "a", span: "span", img: "emoji",
};
/** Dropped together with everything inside · İçindekilerle birlikte atılır */
const ATILAN = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript", "mx-reply", "head", "title"]);

const SINIR_DERINLIK = 24;
const SINIR_DUGUM = 3000;
const SINIR_METIN = 20_000;

/** Matrix permalinks (matrix.to / matrix:): users and rooms become pills · Matrix bağlantıları (matrix.to / matrix:): kullanıcılar ve odalar hap (pill) olur */
function pillBul(href: string): Pill | undefined {
  const b = matrisBaglantiCoz(href);
  if (!b) return undefined;
  return { tur: b.tur, kimlik: b.kimlik };
}

const GUVENLI_HREF = /^(https?:\/\/|mailto:|matrix:)/i;

export function temizle(html: string): Dugum[] {
  if (!html || html.length > SINIR_METIN * 4) return html ? [{ t: "m", v: html.slice(0, SINIR_METIN) }] : [];
  let belge: Document;
  try {
    belge = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return [{ t: "m", v: html.slice(0, SINIR_METIN) }];
  }
  let sayac = 0;

  const yuru = (cocuklar: NodeListOf<ChildNode>, derinlik: number): Dugum[] => {
    const cikti: Dugum[] = [];
    for (const n of Array.from(cocuklar)) {
      if (++sayac > SINIR_DUGUM) break;
      if (n.nodeType === Node.TEXT_NODE) {
        const v = n.textContent ?? "";
        if (v) cikti.push({ t: "m", v });
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as Element;
      const ad = el.localName.toLowerCase();
      if (ATILAN.has(ad)) continue;
      if (derinlik >= SINIR_DERINLIK) {
        // Too deep: keep only the text. · Çok derin: yalnızca metni tut.
        const v = el.textContent ?? "";
        if (v) cikti.push({ t: "m", v });
        continue;
      }
      const etiket = IZINLI[ad];
      if (!etiket) {
        // Unknown tag: unwrap (keep the children, lose the tag). · Bilinmeyen etiket: aç (çocukları tut, etiketi bırak).
        cikti.push(...yuru(el.childNodes, derinlik + 1));
        continue;
      }
      if (etiket === "br") {
        cikti.push({ t: "e", etiket, cocuk: [] });
        continue;
      }
      if (etiket === "emoji") {
        // Only custom emoji (`data-mx-emoticon`) with an mxc:// source; any other image is dropped. · Yalnızca mxc:// kaynaklı özel emoji (`data-mx-emoticon`); başka her resim atılır.
        const src = el.getAttribute("src") ?? "";
        if (el.hasAttribute("data-mx-emoticon") && src.startsWith("mxc://")) {
          cikti.push({ t: "e", etiket, cocuk: [], mxc: src, alt: (el.getAttribute("alt") ?? el.getAttribute("title") ?? "").slice(0, 64) });
        } else {
          const alt = el.getAttribute("alt");
          if (alt) cikti.push({ t: "m", v: alt.slice(0, 64) });
        }
        continue;
      }
      if (etiket === "span") {
        // Only the spoiler span carries meaning; other spans (colours) are unwrapped. · Yalnızca spoiler span'ının anlamı var; öteki span'lar (renkler) açılır.
        if (el.hasAttribute("data-mx-spoiler")) cikti.push({ t: "e", etiket: "spoiler", cocuk: yuru(el.childNodes, derinlik + 1) });
        else cikti.push(...yuru(el.childNodes, derinlik + 1));
        continue;
      }
      const dugum: Dugum = { t: "e", etiket, cocuk: yuru(el.childNodes, derinlik + 1) };
      if (etiket === "a") {
        const href = (el.getAttribute("href") ?? "").trim();
        if (GUVENLI_HREF.test(href)) {
          dugum.href = href;
          dugum.pill = pillBul(href);
        } else {
          // javascript:, data:, relative... become plain text. · javascript:, data:, göreli... düz metin olur.
          cikti.push(...dugum.cocuk);
          continue;
        }
      }
      cikti.push(dugum);
    }
    return cikti;
  };

  return yuru(belge.body.childNodes, 0);
}

/** Plain text of a tree (for the clipboard / search) · Bir ağacın düz metni (pano / arama için) */
export function duzMetin(dugumler: Dugum[]): string {
  return dugumler.map((d) => (d.t === "m" ? d.v : d.etiket === "br" ? "\n" : duzMetin(d.cocuk))).join("");
}
