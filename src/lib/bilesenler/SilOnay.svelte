<!--
  "Bu mesaj silinsin mi?" confirm sheet. Deleting is not undoable, so it asks once: Vazgeç / Sil (red). The deletion itself is the
  parent's job (`onay`).
  "Bu mesaj silinsin mi?" onay sayfası. Silme geri alınamaz, bu yüzden bir kez sorar: Vazgeç / Sil (kırmızı). Silmenin kendisi üst bileşenin
  işidir (`onay`).
-->
<script lang="ts">
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";

  let { baskasininki = false, onay, onkapat }: { baskasininki?: boolean; onay: () => void; onkapat: () => void } = $props();
</script>

<AltSayfa baslik={t("sil.baslik")} {onkapat}>
  <p class="metin">{baskasininki ? t("sil.baskasi") : t("sil.alt")}</p>
  <div class="dugmeler">
    <button class="buton cizgili" onclick={onkapat}>{t("eylem.iptal")}</button>
    <button class="buton tehlike" onclick={() => { onay(); onkapat(); }}>{t("sil.sil")}</button>
  </div>
</AltSayfa>

<style>
  .metin { font-size: .9375rem; color: var(--yazi-2); }
  .dugmeler { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
