<!--
  "Yeni sohbet" sheet: type a Matrix id, an encrypted DM is opened (the existing DM when there is one). Backend: `dm_ac`.
  "Yeni sohbet" sayfası: Matrix kimliği yaz, şifreli bir DM açılır (varsa mevcut DM). Arka uç: `dm_ac`.
-->
<script lang="ts">
  import { dmAc } from "../api/komutlar";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t, type Anahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";

  let { onkapat }: { onkapat: () => void } = $props();
  let kimlik = $state("");
  let mesgul = $state(false);
  let hata = $state<string | null>(null);

  async function baslat(e: SubmitEvent) {
    e.preventDefault();
    const k = kimlik.trim();
    if (!/^@[^:\s]+:[^\s]+$/.test(k)) {
      hata = t("yeniSohbet.gecersiz");
      return;
    }
    mesgul = true;
    hata = null;
    try {
      const id = await dmAc(k);
      onkapat();
      gezinme.odaAc(id);
    } catch (err) {
      bildirim.goster(t(`hata.${(err as { tur: string }).tur}` as Anahtar), 4000, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }
</script>

<AltSayfa baslik={t("yeniSohbet.baslik")} {onkapat}>
  <form class="form" onsubmit={baslat}>
    <p class="alt">{t("yeniSohbet.alt")}</p>
    <label class="alan">
      <span class="etiket">{t("yeniSohbet.alan")}</span>
      <span class="alan-kutu" class:hatali={!!hata}><input bind:value={kimlik} placeholder={t("yeniSohbet.yer")} autocapitalize="off" autocomplete="off" spellcheck="false" /></span>
      {#if hata}<span class="alan-hata" role="alert">{hata}</span>{/if}
    </label>
    <button class="buton birincil" type="submit" disabled={mesgul}>{#if mesgul}<span class="yuklenme"></span>{/if}{t("yeniSohbet.baslat")}</button>
  </form>
</AltSayfa>

<style>
  .form { display: grid; gap: 16px; }
  .alt { font-size: .875rem; color: var(--yazi-2); }
</style>
