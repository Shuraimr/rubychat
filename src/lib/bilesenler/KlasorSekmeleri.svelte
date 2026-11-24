<!--
  Folder tabs of the chat list (Telegram style): a horizontally scrolling strip. The tinted pill behind the selected tab is ONE element that
  slides and resizes to the new tab with a spring (the left edge moves with transform; the width eases), so switching feels connected. The selected
  tab scrolls into view. Swiping the content left / right switches tabs (done by the parent).
  Sizes are rem and the strip scrolls, so a large system font simply makes the tabs bigger; they never wrap or overlap.
  Sohbet listesinin klasör sekmeleri (Telegram tarzı): yatay kayan şerit. Seçili sekmenin arkasındaki tonlu hap TEK bir öğedir; yeni sekmeye
  yayla kayar ve boyutlanır (sol kenar transform ile, genişlik yumuşakça), böylece geçiş bağlantılı hissedilir. Seçili sekme görünüme kayar.
  İçeriği sola / sağa kaydırmak sekme değiştirir (üst bileşen yapar). Boyutlar rem ve şerit
  kayar; büyük sistem yazı tipi sekmeleri yalnızca büyütür, satır kırmaz ya da üst üste binmez.
-->
<script lang="ts" module>
  export interface Sekme { id: string; ad: string; sayi?: number; acilir?: boolean }
</script>

<script lang="ts">
  import { onMount, tick } from "svelte";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { sekmeler, secili, ilerleme, sec }: { sekmeler: Sekme[]; secili: string; /** fractional index, follows the finger · kesirli sıra, parmağı izler */ ilerleme: number; sec: (id: string) => void } = $props();

  let serit: HTMLDivElement | undefined = $state();
  const dugmeler: Record<string, HTMLButtonElement> = {};
  let olculer = $state<{ x: number; w: number }[]>([]);
  // The pill is interpolated between the two tabs the finger is between. · Hap, parmağın arasında olduğu iki sekme arasında oranlanır.
  const gosterge = $derived.by(() => {
    const i = Math.max(0, Math.min(olculer.length - 1, Math.floor(ilerleme)));
    const a = olculer[i];
    if (!a) return { x: 0, w: 0, hazir: false };
    const b = olculer[i + 1] ?? a;
    const k = Math.max(0, Math.min(1, ilerleme - i));
    return { x: a.x + (b.x - a.x) * k, w: a.w + (b.w - a.w) * k, hazir: true };
  });

  function olc() {
    olculer = sekmeler.map((x) => ({ x: dugmeler[x.id]?.offsetLeft ?? 0, w: dugmeler[x.id]?.offsetWidth ?? 0 }));
    const d = dugmeler[secili];
    if (!d) return;
    // Bring the selected tab fully into view. · Seçili sekmeyi tamamen görünüme getir.
    if (serit) {
      const sol = d.offsetLeft - 16;
      const sag = d.offsetLeft + d.offsetWidth + 16;
      const azHareket = document.documentElement.hasAttribute("data-az-animasyon") || matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (sol < serit.scrollLeft) serit.scrollTo({ left: Math.max(0, sol), behavior: azHareket ? "auto" : "smooth" });
      else if (sag > serit.scrollLeft + serit.clientWidth) serit.scrollTo({ left: sag - serit.clientWidth, behavior: azHareket ? "auto" : "smooth" });
    }
  }
  $effect(() => {
    secili;
    sekmeler;
    tick().then(olc);
  });
  onMount(() => {
    // Font size / window size changes move the tabs: measure again. · Yazı boyutu / pencere değişimi sekmeleri kaydırır: yeniden ölç.
    const g = new ResizeObserver(() => olc());
    if (serit) g.observe(serit);
    for (const d of Object.values(dugmeler)) g.observe(d);
    window.addEventListener("resize", olc);
    return () => {
      g.disconnect();
      window.removeEventListener("resize", olc);
    };
  });
</script>

<div class="sekmeler" role="tablist" aria-label={t("sohbetler.suzgec")} bind:this={serit}>
  <span class="gosterge" class:hazir={gosterge.hazir} style:transform="translateX({gosterge.x}px)" style:width="{gosterge.w}px" aria-hidden="true"></span>
  {#each sekmeler as s (s.id)}
    <button class="sekme" class:aktif={secili === s.id} role="tab" aria-selected={secili === s.id} bind:this={dugmeler[s.id]} onclick={() => sec(s.id)}>
      <span class="ad">{s.ad}</span>
      {#if s.acilir}<Ikon ad="asagiOk" boyut={14} />{/if}
      {#if s.sayi && s.sayi > 0}<span class="sayi">{s.sayi > 99 ? "99+" : s.sayi}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .sekmeler { position: relative; display: flex; align-items: center; gap: 2px; padding: 4px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; contain: content; }
  .sekmeler::-webkit-scrollbar { display: none; }
  /* The pill: a tonal rounded rectangle behind the selected tab; spring on both position and width. · Hap: seçili sekmenin arkasında tonlu yuvarlak dikdörtgen; konumda da genişlikte de yay. */
  .gosterge { position: absolute; left: 0; top: 4px; bottom: 4px; border-radius: 24px; background: var(--ton); pointer-events: none; opacity: 0; will-change: transform; }
  .gosterge.hazir { opacity: 1; transition: opacity var(--sure-hizli) var(--egri-cikis); }
  .sekme { position: relative; flex: none; display: inline-flex; align-items: center; gap: .375rem; min-height: max(44px, 2.75rem); padding: 0 1rem; border-radius: 24px; font-size: .9375rem; font-weight: 500; color: var(--yazi-2); white-space: nowrap; transition: color var(--sure-gecis) var(--egri-cikis); }
  .sekme.aktif { color: var(--ton-ustu); font-weight: 600; }
  .sayi { min-width: 1.125rem; height: 1.125rem; padding: 0 .3125rem; border-radius: .5625rem; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); font-size: .6875rem; font-weight: 700; line-height: 1; }
  .aktif .sayi { background: color-mix(in srgb, var(--vurgu) 85%, transparent); }
  @media (hover: hover) { .sekme:not(.aktif):hover { color: var(--yazi); } }
</style>
