<!--
  External link confirm sheet (mounted once in App.svelte): shows the full address, "Tarayıcıda aç" and "Bağlantıyı kopyala".
  Dış bağlantı onay sayfası (App.svelte'te bir kez bağlanır): tam adresi, "Tarayıcıda aç" ve "Bağlantıyı kopyala" düğmelerini gösterir.
-->
<script lang="ts">
  import { baglantiOnay } from "../durum/baglantiOnay.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Ikon from "./Ikon.svelte";

  const kapat = () => (baglantiOnay.url = null);
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(baglantiOnay.url ?? "");
      bildirim.goster(t("baglanti.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
    kapat();
  }
  function ac() {
    // noopener: the page we open must not get a handle to this window · noopener: açılan sayfa bu pencereye erişemesin
    window.open(baglantiOnay.url ?? "", "_blank", "noopener,noreferrer");
    kapat();
  }
</script>

{#if baglantiOnay.url}
  <AltSayfa baslik={t("baglanti.ayrilis")} onkapat={kapat}>
    <p class="alt">{t("baglanti.ayrilisAlt")}</p>
    <p class="adres">{baglantiOnay.url}</p>
    <div class="dugmeler">
      <button class="buton birincil" onclick={ac}><Ikon ad="yukari" boyut={18} />{t("baglanti.ac")}</button>
      <button class="buton tonlu" onclick={kopyala}><Ikon ad="kopya" boyut={18} />{t("baglanti.kopyala")}</button>
    </div>
  </AltSayfa>
{/if}

<style>
  .alt { font-size: .875rem; color: var(--yazi-2); }
  .adres { font-family: var(--mono-tipi); font-size: .8125rem; padding: 12px; border-radius: 12px; background: var(--yuzey-2); word-break: break-all; -webkit-user-select: text; user-select: text; }
  .dugmeler { display: grid; gap: 8px; }
</style>
