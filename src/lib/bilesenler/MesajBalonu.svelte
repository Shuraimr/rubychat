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
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";
  import { saatYaz } from "../zaman-bicim";
  import Avatar from "./Avatar.svelte";
  import DurumIkonu from "./DurumIkonu.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    oge,
    konum,
    gonderenGoster = false,
    yeni = false,
    vurgulu = false,
    yenidenDene,
    menuAc,
  }: {
    oge: ZamanOgesi;
    konum: Konum;
    /** Show the sender name above the first bubble of a group (group rooms) · Grubun ilk balonunun üstünde gönderen adını göster (grup odaları) */
    gonderenGoster?: boolean;
    /** Arrived after the room was opened: plays the rise animation once · Oda açıldıktan sonra geldi: yükselme animasyonu bir kez oynar */
    yeni?: boolean;
    /** Its context menu is open: it stays above the dimmed scrim · Bağlam menüsü açık: kararan perdenin üstünde kalır */
    vurgulu?: boolean;
    yenidenDene: (ogeId: string) => void;
    menuAc: (x: number, y: number, oge: ZamanOgesi) => void;
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
  const bilinmeyen = $derived(!medya && !METIN.has(oge.tur) && oge.tur !== "sifre_cozulemedi" && oge.tur !== "arama");

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

  // ---- Long press (touch) and right click (desktop) · Uzun basma (dokunmatik) ve sağ tık (masaüstü) ----
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  let bx = 0;
  let by = 0;
  function bas(e: PointerEvent) {
    if (e.pointerType === "mouse") return;
    bx = e.clientX;
    by = e.clientY;
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => menuAc(bx, by, oge), 420);
  }
  function oynat(e: PointerEvent) {
    if (Math.hypot(e.clientX - bx, e.clientY - by) > 10) clearTimeout(zamanlayici);
  }
  const birak = () => clearTimeout(zamanlayici);
  function sagTik(e: MouseEvent) {
    e.preventDefault();
    menuAc(e.clientX, e.clientY, oge);
  }
</script>

{#if oge.tur === "arama"}
  <div class="sistem" class:cevapsiz={oge.arama?.sonuc === "cevapsiz"}>
    <Ikon ad="telefon" boyut={14} /><span>{aramaMetni}</span><span class="saat">{saatYaz(oge.zaman)}</span>
  </div>
{:else}
  <div class="satir {konum}" class:kendi={oge.kendi} class:yeni class:vurgulu>
    {#if !oge.kendi}
      <span class="avatar-yer">{#if sonMu}<Avatar harf={oge.gonderenAd.charAt(0).toUpperCase() || "#"} mxc={oge.gonderenAvatarMxc} boyut={32} />{/if}</span>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="balon {konum}"
      class:kendi={oge.kendi}
      class:sifre-yok={oge.tur === "sifre_cozulemedi"}
      class:medyali={medya}
      onpointerdown={bas}
      onpointermove={oynat}
      onpointerup={birak}
      onpointercancel={birak}
      oncontextmenu={sagTik}
    >
      {#if !oge.kendi && gonderenGoster && ilkMi}<div class="gonderen">{oge.gonderenAd}</div>{/if}

      {#if oge.tur === "sifre_cozulemedi"}
        <!-- Undecryptable (design: yellow card) · Çözülemiyor (tasarım: sarı kart) -->
        <div class="sifre-baslik"><Ikon ad="kilit" boyut={16} />{t("oda.sifreCozulemediBaslik")}</div>
        <div class="metin soluk">{t("oda.sifreCozulemedi")}</div>
        <!-- This device could unlock itself with the recovery key · Bu cihaz kurtarma anahtarıyla kendi kilidini açabilir -->
        {#if sifreleme.durum?.kurtarma === "eksik"}
          <button class="baglanti" onclick={() => sifreleme.ac("kurtarma-gir")}>{t("oda.anahtarGir")}</button>
        {/if}
      {:else if medya}
        <MedyaIcerik {oge} />
        <div class="meta alt-satir"><span>{saatYaz(oge.zaman)}</span>{#if oge.kendi}<DurumIkonu durum={oge.durum} />{/if}</div>
      {:else if bilinmeyen}
        <div class="metin soluk">{t("oda.desteklenmeyen")}</div>
      {:else}
        <div class="metin" class:soluk={oge.tur === "diger"}>{metin}<span class="meta"><span>{saatYaz(oge.zaman)}</span>{#if oge.kendi}<DurumIkonu durum={oge.durum} />{/if}</span></div>
      {/if}

      {#if oge.durum === "hata" && oge.kendi}
        <button class="tekrar" onclick={() => yenidenDene(oge.id)}><span class="kirmizi">{t("oda.gonderilemedi")}</span><span class="nokta-ayrac">·</span><span class="eylem">{t("eylem.yenidenDene")}</span></button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sistem {
    display: flex; align-items: center; justify-content: center; gap: 6px; margin: 10px 0 2px;
    font-size: .75rem; color: var(--yazi-2);
  }
  .sistem.cevapsiz { color: var(--hata); }
  .sistem .saat { opacity: .75; }

  .satir { display: flex; align-items: flex-end; gap: 8px; margin-top: 8px; }
  .satir.orta, .satir.son { margin-top: 2px; }
  .satir.kendi { justify-content: flex-end; }
  .avatar-yer { width: 32px; flex: none; }
  .satir.vurgulu { position: relative; z-index: 32; }

  /* Rise: a new message comes up 8px and fades in (200ms); own messages rise from the composer, a bit further. */
  /* Yükselme: yeni mesaj 8px aşağıdan yükselir ve solarak gelir (200ms); giden mesaj yazma alanından, biraz daha uzaktan yükselir. */
  .satir.yeni { animation: yuksel var(--sure-orta) var(--egri-cikis); }
  .satir.yeni.kendi { animation-name: yuksel-kendi; }
  @keyframes yuksel { from { transform: translateY(8px); opacity: 0; } }
  @keyframes yuksel-kendi { from { transform: translateY(24px); opacity: 0; } }

  .balon {
    max-width: min(78%, 560px); min-width: 0; padding: 8px 12px; border-radius: 16px;
    background: var(--yuzey-2); color: var(--yazi);
  }
  .balon.medyali { padding: 4px; }
  /* Corners that join a neighbouring bubble are 4px. Others: left side, own: right side. */
  /* Komşu balona bağlanan köşeler 4px. Başkalarınınki: sol taraf, kendininki: sağ taraf. */
  .balon.ilk { border-bottom-left-radius: 4px; }
  .balon.orta { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
  .balon.son { border-top-left-radius: 4px; }
  .balon.kendi { background: var(--ton); color: var(--ton-ustu); }
  .balon.kendi.ilk { border-bottom-left-radius: 16px; border-bottom-right-radius: 4px; }
  .balon.kendi.orta { border-top-left-radius: 16px; border-bottom-left-radius: 16px; border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
  .balon.kendi.son { border-top-left-radius: 16px; border-top-right-radius: 4px; }
  .balon.sifre-yok { background: color-mix(in srgb, var(--bekliyor) 14%, var(--yuzey-1)); border: 1px solid color-mix(in srgb, var(--bekliyor) 30%, transparent); }

  .gonderen { font-size: .8125rem; font-weight: 600; color: var(--vurgu); margin-bottom: 2px; }
  /* Text: on phones it is NOT selectable (long press opens the menu); with a mouse it is. Long words/links wrap. */
  /* Metin: telefonda seçilemez (uzun basma menüyü açar); fare ile seçilebilir. Uzun kelime/bağlantılar satır kırar. */
  .metin { font-size: .9375rem; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  @media (hover: hover) and (pointer: fine) { .metin { -webkit-user-select: text; user-select: text; } }
  .metin.soluk { color: var(--yazi-2); font-style: italic; }
  .balon.kendi .metin.soluk { color: inherit; opacity: .8; }
  .sifre-baslik { display: flex; align-items: center; gap: 6px; font-size: .875rem; font-weight: 600; color: var(--bekliyor); }
  .sifre-yok .metin { font-size: .8125rem; font-style: normal; }

  /* Time + status: floats to the right so it shares the last text line when there is room, else drops below. */
  /* Saat + durum: sağa yüzer; yer varsa son metin satırını paylaşır, yoksa alta düşer. */
  .meta { float: right; display: inline-flex; align-items: center; gap: 4px; margin: 6px 0 -2px 10px; font-size: .6875rem; line-height: 1; color: inherit; opacity: .7; font-style: normal; white-space: nowrap; }
  .meta.alt-satir { float: none; justify-content: flex-end; margin: 2px 4px 2px 0; }

  .baglanti { display: block; min-height: 44px; margin-top: 4px; padding: 0; color: var(--vurgu); font-size: .8125rem; font-weight: 600; text-align: left; }
  .tekrar {
    display: flex; align-items: center; gap: 6px; min-height: 44px; margin: 0 -6px -6px auto; padding: 0 8px; border-radius: 12px;
    font-size: .75rem; font-weight: 600; clear: both;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  .tekrar:active { background: var(--yuzey-3); }
  .kirmizi { color: var(--hata); }
  .nokta-ayrac { opacity: .6; }
  .eylem { color: var(--vurgu); }
</style>
