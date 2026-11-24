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

  let { oda, secili = false, taslak = "", sec, sira = 0, uzun }: { oda: OdaOzeti; secili?: boolean; taslak?: string; sec: () => void; sira?: number; uzun?: (x: number, y: number) => void } = $props();

  const okunmamisMi = $derived(oda.okunmamis > 0 || oda.bahsedilme > 0);
  const onizleme = $derived(oda.davet ? t("sohbetler.davetli") : taslak || (oda.sonMesaj ?? t("sohbetler.mesajYok")));
  const sayi = $derived(oda.okunmamis > 99 ? "99+" : String(oda.okunmamis));
</script>

<button class="satir liste-gir" style:--i={sira} data-dalga class:secili class:okunmamis={okunmamisMi} onclick={sec} use:uzunBasma={{ ac: (x, y) => uzun?.(x, y), sure: 400 }}>
  <Avatar harf={oda.avatarHarf} mxc={oda.avatarMxc} boyut={52} />
  <span class="orta">
    <span class="ust">
      <span class="ad">{oda.ad}</span>
      {#if oda.sifreli}<span class="kilit" title={t("sohbetler.sifreli")}><Ikon ad="kilit" boyut={14} /></span>{/if}
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
    /* Rows outside the screen are not laid out or painted. · Ekran dışındaki satırlar düzenlenmez, boyanmaz. */
    content-visibility: auto; contain-intrinsic-size: auto 4.5rem;
    position: relative; width: 100%; min-height: 4.5rem; padding: .5rem 1rem;
    display: flex; align-items: center; gap: 1rem; text-align: left;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  @media (hover: hover) { .satir:hover { background: var(--yuzey-1); } }
  .satir:active { background: var(--yuzey-2); }
  /* Selected: only where the list and the room sit side by side · Seçili: yalnızca liste ile oda yan yana dururken */
  .satir.secili { background: var(--yuzey-3); border-radius: 12px; width: calc(100% - 16px); margin: 0 8px; padding: 0 8px; }
  .satir.secili::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 2px; background: var(--vurgu); }
  .orta { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust, .alt { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .ad { font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .kilit { color: var(--yazi-2); display: inline-flex; flex: none; }
  .okunmamis .ad, .okunmamis .onizleme { font-weight: 700; color: var(--yazi); }
  .okunmamis .zaman { color: var(--vurgu); font-weight: 600; }
  .zaman { margin-left: auto; flex: none; font-size: .8125rem; color: var(--yazi-2); }
  .onizleme { flex: 1; min-width: 0; font-size: .875rem; line-height: 1.4; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zaman, .rozet { font-variant-numeric: tabular-nums; }
  .taslak { color: var(--hata); font-weight: 600; }
  /* Mention variant: tonal "@" so it differs from the plain count · Bahsedilme türü: sayıdan ayrışsın diye tonlu "@" */
  .rozet.bahis { background: var(--ton); color: var(--ton-ustu); padding: 0; min-width: 22px; }
</style>
