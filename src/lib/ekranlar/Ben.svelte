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
  import Ikon, { type IkonAdi } from "../bilesenler/Ikon.svelte";
  import { arama } from "../durum/arama.svelte";
  import { ayarlar } from "../durum/ayarlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";
  import BildirimAyarlari from "./BildirimAyarlari.svelte";
  import Gorunum from "./Gorunum.svelte";
  import Guvenlik from "./Guvenlik.svelte";
  import Hakkinda from "./Hakkinda.svelte";
  import SohbetAyarlari from "./SohbetAyarlari.svelte";
  import { altKaydirma } from "../durum/kabuk.svelte";

  const gorunenAd = $derived(oturum.profil?.ad ?? null);
  let kenar = $state(false);

  // Display name needs the network, so it is fetched separately and may arrive late.
  // Görünen ad ağ ister; ayrıca alınır ve geç gelebilir.
  $effect(() => {
    oturum.profilYenile();
  });

  const ad = $derived(gorunenAd ?? oturum.ben?.kullaniciId ?? "");
  const g = $derived(sifreleme.durum);
  const raySiz = $derived(gezinme.sekil === "telefon");
  const temaAdi = $derived(ayarlar.tema === "koyu" ? t("gorunum.koyu") : ayarlar.tema === "acik" ? t("gorunum.acik") : t("gorunum.sistem"));

  // One chip tells the whole security story at a glance (design section 5). · Tek çip güvenlik durumunu bir bakışta söyler (tasarım bölüm 5).
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
  <Baslik baslik={t("ben.baslik")} {kenar} />
  <div class="icerik" use:altKaydirma onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <div class="kimlik">
      <Avatar harf={ad.replace(/^@/, "").charAt(0).toUpperCase() || "#"} boyut={64} mxc={oturum.profil?.avatarMxc ?? null} />
      <div class="adlar">
        {#if gorunenAd}<span class="ad">{gorunenAd}</span>{/if}
        <span class="mxid">{oturum.ben?.kullaniciId}</span>
      </div>
    </div>

    <div class="kart">
      {#if raySiz}
        <button class="satir" data-dalga onclick={() => gezinme.benAltAc("gorunum")}>
          <span class="simge"><Ikon ad="palet" boyut={20} /></span>
          <span class="etiket">{t("gorunum.baslik")}</span>
          <span class="deger">{temaAdi}</span>
          <span class="ok"><Ikon ad="sagOk" boyut={20} /></span>
        </button>
      {/if}
      <button class="satir" data-dalga onclick={() => gezinme.benAltAc("sohbet")}>
        <span class="simge"><Ikon ad="sohbet" boyut={20} /></span>
        <span class="etiket">{t("ayar.sohbet")}</span>
        <span class="ok"><Ikon ad="sagOk" boyut={20} /></span>
      </button>
      <button class="satir" data-dalga onclick={() => gezinme.benAltAc("bildirimler")}>
        <span class="simge"><Ikon ad="zil" boyut={20} /></span>
        <span class="etiket">{t("ayar.bildirimler")}</span>
        <span class="ok"><Ikon ad="sagOk" boyut={20} /></span>
      </button>
      <div class="satir">
        <span class="simge"><Ikon ad="mikrofon" boyut={20} /></span>
        <span class="etiket metinli"><strong>{t("ben.gurultu")}</strong><span>{t("ben.gurultuAlt")}</span></span>
        <Anahtar acik={arama.gurultuAcik} degis={(v) => arama.gurultuAyarla(v)} etiket={t("ben.gurultu")} />
      </div>
      <button class="satir" data-dalga onclick={() => gezinme.benAltAc("guvenlik")}>
        <span class="simge"><Ikon ad="kalkan" boyut={20} /></span>
        <span class="etiket">{t("guvenlik.baslik")}</span>
        <span class="cip {guvenlikCipi.ton}">{guvenlikCipi.ad}</span>
        <span class="ok"><Ikon ad="sagOk" boyut={20} /></span>
      </button>
      <button class="satir" data-dalga onclick={() => gezinme.benAltAc("hakkinda")}>
        <span class="simge"><Ikon ad="bilgi" boyut={20} /></span>
        <span class="etiket">{t("ayar.hakkinda")}</span>
        <span class="ok"><Ikon ad="sagOk" boyut={20} /></span>
      </button>
      <button class="satir tehlike" onclick={cikisIste} disabled={oturum.mesgul}>
        <span class="simge"><Ikon ad="cikis" boyut={20} /></span>
        <span class="etiket">{oturum.mesgul ? t("ben.cikisYapiliyor") : t("ben.cikis")}</span>
      </button>
    </div>

    <dl class="kart bilgi">
      <div><dt>{t("ben.kullaniciId")}</dt><dd>{oturum.ben?.kullaniciId}</dd></div>
      <div><dt>{t("ben.cihazId")}</dt><dd>{oturum.ben?.cihazId}</dd></div>
      <div><dt>{t("ben.sunucu")}</dt><dd>{oturum.ben?.sunucu}</dd></div>
    </dl>
  </div>

  <!-- Sub-pages slide in over this screen · Alt sayfalar bu ekranın üstüne kayarak girer -->
  {#if gezinme.benAlt}
    <div class="alt-sayfa" in:kayGir out:kayCik>
      {#if gezinme.benAlt === "gorunum"}<Gorunum />{:else if gezinme.benAlt === "sohbet"}<SohbetAyarlari />{:else if gezinme.benAlt === "bildirimler"}<BildirimAyarlari />{:else if gezinme.benAlt === "hakkinda"}<Hakkinda />{:else}<Guvenlik />{/if}
    </div>
  {/if}
</div>

<style>
  .ben { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .alt-sayfa { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; background: var(--zemin); }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px calc(var(--dock-yer, 16px) + 8px); display: grid; gap: 16px; align-content: start; }
  .kimlik { display: flex; align-items: center; gap: 16px; padding: 0 4px; }
  .adlar { display: grid; min-width: 0; }
  .ad { font-family: var(--baslik-tipi); font-size: 1.25rem; line-height: 1.3; font-weight: 600; }
  .mxid { font-size: .875rem; color: var(--yazi-2); }
  .kart { margin: 0; display: grid; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); border-radius: 16px; overflow: hidden; }
  /* Settings row (design section 5): icon, label, value or chip, chevron; at least 56px tall */
  /* Ayar satırı (tasarım bölüm 5): simge, etiket, değer ya da çip, ok; en az 56px yüksek */
  .satir { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 4px 16px; text-align: left; width: 100%; border-bottom: 1px solid var(--kenar-ince); transition: background var(--sure-hizli) var(--egri-cikis); }
  .satir:last-child { border-bottom: 0; }
  button.satir:not(:disabled):active { background: var(--yuzey-2); }
  .satir:has(:global(.anahtar)) { padding-right: 8px; }
  .simge { flex: none; display: inline-flex; color: var(--yazi-2); }
  .etiket { flex: 1; min-width: 0; font-size: .9375rem; }
  .etiket.metinli { display: grid; }
  .etiket.metinli strong { font-weight: 500; }
  .etiket.metinli span { font-size: .8125rem; color: var(--yazi-2); }
  .deger { font-size: .875rem; color: var(--yazi-2); }
  .ok { flex: none; display: inline-flex; color: var(--yazi-2); }
  .tehlike, .tehlike .simge { color: var(--hata); }
  .bilgi > div { padding: 12px 16px; border-bottom: 1px solid var(--kenar-ince); }
  .bilgi > div:last-child { border-bottom: 0; }
  dt { font-size: .8125rem; color: var(--yazi-2); }
  dd { margin: 2px 0 0; font-size: .9375rem; }
</style>
