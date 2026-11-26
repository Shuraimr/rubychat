// Setup diagnostics report store and onboarding tour replay toggle.
// Runs `kurulum_raporu`, triggers platform fix actions (`kurulum_duzelt`) with delayed + resume refresh,
// and publishes a summary item to the notification center.
// Kurulum tanı raporu deposu ve tanıtım turu yeniden oynatma durumu.
// `kurulum_raporu`nu çalıştırır, platform düzeltme eylemlerini (`kurulum_duzelt`) gecikmeli + dönüş yenilemesiyle yürütür
// ve bildirim merkezine özet bir öğe ekler.
import { kurulumDuzelt, kurulumRaporu, uygulamaSurumu } from "../api/komutlar";
import type { RaporSatiri } from "../api/tipler";
import { t } from "../i18n";
import { bildirim } from "./bildirim.svelte";
import { bildirimMerkezi } from "./bildirimMerkezi.svelte";

export interface RaporMetni {
  baslik: string;
  aciklama: string;
  eylemEtiket: string;
}

const GRUP_SIRASI: readonly RaporSatiri["grup"][] = ["sistem", "izinler", "baglanti"];

/** Translates a backend diagnostic row (`kimlik`) into localized title, description and action label. */
/** Arka uç tanı satırını (`kimlik`) yerelleştirilmiş başlık, açıklama ve eylem etiketine çevirir. */
export function raporSatirMetni(s: RaporSatiri): RaporMetni {
  const deger = s.deger?.trim() ?? "";
  let baslik = s.kimlik;
  let aciklama = deger;

  switch (s.kimlik) {
    case "calisma_ortami":
      baslik = t("kurulumRaporu.calisma_ortami");
      aciklama = deger;
      break;
    case "bildirim_portali":
      baslik = t("kurulumRaporu.bildirim_portali");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.bildirim_portaliUyari") : deger;
      break;
    case "arka_plan_portali":
      baslik = t("kurulumRaporu.arka_plan_portali");
      aciklama = deger ? `${deger} · ${t("kurulumRaporu.arka_plan_portaliAlt")}` : t("kurulumRaporu.arka_plan_portaliAlt");
      break;
    case "ekran_paylasimi_portali":
      baslik = t("kurulumRaporu.ekran_paylasimi_portali");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.ekran_paylasimi_portaliUyari") : deger;
      break;
    case "kamera_portali":
      baslik = t("kurulumRaporu.kamera_portali");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.kamera_portaliUyari") : deger;
      break;
    case "tepsi":
      if (s.durum === "tamam") {
        baslik = t("kurulumRaporu.tepsiTamam");
        aciklama = "";
      } else {
        baslik = t("kurulumRaporu.tepsiUyari");
        aciklama = t("kurulumRaporu.tepsiUyariAlt");
      }
      break;
    case "anahtar_deposu":
      baslik = t("kurulumRaporu.anahtar_deposu");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.anahtar_deposuEksik") : "";
      break;
    case "pipewire":
      baslik = t("kurulumRaporu.pipewire");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.pipewireUyari") : "";
      break;
    case "android":
      baslik = deger ? (deger.toLowerCase().startsWith("android") ? deger : `${t("kurulumRaporu.android")} ${deger}`) : t("kurulumRaporu.android");
      aciklama = t("kurulumRaporu.androidAlt");
      break;
    case "webview":
      baslik = deger ? `${t("kurulumRaporu.webview")} ${deger}` : t("kurulumRaporu.webview");
      aciklama = t("kurulumRaporu.webviewAlt");
      break;
    case "bildirim_izni":
      baslik = t("kurulumRaporu.bildirim_izni");
      aciklama = s.durum !== "tamam" ? t("kurulumRaporu.bildirim_izniEksik") : "";
      break;
    case "mikrofon":
      baslik = t("kurulumRaporu.mikrofon");
      aciklama = t("kurulumRaporu.mikrofonAlt");
      break;
    case "kamera":
      baslik = t("kurulumRaporu.kamera");
      aciklama = "";
      break;
    case "pil":
      if (s.durum === "tamam") {
        baslik = t("kurulumRaporu.pilTamam");
        aciklama = t("kurulumRaporu.pilTamamAlt");
      } else {
        baslik = t("kurulumRaporu.pilUyari");
        aciklama = t("kurulumRaporu.pilUyariAlt");
      }
      break;
    case "yukleme_izni":
      baslik = t("kurulumRaporu.yukleme_izni");
      aciklama = t("kurulumRaporu.yukleme_izniAlt");
      break;
    case "sunucu":
      baslik = t("kurulumRaporu.sunucu", { deger: deger || "—" });
      aciklama = "";
      break;
  }

  let eylemEtiket = "";
  if (s.eylem) {
    switch (s.eylem) {
      case "tepsi_yardim":
        eylemEtiket = t("kurulumRaporu.eylemNasil");
        break;
      case "bildirim_izni":
      case "mikrofon":
      case "kamera":
      case "yukleme_izni":
        eylemEtiket = t("kurulumRaporu.eylemIzinVer");
        break;
      case "pil_muaf":
        eylemEtiket = t("kurulumRaporu.eylemMuafTut");
        break;
      default:
        eylemEtiket = t("kurulumRaporu.eylemDuzelt");
        break;
    }
  }

  return { baslik, aciklama, eylemEtiket };
}

function uyariMetni(n: number): string {
  return n === 1 ? t("kurulumRaporu.uyariTek") : t("kurulumRaporu.uyariCok", { n });
}

function eksikMetni(n: number): string {
  return n === 1 ? t("kurulumRaporu.eksikTek") : t("kurulumRaporu.eksikCok", { n });
}

/** One-line header summary, e.g. "9 denetim · 1 uyarı · 1 eksik". · Tek satırlık başlık özeti, ör. "9 denetim · 1 uyarı · 1 eksik". */
export function raporOzetiMetni(satirlar: readonly RaporSatiri[]): string {
  if (satirlar.length === 0) return "";
  const uyari = satirlar.filter((s) => s.durum === "uyari").length;
  const eksik = satirlar.filter((s) => s.durum === "eksik").length;
  const parcalar = [t("kurulumRaporu.denetimSayi", { n: satirlar.length })];
  if (uyari > 0) parcalar.push(uyariMetni(uyari));
  if (eksik > 0) parcalar.push(eksikMetni(eksik));
  if (uyari === 0 && eksik === 0) parcalar.push(t("kurulumRaporu.herSeyHazir"));
  return parcalar.join(" · ");
}

/** Plain-text diagnostic report for clipboard copying on desktop. · Masaüstünde panoya kopyalamak için düz metin kurulum raporu. */
export function raporDuzMetin(satirlar: readonly RaporSatiri[], surum = ""): string {
  const baslik = surum ? `rubychat ${surum} — ${t("kurulumRaporu.baslik")}` : `rubychat — ${t("kurulumRaporu.baslik")}`;
  const cikti = [baslik, raporOzetiMetni(satirlar)];
  const isaret = { tamam: "✓", uyari: "⚠", eksik: "✕" } as const;
  for (const grup of GRUP_SIRASI) {
    const g = satirlar.filter((s) => s.grup === grup);
    if (g.length === 0) continue;
    cikti.push("", t(`kurulumRaporu.grup.${grup}`));
    for (const s of g) {
      const m = raporSatirMetni(s);
      const ayrinti = m.aciklama ? ` — ${m.aciklama}` : "";
      cikti.push(`  [${isaret[s.durum]}] ${m.baslik}${ayrinti}`);
    }
  }
  return cikti.join("\n");
}

class KurulumDurumu {
  acik = $state(false);
  /** Replay mode for the onboarding tour (opened from Ben › About rubychat). · Tanıtım turunun yeniden oynatma kipi (Ben › rubychat hakkında'dan açılır). */
  turAcik = $state(false);
  satirlar = $state<RaporSatiri[]>([]);
  yukleniyor = $state(false);
  hata = $state<string | null>(null);
  duzeltilen = $state<string | null>(null);
  surum = $state("");

  #istekNo = 0;
  #zamanlayici: ReturnType<typeof setTimeout> | null = null;
  #odakBirak: (() => void) | null = null;

  async #surumYukle() {
    if (this.surum) return;
    try {
      this.surum = await uygulamaSurumu();
    } catch {
      /* plain browser dev mode · sade tarayıcı geliştirme kipi */
    }
  }

  /** Runs `kurulum_raporu` and mirrors the result into the notification center. · `kurulum_raporu`nu çalıştırır ve sonucu bildirim merkezine işler. */
  async calistir() {
    const bu = ++this.#istekNo;
    this.yukleniyor = true;
    this.hata = null;
    void this.#surumYukle();
    try {
      const sonuc = await kurulumRaporu();
      if (bu !== this.#istekNo) return;
      this.satirlar = sonuc;
      this.#bildirimiGuncelle(sonuc);
    } catch (e) {
      if (bu !== this.#istekNo) return;
      console.error(e);
      this.hata = t("kurulumRaporu.hata");
    } finally {
      if (bu === this.#istekNo) this.yukleniyor = false;
    }
  }

  /** Triggers a platform fix action, then refreshes after ~1s and when the window regains focus/visibility. */
  /** Platform düzeltme eylemini çalıştırır; ~1 sn sonra ve pencere yeniden odaklanınca/görünür olunca raporu yeniler. */
  async duzelt(eylem: string) {
    if (this.duzeltilen) return;
    this.duzeltilen = eylem;
    try {
      await kurulumDuzelt(eylem);
      this.#yenilemePlanla();
    } catch (e) {
      console.error(e);
      bildirim.goster(t("hata.diger"), 3500, { tur: "hata" });
    } finally {
      this.duzeltilen = null;
    }
  }

  #yenilemePlanla() {
    this.#yenilemeyiDurdur();
    this.#zamanlayici = setTimeout(() => {
      this.#zamanlayici = null;
      if (this.acik) void this.calistir();
    }, 1000);

    // Re-check once the user comes back from system permission settings. · Kullanıcı sistem izin ayarlarından dönünce yeniden denetle.
    const yenile = () => {
      if (!this.acik || document.hidden) return;
      void this.calistir();
    };
    const vis = () => {
      if (!document.hidden) yenile();
    };
    window.addEventListener("focus", yenile);
    document.addEventListener("visibilitychange", vis);
    this.#odakBirak = () => {
      window.removeEventListener("focus", yenile);
      document.removeEventListener("visibilitychange", vis);
    };
  }

  #yenilemeyiDurdur() {
    if (this.#zamanlayici) {
      clearTimeout(this.#zamanlayici);
      this.#zamanlayici = null;
    }
    this.#odakBirak?.();
    this.#odakBirak = null;
  }

  /** Updates the single "kurulum" notification-center entry when the diagnostic summary changes. */
  /** Tanı özeti değiştiğinde bildirim merkezindeki tek "kurulum" öğesini günceller. */
  #bildirimiGuncelle(satirlar: readonly RaporSatiri[]) {
    if (satirlar.length === 0) return;
    const eksikler = satirlar.filter((s) => s.durum === "eksik");
    const uyarilar = satirlar.filter((s) => s.durum === "uyari");
    const ilkSorun = eksikler[0] ?? uyarilar[0] ?? null;

    const imza = `${eksikler.length}:${uyarilar.length}:${ilkSorun?.kimlik ?? "tamam"}`;
    const id = `kurulum:${imza}`;
    if (bildirimMerkezi.ogeler.some((o) => o.id === id)) return;

    let baslik: string;
    let metin: string;
    let uyari: boolean;

    if (ilkSorun) {
      uyari = true;
      const sayilar: string[] = [];
      if (uyarilar.length > 0) sayilar.push(uyariMetni(uyarilar.length));
      if (eksikler.length > 0) sayilar.push(eksikMetni(eksikler.length));
      baslik = sayilar.join(" · ");
      const m = raporSatirMetni(ilkSorun);
      metin = m.aciklama ? `${m.baslik} — ${m.aciklama}` : m.baslik;
    } else {
      uyari = false;
      baslik = t("kurulumRaporu.herSeyHazir");
      metin = t("kurulumRaporu.herSeyHazirAlt", { n: satirlar.length });
    }

    // Replace any previous setup-report item so stale warnings disappear once fixed; `ekle()` persists the list.
    // Düzeltilen eski uyarılar kalmasın diye önceki kurulum öğesini kaldır; `ekle()` listeyi kalıcı yazar.
    bildirimMerkezi.ogeler = bildirimMerkezi.ogeler.filter((o) => o.tur !== "kurulum");
    bildirimMerkezi.ekle({
      id,
      tur: "kurulum",
      baslik,
      metin,
      baglam: t("bildirimMerkezi.kurulumBaglam"),
      uyari,
    });
  }

  ac() {
    this.acik = true;
    void this.calistir();
  }

  kapat() {
    this.acik = false;
    this.#yenilemeyiDurdur();
  }

  turAc() {
    this.turAcik = true;
  }

  turKapat() {
    this.turAcik = false;
  }
}

export const kurulum = new KurulumDurumu();

export function kurulumRaporuAc() {
  kurulum.ac();
}

export function kurulumRaporuKapat() {
  kurulum.kapat();
}
