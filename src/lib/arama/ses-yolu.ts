// Android audio routing (speaker / earpiece) through the tiny Kotlin bridge `RubySes` (MainActivity.kt).
// On desktop / other platforms the bridge does not exist: `hoparlorVar` is false and the UI hides the button.
// Android ses yönlendirmesi (hoparlör / kulaklık), küçük Kotlin köprüsü `RubySes` ile (MainActivity.kt).
// Masaüstünde / başka platformlarda köprü yoktur: `hoparlorVar` false olur ve arayüz düğmeyi gizler.
interface RubySes {
  aramaBasladi(basladi: boolean): void;
  hoparlor(ac: boolean): void;
  aramaServisi?(baslat: boolean, ad: string): void;
}
const kopru = (): RubySes | undefined => (window as unknown as { RubySes?: RubySes }).RubySes;

export const hoparlorVar = (): boolean => !!kopru();
// Old-call fixes: communication mode + audio focus (done in Kotlin) and a microphone foreground service so Android 14 keeps the mic alive.
// Eski arama düzeltmeleri: iletişim modu + ses odağı (Kotlin'de) ve Android 14 mikrofonu canlı tutsun diye mikrofon ön plan servisi.
export const aramaSesiBasladi = (b: boolean) => {
  try {
    kopru()?.aramaBasladi(b);
    kopru()?.aramaServisi?.(b, "");
  } catch (e) { console.warn(e); }
};
export const hoparlorAyarla = (ac: boolean) => { try { kopru()?.hoparlor(ac); } catch (e) { console.warn(e); } };
