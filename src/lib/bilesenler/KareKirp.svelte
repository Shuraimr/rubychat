<!--
  Square crop sheet: drag to move, slider to zoom, then "Kırp" exports a square image. Used for the avatar (JPEG/WebP, 512px, plain square) and for
  "Çıkartma yap" (WebP 512px with optional rounded corners / round shape and a white outline, transparent outside). It decodes with
  medya/isleme.ts `resmiCoz` (EXIF-aware) and never uploads anything itself: the caller gets the Blob.
  Kare kırpma sayfası: sürükleyerek taşı, kaydırıcıyla yakınlaştır, sonra "Kırp" kare bir resim verir. Avatar (JPEG/WebP, 512px, düz kare) ve
  "Çıkartma yap" (WebP 512px; isteğe bağlı yuvarlatılmış köşe / daire ve beyaz kenar çizgisi, dışı saydam) için kullanılır. medya/isleme.ts
  `resmiCoz` ile çözer (EXIF'e duyarlı) ve kendisi hiçbir şey yüklemez: çağıran Blob'u alır.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { resmiCoz } from "../medya/isleme";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";

  let { dosya, cikti = 512, cikartmaKipi = false, onbitti, onkapat }: {
    dosya: Blob;
    /** output edge in px · çıktı kenarı (px) */
    cikti?: number;
    /** sticker mode: shape + outline options, transparent WebP · çıkartma kipi: biçim + kenar seçenekleri, saydam WebP */
    cikartmaKipi?: boolean;
    onbitti: (blob: Blob, genislik: number, yukseklik: number, mime: string) => void;
    onkapat: () => void;
  } = $props();

  let bmp = $state<ImageBitmap | null>(null);
  let hata = $state(false);
  let kare = $state(280);
  let zoom = $state(1);
  // offset of the image centre from the viewport centre, in viewport px · görüntü merkezinin görünüm merkezinden kayması (görünüm px)
  let ox = $state(0);
  let oy = $state(0);
  let sekil = $state<"kare" | "yuvarlak" | "daire">("yuvarlak");
  let kenar = $state(true);
  let mesgul = $state(false);

  onMount(() => {
    kare = Math.min(320, Math.max(200, window.innerWidth - 64));
    void resmiCoz(dosya).then((b) => (b ? (bmp = b) : (hata = true)));
    return () => bmp?.close?.();
  });

  const taban = $derived(bmp ? kare / Math.min(bmp.width, bmp.height) : 1);
  const olcek = $derived(taban * zoom);
  // Keep the picture covering the square: clamp the offset. · Resim kareyi kaplasın: kaymayı sınırla.
  function sinirla() {
    if (!bmp) return;
    const mx = Math.max(0, (bmp.width * olcek - kare) / 2);
    const my = Math.max(0, (bmp.height * olcek - kare) / 2);
    ox = Math.max(-mx, Math.min(mx, ox));
    oy = Math.max(-my, Math.min(my, oy));
  }
  $effect(() => {
    zoom;
    sinirla();
  });

  let surukle: { x: number; y: number; ox: number; oy: number } | null = null;
  function pDown(e: PointerEvent) {
    surukle = { x: e.clientX, y: e.clientY, ox, oy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function pMove(e: PointerEvent) {
    if (!surukle) return;
    ox = surukle.ox + (e.clientX - surukle.x);
    oy = surukle.oy + (e.clientY - surukle.y);
    sinirla();
  }
  const pUp = () => (surukle = null);

  async function kirp() {
    if (!bmp || mesgul) return;
    mesgul = true;
    try {
      // The visible square in image coordinates · Görünen karenin resim koordinatları
      const sKenar = kare / olcek;
      const sx = bmp.width / 2 - ox / olcek - sKenar / 2;
      const sy = bmp.height / 2 - oy / olcek - sKenar / 2;
      const tuval = document.createElement("canvas");
      tuval.width = tuval.height = cikti;
      const c = tuval.getContext("2d")!;
      c.imageSmoothingQuality = "high";
      const yaricap = !cikartmaKipi || sekil === "kare" ? 0 : sekil === "daire" ? cikti / 2 : cikti * 0.18;
      const ic = cikartmaKipi && kenar ? cikti * 0.03 : 0;
      c.save();
      if (cikartmaKipi) {
        // Outline first (white), then the picture clipped a little smaller · Önce kenar çizgisi (beyaz), sonra biraz küçük kırpılmış resim
        const yol = (inset: number, r: number) => c.roundRect(inset, inset, cikti - 2 * inset, cikti - 2 * inset, Math.max(0, r - inset));
        if (ic > 0) {
          c.beginPath();
          yol(0, yaricap);
          c.fillStyle = "#fff";
          c.fill();
        }
        c.beginPath();
        yol(ic, yaricap);
        c.clip();
      }
      c.drawImage(bmp, sx, sy, sKenar, sKenar, 0, 0, cikti, cikti);
      c.restore();
      const mime = cikartmaKipi ? "image/webp" : "image/jpeg";
      let blob = await new Promise<Blob | null>((coz) => tuval.toBlob(coz, mime, 0.9));
      // A WebView that cannot encode WebP returns PNG: that keeps the transparency, so it is fine for stickers. · WebP kodlayamayan WebView PNG döndürür: saydamlığı korur, çıkartma için uygundur.
      if (!blob) throw new Error("kodlanamadı");
      onbitti(blob, cikti, cikti, blob.type || mime);
    } catch {
      hata = true;
    } finally {
      mesgul = false;
    }
  }
  const sekiller: { id: "kare" | "yuvarlak" | "daire"; ad: string }[] = $derived([
    { id: "kare", ad: t("kirp.kare") },
    { id: "yuvarlak", ad: t("kirp.yuvarlak") },
    { id: "daire", ad: t("kirp.daire") },
  ]);
</script>

<AltSayfa baslik={cikartmaKipi ? t("kirp.cikartmaBaslik") : t("kirp.baslik")} {onkapat}>
  {#if hata}
    <p class="hata">{t("kirp.hata")}</p>
  {:else}
    <!-- The viewport is the square that will be exported; the picture moves under it. · Görünüm, dışa aktarılacak karedir; resim altında hareket eder. -->
    <div class="gorunum" style:width="{kare}px" style:height="{kare}px" class:daire={cikartmaKipi && sekil === "daire"} class:yuvarlak={cikartmaKipi && sekil === "yuvarlak"} role="img" aria-label={t("kirp.baslik")} onpointerdown={pDown} onpointermove={pMove} onpointerup={pUp} onpointercancel={pUp}>
      {#if bmp}
        <canvas use:cizim={{ bmp, olcek, ox, oy, kare }} width={kare} height={kare}></canvas>
      {/if}
    </div>
    <label class="zoom"><span>{t("kirp.yakinlas")}</span><input type="range" min="1" max="4" step="0.01" bind:value={zoom} aria-label={t("kirp.yakinlas")} /></label>
    {#if cikartmaKipi}
      <div class="sekiller" role="radiogroup" aria-label={t("kirp.sekil")}>
        {#each sekiller as s (s.id)}<button role="radio" aria-checked={sekil === s.id} class:aktif={sekil === s.id} onclick={() => (sekil = s.id)}>{s.ad}</button>{/each}
      </div>
      <label class="kenar-satir"><span>{t("kirp.kenar")}</span><input type="checkbox" bind:checked={kenar} /></label>
    {/if}
    <button class="buton birincil" onclick={kirp} disabled={!bmp || mesgul}>{mesgul ? t("kirp.hazirlaniyor") : t("kirp.tamam")}</button>
  {/if}
</AltSayfa>

<script lang="ts" module>
  /** Draws the picture into the preview canvas; re-runs when the parameters change. · Resmi önizleme tuvaline çizer; parametre değişince yeniden çalışır. */
  export function cizim(node: HTMLCanvasElement, p: { bmp: ImageBitmap; olcek: number; ox: number; oy: number; kare: number }) {
    const ciz = (q: typeof p) => {
      const c = node.getContext("2d")!;
      c.clearRect(0, 0, node.width, node.height);
      c.imageSmoothingQuality = "high";
      const w = q.bmp.width * q.olcek;
      const h = q.bmp.height * q.olcek;
      c.drawImage(q.bmp, q.kare / 2 + q.ox - w / 2, q.kare / 2 + q.oy - h / 2, w, h);
    };
    ciz(p);
    return { update: ciz };
  }
</script>

<style>
  .gorunum { position: relative; margin: 0 auto; overflow: hidden; border-radius: 1rem; background: var(--yuzey-2); touch-action: none; cursor: grab; box-shadow: var(--kat-1); }
  .gorunum.yuvarlak { border-radius: 18%; }
  .gorunum.daire { border-radius: 50%; }
  canvas { display: block; width: 100%; height: 100%; }
  .zoom { display: grid; gap: .25rem; font-size: .8125rem; color: var(--yazi-2); }
  .zoom input { width: 100%; min-height: 2.75rem; accent-color: var(--vurgu); }
  .sekiller { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
  .sekiller button { min-height: 2.75rem; border-radius: .75rem; background: var(--yuzey-2); font-size: .875rem; }
  .sekiller button.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .kenar-satir { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 2.75rem; font-size: .9375rem; }
  .kenar-satir input { width: 1.5rem; height: 1.5rem; accent-color: var(--vurgu); }
  .hata { color: var(--hata); text-align: center; padding: 1rem; }
</style>
