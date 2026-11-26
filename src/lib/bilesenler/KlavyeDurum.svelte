<!--
  Compact Vim mode indicator (NORMAL / ARA / KOMUT), count prefix, pending leader ("g…") and the ":" mini command line.
  Mounted by klavyeBaslat() into document.body so it works across the whole app without touching App.svelte or YazmaAlani.svelte.
  Hides its passive pill whenever KisayolIpucu is visible (KisayolIpucu merges the mode badge into its strip), so nothing ever overlaps.
  Küçük Vim kip göstergesi (NORMAL / ARA / KOMUT), sayı öneki, bekleyen tuş ("g…") ve ":" küçük komut satırı.
  App.svelte veya YazmaAlani.svelte'e dokunmadan uygulama genelinde çalışsın diye klavyeBaslat() tarafından document.body'ye bağlanır.
  KisayolIpucu görünürken pasif hapı gizler (KisayolIpucu kip rozetini kendi şeridine alır); hiçbir şey üst üste binmez.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { sureMs } from "../hareket";
  import { t } from "../i18n";
  import { klavye, KOMUT_SATIRI, komutCalistir, type SatirKomutu } from "../klavyeKisayol.svelte";

  let komutAlan: HTMLInputElement | undefined = $state();
  let seciliOneri = $state(0);

  const katla = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");

  /** Matching command suggestions for the ":" mini command line · ":" komut satırı için eşleşen komut önerileri */
  const oneriler = $derived.by<readonly SatirKomutu[]>(() => {
    const ham = klavye.komutMetin.trimStart().replace(/^:+/, "");
    const ilk = katla(ham.split(/\s+/)[0] ?? "");
    if (!ilk) return KOMUT_SATIRI;
    return KOMUT_SATIRI.filter((k) => {
      if (katla(k.ad).startsWith(ilk)) return true;
      return k.takma?.some((a) => katla(a).startsWith(ilk)) ?? false;
    });
  });

  $effect(() => {
    void klavye.komutMetin;
    seciliOneri = 0;
  });

  $effect(() => {
    if (!klavye.komutAcik) return;
    void tick().then(() => komutAlan?.focus());
  });

  /** Show the passive mode pill when shortcuts are on, no modal/popover/command-bar/hint-strip is visible, and we are in NORMAL or ARA mode.
   *  Kısayollar açıkken, pencere/açılır kart/komut satırı/ipucu şeridi görünmüyorken ve NORMAL veya ARA kipindeyken pasif kip hapını göster. */
  const hapGorunur = $derived(
    !!oturum.ben &&
      tercihler.d.ctrlKisayol &&
      !klavye.komutAcik &&
      !klavye.ipucuGorunur &&
      !klavye.palet &&
      !klavye.yardim &&
      !klavye.katmanAcik &&
      (klavye.kip === "ara" ||
        (klavye.kip === "normal" && (!!klavye.oda || !!klavye.sayac || !!klavye.bekleyen))),
  );

  const kipEtiket = $derived(
    klavye.kip === "ara" ? t("klavye.kipAra") : klavye.kip === "komut" ? t("klavye.kipKomut") : t("klavye.kipNormal"),
  );

  function komutTus(e: KeyboardEvent) {
    if (e.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      klavye.komutKapat();
      return;
    }
    if (e.key === "Backspace" && klavye.komutMetin.length === 0) {
      e.preventDefault();
      klavye.komutKapat();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const o = oneriler[seciliOneri] ?? oneriler[0];
      if (o) klavye.komutMetin = o.ek ? `${o.ad} ` : o.ad;
      return;
    }
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "j")) {
      if (oneriler.length === 0) return;
      e.preventDefault();
      seciliOneri = (seciliOneri + 1) % oneriler.length;
      return;
    }
    if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      if (oneriler.length === 0) return;
      e.preventDefault();
      seciliOneri = (seciliOneri - 1 + oneriler.length) % oneriler.length;
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const ham = klavye.komutMetin.trim();
      if (!ham) {
        klavye.komutKapat();
        return;
      }
      komutCalistir(ham);
    }
  }

  /** Short opacity+translate entrance using --sure-hizli (0ms under reduced motion). · --sure-hizli ile kısa opaklık+kayma girişi (azaltılmış harekette 0ms). */
  function gecis(giris: boolean) {
    return (node: Element) => {
      const sure = sureMs("--sure-hizli");
      if (sure > 0) {
        node.animate(
          giris
            ? [
                { opacity: 0, transform: "translateY(4px)" },
                { opacity: 1, transform: "translateY(0)" },
              ]
            : [
                { opacity: 1, transform: "translateY(0)" },
                { opacity: 0, transform: "translateY(4px)" },
              ],
          { duration: sure, easing: "linear", fill: giris ? "backwards" : "forwards" },
        );
      }
      return { duration: sure };
    };
  }
  const gir = gecis(true);
  const cik = gecis(false);
</script>

{#if oturum.ben && klavye.komutAcik}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="komut-disari" onclick={() => klavye.komutKapat()}></div>
  <div class="komut-kutu" role="region" aria-label={t("klavye.komutEtiket")} in:gir out:cik>
    {#if oneriler.length > 0}
      <div class="oneriler" role="listbox" aria-label={t("klavye.grupKomut")}>
        {#each oneriler as o, i (o.ad)}
          <button
            type="button"
            class="oneri"
            class:secili={i === seciliOneri}
            role="option"
            aria-selected={i === seciliOneri}
            tabindex="-1"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => {
              if (o.ek) {
                klavye.komutMetin = `${o.ad} `;
                komutAlan?.focus();
              } else {
                komutCalistir(o.ad);
              }
            }}
          >
            <kbd>:{o.ad}{o.ek ?? ""}</kbd>
            <span>{t(o.etiket)}</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="komut-satir">
      <span class="rozet-kip komut">{t("klavye.kipKomut")}</span>
      <span class="iki-nokta" aria-hidden="true">:</span>
      <input
        bind:this={komutAlan}
        bind:value={klavye.komutMetin}
        onkeydown={komutTus}
        placeholder={t("klavye.komutYer")}
        aria-label={t("klavye.komutEtiket")}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <kbd class="esc-ipucu">Esc</kbd>
    </div>
    <p class="komut-alt">{t("klavye.komutIpucu")}</p>
  </div>
{:else if hapGorunur}
  <div class="kip-hap" aria-hidden="true" in:gir out:cik>
    <span class="rozet-kip" class:ara={klavye.kip === "ara"}>{kipEtiket}</span>
    {#if klavye.aramaAcik && klavye.aramaToplam > 0}
      <span class="meta">{klavye.aramaSira}/{klavye.aramaToplam}</span>
    {/if}
    {#if klavye.sayac || klavye.bekleyen}
      <span class="bekleyen">{klavye.sayac}{klavye.bekleyen ? `${klavye.bekleyen}…` : ""}</span>
    {/if}
    <span class="yardim-ipucu"><kbd>?</kbd></span>
  </div>
{/if}

<style>
  /* Compact passive mode pill: sits cleanly above --alt-yer at bottom-right so it never covers composer, search bar or toasts. */
  /* Küçük pasif kip hapı: yazma alanı, arama çubuğu veya bildirimleri örtmesin diye sağ altta --alt-yer üstünde durur. */
  .kip-hap {
    position: fixed;
    z-index: 20;
    right: 1rem;
    bottom: calc(max(var(--alt-yer), env(safe-area-inset-bottom)) + 8px);
    height: 1.75rem;
    padding: 0 .5rem 0 .25rem;
    border-radius: .75rem;
    display: inline-flex;
    align-items: center;
    gap: .375rem;
    pointer-events: none;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    color: var(--yazi-2);
    font-size: .75rem;
    line-height: 1;
    box-shadow: var(--kat-1);
    white-space: nowrap;
  }

  .rozet-kip {
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 .4375rem;
    border-radius: .5rem;
    background: var(--ton);
    color: var(--ton-ustu);
    font-family: var(--mono-tipi);
    font-size: .6875rem;
    font-weight: 700;
    letter-spacing: .04em;
  }
  .rozet-kip.ara {
    background: color-mix(in srgb, var(--bekliyor) 22%, var(--yuzey-2));
    color: var(--bekliyor);
  }
  .rozet-kip.komut {
    background: var(--vurgu);
    color: var(--vurgu-ustu);
  }

  .meta {
    font-family: var(--mono-tipi);
    font-size: .75rem;
    font-variant-numeric: tabular-nums;
    color: var(--yazi-2);
  }
  .bekleyen {
    padding: .125rem .375rem;
    border-radius: .375rem;
    background: var(--yuzey-3);
    color: var(--vurgu);
    font-family: var(--mono-tipi);
    font-size: .75rem;
    font-weight: 700;
  }
  .yardim-ipucu {
    display: inline-flex;
    align-items: center;
    opacity: .75;
  }
  .yardim-ipucu kbd,
  .esc-ipucu {
    padding: .125rem .3125rem;
    border-radius: .3125rem;
    background: var(--yuzey-3);
    color: var(--yazi-2);
    font-family: var(--mono-tipi);
    font-size: .6875rem;
    font-weight: 600;
    line-height: 1.1;
  }

  /* ":" mini command line · ":" küçük komut satırı */
  .komut-disari {
    position: fixed;
    inset: 0;
    z-index: 24;
  }
  .komut-kutu {
    position: fixed;
    z-index: 25;
    left: 50%;
    translate: -50% 0;
    bottom: calc(max(var(--alt-yer), env(safe-area-inset-bottom)) + 10px);
    width: min(29rem, calc(100vw - 1.5rem));
    border-radius: 1rem;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar);
    box-shadow: var(--kat-2);
    overflow: hidden;
  }
  .oneriler {
    display: grid;
    padding: 4px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .oneri {
    min-height: 2.25rem;
    padding: .25rem .625rem;
    border-radius: .625rem;
    display: flex;
    align-items: center;
    gap: .625rem;
    text-align: left;
    color: var(--yazi-2);
    font-size: .8125rem;
  }
  .oneri.secili {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .oneri kbd {
    flex: none;
    padding: .125rem .4375rem;
    border-radius: .375rem;
    background: var(--yuzey-3);
    color: var(--yazi);
    font-family: var(--mono-tipi);
    font-size: .75rem;
    font-weight: 600;
  }
  .oneri.secili kbd {
    background: color-mix(in srgb, var(--vurgu) 22%, var(--ton));
    color: var(--ton-ustu);
  }
  .oneri span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .komut-satir {
    display: flex;
    align-items: center;
    gap: .5rem;
    min-height: 2.875rem;
    padding: 0 .625rem;
  }
  .iki-nokta {
    flex: none;
    font-family: var(--mono-tipi);
    font-size: 1rem;
    font-weight: 700;
    color: var(--vurgu);
  }
  .komut-satir input {
    flex: 1;
    min-width: 0;
    height: 2.5rem;
    background: none;
    border: 0;
    outline: none;
    font-family: var(--mono-tipi);
    font-size: .9375rem;
    color: var(--yazi);
  }
  .komut-satir input::placeholder {
    color: var(--yazi-2);
    font-family: var(--yazi-tipi);
    font-size: .875rem;
  }
  .komut-alt {
    margin: 0;
    padding: .25rem .75rem .4375rem;
    border-top: 1px solid var(--kenar-ince);
    font-size: .6875rem;
    color: var(--yazi-2);
  }
</style>
