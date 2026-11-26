<!--
  Sync strip under a header, ONLY when there is a problem (design section 8): offline (yellow), connecting (grey), stopped (red + "Tekrar dene"),
  session closed by the server (red + "Yeniden gir": signs out here so the person can sign in again).
  Başlığın altında eşitleme şeridi, YALNIZCA sorun varken (tasarım bölüm 8): çevrimdışı (sarı), bağlanıyor (gri), durdu (kırmızı + "Tekrar dene"),
  sunucunun kapattığı oturum (kırmızı + "Yeniden gir": burada çıkış yapar, kişi yeniden girer).
-->
<script lang="ts">
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";
  import Maskot from "./Maskot.svelte";

  // "basliyor" is the normal start-up: the strip would flash on every launch, so it only shows once a list already exists.
  // "basliyor" normal açılıştır: şerit her açılışta yanıp sönerdi; yalnızca liste zaten varken gösterilir.
  const durum = $derived(odalar.esitleme.durum);
  const kapali = $derived(durum === "oturum_kapali");
  const gorunur = $derived(durum === "cevrimdisi" || durum === "hata" || kapali || (durum === "basliyor" && odalar.ilkListeGeldi));
</script>

{#if gorunur}
  <div class="serit" class:sari={durum === "cevrimdisi"} class:kirmizi={durum === "hata" || kapali} role="status">
    <!-- Offline: the sleeping raccoon (design 22/13) · Çevrimdışı: uyuyan rakun (tasarım 22/13) -->
    {#if durum === "cevrimdisi"}<Maskot poz="uyku" boyut={32} />{:else if kapali}<Maskot poz="kilit" boyut={32} />{:else}<Ikon ad={durum === "hata" ? "uyari" : "yenile"} boyut={16} />{/if}
    <span class="metin">{durum === "cevrimdisi" ? t("esitleme.seridi") : kapali ? t("esitleme.oturumKapali") : durum === "hata" ? t("esitleme.durdu") : t("esitleme.baglaniyor")}</span>
    {#if durum === "hata"}<button class="tekrar" onclick={() => void odalar.baslat()}>{t("eylem.tekrarDene")}</button>{/if}
    {#if kapali}<button class="tekrar" disabled={oturum.mesgul} onclick={() => void oturum.cikis()}>{t("esitleme.yenidenGir")}</button>{/if}
  </div>
{/if}

<style>
  .serit { flex: none; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: .25rem 1.25rem; font-size: .8125rem; font-weight: 500; background: var(--yuzey-2); color: var(--yazi-2); border-bottom: 1px solid var(--kenar-ince); }
  .serit.sari { background: color-mix(in srgb, var(--bekliyor) 14%, var(--yuzey-1)); color: var(--bekliyor); }
  .serit.kirmizi { color: var(--hata); }
  .metin { flex: 1; min-width: 0; }
  .tekrar { min-height: 44px; padding: 0 8px; margin-right: -8px; color: var(--vurgu); font-weight: 600; font-size: .8125rem; }
</style>
