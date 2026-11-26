import { egri, hareketVar } from "../hareket";
// Scroll a message row into the middle of the timeline and flash it using an opacity-only overlay so the user sees which message matched.
// Bir mesaj satırını zaman çizelgesinin ortasına kaydır ve yalnızca opaklıkla sönen bir katmanla vurgula; kullanıcı eşleşen mesajı görsün.

export function satiriBul(olayId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-olay-id="${CSS.escape(olayId)}"]`);
}

/** Scrolls to the row and fades an accent highlight overlay (opacity-only). Without motion it stays tinted briefly then disappears. */
/** Satıra kaydırır ve vurgu katmanını yalnızca opaklıkla söndürür. Hareketsiz kipte kısa süre boyalı kalıp kaybolur. */
export function kaydirVeVurgula(el: HTMLElement) {
  el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  const katman = document.createElement("span");
  katman.setAttribute("aria-hidden", "true");
  katman.style.cssText =
    "position:absolute;inset:0;border-radius:12px;background:color-mix(in srgb, var(--vurgu) 28%, transparent);pointer-events:none;z-index:0;";
  el.appendChild(katman);
  if (hareketVar()) {
    katman.style.willChange = "opacity";
    const a = katman.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 1600, easing: egri("--egri-cikis") });
    const sil = () => katman.remove();
    a.onfinish = sil;
    a.oncancel = sil;
  } else {
    setTimeout(() => katman.remove(), 1600);
  }
}

// The index folds Turkish letters (ş→s, ı→i, ...), so "sik" finds "şık"; the highlight must match the same way or a found message
// shows no highlight at all. Each letter becomes a class of its folded variants.
// Dizin Türkçe harfleri katlar (ş→s, ı→i, ...); "sik" "şık"ı bulur. Vurgu da aynı biçimde eşleşmeli, yoksa bulunan mesajda hiç vurgu
// görünmez. Her harf, katlanmış biçimlerinin sınıfına dönüşür.
const KATLAMA: Record<string, string> = {
  c: "cçÇ", ç: "cçÇ", g: "gğĞ", ğ: "gğĞ", i: "iıİI", ı: "iıİI", o: "oöÖ", ö: "oöÖ", s: "sşŞ", ş: "sşŞ", u: "uüÜ", ü: "uüÜ",
};
export function katlamaDeseni(kelime: string): string {
  let d = "";
  for (const h of kelime.toLocaleLowerCase("tr")) {
    const k = KATLAMA[h];
    d += k ? `[${k}${h.toLocaleUpperCase("en")}]` : h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return d;
}
