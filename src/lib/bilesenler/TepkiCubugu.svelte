<!--
  Quick reaction bar shown above the message context menu (❤️ 😂 👍 😮 😢 🙏 and "+" for the full emoji picker). The reactions I already
  gave are tinted; tapping one toggles it. Each button is 44px (the bar fits a 375px phone: 7 x 44 + gaps).
  Mesaj bağlam menüsünün üstünde çıkan hızlı tepki çubuğu (❤️ 😂 👍 😮 😢 🙏 ve tam emoji seçici için "+"). Verdiğim tepkiler tonlu;
  birine dokunmak aç/kapat yapar. Her düğme 44px (çubuk 375px telefona sığar: 7 x 44 + boşluklar).
-->
<script lang="ts">
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { benim, sec, dahaFazla }: { benim: Set<string>; sec: (emoji: string) => void; dahaFazla: () => void } = $props();
  const HIZLI = ["❤️", "😂", "👍", "😮", "😢", "🙏"];
</script>

<div class="cubuk" role="group" aria-label={t("tepki.hizli")}>
  {#each HIZLI as e (e)}
    <button class="emoji" class:benim={benim.has(e)} aria-pressed={benim.has(e)} aria-label={e} onclick={() => sec(e)}>{e}</button>
  {/each}
  <button class="daha" aria-label={t("tepki.dahaFazla")} onclick={dahaFazla}><Ikon ad="artik" boyut={22} /></button>
</div>

<style>
  .cubuk { display: flex; align-items: center; justify-content: space-between; gap: 2px; padding: 0 .25rem; min-height: 3.25rem; }
  button { flex: 1 1 0; min-width: 2.25rem; max-width: 2.75rem; height: 2.75rem; border-radius: 1.375rem; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; line-height: 1; transition: background var(--sure-hizli) var(--egri-cikis), transform var(--sure-hizli) var(--egri-yay); }
  button:active { background: var(--yuzey-2); transform: scale(1.15); }
  .benim { background: var(--ton); }
  .daha { color: var(--yazi-2); background: var(--yuzey-2); }
</style>
