// TypeScript types mirroring the Rust DTOs EXACTLY (serde rename_all = "camelCase").
// If you change a struct in src-tauri/src/matrix/*.rs, change it here too.
// Rust DTO'larının TypeScript karşılıkları, BİREBİR (serde camelCase). src-tauri'deki bir yapıyı değiştirirsen burayı da değiştir.

/** Error sent by every failing command · Başarısız her komutun döndürdüğü hata */
export interface Hata {
  tur: "ag" | "giris" | "sunucu_bulunamadi" | "oturum_yok" | "oda_bulunamadi" | "depolama" | "matrix" | "sifreleme" | "diger";
  mesaj: string;
}

/** Current account (Ben screen) · Mevcut hesap (Ben ekranı) */
export interface Ben {
  kullaniciId: string;
  cihazId: string;
  gorunenAd: string | null;
  /** mxc:// of our own avatar · kendi avatarımızın mxc:// adresi */
  avatarMxc: string | null;
  sunucu: string;
  /** where the session secrets live · oturum gizli bilgilerinin yeri */
  gizliDepo: GizliDepoAdi;
}

/** "anahtarlik" = OS keyring, "android_kasa" = Android Keystore, "dosya" = plain file fallback */
/** "anahtarlik" = işletim sistemi anahtarlığı, "android_kasa" = Android Keystore, "dosya" = düz dosya yedeği */
export type GizliDepoAdi = "anahtarlik" | "android_kasa" | "dosya";

export interface OdaOzeti {
  id: string;
  ad: string;
  avatarHarf: string;
  /** mxc:// of the room (or DM partner) avatar · oda (ya da DM'deki kişi) avatarının mxc:// adresi */
  avatarMxc: string | null;
  sonMesaj: string | null;
  /** milliseconds since epoch · epoch'tan beri milisaniye */
  sonZaman: number | null;
  okunmamis: number;
  bahsedilme: number;
  sifreli: boolean;
  dm: boolean;
  davet: boolean;
}

export type EsitlemeDurumuAdi = "basliyor" | "calisiyor" | "hata" | "cevrimdisi";
export interface EsitlemeDurumu {
  durum: EsitlemeDurumuAdi;
  mesaj: string | null;
}

export type ZamanTuru =
  | "metin"
  | "resim"
  | "video"
  | "dosya"
  | "sifre_cozulemedi"
  | "diger"
  | "tarih_ayirici"
  | "okunmamis_ayirici"
  | "arama";

export type AramaSonucu = "yapildi" | "cevapsiz" | "reddedildi" | "bilinmiyor";
export interface AramaSatiri {
  sonuc: AramaSonucu;
  /** talk time in seconds when known · biliniyorsa konuşma süresi (sn) */
  sureSn: number | null;
}
export type GonderimDurumu = "gonderiliyor" | "gonderildi" | "hata";

export interface ZamanOgesi {
  id: string;
  gonderen: string;
  gonderenAd: string;
  kendi: boolean;
  /** milliseconds since epoch · epoch'tan beri milisaniye */
  zaman: number;
  tur: ZamanTuru;
  metin: string | null;
  durum: GonderimDurumu;
  gonderenAvatarMxc: string | null;
  /** set when tur === "arama" · tur === "arama" iken dolu */
  arama: AramaSatiri | null;
  /** set for resim / video / dosya; `metin` is then only the caption · resim / video / dosya için dolu; `metin` bu durumda yalnızca açıklama */
  medya: MedyaBilgisi | null;
  /** Matrix event id of a real event (null for local echoes / virtual rows); message search jumps to it · Gerçek olayın Matrix olay kimliği (yerel yankı / sanal satırlarda null); mesaj araması buna atlar */
  olayId: string | null;
}

// ---- Media · Medya ----

export type MedyaTuru = "resim" | "video" | "dosya";

/** Upload progress of our own message that is still being sent, in bytes · Hâlâ gönderilen kendi mesajımızın yükleme ilerlemesi (bayt) */
export interface MedyaIlerleme {
  gecerli: number;
  toplam: number;
}

/**
 * `kaynakId` / `kucukId` are keys for the `medya` URI scheme (see lib/medya/url.ts): encrypted media has no plain URL.
 * `kaynakId` / `kucukId`, `medya` URI şemasının anahtarlarıdır (bkz. lib/medya/url.ts): şifreli medyanın düz adresi yoktur.
 */
export interface MedyaBilgisi {
  tur: MedyaTuru;
  kaynakId: string;
  kucukId: string | null;
  genislik: number | null;
  yukseklik: number | null;
  sureMs: number | null;
  boyut: number | null;
  dosyaAdi: string;
  mime: string | null;
  /** non-null while uploading · yüklenirken dolu */
  ilerleme: MedyaIlerleme | null;
}

/** UI → Rust: send a prepared file (written to the cache with medya_parca_yaz) · Arayüzden Rust'a: hazırlanmış dosyayı gönder */
export interface MedyaGonderIstegi {
  odaId: string;
  tur: MedyaTuru;
  kimlik: string;
  dosyaAdi: string;
  mime: string;
  genislik: number | null;
  yukseklik: number | null;
  sureMs: number | null;
  kucukKimlik: string | null;
  kucukMime: string | null;
  kucukGenislik: number | null;
  kucukYukseklik: number | null;
  aciklama: string | null;
}

export interface VideoSikistirIstegi {
  /** local id that `medya-ilerleme` events carry · `medya-ilerleme` olaylarının taşıdığı yerel kimlik */
  yerelId: string;
  kimlik: string;
  /** short-edge limit in px (480 / 720); 0 = keep size · kısa kenar sınırı (px); 0 = boyutu koru */
  yukseklik: number;
  bitrateBps: number;
  baslaMs: number;
  /** 0 = until the end · 0 = sona kadar */
  bitisMs: number;
  sessiz: boolean;
}

export interface VideoSonucu {
  kimlik: string;
  boyut: number;
  genislik: number;
  yukseklik: number;
  sureMs: number;
}

/** Event "medya-ilerleme": compress stage of a send · "medya-ilerleme" olayı: bir gönderimin sıkıştırma aşaması */
export interface MedyaIlerlemeOlayi {
  yerelId: string;
  asama: "sikistiriliyor";
  yuzde: number;
}

export interface MedyaYetenekleri {
  /** native video compression exists (Android) · yerel video sıkıştırma var (Android) */
  videoSikistirma: boolean;
  /** system notifications exist (Android) · sistem bildirimi var (Android) */
  sistemBildirimi: boolean;
}

export type BildirimIzni = "verildi" | "verilmedi" | "desteklenmiyor";

/** Event "uygulama-ici-bildirim": a message arrived in a room that is not open · "uygulama-ici-bildirim" olayı: açık olmayan odaya mesaj geldi */
export interface UygulamaIciBildirim {
  odaId: string;
  odaAd: string;
  gonderenAd: string;
  metin: string;
  avatarMxc: string | null;
  /** never true for now (the call screen handles calls) · şimdilik hiç true değil (aramayı arama ekranı işler) */
  arama: boolean;
}

export interface OdaBilgisi {
  id: string;
  ad: string;
  avatarHarf: string;
  sifreli: boolean;
  uyeSayisi: number;
  avatarMxc: string | null;
  /** the other person in a 2-member room (callable) · 2 üyeli odada karşıdaki kişi (aranabilir) */
  karsiKullanici: string | null;
}

export interface ZamanGuncelleme {
  odaId: string;
  ogeler: ZamanOgesi[];
  /** true when the start of the room history was reached · odanın geçmişinin başına ulaşıldıysa true */
  basaUlasildi: boolean;
}

export interface GirisIstegi {
  sunucu: string;
  kullanici: string;
  sifre: string;
}

// ---- Calls · Aramalar ----

/** One TURN server, shaped like the browser's RTCIceServer · Tarayıcının RTCIceServer'ı biçiminde bir TURN sunucusu */
export interface TurnSunucu {
  urls: string[];
  username: string;
  credential: string;
}

export type AramaOlayTuru = "davet" | "adaylar" | "cevap" | "cevap_sec" | "red" | "kapat";

export interface AramaAday {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

/** Incoming m.call.* event (event "arama-olayi") · Gelen m.call.* olayı ("arama-olayi" olayı) */
export interface AramaOlayi {
  odaId: string;
  gonderen: string;
  /** sent by one of our own devices · kendi cihazlarımızdan biri gönderdi */
  kendi: boolean;
  zaman: number;
  tur: AramaOlayTuru;
  aramaId: string;
  tarafId: string | null;
  sdp: string | null;
  omurMs: number | null;
  adaylar: AramaAday[];
  secilenTarafId: string | null;
  neden: string | null;
}

/** UI → Rust: send one call event (wire names: davet, adaylar, cevap, cevap_sec, red, kapat) */
export interface AramaGonderIstegi {
  odaId: string;
  tur: AramaOlayTuru;
  aramaId: string;
  tarafId: string;
  sdp?: string;
  omurMs?: number;
  adaylar?: AramaAday[];
  secilenTarafId?: string;
  neden?: string;
}

// ---- End-to-end encryption · Uçtan uca şifreleme ----

export type CaprazImza = "hazir" | "yok" | "bekliyor";
export type YedekDurumu = "acik" | "kapali" | "yukleniyor";
/** hazir = set up and unlocked here, eksik = set up but this device lacks the secrets, kapali = never set up, bilinmiyor = not known yet */
/** hazir = kurulu ve burada açık, eksik = kurulu ama bu cihazda sırlar yok, kapali = hiç kurulmadı, bilinmiyor = henüz bilinmiyor */
export type KurtarmaDurumu = "hazir" | "eksik" | "kapali" | "bilinmiyor";

/** Event "sifreleme-durumu" and command sifreleme_durumu · "sifreleme-durumu" olayı ve sifreleme_durumu komutu */
export interface SifrelemeDurumu {
  caprazImza: CaprazImza;
  cihazDogrulandi: boolean;
  yedek: YedekDurumu;
  kurtarma: KurtarmaDurumu;
  /** the server wants the account password to create cross-signing · sunucu çapraz imza için hesap şifresini istiyor */
  parolaGerekli: boolean;
}

export type DogrulamaAsamasi =
  | "yok"
  | "istek_gonderildi"
  | "gelen_istek"
  | "hazir"
  | "emoji"
  | "onay_bekleniyor"
  | "bitti"
  | "iptal";

export interface SasEmoji {
  simge: string;
  /** standard English description, translated in the UI · standart İngilizce açıklama, arayüzde çevrilir */
  ad: string;
}

/** Event "dogrulama-guncellendi" and command dogrulama_durumu · "dogrulama-guncellendi" olayı ve dogrulama_durumu komutu */
export interface DogrulamaDurumu {
  asama: DogrulamaAsamasi;
  digerCihaz: string | null;
  emojiler: SasEmoji[];
  /** technical English reason when cancelled · iptalde teknik İngilizce neden */
  neden: string | null;
}

// ---- Message search · Mesaj araması ----

/** A piece of a result snippet; `vurgu` = matched the query · Sonuç özetinin parçası; `vurgu` = sorguyla eşleşti */
export interface MesajParcasi {
  metin: string;
  vurgu: boolean;
}

export interface MesajAramaSonucu {
  olayId: string;
  odaId: string;
  gonderen: string;
  gonderenAd: string | null;
  /** milliseconds since epoch · epoch'tan beri milisaniye */
  zaman: number;
  parcalar: MesajParcasi[];
}

export interface DizinDurumu {
  belgeSayisi: number;
  /** the background backfill of old messages is still running · eski mesajların arka plan doldurması sürüyor */
  dolduruluyor: boolean;
}

// ---- Room members · Oda üyeleri ----
export type UyelikDurumu = "join" | "invite" | "ban" | "leave";
export interface Uye {
  kullaniciId: string;
  ad: string;
  avatarMxc: string | null;
  /** power level; room creators on v12+ report 1000 · yetki düzeyi; v12+ oda kurucuları 1000 bildirir */
  guc: number;
  uyelik: UyelikDurumu;
}
export interface BenimYetkilerim {
  guc: number;
  atmaEsigi: number;
  yasaklamaEsigi: number;
  davetEsigi: number;
  yazmaEsigi: number;
  gucEsigi: number;
  atabilir: boolean;
  yasaklayabilir: boolean;
  davetEdebilir: boolean;
  gucDegistirebilir: boolean;
}
