// Android side of a call: audio mode + audio focus, the microphone foreground service and output routing, through the Kotlin bridge
// `RubySes` (MainActivity.kt). On other platforms the bridge does not exist and every function is a no-op.
// Bir aramanın Android tarafı: ses modu + ses odağı, mikrofon ön plan servisi ve çıkış yönlendirmesi; Kotlin köprüsü `RubySes` ile
// (MainActivity.kt). Diğer platformlarda köprü yoktur ve her fonksiyon boş çalışır.

/** Output device as Element Call's `window.controls.setAvailableAudioDevices` wants it · EC'nin `setAvailableAudioDevices`inin istediği çıkış aygıtı */
export interface SesCihazi {
  id: string;
  name: string;
  isEarpiece?: boolean;
  isSpeaker?: boolean;
  isExternalHeadset?: boolean;
}

interface RubySes {
  aramaBasladi(basladi: boolean): void;
  aramaServisi(baslat: boolean, ad: string): void;
  cihazlar(): string;
  cihazSec(id: string): void;
  varsayilanCihaz(video: boolean): string;
}
const kopru = (): RubySes | undefined => (window as unknown as { RubySes?: RubySes }).RubySes;

/** Is this Android (the bridge exists and has the new methods)? · Bu Android mı (köprü var ve yeni yöntemleri taşıyor mu)? */
export const androidMi = (): boolean => typeof kopru()?.aramaServisi === "function";

const dene = <T>(f: () => T, yedek: T): T => {
  try {
    return f();
  } catch (e) {
    console.warn("RubySes", e);
    return yedek;
  }
};

/** Call opened: communication mode + audio focus + foreground service (asks for the mic first). · Arama açıldı: iletişim modu + ses odağı + ön plan servisi (önce mikrofon izni). */
export function aramaSesiBaslat(ad: string) {
  if (!androidMi()) return;
  dene(() => kopru()!.aramaBasladi(true), undefined);
  dene(() => kopru()!.aramaServisi(true, ad), undefined);
}

/** Call over: normal audio mode, service stopped. · Arama bitti: normal ses modu, servis durur. */
export function aramaSesiBitir() {
  if (!androidMi()) return;
  dene(() => kopru()!.aramaServisi(false, ""), undefined);
  dene(() => kopru()!.aramaBasladi(false), undefined);
}

export const sesCihazlari = (): SesCihazi[] => (androidMi() ? dene(() => JSON.parse(kopru()!.cihazlar()) as SesCihazi[], []) : []);
export const sesCihaziSec = (id: string) => androidMi() && dene(() => kopru()!.cihazSec(id), undefined);
export const sesVarsayilan = (video: boolean): string => (androidMi() ? dene(() => kopru()!.varsayilanCihaz(video), "") : "");
