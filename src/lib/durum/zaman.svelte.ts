// Open-room timeline state. Backend sends the FULL item list on every change (simple and robust).
// Açık odanın zaman çizelgesi durumu. Arka uç her değişiklikte TÜM öğe listesini yollar (basit ve sağlam).
import { geriSayfala, mesajGonder, mesajYenidenDene, odayiAc, odayiKapat, okunduIsaretle } from "../api/komutlar";
import { acilisOlc, onYukle } from "./onYukle.svelte";
import { yaziyorGuncellendi, zamanGuncellendi } from "../api/olaylar";
import type { Hata, KisiBilgisi, OdaBilgisi, ZamanHazir, ZamanOgesi } from "../api/tipler";
import type { UnlistenFn } from "@tauri-apps/api/event";

/** The last state of the rooms opened recently: going back to one draws it in the first frame · Son açılan odaların son hâli; birine dönünce ilk karede çizilir */
interface Kayit { bilgi: OdaBilgisi | null; ogeler: ZamanOgesi[]; sabitler: string[]; sabitleyebilir: boolean }
const bellek = new Map<string, Kayit>();
const EN_COK_ODA = 12;
const EN_COK_OGE = 60;

/** Newest last; the oldest falls out · En yeni sonda; en eski düşer */
function bellekYaz(id: string, k: Kayit) {
  bellek.delete(id);
  bellek.set(id, { ...k, ogeler: k.ogeler.filter((o) => o.durum === "gonderildi").slice(-EN_COK_OGE) });
  if (bellek.size > EN_COK_ODA) bellek.delete(bellek.keys().next().value!);
}

class Zaman {
  /** What is shown came from memory; the backend's list is on its way · Gösterilen bellekten; arka ucun listesi yolda */
  onbellekten = $state(false);
  bilgi = $state<OdaBilgisi | null>(null);
  // Raw on purpose: the list is replaced as a whole, deep proxies over hundreds of messages only cost time.
  // Bilerek ham: liste bütün olarak değişir; yüzlerce mesaj üstünde derin vekiller yalnızca zaman harcar.
  ogeler = $state.raw<ZamanOgesi[]>([]);
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
    const eski = bellek.get(odaId);
    if (eski) {
      Object.assign(this, eski);
      this.onbellekten = eski.ogeler.length > 0;
    }
    this.yukleniyor = !this.onbellekten;
    this.hata = null;
    const olc = acilisOlc(this.onbellekten);
    onYukle.odaAcildi(odaId);
    this.#abone = await zamanGuncellendi((g) => {
      if (g.odaId !== this.#aktifId) return;
      this.onbellekten = false;
      this.ogeler = g.ogeler;
      olc();
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
      // Left before it finished opening: the late timeline must not stay open. · Açılmadan çıkıldı: geç gelen çizelge açık kalmasın.
      else void odayiKapat(odaId).catch(() => {});
    } catch (e) {
      if (this.#aktifId === odaId) {
        this.hata = e as Hata;
        this.yukleniyor = false;
      }
    }
  }

  async kapat() {
    const eski = this.#aktifId;
    if (eski && this.ogeler.length > 0) {
      // Upload progress and unsent echoes belong to the live list. · Yükleme ilerlemesi ve gitmemiş yankılar canlı listenindir.
      bellekYaz(eski, { bilgi: this.bilgi, ogeler: this.ogeler, sabitler: this.sabitler, sabitleyebilir: this.sabitleyebilir });
    }
    this.onbellekten = false;
    if (eski) onYukle.odaKapandi(eski);
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

  /** A room prepared in the background · Arka planda hazırlanan oda */
  hazirla(g: ZamanHazir) {
    if (g.zaman.odaId === this.#aktifId || g.zaman.ogeler.length === 0) return;
    bellekYaz(g.zaman.odaId, { bilgi: g.bilgi, ogeler: g.zaman.ogeler, sabitler: g.zaman.sabitler, sabitleyebilir: g.zaman.sabitleyebilir });
  }

  /** Forget everything (logout) · Her şeyi unut (çıkış) */
  bellekSil() {
    bellek.clear();
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
