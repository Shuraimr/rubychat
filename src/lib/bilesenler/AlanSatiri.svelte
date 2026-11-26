<!--
  One row of the space screens: a joined room / space opens when tapped; a room that is not joined shows its name, topic and member
  count with a "Katıl" button instead (design: same 72px-ish row as the chat list, so spaces feel like the rest of the app).
  Alan ekranlarının bir satırı: katılınmış oda / alan dokununca açılır; katılınmamış oda adını, konusunu ve üye sayısını gösterir ve
  yerine "Katıl" düğmesi çıkar (tasarım: sohbet listesiyle aynı ~72px satır; alanlar uygulamanın gerisi gibi hissettirir).
-->
<script lang="ts">
  import type { AlanOgesi } from "../api/tipler";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    oge,
    ac,
    katil,
    katiliyor = false,
  }: {
    oge: AlanOgesi;
    /** Tap on the row · Satıra dokunma */
    ac: () => void;
    /** "Katıl" for a room that is not joined · Katılınmamış oda için "Katıl" */
    katil?: () => void;
    katiliyor?: boolean;
  } = $props();

  const bilgi = $derived(
    [oge.alan && oge.altSayisi > 0 ? t("alanlar.odaSayisi", { n: oge.altSayisi }) : null, oge.uyeSayisi > 0 ? t("oda.uyeler", { n: oge.uyeSayisi }) : null]
      .filter(Boolean)
      .join(" · "),
  );
  // Not joined and not a space: the row itself does nothing (only "Katıl" does); sub-spaces can always be opened to look inside.
  // Katılınmamış ve alan değil: satırın kendisi bir şey yapmaz (yalnızca "Katıl" yapar); alt alanlar içine bakmak için hep açılabilir.
  const acilabilir = $derived(oge.katildi || oge.alan);
</script>

<div class="satir" class:acilabilir>
  <button class="govde" data-dalga onclick={ac} disabled={!acilabilir} aria-label={oge.ad}>
    <Avatar harf={oge.avatarHarf} mxc={oge.avatarMxc} boyut={48} />
    <span class="orta">
      <span class="ust">
        <span class="ad">{oge.ad}</span>
        {#if oge.alan}<span class="etiket"><Ikon ad="izgara" boyut={12} />{t("alanlar.alan")}</span>{/if}
        {#if oge.onerilen}<span class="etiket oneri">{t("alanlar.onerilen")}</span>{/if}
      </span>
      {#if oge.konu}<span class="konu">{oge.konu}</span>{/if}
      {#if bilgi}<span class="bilgi">{bilgi}</span>{/if}
    </span>
    {#if acilabilir}<Ikon ad="sagOk" boyut={20} />{/if}
  </button>
  {#if !oge.katildi && katil}
    <button class="buton tonlu katil" onclick={katil} disabled={katiliyor}>{katiliyor ? t("alanlar.katiliyor") : t("alanlar.katil")}</button>
  {/if}
</div>

<style>
  .satir { content-visibility: auto; contain-intrinsic-size: auto var(--liste-satir-boy, 4.5rem); contain: layout style; display: flex; align-items: center; gap: 8px; padding-right: 16px; }
  .govde {
    flex: 1; min-width: 0; min-height: var(--liste-satir-boy, 4.5rem); padding: var(--liste-satir-py, .5rem) .5rem var(--liste-satir-py, .5rem) var(--liste-satir-px, 1rem); display: flex; align-items: center; gap: var(--liste-satir-ara, .75rem); text-align: left;
  }
  .govde:disabled { cursor: default; }
  .acilabilir .govde:active { background: var(--yuzey-2); }
  .govde :global(svg) { color: var(--yazi-2); flex: none; }
  .orta { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .ad { font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .etiket { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 6px; font-size: .6875rem; font-weight: 600; background: var(--ton); color: var(--ton-ustu); }
  .etiket.oneri { background: var(--yuzey-3); color: var(--yazi-2); }
  .konu { font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .bilgi { font-size: .75rem; color: var(--yazi-2); }
  .katil { flex: none; width: auto; min-width: 72px; padding: 0 16px; }
</style>
