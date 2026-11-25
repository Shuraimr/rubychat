<!--
  Full-screen call layer: Element Call in an <iframe> under a slim header with the minimise button. Back (Android) / Escape / the chevron
  MINIMISE it to the green bar (EcCubuk); the iframe stays mounted so the call keeps running. Hanging up is EC's own red button.
  Tam ekran arama katmanı: ince bir başlığın altında <iframe> içinde Element Call; başlıkta küçültme düğmesi var. Geri (Android) / Escape /
  ok simgesi onu yeşil çubuğa (EcCubuk) KÜÇÜLTÜR; iframe takılı kalır, arama sürer. Kapatmak EC'nin kendi kırmızı düğmesidir.
-->
<script lang="ts">
  import Ikon from "../bilesenler/Ikon.svelte";
  import { t } from "../i18n";
  import { sureYaz } from "../zaman-bicim";
  import YerelArama from "./YerelArama.svelte";
  import { ec } from "./ec.svelte";
  import { androidMi } from "./ses";

  let iframe = $state<HTMLIFrameElement | null>(null);
  $effect(() => ec.iframeBagla(iframe));

  const durum = $derived(ec.asama === "yukleniyor" ? t("arama.ec.hazirlaniyor") : ec.asama === "acik" ? sureYaz(ec.sure) : "");
  const android = androidMi();
</script>

{#if ec.yerel}
  <YerelArama />
{:else if ec.gorunur}
  <div class="kapsam" class:gizli={!ec.ekranAcik} inert={!ec.ekranAcik} role="dialog" aria-modal="true" aria-label={ec.ad}>
    <header>
      <button class="simge-dugme" onclick={() => (ec.asama === "hata" ? ec.hataKapat() : ec.kucult())} aria-label={ec.asama === "hata" ? t("arama.kapat") : t("arama.ekraniKapat")}>
        <Ikon ad={ec.asama === "hata" ? "kapat" : "asagiOk"} />
      </button>
      <div class="adlar">
        <strong>{ec.ad}</strong>
        <span class="durum">{durum}</span>
      </div>
    </header>
    <div class="govde">
      {#if ec.url}
        <!-- allow: EC asks for the mic/camera/screen itself; autoplay = remote audio without a tap. -->
        <!-- allow: mikrofon/kamera/ekranı EC kendisi ister; autoplay = dokunmadan uzak ses. -->
        <iframe
          bind:this={iframe}
          title={t("arama.ec.baslik")}
          src={ec.url}
          allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
        ></iframe>
      {/if}
      {#if ec.asama === "yukleniyor"}
        <div class="ortu" role="status">
          <p>{t("arama.ec.hazirlaniyor")}</p>
          {#if ec.yedekte}<p class="not">{t("arama.ec.yedekte")}</p>{/if}
          {#if android}<p class="not">{t("arama.ec.ekranPaylasimiAndroid")}</p>{/if}
        </div>
      {:else if ec.asama === "hata"}
        <div class="ortu" role="alert">
          <p>{ec.hata ? t(ec.hata) : ""}</p>
          <button class="kapat" onclick={() => ec.hataKapat()}>{t("arama.kapat")}</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .kapsam { position: fixed; inset: 0; z-index: 40; background: var(--zemin); display: flex; flex-direction: column; }
  /* Minimised: invisible but still mounted, so audio and the connection keep running. · Küçültülmüş: görünmez ama takılı; ses ve bağlantı sürer. */
  .kapsam.gizli { visibility: hidden; pointer-events: none; }
  header {
    flex: none; display: flex; align-items: center; gap: 4px; min-height: 52px;
    padding: env(safe-area-inset-top) calc(8px + env(safe-area-inset-right)) 0 calc(8px + env(safe-area-inset-left));
  }
  .adlar { min-width: 0; display: grid; }
  .adlar strong { font-size: .9375rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .durum { font-size: .75rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .govde { position: relative; flex: 1; min-height: 0; padding-bottom: env(safe-area-inset-bottom); }
  iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--zemin); color-scheme: normal; }
  .ortu {
    position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: 8px; padding: 24px;
    background: var(--zemin); text-align: center; color: var(--yazi);
  }
  .not { font-size: .8125rem; color: var(--yazi-2); max-width: 32ch; }
  .kapat { min-height: 44px; padding: 0 24px; border-radius: 22px; background: var(--yuzey-2); color: var(--yazi); font-weight: 600; }
  .kapat:active { background: var(--yuzey-3); }
</style>
