<!--
  Compact window: one narrow strip takes the place of rail + list. Top: the list drawer; middle: chats as avatars; bottom: Alanlar and Ben.
  Kompakt pencere: ray + listenin yerini tek dar şerit alır. Üstte liste çekmecesi, ortada avatar olarak sohbetler, altta Alanlar ve Ben.
-->
<script lang="ts">
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  const satirlar = $derived(odalar.suz("tumu").slice(0, 40));
  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
  /** The list area is what the user looks at · Kullanıcının baktığı yer liste alanı */
  const acik = $derived(duzen.cekmece || !gezinme.acikOdaId);

  function ac(s: Sekme) {
    // The same button again closes the drawer. · Aynı düğme yine basılınca çekmeceyi kapatır.
    if (duzen.cekmece && gezinme.sekme === s && !gezinme.benAlt) return duzen.cekmeceKapat();
    gezinme.sekmeSec(s);
    duzen.cekmeceAc();
  }
</script>

<nav class="serit" aria-label={t("gezinme.baslik")}>
  <button class="uc" class:aktif={acik && gezinme.sekme === "sohbetler"} aria-label={t("gezinme.sohbetler")} title="{t("gezinme.sohbetler")} (Ctrl+B)" aria-expanded={duzen.cekmece} onclick={() => ac("sohbetler")}><Ikon ad="yanPanel" boyut={22} /></button>
  <div class="odalar">
    {#each satirlar as o (o.id)}
      <button class="oda" class:secili={gezinme.acikOdaId === o.id} title={o.ad} aria-label={o.okunmamis > 0 ? `${o.ad}, ${t("sohbetler.okunmamisSayi", { n: o.okunmamis })}` : o.ad} aria-current={gezinme.acikOdaId === o.id ? "page" : undefined} onclick={() => gezinme.odaAc(o.id, true)}>
        <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={44} />
        {#if o.bahsedilme > 0}<span class="rozet">@</span>{:else if o.okunmamis > 0}<span class="rozet">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}
      </button>
    {/each}
  </div>
  <button class="uc" class:aktif={acik && gezinme.sekme === "alanlar"} aria-label={t("gezinme.alanlar")} title={t("gezinme.alanlar")} onclick={() => ac("alanlar")}><Ikon ad="izgara" boyut={22} /></button>
  <button class="uc" class:aktif={acik && gezinme.sekme === "ben"} aria-label={t("gezinme.ben")} title={t("gezinme.ben")} onclick={() => ac("ben")}>
    <Avatar {harf} boyut={32} mxc={oturum.profil?.avatarMxc ?? null} />
    {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
  </button>
</nav>

<style>
  .serit { position: relative; z-index: 6; width: 68px; flex: none; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; background: var(--yuzey-1); border-right: 1px solid var(--kenar-ince); }
  .odalar { flex: 1; min-height: 0; width: 100%; overflow-y: auto; scrollbar-width: none; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; scroll-padding: 4px; }
  .odalar::-webkit-scrollbar { display: none; }
  .uc { position: relative; flex: none; width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; color: var(--yazi-2); transition: background var(--sure-hizli) var(--egri-cikis); }
  .oda { position: relative; flex: none; width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; transition: background var(--sure-hizli) var(--egri-cikis); }
  @media (hover: hover) { .uc:hover, .oda:hover { background: var(--yuzey-3); } }
  .uc.aktif, .oda.secili { background: var(--ton); color: var(--ton-ustu); }
  .uc:focus-visible, .oda:focus-visible { outline-offset: -2px; }
  .rozet { position: absolute; right: 0; bottom: 2px; min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; border: 2px solid var(--yuzey-1); box-sizing: content-box; }
  .nokta { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 4px; background: var(--vurgu); border: 2px solid var(--yuzey-1); box-sizing: content-box; }
</style>
