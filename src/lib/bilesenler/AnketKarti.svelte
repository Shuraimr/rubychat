<!--
  A poll inside a message bubble (MSC3381). Rules:
   - single choice: tapping an option votes at once (tapping another one moves the vote);
   - multiple choice: tap to select, then "Oy ver" sends all selected;
   - results (bars + counts) are visible while voting only when the poll is "açık" (m.disclosed); otherwise only MY choice is marked
     until the poll ends, and a line says so;
   - the creator can end the poll (a result footer then says "Anket sona erdi").
  Mesaj balonunun içinde anket (MSC3381). Kurallar:
   - tek seçim: bir seçeneğe dokunmak hemen oy verir (başkasına dokunmak oyu taşır);
   - çoklu seçim: seçmek için dokun, sonra "Oy ver" seçilenlerin hepsini yollar;
   - sonuçlar (çubuklar + sayılar) oy verirken yalnızca anket "açık" (m.disclosed) ise görünür; değilse anket bitene dek yalnızca BENİM
     seçimim işaretlenir ve bir satır bunu söyler;
   - oluşturan anketi bitirebilir (sonuç altlığı "Anket sona erdi" der).
-->
<script lang="ts">
  import type { ZamanOgesi } from "../api/tipler";
  import { anketiBitir, oyVer } from "../mesaj/eylemler";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { oge }: { oge: ZamanOgesi } = $props();
  const a = $derived(oge.anket);

  // Local selection for multiple choice, seeded with my current vote. · Çoklu seçim için yerel seçim; mevcut oyumla başlar.
  let secim = $state<string[]>([]);
  let mesgul = $state(false);
  // Re-seed only when MY vote changes, so other people's votes arriving do not wipe a half-made selection.
  // Yalnızca BENİM oyum değişince yeniden kur; başkalarının oyları gelince yarım kalmış seçim silinmesin.
  const benimOyum = $derived(a ? a.secenekler.filter((s) => s.benim).map((s) => s.id).join(",") : "");
  $effect(() => {
    secim = benimOyum ? benimOyum.split(",") : [];
  });

  const coklu = $derived(!!a && a.maksSecim > 1);
  const oylanabilir = $derived(!!a && !a.bitti && !!oge.olayId && oge.durum === "gonderildi");
  const sonucGorunur = $derived(!!a && (a.acik || a.bitti));
  const enCok = $derived(a ? Math.max(1, ...a.secenekler.map((s) => s.oy)) : 1);

  async function sec(id: string) {
    if (!oylanabilir || mesgul || !a) return;
    if (!coklu) {
      mesgul = true;
      await oyVer(oge, [id]);
      mesgul = false;
      return;
    }
    secim = secim.includes(id) ? secim.filter((x) => x !== id) : secim.length < a.maksSecim ? [...secim, id] : secim;
  }
  async function gonder() {
    if (mesgul || secim.length === 0) return;
    mesgul = true;
    await oyVer(oge, secim);
    mesgul = false;
  }
  async function bitir() {
    if (mesgul) return;
    mesgul = true;
    await anketiBitir(oge);
    mesgul = false;
  }
  const degisti = $derived(a ? secim.slice().sort().join() !== a.secenekler.filter((s) => s.benim).map((s) => s.id).sort().join() : false);
</script>

{#if a}
  <div class="anket">
    <div class="soru"><Ikon ad="anket" boyut={18} /><strong>{a.soru}</strong></div>
    <p class="not">{a.bitti ? t("anket.bitti") : coklu ? t("anket.coklu", { n: a.maksSecim }) : t("anket.tek")}</p>
    <div class="secenekler" role={coklu ? "group" : "radiogroup"}>
      {#each a.secenekler as s (s.id)}
        {@const secili = coklu ? secim.includes(s.id) : s.benim}
        <button class="secenek" class:secili disabled={!oylanabilir} role={coklu ? "checkbox" : "radio"} aria-checked={secili} onclick={() => void sec(s.id)}>
          {#if sonucGorunur}<span class="dolgu" style:transform="scaleX({a.toplamOy > 0 ? s.oy / enCok : 0})"></span>{/if}
          <span class="isaret" aria-hidden="true">{#if secili}<Ikon ad="onay" boyut={14} />{/if}</span>
          <span class="metin">{s.metin}</span>
          {#if sonucGorunur}<span class="oy">{s.oy}</span>{/if}
        </button>
      {/each}
    </div>
    {#if !sonucGorunur && !a.bitti}<p class="not">{t("anket.gizli")}</p>{/if}
    <div class="alt">
      <span>{#if sonucGorunur}{t("anket.oy", { n: a.toplamOy })}{/if}</span>
      {#if coklu && oylanabilir && degisti && secim.length > 0}
        <button class="eylem" onclick={() => void gonder()} disabled={mesgul}>{t("anket.oyVer")}</button>
      {:else if a.benimAnketim && !a.bitti && oge.olayId}
        <button class="eylem" onclick={() => void bitir()} disabled={mesgul}>{t("anket.bitir")}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .anket { display: grid; gap: .375em; min-width: min(15em, 100%); }
  .soru { display: flex; gap: .5em; align-items: flex-start; font-size: .9375em; line-height: 1.35; overflow-wrap: anywhere; }
  .soru :global(svg) { flex: none; margin-top: 1px; }
  .not { font-size: .75em; opacity: .75; }
  .secenekler { display: grid; gap: .375em; }
  .secenek {
    position: relative; overflow: hidden; min-height: 44px; display: flex; align-items: center; gap: .625em; padding: 0 .75em 0 .625em; text-align: left; border-radius: .625em;
    background: color-mix(in srgb, currentColor 10%, transparent); border: 1px solid color-mix(in srgb, currentColor 22%, transparent); font-size: .875em;
  }
  .secenek:disabled { opacity: 1; cursor: default; }
  .secenek.secili { border-color: var(--vurgu); }
  /* Poll bar fills with scaleX (compositor-only, no layout reflow). · Anket çubuğu scaleX ile dolar (yalnızca birleştirici, düzen hesabı yok). */
  .dolgu { position: absolute; inset: 0; background: color-mix(in srgb, var(--vurgu) 28%, transparent); transform-origin: left center; transition: transform var(--sure-ekran) var(--egri-ac); }
  .isaret { position: relative; flex: none; width: 18px; height: 18px; border-radius: 9px; border: 2px solid color-mix(in srgb, currentColor 40%, transparent); display: inline-flex; align-items: center; justify-content: center; }
  .secili .isaret { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-ustu); }
  .metin { position: relative; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .oy { position: relative; flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
  .alt { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .75em; opacity: .9; min-height: 44px; }
  .eylem { min-height: 44px; padding: 0 12px; border-radius: 10px; font-weight: 600; color: var(--vurgu); }
  :global(.balon.kendi) .eylem { color: inherit; text-decoration: underline; }
</style>
