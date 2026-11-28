// Calls through Element Call (EC), the way Element X does it: EC runs in an <iframe> (EcKatman.svelte), the Rust `WidgetDriver` answers
// its Matrix requests, and this store carries the JSON messages between the two. It also tracks which rooms have a call running
// (the "Katıl" banner) and keeps the call alive while the screen is minimised (the iframe stays mounted).
// Element Call (EC) ile aramalar, Element X'in yaptığı gibi: EC bir <iframe> içinde çalışır (EcKatman.svelte), Rust `WidgetDriver`
// onun Matrix isteklerini yanıtlar ve bu depo ikisi arasında JSON mesajlarını taşır. Ayrıca hangi odalarda arama sürdüğünü izler
// ("Katıl" şeridi) ve ekran küçültülünce aramayı canlı tutar (iframe takılı kalır).
import type { UnlistenFn } from "@tauri-apps/api/event";
import { ecAc, ecAktifAramalar, ecGonder, ecKapat, ecSunucuDestekliyor, yerelAramaBaslat, yerelAramaKapat, yerelAramaVar } from "../api/komutlar";
import { ecAramaDurumu, ecBitti, ecGelen, yerelAramaDurumu } from "../api/olaylar";
import { t, type Anahtar } from "../i18n";
import { ayarlar } from "../durum/ayarlar.svelte";
import { bildirim } from "../durum/bildirim.svelte";
import { gezinme } from "../durum/gezinme.svelte";
import { aramaSesiBaslat, aramaSesiBitir, androidMi, sesCihaziSec, sesCihazlari, sesVarsayilan } from "./ses";
import { sesAyarlari } from "./sesAyarlari.svelte";
import type { EcAramaDurumu, EcTuru, YerelDurum } from "./tipler";

export type EcAsama = "bos" | "yukleniyor" | "acik" | "hata";

/** If EC sends no `content_loaded` in this time the bundled copy is considered broken (ms). · EC bu sürede `content_loaded` göndermezse paketlenmiş kopya bozuk sayılır (ms). */
const YUKLEME_ZAMAN_ASIMI = 15_000;
/** How long we wait for EC's answer to our hang-up request before closing anyway (ms), like Element X. · Kapatma isteğimize EC'nin yanıtını bekleme süresi (ms), Element X gibi. */
const KAPATMA_BEKLEME = 2_000;

export interface EcOda {
  id: string;
  ad: string;
  avatarHarf: string;
  avatarMxc: string | null;
  dm: boolean;
  /** Voice-only (DM voice call); false = video-capable · Yalnız ses (DM sesli arama); false = görüntü de açılabilir */
  sesli: boolean;
}

const temaAdi = (): string =>
  ayarlar.tema === "koyu" ? "dark" : ayarlar.tema === "acik" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

class EcArama {
  asama = $state<EcAsama>("bos");
  odaId = $state<string | null>(null);
  ad = $state("");
  avatarHarf = $state("");
  avatarMxc = $state<string | null>(null);
  dm = $state(false);
  sesli = $state(false);
  url = $state<string | null>(null);
  widgetId = $state<string | null>(null);
  /** The call layer is visible (false = minimised to the green bar, the iframe keeps running) · Arama katmanı görünüyor (false = yeşil çubuğa küçültülmüş, iframe çalışmayı sürdürür) */
  ekranAcik = $state(false);
  hata = $state<Anahtar | null>(null);
  /** Using the hosted EC because the bundled copy failed · Paketlenmiş kopya başarısız olduğu için barındırılan EC kullanılıyor */
  yedekte = $state(false);
  /** Seconds since the call screen loaded · Arama ekranı yüklendiğinden beri geçen saniye */
  sure = $state(0);
  /** This call runs inside the app (native engine), not in the iframe · Bu arama uygulama içinde (yerel motor), iframe'de değil */
  yerel = $state(false);
  yerelDurum = $state<YerelDurum | null>(null);
  /** Rooms with a running MatrixRTC call · MatrixRTC araması süren odalar */
  aktifler = $state<Record<string, EcAramaDurumu>>({});
  /** Rooms whose incoming-call card was dismissed (until the call ends) · Gelen arama kartı kapatılan odalar (arama bitene kadar) */
  yoksayilan = $state<Record<string, true>>({});

  etkin = $derived(this.asama === "yukleniyor" || this.asama === "acik");
  gorunur = $derived(this.asama !== "bos");

  #iframe: HTMLIFrameElement | null = null;
  #abonelikler: UnlistenFn[] = [];
  #katman = 0;
  #zamanAsimi: ReturnType<typeof setTimeout> | undefined;
  #sayac: ReturnType<typeof setInterval> | undefined;
  #bekleyenKapatma: ((yanit: boolean) => void) | null = null;
  #kapatIstekId = "";
  #oda: EcOda | null = null;
  #tur: EcTuru = "baslat";
  #kapaniyor = false;
  #sesDinleyici = () => this.#sesListesiGonder();
  #arkaPlanDinleyici = () => void this.kapat();

  // ---------- lifecycle · yaşam döngüsü ----------

  /** Start listening after login. · Girişten sonra dinlemeye başla. */
  async baslat() {
    this.durdur();
    const a = await Promise.all([
      ecGelen((g) => this.#iframeeGonder(g.widgetId, g.mesaj)),
      ecBitti((b) => {
        if (b.widgetId === this.widgetId) this.#bitir();
      }),
      ecAramaDurumu((d) => this.#durumGuncelle(d)),
      yerelAramaDurumu((d) => this.#yerelGeldi(d)),
    ]);
    this.#abonelikler = a;
    window.addEventListener("message", this.#iframedenGelen);
    window.addEventListener("rubychat-ses-cihazlari", this.#sesDinleyici);
    window.addEventListener("rubychat-arama-kapat", this.#arkaPlanDinleyici);
    // Calls that were already running before we started (app opened late). · Biz başlamadan önce süren aramalar (uygulama geç açıldı).
    void ecAktifAramalar().then((l) => l.forEach((d) => this.#durumGuncelle(d))).catch((e) => console.warn("aktif aramalar", e));
  }

  durdur() {
    this.#abonelikler.forEach((f) => f());
    this.#abonelikler = [];
    window.removeEventListener("message", this.#iframedenGelen);
    window.removeEventListener("rubychat-ses-cihazlari", this.#sesDinleyici);
    window.removeEventListener("rubychat-arama-kapat", this.#arkaPlanDinleyici);
    this.#temizle();
    this.aktifler = {};
    this.yoksayilan = {};
    this.asama = "bos";
  }

  /** EcKatman gives us the iframe element once it is in the DOM. · EcKatman, DOM'a girince iframe öğesini verir. */
  iframeBagla(el: HTMLIFrameElement | null) {
    this.#iframe = el;
  }

  // ---------- user actions · kullanıcı eylemleri ----------

  /**
   * Start (or join, if one is already running) a call in a room. Returns false when EC cannot be used so the caller can fall back to the
   * old 1:1 WebRTC call (DM only).
   * Bir odada arama başlat (zaten süren varsa katıl). EC kullanılamıyorsa false döner; çağıran eski 1:1 WebRTC aramasına düşebilir (yalnız DM).
   */
  async ara(oda: EcOda): Promise<boolean> {
    if (this.etkin) {
      this.ekranAc();
      return true;
    }
    // No MatrixRTC backend on the homeserver = EC cannot connect. · Anasunucuda MatrixRTC arka ucu yoksa EC bağlanamaz.
    const destek = await ecSunucuDestekliyor().catch(() => true);
    if (!destek) {
      if (!oda.dm) bildirim.goster(t("arama.sunucuDesteklemiyor"), 5000, { tur: "hata" });
      return false;
    }
    const d = this.aktifler[oda.id];
    return this.#ac(oda, d?.aktif && !d.benIcinde ? "katil" : "baslat", false);
  }

  /** "Katıl" banner / incoming call card. · "Katıl" şeridi / gelen arama kartı. */
  katil(oda: EcOda) {
    if (this.etkin) return this.ekranAc();
    void this.#ac(oda, "katil", false);
  }

  yoksay(odaId: string) {
    this.yoksayilan[odaId] = true;
  }

  /** Hang up: asks EC to leave (so the others see us leave), then tears the session down. · Kapat: EC'den ayrılmasını ister (diğerleri çıktığımızı görsün), sonra oturumu söker. */
  async kapat() {
    if (!this.etkin || this.#kapaniyor) return;
    this.#kapaniyor = true;
    try {
      if (this.yerel) await yerelAramaKapat().catch(() => {});
      else if (this.asama === "acik") await this.#ayrilIste();
    } finally {
      this.#bitir();
    }
  }

  /** Show the call layer; back (Android) / Escape minimises it instead of hanging up. · Arama katmanını göster; geri (Android) / Escape kapatmaz, küçültür. */
  ekranAc() {
    if (!this.etkin || this.ekranAcik) return;
    this.ekranAcik = true;
    this.#katman = gezinme.katmanAc(() => {
      this.#katman = 0;
      this.ekranAcik = false;
    });
  }

  kucult() {
    this.ekranAcik = false;
    if (this.#katman) {
      gezinme.katmanBirak(this.#katman);
      this.#katman = 0;
    }
  }

  /** Error screen "Kapat". · Hata ekranındaki "Kapat". */
  hataKapat() {
    this.#temizle();
    this.asama = "bos";
  }

  // ---------- internals · iç işler ----------

  async #ac(oda: EcOda, tur: EcTuru, yedek: boolean): Promise<boolean> {
    this.#temizle();
    this.#oda = oda;
    this.#tur = tur;
    this.odaId = oda.id;
    this.ad = oda.ad;
    this.avatarHarf = oda.avatarHarf;
    this.avatarMxc = oda.avatarMxc;
    this.dm = oda.dm;
    this.sesli = oda.sesli;
    this.hata = null;
    this.sure = 0;
    this.yedekte = yedek;
    this.#kapaniyor = false;
    this.asama = "yukleniyor";
    try {
      if (await yerelAramaVar().catch(() => false)) {
        if (this.asama !== "yukleniyor") return true;
        this.yerel = true;
        // Android: communication mode, audio focus, microphone permission and the foreground service, then the default output
        // (earpiece for a voice DM, speaker otherwise). · Android: iletişim modu, ses odağı, mikrofon izni ve ön plan servisi; sonra
        // varsayılan çıkış (sesli birebir aramada ahize, yoksa hoparlör).
        aramaSesiBaslat(oda.ad);
        const cikis = sesVarsayilan(!oda.sesli || !oda.dm);
        if (cikis) sesCihaziSec(cikis);
        this.ekranAc();
        // Send saved input/output and noise-suppression choices before the engine opens the audio streams.
        // Motor ses akışlarını açmadan önce kayıtlı giriş/çıkış ve gürültü engelleme seçimlerini gönder.
        await sesAyarlari.gonder();
        if (this.asama !== "yukleniyor") return true;
        await yerelAramaBaslat(oda.id, oda.dm, tur === "baslat");
        // Hung up while Rust was starting: the earlier close did nothing (the call did not exist yet), so close it now.
        // Rust başlarken kapatıldı: önceki kapatma boşa gitti (arama henüz yoktu), şimdi kapat.
        if (this.asama !== "yukleniyor") void yerelAramaKapat().catch(() => {});
        return true;
      }
      const a = await ecAc({
        odaId: oda.id,
        tur,
        sesliMi: oda.sesli,
        dmMi: oda.dm,
        ustUrl: location.origin,
        tema: temaAdi(),
        yedek,
      });
      // Cancelled while Rust was working. · Rust çalışırken iptal edildi.
      if (this.asama !== "yukleniyor") {
        void ecKapat(a.widgetId).catch(() => {});
        return true;
      }
      this.widgetId = a.widgetId;
      this.url = a.url;
      aramaSesiBaslat(oda.ad);
      this.ekranAc();
      this.#zamanAsimi = setTimeout(() => this.#yuklenemedi(), YUKLEME_ZAMAN_ASIMI);
      return true;
    } catch (e) {
      console.error("EC açılamadı", e);
      this.#temizle();
      this.asama = "bos";
      return false;
    }
  }

  /** A snapshot of the native call. · Yerel aramanın anlık görüntüsü. */
  #yerelGeldi(d: YerelDurum) {
    if (!this.yerel || d.odaId !== this.odaId) return;
    if (d.asama === "bitti") {
      const n = d.neden;
      if (n && n !== "biz") bildirim.goster(t(`yerel.bitti.${n}`), 5000, n === "ayrildilar" ? {} : { tur: "hata" });
      return this.#bitir();
    }
    this.yerelDurum = d;
    if (d.asama === "acik" && this.asama === "yukleniyor") {
      this.asama = "acik";
      this.#sayac = setInterval(() => this.sure++, 1000);
    }
  }

  /** The widget page never said `content_loaded`: retry once with the hosted EC, then give up with a message. · Widget sayfası hiç `content_loaded` demedi: barındırılan EC ile bir kez daha dene, sonra mesajla vazgeç. */
  #yuklenemedi() {
    if (this.asama !== "yukleniyor") return;
    const oda = this.#oda;
    if (oda && !this.yedekte) {
      const wid = this.widgetId;
      if (wid) void ecKapat(wid).catch(() => {});
      this.iframeBagla(null);
      this.url = null;
      void this.#ac(oda, this.#tur, true).then((tamam) => {
        if (!tamam) this.#hataVer();
      });
      return;
    }
    this.#hataVer();
  }

  #hataVer() {
    const wid = this.widgetId;
    if (wid) void ecKapat(wid).catch(() => {});
    clearTimeout(this.#zamanAsimi);
    aramaSesiBitir();
    this.hata = "arama.ec.yuklenemedi";
    this.asama = "hata";
    this.url = null;
  }

  /** EC posted `content_loaded`: the call UI is up. · EC `content_loaded` gönderdi: arama arayüzü açıldı. */
  #yuklendi() {
    if (this.asama !== "yukleniyor") return;
    clearTimeout(this.#zamanAsimi);
    this.asama = "acik";
    clearInterval(this.#sayac);
    this.#sayac = setInterval(() => this.sure++, 1000);
  }

  /** Window message from the iframe: widget API traffic and our own bridge messages. · iframe'den pencere mesajı: widget API trafiği ve kendi köprü mesajlarımız. */
  #iframedenGelen = (e: MessageEvent) => {
    // The iframe's `contentWindow` is the identity check. (A custom scheme like `ec://` has an opaque origin string in some engines, so
    // `e.origin` is unreliable; the window reference cannot be forged by another frame.)
    // iframe'in `contentWindow`u kimlik denetimidir. (`ec://` gibi özel şemanın kaynak dizesi bazı motorlarda opak olur, bu yüzden
    // `e.origin` güvenilmez; pencere başvurusu başka bir çerçeve tarafından taklit edilemez.)
    if (!this.#iframe || e.source !== this.#iframe.contentWindow) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d !== "object") return;

    if (typeof d.rubychatKopru === "string") return this.#koprudenGelen(d);

    // Same filter as Element X: widget requests, and responses to OUR requests. Everything else is our own echo.
    // Element X ile aynı süzgeç: widget istekleri ve BİZİM isteklerimize yanıtlar. Gerisi kendi yankımız.
    const istek = d.api === "fromWidget" && !d.response;
    const yanit = d.api === "toWidget" && !!d.response;
    if (!istek && !yanit) return;

    if (yanit && this.#bekleyenKapatma && d.requestId === this.#kapatIstekId) {
      this.#bekleyenKapatma(true);
      return;
    }
    if (istek) {
      if (d.action === "content_loaded") this.#yuklendi();
      // EC closes itself after the user left (or an error): same as hanging up. · EC, kullanıcı ayrıldıktan (ya da hatadan) sonra kendini kapatır: kapatmakla aynı.
      if (d.action === "io.element.close" || d.action === "im.vector.hangup") {
        void ecGonder(this.widgetId ?? "", JSON.stringify(d)).catch(() => {});
        this.#bitir();
        return;
      }
    }
    if (this.widgetId) void ecGonder(this.widgetId, JSON.stringify(d)).catch((err) => console.warn("ec_gonder", err));
  };

  /** Messages from our bridge script inside EC (audio output, back button). · EC içindeki köprü betiğimizin mesajları (ses çıkışı, geri düğmesi). */
  #koprudenGelen(d: Record<string, unknown>) {
    switch (d.rubychatKopru) {
      case "ses-basladi":
        // EC is ready for the device list. Pick headset > speaker (video) / earpiece (voice) like Element X. · EC aygıt listesine hazır. Element X gibi: kulaklık > hoparlör (görüntülü) / ahize (sesli).
        this.#sesListesiGonder();
        {
          const id = sesVarsayilan(!this.sesli || !this.dm);
          if (id) {
            sesCihaziSec(id);
            this.#iframeKopru({ rubychatKopru: "ses-sec", id });
          }
        }
        return;
      case "ses-secildi":
        if (typeof d.id === "string") sesCihaziSec(d.id);
        return;
      case "geri":
        return this.kucult();
    }
  }

  #sesListesiGonder() {
    if (!androidMi() || !this.etkin) return;
    this.#iframeKopru({ rubychatKopru: "ses-listesi", cihazlar: sesCihazlari() });
  }

  #iframeKopru(mesaj: Record<string, unknown>) {
    this.#iframe?.contentWindow?.postMessage(mesaj, "*");
  }

  /** Driver → widget. "*" target: the window is OUR iframe (see the identity check above), and custom-scheme origins are not matchable. · Sürücü → widget. "*" hedef: pencere BİZİM iframe'imiz (yukarıdaki kimlik denetimine bak); özel şema kaynakları eşleştirilemez. */
  #iframeeGonder(widgetId: string, mesaj: string) {
    if (widgetId !== this.widgetId) return;
    try {
      this.#iframe?.contentWindow?.postMessage(JSON.parse(mesaj), "*");
    } catch (e) {
      console.warn("ec-gelen", e);
    }
  }

  /** Ask EC to leave the call (`im.vector.hangup`) and wait for its answer (max 2 s), the way Element X does. · EC'den aramadan ayrılmasını iste (`im.vector.hangup`) ve yanıtını bekle (en çok 2 sn), Element X gibi. */
  #ayrilIste(): Promise<void> {
    return new Promise((coz) => {
      if (!this.#iframe?.contentWindow || !this.widgetId) return coz();
      this.#kapatIstekId = crypto.randomUUID();
      const zaman = setTimeout(() => bitti(false), KAPATMA_BEKLEME);
      const bitti = (_: boolean) => {
        clearTimeout(zaman);
        this.#bekleyenKapatma = null;
        coz();
      };
      this.#bekleyenKapatma = bitti;
      this.#iframe.contentWindow.postMessage({ api: "toWidget", widgetId: this.widgetId, requestId: this.#kapatIstekId, action: "im.vector.hangup", data: {} }, "*");
    });
  }

  #durumGuncelle(d: EcAramaDurumu) {
    const eski = this.aktifler[d.odaId];
    if (d.aktif) this.aktifler[d.odaId] = d;
    else delete this.aktifler[d.odaId];
    // A call that ended resets the "dismissed" mark so the next one rings again. · Biten arama "yoksayıldı" işaretini sıfırlar; sıradaki yeniden çalar.
    if (!d.aktif) delete this.yoksayilan[d.odaId];
    // Fresh incoming call from somebody else: a short buzz. · Başkasından yeni gelen arama: kısa titreşim.
    if (d.aktif && !d.benIcinde && !eski?.aktif && !this.etkin) navigator.vibrate?.([300, 150, 300]);
  }

  /** Call ended (hang-up, widget closed, driver ended): tear everything down and go idle. · Arama bitti (kapatma, widget kapandı, sürücü bitti): her şeyi söker, boşa döner. */
  #bitir() {
    if (this.asama === "bos") return;
    const wid = this.widgetId;
    this.#temizle();
    if (wid) void ecKapat(wid).catch(() => {});
    this.asama = "bos";
  }

  #temizle() {
    clearTimeout(this.#zamanAsimi);
    clearInterval(this.#sayac);
    this.#sayac = undefined;
    this.#bekleyenKapatma = null;
    this.kucult();
    this.url = null;
    this.widgetId = null;
    this.yerel = false;
    this.yerelDurum = null;
    this.#iframe = null;
    this.#kapaniyor = false;
    aramaSesiBitir();
  }
}

export const ec = new EcArama();
