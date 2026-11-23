// Message search state: one `MesajAramasi` per search box (debounce + stale-response guard) and one shared `atlama` (jump to a result).
// Self-contained on purpose: the search field will move (bottom of the screen) and the screens around it will be redesigned, so
// nothing here knows about their layout.
// Mesaj araması durumu: her arama kutusu için bir `MesajAramasi` (bekletme + eski cevabı yok sayma) ve ortak bir `atlama` (sonuca atla).
// Bilerek bağımsız: arama alanı taşınacak (ekranın altı) ve çevresindeki ekranlar yeniden tasarlanacak; burada hiçbir şey
// onların düzenini bilmez.
import { dizinDurumu, mesajAra } from "../api/komutlar";
import type { DizinDurumu, MesajAramaSonucu } from "../api/tipler";
import { gezinme } from "../durum/gezinme.svelte";

/** Search starts at this many characters (one letter would match half the history). · Arama bu kadar karakterde başlar (tek harf geçmişin yarısını eşler). */
export const EN_AZ_KARAKTER = 2;
const BEKLEME_MS = 60;

export class MesajAramasi {
  sonuclar = $state<MesajAramaSonucu[]>([]);
  yukleniyor = $state(false);
  hata = $state(false);
  /** The query the current `sonuclar` belong to · Mevcut `sonuclar`ın ait olduğu sorgu */
  sorgu = $state("");
  dizin = $state<DizinDurumu | null>(null);

  #sira = 0;
  #zamanlayici: ReturnType<typeof setTimeout> | undefined;
  #izleyici: ReturnType<typeof setInterval> | undefined;

  /** Run (debounced) a search; an empty / short query clears the results. · (Bekletmeli) arama yap; boş / kısa sorgu sonuçları temizler. */
  ara(sorgu: string, odaId?: string) {
    clearTimeout(this.#zamanlayici);
    const s = sorgu.trim();
    const sira = ++this.#sira; // every call invalidates older answers · her çağrı eski cevapları geçersiz kılar
    if ([...s].length < EN_AZ_KARAKTER) {
      this.sonuclar = [];
      this.sorgu = "";
      this.yukleniyor = false;
      this.hata = false;
      return;
    }
    this.yukleniyor = true;
    this.#zamanlayici = setTimeout(async () => {
      try {
        // Keep the trailing space of the raw query: it tells the backend the last word is finished (no prefix match).
        // Ham sorgunun sondaki boşluğunu koru: arka uca son sözcüğün bittiğini (önek eşleşmesi yok) söyler.
        const sonuc = await mesajAra(sorgu.trimStart(), odaId, 50);
        if (sira !== this.#sira) return; // a newer search started meanwhile · bu arada daha yeni bir arama başladı
        this.sonuclar = sonuc;
        this.sorgu = s;
        this.hata = false;
      } catch (e) {
        if (sira !== this.#sira) return;
        console.error(e);
        this.hata = true;
        this.sonuclar = [];
      } finally {
        if (sira === this.#sira) this.yukleniyor = false;
      }
    }, BEKLEME_MS);
  }

  /** Poll the index status while the search UI is shown ("Dizin hazırlanıyor · N mesaj"). Returns the stop function. · Arama arayüzü görünürken dizin durumunu yokla. Durdurma fonksiyonunu döndürür. */
  durumuIzle(): () => void {
    const yokla = async () => {
      try {
        this.dizin = await dizinDurumu();
      } catch {
        /* the index is optional · dizin isteğe bağlı */
      }
    };
    void yokla();
    this.#izleyici = setInterval(yokla, 3000);
    return () => {
      clearInterval(this.#izleyici);
      this.temizle();
    };
  }

  temizle() {
    clearTimeout(this.#zamanlayici);
    this.#sira++;
    this.sonuclar = [];
    this.sorgu = "";
    this.yukleniyor = false;
  }
}

/** The result the user tapped; `OdaAramasi` (mounted inside the open room) consumes it, loads history and scrolls to it. · Kullanıcının dokunduğu sonuç; açık odanın içindeki `OdaAramasi` onu tüketir, geçmişi yükler ve kaydırır. */
class Atlama {
  hedef = $state<{ odaId: string; olayId: string } | null>(null);

  /** Open the room and ask it to jump to the event. · Odayı aç ve olaya atlamasını iste. */
  git(odaId: string, olayId: string) {
    this.hedef = { odaId, olayId };
    gezinme.odaAc(odaId);
  }
}

export const atlama = new Atlama();
