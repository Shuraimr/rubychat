<!--
  Smart search of the chat list (results panel + the field at the bottom). On portrait phones (`dock`) the field stays hidden and grows out of
  the bottom dock when "Ara" is tapped; on wide desktop and landscape phones it is the always-visible pill next to the round "+" New menu button.
  Sohbet listesinin akıllı araması (sonuç paneli + alttaki alan). Dikey telefonda (`dock`) alan gizli durur ve "Ara"ya basınca alt dock'un içinden
  büyür; geniş masaüstünde ve yatay telefonda yuvarlak "+" Yeni menüsü düğmesinin yanındaki her zaman görünen haptır.
-->
<script lang="ts">
  import { hareketVar } from "../hareket";
  import { flushSync, onDestroy, tick } from "svelte";
  import MesajAramaSonuclari from "../arama-mesaj/MesajAramaSonuclari.svelte";
  import type { OdaOzeti } from "../api/tipler";
  import Avatar from "../bilesenler/Avatar.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon, { type IkonAdi } from "../bilesenler/Ikon.svelte";
  import { titret } from "../dokunma";
  import SohbetSatiri from "../bilesenler/SohbetSatiri.svelte";
  import YeniMenusu, { type YeniSayfa } from "../bilesenler/YeniMenusu.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kabuk } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { sonAramaEkle, sonAramalariOku, sonAramalariTemizle, sorguAyir } from "../durum/sonAramalar";
  import { t, type Anahtar } from "../i18n";

  let { dock = false, onsec }: { dock?: boolean; onsec?: (sayfa: YeniSayfa) => void } = $props();

  // ---- Smart search · Akıllı arama ----
  let aramaModu = $state(false);
  let ham = $state("");
  let alan: HTMLInputElement | undefined = $state();
  let sonlar = $state<string[]>(sonAramalariOku());
  let aramaKatmani = 0;

  // ---- "+" New menu (wide desktop & landscape phone) · "+" Yeni menüsü (geniş masaüstü ve yatay telefon) ----
  let yeniAcik = $state(false);
  let yeniKatman = 0;
  let zorlaKapat = false;
  let menuKap: HTMLDivElement | undefined = $state();
  let yeniMenu = $state<{ geriAl: () => boolean; icinde: (hedef: Node | null) => boolean }>();
  let yeniDugme: HTMLButtonElement | undefined = $state();
  let yeniPerde: HTMLButtonElement | undefined = $state();

  function yeniKapat() {
    if (!yeniKatman) return;
    zorlaKapat = true;
    gezinme.katmanKapat(yeniKatman);
  }
  function yeniDegis() {
    if (yeniAcik) return yeniKapat();
    titret(8);
    kabuk.altGizli = false;
    zorlaKapat = false;
    yeniAcik = true;
    yeniKatman = gezinme.katmanAc(() => {
      // On Escape/back while showing an inline form, return to the menu first instead of dismissing the card.
      // Gömülü formdayken Escape/geri tuşu kartı kapatmak yerine önce menüye döner.
      if (!zorlaKapat && yeniMenu?.geriAl()) return false;
      zorlaKapat = false;
      yeniKatman = 0;
      yeniAcik = false;
    });
  }
  // Close the New menu on outside pointerdown anywhere in the window (including the rail or room column outside Sohbetler's stacking context).
  // Pencerenin herhangi bir yerine dışarı tıklandığında (Sohbetler yığın bağlamı dışındaki ray ya da oda sütunu dahil) Yeni menüsünü kapat.
  $effect(() => {
    if (!yeniAcik || dock) return;
    const disTik = (e: PointerEvent) => {
      const hedef = e.target as Node | null;
      if (!hedef) return;
      if (menuKap?.contains(hedef) || yeniMenu?.icinde(hedef) || yeniDugme?.contains(hedef) || yeniPerde?.contains(hedef)) return;
      yeniKapat();
    };
    document.addEventListener("pointerdown", disTik, true);
    return () => document.removeEventListener("pointerdown", disTik, true);
  });
  const ayri = $derived(sorguAyir(ham));
  const yazi = $derived(ayri.sorgu.trim());
  // ---- What to search in: chips above the field, at the thumb · Nerede aranacağı: alanın üstünde, başparmakta çipler ----
  type Kapsam = "hepsi" | "kisiler" | "gruplar" | "alanlar" | "mesajlar";
  let kapsam = $state<Kapsam>("hepsi");
  const kapsamlar: { id: Kapsam; ad: Anahtar; ikon: IkonAdi }[] = [
    { id: "hepsi", ad: "sohbetler.tumu", ikon: "ara" },
    { id: "mesajlar", ad: "mesajAra.baslik", ikon: "dosya" },
    { id: "kisiler", ad: "sohbetler.kisiler", ikon: "kisi" },
    { id: "gruplar", ad: "sohbetler.gruplar", ikon: "sohbet" },
    { id: "alanlar", ad: "alanlar.baslik", ikon: "izgara" },
  ];
  function kapsamda(o: OdaOzeti): boolean {
    if (kapsam === "mesajlar") return false;
    if (kapsam === "alanlar") return o.alan;
    if (o.alan) return false;
    return kapsam === "hepsi" || (kapsam === "kisiler") === o.dm;
  }
  function alanaGit() {
    aramaKapat();
    gezinme.sekmeSec("alanlar");
  }
  const odaEslesmeleri = $derived.by(() => {
    const a = yazi.toLocaleLowerCase("tr");
    if (!a) return [];
    const l = odalar.liste.filter((o) => !o.davet && kapsamda(o) && o.ad.toLocaleLowerCase("tr").includes(a));
    return kapsam === "hepsi" ? l.slice(0, 5) : l.slice(0, 40);
  });
  // Hidden while scrolling down (never while searching or while the New menu is open). · Aşağı kaydırırken gizli (arama ya da Yeni menüsü açıkken asla).
  const gizli = $derived(dock ? !aramaModu : kabuk.altGizli && !aramaModu && !yeniAcik);

  /**
   * Run a state change as ONE shared-element transition of the pill when View Transitions exist; otherwise switch cleanly without animating width.
   * View Transitions varsa hapın TEK ortak öğe geçişi olarak çalıştır; yoksa width canlandırmadan temizce değiştir.
   */
  async function hapMorf(degistir: () => void) {
    const vt = (document as Document & { startViewTransition?: (f: () => Promise<void>) => unknown }).startViewTransition;
    if (!hareketVar() || !vt || dock) return degistir();
    vt.call(document, async () => {
      degistir();
      await tick();
    });
  }

  function aramaAc() {
    if (aramaModu) return;
    yeniKapat();
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
      kapsam = "hepsi";
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
    if (yeniKatman) gezinme.katmanBirak(yeniKatman);
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
      <h1>{t("sohbetler.aramaBaslik")}</h1>
      {#if !ham.trim()}
        {#if odalar.hizli.length > 0}
          <div class="bolum-baslik"><span>{t(odalar.hizli.some((o) => o.sabit) ? "hizli.baslik" : "hizli.son")}</span></div>
          <div class="kisayollar">
            {#each odalar.hizli as o (o.id)}
              <button class="kisayol" onclick={() => gezinme.odaAc(o.id)}><span class="k-yuz"><Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={56} />{#if o.okunmamis > 0}<span class="rozet k-sayi">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}</span><span class="k-ad">{o.ad}</span></button>
            {/each}
          </div>
        {/if}
        {#if sonlar.length > 0}
          <div class="bolum-baslik"><span>{t("sohbetler.sonAramalar")}</span><button onclick={() => (sonlar = sonAramalariTemizle())}>{t("sohbetler.sonAramaTemizle")}</button></div>
          <div class="ay-kart kenarli">
            {#each sonlar as s (s)}
              <button class="son" data-dalga onclick={() => sonSec(s)}><Ikon ad="saat" boyut={20} /><span>{s}</span></button>
            {/each}
          </div>
        {:else}
          <p class="ipucu">{t("sohbetler.aramaBosAlt")}</p>
        {/if}
      {:else}
        {#if odaEslesmeleri.length > 0}
          <div class="bolum-baslik"><span>{t("sohbetler.bolumSohbetler")}</span></div>
          {#each odaEslesmeleri as oda (oda.id)}
            <SohbetSatiri {oda} sec={() => { hatirla(); if (oda.alan) alanaGit(); else gezinme.odaAc(oda.id); }} />
          {/each}
        {:else if kapsam !== "hepsi" && kapsam !== "mesajlar"}
          <BosDurum maskot="arama" boyut={96} baslik={t("sohbetler.sonucYok")} />
        {/if}
        {#if kapsam === "hepsi" || kapsam === "mesajlar"}<MesajAramaSonuclari sorgu={yazi} kimden={ayri.kimden} />{/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Transparent list scrim while the New menu is open so clicking a chat row closes the menu without opening the chat. -->
<!-- Yeni menüsü açıkken liste üstünde saydam perde: bir sohbet satırına tıklamak sohbeti açmadan menüyü kapatır. -->
{#if !dock && yeniAcik}
  <button bind:this={yeniPerde} class="yeni-perde" type="button" aria-label={t("dock.yeniKapat")} data-bas="yok" onclick={yeniKapat}></button>
{/if}

<!-- Bottom bar: ONLY the search pill + the round "+" button; a fixed bottom bar (data-alt-cubuk) while visible. -->
<!-- Alt çubuk: YALNIZCA arama hapı + yuvarlak "+" düğmesi; görünürken sabit alt çubuk (data-alt-cubuk). -->
<div class="alt-cubuk" class:gizli class:aramada={aramaModu} class:dockta={dock} inert={dock && !aramaModu} data-alt-cubuk={gizli ? undefined : ""}>
  {#if !dock}
    <div class="yeni-menu-kap" bind:this={menuKap}>
      <YeniMenusu bind:this={yeniMenu} acik={yeniAcik} onkapat={yeniKapat} konum="sol" onsec={gezinme.genis ? undefined : onsec} />
    </div>
  {/if}
  {#if aramaModu}
    <div class="kapsamlar" role="radiogroup" aria-label={t("sohbetler.kapsam")}>
      {#each kapsamlar as k (k.id)}
        <button class="cip-k" class:secili={kapsam === k.id} role="radio" aria-checked={kapsam === k.id} type="button" onmousedown={(e) => e.preventDefault()} onclick={() => { titret("tik"); kapsam = k.id; }}><Ikon ad={kapsam === k.id ? "onay" : k.ikon} boyut={18} />{t(k.ad)}</button>
      {/each}
    </div>
  {/if}
  <form class="arama-hapi" class:odakta={aramaModu} onsubmit={gonder} role="search">
    <button class="ara-simge" type="button" aria-label={aramaModu ? t("sohbetler.aramaKapat") : t("sohbetler.ara")} onclick={aramaModu ? aramaKapat : () => alan?.focus()}>
      <Ikon ad={aramaModu ? "geri" : "ara"} boyut={20} />
    </button>
    <input bind:this={alan} bind:value={ham} type="search" enterkeyhint="search" placeholder={t("sohbetler.aramaYer")} aria-label={t("sohbetler.ara")} onfocus={aramaAc} autocomplete="off" autocapitalize="off" spellcheck="false" />
    {#if ham}
      <button class="temizle" type="button" aria-label={t("eylem.temizle")} onclick={() => { ham = ""; alan?.focus(); }}><Ikon ad="kapat" boyut={18} /></button>
    {/if}
  </form>
  {#if !dock}<span class="fab-yer" class:gizli-fab={aramaModu}>
    <button
      bind:this={yeniDugme}
      class="fab"
      class:acik={yeniAcik}
      type="button"
      aria-label={yeniAcik ? t("dock.yeniKapat") : t("dock.yeni")}
      aria-expanded={yeniAcik}
      aria-haspopup="menu"
      onclick={yeniDegis}
      disabled={aramaModu}
    ><span class="cevir"><Ikon ad="artik" boyut={24} /></span></button>
  </span>{/if}
</div>

<style>
  .hap { flex: none; display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: 0 .875rem; border-radius: 1.25rem; background: var(--yuzey-2); font-size: .875rem; font-weight: 500; color: var(--yazi); }
  .hap.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  /* Search results panel · Arama sonuç paneli */
  .arama-paneli { position: absolute; inset: 0; z-index: 3; background: var(--zemin); display: flex; flex-direction: column; animation: belir var(--sure-orta) var(--egri-ac); }
  @keyframes belir { from { opacity: 0; transform: translate3d(0, 8px, 0); } }
  .panel-kayan { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: calc(env(safe-area-inset-top) + .75rem) 0 8.5rem; }
  h1 { padding: .25rem 1rem .5rem; font-size: 1.75rem; }
  .op-cipleri { display: flex; gap: .5rem; padding: 0 1rem .5rem; }
  .bolum-baslik { display: flex; align-items: center; justify-content: space-between; padding: .75rem 1rem .5rem; font-size: .875rem; font-weight: 600; color: var(--vurgu); }
  .bolum-baslik button { min-height: 2.75rem; padding: 0 .5rem; margin: -.75rem -.5rem; color: var(--vurgu); text-transform: none; letter-spacing: 0; font-size: .8125rem; }
  .kisayollar { display: flex; gap: .25rem; overflow-x: auto; scrollbar-width: none; padding: 0 .625rem .25rem; }
  .kisayol { flex: none; width: 5rem; padding: .375rem .125rem; display: grid; justify-items: center; gap: .375rem; border-radius: 1rem; }
  .k-yuz { position: relative; display: inline-flex; }
  .k-sayi { position: absolute; right: -6px; top: -4px; border: 2px solid var(--zemin); }
  .k-ad { max-width: 100%; font-size: .75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kenarli { margin: 0 .75rem; }
  .ipucu { padding: .75rem 1rem; font-size: .875rem; line-height: 1.5; color: var(--yazi-2); }
  .son { position: relative; overflow: hidden; width: 100%; min-height: 3.5rem; padding: 0 1rem; display: flex; align-items: center; gap: 1rem; text-align: left; color: var(--yazi); }
  .son span { min-width: 0; overflow-wrap: anywhere; }
  .son :global(svg) { color: var(--yazi-2); }

  /* Bottom bar: pill (flexible) + FAB. Scrolling down slides it away with a spring. · Alt çubuk: hap (esnek) + FAB. Aşağı kaydırmak yayla uzaklaştırır. */
  .alt-cubuk { position: absolute; z-index: 4; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem calc(.75rem + env(safe-area-inset-bottom)); pointer-events: none; transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-cikis) linear; }
  .alt-cubuk.aramada { flex-wrap: wrap; row-gap: .5rem; }
  .kapsamlar { pointer-events: auto; flex: 0 0 calc(100% + 1.5rem); margin: 0 -.75rem; padding: 0 .75rem; box-sizing: border-box; display: flex; gap: .5rem; overflow-x: auto; scrollbar-width: none; animation: belir var(--sure-orta) var(--egri-ac); }
  .cip-k { flex: none; min-height: 2.75rem; padding: 0 1rem 0 .75rem; display: inline-flex; align-items: center; gap: .5rem; border-radius: .875rem; background: var(--yuzey-3); color: var(--yazi-2); font-size: .875rem; font-weight: 500; }
  .cip-k.secili { background: var(--ton); color: var(--ton-ustu); border-radius: 1.375rem; }
  .alt-cubuk.gizli { transform: translate3d(0, calc(100% + 1rem), 0); opacity: 0; }
  .alt-cubuk.gizli > * { pointer-events: none; }
  .yeni-perde { position: absolute; inset: 0; z-index: 3; background: transparent; }
  .yeni-menu-kap { display: contents; }
  .fab { width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); box-shadow: var(--kat-2); transition: opacity var(--sure-hizli) var(--egri-cikis); }
  .fab:active { opacity: .82; }
  .cevir { display: inline-flex; transition: transform var(--sure-orta) var(--egri-ac); }
  .fab.acik .cevir { transform: rotate(135deg); }
  .arama-hapi { background: var(--yuzey-3); box-shadow: var(--kat-2); pointer-events: auto; flex: 1; min-width: 0; min-height: 3rem; display: flex; align-items: center; border-radius: 1.5rem; overflow: hidden; view-transition-name: arama-hapi; }
  .ara-simge { flex: none; width: 3rem; min-height: 3rem; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .arama-hapi input { flex: 1; min-width: 0; min-height: 3rem; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; text-overflow: ellipsis; }
  .arama-hapi input::placeholder { color: var(--yazi-2); }
  .temizle { flex: none; width: 2.75rem; height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  /* The FAB scales away via transform + opacity only (no per-frame margin animation). · Arama sırasında FAB yalnızca transform + opacity ile kaybolur (kare başına margin animasyonu yok). */
  .fab-yer { pointer-events: auto; flex: none; display: inline-flex; transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-cikis) linear; }
  .fab-yer.gizli-fab { transform: scale(.3); opacity: 0; margin-left: -3.75rem; pointer-events: none; }
  /* Phone: the field grows out of the dock (same place, same corners) · Telefon: alan dock'un içinden büyür (aynı yer, aynı köşeler) */
  .alt-cubuk.dockta.gizli { transform: scale(.94, 1.15); opacity: 0; transform-origin: 50% 100%; }
  .alt-cubuk.dockta .arama-hapi { min-height: 3.5rem; border-radius: 2rem; }
  .alt-cubuk.dockta .ara-simge, .alt-cubuk.dockta .arama-hapi input { min-height: 3.5rem; }
  .aramada { background: linear-gradient(to top, var(--zemin) 60%, transparent); }

</style>
