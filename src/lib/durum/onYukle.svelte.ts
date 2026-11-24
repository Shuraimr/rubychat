// Decides which rooms are kept warm. Score = how often and how recently the user visits (halves every 5 days) + unread / mention / pinned.
// Saves data and battery: on mobile data only the best few, with low battery or data saver nothing, hidden app nothing.
// Hangi odaların sıcak tutulacağına karar verir. Puan = ne sıklıkla ve ne kadar yakında ziyaret edildiği (5 günde yarılanır) + okunmamış /
// bahsedilme / sabit. Veri ve pil korunur: mobil veride yalnızca en iyiler; düşük pil ya da veri tasarrufunda, gizli uygulamada hiçbiri.
import { odalariHazirla } from "../api/komutlar";
import type { OdaOzeti } from "../api/tipler";

const DEPO = "rubychat.ziyaret";
const DEPO_OLCUM = "rubychat.acilisMs";
const YARILANMA = 5 * 24 * 3600e3;
/** Order: first these, the rest (visible rooms) only on Wi-Fi and when idle · Sıra: önce bunlar, kalanı (görünen odalar) yalnızca Wi-Fi'de ve boştayken */
const ONCELIKLI = 5;
const MOBIL = 3;
const HEPSI = 8;

type Ziyaret = Record<string, { p: number; t: number }>;
function oku<T>(anahtar: string, yedek: T): T {
  try {
    return (JSON.parse(localStorage.getItem(anahtar) ?? "null") as T) ?? yedek;
  } catch {
    return yedek;
  }
}
function yaz(anahtar: string, deger: unknown) {
  try {
    localStorage.setItem(anahtar, JSON.stringify(deger));
  } catch {
    /* not persisted · saklanamadı */
  }
}

interface Baglanti { type?: string; saveData?: boolean; effectiveType?: string }
interface Pil { charging: boolean; level: number }
const baglanti = () => (navigator as unknown as { connection?: Baglanti }).connection;

class OnYukle {
  #ziyaret: Ziyaret = oku<Ziyaret>(DEPO, {});
  #liste: OdaOzeti[] = [];
  #acik: string | null = null;
  #cevrimici = false;
  #son = "";
  #z: ReturnType<typeof setTimeout> | undefined;
  #bosta: ReturnType<typeof setTimeout> | undefined;
  #pil: Pil | null = null;

  baslat(): () => void {
    void (navigator as unknown as { getBattery?: () => Promise<Pil> }).getBattery?.().then((p) => (this.#pil = p)).catch(() => {});
    const gorunur = () => (document.hidden ? this.duraklat() : this.#planla(1500));
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      document.removeEventListener("visibilitychange", gorunur);
      clearTimeout(this.#z);
      clearTimeout(this.#bosta);
      this.#cevrimici = false;
      this.#liste = [];
      this.#son = "";
    };
  }

  /** The room list or the connection changed · Oda listesi ya da bağlantı değişti */
  guncelle(liste: OdaOzeti[], cevrimici: boolean) {
    this.#liste = liste;
    this.#cevrimici = cevrimici;
    this.#planla(1500);
  }

  /** The user opened a room: count the visit and stay out of its way · Kullanıcı oda açtı: ziyareti say, yolundan çekil */
  odaAcildi(id: string) {
    const simdi = Date.now();
    this.#ziyaret[id] = { p: this.#puan(id, simdi) + 1, t: simdi };
    const sirali = Object.entries(this.#ziyaret).sort((a, b) => b[1].t - a[1].t);
    this.#ziyaret = Object.fromEntries(sirali.slice(0, 100));
    yaz(DEPO, this.#ziyaret);
    this.#acik = id;
    this.duraklat();
    this.#planla(3000);
  }
  odaKapandi(id: string) {
    if (this.#acik === id) this.#acik = null;
  }

  /** Nothing new starts; what is running (at most two rooms) finishes · Yenisi başlamaz; süren (en çok iki oda) biter */
  duraklat() {
    clearTimeout(this.#z);
    clearTimeout(this.#bosta);
    this.#bosta = undefined;
    if (this.#son) void odalariHazirla([]).catch(() => {});
    this.#son = "";
  }
  sil() {
    this.#ziyaret = {};
    this.#acik = null;
    try {
      localStorage.removeItem(DEPO);
    } catch {
      /* ignore · yoksay */
    }
  }

  #puan(id: string, simdi: number): number {
    const z = this.#ziyaret[id];
    return z ? z.p * 2 ** (-(simdi - z.t) / YARILANMA) : 0;
  }
  #planla(ms: number) {
    clearTimeout(this.#z);
    this.#z = setTimeout(() => this.#calistir(), ms);
  }
  #calistir() {
    const b = baglanti();
    if (document.hidden || !this.#cevrimici || b?.saveData || /2g/.test(b?.effectiveType ?? "")) return;
    if (this.#pil && !this.#pil.charging && this.#pil.level < 0.15) return;
    const mobil = b?.type === "cellular";
    const simdi = Date.now();
    const adaylar = this.#liste.filter((o) => !o.davet && !o.alan && o.id !== this.#acik);
    const puanli = adaylar
      .map((o) => {
        const gecen = o.sonZaman ? (simdi - o.sonZaman) / 3600e3 : 1e6;
        // Unread counts more while it is fresh; a room nobody visits does not win by noise alone. · Okunmamış tazeyken daha çok sayılır; kimsenin girmediği oda yalnızca gürültüyle öne geçmez.
        const taze = gecen < 24 ? 1 : 0.4;
        const okunmamis = o.bahsedilme > 0 ? 4 : o.okunmamis > 0 ? (o.dm ? 3 : 1.2) * taze : 0;
        return { id: o.id, p: Math.min(8, this.#puan(o.id, simdi)) + okunmamis + (o.sabit ? 1.5 : 0) };
      })
      .sort((x, y) => y.p - x.p);
    const iyi = puanli.filter((x) => x.p > 0.5).slice(0, mobil ? MOBIL : ONCELIKLI).map((x) => x.id);
    const iyiImza = iyi.join("|");
    // The wider list already starts with these: nothing new to ask. · Geniş liste zaten bunlarla başlıyor: istenecek yeni şey yok.
    if (iyi.length > 0 && (this.#son === iyiImza || this.#son.startsWith(`${iyiImza}|`))) return;
    this.#gonder(iyi);
    // Wi-Fi and idle for a while: the rooms on screen too. · Wi-Fi ve bir süre boşta: ekrandaki odalar da.
    clearTimeout(this.#bosta);
    if (!mobil) {
      const geri = adaylar.map((o) => o.id).filter((id) => !iyi.includes(id));
      this.#bosta = setTimeout(() => {
        this.#bosta = undefined;
        this.#gonder([...iyi, ...geri].slice(0, HEPSI));
      }, 8000);
    }
  }
  #gonder(idler: string[]) {
    const imza = idler.join("|");
    if (!imza || imza === this.#son || document.hidden) return;
    this.#son = imza;
    void odalariHazirla(idler).catch(() => {});
  }
}
export const onYukle = new OnYukle();

// ---- How long does opening take? (Hakkında shows the averages) · Açılış ne kadar sürüyor? (Hakkında ortalamaları gösterir) ----
interface Olcum { hazir: number[]; soguk: number[] }
/** Starts the clock; the returned function stops it at the first real list · Saati başlatır; dönen işlev ilk gerçek listede durdurur */
export function acilisOlc(hazirdi: boolean): () => void {
  const bas = performance.now();
  let bitti = false;
  return () => {
    if (bitti) return;
    bitti = true;
    const o = oku<Olcum>(DEPO_OLCUM, { hazir: [], soguk: [] });
    const dizi = hazirdi ? o.hazir : o.soguk;
    dizi.push(Math.round(performance.now() - bas));
    if (dizi.length > 20) dizi.shift();
    yaz(DEPO_OLCUM, o);
  };
}
export function acilisOrtalamasi(): { hazir: number | null; soguk: number | null } {
  const o = oku<Olcum>(DEPO_OLCUM, { hazir: [], soguk: [] });
  // Median: one slow opening must not hide the rest. · Ortanca: tek yavaş açılış gerisini gizlemesin.
  const orta = (d: number[]) => (d.length ? [...d].sort((a, b) => a - b)[d.length >> 1] : null);
  return { hazir: orta(o.hazir), soguk: orta(o.soguk) };
}
