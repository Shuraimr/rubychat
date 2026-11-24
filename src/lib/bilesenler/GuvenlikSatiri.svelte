<!--
  One row of the Security card / setup sheet (design section 12d): a status icon (green tick / yellow warning / grey info), title, short help,
  a status chip and an optional action button underneath. Chip colours: done = green, waiting = yellow, neutral = grey.
  Güvenlik kartının / kurulum sayfasının bir satırı (tasarım bölüm 12d): durum simgesi (yeşil tik / sarı uyarı / gri bilgi), başlık, kısa yardım,
  durum çipi ve altında isteğe bağlı eylem düğmesi. Çip renkleri: tamam = yeşil, bekliyor = sarı, nötr = gri.
-->
<script lang="ts">
  import Ikon from "./Ikon.svelte";

  let {
    baslik,
    alt,
    durum,
    ton,
    eylem,
    onEylem,
    eylemKilitli = false,
  }: {
    baslik: string;
    alt?: string;
    durum: string;
    ton: "tamam" | "bekliyor" | "notr";
    eylem?: string;
    onEylem?: () => void;
    eylemKilitli?: boolean;
  } = $props();
</script>

<div class="satir">
  <div class="ust">
    <span class="durum-ikon {ton}"><Ikon ad={ton === "tamam" ? "onay" : ton === "bekliyor" ? "uyari" : "bilgi"} boyut={20} /></span>
    <div class="metin"><strong>{baslik}</strong>{#if alt}<span>{alt}</span>{/if}</div>
    <span class="cip {ton}">{durum}</span>
  </div>
  {#if eylem && onEylem}
    <button class="buton tonlu" onclick={onEylem} disabled={eylemKilitli}>{eylem}</button>
  {/if}
</div>

<style>
  .satir { display: grid; gap: 12px; }
  .ust { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; }
  .durum-ikon { flex: none; display: inline-flex; color: var(--yazi-2); }
  .durum-ikon.tamam { color: var(--cozum); }
  .durum-ikon.bekliyor { color: var(--bekliyor); }
  .metin { flex: 1 1 8rem; min-width: 0; display: grid; gap: 2px; }
  strong { font-size: .9375rem; line-height: 1.4; font-weight: 500; }
  .metin span { font-size: .8125rem; color: var(--yazi-2); }
</style>
