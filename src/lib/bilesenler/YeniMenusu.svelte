<!--
  Shared "+" New menu used by the phone dock, the list bottom bar and the compact strip (Figma 18:1820).
  Groups creation actions (New chat, Create group, Create space) and join actions (Explore rooms, Join by address, Requests with pending count).
  Uses the shared .acilir / .acilir-satir popover styles. Callers inside an isolated stacking context can pass `onsec` to render sheets outside it.
  Telefon dock'u, liste altı ve kompakt şerit tarafından paylaşılan "+" Yeni menüsü (Figma 18:1820).
  Oluşturma (Yeni sohbet, Grup oluştur, Alan oluştur) ve katılma (Odaları keşfet, Adresle katıl, bekleyen sayılı İstekler) eylemlerini toplar.
  Ortak .acilir / .acilir-satir açılır kart stillerini kullanır. Yalıtılmış yığın bağlamındaki çağıranlar sayfaları dışarıda çizmek için `onsec` verebilir.
-->
<script lang="ts" module>
  export type YeniSayfa = "kisi" | "grup" | "alan" | "katil" | "kesfet";
</script>

<script lang="ts">
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import { t, type Anahtar } from "../i18n";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import OdaKesfet from "./OdaKesfet.svelte";
  import OdaOlustur from "./OdaOlustur.svelte";
  import YeniSohbet from "./YeniSohbet.svelte";

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

  const olusturEylemleri: { id: "kisi" | "grup" | "alan"; ikon: IkonAdi; etiket: Anahtar }[] = [
    { id: "kisi", ikon: "kisi", etiket: "sohbetler.yeniSohbet" },
    { id: "grup", ikon: "sohbet", etiket: "dock.grup" },
    { id: "alan", ikon: "izgara", etiket: "dock.alan" },
  ];

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

<div
  class="yeni-menu acilir"
  class:orta={konum === "orta"}
  class:sol={konum === "sol"}
  class:sag={konum === "sag"}
  class:acik
  inert={!acik}
  role="menu"
  aria-label={t("dock.yeni")}
>
  <div class="bolum" role="presentation">{t("yeniMenu.olustur")}</div>
  {#each olusturEylemleri as e (e.id)}
    <button class="acilir-satir" type="button" role="menuitem" onclick={() => ac(e.id)}>
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
  <button class="acilir-satir" type="button" role="menuitem" onclick={() => ac("katil")}>
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

{#if sayfa === "kisi"}
  <YeniSohbet onkapat={() => (sayfa = null)} />
{:else if sayfa === "kesfet"}
  <OdaKesfet onkapat={() => (sayfa = null)} />
{:else if sayfa}
  <OdaOlustur tur={sayfa} onkapat={() => (sayfa = null)} />
{/if}

<style>
  .yeni-menu {
    position: absolute;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
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
  /* List bottom bar (wide desktop & landscape phone): left edge aligns with the list column, sits above the "+" button. */
  /* Liste altı (geniş masaüstü ve yatay telefon): sol kenar liste sütunuyla hizalı, "+" düğmesinin üstünde açılır. */
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
    max-height: calc(var(--gorunen-yukseklik, 100vh) - 24px);
    transform-origin: 0% 0%;
    z-index: 6;
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
    .yeni-menu :global(.acilir-satir:hover) {
      background: var(--yuzey-2);
    }
  }
</style>
