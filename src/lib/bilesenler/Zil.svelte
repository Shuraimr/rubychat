<!--
  Notification center bell button (44px round target, sits left of the settings sliders button in Sohbetler).
  Shows an accent count badge (99+) and plays a single short scale pulse when unread grows or a flying banner lands.
  Bildirim merkezi zil düğmesi (44px yuvarlak hedef, Sohbetler'de ayar düğmesinin solunda durur).
  Vurgu renginde sayı rozeti (99+) gösterir; okunmamış artınca veya uçan şerit inince bir kez kısa nabız yapar.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { bildirimMerkezi } from "../durum/bildirimMerkezi.svelte";
  import { egri, hareketVar, sureMs } from "../hareket";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let dugme: HTMLButtonElement | undefined = $state();
  let rozetEl: HTMLSpanElement | undefined = $state();
  let simgeEl: HTMLSpanElement | undefined = $state();
  let oncekiSayi = untrack(() => bildirimMerkezi.okunmamis);

  function nabizYap() {
    if (!hareketVar()) return;
    const hedef = rozetEl ?? simgeEl;
    if (!hedef) return;
    const sure = sureMs("--sure-orta") || 200;
    hedef.style.willChange = "transform";
    const temizle = () => {
      if (hedef.style.willChange === "transform") hedef.style.removeProperty("will-change");
    };
    const a = hedef.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.25)", offset: 0.45 },
        { transform: "scale(1)" },
      ],
      { duration: sure, easing: egri("--egri-cikis") },
    );
    a.onfinish = temizle;
    a.oncancel = temizle;
  }

  // Pulse once whenever unread count increases. · Okunmamış sayısı her arttığında bir kez nabız yap.
  $effect(() => {
    const simdi = bildirimMerkezi.okunmamis;
    if (simdi > oncekiSayi) {
      queueMicrotask(nabizYap);
    }
    oncekiSayi = simdi;
  });

  // Listen for the flying top banner landing on this button. · Uçan üst şeridin bu düğmeye iniş olayını dinle.
  onMount(() => {
    const el = dugme;
    if (!el) return;
    const inis = () => nabizYap();
    el.addEventListener("zil-inis", inis);
    return () => el.removeEventListener("zil-inis", inis);
  });

  const etiket = $derived(
    bildirimMerkezi.okunmamis > 0
      ? t("bildirimMerkezi.zilSayi", { n: bildirimMerkezi.okunmamis })
      : t("bildirimMerkezi.zilEtiket"),
  );
  const rozetMetni = $derived(bildirimMerkezi.okunmamis > 99 ? "99+" : String(bildirimMerkezi.okunmamis));
</script>

<button
  bind:this={dugme}
  class="zil"
  class:acik={bildirimMerkezi.acik}
  type="button"
  data-zil-hedef="zil"
  aria-label={etiket}
  aria-expanded={bildirimMerkezi.acik}
  aria-haspopup="dialog"
  onclick={(e) => bildirimMerkezi.degistir(e.currentTarget)}
>
  <span class="simge" bind:this={simgeEl}><Ikon ad="zil" boyut={22} dolu={bildirimMerkezi.acik} /></span>
  {#if bildirimMerkezi.okunmamis > 0}
    <span class="rozet sayi" bind:this={rozetEl} aria-hidden="true">{rozetMetni}</span>
  {/if}
</button>

<style>
  .zil {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--yuzey-2);
    color: var(--yazi-2);
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .zil.acik {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  @media (hover: hover) {
    .zil:not(.acik):hover {
      background: var(--yuzey-3);
      color: var(--yazi);
    }
  }
  .zil:active {
    background: var(--yuzey-3);
  }
  .zil.acik:active {
    opacity: .82;
  }
  .simge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .sayi {
    position: absolute;
    top: -3px;
    right: -3px;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 .3125rem;
    border-radius: .625rem;
    font-size: .6875rem;
    border: 2px solid var(--zemin);
    box-sizing: content-box;
    pointer-events: none;
  }
</style>
