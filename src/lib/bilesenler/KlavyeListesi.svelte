<!--
  Grouped, searchable shortcut list driven by YARDIM_GRUPLARI / YARDIM_OGELERI.
  Used by both KlavyeYardim (? / Ctrl+/) and KlavyeAyarlari, clearly marking shortcuts that remain active when Vim/Ctrl shortcuts are off.
  YARDIM_GRUPLARI / YARDIM_OGELERI ile sürülen gruplu, aranabilir kısayol listesi.
  Hem KlavyeYardim (? / Ctrl+/) hem KlavyeAyarlari kullanır; Vim/Ctrl kısayolları kapalıyken de çalışanları açıkça işaretler.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t, type Anahtar } from "../i18n";
  import { YARDIM_GRUPLARI, YARDIM_OGELERI, type YardimGrubu, type YardimOgesi } from "../klavyeKisayol.svelte";
  import Ikon from "./Ikon.svelte";

  let { otoOdak = false }: { otoOdak?: boolean } = $props();

  let sorgu = $state("");
  let seciliGrup = $state<"tumu" | YardimGrubu>("tumu");
  let alan: HTMLInputElement | undefined = $state();

  const katla = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");

  onMount(() => {
    if (!otoOdak) return;
    // Focus after AltSayfa's own onMount focus so the user can type immediately after pressing "?". · "?" sonrası hemen yazılabilsin diye AltSayfa odağından sonra odakla.
    const kare = requestAnimationFrame(() => alan?.focus());
    return () => cancelAnimationFrame(kare);
  });

  const bolumler = $derived.by<{ id: YardimGrubu; ad: Anahtar; ogeler: YardimOgesi[] }[]>(() => {
    const aranan = katla(sorgu.trim());
    const sonuc: { id: YardimGrubu; ad: Anahtar; ogeler: YardimOgesi[] }[] = [];
    for (const g of YARDIM_GRUPLARI) {
      if (seciliGrup !== "tumu" && seciliGrup !== g.id) continue;
      const grupAdi = katla(t(g.ad));
      const ogeler = YARDIM_OGELERI.filter((o) => {
        if (o.grup !== g.id) return false;
        if (!aranan) return true;
        const etiket = katla(t(o.etiket));
        const tuslar = katla(o.tuslar.map((d) => d.join("+") + " " + d.join("")).join(" "));
        const ek = o.anahtarlar ? katla(o.anahtarlar) : "";
        const her = o.herZaman ? katla(t("klavye.herZamanRozet")) : "";
        return etiket.includes(aranan) || tuslar.includes(aranan) || grupAdi.includes(aranan) || ek.includes(aranan) || her.includes(aranan);
      });
      if (ogeler.length > 0) sonuc.push({ id: g.id, ad: g.ad, ogeler });
    }
    return sonuc;
  });
</script>

<div class="kap">
  <div class="ara-kutu">
    <Ikon ad="ara" boyut={18} />
    <input
      bind:this={alan}
      bind:value={sorgu}
      type="search"
      placeholder={t("klavye.araYer")}
      aria-label={t("klavye.araYer")}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
    {#if sorgu}
      <button type="button" class="temizle" aria-label={t("eylem.temizle")} onclick={() => { sorgu = ""; alan?.focus(); }}>
        <Ikon ad="kapat" boyut={16} />
      </button>
    {/if}
  </div>

  <div class="gruplar" role="tablist" aria-label={t("klavye.kisayollar")}>
    <button
      type="button"
      class="grup-hap"
      class:secili={seciliGrup === "tumu"}
      role="tab"
      aria-selected={seciliGrup === "tumu"}
      onclick={() => (seciliGrup = "tumu")}
    >
      {t("klavye.tumu")}
    </button>
    {#each YARDIM_GRUPLARI as g (g.id)}
      <button
        type="button"
        class="grup-hap"
        class:secili={seciliGrup === g.id}
        role="tab"
        aria-selected={seciliGrup === g.id}
        onclick={() => (seciliGrup = g.id)}
      >
        {t(g.ad)}
      </button>
    {/each}
  </div>

  <p class="durum-not" class:kapali={!tercihler.d.ctrlKisayol}>
    <Ikon ad="bilgi" boyut={16} />
    <span>{t(tercihler.d.ctrlKisayol ? "klavye.acikBilgi" : "klavye.kapaliUyari")}</span>
  </p>

  {#if bolumler.length === 0}
    <p class="bos">{t("klavye.araBos")}</p>
  {:else}
    <div class="liste">
      {#each bolumler as b (b.id)}
        <section>
          <h3>{t(b.ad)}</h3>
          <dl>
            {#each b.ogeler as o (o.id)}
              <div class="satir" class:pasif={!tercihler.d.ctrlKisayol && !o.herZaman}>
                <dt>
                  {#each o.tuslar as dizi, di (di)}
                    {#if di > 0}<span class="ayir" aria-hidden="true">/</span>{/if}
                    <span class="dizi">
                      {#each dizi as parca, pi (pi)}<kbd>{parca}</kbd>{/each}
                    </span>
                  {/each}
                </dt>
                <dd>
                  <span class="aciklama">{t(o.etiket)}</span>
                  {#if o.herZaman}<span class="her-rozet">{t("klavye.herZamanRozet")}</span>{/if}
                </dd>
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .kap {
    display: grid;
    gap: .75rem;
  }

  .ara-kutu {
    min-height: 2.75rem;
    padding: 0 .75rem;
    border-radius: .875rem;
    background: var(--yuzey-3);
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    gap: .5rem;
    color: var(--yazi-2);
  }
  .ara-kutu:focus-within {
    border-color: var(--vurgu);
  }
  .ara-kutu input {
    flex: 1;
    min-width: 0;
    min-height: 2.5rem;
    background: none;
    border: 0;
    outline: none;
    color: var(--yazi);
    font-size: .9375rem;
  }
  .ara-kutu input::placeholder {
    color: var(--yazi-2);
  }
  .temizle {
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--yazi-2);
  }

  .gruplar {
    display: flex;
    flex-wrap: nowrap;
    gap: .375rem;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .grup-hap {
    flex: none;
    min-height: 2rem;
    padding: 0 .75rem;
    border-radius: .75rem;
    background: var(--yuzey-3);
    color: var(--yazi-2);
    font-size: .8125rem;
    font-weight: 500;
  }
  .grup-hap.secili {
    background: var(--ton);
    color: var(--ton-ustu);
    font-weight: 600;
  }

  .durum-not {
    display: flex;
    align-items: flex-start;
    gap: .5rem;
    padding: .5rem .75rem;
    border-radius: .75rem;
    background: var(--yuzey-3);
    color: var(--yazi-2);
    font-size: .8125rem;
    line-height: 1.4;
  }
  .durum-not.kapali {
    background: color-mix(in srgb, var(--bekliyor) 14%, var(--yuzey-2));
    color: var(--yazi);
  }
  .durum-not :global(svg) {
    margin-top: 1px;
    color: var(--vurgu);
  }
  .durum-not.kapali :global(svg) {
    color: var(--bekliyor);
  }

  .liste {
    display: grid;
    gap: .875rem;
  }
  section {
    display: grid;
    gap: .25rem;
  }
  h3 {
    font-size: .8125rem;
    font-weight: 600;
    color: var(--vurgu);
    padding-bottom: .125rem;
  }
  dl {
    margin: 0;
    display: grid;
  }
  .satir {
    display: flex;
    align-items: center;
    gap: .75rem;
    min-height: 2.25rem;
    padding: .25rem 0;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .satir:last-child {
    border-bottom: 0;
  }
  .satir.pasif {
    opacity: .56;
  }
  dt {
    flex: none;
    width: 10.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .dizi {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .ayir {
    font-size: .75rem;
    color: var(--yazi-2);
    padding: 0 1px;
  }
  dd {
    margin: 0;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .375rem;
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .aciklama {
    min-width: 0;
  }
  .her-rozet {
    flex: none;
    padding: .125rem .4375rem;
    border-radius: .5rem;
    background: var(--ton);
    color: var(--ton-ustu);
    font-size: .6875rem;
    font-weight: 600;
    line-height: 1.3;
  }
  kbd {
    min-width: 1.45rem;
    padding: .125rem .375rem;
    border-radius: 6px;
    background: var(--yuzey-3);
    border: 1px solid var(--kenar-ince);
    color: var(--yazi);
    font-family: var(--mono-tipi);
    font-size: .75rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.25;
  }
  .bos {
    padding: 1.25rem .5rem;
    text-align: center;
    font-size: .875rem;
    color: var(--yazi-2);
  }
</style>
