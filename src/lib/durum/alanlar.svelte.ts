// Navigation inside the "Alanlar" tab: a stack of the spaces the user opened (a space can hold sub-spaces). Every level is a back-button
// LAYER (gezinme.katmanAc), so the Android back button / Escape / the ← button pop exactly one level.
// "Alanlar" sekmesinin içindeki gezinme: kullanıcının açtığı alanların yığını (bir alan alt alanlar içerebilir). Her düzey bir geri tuşu
// KATMANIDIR (gezinme.katmanAc); Android geri tuşu / Escape / ← düğmesi tam bir düzeyi kapatır.
import { alanlariAl } from "../api/komutlar";
import type { AlanIcerigi, AlanOgesi } from "../api/tipler";
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
  grafik = $state.raw<AlanOgesi[] | null>(null);
  /** Last content of each opened space, so reopening one never waits · Açılmış her alanın son içeriği; yeniden açmak beklemez */
  icerikler = new Map<string, AlanIcerigi>();
  /** The same list for the folder tabs: the graph, or (before it arrives) the joined spaces of the room list · Klasör sekmeleri için aynı liste: grafik ya da (gelmeden önce) oda listesindeki katılınmış alanlar */
  ust = $derived<{ id: string; ad: string }[]>(this.grafik ? this.grafik.map((a) => ({ id: a.id, ad: a.ad })) : odalar.alanlar.map((a) => ({ id: a.id, ad: a.ad })));

  /** Refresh the graph (called when the room list changes; the caller debounces) · Grafiği yenile (oda listesi değişince çağrılır; bekletmeyi çağıran yapar) */
  #imza = "";
  #suruyor: Promise<void> | null = null;
  /**
   * Called by Sohbetler and Alanlar when the room list changed. The list is sent after almost every message, but the space graph
   * only changes when rooms come or go or a space is renamed: compare that and skip the rest (both screens are mounted together on
   * a phone, so this also stops the double call).
   * Oda listesi değişince Sohbetler ve Alanlar çağırır. Liste neredeyse her mesajdan sonra gelir, ama alan grafiği yalnızca oda
   * gelince/gidince ya da bir alanın adı değişince değişir: bunu karşılaştır, gerisini atla (telefonda iki ekran birlikte bağlı
   * olduğundan bu çift çağrıyı da önler).
   */
  listeDegisti(liste: readonly { id: string; ad: string; avatarMxc: string | null; alan: boolean; davet: boolean }[]) {
    const imza = `${liste.length}|${liste.filter((o) => o.alan && !o.davet).map((o) => `${o.id}\u0001${o.ad}\u0001${o.avatarMxc ?? ""}`).join("\u0002")}`;
    if (imza === this.#imza) return;
    this.#imza = imza;
    void this.ustYenile();
  }

  async ustYenile() {
    // One request at a time; a later call waits for the running one and then asks again. · Aynı anda tek istek; sonraki çağrı süreni bekler, sonra yeniden sorar.
    while (this.#suruyor) await this.#suruyor;
    this.#suruyor = this.#ustAl();
    try {
      await this.#suruyor;
    } finally {
      this.#suruyor = null;
    }
  }

  async #ustAl() {
    try {
      this.grafik = await alanlariAl();
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

  /** Nothing is open above the current space (a room, a sheet...) · Şu anki alanın üstünde açık bir şey yok (oda, sayfa...) */
  enUstte(): boolean {
    const k = this.#katmanlar.at(-1);
    return k !== undefined && gezinme.katmanUstteMi(k);
  }

  /** One level up (the ← button) · Bir düzey yukarı (← düğmesi) */
  geri() {
    const k = this.#katmanlar.at(-1);
    if (k !== undefined) gezinme.katmanKapat(k);
  }

  /** Closes the given space (and any sub-spaces above it) after leaving it · Ayrıldıktan sonra verilen alanı (ve üstündeki alt alanları) kapatır */
  kapatId(id: string) {
    this.icerikler.delete(id);
    const i = this.yigin.findIndex((a) => a.id === id);
    if (i < 0) return;
    while (this.yigin.length > i) this.geri();
  }

  sifirla() {
    this.#katmanlar = [];
    this.#imza = "";
    this.yigin = [];
    this.grafik = null;
    this.icerikler.clear();
  }
}

export const alanlar = new Alanlar();
