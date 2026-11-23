// Shell state shared by the floating bottom dock and the chat-list search pill: they hide when the user scrolls down and come back when
// the user scrolls up, TOGETHER (one `altGizli` flag), and stay visible while a search is being typed.
// Yüzen alt menü ile sohbet listesi arama hapının ortak kabuk durumu: aşağı kaydırınca birlikte gizlenir, yukarı kaydırınca birlikte döner
// (tek `altGizli` bayrağı) ve arama yazılırken görünür kalır.
class Kabuk {
  altGizli = $state(false);
  /** The chat-list search field is focused: dock hides, the pill sticks above the keyboard · Sohbet listesi arama alanı odakta: menü gizlenir, hap klavyenin üstüne yapışır */
  aramaOdakta = $state(false);

  sifirla() {
    this.altGizli = false;
  }
}
export const kabuk = new Kabuk();

/**
 * Action for a scrollable area: scrolling down (past 56px) hides the dock + search pill, scrolling up shows them again.
 * Kaydırılabilir alan için eylem: aşağı kaydırmak (56px'ten sonra) menüyü + arama hapını gizler, yukarı kaydırmak geri getirir.
 */
export function altKaydirma(node: HTMLElement) {
  let onceki = node.scrollTop;
  let birikim = 0;
  const kay = () => {
    const simdi = node.scrollTop;
    const fark = simdi - onceki;
    onceki = simdi;
    // Rubber-banding at the very top/bottom must not flip the state · En üstteki/en alttaki esneme durumu değiştirmemeli
    if (simdi <= 8) {
      kabuk.altGizli = false;
      birikim = 0;
      return;
    }
    if (Math.sign(fark) !== Math.sign(birikim)) birikim = 0;
    birikim += fark;
    if (birikim > 24 && simdi > 56) kabuk.altGizli = true;
    else if (birikim < -12) kabuk.altGizli = false;
  };
  node.addEventListener("scroll", kay, { passive: true });
  return { destroy: () => node.removeEventListener("scroll", kay) };
}
