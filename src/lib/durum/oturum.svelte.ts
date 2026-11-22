// Session state (Svelte 5 runes). Single source of truth for "who is logged in".
// Oturum durumu (Svelte 5 rune'ları). "Kim giriş yaptı" sorusunun tek kaynağı.
import * as komutlar from "../api/komutlar";
import type { Ben, GirisIstegi, Hata } from "../api/tipler";

/** Our own name + avatar: shown instantly from the last run, refreshed once per app start. · Kendi adımız + avatarımız: son çalıştırmadan anında gösterilir, her açılışta bir kez yenilenir. */
export interface Profil {
  ad: string | null;
  avatarMxc: string | null;
}
const PROFIL_ANAHTARI = "rubychat.profil";
function profilOku(): Profil | null {
  try {
    const s = localStorage.getItem(PROFIL_ANAHTARI);
    return s ? (JSON.parse(s) as Profil) : null;
  } catch {
    return null;
  }
}

class Oturum {
  ben = $state<Ben | null>(null);
  profil = $state<Profil | null>(profilOku());
  #profilIstendi = false;

  /** Fetch name + avatar at most once per run (the Ben page used to refetch on every visit). · Ad + avatarı çalıştırma başına en fazla bir kez al (Ben sayfası her girişte yeniden alıyordu). */
  profilYenile() {
    if (this.#profilIstendi || !this.ben) return;
    this.#profilIstendi = true;
    komutlar
      .ben()
      .then((b) => {
        // Keep the old value when the network gave nothing. · Ağ bir şey vermediyse eski değeri koru.
        const p: Profil = { ad: b.gorunenAd ?? this.profil?.ad ?? null, avatarMxc: b.avatarMxc ?? this.profil?.avatarMxc ?? null };
        this.profil = p;
        try {
          localStorage.setItem(PROFIL_ANAHTARI, JSON.stringify(p));
        } catch {
          /* not persisted · saklanamadı */
        }
      })
      .catch(() => (this.#profilIstendi = false));
  }
  /** false until the first restore attempt finished · ilk geri yükleme denemesi bitene kadar false */
  hazir = $state(false);
  mesgul = $state(false);
  hata = $state<Hata | null>(null);

  /** On app start: try to restore the saved session. · Uygulama açılırken kayıtlı oturumu geri yüklemeyi dener. */
  async baslat() {
    try {
      this.ben = await komutlar.oturumuGeriYukle();
    } catch (e) {
      this.hata = e as Hata;
      this.ben = null;
    } finally {
      this.hazir = true;
    }
  }

  async giris(istek: GirisIstegi) {
    this.mesgul = true;
    this.hata = null;
    try {
      this.ben = await komutlar.giris(istek);
    } catch (e) {
      this.hata = e as Hata;
    } finally {
      this.mesgul = false;
    }
  }

  async cikis() {
    this.mesgul = true;
    try {
      await komutlar.cikis();
    } catch (e) {
      // Even if the server logout fails we drop the local session. · Sunucudan çıkış başarısız olsa da yerel oturumu bırakırız.
      console.error(e);
    } finally {
      this.ben = null;
      this.profil = null;
      this.#profilIstendi = false;
      try {
        localStorage.removeItem(PROFIL_ANAHTARI);
      } catch {
        /* ignore · yok say */
      }
      this.mesgul = false;
    }
  }
}

export const oturum = new Oturum();
