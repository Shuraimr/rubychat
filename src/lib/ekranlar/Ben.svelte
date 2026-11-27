<!--
  "Me": account card, a settings list (Görünüm, noise suppression, Güvenlik with a status chip, logout) and the account details.
  Görünüm and Güvenlik are sub-pages that slide over this screen (they are history layers: the Android back button closes them).
  Where a side rail exists (tablet, landscape phone) the rail already has a Görünüm shortcut, so the list does not repeat it.
  "Ben": hesap kartı, bir ayar listesi (Görünüm, gürültü engelleme, durum çipli Güvenlik, çıkış) ve hesap ayrıntıları.
  Görünüm ve Güvenlik bu ekranın üstüne kayan alt sayfalardır (history katmanıdır: Android geri tuşu kapatır).
  Yan ray olan yerde (tablet, yatay telefon) rayda zaten Görünüm kısayolu var; liste onu tekrar etmez.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { alanaKatil, uygulamaSurumu } from "../api/komutlar";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import HesapListesi from "../bilesenler/HesapListesi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { arama } from "../durum/arama.svelte";
  import { ayarlar } from "../durum/ayarlar.svelte";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { guncelleme } from "../durum/guncelleme.svelte";
  import { kurulum, kurulumRaporuAc } from "../durum/kurulum.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { RUBYCHAT_ALAN_AD, RUBYCHAT_ALAN_ID, rubychatUyeMi, rubychatVia } from "../durum/rubychatAlan";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { titret } from "../dokunma";
  import { matrisLinkAcikMi, matrisLinkAyariAc, matrisLinkAyariVar } from "../disAc";
  import { geriKaydir } from "../geriKaydir";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import BildirimAyarlari from "./BildirimAyarlari.svelte";
  import Gorunum from "./Gorunum.svelte";
  import Guncellemeler from "./Guncellemeler.svelte";
  import Guvenlik from "./Guvenlik.svelte";
  import Hakkinda from "./Hakkinda.svelte";
  import Hesap from "./Hesap.svelte";
  import KlavyeAyarlari from "./KlavyeAyarlari.svelte";
  import ProfilDuzenle from "./ProfilDuzenle.svelte";
  import SohbetAyarlari from "./SohbetAyarlari.svelte";
  import { altKaydirma } from "../durum/kabuk.svelte";

  const gorunenAd = $derived(oturum.profil?.ad ?? null);
  let kenar = $state(false);
  let ana: HTMLDivElement | undefined = $state();
  /** the sub-page is still moving · alt sayfa hâlâ hareket ediyor */
  let yolda = $state(false);

  // The ripple is seen first, then the page moves; a second tap in between is ignored. · Önce dalga görünür, sonra sayfa kayar; aradaki ikinci dokunuş sayılmaz.
  let bekleyen: ReturnType<typeof setTimeout> | undefined;
  function altAc(ad: Parameters<typeof gezinme.benAltAc>[0]) {
    if (bekleyen) return;
    titret("tik");
    bekleyen = setTimeout(() => {
      bekleyen = undefined;
      gezinme.benAltAc(ad);
    }, 90);
  }

  // Display name needs the network, so it is fetched separately and may arrive late.
  // Görünen ad ağ ister; ayrıca alınır ve geç gelebilir.
  $effect(() => {
    oturum.profilYenile();
  });

  const ad = $derived(gorunenAd ?? oturum.ben?.kullaniciId ?? "");
  const g = $derived(sifreleme.durum);
  const raySiz = $derived(gezinme.sekil === "telefon");
  // The compact desktop strip has no Görünüm button (the rail does): then it lives here, or it could not be reached at all.
  // Kompakt masaüstü şeridinde Görünüm düğmesi yok (rayda var): o zaman burada durur, yoksa hiç ulaşılamazdı.
  const gorunumBurada = $derived(raySiz || (duzen.kompakt && !gezinme.yatay));
  // Desktop only: phones have no hardware shortcut keys. · Yalnızca masaüstü: telefonda donanım kısayol tuşları yok.
  const masaustu = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  const temaAdi = $derived(ayarlar.tema === "koyu" ? t("gorunum.koyu") : ayarlar.tema === "acik" ? t("gorunum.acik") : t("gorunum.sistem"));

  // One line tells the whole security story at a glance (design section 5). · Tek satır güvenlik durumunu bir bakışta söyler (tasarım bölüm 5).
  const guvenlikCipi = $derived.by(() => {
    if (!g || g.caprazImza === "bekliyor") return { ton: "notr", ad: t("durum.bekliyor") };
    if (!g.cihazDogrulandi) return { ton: "bekliyor", ad: t("durum.dogrulanmadi") };
    if (g.kurtarma === "kapali" || g.kurtarma === "eksik") return { ton: "bekliyor", ad: t("durum.gerekli") };
    return { ton: "tamam", ad: t("durum.dogrulandi") };
  });

  /** Always asked: logging back in is work. · Her zaman sorulur: yeniden giriş yapmak uğraştırır. */
  const cikisIste = () => sifreleme.ac("cikis");

  let yerSurum = $state("");
  const surum = $derived(guncelleme.mevcutSurum || yerSurum);
  const rubychatUye = $derived(rubychatUyeMi());
  let alanKatiliyor = $state(false);
  // Android 12+: row to open "Open by default" settings for matrix.to links · Android 12+: matrix.to bağlantıları için "Varsayılan olarak aç" satırı
  const matrisLinkVar = matrisLinkAyariVar();
  let matrisLinkAcik = $state(matrisLinkVar ? matrisLinkAcikMi() : false);
  $effect(() => {
    if (!matrisLinkVar) return;
    const bak = () => (matrisLinkAcik = matrisLinkAcikMi());
    document.addEventListener("visibilitychange", bak);
    return () => document.removeEventListener("visibilitychange", bak);
  });

  onMount(() => {
    if (!guncelleme.mevcutSurum) {
      void uygulamaSurumu().then((v) => (yerSurum = v)).catch(() => {});
    }
  });

  async function rubychatAlanAc() {
    if (rubychatUye) {
      gezinme.sekmeSec("alanlar");
      alanlar.ac(RUBYCHAT_ALAN_ID, RUBYCHAT_ALAN_AD);
      return;
    }
    if (alanKatiliyor) return;
    alanKatiliyor = true;
    try {
      const id = await alanaKatil(RUBYCHAT_ALAN_ID, rubychatVia(oturum.ben?.kullaniciId));
      gezinme.sekmeSec("alanlar");
      alanlar.ac(id, RUBYCHAT_ALAN_AD);
    } catch (e) {
      hataBildir(e);
    } finally {
      alanKatiliyor = false;
    }
  }
</script>

<div class="ben">
  <div class="ana" class:itildi={!!gezinme.benAlt} inert={!!gezinme.benAlt} bind:this={ana}>
  <Baslik baslik={raySiz ? t("profil.baslik") : t("ben.baslik")} {kenar} />
  <div class="icerik" use:altKaydirma onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <div class="ay-kart">
      <button class="ay-satir dugme kimlik" data-dalga onclick={() => altAc("profil")} aria-label={t("profil.baslik")}>
        <Avatar harf={ad.replace(/^@/, "").charAt(0).toUpperCase() || "#"} boyut={56} mxc={oturum.profil?.avatarMxc ?? null} />
        <span class="ay-metin"><strong class="ad">{gorunenAd ?? oturum.ben?.kullaniciId}</strong>{#if gorunenAd}<span>{oturum.ben?.kullaniciId}</span>{/if}</span>
        <Ikon ad="kalem" boyut={20} />
      </button>
    </div>

    <HesapListesi />

    <div class="ay-kart">
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("hesap")}>
        <span class="ay-simge" style:--r="var(--tas-ametist)"><Ikon ad="anahtar" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("hesap.baslik")}</strong><span>{t("ben.hesapAlt")}</span></span>
      </button>
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("guvenlik")}>
        <span class="ay-simge" style:--r="var(--tas-ametist)"><Ikon ad="kalkan" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("guvenlik.baslikAnahtarlar")}</strong><span class="durum {guvenlikCipi.ton}">{guvenlikCipi.ad}</span></span>
      </button>
    </div>

    <div class="ay-kart">
      {#if gorunumBurada}
        <button class="ay-satir dugme" data-dalga onclick={() => altAc("gorunum")}>
          <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="palet" boyut={20} /></span>
          <span class="ay-metin"><strong>{t("gorunum.baslik")}</strong><span>{t("ben.gorunumAlt", { tema: temaAdi })}</span></span>
        </button>
      {/if}
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("sohbet")}>
        <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="sohbet" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ayar.sohbet")}</strong><span>{t("ben.sohbetAlt")}</span></span>
      </button>
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("bildirimler")}>
        <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="zil" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ayar.bildirimler")}</strong><span>{t("ben.bildirimAlt")}</span></span>
      </button>
      {#if masaustu}
        <button class="ay-satir dugme" data-dalga onclick={() => altAc("klavye")}>
          <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="klavye" boyut={20} /></span>
          <span class="ay-metin"><strong>{t("klavye.kisayollar")}</strong><span>{tercihler.d.ctrlKisayol ? t("klavye.acik") : t("klavye.kapali")}</span></span>
        </button>
      {/if}
      <div class="ay-satir">
        <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="mikrofon" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ben.gurultu")}</strong><span>{t("ben.gurultuAlt")}</span></span>
        <Anahtar acik={arama.gurultuAcik} degis={(v) => arama.gurultuAyarla(v)} etiket={t("ben.gurultu")} />
      </div>
      {#if matrisLinkVar}
        <button class="ay-satir dugme" data-dalga onclick={() => { titret("tik"); matrisLinkAyariAc(); }}>
          <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="baglanti" boyut={20} /></span>
          <span class="ay-metin">
            <strong>{t("matrisBaglanti.ayarBaslik")}</strong>
            <span class="durum {matrisLinkAcik ? 'tamam' : 'notr'}">{matrisLinkAcik ? t("durum.acik") : t("durum.kapali")}</span>
          </span>
          <Ikon ad="sagOk" boyut={20} />
        </button>
      {/if}
    </div>

    <div class="ay-kart">
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("guncellemeler")}>
        <span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="indir" boyut={20} /></span>
        <span class="ay-metin">
          <strong>{t("ayar.guncellemeler")}</strong>
          <span class:durum={!!guncelleme.bilgi?.yeni} class:vurgu={!!guncelleme.bilgi?.yeni}>
            {guncelleme.bilgi?.yeni ? t("guncelleme.yeniVarKisa", { surum: guncelleme.bilgi.yeni.surum }) : (guncelleme.mevcutSurum || t("ben.guncellemelerAlt"))}
          </span>
        </span>
      </button>
      <button class="ay-satir dugme" data-dalga onclick={() => { titret("tik"); kurulumRaporuAc(); }}>
        <span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="kalkanOnay" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("kurulumRaporu.baslik")}</strong><span>{t("kurulumRaporu.benAlt")}</span></span>
      </button>
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("hakkinda")}>
        <span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="bilgi" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ayar.hakkinda")}</strong><span>{t("ben.hakkindaAlt")}</span></span>
      </button>
      <button class="ay-satir dugme tehlike" data-dalga onclick={cikisIste} disabled={oturum.mesgul}>
        <span class="ay-simge" style:--r="var(--hata)"><Ikon ad="cikis" boyut={20} /></span>
        <span class="ay-metin"><strong>{oturum.mesgul ? t("ben.cikisYapiliyor") : t("ben.cikis")}</strong><span>{oturum.ben?.sunucu}</span></span>
      </button>
    </div>

    <section class="hakkinda-bolum" aria-label={t("benHakkinda.bolum")}>
      <h2>{t("benHakkinda.bolum")}</h2>
      <div class="ay-kart govde hakkinda-kart">
        <div class="hakkinda-ust">
          <div class="hakkinda-maskot">
            <Maskot poz="selam" boyut={40} />
          </div>
          <div class="hakkinda-kimlik">
            <strong>{surum ? `rubychat ${surum}` : "rubychat"}</strong>
            <span>{t("benHakkinda.alt")}</span>
          </div>
        </div>
        <p class="hakkinda-metin">{t("benHakkinda.aciklama")}</p>
        <div class="hakkinda-dugmeler">
          <button class="buton tonlu" type="button" disabled={alanKatiliyor} onclick={() => void rubychatAlanAc()}>
            {#if alanKatiliyor}<span class="yuklenme"></span>{/if}
            {rubychatUye ? t("rubychatAlan.ac") : t("rubychatAlan.katil")}
          </button>
          <button class="buton cizgili" type="button" onclick={() => baglantiAc("https://github.com/Shuraimr/rubychat")}>
            {t("benHakkinda.github")}
          </button>
        </div>
        <button class="buton metin tur-tekrar" type="button" onclick={() => { titret("tik"); kurulum.turAc(); }}>
          {t("benHakkinda.turuIzle")}
        </button>
      </div>
    </section>
  </div>
  </div>

  <!-- Sub-pages slide in over this screen; they take no taps until they have arrived. · Alt sayfalar bu ekranın üstüne kayar; yerine oturana kadar dokunuş almaz. -->
  {#if gezinme.benAlt}
    <div class="alt-sayfa" class:yolda in:kayGir out:kayCik onintrostart={() => (yolda = true)} onintroend={() => (yolda = false)} onoutrostart={() => (yolda = true)} use:geriKaydir={{ etkin: () => raySiz && gezinme.ustKatmanMi("benAlt"), geri: () => gezinme.benAltKapat(), altta: () => ana }}>
      {#if gezinme.benAlt === "gorunum"}<Gorunum />{:else if gezinme.benAlt === "sohbet"}<SohbetAyarlari />{:else if gezinme.benAlt === "bildirimler"}<BildirimAyarlari />{:else if gezinme.benAlt === "klavye"}<KlavyeAyarlari />{:else if gezinme.benAlt === "guncellemeler"}<Guncellemeler />{:else if gezinme.benAlt === "hakkinda"}<Hakkinda />{:else if gezinme.benAlt === "profil"}<ProfilDuzenle />{:else if gezinme.benAlt === "hesap"}<Hesap />{:else}<Guvenlik />{/if}
    </div>
  {/if}
</div>

<style>
  .ben { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .ana { flex: 1; min-height: 0; display: flex; flex-direction: column; transition: transform var(--sure-ekran) var(--egri-ac), opacity var(--sure-ekran) var(--egri-ac); }
  .ana.itildi { transform: translate3d(-25%, 0, 0); opacity: .4; }
  .alt-sayfa { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; background: var(--zemin); touch-action: pan-y; box-shadow: -8px 0 24px rgb(0 0 0 / .25); }
  .alt-sayfa.yolda { pointer-events: none; }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: .5rem 1rem calc(1rem + var(--dock-yer, env(safe-area-inset-bottom))); display: grid; grid-auto-rows: max-content; gap: .625rem; align-content: start; }
  .kimlik { min-height: 5.5rem; }
  .ad { font-size: 1.125rem !important; font-weight: 600 !important; }
  .durum.tamam { color: var(--cozum) !important; }
  .durum.bekliyor { color: var(--bekliyor) !important; }
  .durum.vurgu { color: var(--vurgu) !important; }
  .ay-metin > :global(*) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tehlike strong { color: var(--hata); }

  .hakkinda-bolum {
    margin-top: .5rem;
    display: grid;
    gap: .5rem;
  }
  .hakkinda-bolum > h2 {
    font-family: var(--yazi-tipi);
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--yazi-2);
    padding: 0 .75rem;
  }
  .hakkinda-kart {
    gap: .75rem;
  }
  .hakkinda-ust {
    display: flex;
    align-items: center;
    gap: .75rem;
  }
  .hakkinda-maskot {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--yuzey-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .hakkinda-kimlik {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .hakkinda-kimlik strong {
    font-family: var(--baslik-tipi);
    font-size: 1rem;
    font-weight: 600;
    color: var(--yazi);
  }
  .hakkinda-kimlik span {
    font-size: .8125rem;
    color: var(--yazi-2);
  }
  .hakkinda-metin {
    font-size: .875rem;
    line-height: 1.45;
    color: var(--yazi-2);
  }
  .hakkinda-dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
  }
  .hakkinda-dugmeler > .buton {
    flex: 1 1 7.5rem;
    width: auto;
    min-height: 44px;
  }
  .tur-tekrar {
    min-height: 44px;
  }
</style>
