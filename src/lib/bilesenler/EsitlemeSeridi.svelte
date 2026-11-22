<!--
  Sync strip under a header, ONLY when there is a problem (design section 8): offline (yellow), connecting (grey), stopped (red + "Tekrar dene").
  Başlığın altında eşitleme şeridi, YALNIZCA sorun varken (tasarım bölüm 8): çevrimdışı (sarı), bağlanıyor (gri), durdu (kırmızı + "Tekrar dene").
-->
<script lang="ts">
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  // "basliyor" is the normal start-up: the strip would flash on every launch, so it only shows once a list already exists.
  // "basliyor" normal açılıştır: şerit her açılışta yanıp sönerdi; yalnızca liste zaten varken gösterilir.
  const durum = $derived(odalar.esitleme.durum);
  const gorunur = $derived(durum === "cevrimdisi" || durum === "hata" || (durum === "basliyor" && odalar.ilkListeGeldi));
</script>

{#if gorunur}
  <div class="serit" class:sari={durum === "cevrimdisi"} class:kirmizi={durum === "hata"} role="status">
    <Ikon ad={durum === "cevrimdisi" ? "bulutYok" : durum === "hata" ? "uyari" : "yenile"} boyut={16} />
    <span class="metin">{durum === "cevrimdisi" ? t("esitleme.seridi") : durum === "hata" ? t("esitleme.durdu") : t("esitleme.baglaniyor")}</span>
    {#if durum === "hata"}<button class="tekrar" onclick={() => void odalar.baslat()}>{t("eylem.tekrarDene")}</button>{/if}
  </div>
{/if}

<style>
  .serit { flex: none; min-height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 16px; font-size: .8125rem; font-weight: 500; background: var(--yuzey-2); color: var(--yazi-2); border-bottom: 1px solid var(--kenar-ince); }
  .serit.sari { background: color-mix(in srgb, var(--bekliyor) 14%, var(--yuzey-1)); color: var(--bekliyor); }
  .serit.kirmizi { color: var(--hata); }
  .metin { flex: 1; min-width: 0; }
  .tekrar { min-height: 44px; padding: 0 8px; margin-right: -8px; color: var(--vurgu); font-weight: 600; font-size: .8125rem; }
</style>
