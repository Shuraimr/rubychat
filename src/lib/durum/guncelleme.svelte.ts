// In-app update store: checks GitHub Releases, handles Android unknown-sources permission and return resume,
// streams download progress, verifies SHA-256 (in Rust) and triggers Android install or desktop Flatpak instructions.
// Uygulama içi güncelleme deposu: GitHub Releases'ı denetler, Android bilinmeyen kaynak izni ve dönüşünü yönetir,
// indirme ilerlemesini izler, SHA-256 doğrulamasını (Rust'ta) bekler ve Android kurulumu ya da masaüstü Flatpak yönergesini açar.
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  guncellemeDenetle,
  guncellemeIndir,
  guncellemeIptal,
  guncellemeIzinAc,
  guncellemeIzinVar,
  guncellemeKur,
  uygulamaSurumu,
} from "../api/komutlar";
import { guncellemeIlerlemesiniDinle } from "../api/olaylar";
import type { GuncellemeBilgisi, GuncellemeIlerleme, Hata, Varlik } from "../api/tipler";
import { androidMi } from "../arama-ec/ses";
import { t } from "../i18n";
import { bildirimMerkezi } from "./bildirimMerkezi.svelte";
import { tercihler } from "./tercihler.svelte";
import { ustBildirim } from "./ustBildirim.svelte";

export type GuncellemeDurumu = "bos" | "denetleniyor" | "guncel" | "var" | "izin" | "indiriliyor" | "dogrulaniyor" | "hazir" | "hata";

const SON_DENETIM_ANAHTARI = "rubychat.sonGuncellemeDenetimi";
const ILK_GECIKME_MS = 8_000;
const ARALIK_MS = 12 * 60 * 60 * 1000;

function sonDenetimOku(): number | null {
  try {
    const v = Number(localStorage.getItem(SON_DENETIM_ANAHTARI));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function sonDenetimYaz(ms: number) {
  try {
    localStorage.setItem(SON_DENETIM_ANAHTARI, String(ms));
  } catch {
    /* ignore · yoksay */
  }
}

function androidPlatform(): boolean {
  return androidMi() || /android/i.test(navigator.userAgent);
}

function ilkNotSatiri(notlar: string): string {
  for (const s of notlar.split(/\r?\n/)) {
    const temiz = s.replace(/^[#*\-•>\s]+/, "").trim();
    if (temiz && !/^sha-?256/i.test(temiz) && !/^(apk|flatpak):/i.test(temiz)) return temiz;
  }
  return "";
}

function hataMetni(e: unknown): string {
  const h = e as Partial<Hata> | undefined;
  if (h && typeof h.mesaj === "string" && h.mesaj.trim()) return h.mesaj;
  return t("hata.diger");
}

class Guncelleme {
  durum = $state<GuncellemeDurumu>("bos");
  mevcutSurum = $state("");
  bilgi = $state<GuncellemeBilgisi | null>(null);
  ilerleme = $state<GuncellemeIlerleme>({ indirilen: 0, toplam: 0 });
  hata = $state<string | null>(null);
  sonDenetim = $state<number | null>(sonDenetimOku());
  indirilenYol = $state<string | null>(null);
  sayfaAcik = $state(false);

  #izinBirak: (() => void) | null = null;
  #izinDenetleniyor = false;

  /** True on Android; determines whether APK or Flatpak asset is selected. · Android'de true; APK veya Flatpak varlığı buna göre seçilir. */
  readonly android = androidPlatform();

  /** Beta releases stay forced on as long as the running build itself is a prerelease (contains "-"). · Çalışan sürüm ön sürüm ("-") olduğu sürece beta kapatılamaz. */
  betaZorunlu = $derived(!this.mevcutSurum || this.mevcutSurum.includes("-"));

  /** Downloadable asset for the current platform · Bu platform için indirilebilir sürüm varlığı */
  varlik = $derived<Varlik | null>(this.bilgi?.yeni ? (this.android ? this.bilgi.yeni.apk : this.bilgi.yeni.flatpak) : null);

  async surumYukle() {
    if (this.mevcutSurum) return;
    try {
      this.mevcutSurum = await uygulamaSurumu();
    } catch {
      /* plain browser dev mode · sade tarayıcı geliştirme kipi */
    }
  }

  /** Checks GitHub Releases. `elle = true` reports errors; automatic checks fail silently. · GitHub Releases'ı denetler. `elle = true` hataları gösterir; otomatik denetim sessiz kalır. */
  async denetle(elle = false) {
    if (this.durum === "denetleniyor" || this.durum === "indiriliyor" || this.durum === "dogrulaniyor") return;
    const oncekiDurum = this.durum;
    this.durum = "denetleniyor";
    this.hata = null;
    try {
      if (!this.mevcutSurum) await this.surumYukle();
      // Beta stays true while running a prerelease (and always true per product policy until stable). · Ön sürümde beta her zaman true gönderilir.
      const b = await guncellemeDenetle(true);
      this.bilgi = b;
      this.mevcutSurum = b.mevcut;
      const simdi = Date.now();
      this.sonDenetim = simdi;
      sonDenetimYaz(simdi);

      if (b.yeni) {
        this.durum = "var";
        const atlandi = tercihler.d.guncellemeAtlanan === b.yeni.surum;
        if (elle || !atlandi) {
          const ozet = ilkNotSatiri(b.yeni.notlar) || t("guncelleme.bildirimMetin", { mevcut: b.mevcut, yeni: b.yeni.surum });
          bildirimMerkezi.ekle({
            id: `guncelleme:${b.yeni.surum}`,
            tur: "guncelleme",
            baslik: t("guncelleme.yeniVar", { surum: b.yeni.surum }),
            metin: ozet,
            baglam: t("bildirimMerkezi.guncellemeBaglam"),
            surum: b.yeni.surum,
          });
          if (!this.sayfaAcik) ustBildirim.guncellemeGoster(b.yeni.surum);
        }
      } else {
        this.durum = "guncel";
      }
    } catch (e) {
      if (elle) {
        this.durum = "hata";
        this.hata = hataMetni(e);
      } else {
        this.durum = this.bilgi?.yeni ? "var" : oncekiDurum;
      }
    }
  }

  /** Starts automatic checks (8 s after login, then every 12 h) and returns a stop function. · Otomatik denetimi başlatır (girişten 8 sn sonra, sonra 12 saatte bir) ve durdurma işlevi döndürür. */
  otomatikBaslat(): () => void {
    void this.surumYukle();
    const ilk = setTimeout(() => {
      if (tercihler.d.guncellemeOtomatik) void this.denetle(false);
    }, ILK_GECIKME_MS);
    const dongu = setInterval(() => {
      if (tercihler.d.guncellemeOtomatik) void this.denetle(false);
    }, ARALIK_MS);
    return () => {
      clearTimeout(ilk);
      clearInterval(dongu);
      this.#izinIzlemeyiDurdur();
    };
  }

  sayfaAc() {
    this.sayfaAcik = true;
    void this.surumYukle();
  }

  sayfaKapat() {
    this.sayfaAcik = false;
    if (this.durum === "izin") {
      this.#izinIzlemeyiDurdur();
      this.durum = this.bilgi?.yeni ? "var" : "bos";
    }
  }

  /** Starts update installation: checks unknown-sources permission on Android first, then downloads and verifies. · Güncellemeyi başlatır: Android'de önce yükleme iznine bakar, sonra indirir ve doğrular. */
  async baslat() {
    if (this.durum === "indiriliyor" || this.durum === "dogrulaniyor") return;
    const v = this.varlik;
    if (!this.bilgi?.yeni || !v) {
      this.durum = "hata";
      this.hata = t("guncelleme.varlikYok");
      return;
    }
    this.hata = null;
    if (this.android) {
      try {
        const izin = await guncellemeIzinVar();
        if (!izin) {
          this.durum = "izin";
          this.#izinIzle(v);
          return;
        }
      } catch (e) {
        this.durum = "hata";
        this.hata = hataMetni(e);
        return;
      }
    }
    await this.#indir(v);
  }

  async izinAc() {
    const v = this.varlik;
    if (v) this.#izinIzle(v);
    try {
      await guncellemeIzinAc();
    } catch (e) {
      this.#izinIzlemeyiDurdur();
      this.durum = "hata";
      this.hata = hataMetni(e);
    }
  }

  /** Watches app resume after opening Android settings so the download begins automatically once permission is granted. · Android ayarlarından dönüşü izler; izin verildiyse indirme kendiliğinden başlar. */
  #izinIzle(v: Varlik) {
    this.#izinIzlemeyiDurdur();
    const denetle = async () => {
      if (this.durum !== "izin" || document.hidden || this.#izinDenetleniyor) return;
      this.#izinDenetleniyor = true;
      try {
        const izin = await guncellemeIzinVar();
        if (izin && this.durum === "izin") {
          this.#izinIzlemeyiDurdur();
          await this.#indir(v);
        }
      } catch {
        /* stay on permission step · izin adımında kal */
      } finally {
        this.#izinDenetleniyor = false;
      }
    };
    const vis = () => {
      if (!document.hidden) void denetle();
    };
    const odak = () => void denetle();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", odak);
    this.#izinBirak = () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("focus", odak);
    };
  }

  #izinIzlemeyiDurdur() {
    this.#izinBirak?.();
    this.#izinBirak = null;
  }

  async #indir(v: Varlik) {
    this.#izinIzlemeyiDurdur();
    this.durum = "indiriliyor";
    this.hata = null;
    this.indirilenYol = null;
    this.ilerleme = { indirilen: 0, toplam: v.boyut };

    let dinlemeBirak: UnlistenFn | null = null;
    try {
      dinlemeBirak = await guncellemeIlerlemesiniDinle((o) => {
        const toplam = o.toplam > 0 ? o.toplam : v.boyut;
        this.ilerleme = { indirilen: o.indirilen, toplam };
        if (toplam > 0 && o.indirilen >= toplam && this.durum === "indiriliyor") {
          this.durum = "dogrulaniyor";
        }
      });

      const yol = await guncellemeIndir(v.url, v.ad, v.sha256);
      this.indirilenYol = yol;
      this.durum = "hazir";

      if (this.android) {
        await guncellemeKur(yol);
      }
    } catch (e) {
      const h = e as Partial<Hata> | undefined;
      if (h?.mesaj === "iptal") {
        this.durum = this.bilgi?.yeni ? "var" : "bos";
        this.hata = null;
      } else {
        this.durum = "hata";
        this.hata = hataMetni(e);
      }
    } finally {
      dinlemeBirak?.();
    }
  }

  async kurTekrar() {
    if (!this.android || !this.indirilenYol) return;
    try {
      await guncellemeKur(this.indirilenYol);
    } catch (e) {
      this.durum = "hata";
      this.hata = hataMetni(e);
    }
  }

  iptal() {
    this.#izinIzlemeyiDurdur();
    if (this.durum === "indiriliyor" || this.durum === "dogrulaniyor") {
      void guncellemeIptal().catch(() => {});
      return;
    }
    this.durum = this.bilgi?.yeni ? "var" : "bos";
    this.hata = null;
  }

  surumuAtla() {
    if (this.bilgi?.yeni) {
      tercihler.yaz("guncellemeAtlanan", this.bilgi.yeni.surum);
    }
    this.sayfaAcik = false;
  }

  atlananGeriAl() {
    tercihler.yaz("guncellemeAtlanan", null);
  }
}

export const guncelleme = new Guncelleme();
