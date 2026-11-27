// Handles incoming Matrix links (matrix.to and MSC2312 matrix: URIs) from OS intents, D-Bus Open, in-app pills/links and the command palette.
// Queues links while signed out or waiting for initial sync, opens joined rooms/spaces directly (jumping to an event when given),
// previews unjoined rooms in OdaOnizlemeSayfasi, and opens user cards (or a DM when action=chat).
// İşletim sistemi niyetlerinden, D-Bus Open'dan, uygulama içi haplardan/bağlantılardan ve komut paletinden gelen Matrix bağlantılarını
// (matrix.to ve MSC2312 matrix:) işler. Oturum yokken ya da ilk eşitleme bitmemişken bekletir, katılınmış oda/alanları doğrudan açar
// (olay varsa oraya atlar), katılınmamış odaları OdaOnizlemeSayfasi ile önizler ve kullanıcı kartını (action=chat ise DM'i) açar.
import { alanaKatil, baglantiOnizle, bekleyenBaglantilariAl, dmAc } from "../api/komutlar";
import { matrisBaglantiGeldi } from "../api/olaylar";
import type { BulunanOda } from "../api/tipler";
import { atlama } from "../arama-mesaj/durum.svelte";
import { bekleyenAndroidBaglanti } from "../disAc";
import { t } from "../i18n";
import { matrisBaglantiCoz } from "../matrisBaglanti";
import { hataBildir } from "../mesaj/eylemler";
import { alanlar } from "./alanlar.svelte";
import { bildirim } from "./bildirim.svelte";
import { gezinme } from "./gezinme.svelte";
import { istekAc } from "./istekler.svelte";
import { kullaniciKartiAc } from "./kullaniciKarti.svelte";
import { odalar } from "./odalar.svelte";
import { oturum } from "./oturum.svelte";

export interface OnizlemeDurumu {
  kimlik: string;
  via: string[];
  olay?: string;
  oda: BulunanOda | null;
  yukleniyor: boolean;
  /** Preview refused by the server: show only id + Join · Sunucu önizleme vermedi: yalnızca kimlik + Katıl */
  hata: boolean;
  katiliyor: boolean;
}

function viaHazirla(kimlik: string, via: string[]): string[] {
  if (via.length > 0) return via;
  if (kimlik.startsWith("!") && kimlik.includes(":")) {
    const s = kimlik.slice(kimlik.indexOf(":") + 1);
    return s ? [s] : [];
  }
  return [];
}

function odaVeyaAlanAc(id: string, ad: string, alan: boolean, olay?: string) {
  if (alan) {
    gezinme.sekmeSec("alanlar");
    alanlar.ac(id, ad);
  } else if (olay) {
    atlama.git(id, olay);
  } else {
    gezinme.odaAc(id);
  }
}

class MatrisBaglantiDurumu {
  /** Link queued until login + initial room list / sync are ready · Giriş + ilk oda listesi / eşitleme hazır olana dek bekleyen bağlantı */
  bekleyen = $state<string | null>(null);
  /** Global preview sheet state (mounted once in App.svelte) · Global önizleme alt sayfası durumu (App.svelte'te bir kez çizilir) */
  onizleme = $state<OnizlemeDurumu | null>(null);
  #istekNo = 0;

  get hazir(): boolean {
    return !!oturum.ben && (odalar.esitleme.durum === "calisiyor" || (odalar.ilkListeGeldi && !odalar.onbellekten));
  }

  kapat() {
    this.#istekNo++;
    this.onizleme = null;
  }

  /** Consumes any link that waited for login / sync. · Giriş / eşitleme için bekleyen bağlantıyı çalıştırır. */
  bekleyeniIsle() {
    const url = this.bekleyen;
    if (!url || !this.hazir) return;
    this.bekleyen = null;
    void baglantiAc(url);
  }

  async onizle(kimlik: string, via: string[], olay?: string) {
    const sunucular = viaHazirla(kimlik, via);
    const bu = ++this.#istekNo;
    this.onizleme = { kimlik, via: sunucular, olay, oda: null, yukleniyor: true, hata: false, katiliyor: false };
    try {
      const oda = await baglantiOnizle(kimlik, sunucular);
      if (bu !== this.#istekNo || !this.onizleme) return;
      if (oda.uye) {
        this.onizleme = null;
        odaVeyaAlanAc(oda.odaId, oda.ad ?? oda.adres ?? oda.odaId, oda.alan, olay);
        return;
      }
      this.onizleme = { ...this.onizleme, oda, yukleniyor: false, hata: false };
    } catch {
      if (bu !== this.#istekNo || !this.onizleme) return;
      // Preview unavailable (server forbids summary): keep sheet open with id + Join · Önizleme alınamadı: yalnızca kimlik + Katıl göster
      this.onizleme = { ...this.onizleme, oda: null, yukleniyor: false, hata: true };
    }
  }

  async katil() {
    const p = this.onizleme;
    if (!p || p.yukleniyor || p.katiliyor) return;
    const hedefKimlik = p.oda?.adres ?? (p.kimlik.startsWith("#") ? p.kimlik : (p.oda?.odaId ?? p.kimlik));
    const ad = p.oda?.ad ?? p.oda?.adres ?? p.kimlik;
    if (p.oda?.uye) {
      this.onizleme = null;
      odaVeyaAlanAc(p.oda.odaId, ad, p.oda.alan, p.olay);
      return;
    }
    if (p.oda?.katilim === "kapi") {
      this.onizleme = null;
      istekAc({ kimlik: hedefKimlik, ad, via: p.via });
      return;
    }
    this.onizleme = { ...p, katiliyor: true };
    try {
      const id = await alanaKatil(hedefKimlik, p.via);
      this.onizleme = null;
      odaVeyaAlanAc(id, ad, p.oda?.alan ?? false, p.olay);
    } catch (err) {
      if (p.hata && (err as { tur?: string }).tur === "giris") {
        // Preview failed and direct join is forbidden: offer a join request · Önizleme alınamamıştı ve doğrudan giriş kapalı: katılma isteği öner
        this.onizleme = null;
        istekAc({ kimlik: hedefKimlik, ad, via: p.via });
        return;
      }
      hataBildir(err);
      if (this.onizleme?.kimlik === p.kimlik) this.onizleme = { ...this.onizleme, katiliyor: false };
    }
  }
}

export const matrisBaglanti = new MatrisBaglantiDurumu();

/** Opens a `matrix.to` or `matrix:` link inside rubychat. · `matrix.to` ya da `matrix:` bağlantısını rubychat içinde açar. */
export async function baglantiAc(url: string): Promise<void> {
  const hedef = matrisBaglantiCoz(url);
  if (!hedef) {
    bildirim.goster(t("matrisBaglanti.acilamadi"), 4000, { tur: "hata" });
    return;
  }
  if (!matrisBaglanti.hazir) {
    matrisBaglanti.bekleyen = url;
    return;
  }
  if (hedef.tur === "kullanici") {
    if (hedef.sohbet) {
      try {
        const odaId = await dmAc(hedef.kimlik);
        gezinme.odaAc(odaId);
      } catch (err) {
        hataBildir(err);
      }
      return;
    }
    kullaniciKartiAc(hedef.kimlik);
    return;
  }
  // Already joined (match by room id or canonical alias) → open directly · Zaten katılmışım (oda kimliği ya da takma adla eşle) → doğrudan aç
  const mevcut = odalar.liste.find(
    (o) => !o.davet && (o.id === hedef.kimlik || (o.takmaAd && o.takmaAd === hedef.kimlik)),
  );
  if (mevcut) {
    odaVeyaAlanAc(mevcut.id, mevcut.ad, mevcut.alan, hedef.olay);
    return;
  }
  await matrisBaglanti.onizle(hedef.kimlik, hedef.via, hedef.olay);
}

/**
 * Starts listening for OS-delivered Matrix links (Android CustomEvent + Tauri desktop D-Bus event) and drains any cold-start link.
 * İşletim sisteminden gelen Matrix bağlantılarını dinlemeye başlar (Android CustomEvent + masaüstü Tauri olayı) ve soğuk açılış bağlantısını tüketir.
 */
export function matrisBaglantiBaslat(): () => void {
  const pencereOlayi = (e: Event) => {
    const url = (e as CustomEvent<string>).detail;
    if (typeof url === "string" && url.trim()) void baglantiAc(url);
  };
  window.addEventListener("rubychat-baglanti", pencereOlayi);

  let kapandi = false;
  let tauriBirak: (() => void) | null = null;
  if ("__TAURI_INTERNALS__" in window) {
    void matrisBaglantiGeldi((url) => {
      if (url.trim()) void baglantiAc(url);
    })
      .then((f) => {
        if (kapandi) f();
        else tauriBirak = f;
      })
      .catch(() => {});
    // Cold-start desktop argv / early D-Bus links · Soğuk açılış masaüstü argv / erken D-Bus bağlantıları
    void bekleyenBaglantilariAl()
      .then((liste) => {
        const son = liste.at(-1);
        if (son) void baglantiAc(son);
      })
      .catch(() => {});
  }

  // Cold-start Android intent link (also marks MainActivity ready for future onNewIntent events)
  // Soğuk açılış Android niyet bağlantısı (MainActivity'yi sonraki onNewIntent olaylarına hazır işaretler)
  const androidBekleyen = bekleyenAndroidBaglanti();
  if (androidBekleyen) void baglantiAc(androidBekleyen);

  return () => {
    kapandi = true;
    window.removeEventListener("rubychat-baglanti", pencereOlayi);
    tauriBirak?.();
  };
}
