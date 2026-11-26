<!--
  Setup report modal (mounted in App.svelte outside session gating so it works right after the first-run tour too).
  Phone: full-screen page with safe-area padding; wide screen: centred 600px dialog.
  Groups rows into SİSTEM / İZİNLER / BAĞLANTI cards (--yuzey-1), with 30px status icons and one-tap fix buttons.
  Kurulum raporu penceresi (ilk kurulum turundan hemen sonra da çalışsın diye App.svelte'te oturumdan bağımsız bağlanır).
  Telefon: safe-area dolgulu tam ekran sayfa; geniş ekran: ortada 600px pencere.
  Satırları SİSTEM / İZİNLER / BAĞLANTI kartlarında (--yuzey-1), 30px durum kutuları ve tek dokunuşluk düzeltme düğmeleriyle gösterir.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { RaporSatiri } from "../api/tipler";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import {
    kurulum,
    kurulumRaporuKapat,
    raporDuzMetin,
    raporOzetiMetni,
    raporSatirMetni,
  } from "../durum/kurulum.svelte";
  import { perdeCik, perdeGir, sayfaCik, sayfaGir } from "../gecis";
  import { t } from "../i18n";
  import { panoyaYaz } from "../pano";
  import Ikon from "./Ikon.svelte";
  import Maskot from "./Maskot.svelte";

  const GRUPLAR: readonly RaporSatiri["grup"][] = ["sistem", "izinler", "baglanti"];
  const masaustu = !/android/i.test(navigator.userAgent);

  let kutu: HTMLDivElement | undefined = $state();
  let tepsiYardimAcik = $state(false);

  const gruplu = $derived(
    GRUPLAR.map((grup) => ({
      grup,
      baslik: t(`kurulumRaporu.grup.${grup}`),
      satirlar: kurulum.satirlar.filter((s) => s.grup === grup),
    })).filter((g) => g.satirlar.length > 0),
  );

  const ozet = $derived(raporOzetiMetni(kurulum.satirlar));

  // Register on the layer stack while open so Android back and Escape close it cleanly.
  // Açıkken katman yığınına kaydol; Android geri tuşu ve Escape düzgün kapatsın.
  $effect(() => {
    if (!kurulum.acik) return;
    tepsiYardimAcik = false;
    const katmanId = untrack(() => gezinme.katmanAc(() => kurulumRaporuKapat()));
    queueMicrotask(() => kutu?.focus());
    return () => gezinme.katmanBirak(katmanId);
  });

  function kapat() {
    kurulumRaporuKapat();
  }

  function eylemCalistir(eylem: string) {
    if (eylem === "tepsi_yardim") {
      tepsiYardimAcik = !tepsiYardimAcik;
      return;
    }
    void kurulum.duzelt(eylem);
  }

  async function kopyala() {
    try {
      await panoyaYaz(raporDuzMetin(kurulum.satirlar, kurulum.surum));
      bildirim.goster(t("kurulumRaporu.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 3500, { tur: "hata" });
    }
  }

  const giris = (n: Element) => (gezinme.genis ? perdeGir(n) : sayfaGir(n));
  const cikis = (n: Element) => (gezinme.genis ? perdeCik(n) : sayfaCik(n));
</script>

{#if kurulum.acik}
  {#if gezinme.genis}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="perde" onclick={kapat} in:perdeGir out:perdeCik></div>
  {/if}
  <div class="kap" class:pencere={gezinme.genis}>
    <div
      class="rapor"
      role="dialog"
      aria-modal="true"
      aria-label={t("kurulumRaporu.baslik")}
      tabindex="-1"
      bind:this={kutu}
      in:giris
      out:cikis
    >
      <div class="ust-cubuk">
        <button
          class="simge-dugme"
          type="button"
          onclick={() => void kurulum.calistir()}
          disabled={kurulum.yukleniyor}
          aria-label={t("kurulumRaporu.yenile")}
        >
          <Ikon ad="yenile" boyut={20} />
        </button>
        <button class="simge-dugme" type="button" onclick={kapat} aria-label={t("eylem.kapat")}>
          <Ikon ad="kapat" boyut={20} />
        </button>
      </div>

      <div class="govde">
        <header class="baslik-kutu">
          <Maskot poz="kilit" boyut={72} />
          <div class="baslik-metin">
            <h2>{t("kurulumRaporu.baslik")}</h2>
            {#if ozet}
              <p class="ozet">{ozet}</p>
            {:else if kurulum.yukleniyor}
              <p class="ozet">{t("kurulumRaporu.yukleniyor")}</p>
            {/if}
          </div>
        </header>

        {#if kurulum.yukleniyor && kurulum.satirlar.length === 0}
          <div class="durum-alani">
            <span class="yuklenme"></span>
            <p>{t("kurulumRaporu.yukleniyor")}</p>
          </div>
        {:else if kurulum.hata && kurulum.satirlar.length === 0}
          <div class="durum-alani">
            <p>{kurulum.hata}</p>
            <button class="buton tonlu yeniden" type="button" onclick={() => void kurulum.calistir()}>
              {t("eylem.yenidenDene")}
            </button>
          </div>
        {:else if gruplu.length === 0}
          <div class="durum-alani">
            <p>{t("kurulumRaporu.bos")}</p>
          </div>
        {:else}
          <div class="gruplar">
            {#each gruplu as g (g.grup)}
              <section class="grup">
                <h3>{g.baslik}</h3>
                <div class="kart">
                  {#each g.satirlar as s (s.kimlik)}
                    {@const m = raporSatirMetni(s)}
                    <div class="satir-kapsam">
                      <div class="satir">
                        <span
                          class="durum-kutu {s.durum}"
                          aria-label={t(`kurulumRaporu.durum.${s.durum}`)}
                        >
                          <Ikon
                            ad={s.durum === "tamam" ? "onay" : s.durum === "uyari" ? "uyari" : "kapat"}
                            boyut={16}
                          />
                        </span>
                        <div class="satir-metin">
                          <strong>{m.baslik}</strong>
                          {#if m.aciklama}
                            <p>{m.aciklama}</p>
                          {/if}
                        </div>
                        {#if s.eylem}
                          <button
                            class="eylem-dugme"
                            type="button"
                            disabled={kurulum.duzeltilen === s.eylem}
                            aria-expanded={s.eylem === "tepsi_yardim" ? tepsiYardimAcik : undefined}
                            onclick={() => s.eylem && eylemCalistir(s.eylem)}
                          >
                            {m.eylemEtiket}
                          </button>
                        {/if}
                      </div>
                      {#if s.eylem === "tepsi_yardim" && tepsiYardimAcik}
                        <p class="yardim-notu">{t("kurulumRaporu.tepsiYardim")}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      </div>

      <footer class="altlik" class:cift={masaustu && kurulum.satirlar.length > 0}>
        {#if masaustu && kurulum.satirlar.length > 0}
          <button class="buton cizgili" type="button" onclick={() => void kopyala()}>
            <Ikon ad="kopya" boyut={18} />
            {t("kurulumRaporu.kopyala")}
          </button>
        {/if}
        <button class="buton birincil" type="button" onclick={kapat}>
          {t("kurulumRaporu.bitti")}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .perde {
    position: fixed;
    inset: 0;
    z-index: 36;
    background: color-mix(in srgb, var(--zemin) 55%, transparent);
  }
  .kap {
    position: fixed;
    inset: 0;
    z-index: 37;
    display: flex;
    align-items: stretch;
    justify-content: center;
    pointer-events: none;
  }
  .kap.pencere {
    align-items: center;
    padding: 16px;
  }
  .rapor {
    pointer-events: auto;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--zemin);
    color: var(--yazi);
    outline: none;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pencere .rapor {
    width: min(600px, 100%);
    height: auto;
    max-height: min(86vh, 760px);
    border-radius: 1.75rem;
    border: 1px solid var(--kenar-ince);
    box-shadow: var(--kat-2);
    padding-top: 0;
    padding-bottom: 0;
    overflow: hidden;
  }

  .ust-cubuk {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 8px 12px 0;
  }

  .govde {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 20px 20px;
    display: grid;
    grid-auto-rows: max-content;
    gap: 20px;
    align-content: start;
  }

  .baslik-kutu {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .baslik-metin {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .baslik-metin h2 {
    font-family: var(--baslik-tipi);
    font-size: 1.375rem;
    line-height: 1.25;
    font-weight: 600;
  }
  .ozet {
    font-size: .875rem;
    color: var(--yazi-2);
    line-height: 1.4;
  }

  .durum-alani {
    display: grid;
    justify-items: center;
    gap: 12px;
    padding: 32px 16px;
    text-align: center;
    color: var(--yazi-2);
    font-size: .9375rem;
  }
  .yeniden {
    width: auto;
    min-width: 140px;
  }

  .gruplar {
    display: grid;
    gap: 16px;
  }
  .grup {
    display: grid;
    gap: 8px;
  }
  .grup h3 {
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--yazi-2);
    padding: 0 4px;
  }
  .kart {
    background: var(--yuzey-1);
    border: 1px solid var(--kenar-ince);
    border-radius: 16px;
    overflow: hidden;
  }
  .satir-kapsam + .satir-kapsam {
    border-top: 1px solid var(--kenar-ince);
  }
  .satir {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    min-height: 56px;
  }

  .durum-kutu {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .durum-kutu.tamam {
    background: color-mix(in srgb, var(--cozum) 16%, var(--zemin));
    color: var(--cozum);
  }
  .durum-kutu.uyari {
    background: color-mix(in srgb, var(--bekliyor) 16%, var(--zemin));
    color: var(--bekliyor);
  }
  .durum-kutu.eksik {
    background: color-mix(in srgb, var(--hata) 16%, var(--zemin));
    color: var(--hata);
  }

  .satir-metin {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .satir-metin strong {
    font-size: .9375rem;
    font-weight: 500;
    line-height: 1.35;
    color: var(--yazi);
  }
  .satir-metin p {
    font-size: .8125rem;
    line-height: 1.4;
    color: var(--yazi-2);
  }

  .eylem-dugme {
    flex: none;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    background: var(--ton);
    color: var(--ton-ustu);
    font-size: .8125rem;
    font-weight: 600;
    white-space: nowrap;
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .eylem-dugme:not(:disabled):active {
    opacity: .82;
  }
  .eylem-dugme:disabled {
    opacity: .45;
  }

  .yardim-notu {
    margin: 0 14px 12px 56px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    font-size: .8125rem;
    line-height: 1.45;
    color: var(--yazi-2);
  }

  .altlik {
    flex: none;
    display: grid;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--kenar-ince);
  }
  .altlik.cift {
    grid-template-columns: 1fr 1fr;
  }
</style>
