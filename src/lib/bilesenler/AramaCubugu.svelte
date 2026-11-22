<!--
  Pinned green bar at the top of the app while a call runs in the background: "ayse ile görüşme · 02:14   Dön" (design section 8).
  Arama arka plandayken uygulamanın üstüne sabit yeşil çubuk: "ayse ile görüşme · 02:14   Dön" (tasarım bölüm 8).
-->
<script lang="ts">
  import { arama } from "../durum/arama.svelte";
  import { t } from "../i18n";
  import { sureYaz } from "../zaman-bicim";
  import Ikon from "./Ikon.svelte";
</script>

{#if arama.etkin && !arama.ekranAcik}
  <button class="cubuk" onclick={() => arama.ekranAc()} aria-label={t("arama.ekranaDon")}>
    <Ikon ad="telefon" boyut={18} />
    <span class="metin">
      {arama.asama === "bagli" ? t("arama.cubuk", { ad: arama.ad, sure: sureYaz(arama.sure) }) : arama.asama === "caliyor" ? t("arama.gelen") : t("arama.ariyor")}
    </span>
    <span class="geri">{t("arama.don")}</span>
  </button>
{/if}

<style>
  .cubuk {
    flex: none; width: 100%; box-sizing: border-box; min-height: calc(44px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top);
    display: flex; align-items: center; gap: 10px; padding-left: calc(16px + env(safe-area-inset-left)); padding-right: calc(16px + env(safe-area-inset-right));
    /* dark text on the green status colour (page background colour = dark in dark theme, light in light theme) */
    background: var(--cozum); color: var(--zemin); font-size: .9375rem; font-weight: 600; text-align: left;
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .cubuk:active { opacity: .85; }
  .metin { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .geri { font-weight: 700; }
</style>
