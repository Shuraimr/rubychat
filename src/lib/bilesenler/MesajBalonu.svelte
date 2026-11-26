<!--
  One message bubble (design section 6): others on the left (surface-2), own on the right (tone). Same sender within 5 min = a group:
  corners that join a neighbour are 4px (Tek / İlk / Orta / Son). Time + a 14px status icon sit at the bottom right and share the last
  text line when it fits. The normal state is never worded (no "gönderildi · şifreli"): only an icon, or the red "Yeniden dene" on failure.
  Media kinds are drawn by <MedyaIcerik> (owned by the media work); unknown kinds fall back to a plain line. Long press / right click
  opens the context menu (handled by the parent).
  Tek mesaj balonu (tasarım bölüm 6): başkalarınınki solda (yuzey-2), kendininki sağda (ton). 5 dk içinde aynı gönderen = grup: komşuya
  bağlanan köşeler 4px (Tek / İlk / Orta / Son). Saat + 14px durum simgesi sağ altta durur, sığarsa son metin satırını paylaşır.
  Normal durum asla yazıyla söylenmez ("gönderildi · şifreli" yok): yalnızca simge ya da başarısızlıkta kırmızı "Yeniden dene".
  Medya türlerini <MedyaIcerik> çizer (medya işine ait); bilinmeyen türler düz satıra düşer. Uzun basma / sağ tık bağlam menüsünü açar (üst bileşen işler).
-->
<script lang="ts" module>
  /** Position in a sender group · Gönderen grubundaki konum */
  export type Konum = "tek" | "ilk" | "orta" | "son";
</script>

<script lang="ts">
  import type { ZamanOgesi } from "../api/tipler";
  import MedyaIcerik from "../medya/MedyaIcerik.svelte";
  import { baglantilar, parcala } from "../baglanti/bul";
  import { kartGoster } from "../baglanti/onizleme";
  import { klipyBaglantisi } from "../gif/klipy";
  import { tercihler } from "../durum/tercihler.svelte";
  import { baglantiAc, baglantiBas } from "../durum/baglantiOnay.svelte";
  import BaglantiKarti from "./BaglantiKarti.svelte";
  import { uzunBasma } from "../dokunma";
  import { ciftDokun } from "../ciftDokun";
  import { kaydirYanit } from "../kaydirYanit";
  import { mesajaGit } from "../arama-mesaj/atla";
  import { katlamaDeseni } from "../arama-mesaj/vurgula";
  import { tepkiVer } from "../mesaj/eylemler";
  import type { Tepki } from "../api/tipler";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t } from "../i18n";
  import { saatYaz } from "../zaman-bicim";
  import AnketKarti from "./AnketKarti.svelte";
  import Avatar from "./Avatar.svelte";
  import BicimliMetin from "./BicimliMetin.svelte";
  import CikartmaGorsel from "./CikartmaGorsel.svelte";
  import DurumIkonu from "./DurumIkonu.svelte";
  import OkuyanAvatarlar from "./OkuyanAvatarlar.svelte";
  import TepkiSatiri from "./TepkiSatiri.svelte";
  import YanitAlintisi from "./YanitAlintisi.svelte";
  import Maskot from "./Maskot.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    oge,
    konum,
    uzak = false,
    gonderenGoster = false,
    yeni = false,
    vurgulu = false,
    secili = false,
    yenidenDene,
    vazgec,
    menuAc,
    eslesme = false,
    vurguSorgu = "",
    dm = false,
    okundu = false,
    yanitla,
    tepkiKimleri,
    okuyanlarAc,
  }: {
    oge: ZamanOgesi;
    konum: Konum;
    /** Far above the newest messages: painting may be skipped while off screen · En yeni mesajların epey üstünde: ekran dışındayken boyanmayabilir */
    uzak?: boolean;
    /** Show the sender name above the first bubble of a group (group rooms) · Grubun ilk balonunun üstünde gönderen adını göster (grup odaları) */
    gonderenGoster?: boolean;
    /** Arrived after the room was opened: plays the rise animation once · Oda açıldıktan sonra geldi: yükselme animasyonu bir kez oynar */
    yeni?: boolean;
    /** Its context menu is open: it stays above the dimmed scrim · Bağlam menüsü açık: kararan perdenin üstünde kalır */
    vurgulu?: boolean;
    /** Selected by keyboard shortcuts (data-imlec) · Klavye kısayollarıyla seçili (data-imlec) */
    secili?: boolean;
    yenidenDene: (ogeId: string) => void;
    /** Drop a message that could not be sent · Gönderilemeyen mesajdan vazgeç */
    vazgec: (oge: ZamanOgesi) => void;
    menuAc: (x: number, y: number, oge: ZamanOgesi) => void;
    /** The current in-chat search match: outlined · Sohbet içi aramanın şu anki eşleşmesi: çerçeveli */
    eslesme?: boolean;
    /** In-chat search text: its words are highlighted in the message · Sohbet içi arama metni: kelimeleri mesajda vurgulanır */
    vurguSorgu?: string;
    /** 1:1 chat: my messages show a double tick once read; group rooms show read avatars instead · 1:1 sohbet: mesajlarım okununca çift tik gösterir; grup odalarında onun yerine okundu avatarları çıkar */
    dm?: boolean;
    /** (DM) the other person has read up to this message · (DM) karşı kişi bu mesaja kadar okudu */
    okundu?: boolean;
    /** Swipe-right-to-reply fired · Sağa kaydırarak yanıtla çalıştı */
    yanitla: (oge: ZamanOgesi) => void;
    /** Long press on a reaction chip: who reacted · Tepki çipine uzun basma: kimler tepki verdi */
    tepkiKimleri: (oge: ZamanOgesi, tepki: Tepki) => void;
    /** Tap on the read avatars · Okundu avatarlarına dokunma */
    okuyanlarAc: (oge: ZamanOgesi) => void;
  } = $props();

  const ilkMi = $derived(konum === "tek" || konum === "ilk");
  const sonMu = $derived(konum === "tek" || konum === "son");

  // Kinds the media work draws. A string set on purpose: the media agent will add "video"/"dosya" to ZamanTuru later.
  // Medya işinin çizdiği türler. Bilerek string kümesi: medya işi ileride ZamanTuru'na "video"/"dosya" ekleyecek.
  const MEDYA = new Set<string>(["resim", "video", "dosya"]);
  const METIN = new Set<string>(["metin", "diger"]);
  const medya = $derived(MEDYA.has(oge.tur));
  const metin = $derived(oge.tur === "diger" ? (oge.metin ?? t("oda.desteklenmeyen")) : (oge.metin ?? ""));
  // Anything that is not text, media, call or undecryptable (a future kind) shows a plain line instead of an empty bubble. · Metin, medya, arama ya da çözülemeyen dışındaki (gelecekteki) türler boş balon yerine düz satır gösterir.
  const bilinmeyen = $derived(!medya && !METIN.has(oge.tur) && !["sifre_cozulemedi", "arama", "silindi", "cikartma", "anket"].includes(oge.tur));

  // "Sesli arama · 3 dk" / "Cevapsız arama" / "Arama reddedildi"
  const aramaMetni = $derived.by(() => {
    const a = oge.arama;
    if (!a) return t("arama.satir.bilinmiyor");
    if (a.sonuc === "yapildi") {
      if (a.sureSn === null) return t("arama.satir.yapildi");
      const sure = a.sureSn >= 60 ? t("arama.dk", { n: Math.round(a.sureSn / 60) }) : t("arama.sn", { n: a.sureSn });
      return t("arama.satir.yapildiSure", { sure });
    }
    return t(`arama.satir.${a.sonuc}`);
  });

  // Split the text into plain / highlighted parts for the search words. · Metni arama kelimelerine göre düz / vurgulu parçalara böl.
  const parcalar = $derived.by(() => {
    const m = metin;
    const kelimeler = vurguSorgu.trim().split(/\s+/).filter((k) => k.length > 1).map(katlamaDeseni);
    const re = kelimeler.length ? new RegExp(`(${kelimeler.join("|")})`, "gi") : null;
    const sonuc: { m: string; v: boolean; url: boolean }[] = [];
    for (const p of parcala(m)) {
      if (p.url || !re) sonuc.push({ m: p.m, v: false, url: p.url });
      else for (const [i, x] of p.m.split(re).entries()) if (x) sonuc.push({ m: x, v: i % 2 === 1, url: false });
    }
    return sonuc;
  });
  // Rich cards for the first two links of a text message (network parts are gated inside the card) · Metin mesajındaki ilk iki bağlantı için zengin kartlar (ağ kısımları kartın içinde sınırlanır)
  const kartlar = $derived(oge.tur === "metin" && kartGoster() ? baglantilar(oge.metin) : []);
  const odaId = $derived(zaman.bilgi?.id);
  // A bare KLIPY link is drawn as a muted, looping picture (respects the link-preview privacy settings: off = plain link; encrypted rooms need "önizle")
  // Yalın bir KLIPY bağlantısı sessiz, döngülü resim olarak çizilir (bağlantı önizleme gizlilik ayarlarına uyar: kapalı = düz bağlantı; şifreli odalar "önizle" ister)
  const gifUrl = $derived(oge.tur === "metin" && tercihler.d.baglantiOnizleme === "hepsi" && (!zaman.bilgi?.sifreli || tercihler.d.sifreliOnizle) ? klipyBaglantisi(oge.metin) : null);

  // A message can be replied to when it is a real, delivered event (not deleted / undecryptable / a system line). · Gerçek, ulaşmış bir olay yanıtlanabilir (silinmiş / çözülemeyen / sistem satırı değil).
  const yanitlanabilir = $derived(!!oge.olayId && oge.durum === "gonderildi" && !["silindi", "sifre_cozulemedi", "arama", "tarih_ayirici", "okunmamis_ayirici"].includes(oge.tur));
  const cikartma = $derived(oge.tur === "cikartma");
  const yanitAlintisiVar = $derived(!!oge.yanit && !["silindi", "sifre_cozulemedi"].includes(oge.tur));

  // Double tap = ❤️ (adds only; taking it back is a tap on the reaction chip, so an accidental third tap removes nothing).
  // Çift dokunma = ❤️ (yalnızca ekler; geri almak tepki çipine dokunmaktır, yanlışlıkla üçüncü dokunuş bir şey silmez).
  let kalp = $state(0);
  function kalpBirak() {
    kalp++;
    if (!oge.tepkiler.some((r) => r.anahtar === "❤️" && r.benim)) void tepkiVer(oge, "❤️");
  }
</script>

{#snippet saatSatiri(sinif: string)}
  <span class={sinif}>{#if oge.duzenlendi}<span class="duzenlendi">{t("mesaj.duzenlendi")}</span>{/if}<span>{saatYaz(oge.zaman)}</span>{#if oge.kendi}<DurumIkonu durum={oge.durum} okundu={dm && okundu} />{/if}</span>
{/snippet}

{#if oge.tur === "arama"}
  <div class="sistem" class:cevapsiz={oge.arama?.sonuc === "cevapsiz"}>
    <Ikon ad="telefon" boyut={14} /><span>{aramaMetni}</span><span class="saat">{saatYaz(oge.zaman)}</span>
  </div>
{:else}
  <!-- data-olay-id: the jump logic (search result, reply quote, pinned bar) finds the row through it · data-olay-id: atlama mantığı (arama sonucu, yanıt alıntısı, sabit çubuğu) satırı bununla bulur -->
  <div
    class="satir {konum}"
    class:kendi={oge.kendi}
    class:yeni
    class:vurgulu
    class:uzak={uzak && !vurgulu && !secili}
    data-olay-id={oge.olayId ?? undefined}
    data-imlec={secili ? "" : undefined}
    use:kaydirYanit={{ ac: () => yanitla(oge), etkin: yanitlanabilir }}
    use:ciftDokun={{ ac: kalpBirak, etkin: yanitlanabilir }}
  >
    <span class="yanit-ipucu" aria-hidden="true"><Ikon ad="yanitla" boyut={20} /></span>
    {#if !oge.kendi}
      <span class="avatar-yer">{#if sonMu}<button class="avatar-dugme" aria-label={oge.gonderenAd} onclick={() => kullaniciKartiAc(oge.gonderen, odaId, oge.gonderenAd, oge.gonderenAvatarMxc)}><Avatar harf={oge.gonderenAd.charAt(0).toUpperCase() || "#"} mxc={oge.gonderenAvatarMxc} boyut={32} /></button>{/if}</span>
    {/if}
    <div class="kolon">
      {#if kalp}{#key kalp}<span class="kalp" aria-hidden="true"><svg viewBox="0 0 24 24" width="56" height="56"><path fill="currentColor" d="M12 21s-8.5-5.2-8.5-11.4A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.5 3C20.500 15.800 12 21 12 21Z"/></svg></span>{/key}{/if}
      {#if cikartma}
        <!-- A sticker has no bubble: just the image with a small time chip -->
        <!-- Çıkartmanın balonu yok: yalnızca resim ve küçük bir saat çipi -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="cikartma-kap" use:uzunBasma={{ ac: (x, y) => menuAc(x, y, oge) }}>
          {#if !oge.kendi && gonderenGoster && ilkMi}<button class="gonderen" onclick={() => kullaniciKartiAc(oge.gonderen, odaId, oge.gonderenAd, oge.gonderenAvatarMxc)}>{oge.gonderenAd}</button>{/if}
          {#if oge.yanit}<div class="cikartma-yanit"><YanitAlintisi yanit={oge.yanit} git={(id) => odaId && void mesajaGit(odaId, id)} /></div>{/if}
          <CikartmaGorsel {oge} />
          {@render saatSatiri("cikartma-saat")}
        </div>
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="balon {konum}"
          class:kendi={oge.kendi}
          class:sifre-yok={oge.tur === "sifre_cozulemedi"}
          class:medyali={medya}
          class:eslesme
          use:uzunBasma={{ ac: (x, y) => menuAc(x, y, oge) }}
        >
          {#if !oge.kendi && gonderenGoster && ilkMi}<button class="gonderen" onclick={() => kullaniciKartiAc(oge.gonderen, odaId, oge.gonderenAd, oge.gonderenAvatarMxc)}>{oge.gonderenAd}</button>{/if}

          {#if yanitAlintisiVar && oge.yanit}<YanitAlintisi yanit={oge.yanit} git={(id) => odaId && void mesajaGit(odaId, id)} />{/if}

          {#if oge.tur === "sifre_cozulemedi"}
            <!-- Undecryptable (design: yellow card) · Çözülemiyor (tasarım: sarı kart) -->
            <div class="sifre-baslik"><Ikon ad="kilit" boyut={16} />{t("oda.sifreCozulemediBaslik")}</div>
            <div class="metin soluk">{t("oda.sifreCozulemedi")}</div>
            <!-- This device could unlock itself with the recovery key · Bu cihaz kurtarma anahtarıyla kendi kilidini açabilir -->
            {#if sifreleme.durum?.kurtarma === "eksik"}
              <button class="baglanti" onclick={() => sifreleme.ac("kurtarma-gir")}>{t("oda.anahtarGir")}</button>
            {/if}
          {:else if oge.tur === "silindi"}
            <!-- Deleted: the row stays so the conversation still makes sense -->
            <!-- Silinmiş: konuşma anlamlı kalsın diye satır durur -->
            <div class="metin soluk silindi"><Ikon ad="cop" boyut={14} />{t("mesaj.silindi")}{@render saatSatiri("meta")}</div>
          {:else if oge.tur === "anket"}
            <AnketKarti {oge} />
            {@render saatSatiri("meta alt-satir")}
          {:else if medya}
            <MedyaIcerik {oge} />
            {@render saatSatiri("meta alt-satir")}
          {:else if gifUrl}
            <div class="gif-kart">
              {#if /\.(mp4|webm)$/i.test(gifUrl)}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video src={gifUrl} autoplay muted loop playsinline preload="metadata"></video>
              {:else}
                <img src={gifUrl} alt="GIF" loading="lazy" draggable="false" />
              {/if}
              <span class="klipy">KLIPY</span>
            </div>
            {@render saatSatiri("meta alt-satir")}
          {:else if bilinmeyen}
            <div class="metin soluk">{t("oda.desteklenmeyen")}</div>
          {:else}
            <div class="metin" class:soluk={oge.tur === "diger"}>
              <!-- In-chat search highlights work on the plain text, so a formatted message shows its HTML only while no search is active. · Sohbet içi arama vurgusu düz metinde çalışır; biçimli mesaj HTML'ini yalnızca arama etkin değilken gösterir. -->
              {#if oge.html && !vurguSorgu.trim()}<BicimliMetin html={oge.html} {odaId} />{:else}{#each parcalar as p, i (i)}{#if p.url}<button class="baglanti-metin" use:baglantiBas={p.m} onclick={() => baglantiAc(p.m)}>{p.m}</button>{:else if p.v}<mark>{p.m}</mark>{:else}{p.m}{/if}{/each}{/if}
              {@render saatSatiri("meta")}
            </div>
            {#each kartlar as k (k.url)}<BaglantiKarti b={k} sifreli={zaman.bilgi?.sifreli ?? false} />{/each}
          {/if}

          {#if oge.durum === "hata" && oge.kendi}
            <div class="basarisiz">
            <button class="tekrar" onclick={() => yenidenDene(oge.id)}><Maskot poz="hata" boyut={28} /><span class="kirmizi">{t("oda.gonderilemedi")}</span><span class="nokta-ayrac">·</span><span class="eylem">{t("eylem.yenidenDene")}</span></button>
            <button class="tekrar sil" onclick={() => vazgec(oge)}><Ikon ad="cop" boyut={16} />{t("sil.sil")}</button>
            </div>
          {/if}
        </div>
      {/if}

      {#if oge.tepkiler.length > 0}
        <TepkiSatiri tepkiler={oge.tepkiler} tikla={(k) => void tepkiVer(oge, k)} uzun={(r) => tepkiKimleri(oge, r)} />
      {/if}
      {#if !dm && oge.okuyanlar.length > 0}
        <OkuyanAvatarlar kisiler={oge.okuyanlar} ac={() => okuyanlarAc(oge)} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .sistem {
    display: flex; align-items: center; justify-content: center; gap: .375em; margin: .625em 0 .125em;
    font-size: .75em; color: var(--yazi-2);
  }
  .sistem.cevapsiz { color: var(--hata); }
  .sistem .saat { opacity: .75; }

  .satir { contain: layout style; position: relative; display: flex; align-items: flex-end; gap: .5em; margin-top: var(--grup-aralik, .5em); }
  /* The column holds the bubble and what hangs under it (reactions, read avatars). It also moves with the swipe-to-reply drag.
     Sütun balonu ve altında asılı olanları (tepkiler, okundu avatarları) taşır. Yanıt için kaydırma sürüklemesiyle de kayar. */
  .kolon { position: relative; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: min(78%, 35em); transform: translate3d(var(--kay-x, 0px), 0, 0); transition: transform var(--sure-ekran) var(--egri-ac); }
  :global([data-yogunluk="kompakt"]) .kolon { max-width: min(84%, 40em); }
  .satir.kendi .kolon { align-items: flex-end; }
  .satir:global(.kayiyor) .kolon { transition: none; }
  .yanit-ipucu { position: absolute; right: 6px; top: 50%; margin-top: -12px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; color: var(--vurgu); background: var(--yuzey-3); opacity: var(--kay-o, 0); pointer-events: none; }
  .satir.orta, .satir.son { margin-top: var(--balon-aralik, 2px); }
  .satir.kendi { justify-content: flex-end; }
  .avatar-yer { width: var(--sohbet-avatar, 2em); flex: none; }
  .avatar-yer :global(.avatar) {
    width: var(--sohbet-avatar, 2em) !important;
    height: var(--sohbet-avatar, 2em) !important;
    border-radius: calc(var(--sohbet-avatar, 2em) * 0.25) !important;
    font-size: calc(var(--sohbet-avatar, 2em) * 0.42) !important;
  }
  /* Keep >=44px hit target around the avatar at every density/zoom without shifting layout. */
  /* Her yoğunluk ve ölçekte düzeni kaydırmadan avatarın çevresinde >=44px dokunma alanı koru. */
  .avatar-dugme { display: block; margin: min(0px, calc((var(--sohbet-avatar, 2em) - 44px) / 2)); padding: max(0px, calc((44px - var(--sohbet-avatar, 2em)) / 2)); border-radius: 14px; }
  /* Off-screen old rows cost nothing. The clip margin keeps tails, hearts and reactions that stick out of the row. */
  /* Ekran dışı eski satırlar bedava. Kırpma payı satırdan taşan kuyruk, kalp ve tepkileri korur. */
  .satir.uzak { content-visibility: auto; contain-intrinsic-size: auto 4em; overflow-clip-margin: 32px; }
  .satir.vurgulu { position: relative; z-index: 32; }

  /* Rise: only newly arriving messages animate; short, smooth transform + opacity. */
  /* Yükselme: yalnızca yeni gelen mesajlar canlanır; kısa ve akıcı transform + opacity. */
  .satir.yeni { animation: yuksel var(--sure-orta) var(--egri-ac); }
  .satir.yeni.kendi { animation-name: yuksel-kendi; animation-duration: var(--sure-ekran); animation-timing-function: var(--egri-ac); }
  @keyframes yuksel { from { transform: translate3d(0, 10px, 0) scale(.98); opacity: 0; } }
  @keyframes yuksel-kendi { from { transform: translate3d(0, 18px, 0) scale(.94); opacity: 0; transform-origin: 100% 100%; } }

  .balon {
    --balon-bg: var(--gelen-dolgu);
    position: relative; max-width: 100%; min-width: 0; padding: var(--balon-dolgu, .5em .75em); border-radius: var(--balon-r, 1.25em);
    background: var(--balon-bg); color: var(--yazi); box-shadow: var(--kat-1);
  }
  /* TAIL (Telegram style): the last bubble of a group (and a lone one) gets a small curved tail at its bottom outer corner. It is a
     masked square filled with the bubble colour, so it follows every theme; the bubble's own corner there is square so they join.
     KUYRUK (Telegram tarzı): grubun son balonu (ve tek balon) alt dış köşesinde küçük kıvrımlı bir kuyruk alır. Balon rengiyle dolu maskeli
     bir karedir, her temayı izler; balonun o köşesi kare olur, böylece birleşirler. */
  .balon.tek:not(.medyali)::after, .balon.son:not(.medyali)::after {
    content: ""; position: absolute; bottom: 0; width: .75em; height: .875em; background: var(--balon-bg); pointer-events: none;
    left: -.6875em; -webkit-mask: var(--kuyruk-sol) no-repeat center / 100% 100%; mask: var(--kuyruk-sol) no-repeat center / 100% 100%;
  }
  .balon.kendi.tek:not(.medyali)::after, .balon.kendi.son:not(.medyali)::after { left: auto; right: -.6875em; -webkit-mask-image: var(--kuyruk-sag); mask-image: var(--kuyruk-sag); }
  .balon.tek:not(.kendi):not(.medyali), .balon.son:not(.kendi):not(.medyali) { border-bottom-left-radius: 0; }
  .balon.tek.kendi:not(.medyali), .balon.son.kendi:not(.medyali) { border-bottom-right-radius: 0; }
  .balon.medyali { padding: 4px; }
  .gif-kart { position: relative; border-radius: .75em; overflow: hidden; max-width: min(100%, 16em); }
  .gif-kart img, .gif-kart video { display: block; width: 100%; height: auto; }
  .klipy { position: absolute; left: .375rem; bottom: .375rem; padding: .0625rem .375rem; border-radius: .375rem; font-size: .625rem; font-weight: 700; letter-spacing: .04em; background: rgb(0 0 0 / .55); color: #fff; }
  /* Corners that join a neighbouring bubble are 4px. Others: left side, own: right side. */
  /* Komşu balona bağlanan köşeler 4px. Başkalarınınki: sol taraf, kendininki: sağ taraf. */
  .balon.ilk { border-bottom-left-radius: 4px; }
  .balon.orta { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
  .balon.son { border-top-left-radius: 4px; }
  .balon.kendi { --balon-bg: var(--giden-bg, var(--giden-dolgu)); color: var(--giden-yazi, var(--yazi)); }
  .balon.kendi.ilk { border-bottom-left-radius: var(--balon-r, 1.25em); border-bottom-right-radius: 4px; }
  .balon.kendi.orta { border-top-left-radius: var(--balon-r, 1.25em); border-bottom-left-radius: var(--balon-r, 1.25em); border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
  .balon.kendi.son { border-top-left-radius: var(--balon-r, 1.25em); border-top-right-radius: 4px; }
  .balon.sifre-yok { --balon-bg: color-mix(in srgb, var(--bekliyor) 14%, var(--yuzey-1)); border: 1px solid color-mix(in srgb, var(--bekliyor) 30%, transparent); }

  .gonderen { display: block; min-height: 1.625em; margin: -.2em 0 -.1em; font-size: .8125em; font-weight: 600; color: var(--vurgu); text-align: left; }
  /* In-chat search: the current match is outlined, search words highlighted · Sohbet içi arama: şu anki eşleşme çerçeveli, aranan kelimeler vurgulu */
  .balon.eslesme { outline: 2px solid var(--bekliyor); outline-offset: 2px; }
  mark { background: color-mix(in srgb, var(--bekliyor) 38%, transparent); color: inherit; border-radius: 4px; padding: 0 1px; }
  /* Text: on phones it is NOT selectable (long press opens the menu); with a mouse it is. Long words/links wrap. */
  /* Metin: telefonda seçilemez (uzun basma menüyü açar); fare ile seçilebilir. Uzun kelime/bağlantılar satır kırar. */
  .metin { font-size: calc(.9375em * var(--sohbet-yazi, 1)); line-height: var(--sohbet-satir-yukseklik, 1.45); white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  @media (hover: hover) and (pointer: fine) { .metin { -webkit-user-select: text; user-select: text; } }
  .metin.soluk { color: var(--yazi-2); font-style: italic; }
  .balon.kendi .metin.soluk { color: inherit; opacity: .8; }
  .sifre-baslik { display: flex; align-items: center; gap: 6px; font-size: .875em; font-weight: 600; color: var(--bekliyor); }
  .sifre-yok .metin { font-size: .8125em; font-style: normal; }

  /* Time + status: floats to the right so it shares the last text line when there is room, else drops below. */
  /* Saat + durum: sağa yüzer; yer varsa son metin satırını paylaşır, yoksa alta düşer. */
  .meta { float: right; display: inline-flex; align-items: center; gap: .3em; margin: .5em 0 -.15em .85em; font-size: .6875em; line-height: 1; color: inherit; opacity: .78; font-style: normal; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .meta.alt-satir { float: none; justify-content: flex-end; margin: .2em .35em .2em 0; }
  .duzenlendi { font-style: italic; }
  .silindi { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .silindi .meta { margin-left: auto; }
  /* Sticker: no bubble; a small chip with the time sits over its corner · Çıkartma: balon yok; saat küçük bir çipte köşesinde durur */
  .cikartma-kap { position: relative; max-width: 100%; }
  .cikartma-yanit { max-width: 16em; margin-bottom: 4px; padding: .375em .5em; border-radius: .75em; background: var(--yuzey-1); box-shadow: var(--kat-1); }
  .cikartma-kap .gonderen { margin: 0 0 2px; }
  .cikartma-kap :global(.cikartma-saat) { position: absolute; right: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 8px; font-size: .6875em; line-height: 1.2; color: var(--yazi); background: color-mix(in srgb, var(--zemin) 72%, transparent); }

  .baglanti-metin { display: inline; padding: 0; text-align: left; color: inherit; text-decoration: underline; text-underline-offset: 2px; font: inherit; overflow-wrap: anywhere; -webkit-user-select: text; user-select: text; }
  .baglanti { display: block; min-height: 44px; margin-top: 4px; padding: 0; color: var(--vurgu); font-size: .8125em; font-weight: 600; text-align: left; }
  .tekrar {
    display: flex; align-items: center; gap: 6px; min-height: 44px; margin: 0 -6px -6px auto; padding: 0 8px; border-radius: 12px;
    font-size: .75em; font-weight: 600; clear: both;
  }
  .basarisiz { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0 12px; clear: both; }
  .tekrar.sil { margin-left: 0; color: var(--hata); }
  .tekrar:active { background: var(--yuzey-3); }
  .kirmizi { color: var(--hata); }
  .nokta-ayrac { opacity: .6; }
  .eylem { color: var(--vurgu); }
  /* Double-tap heart: pure transform + opacity (no filter drop-shadow); hidden in reduced motion. */
  /* Çift dokunma kalbi: yalnızca transform + opacity (filter drop-shadow yok); azaltılmış harekette gizli. */
  .kalp { position: absolute; z-index: 3; left: 50%; top: 50%; margin: -28px 0 0 -28px; color: var(--hata); pointer-events: none; opacity: 0; animation: kalp calc(720ms * var(--hareket)) var(--egri-cikis); }
  @media (prefers-reduced-motion: reduce) { .kalp { display: none; animation: none; } }
  :global([data-az-animasyon]) .kalp { display: none; animation: none; }
  @keyframes kalp {
    0% { opacity: 0; transform: scale(.25) rotate(-10deg); }
    20% { opacity: 1; transform: scale(1.2) rotate(-5deg); }
    36% { transform: scale(.96) rotate(-3deg); }
    50%, 72% { opacity: 1; transform: scale(1) rotate(-3deg); }
    100% { opacity: 0; transform: translate3d(0, -40px, 0) scale(.82); }
  }
</style>
