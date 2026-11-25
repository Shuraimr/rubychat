<!--
  Görünüm (appearance) page: live preview, theme, AMOLED black, accent (rubyyard gems + a custom colour), font, text size, reduced motion.
  Every choice is saved on the device and applied at once (ayarlar.svelte.ts writes attributes on <html>; styles/tokens.css reacts).
  Görünüm sayfası: canlı önizleme, tema, AMOLED siyah, vurgu (rubyyard taşları + özel renk), yazı tipi, yazı boyutu, azaltılmış hareket.
  Her seçim cihazda saklanır ve hemen uygulanır (ayarlar.svelte.ts <html> üzerine öznitelik yazar; styles/tokens.css bunlara tepki verir).
-->
<script lang="ts">
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import OzellestirSayfasi from "../bilesenler/OzellestirSayfasi.svelte";
  import Secici from "../bilesenler/Secici.svelte";
  import { tercihler, type Kompakt } from "../durum/tercihler.svelte";
  import { ayarlar, type AzAnimasyon, type Tema, type VurguAdi, type YaziBoyutu, type YaziTipi } from "../durum/ayarlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { dil, dilSecimi, dilYaz, t } from "../i18n";

  let kenar = $state(false);
  let sohbetGorunumuAcik = $state(false);
  const saatler = $derived<{ id: "24" | "12"; ad: string }[]>([
    { id: "24", ad: t("ayar.saat24") },
    { id: "12", ad: t("ayar.saat12") },
  ]);

  const temalar = $derived<{ id: Tema; ad: string }[]>([
    { id: "sistem", ad: t("gorunum.sistem") },
    { id: "koyu", ad: t("gorunum.koyu") },
    { id: "acik", ad: t("gorunum.acik") },
  ]);
  const taslar: { id: Exclude<VurguAdi, "ozel">; ad: string }[] = [
    { id: "safir", ad: dil === "en" ? "Sapphire" : "Safir" },
    { id: "zumrut", ad: dil === "en" ? "Emerald" : "Zümrüt" },
    { id: "kehribar", ad: dil === "en" ? "Amber" : "Kehribar" },
    { id: "ametist", ad: dil === "en" ? "Amethyst" : "Ametist" },
    { id: "yakut", ad: dil === "en" ? "Ruby" : "Yakut" },
  ];
  const fontlar = $derived<{ id: YaziTipi; ad: string; not: string }[]>([
    { id: "inter", ad: "Inter", not: t("gorunum.fontVarsayilan") },
    { id: "sistem", ad: t("gorunum.fontSistem"), not: t("gorunum.fontSistemNot") },
    { id: "atkinson", ad: "Atkinson Hyperlegible", not: t("gorunum.fontOkunakli") },
    { id: "maple", ad: "Maple Mono", not: t("gorunum.fontMono") },
  ]);
  const diller: { id: "sistem" | "tr" | "en"; ad: string }[] = [
    { id: "sistem", ad: t("gorunum.sistem") },
    { id: "tr", ad: "Türkçe" },
    { id: "en", ad: "English" },
  ];
  const boyutlar = $derived<{ id: YaziBoyutu; ad: string }[]>([
    { id: "kucuk", ad: t("gorunum.kucuk") },
    { id: "normal", ad: t("gorunum.normal") },
    { id: "buyuk", ad: t("gorunum.buyuk") },
  ]);
  const hareketler = $derived<{ id: AzAnimasyon; ad: string }[]>([
    { id: "sistem", ad: t("gorunum.sistem") },
    { id: "acik", ad: t("gorunum.acikHareket") },
  ]);

  // Only where there is a mouse: a phone has neither windows nor these keys. · Yalnızca fare olan yerde: telefonda pencere de bu tuşlar da yok.
  const masaustu = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  const kompaktlar = $derived<{ id: Kompakt; ad: string }[]>([
    { id: "otomatik", ad: t("klavye.otomatik") },
    { id: "acik", ad: t("klavye.acik") },
    { id: "kapali", ad: t("klavye.kapali") },
  ]);

  function ozelRenkSec(e: Event) {
    ayarlar.gorunumYaz("ozelRenk", (e.currentTarget as HTMLInputElement).value);
    ayarlar.gorunumYaz("vurgu", "ozel");
  }
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("gorunum.baslik")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="ay-icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <!-- Live preview: an incoming and an outgoing bubble in the chosen theme, accent, font and size -->
    <!-- Canlı önizleme: seçilen tema, vurgu, yazı tipi ve boyutta bir gelen ve bir giden balon -->
    <div class="onizleme" aria-label={t("gorunum.onizleme")}>
      <div class="gelen">{t("gorunum.onizlemeGelen")}</div>
      <div class="giden">{t("gorunum.onizlemeGiden")}</div>
    </div>

    <section class="ay-bolum">
      <h2>{t("gorunum.tema")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={temalar} deger={ayarlar.tema} sec={(id) => ayarlar.gorunumYaz("tema", id)} etiket={t("gorunum.tema")} /></div>
      <div class="ay-satir">
        <div class="ay-metin"><strong>{t("gorunum.amoled")}</strong><span>{t("gorunum.amoledAlt")}</span></div>
        <Anahtar acik={ayarlar.amoled} degis={(v) => ayarlar.gorunumYaz("amoled", v)} etiket={t("gorunum.amoled")} />
      </div></div>
    </section>

    <section class="ay-bolum">
      <h2>{t("gorunum.vurgu")}</h2>
      <div class="ay-kart govde"><div class="taslar" role="radiogroup" aria-label={t("gorunum.vurgu")}>
        {#each taslar as tas (tas.id)}
          <button class="tas" role="radio" aria-checked={ayarlar.vurgu === tas.id} aria-label={tas.ad} style:background="var(--tas-{tas.id})" onclick={() => ayarlar.gorunumYaz("vurgu", tas.id)}>
            {#if ayarlar.vurgu === tas.id}<span class="isaret"><Ikon ad="onay" boyut={22} /></span>{/if}
          </button>
        {/each}
        <!-- Custom colour: a native colour picker; --vurgu is the chosen colour, the tones are derived from it -->
        <!-- Özel renk: yerel renk seçici; --vurgu seçilen renktir, tonlar ondan türetilir -->
        <label class="tas ozel" class:secili={ayarlar.vurgu === "ozel"} style:background={ayarlar.ozelRenk}>
          <input type="color" value={ayarlar.ozelRenk} oninput={ozelRenkSec} aria-label={t("gorunum.ozelRenk")} />
          {#if ayarlar.vurgu === "ozel"}<span class="isaret"><Ikon ad="onay" boyut={22} /></span>{:else}<span class="isaret"><Ikon ad="palet" boyut={22} /></span>{/if}
        </label>
      </div></div>
      <p class="ay-not">{taslar.find((x) => x.id === ayarlar.vurgu)?.ad ?? t("gorunum.ozelRenk")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("gorunum.yaziTipi")}</h2>
      <div class="ay-kart" role="radiogroup" aria-label={t("gorunum.yaziTipi")}>
        {#each fontlar as f (f.id)}
          <button class="ay-satir dugme" role="radio" aria-checked={ayarlar.yaziTipi === f.id} onclick={() => ayarlar.gorunumYaz("yaziTipi", f.id)}>
            <span class="ay-metin" data-f={f.id}><strong>{f.ad}</strong><span>{f.not}</span></span>
            {#if ayarlar.yaziTipi === f.id}<span class="secili-ikon"><Ikon ad="onay" boyut={20} /></span>{/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="ay-bolum">
      <h2>{t("gorunum.yaziBoyutu")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={boyutlar} deger={ayarlar.yaziBoyutu} sec={(id) => ayarlar.gorunumYaz("yaziBoyutu", id)} etiket={t("gorunum.yaziBoyutu")} /></div></div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart"><button class="ay-satir dugme" data-dalga onclick={() => (sohbetGorunumuAcik = true)}>
        <span class="ay-simge"><Ikon ad="galeri" boyut={20} /></span>
        <div class="ay-metin"><strong>{t("ayar.sohbetGorunumu")}</strong><span>{t("ayar.sohbetGorunumuAlt")}</span></div>
        <Ikon ad="sagOk" boyut={20} />
      </button></div>
    </section>

    {#if masaustu}
      <section class="ay-bolum">
        <h2>{t("klavye.masaustu")}</h2>
        <div class="ay-kart">
          <div class="ay-satir"><div class="ay-metin"><strong>{t("klavye.kompakt")}</strong><span>{t("klavye.kompaktAlt")}</span></div></div>
          <div class="ay-secici"><Secici secenekler={kompaktlar} deger={tercihler.d.kompakt} sec={(id) => tercihler.yaz("kompakt", id)} etiket={t("klavye.kompakt")} /></div>
        </div>
      </section>
    {/if}

    <section class="ay-bolum">
      <h2>{t("gorunum.dil")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={diller} deger={dilSecimi()} sec={dilYaz} etiket={t("gorunum.dil")} /></div></div>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.saatBicimi")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={saatler} deger={tercihler.d.saat24 ? "24" : "12"} sec={(id) => tercihler.yaz("saat24", id === "24")} etiket={t("ayar.saatBicimi")} /></div></div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart"><div class="ay-satir">
        <div class="ay-metin"><strong>{t("ayar.titresim")}</strong><span>{t("ayar.titresimAlt")}</span></div>
        <Anahtar acik={tercihler.d.titresim} degis={(v) => tercihler.yaz("titresim", v)} etiket={t("ayar.titresim")} />
      </div></div>
    </section>

    <section class="ay-bolum">
      <h2>{t("gorunum.animasyon")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={hareketler} deger={ayarlar.azAnimasyon} sec={(id) => ayarlar.gorunumYaz("azAnimasyon", id)} etiket={t("gorunum.animasyon")} /></div></div>
      <p class="ay-not">{t("gorunum.animasyonAlt")}</p>
    </section>
  </div>
</div>

{#if sohbetGorunumuAcik}<OzellestirSayfasi onkapat={() => (sohbetGorunumuAcik = false)} />{/if}

<style>
  .onizleme { display: grid; gap: 2px; padding: 1rem; border-radius: 1.5rem; background: var(--yuzey-1); }
  .gelen, .giden { max-width: 78%; padding: .5rem .75rem; border-radius: 1.25rem; font-size: .9375rem; line-height: 1.4; }
  .gelen { background: var(--gelen-dolgu); border-bottom-left-radius: .375rem; justify-self: start; }
  .giden { background: var(--giden-dolgu); border-bottom-right-radius: .375rem; justify-self: end; }
  .secili-ikon { color: var(--vurgu); display: inline-flex; }
  .taslar { display: grid; grid-template-columns: repeat(auto-fit, minmax(2.75rem, 1fr)); gap: .5rem; justify-items: center; }
  /* 48px round accent swatches · 48px yuvarlak vurgu örnekleri */
  .tas { position: relative; width: 2.5rem; height: 2.5rem; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--zemin); outline: 2px solid transparent; outline-offset: 3px; transition: outline-color var(--sure-hizli) var(--egri-cikis); }
  .tas[aria-checked="true"], .tas.secili { outline-color: var(--yazi); }
  .isaret { display: inline-flex; }
  .ozel { cursor: pointer; }
  .ozel input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: 0; }
  .ozel:focus-within { outline-color: var(--vurgu); }
  .ozel .isaret { pointer-events: none; color: var(--vurgu-ustu); }

  /* Each row is drawn in its own family so the choice previews itself. · Her satır kendi ailesiyle çizilir; seçenek kendini önizler. */
  [data-f="inter"] { font-family: "Inter", system-ui, sans-serif; }
  [data-f="sistem"] { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  [data-f="atkinson"] { font-family: "Atkinson Hyperlegible", system-ui, sans-serif; }
  [data-f="maple"] { font-family: "Maple Mono", ui-monospace, monospace; }
</style>
