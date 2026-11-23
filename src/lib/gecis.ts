// Screen transition for the room (and Ben sub-pages): it enters from the right moving 24px while fading in; going back is the reverse.
// Duration and curve come from CSS tokens (--sure-ekran = 260ms, --egri-vurgulu), so "reduced motion" (0ms) turns it off by itself.
// Oda (ve Ben alt sayfaları) için ekran geçişi: sağdan 24px kayarak ve solarak girer; geri dönüş tersidir.
// Süre ve eğri CSS değişkenlerinden gelir (--sure-ekran = 260ms, --egri-vurgulu); "azaltılmış hareket" (0ms) kendiliğinden kapatır.
function kay(giris: boolean) {
  return (node: Element) => {
    const stil = getComputedStyle(document.documentElement);
    const sure = parseFloat(stil.getPropertyValue("--sure-ekran")) || 0;
    const egri = stil.getPropertyValue("--egri-vurgulu").trim() || "ease";
    if (sure > 0) {
      const uzak = { transform: "translateX(24px)", opacity: 0 };
      const yakin = { transform: "translateX(0)", opacity: 1 };
      // transform + opacity only: no layout work, 60 fps · yalnızca transform + opacity: düzen hesabı yok, 60 fps
      node.animate(giris ? [uzak, yakin] : [yakin, uzak], { duration: sure, easing: egri, fill: giris ? "backwards" : "forwards" });
    }
    // Tell Svelte how long to keep the node alive · Svelte'e düğümü ne kadar canlı tutacağını bildir
    return { duration: sure };
  };
}
export const kayGir = kay(true);
export const kayCik = kay(false);

/**
 * Bottom sheet: rises from the bottom (280ms, slight spring) and sinks again; the scrim fades 0 → 50%.
 * Alt sayfa: alttan çıkar (280ms, hafif yay) ve geri iner; perde 0 → %50 solar.
 */
function sayfa(giris: boolean) {
  return (node: Element) => {
    const stil = getComputedStyle(document.documentElement);
    const sure = parseFloat(stil.getPropertyValue("--sure-sayfa")) || 0;
    const egri = (giris ? stil.getPropertyValue("--egri-sayfa") : stil.getPropertyValue("--egri-giris")).trim() || "ease";
    if (sure > 0) {
      const asagi = { transform: "translateY(100%)" };
      const yukari = { transform: "translateY(0)" };
      node.animate(giris ? [asagi, yukari] : [yukari, asagi], { duration: giris ? sure : sure * 0.7, easing: egri, fill: giris ? "backwards" : "forwards" });
    }
    return { duration: giris ? sure : sure * 0.7 };
  };
}
export const sayfaGir = sayfa(true);
export const sayfaCik = sayfa(false);

/** Plain fade with a token duration (scrims, dialogs) · Süresi değişkenden gelen düz solma (perdeler, pencereler) */
function sol(giris: boolean, sureAdi: string) {
  return (node: Element) => {
    const sure = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(sureAdi)) || 0;
    if (sure > 0) node.animate(giris ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: sure, easing: "linear", fill: giris ? "backwards" : "forwards" });
    return { duration: sure };
  };
}
export const perdeGir = sol(true, "--sure-sayfa");
export const perdeCik = sol(false, "--sure-orta");

/**
 * Toast / in-app notification: rises 12px while fading in (200ms); closing only fades (150ms).
 * Bildirim: 12px yükselerek solar ve girer (200ms); kapanırken yalnızca solar (150ms).
 */
export function bildirimGir(node: Element) {
  const sure = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sure-bildirim")) || 0;
  if (sure > 0) node.animate([{ transform: "translateY(12px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: sure, easing: getComputedStyle(document.documentElement).getPropertyValue("--egri-cikis").trim() || "ease", fill: "backwards" });
  return { duration: sure };
}
export function bildirimCik(node: Element) {
  const sure = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sure-bildirim-cik")) || 0;
  if (sure > 0) node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sure, easing: "linear", fill: "forwards" });
  return { duration: sure };
}
