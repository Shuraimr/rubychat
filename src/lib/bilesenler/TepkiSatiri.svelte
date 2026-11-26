<!--
  Reactions under a message: one chip per emoji with its count; mine are tinted (tonal + accent border). Tap = toggle my reaction,
  long press = who reacted (the parent opens the sheet). A custom-emoji reaction (key is an mxc:// URI) is drawn as an image.
  Bir mesajın altındaki tepkiler: emoji başına bir çip ve sayısı; benimkiler tonlu (ton + vurgu kenarı). Dokun = tepkimi aç/kapat,
  uzun bas = kimler tepki verdi (üst bileşen sayfayı açar). Özel emoji tepkisi (anahtar bir mxc:// adresi) resim olarak çizilir.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { Tepki } from "../api/tipler";
  import { uzunBasma } from "../dokunma";
  import { t } from "../i18n";
  import { gorselUrl } from "../medya";

  let { tepkiler, tikla, uzun }: { tepkiler: Tepki[]; tikla: (anahtar: string) => void; uzun: (tepki: Tepki) => void } = $props();

  // Only reactions added AFTER this row mounted pop in; opening a room or loading history plays no reaction animation.
  // Yalnızca bu satır kurulduktan SONRA eklenen tepkiler yaylanır; oda açarken ya da geçmiş yüklerken tepki animasyonu oynamaz.
  const baslangic = new Set(untrack(() => tepkiler.map((r) => r.anahtar)));
</script>

<div class="tepkiler" role="group" aria-label={t("tepki.grup")}>
  {#each tepkiler as r (r.anahtar)}
    <button
      class="cip"
      class:benim={r.benim}
      class:yeni={!baslangic.has(r.anahtar)}
      aria-pressed={r.benim}
      aria-label={t("tepki.cip", { emoji: r.anahtar.startsWith("mxc://") ? "" : r.anahtar, n: r.sayi })}
      onclick={() => tikla(r.anahtar)}
      use:uzunBasma={{ ac: () => uzun(r) }}
    >
      {#if r.anahtar.startsWith("mxc://")}
        <img src={gorselUrl(r.anahtar, 20) ?? ""} alt="" width="20" height="20" draggable="false" />
      {:else}
        <span class="emoji">{r.anahtar}</span>
      {/if}
      <span class="sayi">{r.sayi}</span>
    </button>
  {/each}
</div>

<style>
  .tepkiler { display: flex; flex-wrap: wrap; gap: 4px; margin-top: .25em; }
  /* Chip sizes use em so reactions scale cleanly with --sohbet-olcek; only newly added chips animate. */
  /* Çip ölçüleri em kullanır, böylece tepkiler --sohbet-olcek ile temiz ölçeklenir; yalnızca yeni eklenen çipler canlanır. */
  .cip {
    min-height: 2em; display: inline-flex; align-items: center; gap: .25em; padding: 0 .625em; border-radius: 1em; box-shadow: var(--kat-1);
    background: var(--yuzey-2); border: 1px solid var(--kenar); font-size: .8125em; color: var(--yazi);
  }
  .cip.yeni { animation: tepki-pop var(--sure-pop) var(--egri-ac); }
  .cip.benim { background: var(--ton); color: var(--ton-ustu); border-color: var(--vurgu); }
  .emoji { font-size: 1.2em; line-height: 1; }
  .sayi { font-weight: 600; font-variant-numeric: tabular-nums; }
  img { width: 1.25em; height: 1.25em; object-fit: contain; }
</style>
