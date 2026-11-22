<!--
  Segmented selector (design section 3: "Sistem · Koyu · Açık"). Single choice, 44px tall segments.
  Bölümlü seçici (tasarım bölüm 3: "Sistem · Koyu · Açık"). Tek seçim, 44px yüksek bölümler.
-->
<script lang="ts" generics="T extends string">
  let { secenekler, deger, sec, etiket }: { secenekler: { id: T; ad: string }[]; deger: T; sec: (id: T) => void; etiket: string } = $props();
</script>

<div class="secici" role="radiogroup" aria-label={etiket}>
  {#each secenekler as s (s.id)}
    <button role="radio" aria-checked={deger === s.id} class:aktif={deger === s.id} onclick={() => sec(s.id)}>{s.ad}</button>
  {/each}
</div>

<style>
  .secici { display: flex; padding: 4px; gap: 4px; border-radius: 14px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); }
  button { flex: 1; min-width: 0; min-height: 44px; padding: 0 8px; border-radius: 10px; font-size: .875rem; color: var(--yazi-2); transition: background var(--sure-hizli) var(--egri-cikis); }
  button.aktif { background: var(--yuzey-3); color: var(--yazi); font-weight: 600; box-shadow: var(--kat-1); }
  button:not(.aktif):active { background: var(--yuzey-3); }
</style>
