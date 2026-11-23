<!--
  In-app browser layer (full screen): shows a web page inside the app, used for the account pages of an OIDC server (matrix.org: password,
  e-mail, sessions, deactivation). It is a back-button LAYER. Many identity providers forbid framing (X-Frame-Options / frame-ancestors); a
  blocked frame cannot be detected from script, so the header ALWAYS offers "Tarayıcıda aç" (system browser via disAc.ts) and a hint appears
  if the page has not reported loading after a few seconds.
  Uygulama içi tarayıcı katmanı (tam ekran): bir web sayfasını uygulamanın içinde gösterir; OIDC sunucusunun hesap sayfaları için (matrix.org:
  şifre, e-posta, oturumlar, hesap kapatma). Geri tuşu KATMANIDIR. Pek çok kimlik sağlayıcı çerçevelenmeyi yasaklar (X-Frame-Options /
  frame-ancestors); engellenen çerçeve betikten anlaşılamaz; bu yüzden başlık HEP "Tarayıcıda aç" sunar (disAc.ts ile sistem tarayıcısı) ve sayfa
  birkaç saniye içinde yüklendiğini bildirmezse bir ipucu çıkar.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { disariAc } from "../disAc";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { url, baslik, onkapat }: { url: string; baslik: string; onkapat: () => void } = $props();
  let katman = 0;
  let yuklendi = $state(false);
  let ipucu = $state(false);

  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
    const z = setTimeout(() => (ipucu = !yuklendi), 5000);
    return () => clearTimeout(z);
  });
  onDestroy(() => gezinme.katmanBirak(katman));
</script>

<div class="kap" in:kayGir out:kayCik>
  <header>
    <button class="simge-dugme" aria-label={t("oda.geri")} onclick={() => gezinme.katmanKapat(katman)}><Ikon ad="geri" /></button>
    <h2>{baslik}</h2>
    <button class="buton tonlu ac" onclick={() => void disariAc(url)}>{t("hesap.tarayicidaAc")}</button>
  </header>
  {#if ipucu && !yuklendi}<p class="ipucu" role="status">{t("hesap.cerceveIpucu")}</p>{/if}
  <iframe title={baslik} src={url} referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" onload={() => (yuklendi = true)}></iframe>
</div>

<style>
  .kap { position: fixed; inset: 0; z-index: 34; display: flex; flex-direction: column; background: var(--zemin); }
  header { flex: none; display: flex; align-items: center; gap: .5rem; min-height: 3.5rem; box-sizing: content-box; padding: env(safe-area-inset-top) .5rem 0 .5rem; border-bottom: 1px solid var(--kenar-ince); background: var(--yuzey-1); }
  h2 { flex: 1; min-width: 0; font-size: 1.0625rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ac { width: auto; min-height: 2.75rem; padding: 0 .875rem; font-size: .8125rem; }
  .ipucu { padding: .75rem 1rem; font-size: .875rem; color: var(--bekliyor); background: var(--yuzey-1); }
  iframe { flex: 1; min-height: 0; width: 100%; border: 0; background: #fff; }
</style>
