<!--
  "İlet" sheet: pick the room a message is forwarded to (joined chats, not spaces, not the current one), with a search box. Choosing a
  room sends the copy at once and closes the sheet.
  "İlet" sayfası: mesajın iletileceği odayı seç (katılınmış sohbetler; alanlar ve şu anki oda hariç), arama kutusuyla. Bir odayı seçmek
  kopyayı hemen yollar ve sayfayı kapatır.
-->
<script lang="ts">
  import { mesajIlet } from "../api/komutlar";
  import type { ZamanOgesi } from "../api/tipler";
  import { bildirim } from "../durum/bildirim.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { hataBildir } from "../mesaj/eylemler";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";

  let { oge, odaId, onkapat }: { oge: ZamanOgesi; odaId: string; onkapat: () => void } = $props();

  let ara = $state("");
  let mesgul = $state(false);
  const adaylar = $derived.by(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    return odalar.liste.filter((o) => !o.davet && !o.alan && o.id !== odaId && (!q || o.ad.toLocaleLowerCase("tr").includes(q)));
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
</script>

<AltSayfa baslik={t("ilet.baslik")} {onkapat}>
  <label class="alan-kutu"><input bind:value={ara} placeholder={t("ilet.ara")} aria-label={t("ilet.ara")} /></label>
  <div class="liste">
    {#each adaylar as o (o.id)}
      <button class="oda" data-dalga disabled={mesgul} onclick={() => void gonder(o.id, o.ad)}>
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
  .oda:active { background: var(--yuzey-3); }
  .ad { font-size: .9375rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bos { text-align: center; padding: 16px; font-size: .875rem; color: var(--yazi-2); }
</style>
