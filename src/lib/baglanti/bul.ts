// Finds links in message text and classifies them, WITHOUT touching the network. Cards for known sites are built from the URL alone;
// the network parts (YouTube title, GitHub stars) live in onizleme.ts and are gated by the user's privacy settings.
// Mesaj metnindeki bağlantıları ağa DOKUNMADAN bulur ve sınıflandırır. Bilinen sitelerin kartları yalnızca adresten kurulur;
// ağ gerektiren kısımlar (YouTube başlığı, GitHub yıldızı) onizleme.ts'te ve kullanıcının gizlilik ayarlarıyla sınırlıdır.
export type BaglantiTuru = "youtube" | "github" | "x" | "spotify" | "reddit" | "wikipedia" | "genel";

export interface Baglanti {
  url: string;
  tur: BaglantiTuru;
  host: string;
  /** youtube video id · youtube video kimliği */
  videoId?: string;
  /** github: owner/repo and the optional issue / pull request number · github: owner/repo ve isteğe bağlı konu / çekme isteği numarası */
  sahip?: string;
  depo?: string;
  alt?: { tur: "issues" | "pull"; no: string };
}

const URL_RE = /(?:https?:\/\/|matrix:(?:roomid|r|u)\/)[^\s<>"']+/gi;

/** Split text into plain / link segments (trailing punctuation stays outside the link) · Metni düz / bağlantı parçalarına böl (sondaki noktalama bağlantının dışında kalır) */
export function parcala(metin: string): { m: string; url: boolean }[] {
  const out: { m: string; url: boolean }[] = [];
  let son = 0;
  for (const e of metin.matchAll(URL_RE)) {
    let u = e[0];
    const i = e.index ?? 0;
    const kuyruk = u.match(/[).,;:!?'"]+$/)?.[0] ?? "";
    if (kuyruk) u = u.slice(0, -kuyruk.length);
    if (i > son) out.push({ m: metin.slice(son, i), url: false });
    out.push({ m: u, url: true });
    son = i + u.length;
  }
  if (son < metin.length) out.push({ m: metin.slice(son), url: false });
  return out.length ? out : [{ m: metin, url: false }];
}

export function siniflandir(url: string): Baglanti | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const b: Baglanti = { url: u.href, tur: "genel", host };
  const yol = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" && yol[0]) return { ...b, tur: "youtube", videoId: yol[0] };
  if (host === "youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(yol[0]) ? yol[1] : undefined);
    if (v && /^[\w-]{6,15}$/.test(v)) return { ...b, tur: "youtube", videoId: v };
  }
  if (host === "github.com" && yol.length >= 2 && /^[\w.-]+$/.test(yol[0]) && /^[\w.-]+$/.test(yol[1])) {
    const alt = (yol[2] === "issues" || yol[2] === "pull") && /^\d+$/.test(yol[3] ?? "") ? { tur: yol[2] as "issues" | "pull", no: yol[3] } : undefined;
    return { ...b, tur: "github", sahip: yol[0], depo: yol[1].replace(/\.git$/, ""), alt };
  }
  if (host === "x.com" || host === "twitter.com") return { ...b, tur: "x" };
  if (host === "open.spotify.com" || host === "spotify.link") return { ...b, tur: "spotify" };
  if (host === "reddit.com" || host === "redd.it" || host.endsWith(".reddit.com")) return { ...b, tur: "reddit" };
  if (host.endsWith("wikipedia.org")) return { ...b, tur: "wikipedia" };
  return b;
}

/** The first `sinir` distinct links of a message, classified · Bir mesajdaki ilk `sinir` farklı bağlantı, sınıflandırılmış */
export function baglantilar(metin: string | null, sinir = 2): Baglanti[] {
  if (!metin) return [];
  const gorulen = new Set<string>();
  const sonuc: Baglanti[] = [];
  for (const p of parcala(metin)) {
    if (!p.url || gorulen.has(p.m)) continue;
    gorulen.add(p.m);
    const b = siniflandir(p.m);
    if (b) sonuc.push(b);
    if (sonuc.length >= sinir) break;
  }
  return sonuc;
}
