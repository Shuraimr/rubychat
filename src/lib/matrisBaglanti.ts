// Single parser for Matrix links: https://matrix.to/#/... and MSC2312 matrix: URIs.
// Supports room ids with or without a server part (Room v12 `!hash`), room aliases (`#alias:server`),
// users (`@user:server`), optional event ids (`$event`), `via` servers, and `action=chat`.
// Matrix bağlantıları için tek ayrıştırıcı: https://matrix.to/#/... ve MSC2312 matrix: adresleri.
// Sunuculu ya da sunucusuz oda kimliklerini (Oda v12 `!özet`), takma adları (`#takma:sunucu`),
// kullanıcıları (`@kisi:sunucu`), isteğe bağlı olay kimliğini (`$olay`), `via` sunucularını ve `action=chat`i destekler.

export type MatrisBaglanti =
  | { tur: "oda"; kimlik: string; olay?: string; via: string[] }
  | { tur: "kullanici"; kimlik: string; sohbet?: boolean };

function cozumle(parca: string): string | null {
  try {
    return decodeURIComponent(parca);
  } catch {
    return null;
  }
}

/** Room id: `!local` (v12) or `!local:server`, no whitespace or separators · Oda kimliği: `!yerel` (v12) ya da `!yerel:sunucu`, boşluk/ayraç yok */
function gecerliOdaId(s: string): boolean {
  if (!s.startsWith("!") || s.length < 2 || /[\s/?#]/.test(s)) return false;
  const govde = s.slice(1);
  const ikiNokta = govde.indexOf(":");
  if (ikiNokta < 0) return true;
  return ikiNokta > 0 && ikiNokta < govde.length - 1;
}

/** Room alias: `#local:server` · Oda takma adı: `#yerel:sunucu` */
function gecerliTakmaAd(s: string): boolean {
  if (!s.startsWith("#") || /[\s/?#]/.test(s)) return false;
  const govde = s.slice(1);
  const ikiNokta = govde.indexOf(":");
  return ikiNokta > 0 && ikiNokta < govde.length - 1;
}

/** Matrix user id: `@local:server` · Matrix kullanıcı kimliği: `@yerel:sunucu` */
function gecerliKullaniciId(s: string): boolean {
  if (!s.startsWith("@") || /[\s/?#]/.test(s)) return false;
  const govde = s.slice(1);
  const ikiNokta = govde.indexOf(":");
  return ikiNokta > 0 && ikiNokta < govde.length - 1;
}

/** Event id: `$opaque` (or legacy `$local:server`) · Olay kimliği: `$kimlik` (ya da eski `$yerel:sunucu`) */
function gecerliOlayId(s: string): boolean {
  return s.startsWith("$") && s.length >= 2 && !/[\s/?#]/.test(s);
}

function sorguCoz(sorgu: string): { via: string[]; sohbet: boolean } {
  if (!sorgu) return { via: [], sohbet: false };
  const p = new URLSearchParams(sorgu);
  const via: string[] = [];
  const gorulen = new Set<string>();
  for (const ham of p.getAll("via")) {
    const v = ham.trim();
    if (!v || /[\s/?#]/.test(v) || gorulen.has(v)) continue;
    gorulen.add(v);
    via.push(v);
  }
  const sohbet = p.get("action")?.trim().toLowerCase() === "chat";
  return { via, sohbet };
}

/** Parses `https://matrix.to/#/<id>[/<event>][?via=...]` · `https://matrix.to/#/<kimlik>[/<olay>][?via=...]` ayrıştırır */
function matrixToCoz(girdi: string): MatrisBaglanti | null {
  const m = girdi.match(/^https?:\/\/matrix\.to\/#\/(.+)$/i);
  if (!m) return null;
  const kuyruk = m[1];
  const soru = kuyruk.indexOf("?");
  const yol = (soru >= 0 ? kuyruk.slice(0, soru) : kuyruk).replace(/\/+$/, "");
  const sorgu = soru >= 0 ? kuyruk.slice(soru + 1) : "";
  if (!yol) return null;

  const parcalar = yol.split("/");
  if (parcalar.length > 2) return null;
  const kimlik = cozumle(parcalar[0]);
  if (!kimlik) return null;

  const { via, sohbet } = sorguCoz(sorgu);

  if (gecerliKullaniciId(kimlik)) {
    if (parcalar.length > 1) return null;
    return sohbet ? { tur: "kullanici", kimlik, sohbet: true } : { tur: "kullanici", kimlik };
  }

  if (gecerliOdaId(kimlik) || gecerliTakmaAd(kimlik)) {
    let olay: string | undefined;
    if (parcalar.length === 2) {
      const o = cozumle(parcalar[1]);
      if (!o || !gecerliOlayId(o)) return null;
      olay = o;
    }
    return olay ? { tur: "oda", kimlik, olay, via } : { tur: "oda", kimlik, via };
  }

  return null;
}

/** Parses MSC2312 `matrix:roomid/...`, `matrix:r/...`, `matrix:u/...` · MSC2312 `matrix:` URI'lerini ayrıştırır */
function matrixUriCoz(girdi: string): MatrisBaglanti | null {
  if (!/^matrix:/i.test(girdi)) return null;
  // Strip `matrix:` (and any stray leading slashes if a launcher added them) · `matrix:` önekini ayır
  const kalan = girdi.slice(7).replace(/^\/+/, "");
  if (!kalan) return null;

  // Drop fragment if any, split query · Varsa # parçasını at, sorguyu ayır
  const diyez = kalan.indexOf("#");
  const temel = diyez >= 0 ? kalan.slice(0, diyez) : kalan;
  const soru = temel.indexOf("?");
  const yol = (soru >= 0 ? temel.slice(0, soru) : temel).replace(/\/+$/, "");
  const sorgu = soru >= 0 ? temel.slice(soru + 1) : "";
  if (!yol) return null;

  const parcalar = yol.split("/");
  if (parcalar.length !== 2 && parcalar.length !== 4) return null;

  const tip = parcalar[0].toLowerCase();
  const hamKimlik = cozumle(parcalar[1]);
  if (!hamKimlik) return null;

  const { via, sohbet } = sorguCoz(sorgu);

  if (tip === "u") {
    if (parcalar.length !== 2) return null;
    const kimlik = hamKimlik.startsWith("@") ? hamKimlik : `@${hamKimlik}`;
    if (!gecerliKullaniciId(kimlik)) return null;
    return sohbet ? { tur: "kullanici", kimlik, sohbet: true } : { tur: "kullanici", kimlik };
  }

  if (tip === "roomid" || tip === "r") {
    const onek = tip === "roomid" ? "!" : "#";
    const kimlik = hamKimlik.startsWith(onek) ? hamKimlik : `${onek}${hamKimlik}`;
    const gecerli = tip === "roomid" ? gecerliOdaId(kimlik) : gecerliTakmaAd(kimlik);
    if (!gecerli) return null;

    let olay: string | undefined;
    if (parcalar.length === 4) {
      if (parcalar[2].toLowerCase() !== "e") return null;
      const hamOlay = cozumle(parcalar[3]);
      if (!hamOlay) return null;
      const o = hamOlay.startsWith("$") ? hamOlay : `$${hamOlay}`;
      if (!gecerliOlayId(o)) return null;
      olay = o;
    }
    return olay ? { tur: "oda", kimlik, olay, via } : { tur: "oda", kimlik, via };
  }

  return null;
}

/** Parses a `matrix.to` or `matrix:` link into a typed target, or `null` if invalid/unsupported. */
/** Bir `matrix.to` ya da `matrix:` bağlantısını tipli hedefe çevirir; geçersiz/desteklenmiyorsa `null` döner. */
export function matrisBaglantiCoz(url: string): MatrisBaglanti | null {
  const s = url.trim();
  if (!s) return null;
  if (/^matrix:/i.test(s)) return matrixUriCoz(s);
  if (/^https?:\/\/matrix\.to\/#\//i.test(s)) return matrixToCoz(s);
  return null;
}
