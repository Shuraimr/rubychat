<!--
  Spaces: not built yet, so the screen shows the empty state from the design (section 13). Grouping rooms under spaces and the
  rubyyard community bridge will live here.
  Alanlar: henüz yok, bu yüzden ekran tasarımdaki boş durumu (bölüm 13) gösterir. Odaları alanlar altında toplama ve rubyyard topluluk köprüsü burada olacak.
-->
<script lang="ts">
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import { t } from "../i18n";
</script>

<div class="alanlar">
  <Baslik baslik={t("alanlar.baslik")} />
  <BosDurum maskot="selam" baslik={t("alanlar.bosBaslik")} metin={t("alanlar.aciklama")} />
</div>

<style>
  .alanlar { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
