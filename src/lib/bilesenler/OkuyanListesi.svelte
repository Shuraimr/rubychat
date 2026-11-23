<!--
  Sheet listing who has read up to a message (opened from the tiny read avatars). Tapping a person opens their user card.
  Bir mesaja kadar kimlerin okuduğunu listeleyen sayfa (minik okundu avatarlarından açılır). Bir kişiye dokunmak kullanıcı kartını açar.
-->
<script lang="ts">
  import type { KisiBilgisi } from "../api/tipler";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";

  let { kisiler, odaId, onkapat }: { kisiler: KisiBilgisi[]; odaId: string; onkapat: () => void } = $props();
</script>

<AltSayfa baslik={t("okundu.baslik")} {onkapat}>
  {#each kisiler as k (k.id)}
    <button class="kisi" data-dalga onclick={() => kullaniciKartiAc(k.id, odaId, k.ad, k.avatarMxc)}>
      <Avatar harf={k.ad.charAt(0).toUpperCase() || "#"} mxc={k.avatarMxc} boyut={40} />
      <span class="ad">{k.ad}</span>
    </button>
  {/each}
</AltSayfa>

<style>
  .kisi { min-height: 52px; display: flex; align-items: center; gap: 12px; text-align: left; border-radius: 12px; padding: 4px; transition: background var(--sure-hizli) var(--egri-cikis); }
  .kisi:active { background: var(--yuzey-3); }
  .ad { font-size: .9375rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
