<!--
  GIF tab of the picker: KLIPY search (debounced 400 ms) and trending (empty search). Tapping a result SENDS ITS LINK as a normal text message
  (the user approved "send as link"); the room then draws known KLIPY links inline (see MesajBalonu). No media is cached or proxied by us.
  Needs the user's own KLIPY API key (Ayarlar › Sohbet); without one the tab explains how to get it. "Powered by KLIPY" is shown at the bottom.
  Seçicinin GIF sekmesi: KLIPY araması (400 ms bekletmeli) ve trendler (boş arama). Sonuca dokunmak BAĞLANTISINI normal metin mesajı olarak
  GÖNDERİR (kullanıcı "bağlantı olarak gönder"i onayladı); oda bilinen KLIPY bağlantılarını satır içi çizer (bkz. MesajBalonu). Medyayı biz
  önbelleğe almaz / vekillemeyiz. Kullanıcının kendi KLIPY API anahtarı gerekir (Ayarlar › Sohbet); yoksa sekme nasıl alınacağını anlatır.
  Altta "Powered by KLIPY" gösterilir.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { androidMi } from "../arama-ec/ses";
  import { gifAra, type GifOgesi } from "../gif/klipy";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { masaustuLinux } from "../pano";
  import { t } from "../i18n";
  import Maskot from "./Maskot.svelte";

  let {
    sec,
    odak,
    acik = true,
  }: {
    sec: (url: string) => void;
    /** search field focus (the keyboard comes) · arama alanı odağı (klavye gelir) */
    odak?: (a: boolean) => void;
    /** Whether the surrounding picker is open (resets the double-send lock) · Çevreleyen seçici açık mı (çift gönderim kilidini sıfırlar) */
    acik?: boolean;
  } = $props();

  const masaustuMu = masaustuLinux || (!androidMi() && !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));
  let sorgu = $state("");
  let yuklenenSorgu = $state("");
  let ogeler = $state<GifOgesi[]>([]);
  let yukleniyor = $state(false);
  let hata = $state(false);
  let secili = $state(0);
  let aramada = $state(false);
  let gonderiliyor = $state(false);
  let izgaraEl: HTMLDivElement | undefined = $state();
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  let kilitZamanlayici: ReturnType<typeof setTimeout> | undefined;
  let istek = 0;
  const anahtar = $derived(tercihler.d.klipyAnahtar);

  $effect(() => {
    if (!acik) {
      gonderiliyor = false;
      clearTimeout(kilitZamanlayici);
    }
  });
  $effect(() => {
    if (ogeler.length === 0 || secili >= ogeler.length) secili = 0;
  });
  $effect(() => {
    if (!masaustuMu || !aramada || !izgaraEl) return;
    (izgaraEl.children[secili] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  });

  async function yukle() {
    if (!anahtar) return;
    const bu = ++istek;
    const aranan = sorgu.trim();
    yukleniyor = true;
    hata = false;
    try {
      const s = await gifAra(anahtar, aranan);
      if (bu === istek) {
        ogeler = s.ogeler;
        yuklenenSorgu = aranan;
        secili = 0;
      }
    } catch {
      if (bu === istek) hata = true;
    } finally {
      if (bu === istek) yukleniyor = false;
    }
  }
  onMount(() => void yukle());
  onDestroy(() => {
    clearTimeout(zamanlayici);
    clearTimeout(kilitZamanlayici);
  });
  function yazildi() {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => void yukle(), 400);
  }
  function gifYolla(g: GifOgesi) {
    if (gonderiliyor) return;
    gonderiliyor = true;
    clearTimeout(kilitZamanlayici);
    // Fallback unlock in case a caller keeps the picker open after sending. · Çağıran gönderdikten sonra seçiciyi açık tutarsa yedek kilit açma.
    kilitZamanlayici = setTimeout(() => (gonderiliyor = false), 600);
    sec(g.url);
  }
  function aramaTus(e: KeyboardEvent) {
    if (!masaustuMu || e.isComposing) return;
    if (e.key === "ArrowDown" && ogeler.length > 0) {
      e.preventDefault();
      secili = Math.min(ogeler.length - 1, secili + 2);
      return;
    }
    if (e.key === "ArrowUp" && ogeler.length > 0) {
      e.preventDefault();
      secili = Math.max(0, secili - 2);
      return;
    }
    if (e.key === "ArrowRight" && ogeler.length > 0 && (e.currentTarget as HTMLInputElement).selectionStart === sorgu.length) {
      e.preventDefault();
      secili = (secili + 1) % ogeler.length;
      return;
    }
    if (e.key === "ArrowLeft" && ogeler.length > 0 && (e.currentTarget as HTMLInputElement).selectionStart === 0) {
      e.preventDefault();
      secili = (secili - 1 + ogeler.length) % ogeler.length;
      return;
    }
    if (e.key === "Enter" && tercihler.d.enterGonder && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
      e.preventDefault();
      // Run pending search right away so Enter never sends a stale result from the previous query.
      // Bekleyen aramayı hemen çalıştır; Enter önceki sorgudan kalan bir GIF'i göndermesin.
      if (sorgu.trim() !== yuklenenSorgu) {
        clearTimeout(zamanlayici);
        void yukle();
        return;
      }
      const hedef = ogeler[secili] ?? ogeler[0];
      if (!yukleniyor && hedef) gifYolla(hedef);
    }
  }
</script>

{#if !anahtar}
  <div class="bos"><Maskot poz="selam" boyut={88} /><strong>{t("gif.anahtarGerekli")}</strong><p>{t("gif.anahtarNasil")}</p>
    <button type="button" class="buton tonlu" onclick={() => baglantiAc("https://partner.klipy.com")}>{t("gif.anahtarAl")}</button></div>
{:else}
  <div class="alan-kutu">
    <input
      type="search"
      bind:value={sorgu}
      oninput={yazildi}
      onkeydown={aramaTus}
      onfocus={() => { aramada = true; odak?.(true); }}
      onblur={() => { aramada = false; odak?.(false); }}
      placeholder={t("gif.araYer")}
      aria-label={t("gif.araYer")}
      autocomplete="off"
    />
  </div>
  {#if hata}
    <p class="bos-metin">{t("gif.hata")}</p>
  {:else if !yukleniyor && ogeler.length === 0}
    <p class="bos-metin">{t("gif.sonucYok")}</p>
  {:else}
    <div class="izgara" bind:this={izgaraEl} aria-busy={yukleniyor}>
      {#each ogeler as g, i (g.id)}
        <button
          type="button"
          class="gif"
          class:secili={masaustuMu && aramada && i === secili}
          disabled={gonderiliyor}
          onpointerenter={(e) => { if (e.pointerType === "mouse") secili = i; }}
          onclick={() => gifYolla(g)}
          aria-label={g.baslik || t("gif.gonder")}
        ><img src={g.onizleme} alt={g.baslik} loading="lazy" draggable="false" /></button>
      {/each}
    </div>
  {/if}
  <p class="atif">{t("gif.atif")}</p>
{/if}

<style>
  .izgara { display: grid; grid-template-columns: repeat(2, 1fr); gap: .375rem; padding-top: .5rem; }
  .gif { min-height: 5.5rem; border-radius: .75rem; overflow: hidden; background: var(--yuzey-2); }
  .gif.secili { outline: 2px solid var(--vurgu); outline-offset: 2px; }
  .gif img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bos { display: grid; justify-items: center; gap: .5rem; text-align: center; padding: 1rem; font-size: .875rem; color: var(--yazi-2); }
  .bos strong { color: var(--yazi); }
  .bos-metin { text-align: center; padding: 1.5rem; color: var(--yazi-2); font-size: .875rem; }
  .atif { text-align: center; font-size: .75rem; color: var(--yazi-2); }
</style>
