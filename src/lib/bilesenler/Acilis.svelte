<!--
  Cold-start splash: the raccoon settles in, the wordmark follows, and the whole page fades into the app. Transform/opacity only, each
  plays once; the progress line appears only when restoring really takes long.
  Soğuk açılış: rakun yerine oturur, yazı logosu onu izler, sayfanın tamamı uygulamaya erir. Yalnızca dönüşüm/opaklık, her biri bir kez;
  ilerleme çizgisi yalnızca geri yükleme gerçekten uzarsa görünür.
-->
<script lang="ts">
  import { acilisCik } from "../gecis";
  import { t } from "../i18n";
  import Maskot from "./Maskot.svelte";
</script>

<div class="acilis" role="status" aria-label={t("uygulama.yukleniyor")} out:acilisCik>
  <span class="yuz"><Maskot poz="sarilan" boyut={152} /></span>
  <span class="ad">rubychat</span>
  <span class="cizgi"><span></span></span>
</div>

<style>
  .acilis { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: var(--zemin); will-change: opacity; }
  .yuz { animation: otur calc(420ms * var(--hareket)) var(--egri-ac) backwards; }
  .ad { font-family: var(--baslik-tipi); font-size: 1.75rem; font-weight: 600; letter-spacing: -.01em; animation: yuksel calc(320ms * var(--hareket)) calc(90ms * var(--hareket)) var(--egri-ac) backwards; }
  .cizgi { width: 96px; height: 3px; border-radius: 2px; background: var(--yuzey-3); overflow: hidden; animation: yuksel 240ms 900ms linear backwards; }
  .cizgi span { display: block; width: 40%; height: 100%; border-radius: 2px; background: var(--vurgu); animation: git calc(1200ms * var(--hareket)) ease-in-out infinite; }
  @keyframes otur { from { transform: scale(.86); opacity: 0; } }
  @keyframes yuksel { from { transform: translateY(8px); opacity: 0; } }
  @keyframes git { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
</style>
