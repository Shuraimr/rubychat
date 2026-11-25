<!--
  Ctrl+Space: jump to a room by typing. Recently opened rooms come first and the current one last, so Ctrl+Space + Enter returns to the previous room.
  Ctrl+Space: yazarak odaya atla. Son açılanlar önce, bulunulan oda en sonda gelir; Ctrl+Space + Enter önceki odaya döner.
-->
<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { menuGir, perdeGir } from "../gecis";
  import { t } from "../i18n";
  import { klavye } from "../klavyeKisayol.svelte";
  import { goreliZaman } from "../zaman-bicim";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let sorgu = $state("");
  let sira = $state(0);
  let alan: HTMLInputElement | undefined = $state();
  let liste: HTMLDivElement | undefined = $state();
  let katman = 0;
  // Frozen at opening: a new message must not move the rows under the finger. · Açılışta dondurulur: yeni mesaj satırları oynatmamalı.
  const ziyaret = [...klavye.ziyaret];

  onMount(() => {
    katman = gezinme.katmanAc(() => {
      klavye.palet = false;
    });
    alan?.focus();
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  const katla = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");
  /** Smaller = better, -1 = no match: start, word start, inside, letters in order · Küçük = iyi, -1 = yok: baş, kelime başı, içinde, harfler sırayla */
  function puan(ad: string, s: string): number {
    if (!s) return 0;
    const a = katla(ad);
    if (a.startsWith(s)) return 0;
    if (a.includes(` ${s}`)) return 1;
    if (a.includes(s)) return 2;
    let i = 0;
    for (const h of a) if (h === s[i]) i++;
    return i >= s.length ? 3 : -1;
  }
  const sonuc = $derived.by(() => {
    const s = katla(sorgu.trim());
    const yeni = (id: string) => {
      if (id === gezinme.acikOdaId) return 1e6;
      const i = ziyaret.indexOf(id);
      return i < 0 ? 1e5 : i;
    };
    return odalar.liste
      .filter((o) => !o.davet && !o.alan)
      .map((o) => ({ o, p: puan(o.ad, s), y: yeni(o.id) }))
      .filter((x) => x.p >= 0)
      .sort((a, b) => a.p - b.p || a.y - b.y || (b.o.sonZaman ?? 0) - (a.o.sonZaman ?? 0))
      .slice(0, 30)
      .map((x) => x.o);
  });
  $effect(() => {
    void sorgu;
    sira = 0;
  });

  async function git(id: string) {
    gezinme.katmanKapat(katman);
    gezinme.odaAc(id);
    if (tercihler.d.vim) return;
    // Without vim keys the next thing is writing. · Vim tuşları yoksa sıradaki iş yazmaktır.
    await tick();
    setTimeout(() => document.querySelector<HTMLElement>(".yazma textarea")?.focus(), 50);
  }
  function tus(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    const yon = k === "arrowdown" || (e.ctrlKey && (k === "j" || k === "n")) ? 1 : k === "arrowup" || (e.ctrlKey && (k === "k" || k === "p")) ? -1 : k === "tab" ? (e.shiftKey ? -1 : 1) : 0;
    if (yon) {
      e.preventDefault();
      e.stopPropagation();
      if (sonuc.length) sira = (sira + yon + sonuc.length) % sonuc.length;
      void tick().then(() => liste?.querySelector(".secili")?.scrollIntoView({ block: "nearest" }));
    } else if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      if (sonuc[sira]) void git(sonuc[sira].id);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => gezinme.katmanKapat(katman)} in:perdeGir></div>
<div class="palet" role="dialog" aria-modal="true" aria-label={t("klavye.kPalet")} in:menuGir>
  <div class="alan">
    <Ikon ad="ara" boyut={20} />
    <input bind:this={alan} bind:value={sorgu} onkeydown={tus} placeholder={t("klavye.paletYer")} aria-label={t("klavye.paletYer")} role="combobox" aria-expanded="true" aria-controls="palet-liste" aria-activedescendant={sonuc[sira] ? `palet-${sira}` : undefined} autocomplete="off" spellcheck="false" />
    <kbd>Esc</kbd>
  </div>
  <div class="liste" id="palet-liste" role="listbox" bind:this={liste}>
    {#each sonuc as o, i (o.id)}
      <button class="oda" class:secili={i === sira} id="palet-{i}" role="option" aria-selected={i === sira} tabindex="-1" onpointermove={() => (sira = i)} onclick={() => void git(o.id)}>
        <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={36} />
        <span class="ad">{o.ad}</span>
        {#if o.bahsedilme > 0}<span class="rozet">@</span>{:else if o.okunmamis > 0}<span class="rozet">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}
        <span class="zaman">{goreliZaman(o.sonZaman)}</span>
      </button>
    {:else}
      <p>{t("klavye.paletBos")}</p>
    {/each}
  </div>
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 46; background: color-mix(in srgb, var(--zemin) 55%, transparent); }
  .palet { position: fixed; z-index: 47; top: min(14vh, 120px); left: 50%; translate: -50% 0; width: min(560px, calc(100vw - 32px)); max-height: min(560px, 72vh); display: flex; flex-direction: column; border-radius: 1.5rem; background: var(--yuzey-2); box-shadow: var(--kat-2); overflow: hidden; }
  .alan { flex: none; display: flex; align-items: center; gap: .75rem; height: 3.5rem; padding: 0 1.125rem; color: var(--yazi-2); border-bottom: 1px solid var(--kenar-ince); }
  input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  kbd { font: inherit; font-size: .75rem; padding: .125rem .5rem; border-radius: 6px; background: var(--yuzey-3); }
  .liste { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; }
  .oda { min-height: 3.25rem; padding: .375rem .75rem; border-radius: 1rem; display: flex; align-items: center; gap: .75rem; text-align: left; }
  .oda.secili { background: var(--ton); color: var(--ton-ustu); }
  .ad { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zaman { flex: none; font-size: .8125rem; color: var(--yazi-2); }
  .secili .zaman { color: inherit; }
  p { padding: 1.5rem; text-align: center; color: var(--yazi-2); }
</style>
