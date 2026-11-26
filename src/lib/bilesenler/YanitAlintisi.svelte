<!--
  The quote at the top of a reply bubble: the replied-to person's name (accent), one line of their text and a thin accent bar on the left.
  Tapping it jumps to the original message (loads history when it is far back). While the backend is still fetching the original
  (`yukleniyor`) a calm placeholder shows instead of an empty box.
  Bir yanıt balonunun üstündeki alıntı: yanıtlanan kişinin adı (vurgu), metninden bir satır ve solda ince vurgu çubuğu. Dokunmak orijinal
  mesaja atlar (uzaktaysa geçmişi yükler). Arka uç orijinali hâlâ getirirken (`yukleniyor`) boş kutu yerine sakin bir yer tutucu görünür.
-->
<script lang="ts">
  import type { YanitBilgisi } from "../api/tipler";
  import { t } from "../i18n";

  let { yanit, git }: { yanit: YanitBilgisi; git: (olayId: string) => void } = $props();
</script>

<button class="alinti" onclick={() => git(yanit.olayId)} aria-label={t("yanit.git")}>
  {#if yanit.yukleniyor}
    <span class="metin soluk">{t("yanit.yukleniyor")}</span>
  {:else if yanit.gonderenAd || yanit.metin}
    {#if yanit.gonderenAd}<span class="ad">{yanit.gonderenAd}</span>{/if}
    <span class="metin">{yanit.metin ?? t("yanit.mesaj")}</span>
  {:else}
    <span class="metin soluk">{t("yanit.bulunamadi")}</span>
  {/if}
</button>

<style>
  .alinti {
    display: grid; gap: 1px; width: 100%; min-height: max(2.5em, 40px); margin: 0 0 .25em; padding: .25em .5em; text-align: left; border-radius: .5em;
    background: color-mix(in srgb, currentColor 10%, transparent); border-left: 3px solid var(--vurgu);
  }
  .ad { font-size: .75em; font-weight: 600; color: var(--vurgu); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metin { font-size: .8125em; line-height: 1.35; opacity: .85; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .soluk { font-style: italic; opacity: .65; }
</style>
