<!--
  Login screen (password). SSO/OIDC will be added as a second button later (it is a disabled placeholder now).
  Fields follow the design (section 3): label above, 52px box, accent border on focus, red border + reason on error.
  Giriş ekranı (şifre). SSO/OIDC sonra ikinci düğme olarak eklenecek (şimdilik devre dışı yer tutucu).
  Alanlar tasarımı izler (bölüm 3): etiket üstte, 52px kutu, odakta vurgu kenarı, hatada kırmızı kenar + neden.
-->
<script lang="ts">
  import { oturum } from "../durum/oturum.svelte";
  import { t, type Anahtar } from "../i18n";
  import Ikon from "../bilesenler/Ikon.svelte";

  let sunucu = $state("matrix.org");
  let kullanici = $state("");
  let sifre = $state("");
  let goster = $state(false);
  let yerelHata = $state<string | null>(null);

  const hataMetni = $derived(
    yerelHata ?? (oturum.hata ? t(`hata.${oturum.hata.tur}` as Anahtar) : null),
  );
  // Technical detail under the friendly text: without it a phone-only failure (TLS, DNS) cannot be diagnosed.
  // Dost metnin altında teknik ayrıntı: onsuz yalnızca telefonda olan bir hata (TLS, DNS) teşhis edilemez.
  const hataAyrinti = $derived(yerelHata ? null : (oturum.hata?.mesaj ?? null));

  async function gonder(e: SubmitEvent) {
    e.preventDefault();
    yerelHata = null;
    // Server-side checks exist too; this only saves a round trip. · Sunucu tarafı da denetler; bu yalnızca bir gidiş-dönüşü kurtarır.
    if (!sunucu.trim() || !kullanici.trim() || !sifre) {
      yerelHata = t("giris.bos");
      return;
    }
    await oturum.giris({ sunucu: sunucu.trim(), kullanici: kullanici.trim(), sifre });
  }
</script>

<main class="sayfa">
  <form class="kart" onsubmit={gonder}>
    <div class="logo"><img src="/logo.svg" width="28" height="28" alt="" /><span>rubychat</span></div>
    <h1>{t("giris.baslik")}</h1>
    <p class="alt">{t("giris.alt")}</p>

    <label class="alan">
      <span class="etiket">{t("giris.sunucu")}</span>
      <span class="alan-kutu">
        <Ikon ad="kalkan" boyut={18} />
        <input bind:value={sunucu} type="text" inputmode="url" autocapitalize="off" autocomplete="url" spellcheck="false" />
      </span>
    </label>

    <label class="alan">
      <span class="etiket">{t("giris.kullanici")}</span>
      <span class="alan-kutu" class:hatali={!!hataMetni}>
        <Ikon ad="kisi" boyut={18} />
        <input bind:value={kullanici} type="text" placeholder={t("giris.kullaniciYer")} autocapitalize="off" autocomplete="username" spellcheck="false" />
      </span>
    </label>

    <label class="alan">
      <span class="etiket">{t("giris.sifre")}</span>
      <span class="alan-kutu" class:hatali={!!hataMetni}>
        <Ikon ad="kilit" boyut={18} />
        <input bind:value={sifre} type={goster ? "text" : "password"} autocomplete="current-password" />
        <button type="button" class="goster" onclick={() => (goster = !goster)}>{goster ? t("giris.gizle") : t("giris.goster")}</button>
      </span>
      {#if hataMetni}<span class="alan-hata" role="alert"><Ikon ad="uyari" boyut={14} />{hataMetni}</span>{#if hataAyrinti}<small class="alan-ayrinti">{hataAyrinti}</small>{/if}{/if}
    </label>

    <button class="buton birincil" type="submit" disabled={oturum.mesgul}>
      {#if oturum.mesgul}<span class="yuklenme"></span>{t("giris.yapiliyor")}{:else}{t("giris.dugme")}{/if}
    </button>

    <div class="ya"><span>{t("giris.ya")}</span></div>
    <button class="buton cizgili" type="button" disabled>{t("giris.sso")}</button>
    <p class="not">{t("giris.ssoYakinda")}</p>

    <p class="alt alt-orta">{t("giris.hesapYok")} <strong>{t("giris.kayit")}</strong></p>
  </form>
</main>

<style>
  .sayfa { height: 100%; overflow-y: auto; display: flex; justify-content: center; align-items: flex-start; padding: 24px; padding-top: max(24px, env(safe-area-inset-top)); }
  .kart { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 16px; }
  .logo { display: flex; align-items: center; gap: 10px; font-family: var(--baslik-tipi); font-size: 1.625rem; font-weight: 600; margin-bottom: 8px; }
  h1 { font-size: 1.5rem; line-height: 1.25; font-weight: 600; }
  .alt { font-size: .9375rem; color: var(--yazi-2); }
  .alt-orta { text-align: center; margin-top: 8px; }
  .alt-orta strong { color: var(--vurgu); font-weight: 600; }
  .goster { color: var(--vurgu); font-size: .875rem; font-weight: 600; min-height: 44px; padding: 0 4px; }
  .ya { display: flex; align-items: center; gap: 12px; color: var(--yazi-2); font-size: .8125rem; }
  .ya::before, .ya::after { content: ""; flex: 1; height: 1px; background: var(--kenar-ince); }
  .not { font-size: .8125rem; color: var(--yazi-2); text-align: center; margin-top: -8px; }
  .alan-ayrinti { display: block; font-size: 11px; color: var(--ton); word-break: break-word; user-select: text; }
</style>
