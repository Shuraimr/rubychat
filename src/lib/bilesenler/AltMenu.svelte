<!--
  Phone bottom menu (portrait phones only): Sohbetler / Alanlar / Ben. Hidden on tablets and landscape phones (the rail does that job:
  no duplicated navigation) and inside a room. The selected item has a 56x32 pill that grows sideways (200ms, transform only).
  Telefon alt menüsü (yalnızca dikey telefon): Sohbetler / Alanlar / Ben. Tablette ve yatay telefonda gizlidir (işi ray yapar: gezinme
  tekrarlanmaz) ve odada gizlidir. Seçili öğenin 56x32 hapı yatayda genişler (200ms, yalnızca transform).
-->
<script lang="ts">
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";

  const ogeler: { sekme: Sekme; ikon: IkonAdi; etiket: "gezinme.sohbetler" | "gezinme.alanlar" | "gezinme.ben" }[] = [
    { sekme: "sohbetler", ikon: "sohbet", etiket: "gezinme.sohbetler" },
    { sekme: "alanlar", ikon: "izgara", etiket: "gezinme.alanlar" },
    { sekme: "ben", ikon: "kisi", etiket: "gezinme.ben" },
  ];
</script>

<!-- While a room covers the menu it must not count as a fixed bottom bar. · Oda menüyü örterken sabit alt çubuk sayılmamalı. -->
<nav class="alt-menu" data-alt-cubuk={gezinme.acikOdaId ? undefined : ""} aria-label={t("gezinme.baslik")}>
  {#each ogeler as o (o.sekme)}
    <button class="oge" class:aktif={gezinme.sekme === o.sekme} aria-current={gezinme.sekme === o.sekme ? "page" : undefined} onclick={() => gezinme.sekmeSec(o.sekme)}>
      <span class="hap">
        <span class="zemin-hap"></span>
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

<style>
  .alt-menu {
    flex: none; display: flex; justify-content: space-around;
    background: var(--yuzey-1); border-top: 1px solid var(--kenar-ince);
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  }
  .oge { flex: 1; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--yazi-2); }
  .hap { position: relative; width: 56px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
  /* The pill: it grows from the middle (scaleX .5 → 1) when the item becomes selected. · Hap: öğe seçilince ortadan büyür (scaleX .5 → 1). */
  .zemin-hap { position: absolute; inset: 0; border-radius: 16px; background: var(--ton); opacity: 0; transform: scaleX(.5); transition: transform var(--sure-orta) var(--egri-cikis), opacity var(--sure-orta) var(--egri-cikis); }
  .aktif .zemin-hap { opacity: 1; transform: scaleX(1); }
  .oge:not(.aktif):active .zemin-hap { opacity: 1; transform: scaleX(1); background: var(--yuzey-3); }
  .simge { position: relative; display: inline-flex; transition: color var(--sure-orta) var(--egri-cikis), transform var(--sure-orta) var(--egri-cikis); }
  .aktif .simge { color: var(--ton-ustu); }
  .sayac { position: absolute; top: -4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .nokta { position: absolute; top: 3px; right: 14px; width: 8px; height: 8px; border-radius: 4px; background: var(--vurgu); border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .etiket { font-size: .75rem; line-height: 1.33; }
  .aktif { color: var(--yazi); }
  .aktif .etiket { font-weight: 600; }
</style>
