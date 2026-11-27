// Lightweight presence cache shared by the chat header online counter and the People panel.
// Many servers switch presence off: once two initial lookups fail without any success, stop querying instead of spamming errors.
// Sohbet başlığı çevrimiçi sayacı ile Kişiler panelinin paylaştığı hafif varlık önbelleği.
// Birçok sunucu varlığı kapatır: hiç başarı olmadan ilk iki istek hata verirse hata yağdırmak yerine sormayı bırakır.
import { varlikDurumu } from "../api/komutlar";
import type { VarlikDurumu } from "../api/tipler";

interface Kayit {
  veri: VarlikDurumu;
  zaman: number;
}

const TTL_MS = 60_000;

class VarlikDeposu {
  harita = $state<Record<string, Kayit>>({});
  /** null = unknown yet, true = server answered at least once, false = server switched presence off · null = henüz bilinmiyor, true = sunucu en az bir kez yanıtladı, false = sunucu varlığı kapatmış */
  destekli = $state<boolean | null>(null);

  #bekleyen = new Set<string>();
  #hataSayaci = 0;

  al(kullaniciId: string): VarlikDurumu | null {
    return this.harita[kullaniciId]?.veri ?? null;
  }

  async sor(kullaniciId: string): Promise<VarlikDurumu | null> {
    if (this.destekli === false) return null;
    const mevcut = this.harita[kullaniciId];
    if (mevcut && Date.now() - mevcut.zaman < TTL_MS) return mevcut.veri;
    if (this.#bekleyen.has(kullaniciId)) return mevcut?.veri ?? null;
    this.#bekleyen.add(kullaniciId);
    try {
      const veri = await varlikDurumu(kullaniciId);
      this.destekli = true;
      this.#hataSayaci = 0;
      this.harita[kullaniciId] = { veri, zaman: Date.now() };
      return veri;
    } catch {
      if (this.destekli === null) {
        this.#hataSayaci++;
        if (this.#hataSayaci >= 2) this.destekli = false;
      }
      return null;
    } finally {
      this.#bekleyen.delete(kullaniciId);
    }
  }

  /** Fetch presence for a slice of users in small batches so big rooms never flood the server. · Büyük odalar sunucuyu boğmasın diye bir kullanıcı diliminin varlığını küçük partilerle getirir. */
  async topluSor(kullaniciIdler: string[], enCok = 24) {
    if (this.destekli === false) return;
    const simdi = Date.now();
    const hedefler = kullaniciIdler
      .filter((id) => {
        const k = this.harita[id];
        return !this.#bekleyen.has(id) && (!k || simdi - k.zaman >= TTL_MS);
      })
      .slice(0, enCok);
    const parti = 4;
    for (let i = 0; i < hedefler.length; i += parti) {
      // Re-read: an awaited batch may have switched it off (TS narrowing can't see that). · Yeniden oku: önceki parti kapatmış olabilir (TS daraltması bunu göremez).
      if ((this.destekli as boolean | null) === false) return;
      await Promise.all(hedefler.slice(i, i + parti).map((id) => this.sor(id)));
    }
  }

  cevrimiciSayisi(kullaniciIdler: string[]): number {
    let n = 0;
    for (const id of kullaniciIdler) {
      if (this.harita[id]?.veri.durum === "cevrimici") n++;
    }
    return n;
  }
}

export const varlik = new VarlikDeposu();
