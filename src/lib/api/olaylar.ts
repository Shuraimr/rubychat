// The ONLY place that calls listen(). Each backend event gets a typed subscription that returns an unsubscribe function.
// listen() çağrısının YAPILDIĞI TEK yer. Her arka uç olayının tipli bir aboneliği var; abonelikten çıkma fonksiyonu döner.
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AramaOlayi,
  DogrulamaDurumu,
  EsitlemeDurumu,
  MedyaIlerlemeOlayi,
  OdaOzeti,
  SifrelemeDurumu,
  UygulamaIciBildirim,
  YaziyorGuncelleme,
  ZamanGuncelleme,
  ZamanHazir,
} from "./tipler";
import type { EcAramaDurumu, YerelDurum, EcBitti, EcGelen } from "../arama-ec/tipler";

export const odalarGuncellendi = (isle: (odalar: OdaOzeti[]) => void): Promise<UnlistenFn> =>
  listen<OdaOzeti[]>("odalar-guncellendi", (e) => isle(e.payload));

/** The server no longer knows this device's session (signed out elsewhere). · Sunucu bu cihazın oturumunu artık tanımıyor (başka yerden çıkış yapıldı). */
export const oturumGecersiz = (isle: () => void): Promise<UnlistenFn> => listen("oturum-gecersiz", () => isle());

export const esitlemeDurumu = (isle: (d: EsitlemeDurumu) => void): Promise<UnlistenFn> =>
  listen<EsitlemeDurumu>("esitleme-durumu", (e) => isle(e.payload));

export const zamanGuncellendi = (isle: (g: ZamanGuncelleme) => void): Promise<UnlistenFn> =>
  listen<ZamanGuncelleme>("zaman-guncellendi", (e) => isle(e.payload));

export const zamanHazir = (isle: (g: ZamanHazir) => void): Promise<UnlistenFn> =>
  listen<ZamanHazir>("zaman-hazir", (e) => isle(e.payload));

export const aramaOlayi = (isle: (o: AramaOlayi) => void): Promise<UnlistenFn> =>
  listen<AramaOlayi>("arama-olayi", (e) => isle(e.payload));

export const sifrelemeDurumuOlayi = (isle: (d: SifrelemeDurumu) => void): Promise<UnlistenFn> =>
  listen<SifrelemeDurumu>("sifreleme-durumu", (e) => isle(e.payload));

export const dogrulamaGuncellendi = (isle: (d: DogrulamaDurumu) => void): Promise<UnlistenFn> =>
  listen<DogrulamaDurumu>("dogrulama-guncellendi", (e) => isle(e.payload));

export const medyaIlerleme = (isle: (o: MedyaIlerlemeOlayi) => void): Promise<UnlistenFn> =>
  listen<MedyaIlerlemeOlayi>("medya-ilerleme", (e) => isle(e.payload));

/** A message arrived in a room that is not open and the app is visible: show an in-app banner. · Açık olmayan odaya mesaj geldi ve uygulama görünür: uygulama içi şerit göster. */
export const uygulamaIciBildirim = (isle: (b: UygulamaIciBildirim) => void): Promise<UnlistenFn> =>
  listen<UygulamaIciBildirim>("uygulama-ici-bildirim", (e) => isle(e.payload));

/** Who is typing in a room changed · Bir odada kimlerin yazdığı değişti */
export const yaziyorGuncellendi = (isle: (g: YaziyorGuncelleme) => void): Promise<UnlistenFn> =>
  listen<YaziyorGuncelleme>("yaziyor-guncellendi", (e) => isle(e.payload));

// ---- Native calls · Yerel aramalar ----
export const yerelAramaDurumu = (isle: (d: YerelDurum) => void): Promise<UnlistenFn> => listen<YerelDurum>("yerel-arama", (e) => isle(e.payload));

// ---- Element Call ----
export const ecGelen = (isle: (g: EcGelen) => void): Promise<UnlistenFn> => listen<EcGelen>("ec-gelen", (e) => isle(e.payload));
export const ecBitti = (isle: (b: EcBitti) => void): Promise<UnlistenFn> => listen<EcBitti>("ec-bitti", (e) => isle(e.payload));
export const ecAramaDurumu = (isle: (d: EcAramaDurumu) => void): Promise<UnlistenFn> =>
  listen<EcAramaDurumu>("ec-arama-durumu", (e) => isle(e.payload));
