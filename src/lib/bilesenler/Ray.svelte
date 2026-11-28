<!--
  Side rail: used on wide desktop/tablet and landscape phone (Figma 18:555 / 15:708).
   - Top: Chats (unread badge), Spaces, Explore
   - Bottom: Notifications (bell + unread badge via Zil), Appearance, Profile (account avatar)
   - Labels are shown on both wide desktop and landscape phone (`kompakt`, .6875rem labels; left padding respects env(safe-area-inset-left)).
  Yan ray: geniş masaüstü/tablet ve yatay telefonda kullanılır (Figma 18:555 / 15:708).
   - Üstte: Sohbetler (okunmamış rozeti), Alanlar, Keşfet
   - Altta: Bildirimler (Zil ile zil + okunmamış rozeti), Görünüm, Profil (hesap avatarı)
   - Etiketler hem geniş masaüstünde hem yatay telefonda (`kompakt`, .6875rem etiketler; sol dolgu env(safe-area-inset-left) payını korur) görünür.
-->
<script lang="ts">
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import Zil from "./Zil.svelte";

  let { kompakt = false }: { kompakt?: boolean } = $props();

  const ogeler: { sekme: Sekme; ikon: IkonAdi; etiket: "gezinme.sohbetler" | "gezinme.alanlar" }[] = [
    { sekme: "sohbetler", ikon: "sohbet", etiket: "gezinme.sohbetler" },
    { sekme: "alanlar", ikon: "izgara", etiket: "gezinme.alanlar" },
  ];
  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
</script>

<nav class="ray" class:kompakt aria-label={t("gezinme.baslik")}>
  <div class="ust">
    {#each ogeler as o (o.sekme)}
      {@const aktif = gezinme.sekme === o.sekme && !gezinme.benAlt}
      <button class="oge" class:aktif aria-current={gezinme.sekme === o.sekme ? "page" : undefined} aria-label={t(o.etiket)} onclick={() => gezinme.sekmeSec(o.sekme)}>
        <span class="hap">
          <span class="zemin-hap"></span>
          <span class="simge"><Ikon ad={o.ikon} boyut={22} dolu={aktif} /></span>
          {#if o.sekme === "sohbetler" && odalar.okunmamisOda > 0}<span class="rozet sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/if}
        </span>
        <span class="etiket">{t(o.etiket)}</span>
      </button>
    {/each}
    <!-- Switches to the Explore directory section · Keşfet dizin bölümüne geçer -->
    <button
      class="oge"
      class:aktif={gezinme.sekme === "kesfet" && !gezinme.benAlt}
      aria-current={gezinme.sekme === "kesfet" ? "page" : undefined}
      aria-label={t("dock.kesfet")}
      onclick={() => gezinme.sekmeSec("kesfet")}
    >
      <span class="hap">
        <span class="zemin-hap"></span>
        <span class="simge"><Ikon ad="pusula" boyut={22} dolu={gezinme.sekme === "kesfet" && !gezinme.benAlt} /></span>
      </span>
      <span class="etiket">{t("ray.kesfet")}</span>
    </button>
  </div>
  <div class="alt">
    <Zil ray {kompakt} />
    <button class="oge" aria-label={t("gorunum.baslik")} class:aktif={gezinme.benAlt === "gorunum"} onclick={() => gezinme.benAltAc("gorunum")}>
      <span class="hap"><span class="zemin-hap"></span><span class="simge"><Ikon ad="palet" boyut={22} dolu={gezinme.benAlt === "gorunum"} /></span></span>
      <span class="etiket">{t("ray.gorunum")}</span>
    </button>
    <button class="oge" class:aktif={gezinme.sekme === "ben" && gezinme.benAlt !== "gorunum"} aria-current={gezinme.sekme === "ben" ? "page" : undefined} aria-label={t("profil.baslik")} onclick={() => gezinme.sekmeSec("ben")}>
      <span class="hap avatar-hap">
        <Avatar {harf} boyut={kompakt ? 26 : 32} mxc={oturum.profil?.avatarMxc ?? null} />
        {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
      </span>
      <span class="etiket">{t("profil.baslik")}</span>
    </button>
  </div>
</nav>

<style>
  .ray {
    width: max(76px, 4.75rem); flex: none; display: flex; flex-direction: column; justify-content: space-between; align-items: center; gap: 8px;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom)); background: var(--yuzey-1); border-right: 1px solid var(--kenar-ince);
    overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  }
  .ray::-webkit-scrollbar { display: none; }
  /* Landscape phone: slightly tighter vertical rhythm so all 6 labelled items fit without scrolling on 390px height. */
  /* Yatay telefon: 6 etiketli öğenin 390px yükseklikte kaydırmadan sığması için biraz daha sıkı dikey aralık. */
  .ray.kompakt {
    width: calc(72px + env(safe-area-inset-left));
    padding: calc(4px + env(safe-area-inset-top)) 0 calc(4px + env(safe-area-inset-bottom)) env(safe-area-inset-left);
    gap: 4px;
  }
  .ust, .alt { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .kompakt .ust, .kompakt .alt { gap: 2px; }
  .oge { width: 100%; min-height: 56px; padding: 0 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--yazi-2); }
  .kompakt .oge { min-height: 46px; gap: 2px; }
  .hap { position: relative; width: 56px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
  .kompakt .hap { height: 28px; }
  .zemin-hap { position: absolute; inset: 0; border-radius: 16px; background: var(--ton); opacity: 0; transform: scaleX(.5); transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-orta) var(--egri-cikis); }
  .kompakt .zemin-hap { border-radius: 14px; inset: 0 4px; }
  .aktif .zemin-hap { opacity: 1; transform: scaleX(1); }
  @media (hover: hover) { .oge:not(.aktif):hover .zemin-hap { opacity: 1; transform: scaleX(1); background: var(--yuzey-3); } }
  .simge { position: relative; display: inline-flex; }
  .aktif .simge { color: var(--ton-ustu); }
  .avatar-hap { height: 40px; }
  .kompakt .avatar-hap { height: 28px; }
  .sayac { position: absolute; top: -2px; right: 4px; min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .kompakt .sayac { top: -4px; right: 6px; }
  .nokta { position: absolute; top: 2px; right: 10px; width: 8px; height: 8px; border-radius: 4px; background: var(--vurgu); border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .kompakt .nokta { top: -1px; right: 12px; }
  .etiket { font-size: .75rem; line-height: 1.33; max-width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kompakt .etiket { font-size: .6875rem; line-height: 1.2; }
  .aktif { color: var(--yazi); }
  .aktif .etiket { font-weight: 600; }
</style>
