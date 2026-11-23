<!--
  Per-message delivery status, 14px, next to the time (design section 9). The normal state is NOT worded: only an icon.
  clock = sending, single tick = server has it, double tick = read (1:1 chats), red "!" = failed.
  The icon cross-fades (160ms) when the state changes; `{#key}` re-creates it and the CSS animation plays.
  Mesaj başına gönderim durumu, 14px, saatin yanında (tasarım bölüm 9). Normal durum yazıyla SÖYLENMEZ: yalnızca simge.
  saat = gönderiliyor, tek tik = sunucu aldı, çift tik = okundu (1:1 sohbetler), kırmızı "!" = başarısız.
  Durum değişince simge 160ms çapraz solar; `{#key}` yeniden kurar ve CSS animasyonu oynar.
-->
<script lang="ts">
  import type { GonderimDurumu } from "../api/tipler";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  /** `okundu`: in a 1:1 chat the other person has read it → double tick · 1:1 sohbette karşı kişi okudu → çift tik */
  let { durum, okundu = false }: { durum: GonderimDurumu; okundu?: boolean } = $props();
  const ad = $derived(durum === "gonderiliyor" ? t("oda.gonderiliyor") : durum === "hata" ? t("oda.gonderilemedi") : okundu ? t("okundu.okundu") : t("oda.gonderildi"));
</script>

{#key `${durum}${okundu}`}
  <span class="durum" class:hata={durum === "hata"} role="img" aria-label={ad}>
    <Ikon ad={durum === "gonderiliyor" ? "saat" : durum === "hata" ? "uyari" : okundu ? "tikCift" : "onay"} boyut={14} />
  </span>
{/key}

<style>
  .durum { display: inline-flex; width: 14px; height: 14px; flex: none; animation: belir var(--sure-gecis) linear; }
  .durum.hata { color: var(--hata); }
  @keyframes belir { from { opacity: 0; } }
</style>
