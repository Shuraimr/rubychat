<!--
  Empty / error state (design section 13): one 48px icon in a tinted box, a title, one sentence and at most one primary action.
  Boş / hata durumu (tasarım bölüm 13): ton kutusunda tek 48px simge, başlık, bir cümle ve en fazla bir birincil eylem.
-->
<script lang="ts">
  import Ikon, { type IkonAdi } from "./Ikon.svelte";

  let {
    ikon,
    baslik,
    metin,
    ton = "ton",
    eylem,
    onEylem,
  }: { ikon: IkonAdi; baslik: string; metin?: string; ton?: "ton" | "bekliyor" | "hata"; eylem?: string; onEylem?: () => void } = $props();
</script>

<div class="bos">
  <span class="kutu {ton}"><Ikon ad={ikon} boyut={24} /></span>
  <h2>{baslik}</h2>
  {#if metin}<p>{metin}</p>{/if}
  {#if eylem && onEylem}<button class="buton birincil" onclick={onEylem}>{eylem}</button>{/if}
</div>

<style>
  .bos { padding: 48px 32px; display: grid; justify-items: center; gap: 8px; text-align: center; }
  .kutu { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; background: var(--ton); color: var(--ton-ustu); }
  .kutu.bekliyor { background: color-mix(in srgb, var(--bekliyor) 18%, var(--zemin)); color: var(--bekliyor); }
  .kutu.hata { background: color-mix(in srgb, var(--hata) 18%, var(--zemin)); color: var(--hata); }
  h2 { font-size: 1.0625rem; font-weight: 600; }
  p { font-size: .875rem; color: var(--yazi-2); max-width: 300px; }
  .buton { width: auto; min-width: 140px; margin-top: 12px; }
</style>
