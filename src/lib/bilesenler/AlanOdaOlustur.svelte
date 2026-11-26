<!--
  Create a room or sub-space inside a space (bottom sheet on phones, 480px dialog on wide screens via AltSayfa).
  Links the new room/sub-space both ways in one backend call (`alandaOdaOlustur`), refreshes the space, and opens it.
  Bir alanın içinde oda ya da alt alan oluşturma (telefonda AltSayfa, geniş ekranda 480px pencere).
  Yeni odayı/alt alanı tek arka uç çağrısıyla (`alandaOdaOlustur`) iki yönde bağlar, alanı yeniler ve açar.
-->
<script lang="ts">
  import { alandaOdaOlustur } from "../api/komutlar";
  import type { Hata } from "../api/tipler";
  import { alanlar } from "../durum/alanlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t, type Anahtar as I18nAnahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Anahtar from "./Anahtar.svelte";
  import Ikon from "./Ikon.svelte";

  type KatilimSecimi = "alan" | "acik" | "davet";

  let {
    alanId,
    alanAd,
    altAlan = false,
    onolustu,
    onkapat,
  }: {
    alanId: string;
    alanAd: string;
    /** true = create a sub-space (hides announcement & encryption switches) · true = alt alan oluştur (duyuru ve şifreleme anahtarlarını gizler) */
    altAlan?: boolean;
    /** Runs right after creation so the parent refreshes its list · Oluşturmadan hemen sonra çağrılır; üst bileşen listesini yeniler */
    onolustu?: (yeniId: string, ad: string) => void;
    onkapat: () => void;
  } = $props();

  let ad = $state("");
  let konu = $state("");
  let katilim = $state<KatilimSecimi>("alan");
  let duyuru = $state(false);
  let sifreli = $state(true);
  let mesgul = $state(false);
  let hata = $state<string | null>(null);
  let formEl: HTMLFormElement | undefined = $state();

  const katilimSecenekleri: { id: KatilimSecimi; baslik: string; alt: string }[] = $derived([
    { id: "alan", baslik: t("alanYonet.alanUyeleri"), alt: t("alanYonet.alanUyeleriAlt", { alan: alanAd }) },
    { id: "acik", baslik: t("alanYonet.herkeseAcik"), alt: t("alanYonet.herkeseAcikAlt") },
    { id: "davet", baslik: t("alanYonet.yalnizcaDavetle"), alt: t("alanYonet.yalnizcaDavetleAlt") },
  ]);

  function katilimSec(yeni: KatilimSecimi) {
    if (mesgul) return;
    katilim = yeni;
    // Public rooms default encryption off (recommended); the user may still switch it back on · Herkese açık odada şifreleme kendiliğinden kapanır (önerilir); kullanıcı yine açabilir
    if (yeni === "acik") sifreli = false;
  }

  /** Arrow-key navigation inside the join-rule radiogroup · Katılma kuralı radyo grubunda ok tuşlarıyla gezinme */
  function radyoKlavye(e: KeyboardEvent, i: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const sonraki = (i + (e.key === "ArrowDown" ? 1 : -1) + katilimSecenekleri.length) % katilimSecenekleri.length;
    katilimSec(katilimSecenekleri[sonraki].id);
    const grup = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    const dugmeler = grup?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    dugmeler?.[sonraki]?.focus();
  }

  async function gonder(e: SubmitEvent) {
    e.preventDefault();
    const temizAd = ad.trim();
    if (!temizAd || mesgul) return;
    mesgul = true;
    hata = null;
    try {
      const yeniId = await alandaOdaOlustur(
        alanId,
        temizAd,
        konu.trim() || null,
        katilim,
        altAlan ? false : duyuru,
        altAlan ? false : sifreli,
        altAlan,
      );
      onkapat();
      onolustu?.(yeniId, temizAd);
      if (altAlan) {
        void alanlar.ustYenile();
        alanlar.ac(yeniId, temizAd);
      } else {
        // Stay on the Spaces tab so back returns to this space · Alanlar sekmesinde kal; geri bu alana döner
        gezinme.odaAc(yeniId, true);
      }
    } catch (err) {
      const e2 = err as Hata | undefined;
      hata = e2?.tur && e2.tur !== "diger" ? t(`hata.${e2.tur}` as I18nAnahtar) : e2?.mesaj || t("hata.diger");
    } finally {
      mesgul = false;
    }
  }
</script>

<AltSayfa baslik={altAlan ? t("alanYonet.altAlanOlusturBaslik", { alan: alanAd }) : t("alanYonet.odaOlusturBaslik", { alan: alanAd })} {onkapat}>
  <form class="form" bind:this={formEl} onsubmit={gonder}>
    <label class="alan">
      <span class="etiket">{altAlan ? t("alanYonet.altAlanAdi") : t("alanYonet.odaAdi")}</span>
      <span class="alan-kutu">
        <input bind:value={ad} maxlength="255" disabled={mesgul} autocomplete="off" enterkeyhint="next" />
      </span>
    </label>

    <label class="alan">
      <span class="etiket">{t("alanYonet.konuIstegeBagli")}</span>
      <span class="alan-kutu">
        <input bind:value={konu} maxlength="500" disabled={mesgul} autocomplete="off" enterkeyhint="done" />
      </span>
    </label>

    <div class="bolum">
      <span class="bolum-baslik" id="katilim-baslik">{t("alanYonet.kimKatilabilir")}</span>
      <div class="radyo-kart" role="radiogroup" aria-labelledby="katilim-baslik">
        {#each katilimSecenekleri as s, i (s.id)}
          <button
            type="button"
            class="radyo-satir"
            class:secili={katilim === s.id}
            role="radio"
            aria-checked={katilim === s.id}
            disabled={mesgul}
            data-dalga
            onclick={() => katilimSec(s.id)}
            onkeydown={(e) => radyoKlavye(e, i)}
          >
            <span class="radyo-daire" aria-hidden="true"><span class="radyo-nokta"></span></span>
            <span class="radyo-metin">
              <strong>{s.baslik}</strong>
              <span>{s.alt}</span>
            </span>
          </button>
        {/each}
      </div>
    </div>

    {#if !altAlan}
      <div class="anahtar-kart">
        <div class="anahtar-satir">
          <span class="anahtar-metin">
            <strong>{t("alanYonet.duyuruOdasi")}</strong>
            <span>{t("alanYonet.duyuruOdasiAlt")}</span>
          </span>
          <Anahtar acik={duyuru} degis={(v) => (duyuru = v)} etiket={t("alanYonet.duyuruOdasi")} kilitli={mesgul} />
        </div>
        <div class="anahtar-satir">
          <span class="anahtar-metin">
            <strong>{t("alanYonet.e2ee")}</strong>
            <span>{t("alanYonet.e2eeAlt")}</span>
          </span>
          <Anahtar acik={sifreli} degis={(v) => (sifreli = v)} etiket={t("alanYonet.e2ee")} kilitli={mesgul} />
        </div>
      </div>
    {/if}

    {#if hata}
      <p class="alan-hata" role="alert"><Ikon ad="uyari" boyut={16} /><span>{hata}</span></p>
    {/if}

    <!-- Hidden submit button so pressing Enter inside any input submits the form on desktop · Herhangi bir girdide Enter'a basınca masaüstünde formu göndersin -->
    <button type="submit" hidden disabled={!ad.trim() || mesgul} aria-hidden="true" tabindex="-1"></button>
  </form>

  {#snippet altlik()}
    <button type="button" class="buton birincil" disabled={!ad.trim() || mesgul} onclick={() => formEl?.requestSubmit()}>
      {#if mesgul}<span class="yuklenme"></span>{t("alanYonet.olusturuluyor")}{:else}{t("eylem.olustur")}{/if}
    </button>
  {/snippet}
</AltSayfa>

<style>
  .form { display: grid; gap: 16px; }
  .bolum { display: grid; gap: 8px; }
  .bolum-baslik { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); padding: 0 4px; }
  .radyo-kart, .anahtar-kart { background: var(--yuzey-2); border-radius: 16px; overflow: hidden; display: grid; }
  .radyo-satir {
    width: 100%; min-height: 56px; padding: 12px 14px; display: flex; align-items: flex-start; gap: 12px; text-align: left;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .radyo-satir:last-child { border-bottom: 0; }
  .radyo-satir:disabled { opacity: .5; }
  .radyo-daire {
    flex: none; width: 20px; height: 20px; margin-top: 2px; border-radius: 50%; border: 2px solid var(--kenar);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .radyo-satir.secili .radyo-daire { border-color: var(--vurgu); }
  .radyo-nokta { width: 10px; height: 10px; border-radius: 50%; background: var(--vurgu); transform: scale(0); transition: transform var(--sure-hizli) var(--egri-ac); }
  .radyo-satir.secili .radyo-nokta { transform: scale(1); }
  .radyo-metin, .anahtar-metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .radyo-metin strong, .anahtar-metin strong { font-size: .9375rem; font-weight: 600; line-height: 1.3; color: var(--yazi); }
  .radyo-metin span, .anahtar-metin span { font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); }
  .anahtar-satir {
    min-height: 60px; padding: 10px 8px 10px 14px; display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .anahtar-satir:last-child { border-bottom: 0; }
</style>
