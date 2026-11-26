// Desktop Vim + modeless Ctrl keyboard shortcuts: one command table drives dispatch, hint strip, help sheet and settings.
// Ctrl+Space (room palette) and Ctrl+B (show / hide list) always work; the rest follow Ben › Klavye kısayolları.
// Normal-mode Vim keys never intercept text typed inside any input or composer; Esc leaves the composer into Normal mode.
// Masaüstü Vim + kipsiz Ctrl klavye kısayolları: tek komut tablosu çalıştırmayı, ipucu şeridini, yardım sayfasını ve ayarları sürer.
// Ctrl+Space (oda paleti) ve Ctrl+B (listeyi göster / gizle) hep çalışır; gerisi Ben › Klavye kısayolları'nı izler.
// Normal kip Vim tuşları yazma alanı veya girdilerdeki yazıyı asla yemez; Esc yazma alanından Normal kipe çıkar.
import { mount, tick, unmount, untrack } from "svelte";
import type { ZamanOgesi } from "./api/tipler";
import KlavyeDurum from "./bilesenler/KlavyeDurum.svelte";
import { bildirim } from "./durum/bildirim.svelte";
import { duzen } from "./durum/duzen.svelte";
import { gezinme } from "./durum/gezinme.svelte";
import { odalar } from "./durum/odalar.svelte";
import { oturum } from "./durum/oturum.svelte";
import { tercihler } from "./durum/tercihler.svelte";
import { t, type Anahtar } from "./i18n";
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
  /** Open in-room search; optional prefilled query and Vim mode flag · Oda içi aramayı aç; isteğe bağlı ön sorgu ve Vim kipi bayrağı */
  ara: (metin?: string, vim?: boolean) => void;
  aramaKapat: () => void;
  /** Step search matches (-1 = older / n, 1 = newer / N) and return active event id · Arama eşleşmelerinde adım at ve etkin olay kimliğini döndür */
  aramaAdim: (yon: -1 | 1) => string | null;
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
export type KlavyeKipi = "normal" | "yazma" | "ara" | "komut";
export type YardimGrubu = "gezinme" | "mesajlar" | "sohbetler" | "komut" | "genel";

export interface Komut {
  id: string;
  /** Display key combo (split on "+" for <kbd> chips) · Gösterim tuş bileşimi (<kbd> için "+" ile bölünür) */
  key: string;
  /** Concise Normal-mode Vim key shown in the hint strip when in Normal mode · Normal kipteyken ipucu şeridinde gösterilen kısa Vim tuşu */
  vimKey?: string;
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

export interface YardimOgesi {
  id: string;
  grup: YardimGrubu;
  /** Alternative key sequences, each split into individual <kbd> chips · Alternatif tuş dizileri, her biri ayrı <kbd> çiplerine bölünür */
  tuslar: readonly (readonly string[])[];
  etiket: Anahtar;
  /** Works even when Vim / keyboard shortcuts are turned off · Vim / klavye kısayolları kapalıyken de çalışır */
  herZaman?: boolean;
  /** Extra search terms (Turkish/English aliases) · Ek arama sözcükleri */
  anahtarlar?: string;
}

export interface SatirKomutu {
  ad: string;
  ek?: string;
  etiket: Anahtar;
  takma?: readonly string[];
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

  /** Count prefix digits accumulated in Normal mode (e.g. "5") · Normal kipte biriken sayı öneki rakamları (örn. "5") */
  sayac = $state("");
  /** Pending two-key leader ("g", "d", "z") · Bekleyen iki tuşlu önek ("g", "d", "z") */
  bekleyen = $state<"" | "g" | "d" | "z">("");
  /** ":" mini command line state · ":" küçük komut satırı durumu */
  komutAcik = $state(false);
  komutMetin = $state("");

  /** Focus and overlay mirrors for reactive mode indicator · Reaktif kip göstergesi için odak ve katman yansıları */
  odakMetinde = $state(false);
  odakAramada = $state(false);
  katmanAcik = $state(false);
  aramaAcik = $state(false);
  aramaSira = $state(0);
  aramaToplam = $state(0);
  /** True while KisayolIpucu is mounted so KlavyeDurum avoids showing a duplicate badge · Çift rozet olmasın diye KisayolIpucu görünürken true */
  ipucuGorunur = $state(false);
  /** Consumed by Sohbetler to open YeniSohbet from ":yeni" · ":yeni" komutundan YeniSohbet açmak için Sohbetler tarafından tüketilir */
  yeniSohbetBekleyen = $state(false);
  /** Last in-room search query per room (for reopening on n/N) · Oda başına son arama sorgusu */
  sonArama = new Map<string, string>();

  kip = $derived.by<KlavyeKipi>(() => {
    if (this.komutAcik) return "komut";
    if (this.aramaAcik && this.odakAramada) return "ara";
    if (this.odakMetinde) return "yazma";
    return "normal";
  });

  bekleyenTemizle() {
    if (this.sayac) this.sayac = "";
    if (this.bekleyen) this.bekleyen = "";
  }

  komutAc() {
    this.bekleyenTemizle();
    this.komutMetin = "";
    this.komutAcik = true;
  }

  komutKapat() {
    if (!this.komutAcik) return;
    this.komutAcik = false;
    this.komutMetin = "";
  }

  secimBirak() {
    if (this.seciliId !== null) this.seciliId = null;
  }
}
export const klavye = new Klavye();

/** Records the current position of the open room before a jump (search result, reply quote, Ctrl+G, gg/G). · Atlamadan önce açık odanın geçerli konumunu kaydeder (arama sonucu, yanıt alıntısı, Ctrl+G, gg/G). */
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

const katla = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");

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

async function yazmayaGec() {
  if (duzen.cekmece) duzen.cekmeceKapat();
  if (!klavye.oda || odaSayfasi()) return;
  // In-room search replaces YazmaAlani while open: close it first so the textarea mounts. · Oda içi arama açıkken YazmaAlani'nın yerini alır: textarea takılsın diye önce kapat.
  if (klavye.oda.aramaAcik()) {
    klavye.oda.aramaKapat();
    await tick();
  }
  const alan = document.querySelector<HTMLElement>(".oda .yazma textarea");
  odakla(alan);
}

async function yazmaEylemi(yap: () => void) {
  if (klavye.oda?.aramaAcik()) {
    klavye.oda.aramaKapat();
    await tick();
  }
  yap();
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
  klavye.bekleyenTemizle();
  duzen.listeGoster();
  if (gezinme.sekme === "ben") gezinme.sekmeSec("sohbetler");
  void tick().then(() => {
    requestAnimationFrame(() => {
      const l = odaSatirlari();
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
  void yazmayaGec();
}

function odaDegistir(adim: number, yazmaOdagiKoru = true) {
  const l = odalar.suz("tumu");
  if (l.length === 0) return;
  // Preserve composer focus only when the user was already typing there; Normal-mode gt/gT/H/L stay in Normal mode.
  // Yalnızca kullanıcı zaten yazma alanındaysa odağı koru; Normal kipteki gt/gT/H/L Normal kipte kalır.
  const yazmadaydi = yazmaOdagiKoru && !!document.activeElement?.closest(".yazma");
  const i = l.findIndex((o) => o.id === gezinme.acikOdaId);
  const hedef = i < 0 ? 0 : (((i + adim) % l.length) + l.length) % l.length;
  gezinme.odaAc(l[hedef].id, true);
  if (yazmadaydi) void tick().then(() => setTimeout(yazmaOdakla, 50));
}

// ---- Message cursor & Vim motions · Mesaj imleci ve Vim hareketleri ----
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
    // First press: lowest visible message above the composer (shifted by extra count if > 1). · İlk basış: yazma alanının üstündeki en alttaki görünür mesaj.
    const stil = getComputedStyle(kutu);
    const alt = kutu.getBoundingClientRect().bottom - (parseFloat(stil.getPropertyValue("--yazma-yer")) || 76) - 8;
    const bas = l.filter((e) => e.getBoundingClientRect().top < alt).at(-1) ?? l.at(-1)!;
    const basIdx = l.indexOf(bas);
    const kayma = adim > 1 ? adim - 1 : adim < -1 ? adim + 1 : 0;
    hedef = l[Math.min(l.length - 1, Math.max(0, basIdx + kayma))];
  } else {
    if (i + adim >= l.length) oda.enAlta();
    if (i + adim < 0) kutu.scrollTop = Math.max(0, kutu.scrollTop - 240); // asks for older messages · eski mesajları ister
    hedef = l[Math.min(l.length - 1, Math.max(0, i + adim))];
  }
  klavye.seciliId = hedef.dataset.olayId ?? null;
  satiraKaydir(hedef);
}

function basaGit(hedefSira: number | null) {
  if (listedeMi()) {
    const l = odaSatirlari();
    if (l.length === 0) return;
    const idx = hedefSira ? Math.min(l.length - 1, Math.max(0, hedefSira - 1)) : 0;
    odakla(l[idx]);
    return;
  }
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const kutu = oda.kutu();
  if (!kutu) return;
  const l = mesajSatirlari();
  if (l.length === 0) return;
  konumKaydet(oda.odaId);
  const idx = hedefSira ? Math.min(l.length - 1, Math.max(0, hedefSira - 1)) : 0;
  const hedef = l[idx];
  klavye.seciliId = hedef.dataset.olayId ?? null;
  if (!hedefSira) kutu.scrollTop = 0;
  else satiraKaydir(hedef);
}

function sonaGit(hedefSira: number | null) {
  if (listedeMi()) {
    const l = odaSatirlari();
    if (l.length === 0) return;
    const idx = hedefSira ? Math.min(l.length - 1, Math.max(0, hedefSira - 1)) : l.length - 1;
    odakla(l[idx]);
    return;
  }
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const kutu = oda.kutu();
  if (!kutu) return;
  const l = mesajSatirlari();
  if (l.length === 0) return;
  konumKaydet(oda.odaId, oda.enYeniId() ?? undefined);
  if (hedefSira) {
    const hedef = l[Math.min(l.length - 1, Math.max(0, hedefSira - 1))];
    klavye.seciliId = hedef.dataset.olayId ?? null;
    satiraKaydir(hedef);
    return;
  }
  const son = l.at(-1)!;
  klavye.seciliId = son.dataset.olayId ?? null;
  oda.enAlta();
}

function yarimSayfa(yon: number) {
  if (listedeMi()) {
    const l = odaSatirlari();
    if (l.length === 0) return;
    const kapsayici = l[0].closest<HTMLElement>(".liste");
    if (kapsayici) kapsayici.scrollTop += Math.round(kapsayici.clientHeight * 0.5) * yon;
    listeOynat(yon * 5);
    return;
  }
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const kutu = oda.kutu();
  if (!kutu) return;
  const stil = getComputedStyle(kutu);
  const tepe = parseFloat(stil.getPropertyValue("--tepe-yer")) || 64;
  const alt = parseFloat(stil.getPropertyValue("--yazma-yer")) || 76;
  const gorunurYuk = Math.max(120, kutu.clientHeight - tepe - alt);
  kutu.scrollTop += Math.round(gorunurYuk * 0.5) * yon;
  // Keep selection anchored to the row closest to the new viewport centre. · Seçimi yeni görünür alanın ortasına en yakın satırda tut.
  const l = mesajSatirlari();
  if (l.length === 0) return;
  const kr = kutu.getBoundingClientRect();
  const orta = (kr.top + tepe + kr.bottom - alt) / 2;
  let enYakin: HTMLElement = l[0];
  let enAz = Infinity;
  for (const s of l) {
    const r = s.getBoundingClientRect();
    const d = Math.abs((r.top + r.bottom) / 2 - orta);
    if (d < enAz) {
      enAz = d;
      enYakin = s;
    }
  }
  klavye.seciliId = enYakin.dataset.olayId ?? null;
}

function satiriHizala(yer: "orta" | "ust" | "alt") {
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  const kutu = oda.kutu();
  if (!kutu) return;
  let satir = imlecSatiri();
  if (!satir) {
    const l = mesajSatirlari();
    if (l.length === 0) return;
    const kr = kutu.getBoundingClientRect();
    const orta = (kr.top + kr.bottom) / 2;
    satir = l.reduce((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return Math.abs((rb.top + rb.bottom) / 2 - orta) < Math.abs((ra.top + ra.bottom) / 2 - orta) ? b : a;
    });
    klavye.seciliId = satir.dataset.olayId ?? null;
  }
  const stil = getComputedStyle(kutu);
  const kr = kutu.getBoundingClientRect();
  const ust = kr.top + (parseFloat(stil.getPropertyValue("--tepe-yer")) || 64) + 8;
  const ipucuPay = tercihler.d.kisayolIpucu ? 36 : 0;
  const alt = kr.bottom - (parseFloat(stil.getPropertyValue("--yazma-yer")) || 76) - ipucuPay - 8;
  const r = satir.getBoundingClientRect();
  if (yer === "orta") kutu.scrollTop += (r.top + r.bottom) / 2 - (ust + alt) / 2;
  else if (yer === "ust") kutu.scrollTop += r.top - ust;
  else kutu.scrollTop += r.bottom - alt;
}

function aramaAdimla(yon: -1 | 1, tekrar: number) {
  const oda = klavye.oda;
  if (!oda || odaSayfasi()) return;
  if (!oda.aramaAcik()) {
    const onceki = klavye.sonArama.get(oda.odaId);
    if (onceki) oda.ara(onceki, true);
    return;
  }
  let son: string | null = null;
  for (let i = 0; i < Math.min(tekrar, 100); i++) {
    son = oda.aramaAdim(yon);
  }
  if (son) klavye.seciliId = son;
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

function sayacAl(): number {
  const n = Math.max(1, parseInt(klavye.sayac, 10) || 1);
  klavye.bekleyenTemizle();
  return n;
}

// ---- ":" Command line table & dispatcher · ":" Komut satırı tablosu ve çalıştırıcı ----
export const KOMUT_SATIRI: readonly SatirKomutu[] = [
  { ad: "q", etiket: "klavye.vKomutQ", takma: ["quit", "kapat"] },
  { ad: "ayarlar", etiket: "klavye.vKomutAyarlar", takma: ["ayar", "settings", "set"] },
  { ad: "yeni", etiket: "klavye.vKomutYeni", takma: ["new"] },
  { ad: "ara", ek: " <metin>", etiket: "klavye.vKomutAra", takma: ["search", "bul"] },
  { ad: "yardim", etiket: "klavye.vKomutYardim", takma: ["help", "h"] },
];

export function komutCalistir(ham: string) {
  const temiz = ham.trim().replace(/^:+/, "").trim();
  klavye.komutKapat();
  if (!temiz) return;
  const bosluk = temiz.search(/\s/);
  const ad = katla(bosluk < 0 ? temiz : temiz.slice(0, bosluk));
  const arg = bosluk < 0 ? "" : temiz.slice(bosluk + 1).trim();

  if (ad === "q" || ad === "quit" || ad === "kapat") {
    if (gezinme.benAlt) gezinme.benAltKapat();
    else if (gezinme.acikOdaId) gezinme.odaKapat();
    return;
  }
  if (ad === "ayarlar" || ad === "ayar" || ad === "settings" || ad === "set") {
    duzen.listeGoster();
    const alt = katla(arg);
    if (alt === "klavye" || alt === "keyboard") gezinme.benAltAc("klavye");
    else if (alt === "gorunum" || alt === "appearance") gezinme.benAltAc("gorunum");
    else if (alt === "sohbet" || alt === "chat") gezinme.benAltAc("sohbet");
    else if (alt === "bildirim" || alt === "bildirimler" || alt === "notifications") gezinme.benAltAc("bildirimler");
    else if (alt === "guvenlik" || alt === "security") gezinme.benAltAc("guvenlik");
    else if (alt === "hesap" || alt === "account") gezinme.benAltAc("hesap");
    else gezinme.sekmeSec("ben");
    return;
  }
  if (ad === "yeni" || ad === "new") {
    duzen.listeGoster();
    if (gezinme.sekme !== "sohbetler") gezinme.sekmeSec("sohbetler");
    klavye.yeniSohbetBekleyen = true;
    return;
  }
  if (ad === "ara" || ad === "search" || ad === "bul") {
    const oda = klavye.oda;
    if (!oda || odaSayfasi()) {
      bildirim.goster(t("klavye.komutOdaYok"), 2500, { tur: "bilgi" });
      return;
    }
    if (arg) klavye.sonArama.set(oda.odaId, arg);
    oda.ara(arg || undefined, true);
    return;
  }
  if (ad === "yardim" || ad === "help" || ad === "h") {
    klavye.yardim = true;
    return;
  }
  if (ad === "oda" || ad === "o") {
    klavye.palet = true;
    return;
  }
  if (ad === "liste" || ad === "b") {
    duzen.degistir();
    return;
  }
  bildirim.goster(t("klavye.komutBilinmiyor", { k: ad }), 2500, { tur: "hata" });
}

// ---- Single source of truth: Ctrl command table (dispatch & hint strip) ----
// ---- Tek doğruluk kaynağı: Ctrl komut tablosu (çalıştırma ve ipucu şeridi) ----
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
      if (klavye.palet || !ustKatman()) {
        klavye.komutKapat();
        klavye.bekleyenTemizle();
        klavye.palet = !klavye.palet;
      }
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
    run: () => imlecOynat(sayacAl()),
  },
  {
    id: "mesajOnceki",
    key: "Ctrl+K",
    context: "genel",
    etiket: "klavye.kMesajOnceki",
    ctrl: true,
    shift: false,
    tus: "k",
    run: () => imlecOynat(-sayacAl()),
  },
  {
    id: "yarimAsagi",
    key: "Ctrl+D",
    context: "genel",
    etiket: "klavye.vYarimSayfa",
    ctrl: true,
    shift: false,
    tus: "d",
    run: () => yarimSayfa(sayacAl()),
  },
  {
    id: "yarimYukari",
    key: "Ctrl+U",
    context: "genel",
    etiket: "klavye.vYarimSayfa",
    ctrl: true,
    shift: false,
    tus: "u",
    run: () => yarimSayfa(-sayacAl()),
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
    run: () => odaDegistir(sayacAl(), true),
  },
  {
    id: "oncekiOda",
    key: "Ctrl+Shift+K",
    context: "genel",
    etiket: "klavye.kOncekiOda",
    ctrl: true,
    shift: true,
    tus: "k",
    run: () => odaDegistir(-sayacAl(), true),
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
      if (klavye.oda && !odaSayfasi()) klavye.oda.ara(undefined, false);
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
    run: () => listeOynat(sayacAl()),
  },
  {
    id: "listeOnceki",
    key: "Ctrl+K",
    context: "liste",
    etiket: "klavye.kListeOnceki",
    ctrl: true,
    shift: false,
    tus: "k",
    run: () => listeOynat(-sayacAl()),
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
    vimKey: "r",
    context: "mesaj",
    etiket: "klavye.kYanit",
    ctrl: true,
    shift: false,
    tus: "r",
    uygun: (o) => gercekOlay(o),
    run: () =>
      mesajEylemi((o, oda) => {
        if (!gercekOlay(o)) return;
        void yazmaEylemi(() => {
          klavye.secimBirak();
          oda.yanitla(o);
        });
      }),
  },
  {
    id: "tepki",
    key: "Ctrl+T",
    vimKey: "+",
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
    vimKey: "y",
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
    vimKey: "e",
    context: "mesaj",
    etiket: "klavye.kDuzenle",
    ctrl: true,
    shift: false,
    tus: "e",
    uygun: (o) => o.duzenlenebilir,
    run: () =>
      mesajEylemi((o, oda) => {
        if (!o.duzenlenebilir) return;
        void yazmaEylemi(() => {
          klavye.secimBirak();
          oda.duzenle(o);
        });
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
    key: "Ctrl+Shift+D",
    vimKey: "dd",
    context: "mesaj",
    etiket: "klavye.kSil",
    ctrl: true,
    shift: true,
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

// ---- Grouped shortcut catalogue for "?" help & KlavyeAyarlari · "?" yardımı ve KlavyeAyarlari için gruplu kısayol kataloğu ----
export const YARDIM_GRUPLARI: readonly { id: YardimGrubu; ad: Anahtar }[] = [
  { id: "gezinme", ad: "klavye.grupGezinme" },
  { id: "mesajlar", ad: "klavye.grupMesajlar" },
  { id: "sohbetler", ad: "klavye.grupSohbetler" },
  { id: "komut", ad: "klavye.grupKomut" },
  { id: "genel", ad: "klavye.grupGenel" },
];

export const YARDIM_OGELERI: readonly YardimOgesi[] = [
  // Gezinme · Navigation
  { id: "v-jk", grup: "gezinme", tuslar: [["j"], ["k"], ["Ctrl", "J"], ["Ctrl", "K"]], etiket: "klavye.vHareket", anahtarlar: "asagi yukari down up next prev" },
  { id: "v-sayac", grup: "gezinme", tuslar: [["5", "j"], ["5", "k"]], etiket: "klavye.vSayac", anahtarlar: "sayi onek count repeat 5j 3k" },
  { id: "v-ggg", grup: "gezinme", tuslar: [["g", "g"], ["G"]], etiket: "klavye.vBasaSona", anahtarlar: "bas son top bottom oldest newest gg G" },
  { id: "v-yarim", grup: "gezinme", tuslar: [["Ctrl", "D"], ["Ctrl", "U"]], etiket: "klavye.vYarimSayfa", anahtarlar: "half page scroll kaydir" },
  { id: "v-zzzt", grup: "gezinme", tuslar: [["z", "z"], ["z", "t"]], etiket: "klavye.vHizala", anahtarlar: "center top ortala ust zz zt zb" },
  { id: "v-ara", grup: "gezinme", tuslar: [["/"], ["Ctrl", "F"]], etiket: "klavye.vAra", anahtarlar: "search find bul oda" },
  { id: "v-nn", grup: "gezinme", tuslar: [["n"], ["N"]], etiket: "klavye.vAraAdim", anahtarlar: "next prev match eslesme" },
  { id: "v-enyeni", grup: "gezinme", tuslar: [["Ctrl", "G"]], etiket: "klavye.kEnYeni", anahtarlar: "bottom latest" },
  { id: "v-geri", grup: "gezinme", tuslar: [["Ctrl", "O"]], etiket: "klavye.kGeriDon", anahtarlar: "jump back atla" },

  // Mesajlar · Messages
  { id: "m-yanit", grup: "mesajlar", tuslar: [["r"], ["Ctrl", "R"]], etiket: "klavye.kYanit", anahtarlar: "reply" },
  { id: "m-kopya", grup: "mesajlar", tuslar: [["y"], ["Ctrl", "Y"]], etiket: "klavye.vKopyala", anahtarlar: "yank copy pano clipboard" },
  { id: "m-duzenle", grup: "mesajlar", tuslar: [["e"], ["Ctrl", "E"]], etiket: "klavye.vDuzenle", anahtarlar: "edit" },
  { id: "m-sil", grup: "mesajlar", tuslar: [["d", "d"], ["Ctrl", "Shift", "D"]], etiket: "klavye.vSilOnay", anahtarlar: "delete remove onay dd" },
  { id: "m-tepki", grup: "mesajlar", tuslar: [["+"], ["Ctrl", "T"]], etiket: "klavye.kTepki", anahtarlar: "react emoji" },
  { id: "m-sabitle", grup: "mesajlar", tuslar: [["Ctrl", "S"]], etiket: "klavye.kSabitle", anahtarlar: "pin" },
  { id: "m-ilet", grup: "mesajlar", tuslar: [["Ctrl", "Shift", "F"]], etiket: "klavye.kIlet", anahtarlar: "forward" },
  { id: "m-profil", grup: "mesajlar", tuslar: [["Ctrl", "P"]], etiket: "klavye.kProfil", anahtarlar: "sender profile user" },
  { id: "m-menu", grup: "mesajlar", tuslar: [["Ctrl", "Enter"]], etiket: "klavye.kMenu", anahtarlar: "context actions" },

  // Sohbetler · Chats
  { id: "s-palet", grup: "sohbetler", herZaman: true, tuslar: [["Ctrl", "Space"]], etiket: "klavye.kPalet", anahtarlar: "palette quick switch oda" },
  { id: "s-liste", grup: "sohbetler", herZaman: true, tuslar: [["Ctrl", "B"]], etiket: "klavye.kListe", anahtarlar: "sidebar panel toggle" },
  { id: "s-sonraki", grup: "sohbetler", tuslar: [["g", "t"], ["L"], ["Ctrl", "Shift", "J"]], etiket: "klavye.kSonrakiOda", anahtarlar: "next chat tab gt" },
  { id: "s-onceki", grup: "sohbetler", tuslar: [["g", "T"], ["H"], ["Ctrl", "Shift", "K"]], etiket: "klavye.kOncekiOda", anahtarlar: "prev chat tab gT" },
  { id: "s-odak", grup: "sohbetler", tuslar: [["Ctrl", "H"]], etiket: "klavye.kListeye", anahtarlar: "list focus" },
  { id: "s-ac", grup: "sohbetler", tuslar: [["Enter"]], etiket: "klavye.kListeAc", anahtarlar: "open room" },

  // Komut satırı · Command line
  { id: "c-ac", grup: "komut", tuslar: [[":"]], etiket: "klavye.vKomutAc", anahtarlar: "command ex colon" },
  { id: "c-q", grup: "komut", tuslar: [[":q"]], etiket: "klavye.vKomutQ", anahtarlar: "close quit kapat" },
  { id: "c-ayar", grup: "komut", tuslar: [[":ayarlar"]], etiket: "klavye.vKomutAyarlar", anahtarlar: "settings preferences" },
  { id: "c-yeni", grup: "komut", tuslar: [[":yeni"]], etiket: "klavye.vKomutYeni", anahtarlar: "new chat sohbet" },
  { id: "c-ara", grup: "komut", tuslar: [[":ara metin"]], etiket: "klavye.vKomutAra", anahtarlar: "search query" },
  { id: "c-yardim", grup: "komut", tuslar: [[":yardim"]], etiket: "klavye.vKomutYardim", anahtarlar: "help" },

  // Genel · General
  { id: "g-yazma", grup: "genel", tuslar: [["g", "i"], ["i"], ["Ctrl", "L"]], etiket: "klavye.vYazma", anahtarlar: "insert composer focus gi" },
  { id: "g-esc", grup: "genel", tuslar: [["Esc"]], etiket: "klavye.vEsc", anahtarlar: "escape normal mode exit cancel" },
  { id: "g-yardim", grup: "genel", tuslar: [["?"], ["Ctrl", "/"]], etiket: "klavye.vYardim", anahtarlar: "help shortcuts" },
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

const DEGISKEN_TUSLAR = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph", "Dead"]);

/** Handles Normal-mode Vim keys (never called while focus is in any text field). · Normal kip Vim tuşlarını işler (odak herhangi bir metin alanındayken asla çağrılmaz). */
function normalTus(e: KeyboardEvent): boolean {
  if (DEGISKEN_TUSLAR.has(e.key)) return false;

  // Pending two-key sequences (g…, d…, z…) · Bekleyen iki tuşlu diziler (g…, d…, z…)
  if (klavye.bekleyen) {
    const lider = klavye.bekleyen;
    const sayacStr = klavye.sayac;
    const n = Math.max(1, parseInt(sayacStr, 10) || 1);
    klavye.bekleyenTemizle();

    if (lider === "g") {
      if (e.key === "g") {
        e.preventDefault();
        basaGit(sayacStr ? n : null);
        return true;
      }
      if (e.key === "t") {
        e.preventDefault();
        odaDegistir(n, false);
        return true;
      }
      if (e.key === "T") {
        e.preventDefault();
        odaDegistir(-n, false);
        return true;
      }
      if (e.key === "i") {
        e.preventDefault();
        void yazmayaGec();
        return true;
      }
      return true;
    }
    if (lider === "d") {
      if (e.key === "d") {
        e.preventDefault();
        mesajEylemi((o, oda) => {
          if (o.silinebilir) oda.sil(o);
        });
      }
      return true;
    }
    if (lider === "z") {
      if (e.key === "z") {
        e.preventDefault();
        satiriHizala("orta");
      } else if (e.key === "t") {
        e.preventDefault();
        satiriHizala("ust");
      } else if (e.key === "b") {
        e.preventDefault();
        satiriHizala("alt");
      }
      return true;
    }
  }

  // Count prefix digits (1-9 start, 0 continues) · Sayı öneki rakamları (1-9 başlatır, 0 sürdürür)
  if (/^[1-9]$/.test(e.key) || (e.key === "0" && klavye.sayac.length > 0)) {
    e.preventDefault();
    if (klavye.sayac.length < 3) klavye.sayac += e.key;
    return true;
  }

  // Leader starters · İki tuşlu önek başlatıcıları
  if (e.key === "g" || e.key === "d" || e.key === "z") {
    e.preventDefault();
    klavye.bekleyen = e.key;
    return true;
  }

  const sayacStr = klavye.sayac;
  const n = Math.max(1, parseInt(sayacStr, 10) || 1);

  switch (e.key) {
    case "j":
      e.preventDefault();
      klavye.bekleyenTemizle();
      if (listedeMi()) listeOynat(n);
      else imlecOynat(n);
      return true;
    case "k":
      e.preventDefault();
      klavye.bekleyenTemizle();
      if (listedeMi()) listeOynat(-n);
      else imlecOynat(-n);
      return true;
    case "G":
      e.preventDefault();
      klavye.bekleyenTemizle();
      sonaGit(sayacStr ? n : null);
      return true;
    case "H":
      e.preventDefault();
      klavye.bekleyenTemizle();
      odaDegistir(-n, false);
      return true;
    case "L":
      e.preventDefault();
      klavye.bekleyenTemizle();
      odaDegistir(n, false);
      return true;
    case "/":
      e.preventDefault();
      klavye.bekleyenTemizle();
      if (klavye.oda && !odaSayfasi()) klavye.oda.ara(undefined, true);
      return true;
    case "n":
      e.preventDefault();
      klavye.bekleyenTemizle();
      aramaAdimla(-1, n);
      return true;
    case "N":
      e.preventDefault();
      klavye.bekleyenTemizle();
      aramaAdimla(1, n);
      return true;
    case ":":
      e.preventDefault();
      klavye.komutAc();
      return true;
    case "?":
      e.preventDefault();
      klavye.bekleyenTemizle();
      klavye.yardim = true;
      return true;
    case "i":
      e.preventDefault();
      klavye.bekleyenTemizle();
      void yazmayaGec();
      return true;
    case "y":
      e.preventDefault();
      klavye.bekleyenTemizle();
      mesajEylemi((o, oda) => {
        if (o.metin) oda.kopyala(o);
      });
      return true;
    case "r":
      e.preventDefault();
      klavye.bekleyenTemizle();
      mesajEylemi((o, oda) => {
        if (!gercekOlay(o)) return;
        void yazmaEylemi(() => {
          klavye.secimBirak();
          oda.yanitla(o);
        });
      });
      return true;
    case "e":
      e.preventDefault();
      klavye.bekleyenTemizle();
      mesajEylemi((o, oda) => {
        if (!o.duzenlenebilir) return;
        void yazmaEylemi(() => {
          klavye.secimBirak();
          oda.duzenle(o);
        });
      });
      return true;
    case "+":
      e.preventDefault();
      klavye.bekleyenTemizle();
      mesajEylemi((o, oda) => {
        if (!gercekOlay(o)) return;
        const [x, y] = satirKonumu();
        oda.tepki(o, x, y);
      });
      return true;
    default:
      if (klavye.sayac) klavye.bekleyenTemizle();
      return false;
  }
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

  // 3. Command line owns its own typing; only Esc closes it here as a fallback. · Komut satırı kendi yazımını yönetir; burada yalnızca yedek Esc kapatır.
  if (klavye.komutAcik) {
    if (e.key === "Escape") {
      e.preventDefault();
      klavye.komutKapat();
    }
    return;
  }

  // 4. Never intercept while a dialog / menu is open (Esc and the dialog's own handlers stay in charge). · Pencere / menü açıkken asla yakalama (Esc ve pencerenin kendi işleyicileri yönetir).
  if (ustKatman()) return;

  // 5. Esc: leave composer into Normal mode → cancel pending count/leader → close in-room search → clear selection → fall through to gezinme.
  //    Esc: yazma alanından Normal kipe çık → bekleyen sayı/öneki iptal et → oda içi aramayı kapat → seçimi bırak → gezinme'ye devret.
  if (e.key === "Escape" && !e.ctrlKey && !e.shiftKey) {
    const aktif = document.activeElement;
    if (aktif instanceof HTMLElement && aktif.matches(".oda .yazma textarea") && !document.getElementById("bahis-listesi")) {
      e.preventDefault();
      aktif.blur();
      klavye.bekleyenTemizle();
      return;
    }
    if (klavye.bekleyen || klavye.sayac) {
      e.preventDefault();
      klavye.bekleyenTemizle();
      return;
    }
    if (klavye.oda?.aramaAcik() && !odaSayfasi()) {
      e.preventDefault();
      klavye.oda.aramaKapat();
      return;
    }
    if (klavye.seciliId && !odaSayfasi() && !duzen.cekmece && !acilirAcik() && !document.getElementById("bahis-listesi")) {
      e.preventDefault();
      klavye.secimBirak();
    }
    return;
  }

  // Keep @mention autocomplete in YazmaAlani in charge while it is open. · YazmaAlani'ndaki @bahsetme listesi açıkken önceliği onda tut.
  const bahisAcik = !!document.getElementById("bahis-listesi");

  // 6. List context (when list side has focus): Ctrl+J/K and Enter. · Liste bağlamı (liste tarafı odaktayken): Ctrl+J/K ve Enter.
  if (listedeMi()) {
    const k = komutBul(e, "liste");
    if (k) {
      if (k.id === "listeAc" && !(document.activeElement instanceof HTMLElement && odaSatirlari().includes(document.activeElement))) return;
      e.preventDefault();
      k.run();
      return;
    }
  }

  // 7. Non-Ctrl keys: NEVER eat characters while focus is in any text field; in Normal mode run Vim motions/actions.
  //    Ctrl'siz tuşlar: odak herhangi bir metin alanındayken ASLA karakter yeme; Normal kipte Vim hareket/eylemlerini çalıştır.
  if (!e.ctrlKey) {
    if (metinAlani(document.activeElement)) return;
    if (bahisAcik || acilirAcik()) return;
    normalTus(e);
    return;
  }

  // 8. Modeless Ctrl shortcuts (work both in Normal mode and while typing in the composer). · Kipsiz Ctrl kısayolları (hem Normal kipte hem yazarken çalışır).
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
  const durumBilesen = mount(KlavyeDurum, { target: document.body });

  let kare = 0;
  const durumuYenile = () => {
    kare = 0;
    const el = document.activeElement;
    klavye.odakAramada = !!el?.closest(".oda .cubuk");
    klavye.odakMetinde = metinAlani(el);
    klavye.katmanAcik = !!ustKatman() || acilirAcik() || !!document.getElementById("bahis-listesi");
    if ((klavye.odakMetinde && !klavye.komutAcik) || klavye.katmanAcik) klavye.bekleyenTemizle();
  };
  const planla = () => {
    if (!kare) kare = requestAnimationFrame(durumuYenile);
  };
  const odakDegisti = () => {
    const el = document.activeElement;
    klavye.odakAramada = !!el?.closest(".oda .cubuk");
    klavye.odakMetinde = metinAlani(el);
    if (klavye.odakMetinde && !klavye.komutAcik) klavye.bekleyenTemizle();
    planla();
  };
  const odakCikti = () => queueMicrotask(odakDegisti);
  const tiklama = () => {
    if (klavye.bekleyen || klavye.sayac) klavye.bekleyenTemizle();
    planla();
  };

  // Track overlay / popover changes so the mode pill hides behind menus and dialogs. · Kip hapı menü ve pencerelerin altında gizlensin diye katman değişimlerini izle.
  const katmanSecici = '[role="menu"], [role="dialog"], [role="alertdialog"], .acilir, #bahis-listesi';
  const ilgiliDugum = (d: Node) => d instanceof Element && (d.matches(katmanSecici) || d.querySelector(katmanSecici) !== null);
  const gozlemci = new MutationObserver((kayitlar) => {
    for (const k of kayitlar) {
      if (k.type === "attributes" && k.target instanceof Element && k.target.matches(katmanSecici)) return planla();
      if ([...k.addedNodes].some(ilgiliDugum) || [...k.removedNodes].some(ilgiliDugum)) return planla();
    }
  });
  gozlemci.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "inert", "role"] });

  window.addEventListener("keydown", tus);
  window.addEventListener("focusin", odakDegisti, true);
  window.addEventListener("focusout", odakCikti, true);
  window.addEventListener("pointerdown", tiklama, true);
  durumuYenile();

  const bitir = $effect.root(() => {
    $effect(() => {
      const id = gezinme.acikOdaId;
      // Untracked: reading the selection here would clear it the moment it is made. · İzlenmeden: seçimi burada okumak onu yapıldığı an silerdi.
      untrack(() => {
        klavye.secimBirak();
        klavye.bekleyenTemizle();
      });
      if (!id) return;
      klavye.ziyaret = [id, ...klavye.ziyaret.filter((x) => x !== id)].slice(0, 30);
      try {
        localStorage.setItem(ZIYARET, JSON.stringify(klavye.ziyaret));
      } catch {
        /* storage blocked: kept for this run · depolama engelli: bu çalışma için tutulur */
      }
    });
    $effect(() => {
      if (!tercihler.d.ctrlKisayol) {
        klavye.secimBirak();
        klavye.bekleyenTemizle();
        klavye.komutKapat();
      }
    });
  });
  return () => {
    cancelAnimationFrame(kare);
    gozlemci.disconnect();
    window.removeEventListener("keydown", tus);
    window.removeEventListener("focusin", odakDegisti, true);
    window.removeEventListener("focusout", odakCikti, true);
    window.removeEventListener("pointerdown", tiklama, true);
    bitir();
    void unmount(durumBilesen);
  };
}
