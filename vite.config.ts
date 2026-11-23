import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Copies the Element Call embedded build (npm: @element-hq/element-call-embedded, AGPL-3.0-only OR Element commercial; we use AGPL) into
 * public/element-call/ so it ships inside the app and is served from our own scheme (src-tauri/src/matrix/ec.rs). Runs in `config()`,
 * i.e. before Vite reads `public/`. If the package is not installed it only warns: the app still builds and falls back to the hosted EC.
 * Element Call gömülü derlemesini (npm: @element-hq/element-call-embedded, AGPL-3.0-only VEYA Element ticari; biz AGPL'yi kullanırız)
 * public/element-call/ içine kopyalar; uygulamayla birlikte gider ve kendi şemamızdan sunulur (src-tauri/src/matrix/ec.rs).
 * `config()` içinde, yani Vite `public/`i okumadan önce çalışır. Paket kurulu değilse yalnızca uyarır: uygulama yine derlenir, barındırılan EC'ye düşer.
 */
function elementCallKopyala() {
  return {
    name: "element-call-kopyala",
    config() {
      const paket = resolve("node_modules/@element-hq/element-call-embedded");
      const hedef = resolve("public/element-call");
      // The package layout is not verified here: prefer a dist/ folder, otherwise the package root.
      // Paket düzeni burada doğrulanmadı: önce dist/ klasörü, yoksa paket kökü.
      const kaynak = existsSync(resolve(paket, "dist/index.html")) ? resolve(paket, "dist") : existsSync(resolve(paket, "index.html")) ? paket : null;
      if (!kaynak) {
        console.warn("[element-call] @element-hq/element-call-embedded bulunamadı (npm install çalıştır); barındırılan EC yedeği kullanılacak.");
        return;
      }
      rmSync(hedef, { recursive: true, force: true });
      // Copy everything (the source path itself contains "node_modules", so no path filter) plus the AGPL text. · Hepsini kopyala (kaynak yolunun kendisi "node_modules" içerir, yol süzgeci yok) ve AGPL metnini ekle.
      cpSync(kaynak, hedef, { recursive: true });
      const lisans = resolve(paket, "LICENSE-AGPL-3.0");
      if (existsSync(lisans)) cpSync(lisans, resolve(hedef, "LICENSE-AGPL-3.0.txt"));
    },
  };
}

// Tauri expects a fixed dev port and the dev host on mobile.
// Tauri sabit bir geliştirme portu ister; telefonda geliştirme sunucusuna ağ adresiyle bağlanır.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte(), elementCallKopyala()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { target: "es2022", sourcemap: false },
});
