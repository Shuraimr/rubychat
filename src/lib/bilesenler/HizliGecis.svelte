<!--
  Popup of the quick switcher (see durum/hizliGecis.svelte.ts): pinned chats, or the most recent ones while nothing is pinned.
  Hızlı geçişin listesi (bkz. durum/hizliGecis.svelte.ts): sabitli sohbetler; hiç sabitli yoksa en yeniler.
-->
<script lang="ts">
  import { gezinme } from "../durum/gezinme.svelte";
  import { hizli } from "../durum/hizliGecis.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  const sabitVar = $derived(odalar.hizli.some((o) => o.sabit));
  // Nearest row to the thumb = first one · Başparmağa en yakın satır = ilk sohbet
  const sirali = $derived(hizli.asagi ? odalar.hizli : [...odalar.hizli].reverse());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" class:acik={hizli.acik} onclick={() => hizli.kapat()}></div>
<div class="kart acilir" class:acik={hizli.acik} class:asagi={hizli.asagi} inert={!hizli.acik} role="menu" aria-label={t("hizli.baslik")} style:right="{hizli.yer.sag}px" style:top={hizli.asagi ? `${hizli.yer.alt + 8}px` : undefined} style:bottom={hizli.asagi ? undefined : `calc(100% - ${hizli.yer.ust - 12}px)`}>
  <p class="baslik"><Ikon ad={sabitVar ? "sabitle" : "saat"} boyut={16} />{t(sabitVar ? "hizli.baslik" : "hizli.son")}</p>
  {#each sirali as o (o.id)}
    <button class="satir" class:secili={hizli.secili === o.id} class:burada={gezinme.acikOdaId === o.id} role="menuitem" data-hizli={o.id} data-bas="yok" onclick={() => hizli.git(o.id)}>
      <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={36} />
      <span class="ad">{o.ad}</span>
      {#if o.okunmamis > 0}<span class="rozet">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}
    </button>
  {:else}
    <p class="baslik">{t("hizli.bos")}</p>
  {/each}
  {#if !sabitVar && odalar.hizli.length > 0}<p class="not">{t("hizli.ipucu")}</p>{/if}
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--zemin) 50%, transparent); opacity: 0; visibility: hidden; transition: opacity var(--sure-cikis) linear, visibility 0s var(--sure-cikis); }
  .perde.acik { opacity: 1; visibility: visible; transition: opacity var(--sure-orta) linear; }
  .kart { position: fixed; z-index: 45; width: min(17.5rem, calc(100vw - 24px)); max-height: 70vh; overflow-y: auto; padding: 8px; border-radius: 1.75rem; transform-origin: 85% 100%; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .kart.asagi { transform-origin: 85% 0; }
  .baslik { display: flex; align-items: center; gap: .5rem; padding: .375rem .75rem; font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  .satir { min-height: 3.25rem; padding: .375rem .75rem; display: flex; align-items: center; gap: .75rem; border-radius: 1rem; text-align: left; transition: background var(--sure-hizli) linear, color var(--sure-hizli) linear; }
  .satir.burada .ad { color: var(--vurgu); }
  .satir.secili, .satir:active { background: var(--ton); color: var(--ton-ustu); }
  .ad { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .not { padding: .375rem .75rem; font-size: .8125rem; line-height: 1.4; color: var(--yazi-2); }
</style>
