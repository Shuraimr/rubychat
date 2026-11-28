<!--
  Notification center bell button: 44px round button in Sohbetler (portrait phone) or labelled rail item in Ray (`ray`).
  Shows an accent count badge (99+) and plays a single short scale pulse when unread grows or a flying banner lands.
  Bildirim merkezi zil düğmesi: Sohbetler'de 44px yuvarlak düğme (dikey telefon) ya da Ray'da etiketli ray öğesi (`ray`).
  Vurgu renginde sayı rozeti (99+) gösterir; okunmamış artınca veya uçan şerit inince bir kez kısa nabız yapar.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { bildirimMerkezi } from "../durum/bildirimMerkezi.svelte";
  import { egri, hareketVar, sureMs } from "../hareket";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { ray = false, kompakt = false }: { ray?: boolean; kompakt?: boolean } = $props();

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

{#if ray}
  <button
    bind:this={dugme}
    class="ray-oge"
    class:kompakt
    class:aktif={bildirimMerkezi.acik}
    type="button"
    data-zil-hedef="zil"
    aria-label={etiket}
    aria-expanded={bildirimMerkezi.acik}
    aria-haspopup="dialog"
    onclick={(e) => bildirimMerkezi.degistir(e.currentTarget)}
  >
    <span class="hap">
      <span class="zemin-hap"></span>
      <span class="simge" bind:this={simgeEl}><Ikon ad="zil" boyut={22} dolu={bildirimMerkezi.acik} /></span>
      {#if bildirimMerkezi.okunmamis > 0}
        <span class="rozet sayac" bind:this={rozetEl} aria-hidden="true">{rozetMetni}</span>
      {/if}
    </span>
    <span class="etiket">{t("bildirimMerkezi.baslik")}</span>
  </button>
{:else}
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
{/if}

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

  /* Rail variant matching Ray.svelte items · Ray.svelte öğeleriyle eşleşen ray görünümü */
  .ray-oge {
    width: 100%;
    min-height: 56px;
    padding: 0 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--yazi-2);
  }
  .ray-oge.kompakt {
    min-height: 46px;
    gap: 2px;
  }
  .hap {
    position: relative;
    width: 56px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .kompakt .hap {
    height: 28px;
  }
  .zemin-hap {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    background: var(--ton);
    opacity: 0;
    transform: scaleX(.5);
    transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-orta) var(--egri-cikis);
  }
  .kompakt .zemin-hap {
    border-radius: 14px;
    inset: 0 4px;
  }
  .aktif .zemin-hap {
    opacity: 1;
    transform: scaleX(1);
  }
  @media (hover: hover) {
    .ray-oge:not(.aktif):hover .zemin-hap {
      opacity: 1;
      transform: scaleX(1);
      background: var(--yuzey-3);
    }
  }
  .ray-oge .simge {
    position: relative;
  }
  .aktif .simge {
    color: var(--ton-ustu);
  }
  .sayac {
    position: absolute;
    top: -2px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: .6875rem;
    border: 2px solid var(--yuzey-1);
    box-sizing: content-box;
    pointer-events: none;
  }
  .kompakt .sayac {
    top: -4px;
    right: 6px;
  }
  .etiket {
    font-size: .75rem;
    line-height: 1.33;
    max-width: 100%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kompakt .etiket {
    font-size: .6875rem;
    line-height: 1.2;
  }
  .aktif {
    color: var(--yazi);
  }
  .aktif .etiket {
    font-weight: 600;
  }
</style>
