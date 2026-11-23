// Custom chat backgrounds picked from the device. Matrix has no such thing and the picture is personal, so it is NEVER uploaded: the
// compressed image lives in this device's IndexedDB (localStorage is far too small for pictures). Key "genel" = all chats, or a room id.
// The blob is shown through a blob: URL (allowed by the CSP img-src). Compression reuses medya/isleme.ts (WebP, long edge 1600px).
// Cihazdan seçilen sohbet arka planları. Matrix'te böyle bir şey yok ve resim kişisel; bu yüzden ASLA yüklenmez: sıkıştırılmış resim bu
// cihazın IndexedDB'sinde durur (localStorage resim için çok küçük). Anahtar "genel" = bütün sohbetler ya da bir oda kimliği.
// Blob, blob: adresiyle gösterilir (CSP img-src izin verir). Sıkıştırma medya/isleme.ts'i kullanır (WebP, uzun kenar 1600px).
import { bosDuzenleme, cizCanvas, resmiCoz, blobaCevir } from "../medya/isleme";

const VT = "rubychat-zemin";
const DEPO = "resimler";

function ac(): Promise<IDBDatabase> {
  return new Promise((coz, red) => {
    const i = indexedDB.open(VT, 1);
    i.onupgradeneeded = () => i.result.createObjectStore(DEPO);
    i.onsuccess = () => coz(i.result);
    i.onerror = () => red(i.error);
  });
}

async function islem<T>(mod: IDBTransactionMode, f: (d: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ac();
  try {
    return await new Promise<T>((coz, red) => {
      const r = f(db.transaction(DEPO, mod).objectStore(DEPO));
      r.onsuccess = () => coz(r.result);
      r.onerror = () => red(r.error);
    });
  } finally {
    db.close();
  }
}

/** Compress a picked file and store it under `anahtar`. Returns false if it is not a readable image. · Seçilen dosyayı sıkıştırıp `anahtar` altında saklar. Okunabilir resim değilse false. */
export async function zeminKaydet(anahtar: string, dosya: Blob): Promise<boolean> {
  const bmp = await resmiCoz(dosya);
  if (!bmp) return false;
  const tuval = cizCanvas(bmp, bosDuzenleme(), 1600);
  const blob = await blobaCevir(tuval, 0.8, 0.82);
  await islem("readwrite", (d) => d.put(blob, anahtar));
  urlOnbellek.get(anahtar) && URL.revokeObjectURL(urlOnbellek.get(anahtar)!);
  urlOnbellek.delete(anahtar);
  return true;
}

const urlOnbellek = new Map<string, string>();

/** A blob: URL for the stored picture, or null. Cached per key so the same URL is reused. · Saklanan resim için blob: adresi ya da null. Anahtar başına önbelleğe alınır. */
export async function zeminUrl(anahtar: string): Promise<string | null> {
  const var_ = urlOnbellek.get(anahtar);
  if (var_) return var_;
  try {
    const blob = await islem<Blob | undefined>("readonly", (d) => d.get(anahtar));
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urlOnbellek.set(anahtar, u);
    return u;
  } catch {
    return null;
  }
}

export async function zeminSil(anahtar: string): Promise<void> {
  try {
    await islem("readwrite", (d) => d.delete(anahtar));
  } catch {
    /* nothing stored · saklanan yok */
  }
  const u = urlOnbellek.get(anahtar);
  if (u) URL.revokeObjectURL(u);
  urlOnbellek.delete(anahtar);
}
