<!--
  "İlet" sheet: pick the room a message is forwarded to (joined chats, not spaces, not the current one), with a search box. Choosing a
  room sends the copy at once and closes the sheet.
  "İlet" sayfası: mesajın iletileceği odayı seç (katılınmış sohbetler; alanlar ve şu anki oda hariç), arama kutusuyla. Bir odayı seçmek
  kopyayı hemen yollar ve sayfayı kapatır.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { mesajIlet } from "../api/komutlar";
  import type { ZamanOgesi } from "../api/tipler";
  import { androidMi } from "../arama-ec/ses";
  import { bildirim } from "../durum/bildirim.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { hataBildir } from "../mesaj/eylemler";
  import { masaustuLinux } from "../pano";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";

  let { oge, odaId, onkapat }: { oge: ZamanOgesi; odaId: string; onkapat: () => void } = $props();

  const masaustuMu = masaustuLinux || (!androidMi() && !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));
  let ara = $state("");
  let mesgul = $state(false);
  let secili = $state(0);
  let araEl: HTMLInputElement | undefined = $state();
  let listeEl: HTMLDivElement | undefined = $state();
  const adaylar = $derived.by(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    return odalar.liste.filter((o) => !o.davet && !o.alan && o.id !== odaId && (!q || o.ad.toLocaleLowerCase("tr").includes(q)));
  });

  $effect(() => {
    if (adaylar.length === 0 || secili >= adaylar.length) secili = 0;
  });
  $effect(() => {
    if (!masaustuMu || !listeEl) return;
    (listeEl.children[secili] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  });
  onMount(() => {
    if (!masaustuMu) return;
    // Focus the search field on desktop so the user can filter and press Enter to forward. · Masaüstünde kullanıcı süzüp Enter ile iletebilsin diye arama kutusunu odakla.
    requestAnimationFrame(() => araEl?.focus());
  });

  async function gonder(hedef: string, ad: string) {
    if (mesgul || !oge.olayId) return;
    mesgul = true;
    try {
      await mesajIlet(odaId, oge.olayId, hedef);
      bildirim.goster(t("ilet.iletildi", { ad }), 3000, { tur: "tamam" });
      onkapat();
    } catch (e) {
      hataBildir(e);
      mesgul = false;
    }
  }

  function tus(e: KeyboardEvent) {
    if (!masaustuMu || e.defaultPrevented || e.isComposing) return;
    if (e.key === "ArrowDown" && adaylar.length > 0) {
      e.preventDefault();
      secili = (secili + 1) % adaylar.length;
      return;
    }
    if (e.key === "ArrowUp" && adaylar.length > 0) {
      e.preventDefault();
      secili = (secili - 1 + adaylar.length) % adaylar.length;
      return;
    }
    if (e.key === "Enter" && tercihler.d.enterGonder && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
      const hedef = e.target as HTMLElement | null;
      // Focused room buttons handle Enter natively; avoid double-forwarding. · Odaklı oda düğmeleri Enter'ı kendisi işler; çift iletimi önle.
      if (hedef?.closest("button, a")) return;
      const o = adaylar[secili] ?? adaylar[0];
      if (!o) return;
      e.preventDefault();
      void gonder(o.id, o.ad);
    }
  }
</script>

<svelte:window onkeydown={tus} />

<AltSayfa baslik={t("ilet.baslik")} {onkapat}>
  <label class="alan-kutu"><input bind:this={araEl} bind:value={ara} placeholder={t("ilet.ara")} aria-label={t("ilet.ara")} /></label>
  <div class="liste" bind:this={listeEl}>
    {#each adaylar as o, i (o.id)}
      <button
        type="button"
        class="oda"
        class:secili={masaustuMu && i === secili}
        data-dalga
        disabled={mesgul}
        onpointerenter={(e) => { if (e.pointerType === "mouse") secili = i; }}
        onclick={() => void gonder(o.id, o.ad)}
      >
        <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={40} />
        <span class="ad">{o.ad}</span>
      </button>
    {:else}
      <p class="bos">{t("ilet.bos")}</p>
    {/each}
  </div>
</AltSayfa>

<style>
  .liste { display: grid; }
  .oda { min-height: 56px; display: flex; align-items: center; gap: 12px; text-align: left; border-radius: 12px; padding: 4px; transition: background var(--sure-hizli) var(--egri-cikis); }
  .oda.secili { background: var(--ton); color: var(--ton-ustu); }
  .oda:active { background: var(--yuzey-3); }
  .ad { font-size: .9375rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bos { text-align: center; padding: 16px; font-size: .875rem; color: var(--yazi-2); }
</style>
