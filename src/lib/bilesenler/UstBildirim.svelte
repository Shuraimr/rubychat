<!--
  In-app message banner, like the system's heads-up: avatar, room, sender, text. Tap opens the room; swiping up dismisses it.
  Uygulama içi mesaj şeridi, sistemin açılır bildirimi gibi: avatar, oda, gönderen, metin. Dokunmak odayı açar; yukarı kaydırmak kapatır.
-->
<script lang="ts">
  import { titret } from "../dokunma";
  import { gezinme } from "../durum/gezinme.svelte";
  import { ustBildirim } from "../durum/ustBildirim.svelte";
  import { ustCik, ustGir } from "../gecis";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";

  let basY = 0;
  let dy = $state(0);
  let basili = $state(false);
  const k = $derived(ustBildirim.kart);

  // The room got opened some other way: the banner has nothing more to say. · Oda başka yoldan açıldı: şeridin söyleyeceği kalmadı.
  $effect(() => {
    if (k && gezinme.acikOdaId === k.odaId) ustBildirim.kapat();
  });
  $effect(() => {
    k?.odaId;
    dy = 0;
    basili = false;
  });

  function asagi(e: PointerEvent) {
    basY = e.clientY;
    basili = true;
    ustBildirim.bekle();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function oyna(e: PointerEvent) {
    if (!basili) return;
    const f = e.clientY - basY;
    // Follows up 1:1, resists down. · Yukarı birebir izler, aşağı direnir.
    dy = f < 0 ? f : f / 6;
  }
  function birak(e: PointerEvent) {
    if (!basili) return;
    basili = false;
    if (e.type === "pointerup" && Math.abs(e.clientY - basY) < 8) {
      const id = k?.odaId;
      ustBildirim.kapat();
      if (id) gezinme.odaAc(id);
      return;
    }
    if (dy < -24) {
      titret("tik");
      ustBildirim.kapat();
      return;
    }
    dy = 0;
    ustBildirim.sur();
  }
</script>

{#if k}{#key k.odaId}
  <div class="yer" in:ustGir out:ustCik role="status">
    <button class="kart" class:basili data-bas="yok" style:transform="translateY({dy}px)" onpointerdown={asagi} onpointermove={oyna} onpointerup={birak} onpointercancel={birak} onclick={(e) => { if (e.detail === 0) { const id = k.odaId; ustBildirim.kapat(); gezinme.odaAc(id); } }}>
      <Avatar harf={(k.odaAd || k.gonderenAd).charAt(0).toUpperCase() || "#"} mxc={k.avatarMxc} boyut={44} />
      <span class="metin">
        <span class="ust"><strong>{k.odaAd || k.gonderenAd}</strong>{#if k.n > 1}<span class="rozet">{k.n}</span>{/if}</span>
        <span class="ileti">{#if k.odaAd && k.gonderenAd && k.odaAd !== k.gonderenAd}<b>{k.gonderenAd}:</b>{/if} {k.metin || t("ustBildirim.yeni")}</span>
      </span>
    </button>
  </div>
{/key}{/if}

<style>
  .yer { position: fixed; z-index: 48; top: calc(env(safe-area-inset-top) + .5rem); left: .75rem; right: .75rem; max-width: 30rem; margin: 0 auto; }
  .kart { position: relative; width: 100%; min-height: 4.5rem; padding: .75rem 1rem 1rem; display: flex; align-items: center; gap: .875rem; text-align: left; border-radius: 1.75rem; background: var(--yuzey-3); color: var(--yazi); box-shadow: var(--kat-2); touch-action: none; transition: transform var(--sure-orta) var(--egri-cikis); }
  .kart.basili { transition: none; }
  .kart::after { content: ""; position: absolute; left: 50%; bottom: .375rem; width: 2rem; height: 4px; margin-left: -1rem; border-radius: 2px; background: var(--kenar); }
  .metin { flex: 1; min-width: 0; display: grid; gap: .125rem; }
  .ust { display: flex; align-items: center; gap: .5rem; min-width: 0; }
  strong { min-width: 0; font-size: .9375rem; line-height: 1.3; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ileti { font-size: .875rem; line-height: 1.35; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  b { font-weight: 600; color: var(--yazi); }
</style>
