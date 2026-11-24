// Screen transition for the room (and Ben sub-pages): the whole page slides in from the right edge, going back is the reverse (the page
// underneath moves 25% with it, see App). Duration and curve come from CSS tokens, so "reduced motion" (0ms) turns it off by itself.
// Oda (ve Ben alt sayfaları) için ekran geçişi: sayfanın tamamı sağ kenardan kayarak girer, geri dönüş tersidir (alttaki sayfa onunla %25
// kayar, bkz. App). Süre ve eğri CSS değişkenlerinden gelir; "azaltılmış hareket" (0ms) kendiliğinden kapatır.

import { egri as egriOku, sureMs } from "./hareket";

/** Set when a swipe already moved the page out: the closing transition must not play a second time. · Kaydırma sayfayı zaten çıkardıysa kurulur: kapanış geçişi ikinci kez oynamasın. */
let cikisAtla = false;
export function cikisiAtla() {
  cikisAtla = true;
  setTimeout(() => (cikisAtla = false), 100);
}

function kay(giris: boolean) {
  return (node: Element) => {
    const sure = !giris && cikisAtla ? 0 : sureMs("--sure-ekran");
    const egri = egriOku("--egri-ac");
    if (sure > 0) {
      const uzak = { transform: "translateX(100%)" };
      const yakin = { transform: "translateX(0)" };
      // transform only: no layout work, 60 fps · yalnızca transform: düzen hesabı yok, 60 fps
      node.animate(giris ? [uzak, yakin] : [yakin, uzak], { duration: sure, easing: egri, fill: giris ? "backwards" : "forwards" });
    }
    // Tell Svelte how long to keep the node alive · Svelte'e düğümü ne kadar canlı tutacağını bildir
    return { duration: sure };
  };
}
export const kayGir = kay(true);
export const kayCik = kay(false);

/**
 * Bottom sheet: rises from the bottom (280ms, soft landing) and sinks again; the scrim fades 0 → 50%.
 * Alt sayfa: alttan çıkar (280ms, yumuşak iniş) ve geri iner; perde 0 → %50 solar.
 */
function sayfa(giris: boolean) {
  return (node: Element) => {
    const sure = sureMs("--sure-sayfa");
    const egri = egriOku(giris ? "--egri-sayfa" : "--egri-giris");
    if (sure > 0) {
      const asagi = { transform: "translateY(100%)" };
      const yukari = { transform: "translateY(0)" };
      node.animate(giris ? [asagi, yukari] : [yukari, asagi], { duration: giris ? sure : sure * 0.65, easing: egri, fill: giris ? "backwards" : "forwards" });
    }
    return { duration: giris ? sure : sure * 0.65 };
  };
}
export const sayfaGir = sayfa(true);
export const sayfaCik = sayfa(false);

/** Plain fade with a token duration (scrims, dialogs) · Süresi değişkenden gelen düz solma (perdeler, pencereler) */
function sol(giris: boolean, sureAdi: string) {
  return (node: Element) => {
    const sure = sureMs(sureAdi);
    if (sure > 0) node.animate(giris ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: sure, easing: "linear", fill: giris ? "backwards" : "forwards" });
    return { duration: sure };
  };
}
export const perdeGir = sol(true, "--sure-orta");
export const perdeCik = sol(false, "--sure-cikis");

/** Snackbar: rises and grows from the bottom edge; closing fades. · Snackbar: alt kenardan yükselip büyür; kapanırken solar. */
export function bildirimGir(node: Element) {
  const sure = (sureMs("--sure-bildirim")) * 1.4;
  if (sure > 0) node.animate([{ transform: "translateY(24px) scale(.9)", opacity: 0 }, { opacity: 1, offset: 0.5 }, { transform: "none", opacity: 1 }], { duration: sure, easing: egriOku("--egri-vurgulu"), fill: "backwards" });
  return { duration: sure };
}
export function bildirimCik(node: Element) {
  const sure = sureMs("--sure-bildirim-cik");
  if (sure > 0) node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sure, easing: "linear", fill: "forwards" });
  return { duration: sure };
}

/** In-app message banner: drops from behind the top edge with a soft spring and goes back up. · Uygulama içi mesaj şeridi: üst kenarın arkasından yumuşak yayla iner, yukarı geri çıkar. */
export function ustGir(node: Element) {
  const sure = sureMs("--sure-sayfa");
  if (sure > 0) node.animate([{ transform: "translateY(-130%)" }, { transform: "none" }], { duration: sure, easing: egriOku("--egri-sayfa"), fill: "backwards" });
  return { duration: sure };
}
export function ustCik(node: Element) {
  const sure = (sureMs("--sure-orta")) * 1.2;
  // Starts where the finger left it. · Parmağın bıraktığı yerden başlar.
  const bas = getComputedStyle(node).transform;
  if (sure > 0) node.animate([{ transform: bas === "none" ? "translateY(0)" : bas }, { transform: "translateY(-130%)", opacity: 0.4 }], { duration: sure, easing: egriOku("--egri-giris"), fill: "forwards" });
  return { duration: sure };
}

/**
 * Menus and small dialogs: fade + a slight growth from their transform-origin. `scale` / `translate` are separate properties on purpose:
 * an element that is centred with its own `transform` keeps it.
 * Menüler ve küçük pencereler: solma + transform-origin'den hafif büyüme. `scale` / `translate` bilerek ayrı özelliklerdir: kendi
 * `transform`'uyla ortalanan öğe onu korur.
 */
function menu(giris: boolean) {
  return (node: Element) => {
    const sure = sureMs(giris ? "--sure-menu" : "--sure-cikis");
    if (sure > 0) {
      const kapali = { opacity: 0, scale: giris ? "0.94" : "0.97" };
      const acik = { opacity: 1, scale: "1" };
      node.animate(giris ? [kapali, { opacity: 1, offset: 0.6 }, acik] : [acik, kapali], { duration: sure, easing: giris ? egriOku("--egri-ac") : "linear", fill: giris ? "backwards" : "forwards" });
    }
    return { duration: sure };
  };
}
export const menuGir = menu(true);
export const menuCik = menu(false);

/** Splash → app: fades while growing a touch, as if walking through it · Açılış → uygulama: hafifçe büyüyerek solar, içinden geçer gibi */
export function acilisCik(node: Element) {
  const sure = sureMs("--sure-sayfa");
  if (sure > 0) node.animate([{ opacity: 1, scale: "1" }, { opacity: 0, scale: "1.04" }], { duration: sure, easing: egriOku("--egri-cikis"), fill: "forwards" });
  return { duration: sure };
}
