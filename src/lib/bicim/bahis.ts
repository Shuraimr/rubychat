// Composer @mention helpers: Turkish/case-insensitive member matching, position-tracked mention spans so two members
// with the same display name are never mixed up, deletion tracking, and extracting existing mentions when editing.
// Yazma alanı @bahsetme yardımcıları: Türkçe/büyük-küçük harf duyarsız üye eşleştirme, aynı görünen adlı iki üyenin
// karışmaması için konum takipli bahsetme aralıkları, silme takibi ve düzenlemede mevcut bahsetmeleri çıkarma.
import type { Uye } from "../api/tipler";
import { duzMetin, temizle, type Dugum } from "./temizle";

export interface BahisKaydi {
  /** UTF-16 start index in the draft text (at '@') · Taslak metnindeki UTF-16 başlangıç konumu ('@' karakterinde) */
  bas: number;
  /** UTF-16 end index in the draft text (right after the visible token) · Görünen metnin hemen sonrası */
  son: number;
  /** Visible text in the draft, e.g. "@Ali" or "@room" · Taslaktaki görünen metin, örn. "@Ali" veya "@room" */
  etiket: string;
  /** Matrix user id, or null for @room · Matrix kullanıcı kimliği; @room için null */
  kullaniciId: string | null;
  /** True for @room · @room için true */
  oda?: boolean;
}

export type BahisOnerisi =
  | { tur: "kisi"; kullaniciId: string; ad: string; avatarMxc: string | null }
  | { tur: "oda"; ad: "room" };

export interface BahisTetik {
  /** Index of '@' · '@' karakterinin konumu */
  bas: number;
  /** Caret index (end of the query) · İmleç konumu (sorgunun sonu) */
  son: number;
  /** Characters typed after '@' · '@' sonrasında yazılanlar */
  sorgu: string;
}

export interface ToplananBahis {
  /** User ids in order of appearance · Görünme sırasıyla kullanıcı kimlikleri */
  kullanicilar: string[];
  /** Whether @room is present · @room var mı */
  oda: boolean;
  /** Ranges relative to `hamMetin.trim()` for Markdown protection · Markdown koruması için `hamMetin.trim()` aralıkları */
  araliklar: { bas: number; son: number }[];
}

const KELIME_ICI = /[\p{L}\p{N}]/u;

/**
 * Fold case and Turkish / Latin diacritics for mention matching:
 * "Işık", "ISIK", "işık", "İsık" and "isik" all fold to "isik".
 * Bahsetme eşleştirmesi için büyük/küçük harf ve Türkçe / Latin imlerini katla:
 * "Işık", "ISIK", "işık", "İsık" ve "isik" hepsi "isik" olur.
 */
export function trKatla(s: string): string {
  return s
    .replace(/[İIı]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[ÜüÛû]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .replace(/[Ââ]/g, "a")
    .replace(/[Îî]/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Word-like boundary check (matches Rust `sinir_uygun`): allows `@Ali,`, `@Ali'ye`, rejects `foo@Ali` and `@Alibaba`. · Sözcük sınırı denetimi (Rust `sinir_uygun` ile aynı). */
function sinirUygun(metin: string, bas: number, son: number): boolean {
  if (bas > 0) {
    const once = metin[bas - 1];
    if (KELIME_ICI.test(once) || once === "_") return false;
  }
  if (son < metin.length && KELIME_ICI.test(metin[son])) return false;
  return true;
}

/** Detects an active `@query` at a word start ending at `imlec`. · `imlec` konumunda biten, sözcük başındaki `@sorgu` tetiğini bulur. */
export function tetikBul(metin: string, imlec: number): BahisTetik | null {
  if (imlec <= 0 || imlec > metin.length) return null;
  const once = metin.slice(0, imlec);
  const m = /(?:^|[\s([{'"«“‘])@([^\s@]{0,40})$/.exec(once);
  if (!m) return null;
  const sorgu = m[1];
  return { bas: imlec - sorgu.length - 1, son: imlec, sorgu };
}

/**
 * Filters and ranks joined room members (excluding me) plus optional `@room`, capped at `maks` (default 6).
 * Katılmış oda üyelerini (ben hariç) ve izin varsa `@room` seçeneğini süzer ve sıralar; en çok `maks` (varsayılan 6).
 */
export function onerileriSuz(
  liste: Uye[],
  sorgu: string,
  benimId: string | undefined,
  odaIzinli: boolean,
  maks = 6,
): BahisOnerisi[] {
  const q = trKatla(sorgu);
  const puanli: { puan: number; u: Uye }[] = [];
  for (const u of liste) {
    if (u.uyelik !== "join") continue;
    if (benimId && u.kullaniciId === benimId) continue;
    const ad = u.ad || u.kullaniciId.replace(/^@/, "").split(":")[0];
    if (!q) {
      puanli.push({ puan: 0, u: { ...u, ad } });
      continue;
    }
    const adK = trKatla(ad);
    const idK = trKatla(u.kullaniciId);
    const yerelK = idK.replace(/^@/, "").split(":")[0];
    let puan = -1;
    if (adK.startsWith(q)) puan = 0;
    else if (adK.split(/\s+/).some((w) => w.startsWith(q))) puan = 1;
    else if (yerelK.startsWith(q)) puan = 2;
    else if (adK.includes(q)) puan = 3;
    else if (idK.includes(q)) puan = 4;
    if (puan >= 0) puanli.push({ puan, u: { ...u, ad } });
  }
  puanli.sort((a, b) => a.puan - b.puan || a.u.ad.localeCompare(b.u.ad, "tr") || a.u.kullaniciId.localeCompare(b.u.kullaniciId));

  const odaEslesir = odaIzinli && (!q || "room".startsWith(q) || "oda".startsWith(q) || "herkes".startsWith(q) || "room".includes(q));
  const kisiSiniri = odaEslesir ? Math.max(0, maks - 1) : maks;
  const sonuc: BahisOnerisi[] = puanli.slice(0, kisiSiniri).map(({ u }) => ({
    tur: "kisi",
    kullaniciId: u.kullaniciId,
    ad: u.ad,
    avatarMxc: u.avatarMxc,
  }));
  if (odaEslesir) sonuc.push({ tur: "oda", ad: "room" });
  return sonuc;
}

/**
 * Updates tracked mention spans when `eski` changes to `yeni`. `imlec` (caret after the edit) disambiguates edits
 * when two mentions share the exact same visible text (e.g. deleting the first `@Ali` in `@Ali @Ali`).
 * `eski` metni `yeni`ye değişince bahsetme aralıklarını günceller. `imlec` (düzenleme sonrası imleç) aynı görünen ada
 * sahip iki bahsetme varken hangisinin silindiğini ayırt eder.
 */
export function bahisleriGuncelle(eski: string, yeni: string, bahisler: BahisKaydi[], imlec?: number): BahisKaydi[] {
  if (bahisler.length === 0) return [];
  if (eski === yeni) {
    return bahisler.filter((b) => yeni.slice(b.bas, b.son) === b.etiket && sinirUygun(yeni, b.bas, b.son));
  }

  const gecerliImlec = imlec !== undefined && imlec >= 0 && imlec <= yeni.length;
  const sinirP = gecerliImlec ? Math.min(eski.length, imlec) : Math.min(eski.length, yeni.length);
  let p = 0;
  while (p < sinirP && eski.charCodeAt(p) === yeni.charCodeAt(p)) p++;

  const sinirS = gecerliImlec ? Math.min(eski.length - p, yeni.length - imlec) : Math.min(eski.length - p, yeni.length - p);
  let s = 0;
  while (s < sinirS && eski.charCodeAt(eski.length - 1 - s) === yeni.charCodeAt(yeni.length - 1 - s)) s++;

  const degBas = p;
  const degEskiSon = eski.length - s;
  const degYeniSon = yeni.length - s;
  const fark = degYeniSon - degEskiSon;

  const kalan: BahisKaydi[] = [];
  for (const b of bahisler) {
    let bas = b.bas;
    let son = b.son;
    if (degBas === degEskiSon) {
      if (son <= degBas) {
        // Edit is after this mention · Düzenleme bu bahsetmeden sonra
      } else if (bas >= degBas) {
        bas += fark;
        son += fark;
      } else {
        // Inserted inside the mention: drop · Bahsetmenin içine eklendi: düşür
        continue;
      }
    } else {
      if (son <= degBas) {
        // Edit is after this mention · Düzenleme bu bahsetmeden sonra
      } else if (bas >= degEskiSon) {
        bas += fark;
        son += fark;
      } else {
        // Overlaps this mention: drop · Bu bahsetmeyle kesişti: düşür
        continue;
      }
    }
    if (bas >= 0 && son <= yeni.length && yeni.slice(bas, son) === b.etiket && sinirUygun(yeni, bas, son)) {
      kalan.push({ ...b, bas, son });
    }
  }
  return kalan;
}

/** Replaces the active `@query` with `@DisplayName ` (or `@room `) and records the mention span. · Etkin `@sorgu`yu `@GörünenAd ` (ya da `@room `) ile değiştirir ve aralığı kaydeder. */
export function bahisUygula(
  metin: string,
  bahisler: BahisKaydi[],
  tetik: BahisTetik,
  secim: BahisOnerisi,
): { metin: string; bahisler: BahisKaydi[]; imlec: number } {
  const etiket = secim.tur === "oda" ? "@room" : `@${secim.ad}`;
  const sonrakiBosluk = metin[tetik.son] === " ";
  const ek = sonrakiBosluk ? etiket : `${etiket} `;
  const yeniMetin = metin.slice(0, tetik.bas) + ek + metin.slice(tetik.son);
  const degisSon = tetik.bas + ek.length;
  const guncel = bahisleriGuncelle(metin, yeniMetin, bahisler, degisSon);
  const yeniKayit: BahisKaydi =
    secim.tur === "oda"
      ? { bas: tetik.bas, son: tetik.bas + etiket.length, etiket, kullaniciId: null, oda: true }
      : { bas: tetik.bas, son: tetik.bas + etiket.length, etiket, kullaniciId: secim.kullaniciId };
  guncel.push(yeniKayit);
  guncel.sort((a, b) => a.bas - b.bas);
  return { metin: yeniMetin, bahisler: guncel, imlec: sonrakiBosluk ? degisSon + 1 : degisSon };
}

/** Collects verified mentions in order of appearance right before sending or editing. · Gönderme ya da düzenleme hemen öncesinde doğrulanmış bahsetmeleri sırasıyla toplar. */
export function bahisleriTopla(hamMetin: string, bahisler: BahisKaydi[]): ToplananBahis {
  const basBosluk = hamMetin.length - hamMetin.trimStart().length;
  const kirpik = hamMetin.trim();
  const sirali = [...bahisler].sort((a, b) => a.bas - b.bas);
  const kullanicilar: string[] = [];
  const araliklar: { bas: number; son: number }[] = [];
  let oda = false;
  for (const b of sirali) {
    const bas = b.bas - basBosluk;
    const son = b.son - basBosluk;
    if (bas < 0 || son > kirpik.length) continue;
    if (kirpik.slice(bas, son) !== b.etiket) continue;
    if (!sinirUygun(kirpik, bas, son)) continue;
    if (b.oda) {
      oda = true;
    } else if (b.kullaniciId) {
      kullanicilar.push(b.kullaniciId);
      araliklar.push({ bas, son });
    }
  }
  return { kullanicilar, oda, araliklar };
}

/**
 * Extracts existing user mention spans from a message's HTML + plain text when entering edit mode,
 * so untouched mentions keep their user ids and matrix.to pills while deleted ones are dropped.
 * Düzenleme kipine girerken mesajın HTML + düz metninden mevcut kullanıcı bahsetmelerini çıkarır;
 * dokunulmayanlar korunur, silinenler düşer.
 */
export function htmlBahisleriCikar(metin: string, html: string | null): BahisKaydi[] {
  if (!metin || !html) return [];
  const bulunan: { kimlik: string; yazi: string }[] = [];
  const gez = (dugumler: Dugum[]) => {
    for (const d of dugumler) {
      if (d.t !== "e") continue;
      if (d.etiket === "a" && d.pill?.tur === "kullanici") {
        bulunan.push({ kimlik: d.pill.kimlik, yazi: duzMetin(d.cocuk) });
      } else {
        gez(d.cocuk);
      }
    }
  };
  gez(temizle(html));

  const sonuc: BahisKaydi[] = [];
  let imlec = 0;
  for (const { kimlik, yazi } of bulunan) {
    const adaylar = [yazi];
    if (yazi && !yazi.startsWith("@")) adaylar.push(`@${yazi}`);
    adaylar.push(kimlik);
    let eslesme: { bas: number; son: number; etiket: string } | null = null;
    for (const aday of adaylar) {
      if (!aday) continue;
      let ara = imlec;
      while (ara < metin.length) {
        const i = metin.indexOf(aday, ara);
        if (i < 0) break;
        const son = i + aday.length;
        if (sinirUygun(metin, i, son)) {
          if (!eslesme || i < eslesme.bas || (i === eslesme.bas && son > eslesme.son)) {
            eslesme = { bas: i, son, etiket: aday };
          }
          break;
        }
        ara = i + 1;
      }
    }
    if (eslesme) {
      sonuc.push({ bas: eslesme.bas, son: eslesme.son, etiket: eslesme.etiket, kullaniciId: kimlik });
      imlec = eslesme.son;
    }
  }
  return sonuc;
}
