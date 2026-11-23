<!--
  A received formatted message body (HTML) drawn safely: the HTML goes through the whitelist sanitizer (bicim/temizle.ts) and the resulting
  tree is rendered with normal Svelte markup (BicimDugum.svelte), never with {@html}.
  Alınan biçimli mesaj gövdesi (HTML), güvenle çizilir: HTML beyaz liste temizleyicisinden geçer (bicim/temizle.ts) ve çıkan ağaç normal
  Svelte işaretlemesiyle çizilir (BicimDugum.svelte), asla {@html} ile değil.
-->
<script lang="ts">
  import { temizle } from "../bicim/temizle";
  import BicimDugum from "./BicimDugum.svelte";

  let { html, odaId }: { html: string; odaId?: string } = $props();
  const agac = $derived(temizle(html));
</script>

<!-- Normal HTML whitespace rules here (the <br> and block tags carry the line breaks); <pre> keeps its own. · Burada normal HTML boşluk kuralları (satır sonlarını <br> ve blok etiketleri taşır); <pre> kendi kuralını korur. -->
<div class="bicimli">{#each agac as d, i (i)}<BicimDugum {d} {odaId} />{/each}</div>

<style>
  .bicimli { white-space: normal; display: inline; }
</style>
