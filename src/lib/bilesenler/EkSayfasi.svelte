<!--
  Attach sheet opened by the composer's "+" (design section 8): Galeri, Kamera, Dosya. Choosing one hands over to the full-screen media flow.
  Yazma alanındaki "+" ile açılan ek sayfası (tasarım bölüm 8): Galeri, Kamera, Dosya. Biri seçilince tam ekran medya akışına geçilir.
-->
<script lang="ts" module>
  export type EkKaynagi = "galeri" | "kamera" | "dosya";
</script>

<script lang="ts">
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";

  let { sec, onkapat }: { sec: (k: EkKaynagi) => void; onkapat: () => void } = $props();

  const ogeler: { id: EkKaynagi; ikon: IkonAdi; etiket: "ek.galeri" | "ek.kamera" | "ek.dosya" }[] = [
    { id: "galeri", ikon: "galeri", etiket: "ek.galeri" },
    { id: "kamera", ikon: "kamera", etiket: "ek.kamera" },
    { id: "dosya", ikon: "dosya", etiket: "ek.dosya" },
  ];
</script>

<AltSayfa baslik={t("ek.baslik")} {onkapat}>
  <div class="izgara">
    {#each ogeler as o (o.id)}
      <button class="oge" onclick={() => sec(o.id)}>
        <span class="kutu"><Ikon ad={o.ikon} boyut={24} /></span>
        <span class="etiket">{t(o.etiket)}</span>
      </button>
    {/each}
  </div>
</AltSayfa>

<style>
  .izgara { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-bottom: 8px; }
  .oge { min-height: 88px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border-radius: 16px; transition: background var(--sure-hizli) var(--egri-cikis); }
  .oge:active { background: var(--yuzey-3); }
  .kutu { width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; background: var(--ton); color: var(--ton-ustu); }
  .etiket { font-size: .8125rem; font-weight: 500; }
</style>
