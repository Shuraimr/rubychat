<!--
  Ben › Hakkında: the mascot, version, licenses (AGPL app, OFL fonts, matrix-rust-sdk) and the source link.
  Ben › Hakkında: maskot, sürüm, lisanslar (AGPL uygulama, OFL yazı tipleri, matrix-rust-sdk) ve kaynak kodu bağlantısı.
-->
<script lang="ts">
  import { acilisOrtalamasi } from "../durum/onYukle.svelte";
  import { onMount } from "svelte";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";

  // Vendored icon packs and their license texts (public/lisanslar) · Alınan simge paketleri ve lisans metinleri (public/lisanslar)
  const LISANSLAR = [
    { dosya: "material", ad: "Material Symbols", tur: "Apache-2.0 · Google" },
    { dosya: "unicode", ad: "Unicode Emoji + CLDR", tur: "Unicode-DFS-2016" },
  ];
  let lisansMetni = $state<{ ad: string; metin: string } | null>(null);
  async function lisansAc(dosya: string, ad: string) {
    try {
      lisansMetni = { ad, metin: await (await fetch(`/lisanslar/${dosya}.txt`)).text() };
    } catch {
      lisansMetni = { ad, metin: "—" };
    }
  }
  const olcum = acilisOrtalamasi();
  let surum = $state("");
  onMount(() => {
    // The app version from Tauri; absent in a plain browser. · Tauri'den uygulama sürümü; sade tarayıcıda yok.
    import("../api/komutlar").then((m) => m.uygulamaSurumu()).then((v) => (surum = v)).catch(() => {});
  });
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("ayar.hakkinda")} geri={() => gezinme.benAltKapat()} />
  <div class="ay-icerik">
    <div class="ust"><Maskot poz="selam" boyut={144} /><h2>rubychat</h2><p class="ay-not">{t("ayar.hakkindaAlt")}</p></div>
    <div class="ay-kart">
      {#if olcum.hazir !== null || olcum.soguk !== null}<div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.odaAcilisi")}</strong><span>{t("ayar.odaAcilisiAlt", { hazir: olcum.hazir ?? "–", soguk: olcum.soguk ?? "–" })}</span></span></div>{/if}
      {#if surum}<div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.surum")}</strong></span><span class="deger">{surum}</span></div>{/if}
      <button class="ay-satir dugme" data-dalga onclick={() => baglantiAc("https://github.com/Shuraimr/rubychat")}><span class="ay-metin"><strong>{t("ayar.github")}</strong></span><Ikon ad="sagOk" boyut={20} /></button>
    </div>
    <section class="ay-bolum">
      <h2>{t("ayar.lisanslar")}</h2>
      <div class="ay-kart govde lisans">
        <p>{t("ayar.lisansUygulama")}</p>
        <p>{t("ayar.lisansYazi")}</p>
        <p>{t("ayar.lisansSdk")}</p>
        <p>{t("ayar.lisansEc")}</p>
        <p>{t("ayar.lisansSimgeler")}</p>
        <div class="lisans-liste">
          {#each LISANSLAR as l (l.dosya)}
            <button class="lisans-baglanti" data-dalga onclick={() => lisansAc(l.dosya, l.ad)}><strong>{l.ad}</strong><span>{l.tur}</span></button>
          {/each}
        </div>
        <button class="ec-kaynak" data-dalga onclick={() => baglantiAc("https://github.com/element-hq/element-call")}>github.com/element-hq/element-call</button>
      </div>
    </section>
  </div>
</div>

{#if lisansMetni}
  <AltSayfa baslik={lisansMetni.ad} onkapat={() => (lisansMetni = null)}><pre class="lisans-metin">{lisansMetni.metin}</pre></AltSayfa>
{/if}

<style>
  .lisans-metin { margin: 0; font-family: var(--mono-tipi); font-size: .75rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--yazi-2); user-select: text; -webkit-user-select: text; }
  .ust { display: grid; justify-items: center; gap: 4px; text-align: center; padding-top: 8px; }
  .ust h2 { font-size: 1.5rem; }
  .deger { color: var(--yazi-2); font-family: var(--mono-tipi); font-size: .875rem; }
  .lisans-liste { display: grid; gap: .25rem; }
  .lisans-baglanti { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .25rem .75rem; min-height: 2.75rem; align-items: center; color: var(--vurgu); text-decoration: none; }
  .lisans-baglanti span { color: var(--yazi-2); font-size: .8125rem; }
  .lisans { gap: .625rem; font-size: .875rem; color: var(--yazi-2); line-height: 1.5; }
  .lisans p { margin: 0; }
  .ec-kaynak { justify-self: start; min-height: 44px; color: var(--vurgu); font-size: .875rem; text-align: left; }
</style>
