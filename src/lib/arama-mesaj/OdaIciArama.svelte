<!--
  In-chat search bar (design 22/04): replaces the composer. Shows "3/17" with ˄ ˅ to step between matches (the current bubble is outlined and
  the words highlighted by the room), and chips Kimden (sender filter) / Medya (media in the loaded history) / ≡ Liste (the results as a list).
  Results come from the instant message index limited to this room (MesajAramasi); stepping uses the same jump as search results (atlama).
  It is a back-button layer: back / ✕ closes it and the composer returns.
  Sohbet içi arama çubuğu (tasarım 22/04): yazma alanının yerine geçer. "3/17" ile eşleşmeler arasında ˄ ˅ adımlar (şu anki balon çerçeveli,
  kelimeler oda tarafından vurgulu) ve Kimden (gönderen süzgeci) / Medya (yüklenen geçmişteki medya) / ≡ Liste (sonuçlar liste olarak) çipleri.
  Sonuçlar bu odayla sınırlı anlık mesaj dizininden gelir (MesajAramasi); adımlama arama sonuçlarıyla aynı atlamayı kullanır (atlama).
  Geri tuşu katmanıdır: geri / ✕ kapatır ve yazma alanı döner.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t } from "../i18n";
  import { atlama, EN_AZ_KARAKTER, MesajAramasi } from "./durum.svelte";
  import MesajAramaSonuclari from "./MesajAramaSonuclari.svelte";

  let {
    odaId,
    onkapat,
    aktifOlay = $bindable(null),
    sorgu = $bindable(""),
    vimKipi = false,
    adimBagla,
    durumDegis,
    vurguDegis,
  }: {
    odaId: string;
    onkapat: () => void;
    aktifOlay?: string | null;
    sorgu?: string;
    /** Opened via Vim "/" or ":ara": Enter confirms and leaves focus for n/N · Vim "/" veya ":ara" ile açıldı: Enter onaylar ve n/N için odağı bırakır */
    vimKipi?: boolean;
    /** Exposes step/focus/close helpers to keyboard shortcuts · Klavye kısayollarına adımlama/odak/kapatma yardımcılarını verir */
    adimBagla?: (api: { adim: (yon: -1 | 1) => string | null; odakla: () => void; kapat: () => void } | null) => void;
    /** Reports match index/total for the mode indicator · Kip göstergesi için eşleşme sırası/toplamını bildirir */
    durumDegis?: (d: { sira: number; toplam: number }) => void;
    /** The words of the current results and the events they matched (the room highlights only those bubbles)
     *  Güncel sonuçların kelimeleri ve eşleştikleri olaylar (oda yalnızca o balonları vurgular) */
    vurguDegis?: (v: { sorgu: string; idler: Set<string> }) => void;
  } = $props();

  const motor = new MesajAramasi();
  let alan: HTMLInputElement | undefined = $state();
  let kimden = $state<string | null>(null);
  let kimdenAcik = $state(false);
  let liste = $state(false);
  let medyaKipi = $state(false);
  let sira = $state(0);
  let katman = 0;
  let listeKatmani = 0;

  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
    adimBagla?.({
      adim,
      odakla: () => {
        alan?.focus();
        alan?.select();
      },
      kapat: () => {
        if (katman) gezinme.katmanKapat(katman);
        else onkapat();
      },
    });
    // Prefilled ":ara text" starts ready for n/N; empty "/" or Ctrl+F focuses the input. · Ön dolgulu ":ara metin" n/N için hazır başlar; boş "/" veya Ctrl+F girdiyi odaklar.
    if (!vimKipi || !sorgu.trim()) queueMicrotask(() => alan?.focus());
  });
  onDestroy(() => {
    clearTimeout(atlaZamanlayici);
    vurguDegis?.({ sorgu: "", idler: new Set() });
    adimBagla?.(null);
    durumDegis?.({ sira: 0, toplam: 0 });
    // Top one first, so each history entry can be removed. · Önce üstteki; her history girdisi silinebilsin.
    if (listeKatmani) gezinme.katmanBirak(listeKatmani);
    if (katman) gezinme.katmanBirak(katman);
    motor.temizle();
    aktifOlay = null;
    sorgu = "";
  });

  // One room: ask for more than the global search does, so "3/17" counts the whole room. · Tek oda: genel aramadan çok iste; "3/17" bütün odayı saysın.
  $effect(() => motor.ara(sorgu, odaId, 200));

  // Oldest first so ˄ goes back in time; start at the NEWEST match · En eski başta: ˄ geçmişe gider; EN YENİ eşleşmeden başla
  const eslesmeler = $derived.by(() => {
    const k = kimden?.toLocaleLowerCase("tr");
    return motor.sonuclar
      .filter((s) => !k || `${s.gonderenAd ?? ""} ${s.gonderen}`.toLocaleLowerCase("tr").includes(k))
      .sort((a, b) => a.zaman - b.zaman);
  });
  // Media in the already loaded history (the text index has no media) · Yüklenmiş geçmişteki medya (metin dizininde medya yok)
  const medyalar = $derived(
    zaman.ogeler.filter((o) => ["resim", "video", "dosya"].includes(o.tur) && o.olayId && (!kimden || `${o.gonderenAd} ${o.gonderen}`.toLocaleLowerCase("tr").includes(kimden.toLocaleLowerCase("tr")))),
  );
  const toplam = $derived(medyaKipi ? medyalar.length : eslesmeler.length);
  const gecerli = $derived([...sorgu.trim()].length >= EN_AZ_KARAKTER);

  // New results: jump to the newest one, but only once the typing settles. Every jump may load history and scroll the room, so jumping
  // on each letter made the chat jerk around while typing; the count still updates at once. Enter / ˄ ˅ jump immediately.
  // Yeni sonuçlar: en yenisine atla, ama yalnızca yazma durulunca. Her atlama geçmiş yükleyip odayı kaydırabilir; her harfte atlamak
  // yazarken sohbeti sarsıyordu. Sayaç yine anında güncellenir. Enter / ˄ ˅ hemen atlar.
  const ATLAMA_BEKLEME = 450;
  let atlaZamanlayici: ReturnType<typeof setTimeout> | undefined;
  let sonAnahtar = "";
  $effect(() => {
    const anahtar = `${medyaKipi}|${kimden}|${motor.sorgu}|${eslesmeler.length}|${medyalar.length}`;
    if (anahtar === sonAnahtar) return;
    sonAnahtar = anahtar;
    sira = Math.max(0, toplam - 1);
    clearTimeout(atlaZamanlayici);
    atlaZamanlayici = setTimeout(git, ATLAMA_BEKLEME);
  });

  // Only the matched bubbles highlight, with the words their results were found for. · Yalnızca eşleşen balonlar, sonuçlarının bulunduğu kelimelerle vurgulanır.
  $effect(() => {
    const idler = new Set<string>(medyaKipi ? [] : eslesmeler.map((s) => s.olayId));
    vurguDegis?.({ sorgu: medyaKipi ? "" : motor.sorgu, idler });
  });

  $effect(() => {
    durumDegis?.({ sira: toplam > 0 ? sira + 1 : 0, toplam });
  });

  function git(): string | null {
    clearTimeout(atlaZamanlayici);
    const o = medyaKipi ? medyalar[sira]?.olayId : eslesmeler[sira]?.olayId;
    aktifOlay = o ?? null;
    if (o) atlama.git(odaId, o);
    return o ?? null;
  }
  function adim(yon: -1 | 1): string | null {
    if (!toplam) return null;
    sira = (sira + yon + toplam) % toplam;
    return git();
  }

  /** Enter = confirm in Vim "/" mode (blur for n/N), or older match in Ctrl+F mode; Shift+Enter = newer (Ctrl+K / Ctrl+J too)
   *  Enter = Vim "/" kipinde onaylar (n/N için odağı bırakır), Ctrl+F kipinde önceki eşleşme; Shift+Enter = sonraki (Ctrl+K / Ctrl+J de) */
  function tus(e: KeyboardEvent) {
    if (vimKipi && e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.isComposing) {
      e.preventDefault();
      alan?.blur();
      return;
    }
    const k = e.key.toLowerCase();
    const yon = e.key === "Enter" && !e.isComposing ? (e.shiftKey ? 1 : -1) : e.ctrlKey && k === "k" ? -1 : e.ctrlKey && k === "j" ? 1 : 0;
    if (!yon) return;
    e.preventDefault();
    adim(yon as -1 | 1);
  }

  // The list view covers the room; it is a layer of its own · Liste görünümü odayı örter; kendi katmanı var
  function listeAc() {
    liste = true;
    listeKatmani = gezinme.katmanAc(() => {
      listeKatmani = 0;
      liste = false;
    });
  }
  function listeKapat() {
    if (listeKatmani) gezinme.katmanKapat(listeKatmani);
  }

  // Senders seen in the loaded history, for the Kimden chip · Kimden çipi için yüklenen geçmişte görülen göndericiler
  const gondericiler = $derived.by(() => {
    const m = new Map<string, string>();
    for (const o of zaman.ogeler) if (!o.kendi && o.gonderen && o.gonderenAd) m.set(o.gonderen, o.gonderenAd);
    return [...m.values()].sort((a, b) => a.localeCompare(b, "tr"));
  });
</script>

<div class="cubuk" data-alt-cubuk>
  <div class="cipler">
    <button class="hap" class:aktif={!!kimden} onclick={() => (kimdenAcik = true)}>{kimden ? `${t("aramaOda.kimden")}: ${kimden}` : t("aramaOda.kimden")}<Ikon ad="asagiOk" boyut={14} /></button>
    <button class="hap" class:aktif={medyaKipi} aria-pressed={medyaKipi} onclick={() => (medyaKipi = !medyaKipi)}>{t("aramaOda.medya")}</button>
    <button class="hap" onclick={listeAc}><Ikon ad="dosya" boyut={14} />{t("aramaOda.liste")}</button>
  </div>
  <div class="satir">
    <button class="ikon" aria-label={t("aramaOda.kapat")} onclick={() => gezinme.katmanKapat(katman)}><Ikon ad="geri" boyut={20} /></button>
    <input bind:this={alan} bind:value={sorgu} type="search" enterkeyhint="search" placeholder={t("aramaOda.yer")} aria-label={t("aramaOda.yer")} autocomplete="off" autocapitalize="off" spellcheck="false" onkeydown={tus} />
    {#if gecerli || medyaKipi}<span class="sayac" aria-live="polite">{toplam ? `${sira + 1}/${toplam}` : "0/0"}</span>{/if}
    <button class="ok" aria-label={t("aramaOda.onceki")} disabled={!toplam} onclick={() => adim(-1)}><Ikon ad="yukari" boyut={20} /></button>
    <button class="ok" aria-label={t("aramaOda.sonraki")} disabled={!toplam} onclick={() => adim(1)}><Ikon ad="asagi" boyut={20} /></button>
  </div>
</div>

{#if kimdenAcik}
  <AltSayfa baslik={t("aramaOda.kimdenBaslik")} onkapat={() => (kimdenAcik = false)}>
    <div class="gonderen-liste">
      <button class="g" class:aktif={!kimden} onclick={() => { kimden = null; kimdenAcik = false; }}>{t("aramaOda.herkes")}</button>
      {#each gondericiler as g (g)}<button class="g" class:aktif={kimden === g} onclick={() => { kimden = g; kimdenAcik = false; }}>{g}</button>{/each}
    </div>
  </AltSayfa>
{/if}

{#if liste}
  <div class="liste-katman">
    <div class="liste-ust">
      <button class="ikon" aria-label={t("oda.geri")} onclick={listeKapat}><Ikon ad="geri" boyut={20} /></button>
      <strong>{sorgu || t("aramaOda.liste")}</strong>
    </div>
    <div class="liste-icerik">
      {#if medyaKipi}
        {#if medyalar.length === 0}<p class="bos">{t("aramaOda.medyaYok")}</p>{/if}
        {#each medyalar as o (o.id)}
          <button class="medya-satir" data-dalga onclick={() => { listeKapat(); if (o.olayId) atlama.git(odaId, o.olayId); }}><Ikon ad={o.tur === "dosya" ? "dosya" : "galeri"} boyut={22} /><span>{o.gonderenAd}</span><small>{o.metin ?? t(`aramaOda.medya`)}</small></button>
        {/each}
      {:else}
        <MesajAramaSonuclari {sorgu} {odaId} {kimden} odaAdiGoster={false} sec={(s) => { listeKapat(); atlama.git(odaId, s.olayId); }} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .cubuk { flex: none; background: var(--yuzey-1); border-top: 1px solid var(--kenar-ince); padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); display: grid; gap: 8px; }
  .cipler { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .hap { flex: none; min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0 16px; border-radius: 22px; background: var(--yuzey-2); font-size: .875rem; font-weight: 500; }
  .hap.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .satir { display: flex; align-items: center; gap: 4px; min-height: 52px; padding: 0 4px; border-radius: 26px; background: var(--yuzey-2); }
  .ikon { flex: none; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); border-radius: 22px; }
  input { flex: 1; min-width: 0; height: 48px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .sayac { flex: none; font-size: .875rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; padding: 0 4px; }
  .ok { flex: none; width: 44px; height: 44px; border-radius: 22px; background: var(--yuzey-3); display: inline-flex; align-items: center; justify-content: center; }
  .ok:disabled { opacity: .38; }
  .gonderen-liste { display: grid; }
  .g { min-height: 52px; text-align: left; padding: 0 8px; border-radius: 12px; font-size: 1rem; }
  .g.aktif { color: var(--vurgu); font-weight: 600; }
  .liste-katman { position: absolute; inset: 0; bottom: 0; z-index: 15; display: flex; flex-direction: column; background: var(--zemin); }
  .liste-ust { flex: none; display: flex; align-items: center; gap: 4px; padding: calc(env(safe-area-inset-top) + 4px) 12px 4px 4px; min-height: 56px; }
  .liste-icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 8px; }
  .bos { padding: 24px 16px; text-align: center; color: var(--yazi-2); font-size: .875rem; }
  .medya-satir { width: 100%; min-height: 56px; padding: 0 16px; display: flex; align-items: center; gap: 12px; text-align: left; }
  .medya-satir span { font-weight: 600; }
  .medya-satir small { color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
</style>
