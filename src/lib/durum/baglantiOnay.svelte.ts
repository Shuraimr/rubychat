// "You are leaving rubychat" confirm for external links: opens the default browser (disAc.ts) or copies the address.
// Dış bağlantılar için "rubychat'ten ayrılıyorsun" onayı: varsayılan tarayıcıda açar (disAc.ts) ya da adresi kopyalar.
class BaglantiOnay {
  url = $state<string | null>(null);
}
export const baglantiOnay = new BaglantiOnay();
export const baglantiAc = (url: string) => (baglantiOnay.url = url);
