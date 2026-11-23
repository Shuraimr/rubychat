<!--
  Reaction picker: the emoji panel inside a bottom sheet (standard emoji only, one tap reacts). The composer uses the panel directly.
  Tepki seçici: alt sayfa içinde emoji paneli (yalnızca standart emoji, bir dokunuş tepki verir). Yazma alanı paneli doğrudan kullanır.
-->
<script lang="ts">
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import EmojiPaneli from "./EmojiPaneli.svelte";

  let { ekle, onkapat }: { ekle: (emoji: string) => void; onkapat: () => void } = $props();
</script>

<AltSayfa baslik={t("tepki.sec")} {onkapat}>
  <div class="govde"><EmojiPaneli tepki {ekle} /></div>
</AltSayfa>

<style>
  .govde { height: min(22rem, 52vh); margin: 0 -12px; display: flex; flex-direction: column; }
</style>
