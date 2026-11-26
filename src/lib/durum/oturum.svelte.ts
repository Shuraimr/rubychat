// Session state (Svelte 5 runes). Single source of truth for "who is logged in".
// Oturum durumu (Svelte 5 rune'ları). "Kim giriş yaptı" sorusunun tek kaynağı.
import * as komutlar from "../api/komutlar";
import type { Ben, GirisIstegi, Hata } from "../api/tipler";
import { oturumGecersiz } from "../api/olaylar";
import { bildirim } from "./bildirim.svelte";
import { t } from "../i18n";

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

// Who was signed in at the last run. The app opens on it at once while the backend restores the session in the background (its
// commands wait for that restore, see AppState::client), instead of a blank start screen for seconds.
// Son çalıştırmada kim girişliydi. Arka uç oturumu arka planda geri yüklerken uygulama saniyelerce boş açılış ekranı yerine hemen
// bununla açılır (komutları o geri yüklemeyi bekler, bkz. AppState::client).
const BEN_ANAHTARI = "rubychat.sonBen";
/** Room list snapshot of odalar.svelte.ts (removed together with the account) · odalar.svelte.ts'nin oda listesi anlık görüntüsü (hesapla birlikte silinir) */
export const ODA_ONBELLEK_ANAHTARI = "rubychat.odaOnbellek";
function benOku(): Ben | null {
  try {
    const b = JSON.parse(localStorage.getItem(BEN_ANAHTARI) ?? "null") as Ben | null;
    return b && typeof b.kullaniciId === "string" && b.kullaniciId && typeof b.cihazId === "string" ? b : null;
  } catch {
    return null;
  }
}
function benYaz(b: Ben | null) {
  try {
    if (b) localStorage.setItem(BEN_ANAHTARI, JSON.stringify(b));
    else localStorage.removeItem(BEN_ANAHTARI);
  } catch {
    /* not persisted · saklanamadı */
  }
}

/** What this device remembers of the account in use (not of the rooms, whose ids are unique anyway) · Cihazın kullanımdaki hesaptan hatırladıkları (odalar değil; kimlikleri zaten benzersiz) */
function hesapIziSil() {
  try {
    for (const a of [PROFIL_ANAHTARI, BEN_ANAHTARI, ODA_ONBELLEK_ANAHTARI, "rubychat.ziyaret", "rubychat.sonAramalar", "rubychat.sonOdalar", "rubychat.bildirimMerkezi"]) localStorage.removeItem(a);
  } catch {
    /* ignore · yok say */
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
  /** Set name / avatar after the user edited them (also remembered for the next start) · Kullanıcı düzenleyince ad / avatarı yaz (sonraki açılış için de hatırlanır) */
  profilYaz(k: Partial<Profil>) {
    const p: Profil = { ad: this.profil?.ad ?? null, avatarMxc: this.profil?.avatarMxc ?? null, ...k };
    this.profil = p;
    try {
      localStorage.setItem(PROFIL_ANAHTARI, JSON.stringify(p));
    } catch {
      /* not persisted · saklanamadı */
    }
  }
  /** false until the first restore attempt finished · ilk geri yükleme denemesi bitene kadar false */
  hazir = $state(false);
  mesgul = $state(false);
  hata = $state<Hata | null>(null);

  /** On app start: try to restore the saved session. · Uygulama açılırken kayıtlı oturumu geri yüklemeyi dener. */
  async baslat() {
    // Probably signed out from another device: say so instead of "cannot connect" forever. The user decides, because the SDK
    // also reports this when a token refresh merely failed on a bad network, and logging out deletes the local history.
    // Büyük olasılıkla başka cihazdan çıkış yapıldı: sonsuza dek "bağlanılamıyor" demek yerine bunu söyle. Karar kullanıcının;
    // çünkü SDK bunu belirteç yenileme yalnızca kötü ağda başarısız olduğunda da bildirir ve çıkış yerel geçmişi siler.
    let sonUyari = 0;
    void oturumGecersiz(() => {
      if (!this.ben || this.mesgul || Date.now() - sonUyari < 5 * 60_000) return;
      sonUyari = Date.now();
      bildirim.goster(t("oturum.gecersiz"), 60_000, { tur: "hata", eylem: { etiket: t("ben.cikis"), calistir: () => void this.cikis() } });
    });
    const onceki = benOku();
    // Asked first, so the backend is already restoring when the screens below send their own commands.
    // Önce istenir; aşağıdaki ekranlar kendi komutlarını yolladığında arka uç zaten geri yüklüyor olur.
    const istek = komutlar.oturumuGeriYukle();
    if (onceki) {
      this.ben = onceki;
      this.hazir = true;
    }
    try {
      const b = await istek;
      // The same account and device: keep the object, or every effect that follows `ben` would start over.
      // Aynı hesap ve cihaz: nesneyi koru; yoksa `ben`i izleyen her etki baştan başlardı.
      if (b && onceki && b.kullaniciId === onceki.kullaniciId && b.cihazId === onceki.cihazId) Object.assign(this.ben!, b);
      else this.ben = b;
      benYaz(b);
    } catch (e) {
      this.hata = e as Hata;
      this.ben = null;
      benYaz(null);
    } finally {
      this.hazir = true;
    }
  }

  async giris(istek: GirisIstegi) {
    this.mesgul = true;
    this.hata = null;
    try {
      this.ben = await komutlar.giris(istek);
      benYaz(this.ben);
    } catch (e) {
      this.hata = e as Hata;
    } finally {
      this.mesgul = false;
    }
  }

  /** Signed in by the phone flow · Telefon akışıyla girildi */
  girildi(ben: Ben) {
    this.hata = null;
    this.ben = ben;
    benYaz(ben);
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
      hesapIziSil();
      this.mesgul = false;
      // Another account remains: the backend has turned to it. · Başka hesap var: arka uç ona döndü.
      const kalan = await komutlar.hesaplariAl().catch(() => null);
      if (kalan?.liste.length) location.reload();
    }
  }

  /** Turns to another account (null = sign in to a new one). The page starts over, so nothing of the old account can stay on screen.
   *  Başka hesaba döner (null = yenisine gir). Sayfa baştan başlar; eski hesaptan ekranda bir şey kalamaz. */
  async hesapDegistir(id: string | null) {
    if (this.mesgul) return;
    this.mesgul = true;
    try {
      await komutlar.hesapDegistir(id);
      hesapIziSil();
      location.reload();
    } catch (e) {
      this.mesgul = false;
      throw e;
    }
  }
}

export const oturum = new Oturum();
