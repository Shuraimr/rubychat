<!--
  Pinned-messages bar at the top of a room (only when something is pinned). Shows the current pinned message (name + one line); tapping it jumps
  to that message in the timeline and, when several are pinned, advances to the next one each tap (a small "1/3" counter shows which).
  The list text is fetched by the backend (`sabit_mesajlar`) whenever the pinned ids change.
  Bir odanın üstündeki sabit mesajlar çubuğu (yalnızca bir şey sabitliyse). Güncel sabit mesajı gösterir (ad + bir satır); dokunmak o mesaja
  atlar ve birden çok sabit varsa her dokunuşta sonrakine ilerler (küçük bir "1/3" sayacı hangisi olduğunu söyler). Liste metnini arka uç
  (`sabit_mesajlar`) sabit kimlikleri değiştikçe getirir.
-->
<script lang="ts">
  import { sabitMesajlar } from "../api/komutlar";
  import type { SabitMesaj } from "../api/tipler";
  import { mesajaGit } from "../arama-mesaj/atla";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { odaId, idler }: { odaId: string; idler: string[] } = $props();

  let liste = $state<SabitMesaj[]>([]);
  let sira = $state(0);
  let istek = 0;

  // Re-fetch the texts when the set of pinned ids changes (not on every timeline update). · Sabit kimlik kümesi değişince metinleri yeniden getir (her çizelge güncellemesinde değil).
  const anahtar = $derived(idler.join(","));
  $effect(() => {
    anahtar;
    const bu = ++istek;
    if (idler.length === 0) {
      liste = [];
      return;
    }
    sabitMesajlar(odaId)
      .then((l) => {
        if (bu === istek) liste = l;
      })
      .catch((e) => console.error(e));
  });
  $effect(() => {
    if (sira >= liste.length) sira = 0;
  });

  const guncel = $derived(liste[sira]);
  const toplam = $derived(liste.length || idler.length);
  async function git() {
    if (!guncel) return;
    await mesajaGit(odaId, guncel.olayId);
    if (liste.length > 1) sira = (sira + 1) % liste.length;
  }
</script>

{#if idler.length > 0}
  <button class="cubuk" onclick={() => void git()} aria-label={t("sabit.git")}>
    <span class="igne" aria-hidden="true"><Ikon ad="sabitle" boyut={16} /></span>
    <span class="metin">
      {#if guncel}
        {#if guncel.gonderenAd}<strong>{guncel.gonderenAd}:</strong>{" "}{/if}{guncel.metin ?? t("sabit.mesaj")}
      {:else}
        {t("sabit.yukleniyor")}
      {/if}
    </span>
    {#if toplam > 1}
      <span class="sayac">{sira + 1}/{toplam}</span>
    {/if}
  </button>
{/if}

<style>
  .cubuk {
    flex: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    text-align: left;
    background: transparent;
    border-top: 1px solid var(--kenar-ince);
    color: var(--yazi);
    transition: background-color var(--sure-hizli) var(--egri-cikis);
  }
  @media (hover: hover) {
    .cubuk:hover { background: var(--yuzey-2); }
  }
  .cubuk:active { background: var(--yuzey-3); }
  .igne { flex: none; display: inline-flex; color: var(--vurgu); }
  .metin {
    flex: 1;
    min-width: 0;
    font-size: .8125rem;
    line-height: 1.3;
    color: var(--yazi);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .metin strong { font-weight: 600; }
  .sayac {
    flex: none;
    font-size: .75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--yazi-2);
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--yuzey-2);
  }
</style>
