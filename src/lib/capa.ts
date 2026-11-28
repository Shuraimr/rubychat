// Anchor tracker and popover positioning for desktop sheets and palettes.
// Records the last clicked/keyboard-activated trigger button so modals open beside it on wide screens.
// Masaüstü sayfaları ve paletler için çapa izleyici ve açılır kart konumlandırma.
// Son tıklanan veya klavyeyle etkinleştirilen tetikleyici düğmeyi tutar; pencereler geniş ekranda onun yanında açılır.

import { egri, sureMs } from "./hareket";

const CAPA_SECICI = "button, a, [role=button], [role=menuitem], [data-capa]";
const KENAR_PAY = 8;
const YAN_ESIK = 140;
const ALT_YETERLI = 320;
const EN_AZ_YUKSEKLIK = 120;

interface CapaKaydi {
  oge: Element | null;
  x: number;
  y: number;
  zaman: number;
  yanda: boolean;
}

export interface CapaAyrinti {
  /** Snapshot rect at capture time · Yakalama anındaki dikdörtgen */
  dikdortgen: DOMRect;
  /** Trigger element while still in the DOM · Hâlâ DOM'daysa tetikleyici öğe */
  oge: Element | null;
  /** Whether the anchor belongs to the left rail or compact strip · Çapa sol rayda veya kompakt şeritte mi */
  yanda: boolean;
}

export interface AcilirKonum {
  sol: number;
  ust?: number;
  alt?: number;
  maxYukseklik: number;
  kok: string;
}

let kayit: CapaKaydi | null = null;

/** Never anchor popovers to text inputs or editable fields · Açılır kartları asla yazı alanlarına çapalama */
function yaziAlaniMi(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const yakin = el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox'], [role='searchbox'], [role='combobox']");
  if (!yakin) return false;
  if (yakin instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "checkbox", "radio", "file"].includes(yakin.type);
  }
  return true;
}

function yandaMi(oge: Element | null, r: DOMRect): boolean {
  return r.right < YAN_ESIK || !!oge?.closest("nav.ray, nav.serit");
}

function isaretciBas(e: PointerEvent) {
  const hedef = e.target instanceof Element ? e.target : e.target instanceof Node ? e.target.parentElement : null;
  if (!hedef || yaziAlaniMi(hedef)) {
    kayit = null;
    return;
  }
  const oge = hedef.closest(CAPA_SECICI);
  if (!oge || yaziAlaniMi(oge)) {
    kayit = null;
    return;
  }
  const r = oge.getBoundingClientRect();
  kayit = {
    oge,
    x: e.clientX,
    y: e.clientY,
    zaman: Date.now(),
    yanda: yandaMi(oge, r),
  };
}

function tusBas(e: KeyboardEvent) {
  if (e.key === "Control" || e.key === "Shift" || e.key === "Alt" || e.key === "Meta") return;
  if ((e.key === "Enter" || e.key === " ") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const etkin = document.activeElement;
    if (etkin instanceof Element && !yaziAlaniMi(etkin)) {
      const dugme = etkin.closest(CAPA_SECICI);
      if (dugme && !yaziAlaniMi(dugme)) {
        const r = dugme.getBoundingClientRect();
        kayit = {
          oge: dugme,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          zaman: Date.now(),
          yanda: yandaMi(dugme, r),
        };
        return;
      }
    }
  }
  // Keyboard shortcuts (Ctrl+Space, ?, etc.) are not button activations, so clear any stale pointer anchor.
  // Klavye kısayolları (Ctrl+Space, ? vb.) düğme etkinleştirmesi değildir; eski işaretçi çapasını temizle.
  kayit = null;
}

/**
 * Returns the detailed anchor record within `enFazlaMs`, or null if expired.
 * `enFazlaMs` süresi içindeki ayrıntılı çapa kaydını döndürür; süre geçtiyse null döner.
 */
export function sonCapaAyrinti(enFazlaMs = 1000): CapaAyrinti | null {
  if (!kayit || Date.now() - kayit.zaman > enFazlaMs) return null;
  if (kayit.oge && kayit.oge.isConnected) {
    const r = kayit.oge.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { dikdortgen: r, oge: kayit.oge, yanda: yandaMi(kayit.oge, r) };
    }
  }
  const r = new DOMRect(kayit.x, kayit.y, 0, 0);
  return { dikdortgen: r, oge: null, yanda: kayit.yanda || r.right < YAN_ESIK };
}

/**
 * Returns the rect of the last activated trigger within `enFazlaMs`, or a 0×0 rect at the pointer point if it unmounted.
 * `enFazlaMs` içinde etkinleşen son tetikleyicinin dikdörtgenini, DOM'dan çıktıysa işaretçi noktasında 0×0 dikdörtgen döndürür.
 */
export function sonCapa(enFazlaMs = 1000): DOMRect | null {
  return sonCapaAyrinti(enFazlaMs)?.dikdortgen ?? null;
}

/**
 * Computes fixed coordinates, max-height and transform-origin for an anchored popover card.
 * Çapaya tutunan açılır kart için sabit koordinatları, en büyük yüksekliği ve transform-origin değerini hesaplar.
 */
export function capaKonumla(
  ayrinti: CapaAyrinti,
  hedefGenislik: number,
  vw = window.innerWidth,
  vh = window.innerHeight,
): AcilirKonum {
  // Re-measure the trigger element when still mounted so window resizes keep alignment accurate.
  // Pencere boyutu değiştiğinde hizalamayı korumak için öğe hâlâ DOM'daysa yeniden ölç.
  let r = ayrinti.dikdortgen;
  if (ayrinti.oge && ayrinti.oge.isConnected) {
    const taze = ayrinti.oge.getBoundingClientRect();
    if (taze.width > 0 && taze.height > 0) r = taze;
  }

  const w = Math.min(hedefGenislik, Math.max(0, vw - KENAR_PAY * 2));
  const yanda = ayrinti.yanda || r.right < YAN_ESIK || (!!ayrinti.oge?.isConnected && !!ayrinti.oge.closest("nav.ray, nav.serit"));

  if (yanda) {
    const sol = Math.max(KENAR_PAY, Math.min(r.right + KENAR_PAY, vw - w - KENAR_PAY));
    const ustYari = (r.top + r.bottom) / 2 <= vh / 2;
    if (ustYari) {
      const ust = Math.max(KENAR_PAY, Math.min(r.top, vh - KENAR_PAY - EN_AZ_YUKSEKLIK));
      const maxYukseklik = Math.max(EN_AZ_YUKSEKLIK, vh - ust - KENAR_PAY);
      return { sol, ust, maxYukseklik, kok: "left top" };
    }
    const alt = Math.max(KENAR_PAY, Math.min(vh - r.bottom, vh - KENAR_PAY - EN_AZ_YUKSEKLIK));
    const maxYukseklik = Math.max(EN_AZ_YUKSEKLIK, vh - alt - KENAR_PAY);
    return { sol, alt, maxYukseklik, kok: "left bottom" };
  }

  const altKalan = vh - r.bottom - KENAR_PAY * 2;
  const ustKalan = r.top - KENAR_PAY * 2;
  const asagi = altKalan >= ALT_YETERLI || altKalan >= ustKalan;

  const sol =
    r.left + w <= vw - KENAR_PAY
      ? Math.max(KENAR_PAY, r.left)
      : Math.max(KENAR_PAY, Math.min(r.right - w, vw - w - KENAR_PAY));

  const ox = Math.round(Math.max(0, Math.min(w, (r.left + r.right) / 2 - sol)));

  if (asagi) {
    const ust = Math.max(KENAR_PAY, Math.min(r.bottom + KENAR_PAY, vh - KENAR_PAY - EN_AZ_YUKSEKLIK));
    const maxYukseklik = Math.max(EN_AZ_YUKSEKLIK, vh - ust - KENAR_PAY);
    return { sol, ust, maxYukseklik, kok: `${ox}px top` };
  }

  const alt = Math.max(KENAR_PAY, Math.min(vh - r.top + KENAR_PAY, vh - KENAR_PAY - EN_AZ_YUKSEKLIK));
  const maxYukseklik = Math.max(EN_AZ_YUKSEKLIK, vh - alt - KENAR_PAY);
  return { sol, alt, maxYukseklik, kok: `${ox}px bottom` };
}

/**
 * Anchored popover enter transition: opacity + scale(0.96) from transform-origin, no spring/overshoot.
 * Çapalı açılır kart giriş geçişi: transform-origin'den opacity + scale(0.96), yay veya taşma yok.
 */
export function acilirGir(node: Element) {
  const sure = sureMs("--sure-orta");
  if (sure > 0) {
    const el = node as HTMLElement;
    el.style.willChange = "transform, opacity";
    const temizle = () => {
      if (el.style.willChange === "transform, opacity") el.style.removeProperty("will-change");
    };
    const a = node.animate(
      [
        { opacity: 0, transform: "scale(.96)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: sure, easing: egri("--egri-ac"), fill: "backwards" },
    );
    a.onfinish = temizle;
    a.oncancel = temizle;
  }
  return { duration: sure };
}

/**
 * Anchored popover exit transition: faster close with --sure-hizli.
 * Çapalı açılır kart çıkış geçişi: --sure-hizli ile daha hızlı kapanış.
 */
export function acilirCik(node: Element) {
  const sure = sureMs("--sure-hizli");
  if (sure > 0) {
    const el = node as HTMLElement;
    el.style.willChange = "transform, opacity";
    const temizle = () => {
      if (el.style.willChange === "transform, opacity") el.style.removeProperty("will-change");
    };
    const a = node.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(.96)" },
      ],
      { duration: sure, easing: egri("--egri-giris"), fill: "forwards" },
    );
    a.onfinish = temizle;
    a.oncancel = temizle;
  }
  return { duration: sure };
}

/**
 * Starts document-level capture listeners for pointer and keyboard triggers; returns the cleanup callback.
 * İşaretçi ve klavye tetikleyicileri için belge düzeyinde yakalama dinleyicilerini başlatır; kaldırma işlevini döndürür.
 */
export function capaBaslat(): () => void {
  document.addEventListener("pointerdown", isaretciBas, true);
  document.addEventListener("keydown", tusBas, true);
  return () => {
    document.removeEventListener("pointerdown", isaretciBas, true);
    document.removeEventListener("keydown", tusBas, true);
  };
}
