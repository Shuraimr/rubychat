<!--
  Ben › Hakkında: the mascot, version, licenses (AGPL app, OFL fonts, matrix-rust-sdk) and the source link.
  Ben › Hakkında: maskot, sürüm, lisanslar (AGPL uygulama, OFL yazı tipleri, matrix-rust-sdk) ve kaynak kodu bağlantısı.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";

  let surum = $state("");
  onMount(() => {
    // The app version from Tauri; absent in a plain browser. · Tauri'den uygulama sürümü; sade tarayıcıda yok.
    import("@tauri-apps/api/app").then((m) => m.getVersion()).then((v) => (surum = v)).catch(() => {});
  });
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("ayar.hakkinda")} geri={() => gezinme.benAltKapat()} />
  <div class="ay-icerik">
    <div class="ust"><Maskot poz="selam" boyut={144} /><h2>rubychat</h2><p class="ay-not">{t("ayar.hakkindaAlt")}</p></div>
    <div class="ay-kart">
      {#if surum}<div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.surum")}</strong></span><span class="deger">{surum}</span></div>{/if}
      <button class="ay-satir dugme" data-dalga onclick={() => baglantiAc("https://github.com/Shuraimr/rubychat")}><span class="ay-metin"><strong>{t("ayar.github")}</strong></span><Ikon ad="sagOk" boyut={20} /></button>
    </div>
    <section class="ay-bolum">
      <h2 class="baslik">{t("ayar.lisanslar")}</h2>
      <div class="ay-kart lisans">
        <p>{t("ayar.lisansUygulama")}</p>
        <p>{t("ayar.lisansYazi")}</p>
        <p>{t("ayar.lisansSdk")}</p>
      </div>
    </section>
  </div>
</div>

<style>
  .ust { display: grid; justify-items: center; gap: 4px; text-align: center; padding-top: 8px; }
  .ust h2 { font-size: 1.5rem; }
  .deger { padding-right: 16px; color: var(--yazi-2); font-family: var(--mono-tipi); font-size: .875rem; }
  .baslik { font-size: .8125rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--yazi-2); padding: 0 4px; }
  .lisans { padding: 12px 16px; gap: 10px; font-size: .875rem; color: var(--yazi-2); line-height: 1.5; }
  .lisans p { margin: 0; }
</style>
