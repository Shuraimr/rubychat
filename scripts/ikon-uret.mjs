// Vendors ONLY the icons the app uses from four open-source packs (no npm packages) into src/lib/ikonlar/<paket>.ts.
// Run: node scripts/ikon-uret.mjs   (needs internet; the generated files are committed, so normal builds never need it)
// Uygulamanın kullandığı simgeleri dört açık kaynak paketten (npm paketi YOK) src/lib/ikonlar/<paket>.ts içine alır.
// Çalıştır: node scripts/ikon-uret.mjs   (internet ister; üretilen dosyalar commit'lenir, normal derleme buna ihtiyaç duymaz)
import { writeFileSync } from "node:fs";

// our name → [material, lucide, phosphor, tabler]
const M = {
  ara: ["search", "search", "magnifying-glass", "search"],
  kilit: ["lock", "lock", "lock", "lock"],
  kisi: ["person", "user", "user", "user"],
  kalkan: ["shield", "shield", "shield", "shield"],
  kalem: ["edit", "pencil", "pencil-simple", "pencil"],
  sohbet: ["chat_bubble", "message-square", "chat-circle", "message"],
  izgara: ["grid_view", "layout-grid", "squares-four", "layout-grid"],
  cikis: ["logout", "log-out", "sign-out", "logout"],
  onay: ["check", "check", "check", "check"],
  yukari: ["arrow_upward", "arrow-up", "arrow-up", "arrow-up"],
  kapat: ["close", "x", "x", "x"],
  geri: ["chevron_left", "chevron-left", "caret-left", "chevron-left"],
  artik: ["add", "plus", "plus", "plus"],
  ucNokta: ["more_vert", "ellipsis-vertical", "dots-three-vertical", "dots-vertical"],
  uyari: ["error", "circle-alert", "warning-circle", "alert-circle"],
  bilgi: ["info", "info", "info", "info-circle"],
  telefon: ["call", "phone", "phone", "phone"],
  telefonKapat: ["call_end", "phone-off", "phone-disconnect", "phone-off"],
  mikrofon: ["mic", "mic", "microphone", "microphone"],
  mikrofonKapali: ["mic_off", "mic-off", "microphone-slash", "microphone-off"],
  hoparlor: ["volume_up", "volume-2", "speaker-high", "volume"],
  saat: ["schedule", "clock", "clock", "clock"],
  asagi: ["arrow_downward", "arrow-down", "arrow-down", "arrow-down"],
  sagOk: ["chevron_right", "chevron-right", "caret-right", "chevron-right"],
  asagiOk: ["expand_more", "chevron-down", "caret-down", "chevron-down"],
  kopya: ["content_copy", "copy", "copy", "copy"],
  galeri: ["image", "image", "image", "photo"],
  kamera: ["photo_camera", "camera", "camera", "camera"],
  dosya: ["description", "file", "file", "file"],
  bulutYok: ["cloud_off", "cloud-off", "cloud-slash", "cloud-off"],
  zil: ["notifications", "bell", "bell", "bell"],
  palet: ["palette", "palette", "palette", "palette"],
  gunes: ["light_mode", "sun", "sun", "sun"],
  emoji: ["mood", "smile", "smiley", "mood-smile"],
  anahtar: ["key", "key-round", "key", "key"],
  kalkanOnay: ["verified_user", "shield-check", "shield-check", "shield-check"],
  yenile: ["refresh", "refresh-cw", "arrows-clockwise", "refresh"],
  tikCift: ["done_all", "check-check", "checks", "checks"],
  yazi: ["text_fields", "type", "text-aa", "typography"],
  yanitla: ["reply", "reply", "arrow-bend-up-left", "arrow-back-up"],
  ilet: ["forward", "forward", "arrow-bend-up-right", "arrow-forward-up"],
  sabitle: ["push_pin", "pin", "push-pin", "pin"],
  cop: ["delete", "trash-2", "trash", "trash"],
  gif: ["gif_box", "image-play", "gif", "gif"],
  makas: ["content_cut", "scissors", "scissors", "scissors"],
  cihaz: ["smartphone", "smartphone", "device-mobile", "device-mobile"],
  bulut: ["cloud_upload", "cloud-upload", "cloud-arrow-up", "cloud-upload"],
  yildiz: ["star", "star", "star", "star"],
  anket: ["bar_chart", "chart-column", "chart-bar", "chart-bar"],
};
const GH = "https://raw.githubusercontent.com/";
const url = {
  material: (n, dolu) => `${GH}google/material-design-icons/master/symbols/web/${n}/materialsymbolsrounded/${n}${dolu ? "_fill1" : ""}_24px.svg`,
  lucide: (n) => `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${n}.svg`,
  phosphor: (n) => `${GH}phosphor-icons/core/main/assets/regular/${n}.svg`,
  tabler: (n) => `${GH}tabler/tabler-icons/main/icons/outline/${n}.svg`,
};
async function al(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.text();
}
const ic = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<path[^>]*d="M0 0h24v24H0z"[^>]*\/>/, "").replace(/\s+/g, " ").trim();
const paketler = ["material", "lucide", "phosphor", "tabler"];
const meta = {
  material: { viewBox: "0 -960 960 960", mod: "dolgu", lisans: "Material Symbols (Rounded, weight 400, fill 0 / 1, opsz 24) — Apache-2.0, Google" },
  lucide: { viewBox: "0 0 24 24", mod: "cizgi", lisans: "Lucide — ISC, Lucide Contributors" },
  phosphor: { viewBox: "0 0 256 256", mod: "dolgu", lisans: "Phosphor Icons (regular) — MIT, Phosphor Icons" },
  tabler: { viewBox: "0 0 24 24", mod: "cizgi", lisans: "Tabler Icons (outline) — MIT, Paweł Kuna" },
};
let hatalar = 0;
for (const [i, p] of paketler.entries()) {
  const sonuc = {};
  const dolu = {};
  await Promise.all(
    Object.entries(M).map(async ([ad, adlar]) => {
      try {
        sonuc[ad] = ic(await al(url[p](adlar[i], false)));
        if (p === "material") {
          try { dolu[ad] = ic(await al(url[p](adlar[i], true))); } catch { /* no filled variant: the outlined one is reused · dolu varyant yok: çizgili olan kullanılır */ }
        }
      } catch (e) {
        hatalar++;
        console.error("EKSIK", p, ad, String(e));
      }
    }),
  );
  const sirali = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const kod = `// GENERATED by scripts/ikon-uret.mjs: only the icons the app uses. ${meta[p].lisans}. License text: public/lisanslar/${p}.txt
// scripts/ikon-uret.mjs ile ÜRETİLDİ: yalnızca uygulamanın kullandığı simgeler. Lisans metni: public/lisanslar/${p}.txt
import type { SimgePaketi } from "./tip";

export const ${p}: SimgePaketi = {
  viewBox: ${JSON.stringify(meta[p].viewBox)},
  mod: ${JSON.stringify(meta[p].mod)},
  simgeler: ${JSON.stringify(sirali(sonuc), null, 1)},
  dolu: ${JSON.stringify(sirali(dolu), null, 1)},
};
`;
  writeFileSync(new URL(`../src/lib/ikonlar/${p}.ts`, import.meta.url), kod);
  console.log(p, Object.keys(sonuc).length, "icons");
}
const lic = {
  material: `${GH}google/material-design-icons/master/LICENSE`,
  lucide: `${GH}lucide-icons/lucide/main/LICENSE`,
  phosphor: `${GH}phosphor-icons/core/main/LICENSE`,
  tabler: `${GH}tabler/tabler-icons/main/LICENSE`,
};
for (const [p, u] of Object.entries(lic)) writeFileSync(new URL(`../public/lisanslar/${p}.txt`, import.meta.url), await al(u));
console.log("hatalar:", hatalar);
