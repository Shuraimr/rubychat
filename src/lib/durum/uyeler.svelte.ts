// Member lists and my permissions, cached per room (members screen, user card and ban dialog share it). The backend does the real checks;
// this only decides what the UI shows (buttons the user may not use are HIDDEN, not disabled).
// Üye listeleri ve kendi yetkilerim, oda başına önbellekli (üyeler ekranı, kullanıcı kartı ve yasaklama penceresi paylaşır). Gerçek denetimi
// arka uç yapar; bu yalnızca arayüzün neyi göstereceğine karar verir (kullanıcının kullanamayacağı düğmeler devre dışı değil GİZLENİR).
import { benimYetkilerim, gucAyarla, uyeCikar, uyeDavetEt, uyeleriListele, uyeYasakla, yasakKaldir } from "../api/komutlar";
import type { BenimYetkilerim, Uye } from "../api/tipler";

interface OdaUyeleri {
  liste: Uye[];
  yetki: BenimYetkilerim | null;
  yukleniyor: boolean;
  hata: boolean;
}

class Uyeler {
  odalar = $state<Record<string, OdaUyeleri>>({});

  al(odaId: string): OdaUyeleri {
    return this.odalar[odaId] ?? { liste: [], yetki: null, yukleniyor: false, hata: false };
  }

  async yukle(odaId: string) {
    const eski = this.odalar[odaId] ?? { liste: [], yetki: null, yukleniyor: false, hata: false };
    this.odalar[odaId] = { ...eski, yukleniyor: true, hata: false };
    try {
      const [liste, yetki] = await Promise.all([uyeleriListele(odaId), benimYetkilerim(odaId)]);
      this.odalar[odaId] = { liste, yetki, yukleniyor: false, hata: false };
    } catch (e) {
      console.error(e);
      this.odalar[odaId] = { ...eski, yukleniyor: false, hata: true };
    }
  }

  uye(odaId: string, kullaniciId: string): Uye | undefined {
    return this.odalar[odaId]?.liste.find((u) => u.kullaniciId === kullaniciId);
  }

  // ---- What may I do to this person? (the target must have a LOWER power level than me) · Bu kişiye ne yapabilirim? (hedefin gücü benimkinden DÜŞÜK olmalı) ----
  atabilir(odaId: string, u: Uye): boolean {
    const y = this.odalar[odaId]?.yetki;
    return !!y && y.atabilir && u.uyelik === "join" && u.guc < y.guc;
  }
  yasaklayabilir(odaId: string, u: Uye): boolean {
    const y = this.odalar[odaId]?.yetki;
    return !!y && y.yasaklayabilir && u.uyelik !== "ban" && u.guc < y.guc;
  }
  yasagiKaldirabilir(odaId: string, u: Uye): boolean {
    const y = this.odalar[odaId]?.yetki;
    return !!y && y.yasaklayabilir && u.uyelik === "ban";
  }
  gucDegistirebilir(odaId: string, u: Uye): boolean {
    const y = this.odalar[odaId]?.yetki;
    return !!y && y.gucDegistirebilir && u.uyelik === "join" && u.guc < y.guc;
  }
  susturulmus(odaId: string, u: Uye): boolean {
    const y = this.odalar[odaId]?.yetki;
    return !!y && u.guc < y.yazmaEsigi;
  }

  async cikar(odaId: string, id: string, sebep?: string) {
    await uyeCikar(odaId, id, sebep);
    await this.yukle(odaId);
  }
  async yasakla(odaId: string, id: string, sebep: string | undefined, mesajlariSil: boolean): Promise<number> {
    const n = await uyeYasakla(odaId, id, sebep, mesajlariSil);
    await this.yukle(odaId);
    return n;
  }
  async yasagiKaldir(odaId: string, id: string) {
    await yasakKaldir(odaId, id);
    await this.yukle(odaId);
  }
  async guc(odaId: string, id: string, guc: number) {
    await gucAyarla(odaId, id, guc);
    await this.yukle(odaId);
  }
  async davet(odaId: string, id: string) {
    await uyeDavetEt(odaId, id);
    await this.yukle(odaId);
  }
}
export const uyeler = new Uyeler();

/** Role name for a power level · Yetki düzeyi için rol adı */
export const rolAdi = (guc: number): "yonetici" | "moderator" | "uye" => (guc >= 100 ? "yonetici" : guc >= 50 ? "moderator" : "uye");
