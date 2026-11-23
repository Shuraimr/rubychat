// Double tap on a message: two taps within 280ms, at most 24px apart. Links, buttons and media inside the message keep their own tap.
// Mesaja çift dokunma: 280ms içinde, en çok 24px arayla iki dokunuş. Mesajın içindeki bağlantı, düğme ve medya kendi dokunuşunu korur.
import { titret } from "./dokunma";

export function ciftDokun(node: HTMLElement, secenek: { ac: () => void; etkin: boolean }) {
  let ayar = secenek;
  let son = 0;
  let sx = 0;
  let sy = 0;
  const tik = (e: MouseEvent) => {
    if (!ayar.etkin || (e.target instanceof Element && e.target.closest("a, button, video, input"))) return;
    if (e.timeStamp - son < 280 && Math.hypot(e.clientX - sx, e.clientY - sy) < 24) {
      son = 0;
      titret(12);
      ayar.ac();
      return;
    }
    son = e.timeStamp;
    sx = e.clientX;
    sy = e.clientY;
  };
  node.addEventListener("click", tik);
  return {
    update(yeni: typeof secenek) {
      ayar = yeni;
    },
    destroy() {
      node.removeEventListener("click", tik);
    },
  };
}
