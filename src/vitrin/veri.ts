// Showcase mode ("vitrin") fake data: for local development and README screenshots only, never bundled into release builds.
// Vitrin kipi sahte verileri: yalnızca geliştirme ve README görselleri içindir, yayına girmez.
import type {
  AlanIcerigi,
  AlanOgesi,
  Ben,
  BenimYetkilerim,
  BulunanKisi,
  BulunanOda,
  EsitlemeDurumu,
  HesapBilgisi,
  OdaAyarlari,
  OdaBilgisi,
  OdaOzeti,
  OnizlemeMesaji,
  OturumCihazi,
  SabitMesaj,
  Uye,
  VarlikDurumu,
  ZamanOgesi,
} from "../lib/api/tipler";
import { dil } from "../lib/i18n";

/** Full in-memory dataset for one showcase session · Tek vitrin oturumu için bellek içi veri kümesi */
export interface VitrinVerisi {
  sunucu: string;
  ben: Ben;
  esitleme: EsitlemeDurumu;
  odalar: OdaOzeti[];
  bilgiler: Record<string, OdaBilgisi>;
  zamanlar: Record<string, ZamanOgesi[]>;
  sabitler: Record<string, SabitMesaj[]>;
  yazanlar: Record<string, { id: string; ad: string; avatarMxc: null }[]>;
  uyeler: Record<string, Uye[]>;
  yetkiler: Record<string, BenimYetkilerim>;
  ayarlar: Record<string, OdaAyarlari>;
  varliklar: Record<string, VarlikDurumu>;
  alanlar: AlanOgesi[];
  alanIcerikleri: Record<string, AlanIcerigi>;
  kesifOdalar: BulunanOda[];
  kesifOnizlemeler: Record<string, OnizlemeMesaji[]>;
  kisiler: BulunanKisi[];
  cihazlar: OturumCihazi[];
  hesapBilgisi: HesapBilgisi;
}

function ingilizceMi(): boolean {
  if (typeof location !== "undefined") {
    const p = new URLSearchParams(location.search).get("dil");
    if (p === "en") return true;
    if (p === "tr") return false;
  }
  return dil === "en";
}

function bugun(saat: number, dakika: number, saniye = 0): number {
  const d = new Date();
  d.setHours(saat, dakika, saniye, 0);
  return d.getTime();
}

function gunOnce(gun: number, saat: number, dakika: number, saniye = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - gun);
  d.setHours(saat, dakika, saniye, 0);
  return d.getTime();
}

function pazartesi(saat: number, dakika: number, saniye = 0): number {
  const d = new Date();
  const fark = (d.getDay() + 6) % 7 || 7;
  return gunOnce(fark, saat, dakika, saniye);
}

function tarihSatiri(id: string, zaman: number): ZamanOgesi {
  return {
    id,
    gonderen: "",
    gonderenAd: "",
    kendi: false,
    zaman,
    tur: "tarih_ayirici",
    metin: null,
    durum: "gonderildi",
    gonderenAvatarMxc: null,
    arama: null,
    medya: null,
    olayId: null,
    html: null,
    duzenlendi: false,
    tepkiler: [],
    yanit: null,
    okuyanlar: [],
    anket: null,
    silinebilir: false,
    sabit: false,
    duzenlenebilir: false,
  };
}

function okunmamisSatiri(id: string, zaman: number): ZamanOgesi {
  return { ...tarihSatiri(id, zaman), tur: "okunmamis_ayirici" };
}

interface MesajSecenek {
  id: string;
  gonderen: string;
  gonderenAd: string;
  kendi?: boolean;
  zaman: number;
  metin: string;
  tepkiler?: ZamanOgesi["tepkiler"];
  sabit?: boolean;
}

function metinSatiri(m: MesajSecenek): ZamanOgesi {
  const kendi = Boolean(m.kendi);
  return {
    id: m.id,
    gonderen: m.gonderen,
    gonderenAd: m.gonderenAd,
    kendi,
    zaman: m.zaman,
    tur: "metin",
    metin: m.metin,
    durum: "gonderildi",
    gonderenAvatarMxc: null,
    arama: null,
    medya: null,
    olayId: m.id,
    html: null,
    duzenlendi: false,
    tepkiler: m.tepkiler ?? [],
    yanit: null,
    okuyanlar: [],
    anket: null,
    silinebilir: kendi,
    sabit: Boolean(m.sabit),
    duzenlenebilir: kendi,
  };
}

function aramaSatiri(id: string, gonderen: string, gonderenAd: string, zaman: number, sureSn: number): ZamanOgesi {
  return {
    id,
    gonderen,
    gonderenAd,
    kendi: false,
    zaman,
    tur: "arama",
    metin: null,
    durum: "gonderildi",
    gonderenAvatarMxc: null,
    arama: { sonuc: "yapildi", sureSn },
    medya: null,
    olayId: id,
    html: null,
    duzenlendi: false,
    tepkiler: [],
    yanit: null,
    okuyanlar: [],
    anket: null,
    silinebilir: false,
    sabit: false,
    duzenlenebilir: false,
  };
}

/** Builds a fresh showcase dataset using timestamps relative to today · Bugüne göre hesaplanmış taze vitrin verisi üretir */
export function vitrinVerisiOlustur(): VitrinVerisi {
  const en = ingilizceMi();
  const sunucu = en ? "example.org" : "ornek.org";
  const u = (yerel: string) => `@${yerel}:${sunucu}`;

  const eceId = u("ece");
  const elifId = u("elif");
  const mertId = u("mert");
  const ayseId = u("ayse");
  const zeynepId = u("zeynep");
  const canId = u("can");
  const burakId = u("burak");
  const denizId = u("deniz");

  const ben: Ben = {
    kullaniciId: eceId,
    cihazId: "VITRIN01",
    gorunenAd: "Ece",
    avatarMxc: null,
    sunucu,
    gizliDepo: "anahtarlik",
  };

  // Room IDs · Oda kimlikleri
  const kitapId = `!kitap:${sunucu}`;
  const rubychatId = `!rubychat:${sunucu}`;
  const dmAyseId = `!dm-ayse:${sunucu}`;
  const linuxId = `!linux:${sunucu}`;
  const dmCanId = `!dm-can:${sunucu}`;
  const bisikletId = `!bisiklet:${sunucu}`;
  const dersId = `!ders:${sunucu}`;
  const acikKaynakId = `!acikkaynak:${sunucu}`;
  const alanId = `!alan-akt:${sunucu}`;

  const DK = 60_000;
  const SAAT = 60 * DK;

  // Book club members: 8 named + 16 extra = 24 total · Kitap kulübü üyeleri: 8 ana + 16 ek = toplam 24
  const ekUyeler: { yerel: string; ad: string; varlik: VarlikDurumu }[] = [
    { yerel: "selin", ad: "Selin Kaya", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 2 * SAAT } },
    { yerel: "emre", ad: "Emre Aydın", varlik: { durum: "cevrimici", sonEtkinlikMs: null } },
    { yerel: "irem", ad: "İrem Aksoy", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 3 * SAAT + 15 * DK } },
    { yerel: "kerem", ad: "Kerem Şahin", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 4 * SAAT } },
    { yerel: "defne", ad: "Defne Arslan", varlik: { durum: "bosta", sonEtkinlikMs: 25 * DK } },
    { yerel: "oguz", ad: "Oğuz Çelik", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 6 * SAAT } },
    { yerel: "melis", ad: "Melis Koç", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 8 * SAAT } },
    { yerel: "arda", ad: "Arda Yıldız", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 11 * SAAT } },
    { yerel: "ceren", ad: "Ceren Özkan", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 14 * SAAT } },
    { yerel: "kaan", ad: "Kaan Polat", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 19 * SAAT } },
    { yerel: "eylul", ad: "Eylül Doğan", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 26 * SAAT } },
    { yerel: "baran", ad: "Baran Kurt", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 31 * SAAT } },
    { yerel: "yagmur", ad: "Yağmur Tekin", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 42 * SAAT } },
    { yerel: "tuna", ad: "Tuna Öztürk", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 53 * SAAT } },
    { yerel: "asli", ad: "Aslı Güneş", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 68 * SAAT } },
    { yerel: "onur", ad: "Onur Acar", varlik: { durum: "cevrimdisi", sonEtkinlikMs: 92 * SAAT } },
  ];

  const varliklar: Record<string, VarlikDurumu> = {
    [eceId]: { durum: "cevrimici", sonEtkinlikMs: null },
    [elifId]: { durum: "cevrimici", sonEtkinlikMs: null },
    [mertId]: { durum: "cevrimici", sonEtkinlikMs: null },
    [ayseId]: { durum: "cevrimdisi", sonEtkinlikMs: 4 * DK },
    [zeynepId]: { durum: "bosta", sonEtkinlikMs: 18 * DK },
    [canId]: { durum: "cevrimici", sonEtkinlikMs: null },
    [burakId]: { durum: "cevrimdisi", sonEtkinlikMs: 42 * DK },
    [denizId]: { durum: "cevrimdisi", sonEtkinlikMs: 95 * DK },
  };
  for (const k of ekUyeler) varliklar[u(k.yerel)] = k.varlik;

  const kitapUyeleri: Uye[] = [
    { kullaniciId: elifId, ad: "Elif", avatarMxc: null, guc: 100, uyelik: "join" },
    { kullaniciId: mertId, ad: "Mert", avatarMxc: null, guc: 50, uyelik: "join" },
    { kullaniciId: eceId, ad: "Ece", avatarMxc: null, guc: 0, uyelik: "join" },
    { kullaniciId: ayseId, ad: "Ayşe Demir", avatarMxc: null, guc: 0, uyelik: "join" },
    { kullaniciId: zeynepId, ad: "Zeynep", avatarMxc: null, guc: 0, uyelik: "join" },
    { kullaniciId: canId, ad: "Can Yılmaz", avatarMxc: null, guc: 0, uyelik: "join" },
    { kullaniciId: burakId, ad: "Burak", avatarMxc: null, guc: 0, uyelik: "join" },
    { kullaniciId: denizId, ad: "Deniz", avatarMxc: null, guc: 0, uyelik: "join" },
    ...ekUyeler.map((k): Uye => ({ kullaniciId: u(k.yerel), ad: k.ad, avatarMxc: null, guc: 0, uyelik: "join" })),
  ];

  // Room summaries (order matches design showcase; space sits at the end and is filtered into Alanlar)
  // Oda özetleri (sıra vitrin tasarımına göre; alan sonda durur ve Alanlar sekmesine ayrılır)
  const odalar: OdaOzeti[] = [
    {
      id: kitapId,
      takmaAd: en ? `#book-club:${sunucu}` : `#kitap-kulubu:${sunucu}`,
      ad: en ? "Book Club" : "Kitap kulübü",
      avatarHarf: en ? "B" : "K",
      avatarMxc: null,
      sonMesaj: en ? "Ayşe: Yes, at 14:00. I reserved a table" : "Ayşe: Evet, saat 14:00. Masa ayırttım",
      sonZaman: bugun(14, 41),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: true,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: rubychatId,
      takmaAd: `#rubychat-dev:${sunucu}`,
      ad: en ? "rubychat dev" : "rubychat geliştirme",
      avatarHarf: "R",
      avatarMxc: null,
      sonMesaj: en ? "Elif: beta.10 opened smoothly on phone" : "Elif: beta.10 telefonda sorunsuz açıldı",
      sonZaman: bugun(14, 32),
      okunmamis: 3,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: dmAyseId,
      takmaAd: null,
      ad: "Ayşe Demir",
      avatarHarf: "A",
      avatarMxc: null,
      sonMesaj: en ? "Are you coming to book club tonight?" : "Akşam kitap kulübüne geliyor musun?",
      sonZaman: bugun(14, 5),
      okunmamis: 1,
      bahsedilme: 0,
      sifreli: true,
      dm: true,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: linuxId,
      takmaAd: en ? `#linux:${sunucu}` : `#linux-tr:${sunucu}`,
      ad: en ? "Linux Community" : "Linux Türkiye",
      avatarHarf: "L",
      avatarMxc: null,
      sonMesaj: en ? "Mert: Tried the Flatpak package on GNOME 51" : "Mert: Flatpak paketini GNOME 51'de denedim",
      sonZaman: bugun(13, 47),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: dmCanId,
      takmaAd: null,
      ad: "Can Yılmaz",
      avatarHarf: "C",
      avatarMxc: null,
      sonMesaj: en ? "Voice call · 12 min" : "Sesli arama · 12 dk",
      sonZaman: gunOnce(1, 19, 20),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: true,
      dm: true,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: bisikletId,
      takmaAd: null,
      ad: en ? "Cycling Tour" : "Bisiklet turu",
      avatarHarf: en ? "C" : "B",
      avatarMxc: null,
      sonMesaj: en ? "Sunday at 08:00 by Moda pier" : "Pazar 08:00'de Moda iskelesinde",
      sonZaman: gunOnce(1, 17, 15),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: dersId,
      takmaAd: null,
      ad: en ? "Lecture Notes" : "Ders notları",
      avatarHarf: en ? "L" : "D",
      avatarMxc: null,
      sonMesaj: en ? "Zeynep sent a file" : "Zeynep bir dosya gönderdi",
      sonZaman: pazartesi(16, 40),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: acikKaynakId,
      takmaAd: en ? `#open-source:${sunucu}` : `#acik-kaynak:${sunucu}`,
      ad: en ? "Open Source Chat" : "Açık kaynak sohbet",
      avatarHarf: en ? "O" : "A",
      avatarMxc: null,
      sonMesaj: en ? "New release notes are out" : "Yeni sürüm notları yayımlandı",
      sonZaman: pazartesi(11, 15),
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: false,
      sabit: false,
    },
    {
      id: alanId,
      takmaAd: en ? `#open-source-tr:${sunucu}` : `#acik-kaynak-tr:${sunucu}`,
      ad: en ? "Open Source Turkey" : "Açık kaynak Türkiye",
      avatarHarf: en ? "O" : "A",
      avatarMxc: null,
      sonMesaj: null,
      sonZaman: null,
      okunmamis: 0,
      bahsedilme: 0,
      sifreli: false,
      dm: false,
      davet: false,
      alan: true,
      sabit: false,
    },
  ];

  // Room header metadata · Oda başlık bilgileri
  const bilgiler: Record<string, OdaBilgisi> = {
    [kitapId]: {
      id: kitapId,
      ad: odalar[0].ad,
      avatarHarf: odalar[0].avatarHarf,
      sifreli: true,
      uyeSayisi: 24,
      avatarMxc: null,
      karsiKullanici: null,
    },
    [rubychatId]: {
      id: rubychatId,
      ad: odalar[1].ad,
      avatarHarf: odalar[1].avatarHarf,
      sifreli: false,
      uyeSayisi: 12,
      avatarMxc: null,
      karsiKullanici: null,
    },
    [dmAyseId]: {
      id: dmAyseId,
      ad: "Ayşe Demir",
      avatarHarf: "A",
      sifreli: true,
      uyeSayisi: 2,
      avatarMxc: null,
      karsiKullanici: ayseId,
    },
    [linuxId]: {
      id: linuxId,
      ad: odalar[3].ad,
      avatarHarf: odalar[3].avatarHarf,
      sifreli: false,
      uyeSayisi: 86,
      avatarMxc: null,
      karsiKullanici: null,
    },
    [dmCanId]: {
      id: dmCanId,
      ad: "Can Yılmaz",
      avatarHarf: "C",
      sifreli: true,
      uyeSayisi: 2,
      avatarMxc: null,
      karsiKullanici: canId,
    },
    [bisikletId]: {
      id: bisikletId,
      ad: odalar[5].ad,
      avatarHarf: odalar[5].avatarHarf,
      sifreli: false,
      uyeSayisi: 14,
      avatarMxc: null,
      karsiKullanici: null,
    },
    [dersId]: {
      id: dersId,
      ad: odalar[6].ad,
      avatarHarf: odalar[6].avatarHarf,
      sifreli: false,
      uyeSayisi: 19,
      avatarMxc: null,
      karsiKullanici: null,
    },
    [acikKaynakId]: {
      id: acikKaynakId,
      ad: odalar[7].ad,
      avatarHarf: odalar[7].avatarHarf,
      sifreli: false,
      uyeSayisi: 112,
      avatarMxc: null,
      karsiKullanici: null,
    },
  };

  // Timelines · Zaman akışları
  const zamanlar: Record<string, ZamanOgesi[]> = {
    [kitapId]: [
      tarihSatiri("t-kitap-bugun", bugun(14, 0)),
      metinSatiri({
        id: "$kitap-1",
        gonderen: elifId,
        gonderenAd: "Elif",
        zaman: bugun(14, 22, 0),
        metin: en ? "Has everyone reached chapter three?" : "Herkes üçüncü bölüme geldi mi?",
      }),
      metinSatiri({
        id: "$kitap-2",
        gonderen: elifId,
        gonderenAd: "Elif",
        zaman: bugun(14, 22, 25),
        metin: en
          ? "I got stuck at Selim's letter, read the same page three times"
          : "Selim'in mektubunda kaldım, aynı sayfayı üç kez okudum",
      }),
      metinSatiri({
        id: "$kitap-3",
        gonderen: mertId,
        gonderenAd: "Mert",
        zaman: bugun(14, 30, 0),
        metin: en
          ? "I'm there, going slowly though. I'll catch up by Saturday"
          : "Ben geldim ama yavaş gidiyorum. Cumartesiye yetişirim",
      }),
      metinSatiri({
        id: "$kitap-4",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: bugun(14, 36, 0),
        metin: en ? "Are we meeting at the library on Saturday?" : "Cumartesi kütüphanede mi buluşuyoruz?",
      }),
      metinSatiri({
        id: "$kitap-5",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: bugun(14, 36, 20),
        metin: en ? "I'll bring tea" : "Ben çay getiririm",
        tepkiler: [
          {
            anahtar: "☕",
            sayi: 2,
            benim: false,
            kisiler: [
              { id: elifId, ad: "Elif", avatarMxc: null },
              { id: ayseId, ad: "Ayşe Demir", avatarMxc: null },
            ],
          },
        ],
      }),
      metinSatiri({
        id: "$kitap-6",
        gonderen: ayseId,
        gonderenAd: "Ayşe",
        zaman: bugun(14, 41, 0),
        metin: en ? "Yes, at 14:00. I reserved a table" : "Evet, saat 14:00. Masa ayırttım",
      }),
    ],

    [rubychatId]: [
      tarihSatiri("t-ruby-bugun", bugun(14, 0)),
      metinSatiri({
        id: "$ruby-1",
        gonderen: mertId,
        gonderenAd: "Mert",
        zaman: bugun(14, 15),
        metin: en ? "GTK clipboard bridge passed cleanly on the Linux build" : "Linux derlemesinde GTK pano köprüsü temiz geçti",
      }),
      metinSatiri({
        id: "$ruby-2",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: bugun(14, 21),
        metin: en ? "Nice, packaging the Android build now" : "Harika, Android tarafını da şimdi paketliyorum",
      }),
      okunmamisSatiri("u-ruby", bugun(14, 25)),
      metinSatiri({
        id: "$ruby-3",
        gonderen: burakId,
        gonderenAd: "Burak",
        zaman: bugun(14, 26),
        metin: en ? "Installed the APK on Pixel, cold start dropped in half" : "APK'yı telefona kurdum, ilk açılış süresi yarıya inmiş",
      }),
      metinSatiri({
        id: "$ruby-4",
        gonderen: denizId,
        gonderenAd: "Deniz",
        zaman: bugun(14, 29),
        metin: en ? "Bubble contrast looks really balanced in dark theme" : "Koyu temada balon kenarlıkları çok dengeli duruyor",
      }),
      metinSatiri({
        id: "$ruby-5",
        gonderen: elifId,
        gonderenAd: "Elif",
        zaman: bugun(14, 32),
        metin: en ? "beta.10 opened smoothly on phone" : "beta.10 telefonda sorunsuz açıldı",
      }),
    ],

    [dmAyseId]: [
      tarihSatiri("t-ayse-bugun", bugun(13, 40)),
      metinSatiri({
        id: "$ayse-1",
        gonderen: ayseId,
        gonderenAd: "Ayşe Demir",
        zaman: bugun(13, 42),
        metin: en ? "Hey, this week was pretty hectic, wasn't it?" : "Selam, bu hafta bayağı yoğun geçti değil mi?",
      }),
      metinSatiri({
        id: "$ayse-2",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: bugun(13, 48),
        metin: en ? "Tell me about it, just catching my breath" : "Sorma, yeni yeni nefes alıyorum",
      }),
      okunmamisSatiri("u-ayse", bugun(14, 4)),
      metinSatiri({
        id: "$ayse-3",
        gonderen: ayseId,
        gonderenAd: "Ayşe Demir",
        zaman: bugun(14, 5),
        metin: en ? "Are you coming to book club tonight?" : "Akşam kitap kulübüne geliyor musun?",
      }),
    ],

    [linuxId]: [
      tarihSatiri("t-linux-bugun", bugun(13, 15)),
      metinSatiri({
        id: "$linux-1",
        gonderen: canId,
        gonderenAd: "Can Yılmaz",
        zaman: bugun(13, 20),
        metin: en ? "Fractional scaling on Wayland is finally crisp" : "Wayland'de kesirli ölçekleme sonunda bulanık değil",
      }),
      metinSatiri({
        id: "$linux-2",
        gonderen: zeynepId,
        gonderenAd: "Zeynep",
        zaman: bugun(13, 34),
        metin: en ? "PipeWire screen sharing works in one click now too" : "PipeWire ekran paylaşımı da tek tıkla çalışıyor artık",
      }),
      metinSatiri({
        id: "$linux-3",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: bugun(13, 41),
        metin: en ? "Updated the Flatpak manifest to the new runtime" : "Flatpak manifestini yeni çalışma zamanına güncelledik",
      }),
      metinSatiri({
        id: "$linux-4",
        gonderen: mertId,
        gonderenAd: "Mert",
        zaman: bugun(13, 47),
        metin: en ? "Tried the Flatpak package on GNOME 51" : "Flatpak paketini GNOME 51'de denedim",
      }),
    ],

    [dmCanId]: [
      tarihSatiri("t-can-dun", gunOnce(1, 19, 0)),
      metinSatiri({
        id: "$can-1",
        gonderen: canId,
        gonderenAd: "Can Yılmaz",
        zaman: gunOnce(1, 19, 2),
        metin: en ? "Free for a quick check on my new mic?" : "Müsait misin, yeni mikrofonu bir deneyelim mi?",
      }),
      metinSatiri({
        id: "$can-2",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: gunOnce(1, 19, 5),
        metin: en ? "Sure, go ahead and call" : "Müsaitim, arayabilirsin",
      }),
      aramaSatiri("$can-3", canId, "Can Yılmaz", gunOnce(1, 19, 8), 12 * 60),
      metinSatiri({
        id: "$can-4",
        gonderen: canId,
        gonderenAd: "Can Yılmaz",
        zaman: gunOnce(1, 19, 20),
        metin: en ? "Audio came through super clear, thanks!" : "Ses tertemiz geliyormuş, teşekkürler!",
      }),
    ],

    [bisikletId]: [
      tarihSatiri("t-bis-dun", gunOnce(1, 16, 45)),
      metinSatiri({
        id: "$bis-1",
        gonderen: denizId,
        gonderenAd: "Deniz",
        zaman: gunOnce(1, 16, 50),
        metin: en ? "Forecast says 19°C and sunny this weekend" : "Hafta sonu hava 19 derece ve güneşli görünüyor",
      }),
      metinSatiri({
        id: "$bis-2",
        gonderen: burakId,
        gonderenAd: "Burak",
        zaman: gunOnce(1, 17, 2),
        metin: en ? "Let's ride down the coast and back, tailwind on the way" : "Sahilden Tuzla yapıp dönelim, rüzgâr arkadan esiyor",
      }),
      metinSatiri({
        id: "$bis-3",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: gunOnce(1, 17, 8),
        metin: en ? "Count me in, I'll pack a spare tube" : "Ben varım, yedek iç lastik alayım",
      }),
      metinSatiri({
        id: "$bis-4",
        gonderen: denizId,
        gonderenAd: "Deniz",
        zaman: gunOnce(1, 17, 15),
        metin: en ? "Sunday at 08:00 by Moda pier" : "Pazar 08:00'de Moda iskelesinde",
      }),
    ],

    [dersId]: [
      tarihSatiri("t-ders-pzt", pazartesi(16, 0)),
      metinSatiri({
        id: "$ders-1",
        gonderen: burakId,
        gonderenAd: "Burak",
        zaman: pazartesi(16, 10),
        metin: en ? "Does anyone have the week 6 distributed systems slides?" : "Dağıtık sistemler 6. hafta slaytlarını bulabilen var mı?",
      }),
      metinSatiri({
        id: "$ders-2",
        gonderen: eceId,
        gonderenAd: "Ece",
        kendi: true,
        zaman: pazartesi(16, 28),
        metin: en ? "I added a Raft summary to my notes, will share shortly" : "Raft özetini kendi notlarıma eklemiştim, birazdan atarım",
      }),
      metinSatiri({
        id: "$ders-3",
        gonderen: zeynepId,
        gonderenAd: "Zeynep",
        zaman: pazartesi(16, 40),
        metin: en
          ? "Uploaded week 6 summary and practice questions (distributed-w6.pdf)"
          : "6. hafta özetini ve örnek soruları yükledim (dagitik-hafta6.pdf)",
      }),
    ],

    [acikKaynakId]: [
      tarihSatiri("t-ak-pzt", pazartesi(10, 40)),
      metinSatiri({
        id: "$ak-1",
        gonderen: elifId,
        gonderenAd: "Elif",
        zaman: pazartesi(10, 45),
        metin: en ? "Latency dropped noticeably with Matrix 2.0 sliding sync" : "Matrix 2.0 kayan eşitleme tarafında gecikme bayağı düştü",
      }),
      metinSatiri({
        id: "$ak-2",
        gonderen: mertId,
        gonderenAd: "Mert",
        zaman: pazartesi(11, 2),
        metin: en ? "Smaller local store helps older devices too" : "Yerel depolama küçülünce eski cihazlar da rahatladı",
      }),
      metinSatiri({
        id: "$ak-3",
        gonderen: elifId,
        gonderenAd: "Elif",
        zaman: pazartesi(11, 15),
        metin: en ? "New release notes are out" : "Yeni sürüm notları yayımlandı",
      }),
    ],
  };

  // Pinned messages for Book Club (2 items so "1/2" shows in the bar) · Kitap kulübü sabit mesajları ("1/2" görünsün)
  const sabitler: Record<string, SabitMesaj[]> = {
    [kitapId]: [
      {
        olayId: "$kitap-sabit-1",
        gonderenAd: "Elif",
        metin: en
          ? "This month's book: Tutunamayanlar · Saturday 14:00 library"
          : "Bu ayın kitabı: Tutunamayanlar · Cumartesi 14:00 kütüphane",
      },
      {
        olayId: "$kitap-sabit-2",
        gonderenAd: "Mert",
        metin: en
          ? "Next month's book poll opens on Sunday evening"
          : "Gelecek ayın kitap öneri anketi pazar akşamı açılıyor",
      },
    ],
  };

  // Typing indicators · Yazıyor göstergeleri
  const yazanlar: Record<string, { id: string; ad: string; avatarMxc: null }[]> = {
    [kitapId]: [{ id: mertId, ad: "Mert", avatarMxc: null }],
  };

  // Member lists per room · Oda başına üye listeleri
  const kucukGrup = kitapUyeleri.slice(0, 8);
  const uyeler: Record<string, Uye[]> = {
    [kitapId]: kitapUyeleri,
    [rubychatId]: kitapUyeleri.slice(0, 12),
    [dmAyseId]: [
      { kullaniciId: eceId, ad: "Ece", avatarMxc: null, guc: 100, uyelik: "join" },
      { kullaniciId: ayseId, ad: "Ayşe Demir", avatarMxc: null, guc: 100, uyelik: "join" },
    ],
    [linuxId]: kucukGrup,
    [dmCanId]: [
      { kullaniciId: eceId, ad: "Ece", avatarMxc: null, guc: 100, uyelik: "join" },
      { kullaniciId: canId, ad: "Can Yılmaz", avatarMxc: null, guc: 100, uyelik: "join" },
    ],
    [bisikletId]: kucukGrup,
    [dersId]: kucukGrup,
    [acikKaynakId]: kucukGrup,
  };

  const standartYetki: BenimYetkilerim = {
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

  const yetkiler: Record<string, BenimYetkilerim> = {};
  const ayarlar: Record<string, OdaAyarlari> = {};
  for (const o of odalar) {
    yetkiler[o.id] = standartYetki;
    ayarlar[o.id] = {
      ad: o.ad,
      konu:
        o.id === kitapId
          ? en
            ? "Monthly reading circle and weekend library meetups"
            : "Aylık okuma grubu ve hafta sonu kütüphane buluşmaları"
          : o.id === alanId
            ? en
              ? "Free software, Linux and open protocols community"
              : "Özgür yazılım, Linux ve açık protokoller topluluğu"
            : "",
      avatarMxc: null,
      adres: o.takmaAd ?? null,
      katilim: o.sifreli ? "davet" : "acik",
      katilimAlani: null,
      dizinde: !o.sifreli && !o.dm,
      duyuru: false,
      sifreli: o.sifreli,
      alan: o.alan,
      adDegistirebilir: false,
      konuDegistirebilir: false,
      avatarDegistirebilir: false,
      katilimDegistirebilir: false,
      gucDegistirebilir: false,
    };
  }

  // Spaces ("Açık kaynak Türkiye" with 3 rooms) · Alanlar ("Açık kaynak Türkiye", 3 oda)
  const alanOgesi: AlanOgesi = {
    id: alanId,
    ad: en ? "Open Source Turkey" : "Açık kaynak Türkiye",
    avatarHarf: en ? "O" : "A",
    avatarMxc: null,
    konu: en ? "Free software, Linux and open protocols community" : "Özgür yazılım, Linux ve açık protokoller topluluğu",
    uyeSayisi: 148,
    alan: true,
    altSayisi: 3,
    katildi: true,
    dm: false,
    onerilen: true,
    via: [sunucu],
  };

  const alanCocuklari: AlanOgesi[] = [
    {
      id: rubychatId,
      ad: odalar[1].ad,
      avatarHarf: odalar[1].avatarHarf,
      avatarMxc: null,
      konu: en ? "rubychat client development and releases" : "rubychat istemci geliştirme ve sürümler",
      uyeSayisi: 12,
      alan: false,
      altSayisi: 0,
      katildi: true,
      dm: false,
      onerilen: true,
      via: [sunucu],
    },
    {
      id: linuxId,
      ad: odalar[3].ad,
      avatarHarf: odalar[3].avatarHarf,
      avatarMxc: null,
      konu: en ? "Desktop Linux, Wayland and Flatpak chat" : "Masaüstü Linux, Wayland ve Flatpak sohbeti",
      uyeSayisi: 86,
      alan: false,
      altSayisi: 0,
      katildi: true,
      dm: false,
      onerilen: true,
      via: [sunucu],
    },
    {
      id: acikKaynakId,
      ad: odalar[7].ad,
      avatarHarf: odalar[7].avatarHarf,
      avatarMxc: null,
      konu: en ? "General open-source news and discussions" : "Genel açık kaynak haberleri ve tartışmaları",
      uyeSayisi: 112,
      alan: false,
      altSayisi: 0,
      katildi: true,
      dm: false,
      onerilen: false,
      via: [sunucu],
    },
  ];

  // Explore directory: 6 public rooms · Keşfet (oda dizini): 6 herkese açık oda
  const kesifOdalar: BulunanOda[] = [
    {
      odaId: `!kesfet-rust:${sunucu}`,
      adres: en ? `#rust-lang:${sunucu}` : `#rust-tr:${sunucu}`,
      ad: en ? "Rust Lounge" : "Rust Türkiye",
      konu: en ? "Systems programming, async Rust and crates" : "Sistem programlama, async Rust ve crate paylaşımları",
      avatarMxc: null,
      uyeSayisi: 342,
      katilim: "acik",
      alan: false,
      uye: false,
    },
    {
      odaId: `!kesfet-svelte:${sunucu}`,
      adres: `#svelte:${sunucu}`,
      ad: en ? "Svelte & UI" : "Svelte ve Arayüz",
      konu: en ? "Svelte 5 runes, CSS design systems and accessibility" : "Svelte 5 rune'ları, CSS tasarım sistemleri ve erişilebilirlik",
      avatarMxc: null,
      uyeSayisi: 215,
      katilim: "acik",
      alan: false,
      uye: false,
    },
    {
      odaId: `!kesfet-foto:${sunucu}`,
      adres: en ? `#photography:${sunucu}` : `#fotograf:${sunucu}`,
      ad: en ? "Photography" : "Fotoğrafçılık",
      konu: en ? "Analog, street photography and darktable tips" : "Analog, sokak fotoğrafçılığı ve darktable ipuçları",
      avatarMxc: null,
      uyeSayisi: 189,
      katilim: "acik",
      alan: false,
      uye: false,
    },
    {
      odaId: `!kesfet-muzik:${sunucu}`,
      adres: en ? `#music:${sunucu}` : `#muzik:${sunucu}`,
      ad: en ? "Music & Vinyl" : "Müzik ve Plak",
      konu: en ? "Album recommendations and concert notes" : "Albüm önerileri ve konser notları",
      avatarMxc: null,
      uyeSayisi: 127,
      katilim: "acik",
      alan: false,
      uye: false,
    },
    {
      odaId: `!kesfet-tasarim:${sunucu}`,
      adres: en ? `#design:${sunucu}` : `#tasarim:${sunucu}`,
      ad: en ? "Open Design" : "Özgür Tasarım",
      konu: en ? "Typography, icons and open-source product design" : "Tipografi, simgeler ve açık kaynak ürün tasarımı",
      avatarMxc: null,
      uyeSayisi: 94,
      katilim: "kapi",
      alan: false,
      uye: false,
    },
    {
      odaId: `!kesfet-topluluk:${sunucu}`,
      adres: en ? `#foss-hub:${sunucu}` : `#ozgur-yazilim:${sunucu}`,
      ad: en ? "FOSS Community Space" : "Özgür Yazılım Alanı",
      konu: en ? "Directory of community projects and local groups" : "Topluluk projeleri ve yerel çalışma grupları",
      avatarMxc: null,
      uyeSayisi: 510,
      katilim: "acik",
      alan: true,
      uye: false,
    },
  ];

  const kesifOnizlemeler: Record<string, OnizlemeMesaji[]> = {
    [`!kesfet-rust:${sunucu}`]: [
      {
        olayId: "$kesfet-rust-1",
        gonderen: mertId,
        gonderenAd: "Mert",
        kendi: false,
        zaman: bugun(13, 12),
        metin: en ? "Anyone tried Tokio's new task dump in production?" : "Tokio'nun yeni task dump özelliğini canlıda deneyen var mı?",
        tur: "metin",
      },
      {
        olayId: "$kesfet-rust-2",
        gonderen: elifId,
        gonderenAd: "Elif",
        kendi: false,
        zaman: bugun(13, 24),
        metin: en ? "Yes, caught a stuck lock in five minutes" : "Evet, takılı kalan bir kilidi beş dakikada buldurdu",
        tur: "metin",
      },
      {
        olayId: "$kesfet-rust-3",
        gonderen: burakId,
        gonderenAd: "Burak",
        kendi: false,
        zaman: bugun(13, 39),
        metin: en ? "Nice, adding it to our tracing setup this week" : "Güzelmiş, bu hafta bizim tracing kurulumuna ekliyorum",
        tur: "metin",
      },
    ],
    [`!kesfet-svelte:${sunucu}`]: [
      {
        olayId: "$kesfet-svelte-1",
        gonderen: zeynepId,
        gonderenAd: "Zeynep",
        kendi: false,
        zaman: bugun(12, 5),
        metin: en ? "Snippets made sharing layouts between modal and inline views so clean" : "Snippet'ler pencere ve gömülü görünümler arasında düzen paylaşımını çok temizleştirdi",
        tur: "metin",
      },
      {
        olayId: "$kesfet-svelte-2",
        gonderen: canId,
        gonderenAd: "Can Yılmaz",
        kendi: false,
        zaman: bugun(12, 18),
        metin: en ? "Agreed, much easier to read than nested slots" : "Katılıyorum, iç içe slot'lardan çok daha okunaklı",
        tur: "metin",
      },
    ],
    [`!kesfet-foto:${sunucu}`]: [
      {
        olayId: "$kesfet-foto-1",
        gonderen: denizId,
        gonderenAd: "Deniz",
        kendi: false,
        zaman: gunOnce(1, 18, 10),
        metin: en ? "Developed a roll of HP5 pushed to 1600, grain looks great" : "1600'e ittiğim HP5 makarasını banyo ettim, gren çok hoş çıktı",
        tur: "metin",
      },
      {
        olayId: "$kesfet-foto-2",
        gonderen: ayseId,
        gonderenAd: "Ayşe Demir",
        kendi: false,
        zaman: gunOnce(1, 18, 42),
        metin: en ? "Share a couple of frames when you scan them!" : "Tarayınca birkaç kare paylaş mutlaka!",
        tur: "metin",
      },
    ],
    [`!kesfet-muzik:${sunucu}`]: [
      {
        olayId: "$kesfet-muzik-1",
        gonderen: burakId,
        gonderenAd: "Burak",
        kendi: false,
        zaman: gunOnce(1, 21, 5),
        metin: en ? "Found a clean first pressing at the Kadıköy flea market" : "Kadıköy bit pazarında tertemiz bir ilk baskı buldum",
        tur: "metin",
      },
    ],
  };

  const kisiler: BulunanKisi[] = kitapUyeleri
    .filter((k) => k.kullaniciId !== eceId)
    .map((k) => ({ kullaniciId: k.kullaniciId, ad: k.ad, avatarMxc: null }));

  const cihazlar: OturumCihazi[] = [
    {
      cihazId: "VITRIN01",
      ad: en ? "rubychat Linux" : "rubychat Linux",
      sonGorulme: Date.now(),
      sonIp: null,
      dogrulandi: true,
      buCihaz: true,
    },
    {
      cihazId: "VITRIN02",
      ad: en ? "rubychat Android" : "rubychat Android",
      sonGorulme: Date.now() - 25 * DK,
      sonIp: null,
      dogrulandi: true,
      buCihaz: false,
    },
  ];

  const hesapBilgisi: HesapBilgisi = {
    sunucu,
    oidc: false,
    hesapUrl: null,
    eylemler: [],
    surumler: ["v1.11", "v1.12"],
    slidingSync: true,
  };

  return {
    sunucu,
    ben,
    esitleme: { durum: "calisiyor", mesaj: null },
    odalar,
    bilgiler,
    zamanlar,
    sabitler,
    yazanlar,
    uyeler,
    yetkiler,
    ayarlar,
    varliklar,
    alanlar: [alanOgesi],
    alanIcerikleri: { [alanId]: { alan: alanOgesi, cocuklar: alanCocuklari } },
    kesifOdalar,
    kesifOnizlemeler,
    kisiler,
    cihazlar,
    hesapBilgisi,
  };
}
