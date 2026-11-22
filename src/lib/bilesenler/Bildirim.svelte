<!--
  Toast (design section 8): sits above the fixed bottom bars (--alt-yer), 4 s, rises 12px while fading in (200ms), fades out (150ms).
  Kind icon on the left (info / done / error) and an optional action on the right.
  Bildirim (tasarım bölüm 8): sabit alt çubukların (--alt-yer) üstünde durur, 4 sn, 12px yükselerek solar (200ms), kapanırken solar (150ms).
  Solda tür simgesi (bilgi / tamam / hata), sağda isteğe bağlı eylem.
-->
<script lang="ts">
  import { bildirimCik, bildirimGir } from "../gecis";
  import { bildirim } from "../durum/bildirim.svelte";
  import Ikon from "./Ikon.svelte";
</script>

{#if bildirim.metin}
  <div class="bildirim {bildirim.tur}" role="status" in:bildirimGir out:bildirimCik>
    <span class="simge"><Ikon ad={bildirim.tur === "tamam" ? "onay" : bildirim.tur === "hata" ? "uyari" : "bilgi"} boyut={20} /></span>
    <span class="metin">{bildirim.metin}</span>
    {#if bildirim.eylem}
      <button class="eylem" onclick={() => { bildirim.eylem?.calistir(); bildirim.kapat(); }}>{bildirim.eylem.etiket}</button>
    {/if}
  </div>
{/if}

<style>
  .bildirim {
    position: fixed; left: 16px; right: 16px; z-index: 50;
    bottom: calc(var(--alt-yer) + 12px + env(safe-area-inset-bottom));
    max-width: 420px; min-height: 48px; margin: 0 auto; padding: 4px 8px 4px 16px; border-radius: 12px;
    display: flex; align-items: center; gap: 12px;
    background: var(--yuzey-3); color: var(--yazi); border: 1px solid var(--kenar); box-shadow: var(--kat-2);
    font-size: .875rem;
  }
  .simge { display: inline-flex; flex: none; color: var(--yazi-2); }
  .tamam .simge { color: var(--cozum); }
  .hata .simge { color: var(--hata); }
  .metin { flex: 1; min-width: 0; padding: 8px 0; }
  .eylem { flex: none; min-height: 44px; padding: 0 12px; border-radius: 10px; color: var(--vurgu); font-weight: 600; }
  .eylem:active { background: var(--yuzey-2); }
</style>
