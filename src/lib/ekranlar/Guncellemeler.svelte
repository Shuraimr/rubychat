<!--
  Ben › Güncellemeler: installed version, manual check, automatic-check toggle, locked beta switch (while on prerelease),
  skipped version management, and link to GitHub Releases.
  Ben › Güncellemeler: yüklü sürüm, elle denetim, otomatik denetim anahtarı, kilitli beta anahtarı (ön sürümdeyken),
  atlanan sürüm yönetimi ve GitHub Releases bağlantısı.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { baglantiSayfasi } from "../durum/baglantiOnay.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { guncelleme } from "../durum/guncelleme.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";

  const KAYNAK_URL = "https://github.com/Shuraimr/rubychat/releases";

  let kenar = $state(false);
  let simdi = $state(Date.now());

  onMount(() => {
    void guncelleme.surumYukle();
    // Refresh the relative "last checked" string once a minute while this page stays open. · Bu sayfa açıkken göreli "son denetim" metnini dakikada bir yenile.
    const z = setInterval(() => (simdi = Date.now()), 60_000);
    return () => clearInterval(z);
  });

  function denetimZamani(ms: number): string {
    const dk = Math.max(0, Math.floor((simdi - ms) / 60_000));
    if (dk < 1) return t("guncelleme.zamanAzOnce");
    if (dk < 60) return t("guncelleme.zamanDk", { n: dk });
    const sa = Math.floor(dk / 60);
    if (sa < 24) return t("guncelleme.zamanSa", { n: sa });
    return t("guncelleme.zamanGun", { n: Math.floor(sa / 24) });
  }

  const denetleniyor = $derived(guncelleme.durum === "denetleniyor");
  const yeni = $derived(guncelleme.bilgi?.yeni ?? null);
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("ayar.guncellemeler")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="ay-icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <section class="ay-bolum">
      <div class="ay-kart govde surum-kart">
        <span class="etiket">{t("guncelleme.yukluSurum")}</span>
        <strong class="surum-deger t-l mono">{guncelleme.mevcutSurum || "—"}</strong>
        {#if yeni}
          <p class="durum-satir vurgu">{t("guncelleme.yeniVar", { surum: yeni.surum })}</p>
        {:else if guncelleme.durum === "hata" && guncelleme.hata}
          <p class="durum-satir hata" role="alert">{guncelleme.hata}</p>
        {:else if guncelleme.sonDenetim}
          <p class="durum-satir tamam">{t("guncelleme.sonDenetimGuncel", { zaman: denetimZamani(guncelleme.sonDenetim) })}</p>
        {:else}
          <p class="durum-satir">{t("guncelleme.henuzDenetlenmedi")}</p>
        {/if}
        <div class="kart-eylemler">
          {#if yeni}
            <button class="buton birincil" type="button" onclick={() => guncelleme.sayfaAc()}>{t("guncelleme.guncelle")}</button>
          {/if}
          <button class="buton tonlu" type="button" disabled={denetleniyor} onclick={() => void guncelleme.denetle(true)}>
            {denetleniyor ? t("guncelleme.denetleniyor") : t("guncelleme.simdiDenetle")}
          </button>
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin">
            <strong>{t("guncelleme.otomatik")}</strong>
            <span>{t("guncelleme.otomatikAlt")}</span>
          </span>
          <Anahtar
            acik={tercihler.d.guncellemeOtomatik}
            degis={(v) => tercihler.yaz("guncellemeOtomatik", v)}
            etiket={t("guncelleme.otomatik")}
          />
        </div>
        <div class="ay-satir">
          <span class="ay-metin">
            <strong class="kilitli-baslik">
              <span>{t("guncelleme.beta")}</span>
              {#if guncelleme.betaZorunlu}<span class="kilit-simge" aria-hidden="true"><Ikon ad="kilit" boyut={14} /></span>{/if}
            </strong>
            <span>{t("guncelleme.betaAlt")}</span>
          </span>
          <Anahtar
            acik={true}
            kilitli={guncelleme.betaZorunlu}
            degis={() => {}}
            etiket={t("guncelleme.beta")}
          />
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin">
            <strong>{t("guncelleme.atlanan")}</strong>
            {#if tercihler.d.guncellemeAtlanan}
              <span class="mono">{tercihler.d.guncellemeAtlanan}</span>
            {:else}
              <span>{t("guncelleme.atlananYok")}</span>
            {/if}
          </span>
          {#if tercihler.d.guncellemeAtlanan}
            <button class="buton metin geri-al" type="button" onclick={() => guncelleme.atlananGeriAl()}>
              {t("guncelleme.geriAl")}
            </button>
          {/if}
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <div class="ay-kart">
        <button class="ay-satir dugme" type="button" data-dalga onclick={() => baglantiSayfasi(KAYNAK_URL)}>
          <span class="ay-metin">
            <strong>{t("guncelleme.kaynak")}</strong>
            <span>github.com/Shuraimr/rubychat/releases</span>
          </span>
          <Ikon ad="sagOk" boyut={20} />
        </button>
      </div>
    </section>
  </div>
</div>

<style>
  .surum-kart {
    gap: 6px;
  }
  .etiket {
    font-size: .8125rem;
    font-weight: 500;
    color: var(--yazi-2);
  }
  .surum-deger {
    font-size: 1.5rem;
    line-height: 1.25;
    color: var(--yazi);
  }
  .durum-satir {
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .durum-satir.tamam {
    color: var(--cozum);
  }
  .durum-satir.vurgu {
    color: var(--vurgu);
    font-weight: 600;
  }
  .durum-satir.hata {
    color: var(--hata);
  }
  .kart-eylemler {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .kart-eylemler > * {
    flex: 1 1 9rem;
  }
  .kilitli-baslik {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .kilit-simge {
    display: inline-flex;
    color: var(--yazi-2);
  }
  .geri-al {
    width: auto;
    min-height: 44px;
    padding: 0 12px;
  }
</style>
