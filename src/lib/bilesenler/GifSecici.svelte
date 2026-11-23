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
  import { gifAra, type GifOgesi } from "../gif/klipy";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";
  import Maskot from "./Maskot.svelte";

  let { sec, odak }: { sec: (url: string) => void; /** search field focus (the keyboard comes) · arama alanı odağı (klavye gelir) */ odak?: (a: boolean) => void } = $props();
  let sorgu = $state("");
  let ogeler = $state<GifOgesi[]>([]);
  let yukleniyor = $state(false);
  let hata = $state(false);
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  let istek = 0;
  const anahtar = $derived(tercihler.d.klipyAnahtar);

  async function yukle() {
    if (!anahtar) return;
    const bu = ++istek;
    yukleniyor = true;
    hata = false;
    try {
      const s = await gifAra(anahtar, sorgu);
      if (bu === istek) ogeler = s.ogeler;
    } catch {
      if (bu === istek) hata = true;
    } finally {
      if (bu === istek) yukleniyor = false;
    }
  }
  onMount(() => void yukle());
  onDestroy(() => clearTimeout(zamanlayici));
  function yazildi() {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => void yukle(), 400);
  }
</script>

{#if !anahtar}
  <div class="bos"><Maskot poz="selam" boyut={88} /><strong>{t("gif.anahtarGerekli")}</strong><p>{t("gif.anahtarNasil")}</p>
    <button class="buton tonlu" onclick={() => baglantiAc("https://partner.klipy.com")}>{t("gif.anahtarAl")}</button></div>
{:else}
  <div class="alan-kutu"><input type="search" bind:value={sorgu} oninput={yazildi} onfocus={() => odak?.(true)} onblur={() => odak?.(false)} placeholder={t("gif.araYer")} aria-label={t("gif.araYer")} autocomplete="off" /></div>
  {#if hata}
    <p class="bos-metin">{t("gif.hata")}</p>
  {:else if !yukleniyor && ogeler.length === 0}
    <p class="bos-metin">{t("gif.sonucYok")}</p>
  {:else}
    <div class="izgara" aria-busy={yukleniyor}>
      {#each ogeler as g (g.id)}
        <button class="gif" onclick={() => sec(g.url)} aria-label={g.baslik || t("gif.gonder")}><img src={g.onizleme} alt={g.baslik} loading="lazy" draggable="false" /></button>
      {/each}
    </div>
  {/if}
  <p class="atif">{t("gif.atif")}</p>
{/if}

<style>
  .izgara { display: grid; grid-template-columns: repeat(2, 1fr); gap: .375rem; padding-top: .5rem; }
  .gif { min-height: 5.5rem; border-radius: .75rem; overflow: hidden; background: var(--yuzey-2); }
  .gif img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bos { display: grid; justify-items: center; gap: .5rem; text-align: center; padding: 1rem; font-size: .875rem; color: var(--yazi-2); }
  .bos strong { color: var(--yazi); }
  .bos-metin { text-align: center; padding: 1.5rem; color: var(--yazi-2); font-size: .875rem; }
  .atif { text-align: center; font-size: .75rem; color: var(--yazi-2); }
</style>
