// Turkish texts of the media screens. Kept in one small local dictionary (like i18n/tr.ts) so the media work does not edit the
// shared i18n files; move the keys into tr.ts when convenient. Usage: m("anahtar", { n: 3 }).
// Medya ekranlarının Türkçe metinleri. Medya işi ortak i18n dosyalarına dokunmasın diye küçük yerel sözlükte tutulur
// (i18n/tr.ts gibi); uygun olunca anahtarlar tr.ts'ye taşınır. Kullanım: m("anahtar", { n: 3 }).
const sozluk = {
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

export type MetinAnahtari = keyof typeof sozluk;

export function m(anahtar: MetinAnahtari, degiskenler?: Record<string, string | number>): string {
  let metin: string = sozluk[anahtar];
  if (degiskenler) for (const [k, v] of Object.entries(degiskenler)) metin = metin.replaceAll(`{${k}}`, String(v));
  return metin;
}

/** 1536000 → "1,5 MB"; small sizes in KB · 1536000 → "1,5 MB"; küçük boyutlar KB */
export function boyutYaz(bayt: number): string {
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`;
  const mb = bayt / (1024 * 1024);
  return `${mb.toLocaleString("tr-TR", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** 83.4 s → "1:23" */
export function sureYaz(sn: number): string {
  const t = Math.max(0, Math.round(sn));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
