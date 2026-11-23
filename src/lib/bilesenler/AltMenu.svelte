<!--
  Phone dock (portrait phones only): a FLOATING pill (12px margins, 28px radius, elevated, blurred translucent surface) with Sohbetler /
  Alanlar / Ben. The active tab has an indicator that SLIDES between tabs (transform only). Unread badge on Sohbetler. It hides when the
  list is scrolled down and returns on scroll up, together with the chat-list search pill (kabuk.altGizli). Long press a tab = quick actions.
  Hidden on tablets and landscape phones (the rail does that job: no duplicated navigation) and inside a room. The wrapper carries
  data-alt-cubuk while visible, so toasts sit above it.
  Telefon menüsü (yalnızca dikey telefon): YÜZEN hap (12px kenar boşluğu, 28px yarıçap, yükseltili, bulanık yarı saydam yüzey);
  Sohbetler / Alanlar / Ben. Seçili sekmenin göstergesi sekmeler arasında KAYAR (yalnızca transform). Sohbetler'de okunmamış rozeti.
  Liste aşağı kaydırılınca gizlenir, yukarı kaydırınca geri döner; sohbet listesi arama hapıyla birlikte (kabuk.altGizli). Sekmeye uzun
  basmak = hızlı eylemler. Tablette ve yatay telefonda (ray işi yapar: gezinme tekrarlanmaz) ve odada gizli. Görünürken sarmalayıcı
  data-alt-cubuk taşır; bildirimler üstünde durur.
-->
<script lang="ts">
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { kabuk } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { uzunBasma } from "../dokunma";
  import { t } from "../i18n";
  import BaglamMenusu, { type MenuEylemi } from "./BaglamMenusu.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import YeniSohbet from "./YeniSohbet.svelte";

  const ogeler: { sekme: Sekme; ikon: IkonAdi; etiket: "gezinme.sohbetler" | "gezinme.alanlar" | "gezinme.ben" }[] = [
    { sekme: "sohbetler", ikon: "sohbet", etiket: "gezinme.sohbetler" },
    { sekme: "alanlar", ikon: "izgara", etiket: "gezinme.alanlar" },
    { sekme: "ben", ikon: "kisi", etiket: "gezinme.ben" },
  ];
  const sira = $derived(Math.max(0, ogeler.findIndex((o) => o.sekme === gezinme.sekme)));
  const gorunur = $derived(!gezinme.acikOdaId && !kabuk.altGizli && !kabuk.aramaOdakta);

  let menu = $state<{ x: number; y: number; eylemler: MenuEylemi[] } | null>(null);
  let yeniAcik = $state(false);

  // Quick actions per tab (only what really exists) · Sekme başına hızlı eylemler (yalnızca gerçekten var olanlar)
  function hizli(sekme: Sekme, x: number, y: number) {
    let eylemler: MenuEylemi[] = [];
    if (sekme === "sohbetler") {
      eylemler = [
        { ikon: "kalem", etiket: t("gezinme.yeniSohbet"), calistir: () => (yeniAcik = true) },
        { ikon: "zil", etiket: t("gezinme.okunmamislariGoster"), calistir: () => { gezinme.sekmeSec("sohbetler"); odalar.suzgec = "okunmamis"; } },
      ];
    } else if (sekme === "ben") {
      eylemler = [
        { ikon: "palet", etiket: t("gorunum.baslik"), calistir: () => gezinme.benAltAc("gorunum") },
        { ikon: "kalkan", etiket: t("guvenlik.baslik"), calistir: () => gezinme.benAltAc("guvenlik") },
      ];
    }
    if (eylemler.length) menu = { x, y, eylemler };
  }
</script>

<!-- While a room covers the dock or it is hidden it must not count as a fixed bottom bar. · Oda menüyü örterken ya da menü gizliyken sabit alt çubuk sayılmamalı. -->
<div class="kap" class:gizli={!gorunur} data-alt-cubuk={gorunur ? "" : undefined}>
  <nav class="alt-menu" aria-label={t("gezinme.baslik")}>
    <span class="gosterge" style:transform="translateX({sira * 100}%)" aria-hidden="true"><span class="hap"></span></span>
    {#each ogeler as o (o.sekme)}
      <button
        class="oge"
        class:aktif={gezinme.sekme === o.sekme}
        aria-current={gezinme.sekme === o.sekme ? "page" : undefined}
        onclick={() => gezinme.sekmeSec(o.sekme)}
        use:uzunBasma={{ ac: (x, y) => hizli(o.sekme, x, y) }}
      >
        <span class="simge-yer">
          <span class="simge"><Ikon ad={o.ikon} boyut={22} /></span>
          <!-- Sohbetler: number of rooms with unread messages · Sohbetler: okunmamış mesajı olan oda sayısı -->
          {#if o.sekme === "sohbetler" && odalar.okunmamisOda > 0}<span class="rozet sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/if}
          <!-- Ben: this device is unverified or the recovery key is missing · Ben: bu cihaz doğrulanmadı ya da kurtarma anahtarı yok -->
          {#if o.sekme === "ben" && sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
        </span>
        <span class="etiket">{t(o.etiket)}</span>
      </button>
    {/each}
  </nav>
</div>

{#if menu}<BaglamMenusu x={menu.x} y={menu.y} eylemler={menu.eylemler} onkapat={() => (menu = null)} />{/if}
{#if yeniAcik}<YeniSohbet onkapat={() => (yeniAcik = false)} />{/if}

<style>
  /* Wrapper: spans the width, margins around the pill; clicks pass through its empty margin. · Sarmalayıcı: genişliği kaplar, hapın çevresinde boşluk; boş kenarlıktan tıklamalar geçer. */
  .kap { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 12px calc(12px + env(safe-area-inset-bottom)); pointer-events: none; transition: transform var(--sure-sayfa) var(--egri-cikis), opacity var(--sure-orta) var(--egri-cikis); }
  .kap.gizli { transform: translateY(calc(100% + 8px)); opacity: 0; }
  .alt-menu {
    position: relative; pointer-events: auto; display: flex; height: 64px; padding: 0 6px; border-radius: 28px;
    background: color-mix(in srgb, var(--yuzey-1) 82%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2);
  }
  .kap.gizli .alt-menu { pointer-events: none; }
  /* Sliding indicator: one third of the dock wide, moves by whole widths · Kayan gösterge: menünün üçte biri genişlikte, tam genişlik adımlarla kayar */
  .gosterge { position: absolute; top: 8px; bottom: 8px; left: 6px; width: calc((100% - 12px) / 3); display: flex; align-items: center; justify-content: center; transition: transform var(--sure-orta) var(--egri-yay); pointer-events: none; }
  .hap { width: 60px; height: 100%; border-radius: 20px; background: var(--ton); }
  .oge { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--yazi-2); border-radius: 28px; }
  .simge-yer { position: relative; display: inline-flex; }
  .simge { display: inline-flex; transition: color var(--sure-orta) var(--egri-cikis); }
  .aktif .simge { color: var(--ton-ustu); }
  .sayac { position: absolute; top: -6px; right: -12px; min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; }
  .nokta { position: absolute; top: -3px; right: -6px; width: 8px; height: 8px; border-radius: 4px; background: var(--vurgu); border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .etiket { font-size: .6875rem; line-height: 1.2; }
  .aktif { color: var(--yazi); }
  .aktif .etiket { font-weight: 600; }
</style>
