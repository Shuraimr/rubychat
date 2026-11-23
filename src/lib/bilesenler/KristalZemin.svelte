<!--
  Background layer of a screen: optional custom photo (blurred + dimmed, from this device only), the hexagon-ruby wallpaper pattern and one
  crystal effect ("Altıgen ızgara" / "Yakut kristalleri" / "Işık kırılması" / "Kapalı"). It is absolutely positioned and click-through, so the
  content simply sits above it (position: relative; z-index: 1). Only transform / opacity animate (GPU), the CSS pauses everything while
  the app is hidden and freezes it under reduced motion. See styles/kristal.css.
  Bir ekranın arka plan katmanı: isteğe bağlı özel fotoğraf (bulanık + karartılmış, yalnızca bu cihazdan), altıgen-yakut duvar kâğıdı deseni
  ve bir kristal efekt ("Altıgen ızgara" / "Yakut kristalleri" / "Işık kırılması" / "Kapalı"). Mutlak konumlu ve tıklamayı geçirir; içerik
  üstünde durur (position: relative; z-index: 1). Yalnızca transform / opacity hareket eder (GPU); CSS uygulama gizliyken her şeyi durdurur,
  azaltılmış harekette dondurur. Bkz. styles/kristal.css.
-->
<script lang="ts">
  import { zeminUrl } from "../durum/zeminResmi";
  import type { ZeminEfekti } from "../durum/sohbetGorunum.svelte";

  let { efekt = "kapali", duvar = false, resim = false, resimAnahtari = "genel", bulanik = 0, karart = 0 }: {
    efekt?: ZeminEfekti;
    duvar?: boolean;
    resim?: boolean;
    /** IndexedDB key of the photo: "genel" or a room id · Fotoğrafın IndexedDB anahtarı: "genel" ya da oda kimliği */
    resimAnahtari?: string;
    bulanik?: number;
    karart?: number;
  } = $props();

  let url = $state<string | null>(null);
  $effect(() => {
    const anahtar = resimAnahtari;
    if (!resim) {
      url = null;
      return;
    }
    let iptal = false;
    // A room can have its own photo; if it has none the global one is used. · Odanın kendi fotoğrafı olabilir; yoksa genel olan kullanılır.
    zeminUrl(anahtar).then((u) => (iptal ? undefined : u ? (url = u) : zeminUrl("genel").then((g) => !iptal && (url = g))));
    return () => (iptal = true);
  });

  // The drift is ~1 px per second, yet a running CSS animation makes the GPU draw 120 frames every second, also while nothing happens.
  // So the animations are paused and stepped by hand 10 times a second, and not at all while a finger is down or the screen is covered.
  // Süzülme saniyede ~1 px; ama çalışan CSS animasyonu hiçbir şey olmazken bile GPU'ya saniyede 120 kare çizdirir. Bu yüzden animasyonlar
  // durdurulur ve saniyede 10 kez elle ilerletilir; parmak ekrandayken ya da ekran örtülüyken hiç ilerlemez.
  function yavasSur(node: HTMLElement) {
    let kareler: Animation[] = [];
    const kur = requestAnimationFrame(() => {
      kareler = node.getAnimations({ subtree: true });
      for (const k of kareler) k.pause();
    });
    let parmak = 0;
    const bas = () => (parmak = Infinity);
    // A fling goes on after the finger leaves: wait a second. · Parmak kalkınca savrulma sürer: bir saniye bekle.
    const kalk = () => (parmak = performance.now() + 1000);
    window.addEventListener("touchstart", bas, { passive: true });
    window.addEventListener("touchend", kalk, { passive: true });
    window.addEventListener("touchcancel", kalk, { passive: true });
    const z = setInterval(() => {
      if (document.hidden || performance.now() < parmak || kareler.length === 0 || node.closest("[inert]")) return;
      for (const k of kareler) k.currentTime = Number(k.currentTime ?? 0) + 100;
    }, 100);
    return {
      destroy() {
        cancelAnimationFrame(kur);
        clearInterval(z);
        window.removeEventListener("touchstart", bas);
        window.removeEventListener("touchend", kalk);
        window.removeEventListener("touchcancel", kalk);
      },
    };
  }
</script>

{#if url}
  <!-- Blur needs a little overscan so the blurred edge does not show; the dim layer keeps the messages readable · Bulanıklık için biraz taşma gerekir; karartma mesajları okunur tutar -->
  <div class="kz foto" aria-hidden="true">
    <img src={url} alt="" style:filter={bulanik > 0 ? `blur(${bulanik}px)` : undefined} style:transform={bulanik > 0 ? "scale(1.08)" : undefined} draggable="false" />
    <span class="karart" style:opacity={karart / 100}></span>
  </div>
{/if}
{#if duvar && efekt !== "izgara"}<div class="duvar-kagidi" aria-hidden="true"></div>{/if}
{#if efekt === "izgara"}
  <div class="kz kz-izgara" aria-hidden="true"></div>
{:else if efekt === "yakut"}
  <div class="kz kz-yakut" aria-hidden="true" use:yavasSur>
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      <polygon class="yuz" points="40,120 150,60 210,150 120,230" />
      <polygon class="yuz" points="260,40 380,110 330,220 240,170" />
      <polygon class="yuz" points="20,420 130,360 190,470 80,540" />
      <polygon class="yuz" points="250,360 390,420 340,540 220,500" />
      <polygon class="yuz" points="90,640 210,590 260,700 150,770" />
      <polygon class="yuz" points="280,620 380,660 350,760 260,730" />
    </svg>
  </div>
{:else if efekt === "isik"}
  <div class="kz kz-isik" aria-hidden="true" use:yavasSur><span class="kirinim"></span><span class="kirinim"></span><span class="kirinim"></span></div>
{/if}

<style>
  .foto { background: var(--zemin); }
  .foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .karart { position: absolute; inset: 0; background: var(--zemin); }
</style>
