// Turkish texts of the media screens. Kept in one small local dictionary (like i18n/tr.ts) so the media work does not edit the
// shared i18n files; move the keys into tr.ts when convenient. Usage: m("anahtar", { n: 3 }).
// Medya ekranlarının Türkçe metinleri. Medya işi ortak i18n dosyalarına dokunmasın diye küçük yerel sözlükte tutulur
// (i18n/tr.ts gibi); uygun olunca anahtarlar tr.ts'ye taşınır. Kullanım: m("anahtar", { n: 3 }).
import { dil, yerel } from "../i18n";

const tr = {
  kapat: "Kapat",
  iptal: "İptal",
  bitti: "Bitti",
  gonder: "Gönder",
  kirp: "Kırp",
  dondur: "Döndür",
  cevir: "Çevir",
  sifirla: "Sıfırla",
  ekle: "Ekle",
  kaldir: "Kaldır",
  serbest: "Serbest",
  kare: "Kare",
  aciklamaEkle: "Açıklama ekle…",
  secili: "{n} seçili",
  secimYok: "Dosya seçilmedi",
  dosyaSec: "Dosya seç",
  hazirlaniyor: "Hazırlanıyor…",
  kalite: "Kalite",
  kaliteStandart: "Standart",
  kaliteYuksek: "Yüksek",
  kaliteOrijinal: "Orijinal",
  kaliteIpucu: "Gönderirken sıkıştırılır; konum ve çekim bilgisi silinir.",
  kaliteIpucuOrijinal: "Orijinal gönderilir: konum ve çekim bilgisi dosyada kalır.",
  tahmini: "≈ {boyut}",
  sesKapat: "Sesi kapat",
  sesAc: "Sesi aç",
  videoSecili: "{sure} seçili · {kalite} · ≈ {boyut}",
  videoOynat: "Oynat",
  videoDurdur: "Durdur",
  kesmeTutacBas: "Başlangıç",
  kesmeTutacSon: "Bitiş",
  duzenlenemez: "Bu dosya türü düzenlenemez; olduğu gibi gönderilir.",
  okunamadi: "Dosya okunamadı.",
  gonderilemedi: "Medya gönderilemedi.",
  sikistiriliyor: "Sıkıştırılıyor %{yuzde}",
  hazirlaniyorYuzde: "Hazırlanıyor %{yuzde}",
  yukleniyor: "Yükleniyor {gecerli} / {toplam} MB",
  yukleniyorKisa: "Yükleniyor",
  gonderimiIptal: "Gönderimi iptal et",
  indir: "İndir",
  kaydet: "Kaydet",
  kaydedildi: "Kaydedildi: {ad}",
  kaydedilemedi: "Kaydedilemedi.",
  paylas: "Paylaş",
  oynat: "Oynat",
  fotograf: "Fotoğraf",
  video: "Video",
  dosya: "Dosya",
  geriDon: "Geri",
  onceki: "Önceki",
  sonraki: "Sonraki",
  yakinlastir: "Yakınlaştır",
  bugun: "Bugün",
  gorsel: "Görsel",
  videoYuklenemedi: "Video açılamadı.",
  resimYuklenemedi: "Görsel yüklenemedi.",
} as const;

// English texts of the media screens (same keys). · Medya ekranlarının İngilizce metinleri (aynı anahtarlar).
const en: Record<keyof typeof tr, string> = {
  kapat: "Close",
  iptal: "Cancel",
  bitti: "Done",
  gonder: "Send",
  kirp: "Crop",
  dondur: "Rotate",
  cevir: "Flip",
  sifirla: "Reset",
  ekle: "Add",
  kaldir: "Remove",
  serbest: "Free",
  kare: "Square",
  aciklamaEkle: "Add a caption…",
  secili: "{n} selected",
  secimYok: "No file selected",
  dosyaSec: "Choose file",
  hazirlaniyor: "Preparing…",
  kalite: "Quality",
  kaliteStandart: "Standard",
  kaliteYuksek: "High",
  kaliteOrijinal: "Original",
  kaliteIpucu: "Compressed when sent; location and camera info are removed.",
  kaliteIpucuOrijinal: "Sent as the original: location and camera info stay in the file.",
  tahmini: "≈ {boyut}",
  sesKapat: "Mute",
  sesAc: "Unmute",
  videoSecili: "{sure} selected · {kalite} · ≈ {boyut}",
  videoOynat: "Play",
  videoDurdur: "Pause",
  kesmeTutacBas: "Start",
  kesmeTutacSon: "End",
  duzenlenemez: "This file type can't be edited; it's sent as is.",
  okunamadi: "Couldn't read the file.",
  gonderilemedi: "Couldn't send media.",
  sikistiriliyor: "Compressing {yuzde}%",
  hazirlaniyorYuzde: "Preparing {yuzde}%",
  yukleniyor: "Uploading {gecerli} / {toplam} MB",
  yukleniyorKisa: "Uploading",
  gonderimiIptal: "Cancel sending",
  indir: "Download",
  kaydet: "Save",
  kaydedildi: "Saved: {ad}",
  kaydedilemedi: "Couldn't save.",
  paylas: "Share",
  oynat: "Play",
  fotograf: "Photo",
  video: "Video",
  dosya: "File",
  geriDon: "Back",
  onceki: "Previous",
  sonraki: "Next",
  yakinlastir: "Zoom",
  bugun: "Today",
  gorsel: "Image",
  videoYuklenemedi: "Couldn't open the video.",
  resimYuklenemedi: "Couldn't load the image.",
};
const sozluk: Record<string, string> = dil === "en" ? en : tr;

export type MetinAnahtari = keyof typeof tr;

export function m(anahtar: MetinAnahtari, degiskenler?: Record<string, string | number>): string {
  let metin: string = sozluk[anahtar] ?? tr[anahtar];
  if (degiskenler) for (const [k, v] of Object.entries(degiskenler)) metin = metin.replaceAll(`{${k}}`, String(v));
  return metin;
}

/** 1536000 → "1,5 MB"; small sizes in KB · 1536000 → "1,5 MB"; küçük boyutlar KB */
export function boyutYaz(bayt: number): string {
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`;
  const mb = bayt / (1024 * 1024);
  return `${mb.toLocaleString(yerel, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** 83.4 s → "1:23" */
export function sureYaz(sn: number): string {
  const t = Math.max(0, Math.round(sn));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
