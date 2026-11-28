<!-- Keyboard shortcut help (? or Ctrl+/) · Klavye kısayolu yardımı (? veya Ctrl+/) -->
<script lang="ts">
  import { t } from "../i18n";
  import { klavye } from "../klavyeKisayol.svelte";
  import AltSayfa from "./AltSayfa.svelte";
  import KlavyeListesi from "./KlavyeListesi.svelte";
</script>

<AltSayfa baslik={t("klavye.kisayollar")} onkapat={() => (klavye.yardim = false)} yerlesim="orta">
  <KlavyeListesi otoOdak />
</AltSayfa>
