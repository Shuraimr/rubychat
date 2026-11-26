<!--
  Full-screen media flow (design 10-medya): pick (gallery / camera / file) → preview + edit (crop, rotate, flip, quality with a size
  estimate, video trim + mute + 480p / 720p / original) → caption → send. Opened from the composer's attach sheet. It picks the files
  itself with a hidden <input type="file"> (on Android the WebView opens the system photo picker, which needs no storage permission).
  Sending hands the prepared items to durum/medya.svelte.ts and closes at once; compression and upload run in the background and show up
  as bubbles in the room (MedyaBekleyenler, then the SDK's local echo).
  Back button: the flow and its crop screen are history layers (katman.ts).
  Tam ekran medya akışı (10-medya tasarımı): seç (galeri / kamera / dosya) → önizle + düzenle (kırp, döndür, çevir, boyut tahminli kalite,
  video kesme + sessiz + 480p / 720p / orijinal) → açıklama → gönder. Yazma alanının ek sayfasından açılır. Dosyaları gizli bir
  <input type="file"> ile kendisi seçtirir (Android'de WebView, depolama izni istemeyen sistem fotoğraf seçicisini açar).
  Göndermek hazırlanan öğeleri durum/medya.svelte.ts'ye verir ve hemen kapanır; sıkıştırma ve yükleme arka planda sürer ve odada balon olarak
  görünür (MedyaBekleyenler, sonra SDK'nın yerel yankısı). Geri tuşu: akış ve kırpma ekranı history katmanlarıdır (katman.ts).
-->
<script lang="ts">
  import { menuCik } from "../gecis";
  import { onMount, tick } from "svelte";
  import type { MedyaTuru } from "../api/tipler";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { medya, type GonderilecekOge, type VideoAyari } from "../durum/medya.svelte";
  import {
    blobaCevir,
    bosDuzenleme,
    cizCanvas,
    duzenlendiMi,
    gorunenBoyut,
    resimUret,
    resmiCoz,
    tahminiResimBoyutu,
    UZUN_KENAR,
    type Duzenleme,
    type KirpAlani,
    type ResimKalitesi,
  } from "./isleme";
  import { tercihler } from "../durum/tercihler.svelte";
  import { katmanAc } from "./katman";
  import { boyutYaz, m, sureYaz } from "./metin";
  import { kareler, metaOku, tahminiVideoBoyutu, videoAc, type VideoKalitesi } from "./video";

  /**
   */
  let {
    odaId,
    kaynak,
    dosyalar,
    onkapat,
  }: {
    odaId: string;
    kaynak: "galeri" | "kamera" | "dosya";
    /** Pasted / dropped files: nothing is picked · Yapıştırılan / bırakılan dosyalar: seçim yapılmaz */
    dosyalar?: File[];
    onkapat: () => void;
  } = $props();

  interface Oge extends GonderilecekOge {
    id: number;
    /** blob URL of the file itself · dosyanın kendisinin blob adresi */
    url: string;
    /** `onizlemeUrl` doubles as the current preview (the file itself until the image is edited) · `onizlemeUrl` güncel önizlemedir (resim düzenlenene dek dosyanın kendisi) */
    kareler: string[];
    /** real encoded size for the current quality / edit, once measured · mevcut kalite / düzenleme için ölçülmüş gerçek kodlanmış boyut */
    gercekBoyut: number | null;
    duzenlenebilir: boolean;
  }

  const MAKS_OGE = 10;
  const KAREAD = 9;

  let kok: HTMLDivElement;
  let girdi: HTMLInputElement;
  let ogeler = $state<Oge[]>([]);
  let secili = $state(0);
  let ekran = $state<"onizleme" | "kirp">("onizleme");
  let okunuyor = $state(false);
  let aciklama = $state("");
  let kaliteMenusu = $state(false);
  let devredildi = false;
  let sayac = 0;

  const oge = $derived<Oge | undefined>(ogeler[secili]);
  const videoOlabilir = $derived(medya.yetenek.videoSikistirma);

  // ---- Layer / back button · Katman / geri tuşu ----
  let katman: ReturnType<typeof katmanAc> | undefined;
  let kirpKatman: ReturnType<typeof katmanAc> | undefined;

  onMount(() => {
    void medya.baslat();
    katman = katmanAc("medya-akis", onkapat);
    // Move to <body>: a transformed ancestor would break position: fixed. · <body>'ye taşı: dönüşümlü üst öğe position: fixed'i bozardı.
    document.body.appendChild(kok);
    // The attach sheet's tap is still a fresh user gesture, so the picker may open right away.
    // Ek sayfasındaki dokunma hâlâ taze bir kullanıcı hareketi; seçici hemen açılabilir.
    if (dosyalar) void al(dosyalar);
    else girdi.click();
    // Some Android WebViews never fire `cancel` when the picker is dismissed: when the page regains focus with nothing chosen, leave.
    // Bazı Android WebView'leri seçici kapatılınca `cancel` yollamaz: sayfa hiçbir şey seçilmeden odağı geri alınca akıştan çık.
    const odakGeldi = () =>
      setTimeout(() => {
        if (!ogeler.length && !okunuyor) secimIptal();
      }, 1200);
    if (!dosyalar) window.addEventListener("focus", odakGeldi, { once: true });
    return () => {
      window.removeEventListener("focus", odakGeldi);
      kirpKatman?.birak();
      katman?.birak();
      for (const o of ogeler) temizle(o);
      kok.remove();
    };
  });

  function temizle(o: Oge) {
    // Items handed to the send queue keep their preview URL and bitmap until sent. · Gönderim kuyruğuna verilen öğeler, gönderilene dek önizleme adresini ve bitmap'ini tutar.
    if (devredildi) return;
    if (o.onizlemeUrl) URL.revokeObjectURL(o.onizlemeUrl);
    if (o.url !== o.onizlemeUrl) URL.revokeObjectURL(o.url);
    o.bitmap?.close();
  }

  function kapat() {
    katman?.kapat();
  }

  // ---- Picking · Seçme ----
  const kabul = $derived(kaynak === "dosya" ? undefined : "image/*,video/*");

  async function sec() {
    const secilen = Array.from(girdi.files ?? []);
    girdi.value = "";
    await al(secilen);
  }

  async function al(gelen: File[]) {
    if (!gelen.length) return;
    okunuyor = true;
    for (const d of gelen) {
      if (ogeler.length >= MAKS_OGE) break;
      try {
        const o = await ogeHazirla(d);
        ogeler.push(o);
        if (ogeler.length === 1) secili = 0;
        // Frame thumbnails of a video are drawn in the background. · Videonun kare küçük resimleri arka planda çizilir.
        if (o.tur === "video") void kareleriCiz(o.id);
      } catch {
        bildirim.goster(m("okunamadi"), 3500, { tur: "hata" });
      }
    }
    okunuyor = false;
    if (!ogeler.length) kapat();
  }

  /** The user closed the picker without choosing: leave the flow (when nothing is chosen yet). · Kullanıcı seçmeden seçiciyi kapattı: akıştan çık (henüz seçili bir şey yoksa). */
  function secimIptal() {
    if (!ogeler.length) kapat();
  }

  async function ogeHazirla(d: File): Promise<Oge> {
    const url = URL.createObjectURL(d);
    const tur: MedyaTuru = d.type.startsWith("image/") ? "resim" : d.type.startsWith("video/") ? "video" : "dosya";
    const taban = {
      id: sayac++,
      dosya: d,
      tur,
      url,
      bitmap: null as ImageBitmap | null,
      videoEl: null as HTMLVideoElement | null,
      duz: bosDuzenleme(),
      kalite: tercihler.d.resimKalitesi as ResimKalitesi,
      video: null as VideoAyari | null,
      onizlemeUrl: url,
      kareler: [] as string[],
      gercekBoyut: null as number | null,
      duzenlenebilir: false,
    };
    if (tur === "resim") {
      taban.bitmap = await resmiCoz(d);
      // GIFs stay as they are (a canvas would flatten the animation); undecodable files (HEIC...) are sent untouched.
      // GIF'ler olduğu gibi kalır (canvas animasyonu düzleştirirdi); çözülemeyen dosyalar (HEIC...) dokunulmadan gider.
      taban.duzenlenebilir = !!taban.bitmap && d.type !== "image/gif";
    } else if (tur === "video") {
      const v = await videoAc(url);
      const meta = metaOku(v);
      taban.videoEl = v;
      taban.video = { sure: meta.sure, basla: 0, bitis: meta.sure, sessiz: false, kalite: "720", genislik: meta.genislik, yukseklik: meta.yukseklik };
    }
    return taban;
  }

  async function kareleriCiz(id: number) {
    const o = ogeler.find((x) => x.id === id);
    if (!o) return;
    try {
      // A separate element: the preview <video> and the poster element must not be seeked under each other.
      // Ayrı bir öğe: önizleme <video>'su ile poster öğesi birbirinin altında sarılmamalı.
      const v = await videoAc(o.url);
      const k = await kareler(v, KAREAD);
      const hala = ogeler.find((x) => x.id === id);
      if (hala) hala.kareler = k;
      v.removeAttribute("src");
      v.load();
    } catch {
      /* the strip stays empty · şerit boş kalır */
    }
  }

  // ---- Image preview, quality and size estimate · Resim önizleme, kalite ve boyut tahmini ----
  async function onizlemeYenile(o: Oge) {
    if (!o.bitmap) return;
    if (!duzenlendiMi(o.duz)) {
      if (o.onizlemeUrl !== o.url && o.onizlemeUrl) URL.revokeObjectURL(o.onizlemeUrl);
      o.onizlemeUrl = o.url;
      return;
    }
    const blob = await blobaCevir(cizCanvas(o.bitmap, o.duz, 1280), 0.8, 0.85);
    if (o.onizlemeUrl !== o.url && o.onizlemeUrl) URL.revokeObjectURL(o.onizlemeUrl);
    o.onizlemeUrl = URL.createObjectURL(blob);
  }

  const KALITE_AD: Record<ResimKalitesi, "kaliteStandart" | "kaliteYuksek" | "kaliteOrijinal"> = {
    standart: "kaliteStandart",
    yuksek: "kaliteYuksek",
    orijinal: "kaliteOrijinal",
  };

  // Real measurement, debounced: re-encode the current image at the current quality and keep its size.
  // Gerçek ölçüm, geciktirilmiş: mevcut resmi mevcut kalitede yeniden kodla ve boyutunu tut.
  $effect(() => {
    const o = oge;
    if (!o || o.tur !== "resim" || !o.bitmap) return;
    const anahtar = `${o.id}|${o.kalite}|${JSON.stringify(o.duz)}`;
    o.gercekBoyut = null;
    const t = setTimeout(async () => {
      if (o.kalite === "orijinal" && !duzenlendiMi(o.duz)) {
        o.gercekBoyut = o.dosya.size;
        return;
      }
      try {
        const h = await resimUret(o.bitmap!, o.duz, o.kalite);
        if (`${o.id}|${o.kalite}|${JSON.stringify(o.duz)}` === anahtar) o.gercekBoyut = h.blob.size;
      } catch {
        /* keep the estimate · tahmin kalsın */
      }
    }, 350);
    return () => clearTimeout(t);
  });

  const resimBoyutu = $derived.by(() => {
    const o = oge;
    if (!o || o.tur !== "resim") return 0;
    if (!o.bitmap) return o.dosya.size;
    return o.gercekBoyut ?? tahminiResimBoyutu(o.bitmap, o.duz, o.kalite);
  });

  function dondur(o: Oge) {
    o.duz.dondur = ((o.duz.dondur + 90) % 360) as Duzenleme["dondur"];
    o.duz.kirp = null; // the crop was drawn for the old orientation · kırpma eski yön için çizilmişti
    void onizlemeYenile(o);
  }

  function kaldir(i: number) {
    const [o] = ogeler.splice(i, 1);
    temizle(o);
    if (!ogeler.length) {
      kapat();
      return;
    }
    secili = Math.min(secili, ogeler.length - 1);
  }

  // ---- Crop screen · Kırpma ekranı ----
  type Dikdortgen = { x: number; y: number; w: number; h: number };
  let kirpTaban = $state<string | null>(null);
  let kirpImg = $state<HTMLImageElement>();
  let kutu = $state({ g: 0, y: 0 });
  let alan = $state<Dikdortgen>({ x: 0, y: 0, w: 0, h: 0 });
  let oran = $state<number | null>(null);
  let kilavuz = $state(false);
  let yedekDuz: Duzenleme | null = null;
  let kirpOnay = false;
  let surukle: { tur: "tasi" | "nw" | "ne" | "sw" | "se"; ox: number; oy: number; r: Dikdortgen } | null = null;

  const MIN = 48;

  async function kirpAc() {
    const o = oge;
    if (!o || !o.bitmap) return;
    yedekDuz = structuredClone($state.snapshot(o.duz));
    kirpOnay = false;
    oran = null;
    await tabaniCiz(o);
    ekran = "kirp";
    kirpKatman = katmanAc("medya-kirp", () => {
      // Pop = leave the crop screen; without "Bitti" it counts as "İptal". · Pop = kırpma ekranından çık; "Bitti" yoksa "İptal" sayılır.
      if (!kirpOnay && yedekDuz && oge) oge.duz = yedekDuz;
      ekran = "onizleme";
      kirpKatman = undefined;
      if (kirpTaban) URL.revokeObjectURL(kirpTaban);
      kirpTaban = null;
      if (oge) void onizlemeYenile(oge);
    });
  }

  /** The un-cropped base picture (rotate + flip applied) the crop rectangle sits on. · Kırpma dikdörtgeninin üstünde durduğu kırpılmamış taban resim (döndür + çevir uygulanmış). */
  async function tabaniCiz(o: Oge) {
    const taban: Duzenleme = { dondur: o.duz.dondur, cevir: o.duz.cevir, kirp: null };
    const blob = await blobaCevir(cizCanvas(o.bitmap!, taban, 1400), 0.8, 0.85);
    if (kirpTaban) URL.revokeObjectURL(kirpTaban);
    kirpTaban = URL.createObjectURL(blob);
  }

  async function kirpYuklendi() {
    await tick();
    if (!kirpImg || !oge?.bitmap) return;
    const r = kirpImg.getBoundingClientRect();
    kutu = { g: r.width, y: r.height };
    const k = oge.duz.kirp;
    alan = k ? { x: k.x * r.width, y: k.y * r.height, w: k.w * r.width, h: k.h * r.height } : { x: 0, y: 0, w: r.width, h: r.height };
    if (oran) oranUygula(oran);
  }

  function oranSec(o: number | null) {
    oran = o;
    if (o) oranUygula(o);
  }

  /** Largest centred rectangle with the ratio w / h (the base picture has the image's own proportions). · w / h oranlı en büyük ortalı dikdörtgen (taban resim resmin kendi oranındadır). */
  function oranUygula(o: number) {
    const w = Math.min(kutu.g, kutu.y * o);
    const h = w / o;
    alan = { x: (kutu.g - w) / 2, y: (kutu.y - h) / 2, w, h };
  }

  function tutBasla(e: PointerEvent, tur: "tasi" | "nw" | "ne" | "sw" | "se") {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    surukle = { tur, ox: e.clientX, oy: e.clientY, r: { ...alan } };
    kilavuz = true;
  }

  const sinirla = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  function tutHareket(e: PointerEvent) {
    if (!surukle) return;
    const dx = e.clientX - surukle.ox;
    const dy = e.clientY - surukle.oy;
    const r = surukle.r;
    if (surukle.tur === "tasi") {
      alan = { ...r, x: sinirla(r.x + dx, 0, kutu.g - r.w), y: sinirla(r.y + dy, 0, kutu.y - r.h) };
      return;
    }
    // The corner opposite to the dragged one stays fixed. · Sürüklenenin karşısındaki köşe sabit kalır.
    const bat = surukle.tur.includes("w");
    const kuzey = surukle.tur.includes("n");
    const fx = bat ? r.x + r.w : r.x;
    const fy = kuzey ? r.y + r.h : r.y;
    const nx = sinirla((bat ? r.x : r.x + r.w) + dx, 0, kutu.g);
    const ny = sinirla((kuzey ? r.y : r.y + r.h) + dy, 0, kutu.y);
    let w = Math.max(MIN, Math.abs(nx - fx));
    let h = Math.max(MIN, Math.abs(ny - fy));
    const sx = nx >= fx ? 1 : -1;
    const sy = ny >= fy ? 1 : -1;
    if (oran) {
      w = Math.max(w, h * oran);
      const sinirG = sx > 0 ? kutu.g - fx : fx;
      const sinirY = sy > 0 ? kutu.y - fy : fy;
      w = Math.min(w, sinirG, sinirY * oran);
      h = w / oran;
    } else {
      w = Math.min(w, sx > 0 ? kutu.g - fx : fx);
      h = Math.min(h, sy > 0 ? kutu.y - fy : fy);
    }
    alan = { x: sx > 0 ? fx : fx - w, y: sy > 0 ? fy : fy - h, w, h };
  }

  function tutBirak() {
    surukle = null;
    kilavuz = false;
  }

  async function kirpDondur() {
    const o = oge;
    if (!o) return;
    o.duz.dondur = ((o.duz.dondur + 90) % 360) as Duzenleme["dondur"];
    o.duz.kirp = null;
    await tabaniCiz(o); // onload of the new picture re-measures the box · yeni resmin onload'u kutuyu yeniden ölçer
  }

  async function kirpCevir() {
    const o = oge;
    if (!o) return;
    o.duz.cevir = !o.duz.cevir;
    o.duz.kirp = null;
    await tabaniCiz(o);
  }

  async function kirpSifirla() {
    const o = oge;
    if (!o) return;
    o.duz = bosDuzenleme();
    oran = null;
    await tabaniCiz(o);
  }

  function kirpBitti() {
    const o = oge;
    if (!o) return;
    const k: KirpAlani = { x: alan.x / kutu.g, y: alan.y / kutu.y, w: alan.w / kutu.g, h: alan.h / kutu.y };
    // An (almost) full rectangle means "no crop". · (Neredeyse) tam dikdörtgen "kırpma yok" demektir.
    o.duz.kirp = k.w > 0.99 && k.h > 0.99 ? null : k;
    kirpOnay = true;
    kirpKatman?.kapat();
  }

  function kirpIptal() {
    kirpKatman?.kapat();
  }

  // ---- Video: trim, mute, quality · Video: kes, sessiz, kalite ----
  let oynatici = $state<HTMLVideoElement>();
  let oynuyor = $state(false);
  let oynatmaZamani = $state(0);
  let serit = $state<HTMLDivElement>();
  let tutac: { tur: "bas" | "son"; ox: number; deger: number; genis: number } | null = null;

  const v = $derived(oge?.video ?? null);
  const secilenSure = $derived(v ? v.bitis - v.basla : 0);
  const videoBoyutu = $derived(oge && v ? (videoOlabilir ? tahminiVideoBoyutu(secilenSure, v.sure, oge.dosya.size, v.kalite, v.sessiz) : oge.dosya.size) : 0);

  function oynatDurdur() {
    if (!oynatici || !v) return;
    if (oynatici.paused) {
      if (oynatici.currentTime < v.basla || oynatici.currentTime >= v.bitis - 0.05) oynatici.currentTime = v.basla;
      void oynatici.play();
    } else {
      oynatici.pause();
    }
  }

  function zamanGuncelle() {
    if (!oynatici || !v) return;
    oynatmaZamani = oynatici.currentTime;
    // Playback stays inside the selection. · Oynatma seçimin içinde kalır.
    if (oynatici.currentTime >= v.bitis) {
      oynatici.pause();
      oynatici.currentTime = v.basla;
    }
  }

  function tutacBasla(e: PointerEvent, tur: "bas" | "son") {
    if (!v || !serit) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    tutac = { tur, ox: e.clientX, deger: tur === "bas" ? v.basla : v.bitis, genis: serit.getBoundingClientRect().width };
    oynatici?.pause();
  }

  function tutacHareket(e: PointerEvent) {
    if (!tutac || !v || !oynatici) return;
    const fark = ((e.clientX - tutac.ox) / tutac.genis) * v.sure;
    const MIN_SURE = Math.min(1, v.sure);
    if (tutac.tur === "bas") {
      v.basla = sinirla(tutac.deger + fark, 0, v.bitis - MIN_SURE);
    } else v.bitis = sinirla(tutac.deger + fark, v.basla + MIN_SURE, v.sure);
    // The preview follows the handle being dragged. · Önizleme sürüklenen tutacağı izler.
    oynatici.currentTime = tutac.tur === "bas" ? v.basla : Math.max(v.basla, v.bitis - 0.05);
  }

  function tutacBirak() {
    if (tutac && oynatici && v) oynatici.currentTime = v.basla;
    tutac = null;
  }

  // ---- Sending · Gönderme ----
  function gonder() {
    if (!ogeler.length) return;
    devredildi = true;
    // Plain objects (not $state proxies) go to the queue. · Kuyruğa düz nesneler ($state vekilleri değil) gider.
    const liste: GonderilecekOge[] = ogeler.map((o) => {
      // The edited image replaced the file's own blob URL; that one is no longer needed (videos keep it: the poster frame uses it).
      // Düzenlenen resim, dosyanın kendi blob adresinin yerini aldı; o artık gerekmez (videolar korur: poster karesi onu kullanır).
      if (o.tur === "resim" && o.url !== o.onizlemeUrl) URL.revokeObjectURL(o.url);
      return {
        dosya: o.dosya,
        tur: o.tur,
        bitmap: o.bitmap,
        duz: $state.snapshot(o.duz),
        kalite: o.kalite,
        video: $state.snapshot(o.video),
        videoEl: o.videoEl,
        onizlemeUrl: o.onizlemeUrl,
      };
    });
    medya.gonder(odaId, liste, aciklama);
    kapat();
  }

  const KALITELER: ResimKalitesi[] = ["standart", "yuksek", "orijinal"];
  const ORANLAR: { ad: string; deger: number | null }[] = [
    { ad: "serbest", deger: null },
    { ad: "kare", deger: 1 },
    { ad: "4:3", deger: 4 / 3 },
    { ad: "16:9", deger: 16 / 9 },
    { ad: "9:16", deger: 9 / 16 },
  ];

  function tus(e: KeyboardEvent) {
    // The back stack already used this Escape (it closed the crop view): it must not close the whole sheet too.
    // Geri yığını bu Escape'i zaten kullandı (kırpmayı kapattı): bütün sayfayı da kapatmamalı.
    if (e.defaultPrevented) return;
    if (e.key === "Escape") {
      if (ekran === "kirp") kirpIptal();
      else kapat();
    }
  }
</script>

<svelte:window onkeydown={tus} />

<div bind:this={kok} out:menuCik|global class="akis" role="dialog" aria-modal="true" aria-label={m("gonder")}>
  <input bind:this={girdi} type="file" hidden multiple={kaynak !== "kamera"} accept={kabul} capture={kaynak === "kamera" ? "environment" : undefined} onchange={sec} oncancel={secimIptal} />

  {#if ekran === "kirp" && oge}
    <!-- ===== Crop screen · Kırpma ekranı ===== -->
    <header class="ust kirp-ust">
      <button type="button" class="metin-dugme" onclick={kirpIptal}>{m("iptal")}</button>
      <strong>{m("kirp")}</strong>
      <button type="button" class="metin-dugme birincil" onclick={kirpBitti}>{m("bitti")}</button>
    </header>
    <div class="sahne kirp-sahne">
      {#if kirpTaban}
        <div class="kirp-kutu">
          <img bind:this={kirpImg} src={kirpTaban} alt="" draggable="false" onload={kirpYuklendi} />
          {#if kutu.g > 0}
            <div class="kirp" class:kilavuz style:left="{alan.x}px" style:top="{alan.y}px" style:width="{alan.w}px" style:height="{alan.h}px">
              <!-- the body moves the rectangle · gövde dikdörtgeni taşır -->
              <div class="govde" role="presentation" onpointerdown={(e) => tutBasla(e, "tasi")} onpointermove={tutHareket} onpointerup={tutBirak} onpointercancel={tutBirak}></div>
              <span class="izgara" aria-hidden="true"></span>
              {#each ["nw", "ne", "sw", "se"] as const as kose}
                <div class="tutamac {kose}" role="presentation" onpointerdown={(e) => tutBasla(e, kose)} onpointermove={tutHareket} onpointerup={tutBirak} onpointercancel={tutBirak}><i></i></div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="alt" data-alt-cubuk>
      <div class="cipler" role="group" aria-label={m("kirp")}>
        {#each ORANLAR as o (o.ad)}
          <button type="button" class="cip" class:acik={oran === o.deger} onclick={() => oranSec(o.deger)}>
            {o.ad === "serbest" ? m("serbest") : o.ad === "kare" ? m("kare") : o.ad}
          </button>
        {/each}
      </div>
      <div class="araclar">
        <button type="button" class="arac" onclick={kirpDondur}><Ikon ad="yenile" /><span>{m("dondur")}</span></button>
        <button type="button" class="arac" onclick={kirpCevir}><Ikon ad="tikCift" /><span>{m("cevir")}</span></button>
        <button type="button" class="arac" onclick={kirpSifirla}><Ikon ad="geri" /><span>{m("sifirla")}</span></button>
      </div>
    </div>
  {:else}
    <!-- ===== Preview + edit · Önizleme + düzenleme ===== -->
    <header class="ust">
      <button type="button" class="ikon-dugme" onclick={kapat} aria-label={m("kapat")}><Ikon ad="kapat" /></button>
      <span class="bosluk"></span>
      {#if oge?.tur === "resim" && oge.duzenlenebilir}
        <button type="button" class="ikon-dugme" onclick={kirpAc} aria-label={m("kirp")}><Ikon ad="galeri" /></button>
        <button type="button" class="ikon-dugme" onclick={() => oge && dondur(oge)} aria-label={m("dondur")}><Ikon ad="yenile" /></button>
      {:else if oge?.tur === "video" && v && videoOlabilir}
        <button type="button" class="ikon-dugme" onclick={() => v && (v.sessiz = !v.sessiz)} aria-pressed={v.sessiz} aria-label={v.sessiz ? m("sesAc") : m("sesKapat")}>
          <Ikon ad={v.sessiz ? "mikrofonKapali" : "hoparlor"} />
        </button>
      {/if}
    </header>

    <div class="sahne">
      {#if okunuyor && !oge}
        <p class="durum-yazi">{m("hazirlaniyor")}</p>
      {:else if !oge}
        <button type="button" class="metin-dugme birincil" onclick={() => girdi.click()}>{m("dosyaSec")}</button>
      {:else if oge.tur === "resim"}
        <img class="onizleme" src={oge.onizlemeUrl} alt={oge.dosya.name} draggable="false" />
        {#if !oge.duzenlenebilir}<p class="not">{m("duzenlenemez")}</p>{/if}
      {:else if oge.tur === "video" && v}
        <div class="video-kutu">
          {#key oge.id}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              bind:this={oynatici}
              src={oge.url}
              muted={v.sessiz}
              playsinline
              preload="auto"
              ontimeupdate={zamanGuncelle}
              onplay={() => (oynuyor = true)}
              onpause={() => (oynuyor = false)}
              onclick={oynatDurdur}
            ></video>
          {/key}
          <button type="button" class="oynat" class:gizli={oynuyor} onclick={oynatDurdur} aria-label={oynuyor ? m("videoDurdur") : m("videoOynat")}><Ikon ad="sagOk" boyut={28} /></button>
        </div>
        {#if !videoOlabilir}<p class="not">{m("duzenlenemez")}</p>{/if}
      {:else if oge.tur === "dosya"}
        <div class="dosya-kart">
          <span class="dosya-ikon"><Ikon ad="dosya" boyut={32} /></span>
          <strong>{oge.dosya.name}</strong>
          <span class="soluk">{boyutYaz(oge.dosya.size)}</span>
        </div>
      {/if}
    </div>

    {#if oge?.tur === "video" && v && videoOlabilir}
      <div class="kesme">
        <div class="zaman-satir">
          <span>{sureYaz(v.basla)}</span>
          <span class="orta">{m("videoSecili", { sure: sureYaz(secilenSure), kalite: v.kalite === "orijinal" ? m("kaliteOrijinal") : `${v.kalite}p`, boyut: boyutYaz(videoBoyutu) })}</span>
          <span>{sureYaz(v.sure)}</span>
        </div>
        <div class="serit" bind:this={serit}>
          <div class="kareler">
            {#each oge.kareler as k, i (i)}<img src={k} alt="" draggable="false" />{/each}
          </div>
          <div class="secim" style:left="{(v.basla / v.sure) * 100}%" style:right="{(1 - v.bitis / v.sure) * 100}%">
            <div class="tutac bas" role="slider" tabindex="0" aria-label={m("kesmeTutacBas")} aria-valuenow={Math.round(v.basla)} aria-valuemin={0} aria-valuemax={Math.round(v.sure)} onpointerdown={(e) => tutacBasla(e, "bas")} onpointermove={tutacHareket} onpointerup={tutacBirak} onpointercancel={tutacBirak}><i></i></div>
            <div class="tutac son" role="slider" tabindex="0" aria-label={m("kesmeTutacSon")} aria-valuenow={Math.round(v.bitis)} aria-valuemin={0} aria-valuemax={Math.round(v.sure)} onpointerdown={(e) => tutacBasla(e, "son")} onpointermove={tutacHareket} onpointerup={tutacBirak} onpointercancel={tutacBirak}><i></i></div>
          </div>
          <span class="oynatma" style:left="{(oynatmaZamani / v.sure) * 100}%"></span>
        </div>
        <div class="cipler" role="group" aria-label={m("kalite")}>
          {#each ["480", "720", "orijinal"] as const as k (k)}
            <button type="button" class="cip" class:acik={v.kalite === k} onclick={() => v && (v.kalite = k as VideoKalitesi)}>
              {k === "orijinal" ? m("kaliteOrijinal") : `${k}p`}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="alt" data-alt-cubuk>
      {#if oge?.tur === "resim"}
        <div class="kalite-satir">
          <button type="button" class="cip kalite" onclick={() => (kaliteMenusu = !kaliteMenusu)} aria-expanded={kaliteMenusu}>
            <Ikon ad="izgara" boyut={16} />
            {m(KALITE_AD[oge.kalite])} · {m("tahmini", { boyut: boyutYaz(resimBoyutu) })}
          </button>
          {#if kaliteMenusu}
            <div class="menu" role="menu">
              {#each KALITELER as k (k)}
                <button type="button" role="menuitemradio" aria-checked={oge.kalite === k} class="menu-oge" class:acik={oge.kalite === k} onclick={() => { if (oge) oge.kalite = k; kaliteMenusu = false; }}>
                  {m(KALITE_AD[k])}
                  <span class="soluk">{k === "orijinal" ? "" : `${UZUN_KENAR[k]} px`}</span>
                </button>
              {/each}
              <p class="ipucu">{oge.kalite === "orijinal" ? m("kaliteIpucuOrijinal") : m("kaliteIpucu")}</p>
            </div>
          {/if}
        </div>
      {/if}

      {#if ogeler.length > 0}
        <div class="seritler" role="listbox" aria-label={m("secili", { n: ogeler.length })}>
          {#each ogeler as o, i (o.id)}
            <div class="kucuk" class:secili={i === secili} role="option" aria-selected={i === secili}>
              <button type="button" class="kucuk-resim" onclick={() => (secili = i)} aria-label={o.dosya.name}>
                {#if o.tur === "resim"}
                  <img src={o.onizlemeUrl} alt="" draggable="false" />
                {:else if o.tur === "video" && o.kareler[0]}
                  <img src={o.kareler[0]} alt="" draggable="false" />
                {:else}
                  <Ikon ad={o.tur === "video" ? "sagOk" : "dosya"} />
                {/if}
                {#if o.tur === "video" && o.video}<span class="sure">{sureYaz(o.video.bitis - o.video.basla)}</span>{/if}
              </button>
              <button type="button" class="kaldir" onclick={() => kaldir(i)} aria-label={m("kaldir")}><Ikon ad="kapat" boyut={14} /></button>
            </div>
          {/each}
          {#if ogeler.length < MAKS_OGE}
            <button type="button" class="ekle" onclick={() => girdi.click()} aria-label={m("ekle")}><Ikon ad="artik" /></button>
          {/if}
        </div>
      {/if}

      <div class="yaz-satir">
        <input class="aciklama" type="text" bind:value={aciklama} placeholder={m("aciklamaEkle")} maxlength="1000" enterkeyhint="send" />
        <button type="button" class="gonder" onclick={gonder} disabled={!ogeler.length || okunuyor} aria-label={m("gonder")}>
          <Ikon ad="yukari" />
          <span>{ogeler.length}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .akis {
    position: fixed;
    inset: 0;
    z-index: 150;
    display: flex;
    flex-direction: column;
    background: var(--zemin);
    color: var(--yazi);
    animation: gir var(--sure-sayfa) var(--egri-ac);
  }
  @keyframes gir {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .akis {
      animation: none;
    }
  }
  .ust {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: calc(8px + env(safe-area-inset-top)) 8px 8px;
  }
  .kirp-ust {
    justify-content: space-between;
  }
  .bosluk {
    flex: 1;
  }
  .ikon-dugme {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--yuzey-2);
    color: var(--yazi);
    cursor: pointer;
  }
  .ikon-dugme[aria-pressed="true"] {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .metin-dugme {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--yazi);
    font: inherit;
    cursor: pointer;
  }
  .metin-dugme.birincil {
    background: var(--vurgu);
    color: var(--vurgu-ustu);
    font-weight: 600;
  }
  .sahne {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 8px;
    position: relative;
  }
  .onizleme {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 12px;
  }
  .not,
  .durum-yazi {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 12px;
    margin: 0;
    text-align: center;
    color: var(--yazi-2);
    font-size: 13px;
  }
  .soluk {
    color: var(--yazi-2);
    font-size: 12px;
  }
  .dosya-kart {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    border-radius: 16px;
    background: var(--yuzey-2);
    max-width: 320px;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .dosya-ikon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: var(--yuzey-3);
    color: var(--vurgu);
  }

  /* ---- video ---- */
  .video-kutu {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    display: grid;
    place-items: center;
  }
  video {
    max-width: 100%;
    max-height: 100%;
    border-radius: 12px;
    background: var(--yuzey-1);
  }
  .oynat {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--zemin);
    color: var(--yazi);
    opacity: 0.9;
    cursor: pointer;
    transition: opacity var(--sure-orta) var(--egri-cikis);
  }
  .oynat.gizli {
    opacity: 0;
    pointer-events: none;
  }
  .kesme {
    padding: 0 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .zaman-satir {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--yazi-2);
    font-variant-numeric: tabular-nums;
  }
  .zaman-satir .orta {
    color: var(--yazi);
    text-align: center;
  }
  .serit {
    position: relative;
    height: 56px;
    margin: 0 14px; /* room for the handles at both ends · iki uçtaki tutacaklara yer */
    border-radius: 8px;
    background: var(--yuzey-2);
    touch-action: none;
  }
  .kareler {
    position: absolute;
    inset: 0;
    display: flex;
    overflow: hidden;
    border-radius: 8px;
    opacity: 0.55;
  }
  .kareler img {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    object-fit: cover;
  }
  .secim {
    position: absolute;
    top: 0;
    bottom: 0;
    border-top: 2px solid var(--vurgu);
    border-bottom: 2px solid var(--vurgu);
  }
  .tutac {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 44px; /* 44px hit area, 14px visible bar · 44px dokunma alanı, 14px görünen çubuk */
    display: grid;
    place-items: center;
    touch-action: none;
    cursor: ew-resize;
  }
  .tutac i {
    width: 14px;
    height: 100%;
    background: var(--vurgu);
  }
  .tutac.bas {
    left: -29px;
  }
  .tutac.bas i {
    border-radius: 8px 0 0 8px;
  }
  .tutac.son {
    right: -29px;
  }
  .tutac.son i {
    border-radius: 0 8px 8px 0;
  }
  .oynatma {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    background: var(--yazi);
    pointer-events: none;
  }

  /* ---- chips, tools ---- */
  .cipler {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .cip {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--kenar);
    border-radius: 12px;
    background: var(--yuzey-2);
    color: var(--yazi);
    font: inherit;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .cip.acik {
    background: var(--ton);
    border-color: var(--vurgu);
    color: var(--ton-ustu);
  }
  .araclar {
    display: flex;
    justify-content: center;
    gap: 24px;
  }
  .arac {
    min-width: 64px;
    min-height: 56px;
    border: 0;
    background: transparent;
    color: var(--yazi);
    font: inherit;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  }

  /* ---- bottom bar ---- */
  .alt {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
    background: var(--zemin);
    position: relative;
  }
  .kalite-satir {
    position: relative;
  }
  .kalite {
    background: var(--yuzey-2);
  }
  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    min-width: 240px;
    padding: 8px;
    border-radius: 16px;
    background: var(--yuzey-3);
    box-shadow: var(--kat-2);
    z-index: 2;
  }
  .menu-oge {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--yazi);
    font: inherit;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }
  .menu-oge.acik {
    background: var(--ton);
    color: var(--ton-ustu);
  }
  .ipucu {
    margin: 4px 12px 8px;
    font-size: 12px;
    color: var(--yazi-2);
  }
  .seritler {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding: 6px 4px 2px;
  }
  .kucuk {
    position: relative;
    flex: none;
  }
  .kucuk-resim {
    position: relative;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    background: var(--yuzey-3);
    color: var(--yazi-2);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .kucuk.secili .kucuk-resim {
    border-color: var(--vurgu);
  }
  .kucuk-resim img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sure {
    position: absolute;
    right: 2px;
    bottom: 2px;
    padding: 0 4px;
    border-radius: 6px;
    background: var(--zemin);
    color: var(--yazi);
    font-size: 10px;
  }
  /* 44px tap target around a small × badge · küçük × rozetinin çevresinde 44px dokunma hedefi */
  .kaldir {
    position: absolute;
    top: -14px;
    right: -14px;
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--yazi);
    display: grid;
    place-items: center;
    cursor: pointer;
    clip-path: circle(22px at 50% 50%);
  }
  .kaldir :global(svg) {
    padding: 4px;
    border-radius: 50%;
    background: var(--yuzey-3);
    box-sizing: content-box;
    width: 14px;
    height: 14px;
  }
  .ekle {
    flex: none;
    width: 56px;
    height: 56px;
    border: 1px dashed var(--kenar);
    border-radius: 12px;
    background: transparent;
    color: var(--yazi);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .yaz-satir {
    display: flex;
    gap: 8px;
  }
  .aciklama {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--kenar);
    border-radius: 12px;
    background: var(--yuzey-2);
    color: var(--yazi);
    font: inherit;
  }
  .aciklama:focus-visible {
    outline: 2px solid var(--vurgu);
    outline-offset: 1px;
  }
  .gonder {
    min-width: 64px;
    height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: var(--vurgu);
    color: var(--vurgu-ustu);
    font: inherit;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
  }
  .gonder:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ---- crop ---- */
  .kirp-sahne {
    padding: 16px;
  }
  .kirp-kutu {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    line-height: 0;
    touch-action: none;
  }
  .kirp-kutu img {
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 300px);
    object-fit: contain;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
  }
  .kirp {
    position: absolute;
    /* the shade outside the rectangle · dikdörtgenin dışındaki gölge */
    box-shadow: 0 0 0 9999px color-mix(in srgb, var(--zemin) 65%, transparent);
    outline: 2px solid var(--yazi);
    touch-action: none;
  }
  .kirp .govde {
    position: absolute;
    inset: 0;
    cursor: move;
    touch-action: none;
  }
  /* rule-of-thirds grid, only while dragging · üçte bir kılavuzu, yalnızca sürüklerken */
  .izgara {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--sure-orta) var(--egri-cikis);
    background:
      linear-gradient(var(--yazi), var(--yazi)) 33.333% 0 / 1px 100% no-repeat,
      linear-gradient(var(--yazi), var(--yazi)) 66.666% 0 / 1px 100% no-repeat,
      linear-gradient(var(--yazi), var(--yazi)) 0 33.333% / 100% 1px no-repeat,
      linear-gradient(var(--yazi), var(--yazi)) 0 66.666% / 100% 1px no-repeat;
  }
  .kirp.kilavuz .izgara {
    opacity: 0.6;
  }
  .tutamac {
    position: absolute;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    touch-action: none;
  }
  .tutamac i {
    width: 22px;
    height: 22px;
    border: 4px solid var(--yazi);
    pointer-events: none;
  }
  .tutamac.nw {
    left: -22px;
    top: -22px;
  }
  .tutamac.nw i {
    border-right: 0;
    border-bottom: 0;
    transform: translate(7px, 7px);
  }
  .tutamac.ne {
    right: -22px;
    top: -22px;
  }
  .tutamac.ne i {
    border-left: 0;
    border-bottom: 0;
    transform: translate(-7px, 7px);
  }
  .tutamac.sw {
    left: -22px;
    bottom: -22px;
  }
  .tutamac.sw i {
    border-right: 0;
    border-top: 0;
    transform: translate(7px, -7px);
  }
  .tutamac.se {
    right: -22px;
    bottom: -22px;
  }
  .tutamac.se i {
    border-left: 0;
    border-top: 0;
    transform: translate(-7px, -7px);
  }
</style>
