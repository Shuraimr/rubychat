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
  import { onDestroy, onMount } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { perdeCik, perdeGir } from "../gecis";
  import Ikon from "./Ikon.svelte";

  let { x, y, eylemler, onkapat }: { x: number; y: number; eylemler: MenuEylemi[]; onkapat: () => void } = $props();

  let katmanId = 0;
  onMount(() => {
    katmanId = gezinme.katmanAc(() => onkapat());
  });
  onDestroy(() => gezinme.katmanBirak(katmanId));

  // Place the menu next to the touch, kept inside the screen; open upwards when there is no room below.
  // Menüyü dokunmanın yanına koy, ekranın içinde tut; altta yer yoksa yukarı doğru aç.
  const GENISLIK = 232;
  const yukseklik = $derived(eylemler.length * 48 + 16);
  const sol = $derived(Math.max(8, Math.min(x - 24, window.innerWidth - GENISLIK - 8)));
  const ust = $derived(y + 12 + yukseklik > window.innerHeight - 8 ? Math.max(8, y - yukseklik - 12) : y + 12);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => gezinme.katmanKapat(katmanId)} oncontextmenu={(e) => e.preventDefault()} in:perdeGir|global out:perdeCik|global></div>
<div class="menu" role="menu" style:left="{sol}px" style:top="{ust}px" style:width="{GENISLIK}px" style:transform-origin="{x - sol}px {y - ust}px">
  {#each eylemler as e (e.etiket)}
    <button role="menuitem" class:tehlike={e.tehlike} onclick={() => { e.calistir(); gezinme.katmanKapat(katmanId); }}>
      <Ikon ad={e.ikon} boyut={20} /><span>{e.etiket}</span>
    </button>
  {/each}
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--zemin) 50%, transparent); }
  .menu {
    position: fixed; z-index: 33; padding: 8px 0; border-radius: 16px; background: var(--yuzey-3); border: 1px solid var(--kenar); box-shadow: var(--kat-2);
    /* Scale from the touch point · Dokunma noktasından ölçeklenir */
    animation: ac var(--sure-menu) var(--egri-cikis);
  }
  @keyframes ac { from { transform: scale(.92); opacity: 0; } }
  button { width: 100%; min-height: 48px; display: flex; align-items: center; gap: 16px; padding: 0 20px; text-align: left; font-size: .9375rem; color: var(--yazi); transition: background var(--sure-hizli) var(--egri-cikis); }
  button:active { background: var(--yuzey-2); }
  button :global(svg) { color: var(--yazi-2); flex: none; }
  .tehlike, .tehlike :global(svg) { color: var(--hata); }
</style>
