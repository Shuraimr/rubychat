<!--
  Ben › Bildirimler: the system permission (card + link to Android settings) and the in-app banner options (on/off, preview, vibration, quiet hours).
  The system notifications themselves are managed by Android, so the screen says so instead of faking switches for them.
  Ben › Bildirimler: sistem izni (kart + Android ayarlarına bağlantı) ve uygulama içi şerit seçenekleri (aç/kapa, önizleme, titreşim, sessiz saatler).
  Sistem bildirimlerini Android yönetir; ekran onlar için sahte anahtarlar koymak yerine bunu söyler.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { bildirimAyarlariniAc } from "../api/komutlar";
  import type { BildirimIzni } from "../api/tipler";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirimIzni, bildirimIzniAc } from "../bildirim-sistem";
  import { gezinme } from "../durum/gezinme.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";

  let izin = $state<BildirimIzni | null>(null);
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
        {#if izin !== "desteklenmiyor"}
          <button class="ay-satir dugme" onclick={() => void bildirimAyarlariniAc().catch(() => {})}>
            <span class="ay-metin"><strong>{t("ayar.sistemAyarlari")}</strong></span><Ikon ad="sagOk" boyut={20} />
          </button>
        {/if}
      </div>
      <p class="ay-not">{t("ayar.notBildirim")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.uygulamaIci")}</h2>
      <div class="ay-kart">
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimAcik")}</strong><span>{t("ayar.uygulamaIciAlt")}</span></span><Anahtar acik={tercihler.d.bildirimAcik} degis={(v) => tercihler.yaz("bildirimAcik", v)} etiket={t("ayar.bildirimAcik")} /></div>
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimOnizleme")}</strong></span><Anahtar acik={tercihler.d.bildirimOnizleme} degis={(v) => tercihler.yaz("bildirimOnizleme", v)} etiket={t("ayar.bildirimOnizleme")} kilitli={!tercihler.d.bildirimAcik} /></div>
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.bildirimTitresim")}</strong></span><Anahtar acik={tercihler.d.bildirimTitresim} degis={(v) => tercihler.yaz("bildirimTitresim", v)} etiket={t("ayar.bildirimTitresim")} kilitli={!tercihler.d.bildirimAcik} /></div>
        <div class="ay-satir"><span class="ay-metin"><strong>{t("ayar.sessizSaatler")}</strong><span>{t("ayar.sessizAlt")}</span></span><Anahtar acik={tercihler.d.sessizSaatler} degis={(v) => tercihler.yaz("sessizSaatler", v)} etiket={t("ayar.sessizSaatler")} kilitli={!tercihler.d.bildirimAcik} /></div>
        {#if tercihler.d.sessizSaatler}
          <div class="ay-satir saatler">
            <label><span>{t("ayar.sessizBas")}</span><input type="time" value={tercihler.d.sessizBas} onchange={(e) => e.currentTarget.value && tercihler.yaz("sessizBas", e.currentTarget.value)} /></label>
            <label><span>{t("ayar.sessizBit")}</span><input type="time" value={tercihler.d.sessizBit} onchange={(e) => e.currentTarget.value && tercihler.yaz("sessizBit", e.currentTarget.value)} /></label>
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .ayrac { width: auto; height: 44px; padding: 0 16px; margin-right: 8px; }
  .saatler { gap: 16px; padding: 8px 16px; }
  label { flex: 1; display: grid; gap: 4px; font-size: .8125rem; color: var(--yazi-2); }
  input[type="time"] { min-height: 44px; padding: 0 12px; border-radius: 12px; background: var(--yuzey-2); border: 1px solid var(--kenar); color: var(--yazi); font-size: 1rem; }
</style>
