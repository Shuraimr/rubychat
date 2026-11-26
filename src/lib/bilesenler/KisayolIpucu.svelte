<!--
  Thin one-line shortcut hint + Vim mode strip right under the composer while a message is selected.
  In flow, part of the measured composer height, never wraps (extra items clip), uses only CSS tokens and a short fade.
  Mesaj seçiliyken yazma alanının hemen altında duran ince tek satırlık kısayol ipucu + Vim kip şeridi.
  Akış içindedir (ölçülen yazma yüksekliğine dahil), asla satır kırmaz (fazlası kırpılır), yalnızca renk değişkenleri ve kısa solma kullanır.
-->
<script lang="ts">
  import type { ZamanOgesi } from "../api/tipler";
  import { sureMs } from "../hareket";
  import { t } from "../i18n";
  import { klavye, mesajKomutlari, type Komut } from "../klavyeKisayol.svelte";

  let { oge }: { oge: ZamanOgesi } = $props();

  const ogeler = $derived(mesajKomutlari(oge));
  const normalde = $derived(klavye.kip === "normal");
  const gorunur = $derived(ogeler.length > 0 && !klavye.komutAcik);

  // Tell KlavyeDurum when this strip is visible so it does not render a second mode pill. · İkinci bir kip hapı çizilmesin diye bu şeridin görünürlüğünü KlavyeDurum'a bildir.
  $effect(() => {
    klavye.ipucuGorunur = gorunur;
    return () => {
      klavye.ipucuGorunur = false;
    };
  });

  function etiket(k: Komut): string {
    if (k.id === "sabitle") return t(oge.sabit ? "klavye.iSabitKaldir" : "klavye.iSabitle");
    return t(k.ipucuEtiket ?? k.etiket);
  }

  function tusMetni(k: Komut): string {
    return normalde && k.vimKey ? k.vimKey : k.key;
  }

  /** Short opacity-only fade using --sure-hizli (0ms under reduced motion). · --sure-hizli ile yalnızca kısa opaklık solması (azaltılmış harekette 0ms). */
  function sol(giris: boolean) {
    return (node: Element) => {
      const sure = sureMs("--sure-hizli");
      if (sure > 0) {
        node.animate(giris ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
          duration: sure,
          easing: "linear",
          fill: giris ? "backwards" : "forwards",
        });
      }
      return { duration: sure };
    };
  }
  const gir = sol(true);
  const cik = sol(false);
</script>

{#if gorunur}
  <div class="ipucu" aria-hidden="true" in:gir out:cik>
    {#if normalde}
      <span class="kip">{t("klavye.kipNormal")}</span>
    {/if}
    {#if klavye.sayac || klavye.bekleyen}
      <span class="bekleyen">{klavye.sayac}{klavye.bekleyen ? `${klavye.bekleyen}…` : ""}</span>
    {/if}
    {#each ogeler as k (k.id)}
      <span class="oge"><kbd>{tusMetni(k)}</kbd><span>{etiket(k)}</span></span>
    {/each}
    <span class="oge"><kbd>Esc</kbd><span>{t("klavye.iSecimBirak")}</span></span>
  </div>
{/if}

<style>
  /* In flow right under the composer pill: a quiet caption row, no card, no shadow, aligned with the text inside the pill. */
  /* Yazma hapının hemen altında, akış içinde: sessiz bir alt yazı satırı; kart ya da gölge yok, hapın içindeki yazıyla hizalı. */
  .ipucu {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: .875rem;
    height: 1.5rem;
    margin-top: -.25rem;
    padding: 0 calc(.75rem + 3.75em) .375rem;
    overflow: hidden;
    white-space: nowrap;
    pointer-events: none;
    color: var(--yazi-2);
    font-size: .75rem;
    line-height: 1;
  }
  @media (max-width: 600px) { .ipucu { padding-left: .75rem; padding-right: .75rem; } }
  .kip {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 .4375rem;
    border-radius: .4375rem;
    background: var(--ton);
    color: var(--ton-ustu);
    font-family: var(--mono-tipi);
    font-size: .6875rem;
    font-weight: 700;
    letter-spacing: .04em;
  }
  .bekleyen {
    flex: none;
    padding: .125rem .375rem;
    border-radius: .375rem;
    background: var(--yuzey-3);
    color: var(--vurgu);
    font-family: var(--mono-tipi);
    font-size: .75rem;
    font-weight: 700;
  }
  .oge {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: .25rem;
    white-space: nowrap;
  }
  kbd {
    padding: .125rem .3125rem;
    border-radius: .3125rem;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    font-family: var(--mono-tipi);
    color: var(--yazi);
    font-size: .6875rem;
    font-weight: 600;
    line-height: 1.1;
  }
</style>
