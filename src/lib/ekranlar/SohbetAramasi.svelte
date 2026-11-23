<!--
  Smart search of the chat list (results panel + the field at the bottom). On phones (`dock`) the field stays hidden and grows out of the
  bottom dock when "Ara" is tapped; on wider shapes it is the always-visible pill next to the "new chat" hexagon.
  Sohbet listesinin akıllı araması (sonuç paneli + alttaki alan). Telefonda (`dock`) alan gizli durur ve "Ara"ya basınca alt dock'un içinden
  büyür; geniş şekillerde altıgen "yeni sohbet" düğmesinin yanındaki her zaman görünen haptır.
-->
<script lang="ts">
  import { flushSync, onDestroy, tick } from "svelte";
  import MesajAramaSonuclari from "../arama-mesaj/MesajAramaSonuclari.svelte";
  import AltigenDugme from "../bilesenler/AltigenDugme.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import SohbetSatiri from "../bilesenler/SohbetSatiri.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kabuk } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { sonAramaEkle, sonAramalariOku, sonAramalariTemizle, sorguAyir } from "../durum/sonAramalar";
  import { t } from "../i18n";

  let { dock = false, onyeni }: { dock?: boolean; onyeni?: () => void } = $props();

  // ---- Smart search · Akıllı arama ----
  let aramaModu = $state(false);
  let ham = $state("");
  let alan: HTMLInputElement | undefined = $state();
  let hap: HTMLFormElement | undefined = $state();
  let sonlar = $state<string[]>(sonAramalariOku());
  let aramaKatmani = 0;
  const ayri = $derived(sorguAyir(ham));
  const yazi = $derived(ayri.sorgu.trim());
  const odaEslesmeleri = $derived.by(() => {
    const a = yazi.toLocaleLowerCase("tr");
    if (!a) return [];
    return odalar.liste.filter((o) => !o.davet && o.ad.toLocaleLowerCase("tr").includes(a)).slice(0, 5);
  });
  // Hidden while scrolling down (never while searching). · Aşağı kaydırırken gizli (arama sırasında asla).
  const gizli = $derived(dock ? !aramaModu : kabuk.altGizli && !aramaModu);

  /**
   * Run a state change as ONE shared-element transition of the pill: View Transitions when the WebView has them, else animate the pill's
   * width from the old to the new size. Reduced motion: change at once.
   * Bir durum değişimini hapın TEK ortak öğe geçişi olarak çalıştır: View Transitions varsa o, yoksa hapın genişliğini canlandır.
   */
  async function hapMorf(degistir: () => void) {
    const az = document.documentElement.hasAttribute("data-az-animasyon") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vt = (document as Document & { startViewTransition?: (f: () => Promise<void>) => unknown }).startViewTransition;
    if (az || !hap) return degistir();
    if (vt && !dock) {
      vt.call(document, async () => {
        degistir();
        await tick();
      });
      return;
    }
    const once = hap.getBoundingClientRect().width;
    degistir();
    await tick();
    if (!hap) return;
    const sonra = hap.getBoundingClientRect().width;
    const sure = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sure-yay")) || 0;
    if (sure > 0 && Math.abs(once - sonra) > 4) {
      hap.animate([{ width: `${once}px` }, { width: `${sonra}px` }], { duration: sure, easing: getComputedStyle(document.documentElement).getPropertyValue("--egri-yay-sakin").trim() || "ease-out" });
    }
  }

  function aramaAc() {
    if (aramaModu) return;
    void hapMorf(() => {
      aramaModu = true;
    });
    kabuk.aramaOdakta = true;
    kabuk.altGizli = false;
    aramaKatmani = gezinme.katmanAc(() => {
      aramaKatmani = 0;
      void hapMorf(() => {
        aramaModu = false;
      });
      kabuk.aramaOdakta = false;
      ham = "";
      alan?.blur();
    });
  }
  /** The dock's "Ara": open and focus in the same tap (Android shows the keyboard only then). · Dock'taki "Ara": aynı dokunuşta aç ve odakla (Android klavyeyi yalnızca o zaman gösterir). */
  $effect(() => {
    if (!dock) return;
    kabuk.aramaAc = () => {
      flushSync(aramaAc);
      alan?.focus();
    };
    return () => (kabuk.aramaAc = null);
  });
  function aramaKapat() {
    if (aramaKatmani) gezinme.katmanKapat(aramaKatmani);
  }
  onDestroy(() => {
    if (aramaKatmani) gezinme.katmanBirak(aramaKatmani);
    kabuk.aramaOdakta = false;
  });

  function gonder(e: SubmitEvent) {
    e.preventDefault();
    sonlar = sonAramaEkle(ham);
    alan?.blur();
  }
  function sonSec(s: string) {
    ham = s;
    alan?.focus();
  }
  const hatirla = () => (sonlar = sonAramaEkle(ham));

</script>

<!-- Smart search results cover the list while the search field is focused · Arama alanı odaktayken akıllı arama sonuçları listeyi örter -->
{#if aramaModu}
  <div class="arama-paneli" role="region" aria-label={t("sohbetler.ara")}>
    <div class="panel-kayan">
      {#if ayri.kimden}
        <div class="op-cipleri"><button class="hap aktif" onclick={() => (ham = ayri.sorgu)}>{t("sohbetler.kimdenCip", { ad: ayri.kimden })}<Ikon ad="kapat" boyut={16} /></button></div>
      {/if}
      {#if !ham.trim()}
        {#if sonlar.length > 0}
          <div class="bolum-baslik"><span>{t("sohbetler.sonAramalar")}</span><button onclick={() => (sonlar = sonAramalariTemizle())}>{t("sohbetler.sonAramaTemizle")}</button></div>
          {#each sonlar as s (s)}
            <button class="son" data-dalga onclick={() => sonSec(s)}><Ikon ad="yenile" boyut={18} /><span>{s}</span></button>
          {/each}
        {:else}
          <BosDurum maskot="arama" baslik={t("sohbetler.aramaBosBaslik")} metin={t("sohbetler.aramaBosAlt")} />
        {/if}
      {:else}
        {#if odaEslesmeleri.length > 0}
          <div class="bolum-baslik"><span>{t("sohbetler.bolumSohbetler")}</span></div>
          {#each odaEslesmeleri as oda (oda.id)}
            <SohbetSatiri {oda} sec={() => { hatirla(); gezinme.odaAc(oda.id); }} />
          {/each}
        {/if}
        <MesajAramaSonuclari sorgu={yazi} kimden={ayri.kimden} />
      {/if}
    </div>
  </div>
{/if}

<!-- Bottom bar: ONLY the search pill + the hexagonal new-chat button; a fixed bottom bar (data-alt-cubuk) while visible. -->
<!-- Alt çubuk: YALNIZCA arama hapı + altıgen yeni sohbet düğmesi; görünürken sabit alt çubuk (data-alt-cubuk). -->
<div class="alt-cubuk" class:gizli class:aramada={aramaModu} class:dockta={dock} inert={dock && !aramaModu} data-alt-cubuk={gizli ? undefined : ""}>
  <form class="arama-hapi kristal" class:odakta={aramaModu} bind:this={hap} onsubmit={gonder} role="search">
    <button class="ara-simge" type="button" aria-label={aramaModu ? t("sohbetler.aramaKapat") : t("sohbetler.ara")} onclick={aramaModu ? aramaKapat : () => alan?.focus()}>
      <Ikon ad={aramaModu ? "geri" : "ara"} boyut={20} />
    </button>
    <input bind:this={alan} bind:value={ham} type="search" enterkeyhint="search" placeholder={t("sohbetler.aramaYer")} aria-label={t("sohbetler.ara")} onfocus={aramaAc} autocomplete="off" autocapitalize="off" spellcheck="false" />
    {#if ham}
      <button class="temizle" type="button" aria-label={t("eylem.temizle")} onclick={() => { ham = ""; alan?.focus(); }}><Ikon ad="kapat" boyut={18} /></button>
    {/if}
  </form>
  {#if !dock}<span class="fab-yer" class:gizli-fab={aramaModu}>
    <AltigenDugme etiket={t("sohbetler.yeniSohbet")} onclick={onyeni} devre={aramaModu}><Ikon ad="kalem" boyut={22} /></AltigenDugme>
  </span>{/if}
</div>

<style>
  .hap { flex: none; display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: 0 .875rem; border-radius: 1.25rem; background: var(--yuzey-2); font-size: .875rem; font-weight: 500; color: var(--yazi); }
  .hap.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  /* Search results panel · Arama sonuç paneli */
  .arama-paneli { position: absolute; inset: 0; z-index: 3; background: var(--zemin); display: flex; flex-direction: column; animation: belir var(--sure-orta) var(--egri-cikis); }
  @keyframes belir { from { opacity: 0; transform: translateY(8px); } }
  .panel-kayan { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: calc(env(safe-area-inset-top) + .5rem) 0 6rem; }
  .op-cipleri { display: flex; gap: .5rem; padding: 0 1rem .5rem; }
  .bolum-baslik { display: flex; align-items: center; justify-content: space-between; padding: .5rem 1rem .25rem; font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); }
  .bolum-baslik button { min-height: 2.75rem; padding: 0 .5rem; margin: -.75rem -.5rem; color: var(--vurgu); text-transform: none; letter-spacing: 0; font-size: .8125rem; }
  .son { width: 100%; min-height: 3rem; padding: 0 1rem; display: flex; align-items: center; gap: .75rem; text-align: left; color: var(--yazi); }
  .son span { min-width: 0; overflow-wrap: anywhere; }
  .son :global(svg) { color: var(--yazi-2); }

  /* Bottom bar: pill (flexible) + hexagon. Scrolling down slides it away with a spring. · Alt çubuk: hap (esnek) + altıgen. Aşağı kaydırmak yayla uzaklaştırır. */
  .alt-cubuk { position: absolute; z-index: 4; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem calc(.75rem + env(safe-area-inset-bottom)); pointer-events: none; transition: transform var(--sure-yay) var(--egri-yay-yumusak), opacity var(--sure-orta) var(--egri-cikis); }
  .alt-cubuk.gizli { transform: translate3d(0, calc(100% + 1rem), 0); opacity: 0; }
  .alt-cubuk.gizli > * { pointer-events: none; }
  .arama-hapi { pointer-events: auto; flex: 1; min-width: 0; min-height: 3.5rem; display: flex; align-items: center; border-radius: 1.75rem; overflow: hidden; view-transition-name: arama-hapi; transition: border-color var(--sure-hizli) var(--egri-cikis); }
  .arama-hapi.odakta { border-color: var(--vurgu); }
  .ara-simge { flex: none; width: 3.25rem; min-height: 3.5rem; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .arama-hapi input { flex: 1; min-width: 0; min-height: 3.5rem; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; text-overflow: ellipsis; }
  .arama-hapi input::placeholder { color: var(--yazi-2); }
  .temizle { flex: none; width: 2.75rem; height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  /* The hexagon scales away while searching so the pill grows into its place · Arama sırasında altıgen küçülüp kaybolur; hap yerine büyür */
  .fab-yer { pointer-events: auto; flex: none; display: inline-flex; transition: transform var(--sure-yay) var(--egri-yay-capkin), opacity var(--sure-orta) var(--egri-cikis), margin var(--sure-yay) var(--egri-yay-sakin); }
  .fab-yer.gizli-fab { transform: scale(.3) rotate(30deg); opacity: 0; margin-left: -4rem; pointer-events: none; }
  /* Phone: the field grows out of the dock (same place, same corners) · Telefon: alan dock'un içinden büyür (aynı yer, aynı köşeler) */
  .alt-cubuk.dockta.gizli { transform: scale(.94, 1.15); opacity: 0; transform-origin: 50% 100%; }
  .alt-cubuk.dockta .arama-hapi { border-radius: 24px; }
  .aramada { background: linear-gradient(to top, var(--zemin) 60%, transparent); }

</style>
