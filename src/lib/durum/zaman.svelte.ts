// Open-room timeline state. Backend sends the FULL item list on every change (simple and robust).
// Açık odanın zaman çizelgesi durumu. Arka uç her değişiklikte TÜM öğe listesini yollar (basit ve sağlam).
import { geriSayfala, mesajGonder, mesajYenidenDene, odayiAc, odayiKapat, okunduIsaretle } from "../api/komutlar";
import { yaziyorGuncellendi, zamanGuncellendi } from "../api/olaylar";
import type { Hata, KisiBilgisi, OdaBilgisi, ZamanOgesi } from "../api/tipler";
import type { UnlistenFn } from "@tauri-apps/api/event";

class Zaman {
  bilgi = $state<OdaBilgisi | null>(null);
  ogeler = $state<ZamanOgesi[]>([]);
  basaUlasildi = $state(false);
  yukleniyor = $state(false);
  eskiYukleniyor = $state(false);
  hata = $state<Hata | null>(null);
  /** Event ids pinned in this room, and whether I may change them · Bu odada sabitli olay kimlikleri ve değiştirmeye yetkim olup olmadığı */
  sabitler = $state<string[]>([]);
  sabitleyebilir = $state(false);
  /** The OTHER people typing right now · Şu an yazan DİĞER kişiler */
  yazanlar = $state<KisiBilgisi[]>([]);

  #aktifId: string | null = null;
  #abone: UnlistenFn | null = null;
  #yaziyorAbone: UnlistenFn | null = null;

  async ac(odaId: string) {
    if (this.#aktifId === odaId) return;
    await this.kapat();
    // Set the id BEFORE invoking so early events are not dropped. · Erken gelen olaylar kaçmasın diye kimliği çağrıdan ÖNCE yazarız.
    this.#aktifId = odaId;
    this.yukleniyor = true;
    this.hata = null;
    this.#abone = await zamanGuncellendi((g) => {
      if (g.odaId !== this.#aktifId) return;
      this.ogeler = g.ogeler;
      this.basaUlasildi = g.basaUlasildi;
      this.sabitler = g.sabitler;
      this.sabitleyebilir = g.sabitleyebilir;
      this.eskiYukleniyor = false;
      this.yukleniyor = false;
    });
    this.#yaziyorAbone = await yaziyorGuncellendi((g) => {
      if (g.odaId === this.#aktifId) this.yazanlar = g.kisiler;
    });
    try {
      const bilgi = await odayiAc(odaId);
      if (this.#aktifId === odaId) this.bilgi = bilgi;
    } catch (e) {
      if (this.#aktifId === odaId) {
        this.hata = e as Hata;
        this.yukleniyor = false;
      }
    }
  }

  async kapat() {
    const eski = this.#aktifId;
    this.#aktifId = null;
    this.#abone?.();
    this.#abone = null;
    this.#yaziyorAbone?.();
    this.#yaziyorAbone = null;
    this.bilgi = null;
    this.ogeler = [];
    this.sabitler = [];
    this.sabitleyebilir = false;
    this.yazanlar = [];
    this.basaUlasildi = false;
    this.yukleniyor = false;
    this.eskiYukleniyor = false;
    this.hata = null;
    if (eski) {
      try {
        await odayiKapat(eski);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async eskileriYukle() {
    if (!this.#aktifId || this.eskiYukleniyor || this.basaUlasildi) return;
    this.eskiYukleniyor = true;
    try {
      await geriSayfala(this.#aktifId);
    } catch (e) {
      console.error(e);
      this.eskiYukleniyor = false;
    }
  }

  /** Sends text; `html` = formatted body, `yanitOlayId` = reply target · Metin yollar; `html` = biçimli gövde, `yanitOlayId` = yanıtlanan mesaj */
  async gonder(metin: string, html: string | null = null, yanitOlayId: string | null = null) {
    if (!this.#aktifId) return;
    await mesajGonder({ odaId: this.#aktifId, metin, html, yanitOlayId });
  }

  async yenidenDene(ogeId: string) {
    if (!this.#aktifId) return;
    await mesajYenidenDene(this.#aktifId, ogeId);
  }

  async okundu() {
    if (!this.#aktifId) return;
    try {
      await okunduIsaretle(this.#aktifId);
    } catch (e) {
      console.error(e);
    }
  }
}

export const zaman = new Zaman();
