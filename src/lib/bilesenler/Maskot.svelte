<!--
  The raccoon mascot (design 22/13). `poz` picks the pose: selam (welcome, empty chat list), yukleniyor (cold start / first sync),
  arama (search empty / no results), uyku (offline), hata (errors), kilit (security), sarilan (splash).
  Static on purpose: no idle breathing loop so resting screens cost zero frames and battery.
  Rakun maskot (tasarım 22/13). `poz` duruşu seçer: selam (karşılama, boş sohbet listesi), yukleniyor (soğuk açılış / ilk eşitleme),
  arama (arama boş / sonuç yok), uyku (çevrimdışı), hata (hatalar), kilit (güvenlik), sarilan (açılış).
  Bilerek durağan: boşta duran nefes alma döngüsü yok; dinlenen ekranlar kare ve pil harcamaz.
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
  img { position: relative; width: 100%; height: 100%; object-fit: contain; }
</style>
