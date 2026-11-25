// Modeless Ctrl keyboard shortcuts: one command table drives both dispatch and help / settings / hint UI.
// Ctrl+Space (room palette) and Ctrl+B (show / hide list) always work; the rest follow Ben › Klavye kısayolları.
// Kipsiz Ctrl klavye kısayolları: tek komut tablosu hem çalıştırmayı hem yardım / ayar / ipucu arayüzünü sürer.
// Ctrl+Space (oda paleti) ve Ctrl+B (listeyi göster / gizle) hep çalışır; gerisi Ben › Klavye kısayolları'nı izler.
import { tick, untrack } from "svelte";
import type { ZamanOgesi } from "./api/tipler";
import { duzen } from "./durum/duzen.svelte";
import { gezinme } from "./durum/gezinme.svelte";
import { odalar } from "./durum/odalar.svelte";
import { oturum } from "./durum/oturum.svelte";
import { tercihler } from "./durum/tercihler.svelte";
import type { Anahtar } from "./i18n";
import { gercekOlay, iletilebilir } from "./mesaj/eylemler";

/** What the open room offers to the keyboard · Açık odanın klavyeye sundukları */
export interface OdaKlavye {
  odaId: string;
  kutu: () => HTMLElement | undefined;
  seciliOge: () => ZamanOgesi | null;
  /** Event id currently in view, recorded before jumps for Ctrl+O · Şu an görünür olay kimliği, Ctrl+O için atlama öncesi kaydedilir */
  konum: () => string | null;
  enYeniId: () => string | null;
  aramaAcik: () => boolean;
  sabitleyebilir: () => boolean;
  ara: () => void;
  enAlta: () => void;
  olayaAtla: (olayId: string) => void;
  menu: (oge: ZamanOgesi, x: number, y: number) => void;
  menuVar: (oge: ZamanOgesi) => boolean;
  yanitla: (oge: ZamanOgesi) => void;
  duzenle: (oge: ZamanOgesi) => void;
  sil: (oge: ZamanOgesi) => void;
  tepki: (oge: ZamanOgesi, x: number, y: number) => void;
  kopyala: (oge: ZamanOgesi) => void;
  sabitle: (oge: ZamanOgesi) => void;
  ilet: (oge: ZamanOgesi) => void;
  profil: (oge: ZamanOgesi) => void;
}

export type KomutBaglami = "genel" | "liste" | "mesaj";

export interface Komut {
  id: string;
  /** Display key combo (split on "+" for <kbd> chips) · Gösterim tuş bileşimi (<kbd> için "+" ile bölünür) */
  key: string;
  context: KomutBaglami;
  /** i18n label key for help and settings · Yardım ve ayarlar için i18n etiket anahtarı */
  etiket: Anahtar;
  /** Optional short label for the composer hint strip · Yazma alanı ipucu şeridi için isteğe bağlı kısa etiket */
  ipucuEtiket?: Anahtar;
  /** Active even when ctrlKisayol is off · ctrlKisayol kapalıyken de etkin */
  herZaman?: boolean;
  ctrl: boolean;
  shift: boolean;
  /** Lowercase e.key match · Küçük harfli e.key eşleşmesi */
  tus: string;
  /** Optional e.code match (e.g. Space) · İsteğe bağlı e.code eşleşmesi (örn. Space) */
  kod?: string;
  /** Ignore e.shiftKey when matching punctuation that needs Shift on some layouts (e.g. "/" on TR-Q) · Bazı düzenlerde Shift isteyen noktalama işaretlerinde (örn. TR-Q'da "/") e.shiftKey yok sayılır */
  shiftEsnek?: boolean;
  /** Whether a message command can run on this message · Mesaj komutunun bu mesajda çalışabilirliği */
  uygun?: (oge: ZamanOgesi, oda: OdaKlavye) => boolean;
  run: () => void;
}

const ZIYARET = "rubychat.sonOdalar";
const MAKS_ATLAMA = 20;
const MAKS_ATLAMA_ODA = 30;

function ziyaretOku(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(ZIYARET) ?? "[]") as unknown;
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

/** Per-room jump-origin stack (event ids) for Ctrl+O · Ctrl+O için oda başına atlama kökeni yığını (olay kimlikleri) */
const atlamaYigini = new Map<string, string[]>();

class Klavye {
  palet = $state(false);
  yardim = $state(false);
  /** Event id of the selected message (drives data-imlec and the hint strip) · Seçili mesajın olay kimliği (data-imlec ve ipucu şeridini sürer) */
  seciliId = $state<string | null>(null);
  oda = $state.raw<OdaKlavye | null>(null);
  /** Rooms in the order they were last opened · En son açılma sırasıyla odalar */
  ziyaret: string[] = ziyaretOku();

  secimBirak() {
    if (this.seciliId !== null) this.seciliId = null;
  }
}
export const klavye = new Klavye();

/** Records the current position of the open room before a jump (search result, reply quote, Ctrl+G). · Atlamadan önce açık odanın geçerli konumunu kaydeder (arama sonucu, yanıt alıntısı, Ctrl+G). */
export function konumKaydet(odaId: string, hedefOlayId?: string) {
  const oda = klavye.oda;
  if (!oda || oda.odaId !== odaId) return;
  const mevcut = oda.konum();
  if (!mevcut || (hedefOlayId && mevcut === hedefOlayId)) return;
  let yigin = atlamaYigini.get(odaId);
  if (!yigin) {
    if (atlamaYigini.size >= MAKS_ATLAMA_ODA) {
      const ilk = atlamaYigini.keys().next().value;
      if (ilk) atlamaYigini.delete(ilk);
    }
    yigin = [];
    atlamaYigini.set(odaId, yigin);
  }
  if (yigin.at(-1) === mevcut) return;
  yigin.push(mevcut);
  if (yigin.length > MAKS_ATLAMA) yigin.splice(0, yigin.length - MAKS_ATLAMA);
}

// ---- DOM helpers · DOM yardımcıları ----
const gorunur = (e: Element) => e.getClientRects().length > 0 && !e.closest("[inert]") && getComputedStyle(e).visibility !== "hidden";
const metinAlani = (e: Element | null): e is HTMLElement =>
  !!e && (e.matches('textarea, [contenteditable="true"]') || (e instanceof HTMLInputElement && !["checkbox", "radio", "range", "color", "button", "file"].includes(e.type)));

/** Top-most open menu or dialog, if any · Varsa en üstteki açık menü ya da pencere */
function ustKatman(): HTMLElement | null {
  const l = [...document.querySelectorAll<HTMLElement>('[role="menu"], [role="dialog"], [role="alertdialog"]')].filter(gorunur);
  return l.at(-1) ?? null;
}

/** Page drawn over the room (room info, members) · Odanın üstüne çizilen sayfa (oda bilgisi, üyeler) */
const odaSayfasi = () => [...document.querySelectorAll<HTMLElement>(".oda .ekran")].filter(gorunur).at(-1) ?? null;

/** Open composer / quick-switcher popover card · Açık yazma alanı / hızlı geçiş açılır kartı */
const acilirAcik = () => !!document.querySelector(".acilir.acik:not([inert])");

function odakla(e: HTMLElement | null): boolean {
  if (!e) return false;
  e.focus({ preventScroll: true });
  e.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function yazmaOdakla() {
  const alan = document.querySelector<HTMLElement>(".oda .yazma textarea") ?? document.querySelector<HTMLElement>('.oda .cubuk input[type="search"]');
  odakla(alan);
}

function listeKapsamlari(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".liste-sutunu, .serit, .ekran:not([inert])")].filter((e) => gorunur(e) && !e.closest(".oda"));
}

function listedeMi(): boolean {
  const odak = document.activeElement;
  if (!odak || odak === document.body || metinAlani(odak)) return false;
  return listeKapsamlari().some((k) => k.contains(odak));
}

function odaSatirlari(): HTMLElement[] {
  const sutun = [...document.querySelectorAll<HTMLElement>(".liste-sutunu, .ekran:not([inert])")].filter((e) => gorunur(e) && !e.closest(".oda"));
  const kapsayici = sutun.length > 0 ? sutun : [...document.querySelectorAll<HTMLElement>(".serit")].filter(gorunur);
  return kapsayici.flatMap((k) => {
    const kr = k.getBoundingClientRect();
    const secici = k.matches(".serit") ? "button.oda" : ".liste button.satir, .liste .satir > button.govde:not([disabled])";
    // Pager neighbours sit outside their column; keep only visible rows in the active page. · Sayfalayıcı komşuları sütunun dışındadır; yalnızca etkin sayfadaki görünür satırları al.
    return [...k.querySelectorAll<HTMLElement>(secici)].filter((e) => {
      const r = e.getBoundingClientRect();
      const orta = (r.left + r.right) / 2;
      return orta >= kr.left && orta <= kr.right && gorunur(e);
    });
  });
}

function listeOdakla() {
  klavye.secimBirak();
  duzen.listeGoster();
  if (gezinme.sekme === "ben") gezinme.sekmeSec("sohbetler");
  void tick().then(() => {
    requestAnimationFrame(() => {
      let l = odaSatirlari();
      if (l.length === 0 && gezinme.sekme !== "sohbetler") {
        gezinme.sekmeSec("sohbetler");
        void tick().then(() => {
          const s = odaSatirlari();
          odakla(s.find((e) => e.classList.contains("secili")) ?? s[0] ?? null);
        });
        return;
      }
      odakla(l.find((e) => e.classList.contains("secili")) ?? l[0] ?? null);
    });
  });
}

function listeOynat(adim: number) {
  const l = odaSatirlari();
  if (l.length === 0) return;
  const i = l.indexOf(document.activeElement as HTMLElement);
  if (i < 0) {
    odakla(l.find((e) => e.classList.contains("secili")) ?? l[0]);
    return;
  }
  odakla(l[Math.min(l.length - 1, Math.max(0, i + adim))]);
}

function listeyiAc() {
  const odak = document.activeElement;
  if (!(odak instanceof HTMLElement) || !odaSatirlari().includes(odak)) return;
  odak.click();
  if (duzen.cekmece) duzen.cekmeceKapat();
  void tick().then(() => setTimeout(yazmaOdakla, 50));
}

function odayaOdakla() {
  if (duzen.cekmece) duzen.cekmeceKapat();
  yazmaOdakla();
}

function odaDegistir(adim: number) {
  const l = odalar.suz("tumu");
  if (l.length === 0) return;
  const yazmadaydi = !!document.activeElement?.closest(".yazma") || !listedeMi();
  const i = l.findIndex((o) => o.id === gezinme.acikOdaId);
  gezinme.odaAc(l[i < 0 ? 0 : (i + adim + l.length) % l.length].id, true);
  if (yazmadaydi) void tick().then(() => setTimeout(yazmaOdakla, 50));
}

// ---- Message cursor · Mesaj imleci ----
const mesajSatirlari = () => [...(klavye.oda?.kutu()?.querySelectorAll<HTMLElement>(".satir[data-olay-id]") ?? [])];
const imlecSatiri = () =>
  klavye.seciliId ? klavye.oda?.kutu()?.querySelector<HTMLElement>(`.satir[data-olay-id="${CSS.escape(klavye.seciliId)}"]`) ?? null : null;

function satiraKaydir(e: HTMLElement) {
  const kutu = klavye.oda?.kutu();
  if (!kutu) return;
  // Floating header, composer and the optional hint strip sit over the list: stay between them. · Yüzen başlık, yazma alanı ve isteğe bağlı ipucu şeridi listenin üstündedir: aralarında kal.
  const stil = getComputedStyle(kutu);
  const ust = kutu.getBoundingClientRect().top + (parseFloat(stil.getPropertyValue("--tepe-yer")) || 64) + 8;
  const ipucuPay = tercihler.d.kisayolIpucu ? 36 : 0;
  const alt = kutu.getBoundingClientRect().bottom - (parseFloat(stil.getPropertyValue("--yazma-yer")) || 0) - ipucuPay - 8;
  const r = e.getBoundingClientRect();
  if (r.top < ust) kutu.scrollTop -= ust - r.top;
  else if (r.bottom > alt) kutu.scrollTop += r.bottom - alt;
}

function imlecOynat(adim: number) {
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const kutu = oda.kutu();
  if (!kutu) return;
  const l = mesajSatirlari();
  if (l.length === 0) return;
  const i = klavye.seciliId ? l.findIndex((e) => e.dataset.olayId === klavye.seciliId) : -1;
  let hedef: HTMLElement;
  if (i < 0) {
    // First press: lowest visible message above the composer. · İlk basış: yazma alanının üstündeki en alttaki görünür mesaj.
    const stil = getComputedStyle(kutu);
    const alt = kutu.getBoundingClientRect().bottom - (parseFloat(stil.getPropertyValue("--yazma-yer")) || 76) - 8;
    hedef = l.filter((e) => e.getBoundingClientRect().top < alt).at(-1) ?? l.at(-1)!;
  } else {
    if (i + adim >= l.length) oda.enAlta();
    if (i + adim < 0) kutu.scrollTop -= 240; // asks for older messages · eski mesajları ister
    hedef = l[Math.min(l.length - 1, Math.max(0, i + adim))];
  }
  klavye.seciliId = hedef.dataset.olayId ?? null;
  satiraKaydir(hedef);
}

function satirKonumu(): [number, number] {
  const s = imlecSatiri();
  if (!s) return [window.innerWidth / 2, window.innerHeight / 2];
  const r = (s.querySelector(".balon, .cikartma-kap, .kolon") ?? s).getBoundingClientRect();
  const x = Math.max(24, Math.min(r.left + 40, window.innerWidth - 40));
  const y = Math.max(72, Math.min(r.bottom, window.innerHeight - 120));
  return [x, y];
}

function menuOdakla() {
  setTimeout(() => {
    const m = ustKatman();
    const oge = m?.querySelector<HTMLElement>('[role="menuitem"], button:not([disabled])') ?? null;
    odakla(oge);
  }, 60);
}

function mesajEylemi(yap: (oge: ZamanOgesi, oda: OdaKlavye) => void) {
  const oda = klavye.oda;
  if (!oda || odaSayfasi() || listedeMi()) return;
  const oge = oda.seciliOge();
  if (!oge) return;
  yap(oge, oda);
}

function geriDon() {
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const yigin = atlamaYigini.get(oda.odaId);
  const hedef = yigin?.pop();
  if (!hedef) return;
  klavye.secimBirak();
  oda.olayaAtla(hedef);
}

// ---- Single source of truth: command table (dispatch, help sheet, settings, hint strip) ----
// ---- Tek doğruluk kaynağı: komut tablosu (çalıştırma, yardım sayfası, ayarlar, ipucu şeridi) ----
export const KOMUTLAR: readonly Komut[] = [
  // Always active · Her zaman etkin
  {
    id: "palet",
    key: "Ctrl+Space",
    context: "genel",
    herZaman: true,
    etiket: "klavye.kPalet",
    ctrl: true,
    shift: false,
    tus: " ",
    kod: "Space",
    run: () => {
      // A modal dialog that must be finished stays on top. · Bitirilmesi gereken pencere üstte kalır.
      if (klavye.palet || !ustKatman()) klavye.palet = !klavye.palet;
    },
  },
  {
    id: "liste",
    key: "Ctrl+B",
    context: "genel",
    herZaman: true,
    etiket: "klavye.kListe",
    ctrl: true,
    shift: false,
    tus: "b",
    run: () => {
      if (!ustKatman()) duzen.degistir();
    },
  },

  // Global when on · Açıkken genel
  {
    id: "mesajSonraki",
    key: "Ctrl+J",
    context: "genel",
    etiket: "klavye.kMesajSonraki",
    ctrl: true,
    shift: false,
    tus: "j",
    run: () => imlecOynat(1),
  },
  {
    id: "mesajOnceki",
    key: "Ctrl+K",
    context: "genel",
    etiket: "klavye.kMesajOnceki",
    ctrl: true,
    shift: false,
    tus: "k",
    run: () => imlecOynat(-1),
  },
  {
    id: "listeye",
    key: "Ctrl+H",
    context: "genel",
    etiket: "klavye.kListeye",
    ctrl: true,
    shift: false,
    tus: "h",
    run: listeOdakla,
  },
  {
    id: "odaya",
    key: "Ctrl+L",
    context: "genel",
    etiket: "klavye.kOdaya",
    ctrl: true,
    shift: false,
    tus: "l",
    run: odayaOdakla,
  },
  {
    id: "sonrakiOda",
    key: "Ctrl+Shift+J",
    context: "genel",
    etiket: "klavye.kSonrakiOda",
    ctrl: true,
    shift: true,
    tus: "j",
    run: () => odaDegistir(1),
  },
  {
    id: "oncekiOda",
    key: "Ctrl+Shift+K",
    context: "genel",
    etiket: "klavye.kOncekiOda",
    ctrl: true,
    shift: true,
    tus: "k",
    run: () => odaDegistir(-1),
  },
  {
    id: "ara",
    key: "Ctrl+F",
    context: "genel",
    etiket: "klavye.kAra",
    ctrl: true,
    shift: false,
    tus: "f",
    run: () => {
      if (klavye.oda && !odaSayfasi()) klavye.oda.ara();
    },
  },
  {
    id: "enYeni",
    key: "Ctrl+G",
    context: "genel",
    etiket: "klavye.kEnYeni",
    ctrl: true,
    shift: false,
    tus: "g",
    run: () => {
      const oda = klavye.oda;
      if (!oda || odaSayfasi()) return;
      konumKaydet(oda.odaId, oda.enYeniId() ?? undefined);
      klavye.secimBirak();
      oda.enAlta();
    },
  },
  {
    id: "geriDon",
    key: "Ctrl+O",
    context: "genel",
    etiket: "klavye.kGeriDon",
    ctrl: true,
    shift: false,
    tus: "o",
    run: geriDon,
  },
  {
    id: "yardim",
    key: "Ctrl+/",
    context: "genel",
    etiket: "klavye.kYardim",
    ctrl: true,
    shift: false,
    tus: "/",
    shiftEsnek: true,
    run: () => {
      klavye.yardim = true;
    },
  },
  {
    id: "secimBirak",
    key: "Esc",
    context: "genel",
    etiket: "klavye.kEsc",
    ctrl: false,
    shift: false,
    tus: "escape",
    run: () => klavye.secimBirak(),
  },

  // List side · Oda listesi
  {
    id: "listeSonraki",
    key: "Ctrl+J",
    context: "liste",
    etiket: "klavye.kListeSonraki",
    ctrl: true,
    shift: false,
    tus: "j",
    run: () => listeOynat(1),
  },
  {
    id: "listeOnceki",
    key: "Ctrl+K",
    context: "liste",
    etiket: "klavye.kListeOnceki",
    ctrl: true,
    shift: false,
    tus: "k",
    run: () => listeOynat(-1),
  },
  {
    id: "listeAc",
    key: "Enter",
    context: "liste",
    etiket: "klavye.kListeAc",
    ctrl: false,
    shift: false,
    tus: "enter",
    run: listeyiAc,
  },

  // Selected message actions · Seçili mesaj eylemleri
  {
    id: "yanitla",
    key: "Ctrl+R",
    context: "mesaj",
    etiket: "klavye.kYanit",
    ctrl: true,
    shift: false,
    tus: "r",
    uygun: (o) => gercekOlay(o),
    run: () =>
      mesajEylemi((o, oda) => {
        if (!gercekOlay(o)) return;
        klavye.secimBirak();
        oda.yanitla(o);
      }),
  },
  {
    id: "tepki",
    key: "Ctrl+T",
    context: "mesaj",
    etiket: "klavye.kTepki",
    ipucuEtiket: "klavye.iTepki",
    ctrl: true,
    shift: false,
    tus: "t",
    uygun: (o) => gercekOlay(o),
    run: () =>
      mesajEylemi((o, oda) => {
        if (!gercekOlay(o)) return;
        const [x, y] = satirKonumu();
        oda.tepki(o, x, y);
      }),
  },
  {
    id: "kopyala",
    key: "Ctrl+Y",
    context: "mesaj",
    etiket: "klavye.kKopya",
    ctrl: true,
    shift: false,
    tus: "y",
    uygun: (o) => !!o.metin,
    run: () =>
      mesajEylemi((o, oda) => {
        if (o.metin) oda.kopyala(o);
      }),
  },
  {
    id: "duzenle",
    key: "Ctrl+E",
    context: "mesaj",
    etiket: "klavye.kDuzenle",
    ctrl: true,
    shift: false,
    tus: "e",
    uygun: (o) => o.duzenlenebilir,
    run: () =>
      mesajEylemi((o, oda) => {
        if (!o.duzenlenebilir) return;
        klavye.secimBirak();
        oda.duzenle(o);
      }),
  },
  {
    id: "sabitle",
    key: "Ctrl+S",
    context: "mesaj",
    etiket: "klavye.kSabitle",
    ipucuEtiket: "klavye.iSabitle",
    ctrl: true,
    shift: false,
    tus: "s",
    uygun: (o, oda) => gercekOlay(o) && oda.sabitleyebilir(),
    run: () =>
      mesajEylemi((o, oda) => {
        if (gercekOlay(o) && oda.sabitleyebilir()) oda.sabitle(o);
      }),
  },
  {
    id: "ilet",
    key: "Ctrl+Shift+F",
    context: "mesaj",
    etiket: "klavye.kIlet",
    ctrl: true,
    shift: true,
    tus: "f",
    uygun: (o) => gercekOlay(o) && iletilebilir(o),
    run: () =>
      mesajEylemi((o, oda) => {
        if (gercekOlay(o) && iletilebilir(o)) oda.ilet(o);
      }),
  },
  {
    id: "profil",
    key: "Ctrl+P",
    context: "mesaj",
    etiket: "klavye.kProfil",
    ipucuEtiket: "klavye.iProfil",
    ctrl: true,
    shift: false,
    tus: "p",
    uygun: (o) => !!o.gonderen,
    run: () =>
      mesajEylemi((o, oda) => {
        if (o.gonderen) oda.profil(o);
      }),
  },
  {
    id: "sil",
    key: "Ctrl+D",
    context: "mesaj",
    etiket: "klavye.kSil",
    ctrl: true,
    shift: false,
    tus: "d",
    uygun: (o) => o.silinebilir,
    run: () =>
      mesajEylemi((o, oda) => {
        if (o.silinebilir) oda.sil(o);
      }),
  },
  {
    id: "menu",
    key: "Ctrl+Enter",
    context: "mesaj",
    etiket: "klavye.kMenu",
    ipucuEtiket: "klavye.iMenu",
    ctrl: true,
    shift: false,
    tus: "enter",
    uygun: (o, oda) => oda.menuVar(o),
    run: () =>
      mesajEylemi((o, oda) => {
        if (!oda.menuVar(o)) return;
        const [x, y] = satirKonumu();
        oda.menu(o, x, y);
        menuOdakla();
      }),
  },
];

/** Commands usable for a given selected message (drives the hint strip from the single table). · Seçili mesaj için kullanılabilir komutlar (ipucu şeridini tek tablodan sürer). */
export function mesajKomutlari(oge: ZamanOgesi): Komut[] {
  const oda = klavye.oda;
  if (!oda) return [];
  return KOMUTLAR.filter((k) => k.context === "mesaj" && (!k.uygun || k.uygun(oge, oda)));
}

function tusEslesir(k: Komut, e: KeyboardEvent): boolean {
  if (e.ctrlKey !== k.ctrl) return false;
  if (!k.shiftEsnek && e.shiftKey !== k.shift) return false;
  if (k.kod && e.code === k.kod) return true;
  return e.key.toLowerCase() === k.tus;
}

function komutBul(e: KeyboardEvent, baglam: KomutBaglami, herZaman = false): Komut | undefined {
  return KOMUTLAR.find((k) => Boolean(k.herZaman) === herZaman && k.context === baglam && tusEslesir(k, e));
}

function tus(e: KeyboardEvent) {
  if (!oturum.ben || e.defaultPrevented || e.isComposing) return;
  // Never intercept Alt / Meta / AltGr combos (e.g. Turkish layout @, [, ], {, }). · Alt / Meta / AltGr bileşimlerini asla yakalama (örn. Türkçe düzende @, [, ], {, }).
  if (e.altKey || e.metaKey || e.getModifierState("AltGraph")) return;

  // 1. Always-active commands: Ctrl+Space and Ctrl+B. · Her zaman etkin komutlar: Ctrl+Space ve Ctrl+B.
  const her = komutBul(e, "genel", true);
  if (her) {
    if (ustKatman() && !(her.id === "palet" && klavye.palet)) return;
    e.preventDefault();
    her.run();
    return;
  }

  // 2. Everything else requires the setting to be on. · Geri kalan her şey ayarın açık olmasını ister.
  if (!tercihler.d.ctrlKisayol) return;

  // 3. Never intercept while a dialog / menu is open (Esc and the dialog's own handlers stay in charge). · Pencere / menü açıkken asla yakalama (Esc ve pencerenin kendi işleyicileri yönetir).
  if (ustKatman()) return;

  // 4. Esc drops the message selection first when no overlay is covering the room; otherwise it falls through to existing handling.
  //    Odayı örten bir katman yokken Esc önce mesaj seçimini bırakır; değilse mevcut işleyişe geçer.
  if (e.key === "Escape" && !e.ctrlKey && !e.shiftKey) {
    if (klavye.seciliId && !odaSayfasi() && !duzen.cekmece && !klavye.oda?.aramaAcik() && !acilirAcik() && !document.getElementById("bahis-listesi")) {
      e.preventDefault();
      klavye.secimBirak();
    }
    return;
  }

  // Keep @mention autocomplete in YazmaAlani in charge while it is open. · YazmaAlani'ndaki @bahsetme listesi açıkken önceliği onda tut.
  const bahisAcik = !!document.getElementById("bahis-listesi");

  // 5. List context (when list side has focus): Ctrl+J/K move between room rows, Enter opens focused room row.
  //    Liste bağlamı (liste tarafı odaktayken): Ctrl+J/K oda satırlarında gezer, Enter odaktaki odayı açar.
  if (listedeMi()) {
    const k = komutBul(e, "liste");
    if (k) {
      if (k.id === "listeAc" && !(document.activeElement instanceof HTMLElement && odaSatirlari().includes(document.activeElement))) return;
      e.preventDefault();
      k.run();
      return;
    }
  }

  // 6. Global and message commands (only Ctrl combos reach here; Esc and list Enter were handled above).
  //    Genel ve mesaj komutları (buraya yalnızca Ctrl bileşimleri ulaşır; Esc ve liste Enter yukarıda işlendi).
  if (!e.ctrlKey) {
    // A closed menu or dialog leaves the focus on the page: a typed character goes to the composer. · Kapanan menü ya da pencere odağı sayfada bırakır: yazılan karakter yazma alanına gider.
    if (e.key.length === 1 && document.activeElement === document.body && klavye.oda && !odaSayfasi()) yazmaOdakla();
    return;
  }
  const genel = komutBul(e, "genel");
  if (genel) {
    e.preventDefault();
    if (!bahisAcik) genel.run();
    return;
  }
  const mesaj = komutBul(e, "mesaj");
  if (mesaj) {
    // Prevent browser defaults (Print, Reload, Save, etc.) while the feature is on, even without a selection.
    // Özellik açıkken seçim olmasa da tarayıcı varsayılanlarını (Yazdır, Yenile, Kaydet vb.) engelle.
    e.preventDefault();
    if (!bahisAcik) mesaj.run();
  }
}

export function klavyeBaslat(): () => void {
  window.addEventListener("keydown", tus);
  const bitir = $effect.root(() => {
    $effect(() => {
      const id = gezinme.acikOdaId;
      // Untracked: reading the selection here would clear it the moment it is made. · İzlenmeden: seçimi burada okumak onu yapıldığı an silerdi.
      untrack(() => klavye.secimBirak());
      if (!id) return;
      klavye.ziyaret = [id, ...klavye.ziyaret.filter((x) => x !== id)].slice(0, 30);
      try {
        localStorage.setItem(ZIYARET, JSON.stringify(klavye.ziyaret));
      } catch {
        /* storage blocked: kept for this run · depolama engelli: bu çalışma için tutulur */
      }
    });
    $effect(() => {
      if (!tercihler.d.ctrlKisayol) klavye.secimBirak();
    });
  });
  return () => {
    window.removeEventListener("keydown", tus);
    bitir();
  };
}
