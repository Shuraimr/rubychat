<!--
  Segmented selector (design section 3: "Sistem · Koyu · Açık"). Single choice, 44px tall segments.
  Bölümlü seçici (tasarım bölüm 3: "Sistem · Koyu · Açık"). Tek seçim, 44px yüksek bölümler.
-->
<script lang="ts" generics="T extends string">
  import { titret } from "../dokunma";

  let { secenekler, deger, sec, etiket }: { secenekler: { id: T; ad: string }[]; deger: T; sec: (id: T) => void; etiket: string } = $props();
</script>

<div class="secici" role="radiogroup" aria-label={etiket}>
  {#each secenekler as s (s.id)}
    <button role="radio" aria-checked={deger === s.id} class:aktif={deger === s.id} onclick={() => { titret("tik"); sec(s.id); }}>{s.ad}</button>
  {/each}
</div>

<style>
  /* One line always: with large text the padding and the size give way before the words do. · Hep tek satır: büyük yazıda sözcüklerden önce boşluk ve boyut küçülür. */
  .secici { display: flex; gap: 2px; border-radius: 1.5rem; overflow: hidden; }
  button { flex: 1 1 auto; min-width: 0; min-height: 3rem; padding: .375rem min(.75rem, 2.4vw); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: .375rem; background: color-mix(in srgb, var(--yazi) 7%, var(--yuzey-2)); font-size: min(.875rem, 3.9vw); line-height: 1.25; color: var(--yazi-2); transition: background var(--sure-orta) var(--egri-cikis), color var(--sure-orta) var(--egri-cikis), border-radius var(--sure-orta) var(--egri-cikis); }
  button.aktif { background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; border-radius: 1.5rem; }
</style>
