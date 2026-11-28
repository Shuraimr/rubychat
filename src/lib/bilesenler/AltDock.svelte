<!--
  Phone dock (Figma 24 · B, from rubyyard's bottom menu): a floating bar with Sohbetler · Alanlar · Yeni · Ara · Profil.
   - Icons only (64px), always the same size. The Material pill indicator follows the FINGER while the pages are swiped (kabuk.ilerleme), it does not jump after the fact.
   - It never hides or shrinks. A running call is its upper storey.
   - "Yeni" opens four actions above the dock and turns into ✕; "Ara" turns the dock into the search field (SohbetAramasi).
   - Tapping the page you are on scrolls it to the top; long press = quick actions.
  Telefon dock'u (Figma 24 · B, rubyyard alt menüsünden): Sohbetler · Alanlar · Yeni · Ara · Profil taşıyan yüzen çubuk.
   - Yalnızca simgeler (64px), hep aynı boyda. Material hap göstergesi sayfalar kaydırılırken PARMAĞI izler (kabuk.ilerleme), sonradan zıplamaz.
   - Hiç gizlenmez, küçülmez. Süren arama onun üst katıdır.
   - "Yeni" dock'un üstünde dört eylem açar ve ✕ olur; "Ara" dock'u arama alanına çevirir (SohbetAramasi).
   - Bulunduğun sayfaya dokunmak başa kaydırır; uzun basmak = hızlı eylemler.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { hareketVar } from "../hareket";
  import { ec } from "../arama-ec/ec.svelte";
  import EcCubuk from "../arama-ec/EcCubuk.svelte";
  import { titret, uzunBasma } from "../dokunma";
  import { arama } from "../durum/arama.svelte";
  import { gezinme, type Sekme } from "../durum/gezinme.svelte";
  import { hizli, hizliGecis } from "../durum/hizliGecis.svelte";
  import { kabuk } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import AramaCubugu from "./AramaCubugu.svelte";
  import Avatar from "./Avatar.svelte";
  import BaglamMenusu, { type MenuEylemi } from "./BaglamMenusu.svelte";
  import Ikon from "./Ikon.svelte";
  import OdaOlustur from "./OdaOlustur.svelte";
  import YeniMenusu, { type YeniSayfa } from "./YeniMenusu.svelte";
  import YeniSohbet from "./YeniSohbet.svelte";
  import OdaKesfet from "./OdaKesfet.svelte";

  let { gizli }: { gizli: boolean } = $props();

  const harf = $derived((oturum.ben?.kullaniciId ?? "#").replace(/^@/, "").charAt(0).toUpperCase() || "#");
  const aramaVar = $derived((ec.etkin && !ec.ekranAcik) || (arama.etkin && !arama.ekranAcik));

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
    const yumusak = hareketVar();
    for (const l of document.querySelectorAll<HTMLElement>(".ekran .yaprak:not([inert]) .liste, .ekran .yaprak:not([inert]) .icerik")) {
      if (l.scrollTop > 0) l.scrollTo({ top: 0, behavior: yumusak ? "smooth" : "instant" });
    }
  }

  // ---- "Yeni" menu: a layer, so back closes it · "Yeni" menüsü: katman, geri tuşu kapatır ----
  let yeniAcik = $state(false);
  let katman = 0;
  let sayfa = $state<YeniSayfa | null>(null);
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
  // Rotating to landscape removes the dock while the menu is open: its layer must not stay on the stack (back would do nothing).
  // Menü açıkken yatay konuma dönmek dock'u kaldırır: katmanı yığında kalmamalı (geri tuşu boşa giderdi).
  onDestroy(() => {
    if (katman) gezinme.katmanBirak(katman);
  });
  function yeniKapat() {
    if (katman) gezinme.katmanKapat(katman);
  }

  // ---- Slide a finger along the dock: the page under the finger opens (Sohbetler · Alanlar · Profil) ----
  // ---- Parmağı dock boyunca kaydır: parmağın altındaki sayfa açılır (Sohbetler · Alanlar · Profil) ----
  const SAYFALAR: (Sekme | null)[] = ["sohbetler", "alanlar", null, null, "ben"];
  function dockKaydir(node: HTMLElement) {
    let id = -1;
    let bx = 0;
    let by = 0;
    let surer = false;
    let yut = false;
    const bas = (e: PointerEvent) => {
      if (id !== -1 || !e.isPrimary) return;
      id = e.pointerId;
      bx = e.clientX;
      by = e.clientY;
      surer = yut = false;
    };
    const oyna = (e: PointerEvent) => {
      if (e.pointerId !== id || hizli.acik) return;
      if (!surer) {
        if (Math.abs(e.clientX - bx) < 14 || Math.abs(e.clientX - bx) < Math.abs(e.clientY - by)) return;
        surer = yut = true;
        yeniKapat();
        node.setPointerCapture(id);
      }
      const r = node.getBoundingClientRect();
      const s = SAYFALAR[Math.max(0, Math.min(4, Math.floor(((e.clientX - r.left - 6) / (r.width - 12)) * 5)))];
      if (s && s !== gezinme.sekme) {
        titret("tik");
        gezinme.sekmeSec(s);
      }
    };
    const birak = (e: PointerEvent) => {
      if (e.pointerId === id) id = -1;
    };
    const tik = (e: Event) => {
      if (!yut) return;
      yut = false;
      e.stopPropagation();
      e.preventDefault();
    };
    node.addEventListener("pointerdown", bas);
    node.addEventListener("pointermove", oyna);
    node.addEventListener("pointerup", birak);
    node.addEventListener("pointercancel", birak);
    node.addEventListener("click", tik, true);
    return {
      destroy() {
        node.removeEventListener("pointerdown", bas);
        node.removeEventListener("pointermove", oyna);
        node.removeEventListener("pointerup", birak);
        node.removeEventListener("pointercancel", birak);
        node.removeEventListener("click", tik, true);
      },
    };
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

<button class="perde" class:acik={yeniAcik} inert={!yeniAcik} aria-label={t("dock.yeniKapat")} data-bas="yok" onclick={yeniKapat}></button>

<div class="kap" class:gizli inert={gizli} data-alt-cubuk={gizli ? undefined : ""}>
  <YeniMenusu acik={yeniAcik} onkapat={yeniKapat} konum="orta" onsec={(s) => (sayfa = s)} />

  <div class="govde">
    {#if aramaVar && !gizli}<div class="kat"><AramaCubugu /><EcCubuk /></div>{/if}
    <nav class="dock" aria-label={t("gezinme.baslik")} use:dockKaydir>
      <span class="iz" aria-hidden="true"><span class="gosterge" style:transform="translate3d({sutun * 100}%,0,0)"><span class="hap"></span></span></span>

      <button class="oge" class:aktif={yakin === "sohbetler"} aria-current={gezinme.sekme === "sohbetler" ? "page" : undefined} aria-label={t("gezinme.sohbetler")} data-bas="yok" onclick={() => dokun("sohbetler")}>
        <span class="simge"><Ikon ad="sohbet" boyut={24} dolu={yakin === "sohbetler"} />
          {#if odalar.okunmamisOda > 0}{#key odalar.okunmamisOda}<span class="sayac" aria-label={t("sohbetler.okunmamisSayi", { n: odalar.okunmamisOda })}>{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>{/key}{/if}
        </span>
      </button>

      <button class="oge" class:aktif={yakin === "alanlar"} aria-current={gezinme.sekme === "alanlar" ? "page" : undefined} aria-label={t("gezinme.alanlar")} data-bas="yok" onclick={() => dokun("alanlar")}>
        <span class="simge"><Ikon ad="izgara" boyut={24} dolu={yakin === "alanlar"} /></span>
      </button>

      <button class="oge yeni" class:acik={yeniAcik} aria-label={yeniAcik ? t("dock.yeniKapat") : t("dock.yeni")} aria-expanded={yeniAcik} data-bas="yok" onclick={yeniDegis}>
        <span class="fab"><span class="cevir"><Ikon ad="artik" boyut={26} /></span></span>
      </button>

      <button class="oge" aria-label={t("dock.ara")} data-bas="yok" use:hizliGecis onclick={() => { titret("tik"); yeniKapat(); kabuk.aramaAc?.(); }}>
        <span class="simge"><Ikon ad="ara" boyut={24} /></span>
      </button>

      <button class="oge" class:aktif={yakin === "ben"} aria-current={gezinme.sekme === "ben" ? "page" : undefined} aria-label={t("profil.baslik")} data-bas="yok" onclick={() => dokun("ben")} use:uzunBasma={{ ac: profilHizli }}>
        <span class="simge"><span class="yuz"><Avatar {harf} boyut={26} mxc={oturum.profil?.avatarMxc ?? null} yaricap={10} /></span>
          {#if sifreleme.noktaVar}<span class="nokta" role="img" aria-label={t("guvenlik.baslik")}></span>{/if}
        </span>
      </button>
    </nav>
  </div>
</div>

{#if menu}<BaglamMenusu x={menu.x} y={menu.y} eylemler={menu.eylemler} onkapat={() => (menu = null)} />{/if}
{#if sayfa === "kisi"}<YeniSohbet onkapat={() => (sayfa = null)} />{:else if sayfa === "kesfet"}<OdaKesfet onkapat={() => (sayfa = null)} />{:else if sayfa}<OdaOlustur tur={sayfa} onkapat={() => (sayfa = null)} />{/if}

<style>
  .perde { position: absolute; inset: 0; z-index: 5; background: color-mix(in srgb, var(--zemin) 50%, transparent); opacity: 0; visibility: hidden; transition: opacity var(--sure-cikis) linear, visibility 0s var(--sure-cikis); }
  .perde.acik { opacity: 1; visibility: visible; transition: opacity var(--sure-orta) linear; }
  .kap { position: absolute; z-index: 6; left: 0; right: 0; bottom: 0; padding: 0 12px calc(12px + env(safe-area-inset-bottom)); pointer-events: none; transition: transform var(--sure-orta) var(--egri-cikis), opacity var(--sure-orta) var(--egri-cikis); }
  .kap > * { pointer-events: auto; }
  .kap.gizli { opacity: 0; transform: translate3d(0, 8px, 0) scale(.96); }
  .kap.gizli > * { pointer-events: none; }
  .govde { position: relative; border-radius: 32px; background: var(--yuzey-2); box-shadow: var(--kat-2); }
  /* The upper storey (running call) shares the dock's outline · Üst kat (süren arama) dock'un çizgisini paylaşır */
  .kat { overflow: hidden; border-radius: 32px 32px 0 0; }
  .kat :global(.cubuk) { padding-top: 0; min-height: 52px; background: var(--yuzey-2); color: var(--yazi); }
  .kat :global(.cubuk > svg), .kat :global(.don > svg) { color: var(--cozum); }
  .kat :global(.kapat) { color: var(--hata); }
  /* px on purpose: five columns must fit 320px at any text size · Bilerek px: beş sütun her yazı boyutunda 320px'e sığmalı */
  .dock { touch-action: none; position: relative; height: 64px; padding: 0 6px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .iz { position: absolute; inset: 0 6px; pointer-events: none; }
  .gosterge { position: absolute; left: 0; top: 14px; width: 20%; height: 36px; display: flex; justify-content: center; }
  .hap { width: min(60px, 100%); height: 36px; border-radius: 18px; background: var(--ton); }
  .oge { position: relative; min-width: 0; display: flex; align-items: center; justify-content: center; color: var(--yazi-2); -webkit-tap-highlight-color: transparent; }
  /* Material state layer: the same pill as the indicator, only while pressed · Material durum katmanı: göstergeyle aynı hap, yalnızca basılıyken */
  .oge::before { content: ""; position: absolute; left: 50%; top: 14px; width: min(60px, 100%); height: 36px; border-radius: 18px; transform: translateX(-50%) scaleX(.6); background: currentColor; opacity: 0; transition: opacity var(--sure-yavas) var(--egri-cikis), transform var(--sure-yavas) var(--egri-cikis); }
  .oge:active::before { opacity: .12; transform: translateX(-50%); transition-duration: calc(60ms * var(--hareket)), var(--sure-orta); }
  .simge { position: relative; display: inline-flex; align-items: center; }
  .simge :global(svg) { width: 28px !important; height: 28px !important; }
  .yuz :global(.avatar) { width: 30px !important; height: 30px !important; font-size: 13px !important; }
  .sayac { font-size: 11px !important; }
  .aktif { color: var(--ton-ustu); }
  .yeni::before { display: none; }
  .fab { position: relative; overflow: hidden; width: 52px; height: 48px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); }
  .fab::after { content: ""; position: absolute; inset: 0; background: currentColor; opacity: 0; transition: opacity var(--sure-orta) var(--egri-cikis); }
  .yeni:active .fab::after { opacity: .14; transition-duration: calc(60ms * var(--hareket)); }
  .acik .fab { border-radius: 24px; }
  .fab :global(svg) { width: 28px !important; height: 28px !important; }
  .cevir { display: inline-flex; transition: transform var(--sure-yavas) var(--egri-ac); }
  .acik .cevir { transform: rotate(135deg); }
  .sayac { position: absolute; left: 16px; top: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; animation: pop var(--sure-pop) var(--egri-cikis); }
  @keyframes pop { from { transform: scale(.4); } }
  /* Active profile ring fades with opacity on a pseudo-element instead of animating box-shadow. */
  /* Etkin profil halkası box-shadow canlandırmak yerine sözde öğede opaklıkla belirir. */
  .yuz { position: relative; display: inline-flex; border-radius: 10px; }
  .yuz::after { content: ""; position: absolute; inset: -2px; border-radius: 12px; border: 2px solid var(--vurgu); opacity: 0; pointer-events: none; transition: opacity var(--sure-orta) var(--egri-cikis); }
  .aktif .yuz::after { opacity: 1; }
  .nokta { position: absolute; right: -4px; top: -3px; width: 8px; height: 8px; border-radius: 4px; background: var(--bekliyor); border: 2px solid var(--yuzey-1); }
</style>
