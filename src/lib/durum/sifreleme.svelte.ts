// End-to-end encryption UI state (Svelte 5 runes): verification, recovery key, cross-signing password, which sheet is open.
// The Rust side (src-tauri/src/matrix/sifreleme.rs) owns the truth; this file mirrors it through two events and drives the sheets.
// Uçtan uca şifreleme arayüz durumu (Svelte 5 rune'ları): doğrulama, kurtarma anahtarı, çapraz imza şifresi, hangi sayfanın açık olduğu.
// Gerçeğin sahibi Rust tarafıdır (src-tauri/src/matrix/sifreleme.rs); bu dosya onu iki olayla yansıtır ve sayfaları sürer.
import type { UnlistenFn } from "@tauri-apps/api/event";
import * as komutlar from "../api/komutlar";
import { dogrulamaGuncellendi, sifrelemeDurumuOlayi } from "../api/olaylar";
import type { DogrulamaDurumu, Hata, SifrelemeDurumu } from "../api/tipler";
import { t, type Anahtar } from "../i18n";
import { bildirim } from "./bildirim.svelte";

/** Which sheet is open (null = none). · Hangi sayfa açık (null = hiçbiri). */
export type Katman = null | "kurulum" | "dogrulama" | "kurtarma-gir" | "kurtarma-olustur" | "parola" | "cikis";

const BOS_DOGRULAMA: DogrulamaDurumu = { asama: "yok", digerCihaz: null, emojiler: [], neden: null };

/** The one-time setup sheet is shown once per device; this remembers it. Storage may be blocked, so it is wrapped.
 *  Kurulum sayfası cihaz başına bir kez gösterilir; bu onu hatırlar. Depolama engelli olabilir, bu yüzden sarılıdır. */
const kurulumAnahtari = (cihazId: string) => `rubychat.sifrelemeKurulumu.${cihazId}`;
function kurulumGosterildiMi(cihazId: string): boolean {
  try {
    return localStorage.getItem(kurulumAnahtari(cihazId)) === "1";
  } catch {
    return false;
  }
}
function kurulumGosterildiYaz(cihazId: string) {
  try {
    localStorage.setItem(kurulumAnahtari(cihazId), "1");
  } catch {
    /* not persisted: the sheet may show again next start · saklanamadı: sayfa sonraki açılışta yine çıkabilir */
  }
}

/** Technical error → Turkish text by kind. · Teknik hata → türe göre Türkçe metin. */
export const hataMetni = (e: unknown): string => t(`hata.${(e as Hata)?.tur ?? "diger"}` as Anahtar);

class Sifreleme {
  durum = $state<SifrelemeDurumu | null>(null);
  dogrulama = $state<DogrulamaDurumu>(BOS_DOGRULAMA);
  katman = $state<Katman>(null);
  mesgul = $state(false);
  /** Turkish error text for the open sheet · Açık sayfa için Türkçe hata metni */
  hata = $state<string | null>(null);
  /** The NEW recovery key, only while its sheet is open. Never stored anywhere else. · YENİ kurtarma anahtarı; yalnızca sayfası açıkken, başka hiçbir yerde saklanmaz. */
  yeniAnahtar = $state<string | null>(null);

  #cihazId = "";
  #donus: Katman = null;
  #abonelikler: UnlistenFn[] = [];

  /** Ben tab dot: this device is unverified or recovery is missing. · Ben sekmesi noktası: bu cihaz doğrulanmadı ya da kurtarma eksik. */
  noktaVar = $derived(
    !!this.durum &&
      this.durum.caprazImza !== "bekliyor" &&
      (!this.durum.cihazDogrulandi || this.durum.kurtarma === "kapali" || this.durum.kurtarma === "eksik" || this.durum.parolaGerekli),
  );

  /** Logging out would lose history: no recovery key (or not entered on this device). · Çıkış geçmişi kaybettirir: kurtarma anahtarı yok (ya da bu cihazda girilmemiş). */
  cikisRiskli = $derived(!!this.durum && this.durum.kurtarma !== "hazir" && this.durum.kurtarma !== "bilinmiyor");

  /** Turkish text for an error (used by the settings pages) · Bir hata için Türkçe metin (ayar sayfaları kullanır) */
  hataMetniVer(e: unknown): string {
    return hataMetni(e);
  }

  /** Phone sign-in carries no keys: go straight to the emoji verification. · Telefonla giriş anahtar taşımaz: doğrudan emoji doğrulamasına geç. */
  girisSonrasiDogrula = false;

  async baslat(cihazId: string) {
    this.durdur();
    this.#cihazId = cihazId;
    this.#abonelikler = [
      await sifrelemeDurumuOlayi((d) => {
        this.durum = d;
        this.#kurulumKontrol();
      }),
      await dogrulamaGuncellendi((d) => {
        this.dogrulama = d;
        // An incoming request opens its sheet, unless the user is copying a fresh recovery key right now.
        // Gelen istek kendi sayfasını açar; kullanıcı taze bir kurtarma anahtarını kopyalarken açmaz.
        if (d.asama === "gelen_istek" && this.katman !== "kurtarma-olustur") this.katman = "dogrulama";
      }),
    ];
    try {
      this.durum = await komutlar.sifrelemeDurumu();
      this.dogrulama = await komutlar.dogrulamaDurumu();
    } catch {
      /* the event stream will fill it in · olay akışı dolduracak */
    }
    this.#kurulumKontrol();
  }

  durdur() {
    this.#abonelikler.forEach((f) => f());
    this.#abonelikler = [];
    this.durum = null;
    this.dogrulama = BOS_DOGRULAMA;
    this.katman = null;
    this.yeniAnahtar = null;
    this.hata = null;
    this.mesgul = false;
    this.#donus = null;
  }

  /** One-time setup sheet after the first login on this device, when something is still missing. */
  /** Bu cihazdaki ilk girişten sonra, bir şey hâlâ eksikse bir kez çıkan kurulum sayfası. */
  #kurulumKontrol() {
    const d = this.durum;
    if (this.katman || !d || !this.#cihazId) return;
    if (d.caprazImza === "bekliyor" || d.kurtarma === "bilinmiyor") return; // not known yet · henüz bilinmiyor
    if (!this.noktaVar || kurulumGosterildiMi(this.#cihazId)) return;
    kurulumGosterildiYaz(this.#cihazId);
    this.katman = "kurulum";
    const dogrula = this.girisSonrasiDogrula && !d.cihazDogrulandi && d.caprazImza === "hazir";
    this.girisSonrasiDogrula = false;
    if (dogrula) void this.dogrulamaBaslat("kurulum");
  }

  /** `donus`: the sheet to come back to when the sub-flow ends (the hub, or nothing). · `donus`: alt akış bitince dönülecek sayfa (merkez ya da hiçbiri). */
  ac(katman: Exclude<Katman, null>, donus: Katman = null) {
    this.hata = null;
    this.#donus = donus;
    this.katman = katman;
  }

  /** Sub-flow finished or abandoned: back to the hub or close. · Alt akış bitti ya da bırakıldı: merkeze dön ya da kapat. */
  geri() {
    this.hata = null;
    this.yeniAnahtar = null;
    this.katman = this.#donus;
    this.#donus = null;
  }

  /** Closing from the backdrop / close button. A freshly shown recovery key cannot be dismissed by accident. */
  /** Arka plan / kapat düğmesiyle kapatma. Yeni gösterilen kurtarma anahtarı yanlışlıkla kapatılamaz. */
  kapat() {
    if (this.katman === "kurtarma-olustur" && this.yeniAnahtar) return;
    if (this.katman === "dogrulama") {
      void this.dogrulamaKapat();
      return;
    }
    this.geri();
  }

  // ---- Verification · Doğrulama ----

  async dogrulamaBaslat(donus: Katman = "kurulum") {
    this.hata = null;
    this.mesgul = true;
    try {
      await komutlar.dogrulamaBaslat();
      this.ac("dogrulama", donus);
    } catch (e) {
      this.hata = hataMetni(e);
    } finally {
      this.mesgul = false;
    }
  }

  /** Cancel (if still running) and reset the flow, then leave the sheet. · (Sürüyorsa) iptal et ve akışı sıfırla, sonra sayfadan çık. */
  async dogrulamaKapat() {
    try {
      await komutlar.dogrulamaIptal();
    } catch {
      /* nothing to cancel · iptal edecek bir şey yok */
    }
    this.dogrulama = BOS_DOGRULAMA;
    this.geri();
  }

  async dogrulamaKabul() {
    await this.#calistir(() => komutlar.dogrulamaKabulEt());
  }
  async dogrulamaOnayla() {
    await this.#calistir(() => komutlar.dogrulamaOnayla());
  }
  async dogrulamaEslesmiyor() {
    await this.#calistir(() => komutlar.dogrulamaEslesmiyor());
  }

  // ---- Recovery · Kurtarma ----

  async kurtarmaOlustur() {
    this.hata = null;
    this.mesgul = true;
    try {
      this.yeniAnahtar = await komutlar.kurtarmaOlustur();
    } catch (e) {
      this.hata = hataMetni(e);
    } finally {
      this.mesgul = false;
    }
  }

  async kurtarmaKurtar(anahtar: string) {
    this.hata = null;
    this.mesgul = true;
    try {
      await komutlar.kurtarmaKurtar(anahtar);
      bildirim.goster(t("kurtarmaGir.bitti"));
      this.geri();
    } catch (e) {
      // A wrong key is the usual cause, so say that instead of the generic text. · Genelde sebep yanlış anahtardır; genel metin yerine bunu söyle.
      this.hata = (e as Hata)?.tur === "sifreleme" ? t("kurtarmaGir.yanlis") : hataMetni(e);
    } finally {
      this.mesgul = false;
    }
  }

  async caprazImzaKur(parola: string) {
    this.hata = null;
    this.mesgul = true;
    try {
      await komutlar.capraziImzaKur(parola);
      this.geri();
    } catch (e) {
      this.hata = (e as Hata)?.tur === "giris" ? t("parola.yanlis") : hataMetni(e);
    } finally {
      this.mesgul = false;
    }
  }

  async #calistir(is: () => Promise<void>) {
    this.hata = null;
    try {
      await is();
    } catch (e) {
      this.hata = hataMetni(e);
    }
  }
}

export const sifreleme = new Sifreleme();
