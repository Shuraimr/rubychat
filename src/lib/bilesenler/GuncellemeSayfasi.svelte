<!--
  In-app update sheet (mounted once in App.svelte, independent of login state).
  Uses AltSayfa: bottom sheet on phones, centred modal dialog on tablets/desktop.
  Handles all states: new release notes, Android unknown-source permission guide, download & SHA-256 progress, Flatpak ready command, and errors.
  Uygulama içi güncelleme sayfası (App.svelte'te oturumdan bağımsız tek yerde bağlanır).
  AltSayfa kullanır: telefonda alt sayfa, tablet/masaüstünde ortada pencere.
  Tüm halleri yönetir: sürüm notları, Android izin rehberi, indirme ve SHA-256 ilerlemesi, Flatpak hazır komutu ve hatalar.
-->
<script lang="ts">
  import { klasorAc } from "../disAc";
  import { baglantiSayfasi } from "../durum/baglantiOnay.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { guncelleme } from "../durum/guncelleme.svelte";
  import { t } from "../i18n";
  import { panoyaYaz } from "../pano";
  import AltSayfa from "./AltSayfa.svelte";
  import Ikon from "./Ikon.svelte";

  const SURUMLER_SAYFASI = "https://github.com/Shuraimr/rubychat/releases";

  let kopyalandi = $state(false);
  let kopyaZamanlayici: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!guncelleme.sayfaAcik) {
      kopyalandi = false;
      clearTimeout(kopyaZamanlayici);
    }
  });

  type NotSatiri =
    | { tur: "baslik"; metin: string }
    | { tur: "madde"; metin: string }
    | { tur: "paragraf"; metin: string };

  type SatirParcasi = { tur: "duz" | "kalin" | "kod"; metin: string };

  /** Splits simple inline **bold** and `code` spans for safe Svelte rendering without {@html}. · {@html} olmadan güvenli çizim için basit **kalın** ve `kod` parçalarını ayırır. */
  function parcalaraAyir(metin: string): SatirParcasi[] {
    const sonuc: SatirParcasi[] = [];
    const des = /`([^`]+)`|\*\*([^*]+)\*\*/g;
    let son = 0;
    let es: RegExpExecArray | null;
    while ((es = des.exec(metin)) !== null) {
      if (es.index > son) sonuc.push({ tur: "duz", metin: metin.slice(son, es.index) });
      if (es[1] !== undefined) sonuc.push({ tur: "kod", metin: es[1] });
      else if (es[2] !== undefined) sonuc.push({ tur: "kalin", metin: es[2] });
      son = des.lastIndex;
    }
    if (son < metin.length) sonuc.push({ tur: "duz", metin: metin.slice(son) });
    return sonuc;
  }

  function notSatirlari(ham: string): NotSatiri[] {
    const sonuc: NotSatiri[] = [];
    for (const satir of ham.split(/\r?\n/)) {
      const temiz = satir.trim();
      if (!temiz) continue;
      const b = temiz.match(/^#{1,6}\s+(.*)$/);
      if (b) {
        sonuc.push({ tur: "baslik", metin: b[1].trim() });
        continue;
      }
      const m = temiz.match(/^[-*•]\s+(.*)$/);
      if (m) {
        sonuc.push({ tur: "madde", metin: m[1].trim() });
        continue;
      }
      sonuc.push({ tur: "paragraf", metin: temiz });
    }
    return sonuc;
  }

  function mbYaz(bayt: number): string {
    const mb = bayt / (1024 * 1024);
    if (mb >= 10) return String(Math.round(mb));
    return mb.toFixed(1).replace(/\.0$/, "");
  }

  function kabukYol(yol: string): string {
    return /^[A-Za-z0-9_./:-]+$/.test(yol) ? yol : `'${yol.replaceAll("'", "'\\''")}'`;
  }

  const yeni = $derived(guncelleme.bilgi?.yeni ?? null);
  const mevcut = $derived(guncelleme.bilgi?.mevcut || guncelleme.mevcutSurum || "—");
  const varlik = $derived(guncelleme.varlik);
  const satirlar = $derived(yeni ? notSatirlari(yeni.notlar) : []);

  const toplamBayt = $derived(guncelleme.ilerleme.toplam || varlik?.boyut || 0);
  const indirilenBayt = $derived(guncelleme.ilerleme.indirilen);
  const oran = $derived(
    guncelleme.durum === "dogrulaniyor"
      ? 1
      : toplamBayt > 0
        ? Math.min(1, Math.max(0, indirilenBayt / toplamBayt))
        : 0,
  );
  const yuzde = $derived(Math.round(oran * 100));

  const flatpakKomutu = $derived(
    guncelleme.indirilenYol ? `flatpak install --user --bundle ${kabukYol(guncelleme.indirilenYol)}` : "",
  );

  const sayfaBaslik = $derived.by(() => {
    switch (guncelleme.durum) {
      case "izin":
        return t("ayar.guncellemeler");
      case "indiriliyor":
        return t("guncelleme.indiriliyorBaslik");
      case "dogrulaniyor":
        return t("guncelleme.dogrulaniyorBaslik");
      case "hazir":
        return t("guncelleme.hazirBaslik");
      case "hata":
        return t("guncelleme.hataBaslik");
      default:
        return t("guncelleme.yeniBaslik");
    }
  });

  async function komutuKopyala() {
    if (!flatpakKomutu) return;
    try {
      await panoyaYaz(flatpakKomutu);
      kopyalandi = true;
      clearTimeout(kopyaZamanlayici);
      kopyaZamanlayici = setTimeout(() => (kopyalandi = false), 2200);
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  async function klasoruAc() {
    if (!guncelleme.indirilenYol) return;
    try {
      await klasorAc(guncelleme.indirilenYol);
    } catch {
      bildirim.goster(t("guncelleme.klasorAcilamadi"), 4000, { tur: "hata" });
    }
  }
</script>

{#snippet bicimliSatir(metin: string)}
  {#each parcalaraAyir(metin) as p, i (i)}
    {#if p.tur === "kalin"}<strong>{p.metin}</strong>{:else if p.tur === "kod"}<code>{p.metin}</code>{:else}{p.metin}{/if}
  {/each}
{/snippet}

{#if guncelleme.sayfaAcik}
  <AltSayfa baslik={sayfaBaslik} onkapat={() => guncelleme.sayfaKapat()} yerlesim="orta">
    {#if guncelleme.durum === "izin"}
      <div class="kahraman">
        <span class="simge-kutu uyari" aria-hidden="true"><Ikon ad="kalkan" boyut={24} /></span>
        <h3 class="t-m">{t("guncelleme.izinBaslik")}</h3>
        <p class="aciklama">{t("guncelleme.izinAciklama")}</p>
      </div>
      <ol class="adim-kutu">
        <li><span class="no">1</span><span>{t("guncelleme.izinAdim1")}</span></li>
        <li><span class="no">2</span><span>{t("guncelleme.izinAdim2")}</span></li>
        <li><span class="no">3</span><span>{t("guncelleme.izinAdim3")}</span></li>
      </ol>
    {:else if guncelleme.durum === "indiriliyor" || guncelleme.durum === "dogrulaniyor"}
      <div class="ilerleme-kutu">
        <div class="cubuk-iz" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={yuzde}>
          <div class="cubuk-dolgu" style:transform="scaleX({oran})"></div>
        </div>
        <div class="ilerleme-metin">
          <span class="boyut">{#if toplamBayt > 0}{mbYaz(indirilenBayt)} / {mbYaz(toplamBayt)} MB{:else}{mbYaz(indirilenBayt)} MB{/if}</span>
          <span class="yuzde">%{yuzde}</span>
        </div>
      </div>

      <ul class="durum-adimlar">
        {#if guncelleme.android}
          <li class="tamam"><span class="adim-isaret" aria-hidden="true"><Ikon ad="onay" boyut={18} /></span><span>{t("guncelleme.adimIzin")}</span></li>
        {/if}
        <li class:tamam={guncelleme.durum === "dogrulaniyor"} class:etkin={guncelleme.durum === "indiriliyor"}>
          <span class="adim-isaret" aria-hidden="true">
            {#if guncelleme.durum === "dogrulaniyor"}<Ikon ad="onay" boyut={18} />{:else}<span class="nokta-etkin"></span>{/if}
          </span>
          <span>{t("guncelleme.adimIndir")}</span>
        </li>
        <li class:etkin={guncelleme.durum === "dogrulaniyor"}>
          <span class="adim-isaret" aria-hidden="true">
            <span class={guncelleme.durum === "dogrulaniyor" ? "nokta-etkin" : "nokta-bekle"}></span>
          </span>
          <span>{t("guncelleme.adimDogrula")}</span>
        </li>
        <li>
          <span class="adim-isaret" aria-hidden="true"><span class="nokta-bekle"></span></span>
          <span>{t(guncelleme.android ? "guncelleme.adimKur" : "guncelleme.adimHazirla")}</span>
        </li>
      </ul>

      <p class="kucuk-not">{t("guncelleme.cikabilirsin")}</p>
    {:else if guncelleme.durum === "hazir"}
      {#if !guncelleme.android}
        <p class="aciklama">{t("guncelleme.flatpakAciklama")}</p>
        {#if guncelleme.indirilenYol}
          <div class="dosya-satir">
            <span class="tamam-simge" aria-hidden="true"><Ikon ad="onay" boyut={20} /></span>
            <span class="dosya-metin">
              <code class="yol">{guncelleme.indirilenYol}</code>
              <span class="sha-etiket">{t("guncelleme.shaEsles")}</span>
            </span>
          </div>
          <div class="komut-kutu">
            <code class="komut">{flatpakKomutu}</code>
            <button class="buton tonlu kopya-dugme" type="button" onclick={() => void komutuKopyala()}>
              <Ikon ad={kopyalandi ? "onay" : "kopya"} boyut={18} />
              {kopyalandi ? t("guncelleme.kopyalandi") : t("guncelleme.kopyala")}
            </button>
          </div>
        {/if}
      {:else}
        <div class="kahraman">
          <span class="simge-kutu tamam" aria-hidden="true"><Ikon ad="onay" boyut={24} /></span>
          <p class="aciklama">{t("guncelleme.androidHazirAciklama")}</p>
        </div>
      {/if}
    {:else if guncelleme.durum === "hata"}
      <div class="kahraman">
        <span class="simge-kutu hata" aria-hidden="true"><Ikon ad="uyari" boyut={24} /></span>
        <p class="hata-metin" role="alert">{guncelleme.hata || t("hata.diger")}</p>
      </div>
    {:else if yeni}
      <div class="kahraman">
        <span class="simge-kutu ton" aria-hidden="true"><Ikon ad="indir" boyut={24} /></span>
        <h3 class="t-m">{t("guncelleme.yeniBaslik")}</h3>
        <p class="surum-ozet mono">
          {mevcut} → {yeni.surum}{#if varlik && varlik.boyut > 0} · {mbYaz(varlik.boyut)} MB{/if}
        </p>
      </div>

      <div class="notlar-kutu">
        {#if satirlar.length === 0}
          <p class="not-bos">{t("guncelleme.notYok")}</p>
        {:else}
          {#each satirlar as s, i (i)}
            {#if s.tur === "baslik"}
              <h4 class="not-baslik">{s.metin}</h4>
            {:else if s.tur === "madde"}
              <div class="not-madde">
                <span class="madde-nokta" aria-hidden="true">•</span>
                <span>{@render bicimliSatir(s.metin)}</span>
              </div>
            {:else}
              <p class="not-satir">{@render bicimliSatir(s.metin)}</p>
            {/if}
          {/each}
        {/if}
      </div>

      <p class="kucuk-not">{t("guncelleme.notlarOdasi")}</p>
    {/if}

    {#snippet altlik()}
      {#if guncelleme.durum === "izin"}
        <button class="buton birincil" type="button" onclick={() => void guncelleme.izinAc()}>{t("guncelleme.izinAc")}</button>
        <button class="buton cizgili" type="button" onclick={() => guncelleme.iptal()}>{t("guncelleme.vazgec")}</button>
      {:else if guncelleme.durum === "indiriliyor" || guncelleme.durum === "dogrulaniyor"}
        <button class="buton cizgili" type="button" onclick={() => guncelleme.iptal()}>{t("eylem.iptal")}</button>
      {:else if guncelleme.durum === "hazir"}
        {#if !guncelleme.android}
          <div class="ikili">
            {#if guncelleme.indirilenYol}
              <button class="buton tonlu" type="button" onclick={() => void klasoruAc()}>
                <Ikon ad="klasor" boyut={18} />{t("guncelleme.klasoruAc")}
              </button>
            {/if}
            <button class="buton birincil" type="button" onclick={() => guncelleme.sayfaKapat()}>{t("eylem.tamam")}</button>
          </div>
        {:else}
          <button class="buton birincil" type="button" onclick={() => void guncelleme.kurTekrar()}>{t("guncelleme.yuklemeyiAc")}</button>
          <button class="buton cizgili" type="button" onclick={() => guncelleme.sayfaKapat()}>{t("eylem.tamam")}</button>
        {/if}
      {:else if guncelleme.durum === "hata"}
        <button class="buton birincil" type="button" onclick={() => void (yeni ? guncelleme.baslat() : guncelleme.denetle(true))}>
          {t("guncelleme.yenidenDene")}
        </button>
        <button class="buton cizgili" type="button" onclick={() => baglantiSayfasi(yeni?.sayfa || SURUMLER_SAYFASI)}>
          {t("guncelleme.githubdaAc")}
        </button>
      {:else if yeni}
        <button class="buton birincil" type="button" onclick={() => void guncelleme.baslat()}>{t("guncelleme.guncelle")}</button>
        <div class="ikili">
          <button class="buton cizgili" type="button" onclick={() => guncelleme.sayfaKapat()}>{t("guncelleme.sonra")}</button>
          <button class="buton metin" type="button" onclick={() => guncelleme.surumuAtla()}>{t("guncelleme.atla")}</button>
        </div>
      {/if}
    {/snippet}
  </AltSayfa>
{/if}

<style>
  .kahraman {
    display: grid;
    gap: 8px;
    justify-items: start;
  }
  .simge-kutu {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .simge-kutu.ton {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .simge-kutu.uyari {
    background: color-mix(in srgb, var(--bekliyor) 18%, var(--zemin));
    color: var(--bekliyor);
  }
  .simge-kutu.tamam {
    background: color-mix(in srgb, var(--cozum) 18%, var(--zemin));
    color: var(--cozum);
  }
  .simge-kutu.hata {
    background: color-mix(in srgb, var(--hata) 18%, var(--zemin));
    color: var(--hata);
  }

  .surum-ozet {
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .aciklama {
    font-size: .875rem;
    line-height: 1.5;
    color: var(--yazi-2);
  }
  .hata-metin {
    font-size: .9375rem;
    line-height: 1.45;
    color: var(--hata);
  }
  .kucuk-not {
    font-size: .8125rem;
    color: var(--yazi-2);
  }

  .notlar-kutu {
    background: var(--yuzey-2);
    border-radius: 16px;
    padding: 14px 16px;
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: grid;
    gap: 6px;
    font-size: .875rem;
    line-height: 1.45;
    color: var(--yazi);
    -webkit-user-select: text;
    user-select: text;
  }
  .not-baslik {
    margin: 6px 0 0;
    font-size: .875rem;
    font-weight: 600;
    color: var(--vurgu);
  }
  .not-baslik:first-child {
    margin-top: 0;
  }
  .not-madde {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .madde-nokta {
    flex: none;
    color: var(--vurgu);
    font-weight: 700;
  }
  .not-satir {
    margin: 0;
  }
  .not-bos {
    margin: 0;
    color: var(--yazi-2);
  }
  .notlar-kutu code {
    padding: 1px 5px;
    border-radius: 6px;
    background: var(--yuzey-3);
    font-size: .8125rem;
  }

  .adim-kutu {
    margin: 0;
    padding: 14px 16px;
    list-style: none;
    background: var(--yuzey-2);
    border-radius: 16px;
    display: grid;
    gap: 12px;
  }
  .adim-kutu li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: .875rem;
    line-height: 1.4;
  }
  .no {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--ton);
    color: var(--ton-ustu);
    font-size: .8125rem;
    font-weight: 700;
  }

  .ilerleme-kutu {
    display: grid;
    gap: 8px;
  }
  .cubuk-iz {
    height: 8px;
    border-radius: 4px;
    background: var(--yuzey-3);
    overflow: hidden;
  }
  .cubuk-dolgu {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background: var(--vurgu);
    transform-origin: left center;
    transition: transform var(--sure-hizli) linear;
  }
  .ilerleme-metin {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: .875rem;
    color: var(--yazi-2);
    font-variant-numeric: tabular-nums;
  }
  .yuzde {
    font-weight: 600;
    color: var(--yazi);
  }

  .durum-adimlar {
    margin: 0;
    padding: 14px 16px;
    list-style: none;
    background: var(--yuzey-2);
    border-radius: 16px;
    display: grid;
    gap: 10px;
  }
  .durum-adimlar li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .durum-adimlar li.tamam {
    color: var(--cozum);
  }
  .durum-adimlar li.etkin {
    color: var(--yazi);
    font-weight: 600;
  }
  .adim-isaret {
    flex: none;
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nokta-etkin,
  .nokta-bekle {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .nokta-etkin {
    background: var(--vurgu);
  }
  .nokta-bekle {
    background: var(--kenar);
  }

  .dosya-satir {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--yuzey-2);
  }
  .tamam-simge {
    flex: none;
    color: var(--cozum);
    margin-top: 2px;
  }
  .dosya-metin {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .yol {
    font-size: .8125rem;
    color: var(--yazi);
    word-break: break-all;
    -webkit-user-select: text;
    user-select: text;
  }
  .sha-etiket {
    font-size: .75rem;
    font-weight: 600;
    color: var(--cozum);
  }

  .komut-kutu {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
  }
  .komut {
    font-size: .8125rem;
    line-height: 1.5;
    color: var(--yazi);
    word-break: break-all;
    -webkit-user-select: text;
    user-select: text;
  }
  .kopya-dugme {
    width: auto;
    justify-self: start;
    min-height: 44px;
    padding: 0 16px;
  }

  .ikili {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ikili > * {
    flex: 1 1 8rem;
  }
</style>
