<!--
  "Grup oluştur" / "Alan oluştur" / "Adresle odaya katıl" sheet: one field, one button.
  "Grup oluştur" / "Alan oluştur" / "Adresle odaya katıl" sayfası: tek alan, tek düğme.
-->
<script lang="ts">
  import { alanaKatil, odaOlustur } from "../api/komutlar";
  import { alanlar } from "../durum/alanlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import AltSayfa from "./AltSayfa.svelte";

  let { tur, onkapat }: { tur: "grup" | "alan" | "katil"; onkapat: () => void } = $props();
  let deger = $state("");
  let mesgul = $state(false);
  let hata = $state<string | null>(null);

  async function gonder(e: SubmitEvent) {
    e.preventDefault();
    const d = deger.trim();
    hata = tur === "katil" ? (/^[#!][^\s]+$/.test(d) ? null : t("dock.adresGecersiz")) : d ? null : t("dock.adBos");
    if (hata) return;
    mesgul = true;
    try {
      // A room id needs a server to ask; an alias carries its own. · Oda kimliği sorulacak bir sunucu ister; takma ad kendininkini taşır.
      const via = d.startsWith("!") && d.includes(":") ? [d.slice(d.indexOf(":") + 1)] : [];
      const id = tur === "katil" ? await alanaKatil(d, via) : await odaOlustur(d, tur === "alan");
      onkapat();
      if (tur === "alan") {
        gezinme.sekmeSec("alanlar");
        alanlar.ac(id, d);
      } else gezinme.odaAc(id);
    } catch (err) {
      hataBildir(err);
    } finally {
      mesgul = false;
    }
  }
</script>

<AltSayfa baslik={t(`dock.${tur}`)} {onkapat}>
  <form class="form" onsubmit={gonder}>
    <p class="alt">{t(`dock.${tur}Alt`)}</p>
    <label class="alan">
      <span class="etiket">{tur === "katil" ? t("dock.adres") : t("dock.ad")}</span>
      <span class="alan-kutu" class:hatali={!!hata}><input bind:value={deger} maxlength="255" placeholder={tur === "katil" ? t("dock.adresYer") : ""} autocapitalize={tur === "katil" ? "off" : "sentences"} autocomplete="off" spellcheck="false" /></span>
      {#if hata}<span class="alan-hata" role="alert">{hata}</span>{/if}
    </label>
    <button class="buton birincil" type="submit" disabled={mesgul}>{#if mesgul}<span class="yuklenme"></span>{/if}{tur === "katil" ? t("dock.katilEylem") : t("dock.olustur")}</button>
  </form>
</AltSayfa>

<style>
  .form { display: grid; gap: 16px; }
  .alt { font-size: .875rem; color: var(--yazi-2); }
</style>
