<!--
  Emoji sheet for the composer: a plain grid of common emoji; tapping one inserts it at the cursor. (Reactions are not offered: the backend has none yet.)
  Yazma alanı için emoji sayfası: yaygın emojilerden düz bir ızgara; birine dokunmak onu imlecin olduğu yere ekler. (Tepki sunulmaz: arka uçta henüz yok.)
-->
<script lang="ts">
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";

  let { ekle, onkapat }: { ekle: (emoji: string) => void; onkapat: () => void } = $props();

  const EMOJILER = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🙂", "😉", "😊", "😍", "🥰", "😘", "😎", "🤩", "🤔",
    "😐", "😴", "😢", "😭", "😡", "😱", "🥳", "🙃", "👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "🤝",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "🔥", "✨", "🎉", "🎂", "☕", "🍕", "🌱", "🌙",
    "⭐", "✅", "❌", "❓", "❗", "💡", "📌", "📎", "🚀", "💻", "📱", "🎧", "🐶", "🐱", "🦊", "🦝",
  ];
</script>

<AltSayfa baslik={t("emoji.baslik")} {onkapat}>
  <div class="izgara">
    {#each EMOJILER as e (e)}
      <button onclick={() => ekle(e)} aria-label={e}>{e}</button>
    {/each}
  </div>
</AltSayfa>

<style>
  .izgara { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding-bottom: 8px; }
  button { min-width: 44px; min-height: 44px; border-radius: 10px; font-size: 1.5rem; line-height: 1; transition: background var(--sure-hizli) var(--egri-cikis); }
  button:active { background: var(--yuzey-3); }
  @media (max-width: 360px) { .izgara { grid-template-columns: repeat(7, 1fr); } }
</style>
