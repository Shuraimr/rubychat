<!--
  Our own media messages that are still being prepared (compressing / copying), drawn as right-aligned bubbles at the end of the room's
  timeline (design 10, part 5: "Sıkıştırılıyor %35" with a cancel cross). When Rust has queued the file the SDK's local echo takes over
  inside the timeline (MedyaIcerik shows the upload) and this entry disappears. Put <MedyaBekleyenler odaId=…/> after the message list.
  Henüz hazırlanan (sıkıştırılan / kopyalanan) kendi medya mesajlarımız; odanın zaman çizelgesinin sonunda sağa dayalı balonlar olarak çizilir
  (10. tasarım, 5. bölüm: iptal çarpılı "Sıkıştırılıyor %35"). Rust dosyayı sıraya alınca SDK'nın yerel yankısı zaman çizelgesinde devralır
  (yüklemeyi MedyaIcerik gösterir) ve bu kayıt kalkar. Mesaj listesinin ardına <MedyaBekleyenler odaId=…/> koy.
-->
<script lang="ts">
  import Ikon from "../bilesenler/Ikon.svelte";
  import { medya } from "../durum/medya.svelte";
  import IlerlemeHalkasi from "./IlerlemeHalkasi.svelte";
  import { m } from "./metin";

  let { odaId }: { odaId: string } = $props();
  const liste = $derived(medya.oda(odaId));

  function kutu(g: number | null, y: number | null): { g: number; y: number } {
    if (!g || !y) return { g: 220, y: 160 };
    const s = Math.min(260 / g, 340 / y);
    return { g: Math.max(120, Math.round(g * s)), y: Math.max(80, Math.round(y * s)) };
  }
</script>

{#each liste as b (b.yerelId)}
  {@const k = kutu(b.genislik, b.yukseklik)}
  <div class="satir">
    <div class="balon" style:width={b.tur === "dosya" ? undefined : `${k.g}px`}>
      <div class="gorsel" style:height={b.tur === "dosya" ? "72px" : `${k.y}px`}>
        {#if b.onizleme && b.tur !== "dosya"}
          {#if b.tur === "video"}
            <video src={b.onizleme} muted playsinline preload="metadata"></video>
          {:else}
            <img src={b.onizleme} alt="" draggable="false" />
          {/if}
        {:else}
          <span class="ikon"><Ikon ad="dosya" boyut={28} /></span>
        {/if}
        <span class="katman">
          {#if b.asama === "hata"}
            <button type="button" class="kapat" onclick={() => medya.kapat(b.yerelId)} aria-label={m("kapat")}><Ikon ad="kapat" /></button>
          {:else}
            <IlerlemeHalkasi oran={b.yuzde > 0 ? b.yuzde / 100 : null} iptal={() => medya.iptalEt(b.yerelId)} />
            <span class="durum">
              {b.asama === "sikistiriliyor" ? m("sikistiriliyor", { yuzde: b.yuzde }) : b.asama === "yukleniyor" ? m("yukleniyorKisa") : m("hazirlaniyorYuzde", { yuzde: b.yuzde })}
            </span>
          {/if}
        </span>
      </div>
    </div>
  </div>
{/each}

<style>
  .satir {
    display: flex;
    justify-content: flex-end;
    padding: 2px 12px;
  }
  .balon {
    max-width: 100%;
    min-width: 160px;
    padding: 4px;
    border-radius: 16px 16px 4px 16px;
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .gorsel {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: var(--yuzey-3);
  }
  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: blur(6px) brightness(0.7);
  }
  .ikon {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--yazi-2);
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
  .kapat {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--zemin);
    color: var(--hata);
    cursor: pointer;
  }
</style>
