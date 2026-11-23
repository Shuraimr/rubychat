<!--
  Cold-start splash (design 22/09): the hugging raccoon, the wordmark and a thin indeterminate progress line.
  Shown only while the saved session is being restored (App.svelte); once cached rooms exist the list is drawn instead.
  Soğuk açılış ekranı (tasarım 22/09): sarılan rakun, yazı logosu ve ince belirsiz ilerleme çizgisi.
  Yalnızca kayıtlı oturum geri yüklenirken gösterilir (App.svelte); önbellekte oda varsa bunun yerine liste çizilir.
-->
<script lang="ts">
  import { t } from "../i18n";
  import Maskot from "./Maskot.svelte";
</script>

<div class="acilis" role="status" aria-label={t("uygulama.yukleniyor")}>
  <Maskot poz="sarilan" boyut={168} />
  <span class="ad">rubychat</span>
  <span class="cizgi"><span></span></span>
</div>

<style>
  .acilis { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: var(--zemin); }
  .ad { font-family: var(--baslik-tipi); font-size: 1.75rem; font-weight: 600; letter-spacing: -.01em; }
  .cizgi { width: 96px; height: 3px; border-radius: 2px; background: var(--yuzey-3); overflow: hidden; }
  .cizgi span { display: block; width: 40%; height: 100%; border-radius: 2px; background: var(--vurgu); animation: git calc(1200ms * var(--hareket)) ease-in-out infinite; }
  @keyframes git { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
</style>
