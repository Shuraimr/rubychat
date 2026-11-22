<!--
  Round progress ring with a cancel cross in the middle (design 10-medya, part 5). `oran` null = unknown (slow spin).
  The 44px tap target is the whole circle. Motion collapses under reduced motion (the ring just shows the value).
  Ortasında iptal çarpısı olan yuvarlak ilerleme halkası (10-medya tasarımı, 5. bölüm). `oran` null = bilinmiyor (yavaş dönüş).
  44px dokunma hedefi dairenin tamamıdır. Azaltılmış harekette hareket kapanır (halka yalnızca değeri gösterir).
-->
<script lang="ts">
  import Ikon from "../bilesenler/Ikon.svelte";
  import { m } from "./metin";

  let { oran = null, iptal }: { oran?: number | null; iptal?: () => void } = $props();
  const CEVRE = 2 * Math.PI * 20;
</script>

<button type="button" class="halka" class:bilinmiyor={oran === null} onclick={(e) => { e.stopPropagation(); iptal?.(); }} disabled={!iptal} aria-label={m("gonderimiIptal")}>
  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <circle cx="24" cy="24" r="20" class="iz" />
    <circle cx="24" cy="24" r="20" class="deger" stroke-dasharray={CEVRE} stroke-dashoffset={CEVRE * (1 - (oran ?? 0.25))} />
  </svg>
  {#if iptal}<span class="carpi"><Ikon ad="kapat" boyut={18} /></span>{/if}
</button>

<style>
  .halka {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    background: var(--zemin);
    color: var(--yazi);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .halka:disabled {
    cursor: default;
  }
  svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }
  circle {
    fill: none;
    stroke-width: 3.5;
  }
  .iz {
    stroke: var(--kenar);
  }
  .deger {
    stroke: var(--vurgu);
    stroke-linecap: round;
    transition: stroke-dashoffset var(--sure-orta) var(--egri-cikis);
  }
  .bilinmiyor svg {
    animation: don 1.1s linear infinite;
  }
  @keyframes don {
    to {
      transform: rotate(270deg);
    }
  }
  .carpi {
    position: relative;
  }
  @media (prefers-reduced-motion: reduce) {
    .bilinmiyor svg {
      animation: none;
    }
  }
</style>
