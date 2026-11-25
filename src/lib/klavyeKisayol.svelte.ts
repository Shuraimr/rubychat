// Keyboard shortcuts. Ctrl+Space (rooms) and Ctrl+E (list) always work; the vim keys follow Görünüm › Masaüstü › Vim tuşları.
// vim: "insert" = a text field has the focus, everything else is "normal". In normal mode the focused element says where we are:
// a menu / dialog on top, the list side, or (nothing focused) the open room, where j/k move a message cursor.
// Klavye kısayolları. Ctrl+Space (odalar) ve Ctrl+E (liste) hep çalışır; vim tuşları Görünüm › Masaüstü › Vim tuşları'nı izler.
// vim: "insert" = odak bir metin alanında, gerisi "normal". Normal kipte nerede olduğumuzu odaktaki öğe söyler:
// üstteki menü / pencere, liste tarafı ya da (odak yoksa) açık oda; odada j/k bir mesaj imlecini gezdirir.
import { duzen } from "./durum/duzen.svelte";
import { gezinme, type Sekme } from "./durum/gezinme.svelte";
import { odalar } from "./durum/odalar.svelte";
import { oturum } from "./durum/oturum.svelte";
import { tercihler } from "./durum/tercihler.svelte";

/** What the open room offers to the keyboard · Açık odanın klavyeye sundukları */
export interface OdaKlavye {
  kutu: () => HTMLElement | undefined;
  ara: () => void;
  bilgi: () => void;
  enAlta: () => void;
  menu: (olayId: string, x: number, y: number) => void;
  yanitla: (olayId: string) => void;
  duzenle: (olayId: string) => void;
  kopyala: (olayId: string) => void;
}

const ZIYARET = "rubychat.sonOdalar";
function ziyaretOku(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(ZIYARET) ?? "[]") as unknown;
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

class Klavye {
  palet = $state(false);
  yardim = $state(false);
  oda: OdaKlavye | null = null;
  /** Rooms in the order they were last opened · En son açılma sırasıyla odalar */
  ziyaret: string[] = ziyaretOku();
}
export const klavye = new Klavye();

type Yon = "h" | "j" | "k" | "l";
const ODAKLANIR = 'button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';
const SOL = ".liste-sutunu, .ray, .serit, .ekran:not([inert])";

const metinAlani = (e: Element | null): e is HTMLElement =>
  !!e && (e.matches('textarea, [contenteditable="true"]') || (e instanceof HTMLInputElement && !["checkbox", "radio", "range", "color", "button", "file"].includes(e.type)));
const gorunur = (e: Element) => e.getClientRects().length > 0 && !e.closest("[inert]") && getComputedStyle(e).visibility !== "hidden";

/** The menu / dialog on top, if any · Varsa en üstteki menü / pencere */
function ustKatman(): HTMLElement | null {
  const l = [...document.querySelectorAll<HTMLElement>('[role="menu"], [role="dialog"]')].filter(gorunur);
  return l.at(-1) ?? null;
}
/** A page drawn over the room (info, members) · Odanın üstüne çizilen sayfa (bilgi, üyeler) */
const odaSayfasi = () => [...document.querySelectorAll<HTMLElement>(".oda .ekran")].filter(gorunur).at(-1) ?? null;
const solTaraf = () => [...document.querySelectorAll<HTMLElement>(SOL)].filter((e) => gorunur(e) && !e.closest(".oda"));

/** Nearest focusable element in one direction · Bir yöndeki en yakın odaklanabilir öğe */
function yandaki(kapsam: HTMLElement[], yon: Yon, metinDahil: boolean): HTMLElement | null {
  const simdi = document.activeElement;
  const adaylar = kapsam
    .flatMap((k) => {
      const kr = k.getBoundingClientRect();
      // Pager neighbours sit outside their column. · Sayfalayıcının komşu sayfaları sütunlarının dışındadır.
      return [...k.querySelectorAll<HTMLElement>(ODAKLANIR)].filter((e) => {
        const r = e.getBoundingClientRect();
        const o = (r.left + r.right) / 2;
        return o >= kr.left && o <= kr.right && gorunur(e) && (metinDahil || !metinAlani(e));
      });
    })
    .filter((e) => e !== simdi);
  if (!simdi || !kapsam.some((k) => k !== simdi && k.contains(simdi))) {
    return adaylar.find((e) => e.matches('.satir.secili, [role="radio"][aria-checked="true"]')) ?? adaylar.find((e) => e.matches('.liste .satir, [role="menuitem"]')) ?? adaylar[0] ?? null;
  }
  const a = simdi.getBoundingClientRect();
  let iyi: HTMLElement | null = null;
  let enAz = Infinity;
  for (const e of adaylar) {
    const b = e.getBoundingClientRect();
    const dikey = yon === "j" || yon === "k";
    const ileri = yon === "j" || yon === "l";
    const [a0, a1, b0, b1] = dikey ? [a.top, a.bottom, b.top, b.bottom] : [a.left, a.right, b.left, b.right];
    const [c0, c1, d0, d1] = dikey ? [a.left, a.right, b.left, b.right] : [a.top, a.bottom, b.top, b.bottom];
    const uzak = ileri ? b0 - a1 : a0 - b1;
    // Half of the smaller one may overlap (rounded neighbours), more is not "in that direction". · Küçüğün yarısı kadar bindirme olur, fazlası "o yönde" değildir.
    if (uzak < -Math.min(a1 - a0, b1 - b0) / 2) continue;
    const yanal = Math.max(0, d0 - c1, c0 - d1);
    // Sideways only within the same line · Yana yalnızca aynı satırda
    if (!dikey && yanal > 0) continue;
    const p = Math.max(0, uzak) + yanal * 3 + Math.abs((c0 + c1) / 2 - (d0 + d1) / 2) * 0.1;
    if (p < enAz) {
      enAz = p;
      iyi = e;
    }
  }
  return iyi;
}

function odakla(e: HTMLElement | null): boolean {
  if (!e) return false;
  e.focus({ preventScroll: true });
  e.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}
const odagiBirak = () => (document.activeElement as HTMLElement | null)?.blur?.();

// ---- Message cursor · Mesaj imleci ----
const satirlar = () => [...(klavye.oda?.kutu()?.querySelectorAll<HTMLElement>(".satir[data-olay-id]") ?? [])];
const imlecSatiri = () => klavye.oda?.kutu()?.querySelector<HTMLElement>("[data-imlec]") ?? null;
function imlecKoy(e: HTMLElement | null) {
  imlecSatiri()?.removeAttribute("data-imlec");
  if (!e) return;
  e.setAttribute("data-imlec", "");
  const kutu = klavye.oda?.kutu();
  if (!kutu) return;
  // The header and the composer float over the list: stay between them. · Başlık ve yazma alanı listenin üstünde yüzer: aralarında kal.
  const stil = getComputedStyle(kutu);
  const ust = kutu.getBoundingClientRect().top + (parseFloat(stil.getPropertyValue("--tepe-yer")) || 64) + 8;
  const alt = kutu.getBoundingClientRect().bottom - (parseFloat(stil.getPropertyValue("--yazma-yer")) || 0) - 8;
  const r = e.getBoundingClientRect();
  if (r.top < ust) kutu.scrollTop -= ust - r.top;
  else if (r.bottom > alt) kutu.scrollTop += r.bottom - alt;
}
function imlecOynat(adim: number) {
  const l = satirlar();
  if (l.length === 0) return;
  const i = l.indexOf(imlecSatiri()!);
  if (i < 0) {
    // First press: the lowest message on screen. · İlk basış: ekrandaki en alttaki mesaj.
    const alt = klavye.oda!.kutu()!.getBoundingClientRect().bottom;
    return imlecKoy(l.filter((e) => e.getBoundingClientRect().top < alt - 80).at(-1) ?? l.at(-1)!);
  }
  if (i + adim >= l.length) klavye.oda!.enAlta();
  if (i + adim < 0) klavye.oda!.kutu()!.scrollTop -= 240; // asks for older messages · eski mesajları ister
  imlecKoy(l[Math.min(l.length - 1, Math.max(0, i + adim))]);
}

function odaDegistir(adim: number) {
  const l = odalar.suz("tumu");
  if (l.length === 0) return;
  const i = l.findIndex((o) => o.id === gezinme.acikOdaId);
  gezinme.odaAc(l[i < 0 ? 0 : (i + adim + l.length) % l.length].id, true);
}
function sekmeDegistir(adim: number) {
  const s: Sekme[] = ["sohbetler", "alanlar", "ben"];
  gezinme.sekmeSec(s[(s.indexOf(gezinme.sekme) + adim + 3) % 3]);
  listeyeGec();
}
function listeyeGec() {
  duzen.listeGoster();
  // After the list is drawn · Liste çizildikten sonra
  setTimeout(() => {
    odagiBirak();
    const sol = solTaraf();
    const liste = sol.filter((e) => e.matches(".liste-sutunu, .ekran"));
    odakla(yandaki(liste.length ? liste : sol, "j", false));
  }, 40);
}
function listeAramasi() {
  odakla(solTaraf().flatMap((k) => [...k.querySelectorAll<HTMLElement>("input")]).find((e) => metinAlani(e) && gorunur(e)) ?? null);
}

let bekleyen = "";
let bekleyenZamani: ReturnType<typeof setTimeout> | undefined;

/** Returns true when the key was used · Tuş kullanıldıysa true döner */
function normalTus(e: KeyboardEvent): boolean {
  const k = e.key;
  const once = bekleyen;
  bekleyen = "";
  clearTimeout(bekleyenZamani);
  const yon = !e.ctrlKey && (k === "h" || k === "j" || k === "k" || k === "l") ? k : null;

  // 1. A menu or dialog on top takes the moves; nothing else leaks to what is under it. · Üstteki menü / pencere hareketleri alır; altına bir şey sızmaz.
  const ust = ustKatman();
  if (ust) return yon ? odakla(yandaki([ust], yon, true)) : false;
  const sayfa = odaSayfasi();
  if (sayfa) return yon ? odakla(yandaki([sayfa], yon, true)) : false;

  const odak = document.activeElement;
  const sol = solTaraf();
  const solda = !gezinme.acikOdaId || (!!odak && odak !== document.body && sol.some((s) => s.contains(odak)));

  // 2. Keys that work on both sides · İki tarafta da çalışan tuşlar
  if (!e.ctrlKey) {
    if (once === "g") {
      if (k === "t") return sekmeDegistir(1), true;
      if (k === "T") return sekmeDegistir(-1), true;
      if (k === "s") return gezinme.sekmeSec("ben"), listeyeGec(), true;
      if (k === "i" && klavye.oda) return klavye.oda.bilgi(), true;
      if (k === "g") {
        if (solda) return odakla(sol.flatMap((s) => [...s.querySelectorAll<HTMLElement>(".liste .satir")]).find(gorunur) ?? null);
        return imlecKoy(satirlar()[0] ?? null), true;
      }
    }
    if (k === "g") {
      bekleyen = "g";
      bekleyenZamani = setTimeout(() => (bekleyen = ""), 800);
      return true;
    }
    if (k === "?") return (klavye.yardim = true), true;
    if (k === "J") return odaDegistir(1), true;
    if (k === "K") return odaDegistir(-1), true;
    if (k === "i" && klavye.oda) return odakla(document.querySelector<HTMLElement>(".yazma textarea"));
  }

  // 3. The list side · Liste tarafı
  if (solda) {
    if (k === "/") return listeAramasi(), true;
    if (!yon) return false;
    if (odakla(yandaki(sol, yon, false))) return true;
    // Nothing to the right: open the row / go to the room. · Sağda bir şey yok: satırı aç / odaya geç.
    if (yon === "l") {
      if (odak instanceof HTMLElement && odak.matches(".liste .satir")) odak.click();
      odagiBirak();
      if (duzen.cekmece) duzen.cekmeceKapat();
    }
    return true;
  }

  // 4. The open room · Açık oda
  const o = klavye.oda;
  if (!o) return false;
  if (e.ctrlKey) {
    if (k === "d" || k === "u") {
      const kutu = o.kutu();
      kutu?.scrollBy({ top: (k === "d" ? 1 : -1) * kutu.clientHeight * 0.5 });
      imlecKoyYok();
      return true;
    }
    return false;
  }
  const id = imlecSatiri()?.dataset.olayId;
  switch (k) {
    case "j":
      return imlecOynat(1), true;
    case "k":
      return imlecOynat(-1), true;
    case "h":
      return listeyeGec(), true;
    case "G":
      return imlecKoyYok(), o.enAlta(), true;
    case "/":
    case "Tab":
      return o.ara(), true;
    case "Escape":
      return imlecKoyYok(), true;
    case "a":
      return odakla(document.querySelector<HTMLElement>(".yazma textarea"));
    case "r":
      return id ? (o.yanitla(id), true) : false;
    case "e":
      return id ? (o.duzenle(id), true) : false;
    case "y":
      return id ? (o.kopyala(id), true) : false;
    case "o":
    case "Enter": {
      // Enter on a focused button stays a click. · Odaktaki düğmede Enter tıklamadır.
      if (!id || (k === "Enter" && odak && odak !== document.body)) return false;
      const r = (imlecSatiri()!.querySelector(".kolon") ?? imlecSatiri()!).getBoundingClientRect();
      o.menu(id, r.left + 40, Math.min(r.bottom, innerHeight - 120));
      setTimeout(() => {
        const m = ustKatman();
        if (m) odakla(yandaki([m], "j", false));
      }, 60);
      return true;
    }
  }
  return false;
}
const imlecKoyYok = () => imlecKoy(null);

function tus(e: KeyboardEvent) {
  if (!oturum.ben || e.defaultPrevented || e.isComposing) return;
  const yalnizCtrl = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
  if (yalnizCtrl && (e.code === "Space" || e.key.toLowerCase() === "e")) {
    e.preventDefault();
    if (e.code === "Space") {
      // A dialog that must be finished stays on top. · Bitirilmesi gereken pencere üstte kalır.
      if (klavye.palet || !ustKatman()) klavye.palet = !klavye.palet;
    } else if (!ustKatman()) duzen.degistir();
    return;
  }
  if (!tercihler.d.vim || e.altKey || e.metaKey) return;
  const odak = document.activeElement;
  if (metinAlani(odak)) {
    const yazmada = !!odak.closest(".yazma");
    if (e.key === "Escape" && !odak.closest('[role="dialog"]')) {
      e.preventDefault();
      odak.blur();
    } else if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && yazmada && klavye.oda) {
      e.preventDefault();
      klavye.oda.ara();
    }
    return;
  }
  if (e.key === "Shift" || e.key === "Control") return;
  if (e.shiftKey && e.key === "Tab") return;
  if (normalTus(e)) e.preventDefault();
}

export function klavyeBaslat(): () => void {
  window.addEventListener("keydown", tus);
  const bitir = $effect.root(() => {
    $effect(() => {
      const id = gezinme.acikOdaId;
      if (!id) return;
      klavye.ziyaret = [id, ...klavye.ziyaret.filter((x) => x !== id)].slice(0, 30);
      try {
        localStorage.setItem(ZIYARET, JSON.stringify(klavye.ziyaret));
      } catch {
        /* storage blocked: kept for this run · depolama engelli: bu çalışma için tutulur */
      }
      // vim: a chosen row hands the keys to the room. · vim: seçilen satır tuşları odaya verir.
      if (tercihler.d.vim && !metinAlani(document.activeElement)) odagiBirak();
    });
  });
  return () => {
    window.removeEventListener("keydown", tus);
    bitir();
  };
}
