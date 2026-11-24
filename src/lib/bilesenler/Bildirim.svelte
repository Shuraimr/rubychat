<!--
  Toast (design section 8): sits above the fixed bottom bars (--alt-yer), 4 s, Material snackbar: grows up from the bottom, fades out.
  Kind icon on the left (info / done / error) and an optional action on the right.
  Bildirim (tasarım bölüm 8): sabit alt çubukların (--alt-yer) üstünde durur, 4 sn, Material snackbar: alttan büyüyerek gelir, solarak gider.
  Solda tür simgesi (bilgi / tamam / hata), sağda isteğe bağlı eylem.
-->
<script lang="ts">
  import { bildirimCik, bildirimGir } from "../gecis";
  import { bildirim } from "../durum/bildirim.svelte";
  import Ikon from "./Ikon.svelte";
</script>

{#if bildirim.metin}{#key bildirim.sira}
  <div class="bildirim {bildirim.tur}" role="status" in:bildirimGir out:bildirimCik>
    <span class="simge"><Ikon ad={bildirim.tur === "tamam" ? "onay" : bildirim.tur === "hata" ? "uyari" : "bilgi"} boyut={20} /></span>
    <span class="metin">{bildirim.metin}</span>
    {#if bildirim.eylem}
      <button class="eylem" onclick={() => { bildirim.eylem?.calistir(); bildirim.kapat(); }}>{bildirim.eylem.etiket}</button>
    {/if}
  </div>
{/key}{/if}

<style>
  /* Inverse surface, like a Material snackbar: it must read as "above the app" in both themes. · Ters yüzey, Material snackbar gibi: iki temada da "uygulamanın üstünde" okunmalı. */
  .bildirim {
    position: fixed; left: 1rem; right: 1rem; z-index: 50; transform-origin: 50% 100%;
    bottom: calc(var(--alt-yer) + 12px + env(safe-area-inset-bottom));
    max-width: 26rem; min-height: 3.25rem; margin: 0 auto; padding: .25rem .5rem .25rem 1rem; border-radius: 1rem;
    display: flex; align-items: center; gap: .75rem; background: var(--yazi); color: var(--zemin); box-shadow: var(--kat-2); font-size: .875rem;
  }
  .simge { display: inline-flex; flex: none; opacity: .75; }
  .metin { flex: 1; min-width: 0; padding: .625rem 0; line-height: 1.35; max-height: 6.5rem; overflow-y: auto; }
  .eylem { flex: none; max-width: 45%; min-height: 2.75rem; padding: 0 .75rem; border-radius: 1.5rem; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
</style>
