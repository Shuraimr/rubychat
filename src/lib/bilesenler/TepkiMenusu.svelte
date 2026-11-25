<!--
  Quick reaction popover opened from the keyboard (Ctrl+T): reuses TepkiCubugu inside a lightweight dialog layer.
  Klavyeden açılan hızlı tepki penceresi (Ctrl+T): TepkiCubugu'nu hafif bir pencere katmanında yeniden kullanır.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { menuCik, menuGir, perdeCik, perdeGir } from "../gecis";
  import { t } from "../i18n";
  import TepkiCubugu from "./TepkiCubugu.svelte";

  let {
    x,
    y,
    benim,
    sec,
    dahaFazla,
    onkapat,
  }: {
    x: number;
    y: number;
    benim: Set<string>;
    sec: (emoji: string) => void;
    dahaFazla: () => void;
    onkapat: () => void;
  } = $props();

  let kutu: HTMLDivElement | undefined = $state();
  let katmanId = 0;
  let w = $state(0);
  let h = $state(0);

  onMount(() => {
    katmanId = gezinme.katmanAc(() => onkapat());
    queueMicrotask(() => kutu?.querySelector<HTMLElement>("button")?.focus());
  });
  onDestroy(() => gezinme.katmanBirak(katmanId));

  const sol = $derived(Math.max(16, Math.min(x - 24, window.innerWidth - w - 16)));
  const ust = $derived(y + 12 + h > window.innerHeight - 8 ? Math.max(8, y - h - 12) : y + 12);

  function kapat() {
    gezinme.katmanKapat(katmanId);
  }

  /** Left/right arrows move across the quick reactions and "+". · Sol/sağ oklar hızlı tepkiler ve "+" arasında gezer. */
  function tus(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const dugmeler = [...(kutu?.querySelectorAll<HTMLElement>("button") ?? [])];
    if (dugmeler.length === 0) return;
    e.preventDefault();
    const i = dugmeler.indexOf(document.activeElement as HTMLElement);
    const adim = e.key === "ArrowRight" ? 1 : -1;
    dugmeler[(i < 0 ? 0 : i + adim + dugmeler.length) % dugmeler.length].focus();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={kapat} oncontextmenu={(e) => e.preventDefault()} in:perdeGir|global out:perdeCik|global></div>
<div
  class="pencere"
  class:olculdu={w > 0}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  aria-label={t("tepki.hizli")}
  bind:this={kutu}
  bind:offsetWidth={w}
  bind:offsetHeight={h}
  onkeydown={tus}
  style:left="{sol}px"
  style:top="{ust}px"
  style:transform-origin="{x - sol}px {y - ust}px"
  in:menuGir|global
  out:menuCik|global
>
  <TepkiCubugu
    {benim}
    sec={(e) => { sec(e); kapat(); }}
    dahaFazla={() => { kapat(); dahaFazla(); }}
  />
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--zemin) 55%, transparent); }
  .pencere {
    position: fixed;
    z-index: 33;
    width: min(20rem, calc(100vw - 2rem));
    padding: .25rem .5rem;
    border-radius: 1.75rem;
    background: var(--yuzey-3);
    box-shadow: var(--kat-2);
    visibility: hidden;
  }
  .pencere.olculdu { visibility: visible; }
</style>
