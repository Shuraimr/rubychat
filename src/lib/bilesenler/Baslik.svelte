<!--
  Screen header: 56px, title on the left (or a back arrow + title on sub-pages), optional actions on the right.
  A bottom hairline appears once the content below has scrolled under it (`kenar`).
  Ekran başlığı: 56px, solda başlık (alt sayfalarda geri oku + başlık), sağda isteğe bağlı eylemler.
  Altındaki içerik kayınca alt kenar çizgisi belirir (`kenar`).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { baslik, geri, kenar = false, eylemler }: { baslik: string; geri?: () => void; kenar?: boolean; eylemler?: Snippet } = $props();
</script>

<header class="baslik" class:kenar>
  {#if geri}<button class="simge-dugme geri" onclick={geri} aria-label={t("oda.geri")}><Ikon ad="geri" /></button>{/if}
  <h1 class:alt={!!geri}>{baslik}</h1>
  {#if eylemler}<div class="eylemler">{@render eylemler()}</div>{/if}
</header>

<style>
  .baslik {
    flex: none; display: flex; align-items: center; gap: 4px; min-height: 4.25rem; box-sizing: content-box;
    padding: env(safe-area-inset-top) 12px 0 20px; border-bottom: 1px solid transparent;
    transition: border-color var(--sure-hizli) var(--egri-cikis);
  }
  .baslik.kenar { border-bottom-color: var(--kenar-ince); }
  .geri { margin-left: -12px; }
  h1 { flex: 1; min-width: 0; font-size: 1.625rem; line-height: 1.2; font-weight: 700; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  h1.alt { font-size: 1.25rem; line-height: 1.3; font-weight: 600; letter-spacing: 0; }
  .eylemler { display: flex; align-items: center; gap: 0; }
</style>
