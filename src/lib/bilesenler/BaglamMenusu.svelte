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
    /** Drawn as a tile above the list · Listenin üstünde karo olarak çizilir */
    karo?: boolean;
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, type Snippet } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { menuCik, menuGir, perdeCik, perdeGir } from "../gecis";
  import Ikon from "./Ikon.svelte";

  let {
    x,
    y,
    eylemler,
    onkapat,
    ust,
    onizleme,
  }: {
    x: number;
    y: number;
    eylemler: MenuEylemi[];
    onkapat: () => void;
    /** Optional row above the actions (the quick reaction bar); it gets a `kapat` function · Eylemlerin üstünde isteğe bağlı satır (hızlı tepki çubuğu); bir `kapat` işlevi alır */
    ust?: Snippet<[() => void]>;
    /** Which message this is about · Hangi mesajla ilgili olduğu */
    onizleme?: { ad: string; zaman: string; metin: string };
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
  const karolar = $derived(eylemler.filter((e) => e.karo));
  const satirlar = $derived(eylemler.filter((e) => !e.karo));
  function yap(e: MenuEylemi) {
    e.calistir();
    gezinme.katmanKapat(katmanId);
  }
  let w = $state(0);
  let h = $state(0);
  const sol = $derived(Math.max(16, Math.min(x - 24, window.innerWidth - w - 16)));
  const ustKonum = $derived(y + 12 + h > window.innerHeight - 8 ? Math.max(8, y - h - 12) : y + 12);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => gezinme.katmanKapat(katmanId)} oncontextmenu={(e) => e.preventDefault()} in:perdeGir|global out:perdeCik|global></div>
<div class="menu" class:olculdu={w > 0} class:genis={!!ust} role="menu" bind:offsetWidth={w} bind:offsetHeight={h} style:left="{sol}px" style:top="{ustKonum}px" style:transform-origin="{x - sol}px {y - ustKonum}px" in:menuGir|global out:menuCik|global>
  {#if ust}<div class="ust kart">{@render ust(() => gezinme.katmanKapat(katmanId))}</div>{/if}
  <div class="govde kart">
    {#if onizleme}<div class="onizleme"><span class="kim"><b>{onizleme.ad}</b><small>{onizleme.zaman}</small></span><span class="ne">{onizleme.metin}</span></div>{/if}
    {#if karolar.length > 0}
      <div class="karolar" style:--n={karolar.length}>
        {#each karolar as e (e.etiket)}<button role="menuitem" data-dalga onclick={() => yap(e)}><Ikon ad={e.ikon} boyut={22} /><span>{e.etiket}</span></button>{/each}
      </div>
    {/if}
    {#each satirlar as e (e.etiket)}
      <button class="satir" role="menuitem" data-dalga class:tehlike={e.tehlike} onclick={() => yap(e)}>
        <Ikon ad={e.ikon} boyut={20} /><span class="et">{e.etiket}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--zemin) 55%, transparent); }
  /* Two surfaces: the reactions float above the actions (Material). · İki yüzey: tepkiler eylemlerin üstünde yüzer (Material). */
  .menu {
    position: fixed; z-index: 33; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px;
    width: max-content; min-width: min(14.5rem, calc(100vw - 2rem)); max-width: min(20rem, calc(100vw - 2rem)); max-height: calc(var(--gorunen-yukseklik, 100vh) - 1rem); overflow-y: auto; scrollbar-width: none;
    visibility: hidden;
  }
  .menu::-webkit-scrollbar { display: none; }
  .menu.olculdu { visibility: visible; }
  .menu.genis { width: min(20rem, calc(100vw - 2rem)); }
  .kart { background: var(--yuzey-3); border-radius: 1.75rem; box-shadow: var(--kat-2); }
  .ust { padding: .25rem .5rem; }
  .govde { padding: 8px; display: grid; grid-template-columns: minmax(0, 1fr); }
  .onizleme { padding: 6px 10px 10px; display: grid; gap: 2px; min-width: 0; }
  .kim { display: flex; align-items: baseline; gap: 8px; font-size: .8125rem; color: var(--vurgu); }
  .kim b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kim small { flex: none; margin-left: auto; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .ne { font-size: .875rem; line-height: 1.4; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .karolar { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 4px; padding-bottom: 6px; }
  .karolar button { position: relative; overflow: hidden; min-height: 4.25rem; padding: 8px 2px; display: grid; align-content: center; justify-items: center; gap: 4px; border-radius: 1.25rem; background: var(--ton); color: var(--ton-ustu); }
  .karolar span { max-width: 100%; font-size: min(.75rem, 13px); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .satir { position: relative; overflow: hidden; width: 100%; min-height: 3rem; display: flex; align-items: center; gap: .875rem; padding: .25rem .75rem; border-radius: 1.25rem; text-align: left; font-size: .9375rem; line-height: 1.3; color: var(--yazi); }
  .satir :global(svg) { color: var(--yazi-2); flex: none; }
  .et { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tehlike, .tehlike :global(svg) { color: var(--hata); }
</style>
