// App entry: apply the saved appearance FIRST (attributes on <html>, so the first paint is already right),
// then global styles, then mount the root Svelte component. No inline script: CSP blocks it, so this module does the job.
// Uygulama girişi: ÖNCE kayıtlı görünümü uygula (<html> öznitelikleri; ilk çizim baştan doğru olsun), sonra genel stiller,
// sonra kök Svelte bileşeni. Satır içi betik yok: CSP engeller, işi bu modül yapar.
import { ayarlar } from "./lib/durum/ayarlar.svelte";
ayarlar.uygula();

import "./styles/fontlar.css";
import "./styles/tokens.css";
import "./styles/temel.css";
import "./styles/kristal.css";
import { dil, dilSecimi } from "./lib/i18n";
import { dilAyarla } from "./lib/api/komutlar";
import { mount } from "svelte";
import App from "./App.svelte";

const hedef = document.getElementById("uygulama");
if (!hedef) throw new Error("#uygulama bulunamadı");

// Native texts (previews, notifications) follow the app language. · Yerel metinler (önizleme, bildirim) uygulama dilini izler.
const yerelKopru = (window as unknown as { RubyBaglanti?: { dil?: (d: string) => void } }).RubyBaglanti;
try {
  yerelKopru?.dil?.(dilSecimi() === "sistem" ? "" : dil);
} catch {
  /* not on Android · Android değil */
}
void dilAyarla(dil === "en").catch(() => {});

export default mount(App, { target: hedef });
