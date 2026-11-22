<!--
  The seven SAS emojis (design section 12b): 4 + 3 in 72px boxes, each with its Turkish name. Fits a 375px screen without sideways scrolling.
  Yedi SAS emojisi (tasarım bölüm 12b): 72px kutularda 4 + 3, her biri Türkçe adıyla. 375px ekrana yana kaydırmadan sığar.
-->
<script lang="ts">
  import type { SasEmoji } from "../api/tipler";
  import { emojiAdi } from "../i18n";

  let { emojiler }: { emojiler: SasEmoji[] } = $props();
</script>

<ol class="izgara">
  {#each emojiler as e, i (i)}
    <li class="kutucuk">
      <span class="simge" aria-hidden="true">{e.simge}</span>
      <span class="ad">{emojiAdi(e.ad)}</span>
    </li>
  {/each}
</ol>

<style>
  .izgara { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .kutucuk { width: calc((100% - 24px) / 4); min-width: 72px; min-height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; border-radius: 12px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); }
  .simge { font-size: 2rem; line-height: 1.1; }
  .ad { font-size: .75rem; color: var(--yazi-2); text-align: center; overflow-wrap: anywhere; }
</style>
