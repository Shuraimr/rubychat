<!--
  One node of the sanitized message HTML tree (see bicim/temizle.ts). Every allowed tag is written out here as normal Svelte markup, so
  nothing from the message ever reaches innerHTML. Links open the leaving-rubychat confirm, matrix.to user links become pills that open the
  user card, spoilers blur until tapped, custom emoji are small images from the `medya` scheme.
  Temizlenmiş mesaj HTML ağacının bir düğümü (bkz. bicim/temizle.ts). İzin verilen her etiket burada normal Svelte işaretlemesi olarak
  yazılıdır; böylece mesajdan hiçbir şey innerHTML'e ulaşmaz. Bağlantılar rubychat'ten ayrılma onayını açar, matrix.to kullanıcı
  bağlantıları kullanıcı kartını açan hap (pill) olur, spoiler dokunulana dek bulanıktır, özel emojiler `medya` şemasından küçük resimlerdir.
-->
<script lang="ts">
  import { duzMetin, type Dugum } from "../bicim/temizle";
  import { baglantiAc, baglantiBas } from "../durum/baglantiOnay.svelte";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { baglantiAc as matrisBaglantiAc } from "../durum/matrisBaglanti.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t } from "../i18n";
  import { gorselUrl } from "../medya";
  import BicimDugum from "./BicimDugum.svelte";

  let { d, odaId }: { d: Dugum; odaId?: string } = $props();

  let acik = $state(false);

  function pillAc(tur: "kullanici" | "oda", kimlik: string, ad: string, href?: string) {
    if (tur === "kullanici") {
      kullaniciKartiAc(kimlik, odaId, ad.replace(/^@/, "") || undefined);
      return;
    }
    // Room / space link: open joined rooms directly (including event jump) or preview unjoined ones in-app.
    // Oda / alan bağlantısı: katılınmış odaları doğrudan açar (olay atlamasıyla) ya da katılınmamışları uygulama içinde önizler.
    void matrisBaglantiAc(href ?? `https://matrix.to/#/${encodeURIComponent(kimlik)}`);
  }
</script>

{#snippet cocuklar(liste: Dugum[])}{#each liste as c, i (i)}<BicimDugum d={c} {odaId} />{/each}{/snippet}

{#if d.t === "m"}{d.v}
{:else if d.etiket === "br"}<br />
{:else if d.etiket === "strong"}<strong>{@render cocuklar(d.cocuk)}</strong>
{:else if d.etiket === "em"}<em>{@render cocuklar(d.cocuk)}</em>
{:else if d.etiket === "u"}<u>{@render cocuklar(d.cocuk)}</u>
{:else if d.etiket === "del"}<del>{@render cocuklar(d.cocuk)}</del>
{:else if d.etiket === "code"}<code>{@render cocuklar(d.cocuk)}</code>
{:else if d.etiket === "pre"}<pre>{@render cocuklar(d.cocuk)}</pre>
{:else if d.etiket === "blockquote"}<blockquote>{@render cocuklar(d.cocuk)}</blockquote>
{:else if d.etiket === "ul"}<ul>{@render cocuklar(d.cocuk)}</ul>
{:else if d.etiket === "ol"}<ol>{@render cocuklar(d.cocuk)}</ol>
{:else if d.etiket === "li"}<li>{@render cocuklar(d.cocuk)}</li>
{:else if d.etiket === "p"}<p>{@render cocuklar(d.cocuk)}</p>
{:else if d.etiket === "h1" || d.etiket === "h2" || d.etiket === "h3" || d.etiket === "h4" || d.etiket === "h5" || d.etiket === "h6"}<p class="baslik">{@render cocuklar(d.cocuk)}</p>
{:else if d.etiket === "spoiler"}
  <button class="spoiler" class:acik aria-label={acik ? undefined : t("bicim.spoiler")} onclick={() => (acik = !acik)}><span class="spoiler-ic">{@render cocuklar(d.cocuk)}</span></button>
{:else if d.etiket === "emoji"}
  <img class="ozel-emoji" src={gorselUrl(d.mxc, 32) ?? ""} alt={d.alt ?? ""} title={d.alt ?? ""} draggable="false" />
{:else if d.etiket === "a" && d.href}
  {#if d.pill}
    {@const pill = d.pill}
    <button
      class="pill"
      class:ben={pill.tur === "kullanici" && pill.kimlik === oturum.ben?.kullaniciId}
      type="button"
      onclick={() => pillAc(pill.tur, pill.kimlik, duzMetin(d.cocuk), d.href)}
    >{@render cocuklar(d.cocuk)}</button>
  {:else}
    {@const href = d.href}
    <button class="baglanti" use:baglantiBas={href} onclick={() => baglantiAc(href, duzMetin(d.cocuk))}>{@render cocuklar(d.cocuk)}</button>
  {/if}
{:else}{@render cocuklar(d.cocuk)}{/if}

<style>
  p { margin: 0; }
  p:not(:last-child) { margin-bottom: .5em; }
  .baslik { font-weight: 700; }
  pre { margin: .25em 0; padding: .4em .55em; border-radius: .5em; background: color-mix(in srgb, currentColor 12%, transparent); font-family: var(--mono-tipi); font-size: .875em; white-space: pre-wrap; overflow-x: auto; }
  code { font-family: var(--mono-tipi); font-size: .875em; padding: 0 4px; border-radius: 4px; background: color-mix(in srgb, currentColor 12%, transparent); }
  /* <code> inside <pre> is another component instance, so it needs a global selector · <pre> içindeki <code> başka bir bileşen örneğidir, bu yüzden global seçici ister */
  :global(.bicimli pre code) { padding: 0; background: none; }
  blockquote { margin: .25em 0; padding: 0 0 0 10px; border-left: 3px solid color-mix(in srgb, currentColor 40%, transparent); opacity: .9; }
  ul, ol { margin: .25em 0; padding-left: 1.4em; }
  .baglanti { display: inline; padding: 0; color: inherit; text-decoration: underline; text-underline-offset: 2px; font: inherit; text-align: left; overflow-wrap: anywhere; }
  .pill { display: inline; padding: 1px 6px; border-radius: 8px; font: inherit; font-weight: 600; text-align: left; overflow-wrap: anywhere; background: var(--ton); color: var(--ton-ustu); transition: opacity var(--sure-hizli) var(--egri-cikis); }
  .pill.ben { background: var(--vurgu); color: var(--vurgu-ustu); }
  .pill:active { opacity: .82; }
  /* Spoiler: solid tonal cover revealed via opacity only (no blur filter). · Spoiler: yalnızca opaklıkla açılan düz tonlu örtü (blur filtresi yok). */
  .spoiler { display: inline; padding: 0 4px; font: inherit; color: inherit; border-radius: 4px; text-align: left; background: color-mix(in srgb, var(--yazi) 22%, var(--yuzey-3)); }
  .spoiler-ic { opacity: 0; transition: opacity var(--sure-orta) var(--egri-cikis); }
  .spoiler.acik { background: color-mix(in srgb, currentColor 10%, transparent); }
  .spoiler.acik .spoiler-ic { opacity: 1; }
  .ozel-emoji { height: 1.5em; width: auto; max-width: 3em; vertical-align: middle; object-fit: contain; }
</style>
