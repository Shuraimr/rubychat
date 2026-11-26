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
  async function git() {
    if (!guncel) return;
    await mesajaGit(odaId, guncel.olayId);
    if (liste.length > 1) sira = (sira + 1) % liste.length;
  }
</script>

{#if idler.length > 0}
  <button class="cubuk" onclick={() => void git()} aria-label={t("sabit.git")}>
    <Ikon ad="sabitle" boyut={18} />
    <span class="govde">
      <span class="baslik">{t("sabit.baslik")}{#if liste.length > 1} · {sira + 1}/{liste.length}{/if}</span>
      <span class="metin">{guncel ? ((guncel.gonderenAd ? guncel.gonderenAd + ": " : "") + (guncel.metin ?? t("sabit.mesaj"))) : t("sabit.yukleniyor")}</span>
    </span>
  </button>
{/if}

<style>
  .cubuk { flex: none; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 4px 20px; text-align: left; background: transparent; border-bottom: 1px solid var(--kenar-ince); color: var(--vurgu); }
  .cubuk:active { background: var(--yuzey-2); }
  .govde { flex: 1; min-width: 0; display: grid; }
  .baslik { font-size: .75rem; font-weight: 600; }
  .metin { font-size: .875rem; color: var(--yazi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
