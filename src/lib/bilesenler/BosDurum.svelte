<!--
  Empty / error state (design section 13): the raccoon mascot (pose per situation), a title, one sentence and at most one primary action.
  Without `maskot` it falls back to the old 48px icon box.
  Boş / hata durumu (tasarım bölüm 13): rakun maskot (duruma göre poz), başlık, bir cümle ve en fazla bir birincil eylem.
  `maskot` verilmezse eski 48px simge kutusuna düşer.
-->
<script lang="ts">
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import Maskot, { type MaskotPozu } from "./Maskot.svelte";

  let {
    ikon,
    maskot,
    baslik,
    metin,
    ton = "ton",
    eylem,
    onEylem,
    boyut = 120,
  }: { ikon?: IkonAdi; maskot?: MaskotPozu; baslik: string; metin?: string; ton?: "ton" | "bekliyor" | "hata"; eylem?: string; onEylem?: () => void; boyut?: number } = $props();
</script>

<div class="bos">
  {#if maskot}<Maskot poz={maskot} {boyut} />{:else if ikon}<span class="kutu {ton}"><Ikon ad={ikon} boyut={24} /></span>{/if}
  <h2>{baslik}</h2>
  {#if metin}<p>{metin}</p>{/if}
  {#if eylem && onEylem}<button class="buton birincil" onclick={onEylem}>{eylem}</button>{/if}
</div>

<style>
  .bos { padding: 40px 32px; display: grid; justify-items: center; gap: 8px; text-align: center; }
  .kutu { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; background: var(--ton); color: var(--ton-ustu); }
  .kutu.bekliyor { background: color-mix(in srgb, var(--bekliyor) 18%, var(--zemin)); color: var(--bekliyor); }
  .kutu.hata { background: color-mix(in srgb, var(--hata) 18%, var(--zemin)); color: var(--hata); }
  h2 { font-size: 1.0625rem; font-weight: 600; margin-top: 4px; }
  p { font-size: .875rem; color: var(--yazi-2); max-width: 300px; }
  .buton { width: auto; min-width: 140px; margin-top: 12px; }
</style>
