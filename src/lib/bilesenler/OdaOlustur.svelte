<!--
  "Grup oluştur" / "Alan oluştur" / "Adresle odaya katıl" sheet: one field, one button.
  "Grup oluştur" / "Alan oluştur" / "Adresle odaya katıl" sayfası: tek alan, tek düğme.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { alanaKatil, odaOlustur } from "../api/komutlar";
  import { alanlar } from "../durum/alanlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekAc } from "../durum/istekler.svelte";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import AltSayfa from "./AltSayfa.svelte";

  let {
    tur,
    onkapat,
    gomulu = false,
  }: {
    tur: "grup" | "alan" | "katil";
    onkapat: () => void;
    /** Render only the form body without AltSayfa (used inside the desktop New menu card) · AltSayfa olmadan yalnızca form gövdesini çizer (masaüstü Yeni menüsü kartı içinde kullanılır) */
    gomulu?: boolean;
  } = $props();
  let deger = $state("");
  let mesgul = $state(false);
  let hata = $state<string | null>(null);
  let kapandi = false;
  onDestroy(() => {
    kapandi = true;
  });

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
      if (kapandi) return;
      onkapat();
      if (tur === "alan") {
        gezinme.sekmeSec("alanlar");
        alanlar.ac(id, d);
      } else gezinme.odaAc(id);
    } catch (err) {
      if (kapandi) return;
      // Not open to everyone: offer to ask for permission. · Herkese açık değil: izin istemeyi öner.
      if (tur === "katil" && (err as { tur?: string }).tur === "giris") {
        onkapat();
        istekAc({ kimlik: d, ad: d, via: d.startsWith("!") && d.includes(":") ? [d.slice(d.indexOf(":") + 1)] : [] });
      } else hataBildir(err);
    } finally {
      mesgul = false;
    }
  }
</script>

{#snippet govde()}
  <form class="form" onsubmit={gonder}>
    <p class="alt">{t(`dock.${tur}Alt`)}</p>
    <label class="alan">
      <span class="etiket">{tur === "katil" ? t("dock.adres") : t("dock.ad")}</span>
      <span class="alan-kutu" class:hatali={!!hata}><input bind:value={deger} maxlength="255" placeholder={tur === "katil" ? t("dock.adresYer") : ""} autocapitalize={tur === "katil" ? "off" : "sentences"} autocomplete="off" spellcheck="false" /></span>
      {#if hata}<span class="alan-hata" role="alert">{hata}</span>{/if}
    </label>
    <button class="buton birincil" type="submit" disabled={mesgul}>{#if mesgul}<span class="yuklenme"></span>{/if}{tur === "katil" ? t("dock.katilEylem") : t("dock.olustur")}</button>
  </form>
{/snippet}

{#if gomulu}
  {@render govde()}
{:else}
  <AltSayfa baslik={t(`dock.${tur}`)} {onkapat}>
    {@render govde()}
  </AltSayfa>
{/if}

<style>
  .form { display: grid; gap: 16px; }
  .alt { font-size: .875rem; color: var(--yazi-2); }
</style>
