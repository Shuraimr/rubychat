// Notification center store (bell): keeps up to 50 newest-first items across messages, mentions, invites, updates and setup checks.
// Persisted in localStorage (wrapped in try/catch) and wiped on sign-out so another account never sees the previous one's alerts.
// Bildirim merkezi deposu (zil): mesaj, bahsetme, davet, güncelleme ve kurulum öğelerini en yeni üstte en çok 50 adet tutar.
// localStorage'da saklanır (try/catch ile) ve oturum kapanınca silinir; başka hesap öncekinin bildirimlerini görmez.
import type { Istekler } from "../api/tipler";
import { t } from "../i18n";

export type BildirimMerkeziTuru = "mesaj" | "bahsetme" | "davet" | "guncelleme" | "kurulum";

export interface BildirimOgesi {
  id: string;
  tur: BildirimMerkeziTuru;
  baslik: string;
  metin: string;
  zaman: number;
  odaId?: string;
  avatarMxc?: string | null;
  harf?: string;
  okundu: boolean;
  /** Optional small context line (e.g. room name) · İsteğe bağlı küçük bağlam satırı (ör. oda adı) */
  baglam?: string;
  /** Yellow warning tint for setup report items · Kurulum raporu öğeleri için sarı uyarı tonu */
  uyari?: boolean;
  /** Version tag for update items · Güncelleme öğeleri için sürüm etiketi */
  surum?: string;
}

export type YeniBildirimOgesi = Omit<BildirimOgesi, "id" | "zaman" | "okundu"> & {
  id?: string;
  zaman?: number;
  okundu?: boolean;
};

const ANAHTAR = "rubychat.bildirimMerkezi";
const MAKS = 50;
const TURLER = new Set<BildirimMerkeziTuru>(["mesaj", "bahsetme", "davet", "guncelleme", "kurulum"]);

function oku(): BildirimOgesi[] {
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]") as unknown;
    if (!Array.isArray(ham)) return [];
    const sonuc: BildirimOgesi[] = [];
    for (const x of ham) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      if (typeof o.id !== "string" || !TURLER.has(o.tur as BildirimMerkeziTuru)) continue;
      if (typeof o.baslik !== "string" || typeof o.metin !== "string" || typeof o.zaman !== "number") continue;
      sonuc.push({
        id: o.id,
        tur: o.tur as BildirimMerkeziTuru,
        baslik: o.baslik,
        metin: o.metin,
        zaman: o.zaman,
        odaId: typeof o.odaId === "string" ? o.odaId : undefined,
        avatarMxc: typeof o.avatarMxc === "string" || o.avatarMxc === null ? o.avatarMxc : undefined,
        harf: typeof o.harf === "string" ? o.harf : undefined,
        okundu: Boolean(o.okundu),
        baglam: typeof o.baglam === "string" ? o.baglam : undefined,
        uyari: typeof o.uyari === "boolean" ? o.uyari : undefined,
        surum: typeof o.surum === "string" ? o.surum : undefined,
      });
      if (sonuc.length >= MAKS) break;
    }
    return sonuc;
  } catch {
    return [];
  }
}

class BildirimMerkezi {
  ogeler = $state<BildirimOgesi[]>(oku());
  /** Panel open state (phone AltSayfa / desktop popover) · Panelin açık olma durumu (telefonda AltSayfa / masaüstünde açılır panel) */
  acik = $state(false);
  /** Trigger element that opened the panel (used to anchor desktop popover and restore focus) · Paneli açan düğme (masaüstü konumlandırma ve odağı geri vermek için) */
  tetik = $state<HTMLElement | null>(null);
  #sayac = 0;

  okunmamis = $derived(this.ogeler.reduce((n, o) => n + (o.okundu ? 0 : 1), 0));

  #sakla() {
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify($state.snapshot(this.ogeler)));
    } catch {
      /* blocked or full storage: keep working in memory · depo engelli ya da dolu: bellekte çalışmayı sürdür */
    }
  }

  /** Prepends an item (deduplicated when `id` is given) and trims to 50. · Bir öğeyi başa ekler (`id` verildiyse yinelemez) ve 50 ile sınırlar. */
  ekle(girdi: YeniBildirimOgesi): string {
    const id = girdi.id ?? `${girdi.tur}:${Date.now()}:${++this.#sayac}`;
    if (girdi.id && this.ogeler.some((o) => o.id === id)) return id;
    const oge: BildirimOgesi = {
      ...girdi,
      id,
      zaman: girdi.zaman ?? Date.now(),
      okundu: girdi.okundu ?? false,
    };
    this.ogeler = [oge, ...this.ogeler].slice(0, MAKS);
    this.#sakla();
    return id;
  }

  /** Syncs pending incoming invitations into the center without duplicates and drops resolved ones. · Bekleyen gelen davetleri yinelemeden merkeze işler, bitenleri kaldırır. */
  davetleriEsle(gelen: Istekler["gelen"]) {
    const aktif = new Set(gelen.map((d) => `davet:${d.oda.id}`));
    let degisti = false;
    const kalan = this.ogeler.filter((o) => {
      if (o.tur === "davet" && o.id.startsWith("davet:") && !aktif.has(o.id)) {
        degisti = true;
        return false;
      }
      return true;
    });
    const mevcut = new Set(kalan.map((o) => o.id));
    const yeniler: BildirimOgesi[] = [];
    const simdi = Date.now();
    for (const d of gelen) {
      const id = `davet:${d.oda.id}`;
      if (mevcut.has(id)) continue;
      degisti = true;
      yeniler.push({
        id,
        tur: "davet",
        baslik: d.oda.ad,
        metin: d.davetEden ? t("bildirimMerkezi.davetEden", { ad: d.davetEden.ad }) : t("sohbetler.davetli"),
        zaman: simdi,
        odaId: d.oda.id,
        avatarMxc: d.oda.avatarMxc,
        harf: d.oda.avatarHarf,
        okundu: false,
      });
    }
    if (!degisti) return;
    this.ogeler = [...yeniler, ...kalan].slice(0, MAKS);
    this.#sakla();
  }

  okunduSay(id: string) {
    let degisti = false;
    this.ogeler = this.ogeler.map((o) => {
      if (o.id !== id || o.okundu) return o;
      degisti = true;
      return { ...o, okundu: true };
    });
    if (degisti) this.#sakla();
  }

  tumunuOkunduSay() {
    if (this.okunmamis === 0) return;
    this.ogeler = this.ogeler.map((o) => (o.okundu ? o : { ...o, okundu: true }));
    this.#sakla();
  }

  temizle() {
    this.ogeler = [];
    this.acik = false;
    this.tetik = null;
    try {
      localStorage.removeItem(ANAHTAR);
    } catch {
      /* ignore · yoksay */
    }
  }

  ac(kaynak?: HTMLElement | null) {
    if (kaynak !== undefined) this.tetik = kaynak;
    this.acik = true;
  }

  kapat() {
    this.acik = false;
  }

  degistir(kaynak?: HTMLElement | null) {
    if (this.acik) this.kapat();
    else this.ac(kaynak);
  }
}

export const bildirimMerkezi = new BildirimMerkezi();
