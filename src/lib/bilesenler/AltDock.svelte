<!--
  Phone dock (Figma 24 · B, from rubyyard's bottom menu): a floating bar with Sohbetler · Alanlar · Yeni · Ara · Profil.
   - The crystal-cut indicator follows the FINGER while the pages are swiped (kabuk.ilerleme), it does not jump after the fact.
   - Scrolling down shrinks it to icons (72 → 56px), it never disappears. A running call is its upper storey.
   - "Yeni" opens four actions above the dock and turns into ✕; "Ara" turns the dock into the search field (SohbetAramasi).
   - Tapping the page you are on scrolls it to the top; long press = quick actions.
  Telefon dock'u (Figma 24 · B, rubyyard alt menüsünden): Sohbetler · Alanlar · Yeni · Ara · Profil taşıyan yüzen çubuk.
   - Kristal kesimli gösterge sayfalar kaydırılırken PARMAĞI izler (kabuk.ilerleme), sonradan zıplamaz.
   - Aşağı kaydırmak onu simgelere küçültür (72 → 56px), hiç kaybolmaz. Süren arama onun üst katıdır.
   - "Yeni" dock'un üstünde dört eylem açar ve ✕ olur; "Ara" dock'u arama alanına çevirir (SohbetAramasi).
   - Bulunduğun sayfaya dokunmak başa kaydırır; uzun basmak = hızlı eylemler.
-->
<script lang="ts">
  import { ec } from "../arama-ec/ec.svelte";
  import EcCubuk from "../arama-ec/EcCubuk.svelte";
  import { titret, uzunBasma } from "../dokunma";
  import { arama } from "../durum/arama.svelte";
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { kabuk } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import AltigenDugme from "./AltigenDugme.svelte";
  import AramaCubugu from "./AramaCubugu.svelte";
  import Avatar from "./Avatar.svelte";
  import BaglamMenusu, { type MenuEylemi } from "./BaglamMenusu.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import OdaOlustur from "./OdaOlustur.svelte";
  import YeniSohbet from "./YeniSohbet.svelte";

  let { gizli }: { gizli: boolean } = $props();

  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
  const aramaVar = $derived((ec.etkin && !ec.ekranAcik) || (arama.etkin && !arama.ekranAcik));
  const kompakt = $derived(kabuk.altGizli);

  // Page position (0..2) → dock column (0, 1, 4): between Alanlar and Profil the indicator glides past Yeni and Ara.
  // Sayfa konumu (0..2) → dock sütunu (0, 1, 4): Alanlar ile Profil arasında gösterge Yeni ve Ara'nın altından süzülür.
  const SUTUN = [0, 1, 4];
  const sutun = $derived.by(() => {
    const f = Math.max(0, Math.min(2, kabuk.ilerleme));
    const i = Math.floor(f);
    return SUTUN[i] + ((SUTUN[i + 1] ?? SUTUN[i]) - SUTUN[i]) * (f - i);
  });
  const yakin = $derived<Sekme>((["sohbetler", "alanlar", "ben"] as const)[Math.max(0, Math.min(2, Math.round(kabuk.ilerleme)))]);

  function dokun(s: Sekme) {
    kabuk.altGizli = false;
    yeniKapat();
    if (gezinme.sekme !== s) {
      titret(6);
      gezinme.sekmeSec(s);
      return;
    }
    // Already here: every visible list of this page goes to its top. · Zaten buradayız: bu sayfanın görünen listeleri başa gider.
    const yumusak = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hareket")) > 0;
    for (const l of document.querySelectorAll<HTMLElement>(".ekran .yaprak:not([inert]) .liste, .ekran .yaprak:not([inert]) .icerik")) {
      if (l.scrollTop > 0) l.scrollTo({ top: 0, behavior: yumusak ? "smooth" : "instant" });
    }
  }

  // ---- "Yeni" menu: a layer, so back closes it · "Yeni" menüsü: katman, geri tuşu kapatır ----
  let yeniAcik = $state(false);
  let katman = 0;
  let sayfa = $state<"kisi" | "grup" | "alan" | "katil" | null>(null);
  const eylemler: { id: "kisi" | "grup" | "alan" | "katil"; ikon: IkonAdi }[] = [
    { id: "kisi", ikon: "kisi" },
    { id: "grup", ikon: "sohbet" },
    { id: "alan", ikon: "izgara" },
    { id: "katil", ikon: "ara" },
  ];
  function yeniDegis() {
    if (yeniAcik) return yeniKapat();
    titret(8);
    kabuk.altGizli = false;
    yeniAcik = true;
    katman = gezinme.katmanAc(() => {
      katman = 0;
      yeniAcik = false;
    });
  }
  function yeniKapat() {
    if (katman) gezinme.katmanKapat(katman);
  }
  function sec(id: typeof sayfa) {
    yeniKapat();
    sayfa = id;
  }

  // ---- Long press · Uzun basma ----
  let menu = $state<{ x: number; y: number; eylemler: MenuEylemi[] } | null>(null);
  function profilHizli(x: number, y: number) {
    menu = {
      x, y,
      eylemler: [
        { ikon: "palet", etiket: t("gorunum.baslik"), calistir: () => gezinme.benAltAc("gorunum") },
        { ikon: "kalkan", etiket: t("guvenlik.baslik"), calistir: () => gezinme.benAltAc("guvenlik") },
        { ikon: "zil", etiket: t("ayar.bildirimler"), calistir: () => gezinme.benAltAc("bildirimler") },
      ],
    };
  }
</script>

{#if yeniAcik}<button class="perde" aria-label={t("dock.yeniKapat")} data-bas="yok" onclick={yeniKapat}></button>{/if}

<div class="kap" class:gizli inert={gizli} data-alt-cubuk={gizli ? undefined : ""}>
  {#if yeniAcik}
    <div class="yeni-menu" role="menu" aria-label={t("dock.yeni")}>
      {#each eylemler as e, i (e.id)}
        <button role="menuitem" style:--i={i} onclick={() => sec(e.id)}><Ikon ad={e.ikon} boyut={24} /><span>{t(`dock.${e.id}`)}</span></button>
      {/each}
    </div>
  {/if}

  <div class="govde">
    {#if aramaVar && !gizli}<div class="kat"><AramaCubugu /><EcCubuk /></div>{/if}
    <nav class="dock" class:kompakt aria-label={t("gezinme.baslik")}>
      <span class="iz" aria-hidden="true"><span class="gosterge" style:transform="translate3d({sutun * 100}%,0,0)"><svg viewBox="0 0 56 32"><path d="M13 0h30q2 0 3 1.700l9 12.600q1 1.700 0 3.400l-9 12.600q-1 1.700-3 1.700H13q-2 0-3-1.700L1 17.700q-1-1.700 0-3.400L10 1.700Q11 0 13 0Z" /></svg></span></span>

      <button class="oge" class:aktif={yakin === "sohbetler"} aria-current={gezinme.sekme === "sohbetler" ? "page" : undefined} onclick={() => dokun("sohbetler")}>
        <span class="simge"><Ikon ad="sohbet" boyut={24} dolu={yakin === "sohbetler"} />
          {#if odalar.okunmamisOda > 0}{#key odalar.okunmamisOda}<span class="sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/key}{/if}
        </span>
        <span class="etiket">{t("gezinme.sohbetler")}</span>
      </button>

      <button class="oge" class:aktif={yakin === "alanlar"} aria-current={gezinme.sekme === "alanlar" ? "page" : undefined} onclick={() => dokun("alanlar")}>
        <span class="simge"><Ikon ad="izgara" boyut={24} dolu={yakin === "alanlar"} /></span>
        <span class="etiket">{t("gezinme.alanlar")}</span>
      </button>

      <div class="oge yeni" class:acik={yeniAcik}>
        <span class="alti"><AltigenDugme etiket={yeniAcik ? t("dock.yeniKapat") : t("dock.yeni")} boyut={3.25} onclick={yeniDegis}><span class="cevir">{#if yeniAcik}<Ikon ad="kapat" boyut={22} />{:else}<Ikon ad="kalem" boyut={22} dolu />{/if}</span></AltigenDugme></span>
        <span class="etiket" aria-hidden="true">{t("dock.yeni")}</span>
      </div>

      <button class="oge" onclick={() => { yeniKapat(); kabuk.aramaAc?.(); }}>
        <span class="simge"><Ikon ad="ara" boyut={24} /></span>
        <span class="etiket">{t("dock.ara")}</span>
      </button>

      <button class="oge" class:aktif={yakin === "ben"} aria-current={gezinme.sekme === "ben" ? "page" : undefined} onclick={() => dokun("ben")} use:uzunBasma={{ ac: profilHizli }}>
        <span class="simge"><span class="yuz"><Avatar {harf} boyut={26} mxc={oturum.profil?.avatarMxc ?? null} yaricap={9} /></span>
          {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
        </span>
        <span class="etiket">{t("profil.baslik")}</span>
      </button>
    </nav>
  </div>
</div>

{#if menu}<BaglamMenusu x={menu.x} y={menu.y} eylemler={menu.eylemler} onkapat={() => (menu = null)} />{/if}
{#if sayfa === "kisi"}<YeniSohbet onkapat={() => (sayfa = null)} />{:else if sayfa}<OdaOlustur tur={sayfa} onkapat={() => (sayfa = null)} />{/if}

<style>
  .perde { position: absolute; inset: 0; z-index: 5; background: rgb(0 0 0 / .5); animation: sol var(--sure-orta) var(--egri-cikis); }
  @keyframes sol { from { opacity: 0; } }
  .kap { position: absolute; z-index: 6; left: 0; right: 0; bottom: 0; padding: 0 12px calc(12px + env(safe-area-inset-bottom)); pointer-events: none; transition: transform var(--sure-orta) var(--egri-cikis), opacity var(--sure-orta) var(--egri-cikis); }
  .kap > * { pointer-events: auto; }
  .kap.gizli { opacity: 0; transform: translate3d(0, 8px, 0) scale(.96); }
  .kap.gizli > * { pointer-events: none; }
  .govde { position: relative; border-radius: 24px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); }
  /* The upper storey (running call) shares the dock's outline · Üst kat (süren arama) dock'un çizgisini paylaşır */
  .kat { overflow: hidden; border-radius: 23px 23px 0 0; }
  .kat :global(.cubuk) { padding-top: 0; min-height: 52px; background: var(--yuzey-2); color: var(--yazi); }
  .kat :global(.cubuk > svg), .kat :global(.don > svg) { color: var(--cozum); }
  .kat :global(.kapat) { color: var(--hata); }
  .dock { position: relative; height: 72px; padding: 0 6px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); transition: height var(--sure-yavas) var(--egri-cikis); }
  .dock.kompakt { height: 56px; }
  .iz { position: absolute; inset: 0 6px; pointer-events: none; }
  .gosterge { position: absolute; left: 0; top: 11px; width: 20%; height: 32px; display: flex; justify-content: center; will-change: transform; }
  .gosterge svg { width: 56px; height: 32px; fill: var(--ton); }
  .oge { position: relative; min-width: 0; padding-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--yazi-2); border-radius: 18px; transition: color var(--sure-orta) var(--egri-cikis); }
  .simge { position: relative; display: inline-flex; height: 24px; align-items: center; transition: transform var(--sure-yay, 460ms) var(--egri-yay-capkin, ease-out); }
  /* The dock keeps its px geometry (five columns must fit 320px); only its labels follow the text size, up to the column width. */
  /* Dock px ölçüsünü korur (beş sütun 320px'e sığmalı); yalnızca etiketleri yazı boyutunu, sütun genişliğine kadar izler. */
  .simge :global(svg), .alti :global(.ic svg) { width: 24px !important; height: 24px !important; }
  .alti :global(.altigen-dugme) { width: 52px !important; height: 52px !important; }
  .yuz :global(.avatar) { width: 26px !important; height: 26px !important; font-size: 11px !important; }
  .sayac { font-size: 11px !important; }
  .aktif { color: var(--yazi); }
  .aktif .simge { color: var(--ton-ustu); transform: scale(1.06); }
  .oge:active .simge { transform: scale(.88); }
  .etiket { max-width: 100%; font-size: min(.75rem, 3.75vw, 14px); line-height: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity var(--sure-hizli) var(--egri-cikis); }
  .aktif .etiket { font-weight: 600; }
  .kompakt .etiket { opacity: 0; }
  .yeni { padding-top: 0; }
  .alti { position: absolute; top: -8px; transition: transform var(--sure-yavas) var(--egri-cikis); }
  .kompakt .alti { transform: translateY(10px) scale(.88); }
  .yeni .etiket { position: absolute; top: 49px; }
  .cevir { display: inline-flex; transition: transform var(--sure-yay, 460ms) var(--egri-yay-capkin, ease-out); }
  .acik .cevir { transform: rotate(180deg); }
  .sayac { position: absolute; left: 13px; top: -8px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; border: 2px solid var(--yuzey-1); display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); font-size: .6875rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; animation: pop var(--sure-pop) var(--egri-yay-capkin, ease-out); }
  @keyframes pop { from { transform: scale(.4); } }
  .yuz { display: inline-flex; border-radius: 11px; box-shadow: 0 0 0 2px transparent; transition: box-shadow var(--sure-orta) var(--egri-cikis); }
  .aktif .yuz { box-shadow: 0 0 0 2px var(--vurgu); }
  .nokta { position: absolute; right: -4px; top: -3px; width: 8px; height: 8px; border-radius: 4px; background: var(--bekliyor); border: 2px solid var(--yuzey-1); }
  .yeni-menu { position: absolute; left: 50%; bottom: calc(100% - 2px + 8px); width: min(16rem, calc(100vw - 48px)); margin-left: calc(min(16rem, 100vw - 48px) / -2); padding: 8px; border-radius: 20px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); display: grid; transform-origin: 50% 100%; animation: buyu var(--sure-yavas) var(--egri-yay-yumusak, ease-out); }
  @keyframes buyu { from { opacity: 0; transform: translateY(16px) scale(.7); } }
  .yeni-menu button { min-height: 52px; padding: 0 12px; display: flex; align-items: center; gap: 14px; border-radius: 14px; text-align: left; font-weight: 500; animation: gel var(--sure-yavas) var(--egri-cikis) backwards; animation-delay: calc(var(--i) * 30ms * var(--hareket)); }
  .yeni-menu span { min-width: 0; overflow-wrap: anywhere; }
  @keyframes gel { from { opacity: 0; transform: translateY(8px); } }
</style>
