<!--
  "X yazıyor…" line above the composer: one name, two names or "N kişi yazıyor…". It takes no room while nobody types (the row is not rendered),
  so the timeline does not jump; the three dots pulse unless motion is reduced.
  Yazma alanının üstündeki "X yazıyor…" satırı: bir ad, iki ad ya da "N kişi yazıyor…". Kimse yazmıyorken yer kaplamaz (satır çizilmez), böylece
  çizelge zıplamaz; hareket azaltılmadıkça üç nokta atar.
-->
<script lang="ts">
  import type { KisiBilgisi } from "../api/tipler";
  import { t } from "../i18n";

  let { kisiler }: { kisiler: KisiBilgisi[] } = $props();
  const metin = $derived(
    kisiler.length === 1
      ? t("yaziyor.bir", { ad: kisiler[0].ad })
      : kisiler.length === 2
        ? t("yaziyor.iki", { a: kisiler[0].ad, b: kisiler[1].ad })
        : t("yaziyor.cok", { n: kisiler.length }),
  );
</script>

{#if kisiler.length > 0}
  <div class="satir" role="status" aria-live="polite">
    <span class="noktalar" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="metin">{metin}</span>
  </div>
{/if}

<style>
  .satir { display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 2px 16px 0; font-size: .75rem; color: var(--yazi-2); }
  .metin { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .noktalar { display: inline-flex; gap: 3px; }
  i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: at calc(1.2s * var(--hareket)) ease-in-out infinite; }
  i:nth-child(2) { animation-delay: .15s; }
  i:nth-child(3) { animation-delay: .3s; }
  @keyframes at { 0%, 60%, 100% { opacity: .35; } 30% { opacity: 1; } }
</style>
