<!--
  The strip above the composer while replying ("<ad> kişisine yanıt") or editing ("Mesajı düzenle"): a short preview of the message and a ✕
  that cancels the mode. Pure presentation: the composer owns the state (durum/yazma.svelte.ts).
  Yanıtlarken ("<ad> kişisine yanıt") ya da düzenlerken ("Mesajı düzenle") yazma alanının üstündeki şerit: mesajın kısa önizlemesi ve kipi
  iptal eden ✕. Saf sunum: durum yazma alanında (durum/yazma.svelte.ts).
-->
<script lang="ts">
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { tur, ad = "", metin, iptal }: { tur: "yanit" | "duzenle"; ad?: string; metin: string; iptal: () => void } = $props();
</script>

<div class="serit">
  <span class="cubuk" aria-hidden="true"></span>
  <span class="ikon" aria-hidden="true"><Ikon ad={tur === "yanit" ? "yanitla" : "kalem"} boyut={18} /></span>
  <span class="govde">
    <span class="baslik">{tur === "yanit" ? t("yanit.kisiye", { ad }) : t("duzenle.baslik")}</span>
    <span class="metin">{metin}</span>
  </span>
  <button class="simge-dugme" onclick={iptal} aria-label={t("eylem.iptal")}><Ikon ad="kapat" boyut={20} /></button>
</div>

<style>
  .serit { display: flex; align-items: center; gap: 8px; padding: 4px 4px 0 12px; min-height: 52px; animation: serit-gel var(--sure-orta) var(--egri-ac); }
  @keyframes serit-gel { from { opacity: 0; transform: translateY(8px); } }
  .cubuk { width: 3px; align-self: stretch; margin: 6px 0; border-radius: 2px; background: var(--vurgu); flex: none; }
  .ikon { color: var(--vurgu); flex: none; display: inline-flex; }
  .govde { flex: 1; min-width: 0; display: grid; }
  .baslik { font-size: .75rem; font-weight: 600; color: var(--vurgu); }
  .metin { font-size: .875rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
