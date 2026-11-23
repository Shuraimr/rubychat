<!--
  Composer bar: one floating pill (emoji / keyboard · text, up to 6 lines · attach · send while there is text). Messages scroll under it. While
  scrolled up a round "go to the newest message" button floats above its right end. Enter sends, Shift+Enter inserts a newline.
  The unsent text is remembered per room as a draft ("Taslak:" in the chat list). While offline a yellow line says messages are queued.
  Yazma çubuğu: yüzen tek hap (emoji / klavye · 6 satıra kadar metin · ek · yazı varken gönder). Mesajlar altından kayar. Yukarı
  kaydırılmışken sağ ucunun üstünde yuvarlak "en yeni mesaja in" düğmesi yüzer. Enter gönderir, Shift+Enter yeni satır ekler.
  Gönderilmemiş yazı oda başına taslak olarak hatırlanır (sohbet listesinde "Taslak:"). Çevrimdışıyken sarı bir satır mesajların sıraya alındığını söyler.
  Also: a strip above the box while replying / editing (✕ cancels), Markdown (**kalın**, *italik*, ~~çizili~~, `kod`, ```blok```, [bağlantı](url), ||spoiler||)
  is sent as an HTML body, "+" also offers a poll, the emoji sheet offers the room's custom emoji and stickers, and "X yazıyor…" shows above the box
  while someone types (and my own typing is announced, throttled).
  Ayrıca: yanıtlarken / düzenlerken kutunun üstünde bir şerit (✕ iptal eder), Markdown HTML gövde olarak gönderilir, "+" bir anket de sunar, emoji
  sayfası odanın özel emojilerini ve çıkartmalarını sunar, biri yazarken kutunun üstünde "X yazıyor…" görünür (kendi yazdığım da, seyreltilerek, bildirilir).
-->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { cikartmaGonder as cikartmaYolla, mesajDuzenle, yaziyorBildir } from "../api/komutlar";
  import type { PaketGorseli, ZamanOgesi } from "../api/tipler";
  import { markdownCevir } from "../bicim/markdown";
  import { emojiJetonu } from "../emoji/paketler.svelte";
  import MedyaAkisi from "../medya/MedyaAkisi.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { yazma } from "../durum/yazma.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { hataBildir } from "../mesaj/eylemler";
  import { t } from "../i18n";
  import AnketOlustur from "./AnketOlustur.svelte";
  import EkSayfasi, { type EkKaynagi } from "./EkSayfasi.svelte";
  import EmojiPaneli from "./EmojiPaneli.svelte";
  import Ikon from "./Ikon.svelte";
  import YanitOnizleme from "./YanitOnizleme.svelte";

  let {
    odaId,
    sifreli,
    gonder,
    altta,
    yeniSayi,
    enAlta,
    yukseklik = $bindable(0),
  }: {
    odaId: string;
    sifreli: boolean;
    /** Send: plain text, optional HTML body, optional reply target · Gönder: düz metin, isteğe bağlı HTML gövde, isteğe bağlı yanıtlanan mesaj */
    gonder: (metin: string, html: string | null, yanitOlayId: string | null) => void;
    /** The newest message is on screen · En yeni mesaj ekranda */
    altta: boolean;
    /** New messages below the screen · Ekranın altında kalan yeni mesaj sayısı */
    yeniSayi: number;
    /** Go to the newest message · En yeni mesaja git */
    enAlta: () => void;
    /** Measured height of the bar, for the timeline padding · Çubuğun ölçülen yüksekliği, çizelgenin alt boşluğu için */
    yukseklik?: number;
  } = $props();

  // The component is re-created per room ({#key}), so reading the room id once is intended. · Bileşen her odada yeniden kurulur ({#key}); oda kimliğini bir kez okumak bilerek yapılır.
  let deger = $state(untrack(() => odalar.taslaklar[odaId]) ?? "");
  let kutu: HTMLTextAreaElement | undefined = $state();
  let odakta = $state(false);
  let ekAcik = $state(false);
  let medyaKaynak = $state<Exclude<EkKaynagi, "anket" | "gifyap"> | null>(null);
  let anketAcik = $state(false);
  /** "GIF yap" (video trimmed to 6 s, muted) · "GIF yap" (6 sn'ye kesilmiş sessiz video) */
  let gifYap = $state(false);
  let medyaKatmani = 0;
  /** Custom emoji inserted from packs: shortcode → mxc:// (turned into <img> when the message is sent) · Paketlerden eklenen özel emojiler: kısa kod → mxc:// (mesaj yollanırken <img> olur) */
  let ozelEmoji: Record<string, string> = {};

  const cevrimdisi = $derived(odalar.esitleme.durum === "cevrimdisi");
  const yazili = $derived(deger.trim().length > 0);

  /** Grow with the content up to 6 lines, at most 30% of the screen · İçerikle birlikte 6 satıra, en çok ekranın %30'una kadar büyür */
  function boyutla() {
    if (!kutu) return;
    kutu.style.height = "auto";
    kutu.style.height = `${Math.min(kutu.scrollHeight, Math.max(44, Math.min(6 * parseFloat(getComputedStyle(kutu).lineHeight) + 20, innerHeight * 0.3)))}px`;
  }
  $effect(() => {
    deger;
    boyutla();
  });

  // The draft can change from outside (user card › Bahset): mirror it into the open composer. · Taslak dışarıdan değişebilir (kullanıcı kartı › Bahset): açık yazma alanına yansıt.
  $effect(() => {
    const tas = odalar.taslaklar[odaId] ?? "";
    if (tas !== untrack(() => deger)) deger = tas;
  });

  // ---- Reply / edit mode · Yanıt / düzenleme kipi ----
  // Editing swaps the box content for the message text; the unsent draft comes back afterwards. · Düzenleme kutu içeriğini mesaj metniyle değiştirir; gönderilmemiş taslak sonra geri gelir.
  let taslakYedek = "";
  let oncekiDuzenle: ZamanOgesi | null = null;
  $effect(() => {
    const d = yazma.duzenle;
    if (d && !oncekiDuzenle) {
      taslakYedek = untrack(() => deger);
      deger = d.metin ?? "";
      kutu?.focus();
    } else if (!d && oncekiDuzenle) {
      deger = taslakYedek;
      taslakYedek = "";
    }
    oncekiDuzenle = d;
  });
  $effect(() => {
    if (yazma.yanit) kutu?.focus();
  });
  // The component is re-created per room; leaving the room cancels the modes. · Bileşen her odada yeniden kurulur; odadan çıkmak kipleri iptal eder.
  onDestroy(() => {
    yazma.iptal();
    yaziyorDur();
  });

  // ---- Typing notice: announced while I type, throttled to one request per 3 s, stopped after 5 s of silence ----
  // ---- Yazıyor bildirimi: yazarken duyurulur, 3 sn'de bir istekle seyreltilir, 5 sn sessizlikten sonra durdurulur ----
  let yaziyor = false;
  let sonBildirim = 0;
  let durZamani: ReturnType<typeof setTimeout> | undefined;
  function yaziyorDur() {
    clearTimeout(durZamani);
    if (!yaziyor) return;
    yaziyor = false;
    void yaziyorBildir(odaId, false).catch(() => {});
  }
  function yaziyorBildirimi() {
    // Not while editing, and not for an empty box. · Düzenlerken ve boş kutuda değil.
    if (yazma.duzenle || !deger.trim()) {
      yaziyorDur();
      return;
    }
    const simdi = Date.now();
    if (!yaziyor || simdi - sonBildirim > 3000) {
      yaziyor = true;
      sonBildirim = simdi;
      void yaziyorBildir(odaId, true).catch(() => {});
    }
    clearTimeout(durZamani);
    durZamani = setTimeout(yaziyorDur, 5000);
  }

  function degisti() {
    // While editing, the box is not the room draft. · Düzenlerken kutu oda taslağı değildir.
    if (!yazma.duzenle) odalar.taslakYaz(odaId, deger);
    yaziyorBildirimi();
  }

  function yolla() {
    const metin = deger.trim();
    if (!metin) return;
    yaziyorDur();
    // Markdown → HTML body; `bicim.html` is null when nothing needs formatting. · Markdown → HTML gövde; biçimlenecek bir şey yoksa `bicim.html` null.
    const bicim = markdownCevir(metin, ozelEmoji);
    const duzenle = yazma.duzenle;
    if (duzenle?.olayId) {
      const id = duzenle.olayId;
      yazma.iptal(); // restores the draft through the effect above · yukarıdaki etki taslağı geri getirir
      void mesajDuzenle(odaId, id, bicim.metin, bicim.html).catch(hataBildir);
      ozelEmoji = {};
      return;
    }
    const yanit = yazma.yanit?.olayId ?? null;
    gonder(bicim.metin, bicim.html, yanit);
    yazma.iptal();
    ozelEmoji = {};
    deger = "";
    odalar.taslakYaz(odaId, "");
  }

  function tus(e: KeyboardEvent) {
    // isComposing: do not send while an IME (e.g. mobile keyboard) is still composing a word
    // isComposing: telefon klavyesi gibi bir giriş yöntemi hâlâ kelime oluşturuyorken gönderme
    // With "Enter ile gönder" off, Enter inserts a newline and only the arrow sends. · "Enter ile gönder" kapalıyken Enter satır ekler, yalnızca ok gönderir.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && tercihler.d.enterGonder) {
      e.preventDefault();
      yolla();
    }
    if (e.key === "Escape" && (yazma.yanit || yazma.duzenle)) yazma.iptal();
  }

  // ---- Emoji panel: takes the keyboard's place UNDER the box, so the text stays visible while picking ----
  // ---- Emoji paneli: klavyenin yerini kutunun ALTINDA alır; seçerken metin görünür kalır ----
  let emojiAcik = $state(false);
  let emojiAramada = $state(false);
  let panelKatmani = 0;
  let cubuk: HTMLDivElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  /** Built on the first opening and kept: later openings only show it · İlk açılışta kurulur ve tutulur: sonraki açılışlar yalnızca gösterir */
  let panelKuruldu = $state(false);
  let kapaniyor = $state(false);
  let kapanisSirasi = 0;

  async function panelAc() {
    if (emojiAcik) return klavyeyeDon();
    const klavyeVardi = parseFloat(document.documentElement.style.getPropertyValue("--klavye-simdi")) > 0;
    kapanisSirasi++;
    kapaniyor = false;
    panelKuruldu = true;
    emojiAcik = true;
    emojiAramada = false;
    panelKatmani = gezinme.katmanAc(() => {
      panelKatmani = 0;
      panelCik();
      emojiAcik = false;
      emojiAramada = false;
    });
    // Re-focus with inputmode="none": the keyboard leaves, the caret stays. · inputmode="none" ile yeniden odakla: klavye gider, imleç kalır.
    const imlec: [number, number] = [kutu?.selectionStart ?? deger.length, kutu?.selectionEnd ?? deger.length];
    kutu?.blur();
    await tick();
    kutu?.focus({ preventScroll: true });
    kutu?.setSelectionRange(...imlec);
    // With the keyboard open the panel simply takes its place; otherwise bar + panel slide up as one piece (transform only).
    // Klavye açıksa panel onun yerini alır; değilse çubuk + panel tek parça yukarı kayar (yalnızca transform).
    const stil = getComputedStyle(document.documentElement);
    const sure = parseFloat(stil.getPropertyValue("--sure-orta")) || 0;
    // Re-opened while still closing: undo the closing position. · Kapanırken yeniden açıldı: kapanış konumunu geri al.
    panel?.removeAttribute("style");
    if (klavyeVardi || sure === 0 || !panel || !cubuk) return;
    const y = `translateY(${panel.offsetHeight}px)`;
    cubuk.animate([{ transform: y }, { transform: "none" }], { duration: sure * 1.2, easing: stil.getPropertyValue("--egri-cikis") });
    if (altta) cubuk.parentElement?.querySelector(".zaman-sarmal")?.animate([{ transform: y }, { transform: "none" }], { duration: sure * 1.2, easing: stil.getPropertyValue("--egri-cikis") });
  }
  /** The bar + panel go down together; the keyboard takes over without motion. · Çubuk + panel birlikte iner; klavye devralırken hareket yok. */
  function panelCik() {
    if (!panel || !cubuk) return;
    const stil = getComputedStyle(document.documentElement);
    const sure = klavyeGeliyor ? 0 : parseFloat(stil.getPropertyValue("--sure-orta")) || 0;
    const h = panel.offsetHeight;
    if (sure === 0 || h === 0) return;
    kapaniyor = true;
    const sira = ++kapanisSirasi;
    // Out of the flow at once (the timeline gets its final size), then only transforms move. · Hemen akıştan çıkar (çizelge son boyunu alır), sonra yalnızca transform oynar.
    Object.assign(panel.style, { position: "absolute", left: "0", right: "0", top: "100%", height: `${h}px` });
    const a: [Keyframe[], KeyframeAnimationOptions] = [[{ transform: `translateY(${-h}px)` }, { transform: "none" }], { duration: sure, easing: stil.getPropertyValue("--egri-cikis") }];
    const bitti = () => {
      if (sira !== kapanisSirasi) return;
      kapaniyor = false;
      panel?.removeAttribute("style");
    };
    const oynat = cubuk.animate(...a);
    oynat.onfinish = bitti;
    oynat.oncancel = bitti;
    if (altta) cubuk.parentElement?.querySelector(".zaman-sarmal")?.animate(...a);
  }
  let klavyeGeliyor = false;
  function panelKapat() {
    klavyeGeliyor = false;
    if (panelKatmani) gezinme.katmanKapat(panelKatmani);
  }
  async function klavyeyeDon() {
    klavyeGeliyor = true;
    if (panelKatmani) gezinme.katmanKapat(panelKatmani);
    kutu?.blur();
    await tick();
    kutu?.focus({ preventScroll: true });
  }
  onDestroy(() => {
    if (panelKatmani) gezinme.katmanBirak(panelKatmani);
  });

  /** Deletes the selection or the character (whole emoji) before the caret · Seçimi ya da imleçten önceki karakteri (tam emojiyi) siler */
  function geriSil() {
    if (!kutu) return;
    const son = kutu.selectionEnd ?? deger.length;
    let bas = kutu.selectionStart ?? deger.length;
    if (bas === son) {
      const once = deger.slice(0, bas);
      const ozel = /:[^\s:]+:$/.exec(once);
      if (ozel && ozelEmoji[ozel[0].slice(1, -1)]) bas -= ozel[0].length;
      else bas -= [...new Intl.Segmenter("tr", { granularity: "grapheme" }).segment(once)].at(-1)?.segment.length ?? 0;
    }
    deger = deger.slice(0, bas) + deger.slice(son);
    imlecYaz(bas);
    degisti();
  }

  /** Text and caret are written at once (not on the next frame): two quick taps must land in order. · Metin ve imleç hemen yazılır (sonraki karede değil): iki hızlı dokunuş sırayla düşmeli. */
  function imlecYaz(yer: number) {
    if (!kutu) return;
    kutu.value = deger;
    kutu.setSelectionRange(yer, yer);
    boyutla();
    if (yer === deger.length) kutu.scrollTop = kutu.scrollHeight;
  }

  function emojiEkle(emoji: string) {
    const bas = kutu?.selectionStart ?? deger.length;
    const son = kutu?.selectionEnd ?? deger.length;
    deger = deger.slice(0, bas) + emoji + deger.slice(son);
    const yeni = bas + emoji.length;
    imlecYaz(yeni);
    degisti();
  }

  /** A custom emoji of a pack: the text gets `:shortcode:`, the mxc:// is remembered for sending · Paketten özel emoji: metne `:kisakod:` girer, mxc:// gönderim için hatırlanır */
  function ozelEmojiEkle(g: PaketGorseli) {
    const jeton = emojiJetonu(g);
    ozelEmoji[jeton] = g.mxc;
    emojiEkle(`:${jeton}:`);
  }

  /** A KLIPY GIF is sent as its plain link; the room draws it inline. · KLIPY GIF'i yalın bağlantısı olarak gönderilir; oda onu satır içi çizer. */
  function gifGonder(url: string) {
    panelKapat();
    gonder(url, null, yazma.yanit?.olayId ?? null);
    yazma.iptal();
  }

  async function cikartmaGonder(g: PaketGorseli) {
    panelKapat();
    const yanitOlayId = yazma.yanit?.olayId ?? null;
    // The strip goes at once; editing keeps its own mode (a sticker is not an edit). · Şerit hemen kalkar; düzenleme kipi durur (çıkartma düzenleme değildir).
    if (yazma.yanit) yazma.iptal();
    try {
      await cikartmaYolla({ odaId, yanitOlayId, mxc: g.mxc, metin: g.metin, genislik: g.genislik, yukseklik: g.yukseklik, mime: g.mime });
    } catch (e) {
      hataBildir(e);
    }
  }

  // The media flow registers its OWN back-button layer (medya/katman.ts → gezinme stack); registering here too would need two presses.
  // Medya akışı KENDİ geri tuşu katmanını kaydeder (medya/katman.ts → gezinme yığını); burada da kaydetmek iki basış gerektirirdi.
  function medyaAc(k: EkKaynagi) {
    ekAcik = false;
    // The poll sheet is not part of the media flow. · Anket sayfası medya akışının parçası değil.
    if (k === "anket") anketAcik = true;
    else if (k === "gifyap") {
      gifYap = true;
      medyaKaynak = "galeri";
    } else {
      gifYap = false;
      medyaKaynak = k;
    }
  }
  function medyaKapat() {
    medyaKaynak = null;
  }
</script>

<div class="yazma" class:panelli={emojiAcik} data-alt-cubuk bind:this={cubuk} bind:clientHeight={yukseklik}>
  <!-- "X is typing" now lives in the room header (design D) · "X yazıyor" artık oda başlığında (tasarım D) -->
  {#if yazma.duzenle}
    <YanitOnizleme tur="duzenle" metin={yazma.duzenle.metin ?? ""} iptal={() => yazma.iptal()} />
  {:else if yazma.yanit}
    <YanitOnizleme tur="yanit" ad={yazma.yanit.gonderenAd} metin={yazma.yanit.metin ?? (yazma.yanit.tur === "cikartma" ? t("yanit.cikartma") : t("yanit.mesaj"))} iptal={() => yazma.iptal()} />
  {/if}
  {#if cevrimdisi}
    <div class="cevrimdisi" role="status"><Ikon ad="saat" boyut={14} />{t("yazma.cevrimdisi")}</div>
  {/if}
  {#if !altta}
    <!-- Counted as a bottom bar, so toasts stay above it. mousedown is cancelled: the focus (and the keyboard) stays. · Alt çubuk sayılır, bildirimler üstünde durur. mousedown iptal: odak (ve klavye) kalır. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="inis" data-alt-cubuk onmousedown={(e) => e.preventDefault()}>
      <button class="in" class:var={yeniSayi > 0} onclick={enAlta} aria-label={yeniSayi > 0 ? t("oda.asagiInSayi", { n: yeniSayi }) : t("oda.asagiIn")}><Ikon ad="asagiOk" boyut={24} />{#if yeniSayi > 0}<span class="rozet sayi">{yeniSayi > 99 ? "99+" : yeniSayi}</span>{/if}</button>
    </div>
  {/if}
  <div class="satir">
    <!-- Pill: emoji / keyboard · text · attach · send. The round ends and the 44px buttons share a centre; send grows in from the right end when there is text. -->
    <!-- Hap: emoji / klavye · metin · ek · gönder. Yuvarlak uçlarla 44px düğmelerin merkezi ortaktır; yazı varken gönder sağ uçtan büyüyerek gelir. -->
    <div class="kutu kristal" class:odakta>
      <button class="uc" class:acik={emojiAcik} type="button" aria-pressed={emojiAcik} aria-label={emojiAcik ? t("emoji.klavye") : t("emoji.baslik")} onmousedown={(e) => e.preventDefault()} onclick={panelAc}><Ikon ad={emojiAcik ? "klavye" : "emoji"} boyut={24} /></button>
      <textarea
        bind:this={kutu}
        bind:value={deger}
        oninput={degisti}
        onkeydown={tus}
        onpointerdown={() => { if (emojiAcik) void klavyeyeDon(); }}
        onfocus={() => (odakta = true)}
        onblur={() => (odakta = false)}
        rows="1"
        inputmode={emojiAcik ? "none" : undefined}
        placeholder={t("oda.yazi")}
        aria-label={sifreli ? t("oda.yaziSifreli") : t("oda.yazi")}
      ></textarea>
      <button class="uc" type="button" aria-label={t("oda.ekle")} onclick={() => { panelKapat(); ekAcik = true; }}><Ikon ad="atac" boyut={24} /></button>
      <span class="gonder-yer" class:acik={yazili}>
        <button class="gonder" type="button" aria-label={t("oda.gonder")} disabled={!yazili} tabindex={yazili ? 0 : -1} onmousedown={(e) => e.preventDefault()} onclick={yolla}><Ikon ad={yazma.duzenle ? "onay" : "gonder"} boyut={22} /></button>
      </span>
    </div>
  </div>
  {#if panelKuruldu}
    <div class="emoji-panel" class:gizli={!emojiAcik && !kapaniyor} class:aramada={emojiAramada} bind:this={panel}>
      <EmojiPaneli acik={emojiAcik} ekle={emojiEkle} sil={geriSil} aramada={(a) => (emojiAramada = a)} odakGeri={() => kutu?.focus({ preventScroll: true })} {odaId} ozelEkle={ozelEmojiEkle} {cikartmaGonder} {gifGonder} />
    </div>
  {/if}
</div>

{#if ekAcik}<EkSayfasi sec={medyaAc} onkapat={() => (ekAcik = false)} />{/if}
{#if anketAcik}<AnketOlustur {odaId} onkapat={() => (anketAcik = false)} />{/if}
{#if medyaKaynak}
  <div class="medya-kap"><MedyaAkisi {odaId} kaynak={medyaKaynak} gif={gifYap} onkapat={medyaKapat} /></div>
{/if}

<style>
  /* Floats over the messages, like the header card. The phone's bottom inset is inside the keyboard's height, so it is not added twice. */
  /* Başlık kartı gibi mesajların üstünde yüzer. Telefonun alt payı klavye boyunun içindedir; iki kez eklenmez. */
  .yazma { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; padding-bottom: max(0px, calc(env(safe-area-inset-bottom) - var(--klavye-simdi, 0px))); pointer-events: none; }
  .yazma > :global(*) { pointer-events: auto; }
  .yazma > .satir, .yazma > .inis { pointer-events: none; }
  /* Messages fade out under the pill instead of being cut by a line · Mesajlar çizgiyle kesilmek yerine hapın altında solar */
  .yazma::before { content: ""; position: absolute; z-index: -1; inset: -16px 0 0; background: linear-gradient(transparent, var(--sohbet-zemin, var(--zemin)) 60%); pointer-events: none; }
  .panelli::before { display: none; }
  .yazma.panelli { padding-bottom: 0; }
  .cevrimdisi { display: flex; align-items: center; gap: 6px; min-height: 1.75rem; padding: .25rem 1rem 0; font-size: .75rem; font-weight: 500; color: var(--bekliyor); }
  .satir { display: flex; align-items: flex-end; gap: 8px; padding: 8px 8px 8px; }
  .panelli { background: var(--yuzey-1); border-top: 1px solid var(--kenar-ince); border-radius: 24px 24px 0 0; box-shadow: var(--kat-2); }
  .panelli .satir { padding-bottom: 4px; }
  /* 56px pill, 28px radius: a 44px button inset by 6px is concentric with the round end. · 56px hap, 28px yarıçap: 6px içeride duran 44px düğme yuvarlak uçla eşmerkezlidir. */
  .kutu { flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 4px; padding: 5px; border-radius: 28px; min-height: 56px; pointer-events: auto; transition: border-color var(--sure-hizli) var(--egri-cikis); }
  .kutu.odakta { border-color: var(--vurgu); }
  textarea {
    flex: 1; min-width: 0; min-height: 44px; resize: none; background: none; border: 0; outline: none;
    scrollbar-width: none; padding: 10px 0; line-height: 1.5rem; font-size: 1rem; color: var(--yazi);
  }
  textarea::placeholder { color: var(--yazi-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .uc { flex: none; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); transition: background var(--sure-hizli) var(--egri-cikis), color var(--sure-hizli) var(--egri-cikis); }
  .uc:active { background: var(--yuzey-3); }
  .uc.acik { background: var(--ton); color: var(--ton-ustu); }
  /* Send: a plain accent disc; its place opens from 0 to 48px while the glyph scales in · Gönder: düz vurgu dairesi; yeri 0'dan 48px'e açılırken simge büyür */
  .gonder-yer { flex: none; width: 0; margin-left: -4px; height: 44px; display: flex; justify-content: flex-end; overflow: hidden; border-radius: 22px; transition: width var(--sure-orta) var(--egri-cikis), margin var(--sure-orta) var(--egri-cikis); }
  .gonder-yer.acik { width: 44px; margin-left: 0; }
  .gonder { flex: none; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); transform: scale(.3); opacity: 0; transition: transform var(--sure-orta) var(--egri-yay-sakin, var(--egri-cikis)), opacity var(--sure-hizli) var(--egri-cikis); }
  .acik > .gonder { transform: none; opacity: 1; }
  /* Outside the flow: the bar (and the timeline padding measured from it) keeps its height · Akışın dışında: çubuğun (ve ondan ölçülen boşluğun) boyu değişmez */
  .inis { position: absolute; right: 14px; bottom: 100%; height: 48px; }
  .in { position: relative; pointer-events: auto; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--yuzey-2); color: var(--yazi); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); animation: in-gel var(--sure-orta) var(--egri-cikis) backwards; }
  .in.var { color: var(--vurgu); }
  @keyframes in-gel { from { transform: translateY(12px) scale(.7); opacity: 0; } }
  .sayi { position: absolute; top: -6px; right: -4px; border: 2px solid var(--zemin); }
  /* Same height as the keyboard it replaces; while the keyboard is still moving the two always add up to one height, so the box does not jump. */
  /* Yerini aldığı klavye kadar; klavye hâlâ hareket ederken ikisinin toplamı hep aynıdır, kutu zıplamaz. */
  .emoji-panel { box-sizing: border-box; display: flex; flex-direction: column; background: var(--yuzey-1); padding-bottom: max(0px, calc(env(safe-area-inset-bottom) - var(--klavye-simdi, 0px))); height: max(0px, calc(min(max(var(--klavye-son, 320px), 300px), 52vh + var(--klavye-simdi, 0px)) - var(--klavye-simdi, 0px))); overflow: hidden; }
  .emoji-panel.gizli { display: none; }
  /* Searching: as tall as the space above the keyboard allows, keeping the header and a message in sight. · Ararken: klavyenin üstündeki yer kadar; başlık ve bir mesaj görünür kalır. */
  .emoji-panel.aramada { height: clamp(11rem, calc(var(--gorunen-yukseklik, 100vh) - 17rem), 18rem); }
  /* Full-screen media flow sits above everything in the room (toasts are higher) · Tam ekran medya akışı odadaki her şeyin üstünde durur */
  .medya-kap { position: fixed; inset: 0; z-index: 35; background: var(--zemin); }
</style>
