<!--
  First-run onboarding tour (6 cards explaining Matrix). Shown once on a clean install before Giris, and replayable from Ben › About rubychat.
  Supports horizontal swipe, Next/Start button, Skip button and desktop keyboard arrows / Enter.
  Layouts: portrait phone (stacked), landscape phone <=500px height (mascot ~260px left, text & controls right), wide screen (centred 480px card).
  İlk kurulum tanıtım turu (Matrix'i anlatan 6 kart). Temiz kurulumda Giriş'ten önce bir kez gösterilir; Ben › rubychat hakkında'dan tekrar izlenebilir.
  Yatay kaydırma, İleri/Başla düğmesi, Geç düğmesi ve masaüstünde ok tuşları / Enter destekler.
  Düzenler: dikey telefon (alt alta), yatay telefon <=500px yükseklik (maskot solda ~260px, metin + düğmeler sağda), geniş ekran (ortada 480px pencere).
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { perdeCik, perdeGir } from "../gecis";
  import { t, type Anahtar } from "../i18n";
  import Maskot, { type MaskotPozu } from "./Maskot.svelte";

  let { onbitir, tekrar = false }: { onbitir: () => void; tekrar?: boolean } = $props();

  const KARTLAR: readonly { poz: MaskotPozu; baslik: Anahtar; metin: Anahtar }[] = [
    { poz: "selam", baslik: "tur.kart1Baslik", metin: "tur.kart1Metin" },
    { poz: "yukleniyor", baslik: "tur.kart2Baslik", metin: "tur.kart2Metin" },
    { poz: "arama", baslik: "tur.kart3Baslik", metin: "tur.kart3Metin" },
    { poz: "selam", baslik: "tur.kart4Baslik", metin: "tur.kart4Metin" },
    { poz: "kilit", baslik: "tur.kart5Baslik", metin: "tur.kart5Metin" },
    { poz: "arama", baslik: "tur.kart6Baslik", metin: "tur.kart6Metin" },
  ];

  let adim = $state(0);
  let surukleX = $state(0);
  let surukleniyor = $state(false);
  let katmanId = 0;

  // Pointer drag tracking · Parmakla sürükleme izleme
  let aktif = false;
  let kilitli = false;
  let basX = 0;
  let basY = 0;
  let sonX = 0;
  let sonT = 0;
  let hiz = 0;

  const sonMu = $derived(adim === KARTLAR.length - 1);

  function ileri() {
    if (sonMu) onbitir();
    else adim += 1;
  }

  function geri() {
    if (adim > 0) adim -= 1;
  }

  function basla(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    aktif = true;
    kilitli = false;
    basX = e.clientX;
    basY = e.clientY;
    sonX = e.clientX;
    sonT = performance.now();
    hiz = 0;
  }

  function hareket(e: PointerEvent) {
    if (!aktif) return;
    const dx = e.clientX - basX;
    const dy = e.clientY - basY;
    if (!kilitli) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        aktif = false;
        return;
      }
      if (Math.abs(dx) < 10) return;
      kilitli = true;
      surukleniyor = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore · yoksay */
      }
    }
    const simdi = performance.now();
    if (simdi > sonT) hiz = (e.clientX - sonX) / (simdi - sonT);
    sonX = e.clientX;
    sonT = simdi;
    // Soft resistance at both ends · İki uçta yumuşak direnç
    const sinirda = (adim === 0 && dx > 0) || (sonMu && dx < 0);
    surukleX = sinirda ? dx * 0.25 : dx;
  }

  function birak() {
    if (!aktif) return;
    aktif = false;
    if (!kilitli) return;
    kilitli = false;
    surukleniyor = false;
    const dx = surukleX;
    surukleX = 0;
    if ((dx < -50 || (hiz < -0.4 && dx < -20)) && !sonMu) adim += 1;
    else if ((dx > 50 || (hiz > 0.4 && dx > 20)) && adim > 0) adim -= 1;
  }

  onMount(() => {
    if (tekrar) {
      katmanId = gezinme.katmanAc(() => onbitir());
    }
    const tus = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!sonMu) adim += 1;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        geri();
      } else if (e.key === "Enter") {
        // Avoid double activation if a button already has focus. · Zaten bir düğme odaktaysa çift tetikleme yapma.
        if (document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        ileri();
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  });

  onDestroy(() => {
    if (katmanId) gezinme.katmanBirak(katmanId);
  });
</script>

<div
  class="tur-kap"
  class:tekrar
  role={tekrar ? "dialog" : "region"}
  aria-modal={tekrar ? "true" : undefined}
  aria-label={t("tur.sayfa", { n: adim + 1, toplam: KARTLAR.length })}
  in:perdeGir
  out:perdeCik
>
  <div class="tur-pencere">
    <div class="ust">
      <button class="gec" type="button" onclick={onbitir}>{t("tur.gec")}</button>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="gorunum"
      onpointerdown={basla}
      onpointermove={hareket}
      onpointerup={birak}
      onpointercancel={birak}
    >
      <div
        class="ray"
        class:suruklenen={surukleniyor}
        style:transform="translate3d(calc({-adim * 100}% + {surukleX}px), 0, 0)"
      >
        {#each KARTLAR as kart, i (kart.baslik)}
          <section class="kart" aria-hidden={i !== adim}>
            <div class="maskot-alani">
              <Maskot poz={kart.poz} boyut={164} />
            </div>
            <div class="metin-alani">
              <h1>{t(kart.baslik)}</h1>
              <p>{t(kart.metin)}</p>
            </div>
          </section>
        {/each}
      </div>
    </div>

    <div class="alt">
      <div class="noktalar" role="tablist" aria-label={t("tur.sayfa", { n: adim + 1, toplam: KARTLAR.length })}>
        {#each KARTLAR as k, i (k.baslik)}
          <button
            class="nokta"
            class:etkin={i === adim}
            type="button"
            role="tab"
            aria-selected={i === adim}
            aria-label={t("tur.sayfa", { n: i + 1, toplam: KARTLAR.length })}
            onclick={() => (adim = i)}
          >
            <span class="nokta-ic" aria-hidden="true"></span>
          </button>
        {/each}
      </div>
      <button class="buton birincil" type="button" onclick={ileri}>
        {sonMu ? t("tur.basla") : t("tur.ileri")}
      </button>
    </div>
  </div>
</div>

<style>
  .tur-kap {
    position: fixed;
    inset: 0;
    z-index: 35;
    background: var(--zemin);
    color: var(--yazi);
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tur-kap.tekrar {
    background: color-mix(in srgb, var(--zemin) 92%, transparent);
  }

  .tur-pencere {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .ust {
    flex: none;
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px 0;
  }
  .gec {
    min-height: 44px;
    min-width: 44px;
    padding: 0 14px;
    border-radius: 12px;
    font-size: .9375rem;
    font-weight: 600;
    color: var(--yazi-2);
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  @media (hover: hover) {
    .gec:hover {
      background: var(--yuzey-2);
      color: var(--yazi);
    }
  }
  .gec:active {
    background: var(--yuzey-3);
  }

  .gorunum {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    touch-action: pan-y;
    display: flex;
  }
  .ray {
    display: flex;
    width: 100%;
    height: 100%;
    transition: transform var(--sure-ekran) var(--egri-ac);
  }
  .ray.suruklenen {
    transition: none;
  }

  .kart {
    flex: 0 0 100%;
    width: 100%;
    min-width: 0;
    padding: 16px 28px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    text-align: center;
  }
  .maskot-alani {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .metin-alani {
    max-width: 380px;
    display: grid;
    gap: 12px;
  }
  .metin-alani h1 {
    font-family: var(--baslik-tipi);
    font-size: 1.5rem;
    line-height: 1.25;
    font-weight: 600;
    color: var(--yazi);
  }
  .metin-alani p {
    font-size: .9375rem;
    line-height: 1.5;
    color: var(--yazi-2);
  }

  .alt {
    flex: none;
    padding: 8px 24px 20px;
    display: grid;
    gap: 14px;
  }

  .noktalar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .nokta {
    min-height: 44px;
    min-width: 28px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nokta-ic {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--kenar);
  }
  .nokta.etkin .nokta-ic {
    width: 20px;
    background: var(--vurgu);
  }

  /* Landscape phone (small height): mascot on the left (~260px), text & controls on the right. */
  /* Yatay telefon (yükseklik küçük): maskot solda (~260px), metin + düğmeler sağda. */
  @media (max-height: 500px) {
    .ust {
      padding: 4px 12px 0;
    }
    .kart {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
      gap: 20px;
      padding: 4px 24px;
    }
    .maskot-alani {
      flex: 0 0 min(260px, 38%);
    }
    .maskot-alani :global(.maskot) {
      width: 128px !important;
      height: 128px !important;
    }
    .metin-alani {
      flex: 1;
      max-width: none;
      gap: 8px;
    }
    .metin-alani h1 {
      font-size: 1.25rem;
    }
    .metin-alani p {
      font-size: .875rem;
    }
    .alt {
      margin-left: calc(min(260px, 38%) + 20px);
      padding: 4px 24px 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .alt .buton {
      width: auto;
      min-width: 140px;
    }
    .noktalar {
      justify-content: flex-start;
    }
  }

  /* Wide screen: centred 480px card window. · Geniş ekran: ekran ortasında 480px pencere. */
  @media (min-width: 768px) and (min-height: 501px) {
    .tur-kap {
      align-items: center;
      padding: 24px;
    }
    .tur-pencere {
      width: min(480px, 100%);
      height: auto;
      min-height: 520px;
      max-height: min(640px, 100%);
      background: var(--yuzey-1);
      border: 1px solid var(--kenar-ince);
      border-radius: 1.75rem;
      box-shadow: var(--kat-2);
    }
  }
</style>
