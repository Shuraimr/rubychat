<!--
  The inside of a media bubble (designs 06 + 10): an image box (thumbnail first, full image in the viewer), a video poster with a play
  button and duration, or a file card; plus the caption and, for our own message that is still uploading, a progress overlay with a
  cancel cross. Tapping an image / video opens the full-screen viewer (Goruntuleyici). The bubble itself (colour, time, status) is
  drawn by MesajBalonu.
  Medya balonunun içi (06 + 10 tasarımları): resim kutusu (önce küçük resim, tam resim görüntüleyicide), oynat düğmeli ve süreli video
  posteri ya da dosya kartı; ayrıca açıklama ve hâlâ yüklenen kendi mesajımız için iptal çarpılı ilerleme katmanı. Resme / videoya
  dokunmak tam ekran görüntüleyiciyi (Goruntuleyici) açar. Balonun kendisini (renk, saat, durum) MesajBalonu çizer.
-->
<script lang="ts">
  import { yerel } from "../i18n";
  import { medyaGonderimiIptal, medyaKaydet } from "../api/komutlar";
  import type { ZamanOgesi } from "../api/tipler";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import Goruntuleyici from "./Goruntuleyici.svelte";
  import IlerlemeHalkasi from "./IlerlemeHalkasi.svelte";
  import { boyutYaz, m, sureYaz } from "./metin";
  import { medyaUrl } from "./url";

  let { oge }: { oge: ZamanOgesi } = $props();

  const md = $derived(oge.medya);
  const gorsel = $derived(md?.tur === "resim" || md?.tur === "video");
  // Thumbnail first; a plain image without one falls back to the file itself. · Önce küçük resim; küçük resmi olmayan düz resim dosyanın kendisine düşer.
  const kucukSrc = $derived(md ? (md.kucukId ? medyaUrl(md.kucukId) : md.tur === "resim" ? medyaUrl(md.kaynakId) : null) : null);

  // Box size: long side limited to 260 x 340 px, aspect ratio kept (unknown size = a calm landscape box).
  // Kutu boyutu: 260 x 340 px'e sığar, oran korunur (boyut bilinmiyorsa sakin bir yatay kutu).
  const kutu = $derived.by(() => {
    const g = md?.genislik ?? 0;
    const y = md?.yukseklik ?? 0;
    if (!g || !y) return { g: 260, y: 180 };
    const s = Math.min(260 / g, 340 / y);
    return { g: Math.max(120, Math.round(g * s)), y: Math.max(80, Math.round(y * s)) };
  });

  let yuklendi = $state(false);
  let hatali = $state(false);
  let gorAcik = $state(false);

  const oran = $derived(md?.ilerleme && md.ilerleme.toplam > 0 ? Math.min(1, md.ilerleme.gecerli / md.ilerleme.toplam) : null);
  const yukleniyor = $derived(!!md?.ilerleme);

  function iptalEt() {
    if (zaman.bilgi) void medyaGonderimiIptal(zaman.bilgi.id, oge.id).catch(() => {});
  }

  async function indir(e: Event) {
    e.stopPropagation();
    if (!md) return;
    try {
      const ad = await medyaKaydet(md.kaynakId);
      bildirim.goster(m("kaydedildi", { ad: ad.split("/").pop() ?? ad }), 3500, { tur: "tamam" });
    } catch {
      bildirim.goster(m("kaydedilemedi"), 4000, { tur: "hata" });
    }
  }
</script>

{#if md}
  {#if gorsel}
    <button
      type="button"
      class="kutu"
      style:width="{kutu.g}px"
      style:height="{kutu.y}px"
      onclick={() => (gorAcik = true)}
      aria-label={md.tur === "video" ? m("oynat") : m("gorsel")}
    >
      {#if kucukSrc && !hatali}
        <img src={kucukSrc} alt={md.dosyaAdi} class:hazir={yuklendi} class:bulanik={yukleniyor} draggable="false" onload={() => (yuklendi = true)} onerror={() => (hatali = true)} />
      {/if}
      {#if hatali}<span class="yedek"><Ikon ad="galeri" boyut={28} /></span>{/if}
      {#if md.tur === "video" && !yukleniyor}
        <span class="oynat"><Ikon ad="sagOk" boyut={26} /></span>
        {#if md.sureMs}<span class="sure">{sureYaz(md.sureMs / 1000)}</span>{/if}
      {/if}
      {#if yukleniyor}
        <span class="katman">
          <IlerlemeHalkasi {oran} iptal={iptalEt} />
          <span class="durum">
            {#if md.ilerleme && md.ilerleme.toplam > 0}
              {m("yukleniyor", {
                gecerli: (md.ilerleme.gecerli / 1048576).toLocaleString(yerel, { maximumFractionDigits: 2 }),
                toplam: (md.ilerleme.toplam / 1048576).toLocaleString(yerel, { maximumFractionDigits: 2 }),
              })}
            {:else}
              {m("yukleniyorKisa")}
            {/if}
          </span>
        </span>
      {/if}
    </button>
  {:else}
    <div class="dosya">
      <span class="dosya-ikon"><Ikon ad="dosya" boyut={24} /></span>
      <span class="dosya-metin">
        <span class="dosya-ad">{md.dosyaAdi}</span>
        <span class="dosya-alt">{md.boyut ? boyutYaz(md.boyut) : m("dosya")}</span>
      </span>
      {#if yukleniyor}
        <IlerlemeHalkasi {oran} iptal={iptalEt} />
      {:else}
        <button type="button" class="indir" onclick={indir} aria-label={m("indir")}><Ikon ad="asagi" boyut={20} /></button>
      {/if}
    </div>
  {/if}
  {#if oge.metin}<p class="aciklama">{oge.metin}</p>{/if}
  {#if gorAcik}<Goruntuleyici baslangicId={oge.id} onkapat={() => (gorAcik = false)} />{/if}
{:else if oge.metin}
  <span>{oge.metin}</span>
{/if}

<style>
  .kutu {
    position: relative;
    display: block;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-radius: 12px;
    overflow: hidden;
    background: var(--yuzey-3);
    color: var(--yazi);
    cursor: pointer;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity var(--sure-orta) var(--egri-cikis);
  }
  img.hazir {
    opacity: 1;
  }
  /* A local echo that is still uploading shows its picture dimmed and blurred, as in design 10 part 5 · Hâlâ yüklenen yerel yankı resmini kısık ve bulanık gösterir (10. tasarım 5. bölüm) */
  img.bulanik {
    filter: blur(6px) brightness(0.7);
  }
  .yedek {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--yazi-2);
  }
  .oynat {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--zemin);
    color: var(--yazi);
    opacity: 0.92;
  }
  .sure {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--zemin);
    color: var(--yazi);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .katman {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .durum {
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--zemin);
    color: var(--yazi);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .dosya {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
    max-width: 280px;
    min-height: 52px;
  }
  .dosya-ikon {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--yuzey-3);
    color: var(--vurgu);
  }
  .dosya-metin {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .dosya-ad {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .dosya-alt {
    font-size: 12px;
    color: var(--yazi-2);
  }
  .indir {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--yuzey-3);
    color: var(--yazi);
    cursor: pointer;
  }
  .aciklama {
    margin: 6px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
