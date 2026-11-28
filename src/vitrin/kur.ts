// Showcase mode ("vitrin") IPC mock: for local development and README screenshots only, never bundled into release builds.
// Vitrin kipi IPC taklidi: yalnızca geliştirme ve README görselleri içindir, yayına girmez.
import type { InvokeArgs } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type {
  DogrulamaDurumu,
  MesajAramaSonucu,
  MesajGonderIstegi,
  MesajParcasi,
  OnizlemeMesaji,
  SifrelemeDurumu,
  ZamanGuncelleme,
  ZamanOgesi,
} from "../lib/api/tipler";
import type { YerelDurum } from "../lib/arama-ec/tipler";
import { vitrinVerisiOlustur } from "./veri";

const SURUM = "0.1.0-beta.10";

const SIFRELEME_HAZIR: SifrelemeDurumu = {
  caprazImza: "hazir",
  cihazDogrulandi: true,
  yedek: "acik",
  kurtarma: "hazir",
  parolaGerekli: false,
};

const DOGRULAMA_YOK: DogrulamaDurumu = {
  asama: "yok",
  digerCihaz: null,
  emojiler: [],
  neden: null,
};

const veri = vitrinVerisiOlustur();
let yerelSira = 1;

type VitrinAramaKipi = "izgara" | "izleme" | "paylasim" | "koptu";

// Optional showcase call preview (?vitrin&arama=izgara|izleme|paylasim|koptu) to verify call layouts without a backend.
// Arka uç olmadan arama düzenlerini doğrulamak için isteğe bağlı vitrin arama önizlemesi.
const vitrinAramaKipi: VitrinAramaKipi | null = (() => {
  if (typeof location === "undefined") return null;
  const v = new URLSearchParams(location.search).get("arama");
  return v === "izgara" || v === "izleme" || v === "paylasim" || v === "koptu" ? v : null;
})();

let sonYerelDurum: YerelDurum | null = null;

/** Build one static 64x36 I420 dark frame so YerelVideo renders cleanly without spinning in showcase mode. */
/** YerelVideo'nun vitrinde boş döngüye girmeden temiz çizmesi için tek bir sabit 64x36 I420 koyu kare üretir. */
function vitrinKareUret(): ArrayBuffer {
  const g = 64;
  const h = 36;
  const cg = g >> 1;
  const ch = h >> 1;
  const buf = new ArrayBuffer(12 + g * h + 2 * cg * ch);
  const dv = new DataView(buf);
  dv.setUint32(0, 1, true);
  dv.setUint32(4, g, true);
  dv.setUint32(8, h, true);
  const y = new Uint8Array(buf, 12, g * h);
  y.fill(38);
  // Subtle top bar so the shared screen looks like an application window. · Paylaşılan ekran bir uygulama penceresi gibi görünsün diye hafif üst çubuk.
  y.fill(54, 0, g * 4);
  new Uint8Array(buf, 12 + g * h, cg * ch).fill(132);
  new Uint8Array(buf, 12 + g * h + cg * ch, cg * ch).fill(126);
  return buf;
}

function vitrinAramaDurumuOlustur(odaId: string, kip: VitrinAramaKipi): YerelDurum {
  const izleme = kip === "izleme";
  const paylasim = kip === "paylasim";
  return {
    odaId,
    asama: kip === "koptu" ? "koptu" : "acik",
    neden: null,
    mikrofonKapali: false,
    paylasim: paylasim ? "acik" : "yok",
    paylasilan: paylasim ? ["Helium"] : [],
    paylasimHatasi: false,
    onizleme: paylasim ? "ben|ekran-onizleme" : null,
    yayin: paylasim ? { durum: "yayinda", kbps: 1400, kareHizi: 30, genislik: 1920, yukseklik: 1080 } : null,
    katilimcilar: [
      {
        uye: "vitrin-ben",
        kullaniciId: veri.ben.kullaniciId,
        ad: "Sen",
        avatarMxc: null,
        ben: true,
        susturulmus: false,
        konusuyor: false,
        ekran: null,
        kamera: null,
        sesler: [{ anahtar: "ben|mik", tur: "mikrofon", ad: null, duzey: 1 }],
        sorun: null,
      },
      {
        uye: "vitrin-ece",
        kullaniciId: `@ece2:${veri.sunucu}`,
        ad: "Ece",
        avatarMxc: null,
        ben: false,
        susturulmus: false,
        konusuyor: true,
        ekran: izleme ? "vitrin|ekran" : null,
        kamera: null,
        sesler: [
          { anahtar: "ece|mik", tur: "mikrofon", ad: null, duzey: 1 },
          ...(izleme ? [{ anahtar: "ece|helium", tur: "uygulama" as const, ad: "Helium", duzey: 0.8 }] : []),
        ],
        sorun: null,
      },
      {
        uye: "vitrin-mert",
        kullaniciId: `@mert:${veri.sunucu}`,
        ad: "Mert",
        avatarMxc: null,
        ben: false,
        susturulmus: true,
        konusuyor: false,
        ekran: null,
        kamera: null,
        sesler: [{ anahtar: "mert|mik", tur: "mikrofon", ad: null, duzey: 1 }],
        sorun: null,
      },
      {
        uye: "vitrin-deniz",
        kullaniciId: `@deniz:${veri.sunucu}`,
        ad: "Deniz",
        avatarMxc: null,
        ben: false,
        susturulmus: false,
        konusuyor: false,
        ekran: null,
        kamera: null,
        sesler: [{ anahtar: "deniz|mik", tur: "mikrofon", ad: null, duzey: 1 }],
        sorun: "dogrulanmamis",
      },
    ],
  };
}

function yerelDurumYayinla(durum: YerelDurum) {
  sonYerelDurum = durum;
  queueMicrotask(() => {
    void emit("yerel-arama", durum);
  });
}

function argNesne(payload?: InvokeArgs): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function zamanYuk(odaId: string): ZamanGuncelleme {
  return {
    odaId,
    ogeler: [...(veri.zamanlar[odaId] ?? [])],
    basaUlasildi: true,
    sabitler: (veri.sabitler[odaId] ?? []).map((s) => s.olayId),
    sabitleyebilir: true,
  };
}

function zamanYayinla(odaId: string) {
  queueMicrotask(() => {
    void emit("zaman-guncellendi", zamanYuk(odaId));
    const yazan = veri.yazanlar[odaId] ?? [];
    if (yazan.length > 0) void emit("yaziyor-guncellendi", { odaId, kisiler: yazan });
  });
}

function odalariYayinla() {
  queueMicrotask(() => {
    void emit("odalar-guncellendi", [...veri.odalar]);
  });
}

function odaBul(odaId: string) {
  return veri.odalar.find((o) => o.id === odaId);
}

function metinAra(sorgu: string, odaId: string | null, sinir: number): MesajAramaSonucu[] {
  const aranan = sorgu.trim().toLowerCase();
  if (!aranan) return [];
  const sonuclar: MesajAramaSonucu[] = [];
  const odalar = odaId ? [odaId] : Object.keys(veri.zamanlar);
  for (const id of odalar) {
    for (const o of veri.zamanlar[id] ?? []) {
      if (!o.metin || !o.olayId) continue;
      const i = o.metin.toLowerCase().indexOf(aranan);
      if (i < 0) continue;
      const parcalar: MesajParcasi[] = [];
      if (i > 0) parcalar.push({ metin: o.metin.slice(0, i), vurgu: false });
      parcalar.push({ metin: o.metin.slice(i, i + aranan.length), vurgu: true });
      if (i + aranan.length < o.metin.length) parcalar.push({ metin: o.metin.slice(i + aranan.length), vurgu: false });
      sonuclar.push({
        olayId: o.olayId,
        odaId: id,
        gonderen: o.gonderen,
        gonderenAd: o.gonderenAd,
        zaman: o.zaman,
        parcalar,
      });
      if (sonuclar.length >= sinir) return sonuclar;
    }
  }
  return sonuclar;
}

function isleyici(komut: string, payload?: InvokeArgs): unknown {
  const arg = argNesne(payload);

  switch (komut) {
    // ---- Session & account · Oturum ve hesap ----
    case "oturumu_geri_yukle":
    case "ben":
    case "giris":
    case "cihaz_girisi_bekle":
      return veri.ben;
    case "hesaplari_al":
      return {
        aktif: "vitrin-ece",
        liste: [
          {
            id: "vitrin-ece",
            kullaniciId: veri.ben.kullaniciId,
            sunucu: veri.ben.sunucu,
            ad: veri.ben.gorunenAd,
            avatarMxc: null,
          },
        ],
      };
    case "hesap_degistir":
    case "cikis":
    case "profil_ad_ayarla":
    case "profil_avatar_kaldir":
    case "cihaz_yeniden_adlandir":
    case "cihaz_cikis":
    case "yedek_ayarla":
    case "sifre_degistir":
    case "eposta_sil":
    case "hesap_kapat":
    case "cihaz_girisi_iptal":
    case "kayit_penceresi_ac":
    case "kayit_penceresi_kapat":
      return null;
    case "profil_avatar_ayarla":
    case "kurtarma_sifirla":
    case "cikartma_paketine_ekle":
      return "";
    case "oturumlar_listele":
      return veri.cihazlar;
    case "hesap_bilgisi":
      return veri.hesapBilgisi;
    case "epostalar_listele":
      return [{ adres: `ece@${veri.sunucu}`, dogrulandi: true }];
    case "cihaz_girisi_baslat":
      return { kod: "VITR-2026", adres: `https://${veri.sunucu}`, kodYazilir: false, saniye: 300 };

    // ---- Room list & sync · Oda listesi ve eşitleme ----
    case "odalari_al":
      return [...veri.odalar];
    case "esitleme_durumu":
      return veri.esitleme;
    case "oda_sabitle": {
      const o = odaBul(String(arg.odaId ?? ""));
      if (o) {
        o.sabit = Boolean(arg.sabit);
        odalariYayinla();
      }
      return null;
    }
    case "okundu_isaretle": {
      const o = odaBul(String(arg.odaId ?? ""));
      if (o && (o.okunmamis > 0 || o.bahsedilme > 0)) {
        o.okunmamis = 0;
        o.bahsedilme = 0;
        odalariYayinla();
      }
      return null;
    }
    case "odalari_hazirla":
      return null;

    // ---- Timeline · Zaman akışı ----
    case "odayi_ac": {
      const odaId = String(arg.odaId ?? "");
      const bilgi = veri.bilgiler[odaId] ?? {
        id: odaId,
        ad: odaBul(odaId)?.ad ?? odaId,
        avatarHarf: (odaBul(odaId)?.ad ?? "#").charAt(0).toUpperCase(),
        sifreli: false,
        uyeSayisi: 2,
        avatarMxc: null,
        karsiKullanici: null,
      };
      zamanYayinla(odaId);
      return bilgi;
    }
    case "odayi_kapat":
    case "geri_sayfala":
    case "yaziyor_bildir":
    case "mesaj_yeniden_dene":
    case "anket_olustur":
    case "anket_oy_ver":
    case "anket_bitir":
    case "mesaj_ilet":
    case "cikartma_gonder":
      return null;
    case "oda_onizleme": {
      const odaId = String(arg.odaId ?? "");
      const adet = typeof arg.adet === "number" ? arg.adet : 20;
      const ogeler = veri.zamanlar[odaId];
      if (!ogeler) return (veri.kesifOnizlemeler[odaId] ?? []).slice(-adet);
      const sonuc: OnizlemeMesaji[] = ogeler
        .filter((o) => o.olayId && o.metin)
        .slice(-adet)
        .map((o) => ({
          olayId: o.olayId!,
          gonderen: o.gonderen,
          gonderenAd: o.gonderenAd,
          kendi: o.kendi,
          zaman: o.zaman,
          metin: o.metin!,
          tur: "metin",
        }));
      return sonuc;
    }
    case "mesaj_gonder": {
      const istek = arg.istek as MesajGonderIstegi | undefined;
      if (!istek?.odaId) return null;
      const yeniId = `$vitrin-${++yerelSira}`;
      const simdi = Date.now();
      const liste = (veri.zamanlar[istek.odaId] ??= []);
      const yanitHedef = istek.yanitOlayId ? liste.find((o) => o.olayId === istek.yanitOlayId) : null;
      const yeni: ZamanOgesi = {
        id: yeniId,
        gonderen: veri.ben.kullaniciId,
        gonderenAd: veri.ben.gorunenAd ?? "Ece",
        kendi: true,
        zaman: simdi,
        tur: "metin",
        metin: istek.metin,
        durum: "gonderildi",
        gonderenAvatarMxc: null,
        arama: null,
        medya: null,
        olayId: yeniId,
        html: istek.html,
        duzenlendi: false,
        tepkiler: [],
        yanit: yanitHedef
          ? {
              olayId: yanitHedef.olayId!,
              gonderen: yanitHedef.gonderen,
              gonderenAd: yanitHedef.gonderenAd,
              metin: yanitHedef.metin,
              yukleniyor: false,
            }
          : null,
        okuyanlar: [],
        anket: null,
        silinebilir: true,
        sabit: false,
        duzenlenebilir: true,
      };
      liste.push(yeni);
      const o = odaBul(istek.odaId);
      if (o) {
        o.sonMesaj = o.dm ? istek.metin : `${veri.ben.gorunenAd ?? "Ece"}: ${istek.metin}`;
        o.sonZaman = simdi;
        odalariYayinla();
      }
      zamanYayinla(istek.odaId);
      return null;
    }
    case "tepki_degistir": {
      const odaId = String(arg.odaId ?? "");
      const olayId = String(arg.olayId ?? "");
      const anahtar = String(arg.anahtar ?? "");
      const oge = (veri.zamanlar[odaId] ?? []).find((x) => x.olayId === olayId);
      if (!oge || !anahtar) return false;
      const mevcut = oge.tepkiler.find((t) => t.anahtar === anahtar);
      let eklendi = false;
      if (mevcut?.benim) {
        mevcut.benim = false;
        mevcut.sayi = Math.max(0, mevcut.sayi - 1);
        mevcut.kisiler = mevcut.kisiler.filter((k) => k.id !== veri.ben.kullaniciId);
        oge.tepkiler = oge.tepkiler.filter((t) => t.sayi > 0);
      } else if (mevcut) {
        mevcut.benim = true;
        mevcut.sayi += 1;
        mevcut.kisiler = [...mevcut.kisiler, { id: veri.ben.kullaniciId, ad: veri.ben.gorunenAd ?? "Ece", avatarMxc: null }];
        eklendi = true;
      } else {
        oge.tepkiler = [
          ...oge.tepkiler,
          {
            anahtar,
            sayi: 1,
            benim: true,
            kisiler: [{ id: veri.ben.kullaniciId, ad: veri.ben.gorunenAd ?? "Ece", avatarMxc: null }],
          },
        ];
        eklendi = true;
      }
      zamanYayinla(odaId);
      return eklendi;
    }
    case "mesaj_sil": {
      const odaId = String(arg.odaId ?? "");
      const olayId = String(arg.olayId ?? "");
      const oge = (veri.zamanlar[odaId] ?? []).find((x) => x.olayId === olayId);
      if (oge) {
        oge.tur = "silindi";
        oge.metin = null;
        oge.html = null;
        oge.silinebilir = false;
        oge.duzenlenebilir = false;
        zamanYayinla(odaId);
      }
      return null;
    }
    case "mesaj_duzenle": {
      const odaId = String(arg.odaId ?? "");
      const olayId = String(arg.olayId ?? "");
      const oge = (veri.zamanlar[odaId] ?? []).find((x) => x.olayId === olayId);
      if (oge) {
        oge.metin = String(arg.metin ?? "");
        oge.html = typeof arg.html === "string" ? arg.html : null;
        oge.duzenlendi = true;
        zamanYayinla(odaId);
      }
      return null;
    }
    case "mesaj_sabitle": {
      const odaId = String(arg.odaId ?? "");
      const olayId = String(arg.olayId ?? "");
      const sabitle = Boolean(arg.sabitle);
      const liste = (veri.sabitler[odaId] ??= []);
      const oge = (veri.zamanlar[odaId] ?? []).find((x) => x.olayId === olayId);
      if (sabitle && !liste.some((s) => s.olayId === olayId)) {
        liste.push({ olayId, gonderenAd: oge?.gonderenAd ?? null, metin: oge?.metin ?? null });
      } else if (!sabitle) {
        veri.sabitler[odaId] = liste.filter((s) => s.olayId !== olayId);
      }
      if (oge) oge.sabit = sabitle;
      zamanYayinla(odaId);
      return null;
    }
    case "sabit_mesajlar":
      return [...(veri.sabitler[String(arg.odaId ?? "")] ?? [])];

    // ---- Search · Arama ----
    case "mesaj_ara":
      return metinAra(
        String(arg.sorgu ?? ""),
        typeof arg.odaId === "string" ? arg.odaId : null,
        typeof arg.sinir === "number" ? arg.sinir : 40,
      );
    case "dizin_durumu": {
      const belgeSayisi = Object.values(veri.zamanlar).reduce((n, l) => n + l.filter((o) => o.olayId).length, 0);
      return { belgeSayisi, dolduruluyor: false };
    }
    case "olaya_git": {
      const odaId = String(arg.odaId ?? "");
      const olayId = String(arg.olayId ?? "");
      return (veri.zamanlar[odaId] ?? []).some((o) => o.olayId === olayId);
    }

    // ---- Members, presence & room settings · Üyeler, varlık ve oda ayarları ----
    case "uyeleri_listele":
      return [...(veri.uyeler[String(arg.odaId ?? "")] ?? [])];
    case "benim_yetkilerim":
      return veri.yetkiler[String(arg.odaId ?? "")] ?? {
        guc: 0,
        atmaEsigi: 50,
        yasaklamaEsigi: 50,
        davetEsigi: 0,
        yazmaEsigi: 0,
        gucEsigi: 100,
        atabilir: false,
        yasaklayabilir: false,
        davetEdebilir: true,
        gucDegistirebilir: false,
        odayiBildirebilir: false,
      };
    case "varlik_durumu": {
      const id = String(arg.kullaniciId ?? "");
      return veri.varliklar[id] ?? { durum: "cevrimdisi", sonEtkinlikMs: 3 * 3_600_000 };
    }
    case "emoji_paketleri":
      return [];
    case "uye_davet_et":
    case "uye_cikar":
    case "yasak_kaldir":
    case "guc_ayarla":
    case "oda_ayril":
      return null;
    case "uye_yasakla":
      return 0;
    case "oda_olustur":
      return veri.odalar[0]?.id ?? `!yeni:${veri.sunucu}`;
    case "dm_ac": {
      const kisi = String(arg.kullaniciId ?? "");
      const dm = Object.values(veri.bilgiler).find((b) => b.karsiKullanici === kisi);
      return dm?.id ?? veri.odalar[0]?.id ?? `!dm:${veri.sunucu}`;
    }
    case "oda_ayarlari": {
      const odaId = String(arg.odaId ?? "");
      return veri.ayarlar[odaId] ?? {
        ad: odaBul(odaId)?.ad ?? odaId,
        konu: "",
        avatarMxc: null,
        adres: null,
        katilim: "davet",
        katilimAlani: null,
        dizinde: false,
        duyuru: false,
        sifreli: false,
        alan: false,
        adDegistirebilir: false,
        konuDegistirebilir: false,
        avatarDegistirebilir: false,
        katilimDegistirebilir: false,
        gucDegistirebilir: false,
      };
    }
    case "oda_ayarlarini_yaz":
    case "oda_avatar_kaldir":
      return null;
    case "oda_avatar_ayarla":
      return "";

    // ---- Spaces & directory · Alanlar ve keşfet ----
    case "alanlari_al":
      return [...veri.alanlar];
    case "alan_icerigi": {
      const alanId = String(arg.alanId ?? "");
      return veri.alanIcerikleri[alanId] ?? { alan: null, cocuklar: [] };
    }
    case "alan_yetkim":
      return { cocukYonetebilir: false, ayarDegistirebilir: false, davetEdebilir: true };
    case "eklenebilir_odalar":
      return [];
    case "alana_oda_ekle":
      return 0;
    case "alana_katil": {
      const kimlik = String(arg.kimlik ?? "");
      const kesif = veri.kesifOdalar.find((o) => o.odaId === kimlik || o.adres === kimlik);
      if (kesif) {
        kesif.uye = true;
        const ad = kesif.ad ?? kesif.adres ?? kesif.odaId;
        const harf = ad.replace(/^[#!]/, "").charAt(0).toUpperCase() || "#";
        const oniz = veri.kesifOnizlemeler[kesif.odaId] ?? [];
        const son = oniz.at(-1);
        if (!odaBul(kesif.odaId)) {
          veri.odalar.unshift({
            id: kesif.odaId,
            takmaAd: kesif.adres,
            ad,
            avatarHarf: harf,
            avatarMxc: kesif.avatarMxc,
            sonMesaj: son ? `${son.gonderenAd}: ${son.metin}` : null,
            sonZaman: son?.zaman ?? Date.now(),
            okunmamis: 0,
            bahsedilme: 0,
            sifreli: false,
            dm: false,
            davet: false,
            alan: kesif.alan,
            sabit: false,
          });
        }
        if (!kesif.alan && !veri.bilgiler[kesif.odaId]) {
          veri.bilgiler[kesif.odaId] = {
            id: kesif.odaId,
            ad,
            avatarHarf: harf,
            sifreli: false,
            uyeSayisi: kesif.uyeSayisi + 1,
            avatarMxc: kesif.avatarMxc,
            karsiKullanici: null,
          };
        }
        if (!kesif.alan && !veri.zamanlar[kesif.odaId] && oniz.length > 0) {
          veri.zamanlar[kesif.odaId] = oniz.map((m) => ({
            id: m.olayId,
            gonderen: m.gonderen,
            gonderenAd: m.gonderenAd,
            kendi: m.kendi,
            zaman: m.zaman,
            tur: "metin",
            metin: m.metin,
            durum: "gonderildi",
            gonderenAvatarMxc: null,
            arama: null,
            medya: null,
            olayId: m.olayId,
            html: null,
            duzenlendi: false,
            tepkiler: [],
            yanit: null,
            okuyanlar: [],
            anket: null,
            silinebilir: false,
            sabit: false,
            duzenlenebilir: false,
          }));
        }
        odalariYayinla();
        return kesif.odaId;
      }
      return kimlik || veri.odalar[0]?.id || `!yeni:${veri.sunucu}`;
    }
    case "alanda_oda_olustur":
      return String(arg.kimlik ?? veri.odalar[0]?.id ?? `!yeni:${veri.sunucu}`);
    case "alandan_cikar":
    case "alan_one_cikar":
      return null;
    case "baglanti_onizle": {
      const kimlik = String(arg.kimlik ?? "");
      return (
        veri.kesifOdalar.find((o) => o.odaId === kimlik || o.adres === kimlik) ?? {
          odaId: kimlik,
          adres: kimlik.startsWith("#") ? kimlik : null,
          ad: kimlik,
          konu: null,
          avatarMxc: null,
          uyeSayisi: 1,
          katilim: "acik",
          alan: false,
          uye: false,
        }
      );
    }
    case "bekleyen_baglantilari_al":
      return [];
    case "kullanici_ara": {
      const q = String(arg.sorgu ?? "").trim().toLowerCase();
      if (!q) return veri.kisiler.slice(0, 8);
      return veri.kisiler.filter(
        (k) => k.kullaniciId.toLowerCase().includes(q) || (k.ad ?? "").toLowerCase().includes(q),
      );
    }
    case "odalari_kesfet": {
      const q = String(arg.sorgu ?? "").trim().toLowerCase();
      const tur = String(arg.tur ?? "");
      const sunucu = typeof arg.sunucu === "string" && arg.sunucu.trim() ? arg.sunucu.trim() : veri.sunucu;
      const odalar = veri.kesifOdalar.filter((o) => {
        if (tur === "oda" && o.alan) return false;
        if (tur === "alan" && !o.alan) return false;
        if (!q) return true;
        return (
          (o.ad ?? "").toLowerCase().includes(q) ||
          (o.adres ?? "").toLowerCase().includes(q) ||
          (o.konu ?? "").toLowerCase().includes(q)
        );
      });
      return { odalar, sonraki: null, sunucu };
    }

    // ---- Requests, encryption, notifications, updates, calls, media ----
    // ---- İstekler, şifreleme, bildirimler, güncellemeler, aramalar, medya ----
    case "istekleri_al":
      return { gelen: [], giden: [], odalar: [] };
    case "davet_kabul":
    case "davet_reddet":
    case "katilma_istegi":
    case "katilma_yanitla":
    case "dil_ayarla":
      return null;
    case "sifreleme_durumu":
      return SIFRELEME_HAZIR;
    case "dogrulama_durumu":
      return DOGRULAMA_YOK;
    case "kurtarma_olustur":
      return "EsTt V1TR 1N00 K0D0 0000 0000";
    case "capraz_imza_kur":
    case "kurtarma_kurtar":
    case "dogrulama_baslat":
    case "dogrulama_kabul_et":
    case "dogrulama_onayla":
    case "dogrulama_eslesmiyor":
    case "dogrulama_iptal":
      return null;
    case "medya_yetenekleri":
      return { videoSikistirma: false, sistemBildirimi: false };
    case "medya_parca_yaz":
      return `vitrin-dosya-${++yerelSira}`;
    case "medya_temizle":
    case "medya_gonder":
    case "medya_gonderimi_iptal":
    case "video_sikistirmayi_iptal":
      return null;
    case "video_sikistir":
      return { kimlik: "vitrin-video", boyut: 0, genislik: 0, yukseklik: 0, sureMs: 0 };
    case "medya_kaydet":
      return "";
    case "bildirim_izni_durumu":
    case "bildirim_izni_iste":
      return "verildi";
    case "bildirim_bekleyen_oda":
    case "bildirim_ayarlarini_ac":
    case "uygulama_arka_planda":
    case "masaustu_arka_plan":
    case "uygulamadan_cik":
    case "kamera_penceresi":
      return null;
    case "arama_turn_sunuculari":
    case "ec_aktif_aramalar":
      return [];
    case "yerel_arama_uygulamalar":
      return vitrinAramaKipi ? ["Helium", "Firefox"] : [];
    case "yerel_arama_aygitlar":
      return {
        girisler: [
          { ad: "alsa_input.pci-0000_00_1f.3.analog-stereo", aciklama: "Dahili mikrofon" },
          { ad: "alsa_input.usb-Blue_Microphones-00.mono-fallback", aciklama: "USB Masaüstü Mikrofonu" },
        ],
        cikislar: [
          { ad: "alsa_output.pci-0000_00_1f.3.analog-stereo", aciklama: "Dahili hoparlör" },
          { ad: "bluez_output.00_11_22_33_44_55.1", aciklama: "Bluetooth Kulaklık" },
        ],
        varsayilanGiris: "alsa_input.pci-0000_00_1f.3.analog-stereo",
        varsayilanCikis: "alsa_output.pci-0000_00_1f.3.analog-stereo",
      };
    case "yerel_arama_var":
    case "ec_sunucu_destekliyor":
      // ec.ara checks ec_sunucu_destekliyor before yerel_arama_var, so both must be true for showcase calls.
      // ec.ara, yerel_arama_var'dan önce ec_sunucu_destekliyor'u yoklar; vitrin araması için ikisi de true olmalı.
      return vitrinAramaKipi !== null;
    case "pano_yaz":
    case "guncelleme_izin_var":
    case "guncelleme_kur":
      return false;
    case "yerel_arama_kare": {
      if (!vitrinAramaKipi) return new ArrayBuffer(0);
      const sonra = typeof arg.sonra === "number" ? arg.sonra : 0;
      if (sonra === 0) return vitrinKareUret();
      return new Promise<ArrayBuffer>((coz) => setTimeout(() => coz(new ArrayBuffer(4)), 1000));
    }
    case "pano_resim":
      return new ArrayBuffer(0);
    case "ec_ac":
      return { widgetId: "vitrin-ec", url: "about:blank" };
    case "yerel_arama_baslat": {
      if (vitrinAramaKipi) {
        const odaId = String(arg.odaId ?? "");
        yerelDurumYayinla(vitrinAramaDurumuOlustur(odaId, vitrinAramaKipi));
      }
      return null;
    }
    case "yerel_arama_sustur": {
      if (sonYerelDurum) {
        const kapali = Boolean(arg.kapali);
        yerelDurumYayinla({
          ...sonYerelDurum,
          mikrofonKapali: kapali,
          katilimcilar: sonYerelDurum.katilimcilar.map((k) => (k.ben ? { ...k, susturulmus: kapali } : k)),
        });
      }
      return null;
    }
    case "yerel_arama_paylas": {
      if (sonYerelDurum) {
        const paylasilan = Array.isArray(arg.uygulamalar) ? arg.uygulamalar.map(String) : [];
        yerelDurumYayinla({
          ...sonYerelDurum,
          paylasim: "acik",
          paylasilan,
          onizleme: "ben|ekran-onizleme",
          yayin: { durum: "yayinda", kbps: 1400, kareHizi: 30, genislik: 1920, yukseklik: 1080 },
        });
      }
      return null;
    }
    case "yerel_arama_paylasilan_sesler": {
      if (sonYerelDurum) {
        const paylasilan = Array.isArray(arg.uygulamalar) ? arg.uygulamalar.map(String) : [];
        yerelDurumYayinla({ ...sonYerelDurum, paylasilan });
      }
      return null;
    }
    case "yerel_arama_paylasimi_durdur": {
      if (sonYerelDurum) {
        yerelDurumYayinla({
          ...sonYerelDurum,
          paylasim: "yok",
          paylasilan: [],
          onizleme: null,
          yayin: null,
        });
      }
      return null;
    }
    case "yerel_arama_kapat":
      sonYerelDurum = null;
      return null;
    case "arama_olayi_gonder":
    case "yerel_arama_duzey":
    case "yerel_arama_ses_ayarla":
    case "ec_gonder":
    case "ec_kapat":
    case "guncelleme_iptal":
    case "guncelleme_izin_ac":
    case "kurulum_duzelt":
      return null;
    case "uygulama_surumu":
      return SURUM;
    case "guncelleme_denetle":
      return { mevcut: SURUM, yeni: null };
    case "guncelleme_indir":
      return "";
    case "kurulum_raporu":
      return [];

    default:
      console.warn(`[vitrin] komut: ${komut}`);
      return null;
  }
}

mockWindows("main");
mockIPC(isleyici, { shouldMockEvents: true });

if (vitrinAramaKipi) {
  const grup = veri.odalar.find((o) => !o.dm && !o.alan);
  if (grup) {
    // Wait until App.svelte restores the mock session and ec.baslat() subscribes to "yerel-arama".
    // App.svelte taklit oturumu geri yükleyip ec.baslat() "yerel-arama" olayına abone olana dek bekle.
    setTimeout(() => {
      void import("../lib/arama-ec/ec.svelte").then(({ ec }) => {
        void ec.ara({
          id: grup.id,
          ad: grup.ad,
          avatarHarf: grup.avatarHarf || grup.ad.charAt(0).toUpperCase(),
          avatarMxc: null,
          dm: false,
          sesli: false,
        });
      });
    }, 1500);
  }
}
