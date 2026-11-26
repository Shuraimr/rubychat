<!--
  Notification center panel (mounted once in App.svelte):
   - Phone (!gezinme.genis): bottom sheet via AltSayfa
   - Wide screen (gezinme.genis): 380px popover anchored beneath the bell button, with outside-click, Escape and focus trap.
  Bildirim merkezi paneli (App.svelte'te bir kez bağlanır):
   - Telefon (!gezinme.genis): AltSayfa ile alt sayfa
   - Geniş ekran (gezinme.genis): zil düğmesinin altında 380px açılır panel; dışarı tıklama, Esc ve odak tuzağı ile.
-->
<script lang="ts">
  import { bildirimMerkezi, type BildirimOgesi } from "../durum/bildirimMerkezi.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { guncelleme } from "../durum/guncelleme.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import { kurulumRaporuAc } from "../durum/kurulum.svelte";
  import { menuCik, menuGir } from "../gecis";
  import { t } from "../i18n";
  import { goreliZaman } from "../zaman-bicim";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import BosDurum from "./BosDurum.svelte";
  import Ikon from "./Ikon.svelte";

  const okunmamislar = $derived(bildirimMerkezi.ogeler.filter((o) => !o.okundu));
  const okunmuslar = $derived(bildirimMerkezi.ogeler.filter((o) => o.okundu));

  let panelEl: HTMLDivElement | undefined = $state();
  let konum = $state({ top: 64, left: 16, maksYuk: 480 });

  function konumOlc() {
    const en = Math.min(380, window.innerWidth - 24);
    const kaynak = bildirimMerkezi.tetik ?? document.querySelector<HTMLElement>('[data-zil-hedef="zil"]');
    const r = kaynak?.getBoundingClientRect();
    const top = r && r.height > 0 ? Math.min(r.bottom + 8, window.innerHeight - 200) : 64;
    const hedefSol = r && r.width > 0 ? r.right - en : 16;
    const left = Math.max(12, Math.min(hedefSol, window.innerWidth - en - 12));
    const maksYuk = Math.max(220, Math.min(540, window.innerHeight - top - 16));
    konum = { top, left, maksYuk };
  }

  // Wide-screen popover lifecycle: layer stack (Esc/back), anchor measurement, focus management & restoration.
  // Geniş ekran açılır panel yaşam döngüsü: katman yığını (Esc/geri), konum ölçümü, odak yönetimi ve odağı geri verme.
  $effect(() => {
    if (!bildirimMerkezi.acik || !gezinme.genis) return;
    konumOlc();
    const oncekiOdak = bildirimMerkezi.tetik ?? (document.activeElement as HTMLElement | null);
    const katmanId = gezinme.katmanAc(() => {
      bildirimMerkezi.kapat();
    });
    const yeniden = () => konumOlc();
    window.addEventListener("resize", yeniden);
    window.addEventListener("keydown", tus);
    queueMicrotask(() => panelEl?.focus());
    return () => {
      window.removeEventListener("resize", yeniden);
      window.removeEventListener("keydown", tus);
      gezinme.katmanBirak(katmanId);
      if (oncekiOdak && document.contains(oncekiOdak)) oncekiOdak.focus();
    };
  });

  // Keep Tab focus inside the wide popover while it is open. · Açıkken Tab odağını geniş açılır panelin içinde tut.
  function tus(e: KeyboardEvent) {
    if (e.key !== "Tab" || !panelEl) return;
    const hedefler = Array.from(
      panelEl.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => el.offsetParent !== null);
    if (hedefler.length === 0) {
      e.preventDefault();
      panelEl.focus();
      return;
    }
    const ilk = hedefler[0];
    const son = hedefler[hedefler.length - 1];
    if (e.shiftKey && (document.activeElement === ilk || document.activeElement === panelEl)) {
      e.preventDefault();
      son.focus();
    } else if (!e.shiftKey && document.activeElement === son) {
      e.preventDefault();
      ilk.focus();
    }
  }

  function baglamMetni(o: BildirimOgesi): string {
    if (o.tur === "guncelleme") return t("bildirimMerkezi.guncellemeBaglam");
    if (o.tur === "kurulum") return t("bildirimMerkezi.kurulumBaglam");
    if (o.tur === "davet") return t("bildirimMerkezi.davetBaglam");
    if (o.tur === "bahsetme") return o.baglam ? `${o.baglam} · @` : t("bildirimMerkezi.bahsetme");
    return o.baglam || o.baslik;
  }

  function satiraDokun(o: BildirimOgesi) {
    bildirimMerkezi.okunduSay(o.id);
    bildirimMerkezi.kapat();
    if (o.tur === "mesaj" || o.tur === "bahsetme") {
      if (o.odaId) gezinme.odaAc(o.odaId);
    } else if (o.tur === "davet") {
      istekler.ac();
    } else if (o.tur === "guncelleme") {
      guncelleme.sayfaAc();
    } else if (o.tur === "kurulum") {
      kurulumRaporuAc();
    }
  }

  function guncellemeBaslat(o: BildirimOgesi) {
    bildirimMerkezi.okunduSay(o.id);
    bildirimMerkezi.kapat();
    guncelleme.sayfaAc();
    void guncelleme.baslat();
  }

  function guncellemeNotlari(o: BildirimOgesi) {
    bildirimMerkezi.okunduSay(o.id);
    bildirimMerkezi.kapat();
    guncelleme.sayfaAc();
  }
</script>

{#snippet satir(o: BildirimOgesi)}
  <div class="satir-kutu" class:okunmamis={!o.okundu}>
    <button class="satir" type="button" data-dalga onclick={() => satiraDokun(o)}>
      {#if o.tur === "guncelleme"}
        <span class="simge-kutu ton" aria-hidden="true"><Ikon ad="indir" boyut={20} /></span>
      {:else if o.tur === "kurulum"}
        <span class="simge-kutu" class:uyari={!!o.uyari} class:ton={!o.uyari} aria-hidden="true"><Ikon ad="kalkan" boyut={20} /></span>
      {:else}
        <Avatar harf={o.harf || o.baslik.charAt(0).toUpperCase() || "#"} mxc={o.avatarMxc ?? null} boyut={40} />
      {/if}
      <span class="govde">
        <span class="baglam" class:vurgulu={o.tur === "bahsetme"}>{baglamMetni(o)}</span>
        <strong class="satir-baslik">{o.baslik}</strong>
        {#if o.metin}<span class="satir-metin">{o.metin}</span>{/if}
      </span>
      <span class="sag">
        <span class="zaman">{goreliZaman(o.zaman)}</span>
        {#if !o.okundu}<span class="nokta" aria-hidden="true"></span>{/if}
      </span>
    </button>
    {#if gezinme.genis && o.tur === "guncelleme"}
      <div class="guncelle-eylemler">
        <button class="kucuk-dugme vurgu" type="button" onclick={() => guncellemeBaslat(o)}>{t("guncelleme.guncelle")}</button>
        <button class="kucuk-dugme" type="button" onclick={() => bildirimMerkezi.okunduSay(o.id)}>{t("bildirimMerkezi.sonra")}</button>
        <button class="kucuk-dugme" type="button" onclick={() => guncellemeNotlari(o)}>{t("bildirimMerkezi.notlar")}</button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet listeIcerigi()}
  {#if bildirimMerkezi.ogeler.length === 0}
    <BosDurum maskot="selam" boyut={96} baslik={t("bildirimMerkezi.bos")} metin={t("bildirimMerkezi.bosAlt")} />
  {:else}
    <div class="liste">
      {#if okunmamislar.length > 0}
        <div class="ayrac" role="heading" aria-level="3">{t("bildirimMerkezi.yeni")}</div>
        {#each okunmamislar as o (o.id)}
          {@render satir(o)}
        {/each}
      {/if}
      {#if okunmuslar.length > 0}
        {#if okunmamislar.length > 0}
          <div class="ayrac eski" role="heading" aria-level="3">{t("bildirimMerkezi.onceki")}</div>
        {/if}
        {#each okunmuslar as o (o.id)}
          {@render satir(o)}
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

{#if bildirimMerkezi.acik}
  {#if !gezinme.genis}
    <AltSayfa baslik={t("bildirimMerkezi.baslik")} onkapat={() => bildirimMerkezi.kapat()}>
      {#snippet ustEylem()}
        {#if bildirimMerkezi.okunmamis > 0}
          <button class="tumunu-oku" type="button" onclick={() => bildirimMerkezi.tumunuOkunduSay()}>
            {t("bildirimMerkezi.tumunuOkundu")}
          </button>
        {/if}
      {/snippet}
      {@render listeIcerigi()}
    </AltSayfa>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="dis-perde" onclick={() => bildirimMerkezi.kapat()}></div>
    <div
      bind:this={panelEl}
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-label={t("bildirimMerkezi.baslik")}
      tabindex="-1"
      style:top="{konum.top}px"
      style:left="{konum.left}px"
      style:max-height="{konum.maksYuk}px"
      in:menuGir
      out:menuCik
    >
      <header class="panel-ust">
        <h2>{t("bildirimMerkezi.baslik")}</h2>
        {#if bildirimMerkezi.okunmamis > 0}
          <button class="tumunu-oku" type="button" onclick={() => bildirimMerkezi.tumunuOkunduSay()}>
            {t("bildirimMerkezi.tumunuOkundu")}
          </button>
        {/if}
      </header>
      <div class="panel-govde">
        {@render listeIcerigi()}
      </div>
    </div>
  {/if}
{/if}

<style>
  .dis-perde {
    position: fixed;
    inset: 0;
    z-index: 34;
    background: transparent;
  }
  .panel {
    position: fixed;
    z-index: 35;
    width: min(380px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    background: var(--yuzey-2);
    color: var(--yazi);
    border-radius: 16px;
    border: 1px solid var(--kenar-ince);
    box-shadow: var(--kat-2);
    transform-origin: top right;
    outline: none;
    overflow: hidden;
  }
  .panel-ust {
    flex: none;
    min-height: 56px;
    padding: 6px 8px 6px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .panel-ust h2 {
    font-size: 1.125rem;
    line-height: 1.3;
    font-weight: 600;
  }
  .panel-govde {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px;
  }
  .tumunu-oku {
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    font-size: .8125rem;
    font-weight: 600;
    color: var(--vurgu);
    white-space: nowrap;
  }
  @media (hover: hover) {
    .tumunu-oku:hover {
      background: var(--yuzey-3);
    }
  }
  .tumunu-oku:active {
    background: var(--yuzey-3);
  }

  .liste {
    display: grid;
    gap: 4px;
  }
  .ayrac {
    padding: 6px 10px 4px;
    font-size: .6875rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--vurgu);
  }
  .ayrac.eski {
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--kenar-ince);
    color: var(--yazi-2);
  }

  .satir-kutu {
    border-radius: 14px;
    overflow: hidden;
  }
  .satir-kutu.okunmamis {
    background: color-mix(in srgb, var(--ton) 35%, transparent);
  }
  .satir {
    width: 100%;
    min-height: 60px;
    padding: 10px 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    text-align: left;
    color: var(--yazi);
    border-radius: 14px;
  }
  @media (hover: hover) {
    .satir:hover {
      background: var(--yuzey-3);
    }
  }
  .satir:active {
    background: var(--yuzey-3);
  }

  .simge-kutu {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .simge-kutu.ton {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .simge-kutu.uyari {
    background: color-mix(in srgb, var(--bekliyor) 18%, var(--zemin));
    color: var(--bekliyor);
  }

  .govde {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .baglam {
    font-size: .75rem;
    line-height: 1.3;
    color: var(--yazi-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .baglam.vurgulu {
    color: var(--vurgu);
    font-weight: 600;
  }
  .satir-baslik {
    font-size: .9375rem;
    line-height: 1.3;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .satir-metin {
    font-size: .8125rem;
    line-height: 1.35;
    color: var(--yazi-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sag {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding-top: 2px;
  }
  .zaman {
    font-size: .75rem;
    color: var(--yazi-2);
    white-space: nowrap;
  }
  .nokta {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--vurgu);
  }

  .guncelle-eylemler {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px 8px 64px;
    flex-wrap: wrap;
  }
  .kucuk-dugme {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    font-size: .8125rem;
    font-weight: 600;
    color: var(--yazi-2);
  }
  .kucuk-dugme.vurgu {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  @media (hover: hover) {
    .kucuk-dugme:not(.vurgu):hover {
      background: var(--yuzey-3);
      color: var(--yazi);
    }
  }
  .kucuk-dugme:active {
    opacity: .82;
  }
</style>
