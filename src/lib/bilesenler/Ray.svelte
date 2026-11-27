<!--
  Side rail: the same destinations as the phone bottom menu.
   - tablet: 72px wide, labelled
   - landscape phone (`kompakt`): 64px, icons only; its left padding grows by env(safe-area-inset-left) so the notch/camera never covers it
  Plus a "Keşfet" room directory trigger under the tabs, a quick "Görünüm" shortcut and the Ben destination at the bottom (account avatar).
  Yan ray: telefon alt menüsüyle aynı hedefler.
   - tablet: 72px genişlik, etiketli
   - yatay telefon (`kompakt`): 64px, yalnızca simge; çentik/kamera örtmesin diye sol dolgusu env(safe-area-inset-left) kadar büyür
  Ek olarak sekmelerin altında "Keşfet" oda dizini tetikleyicisi, hızlı "Görünüm" kısayolu ve altta Ben hedefi (hesap avatarı).
-->
<script lang="ts">
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import OdaKesfet from "./OdaKesfet.svelte";

  let { kompakt = false }: { kompakt?: boolean } = $props();

  const ogeler: { sekme: Sekme; ikon: IkonAdi; etiket: "gezinme.sohbetler" | "gezinme.alanlar" }[] = [
    { sekme: "sohbetler", ikon: "sohbet", etiket: "gezinme.sohbetler" },
    { sekme: "alanlar", ikon: "izgara", etiket: "gezinme.alanlar" },
  ];
  let kesfetAcik = $state(false);
  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
</script>

<nav class="ray" class:kompakt aria-label={t("gezinme.baslik")}>
  <div class="ust">
    {#each ogeler as o (o.sekme)}
      <button class="oge" class:aktif={gezinme.sekme === o.sekme && !gezinme.benAlt} aria-current={gezinme.sekme === o.sekme ? "page" : undefined} aria-label={t(o.etiket)} onclick={() => gezinme.sekmeSec(o.sekme)}>
        <span class="hap">
          <span class="zemin-hap"></span>
          <span class="simge"><Ikon ad={o.ikon} boyut={22} /></span>
          {#if o.sekme === "sohbetler" && odalar.okunmamisOda > 0}<span class="rozet sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/if}
        </span>
        {#if !kompakt}<span class="etiket">{t(o.etiket)}</span>{/if}
      </button>
    {/each}
    <!-- Opens the public room directory modal instead of switching tabs · Sekme değiştirmek yerine herkese açık oda dizini penceresini açar -->
    <button class="oge" class:aktif={kesfetAcik} aria-expanded={kesfetAcik} aria-label={t("dock.kesfet")} onclick={() => (kesfetAcik = true)}>
      <span class="hap">
        <span class="zemin-hap"></span>
        <span class="simge"><Ikon ad="pusula" boyut={22} /></span>
      </span>
      {#if !kompakt}<span class="etiket">{t("ray.kesfet")}</span>{/if}
    </button>
  </div>
  <div class="alt">
    <button class="oge" aria-label={t("gorunum.baslik")} class:aktif={gezinme.benAlt === "gorunum"} onclick={() => gezinme.benAltAc("gorunum")}>
      <span class="hap"><span class="zemin-hap"></span><span class="simge"><Ikon ad="palet" boyut={22} /></span></span>
      {#if !kompakt}<span class="etiket">{t("ray.gorunum")}</span>{/if}
    </button>
    <button class="oge" class:aktif={gezinme.sekme === "ben" && gezinme.benAlt !== "gorunum"} aria-current={gezinme.sekme === "ben" ? "page" : undefined} aria-label={t("gezinme.ben")} onclick={() => gezinme.sekmeSec("ben")}>
      <span class="hap avatar-hap">
        <Avatar {harf} boyut={32} mxc={oturum.profil?.avatarMxc ?? null} />
        {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
      </span>
      {#if !kompakt}<span class="etiket">{t("gezinme.ben")}</span>{/if}
    </button>
  </div>
</nav>

{#if kesfetAcik}
  <OdaKesfet onkapat={() => (kesfetAcik = false)} />
{/if}

<style>
  .ray {
    width: max(72px, 4.5rem); flex: none; display: flex; flex-direction: column; justify-content: space-between; align-items: center; gap: 8px;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom)); background: var(--yuzey-1); border-right: 1px solid var(--kenar-ince);
    overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  }
  .ray::-webkit-scrollbar { display: none; }
  .ray.kompakt { width: calc(64px + env(safe-area-inset-left)); padding-left: env(safe-area-inset-left); padding-top: calc(8px + env(safe-area-inset-top)); gap: 4px; }
  .ust, .alt { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .oge { width: 64px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--yazi-2); }
  .kompakt .oge { min-height: 44px; }
  .hap { position: relative; width: 56px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
  .kompakt .hap { height: 44px; }
  .zemin-hap { position: absolute; inset: 0; border-radius: 16px; background: var(--ton); opacity: 0; transform: scaleX(.5); transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-orta) var(--egri-cikis); }
  .kompakt .zemin-hap { border-radius: 12px; inset: 0 8px; }
  .aktif .zemin-hap { opacity: 1; transform: scaleX(1); }
  @media (hover: hover) { .oge:not(.aktif):hover .zemin-hap { opacity: 1; transform: scaleX(1); background: var(--yuzey-3); } }
  .simge { position: relative; display: inline-flex; }
  .aktif .simge { color: var(--ton-ustu); }
  .avatar-hap { height: 44px; }
  .sayac { position: absolute; top: -2px; right: 4px; min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .kompakt .sayac { right: 8px; }
  .nokta { position: absolute; top: 2px; right: 10px; width: 8px; height: 8px; border-radius: 4px; background: var(--vurgu); border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .etiket { font-size: .75rem; line-height: 1.33; max-width: calc(100% - 4px); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .aktif { color: var(--yazi); }
  .aktif .etiket { font-weight: 600; }
</style>
