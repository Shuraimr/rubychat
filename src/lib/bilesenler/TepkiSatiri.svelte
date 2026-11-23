<!--
  Reactions under a message: one chip per emoji with its count; mine are tinted (tonal + accent border). Tap = toggle my reaction,
  long press = who reacted (the parent opens the sheet). A custom-emoji reaction (key is an mxc:// URI) is drawn as an image.
  Bir mesajın altındaki tepkiler: emoji başına bir çip ve sayısı; benimkiler tonlu (ton + vurgu kenarı). Dokun = tepkimi aç/kapat,
  uzun bas = kimler tepki verdi (üst bileşen sayfayı açar). Özel emoji tepkisi (anahtar bir mxc:// adresi) resim olarak çizilir.
-->
<script lang="ts">
  import type { Tepki } from "../api/tipler";
  import { uzunBasma } from "../dokunma";
  import { t } from "../i18n";
  import { gorselUrl } from "../medya";

  let { tepkiler, tikla, uzun }: { tepkiler: Tepki[]; tikla: (anahtar: string) => void; uzun: (tepki: Tepki) => void } = $props();
</script>

<div class="tepkiler" role="group" aria-label={t("tepki.grup")}>
  {#each tepkiler as r (r.anahtar)}
    <button
      class="cip"
      class:benim={r.benim}
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
  .tepkiler { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  /* 28px chip drawn inside a 44px hit row via padding on the button's :before is not needed: the row gap keeps them apart, the chip itself is min 32px high */
  .cip {
    min-height: 2rem; display: inline-flex; align-items: center; gap: 4px; padding: 0 .625rem; border-radius: 1rem; box-shadow: var(--kat-1);
    background: var(--yuzey-2); border: 1px solid var(--kenar); font-size: .8125rem; color: var(--yazi);
    animation: tepki-pop var(--sure-pop) var(--egri-cikis);
    transition: background var(--sure-hizli) var(--egri-cikis), border-color var(--sure-hizli) var(--egri-cikis);
  }
  .cip.benim { background: var(--ton); color: var(--ton-ustu); border-color: var(--vurgu); }
  .emoji { font-size: 1rem; line-height: 1; }
  .sayi { font-weight: 600; font-variant-numeric: tabular-nums; }
  img { width: 20px; height: 20px; object-fit: contain; }
</style>
