<!--
  Horizontal pager on native scroll-snap: the page follows the finger 1:1, flicks, and never drops frames because the browser scrolls it.
  Pagers can be nested: at the inner pager's last page the swipe continues in the outer one. Pages are drawn when first needed (current ± 1).
  Yerel scroll-snap üzerinde yatay sayfalayıcı: sayfa parmağı birebir izler, savrulur ve tarayıcı kaydırdığı için kare kaçırmaz.
  Sayfalayıcılar iç içe olabilir: içtekinin son sayfasında kaydırma dıştakinde sürer. Sayfalar ilk gerektiğinde çizilir (şimdiki ± 1).
-->
<script lang="ts">
  import { untrack, type Snippet } from "svelte";

  let { sayfalar, secili, sec, ilerle, kilitli = false, sayfa }: {
    sayfalar: string[];
    secili: string;
    sec: (id: string) => void;
    /** fractional page position, on every scroll frame · kesirli sayfa konumu, her kaydırma karesinde */
    ilerle?: (f: number) => void;
    kilitli?: boolean;
    sayfa: Snippet<[string]>;
  } = $props();

  let el: HTMLDivElement | undefined = $state();
  let yakin = $state(0);
  let cizilen = $state<Record<string, true>>({});
  let ilk = true;
  let parmakta = false;
  let z: ReturnType<typeof setTimeout> | undefined;

  const azHareket = () => document.documentElement.hasAttribute("data-az-animasyon") || matchMedia("(prefers-reduced-motion: reduce)").matches;

  $effect(() => {
    for (let i = yakin - 1; i <= yakin + 1; i++) {
      const id = sayfalar[i];
      if (id && !untrack(() => cizilen[id])) cizilen[id] = true;
    }
  });

  function git(yumusak: boolean) {
    const i = sayfalar.indexOf(secili);
    if (!el || i < 0 || !el.clientWidth) return;
    const hedef = i * el.clientWidth;
    if (Math.abs(el.scrollLeft - hedef) < 2) return;
    el.scrollTo({ left: hedef, behavior: yumusak && !azHareket() ? "smooth" : "instant" });
  }
  // A tab was chosen from outside, or the page list changed. · Sekme dışarıdan seçildi ya da sayfa listesi değişti.
  let oncekiSecili = "";
  $effect(() => {
    void sayfalar.length;
    const yumusak = !ilk && oncekiSecili !== secili;
    oncekiSecili = secili;
    ilk = false;
    untrack(() => git(yumusak));
  });
  // Rotation / font size: stay on the same page. · Döndürme / yazı boyutu: aynı sayfada kal.
  $effect(() => {
    if (!el) return;
    const g = new ResizeObserver(() => git(false));
    g.observe(el);
    return () => {
      g.disconnect();
      clearTimeout(z);
    };
  });

  function kaydi() {
    if (!el || !el.clientWidth) return;
    const f = el.scrollLeft / el.clientWidth;
    yakin = Math.max(0, Math.min(sayfalar.length - 1, Math.round(f)));
    ilerle?.(f);
    // Fallback for WebViews without `scrollend` · `scrollend`i olmayan WebView'lar için yedek
    if (!("onscrollend" in window)) {
      clearTimeout(z);
      z = setTimeout(durdu, 120);
    }
  }
  function durdu(e?: Event) {
    // scrollend of a nested pager / list bubbles up: only ours counts. · İçteki sayfalayıcının / listenin scrollend'i yukarı çıkar: yalnızca bizimki sayılır.
    if (!el || parmakta || (e && e.target !== el)) return;
    const f = el.scrollLeft / el.clientWidth;
    const id = sayfalar[Math.round(f)];
    if (id && Math.abs(f - Math.round(f)) < 0.02 && id !== secili) sec(id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (only tracks the finger) -->
<div class="sayfalayici" class:kilitli bind:this={el} onscroll={kaydi} onscrollend={durdu} ontouchstart={() => (parmakta = true)} ontouchend={() => { parmakta = false; kaydi(); }} ontouchcancel={() => { parmakta = false; kaydi(); }}>
  {#each sayfalar as id (id)}
    <div class="yaprak" inert={id !== secili && sayfalar[yakin] !== id}>
      {#if cizilen[id] || id === secili}{@render sayfa(id)}{/if}
    </div>
  {/each}
</div>

<style>
  .sayfalayici { flex: 1; min-height: 0; min-width: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-y: contain; }
  .sayfalayici::-webkit-scrollbar { display: none; }
  .sayfalayici.kilitli { overflow-x: hidden; }
  .yaprak { flex: 0 0 100%; width: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; scroll-snap-align: start; scroll-snap-stop: always; }
  /* Pages beside the visible one must not animate (a breathing mascot there costs frames here). · Yandaki sayfalar canlanmamalı (oradaki nefes alan maskot burada kare harcar). */
  .yaprak[inert] :global(*) { animation-play-state: paused !important; }
</style>
