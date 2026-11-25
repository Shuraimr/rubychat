<!--
  Ben › Klavye kısayolları (desktop only): main switch for modeless Ctrl shortcuts, hint strip switch (when main is on),
  and the full shortcut list from the single command table.
  Ben › Klavye kısayolları (yalnızca masaüstü): kipsiz Ctrl kısayolları ana anahtarı, ipucu şeridi anahtarı (ana anahtar açıkken)
  ve tek komut tablosundan tam kısayol listesi.
-->
<script lang="ts">
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import KlavyeListesi from "../bilesenler/KlavyeListesi.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";

  let kenar = $state(false);
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("klavye.kisayollar")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="ay-icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <section class="ay-bolum">
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin"><strong>{t("klavye.ctrl")}</strong><span>{t("klavye.ctrlAlt")}</span></span>
          <Anahtar acik={tercihler.d.ctrlKisayol} degis={(v) => tercihler.yaz("ctrlKisayol", v)} etiket={t("klavye.ctrl")} />
        </div>
        {#if tercihler.d.ctrlKisayol}
          <div class="ay-satir">
            <span class="ay-metin"><strong>{t("klavye.ipucu")}</strong><span>{t("klavye.ipucuAlt")}</span></span>
            <Anahtar acik={tercihler.d.kisayolIpucu} degis={(v) => tercihler.yaz("kisayolIpucu", v)} etiket={t("klavye.ipucu")} />
          </div>
        {/if}
      </div>
      {#if !tercihler.d.ctrlKisayol}
        <p class="ay-not">{t("klavye.kapaliNot")}</p>
      {/if}
    </section>

    {#if tercihler.d.ctrlKisayol}
      <section class="ay-bolum">
        <div class="ay-kart govde">
          <KlavyeListesi />
        </div>
      </section>
    {/if}
  </div>
</div>
