<!--
  The raccoon mascot (design 22/13). `poz` picks the pose: selam (welcome, empty chat list), yukleniyor (cold start / first sync),
  arama (search empty / no results), uyku (offline), hata (errors), kilit (security), sarilan (splash).
  A slow "breathing" scale (1 → 1.03 over 3s) keeps it alive; it is off with "Animasyonları azalt" (--hareket is 0).
  Rakun maskot (tasarım 22/13). `poz` duruşu seçer: selam (karşılama, boş sohbet listesi), yukleniyor (soğuk açılış / ilk eşitleme),
  arama (arama boş / sonuç yok), uyku (çevrimdışı), hata (hatalar), kilit (güvenlik), sarilan (açılış).
  Yavaş "nefes alma" (3 sn'de 1 → 1.03 ölçek) canlı tutar; "Animasyonları azalt"ta kapalıdır (--hareket 0).
-->
<script lang="ts" module>
  export type MaskotPozu = "selam" | "arama" | "hata" | "uyku" | "kilit" | "yukleniyor" | "sarilan";
</script>

<script lang="ts">
  let { poz, boyut = 120, hale = false }: { poz: MaskotPozu; boyut?: number; hale?: boolean } = $props();
</script>

<span class="maskot" class:hale style:width="{boyut}px" style:height="{boyut}px" aria-hidden="true">
  <img src="/maskot/{poz}.webp" alt="" width={boyut} height={boyut} loading="lazy" decoding="async" draggable="false" />
</span>

<style>
  .maskot { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; }
  /* Soft accent halo behind the mascot (login) · Maskotun arkasında yumuşak vurgu halesi (giriş) */
  .hale::before { content: ""; position: absolute; inset: -12%; border-radius: 50%; background: color-mix(in srgb, var(--vurgu) 16%, transparent); }
  img { position: relative; width: 100%; height: 100%; object-fit: contain; animation: nefes calc(3s * var(--hareket)) ease-in-out infinite alternate; }
  @keyframes nefes { from { transform: scale(1); } to { transform: scale(1.03); } }
</style>
