<!--
  Green bar at the top of the app while an Element Call call runs minimised: "ayse ile görüşme · 02:14   Dön", plus a hang-up button.
  Element Call aramasi küçültülmüşken uygulamanın üstündeki yeşil çubuk: "ayse ile görüşme · 02:14   Dön" ve kapatma düğmesi.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { sureYaz } from "../zaman-bicim";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { ec } from "./ec.svelte";
</script>

{#if ec.etkin && !ec.ekranAcik}
  <div class="cubuk">
    <button class="don" onclick={() => ec.ekranAc()} aria-label={t("arama.ekranaDon")}>
      <Ikon ad="telefon" boyut={18} />
      <span class="metin">{ec.asama === "acik" ? t("arama.cubuk", { ad: ec.ad, sure: sureYaz(ec.sure) }) : t("arama.baglaniyor")}</span>
      <span class="geri">{t("arama.don")}</span>
    </button>
    <button class="kapat" onclick={() => ec.kapat()} aria-label={t("arama.kapat")}><Ikon ad="telefonKapat" boyut={20} /></button>
  </div>
{/if}

<style>
  .cubuk {
    flex: none; width: 100%; box-sizing: border-box; display: flex; align-items: center; padding-top: env(safe-area-inset-top);
    padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);
    /* dark text on the green status colour */
    background: var(--cozum); color: var(--zemin); font-size: .9375rem; font-weight: 600;
  }
  .don { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 16px; text-align: left; color: inherit; }
  .don:active { opacity: .85; }
  .metin { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .geri { font-weight: 700; }
  .kapat { flex: none; width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; color: inherit; }
  .kapat:active { opacity: .7; }
</style>
