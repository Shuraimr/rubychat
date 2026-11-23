// 1:1 voice call state machine: bos → ariyor/caliyor → baglaniyor → bagli → bitti (→ bos).
// Matrix VoIP v1 signalling goes through the Rust commands; the media runs in arama/motor.ts (WebRTC).
// 1:1 sesli arama durum makinesi: bos → ariyor/caliyor → baglaniyor → bagli → bitti (→ bos).
// Matrix VoIP v1 sinyalleşmesi Rust komutlarından geçer; medya arama/motor.ts'te (WebRTC) çalışır.
import type { UnlistenFn } from "@tauri-apps/api/event";
import { aramaOlayiGonder, aramaTurnSunuculari } from "../api/komutlar";
import { aramaOlayi as aramaOlayiDinle } from "../api/olaylar";
import type { AramaAday, AramaGonderIstegi, AramaOlayi, OdaOzeti } from "../api/tipler";
import { aramaSesiBasladi, hoparlorAyarla, hoparlorVar } from "../arama/ses-yolu";
import { Motor, MikrofonHatasi, mikrofonAl } from "../arama/motor";
import { ayarlar } from "./ayarlar.svelte";
import { bildirim } from "./bildirim.svelte";
import { odalar } from "./odalar.svelte";
import { ec } from "../arama-ec/ec.svelte";
import { t, type Anahtar } from "../i18n";

export type Asama = "bos" | "ariyor" | "caliyor" | "baglaniyor" | "bagli" | "bitti";

/** How long a call rings before the caller gives up (ms) · Arayanın vazgeçmesine kadar çalma süresi (ms) */
const CALMA_SURESI = 60_000;
/** How long the "ended" screen stays · "Bitti" ekranının kalma süresi */
const BITTI_GOSTERIM = 2500;

const yeniId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 16);

class Arama {
  asama = $state<Asama>("bos");
  odaId = $state<string | null>(null);
  ad = $state("");
  avatarHarf = $state("");
  avatarMxc = $state<string | null>(null);
  /** Anahtar of the end reason shown on the call screen · Arama ekranında gösterilen bitiş nedeninin anahtarı */
  bitisNedeni = $state<Anahtar | null>(null);
  sessiz = $state(false);
  hoparlor = $state(false);
  /** The call screen is shown (false = running in the background → top bar) · Arama ekranı görünüyor (false = arka planda → üst çubuk) */
  ekranAcik = $state(false);
  /** Talk time in seconds · Konuşma süresi (sn) */
  sure = $state(0);
  /** Does this platform have a speaker toggle? · Bu platformda hoparlör düğmesi var mı? */
  readonly hoparlorVar = hoparlorVar();

  #gelen = false;
  #aramaId = "";
  #tarafId = "";
  #uzakTarafId: string | null = null;
  #teklifSdp = "";
  #motor: Motor | null = null;
  #uzakAdaylar: AramaAday[] = [];
  #calmaZamanlayici: ReturnType<typeof setTimeout> | undefined;
  #bitisZamanlayici: ReturnType<typeof setTimeout> | undefined;
  #sayac: ReturnType<typeof setInterval> | undefined;
  #abone: UnlistenFn | null = null;
  #kendiKullanici = "";

  /** Active = anything but idle/ended · Etkin = boşta/bitti dışındaki her şey */
  etkin = $derived(this.asama !== "bos" && this.asama !== "bitti");
  gorunur = $derived(this.asama !== "bos");
  gurultuAcik = $derived(ayarlar.gurultuEngelleme);

  async baslat(kendiKullanici: string) {
    this.#kendiKullanici = kendiKullanici;
    // Element Call (the main call path) starts listening together with the old signalling (receive-only now). · Element Call (ana arama yolu) eski sinyalleşmeyle birlikte dinlemeye başlar (artık yalnız alma).
    void ec.baslat();
    this.#abone?.();
    this.#abone = await aramaOlayiDinle((o) => this.olayIsle(o));
  }

  durdur() {
    ec.durdur();
    this.#abone?.();
    this.#abone = null;
    this.#temizle();
    this.#gecis("bos");
  }

  // ---------- user actions · kullanıcı eylemleri ----------

  /**
   * Entry point of every call button. Calls go through Element Call (MatrixRTC): DM = voice call, group room = video-capable call.
   * Only when EC cannot be used (the homeserver has no MatrixRTC backend, or it failed to start) a DM falls back to the old 1:1
   * WebRTC call below (Matrix VoIP v1), which also keeps working with clients that cannot do MatrixRTC.
   * Her arama düğmesinin giriş noktası. Aramalar Element Call (MatrixRTC) üzerinden gider: DM = sesli arama, grup odası = görüntü de açılabilen arama.
   * Yalnızca EC kullanılamıyorsa (anasunucuda MatrixRTC arka ucu yok ya da başlatılamadı) DM, aşağıdaki eski 1:1 WebRTC aramasına
   * (Matrix VoIP v1) düşer; o, MatrixRTC bilmeyen istemcilerle de çalışmayı sürdürür.
   */
  async ara(oda: { id: string; ad: string; avatarHarf: string; avatarMxc: string | null }) {
    if (this.etkin) {
      this.ekranAc();
      return;
    }
    if (ec.etkin) {
      ec.ekranAc();
      return;
    }
    const dm = !!odalar.liste.find((r) => r.id === oda.id)?.dm;
    if (await ec.ara({ ...oda, dm, sesli: dm })) return;
    if (dm) await this.#eskiAra(oda);
  }

  async #eskiAra(oda: { id: string; ad: string; avatarHarf: string; avatarMxc: string | null }) {
    this.#basla(oda, false);
    this.#aramaId = yeniId();
    this.#tarafId = yeniId();
    try {
      const motor = await this.#motorKur();
      const sdp = await motor.teklifOlustur();
      if (this.asama !== "ariyor") return motor.kapat();
      await this.#gonder({ tur: "davet", sdp, omurMs: CALMA_SURESI });
      motor.adayGonderiminiAc();
      this.#calmaZamanlayici = setTimeout(() => void this.#kapatGonderVeBitir("invite_timeout", "arama.bitti.cevapsiz"), CALMA_SURESI);
    } catch (e) {
      this.#hataIleBitir(e);
    }
  }

  async yanitla() {
    if (this.asama !== "caliyor") return;
    this.#gecis("baglaniyor");
    clearTimeout(this.#calmaZamanlayici);
    try {
      const motor = await this.#motorKur();
      const sdp = await motor.cevapOlustur(this.#teklifSdp);
      if ((this.asama as Asama) !== "baglaniyor") return motor.kapat();
      await this.#gonder({ tur: "cevap", sdp });
      motor.adayGonderiminiAc();
      await motor.adayEkle(this.#uzakAdaylar.splice(0));
    } catch (e) {
      if (e instanceof MikrofonHatasi) await this.#gonder({ tur: "kapat", neden: "user_media_failed" }).catch(() => {});
      this.#hataIleBitir(e);
    }
  }

  async reddet() {
    if (this.asama !== "caliyor") return;
    await this.#gonder({ tur: "red" }).catch(() => {});
    this.#bitir("arama.bitti.reddettin");
  }

  /** Hang up (also cancels an outgoing call that is still ringing). · Kapat (çalmakta olan giden aramayı da iptal eder). */
  async kapat() {
    if (!this.etkin) return;
    await this.#kapatGonderVeBitir("user_hangup", "arama.bitti.sen");
  }

  sessizToggle() {
    this.sessiz = !this.sessiz;
    this.#motor?.sessizeAl(this.sessiz);
  }

  hoparlorToggle() {
    this.hoparlor = !this.hoparlor;
    hoparlorAyarla(this.hoparlor);
  }

  /** Noise suppression on/off; applied to the running call too. · Gürültü engelleme aç/kapa; süren aramaya da uygulanır. */
  async gurultuAyarla(deger: boolean) {
    ayarlar.gurultuYaz(deger);
    if (this.#motor && !(await this.#motor.gurultuEngelle(deger))) bildirim.goster(t("arama.gurultuUygulanamadi"));
  }

  ekranAc() {
    if (!this.gorunur || this.ekranAcik) return;
    this.ekranAcik = true;
    // Phone back button closes the call screen to the top bar (see gezinme popstate). · Telefon geri tuşu arama ekranını üst çubuğa kapatır.
    if (window.matchMedia("(max-width: 800px)").matches) history.pushState({ arama: true }, "");
  }

  /** From the UI (back arrow): goes through history so the stack stays consistent. · Arayüzden (geri oku): yığın tutarlı kalsın diye history'den geçer. */
  ekranKapat() {
    if (history.state?.arama) history.back();
    else this.ekranAcik = false;
  }

  /** Called by the popstate handler. · popstate işleyicisi çağırır. */
  ekranGizle() {
    this.ekranAcik = false;
  }

  // ---------- incoming events · gelen olaylar ----------

  olayIsle(o: AramaOlayi) {
    const benimki = o.aramaId === this.#aramaId && this.asama !== "bos";
    switch (o.tur) {
      case "davet":
        if (o.kendi) return;
        return this.#davetGeldi(o);
      case "adaylar":
        if (!benimki || o.kendi) return;
        if (this.#uzakTarafId && o.tarafId && o.tarafId !== this.#uzakTarafId) return;
        // The engine holds candidates itself until the remote description exists; before it exists we hold them here.
        // Motor, uzak tanım gelene kadar adayları kendisi tutar; motor yokken (çalıyor) burada tutarız.
        if (this.#motor) void this.#motor.adayEkle(o.adaylar);
        else this.#uzakAdaylar.push(...o.adaylar);
        return;
      case "cevap":
        if (!benimki) return;
        if (o.kendi) {
          // Another device of ours answered the incoming call. · Başka cihazımız gelen aramayı yanıtladı.
          if (this.asama === "caliyor" && o.tarafId !== this.#tarafId) this.#bitir("arama.bitti.baskaCihaz");
          return;
        }
        if (this.asama !== "ariyor" || !this.#motor || !o.sdp) return;
        this.#uzakTarafId = o.tarafId;
        clearTimeout(this.#calmaZamanlayici);
        this.#gecis("baglaniyor");
        void this.#motor
          .cevapUygula(o.sdp)
          .then(async () => {
            await this.#gonder({ tur: "cevap_sec", secilenTarafId: o.tarafId ?? "" });
            await this.#motor?.adayEkle(this.#uzakAdaylar.splice(0));
          })
          .catch((e) => this.#hataIleBitir(e));
        return;
      case "cevap_sec":
        if (benimki && this.#gelen && o.secilenTarafId && o.secilenTarafId !== this.#tarafId && !o.kendi) {
          this.#bitir("arama.bitti.baskaCihaz");
        }
        return;
      case "red":
        if (!benimki) return;
        if (o.kendi) {
          if (this.asama === "caliyor" && o.tarafId !== this.#tarafId) this.#bitir("arama.bitti.baskaCihaz");
        } else if (!this.#gelen) {
          this.#bitir("arama.bitti.reddedildi");
        }
        return;
      case "kapat":
        if (!benimki || o.kendi) return;
        this.#bitir(this.asama === "caliyor" ? "arama.bitti.cevapsiz" : "arama.bitti.karsi");
        return;
    }
  }

  #davetGeldi(o: AramaOlayi) {
    // Busy: tell the caller and ignore. (An Element Call call in progress also counts as busy.) · Meşgul: arayana bildir ve yok say. (Süren bir Element Call araması da meşgul sayılır.)
    if (this.etkin || ec.etkin) {
      // Glare (we both called the same room at once): the call with the lower id survives.
      // Çakışma (aynı odayı aynı anda aradık): kimliği küçük olan arama yaşar.
      if (this.asama === "ariyor" && this.odaId === o.odaId && o.aramaId < this.#aramaId) {
        const teklif = o.sdp ?? "";
        const uzak = o.tarafId;
        void this.#kapatGonderVeBitir("user_hangup", "arama.bitti.sen", true).then(() => {
          this.#gelenKur(o, teklif, uzak);
          void this.yanitla();
        });
        return;
      }
      if (o.aramaId !== this.#aramaId) {
        void aramaOlayiGonder({ odaId: o.odaId, tur: "kapat", aramaId: o.aramaId, tarafId: yeniId(), neden: "user_busy" }).catch(() => {});
      }
      return;
    }
    this.#gelenKur(o, o.sdp ?? "", o.tarafId);
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    // Ring for what is left of the invite's lifetime. · Davetin kalan ömrü kadar çal.
    const kalan = Math.max(1000, (o.omurMs ?? CALMA_SURESI) - (Date.now() - o.zaman));
    this.#calmaZamanlayici = setTimeout(() => this.#bitir("arama.bitti.cevapsiz"), kalan);
  }

  #gelenKur(o: AramaOlayi, teklif: string, uzakTaraf: string | null) {
    const oda: OdaOzeti | undefined = odalar.liste.find((r) => r.id === o.odaId);
    this.#basla(
      { id: o.odaId, ad: oda?.ad ?? o.gonderen, avatarHarf: oda?.avatarHarf ?? "#", avatarMxc: oda?.avatarMxc ?? null },
      true,
    );
    this.#aramaId = o.aramaId;
    this.#tarafId = yeniId();
    this.#uzakTarafId = uzakTaraf;
    this.#teklifSdp = teklif;
  }

  // ---------- internals · iç işler ----------

  #basla(oda: { id: string; ad: string; avatarHarf: string; avatarMxc: string | null }, gelen: boolean) {
    this.#temizle();
    clearTimeout(this.#bitisZamanlayici);
    this.#gelen = gelen;
    this.odaId = oda.id;
    this.ad = oda.ad;
    this.avatarHarf = oda.avatarHarf;
    this.avatarMxc = oda.avatarMxc;
    this.sessiz = false;
    this.hoparlor = false;
    this.sure = 0;
    this.bitisNedeni = null;
    this.#uzakTarafId = null;
    this.#uzakAdaylar = [];
    this.#gecis(gelen ? "caliyor" : "ariyor");
    // Incoming call anywhere opens the call screen; so does dialling. · Her yerde gelen arama arama ekranını açar; arama başlatmak da.
    this.ekranAc();
  }

  async #motorKur(): Promise<Motor> {
    const yerel = await mikrofonAl(ayarlar.gurultuEngelleme);
    // TURN is best effort: without it only direct/STUN-less paths work, but the call may still succeed on one LAN.
    // TURN elinden geleni yapar: yoksa yalnızca doğrudan yollar çalışır; aynı ağda arama yine de olabilir.
    const turn = await aramaTurnSunuculari().catch((e) => {
      console.warn("TURN alınamadı", e);
      return [];
    });
    if (this.asama === "bos" || this.asama === "bitti") {
      yerel.getTracks().forEach((iz) => iz.stop());
      throw new Error("iptal");
    }
    aramaSesiBasladi(true);
    this.#motor = new Motor(yerel, turn, {
      adaylar: (liste) => void this.#gonder({ tur: "adaylar", adaylar: liste }).catch((e) => console.warn(e)),
      baglandi: () => this.#baglandi(),
      koptu: () => void this.#kapatGonderVeBitir("ice_failed", "arama.bitti.ag"),
    });
    return this.#motor;
  }

  #baglandi() {
    if (this.asama === "bagli" || (this.asama !== "baglaniyor" && this.asama !== "ariyor")) return;
    this.#gecis("bagli");
    clearTimeout(this.#calmaZamanlayici);
    this.#sayac = setInterval(() => this.sure++, 1000);
  }

  async #gonder(istek: Partial<AramaGonderIstegi> & Pick<AramaGonderIstegi, "tur">) {
    if (!this.odaId) return;
    await aramaOlayiGonder({ odaId: this.odaId, aramaId: this.#aramaId, tarafId: this.#tarafId, ...istek });
  }

  async #kapatGonderVeBitir(neden: string, mesaj: Anahtar, sessiz = false) {
    const gonder = this.#gonder({ tur: "kapat", neden }).catch(() => {});
    if (sessiz) {
      this.#temizle();
      this.asama = "bos";
      await gonder;
      return;
    }
    this.#bitir(mesaj);
    await gonder;
  }

  #hataIleBitir(e: unknown) {
    if (this.asama === "bos" || this.asama === "bitti") return;
    if (e instanceof MikrofonHatasi) {
      const m = e.neden === "izin" ? "arama.bitti.mikrofonIzin" : e.neden === "yok" ? "arama.bitti.mikrofonYok" : "arama.bitti.hata";
      return this.#bitir(m);
    }
    console.error(e);
    void this.#gonder({ tur: "kapat", neden: "unknown_error" }).catch(() => {});
    this.#bitir("arama.bitti.hata");
  }

  #gecis(a: Asama) {
    this.asama = a;
  }

  #temizle() {
    clearTimeout(this.#calmaZamanlayici);
    clearInterval(this.#sayac);
    this.#sayac = undefined;
    this.#motor?.kapat();
    this.#motor = null;
    // Do not reset the audio mode under a running Element Call call. · Süren Element Call aramasının ses modunu sıfırlama.
    if (!ec.etkin) aramaSesiBasladi(false);
  }

  /** Ends locally: stops media, shows the reason for a moment, then returns to idle. · Yerelde bitirir: medyayı durdurur, nedeni bir an gösterir, sonra boşa döner. */
  #bitir(neden: Anahtar) {
    if (this.asama === "bos" || this.asama === "bitti") return;
    this.#temizle();
    this.bitisNedeni = neden;
    this.#gecis("bitti");
    // Errors must be visible even if the screen is closed. · Ekran kapalı olsa bile hata görünmeli.
    if (!this.ekranAcik && neden !== "arama.bitti.sen" && neden !== "arama.bitti.reddettin") bildirim.goster(t(neden));
    clearTimeout(this.#bitisZamanlayici);
    this.#bitisZamanlayici = setTimeout(() => {
      this.#gecis("bos");
      if (this.ekranAcik) this.ekranKapat();
    }, BITTI_GOSTERIM);
  }
}

export const arama = new Arama();
