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
  import { tercihler } from "../durum/tercihler.svelte";
  import { ayarlar, type AzAnimasyon, type Tema, type VurguAdi, type YaziBoyutu, type YaziTipi } from "../durum/ayarlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";

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
    { id: "safir", ad: "Safir" },
    { id: "zumrut", ad: "Zümrüt" },
    { id: "kehribar", ad: "Kehribar" },
    { id: "ametist", ad: "Ametist" },
    { id: "yakut", ad: "Yakut" },
  ];
  const fontlar = $derived<{ id: YaziTipi; ad: string; not: string }[]>([
    { id: "inter", ad: "Inter", not: t("gorunum.fontVarsayilan") },
    { id: "sistem", ad: t("gorunum.fontSistem"), not: t("gorunum.fontSistemNot") },
    { id: "atkinson", ad: "Atkinson Hyperlegible", not: t("gorunum.fontOkunakli") },
    { id: "nunito", ad: "Nunito", not: t("gorunum.fontYuvarlak") },
    { id: "maple", ad: "Maple Mono", not: t("gorunum.fontMono") },
    { id: "mono", ad: "JetBrains Mono", not: t("gorunum.fontMono") },
  ]);
  const boyutlar = $derived<{ id: YaziBoyutu; ad: string }[]>([
    { id: "kucuk", ad: t("gorunum.kucuk") },
    { id: "normal", ad: t("gorunum.normal") },
    { id: "buyuk", ad: t("gorunum.buyuk") },
  ]);
  const hareketler = $derived<{ id: AzAnimasyon; ad: string }[]>([
    { id: "sistem", ad: t("gorunum.sistem") },
    { id: "acik", ad: t("gorunum.acikHareket") },
  ]);

  function ozelRenkSec(e: Event) {
    ayarlar.gorunumYaz("ozelRenk", (e.currentTarget as HTMLInputElement).value);
    ayarlar.gorunumYaz("vurgu", "ozel");
  }
</script>

<div class="sayfa">
  <Baslik baslik={t("gorunum.baslik")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <!-- Live preview: an incoming and an outgoing bubble in the chosen theme, accent, font and size -->
    <!-- Canlı önizleme: seçilen tema, vurgu, yazı tipi ve boyutta bir gelen ve bir giden balon -->
    <div class="onizleme" aria-label={t("gorunum.onizleme")}>
      <div class="gelen">{t("gorunum.onizlemeGelen")}</div>
      <div class="giden">{t("gorunum.onizlemeGiden")}</div>
    </div>

    <section>
      <h2>{t("gorunum.tema")}</h2>
      <Secici secenekler={temalar} deger={ayarlar.tema} sec={(id) => ayarlar.gorunumYaz("tema", id)} etiket={t("gorunum.tema")} />
      <div class="satir">
        <div class="metin"><strong>{t("gorunum.amoled")}</strong><span>{t("gorunum.amoledAlt")}</span></div>
        <Anahtar acik={ayarlar.amoled} degis={(v) => ayarlar.gorunumYaz("amoled", v)} etiket={t("gorunum.amoled")} />
      </div>
    </section>

    <section>
      <h2>{t("gorunum.vurgu")}</h2>
      <div class="taslar" role="radiogroup" aria-label={t("gorunum.vurgu")}>
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
      </div>
      <p class="not">{taslar.find((x) => x.id === ayarlar.vurgu)?.ad ?? t("gorunum.ozelRenk")}</p>
    </section>

    <section>
      <h2>{t("gorunum.yaziTipi")}</h2>
      <div class="kart" role="radiogroup" aria-label={t("gorunum.yaziTipi")}>
        {#each fontlar as f (f.id)}
          <button class="font-satir" role="radio" aria-checked={ayarlar.yaziTipi === f.id} onclick={() => ayarlar.gorunumYaz("yaziTipi", f.id)}>
            <span class="font-metin" data-f={f.id}><strong>{f.ad}</strong><span>{f.not}</span></span>
            {#if ayarlar.yaziTipi === f.id}<span class="secili-ikon"><Ikon ad="onay" boyut={20} /></span>{/if}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h2>{t("gorunum.yaziBoyutu")}</h2>
      <Secici secenekler={boyutlar} deger={ayarlar.yaziBoyutu} sec={(id) => ayarlar.gorunumYaz("yaziBoyutu", id)} etiket={t("gorunum.yaziBoyutu")} />
    </section>

    <section>
      <h2>{t("ayar.sohbetGorunumu")}</h2>
      <button class="satir dugme" onclick={() => (sohbetGorunumuAcik = true)}>
        <div class="metin"><strong>{t("ayar.sohbetGorunumu")}</strong><span>{t("ayar.sohbetGorunumuAlt")}</span></div>
        <Ikon ad="sagOk" boyut={20} />
      </button>
    </section>

    <section>
      <h2>{t("ayar.saatBicimi")}</h2>
      <Secici secenekler={saatler} deger={tercihler.d.saat24 ? "24" : "12"} sec={(id) => tercihler.yaz("saat24", id === "24")} etiket={t("ayar.saatBicimi")} />
    </section>

    <section>
      <h2>{t("ayar.titresim")}</h2>
      <div class="satir">
        <div class="metin"><strong>{t("ayar.titresim")}</strong><span>{t("ayar.titresimAlt")}</span></div>
        <Anahtar acik={tercihler.d.titresim} degis={(v) => tercihler.yaz("titresim", v)} etiket={t("ayar.titresim")} />
      </div>
    </section>

    <section>
      <h2>{t("gorunum.animasyon")}</h2>
      <Secici secenekler={hareketler} deger={ayarlar.azAnimasyon} sec={(id) => ayarlar.gorunumYaz("azAnimasyon", id)} etiket={t("gorunum.animasyon")} />
      <p class="not">{t("gorunum.animasyonAlt")}</p>
    </section>
  </div>
</div>

{#if sohbetGorunumuAcik}<OzellestirSayfasi onkapat={() => (sohbetGorunumuAcik = false)} />{/if}

<style>
  .sayfa { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--zemin); }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px 24px; display: grid; gap: 24px; align-content: start; }
  section { display: grid; gap: 12px; }
  h2 { font-family: var(--yazi-tipi); font-size: .8125rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--yazi-2); padding: 0 4px; }
  .not { font-size: .8125rem; color: var(--yazi-2); padding: 0 4px; }

  .onizleme { display: grid; gap: 4px; padding: 16px; border-radius: 16px; background: var(--zemin); border: 1px solid var(--kenar-ince); }
  .gelen, .giden { max-width: 78%; padding: 8px 12px; border-radius: 16px; font-size: .9375rem; line-height: 1.4; }
  .gelen { background: var(--yuzey-2); border-bottom-left-radius: 4px; justify-self: start; }
  .giden { background: var(--ton); color: var(--ton-ustu); border-bottom-right-radius: 4px; justify-self: end; }

  .satir { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 4px 4px 4px 16px; border-radius: 16px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); }
  .dugme { width: 100%; text-align: left; padding-right: 16px; }
  .metin { flex: 1; min-width: 0; display: grid; }
  .metin strong { font-size: .9375rem; font-weight: 500; }
  .metin span { font-size: .8125rem; color: var(--yazi-2); }

  .taslar { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px; }
  /* 44px rounded squares (design: accent swatches) · 44px yuvarlatılmış kareler (tasarım: vurgu örnekleri) */
  .tas { position: relative; width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: var(--zemin); outline: 2px solid transparent; outline-offset: 3px; transition: outline-color var(--sure-hizli) var(--egri-cikis); }
  .tas[aria-checked="true"], .tas.secili { outline-color: var(--yazi); }
  .isaret { display: inline-flex; }
  .ozel { cursor: pointer; }
  .ozel input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: 0; }
  .ozel:focus-within { outline-color: var(--vurgu); }
  .ozel .isaret { pointer-events: none; color: var(--zemin); mix-blend-mode: difference; }

  .kart { display: grid; border-radius: 16px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); overflow: hidden; }
  .font-satir { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px; text-align: left; border-bottom: 1px solid var(--kenar-ince); transition: background var(--sure-hizli) var(--egri-cikis); }
  .font-satir:last-child { border-bottom: 0; }
  .font-satir:active { background: var(--yuzey-2); }
  .font-metin { flex: 1; min-width: 0; display: grid; }
  .font-metin strong { font-size: 1rem; font-weight: 600; }
  .font-metin span { font-size: .8125rem; color: var(--yazi-2); }
  .secili-ikon { color: var(--vurgu); display: inline-flex; }
  /* Each row is drawn in its own family so the choice previews itself. · Her satır kendi ailesiyle çizilir; seçenek kendini önizler. */
  [data-f="inter"] { font-family: "Inter", system-ui, sans-serif; }
  [data-f="sistem"] { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  [data-f="atkinson"] { font-family: "Atkinson Hyperlegible", system-ui, sans-serif; }
  [data-f="nunito"] { font-family: "Nunito", system-ui, sans-serif; }
  [data-f="maple"] { font-family: "Maple Mono", ui-monospace, monospace; }
  [data-f="mono"] { font-family: "JetBrains Mono", ui-monospace, monospace; }
</style>
