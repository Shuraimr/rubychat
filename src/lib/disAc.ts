import { invoke } from "@tauri-apps/api/core";
import { baglantiTercihi, siteOf, type AcmaYolu } from "./durum/baglantiTercihi.svelte";

// Opening a web address. On Android the native bridge (RubyBaglanti, MainActivity.kt) does it: a browser tab inside the app (Custom Tab, the
// phone's own browser with its logins), the browser app itself, or one chosen app. Elsewhere tauri-plugin-opener. window.open does nothing
// inside the Android WebView, so it is used only in a plain browser (development). A failure is thrown so the caller can say it.
// Web adresi açma. Android'de yerel köprü (RubyBaglanti, MainActivity.kt) yapar: uygulamanın içinde tarayıcı sekmesi (Custom Tab; telefonun
// kendi tarayıcısı, oturumlarıyla), tarayıcının kendisi ya da seçilen bir uygulama. Başka yerde tauri-plugin-opener. window.open Android
// WebView'da hiçbir şey yapmaz; yalnızca düz tarayıcıda (geliştirme) kullanılır. Hata fırlatılır, çağıran söyler.
interface Kopru {
  ac(url: string, yol: string, renk: string): boolean;
  uygulamalar(url: string): string;
  paylas(url: string): void;
}
const kopru = () => (window as unknown as { RubyBaglanti?: Kopru }).RubyBaglanti;

export interface AcanUygulama {
  paket: string;
  ad: string;
  tarayici: boolean;
}
/** Installed apps that can open this address (Android only) · Bu adresi açabilen yüklü uygulamalar (yalnızca Android) */
export function acanUygulamalar(url: string): AcanUygulama[] {
  try {
    return JSON.parse(kopru()?.uygulamalar(url) ?? "[]") as AcanUygulama[];
  } catch {
    return [];
  }
}
export const sekmeVar = () => !!kopru();
export const paylasVar = () => !!kopru();
export const paylas = (url: string) => kopru()?.paylas(url);

/** Opens with the given way, else with the rule of the site, else with the general choice · Verilen yolla, yoksa sitenin kuralıyla, yoksa genel seçimle açar */
export async function disariAc(url: string, yol?: AcmaYolu): Promise<void> {
  const k = kopru();
  if (k && /^https?:/i.test(url)) {
    const istenen = yol ?? baglantiTercihi.siteler[siteOf(url)]?.yol ?? (baglantiTercihi.genel === "sor" ? "sekme" : baglantiTercihi.genel);
    const renk = getComputedStyle(document.documentElement).getPropertyValue("--yuzey-1").trim();
    // A chosen app can be uninstalled later: fall back to the tab. · Seçilen uygulama sonradan kaldırılmış olabilir: sekmeye düş.
    if (k.ac(url, istenen, renk) || k.ac(url, "sekme", renk)) return;
  }
  if ("__TAURI_INTERNALS__" in window) await invoke("plugin:opener|open_url", { url });
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Reveals a downloaded file in its folder (desktop, via tauri-plugin-opener). · İndirilen dosyayı klasöründe gösterir (masaüstü, tauri-plugin-opener ile). */
export async function klasorAc(yol: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    await invoke("plugin:opener|reveal_item_in_dir", { paths: [yol] });
  } catch {
    // Fallback: open the parent directory when reveal_item_in_dir is not supported. · Yedek: reveal_item_in_dir desteklenmiyorsa üst klasörü aç.
    const ust = yol.replace(/[/\\][^/\\]+$/, "") || yol;
    await invoke("plugin:opener|open_path", { path: ust });
  }
}
