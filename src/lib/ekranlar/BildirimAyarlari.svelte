<!--
  Ben › Bildirimler: the system permission (card + link to Android settings) and the in-app banner options (on/off, preview, vibration).
  The system notifications themselves are managed by Android, so the screen says so instead of faking switches for them.
  Ben › Bildirimler: sistem izni (kart + Android ayarlarına bağlantı) ve uygulama içi şerit seçenekleri (aç/kapa, önizleme, titreşim).
  Sistem bildirimlerini Android yönetir; ekran onlar için sahte anahtarlar koymak yerine bunu söyler.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { bildirimAyarlariniAc, uygulamadanCik } from "../api/komutlar";
  import type { BildirimIzni } from "../api/tipler";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { arkaPlanAyarla, arkaPlanVar, bildirimIzni, bildirimIzniAc, pilAyariAc, pilMuafMi } from "../bildirim-sistem";
  import { gezinme } from "../durum/gezinme.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";
  import { androidMi } from "../arama-ec/ses";

  let izin = $state<BildirimIzni | null>(null);
  // Only Android has a settings page to open and the note about it; on the desktop the row did nothing.
  // Açılacak ayar sayfası ve onunla ilgili not yalnızca Android'de var; masaüstünde satır hiçbir şey yapmıyordu.
  const android = androidMi();
  let pilMuaf = $state(pilMuafMi());
  // Coming back from the system page: the answer may have changed. · Sistem sayfasından dönüşte cevap değişmiş olabilir.
  $effect(() => {
    const bak = () => (pilMuaf = pilMuafMi());
    document.addEventListener("visibilitychange", bak);
    return () => document.removeEventListener("visibilitychange", bak);
  });
  onMount(() => {
    bildirimIzni().then((d) => (izin = d)).catch(() => {});
  });
  async function izinVer() {
    try {
      izin = await bildirimIzniAc();
    } catch {
      /* the system dialog failed: leave the state · sistem penceresi başarısız: durumu bırak */
    }
  }
  const izinAd = $derived(izin === "verildi" ? t("ayar.bildirimIzinVerildi") : izin === "verilmedi" ? t("ayar.bildirimIzinYok") : t("ayar.bildirimIzinDesteklenmiyor"));
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("ayar.bildirimler")} geri={() => gezinme.benAltKapat()} />
  <div class="ay-icerik">
    <section class="ay-bolum">
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin"><strong>{t("ayar.bildirimIzin")}</strong><span>{izinAd}</span></span>
          {#if izin === "verilmedi"}<button class="buton birincil ayrac" onclick={izinVer}>{t("ayar.bildirimIzinAc")}</button>{/if}
        </div>
        {#if android && izin !== "desteklenmiyor"}
          <button class="ay-satir dugme" onclick={() => void bildirimAyarlariniAc().catch(() => {})}>
            <span class="ay-metin"><strong>{t("ayar.sistemAyarlari")}</strong></span><Ikon ad="sagOk" boyut={20} />
          </button>
        {/if}
      </div>
      {#if android}<p class="ay-not">{t("ayar.notBildirim")}</p>{/if}
    </section>

    {#if arkaPlanVar()}
      <section class="ay-bolum">
        <h2>{t("ayar.arkaPlan")}</h2>
        <div class="ay-kart">
          <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.arkaPlanAcik")}</strong><span>{t(android ? "ayar.arkaPlanAlt" : "ayar.arkaPlanAltMasaustu")}</span></span><Anahtar acik={tercihler.d.arkaPlan} degis={(v) => { tercihler.yaz("arkaPlan", v); arkaPlanAyarla(v); }} etiket={t("ayar.arkaPlanAcik")} /></div>
          {#if !android}
            <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.acilistaBaslat")}</strong><span>{t("ayar.acilistaBaslatAlt")}</span></span><Anahtar acik={tercihler.d.acilistaBaslat} degis={(v) => { tercihler.yaz("acilistaBaslat", v); arkaPlanAyarla(tercihler.d.arkaPlan); }} etiket={t("ayar.acilistaBaslat")} kilitli={!tercihler.d.arkaPlan} /></div>
            <button class="ay-satir dugme" onclick={() => void uygulamadanCik().catch(() => {})}><span class="ay-metin"><strong>{t("ayar.uygulamadanCik")}</strong></span><Ikon ad="cikis" boyut={20} /></button>
          {/if}
          {#if tercihler.d.arkaPlan && !pilMuaf}
            <button class="ay-satir dugme" data-dalga onclick={pilAyariAc}><span class="ay-metin"><strong>{t("ayar.pil")}</strong><span>{t("ayar.pilAlt")}</span></span><Ikon ad="sagOk" boyut={20} /></button>
          {/if}
        </div>
        <p class="ay-not">{t(android ? "ayar.arkaPlanNot" : "ayar.arkaPlanNotMasaustu")}</p>
      </section>
    {/if}

    <section class="ay-bolum">
      <h2>{t("ayar.uygulamaIci")}</h2>
      <div class="ay-kart">
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimAcik")}</strong><span>{t("ayar.uygulamaIciAlt")}</span></span><Anahtar acik={tercihler.d.bildirimAcik} degis={(v) => tercihler.yaz("bildirimAcik", v)} etiket={t("ayar.bildirimAcik")} /></div>
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimOnizleme")}</strong></span><Anahtar acik={tercihler.d.bildirimOnizleme} degis={(v) => tercihler.yaz("bildirimOnizleme", v)} etiket={t("ayar.bildirimOnizleme")} kilitli={!tercihler.d.bildirimAcik} /></div>
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimTitresim")}</strong></span><Anahtar acik={tercihler.d.bildirimTitresim} degis={(v) => tercihler.yaz("bildirimTitresim", v)} etiket={t("ayar.bildirimTitresim")} kilitli={!tercihler.d.bildirimAcik} /></div>
      </div>
    </section>
  </div>
</div>

<style>
  .ayrac { width: auto; min-height: 2.75rem; padding: 0 16px; }
</style>
