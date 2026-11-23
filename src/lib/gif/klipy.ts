// KLIPY GIF API adapter (https://docs.klipy.com, checked 2026-11-23). One place to change if the API moves.
//   GET https://api.klipy.com/api/v1/{app_key}/gifs/search?q=&page=&per_page=&customer_id=
//   GET https://api.klipy.com/api/v1/{app_key}/gifs/trending?page=&per_page=&customer_id=
//   response: { result, data: { data: [ { id, slug, title, file: { hd|md|sm|xs: { gif|webp|mp4|webm: { url, width, height } } } } ], has_next } }
// Rules we follow: no caching / proxying of the media (the WebView loads static*.klipy.com directly), the search field's placeholder is
// "Search KLIPY" (their attribution rule; Turkish "KLIPY'de ara"), and a "Powered by KLIPY" mark is shown. The key is the user's own
// (Ayarlar › Sohbet) and lives only on this device. `customer_id` is a random per-install id, not tied to the Matrix account.
// KLIPY GIF API bağdaştırıcısı (https://docs.klipy.com, 2026-11-23'te denetlendi). API değişirse tek değişecek yer.
// Uyduğumuz kurallar: medya önbelleğe alınmaz / vekillenmez (WebView static*.klipy.com'dan doğrudan yükler), arama alanının yer tutucusu
// "Search KLIPY" (atıf kuralları; Türkçesi "KLIPY'de ara"), "Powered by KLIPY" işareti gösterilir. Anahtar kullanıcının kendisinin
// (Ayarlar › Sohbet) ve yalnızca bu cihazda durur. `customer_id` kuruluma özel rastgele kimliktir, Matrix hesabına bağlı değildir.
export interface GifOgesi {
  id: string;
  baslik: string;
  /** small preview (a few hundred KB at most) · küçük önizleme */
  onizleme: string;
  /** the URL that is sent as a message · mesaj olarak gönderilen adres */
  url: string;
  genislik: number;
  yukseklik: number;
}

const TABAN = "https://api.klipy.com/api/v1";
const KIM = "rubychat.klipyMusteri";

function musteriKimligi(): string {
  try {
    let k = localStorage.getItem(KIM);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(KIM, k);
    }
    return k;
  } catch {
    return "anon";
  }
}

interface Bicim { url?: string; width?: number; height?: number }
type Boyut = Partial<Record<"gif" | "webp" | "mp4" | "webm", Bicim>>;

function esle(h: unknown): GifOgesi | null {
  const o = h as { id?: string | number; slug?: string; title?: string; file?: Partial<Record<"hd" | "md" | "sm" | "xs", Boyut>> };
  const f = o?.file;
  if (!f) return null;
  const orta = f.md?.gif ?? f.sm?.gif ?? f.hd?.gif ?? f.xs?.gif;
  const kucuk = f.sm?.gif ?? f.xs?.gif ?? f.md?.gif ?? f.sm?.webp;
  if (!orta?.url || !kucuk?.url) return null;
  // Only the KLIPY media hosts are ever used (also what the CSP allows). · Yalnızca KLIPY medya sunucuları kullanılır (CSP de bunu izin verir).
  if (!/^https:\/\/static\d*\.klipy\.com\//.test(orta.url) || !/^https:\/\/static\d*\.klipy\.com\//.test(kucuk.url)) return null;
  return { id: String(o.id ?? o.slug ?? orta.url), baslik: o.title ?? "", onizleme: kucuk.url, url: orta.url, genislik: orta.width ?? 200, yukseklik: orta.height ?? 200 };
}

export async function gifAra(anahtar: string, sorgu: string, sayfa = 1): Promise<{ ogeler: GifOgesi[]; devami: boolean }> {
  const q = new URLSearchParams({ page: String(sayfa), per_page: "24", customer_id: musteriKimligi() });
  const yol = sorgu.trim() ? "search" : "trending";
  if (sorgu.trim()) q.set("q", sorgu.trim());
  const r = await fetch(`${TABAN}/${encodeURIComponent(anahtar)}/gifs/${yol}?${q}`);
  if (!r.ok) throw new Error(`klipy ${r.status}`);
  const j = (await r.json()) as { data?: { data?: unknown[]; has_next?: boolean } };
  const ogeler = (j.data?.data ?? []).map(esle).filter((x): x is GifOgesi => !!x);
  return { ogeler, devami: !!j.data?.has_next };
}

/** Is this message text a bare KLIPY media link? Then the room draws it inline as a looping picture. · Bu mesaj metni yalın bir KLIPY medya bağlantısı mı? O zaman oda onu satır içi döngülü resim olarak çizer. */
export const klipyBaglantisi = (m: string | null | undefined): string | null => {
  const s = (m ?? "").trim();
  return /^https:\/\/static\d*\.klipy\.com\/\S+\.(gif|webp|mp4|webm)$/i.test(s) ? s : null;
};
