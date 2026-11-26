// TypeScript types mirroring the Rust DTOs EXACTLY (serde rename_all = "camelCase").
// If you change a struct in src-tauri/src/matrix/*.rs, change it here too.
// Rust DTO'larının TypeScript karşılıkları, BİREBİR (serde camelCase). src-tauri'deki bir yapıyı değiştirirsen burayı da değiştir.

/** Error sent by every failing command · Başarısız her komutun döndürdüğü hata */
export interface Hata {
  tur: "ag" | "giris" | "sunucu_bulunamadi" | "oturum_yok" | "oda_bulunamadi" | "oda_turu" | "depolama" | "matrix" | "sifreleme" | "dosya_buyuk" | "diger";
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
  /** The room is a space: it has no message timeline, so it belongs to "Alanlar" and is never opened as a chat · Oda bir alan: mesaj çizelgesi yok, "Alanlar"a aittir ve sohbet olarak açılmaz */
  alan: boolean;
  /** Pinned (m.favourite tag) · Sabitli (m.favourite etiketi) */
  sabit: boolean;
}

/** "oturum_kapali" = the server rejected this session for good · sunucu bu oturumu kesin reddetti */
export type EsitlemeDurumuAdi = "basliyor" | "calisiyor" | "hata" | "cevrimdisi" | "oturum_kapali";
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
  | "arama"
  | "silindi"
  | "cikartma"
  | "anket";

export type AramaSonucu = "yapildi" | "cevapsiz" | "reddedildi" | "bilinmiyor";
export interface AramaSatiri {
  sonuc: AramaSonucu;
  /** talk time in seconds when known · biliniyorsa konuşma süresi (sn) */
  sureSn: number | null;
}
export type GonderimDurumu = "gonderiliyor" | "gonderildi" | "bekliyor" | "hata";

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
  /** Raw formatted_body (HTML); sanitized by lib/bicim/temizle.ts before drawing · Ham formatted_body (HTML); çizmeden önce lib/bicim/temizle.ts temizler */
  html: string | null;
  duzenlendi: boolean;
  tepkiler: Tepki[];
  /** The quoted message when this one is a reply · Bu bir yanıtsa alıntılanan mesaj */
  yanit: YanitBilgisi | null;
  /** People whose latest read receipt is on this message (small rooms; never me) · Son okundu bilgisi bu mesajda olan kişiler (küçük odalar; ben asla) */
  okuyanlar: KisiBilgisi[];
  anket: AnketBilgisi | null;
  /** I may delete it · Silebilirim */
  silinebilir: boolean;
  sabit: boolean;
  /** Own text message that can be edited · Düzenlenebilir kendi metin mesajım */
  duzenlenebilir: boolean;
}

export interface KisiBilgisi {
  id: string;
  ad: string;
  avatarMxc: string | null;
}

/** One reaction key under a message · Bir mesajın altındaki tek tepki anahtarı */
export interface Tepki {
  /** emoji, or an mxc:// URI for a custom-emoji reaction · emoji, özel emoji tepkisinde mxc:// adresi */
  anahtar: string;
  sayi: number;
  benim: boolean;
  kisiler: KisiBilgisi[];
}

export interface YanitBilgisi {
  olayId: string;
  gonderen: string | null;
  gonderenAd: string | null;
  metin: string | null;
  /** not fetched yet (the backend is asking for it) · henüz getirilmedi (arka uç istiyor) */
  yukleniyor: boolean;
}

export interface AnketSecenegi {
  id: string;
  metin: string;
  oy: number;
  benim: boolean;
}

export interface AnketBilgisi {
  soru: string;
  secenekler: AnketSecenegi[];
  toplamOy: number;
  bitti: boolean;
  /** m.disclosed: results visible while voting · m.disclosed: oy verirken sonuçlar görünür */
  acik: boolean;
  maksSecim: number;
  benimAnketim: boolean;
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
  /** event ids in the room's pinned list · odanın sabit listesindeki olay kimlikleri */
  sabitler: string[];
  /** may I pin / unpin here? · burada sabitleyebilir / kaldırabilir miyim? */
  sabitleyebilir: boolean;
}

/** Who is typing in a room (me excluded) · Bir odada kimler yazıyor (ben hariç) */
export interface YaziyorGuncelleme {
  odaId: string;
  kisiler: KisiBilgisi[];
}

export interface SabitMesaj {
  olayId: string;
  gonderenAd: string | null;
  metin: string | null;
}

/** UI → Rust: send a text message, optionally as a reply, with HTML and/or mentions · Arayüzden Rust'a: metin mesajı, isteğe bağlı yanıt, HTML ve/veya bahsetme */
export interface MesajGonderIstegi {
  odaId: string;
  metin: string;
  html: string | null;
  yanitOlayId: string | null;
  /** Mentioned Matrix user ids in order of appearance · Görünme sırasıyla bahsedilen kullanıcı kimlikleri */
  bahsedilenler?: string[];
  /** Notify the whole room (`@room`) · Tüm odaya bildir (`@room`) */
  odaBahset?: boolean;
}

export interface AnketIstegi {
  odaId: string;
  soru: string;
  secenekler: string[];
  /** true = results visible while voting · true = oy verirken sonuçlar görünür */
  acik: boolean;
  coklu: boolean;
}

export interface CikartmaIstegi {
  odaId: string;
  mxc: string;
  metin: string;
  genislik: number | null;
  yukseklik: number | null;
  mime: string | null;
  /** Replied-to event · Yanıtlanan olay */
  yanitOlayId: string | null;
}

/** One image of an MSC2545 pack · MSC2545 paketinin tek görseli */
export interface PaketGorseli {
  kisaKod: string;
  mxc: string;
  metin: string;
  genislik: number | null;
  yukseklik: number | null;
  mime: string | null;
  /** may be used as custom emoji / as a sticker · özel emoji / çıkartma olarak kullanılabilir */
  emoji: boolean;
  cikartma: boolean;
}

export interface GorselPaketi {
  kaynak: "oda" | "kullanici" | "baska_oda";
  ad: string;
  avatarMxc: string | null;
  gorseller: PaketGorseli[];
}

// ---- Spaces · Alanlar ----
export interface AlanOgesi {
  id: string;
  ad: string;
  avatarHarf: string;
  avatarMxc: string | null;
  konu: string | null;
  uyeSayisi: number;
  /** it is a space itself (opens as a space view) · kendisi bir alan (alan görünümü olarak açılır) */
  alan: boolean;
  altSayisi: number;
  /** I am joined: opens normally; otherwise "Katıl" · katılmışım: normal açılır; değilse "Katıl" */
  katildi: boolean;
  dm: boolean;
  onerilen: boolean;
  /** servers to join through · katılırken kullanılacak sunucular */
  via: string[];
}
export interface AlanIcerigi {
  alan: AlanOgesi | null;
  cocuklar: AlanOgesi[];
}

/** Presence, when the server tells us · Sunucu söylerse varlık durumu */
export interface VarlikDurumu {
  durum: "cevrimici" | "bosta" | "cevrimdisi";
  sonEtkinlikMs: number | null;
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
  /** May notify the whole room (`@room`) · Tüm odayı bildirebilir (`@room`) */
  odayiBildirebilir: boolean;
}

/** One of my login sessions (device) · Oturum açtığım bir cihaz (profil.rs `OturumCihazi`) */
export interface OturumCihazi {
  cihazId: string;
  ad: string | null;
  /** ms since epoch · epoch'tan beri ms */
  sonGorulme: number | null;
  sonIp: string | null;
  /** cross-signed by me (trusted) · bana ait çapraz imzayla doğrulanmış */
  dogrulandi: boolean;
  buCihaz: boolean;
}

/** Ben › Hesap: what the server offers · Ben › Hesap: sunucunun sunduğu (profil.rs `HesapBilgisi`) */
export interface HesapBilgisi {
  sunucu: string;
  oidc: boolean;
  hesapUrl: string | null;
  eylemler: string[];
  surumler: string[];
  slidingSync: boolean;
}
export interface EpostaAdresi {
  adres: string;
  dogrulandi: boolean;
}

// ---- Invitations and join requests · Davetler ve katılma istekleri ----
export interface IstekOdasi {
  id: string;
  ad: string;
  avatarHarf: string;
  avatarMxc: string | null;
  konu: string | null;
  uyeSayisi: number;
  alan: boolean;
  sifreli: boolean;
  dm: boolean;
}
export interface Istekler {
  gelen: { oda: IstekOdasi; davetEden: KisiBilgisi | null }[];
  giden: IstekOdasi[];
  odalar: { oda: IstekOdasi; kisiler: KisiBilgisi[] }[];
}

/** A preloaded room · Ön yüklenmiş oda */
export interface ZamanHazir { bilgi: OdaBilgisi; zaman: ZamanGuncelleme }

/** Code of the sign-in with the phone · Telefonla girişin kodu */
export interface CihazKodu {
  kod: string;
  adres: string;
  /** The page does not know the code yet: it must be typed · Sayfa kodu henüz bilmiyor: yazılmalı */
  kodYazilir: boolean;
  saniye: number;
}

/** A person from the server's user directory (kesif.rs) · Sunucunun kullanıcı dizininden bir kişi (kesif.rs) */
export interface BulunanKisi {
  kullaniciId: string;
  ad: string | null;
  avatarMxc: string | null;
}
/** A public room from a server's directory (kesif.rs) · Bir sunucunun dizininden herkese açık oda (kesif.rs) */
export interface BulunanOda {
  odaId: string;
  adres: string | null;
  ad: string | null;
  konu: string | null;
  avatarMxc: string | null;
  uyeSayisi: number;
  /** "acik" = join right away, "kapi" = ask to join · "acik" = hemen katıl, "kapi" = katılma isteği */
  katilim: "acik" | "kapi";
  alan: boolean;
  uye: boolean;
}
export interface KesifSayfasi {
  odalar: BulunanOda[];
  sonraki: string | null;
  sunucu: string;
}

export type OnizlemeTuru = "metin" | "medya" | "sifreli";

/** One recent cached message for the room-palette preview panel (onizleme.rs) · Oda paleti önizleme paneli için önbellekteki tek son mesaj */
export interface OnizlemeMesaji {
  olayId: string;
  gonderen: string;
  gonderenAd: string;
  kendi: boolean;
  /** milliseconds since epoch · epoch'tan beri milisaniye */
  zaman: number;
  metin: string;
  tur: OnizlemeTuru;
}
