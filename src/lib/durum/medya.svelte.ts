// Media sending queue: prepares each chosen item (image re-encode, video transcode, thumbnail), uploads it to the Rust cache and
// hands it to the send queue. While that runs, the item shows as a "pending" bubble (see medya/MedyaBekleyenler.svelte); once Rust
// has queued it, the SDK's own local echo (with upload progress) takes over in the timeline and the pending entry disappears.
// Medya gönderim kuyruğu: seçilen her öğeyi hazırlar (resim yeniden kodlama, video dönüşümü, küçük resim), Rust önbelleğine yükler ve
// gönderim kuyruğuna verir. Bu sürerken öğe "bekleyen" balon olarak görünür (bkz. medya/MedyaBekleyenler.svelte); Rust sıraya
// alınca zaman çizelgesinde SDK'nın kendi yerel yankısı (yükleme ilerlemesiyle) devralır ve bekleyen kayıt kalkar.
import { medyaGonder, medyaTemizle, medyaYetenekleri, videoSikistir, videoSikistirmayiIptal } from "../api/komutlar";
import { medyaIlerleme } from "../api/olaylar";
import type { Hata, MedyaTuru, MedyaYetenekleri } from "../api/tipler";
import {
  adDegistir,
  blobaCevir,
  cizCanvas,
  dosyaYukle,
  duzenlendiMi,
  kucukResim,
  UZUN_KENAR,
  uzantiBul,
  type Duzenleme,
  type HazirResim,
  type ResimKalitesi,
} from "../medya/isleme";
import { m } from "../medya/metin";
import { posterAl, VIDEO_BITRATE, type VideoKalitesi } from "../medya/video";
import { bildirim } from "./bildirim.svelte";

export interface VideoAyari {
  sure: number;
  basla: number;
  bitis: number;
  sessiz: boolean;
  kalite: VideoKalitesi;
  genislik: number;
  yukseklik: number;
}

/** One item the user chose in the flow · Kullanıcının akışta seçtiği tek öğe */
export interface GonderilecekOge {
  dosya: File;
  tur: MedyaTuru;
  /** decoded image (null for videos / files / undecodable images) · çözülmüş resim (video / dosya / çözülemeyen resimde null) */
  bitmap: ImageBitmap | null;
  duz: Duzenleme;
  kalite: ResimKalitesi;
  video: VideoAyari | null;
  /** loaded <video> used for the poster frame · poster karesi için yüklü <video> */
  videoEl: HTMLVideoElement | null;
  /** blob URL of a preview; ownership passes to the queue on send · önizleme blob adresi; gönderilince sahiplik kuyruğa geçer */
  onizlemeUrl: string | null;
}

export type BekleyenAsama = "hazirlaniyor" | "sikistiriliyor" | "yukleniyor" | "hata";

export interface Bekleyen {
  yerelId: string;
  odaId: string;
  tur: MedyaTuru;
  ad: string;
  onizleme: string | null;
  genislik: number | null;
  yukseklik: number | null;
  asama: BekleyenAsama;
  /** 0..100 */
  yuzde: number;
}

class MedyaDurumu {
  bekleyenler = $state<Bekleyen[]>([]);
  yetenek = $state<MedyaYetenekleri>({ videoSikistirma: false, sistemBildirimi: false });
  #sayac = 0;
  #iptal = new Set<string>();
  #basladi = false;

  /** Reads what this device can do and starts listening to compression progress. Safe to call many times. */
  /** Bu cihazın yapabildiklerini okur ve sıkıştırma ilerlemesini dinlemeye başlar. Çok kez çağrılabilir. */
  async baslat() {
    if (this.#basladi) return;
    this.#basladi = true;
    try {
      this.yetenek = await medyaYetenekleri();
    } catch {
      /* keep the defaults · varsayılanları koru */
    }
    await medyaIlerleme((o) => {
      const b = this.bekleyenler.find((x) => x.yerelId === o.yerelId);
      // The first 15 % was copying the file into the cache, the rest is the native transcode. · İlk %15 dosyayı önbelleğe kopyalamaydı, kalanı yerel dönüşüm.
      if (b && b.asama !== "hata") b.yuzde = Math.round(15 + o.yuzde * 0.85);
    });
  }

  oda(odaId: string): Bekleyen[] {
    return this.bekleyenler.filter((b) => b.odaId === odaId);
  }

  /** Cancel while preparing; a running native transcode is stopped too. · Hazırlanırken iptal; süren yerel dönüşüm de durdurulur. */
  iptalEt(yerelId: string) {
    this.#iptal.add(yerelId);
    const b = this.bekleyenler.find((x) => x.yerelId === yerelId);
    if (b?.asama === "sikistiriliyor") void videoSikistirmayiIptal().catch(() => {});
    if (b?.asama === "hata") this.#kaldir(yerelId);
  }

  kapat(yerelId: string) {
    this.#kaldir(yerelId);
  }

  #kaldir(yerelId: string) {
    const b = this.bekleyenler.find((x) => x.yerelId === yerelId);
    if (b?.onizleme) URL.revokeObjectURL(b.onizleme);
    this.bekleyenler = this.bekleyenler.filter((x) => x.yerelId !== yerelId);
    this.#iptal.delete(yerelId);
  }

  /** Queues the items one after another. The caption goes on the first item. · Öğeleri sırayla kuyruğa alır. Açıklama ilk öğeye konur. */
  gonder(odaId: string, ogeler: GonderilecekOge[], aciklama: string) {
    void this.baslat();
    const kayitlar = ogeler.map((o, i) => {
      const b: Bekleyen = {
        yerelId: `y${Date.now().toString(36)}${this.#sayac++}`,
        odaId,
        tur: o.tur,
        ad: o.dosya.name,
        onizleme: o.onizlemeUrl,
        genislik: o.video?.genislik ?? o.bitmap?.width ?? null,
        yukseklik: o.video?.yukseklik ?? o.bitmap?.height ?? null,
        asama: "hazirlaniyor",
        yuzde: 0,
      };
      return { o, b, aciklama: i === 0 ? aciklama.trim() : "" };
    });
    this.bekleyenler = [...this.bekleyenler, ...kayitlar.map((k) => k.b)];
    // The Proxy wrappers of $state: always edit through the array element. · $state sarmalayıcıları: değişikliği hep dizi öğesinden yap.
    void (async () => {
      for (const k of kayitlar) {
        const canli = this.bekleyenler.find((x) => x.yerelId === k.b.yerelId);
        if (!canli) continue;
        await this.#isle(canli, k.o, k.aciklama);
      }
    })();
  }

  async #isle(b: Bekleyen, o: GonderilecekOge, aciklama: string) {
    const temizlenecek: string[] = [];
    try {
      const iptalli = () => this.#iptal.has(b.yerelId);
      let kimlik: string;
      let ad = o.dosya.name;
      let mime = o.dosya.type || "application/octet-stream";
      let genislik: number | null = null;
      let yukseklik: number | null = null;
      let sureMs: number | null = null;
      let kucuk: HazirResim | null = null;

      if (o.tur === "resim") {
        const aynen = !o.bitmap || o.dosya.type === "image/gif" || (o.kalite === "orijinal" && !duzenlendiMi(o.duz));
        if (aynen) {
          // Untouched bytes ("Orijinal", GIF, or an image the WebView cannot decode). · Dokunulmamış baytlar ("Orijinal", GIF ya da WebView'in çözemediği resim).
          kimlik = await dosyaYukle(o.dosya, uzantiBul(ad, mime), (r) => (b.yuzde = Math.round(r * 100)));
          if (o.bitmap) {
            genislik = o.bitmap.width;
            yukseklik = o.bitmap.height;
            kucuk = await kucukResim(o.bitmap);
          }
        } else {
          b.asama = "sikistiriliyor";
          const tuval = cizCanvas(o.bitmap!, o.duz, UZUN_KENAR[o.kalite]);
          const blob = o.kalite === "orijinal" ? await blobaCevir(tuval, 0.95, 0.95) : await blobaCevir(tuval, 0.82, 0.85);
          genislik = tuval.width;
          yukseklik = tuval.height;
          mime = blob.type;
          ad = adDegistir(ad, blob.type === "image/webp" ? "webp" : "jpg");
          kucuk = await kucukResim(tuval);
          b.yuzde = 50;
          kimlik = await dosyaYukle(blob, uzantiBul(ad, mime), (r) => (b.yuzde = 50 + Math.round(r * 50)));
        }
      } else if (o.tur === "video" && o.video) {
        const v = o.video;
        kimlik = await dosyaYukle(o.dosya, uzantiBul(ad, mime), (r) => (b.yuzde = Math.round(r * 15)));
        temizlenecek.push(kimlik);
        genislik = v.genislik;
        yukseklik = v.yukseklik;
        sureMs = Math.round((v.bitis - v.basla) * 1000);
        const kesildi = v.basla > 0.05 || v.bitis < v.sure - 0.05;
        const degisti = kesildi || v.sessiz || v.kalite !== "orijinal";
        if (this.yetenek.videoSikistirma && degisti && !iptalli()) {
          b.asama = "sikistiriliyor";
          const s = await videoSikistir({
            yerelId: b.yerelId,
            kimlik,
            yukseklik: v.kalite === "orijinal" ? 0 : Number(v.kalite),
            bitrateBps: VIDEO_BITRATE[v.kalite],
            baslaMs: Math.round(v.basla * 1000),
            bitisMs: v.bitis >= v.sure - 0.05 ? 0 : Math.round(v.bitis * 1000),
            sessiz: v.sessiz,
          });
          temizlenecek.push(s.kimlik);
          kimlik = s.kimlik;
          genislik = s.genislik || genislik;
          yukseklik = s.yukseklik || yukseklik;
          sureMs = s.sureMs || sureMs;
          mime = "video/mp4";
          ad = adDegistir(ad, "mp4");
        }
        // TODO(desktop): no transcoding there yet, the original goes out (see matrix/medya.rs). · TODO(masaüstü): orada henüz dönüştürme yok, özgün gider.
        if (o.videoEl) kucuk = await posterAl(o.videoEl, v.basla + 0.1);
        if (mime === "application/octet-stream") mime = "video/mp4";
      } else {
        kimlik = await dosyaYukle(o.dosya, uzantiBul(ad, mime), (r) => (b.yuzde = Math.round(r * 100)));
      }

      if (iptalli()) {
        await medyaTemizle([...temizlenecek, kimlik]).catch(() => {});
        this.#kaldir(b.yerelId);
        return;
      }

      b.asama = "yukleniyor";
      let kucukKimlik: string | null = null;
      if (kucuk) {
        kucukKimlik = await dosyaYukle(kucuk.blob, kucuk.blob.type === "image/webp" ? "webp" : "jpg");
      }
      await medyaGonder({
        odaId: b.odaId,
        tur: o.tur,
        kimlik,
        dosyaAdi: ad,
        mime,
        genislik,
        yukseklik,
        sureMs,
        kucukKimlik,
        kucukMime: kucuk?.blob.type ?? null,
        kucukGenislik: kucuk?.genislik ?? null,
        kucukYukseklik: kucuk?.yukseklik ?? null,
        aciklama: aciklama || null,
      });
      // The Rust side removes the cache file it sent; ours (the pre-transcode copy) goes now. · Rust yolladığı önbellek dosyasını siler; bizimki (dönüşüm öncesi kopya) şimdi gider.
      await medyaTemizle(temizlenecek.filter((k) => k !== kimlik)).catch(() => {});
      this.#kaldir(b.yerelId);
    } catch (e) {
      await medyaTemizle(temizlenecek).catch(() => {});
      if (this.#iptal.has(b.yerelId)) {
        this.#kaldir(b.yerelId);
        return;
      }
      b.asama = "hata";
      const mesaj = (e as Hata)?.mesaj;
      bildirim.goster(m("gonderilemedi"), 5000, { tur: "hata" });
      console.warn("medya gönderilemedi", mesaj ?? e);
    } finally {
      // Decoded pixels and the poster video are not needed any more. · Çözülmüş pikseller ve poster videosu artık gerekmez.
      o.bitmap?.close();
      o.videoEl?.removeAttribute("src");
    }
  }
}

export const medya = new MedyaDurumu();
