<!--
  "This message could not be sent": asks what to do with it. A message that cannot be sent holds up everything written after it, so the
  question comes by itself instead of waiting in a menu. Closing the sheet keeps the message; its bubble offers the same two choices.
  "Bu mesaj gönderilemedi": ne yapılacağını sorar. Gönderilemeyen mesaj kendinden sonra yazılan her şeyi bekletir; bu yüzden soru bir menüde
  beklemek yerine kendiliğinden gelir. Sayfayı kapatmak mesajı tutar; balonu aynı iki seçeneği sunar.
-->
<script lang="ts">
  import type { ZamanOgesi } from "../api/tipler";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";

  let { oge, yeniden, sil, onkapat }: { oge: ZamanOgesi; yeniden: () => void; sil: () => void; onkapat: () => void } = $props();
</script>

<AltSayfa baslik={t("gonderilemedi.baslik")} {onkapat}>
  {#if oge.medya?.dosyaAdi || oge.metin}<p class="ne">{oge.medya?.dosyaAdi ?? oge.metin}</p>{/if}
  <p class="metin">{t("gonderilemedi.alt")}</p>
  <div class="dugmeler">
    <button class="buton tehlike" onclick={() => { sil(); onkapat(); }}>{t("sil.sil")}</button>
    <button class="buton birincil" onclick={() => { yeniden(); onkapat(); }}>{t("eylem.yenidenDene")}</button>
  </div>
</AltSayfa>

<style>
  .ne { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .metin { font-size: .9375rem; color: var(--yazi-2); }
  .dugmeler { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
