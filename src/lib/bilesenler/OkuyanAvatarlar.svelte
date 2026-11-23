<!--
  Tiny avatars of the people whose latest read receipt is on this message (small group rooms only; the backend sends none for big rooms or
  for me). At most 5 are drawn, the rest become "+N". Tapping opens the list of readers.
  Son okundu bilgisi bu mesajda olan kişilerin minik avatarları (yalnızca küçük grup odaları; arka uç büyük odalar ve ben için göndermez).
  En çok 5 tane çizilir, kalanı "+N" olur. Dokunmak okuyanların listesini açar.
-->
<script lang="ts">
  import type { KisiBilgisi } from "../api/tipler";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";

  let { kisiler, ac }: { kisiler: KisiBilgisi[]; ac: () => void } = $props();
  const gorunen = $derived(kisiler.slice(0, 5));
  const fazla = $derived(kisiler.length - gorunen.length);
</script>

{#if kisiler.length > 0}
  <button class="okuyanlar" onclick={ac} aria-label={t("okundu.kimler", { n: kisiler.length })}>
    {#each gorunen as k (k.id)}<Avatar harf={k.ad.charAt(0).toUpperCase() || "#"} mxc={k.avatarMxc} boyut={16} yaricap={5} />{/each}
    {#if fazla > 0}<span class="fazla">+{fazla}</span>{/if}
  </button>
{/if}

<style>
  /* 16px avatars inside a 44px-high hit area (negative margins keep the layout tight) · 44px yüksek dokunma alanı içinde 16px avatarlar (negatif kenar boşlukları düzeni sıkı tutar) */
  .okuyanlar { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; margin: -14px 0 -14px; padding: 0 2px; }
  .fazla { font-size: .6875rem; color: var(--yazi-2); padding-left: 2px; }
</style>
