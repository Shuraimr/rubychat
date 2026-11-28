// Native call audio settings: preferred input/output devices (persisted in localStorage), noise suppression (delegated to
// ayarlar.gurultuEngelleme so Ben and the call screen share one source of truth), and live microphone peak level from Rust.
// Yerel arama ses ayarları: yeğlenen giriş/çıkış aygıtları (localStorage'da saklanır), gürültü engelleme (Ben ile arama ekranı
// tek kaynaktan okusun diye ayarlar.gurultuEngelleme'yi kullanır) ve Rust'tan gelen anlık mikrofon tepe düzeyi.
import type { UnlistenFn } from "@tauri-apps/api/event";
import { yerelAramaSesAyarla } from "../api/komutlar";
import { yerelAramaSeviye } from "../api/olaylar";
import { ayarlar } from "../durum/ayarlar.svelte";
import { sesCihaziSec } from "./ses";

const GIRIS_ANAHTARI = "rubychat.aramaGiris";
const CIKIS_ANAHTARI = "rubychat.aramaCikis";

function oku(anahtar: string): string | null {
  try {
    return localStorage.getItem(anahtar) || null;
  } catch {
    return null;
  }
}

function yaz(anahtar: string, deger: string | null) {
  try {
    if (deger) localStorage.setItem(anahtar, deger);
    else localStorage.removeItem(anahtar);
  } catch {
    /* storage may be blocked; still applies for this session · depolama engelli olabilir; bu oturumda yine geçerli */
  }
}

class SesAyarlari {
  giris = $state<string | null>(oku(GIRIS_ANAHTARI));
  cikis = $state<string | null>(oku(CIKIS_ANAHTARI));
  seviye = $state(0);
  /** Last output chosen on Android during this session (Android device IDs are ephemeral, so not persisted). · Bu oturumda Android'de son seçilen çıkış (Android aygıt kimlikleri geçicidir, saklanmaz). */
  androidCikis = $state<string | null>(null);

  /** Push the current audio settings to the native call engine; errors are swallowed so callers never block a call. · Güncel ses ayarlarını yerel arama motoruna gönderir; hatalar yutulur, aramayı engellemez. */
  async gonder(): Promise<void> {
    await yerelAramaSesAyarla(this.giris, this.cikis, ayarlar.gurultuEngelleme).catch(() => {});
  }

  girisSec(ad: string | null) {
    this.giris = ad;
    yaz(GIRIS_ANAHTARI, ad);
    void this.gonder();
  }

  cikisSec(ad: string | null) {
    this.cikis = ad;
    yaz(CIKIS_ANAHTARI, ad);
    void this.gonder();
  }

  gurultuSec(deger: boolean) {
    ayarlar.gurultuYaz(deger);
    void this.gonder();
  }

  /** Route audio on Android through the Kotlin bridge and remember the choice for the sheet. · Android'de sesi Kotlin köprüsünden yönlendirir ve sayfa için seçimi hatırlar. */
  androidCikisSec(id: string) {
    this.androidCikis = id;
    sesCihaziSec(id);
  }

  /** Listen to microphone peak levels while the audio settings sheet is open so idle calls do not trigger reactive work. · Ses ayarları sayfası açıkken mikrofon tepe düzeyini dinler; kapalıyken boş yere tepki üretmez. */
  seviyeDinle(): () => void {
    let aktif = true;
    let birak: UnlistenFn | null = null;
    void yerelAramaSeviye((s) => {
      if (aktif) this.seviye = Math.min(1, Math.max(0, Number.isFinite(s) ? s : 0));
    })
      .then((fn) => {
        if (aktif) birak = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      aktif = false;
      birak?.();
      birak = null;
      this.seviye = 0;
    };
  }
}

export const sesAyarlari = new SesAyarlari();
