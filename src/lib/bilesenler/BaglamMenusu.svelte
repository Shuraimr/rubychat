<!--
  Context menu for a message (design section 8): opens at the touch point (scales 0.92 → 1 from there, 180ms), the message stays lit and
  the rest dims 50%. Only actions that really work are listed (the parent decides). It is a LAYER: back / Escape / outside tap close it.
  Bir mesajın bağlam menüsü (tasarım bölüm 8): dokunulan noktada açılır (oradan 0.92 → 1 ölçeklenir, 180ms), mesaj aydınlık kalır,
  gerisi %50 kararır. Yalnızca gerçekten çalışan eylemler listelenir (üst bileşen karar verir). Bir KATMANDIR: geri / Escape / dışa dokunma kapatır.
-->
<script lang="ts" module>
  import type { IkonAdi } from "./Ikon.svelte";
  export interface MenuEylemi {
    ikon: IkonAdi;
    etiket: string;
    calistir: () => void;
    tehlike?: boolean;
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, type Snippet } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { perdeCik, perdeGir } from "../gecis";
  import Ikon from "./Ikon.svelte";

  let {
    x,
    y,
    eylemler,
    onkapat,
    ust,
  }: {
    x: number;
    y: number;
    eylemler: MenuEylemi[];
    onkapat: () => void;
    /** Optional row above the actions (the quick reaction bar); it gets a `kapat` function · Eylemlerin üstünde isteğe bağlı satır (hızlı tepki çubuğu); bir `kapat` işlevi alır */
    ust?: Snippet<[() => void]>;
  } = $props();

  let katmanId = 0;
  onMount(() => {
    katmanId = gezinme.katmanAc(() => onkapat());
  });
  onDestroy(() => gezinme.katmanBirak(katmanId));

  // Place the menu next to the touch, kept inside the screen; open upwards when there is no room below. The size is MEASURED after the
  // first paint (labels wrap and the text may be zoomed, so a guessed size would overflow); until then it stays invisible.
  // Menüyü dokunmanın yanına koy, ekranın içinde tut; altta yer yoksa yukarı aç. Boyut ilk çizimden sonra ÖLÇÜLÜR (etiketler satır kırar,
  // yazı büyütülmüş olabilir; tahmin taşardı); o ana dek görünmez kalır.
  let w = $state(0);
  let h = $state(0);
  const sol = $derived(Math.max(16, Math.min(x - 24, window.innerWidth - w - 16)));
  const ustKonum = $derived(y + 12 + h > window.innerHeight - 8 ? Math.max(8, y - h - 12) : y + 12);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => gezinme.katmanKapat(katmanId)} oncontextmenu={(e) => e.preventDefault()} in:perdeGir|global out:perdeCik|global></div>
<div class="menu" class:olculdu={w > 0} class:genis={!!ust} role="menu" bind:offsetWidth={w} bind:offsetHeight={h} style:left="{sol}px" style:top="{ustKonum}px" style:transform-origin="{x - sol}px {y - ustKonum}px">
  {#if ust}<div class="ust">{@render ust(() => gezinme.katmanKapat(katmanId))}</div>{/if}
  {#each eylemler as e (e.etiket)}
    <button role="menuitem" class:tehlike={e.tehlike} onclick={() => { e.calistir(); gezinme.katmanKapat(katmanId); }}>
      <Ikon ad={e.ikon} boyut={20} /><span class="et">{e.etiket}</span>
    </button>
  {/each}
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--zemin) 66%, transparent); }
  .menu {
    position: fixed; z-index: 33; padding: .5rem 0; border-radius: 1rem; background: var(--yuzey-3); border: 1px solid var(--kenar); box-shadow: var(--kat-2);
    /* Sizes to its content, never wider than the screen (X1) · İçeriğe göre boyutlanır, ekrandan geniş olmaz (X1) */
    width: max-content; min-width: min(14.5rem, calc(100vw - 2rem)); max-width: min(20rem, calc(100vw - 2rem)); max-height: calc(var(--gorunen-yukseklik, 100vh) - 1rem); overflow-y: auto;
    visibility: hidden;
    /* Scale from the pressed bubble's point with a spring · Basılan balonun noktasından yayla ölçeklenir */
    animation: menu-buyu var(--sure-yay) var(--egri-yay-capkin);
  }
  .menu.olculdu { visibility: visible; }
  .menu.genis { min-width: min(20rem, calc(100vw - 2rem)); }
  button { width: 100%; min-height: 3rem; display: flex; align-items: center; gap: 1rem; padding: .375rem 1.25rem; text-align: left; font-size: .9375rem; line-height: 1.3; color: var(--yazi); transition: background var(--sure-hizli) var(--egri-cikis); }
  button:active { background: var(--yuzey-2); }
  button :global(svg) { color: var(--yazi-2); flex: none; }
  /* The label wraps to two lines, then ends with an ellipsis (never clipped mid-glyph) · Etiket iki satıra kadar sarar, sonra üç nokta (harf ortasında kesilmez) */
  .et { min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .tehlike, .tehlike :global(svg) { color: var(--hata); }
  .ust { padding: .25rem .5rem; border-bottom: 1px solid var(--kenar-ince); margin-bottom: .25rem; }
</style>
