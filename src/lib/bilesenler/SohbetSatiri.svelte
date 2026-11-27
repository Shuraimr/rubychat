<!--
  One 72px row in the chat list (design section 5). States: unread (bold name + preview, accent time, count badge), mention ("@" badge),
  draft (red "Taslak:" prefix), selected on wide layouts (surface-3 + 3px accent bar on the left), invite ("Davet bekliyor"), pressed (surface-2).
  Muted rows are not drawn: the backend sends no mute setting yet.
  Sohbet listesindeki 72px'lik bir satır (tasarım bölüm 5). Haller: okunmamış (kalın ad + önizleme, vurgu zaman, sayı rozeti), bahsedilme
  ("@" rozeti), taslak (kırmızı "Taslak:" öneki), geniş düzende seçili (yuzey-3 + solda 3px vurgu çubuğu), davet ("Davet bekliyor"), basılı (yuzey-2).
  Sessiz satır çizilmez: arka uç henüz sessize alma ayarı yollamıyor.
-->
<script lang="ts">
  import type { OdaOzeti } from "../api/tipler";
  import { uzunBasma } from "../dokunma";
  import { t } from "../i18n";
  import { goreliZaman } from "../zaman-bicim";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let { oda, secili = false, taslak = "", sec, uzun }: { oda: OdaOzeti; secili?: boolean; taslak?: string; sec: () => void; sira?: number; uzun?: (x: number, y: number) => void } = $props();

  const okunmamisMi = $derived(oda.okunmamis > 0 || oda.bahsedilme > 0);
  const onizleme = $derived(oda.davet ? t("sohbetler.davetli") : taslak || (oda.sonMesaj ?? t("sohbetler.mesajYok")));
  const sayi = $derived(oda.okunmamis > 99 ? "99+" : String(oda.okunmamis));
</script>

<button class="satir" data-dalga class:secili class:okunmamis={okunmamisMi} onclick={sec} use:uzunBasma={{ ac: (x, y) => uzun?.(x, y), sure: 400 }}>
  <Avatar harf={oda.avatarHarf} mxc={oda.avatarMxc} boyut={52} anahtar={oda.id} />
  <span class="orta">
    <span class="ust">
      <span class="ad">{oda.ad}</span>
      {#if oda.sifreli}<span class="kilit sifreli" title={t("sohbetler.sifreli")}><Ikon ad="kilit" boyut={14} /></span>{/if}
      {#if oda.sabit}<span class="kilit" title={t("sohbetler.sabitli")}><Ikon ad="sabitle" boyut={14} /></span>{/if}
      <span class="zaman">{goreliZaman(oda.sonZaman)}</span>
    </span>
    <span class="alt">
      <span class="onizleme">{#if taslak && !oda.davet}<span class="taslak">{t("sohbetler.taslak")}</span> {/if}{onizleme}</span>
      {#if oda.bahsedilme > 0}
        <span class="rozet bahis" title={t("sohbetler.bahsedildi")} aria-label={t("sohbetler.bahsedildi")}>@</span>
      {/if}
      {#if oda.okunmamis > 0}<span class="rozet">{sayi}</span>{/if}
    </span>
  </span>
</button>

<style>
  .satir {
    /* Rows outside the screen are not laid out or painted; containment isolates every row in long lists. */
    /* Ekran dışındaki satırlar düzenlenmez, boyanmaz; containment uzun listelerde her satırı yalıtır. */
    content-visibility: auto; contain-intrinsic-size: auto var(--liste-satir-boy, 4.5rem); contain: layout style paint;
    position: relative; width: 100%; min-height: var(--liste-satir-boy, 4.5rem); padding: var(--liste-satir-py, .5rem) var(--liste-satir-px, 1rem);
    display: flex; align-items: center; gap: var(--liste-satir-ara, 1rem); text-align: left;
  }
  /* Avatar size follows the active density token so compact/default/comfortable stay proportional without clipping. */
  /* Avatar boyutu etkin yoğunluk değişkenini izler; kompakt/varsayılan/rahat kırpılmadan orantılı kalır. */
  .satir :global(.avatar) {
    width: var(--liste-avatar, 3.25rem) !important;
    height: var(--liste-avatar, 3.25rem) !important;
    border-radius: calc(var(--liste-avatar, 3.25rem) * 0.25) !important;
    font-size: calc(var(--liste-avatar, 3.25rem) * 0.42) !important;
  }
  @media (hover: hover) { .satir:hover { background: var(--yuzey-1); } }
  .satir:focus-visible { outline-offset: -2px; border-radius: 12px; }
  .satir:active { background: var(--yuzey-2); }
  /* Selected: only where the list and the room sit side by side; keeps vertical padding so rows never jump. */
  /* Seçili: yalnızca liste ile oda yan yana dururken; dikey dolgu korunur, satır hiç zıplamaz. */
  .satir.secili { background: var(--yuzey-3); border-radius: 12px; width: calc(100% - 16px); margin: 0 8px; padding: var(--liste-satir-py, .5rem) calc(var(--liste-satir-px, 1rem) - 8px); }
  .satir.secili::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 2px; background: var(--vurgu); }
  .orta { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust, .alt { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .ad { font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .kilit { color: var(--yazi-2); display: inline-flex; flex: none; }
  .kilit.sifreli { color: var(--cozum); }
  .okunmamis .ad, .okunmamis .onizleme { font-weight: 700; color: var(--yazi); }
  .okunmamis .zaman { color: var(--vurgu); font-weight: 600; }
  .zaman { margin-left: auto; flex: none; font-size: .8125rem; color: var(--yazi-2); }
  .onizleme { flex: 1; min-width: 0; font-size: .875rem; line-height: 1.4; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zaman, .rozet { font-variant-numeric: tabular-nums; }
  .taslak { color: var(--hata); font-weight: 600; }
  /* Mention variant: tonal "@" so it differs from the plain count · Bahsedilme türü: sayıdan ayrışsın diye tonlu "@" */
  .rozet.bahis { background: var(--ton); color: var(--ton-ustu); padding: 0; min-width: 22px; }
  :global([data-yogunluk="kompakt"]) .orta { gap: 1px; }
  :global([data-yogunluk="kompakt"]) .ad { font-size: .9375rem; line-height: 1.25; }
  :global([data-yogunluk="kompakt"]) .onizleme { font-size: .8125rem; line-height: 1.3; }
  :global([data-yogunluk="kompakt"]) .zaman { font-size: .75rem; }
</style>
