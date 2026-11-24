import { hareketVar } from "../hareket";
// Scroll a message row into the middle of the timeline and flash it, so the user sees which message the search found.
// Bir mesaj satırını zaman çizelgesinin ortasına kaydır ve yakıp söndür; kullanıcı aramanın hangi mesajı bulduğunu görsün.

export function satiriBul(olayId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-olay-id="${CSS.escape(olayId)}"]`);
}

/** Scrolls to the row and flashes it. Without motion ("Animasyonları azalt" → --sure-ekran is 0) it just stays tinted for a while. · Satıra kaydırır ve yakıp söndürür. Hareketsiz kipte (--sure-ekran 0) bir süre boyalı kalır. */
export function kaydirVeVurgula(el: HTMLElement) {
  el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  const renk = "color-mix(in srgb, var(--vurgu) 28%, transparent)";
  const hareket = hareketVar();
  if (hareket) {
    el.animate([{ backgroundColor: renk }, { backgroundColor: renk, offset: 0.6 }, { backgroundColor: "transparent" }], { duration: 2000, easing: "ease-out" });
  } else {
    el.style.backgroundColor = renk;
    setTimeout(() => (el.style.backgroundColor = ""), 2000);
  }
}
