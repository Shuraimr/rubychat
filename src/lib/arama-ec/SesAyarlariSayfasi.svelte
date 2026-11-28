<!--
  Call audio settings sheet (inside AltSayfa): desktop microphone/output pickers, live microphone level meter,
  Android output routing through RubySes, and the shared noise-suppression switch.
  Arama ses ayarları sayfası (AltSayfa içinde): masaüstü mikrofon/çıkış seçicileri, canlı mikrofon seviye göstergesi,
  Android'de RubySes üzerinden çıkış yönlendirmesi ve ortak gürültü engelleme anahtarı.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { yerelAramaAygitlar } from "../api/komutlar";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { titret } from "../dokunma";
  import { ayarlar } from "../durum/ayarlar.svelte";
  import { t } from "../i18n";
  import { ec } from "./ec.svelte";
  import { androidMi, sesCihazlari, sesVarsayilan, type SesCihazi } from "./ses";
  import { sesAyarlari } from "./sesAyarlari.svelte";
  import type { SesAygitlari } from "./tipler";

  let { onkapat }: { onkapat: () => void } = $props();

  const android = androidMi();
  const mikId = "ses-ayar-mik";
  const cikisId = "ses-ayar-cikis";
  const mikrofonKapali = $derived(ec.yerelDurum?.mikrofonKapali ?? false);

  let aygitlar = $state<SesAygitlari | null>(null);
  let yukleniyor = $state(!android);
  let iskelet = $state(false);
  let androidCihazlar = $state<SesCihazi[]>(android ? sesCihazlari() : []);

  const androidSecili = $derived.by(() => {
    if (!android) return "";
    const son = sesAyarlari.androidCikis;
    if (son && androidCihazlar.some((c) => c.id === son)) return son;
    return sesVarsayilan(!ec.sesli || !ec.dm);
  });

  onMount(() => {
    const seviyeBirak = sesAyarlari.seviyeDinle();
    let etkin = true;

    if (android) {
      const yenile = () => {
        androidCihazlar = sesCihazlari();
      };
      yenile();
      window.addEventListener("rubychat-ses-cihazlari", yenile);
      return () => {
        etkin = false;
        seviyeBirak();
        window.removeEventListener("rubychat-ses-cihazlari", yenile);
      };
    }

    // Show skeletons only after 400 ms so local pactl queries never cause a flash.
    // Yerel pactl sorgusu hızlı bitince yanıp sönmesin diye iskeleti yalnız 400 ms sonra göster.
    const iskeletZaman = setTimeout(() => {
      if (etkin && yukleniyor) iskelet = true;
    }, 400);

    void yerelAramaAygitlar()
      .then((sonuc) => {
        if (!etkin) return;
        aygitlar = sonuc;
      })
      .catch(() => {
        if (!etkin) return;
        aygitlar = { girisler: [], cikislar: [], varsayilanGiris: null, varsayilanCikis: null };
      })
      .finally(() => {
        if (!etkin) return;
        clearTimeout(iskeletZaman);
        yukleniyor = false;
        iskelet = false;
      });

    return () => {
      etkin = false;
      clearTimeout(iskeletZaman);
      seviyeBirak();
    };
  });
</script>

{#snippet radyo(etiket: string, secili: boolean, onsec: () => void)}
  <button
    type="button"
    class="radyo"
    class:secili
    role="radio"
    aria-checked={secili}
    title={etiket}
    onclick={() => {
      titret("tik");
      onsec();
    }}
  >
    <span class="radyo-ad">{etiket}</span>
    {#if secili}<span class="onay"><Ikon ad="onay" boyut={20} /></span>{/if}
  </button>
{/snippet}

<AltSayfa baslik={t("yerel.sesAyarlari")} {onkapat}>
  <section class="bolum">
    <h3 id={mikId}>{t("yerel.mikrofon")}</h3>
    {#if !android}
      {#if iskelet}
        <div class="liste" aria-busy="true">
          <div class="iskelet parilti"></div>
          <div class="iskelet parilti"></div>
        </div>
      {:else}
        <div class="liste" role="radiogroup" aria-labelledby={mikId}>
          {@render radyo(t("yerel.sistemVarsayilani"), sesAyarlari.giris === null, () => sesAyarlari.girisSec(null))}
          {#each aygitlar?.girisler ?? [] as a (a.ad)}
            {@render radyo(a.aciklama || a.ad, sesAyarlari.giris === a.ad, () => sesAyarlari.girisSec(a.ad))}
          {/each}
        </div>
      {/if}
    {/if}
    {#if mikrofonKapali}
      <p class="not">{t("yerel.mikrofonKapali")}</p>
    {:else}
      <div
        class="seviye-yol"
        role="meter"
        aria-label={t("yerel.mikrofonSeviyesi")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(sesAyarlari.seviye * 100)}
      >
        <div class="seviye-dolgu" style:transform={`scaleX(${sesAyarlari.seviye})`}></div>
      </div>
    {/if}
  </section>

  <section class="bolum">
    <h3 id={cikisId}>{t("yerel.cikis")}</h3>
    {#if android}
      {#if androidCihazlar.length}
        <div class="liste" role="radiogroup" aria-labelledby={cikisId}>
          {#each androidCihazlar as c (c.id)}
            {@render radyo(c.name, androidSecili === c.id, () => sesAyarlari.androidCikisSec(c.id))}
          {/each}
        </div>
      {:else}
        <p class="not">{t("yerel.aygitYok")}</p>
      {/if}
    {:else if iskelet}
      <div class="liste" aria-busy="true">
        <div class="iskelet parilti"></div>
        <div class="iskelet parilti"></div>
      </div>
    {:else}
      <div class="liste" role="radiogroup" aria-labelledby={cikisId}>
        {@render radyo(t("yerel.sistemVarsayilani"), sesAyarlari.cikis === null, () => sesAyarlari.cikisSec(null))}
        {#each aygitlar?.cikislar ?? [] as a (a.ad)}
          {@render radyo(a.aciklama || a.ad, sesAyarlari.cikis === a.ad, () => sesAyarlari.cikisSec(a.ad))}
        {/each}
      </div>
    {/if}
  </section>

  <section class="bolum">
    <div class="anahtar-satir">
      <div class="anahtar-metin">
        <span class="anahtar-baslik">{t("yerel.gurultu")}</span>
        <span class="not">{t("yerel.gurultuAlt")}</span>
      </div>
      <Anahtar acik={ayarlar.gurultuEngelleme} degis={(v) => sesAyarlari.gurultuSec(v)} etiket={t("yerel.gurultu")} />
    </div>
  </section>
</AltSayfa>

<style>
  .bolum { display: grid; gap: 8px; }
  h3 { font-size: .875rem; font-weight: 600; color: var(--yazi-2); }
  .liste { display: grid; gap: 6px; }
  .radyo {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    width: 100%; min-height: 48px; padding: 0 12px; border-radius: 12px;
    background: var(--yuzey-2); color: var(--yazi); text-align: left; font-size: .9375rem;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  .radyo.secili { background: var(--ton); color: var(--ton-ustu); }
  .radyo-ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .onay { flex: none; display: inline-flex; }
  .iskelet { height: 48px; border-radius: 12px; }
  .seviye-yol { height: 6px; border-radius: 3px; background: var(--yuzey-3); overflow: hidden; }
  /* Compositor-only level bar: scaleX avoids layout work on every 100 ms sample. · Yalnızca birleştirici seviye çubuğu: scaleX her 100 ms örnekte yerleşim hesabını önler. */
  .seviye-dolgu {
    width: 100%; height: 100%; border-radius: 3px; background: var(--vurgu);
    transform-origin: left center;
    transition: transform var(--sure-hizli) linear;
  }
  @media (prefers-reduced-motion: reduce) {
    .seviye-dolgu { transition: none; }
  }
  :global(:root[data-az-animasyon]) .seviye-dolgu { transition: none; }
  .anahtar-satir {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    min-height: 52px; padding: 8px 12px; border-radius: 12px; background: var(--yuzey-2);
  }
  .anahtar-metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .anahtar-baslik { font-size: .9375rem; font-weight: 500; }
  .not { font-size: .8125rem; color: var(--yazi-2); line-height: 1.45; }
</style>
