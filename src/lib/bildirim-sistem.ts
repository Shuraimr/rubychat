// System notifications, UI side: permission helpers, the "tapped a notification" route, the foreground / background report and the
// in-app banner event. The native half is Bildirimci.kt (Android) + src-tauri/src/bildirim.rs (decisions). Without push (FCM /
// UnifiedPush) notifications only arrive while the app process is alive and syncing.
// Sistem bildirimleri, arayüz tarafı: izin yardımcıları, "bildirime dokunuldu" yolu, ön / arka plan bildirimi ve uygulama içi şerit
// olayı. Yerel yarısı Bildirimci.kt (Android) + src-tauri/src/bildirim.rs (kararlar). Anlık bildirim (FCM / UnifiedPush) olmadan
// bildirimler yalnızca uygulama süreci canlı ve eşitlemedeyken gelir.
import {
  bildirimAyarlariniAc,
  bildirimBekleyenOda,
  bildirimIzniDurumu,
  bildirimIzniIste,
  masaustuArkaPlan,
  uygulamaArkaPlanda,
} from "./api/komutlar";
import { tercihler } from "./durum/tercihler.svelte";
import { masaustuLinux } from "./pano";
import { uygulamaIciBildirim } from "./api/olaylar";
import type { BildirimIzni, UygulamaIciBildirim } from "./api/tipler";

export interface BildirimBaglantilari {
  /** Open this room: a system notification was tapped (live or from a cold start). · Bu odayı aç: sistem bildirimine dokunuldu (canlı ya da soğuk açılıştan). */
  odaAc: (odaId: string) => void;
  /** Show an in-app banner: a message arrived in a room that is not open while the app is visible. · Uygulama içi şerit göster: uygulama görünürken açık olmayan odaya mesaj geldi. */
  uygulamaIci: (b: UygulamaIciBildirim) => void;
}

/**
 * Call ONCE after a session exists (login or restore). Returns a function that undoes everything (call it on logout).
 * Bir oturum varken (giriş ya da geri yükleme) BİR kez çağır. Her şeyi geri alan bir fonksiyon döndürür (çıkışta çağır).
 */
export async function bildirimSistemiBaslat(b: BildirimBaglantilari): Promise<() => void> {
  // Tell Rust when the page is hidden: the desktop banner logic needs it (Android asks its own lifecycle). Hidden = system notification (where it exists).
  // Sayfa gizlenince Rust'a söyle: masaüstü şerit mantığı buna ihtiyaç duyar (Android kendi yaşam döngüsüne sorar).
  const gorunurluk = () => void uygulamaArkaPlanda(document.hidden).catch(() => {});
  document.addEventListener("visibilitychange", gorunurluk);
  gorunurluk();

  // A tapped notification while the app is running: MainActivity dispatches this window event (see MainActivity.kt).
  // Uygulama çalışırken dokunulan bildirim: MainActivity bu pencere olayını yollar (bkz. MainActivity.kt).
  const oda = (e: Event) => {
    const id = (e as CustomEvent<string>).detail;
    if (typeof id === "string" && id) b.odaAc(id);
  };
  window.addEventListener("rubychat-oda-ac", oda);

  // Cold start: the notification that opened the app left its room id with the native side.
  // Soğuk açılış: uygulamayı açan bildirim oda kimliğini yerel tarafta bıraktı.
  bildirimBekleyenOda()
    .then((id) => {
      if (id) b.odaAc(id);
    })
    .catch(() => {});

  const birak = await uygulamaIciBildirim(b.uygulamaIci);
  return () => {
    document.removeEventListener("visibilitychange", gorunurluk);
    window.removeEventListener("rubychat-oda-ac", oda);
    birak();
  };
}

/** Current permission: "verildi" | "verilmedi" | "desteklenmiyor" (desktop, for now). · Güncel izin. */
export const bildirimIzni = (): Promise<BildirimIzni> => bildirimIzniDurumu();

/**
 * For the "Aç" button of the permission card. Shows the system dialog; if Android no longer shows it (denied twice) the notification
 * settings of the app open instead, so the button never does nothing. Returns the permission after the attempt.
 * İzin kartındaki "Aç" düğmesi için. Sistem penceresini gösterir; Android artık göstermiyorsa (iki kez reddedildi) bunun yerine uygulamanın
 * bildirim ayarları açılır; düğme asla sessiz kalmaz. Denemeden sonraki izni döndürür.
 */
export async function bildirimIzniAc(): Promise<BildirimIzni> {
  const once = await bildirimIzniDurumu();
  if (once !== "verilmedi") return once;
  const bas = performance.now();
  const sonra = await bildirimIzniIste();
  // A dialog the user answered takes a moment; one that comes back at once was refused by Android (denied before): open the settings page.
  // Kullanıcının cevapladığı pencere biraz sürer; hemen dönen, Android'in reddettiği (daha önce reddedilmiş) pencere demektir: ayarlar sayfasını aç.
  if (sonra === "verilmedi" && performance.now() - bas < 500) await bildirimAyarlariniAc();
  return sonra;
}

// ---- Background connection (Android foreground service, BaglantiServisi.kt): without a push server the sync must stay alive itself ----
// ---- Arka plan bağlantısı (Android ön plan servisi, BaglantiServisi.kt): anlık bildirim sunucusu olmadan eşitleme kendisi canlı kalmalı ----
const arkaKopru = () => (window as unknown as { RubyArkaPlan?: { ayarla(acik: boolean): void; pilMuaf(): boolean; pilAyari(): void } }).RubyArkaPlan;
export const arkaPlanVar = () => !!arkaKopru() || masaustuLinux;
// Desktop: the window's close button hides it while this is on (src-tauri/src/masaustu_linux.rs); autostart comes with it.
// Masaüstü: bu açıkken pencerenin kapatma düğmesi gizler (src-tauri/src/masaustu_linux.rs); otomatik başlatma onunla gelir.
export const arkaPlanAyarla = (acik: boolean) => {
  const k = arkaKopru();
  if (k) k.ayarla(acik);
  else if (masaustuLinux) void masaustuArkaPlan(acik, acik && tercihler.d.acilistaBaslat).catch(() => {});
};
export const pilMuafMi = () => arkaKopru()?.pilMuaf() ?? true;
export const pilAyariAc = () => arkaKopru()?.pilAyari();
