<!--
  Shared "+" New menu used by the phone dock, the list bottom bar and the compact strip (Figma 18:1820).
  Groups creation actions (New chat, Create group, Create space) and join actions (Explore rooms, Join by address, Requests with pending count).
  On wide screens and compact desktop the card morphs in place into the chosen form; on portrait and landscape phones it opens AltSayfa sheets.
  Telefon dock'u, liste altı ve kompakt şerit tarafından paylaşılan "+" Yeni menüsü (Figma 18:1820).
  Oluşturma (Yeni sohbet, Grup oluştur, Alan oluştur) ve katılma (Odaları keşfet, Adresle katıl, bekleyen sayılı İstekler) eylemlerini toplar.
  Geniş ekranda ve kompakt masaüstünde kart yerinde seçilen forma dönüşür; dikey ve yatay telefonda AltSayfa sayfaları açılır.
-->
<script lang="ts" module>
  export type YeniSayfa = "kisi" | "grup" | "alan" | "katil" | "kesfet";
</script>

<script lang="ts">
  import { tick } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import { egri, sureMs } from "../hareket";
  import { t, type Anahtar } from "../i18n";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import OdaKesfet from "./OdaKesfet.svelte";
  import OdaOlustur from "./OdaOlustur.svelte";
  import YeniSohbet from "./YeniSohbet.svelte";

  type Asama = "menu" | "kisi" | "grup" | "alan" | "adres";

  let {
    acik,
    onkapat,
    konum = "orta",
    onsec,
  }: {
    acik: boolean;
    onkapat: () => void;
    /** Placement relative to its container: "orta" (above phone dock), "sol" (above list bottom bar, left-aligned with list column), "sag" (beside compact strip) · Kaba göre yerleşim: "orta" (telefon dock üstü), "sol" (liste altı üstü, liste sütununa sol hizalı), "sag" (kompakt şeridin sağında) */
    konum?: "orta" | "sol" | "sag";
    /** Optional handler so callers inside an isolated stacking context can mount sheets at their outer level · Yalıtılmış yığın bağlamındaki çağıranların sayfaları dış katmanda açabilmesi için isteğe bağlı işleyici */
    onsec?: (sayfa: YeniSayfa) => void;
  } = $props();

  let sayfa = $state<YeniSayfa | null>(null);
  let asama = $state<Asama>("menu");
  /** Slide direction: 1 = menu → form, -1 = form → menu · Kayma yönü: 1 = menü → form, -1 = form → menü */
  let yon = $state<1 | -1>(1);
  let sonSecim = $state<Exclude<Asama, "menu"> | null>(null);

  let capaEl: HTMLSpanElement | undefined = $state();
  let kartEl: HTMLDivElement | undefined = $state();
  let sahneEl: HTMLDivElement | undefined = $state();
  let capa = $state<{ sol: number; alt: number; menuEn: number; maxYukseklik: number } | null>(null);

  // Morph inline only on wide desktop (including compact strip); portrait and landscape phones keep bottom sheets.
  // Yalnızca geniş masaüstünde (kompakt şerit dahil) yerinde forma dönüş; dikey ve yatay telefonda alt sayfalar kalır.
  const gomuluMod = $derived(gezinme.genis && konum !== "orta");
  const formda = $derived(gomuluMod && asama !== "menu");
  // Portal the list-bar card to document.body on wide desktop so the 400px form is never clipped by the list column or buried under the room column.
  // Geniş masaüstünde liste altı kartını document.body'ye taşı; 400px form liste sütununca kırpılmasın ve oda sütununun altında kalmasın.
  const portalli = $derived(gezinme.genis && konum === "sol");

  const olusturEylemleri: { id: "kisi" | "grup" | "alan"; ikon: IkonAdi; etiket: Anahtar }[] = [
    { id: "kisi", ikon: "kisi", etiket: "sohbetler.yeniSohbet" },
    { id: "grup", ikon: "sohbet", etiket: "dock.grup" },
    { id: "alan", ikon: "izgara", etiket: "dock.alan" },
  ];

  const formBaslik = $derived.by(() => {
    switch (asama) {
      case "kisi":
        return t("yeniSohbet.baslik");
      case "grup":
        return t("dock.grup");
      case "alan":
        return t("dock.alan");
      case "adres":
        return t("yeniMenu.adresleKatil");
      default:
        return t("dock.yeni");
    }
  });

  // Always start on the menu when reopened; wait for the close fade before unmounting the active form so it does not flash back to the menu.
  // Yeniden açıldığında hep menüden başla; kapanış solması bitene dek etkin formu kaldırma ki kapanırken menüye zıplamasın.
  let oncekiAcik = false;
  $effect(() => {
    if (acik && !oncekiAcik) {
      asama = "menu";
      yon = 1;
      sonSecim = null;
    }
    oncekiAcik = acik;
  });

  $effect(() => {
    if (acik || asama === "menu") return;
    const ms = sureMs("--sure-cikis");
    if (ms <= 0) {
      asama = "menu";
      return;
    }
    const z = setTimeout(() => {
      asama = "menu";
    }, ms);
    return () => clearTimeout(z);
  });

  $effect(() => {
    if (!gomuluMod && asama !== "menu") asama = "menu";
  });

  function capaOlc() {
    if (!capaEl) return;
    const r = capaEl.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const kok = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const kenar = kok * 0.75;
    capa = {
      sol: Math.max(8, Math.round(r.left + kenar)),
      alt: Math.max(8, Math.round(window.innerHeight - r.top + 2)),
      menuEn: Math.max(200, Math.round(r.width - kenar * 2)),
      maxYukseklik: Math.max(180, Math.round(r.top - 16)),
    };
  }

  $effect(() => {
    if (!portalli) {
      capa = null;
      return;
    }
    if (!capaEl) return;
    capaOlc();
    if (!acik) return;
    const ro = new ResizeObserver(capaOlc);
    ro.observe(capaEl);
    window.addEventListener("resize", capaOlc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", capaOlc);
    };
  });

  /**
   * Move the popover element to document.body while `etkin` is true so it escapes ancestor overflow/stacking contexts, restoring it on toggle or unmount.
   * `etkin` doğruyken açılır kartı üst kırpma/yığın bağlamlarından kurtarmak için document.body'ye taşır; değişimde ya da sökümde geri alır.
   */
  function portal(node: HTMLElement, etkin: boolean) {
    let yer: Comment | null = null;
    const uygula = (ac: boolean) => {
      if (ac && !yer && node.parentNode) {
        yer = document.createComment("yeni-menu-yer");
        node.parentNode.insertBefore(yer, node);
        document.body.appendChild(node);
      } else if (!ac && yer) {
        yer.parentNode?.insertBefore(node, yer);
        yer.remove();
        yer = null;
      }
    };
    uygula(etkin);
    return {
      update(yeni: boolean) {
        uygula(yeni);
      },
      destroy() {
        yer?.remove();
        yer = null;
        if (node.parentNode === document.body) node.remove();
      },
    };
  }

  /**
   * Run a compositor-only WAAPI animation and drop `will-change` as soon as it finishes so idle cards hold no GPU layers.
   * Yalnızca birleştiricide çalışan WAAPI animasyonu oynatır ve bitince `will-change`i kaldırarak boşta GPU katmanı tutmaz.
   */
  function oynat(node: Element, kareler: Keyframe[], secenek: KeyframeAnimationOptions) {
    const el = node as HTMLElement;
    el.style.willChange = "transform, opacity";
    const temizle = () => {
      if (el.style.willChange === "transform, opacity") el.style.removeProperty("will-change");
    };
    const a = node.animate(kareler, secenek);
    a.onfinish = temizle;
    a.oncancel = temizle;
  }

  function icerikGir(node: Element) {
    const sure = acik ? sureMs("--sure-orta") : 0;
    if (sure > 0) {
      const dx = yon > 0 ? "28px" : "-28px";
      oynat(
        node,
        [
          { transform: `translate3d(${dx}, 0, 0)`, opacity: 0 },
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
        ],
        { duration: sure, easing: egri("--egri-ac"), fill: "backwards" },
      );
    }
    return { duration: sure };
  }

  function icerikCik(node: Element) {
    const sure = acik ? sureMs("--sure-orta") : 0;
    if (sure > 0) {
      const el = node as HTMLElement;
      el.dataset.cikan = "";
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.pointerEvents = "none";
      const dx = yon > 0 ? "-28px" : "28px";
      oynat(
        node,
        [
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
          { transform: `translate3d(${dx}, 0, 0)`, opacity: 0 },
        ],
        { duration: sure, easing: egri("--egri-ac"), fill: "forwards" },
      );
    }
    return { duration: sure };
  }

  async function ilkAlanaOdakla() {
    await tick();
    if (!acik || !formda) return;
    sahneEl?.querySelector<HTMLElement>(".gorunum:not([data-cikan]) input")?.focus({ preventScroll: true });
  }

  async function sonOgeyeOdakla() {
    await tick();
    if (!acik || formda || !sonSecim) return;
    sahneEl?.querySelector<HTMLButtonElement>(`.gorunum:not([data-cikan]) [data-menu-id="${sonSecim}"]`)?.focus({ preventScroll: true });
  }

  function asamaAc(hedef: Exclude<Asama, "menu">) {
    sonSecim = hedef;
    yon = 1;
    asama = hedef;
    void ilkAlanaOdakla();
  }

  function menuyeDon() {
    if (asama === "menu") return;
    yon = -1;
    asama = "menu";
    void sonOgeyeOdakla();
  }

  /** Step back from a form to the menu on Escape/back; return false when already on the menu so the caller closes the card. · Escape/geri tuşunda formdan menüye döner; zaten menüdeyken false döner ve çağıran kartı kapatır. */
  export function geriAl(): boolean {
    if (!formda) return false;
    menuyeDon();
    return true;
  }

  /** Report whether a DOM node is inside this popover card (used by outside-click handlers when portaled). · Bir DOM düğümünün bu kartın içinde olup olmadığını bildirir (portal açıkken dış tıklama denetimi için). */
  export function icinde(hedef: Node | null): boolean {
    return !!hedef && !!kartEl?.contains(hedef);
  }

  function sec(id: Exclude<Asama, "menu">) {
    if (gomuluMod) {
      asamaAc(id);
      return;
    }
    ac(id === "adres" ? "katil" : id);
  }

  function ac(id: YeniSayfa) {
    onkapat();
    // On wide desktop and landscape phone Explore is a dedicated rail tab; portrait phone opens the modal sheet.
    // Geniş masaüstü ve yatay telefonda Keşfet ayrı bir ray sekmesidir; dikey telefonda pencere açılır.
    if (id === "kesfet" && gezinme.sekil !== "telefon") {
      gezinme.sekmeSec("kesfet");
      return;
    }
    if (onsec) onsec(id);
    else sayfa = id;
  }

  function istekleriAc() {
    onkapat();
    istekler.ac();
  }
</script>

{#if konum === "sol"}
  <span class="capa-iz" bind:this={capaEl} aria-hidden="true"></span>
{/if}

<div
  bind:this={kartEl}
  use:portal={portalli}
  class="yeni-menu acilir"
  class:orta={konum === "orta"}
  class:sol={konum === "sol" && !portalli}
  class:portalli
  class:sag={konum === "sag"}
  class:formda
  class:acik
  style:left={portalli && capa ? `${capa.sol}px` : undefined}
  style:bottom={portalli && capa ? `${capa.alt}px` : undefined}
  style:width={portalli && capa ? (formda ? `min(400px, calc(100vw - ${capa.sol}px - 12px))` : `${capa.menuEn}px`) : undefined}
  style:max-height={portalli && capa ? `${capa.maxYukseklik}px` : undefined}
  style:transform-origin={portalli && capa ? `${Math.max(24, capa.menuEn - 24)}px 100%` : undefined}
  inert={!acik}
  role={formda ? "dialog" : "menu"}
  aria-label={formda ? formBaslik : t("dock.yeni")}
>
  <div class="sahne" bind:this={sahneEl}>
    {#key asama}
      <div class="gorunum" in:icerikGir out:icerikCik>
        {#if !formda}
          <div class="menu-govde">
            <div class="bolum" role="presentation">{t("yeniMenu.olustur")}</div>
            {#each olusturEylemleri as e (e.id)}
              <button class="acilir-satir" type="button" role="menuitem" data-menu-id={e.id} onclick={() => sec(e.id)}>
                <Ikon ad={e.ikon} boyut={22} />
                <span class="etiket">{t(e.etiket)}</span>
              </button>
            {/each}

            <div class="ayrac" role="separator"></div>

            <div class="bolum" role="presentation">{t("yeniMenu.katil")}</div>
            <button class="acilir-satir" type="button" role="menuitem" onclick={() => ac("kesfet")}>
              <Ikon ad="pusula" boyut={22} />
              <span class="etiket">{t("dock.kesfet")}</span>
            </button>
            <button class="acilir-satir" type="button" role="menuitem" data-menu-id="adres" onclick={() => sec("adres")}>
              <Ikon ad="baglanti" boyut={22} />
              <span class="etiket">{t("yeniMenu.adresleKatil")}</span>
            </button>
            <button class="acilir-satir" type="button" role="menuitem" onclick={istekleriAc}>
              <Ikon ad="zil" boyut={22} />
              <span class="etiket">{t("istek.baslik")}</span>
              {#if istekler.bekleyen > 0}
                <span class="rozet">{istekler.bekleyen}</span>
              {/if}
            </button>
          </div>
        {:else}
          <header class="form-ust">
            <button class="simge-dugme" type="button" aria-label={t("yeniMenu.geri")} onclick={menuyeDon}>
              <Ikon ad="geri" boyut={20} />
            </button>
            <h2>{formBaslik}</h2>
            <button class="simge-dugme" type="button" aria-label={t("eylem.kapat")} onclick={onkapat}>
              <Ikon ad="kapat" boyut={20} />
            </button>
          </header>
          <div class="form-govde">
            {#if asama === "kisi"}
              <YeniSohbet gomulu {onkapat} />
            {:else if asama === "grup" || asama === "alan" || asama === "adres"}
              <OdaOlustur tur={asama === "adres" ? "katil" : asama} gomulu {onkapat} />
            {/if}
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>

{#if sayfa === "kisi"}
  <YeniSohbet onkapat={() => (sayfa = null)} />
{:else if sayfa === "kesfet"}
  <OdaKesfet onkapat={() => (sayfa = null)} />
{:else if sayfa}
  <OdaOlustur tur={sayfa} onkapat={() => (sayfa = null)} />
{/if}

<style>
  .capa-iz {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .yeni-menu {
    position: absolute;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .yeni-menu.portalli {
    position: fixed;
    z-index: 25;
  }
  /* Phone dock: centred above the dock · Telefon dock'u: dock'un üstünde ortalı */
  .yeni-menu.orta {
    left: 50%;
    bottom: calc(100% + 6px);
    width: min(16rem, calc(100vw - 48px));
    margin-left: calc(min(16rem, 100vw - 48px) / -2);
    max-height: calc(var(--gorunen-yukseklik, 100vh) - 140px);
    transform-origin: 50% 100%;
  }
  /* List bottom bar (landscape phone): left edge aligns with the list column, sits above the "+" button. */
  /* Liste altı (yatay telefon): sol kenar liste sütunuyla hizalı, "+" düğmesinin üstünde açılır. */
  .yeni-menu.sol {
    left: .75rem;
    right: .75rem;
    bottom: calc(100% + 2px);
    max-height: calc(var(--gorunen-yukseklik, 100vh) - 88px);
    transform-origin: calc(100% - 24px) 100%;
    z-index: 6;
  }
  /* Compact strip: opens to the right of the strip · Kompakt şerit: şeridin sağında açılır */
  .yeni-menu.sag {
    left: calc(100% + 8px);
    top: 0;
    width: min(16.5rem, calc(100vw - 96px));
    max-height: calc(var(--gorunen-yukseklik, 100vh) - var(--ust, 64px) - 12px);
    transform-origin: 0% 0%;
    z-index: 6;
  }
  .yeni-menu.sag.formda {
    width: min(400px, calc(100vw - var(--serit-en, 76px) - 20px));
  }
  .sahne {
    position: relative;
    flex: 0 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .gorunum {
    flex: 0 1 auto;
    min-height: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  .menu-govde {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
  }
  .form-ust {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 4px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .form-ust h2 {
    flex: 1;
    min-width: 0;
    font-size: 1.0625rem;
    line-height: 1.3;
    font-weight: 600;
    color: var(--yazi);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .form-govde {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 16px 16px;
  }
  .bolum {
    padding: .375rem .875rem .125rem;
    font-size: .6875rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--yazi-2);
    white-space: nowrap;
  }
  .ayrac {
    height: 1px;
    margin: .25rem .5rem;
    background: var(--kenar-ince);
  }
  .etiket {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (hover: hover) {
    .yeni-menu :global(.acilir-satir:hover),
    .yeni-menu .form-ust :global(.simge-dugme:hover) {
      background: var(--yuzey-2);
    }
  }
  .yeni-menu .form-ust :global(.simge-dugme:active) {
    background: var(--yuzey-2);
  }
</style>
