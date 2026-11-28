// Desktop mouse navigation and native context-menu suppression:
//  - Blocks WebKitGTK's default browser menu ("Back, Forward, Stop, Reload") on empty areas, while keeping it in text fields
//    and when text is selected (for copy/paste), and leaving the app's own menus untouched (bubble phase, after component handlers).
//  - Maps mouse back/forward buttons (button 3 / 4) and desktop Alt+ArrowLeft / Alt+ArrowRight to in-app navigation history.
// Masaüstü fare gezinmesi ve yerleşik bağlam menüsünü kapatma:
//  - Boş alanlarda WebKitGTK'nın kendi tarayıcı menüsünü ("Geri, İleri, Durdur, Tekrar Yükle") engeller; yazı alanlarında ve
//    metin seçiliyken (kopyala/yapıştır için) korur, uygulamanın kendi menülerine dokunmaz (kabarcık aşaması, bileşen işleyicilerinden sonra).
//  - Farenin geri/ileri tuşlarını (button 3 / 4) ve masaüstünde Alt+Sol / Alt+Sağ ok tuşlarını uygulama içi gezinme geçmişine bağlar.
import { gezinme } from "./durum/gezinme.svelte";

const METIN_DISI_GIRIS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** True when the target is an editable text input, textarea or contenteditable region. · Hedef düzenlenebilir bir metin girişi, textarea veya contenteditable alanıysa doğru döner. */
function yaziAlaniMi(hedef: EventTarget | null): boolean {
  const el = hedef instanceof Element ? hedef : hedef instanceof Node ? hedef.parentElement : null;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !METIN_DISI_GIRIS.has(el.type);
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

/** True when the page currently has a non-empty text selection. · Sayfada boş olmayan bir metin seçimi varsa doğru döner. */
function seciliMetinVarMi(): boolean {
  const secim = window.getSelection();
  return !!secim && !secim.isCollapsed && secim.toString().length > 0;
}

/** Matches desktop pointer devices (same query App.svelte uses for desktop-only shortcuts). · Masaüstü işaretçi aygıtlarıyla eşleşir (App.svelte'in masaüstü kısayolları için kullandığı sorgu). */
function masaustuMu(): boolean {
  return window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
}

/**
 * Install global contextmenu suppression and mouse / Alt+Arrow back-forward handlers. Returns the cleanup function.
 * Genel bağlam menüsü bastırmasını ve fare / Alt+Ok geri-ileri işleyicilerini kurar. Temizleme fonksiyonunu döndürür.
 */
export function fareGezinmeBaslat(): () => void {
  // Bubble phase so app-level contextmenu handlers (uzunBasma, hizliGecis) run first and set defaultPrevented.
  // Kabarcık aşamasında dinlenir; böylece uygulamanın kendi sağ tık işleyicileri (uzunBasma, hizliGecis) önce çalışır ve defaultPrevented ayarlar.
  const sagTik = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (yaziAlaniMi(e.target) || seciliMetinVarMi()) return;
    e.preventDefault();
  };

  // Track recent mouseup for buttons 3/4 so a following auxclick on the same press does not navigate twice.
  // 3/4 tuşları için son mouseup'ı izle; aynı basışın ardından gelen auxclick iki kez gezinme yapmasın.
  let sonYukariTus = -1;
  let sonYukariZaman = 0;

  const fareAsagi = (e: MouseEvent) => {
    if (e.button === 3 || e.button === 4) e.preventDefault();
  };

  const fareYukari = (e: MouseEvent) => {
    if (e.defaultPrevented || (e.button !== 3 && e.button !== 4)) return;
    e.preventDefault();
    sonYukariTus = e.button;
    sonYukariZaman = performance.now();
    if (e.button === 3) gezinme.geriGit();
    else gezinme.ileriGit();
  };

  const ekTik = (e: MouseEvent) => {
    if (e.defaultPrevented || (e.button !== 3 && e.button !== 4)) return;
    e.preventDefault();
    if (sonYukariTus === e.button && performance.now() - sonYukariZaman < 250) {
      sonYukariTus = -1;
      return;
    }
    if (e.button === 3) gezinme.geriGit();
    else gezinme.ileriGit();
  };

  const tus = (e: KeyboardEvent) => {
    if (e.defaultPrevented || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!masaustuMu()) return;
    if (yaziAlaniMi(e.target) || yaziAlaniMi(document.activeElement)) return;
    e.preventDefault();
    if (e.key === "ArrowLeft") gezinme.geriGit();
    else gezinme.ileriGit();
  };

  window.addEventListener("contextmenu", sagTik);
  window.addEventListener("mousedown", fareAsagi);
  window.addEventListener("mouseup", fareYukari);
  window.addEventListener("auxclick", ekTik);
  window.addEventListener("keydown", tus);

  return () => {
    window.removeEventListener("contextmenu", sagTik);
    window.removeEventListener("mousedown", fareAsagi);
    window.removeEventListener("mouseup", fareYukari);
    window.removeEventListener("auxclick", ekTik);
    window.removeEventListener("keydown", tus);
  };
}
