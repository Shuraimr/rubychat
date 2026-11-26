<!--
  "Anket oluştur" sheet (composer "+" menu): a question, 2 to 10 options (each can be removed once there are more than two), and two
  switches: "Sonuçlar açık" (everyone sees the votes while voting) and "Birden çok seçim". Sends one `org.matrix.msc3381.poll.start`.
  "Anket oluştur" sayfası (yazma alanındaki "+" menüsü): bir soru, 2 ila 10 seçenek (ikiden fazlaysa her biri silinebilir) ve iki anahtar:
  "Sonuçlar açık" (oy verirken herkes oyları görür) ve "Birden çok seçim". Tek bir `org.matrix.msc3381.poll.start` yollar.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { anketOlustur } from "../api/komutlar";
  import { androidMi } from "../arama-ec/ses";
  import { bildirim } from "../durum/bildirim.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { hataBildir } from "../mesaj/eylemler";
  import { masaustuLinux } from "../pano";
  import { t } from "../i18n";
  import Anahtar from "./Anahtar.svelte";
  import AltSayfa from "./AltSayfa.svelte";
  import Ikon from "./Ikon.svelte";

  let { odaId, onkapat }: { odaId: string; onkapat: () => void } = $props();

  const EN_COK = 10;
  const masaustuMu = masaustuLinux || (!androidMi() && !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));
  let soru = $state("");
  let secenekler = $state(["", ""]);
  let acik = $state(false);
  let coklu = $state(false);
  let mesgul = $state(false);
  let soruEl: HTMLInputElement | undefined = $state();
  let secenekEl = $state<(HTMLInputElement | undefined)[]>([]);

  const dolu = $derived(secenekler.map((s) => s.trim()).filter(Boolean));
  const gecerli = $derived(soru.trim().length > 0 && dolu.length >= 2);

  onMount(() => {
    if (!masaustuMu) return;
    // Focus the question input on desktop after AltSayfa takes initial focus. · AltSayfa ilk odağı aldıktan sonra masaüstünde soru alanını odakla.
    requestAnimationFrame(() => soruEl?.focus());
  });

  async function gonder() {
    if (!gecerli || mesgul) return;
    mesgul = true;
    try {
      await anketOlustur({ odaId, soru: soru.trim(), secenekler: dolu, acik, coklu });
      bildirim.goster(t("anket.gonderildi"), 2500, { tur: "tamam" });
      onkapat();
    } catch (e) {
      hataBildir(e);
      mesgul = false;
    }
  }

  function tus(e: KeyboardEvent) {
    if (!masaustuMu || !tercihler.d.enterGonder || e.defaultPrevented || e.isComposing || e.repeat) return;
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const hedef = e.target as HTMLElement | null;
    if (hedef?.closest("button, a, textarea, select, [role='switch'], [role='checkbox'], [role='radio']")) return;
    e.preventDefault();
    if (gecerli) {
      void gonder();
      return;
    }
    // Not ready to send yet: guide focus to the first missing required field. · Henüz gönderilemiyorsa odağı eksik ilk zorunlu alana taşı.
    if (!soru.trim()) {
      soruEl?.focus();
      return;
    }
    const bos = secenekler.findIndex((s) => !s.trim());
    if (bos >= 0) secenekEl[bos]?.focus();
  }
</script>

<svelte:window onkeydown={tus} />

<AltSayfa baslik={t("anket.baslik")} {onkapat}>
  <label class="alan">
    <span class="etiket">{t("anket.soru")}</span>
    <span class="alan-kutu"><input bind:this={soruEl} bind:value={soru} maxlength="200" placeholder={t("anket.soruYer")} /></span>
  </label>
  <div class="alan">
    <span class="etiket">{t("anket.secenekler")}</span>
    {#each secenekler as _, i (i)}
      <span class="alan-kutu">
        <input bind:this={secenekEl[i]} bind:value={secenekler[i]} maxlength="100" placeholder={t("anket.secenekYer", { n: i + 1 })} aria-label={t("anket.secenekYer", { n: i + 1 })} />
        {#if secenekler.length > 2}
          <button type="button" class="simge-dugme" aria-label={t("anket.secenegiSil")} onclick={() => (secenekler = secenekler.filter((_, j) => j !== i))}><Ikon ad="kapat" boyut={18} /></button>
        {/if}
      </span>
    {/each}
    {#if secenekler.length < EN_COK}
      <button type="button" class="buton metin ekle" onclick={() => (secenekler = [...secenekler, ""])}><Ikon ad="artik" boyut={18} />{t("anket.secenekEkle")}</button>
    {/if}
  </div>
  <div class="satir"><span>{t("anket.acik")}</span><Anahtar acik={acik} degis={(v) => (acik = v)} etiket={t("anket.acik")} /></div>
  <div class="satir"><span>{t("anket.cokluSecim")}</span><Anahtar acik={coklu} degis={(v) => (coklu = v)} etiket={t("anket.cokluSecim")} /></div>
  <button type="button" class="buton birincil" onclick={() => void gonder()} disabled={!gecerli || mesgul}>{t("anket.gonder")}</button>
</AltSayfa>

<style>
  .satir { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .9375rem; }
  .ekle { justify-content: flex-start; width: auto; }
</style>
