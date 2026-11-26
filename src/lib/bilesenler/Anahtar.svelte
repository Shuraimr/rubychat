<!--
  Switch (design section 3): 52x32 track inside a 52x44 hit area. Used by Ben and Görünüm.
  Anahtar (tasarım bölüm 3): 52x44 dokunma alanı içinde 52x32 ray. Ben ve Görünüm kullanır.
-->
<script lang="ts">
  import { titret } from "../dokunma";

  let { acik, degis, etiket, kilitli = false }: { acik: boolean; degis: (deger: boolean) => void; etiket: string; kilitli?: boolean } = $props();
</script>

<button class="anahtar" class:acik role="switch" aria-checked={acik} aria-label={etiket} disabled={kilitli} data-bas="yok" onclick={() => { titret("dokunus"); degis(!acik); }}>
  <span class="ray"><span class="top"></span></span>
</button>

<style>
  .anahtar { flex: none; width: 52px; height: 48px; display: inline-flex; align-items: center; justify-content: center; border-radius: 24px; }
  .anahtar:disabled { opacity: .38; }
  .ray { position: relative; width: 52px; height: 32px; border-radius: 16px; background: var(--yuzey-3); border: 2px solid var(--kenar); }
  /* Material 3: the thumb glides via transform only (compositor-only) · Material 3: top yalnızca transform ile kayar (yalnızca birleştirici) */
  .top { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 12px; background: var(--yazi-2); transform: scale(.67); transition: transform var(--sure-orta) var(--egri-ac); }
  .acik .ray { background: var(--vurgu); border-color: var(--vurgu); }
  .acik .top { background: var(--vurgu-ustu); transform: translate3d(20px, 0, 0); }
  .anahtar:active .top { transform: scale(1.08); }
  .acik:active .top { transform: translate3d(20px, 0, 0) scale(1.08); }
</style>
