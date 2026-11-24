<!--
  Requests layer: the full-screen "İstekler" page (incoming invitations, people asking to enter my rooms, my own pending requests)
  and the "ask to join" sheet. Lives at the root, so it opens over any page.
  İstekler katmanı: tam ekran "İstekler" sayfası (gelen davetler, odalarıma girmek isteyenler, kendi bekleyen isteklerim) ve
  "katılma isteği gönder" sayfası. Kökte durur; her sayfanın üstünde açılır.
-->
<script lang="ts">
  import { istekler, istekSayfasi } from "../durum/istekler.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import Istekler from "../ekranlar/Istekler.svelte";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import { bildirim } from "../durum/bildirim.svelte";
  import AltSayfa from "./AltSayfa.svelte";

  $effect(() => {
    odalar.liste;
    const z = setTimeout(() => void istekler.yenile(), 800);
    return () => clearTimeout(z);
  });
  $effect(() => () => istekler.sifirla());

  let sebep = $state("");
  let mesgul = $state(false);
  async function gonder(e: SubmitEvent) {
    e.preventDefault();
    const h = istekSayfasi.hedef;
    if (!h) return;
    mesgul = true;
    try {
      await istekler.iste(h.kimlik, h.via, sebep.trim() || null);
      bildirim.goster(t("istek.gonderildi"), 3500, { tur: "tamam" });
      istekSayfasi.hedef = null;
      sebep = "";
    } catch (err) {
      // "giris" = forbidden: this room takes no requests, only invitations. · "giris" = yasak: bu oda istek kabul etmiyor, yalnızca davet.
      if ((err as { tur?: string }).tur === "giris") bildirim.goster(t("istek.kapali"), 5000, { tur: "hata" });
      else hataBildir(err);
    } finally {
      mesgul = false;
    }
  }
</script>

{#if istekler.acik}<Istekler onkapat={() => (istekler.acik = false)} />{/if}

{#if istekSayfasi.hedef}
  <AltSayfa baslik={t("istek.gonderBaslik")} onkapat={() => (istekSayfasi.hedef = null)}>
    <form class="form" onsubmit={gonder}>
      <p>{t("istek.gonderAlt", { ad: istekSayfasi.hedef.ad })}</p>
      <label class="alan">
        <span class="etiket">{t("istek.not")}</span>
        <span class="alan-kutu"><input bind:value={sebep} maxlength="200" placeholder={t("istek.notYer")} /></span>
      </label>
      <button class="buton birincil" type="submit" disabled={mesgul}>{#if mesgul}<span class="yuklenme"></span>{/if}{t("istek.gonder")}</button>
    </form>
  </AltSayfa>
{/if}

<style>
  .form { display: grid; gap: 16px; }
  p { font-size: .875rem; color: var(--yazi-2); }
</style>
