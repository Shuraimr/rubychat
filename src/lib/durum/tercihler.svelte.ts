// Device preferences that are not "appearance" (those live in ayarlar.svelte.ts): chat, notifications, haptics, link previews, photo quality.
// One JSON blob in localStorage; every key is validated on read so a bad/old value falls back to its default. Only options that are
// really wired somewhere are listed here (see the settings screens).
// Görünüm dışındaki cihaz tercihleri (görünüm ayarlar.svelte.ts'te): sohbet, bildirim, titreşim, bağlantı önizleme, fotoğraf kalitesi.
// localStorage'da tek JSON; her anahtar okunurken doğrulanır, bozuk/eski değer varsayılana düşer. Burada yalnızca gerçekten bir yere
// bağlanmış seçenekler var (ayar ekranlarına bak).
import type { ResimKalitesi } from "../medya/isleme";

/** Side-by-side layout in narrow windows: room strip instead of rail + list · Dar pencerede yan yana düzen: ray + liste yerine oda şeridi */
export type Kompakt = "otomatik" | "acik" | "kapali";
export type OnizlemeKipi = "hepsi" | "yt-gh" | "kapali";

export interface TercihDeger {
  titresim: boolean;
  saat24: boolean;
  enterGonder: boolean;
  baglantiOnizleme: OnizlemeKipi;
  sifreliOnizle: boolean;
  resimKalitesi: ResimKalitesi;
  bildirimAcik: boolean;
  bildirimOnizleme: boolean;
  bildirimTitresim: boolean;
  /** keep the sync alive in the background (Android foreground service) · eşitlemeyi arka planda canlı tut (Android ön plan servisi) */
  arkaPlan: boolean;
  /** desktop: start hidden at login (autostart through the background portal) · masaüstü: oturum açılınca gizli başla (arka plan portalıyla otomatik başlatma) */
  acilistaBaslat: boolean;
  /** KLIPY API key for the GIF tab: stored on this device only, never committed · GIF sekmesi için KLIPY API anahtarı: yalnızca bu cihazda, asla commit'lenmez */
  klipyAnahtar: string;
  kompakt: Kompakt;
  /** Rail and list hidden with Ctrl+B (wide window) · Ray ve liste Ctrl+B ile gizli (geniş pencere) */
  listeGizli: boolean;
  /** Right-side People panel open on desktop/tablet · Masaüstü/tablette sağdaki Kişiler paneli açık */
  kisilerPaneli: boolean;
  /** Modeless Ctrl keyboard shortcuts (lib/klavyeKisayol.svelte.ts) · Kipsiz Ctrl klavye kısayolları */
  ctrlKisayol: boolean;
  /** One-line shortcut hint strip above the composer when a message is selected · Mesaj seçiliyken yazma alanının üstünde tek satırlık kısayol ipucu */
  kisayolIpucuAcik: boolean;
  /** Check GitHub Releases automatically at start and every 12h · Açılışta ve 12 saatte bir GitHub Releases'ı otomatik denetle */
  guncellemeOtomatik: boolean;
  /** Release version the user chose to skip until a newer one comes out · Kullanıcının yenisi çıkana dek atlamayı seçtiği sürüm */
  guncellemeAtlanan: string | null;
  /** First-run onboarding tour completed/skipped (always true when upgrading from an older version) · İlk kurulum tanıtım turu görüldü/geçildi (eski sürümden yükseltmede hep true) */
  turGoruldu: boolean;
  /** Setup report shown once automatically after the tour · Tur bitince kurulum raporu bir kez otomatik gösterildi */
  raporGosterildi: boolean;
  /** Official rubychat space card dismissed in Explore · Keşfet'teki resmi rubychat alanı kartı kapatıldı */
  rubychatKartiKapali: boolean;
}

const VARSAYILAN: TercihDeger = {
  titresim: true, saat24: true, enterGonder: true, baglantiOnizleme: "hepsi", sifreliOnizle: false, resimKalitesi: "standart",
  bildirimAcik: true, bildirimOnizleme: true, bildirimTitresim: true, arkaPlan: true, acilistaBaslat: false,
  klipyAnahtar: "", kompakt: "otomatik", listeGizli: false, kisilerPaneli: false, ctrlKisayol: false, kisayolIpucuAcik: false,
  guncellemeOtomatik: true, guncellemeAtlanan: null,
  turGoruldu: false, raporGosterildi: false, rubychatKartiKapali: false,
};
const ANAHTAR = "rubychat.tercihler";

function oku(): TercihDeger {
  const g = { ...VARSAYILAN };
  try {
    const ham = localStorage.getItem(ANAHTAR);
    const h = JSON.parse(ham ?? "{}") as Record<string, unknown>;
    for (const k of ["titresim", "saat24", "enterGonder", "sifreliOnizle", "bildirimAcik", "bildirimOnizleme", "bildirimTitresim", "arkaPlan", "acilistaBaslat", "listeGizli", "kisilerPaneli", "ctrlKisayol", "kisayolIpucuAcik", "guncellemeOtomatik", "raporGosterildi", "rubychatKartiKapali"] as const) {
      if (typeof h[k] === "boolean") g[k] = h[k] as boolean;
    }
    if (typeof h.turGoruldu === "boolean") {
      g.turGoruldu = h.turGoruldu;
    } else {
      // Upgrading from an earlier version (saved preferences or any existing rubychat.* storage key): skip the first-run tour.
      // Önceki bir sürümden yükseltme (kayıtlı tercih ya da herhangi bir rubychat.* anahtarı varsa): ilk kurulum turunu gösterme.
      let oncekiVar = ham !== null;
      if (!oncekiVar) {
        for (let i = 0; i < localStorage.length; i++) {
          const anahtar = localStorage.key(i);
          if (anahtar && anahtar.startsWith("rubychat.")) {
            oncekiVar = true;
            break;
          }
        }
      }
      if (oncekiVar) g.turGoruldu = true;
    }
    if (["hepsi", "yt-gh", "kapali"].includes(h.baglantiOnizleme as string)) g.baglantiOnizleme = h.baglantiOnizleme as OnizlemeKipi;
    if (["standart", "yuksek", "orijinal"].includes(h.resimKalitesi as string)) g.resimKalitesi = h.resimKalitesi as ResimKalitesi;
    if (["otomatik", "acik", "kapali"].includes(h.kompakt as string)) g.kompakt = h.kompakt as Kompakt;
    if (typeof h.klipyAnahtar === "string" && h.klipyAnahtar.length < 200) g.klipyAnahtar = h.klipyAnahtar.trim();
    if (typeof h.guncellemeAtlanan === "string" && h.guncellemeAtlanan.trim().length > 0 && h.guncellemeAtlanan.length < 64) {
      g.guncellemeAtlanan = h.guncellemeAtlanan.trim();
    } else if (h.guncellemeAtlanan === null) {
      g.guncellemeAtlanan = null;
    }
  } catch {
    /* blocked or corrupt storage: defaults · depolama engelli ya da bozuk: varsayılanlar */
  }
  return g;
}

class Tercihler {
  d = $state<TercihDeger>(oku());

  yaz<K extends keyof TercihDeger>(anahtar: K, deger: TercihDeger[K]) {
    this.d[anahtar] = deger;
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify($state.snapshot(this.d)));
    } catch {
      /* not persisted; still applies for this session · saklanamadı; bu oturum için yine geçerli */
    }
  }
}
export const tercihler = new Tercihler();
