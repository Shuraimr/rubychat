<!--
  The chat wallpaper: an own photo (this device only) under a dimming layer. Solid colours come from --sohbet-zemin, so this renders nothing then.
  Sohbet duvar kâğıdı: kendi fotoğrafın (yalnızca bu cihazda) ve üstünde karartma katmanı. Düz renkler --sohbet-zemin'den gelir; o zaman bir şey çizmez.
-->
<script lang="ts">
  import { zeminUrl } from "../durum/zeminResmi";

  let { resim, resimAnahtari, karart }: { resim: boolean; /** IndexedDB key: "genel" or a room id · IndexedDB anahtarı: "genel" ya da oda kimliği */ resimAnahtari: string; karart: number } = $props();

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
</script>

{#if url}
  <div class="foto" aria-hidden="true"><img src={url} alt="" draggable="false" /><span style:opacity={karart / 100}></span></div>
{/if}

<style>
  .foto { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; contain: strict; background: var(--zemin); }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  span { position: absolute; inset: 0; background: var(--zemin); }
</style>
