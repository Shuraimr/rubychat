// Image and video preparation in the WebView (no packages): decode, crop / rotate / flip on a canvas, downscale, re-encode, thumbnails,
// and the chunked upload of the result to Rust. Re-encoding through a canvas also drops EXIF / GPS metadata.
// WebView içinde resim ve video hazırlığı (paket yok): çözme, canvas'ta kırp / döndür / çevir, küçültme, yeniden kodlama, küçük
// resimler ve sonucun Rust'a parçalı yüklenmesi. Canvas üzerinden yeniden kodlama EXIF / GPS üstverisini de siler.
import { medyaParcaYaz } from "../api/komutlar";

export type ResimKalitesi = "standart" | "yuksek" | "orijinal";
/** Long-edge limits in px; "orijinal" = no downscale · Uzun kenar sınırları (px); "orijinal" = küçültme yok */
export const UZUN_KENAR: Record<ResimKalitesi, number> = { standart: 2560, yuksek: 4096, orijinal: Infinity };

/** Fractions (0..1) of the DISPLAYED image, i.e. after rotate / flip · GÖRÜNEN resmin (döndür / çevirden sonra) oranları (0..1) */
export interface KirpAlani {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Duzenleme {
  /** clockwise degrees: 0 | 90 | 180 | 270 · saat yönünde derece */
  dondur: 0 | 90 | 180 | 270;
  /** mirror left-right (after rotating) · soldan sağa aynala (döndürmeden sonra) */
  cevir: boolean;
  kirp: KirpAlani | null;
}

export const bosDuzenleme = (): Duzenleme => ({ dondur: 0, cevir: false, kirp: null });
export const duzenlendiMi = (d: Duzenleme): boolean => d.dondur !== 0 || d.cevir || d.kirp !== null;

/** Decodes a file. imageOrientation "from-image" applies the EXIF rotation, so phone photos come out upright. Null if the WebView cannot decode it (HEIC...). */
/** Dosyayı çözer. imageOrientation "from-image" EXIF dönüşünü uygular; telefon fotoğrafları dik çıkar. WebView çözemezse (HEIC...) null. */
export async function resmiCoz(dosya: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(dosya, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/** Displayed size of the bitmap after rotating · Bitmap'in döndürmeden sonraki görünen boyutu */
export function gorunenBoyut(b: { width: number; height: number }, d: Duzenleme): { g: number; y: number } {
  return d.dondur % 180 === 0 ? { g: b.width, y: b.height } : { g: b.height, y: b.width };
}

/**
 * Draws the edited image into a new canvas whose long edge is at most `sinir` px.
 * The matrix chain (applied right-to-left to a source point): rotate → mirror → move the crop origin to (0,0) → scale.
 * Düzenlenmiş resmi uzun kenarı en çok `sinir` px olan yeni bir canvas'a çizer.
 * Matris zinciri (kaynak noktaya sağdan sola uygulanır): döndür → aynala → kırpma başlangıcını (0,0)'a taşı → ölçekle.
 */
export function cizCanvas(b: ImageBitmap, d: Duzenleme, sinir: number): HTMLCanvasElement {
  const { g: dg, y: dy } = gorunenBoyut(b, d);
  const k = d.kirp ?? { x: 0, y: 0, w: 1, h: 1 };
  const kx = Math.round(k.x * dg);
  const ky = Math.round(k.y * dy);
  const kg = Math.max(1, Math.round(k.w * dg));
  const ky2 = Math.max(1, Math.round(k.h * dy));
  const olcek = Math.min(1, sinir / Math.max(kg, ky2));
  const tuval = document.createElement("canvas");
  tuval.width = Math.max(1, Math.round(kg * olcek));
  tuval.height = Math.max(1, Math.round(ky2 * olcek));
  const c = tuval.getContext("2d")!;
  c.imageSmoothingQuality = "high";
  c.scale(tuval.width / kg, tuval.height / ky2);
  c.translate(-kx, -ky);
  if (d.cevir) c.transform(-1, 0, 0, 1, dg, 0);
  // source → displayed, per rotation (x' = a·x + c·y + e, y' = b·x + d·y + f)
  // kaynak → görünen, dönüşe göre
  if (d.dondur === 90) c.transform(0, 1, -1, 0, b.height, 0);
  else if (d.dondur === 180) c.transform(-1, 0, 0, -1, b.width, b.height);
  else if (d.dondur === 270) c.transform(0, -1, 1, 0, 0, b.width);
  c.drawImage(b, 0, 0);
  return tuval;
}

/** canvas → blob. WebP first; where the WebView cannot encode it the browser silently returns PNG, so we fall back to JPEG on a white background. */
/** canvas → blob. Önce WebP; WebView kodlayamazsa tarayıcı sessizce PNG döndürür, o zaman beyaz zeminde JPEG'e düşeriz. */
export async function blobaCevir(tuval: HTMLCanvasElement, webpKalite: number, jpegKalite: number): Promise<Blob> {
  const al = (tur: string, kalite: number) => new Promise<Blob | null>((coz) => tuval.toBlob(coz, tur, kalite));
  const w = await al("image/webp", webpKalite);
  if (w && w.type === "image/webp") return w;
  const beyaz = document.createElement("canvas");
  beyaz.width = tuval.width;
  beyaz.height = tuval.height;
  const c = beyaz.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, beyaz.width, beyaz.height);
  c.drawImage(tuval, 0, 0);
  const j = await new Promise<Blob | null>((coz) => beyaz.toBlob(coz, "image/jpeg", jpegKalite));
  if (!j) throw new Error("kodlanamadı");
  return j;
}

export interface HazirResim {
  blob: Blob;
  genislik: number;
  yukseklik: number;
}

/** The image that will really be sent for a given quality. "orijinal" with edits keeps full size at a higher encoder quality. */
/** Verilen kalitede gerçekten gönderilecek resim. Düzenlenmiş "orijinal", tam boyutu daha yüksek kodlayıcı kalitesiyle korur. */
export async function resimUret(b: ImageBitmap, d: Duzenleme, kalite: ResimKalitesi): Promise<HazirResim> {
  const tuval = cizCanvas(b, d, UZUN_KENAR[kalite]);
  const blob = kalite === "orijinal" ? await blobaCevir(tuval, 0.95, 0.95) : await blobaCevir(tuval, 0.82, 0.85);
  return { blob, genislik: tuval.width, yukseklik: tuval.height };
}

/** Thumbnail with a long edge of 800 px (WebP 0.7), drawn from a ready canvas or bitmap. · Uzun kenarı 800 px küçük resim (WebP 0.7). */
export async function kucukResim(kaynak: CanvasImageSource & { width: number; height: number }): Promise<HazirResim> {
  const olcek = Math.min(1, 800 / Math.max(kaynak.width, kaynak.height));
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(kaynak.width * olcek));
  t.height = Math.max(1, Math.round(kaynak.height * olcek));
  const c = t.getContext("2d")!;
  c.imageSmoothingQuality = "high";
  c.drawImage(kaynak, 0, 0, t.width, t.height);
  return { blob: await blobaCevir(t, 0.7, 0.75), genislik: t.width, yukseklik: t.height };
}

/** Rough size before encoding (≈ 0.17 byte per WebP pixel); shown with "≈" until the real encode finishes. · Kodlamadan önce kaba boyut. */
export function tahminiResimBoyutu(b: { width: number; height: number }, d: Duzenleme, kalite: ResimKalitesi): number {
  const { g, y } = gorunenBoyut(b, d);
  const k = d.kirp ?? { x: 0, y: 0, w: 1, h: 1 };
  const kg = g * k.w;
  const ky = y * k.h;
  const olcek = Math.min(1, UZUN_KENAR[kalite] / Math.max(kg, ky));
  return Math.round(kg * olcek * ky * olcek * (kalite === "orijinal" ? 0.4 : 0.17));
}

// ---- Upload to Rust · Rust'a yükleme ----

const PARCA = 1.5 * 1024 * 1024;

function base64Oku(parca: Blob): Promise<string> {
  return new Promise((coz, red) => {
    const r = new FileReader();
    r.onload = () => coz(String(r.result).split(",")[1] ?? "");
    r.onerror = () => red(r.error);
    r.readAsDataURL(parca);
  });
}

/** Writes a Blob / File into the app cache in 1.5 MB base64 chunks (Tauri cannot send raw bodies on Android). Returns the file id. */
/** Blob / File'ı uygulama önbelleğine 1,5 MB'lık base64 parçalarla yazar (Tauri Android'de ham gövde yollayamaz). Dosya kimliğini döndürür. */
export async function dosyaYukle(veri: Blob, uzanti: string, ilerle?: (oran: number) => void): Promise<string> {
  let kimlik: string | null = null;
  if (veri.size === 0) return medyaParcaYaz(null, uzanti, "");
  for (let bas = 0; bas < veri.size; bas += PARCA) {
    kimlik = await medyaParcaYaz(kimlik, uzanti, await base64Oku(veri.slice(bas, bas + PARCA)));
    ilerle?.(Math.min(1, (bas + PARCA) / veri.size));
  }
  return kimlik!;
}

/** File name extension in lower case without the dot · Küçük harfli, noktasız dosya uzantısı */
export function uzantiBul(ad: string, mime: string): string {
  const u = ad.includes(".") ? ad.split(".").pop()!.toLowerCase() : "";
  if (/^[a-z0-9]{1,8}$/.test(u)) return u;
  return mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
}

/** The name of an edited image: same base name, new extension · Düzenlenmiş resmin adı: aynı ad, yeni uzantı */
export function adDegistir(ad: string, uzanti: string): string {
  const govde = ad.includes(".") ? ad.slice(0, ad.lastIndexOf(".")) : ad;
  return `${govde || "foto"}.${uzanti}`;
}
