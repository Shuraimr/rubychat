<!--
  Login screen (design 22/11 and 22/12): the waving raccoon on a soft accent halo, "rubychat'e hoş geldin", username + password with
  floating labels, the server shown as one line ("Sunucu: matrix.org · Değiştir") that expands the server field, a big primary button,
  SSO (placeholder, disabled) and the register hint. A failure that is not about the credentials (network, server) switches the whole
  screen to the sad raccoon with a friendly title; the technical detail stays collapsed under "Ayrıntı" (selectable + copyable).
  Giriş ekranı (tasarım 22/11 ve 22/12): yumuşak vurgu halesinde el sallayan rakun, "rubychat'e hoş geldin", kayan etiketli kullanıcı adı +
  şifre, sunucu tek satır ("Sunucu: matrix.org · Değiştir"; dokununca sunucu alanı açılır), büyük birincil düğme, SSO (yer tutucu, devre
  dışı) ve kayıt ipucu. Kimlik bilgisiyle ilgili olmayan bir hata (ağ, sunucu) bütün ekranı üzgün rakuna ve dost bir başlığa çevirir;
  teknik ayrıntı "Ayrıntı" altında kapalı durur (seçilebilir + kopyalanabilir).
-->
<script lang="ts">
  import { hesaplariAl } from "../api/komutlar";
  import { panoyaYaz } from "../pano";
  import { bildirim } from "../durum/bildirim.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t } from "../i18n";
  import Ikon from "../bilesenler/Ikon.svelte";
  import TelefonlaGiris from "./TelefonlaGiris.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";

  // Came here to add an account: there is a way back. · Buraya hesap eklemeye gelindi: dönüş yolu var.
  let donulecek = $state<string | null>(null);
  void hesaplariAl()
    .then((h) => (donulecek = h.liste.at(0)?.id ?? null))
    .catch(() => {});

  let sunucu = $state("matrix.org");
  let sunucuAcik = $state(false);
  let kullanici = $state("");
  let sifre = $state("");
  let goster = $state(false);
  let yerelHata = $state<string | null>(null);
  let ayrintiAcik = $state(false);
  let telefonla = $state(false);
  // A full id typed above names its own server. · Yukarı yazılan tam kimlik kendi sunucusunu söyler.
  const girisSunucusu = $derived(/^@[^:]+:(.+)$/.exec(kullanici.trim())?.[1] ?? sunucu.trim());

  // Wrong credentials stay on the form (inline); everything else is a full-screen "something broke" state.
  // Yanlış kimlik bilgisi formda (satır içi) kalır; geri kalan her şey tam ekran "bir şey bozuldu" durumudur.
  const kimlikHatasi = $derived(oturum.hata?.tur === "giris");
  const tamHata = $derived(!!oturum.hata && !kimlikHatasi);
  const hataBaslik = $derived(
    oturum.hata?.tur === "ag" ? t("giris.hataAg") : oturum.hata?.tur === "sunucu_bulunamadi" ? t("giris.hataSunucu") : t("giris.hataDiger"),
  );
  const hataAlt = $derived(
    oturum.hata?.tur === "ag" ? t("giris.hataAgAlt") : oturum.hata?.tur === "sunucu_bulunamadi" ? t("giris.hataSunucuAlt") : t("giris.hataDigerAlt"),
  );
  const alanHatasi = $derived(yerelHata ?? (kimlikHatasi ? t("hata.giris") : null));

  async function gonder(e?: SubmitEvent) {
    e?.preventDefault();
    yerelHata = null;
    // Server-side checks exist too; this only saves a round trip. · Sunucu tarafı da denetler; bu yalnızca bir gidiş-dönüşü kurtarır.
    if (!sunucu.trim() || !kullanici.trim() || !sifre) {
      yerelHata = t("giris.bos");
      sunucuAcik = sunucuAcik || !sunucu.trim();
      return;
    }
    await oturum.giris({ sunucu: sunucu.trim(), kullanici: kullanici.trim(), sifre });
  }

  async function ayrintiKopyala() {
    try {
      await panoyaYaz(oturum.hata?.mesaj ?? "");
      bildirim.goster(t("giris.kopyalandi"), 3000, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }
</script>

<main class="sayfa">
  {#if telefonla}
    <TelefonlaGiris sunucu={girisSunucusu} onkapat={() => (telefonla = false)} />
  {:else if tamHata}
    <section class="kart merkez">
      <Maskot poz="hata" boyut={168} />
      <h1>{hataBaslik}</h1>
      <p class="alt">{hataAlt}</p>
      {#if oturum.hata?.mesaj}
        <div class="ayrinti-kutu">
          <button class="ayrinti-baslik" type="button" aria-expanded={ayrintiAcik} onclick={() => (ayrintiAcik = !ayrintiAcik)}>
            {t("giris.ayrinti")} <span class="ok" class:acik={ayrintiAcik}><Ikon ad="asagiOk" boyut={14} /></span>
          </button>
          <p class="ayrinti" class:acik={ayrintiAcik}>{oturum.hata.mesaj}</p>
          {#if ayrintiAcik}<button class="kopyala" type="button" onclick={ayrintiKopyala}><Ikon ad="kopya" boyut={16} />{t("giris.ayrintiKopyala")}</button>{/if}
        </div>
      {/if}
      <button class="buton birincil" type="button" disabled={oturum.mesgul} onclick={() => gonder()}>
        {#if oturum.mesgul}<span class="yuklenme"></span>{t("giris.yapiliyor")}{:else}{t("giris.tekrarDene")}{/if}
      </button>
      <button class="buton metin" type="button" onclick={() => (oturum.hata = null)}>{t("giris.geriDon")}</button>
    </section>
  {:else}
    <form class="kart" onsubmit={gonder}>
      <div class="maskot-yer"><Maskot poz={kimlikHatasi ? "hata" : "selam"} boyut={180} hale /></div>
      <h1>{t("giris.hosgeldin")}</h1>
      <p class="alt">{t("giris.hosgeldinAlt")}</p>

      <label class="yuzen" class:hatali={!!alanHatasi}>
        <input bind:value={kullanici} type="text" placeholder=" " autocapitalize="off" autocomplete="username" spellcheck="false" />
        <span class="etiket">{t("giris.kullanici")}</span>
      </label>

      <label class="yuzen" class:hatali={!!alanHatasi}>
        <input bind:value={sifre} type={goster ? "text" : "password"} placeholder=" " autocomplete="current-password" />
        <span class="etiket">{t("giris.sifre")}</span>
        <button type="button" class="goster" onclick={() => (goster = !goster)}>{goster ? t("giris.gizle") : t("giris.goster")}</button>
      </label>
      {#if alanHatasi}<span class="alan-hata" role="alert"><Ikon ad="uyari" boyut={14} />{alanHatasi}</span>{/if}

      {#if sunucuAcik}
        <label class="yuzen">
          <input bind:value={sunucu} type="text" placeholder=" " inputmode="url" autocapitalize="off" autocomplete="url" spellcheck="false" />
          <span class="etiket">{t("giris.sunucu")}</span>
        </label>
      {:else}
        <p class="sunucu-satir">{t("giris.sunucuSatir", { sunucu })} · <button type="button" onclick={() => (sunucuAcik = true)}>{t("giris.degistir")}</button></p>
      {/if}

      <button class="buton birincil buyuk" type="submit" disabled={oturum.mesgul}>
        {#if oturum.mesgul}<span class="yuklenme"></span>{t("giris.yapiliyor")}{:else}{t("giris.dugme")}{/if}
      </button>
      <button class="buton tonlu-yuzey buyuk" type="button" disabled={oturum.mesgul || !sunucu.trim()} onclick={() => (telefonla = true)}><Ikon ad="telefonCihaz" boyut={20} />{t("telefonla.dugme")}</button>
      {#if donulecek !== null}<button class="buton cizgili buyuk" type="button" disabled={oturum.mesgul} onclick={() => void oturum.hesapDegistir(donulecek).catch(() => bildirim.goster(t("hata.diger"), 4000, { tur: "hata" }))}>{t("hesaplar.geriDon")}</button>{/if}
      <p class="kayit">{t("giris.kayitSatir")}</p>
    </form>
  {/if}
</main>

<style>
  .sayfa { height: 100%; overflow-y: auto; display: flex; justify-content: center; align-items: flex-start; padding: 16px 24px 32px; padding-top: max(16px, env(safe-area-inset-top)); }
  .kart { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; }
  /* Wide window: centred; auto margins never cut the top off in a short one. · Geniş pencere: ortalı; kısa pencerede üst kesilmez. */
  @media (min-width: 700px) { .kart { margin-block: auto; } }
  .kart.merkez { align-items: center; text-align: center; padding-top: 48px; }
  .maskot-yer { display: flex; justify-content: center; padding: 8px 0 4px; }
  h1 { font-size: 1.5rem; line-height: 1.25; font-weight: 600; }
  .alt { font-size: .9375rem; color: var(--yazi-2); }
  /* Floating label: the label sits inside the box and floats up when the field has text or focus (placeholder=" " trick). */
  /* Kayan etiket: etiket kutunun içinde durur; alan doluyken ya da odaktayken yukarı kayar (placeholder=" " hilesi). */
  .yuzen { position: relative; display: block; border-radius: 16px; background: var(--yuzey-2); border: 1px solid transparent; transition: border-color var(--sure-hizli) var(--egri-cikis); }
  .yuzen:focus-within { border-color: var(--vurgu); }
  .yuzen.hatali { border-color: var(--hata); }
  .yuzen input { width: 100%; height: 56px; padding: 22px 76px 6px 16px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .etiket { position: absolute; left: 16px; top: 18px; font-size: 1rem; color: var(--yazi-2); pointer-events: none; transform-origin: left top; transition: transform var(--sure-gecis) var(--egri-cikis); }
  .yuzen input:focus ~ .etiket, .yuzen input:not(:placeholder-shown) ~ .etiket { transform: translateY(-11px) scale(.75); }
  .goster { position: absolute; right: 4px; top: 6px; min-height: 44px; padding: 0 12px; color: var(--vurgu); font-size: .875rem; font-weight: 600; }
  .alan-hata { margin-top: -6px; }
  .sunucu-satir { font-size: .875rem; color: var(--yazi-2); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .sunucu-satir button { min-height: 44px; padding: 0 4px; color: var(--yazi); font-weight: 600; }
  .buyuk { height: 56px; border-radius: 28px; font-size: 1rem; }
  .tonlu-yuzey { background: var(--yuzey-2); color: var(--yazi); }
  .kayit { text-align: center; color: var(--vurgu); font-weight: 600; font-size: .9375rem; padding: 8px 0; }
  .ayrinti-kutu { width: 100%; text-align: left; padding: 8px 12px; border-radius: 16px; background: color-mix(in srgb, var(--hata) 12%, var(--zemin)); }
  .ayrinti-baslik { min-height: 44px; display: inline-flex; align-items: center; gap: 4px; color: var(--hata); font-weight: 600; font-size: .875rem; }
  .ok { display: inline-flex; transition: transform var(--sure-hizli) var(--egri-cikis); }
  .ok.acik { transform: rotate(180deg); }
  .ayrinti { font-family: var(--mono-tipi); font-size: .75rem; color: var(--yazi-2); line-height: 1.5; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; -webkit-user-select: text; user-select: text; padding-bottom: 4px; }
  .ayrinti.acik { display: block; -webkit-line-clamp: unset; line-clamp: unset; }
  .kopyala { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; color: var(--vurgu); font-weight: 600; font-size: .875rem; }
</style>
