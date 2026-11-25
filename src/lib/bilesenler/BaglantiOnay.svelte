<!--
  Link sheet (mounted once in App.svelte): the full address, the ways to open it, "always for this site", copy and share.
  Bağlantı sayfası (App.svelte'te bir kez bağlanır): tam adres, açma yolları, "bu site için hep", kopyala ve paylaş.
-->
<script lang="ts">
  import { panoyaYaz } from "../pano";
  import { baglantiOnay } from "../durum/baglantiOnay.svelte";
  import { baglantiTercihi, siteOf } from "../durum/baglantiTercihi.svelte";
  import { acanUygulamalar, disariAc, paylas, paylasVar, sekmeVar, type AcanUygulama } from "../disAc";
  import { bildirim } from "../durum/bildirim.svelte";
  import { titret } from "../dokunma";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Anahtar from "./Anahtar.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";

  const site = $derived(baglantiOnay.url ? siteOf(baglantiOnay.url) : "");
  const kural = $derived(baglantiTercihi.siteler[site]);
  let hep = $state(false);
  let uygulamalar = $state<AcanUygulama[]>([]);
  $effect(() => {
    const u = baglantiOnay.url;
    hep = false;
    uygulamalar = u ? acanUygulamalar(u) : [];
  });
  const yollar = $derived<{ yol: string; ad: string; alt?: string; ikon: IkonAdi }[]>([
    ...(sekmeVar() ? [{ yol: "sekme", ad: t("baglanti.sekme"), alt: t("baglanti.sekmeAlt"), ikon: "sohbet" as const }] : []),
    { yol: "tarayici", ad: t("baglanti.ac"), ikon: "yukari" as const },
    ...uygulamalar.map((a) => ({ yol: a.paket, ad: a.ad, alt: t(a.tarayici ? "baglanti.tarayici" : "baglanti.uygulama"), ikon: (a.tarayici ? "yukari" : "cihaz") as IkonAdi })),
  ]);

  const kapat = () => (baglantiOnay.url = null);
  async function ac(yol: string, ad: string) {
    const url = baglantiOnay.url;
    if (!url) return;
    titret("tik");
    if (hep) baglantiTercihi.siteYaz(site, { yol, ad });
    kapat();
    try {
      await disariAc(url, yol);
    } catch {
      bildirim.goster(t("baglanti.acilamadi"), 4000, { tur: "hata" });
    }
  }
  async function kopyala() {
    try {
      await panoyaYaz(baglantiOnay.url ?? "");
      bildirim.goster(t("baglanti.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
    kapat();
  }
</script>

{#if baglantiOnay.url}
  <AltSayfa baslik={site || t("baglanti.ayrilis")} onkapat={kapat}>
    {#if baglantiOnay.supheli}<p class="uyari"><Ikon ad="uyari" boyut={18} />{t("baglanti.supheli")}</p>{/if}
    <p class="adres">{baglantiOnay.url}</p>
    <div class="ay-kart">
      {#each yollar as y (y.yol)}
        <button class="ay-satir dugme" data-dalga onclick={() => void ac(y.yol, y.ad)}>
          <span class="ay-simge" style:--r={kural?.yol === y.yol ? "var(--vurgu)" : "var(--tas-ametist)"}><Ikon ad={kural?.yol === y.yol ? "onay" : y.ikon} boyut={20} /></span>
          <span class="ay-metin"><strong>{y.ad}</strong>{#if y.alt}<span>{y.alt}</span>{/if}</span>
        </button>
      {/each}
    </div>
    {#if site}
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin"><strong>{t("baglanti.hep", { site })}</strong><span>{kural ? t("baglanti.kuralVar", { ad: kural.ad }) : t("baglanti.hepAlt")}</span></span>
          <Anahtar acik={hep} degis={(v) => (hep = v)} etiket={t("baglanti.hep", { site })} />
        </div>
        {#if kural}<button class="ay-satir dugme" data-dalga onclick={() => baglantiTercihi.siteYaz(site, null)}><span class="ay-metin"><strong>{t("baglanti.kuralSil")}</strong></span><Ikon ad="cop" boyut={20} /></button>{/if}
      </div>
    {/if}
    <div class="dugmeler">
      <button class="buton tonlu" onclick={kopyala}><Ikon ad="kopya" boyut={18} />{t("baglanti.kopyala")}</button>
      {#if paylasVar()}<button class="buton tonlu" onclick={() => { const u = baglantiOnay.url; kapat(); if (u) paylas(u); }}><Ikon ad="ilet" boyut={18} />{t("baglanti.paylas")}</button>{/if}
    </div>
  </AltSayfa>
{/if}

<style>
  .uyari { display: flex; gap: .5rem; align-items: center; font-size: .875rem; color: var(--bekliyor); }
  .adres { font-family: var(--mono-tipi); font-size: .8125rem; padding: .75rem 1rem; border-radius: 1rem; background: var(--yuzey-2); word-break: break-all; max-height: 6rem; overflow-y: auto; -webkit-user-select: text; user-select: text; }
  .dugmeler { display: flex; flex-wrap: wrap; gap: .5rem; }
  .dugmeler > * { flex: 1 1 8rem; }
</style>
