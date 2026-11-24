// Invitations and join requests (the "İstekler" screen). The numbers follow the room list, so a new invitation shows up by itself.
// Davetler ve katılma istekleri ("İstekler" ekranı). Sayılar oda listesini izler; yeni davet kendiliğinden görünür.
import { davetKabul, davetReddet, istekleriAl, katilmaIstegi, katilmaYanitla } from "../api/komutlar";
import type { Istekler as Veri } from "../api/tipler";

class Istekler {
  veri = $state.raw<Veri>({ gelen: [], giden: [], odalar: [] });
  acik = $state(false);
  yuklendi = $state(false);
  /** Keys being answered right now · Şu an yanıtlanan anahtarlar */
  suren = $state<Record<string, true>>({});
  /** Everything that waits for MY answer · BENİM yanıtımı bekleyen her şey */
  bekleyen = $derived(this.veri.gelen.length + this.veri.odalar.reduce((n, o) => n + o.kisiler.length, 0));

  ac() {
    this.acik = true;
    void this.yenile();
  }
  async yenile() {
    try {
      this.veri = (await istekleriAl()) ?? this.veri;
      this.yuklendi = true;
    } catch (e) {
      console.error(e);
    }
  }
  async #yap(anahtar: string, f: () => Promise<void>) {
    if (this.suren[anahtar]) return;
    this.suren[anahtar] = true;
    try {
      await f();
      await this.yenile();
    } finally {
      delete this.suren[anahtar];
    }
  }
  kabul = (id: string) => this.#yap(id, () => davetKabul(id));
  reddet = (id: string) => this.#yap(id, () => davetReddet(id));
  yanitla = (id: string, kisi: string, kabul: boolean) => this.#yap(id + kisi, () => katilmaYanitla(id, kisi, kabul));
  async iste(kimlik: string, via: string[], sebep: string | null) {
    await katilmaIstegi(kimlik, via, sebep);
    await this.yenile();
  }
  sifirla() {
    this.veri = { gelen: [], giden: [], odalar: [] };
    this.acik = false;
    this.yuklendi = false;
  }
}
export const istekler = new Istekler();

/** The "ask to join" sheet · "Katılma isteği gönder" sayfası */
export interface IstekHedefi { kimlik: string; ad: string; via: string[] }
export const istekSayfasi = $state<{ hedef: IstekHedefi | null }>({ hedef: null });
export const istekAc = (h: IstekHedefi) => (istekSayfasi.hedef = h);
