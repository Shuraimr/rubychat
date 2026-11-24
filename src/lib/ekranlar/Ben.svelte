<!--
  "Me": account card, a settings list (Görünüm, noise suppression, Güvenlik with a status chip, logout) and the account details.
  Görünüm and Güvenlik are sub-pages that slide over this screen (they are history layers: the Android back button closes them).
  Where a side rail exists (tablet, landscape phone) the rail already has a Görünüm shortcut, so the list does not repeat it.
  "Ben": hesap kartı, bir ayar listesi (Görünüm, gürültü engelleme, durum çipli Güvenlik, çıkış) ve hesap ayrıntıları.
  Görünüm ve Güvenlik bu ekranın üstüne kayan alt sayfalardır (history katmanıdır: Android geri tuşu kapatır).
  Yan ray olan yerde (tablet, yatay telefon) rayda zaten Görünüm kısayolu var; liste onu tekrar etmez.
-->
<script lang="ts">
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { arama } from "../durum/arama.svelte";
  import { ayarlar } from "../durum/ayarlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { titret } from "../dokunma";
  import { geriKaydir } from "../geriKaydir";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";
  import BildirimAyarlari from "./BildirimAyarlari.svelte";
  import Gorunum from "./Gorunum.svelte";
  import Guvenlik from "./Guvenlik.svelte";
  import Hakkinda from "./Hakkinda.svelte";
  import Hesap from "./Hesap.svelte";
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
  const temaAdi = $derived(ayarlar.tema === "koyu" ? t("gorunum.koyu") : ayarlar.tema === "acik" ? t("gorunum.acik") : t("gorunum.sistem"));

  // One line tells the whole security story at a glance (design section 5). · Tek satır güvenlik durumunu bir bakışta söyler (tasarım bölüm 5).
  const guvenlikCipi = $derived.by(() => {
    if (!g || g.caprazImza === "bekliyor") return { ton: "notr", ad: t("durum.bekliyor") };
    if (!g.cihazDogrulandi) return { ton: "bekliyor", ad: t("durum.dogrulanmadi") };
    if (g.kurtarma === "kapali" || g.kurtarma === "eksik") return { ton: "bekliyor", ad: t("durum.gerekli") };
    return { ton: "tamam", ad: t("durum.dogrulandi") };
  });

  /** With risk (no recovery key) ask first; otherwise log out right away. · Riskliyse (kurtarma anahtarı yok) önce sor; değilse hemen çık. */
  function cikisIste() {
    if (sifreleme.cikisRiskli) sifreleme.ac("cikis");
    else void oturum.cikis();
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
      {#if raySiz}
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
      <div class="ay-satir">
        <span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="mikrofon" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ben.gurultu")}</strong><span>{t("ben.gurultuAlt")}</span></span>
        <Anahtar acik={arama.gurultuAcik} degis={(v) => arama.gurultuAyarla(v)} etiket={t("ben.gurultu")} />
      </div>
    </div>

    <div class="ay-kart">
      <button class="ay-satir dugme" data-dalga onclick={() => altAc("hakkinda")}>
        <span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="bilgi" boyut={20} /></span>
        <span class="ay-metin"><strong>{t("ayar.hakkinda")}</strong><span>{t("ben.hakkindaAlt")}</span></span>
      </button>
      <button class="ay-satir dugme tehlike" data-dalga onclick={cikisIste} disabled={oturum.mesgul}>
        <span class="ay-simge" style:--r="var(--hata)"><Ikon ad="cikis" boyut={20} /></span>
        <span class="ay-metin"><strong>{oturum.mesgul ? t("ben.cikisYapiliyor") : t("ben.cikis")}</strong><span>{oturum.ben?.sunucu}</span></span>
      </button>
    </div>
  </div>
  </div>

  <!-- Sub-pages slide in over this screen; they take no taps until they have arrived. · Alt sayfalar bu ekranın üstüne kayar; yerine oturana kadar dokunuş almaz. -->
  {#if gezinme.benAlt}
    <div class="alt-sayfa" class:yolda in:kayGir out:kayCik onintrostart={() => (yolda = true)} onintroend={() => (yolda = false)} onoutrostart={() => (yolda = true)} use:geriKaydir={{ etkin: () => raySiz && gezinme.ustKatmanMi("benAlt"), geri: () => gezinme.benAltKapat(), altta: () => ana }}>
      {#if gezinme.benAlt === "gorunum"}<Gorunum />{:else if gezinme.benAlt === "sohbet"}<SohbetAyarlari />{:else if gezinme.benAlt === "bildirimler"}<BildirimAyarlari />{:else if gezinme.benAlt === "hakkinda"}<Hakkinda />{:else if gezinme.benAlt === "profil"}<ProfilDuzenle />{:else if gezinme.benAlt === "hesap"}<Hesap />{:else}<Guvenlik />{/if}
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
  .ay-metin > :global(*) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tehlike strong { color: var(--hata); }
</style>
