<!--
  Ben › Hesap. What you can do depends on the server:
   - OIDC server (matrix.org + MAS): password, e-mail, sessions and deactivation exist ONLY on the provider's account page. The rows below open it
     with the right `action=` inside the app (IcTarayici, with a system-browser button).
   - Legacy server (password + UIA): the same things are done natively (change password, e-mail addresses, deactivate with a strong confirmation).
  Plus a "Sunucu bilgisi" card (name, spec versions, sliding sync, OIDC). Rust side: src-tauri/src/matrix/profil.rs (`hesap_bilgisi` ...).
  Ben › Hesap. Yapabileceklerin sunucuya göre değişir:
   - OIDC sunucusu (matrix.org + MAS): şifre, e-posta, oturumlar ve hesap kapatma YALNIZCA sağlayıcının hesap sayfasındadır. Aşağıdaki satırlar onu
     doğru `action=` ile uygulamanın içinde açar (IcTarayici, sistem tarayıcısı düğmesiyle).
   - Eski sunucu (şifre + UIA): aynı şeyler yerel yapılır (şifre değiştir, e-posta adresleri, güçlü onayla hesap kapat).
  Ayrıca "Sunucu bilgisi" kartı (ad, spec sürümleri, sliding sync, OIDC). Rust tarafı: src-tauri/src/matrix/profil.rs (`hesap_bilgisi` ...).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { epostaSil, epostalarListele, hesapBilgisi, hesapKapat, sifreDegistir } from "../api/komutlar";
  import type { EpostaAdresi, HesapBilgisi } from "../api/tipler";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import IcTarayici from "../bilesenler/IcTarayici.svelte";
  import Ikon, { type IkonAdi } from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t, type Anahtar } from "../i18n";

  let bilgi = $state<HesapBilgisi | null>(null);
  let yuklemeHata = $state(false);
  let tarayici = $state<{ url: string; baslik: string } | null>(null);
  let kenar = $state(false);

  async function yukle() {
    yuklemeHata = false;
    try {
      bilgi = await hesapBilgisi();
      if (!bilgi.oidc) epostalar = await epostalarListele().catch(() => []);
    } catch {
      yuklemeHata = true;
    }
  }
  onMount(() => void yukle());

  /** `base?action=…` (keeps an existing query string) · `base?action=…` (var olan sorgu dizesini korur) */
  function eylemAdresi(eylem: string | null): string | null {
    if (!bilgi?.hesapUrl) return null;
    if (!eylem) return bilgi.hesapUrl;
    return `${bilgi.hesapUrl}${bilgi.hesapUrl.includes("?") ? "&" : "?"}action=${encodeURIComponent(eylem)}`;
  }
  const destekli = (...adaylar: string[]) => adaylar.find((a) => bilgi?.eylemler.includes(a)) ?? adaylar[0];

  const oidcSatirlari = $derived<{ ikon: IkonAdi; ad: Anahtar; alt: Anahtar; eylem: string | null; tehlike?: boolean }[]>([
    { ikon: "anahtar", ad: "hesap.sifre", alt: "hesap.sifreAltWeb", eylem: "org.matrix.profile" },
    { ikon: "kisi", ad: "hesap.eposta", alt: "hesap.epostaAltWeb", eylem: "org.matrix.profile" },
    { ikon: "cihaz", ad: "hesap.oturumlar", alt: "hesap.oturumlarAltWeb", eylem: destekli("org.matrix.devices_list", "org.matrix.sessions_list") },
    { ikon: "cop", ad: "hesap.kapat", alt: "hesap.kapatAltWeb", eylem: "org.matrix.account_deactivate", tehlike: true },
  ]);
  function webAc(ad: Anahtar, eylem: string | null) {
    const u = eylemAdresi(eylem);
    if (u) tarayici = { url: u, baslik: t(ad) };
  }

  // ---- Legacy native flows · Eski sunucu yerel akışları ----
  let sifreAcik = $state(false);
  let eski = $state("");
  let yeni = $state("");
  let yeni2 = $state("");
  let mesgul = $state(false);
  let hata = $state<string | null>(null);
  let epostalar = $state<EpostaAdresi[]>([]);
  let kapatAcik = $state(false);
  let kapatParola = $state("");
  let kapatOnay = $state("");
  let kapatSil = $state(false);
  const hataMetni = (e: unknown) => t(`hata.${(e as { tur?: string })?.tur ?? "diger"}` as Anahtar);
  const kullanici = $derived((oturum.ben?.kullaniciId ?? "").replace(/^@/, "").split(":")[0]);

  async function sifreKaydet() {
    hata = null;
    if (yeni.length < 8) return void (hata = t("hesap.sifreKisa"));
    if (yeni !== yeni2) return void (hata = t("hesap.sifreFarkli"));
    mesgul = true;
    try {
      await sifreDegistir(eski, yeni);
      sifreAcik = false;
      eski = yeni = yeni2 = "";
      bildirim.goster(t("hesap.sifreDegisti"), 3500, { tur: "tamam" });
    } catch (e) {
      hata = hataMetni(e);
    } finally {
      mesgul = false;
    }
  }
  async function epostaKaldir(a: string) {
    try {
      await epostaSil(a);
      epostalar = await epostalarListele();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    }
  }
  async function hesabiKapat() {
    hata = null;
    mesgul = true;
    try {
      await hesapKapat(kapatParola, kapatSil);
      kapatAcik = false;
      // The account is gone: the local session is no use any more. · Hesap gitti: yerel oturumun artık işi yok.
      await oturum.cikis();
    } catch (e) {
      hata = hataMetni(e);
    } finally {
      mesgul = false;
    }
  }
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("hesap.baslik")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="ay-icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    {#if yuklemeHata}
      <div class="bos"><Maskot poz="hata" boyut={96} /><p>{t("hesap.yuklenemedi")}</p><button class="buton cizgili" onclick={yukle}>{t("eylem.tekrarDene")}</button></div>
    {:else if !bilgi}
      <div class="bos"><Maskot poz="yukleniyor" boyut={96} /></div>
    {:else}
      <section class="ay-bolum">
        <h2>{bilgi.oidc ? t("hesap.webHesap") : t("hesap.hesabin")}</h2>
        <div class="ay-kart">
          {#if bilgi.oidc}
            {#if !bilgi.hesapUrl}
              <p class="ay-not govde">{t("hesap.webYok")}</p>
            {:else}
              {#each oidcSatirlari as s (s.ad)}
                <button class="ay-satir dugme" class:tehlike={s.tehlike} data-dalga onclick={() => webAc(s.ad, s.eylem)}>
                  <span class="simge"><Ikon ad={s.ikon} boyut={20} /></span>
                  <span class="ay-metin"><strong>{t(s.ad)}</strong><span>{t(s.alt)}</span></span>
                  <Ikon ad="sagOk" boyut={20} />
                </button>
              {/each}
            {/if}
          {:else}
            <button class="ay-satir dugme" data-dalga onclick={() => { hata = null; sifreAcik = true; }}>
              <span class="simge"><Ikon ad="anahtar" boyut={20} /></span>
              <span class="ay-metin"><strong>{t("hesap.sifre")}</strong><span>{t("hesap.sifreAlt")}</span></span><Ikon ad="sagOk" boyut={20} />
            </button>
            <button class="ay-satir dugme tehlike" data-dalga onclick={() => { hata = null; kapatAcik = true; }}>
              <span class="simge"><Ikon ad="cop" boyut={20} /></span>
              <span class="ay-metin"><strong>{t("hesap.kapat")}</strong><span>{t("hesap.kapatAlt")}</span></span><Ikon ad="sagOk" boyut={20} />
            </button>
          {/if}
        </div>
        {#if bilgi.oidc}<p class="ay-not">{t("hesap.webNot")}</p>{/if}
      </section>

      {#if !bilgi.oidc}
        <section class="ay-bolum">
          <h2>{t("hesap.eposta")}</h2>
          <div class="ay-kart">
            {#each epostalar as e (e.adres)}
              <div class="ay-satir"><span class="ay-metin"><strong class="mono">{e.adres}</strong></span><button class="simge-dugme" aria-label={t("hesap.epostaKaldir")} onclick={() => void epostaKaldir(e.adres)}><Ikon ad="cop" boyut={20} /></button></div>
            {:else}
              <p class="ay-not govde">{t("hesap.epostaYok")}</p>
            {/each}
          </div>
          <p class="ay-not">{t("hesap.epostaEkleNot")}</p>
        </section>
      {/if}

      <section class="ay-bolum">
        <h2>{t("hesap.sunucuBilgisi")}</h2>
        <dl class="ay-kart bilgi">
          <div><dt>{t("ben.sunucu")}</dt><dd class="mono">{bilgi.sunucu}</dd></div>
          <div><dt>{t("hesap.girisTuru")}</dt><dd>{bilgi.oidc ? t("hesap.oidc") : t("hesap.klasikGiris")}</dd></div>
          <div><dt>{t("hesap.slidingSync")}</dt><dd>{bilgi.slidingSync ? t("hesap.var") : t("hesap.yok")}</dd></div>
          {#if bilgi.surumler.length > 0}<div><dt>{t("hesap.surumler")}</dt><dd class="mono">{bilgi.surumler.slice(-3).join(", ")}</dd></div>{/if}
        </dl>
      </section>
    {/if}
  </div>
</div>

{#if tarayici}<IcTarayici url={tarayici.url} baslik={tarayici.baslik} onkapat={() => (tarayici = null)} />{/if}

{#if sifreAcik}
  <AltSayfa baslik={t("hesap.sifre")} onkapat={() => (sifreAcik = false)}>
    <div class="alan-kutu"><input type="password" bind:value={eski} autocomplete="current-password" placeholder={t("hesap.eskiSifre")} aria-label={t("hesap.eskiSifre")} /></div>
    <div class="alan-kutu"><input type="password" bind:value={yeni} autocomplete="new-password" placeholder={t("hesap.yeniSifre")} aria-label={t("hesap.yeniSifre")} /></div>
    <div class="alan-kutu"><input type="password" bind:value={yeni2} autocomplete="new-password" placeholder={t("hesap.yeniSifre2")} aria-label={t("hesap.yeniSifre2")} /></div>
    {#if hata}<p class="alan-hata">{hata}</p>{/if}
    <button class="buton birincil" onclick={sifreKaydet} disabled={mesgul || !eski || !yeni}>{t("eylem.kaydet")}</button>
  </AltSayfa>
{/if}

{#if kapatAcik}
  <AltSayfa baslik={t("hesap.kapat")} onkapat={() => (kapatAcik = false)}>
    <p class="uyari-metin">{t("hesap.kapatUyari")}</p>
    <label class="onay-satir"><input type="checkbox" bind:checked={kapatSil} /><span>{t("hesap.veriyiSil")}</span></label>
    <div class="alan-kutu"><input type="text" bind:value={kapatOnay} autocomplete="off" autocapitalize="off" placeholder={t("hesap.kapatOnayYer", { ad: kullanici })} aria-label={t("hesap.kapatOnayYer", { ad: kullanici })} /></div>
    <div class="alan-kutu"><input type="password" bind:value={kapatParola} autocomplete="current-password" placeholder={t("giris.sifre")} aria-label={t("giris.sifre")} /></div>
    {#if hata}<p class="alan-hata">{hata}</p>{/if}
    <button class="buton tehlike" onclick={hesabiKapat} disabled={mesgul || kapatOnay.trim() !== kullanici || !kapatParola}>{t("hesap.kapatDugme")}</button>
  </AltSayfa>
{/if}

<style>
  .bos { display: grid; justify-items: center; gap: .75rem; padding: 2rem 1rem; text-align: center; color: var(--yazi-2); }
  .govde { padding: .75rem 1rem; }
  .simge { flex: none; display: inline-flex; color: var(--yazi-2); }
  .tehlike, .tehlike .simge { color: var(--hata); }
  .mono { font-family: var(--mono-tipi); overflow-wrap: anywhere; }
  .bilgi { margin: 0; }
  .bilgi > div { padding: .75rem 1rem; border-bottom: 1px solid var(--kenar-ince); }
  .bilgi > div:last-child { border-bottom: 0; }
  dt { font-size: .8125rem; color: var(--yazi-2); }
  dd { margin: 2px 0 0; font-size: .9375rem; overflow-wrap: anywhere; }
  .uyari-metin { color: var(--hata); font-size: .9375rem; line-height: 1.5; }
  .onay-satir { display: flex; align-items: center; gap: .75rem; min-height: 2.75rem; font-size: .9375rem; }
  .onay-satir input { width: 1.5rem; height: 1.5rem; flex: none; accent-color: var(--vurgu); }
</style>
