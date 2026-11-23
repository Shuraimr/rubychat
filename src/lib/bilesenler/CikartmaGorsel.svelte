<!--
  A received / sent sticker: just the image, no bubble (the time sits in a small chip over its corner). Size is limited to 160px and keeps
  the sticker's own aspect ratio. Animated formats animate (the full file is served, not a thumbnail).
  Alınan / gönderilen çıkartma: yalnızca resim, balon yok (saat köşede küçük bir çipte durur). Boyut 160px ile sınırlı ve çıkartmanın kendi
  en-boy oranını korur. Hareketli biçimler oynar (küçük resim değil tam dosya sunulur).
-->
<script lang="ts">
  import type { ZamanOgesi } from "../api/tipler";
  import { medyaUrl } from "../medya/url";

  let { oge }: { oge: ZamanOgesi } = $props();
  const md = $derived(oge.medya);
  const boyut = $derived.by(() => {
    const g = md?.genislik ?? 0;
    const y = md?.yukseklik ?? 0;
    if (!g || !y) return { g: 140, y: 140 };
    const s = Math.min(160 / g, 160 / y, 1);
    return { g: Math.round(g * s), y: Math.round(y * s) };
  });
  let hatali = $state(false);
</script>

{#if md && !hatali}
  <img class="cikartma" src={medyaUrl(md.kaynakId)} alt={md.dosyaAdi} width={boyut.g} height={boyut.y} draggable="false" onerror={() => (hatali = true)} />
{:else}
  <span class="yedek" style:width="{boyut.g}px" style:height="{boyut.y}px">{md?.dosyaAdi ?? ""}</span>
{/if}

<style>
  .cikartma { display: block; object-fit: contain; max-width: 100%; height: auto; }
  .yedek { display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px; font-size: .75rem; color: var(--yazi-2); border: 1px dashed var(--kenar); border-radius: 12px; overflow: hidden; }
</style>
