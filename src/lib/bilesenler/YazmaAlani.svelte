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
  import { titret } from "../dokunma";
  import { panodakiResim } from "../pano";
  import { onDestroy, untrack } from "svelte";
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
  import EmojiPaneli from "./EmojiPaneli.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
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
  type EkKaynagi = "galeri" | "kamera" | "dosya" | "anket";
  let deger = $state(untrack(() => odalar.taslaklar[odaId]) ?? "");
  let kutu: HTMLTextAreaElement | undefined = $state();
  let ekAcik = $state(false);
  let medyaKaynak = $state<Exclude<EkKaynagi, "anket"> | null>(null);
  let anketAcik = $state(false);
  let medyaKatmani = 0;
  /** Custom emoji inserted from packs: shortcode → mxc:// (turned into <img> when the message is sent) · Paketlerden eklenen özel emojiler: kısa kod → mxc:// (mesaj yollanırken <img> olur) */
  let ozelEmoji: Record<string, string> = {};

  const cevrimdisi = $derived(odalar.esitleme.durum === "cevrimdisi");
  const yazili = $derived(deger.trim().length > 0);

  /** Grow with the content up to 6 lines, at most 30% of the screen · İçerikle birlikte 6 satıra, en çok ekranın %30'una kadar büyür */
  function boyutla() {
    if (!kutu) return;
    kutu.style.height = "auto";
    kutu.style.height = `${Math.min(kutu.scrollHeight, Math.max(44, Math.min(6 * parseFloat(getComputedStyle(kutu).lineHeight) + 28, innerHeight * 0.3)))}px`;
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
    titret("dokunus");
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
    // WebKitGTK may fire no paste event at all for a picture: look at the clipboard ourselves. · WebKitGTK resim için hiç yapıştırma olayı vermeyebilir: panoya kendimiz bakarız.
    if (e.key.toLowerCase() === "v" && e.ctrlKey && !e.shiftKey && !e.altKey) {
      yapistirmaGeldi = false;
      setTimeout(() => {
        if (!yapistirmaGeldi) void panoResminiAc();
      }, 120);
    }
    // isComposing: do not send while an IME (e.g. mobile keyboard) is still composing a word
    // isComposing: telefon klavyesi gibi bir giriş yöntemi hâlâ kelime oluşturuyorken gönderme
    // With "Enter ile gönder" off, Enter inserts a newline and only the arrow sends. · "Enter ile gönder" kapalıyken Enter satır ekler, yalnızca ok gönderir.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && tercihler.d.enterGonder) {
      e.preventDefault();
      yolla();
    }
    if (e.key === "Escape" && (yazma.yanit || yazma.duzenle)) yazma.iptal();
  }

  // ---- Emoji card above the bar: the text and the keyboard stay where they are ----
  // ---- Çubuğun üstünde emoji kartı: metin ve klavye yerinde kalır ----
  let emojiAcik = $state(false);
  let panelKatmani = 0;
  /** Built on the first opening and kept: later openings only show it · İlk açılışta kurulur ve tutulur: sonraki açılışlar yalnızca gösterir */
  let panelKuruldu = $state(false);

  // Built quietly once the room has settled, so the first opening is only a movement and not a construction. · Oda oturunca sessizce kurulur; ilk açılış yalnızca hareket olur, kurulum değil.
  $effect(() => {
    const z = setTimeout(() => (panelKuruldu = true), 1500);
    return () => clearTimeout(z);
  });

  // Neither the bar nor the keyboard moves: the card only appears above them. · Ne çubuk ne klavye oynar: kart yalnızca üstlerinde belirir.
  function panelAc() {
    if (emojiAcik) return panelKapat();
    ekKapat();
    // Little room above the keyboard: let it go, or the card would be a slit. · Klavyenin üstünde yer az: klavye kapansın, yoksa kart ince bir şerit olurdu.
    if ((window.visualViewport?.height ?? innerHeight) < 460) kutu?.blur();
    panelKuruldu = true;
    emojiAcik = true;
    panelKatmani = gezinme.katmanAc(() => {
      panelKatmani = 0;
      emojiAcik = false;
    });
  }
  function panelKapat() {
    if (panelKatmani) gezinme.katmanKapat(panelKatmani);
  }
  // ---- Attach menu: the same kind of card above "+" ---- · ---- Ek menüsü: "+" üstünde aynı tür kart ----
  let ekKatmani = 0;
  const ekler: { id: EkKaynagi; ikon: IkonAdi; renk: string }[] = [
    { id: "galeri", ikon: "galeri", renk: "var(--tas-ametist)" },
    { id: "kamera", ikon: "kamera", renk: "var(--tas-safir)" },
    { id: "dosya", ikon: "dosya", renk: "var(--tas-zumrut)" },
    { id: "anket", ikon: "anket", renk: "var(--tas-kehribar)" },
  ];
  function ekAc() {
    if (ekAcik) return ekKapat();
    panelKapat();
    ekAcik = true;
    ekKatmani = gezinme.katmanAc(() => {
      ekKatmani = 0;
      ekAcik = false;
    });
  }
  function ekKapat() {
    if (ekKatmani) gezinme.katmanKapat(ekKatmani);
  }
  onDestroy(() => {
    if (ekKatmani) gezinme.katmanBirak(ekKatmani);
  });
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
    ekKapat();
    // The poll sheet is not part of the media flow. · Anket sayfası medya akışının parçası değil.
    if (k === "anket") anketAcik = true;
    else medyaKaynak = k;
  }
  // ---- Paste: pictures and files open the same send screen ---- · ---- Yapıştırma: resim ve dosyalar aynı gönderme ekranını açar ----
  let yapistirilan = $state<File[] | undefined>();
  let yapistirmaGeldi = false;
  function dosyalariAc(d: File[]) {
    if (medyaKaynak) return;
    yapistirilan = d;
    medyaKaynak = "dosya";
  }
  async function panoResminiAc() {
    const r = await panodakiResim();
    if (r) dosyalariAc([r]);
  }
  function yapistir(e: ClipboardEvent) {
    yapistirmaGeldi = true;
    const v = e.clipboardData;
    const dosyalar = Array.from(v?.files ?? []);
    if (dosyalar.length > 0) {
      e.preventDefault();
      dosyalariAc(dosyalar);
    } else if (!v?.getData("text/plain")) void panoResminiAc();
  }
  function medyaKapat() {
    medyaKaynak = null;
    yapistirilan = undefined;
  }
</script>

<div class="yazma" data-alt-cubuk bind:clientHeight={yukseklik}>
  <!-- "X is typing" now lives in the room header (design D) · "X yazıyor" artık oda başlığında (tasarım D) -->
  {#if yazma.duzenle}
    <YanitOnizleme tur="duzenle" metin={yazma.duzenle.metin ?? ""} iptal={() => yazma.iptal()} />
  {:else if yazma.yanit}
    <YanitOnizleme tur="yanit" ad={yazma.yanit.gonderenAd} metin={yazma.yanit.metin ?? (yazma.yanit.tur === "cikartma" ? t("yanit.cikartma") : t("yanit.mesaj"))} iptal={() => yazma.iptal()} />
  {/if}
  {#if cevrimdisi}
    <div class="cevrimdisi" role="status"><Ikon ad="saat" boyut={14} />{t("yazma.cevrimdisi")}</div>
  {/if}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  {#if emojiAcik || ekAcik}<div class="disari" onmousedown={(e) => e.preventDefault()} onclick={() => { panelKapat(); ekKapat(); }}></div>{/if}
  {#if !altta && !emojiAcik && !ekAcik}
    <!-- Counted as a bottom bar, so toasts stay above it. mousedown is cancelled: the focus (and the keyboard) stays. · Alt çubuk sayılır, bildirimler üstünde durur. mousedown iptal: odak (ve klavye) kalır. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="inis" data-alt-cubuk onmousedown={(e) => e.preventDefault()}>
      <button class="in" class:var={yeniSayi > 0} onclick={enAlta} aria-label={yeniSayi > 0 ? t("oda.asagiInSayi", { n: yeniSayi }) : t("oda.asagiIn")}><Ikon ad="asagiOk" boyut={24} />{#if yeniSayi > 0}<span class="rozet sayi">{yeniSayi > 99 ? "99+" : yeniSayi}</span>{/if}</button>
    </div>
  {/if}
  <div class="satir">
    <!-- Material You: tonal "+" · text pill with the emoji key at the thumb's side · send, which grows in when there is text. All 52px, bottom aligned. -->
    <!-- Material You: tonlu "+" · başparmak tarafında emoji tuşlu metin hapı · yazı varken büyüyerek gelen gönder. Hepsi 52px, alta hizalı. -->
    <button class="yan" class:acik={ekAcik} type="button" aria-expanded={ekAcik} aria-label={t("oda.ekle")} onmousedown={(e) => e.preventDefault()} onclick={() => { titret("tik"); ekAc(); }}><Ikon ad="artik" boyut={26} /></button>
    <div class="kutu">
      <textarea
        bind:this={kutu}
        bind:value={deger}
        oninput={degisti}
        onkeydown={tus}
        onpaste={yapistir}
        onpointerdown={() => { panelKapat(); ekKapat(); }}
        rows="1"
        placeholder={t("oda.yazi")}
        aria-label={sifreli ? t("oda.yaziSifreli") : t("oda.yazi")}
      ></textarea>
      <button class="uc" class:acik={emojiAcik} type="button" aria-pressed={emojiAcik} aria-label={t("emoji.baslik")} onmousedown={(e) => e.preventDefault()} onclick={() => { titret("tik"); panelAc(); }}><Ikon ad="emoji" boyut={26} /></button>
    </div>
    <span class="gonder-yer" class:acik={yazili}>
      <button class="gonder" type="button" aria-label={t("oda.gonder")} disabled={!yazili} tabindex={yazili ? 0 : -1} onmousedown={(e) => e.preventDefault()} onclick={yolla}><Ikon ad={yazma.duzenle ? "onay" : "gonder"} boyut={24} /></button>
    </span>
  </div>
  <div class="ek acilir" class:acik={ekAcik} inert={!ekAcik} role="menu" aria-label={t("ek.baslik")}>
    {#each ekler as e (e.id)}
      <button class="ek-satir" role="menuitem" data-dalga style:--r={e.renk} onmousedown={(o) => o.preventDefault()} onclick={() => medyaAc(e.id)}><span class="ek-simge"><Ikon ad={e.ikon} boyut={22} /></span><span class="ek-metin"><strong>{t(`ek.${e.id}`)}</strong><small>{t(`ek.${e.id}Alt`)}</small></span></button>
    {/each}
  </div>
  {#if panelKuruldu}
    <div class="emoji acilir" class:acik={emojiAcik} inert={!emojiAcik}>
      <EmojiPaneli acik={emojiAcik} ekle={emojiEkle} sil={geriSil} odakGeri={() => kutu?.focus({ preventScroll: true })} {odaId} ozelEkle={ozelEmojiEkle} {cikartmaGonder} {gifGonder} />
    </div>
  {/if}
</div>

{#if anketAcik}<AnketOlustur {odaId} onkapat={() => (anketAcik = false)} />{/if}
{#if medyaKaynak}
  <div class="medya-kap"><MedyaAkisi {odaId} kaynak={medyaKaynak} dosyalar={yapistirilan} onkapat={medyaKapat} /></div>
{/if}

<style>
  /* Floats over the messages, like the header card. The phone's bottom inset is inside the keyboard's height, so it is not added twice. */
  /* Başlık kartı gibi mesajların üstünde yüzer. Telefonun alt payı klavye boyunun içindedir; iki kez eklenmez. */
  .yazma { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; padding-bottom: max(0px, calc(env(safe-area-inset-bottom) - var(--klavye-simdi, 0px))); pointer-events: none; }
  .yazma > :global(*) { pointer-events: auto; }
  .yazma > .satir, .yazma > .inis { pointer-events: none; }
  /* Messages fade out under the pill instead of being cut by a line · Mesajlar çizgiyle kesilmek yerine hapın altında solar */
  .yazma::before { content: ""; position: absolute; z-index: -1; inset: -16px 0 0; background: linear-gradient(transparent, var(--sohbet-zemin, var(--zemin)) 60%); pointer-events: none; }
  .cevrimdisi { display: flex; align-items: center; gap: 6px; min-height: 1.75rem; padding: .25rem 1rem 0; font-size: .75rem; font-weight: 500; color: var(--bekliyor); }
  .satir { display: flex; align-items: flex-end; gap: .5rem; padding: .5rem .75rem; }
  .yan, .gonder { pointer-events: auto; flex: none; width: min(3.25rem, 54px); height: min(3.25rem, 54px); border-radius: 1.625rem; display: inline-flex; align-items: center; justify-content: center; }
  .yan { background: var(--ton); color: var(--ton-ustu); }
  /* Opaque tonal surface, no border: the shape itself is the field. · Opak tonlu yüzey, kenarlık yok: biçimin kendisi alandır. */
  .kutu { pointer-events: auto; flex: 1; min-width: 0; min-height: min(3.25rem, 54px); display: flex; align-items: flex-end; border-radius: 1.625rem; background: var(--yuzey-3); transition: border-radius var(--sure-orta) var(--egri-cikis); }
  textarea {
    flex: 1; min-width: 0; min-height: 44px; resize: none; background: none; border: 0; outline: none;
    scrollbar-width: none; padding: .875rem 0 .875rem min(1.25rem, 18px); line-height: 1.5rem; font-size: 1rem; color: var(--yazi);
  }
  textarea::placeholder { color: var(--yazi-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .uc { flex: none; width: min(3rem, 48px); height: min(3.25rem, 54px); border-radius: 1.5rem; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); transition: color var(--sure-orta) var(--egri-cikis); }
  .uc.acik { color: var(--vurgu); }
  /* Send: its place opens from 0 while the button scales in; squarer than the rest so it reads as the main action. · Gönder: yeri 0'dan açılırken düğme büyür; ana eylem olduğu için ötekilerden daha köşeli. */
  .gonder-yer { pointer-events: auto; flex: none; width: 0; margin-left: -.5rem; display: flex; justify-content: flex-end; overflow: hidden; border-radius: 1.125rem; transition: width var(--sure-orta) var(--egri-vurgulu), margin var(--sure-orta) var(--egri-vurgulu); }
  .gonder-yer.acik { width: min(3.25rem, 54px); margin-left: 0; }
  .gonder { border-radius: 1.125rem; background: var(--vurgu); color: var(--vurgu-ustu); transform: scale(.5); opacity: 0; transition: transform var(--sure-orta) var(--egri-vurgulu), opacity var(--sure-hizli) var(--egri-cikis); }
  .acik > .gonder { transform: none; opacity: 1; }
  /* Outside the flow: the bar (and the timeline padding measured from it) keeps its height · Akışın dışında: çubuğun (ve ondan ölçülen boşluğun) boyu değişmez */
  .inis { position: absolute; right: 14px; bottom: 100%; height: 48px; }
  .in { position: relative; pointer-events: auto; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--yuzey-2); color: var(--yazi); box-shadow: var(--kat-2); animation: in-gel var(--sure-orta) var(--egri-cikis) backwards; }
  .in.var { color: var(--vurgu); }
  @keyframes in-gel { from { transform: translateY(12px) scale(.7); opacity: 0; } }
  .sayi { position: absolute; top: -6px; right: -4px; border: 2px solid var(--zemin); }
  /* Popover cards above the bar; each grows from its own button. · Çubuğun üstündeki açılır kartlar; her biri kendi düğmesinden büyür. */
  /* Everything between the room header and the bar, never more: the card must not slide under the header. · Oda başlığıyla çubuk arası, fazlası değil: kart başlığın altına girmemeli. */
  .ek, .emoji { --kart-yer: calc(var(--gorunen-yukseklik, 100vh) - var(--tepe-yer, 88px) - var(--yazma-yer, 72px) - 12px); position: absolute; z-index: 4; bottom: 100%; box-sizing: border-box; }
  .ek { left: .75rem; width: max-content; min-width: 15.5rem; max-width: calc(100% - 1.5rem); max-height: var(--kart-yer); overflow-y: auto; padding: 8px; border-radius: 1.75rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; transform-origin: 1.6rem 100%; }
  .emoji { right: .75rem; width: min(26rem, calc(100% - 1.5rem)); height: min(22rem, var(--kart-yer)); border-radius: 1.75rem; display: flex; flex-direction: column; overflow: hidden; transform-origin: calc(100% - 2rem) 100%; }
  .ek-satir { position: relative; overflow: hidden; min-height: 3.75rem; padding: .5rem 1rem .5rem .625rem; display: flex; align-items: center; gap: .875rem; text-align: left; border-radius: .375rem; background: var(--yuzey-2); transition: background var(--sure-hizli) linear; }
  .ek-satir:first-child { border-top-left-radius: 1.25rem; border-top-right-radius: 1.25rem; }
  .ek-satir:last-child { border-bottom-left-radius: 1.25rem; border-bottom-right-radius: 1.25rem; }
  .ek-simge { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 1rem; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--r) 22%, transparent); color: var(--r); }
  .ek-metin { min-width: 0; display: grid; }
  .ek-metin strong { font-size: 1rem; font-weight: 500; line-height: 1.3; }
  .ek-metin small { font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); }
  /* Outside tap closes; messages stay readable, nothing dims. · Dışa dokunma kapatır; mesajlar okunur kalır, hiçbir şey kararmaz. */
  .disari { position: fixed; inset: 0; z-index: -1; }
  .yan :global(svg) { transition: transform var(--sure-orta) var(--egri-ac); }
  .yan.acik :global(svg) { transform: rotate(45deg); }
  /* Full-screen media flow sits above everything in the room (toasts are higher) · Tam ekran medya akışı odadaki her şeyin üstünde durur */
  .medya-kap { position: fixed; inset: 0; z-index: 35; background: var(--zemin); }
</style>
