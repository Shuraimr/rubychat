<!--
  Ben › Klavye kısayolları (desktop only): main switch for Vim & modeless Ctrl shortcuts, hint strip switch (when main is on),
  short "How it works" explanation, and the shared grouped/searchable shortcut list.
  Ben › Klavye kısayolları (yalnızca masaüstü): Vim ve kipsiz Ctrl kısayolları ana anahtarı, ipucu şeridi anahtarı (ana anahtar açıkken),
  kısa "Nasıl çalışır?" açıklaması ve ortak gruplu/aranabilir kısayol listesi.
-->
<script lang="ts">
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
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
          <span class="ay-metin"><strong>{t("klavye.vimBaslik")}</strong><span>{t("klavye.vimAlt")}</span></span>
          <Anahtar acik={tercihler.d.ctrlKisayol} degis={(v) => tercihler.yaz("ctrlKisayol", v)} etiket={t("klavye.vimBaslik")} />
        </div>
        {#if tercihler.d.ctrlKisayol}
          <div class="ay-satir">
            <span class="ay-metin"><strong>{t("klavye.ipucu")}</strong><span>{t("klavye.ipucuYeniAlt")}</span></span>
            <Anahtar acik={tercihler.d.kisayolIpucuAcik} degis={(v) => tercihler.yaz("kisayolIpucuAcik", v)} etiket={t("klavye.ipucu")} />
          </div>
        {/if}
      </div>
    </section>

    <section class="ay-bolum">
      <h2>{t("klavye.nasilBaslik")}</h2>
      <div class="ay-kart govde nasil">
        <div class="nasil-satir">
          <span class="nasil-ikon"><Ikon ad="klavye" boyut={18} /></span>
          <p>{t("klavye.nasilYazma")}</p>
        </div>
        <div class="nasil-satir">
          <span class="nasil-ikon"><Ikon ad="pusula" boyut={18} /></span>
          <p>{t("klavye.nasilSayac")}</p>
        </div>
        <div class="nasil-satir">
          <span class="nasil-ikon"><Ikon ad="bilgi" boyut={18} /></span>
          <p>{t("klavye.nasilKapali")}</p>
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart govde">
        <KlavyeListesi />
      </div>
    </section>
  </div>
</div>

<style>
  .nasil {
    gap: .625rem;
  }
  .nasil-satir {
    display: flex;
    align-items: flex-start;
    gap: .625rem;
    font-size: .8125rem;
    line-height: 1.45;
    color: var(--yazi-2);
  }
  .nasil-ikon {
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: .5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .nasil-satir p {
    flex: 1;
    min-width: 0;
  }
</style>
