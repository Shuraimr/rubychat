<!--
  All encryption sheets in one place (opened through `sifreleme.katman`):
  kurulum (hub) · dogrulama (SAS emoji) · kurtarma-olustur · kurtarma-gir · parola · cikis (logout warning).
  Şifrelemenin bütün sayfaları tek yerde (`sifreleme.katman` ile açılır):
  kurulum (merkez) · dogrulama (SAS emoji) · kurtarma-olustur · kurtarma-gir · parola · cikis (çıkış uyarısı).
-->
<script lang="ts">
  import { panoyaYaz } from "../pano";
  import { bildirim } from "../durum/bildirim.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import Maskot from "./Maskot.svelte";
  import AltSayfa from "./AltSayfa.svelte";
  import EmojiIzgara from "./EmojiIzgara.svelte";
  import GuvenlikSatiri from "./GuvenlikSatiri.svelte";
  import Ikon from "./Ikon.svelte";

  const d = $derived(sifreleme.durum);
  const dog = $derived(sifreleme.dogrulama);

  // Local form fields. They are cleared as soon as the sheet closes so nothing secret lingers in memory longer than needed.
  // Yerel form alanları. Sayfa kapanınca hemen temizlenir; gizli bir şey gerektiğinden uzun bellekte kalmaz.
  let anahtarGirdisi = $state("");
  let parolaGirdisi = $state("");
  let kaydettim = $state(false);
  let kopyalandi = $state(false);

  $effect(() => {
    if (sifreleme.katman !== "kurtarma-gir") anahtarGirdisi = "";
    if (sifreleme.katman !== "parola") parolaGirdisi = "";
    if (sifreleme.katman !== "kurtarma-olustur") {
      kaydettim = false;
      kopyalandi = false;
    }
  });

  const hepsiTamam = $derived(!!d && d.cihazDogrulandi && d.kurtarma === "hazir");

  async function kopyala() {
    // navigator.clipboard can be missing/blocked in a webview: say so instead of failing silently.
    // navigator.clipboard webview'da olmayabilir/engellenebilir: sessizce başarısız olmak yerine söyle.
    try {
      await panoyaYaz(sifreleme.yeniAnahtar ?? "");
      kopyalandi = true;
    } catch {
      bildirim.goster(t("kurtarmaOlustur.kopyalanamadi"));
    }
  }

  async function cikisYap() {
    sifreleme.geri();
    await oturum.cikis();
  }

  function kurtarmaGonder(e: SubmitEvent) {
    e.preventDefault();
    if (anahtarGirdisi.trim()) void sifreleme.kurtarmaKurtar(anahtarGirdisi);
  }
  function parolaGonder(e: SubmitEvent) {
    e.preventDefault();
    if (!parolaGirdisi) return;
    const p = parolaGirdisi;
    parolaGirdisi = "";
    void sifreleme.caprazImzaKur(p);
  }
</script>

{#if sifreleme.katman === "kurulum"}
  <AltSayfa baslik={t("kurulum.baslik")} onkapat={() => sifreleme.kapat()}>
    <Maskot poz="kilit" boyut={96} />
    <p class="aciklama">{t("kurulum.alt")}</p>
    {#if d}
      <!-- Step 1: this device · Adım 1: bu cihaz -->
      <GuvenlikSatiri
        baslik={t("kurulum.adim1")}
        alt={t("guvenlik.cihazDogrulamaAlt")}
        durum={d.cihazDogrulandi ? t("durum.dogrulandi") : d.caprazImza === "bekliyor" ? t("durum.bekliyor") : d.caprazImza === "yok" ? t("durum.kimlikYok") : t("durum.dogrulanmadi")}
        ton={d.cihazDogrulandi ? "tamam" : d.caprazImza === "bekliyor" ? "notr" : "bekliyor"}
      />
      {#if !d.cihazDogrulandi}
        {#if d.caprazImza === "hazir"}
          <!-- Two option cards (design section 12a): the easiest path is on top and tinted. · İki seçenek kartı (tasarım bölüm 12a): en kolay yol üstte ve tonlu. -->
          <div class="eylemler">
            <button class="secenek one-cikan" onclick={() => sifreleme.dogrulamaBaslat("kurulum")} disabled={sifreleme.mesgul}>
              <span class="secenek-simge"><Ikon ad="telefon" boyut={20} /></span>
              <span class="secenek-metin"><strong>{t("kurulum.baskaCihaz")}</strong><span>{t("kurulum.baskaCihazAlt")}</span></span>
            </button>
            {#if d.kurtarma === "eksik"}
              <button class="secenek" onclick={() => sifreleme.ac("kurtarma-gir", "kurulum")}>
                <span class="secenek-simge"><Ikon ad="anahtar" boyut={20} /></span>
                <span class="secenek-metin"><strong>{t("kurulum.anahtarla")}</strong><span>{t("kurulum.anahtarlaAlt")}</span></span>
              </button>
            {/if}
          </div>
        {:else if d.caprazImza === "yok"}
          {#if d.parolaGerekli}
            <p class="aciklama">{t("kurulum.kimlikSifre")}</p>
            <button class="buton birincil" onclick={() => sifreleme.ac("parola", "kurulum")}>{t("eylem.sifreyiGir")}</button>
          {:else}
            <p class="aciklama">{t("kurulum.kimlikYok")}</p>
          {/if}
        {:else}
          <p class="aciklama">{t("kurulum.kimlikBekle")}</p>
        {/if}
        {#if sifreleme.hata}<p class="hata" role="alert">{sifreleme.hata}</p>{/if}
      {/if}

      <hr />

      <!-- Step 2: recovery key · Adım 2: kurtarma anahtarı -->
      <GuvenlikSatiri
        baslik={t("kurulum.adim2")}
        alt={t("guvenlik.kurtarmaAlt")}
        durum={d.kurtarma === "hazir" ? t("durum.hazir") : d.kurtarma === "eksik" ? t("durum.gerekli") : t("durum.kurulmadi")}
        ton={d.kurtarma === "hazir" ? "tamam" : "bekliyor"}
        eylem={d.kurtarma === "kapali" && d.caprazImza === "hazir" ? t("eylem.olustur") : d.kurtarma === "eksik" && d.cihazDogrulandi ? t("eylem.anahtariGir") : undefined}
        onEylem={() => (d.kurtarma === "kapali" ? sifreleme.ac("kurtarma-olustur", "kurulum") : sifreleme.ac("kurtarma-gir", "kurulum"))}
      />
      {#if hepsiTamam}
        <p class="tamam"><Ikon ad="onay" boyut={18} />{t("kurulum.hepsiTamam")}</p>
      {/if}
    {/if}
    {#snippet altlik()}
      <button class="buton {hepsiTamam ? 'birincil' : 'metin'}" onclick={() => sifreleme.kapat()}>{hepsiTamam ? t("eylem.tamam") : t("kurulum.simdilikGec")}</button>
    {/snippet}
  </AltSayfa>
{:else if sifreleme.katman === "dogrulama"}
  <AltSayfa baslik={dog.asama === "gelen_istek" ? t("dogrulama.gelenBaslik") : t("dogrulama.baslik")} onkapat={() => sifreleme.kapat()}>
    {#if dog.asama === "istek_gonderildi" || dog.asama === "yok"}
      <div class="durum bekliyor"><span class="yuklenme"></span><strong>{t("dogrulama.bekle")}</strong></div>
      <p class="aciklama">{t("dogrulama.bekleAlt")}</p>
      {#if d?.kurtarma === "eksik"}
        <p class="aciklama">{t("dogrulama.baskaCihazYok")}</p>
        <button class="buton cizgili" onclick={async () => { await sifreleme.dogrulamaKapat(); sifreleme.ac("kurtarma-gir", "kurulum"); }}>{t("kurulum.anahtarla")}</button>
      {/if}
    {:else if dog.asama === "gelen_istek"}
      <p class="aciklama">{t("dogrulama.gelenAlt", { cihaz: dog.digerCihaz ?? "?" })}</p>
    {:else if dog.asama === "hazir"}
      <div class="durum bekliyor"><span class="yuklenme"></span><strong>{t("dogrulama.hazirlaniyor")}</strong></div>
    {:else if dog.asama === "emoji"}
      <p class="aciklama"><strong>{t("dogrulama.emojiBaslik")}</strong><br />{t("dogrulama.emojiAlt")}</p>
      <EmojiIzgara emojiler={dog.emojiler} />
    {:else if dog.asama === "onay_bekleniyor"}
      <div class="durum bekliyor"><span class="yuklenme"></span><strong>{t("dogrulama.onayBekle")}</strong></div>
    {:else if dog.asama === "bitti"}
      <div class="durum tamam"><Ikon ad="onay" boyut={22} /><strong>{t("dogrulama.bitti")}</strong></div>
      <p class="aciklama">{t("dogrulama.bittiAlt")}</p>
    {:else if dog.asama === "iptal"}
      <div class="durum iptal"><Ikon ad="uyari" boyut={22} /><strong>{t("dogrulama.iptal")}</strong></div>
      <p class="aciklama">{t("dogrulama.iptalAlt")}</p>
      {#if dog.neden}<p class="teknik">{dog.neden}</p>{/if}
    {/if}
    {#if sifreleme.hata}<p class="hata" role="alert">{sifreleme.hata}</p>{/if}
    {#snippet altlik()}
      {#if dog.asama === "gelen_istek"}
        <button class="buton birincil" onclick={() => sifreleme.dogrulamaKabul()}>{t("dogrulama.kabul")}</button>
        <button class="buton cizgili" onclick={() => sifreleme.dogrulamaKapat()}>{t("dogrulama.reddet")}</button>
      {:else if dog.asama === "emoji"}
        <button class="buton birincil" onclick={() => sifreleme.dogrulamaOnayla()}>{t("dogrulama.eslesiyor")}</button>
        <button class="buton cizgili kirmizi" onclick={() => sifreleme.dogrulamaEslesmiyor()}>{t("dogrulama.eslesmiyor")}</button>
      {:else if dog.asama === "bitti"}
        <button class="buton birincil" onclick={() => sifreleme.dogrulamaKapat()}>{t("eylem.tamam")}</button>
      {:else if dog.asama === "iptal"}
        <button class="buton cizgili" onclick={() => sifreleme.dogrulamaKapat()}>{t("eylem.kapat")}</button>
      {:else}
        <button class="buton cizgili" onclick={() => sifreleme.dogrulamaKapat()}>{t("eylem.iptal")}</button>
      {/if}
    {/snippet}
  </AltSayfa>
{:else if sifreleme.katman === "kurtarma-olustur"}
  <!-- Once the key is shown the sheet cannot be dismissed by accident: the key appears only once. -->
  <!-- Anahtar gösterildikten sonra sayfa yanlışlıkla kapatılamaz: anahtar yalnızca bir kez görünür. -->
  <AltSayfa baslik={t("kurtarmaOlustur.baslik")} onkapat={() => sifreleme.kapat()} kapatilabilir={!sifreleme.yeniAnahtar}>
    {#if !sifreleme.yeniAnahtar}
      <p class="aciklama">{t("kurtarmaOlustur.alt")}</p>
    {:else}
      <div class="anahtar-kutusu">
        <span class="etiket">{t("kurtarmaOlustur.anahtarin")}</span>
        <!-- Groups of four, evenly spaced and selectable (design section 12c) · Dörtlü gruplar, eşit aralıklı ve seçilebilir (tasarım bölüm 12c) -->
        <code class="anahtar">{#each sifreleme.yeniAnahtar.split(/\s+/).filter(Boolean) as grup, i (i)}<span>{grup}</span>{/each}</code>
        <button class="buton cizgili" onclick={kopyala}>{kopyalandi ? t("kurtarmaOlustur.kopyalandi") : t("kurtarmaOlustur.kopyala")}</button>
      </div>
      <p class="aciklama">{t("kurtarmaOlustur.uyari")}</p>
      <label class="onay">
        <input type="checkbox" bind:checked={kaydettim} />
        <span>{t("kurtarmaOlustur.kaydettim")}</span>
      </label>
    {/if}
    {#if sifreleme.hata}<p class="hata" role="alert">{sifreleme.hata}</p>{/if}
    {#snippet altlik()}
      {#if !sifreleme.yeniAnahtar}
        <button class="buton birincil" onclick={() => sifreleme.kurtarmaOlustur()} disabled={sifreleme.mesgul}>
          {#if sifreleme.mesgul}<span class="yuklenme"></span>{t("kurtarmaOlustur.olusturuluyor")}{:else}{t("kurtarmaOlustur.olustur")}{/if}
        </button>
        <button class="buton cizgili" onclick={() => sifreleme.kapat()} disabled={sifreleme.mesgul}>{t("eylem.iptal")}</button>
      {:else}
        <button class="buton birincil" onclick={() => sifreleme.geri()} disabled={!kaydettim}>{t("eylem.devam")}</button>
      {/if}
    {/snippet}
  </AltSayfa>
{:else if sifreleme.katman === "kurtarma-gir"}
  <AltSayfa baslik={t("kurtarmaGir.baslik")} onkapat={() => sifreleme.kapat()} kapatilabilir={!sifreleme.mesgul}>
    <form id="kurtarma-formu" onsubmit={kurtarmaGonder} class="form">
      <p class="aciklama">{t("kurtarmaGir.alt")}</p>
      <label class="alan">
        <span class="etiket">{t("kurtarmaGir.etiket")}</span>
        <textarea
          bind:value={anahtarGirdisi}
          rows="3"
          placeholder={t("kurtarmaGir.yer")}
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          disabled={sifreleme.mesgul}
        ></textarea>
      </label>
      {#if sifreleme.mesgul}
        <div class="durum bekliyor"><span class="yuklenme"></span><strong>{t("kurtarmaGir.calisiyor")}</strong></div>
      {/if}
      {#if sifreleme.hata}<p class="hata" role="alert">{sifreleme.hata}</p>{/if}
    </form>
    {#snippet altlik()}
      <button class="buton birincil" type="submit" form="kurtarma-formu" disabled={sifreleme.mesgul || !anahtarGirdisi.trim()}>{t("kurtarmaGir.dugme")}</button>
      <button class="buton cizgili" onclick={() => sifreleme.kapat()} disabled={sifreleme.mesgul}>{t("eylem.iptal")}</button>
    {/snippet}
  </AltSayfa>
{:else if sifreleme.katman === "parola"}
  <AltSayfa baslik={t("parola.baslik")} onkapat={() => sifreleme.kapat()} kapatilabilir={!sifreleme.mesgul}>
    <form id="parola-formu" onsubmit={parolaGonder} class="form">
      <p class="aciklama">{t("parola.alt")}</p>
      <label class="alan">
        <span class="etiket">{t("parola.etiket")}</span>
        <input type="password" bind:value={parolaGirdisi} autocomplete="current-password" disabled={sifreleme.mesgul} />
      </label>
      {#if sifreleme.hata}<p class="hata" role="alert">{sifreleme.hata}</p>{/if}
    </form>
    {#snippet altlik()}
      <button class="buton birincil" type="submit" form="parola-formu" disabled={sifreleme.mesgul || !parolaGirdisi}>
        {#if sifreleme.mesgul}<span class="yuklenme"></span>{/if}{t("parola.dugme")}
      </button>
      <button class="buton cizgili" onclick={() => sifreleme.kapat()} disabled={sifreleme.mesgul}>{t("eylem.iptal")}</button>
    {/snippet}
  </AltSayfa>
{:else if sifreleme.katman === "cikis"}
  <AltSayfa baslik={t("cikis.baslik")} onkapat={() => sifreleme.kapat()}>
    <div class="durum iptal"><Ikon ad="uyari" boyut={22} /><strong>{d?.kurtarma === "eksik" ? t("cikis.uyariEksik") : t("cikis.uyari")}</strong></div>
    {#snippet altlik()}
      <button
        class="buton birincil"
        onclick={() => (d?.kurtarma === "eksik" ? sifreleme.ac("kurtarma-gir") : sifreleme.ac("kurtarma-olustur"))}
      >{d?.kurtarma === "eksik" ? t("cikis.onceAnahtarGir") : t("cikis.onceAnahtar")}</button>
      <button class="buton cizgili kirmizi" onclick={cikisYap}>{t("cikis.yineDeCik")}</button>
    {/snippet}
  </AltSayfa>
{/if}

<style>
  .aciklama { font-size: .875rem; line-height: 1.43; color: var(--yazi-2); }
  /* Option card: icon, title, one line of help (design section 12a) · Seçenek kartı: simge, başlık, bir satır yardım (tasarım bölüm 12a) */
  .secenek { width: 100%; min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 12px; text-align: left; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); transition: background var(--sure-hizli) var(--egri-cikis); }
  .secenek:active { background: var(--yuzey-3); }
  .secenek:disabled { opacity: .38; }
  .secenek.one-cikan { background: var(--ton); color: var(--ton-ustu); border-color: transparent; }
  .secenek-simge { flex: none; display: inline-flex; }
  .secenek-metin { display: grid; gap: 2px; min-width: 0; }
  .secenek-metin strong { font-size: .9375rem; font-weight: 600; }
  .secenek-metin span { font-size: .8125rem; opacity: .75; }
  .aciklama strong { color: var(--yazi); }
  .eylemler { display: grid; gap: 8px; }
  hr { border: 0; border-top: 1px solid var(--kenar-ince); margin: 0; width: 100%; }
  .hata { font-size: .875rem; color: var(--hata); }
  .teknik { font-size: .75rem; color: var(--yazi-2); }
  .tamam { display: flex; align-items: center; gap: 8px; font-size: .875rem; color: var(--cozum); }
  .durum { display: flex; align-items: center; gap: 12px; font-size: .9375rem; }
  .durum.bekliyor { color: var(--bekliyor); }
  .durum.tamam { color: var(--cozum); }
  .durum.iptal { color: var(--hata); align-items: flex-start; }
  .form { display: grid; gap: 16px; }
  .alan { display: grid; gap: 6px; }
  .etiket { font-size: .8125rem; font-weight: 500; color: var(--yazi-2); }
  input[type="password"], textarea {
    width: 100%; min-height: 52px; padding: 12px 14px; border-radius: 12px; font: inherit; font-size: 1rem;
    background: var(--yuzey-2); color: var(--yazi); border: 1px solid var(--kenar);
  }
  input[type="password"]:focus, textarea:focus { outline: none; border-color: var(--vurgu); box-shadow: 0 0 0 1px var(--vurgu); }
  textarea { resize: none; font-family: var(--mono-tipi); }
  .anahtar-kutusu { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); }
  /* The key stays selectable so it can be copied by hand if the clipboard button fails. · Pano düğmesi başarısız olursa elle kopyalansın diye anahtar seçilebilir kalır. */
  .anahtar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 8px; font-family: var(--mono-tipi); font-size: .9375rem; line-height: 1.6; -webkit-user-select: text; user-select: text; }
  .anahtar span { -webkit-user-select: text; user-select: text; }
  .onay { display: flex; align-items: center; gap: 12px; min-height: 44px; font-size: .9375rem; }
  .onay input { width: 24px; height: 24px; flex: none; accent-color: var(--vurgu); }
  .buton.kirmizi { color: var(--hata); }
</style>
