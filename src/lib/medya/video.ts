// Video helpers in the WebView: read metadata, draw frame thumbnails for the trim strip, grab a poster frame, estimate sizes.
// The heavy part (re-encoding) is native, see src-tauri/.../VideoSikistir.kt.
// WebView'de video yardımcıları: üstveri okuma, kesme şeridi için kare küçük resimleri, poster karesi, boyut tahmini.
// Ağır iş (yeniden kodlama) yereldir: bkz. src-tauri/.../VideoSikistir.kt.
import { kucukResim, type HazirResim } from "./isleme";

export type VideoKalitesi = "480" | "720" | "orijinal";

/** Bits per second for the video track: 480p ≈ 1.2 Mbps, 720p ≈ 2.5 Mbps (audio AAC 96 kbps is added). */
/** Video izi için bit hızı: 480p ≈ 1,2 Mbps, 720p ≈ 2,5 Mbps (AAC 96 kbps ses eklenir). */
export const VIDEO_BITRATE: Record<VideoKalitesi, number> = { "480": 1_200_000, "720": 2_500_000, orijinal: 8_000_000 };
export const SES_BITRATE = 96_000;

export interface VideoMeta {
  sure: number;
  genislik: number;
  yukseklik: number;
}

/** A hidden <video> element for a blob URL, ready once metadata is known. · Blob adresi için gizli <video>; üstveri gelince hazır. */
export function videoAc(url: string): Promise<HTMLVideoElement> {
  return new Promise((coz, red) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => coz(v);
    v.onerror = () => red(new Error("video açılamadı"));
    v.src = url;
  });
}

export function metaOku(v: HTMLVideoElement): VideoMeta {
  return { sure: Number.isFinite(v.duration) ? v.duration : 0, genislik: v.videoWidth, yukseklik: v.videoHeight };
}

function ara(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((coz) => {
    const bitti = () => {
      v.removeEventListener("seeked", bitti);
      coz();
    };
    v.addEventListener("seeked", bitti);
    v.currentTime = t;
    // Some WebViews never fire "seeked" for a no-op seek. · Bazı WebView'ler anlamsız sarma için "seeked" yollamaz.
    setTimeout(bitti, 1500);
  });
}

/** `adet` evenly spaced frame thumbnails as data URLs (about 96 px high), drawn one after another. */
/** Eşit aralıklı `adet` kare küçük resmi (yaklaşık 96 px yüksek), data URL olarak; sırayla çizilir. */
export async function kareler(v: HTMLVideoElement, adet: number): Promise<string[]> {
  const sure = metaOku(v).sure;
  const oran = v.videoWidth / Math.max(1, v.videoHeight);
  const t = document.createElement("canvas");
  t.height = 96;
  t.width = Math.max(16, Math.round(96 * oran));
  const c = t.getContext("2d")!;
  const cikti: string[] = [];
  for (let i = 0; i < adet; i++) {
    await ara(v, Math.min(sure - 0.05, (sure * (i + 0.5)) / adet));
    c.drawImage(v, 0, 0, t.width, t.height);
    cikti.push(t.toDataURL("image/jpeg", 0.6));
  }
  return cikti;
}

/** Poster frame at 0.1 s (or the start of the trim), as a WebP thumbnail with a long edge of 800 px. Null if the frame cannot be drawn. */
/** 0,1 sn'deki (ya da kesmenin başındaki) poster karesi; uzun kenarı 800 px WebP küçük resim. Kare çizilemezse null. */
export async function posterAl(v: HTMLVideoElement, t = 0.1): Promise<HazirResim | null> {
  try {
    await ara(v, Math.min(Math.max(0, t), Math.max(0, metaOku(v).sure - 0.05)));
    if (!v.videoWidth) return null;
    const tuval = document.createElement("canvas");
    tuval.width = v.videoWidth;
    tuval.height = v.videoHeight;
    tuval.getContext("2d")!.drawImage(v, 0, 0);
    return await kucukResim(tuval);
  } catch {
    return null;
  }
}

/** Estimated size in bytes of `sure` seconds at the chosen quality (duration × bitrate); "orijinal" scales the file size. */
/** `sure` saniyenin seçilen kalitedeki tahmini boyutu (süre × bit hızı); "orijinal" dosya boyutunu orantılar. */
export function tahminiVideoBoyutu(sure: number, toplamSure: number, dosyaBoyutu: number, kalite: VideoKalitesi, sessiz: boolean): number {
  if (kalite === "orijinal") return Math.round(dosyaBoyutu * (sure / Math.max(0.001, toplamSure)));
  return Math.round(((VIDEO_BITRATE[kalite] + (sessiz ? 0 : SES_BITRATE)) * sure) / 8);
}
