<!--
  Per-message delivery status, 14px, next to the time (design section 9). The normal state is NOT worded: only an icon.
  clock = sending, single tick = server has it, red "!" = failed. (No double tick: the backend sends no read receipts yet.)
  The icon cross-fades (160ms) when the state changes; `{#key}` re-creates it and the CSS animation plays.
  Mesaj başına gönderim durumu, 14px, saatin yanında (tasarım bölüm 9). Normal durum yazıyla SÖYLENMEZ: yalnızca simge.
  saat = gönderiliyor, tek tik = sunucu aldı, kırmızı "!" = başarısız. (Çift tik yok: arka uç henüz okundu bilgisi yollamıyor.)
  Durum değişince simge 160ms çapraz solar; `{#key}` yeniden kurar ve CSS animasyonu oynar.
-->
<script lang="ts">
  import type { GonderimDurumu } from "../api/tipler";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { durum }: { durum: GonderimDurumu } = $props();
  const ad = $derived(durum === "gonderiliyor" ? t("oda.gonderiliyor") : durum === "hata" ? t("oda.gonderilemedi") : t("oda.gonderildi"));
</script>

{#key durum}
  <span class="durum" class:hata={durum === "hata"} role="img" aria-label={ad}>
    <Ikon ad={durum === "gonderiliyor" ? "saat" : durum === "hata" ? "uyari" : "onay"} boyut={14} />
  </span>
{/key}

<style>
  .durum { display: inline-flex; width: 14px; height: 14px; flex: none; animation: belir var(--sure-gecis) linear; }
  .durum.hata { color: var(--hata); }
  @keyframes belir { from { opacity: 0; } }
</style>
