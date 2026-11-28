<!--
  Compact window strip (~76px, Figma 16:648): Search (OdaPaleti beside button), "+" New menu (to the right), Chats (toggles drawer),
  Spaces, Explore, thin divider, top 3 recent chats (unread/mentions first, then newest), spacer, Notifications, Appearance and Profile.
  Kompakt pencere şeridi (~76px, Figma 16:648): Ara (OdaPaleti düğmenin yanında), "+" Yeni menüsü (sağında), Sohbetler (çekmeceyi aç/kapat),
  Alanlar, Keşfet, ince ayırıcı, son 3 oda (önce okunmamış/bahsetme, sonra en yeniler), boşluk, Bildirimler, Görünüm ve Profil.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { titret } from "../dokunma";
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import { klavye } from "../klavyeKisayol.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";
  import YeniMenusu from "./YeniMenusu.svelte";
  import Zil from "./Zil.svelte";

  // Top 3 recent chats: rooms with unread messages or mentions first (newest first), then the newest remaining chats.
  // Son 3 oda: önce okunmamış ya da bahsetme olanlar (en yeniden eskiye), sonra en yeni diğer sohbetler.
  const sonOdalar = $derived.by(() => {
    const sohbetler = odalar.liste.filter((o) => !o.davet && !o.alan);
    const zamanSirala = (a: (typeof sohbetler)[number], b: (typeof sohbetler)[number]) => (b.sonZaman ?? 0) - (a.sonZaman ?? 0);
    const oncelikli = sohbetler.filter((o) => o.bahsedilme > 0 || o.okunmamis > 0).sort(zamanSirala);
    const diger = sohbetler.filter((o) => o.bahsedilme === 0 && o.okunmamis === 0).sort(zamanSirala);
    return [...oncelikli, ...diger].slice(0, 3);
  });
  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
  /** The list area is what the user looks at · Kullanıcının baktığı yer liste alanı */
  const acik = $derived(duzen.cekmece || (!gezinme.acikOdaId && !gezinme.odaAyar));

  let seritEl: HTMLElement | undefined = $state();
  let yeniDugme: HTMLButtonElement | undefined = $state();
  let yeniMenu = $state<{ geriAl: () => boolean }>();
  let yeniAcik = $state(false);
  let yeniKatman = 0;
  let zorlaKapat = false;
  let yeniUst = $state(60);

  function yeniKapat() {
    if (!yeniKatman) return;
    zorlaKapat = true;
    gezinme.katmanKapat(yeniKatman);
  }
  function yeniDegis() {
    if (yeniAcik) return yeniKapat();
    if (yeniDugme && seritEl) {
      yeniUst = Math.max(8, Math.round(yeniDugme.getBoundingClientRect().top - seritEl.getBoundingClientRect().top));
    }
    titret(8);
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
  onDestroy(() => {
    if (yeniKatman) gezinme.katmanBirak(yeniKatman);
  });

  function ac(s: Sekme) {
    // The same button again closes the drawer. · Aynı düğme yine basılınca çekmeceyi kapatır.
    if (duzen.cekmece && gezinme.sekme === s && !gezinme.benAlt) return duzen.cekmeceKapat();
    gezinme.sekmeSec(s);
    duzen.cekmeceAc();
  }

  function kesfetSec() {
    duzen.cekmeceKapat();
    gezinme.sekmeSec("kesfet");
  }

  function gorunumAc() {
    // Tapping Appearance again while it is open in the drawer closes the drawer.
    // Çekmecede Görünüm zaten açıkken tekrar basmak çekmeceyi kapatır.
    if (duzen.cekmece && gezinme.benAlt === "gorunum") {
      duzen.cekmeceKapat();
      return;
    }
    gezinme.benAltAc("gorunum");
    duzen.cekmeceAc();
  }

  function odaSec(id: string) {
    duzen.cekmeceKapat();
    // Leave Explore when picking a recent chat so the room column shows it right away.
    // Son odalardan birini seçince Keşfet'ten çık; oda sütunu hemen odayı göstersin.
    gezinme.odaAc(id, gezinme.sekme !== "kesfet");
  }
</script>

<nav class="serit" bind:this={seritEl} aria-label={t("gezinme.baslik")}>
  <div class="serit-ic">
    <button
      class="ara-dugme"
      class:aktif={klavye.palet}
      type="button"
      aria-label={t("sohbetler.ara")}
      aria-expanded={klavye.palet}
      aria-haspopup="dialog"
      title="{t("sohbetler.ara")} (Ctrl+Space)"
      onclick={() => (klavye.palet = !klavye.palet)}
    >
      <Ikon ad="ara" boyut={20} />
    </button>

    <button
      bind:this={yeniDugme}
      class="yeni-dugme"
      class:acik={yeniAcik}
      type="button"
      aria-label={yeniAcik ? t("dock.yeniKapat") : t("dock.yeni")}
      aria-expanded={yeniAcik}
      aria-haspopup="menu"
      title={yeniAcik ? t("dock.yeniKapat") : t("dock.yeni")}
      onclick={yeniDegis}
    >
      <span class="cevir"><Ikon ad="artik" boyut={22} /></span>
    </button>

    <button
      class="oge"
      class:aktif={acik && gezinme.sekme === "sohbetler" && !gezinme.benAlt}
      type="button"
      aria-label={t("gezinme.sohbetler")}
      aria-current={acik && gezinme.sekme === "sohbetler" && !gezinme.benAlt ? "page" : undefined}
      aria-expanded={duzen.cekmece && gezinme.sekme === "sohbetler"}
      title="{t("gezinme.sohbetler")} (Ctrl+B)"
      onclick={() => ac("sohbetler")}
    >
      <span class="hap">
        <span class="zemin-hap"></span>
        <span class="simge"><Ikon ad="sohbet" boyut={22} dolu={acik && gezinme.sekme === "sohbetler" && !gezinme.benAlt} /></span>
        {#if odalar.okunmamisOda > 0}<span class="rozet sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/if}
      </span>
      <span class="etiket">{t("gezinme.sohbetler")}</span>
    </button>

    <button
      class="oge"
      class:aktif={acik && gezinme.sekme === "alanlar" && !gezinme.benAlt}
      type="button"
      aria-label={t("gezinme.alanlar")}
      aria-current={acik && gezinme.sekme === "alanlar" && !gezinme.benAlt ? "page" : undefined}
      title={t("gezinme.alanlar")}
      onclick={() => ac("alanlar")}
    >
      <span class="hap">
        <span class="zemin-hap"></span>
        <span class="simge"><Ikon ad="izgara" boyut={22} dolu={acik && gezinme.sekme === "alanlar" && !gezinme.benAlt} /></span>
      </span>
      <span class="etiket">{t("gezinme.alanlar")}</span>
    </button>

    <button
      class="oge"
      class:aktif={gezinme.sekme === "kesfet" && !gezinme.benAlt}
      type="button"
      aria-label={t("dock.kesfet")}
      aria-current={gezinme.sekme === "kesfet" && !gezinme.benAlt ? "page" : undefined}
      title={t("dock.kesfet")}
      onclick={kesfetSec}
    >
      <span class="hap">
        <span class="zemin-hap"></span>
        <span class="simge"><Ikon ad="pusula" boyut={22} dolu={gezinme.sekme === "kesfet" && !gezinme.benAlt} /></span>
      </span>
      <span class="etiket">{t("ray.kesfet")}</span>
    </button>

    {#if sonOdalar.length > 0}
      <div class="ayirici" role="separator"></div>
      <div class="odalar">
        {#each sonOdalar as o (o.id)}
          <button
            class="oda"
            class:secili={gezinme.acikOdaId === o.id}
            type="button"
            title={o.ad}
            aria-label={o.okunmamis > 0 ? `${o.ad}, ${t("sohbetler.okunmamisSayi", { n: o.okunmamis })}` : o.ad}
            aria-current={gezinme.acikOdaId === o.id ? "page" : undefined}
            onclick={() => odaSec(o.id)}
          >
            <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={40} anahtar={o.id} />
            {#if o.bahsedilme > 0}<span class="rozet oda-rozet">@</span>{:else if o.okunmamis > 0}<span class="rozet oda-rozet">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="bosluk" aria-hidden="true"></div>

    <div class="alt">
      <Zil ray kompakt />
      <button
        class="oge"
        class:aktif={acik && gezinme.benAlt === "gorunum"}
        type="button"
        aria-label={t("gorunum.baslik")}
        title={t("gorunum.baslik")}
        onclick={gorunumAc}
      >
        <span class="hap">
          <span class="zemin-hap"></span>
          <span class="simge"><Ikon ad="palet" boyut={22} dolu={acik && gezinme.benAlt === "gorunum"} /></span>
        </span>
        <span class="etiket">{t("ray.gorunum")}</span>
      </button>
      <button
        class="oge"
        class:aktif={acik && gezinme.sekme === "ben" && gezinme.benAlt !== "gorunum"}
        type="button"
        aria-label={t("profil.baslik")}
        aria-current={acik && gezinme.sekme === "ben" && gezinme.benAlt !== "gorunum" ? "page" : undefined}
        title={t("profil.baslik")}
        onclick={() => ac("ben")}
      >
        <span class="hap avatar-hap">
          <Avatar {harf} boyut={26} mxc={oturum.profil?.avatarMxc ?? null} />
          {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
        </span>
        <span class="etiket">{t("profil.baslik")}</span>
      </button>
    </div>
  </div>
</nav>

<!-- Mounted outside <nav class="serit"> so scrolling never clips the menu and sheets escape the strip's stacking context. -->
<!-- <nav class="serit"> dışında bağlanır; kaydırma menüyü kırpmaz ve açılan sayfalar şeridin yığın bağlamına hapsolmaz. -->
{#if yeniAcik}
  <button class="yeni-perde" type="button" aria-label={t("dock.yeniKapat")} data-bas="yok" onclick={yeniKapat}></button>
{/if}
<div class="yeni-menu-kap" style:top="{yeniUst}px" style:--ust="{yeniUst}px">
  <YeniMenusu bind:this={yeniMenu} acik={yeniAcik} onkapat={yeniKapat} konum="sag" />
</div>

<style>
  .serit {
    position: relative;
    z-index: 6;
    width: var(--serit-en, 76px);
    flex: none;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--yuzey-1);
    border-right: 1px solid var(--kenar-ince);
  }
  .serit-ic {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  }
  .serit-ic::-webkit-scrollbar { display: none; }

  .ara-dugme {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--yuzey-2);
    color: var(--yazi-2);
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .ara-dugme.aktif { background: var(--ton); color: var(--ton-ustu); }
  @media (hover: hover) { .ara-dugme:not(.aktif):hover { background: var(--yuzey-3); color: var(--yazi); } }
  .ara-dugme:active { background: var(--yuzey-3); }

  .yeni-dugme {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: var(--vurgu);
    color: var(--vurgu-ustu);
    margin-bottom: 8px;
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .yeni-dugme:active { opacity: .82; }
  .cevir { display: inline-flex; transition: transform var(--sure-orta) var(--egri-ac); }
  .yeni-dugme.acik .cevir { transform: rotate(135deg); }

  .oge {
    flex: none;
    width: 100%;
    min-height: 46px;
    padding: 0 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--yazi-2);
  }
  .hap {
    position: relative;
    width: 56px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .zemin-hap {
    position: absolute;
    inset: 0 4px;
    border-radius: 14px;
    background: var(--ton);
    opacity: 0;
    transform: scaleX(.5);
    transition: transform var(--sure-orta) var(--egri-ac), opacity var(--sure-orta) var(--egri-cikis);
  }
  .aktif .zemin-hap { opacity: 1; transform: scaleX(1); }
  @media (hover: hover) { .oge:not(.aktif):hover .zemin-hap { opacity: 1; transform: scaleX(1); background: var(--yuzey-3); } }
  .simge { position: relative; display: inline-flex; }
  .aktif .simge { color: var(--ton-ustu); }
  .avatar-hap { height: 28px; }
  .etiket {
    font-size: .6875rem;
    line-height: 1.2;
    max-width: 100%;
    text-align: center;
    white-space: nowrap;
  }
  .aktif { color: var(--yazi); }
  .aktif .etiket { font-weight: 600; }

  .sayac {
    position: absolute;
    top: -7px;
    right: 0;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: .6875rem;
    border: 2px solid var(--yuzey-1);
    box-sizing: content-box;
    pointer-events: none;
  }
  .nokta {
    position: absolute;
    top: -1px;
    right: 12px;
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--vurgu);
    border: 2px solid var(--yuzey-1);
    box-sizing: content-box;
  }

  .ayirici {
    flex: none;
    width: 32px;
    height: 1px;
    margin: 2px 0;
    background: var(--kenar-ince);
  }
  .odalar {
    flex: none;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .oda {
    contain: layout style;
    position: relative;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: grid;
    place-items: center;
  }
  /* Cap strip avatars so large root font sizes never clip inside the 76px strip. */
  /* Şerit avatarlarını sınırla; büyük kök yazı boyutları 76px şeritte taşmasın. */
  .oda :global(.avatar) {
    width: 40px !important;
    height: 40px !important;
    border-radius: 11px !important;
    font-size: 16px !important;
  }
  @media (hover: hover) { .oda:hover { background: var(--yuzey-3); } }
  .oda.secili { background: var(--ton); color: var(--ton-ustu); }
  .oda.secili::before {
    content: "";
    position: absolute;
    left: -10px;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 2px;
    background: var(--vurgu);
  }
  .oda:focus-visible, .oge:focus-visible, .ara-dugme:focus-visible, .yeni-dugme:focus-visible { outline-offset: -2px; }
  /* Top-right corner like the rail, so the room's letter stays readable. · Raydaki gibi sağ üst köşe; odanın harfi okunur kalsın. */
  .oda-rozet {
    position: absolute;
    right: -4px;
    top: -4px;
    min-width: 18px;
    max-width: calc(100% - 4px);
    height: 18px;
    padding: 0 5px;
    font-size: .6875rem;
    border: 2px solid var(--yuzey-1);
    box-sizing: content-box;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bosluk { flex: 1; min-height: 4px; }
  .alt {
    flex: none;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .yeni-perde {
    position: fixed;
    inset: 0;
    z-index: 6;
    background: transparent;
  }
  .yeni-menu-kap {
    position: absolute;
    left: 0;
    width: var(--serit-en, 76px);
    height: 0;
    z-index: 7;
    pointer-events: none;
  }
</style>
