<!--
  Thin one-line shortcut hint + Vim mode strip floating right above the composer while a message is selected.
  Outside normal flow so it never shifts the message list, never wraps (extra items clip), uses only CSS tokens and a short fade.
  Mesaj seçiliyken yazma alanının hemen üstünde yüzen ince tek satırlık kısayol ipucu + Vim kip şeridi.
  Normal akışın dışındadır (mesaj listesini hiç kaydırmaz), asla satır kırmaz (fazlası kırpılır), yalnızca renk değişkenleri ve kısa solma kullanır.
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
  /* Outside the composer flow (bottom: 100%) and below popovers (z-index: 1 vs 4), so it never shifts messages or covers @mentions. */
  /* Yazma alanı akışının dışında (bottom: 100%) ve açılır kartların altında (z-index: 1 vs 4); mesajları kaydırmaz, @bahsetmeyi örtmez. */
  .ipucu {
    position: absolute;
    z-index: 1;
    left: .75rem;
    right: .75rem;
    bottom: calc(100% + 4px);
    height: 1.75rem;
    padding: 0 .625rem 0 .375rem;
    border-radius: .75rem;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: .5rem;
    overflow: hidden;
    white-space: nowrap;
    pointer-events: none;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    color: var(--yazi-2);
    font-size: .75rem;
    line-height: 1;
    box-shadow: var(--kat-1);
  }
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
    background: var(--yuzey-3);
    color: var(--yazi);
    font-size: .6875rem;
    font-weight: 600;
    line-height: 1.1;
  }
</style>
