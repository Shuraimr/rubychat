<!--
  Switch (design section 3): 52x32 track inside a 52x44 hit area. Used by Ben and Görünüm.
  Anahtar (tasarım bölüm 3): 52x44 dokunma alanı içinde 52x32 ray. Ben ve Görünüm kullanır.
-->
<script lang="ts">
  let { acik, degis, etiket, kilitli = false }: { acik: boolean; degis: (deger: boolean) => void; etiket: string; kilitli?: boolean } = $props();
</script>

<button class="anahtar" class:acik role="switch" aria-checked={acik} aria-label={etiket} disabled={kilitli} onclick={() => degis(!acik)}>
  <span class="ray"><span class="top"></span></span>
</button>

<style>
  .anahtar { flex: none; width: 52px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; }
  .anahtar:disabled { opacity: .38; }
  .ray {
    position: relative; width: 52px; height: 32px; border-radius: 16px; background: var(--yuzey-3); border: 2px solid var(--kenar);
    transition: background var(--sure-hizli) var(--egri-cikis), border-color var(--sure-hizli) var(--egri-cikis);
  }
  .top {
    position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 10px; background: var(--yazi-2);
    transition: transform var(--sure-hizli) var(--egri-cikis), background var(--sure-hizli) var(--egri-cikis);
  }
  .acik .ray { background: var(--vurgu); border-color: var(--vurgu); }
  .acik .top { background: var(--vurgu-ustu); transform: translateX(20px); }
</style>
