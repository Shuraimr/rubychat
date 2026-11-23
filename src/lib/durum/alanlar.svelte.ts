// Navigation inside the "Alanlar" tab: a stack of the spaces the user opened (a space can hold sub-spaces). Every level is a back-button
// LAYER (gezinme.katmanAc), so the Android back button / Escape / the ← button pop exactly one level.
// "Alanlar" sekmesinin içindeki gezinme: kullanıcının açtığı alanların yığını (bir alan alt alanlar içerebilir). Her düzey bir geri tuşu
// KATMANIDIR (gezinme.katmanAc); Android geri tuşu / Escape / ← düğmesi tam bir düzeyi kapatır.
import { alanlariAl } from "../api/komutlar";
import type { AlanOgesi } from "../api/tipler";
import { gezinme } from "./gezinme.svelte";
import { odalar } from "./odalar.svelte";

export interface AlanAdimi {
  id: string;
  /** Name we already know, shown in the header while the content loads · Bildiğimiz ad; içerik yüklenirken başlıkta görünür */
  ad: string;
}

class Alanlar {
  yigin = $state<AlanAdimi[]>([]);
  /** Top-level joined spaces (not inside another joined space), from the space graph; null until it arrived · Üst düzey katılınmış alanlar (başka bir katılmış alanın içinde olmayanlar), alan grafiğinden; gelene dek null */
  #grafik = $state<AlanOgesi[] | null>(null);
  /** The same list for the folder tabs: the graph, or (before it arrives) the joined spaces of the room list · Klasör sekmeleri için aynı liste: grafik ya da (gelmeden önce) oda listesindeki katılınmış alanlar */
  ust = $derived<{ id: string; ad: string }[]>(this.#grafik ? this.#grafik.map((a) => ({ id: a.id, ad: a.ad })) : odalar.alanlar.map((a) => ({ id: a.id, ad: a.ad })));

  /** Refresh the graph (called when the room list changes; the caller debounces) · Grafiği yenile (oda listesi değişince çağrılır; bekletmeyi çağıran yapar) */
  async ustYenile() {
    try {
      this.#grafik = await alanlariAl();
    } catch (e) {
      console.error(e);
    }
  }
  #katmanlar: number[] = [];

  /** The space currently shown, or null = the list of top-level spaces · Şu an gösterilen alan; null = üst düzey alanların listesi */
  get gecerli(): AlanAdimi | null {
    return this.yigin.at(-1) ?? null;
  }

  ac(id: string, ad: string) {
    this.yigin = [...this.yigin, { id, ad }];
    // The layer's close callback runs for both the back button and our own ← (which asks the layer to close).
    // Katmanın kapatma işlevi hem geri tuşunda hem kendi ← düğmemizde (katmandan kapanmasını isteriz) çalışır.
    this.#katmanlar.push(
      gezinme.katmanAc(() => {
        this.#katmanlar.pop();
        this.yigin = this.yigin.slice(0, -1);
      }),
    );
  }

  /** One level up (the ← button) · Bir düzey yukarı (← düğmesi) */
  geri() {
    const k = this.#katmanlar.at(-1);
    if (k !== undefined) gezinme.katmanKapat(k);
  }

  sifirla() {
    this.#katmanlar = [];
    this.yigin = [];
  }
}

export const alanlar = new Alanlar();
