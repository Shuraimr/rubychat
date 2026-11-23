<!--
  Emoji / sticker / GIF picker body, used in two places:
   - the composer: a keyboard-sized panel UNDER the text field, so every pick is seen in the text at once (YazmaAlani);
   - the reaction sheet (EmojiSayfasi, "tepki" mode): standard emoji only.
  All categories are one scrolling list; the strip on top jumps and follows. Bottom tabs: Emoji · Çıkartma · GIF.
  Emoji / çıkartma / GIF seçicinin gövdesi, iki yerde kullanılır:
   - yazma alanı: metin kutusunun ALTINDA klavye boyunda panel; her seçim metinde anında görünür (YazmaAlani);
   - tepki sayfası (EmojiSayfasi, "tepki" kipi): yalnızca standart emoji.
  Bütün kategoriler tek kayan listedir; üstteki şerit atlar ve izler. Alt sekmeler: Emoji · Çıkartma · GIF.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { titret } from "../dokunma";
  import type { PaketGorseli } from "../api/tipler";
  import { EMOJI_GRUPLARI, TEN_TONLARI, emojiAra, tenli } from "../emoji/veri";
  import { paketler } from "../emoji/paketler.svelte";
  import { sonEmojiEkle, sonEmojiler, tenSecimiYaz, tenSecimleri } from "../emoji/son";
  import { t, type Anahtar } from "../i18n";
  import { gorselUrl } from "../medya";
  import GifSecici from "./GifSecici.svelte";
  import KareKirp from "./KareKirp.svelte";
  import { cikartmaPaketineEkle } from "../api/komutlar";
  import { dosyaYukle } from "../medya/isleme";
  import { bildirim } from "../durum/bildirim.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    ekle,
    sil,
    aramada,
    odakGeri,
    odaId,
    tepki = false,
    ozelEkle,
    cikartmaGonder,
    gifGonder,
    acik = true,
  }: {
    /** A standard emoji was picked · Standart bir emoji seçildi */
    ekle: (emoji: string) => void;
    /** Backspace in the composer · Yazma alanında geri silme */
    sil?: () => void;
    /** The search field opened / closed (the keyboard is coming) · Arama alanı açıldı / kapandı (klavye geliyor) */
    aramada?: (acik: boolean) => void;
    /** Give the caret back to the text · İmleci metne geri ver */
    odakGeri?: () => void;
    /** Room whose packs are offered (composer only) · Paketleri sunulan oda (yalnızca yazma alanı) */
    odaId?: string;
    /** Reaction mode: standard emoji only · Tepki kipi: yalnızca standart emoji */
    tepki?: boolean;
    /** A custom emoji was picked · Özel bir emoji seçildi */
    ozelEkle?: (g: PaketGorseli) => void;
    /** A sticker was picked · Bir çıkartma seçildi */
    cikartmaGonder?: (g: PaketGorseli) => void;
    /** A GIF was picked: its KLIPY link, sent as a text message · Bir GIF seçildi: KLIPY bağlantısı, metin mesajı olarak gönderilir */
    gifGonder?: (url: string) => void;
    /** On screen (the composer keeps the panel alive while closed) · Ekranda (yazma alanı paneli kapalıyken de canlı tutar) */
    acik?: boolean;
  } = $props();

  type Sekme = "emoji" | "cikartma" | "gif";
  let sekme = $state<Sekme>("emoji");
  let sorgu = $state("");
  let araAcik = $state(false);
  let gifArar = $state(false);
  let araKutu: HTMLInputElement | undefined = $state();
  let kok: HTMLDivElement | undefined = $state();
  let kap: HTMLDivElement | undefined = $state();
  let serit: HTMLDivElement | undefined = $state();
  /** Section on screen: "son", a category id or "paket:<index>" · Ekrandaki bölüm: "son", kategori kimliği ya da "paket:<sıra>" */
  let grup = $state<string>(sonEmojiler().length > 0 ? "son" : "yuzler");
  /** The recent list does not reorder under the finger: it is refreshed on the next opening. · Son kullanılanlar parmağın altında yer değiştirmez: sonraki açılışta tazelenir. */
  let son = $state(sonEmojiler());
  let ilkAcilis = true;
  $effect(() => {
    if (!acik) {
      araAcik = false;
      sorgu = "";
      ten = null;
      return;
    }
    if (!ilkAcilis) {
      son = sonEmojiler();
      // A recently-used tap changes the list height: measure again. · Son kullanılanlar listenin boyunu değiştirir: yeniden ölç.
      yerler = null;
      // A hidden list loses its scroll: start from the top, strip included. · Gizlenen liste kaydırmasını yitirir: şerit dahil baştan başla.
      const ilk = sonEmojiler().length > 0;
      grup = ilk ? "son" : "yuzler";
      if (kap) kap.scrollTop = 0;
    }
    ilkAcilis = false;
  });

  // ---- The list is built a section per frame, so the first opening does not freeze; later openings reuse it ----
  // ---- Liste kare başına bir bölüm kurulur; ilk açılış donmaz, sonraki açılışlar aynı düğümleri kullanır ----
  let kurulan = $state(2);
  onMount(() => {
    let z: ReturnType<typeof setTimeout>;
    const ileri = () => {
      kurulan++;
      if (kurulan < EMOJI_GRUPLARI.length) z = setTimeout(ileri, 40);
    };
    z = setTimeout(ileri, 350);
    return () => clearTimeout(z);
  });
  /** Real column count, for the height estimate of sections not painted yet · Henüz boyanmamış bölümlerin boy tahmini için gerçek sütun sayısı */
  let kapEni = $state(360);
  $effect(() => {
    if (!kap) return;
    // A closed (display: none) panel measures 0: keep the last real width. · Kapalı panel 0 ölçülür: son gerçek genişlik kalır.
    const g = new ResizeObserver(([k]) => {
      if (k.contentRect.width > 0) kapEni = k.contentRect.width + 16;
    });
    g.observe(kap);
    return () => g.disconnect();
  });
  const sutun = $derived(Math.max(1, Math.floor((kapEni - 16) / Math.max(44, 2.75 * parseFloat(getComputedStyle(document.documentElement).fontSize)))));

  onMount(() => {
    if (odaId && !tepki) void paketler.yukle(odaId);
  });

  const emojiPaketleri = $derived(paketler.paketler.map((p, i) => ({ p, i })).filter(({ p }) => p.gorseller.some((g) => g.emoji)));
  const cikartmaPaketleri = $derived(paketler.paketler.map((p, i) => ({ p, i })).filter(({ p }) => p.gorseller.some((g) => g.cikartma)));
  let cikartmaGrubu = $state(0);
  const gifVar = $derived(!!gifGonder && !tepki);

  // "Çıkartma yap": pick an image → crop / round / outline → WebP 512px → my personal pack (im.ponies.user_emotes).
  // "Çıkartma yap": resim seç → kırp / yuvarla / kenar çiz → WebP 512px → kişisel paketim (im.ponies.user_emotes).
  let yapDosya = $state<Blob | null>(null);
  function yapSec(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = "";
    if (f) yapDosya = f;
  }
  async function yapBitti(blob: Blob, g: number, y: number, mime: string) {
    yapDosya = null;
    try {
      const id = await dosyaYukle(blob, mime.includes("png") ? "png" : "webp");
      await cikartmaPaketineEkle(id, mime, "cikartma", g, y);
      if (odaId) await paketler.yukle(odaId, true);
      bildirim.goster(t("cikartmaYap.eklendi"), 3500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("cikartmaYap.hata"), 4500, { tur: "hata" });
    }
  }

  const aranan = $derived(sorgu.trim());
  const sonuc = $derived(aranan ? emojiAra(aranan) : []);
  // Custom emoji whose shortcode matches the search · Kısa kodu aramayla eşleşen özel emojiler
  const ozelSonuc = $derived.by(() => {
    const q = aranan.toLocaleLowerCase("tr");
    if (!q || tepki) return [];
    return paketler.paketler.flatMap((p) => p.gorseller.filter((g) => g.emoji && g.kisaKod.toLocaleLowerCase("tr").includes(q)));
  });

  const gruplar = EMOJI_GRUPLARI;

  function canlan(d: EventTarget | null) {
    const oge = (d as HTMLElement | null)?.closest("button")?.firstElementChild as HTMLElement | null;
    if (oge && parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hareket")) > 0) {
      oge.animate([{ transform: "scale(1)" }, { transform: "scale(1.45)", offset: 0.35 }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
    }
    titret(5);
  }
  function sec(d: EventTarget | null, emoji: string) {
    canlan(d);
    sonEmojiEkle(emoji);
    ekle(emoji);
  }
  function ozelSec(e: MouseEvent, g: PaketGorseli) {
    canlan(e.currentTarget);
    ozelEkle?.(g);
  }

  // ---- One listener for ~1900 buttons; holding one that takes a skin tone opens the tones above it ----
  // ---- ~1900 düğme için tek dinleyici; ten rengi alan birini basılı tutmak tonları üstünde açar ----
  let secimler = $state(tenSecimleri());
  let ten = $state<{ emoji: string; x: number; y: number } | null>(null);
  let basZamani: ReturnType<typeof setTimeout> | undefined;
  let basYeri = [0, 0];
  let uzunOldu = false;
  const gorunen = (emoji: string) => tenli(emoji, secimler[emoji] ?? "");
  const dugmesi = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("button[data-e]");
  function tenAc(d: HTMLElement) {
    const taban = d.dataset.t;
    if (!taban || !kok) return;
    uzunOldu = true;
    titret(10);
    const r = d.getBoundingClientRect();
    const k = kok.getBoundingClientRect();
    const en = Math.min(274, k.width - 16);
    ten = { emoji: taban, x: Math.max(8, Math.min(r.left - k.left + r.width / 2 - en / 2, k.width - en - 8)), y: Math.max(4, r.top - k.top - 56) };
  }
  function basildi(e: PointerEvent) {
    uzunOldu = false;
    clearTimeout(basZamani);
    const d = dugmesi(e);
    if (!d?.dataset.t) return;
    basYeri = [e.clientX, e.clientY];
    basZamani = setTimeout(() => tenAc(d), 350);
  }
  function oynadi(e: PointerEvent) {
    if (Math.hypot(e.clientX - basYeri[0], e.clientY - basYeri[1]) > 10) clearTimeout(basZamani);
  }
  const birakildi = () => clearTimeout(basZamani);
  onMount(() => birakildi);
  function tiklandi(e: MouseEvent) {
    if (uzunOldu) {
      uzunOldu = false;
      return;
    }
    if (ten) {
      ten = null;
      return;
    }
    const d = dugmesi(e);
    if (d) sec(d, d.dataset.e!);
  }
  function sagTik(e: MouseEvent) {
    const d = dugmesi(e);
    if (!d) return;
    e.preventDefault();
    if (!ten) tenAc(d);
  }
  function tonSec(ton: string) {
    if (!ten) return;
    const taban = ten.emoji;
    secimler[taban] = ton;
    if (!ton) delete secimler[taban];
    tenSecimiYaz($state.snapshot(secimler));
    ten = null;
    uzunOldu = false;
    sec(null, tenli(taban, ton));
  }

  // ---- One long list; the strip follows it · Tek uzun liste; şerit onu izler ----
  let git = 0;
  function bolumeGit(id: string) {
    const b = kap?.querySelector<HTMLElement>(`[data-bolum="${id}"]`);
    if (!kap || !b) return;
    grup = id;
    // Ignore the scroll events of this jump. · Bu atlamanın kaydırma olaylarını yok say.
    git = performance.now() + 250;
    kap.scrollTop = b.offsetTop;
    seritOrtala();
  }
  function kaydi() {
    if (ten) ten = null;
    if (!kap || performance.now() < git || kareBekler) return;
    // Once per frame at most · En çok kare başına bir kez
    kareBekler = true;
    requestAnimationFrame(izle);
  }
  let kareBekler = false;
  let yerler: { boy: number; liste: [string, number][] } | null = null;
  function izle() {
    kareBekler = false;
    if (!kap) return;
    const ust = kap.scrollTop + 24;
    let id = grup;
    // Offsets are read again only when the list height changed. · Konumlar yalnızca listenin boyu değişince yeniden okunur.
    if (!yerler || yerler.boy !== kap.scrollHeight) {
      yerler = { boy: kap.scrollHeight, liste: [...kap.querySelectorAll<HTMLElement>("[data-bolum]")].map((b) => [b.dataset.bolum!, b.offsetTop]) };
    }
    for (const [b, y] of yerler.liste) {
      if (y > ust) break;
      id = b;
    }
    if (id === grup) return;
    grup = id;
    seritOrtala();
  }
  function seritOrtala() {
    tick().then(() => {
      const d = serit?.querySelector<HTMLElement>(".secili");
      if (serit && d) serit.scrollLeft = d.offsetLeft - serit.clientWidth / 2 + d.offsetWidth / 2;
    });
  }

  async function araAc() {
    araAcik = true;
    aramada?.(true);
    await tick();
    araKutu?.focus();
  }
  // The keyboard can be closed with the system back button without any blur event: give the panel its full size back.
  // Klavye, blur olayı olmadan sistem geri tuşuyla kapanabilir: panele tam boyunu geri ver.
  onMount(() => {
    const vv = window.visualViewport;
    let acikti = false;
    const bak = () => {
      const acik = parseFloat(document.documentElement.style.getPropertyValue("--klavye-simdi")) > 0;
      if (acikti && !acik) {
        gifArar = false;
        aramada?.(false);
        (document.activeElement as HTMLElement | null)?.closest(".panel") && (document.activeElement as HTMLElement).blur();
      } else if (acik && !acikti && (araAcik || document.activeElement?.closest(".panel"))) aramada?.(true);
      acikti = acik;
    };
    vv?.addEventListener("resize", bak);
    return () => vv?.removeEventListener("resize", bak);
  });
  function araKapat() {
    araAcik = false;
    sorgu = "";
    aramada?.(false);
    odakGeri?.();
  }

  // Backspace repeats while held · Geri silme basılı tutulurken yineler
  let tekrar: ReturnType<typeof setTimeout> | undefined;
  function silBasla(e: PointerEvent) {
    e.preventDefault();
    sil?.();
    titret(5);
    const don = () => {
      sil?.();
      tekrar = setTimeout(don, 70);
    };
    tekrar = setTimeout(don, 420);
  }
  const silBit = () => clearTimeout(tekrar);
  onMount(() => silBit);

  const paketSimgesi = (p: { avatarMxc: string | null; gorseller: PaketGorseli[] }) => gorselUrl(p.avatarMxc ?? p.gorseller[0]?.mxc, 24);
</script>

<!-- mousedown is cancelled so a tap never takes the focus (and the caret) away from the composer. · mousedown iptal edilir; dokunuş odağı (ve imleci) yazma alanından almaz. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="panel" class:tepki bind:this={kok} onmousedown={(e) => { if (!(e.target as HTMLElement).closest("input, label")) e.preventDefault(); }}>
  {#if sekme === "emoji"}
    <div class="tepe">
      {#if araAcik}
        <label class="ara"><Ikon ad="ara" boyut={18} /><input bind:this={araKutu} bind:value={sorgu} placeholder={t("emoji.ara")} aria-label={t("emoji.ara")} enterkeyhint="search" autocomplete="off" /></label>
        <button class="duz" aria-label={t("emoji.araKapat")} onclick={araKapat}><Ikon ad="kapat" boyut={20} /></button>
      {:else}
        <button class="duz" aria-label={t("emoji.ara")} onclick={araAc}><Ikon ad="ara" boyut={20} /></button>
        <div class="serit" role="tablist" aria-label={t("emoji.kategoriler")} bind:this={serit}>
          {#if son.length > 0}<button role="tab" aria-selected={grup === "son"} aria-label={t("emoji.son")} class:secili={grup === "son"} onclick={() => bolumeGit("son")}><Ikon ad="saat" boyut={20} /></button>{/if}
          {#each gruplar as g (g.id)}
            <button role="tab" aria-selected={grup === g.id} aria-label={t(`emoji.kategori.${g.id}` as Anahtar)} class:secili={grup === g.id} onclick={() => bolumeGit(g.id)}>{g.simge}</button>
          {/each}
          {#if !tepki}
            {#each emojiPaketleri as { p, i } (i)}
              {@const url = paketSimgesi(p)}
              <button role="tab" aria-selected={grup === `paket:${i}`} aria-label={p.ad} class:secili={grup === `paket:${i}`} onclick={() => bolumeGit(`paket:${i}`)}>{#if url}<img src={url} alt="" width="24" height="24" />{:else}<Ikon ad="galeri" boyut={20} />{/if}</button>
            {/each}
          {/if}
        </div>
        {#if sil}<button class="duz" aria-label={t("emoji.geriSil")} onpointerdown={silBasla} onpointerup={silBit} onpointerleave={silBit} onpointercancel={silBit} onclick={(e) => { if (e.detail === 0) sil?.(); }}><Ikon ad="geriSil" boyut={22} /></button>{/if}
      {/if}
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="kap" bind:this={kap} onscroll={kaydi} onclick={tiklandi} onpointerdown={basildi} onpointermove={oynadi} onpointerup={birakildi} onpointercancel={birakildi} oncontextmenu={sagTik}>
      {#if aranan}
        {#if sonuc.length + ozelSonuc.length === 0}
          <p class="bos">{t("emoji.sonucYok")}</p>
        {:else}
          <div class="izgara">
            {#each sonuc as e (e.emoji)}{@render emojiDugmesi(e.emoji, e.ten)}{/each}
            {#each ozelSonuc as g (g.mxc + g.kisaKod)}<button onclick={(o) => ozelSec(o, g)} aria-label={g.kisaKod}><img src={gorselUrl(g.mxc, 32) ?? ""} alt={g.kisaKod} width="32" height="32" /></button>{/each}
          </div>
        {/if}
      {:else}
        {#if son.length > 0}
          <section data-bolum="son"><h3>{t("emoji.son")}</h3>
            <div class="izgara">{#each son as e (e)}{@render emojiDugmesi(e, false)}{/each}</div>
          </section>
        {/if}
        {#each gruplar as g, i (g.id)}
          <section data-bolum={g.id} class:bekler={i >= kurulan} style:--satir={Math.ceil(g.ogeler.length / sutun)}><h3>{t(`emoji.kategori.${g.id}` as Anahtar)}</h3>
            <div class="izgara">{#if i < kurulan}{#each g.ogeler as e (e.emoji)}{@render emojiDugmesi(e.emoji, e.ten)}{/each}{/if}</div>
          </section>
        {/each}
        {#if !tepki}
          {#each emojiPaketleri as { p, i } (i)}
            <section data-bolum="paket:{i}"><h3>{p.ad}</h3>
              <div class="izgara">{#each p.gorseller.filter((g) => g.emoji) as g (g.kisaKod)}<button onclick={(o) => ozelSec(o, g)} aria-label={g.kisaKod}><img src={gorselUrl(g.mxc, 32) ?? ""} alt={g.kisaKod} width="32" height="32" loading="lazy" /></button>{/each}</div>
            </section>
          {/each}
        {/if}
      {/if}
    </div>
  {:else if sekme === "gif" && gifGonder}
    <div class="kap gif"><GifSecici sec={gifGonder} odak={(a) => { gifArar = a; aramada?.(a); }} /></div>
  {:else}
    <div class="cik-ust"><label class="yap"><Ikon ad="makas" boyut={18} />{t("cikartmaYap.dugme")}<input type="file" accept="image/*" onchange={yapSec} /></label></div>
    <!-- Stickers: tabs are the packs that have sticker images · Çıkartmalar: sekmeler çıkartma görseli olan paketlerdir -->
    {#if paketler.yukleniyor && cikartmaPaketleri.length === 0}
      <p class="bos">{t("emoji.cikartmaYukleniyor")}</p>
    {:else if cikartmaPaketleri.length === 0}
      <p class="bos">{t(paketler.hata ? "emoji.cikartmaHata" : "emoji.cikartmaYok")}</p>
    {:else}
      {#if cikartmaPaketleri.length > 1}
        <div class="kategoriler" role="tablist">
          {#each cikartmaPaketleri as { p }, n (n)}
            {@const url = paketSimgesi(p)}
            <button role="tab" aria-selected={cikartmaGrubu === n} aria-label={p.ad} class:secili={cikartmaGrubu === n} onclick={() => (cikartmaGrubu = n)}>
              {#if url}<img src={url} alt="" width="24" height="24" />{:else}<Ikon ad="galeri" boyut={20} />{/if}
            </button>
          {/each}
        </div>
      {/if}
      {@const gecerli = cikartmaPaketleri[Math.min(cikartmaGrubu, cikartmaPaketleri.length - 1)]?.p}
      <div class="kap cik">
        {#if gecerli}
          <p class="paket-ad">{gecerli.ad}</p>
          <div class="izgara cikartmalar">
            {#each gecerli.gorseller.filter((g) => g.cikartma) as g (g.kisaKod)}
              <button class="cikartma" onclick={() => cikartmaGonder?.(g)} aria-label={g.metin}><img src={gorselUrl(g.mxc, 80) ?? ""} alt={g.metin} width="72" height="72" loading="lazy" /></button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if !tepki && !araAcik && !gifArar && (gifVar || cikartmaGonder)}
    <div class="sekmeler" role="tablist">
      {#each [["emoji", t("emoji.sekmeEmoji")], ...(cikartmaGonder ? [["cikartma", t("emoji.sekmeCikartma")]] : []), ...(gifVar ? [["gif", "GIF"]] : [])] as [id, ad] (id)}
        <button role="tab" aria-selected={sekme === id} class:secili={sekme === id} onclick={() => (sekme = id as Sekme)}>{ad}</button>
      {/each}
    </div>
  {/if}

  {#if ten}
    <div class="tonlar" role="menu" aria-label={t("emoji.tenRengi")} style:left="{ten.x}px" style:top="{ten.y}px">
      {#each TEN_TONLARI as ton (ton)}<button role="menuitem" aria-label={tenli(ten.emoji, ton)} onclick={() => tonSec(ton)}>{tenli(ten.emoji, ton)}</button>{/each}
    </div>
  {/if}
</div>

{#snippet emojiDugmesi(e: string, tenVar: boolean)}{@const g = tenVar ? gorunen(e) : e}<button data-e={g} data-t={tenVar ? e : undefined} class:tenli={tenVar} aria-label={g}><span>{g}</span></button>{/snippet}

{#if yapDosya}<KareKirp dosya={yapDosya} cikti={512} cikartmaKipi onbitti={yapBitti} onkapat={() => (yapDosya = null)} />{/if}

<style>
  .panel { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
  .tepe { flex: none; display: flex; align-items: center; gap: 4px; padding: 4px 8px; }
  .duz { flex: none; width: 44px; height: 44px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .duz:active { background: var(--yuzey-3); }
  .ara { flex: 1; min-width: 0; height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 14px; background: var(--yuzey-3); color: var(--yazi-2); }
  .ara input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: none; color: var(--yazi); font: inherit; font-size: .9375rem; }
  .serit { position: relative; flex: 1; min-width: 0; display: flex; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .serit::-webkit-scrollbar, .kategoriler::-webkit-scrollbar { display: none; }
  .serit button, .kategoriler button { flex: none; width: 44px; height: 44px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; line-height: 1; color: var(--yazi-2); opacity: .62; transition: background var(--sure-hizli) var(--egri-cikis), opacity var(--sure-hizli) var(--egri-cikis); }
  .serit button.secili, .kategoriler button.secili { background: var(--ton); color: var(--ton-ustu); opacity: 1; }
  .kategoriler { display: flex; overflow-x: auto; scrollbar-width: none; padding: 0 8px; }
  .kap { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 8px 8px; touch-action: pan-y; }
  .kap.gif { padding-top: 8px; }
  /* The first two are painted at once, or the panel would open empty for a frame. · İlk ikisi hemen boyanır; yoksa panel bir kare boş açılırdı. */
  section:nth-of-type(n + 3) { content-visibility: auto; contain-intrinsic-size: auto calc(2rem + var(--satir, 3) * 2.875rem); }
  section.bekler { min-height: calc(2rem + var(--satir, 3) * 2.875rem); }
  h3 { padding: 8px 8px 4px; font-family: var(--yazi-tipi); font-size: .75rem; font-weight: 600; color: var(--yazi-2); }
  .izgara { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(44px, 2.75rem), 1fr)); }
  .izgara button { height: 2.875rem; min-height: 44px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.75rem; line-height: 1; }
  .izgara button:active { background: var(--yuzey-3); }
  .izgara span { display: inline-flex; }
  /* A small corner marks the ones that have skin tones · Ten rengi olanları küçük bir köşe belirtir */
  .izgara .tenli { position: relative; }
  .izgara .tenli::after { content: ""; position: absolute; right: 4px; bottom: 4px; border: 2.5px solid transparent; border-right-color: var(--yazi-2); border-bottom-color: var(--yazi-2); opacity: .6; }
  .tonlar { position: absolute; z-index: 3; display: flex; box-sizing: border-box; width: min(274px, calc(100% - 16px)); padding: 4px; border-radius: 18px; background: var(--yuzey-3); border: 1px solid var(--kenar); box-shadow: var(--kat-2); animation: ton-gel var(--sure-hizli) var(--egri-cikis); }
  .tonlar button { flex: 1 1 0; min-width: 0; height: 44px; border-radius: 14px; font-size: 1.625rem; line-height: 1; }
  .tonlar button:active { background: var(--yuzey-2); }
  @keyframes ton-gel { from { transform: scale(.9); opacity: 0; } }
  .izgara img { object-fit: contain; }
  .izgara.cikartmalar { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 4px; }
  .izgara .cikartma { height: 84px; }
  .cik-ust { flex: none; padding: 8px 12px 4px; }
  .yap { position: relative; min-height: 44px; padding: 0 16px; border-radius: 14px; display: inline-flex; align-items: center; gap: 8px; background: var(--ton); color: var(--ton-ustu); font-size: .875rem; font-weight: 600; cursor: pointer; }
  .yap input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
  .sekmeler { flex: none; display: flex; justify-content: center; gap: 4px; padding: 4px 8px; border-top: 1px solid var(--kenar-ince); }
  .sekmeler button { flex: 0 1 7rem; min-width: 0; min-height: 44px; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 14px; font-size: min(.875rem, 5vw); font-weight: 600; color: var(--yazi-2); transition: background var(--sure-hizli) var(--egri-cikis), color var(--sure-hizli) var(--egri-cikis); }
  .sekmeler button.secili { background: var(--ton); color: var(--ton-ustu); }
  .paket-ad { font-size: .75rem; font-weight: 600; color: var(--yazi-2); padding: 4px 8px; }
  .bos { text-align: center; font-size: .875rem; color: var(--yazi-2); padding: 24px 8px; }
</style>
