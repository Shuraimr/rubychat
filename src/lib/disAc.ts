import { invoke } from "@tauri-apps/api/core";

// Open a URL OUTSIDE the app (system browser) via tauri-plugin-opener's command, so no extra npm package is needed.
// window.open does nothing inside the Android WebView, so it is used only in a plain browser (development); in the app a failure is thrown
// so the caller can say it. All callers go through this one function.
// Bir adresi uygulamanın DIŞINDA (sistem tarayıcısı) tauri-plugin-opener komutuyla aç; böylece ek npm paketi gerekmez.
// window.open Android WebView'da hiçbir şey yapmaz; yalnızca düz tarayıcıda (geliştirme) kullanılır. Uygulamada hata fırlatılır, çağıran
// söyler. Bütün çağıranlar bu tek işlevden geçer.
export async function disariAc(url: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) await invoke("plugin:opener|open_url", { url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
