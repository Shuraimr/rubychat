// The ONLY place that calls invoke(). Every Rust command gets one typed wrapper here.
// invoke() çağrısının YAPILDIĞI TEK yer. Her Rust komutunun burada tipli bir sarmalayıcısı var.
import { invoke } from "@tauri-apps/api/core";
import type {
  Istekler,
  EsitlemeDurumu,
  AramaGonderIstegi,
  AlanIcerigi,
  AlanOgesi,
  AnketIstegi,
  Ben,
  CihazKodu,
  CikartmaIstegi,
  DizinDurumu,
  GorselPaketi,
  MesajGonderIstegi,
  SabitMesaj,
  VarlikDurumu,
  DogrulamaDurumu,
  MesajAramaSonucu,
  GirisIstegi,
  BenimYetkilerim,
  BildirimIzni,
  Hata,
  MedyaGonderIstegi,
  MedyaYetenekleri,
  OdaBilgisi,
  OdaOzeti,
  OturumCihazi,
  HesapBilgisi,
  EpostaAdresi,
  SifrelemeDurumu,
  TurnSunucu,
  Uye,
  VideoSikistirIstegi,
  VideoSonucu,
  BulunanKisi,
  KesifSayfasi,
} from "./tipler";
import type { EcAcIstegi, EcAcilis, EcAramaDurumu } from "../arama-ec/tipler";

/** Tauri rejects with whatever the command returned in Err; normalise it to our Hata shape. */
/** Tauri, komutun Err'ünü olduğu gibi reddeder; onu Hata biçimine düzeltiriz. */
function hataYap(e: unknown): Hata {
  if (e && typeof e === "object" && "tur" in e && "mesaj" in e) return e as Hata;
  return { tur: "diger", mesaj: typeof e === "string" ? e : String(e) };
}

async function cagir<T>(komut: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(komut, args);
  } catch (e) {
    throw hataYap(e);
  }
}

export const giris = (istek: GirisIstegi) => cagir<Ben>("giris", { istek });
export const oturumuGeriYukle = () => cagir<Ben | null>("oturumu_geri_yukle");
export interface HesapKaydi { id: string; kullaniciId: string; sunucu: string; ad: string | null; avatarMxc: string | null }
export const hesaplariAl = () => cagir<{ aktif: string; liste: HesapKaydi[] }>("hesaplari_al");
/** null = an empty place to sign in to another account · null = başka hesaba girmek için boş yer */
export const hesapDegistir = (id: string | null) => cagir<void>("hesap_degistir", { id });
export const cikis = () => cagir<void>("cikis");
export const ben = () => cagir<Ben>("ben");
export const odalariAl = () => cagir<OdaOzeti[]>("odalari_al");
export const esitlemeDurumuAl = () => cagir<EsitlemeDurumu | null>("esitleme_durumu");
export const odaSabitle = (odaId: string, sabit: boolean) => cagir<void>("oda_sabitle", { odaId, sabit });
export const odayiAc = (odaId: string) => cagir<OdaBilgisi>("odayi_ac", { odaId });
export const odayiKapat = (odaId: string) => cagir<void>("odayi_kapat", { odaId });
/** Rooms to keep warm, best first; replaces the previous list, [] pauses · Sıcak tutulacak odalar, en iyi önce; öncekinin yerine geçer, [] duraklatır */
export const odalariHazirla = (idler: string[]) => cagir<void>("odalari_hazirla", { idler });
export const geriSayfala = (odaId: string) => cagir<void>("geri_sayfala", { odaId });
// ---- Message search · Mesaj araması ----
export const mesajAra = (sorgu: string, odaId?: string, sinir?: number) =>
  cagir<MesajAramaSonucu[]>("mesaj_ara", { sorgu, odaId: odaId ?? null, sinir: sinir ?? null });
export const dizinDurumu = () => cagir<DizinDurumu>("dizin_durumu");
/** Loads history until the event is in the open room's timeline; false = not found within the limit · Olay açık odanın çizelgesine girene dek geçmişi yükler; false = sınır içinde bulunamadı */
export const olayaGit = (odaId: string, olayId: string) => cagir<boolean>("olaya_git", { odaId, olayId });
export const mesajGonder = (istek: MesajGonderIstegi) => cagir<void>("mesaj_gonder", { istek });
// ---- Message actions · Mesaj eylemleri ----
/** Toggles my reaction; true = added, false = removed · Tepkimi açıp kapatır; true = eklendi, false = kaldırıldı */
export const tepkiDegistir = (odaId: string, olayId: string, anahtar: string) => cagir<boolean>("tepki_degistir", { odaId, olayId, anahtar });
export const mesajSil = (odaId: string, olayId: string) => cagir<void>("mesaj_sil", { odaId, olayId });
export const mesajDuzenle = (
  odaId: string,
  olayId: string,
  metin: string,
  html: string | null,
  bahsedilenler: string[] = [],
  odaBahset = false,
) => cagir<void>("mesaj_duzenle", { odaId, olayId, metin, html, bahsedilenler, odaBahset });
export const yaziyorBildir = (odaId: string, yaziyor: boolean) => cagir<void>("yaziyor_bildir", { odaId, yaziyor });
export const mesajSabitle = (odaId: string, olayId: string, sabitle: boolean) => cagir<void>("mesaj_sabitle", { odaId, olayId, sabitle });
export const sabitMesajlar = (odaId: string) => cagir<SabitMesaj[]>("sabit_mesajlar", { odaId });
export const anketOlustur = (istek: AnketIstegi) => cagir<void>("anket_olustur", { istek });
export const anketOyVer = (odaId: string, anketOlayId: string, secenekler: string[]) => cagir<void>("anket_oy_ver", { odaId, anketOlayId, secenekler });
export const anketBitir = (odaId: string, anketOlayId: string) => cagir<void>("anket_bitir", { odaId, anketOlayId });
export const mesajIlet = (kaynakOdaId: string, olayId: string, hedefOdaId: string) => cagir<void>("mesaj_ilet", { kaynakOdaId, olayId, hedefOdaId });
export const cikartmaGonder = (istek: CikartmaIstegi) => cagir<void>("cikartma_gonder", { istek });
/** Fails on servers that switched presence off; callers just show nothing then · Varlığı kapatan sunucularda hata verir; çağıranlar o zaman bir şey göstermez */
export const varlikDurumu = (kullaniciId: string) => cagir<VarlikDurumu>("varlik_durumu", { kullaniciId });
export const emojiPaketleri = (odaId: string) => cagir<GorselPaketi[]>("emoji_paketleri", { odaId });
// ---- Spaces · Alanlar ----
export const alanlariAl = () => cagir<AlanOgesi[]>("alanlari_al");
export const alanIcerigi = (alanId: string) => cagir<AlanIcerigi>("alan_icerigi", { alanId });
/** Joins by room id or alias through the given servers; returns the room id · Verilen sunucular üzerinden oda kimliği ya da takma adla katılır; oda kimliğini döndürür */
export const alanaKatil = (kimlik: string, via: string[]) => cagir<string>("alana_katil", { kimlik, via });
// ---- Invitations and join requests · Davetler ve katılma istekleri ----
export const istekleriAl = () => cagir<Istekler>("istekleri_al");
export const davetKabul = (odaId: string) => cagir<void>("davet_kabul", { odaId });
/** Declines an invitation or takes back my own request · Daveti reddeder ya da kendi isteğimi geri çeker */
export const davetReddet = (odaId: string) => cagir<void>("davet_reddet", { odaId });
export const katilmaIstegi = (kimlik: string, via: string[], sebep: string | null) => cagir<void>("katilma_istegi", { kimlik, via, sebep });
export const katilmaYanitla = (odaId: string, kullaniciId: string, kabul: boolean) => cagir<void>("katilma_yanitla", { odaId, kullaniciId, kabul });
export const dilAyarla = (en: boolean) => cagir<void>("dil_ayarla", { en });
export const okunduIsaretle = (odaId: string) => cagir<void>("okundu_isaretle", { odaId });
export const mesajYenidenDene = (odaId: string, ogeId: string) => cagir<void>("mesaj_yeniden_dene", { odaId, ogeId });
export const aramaTurnSunuculari = () => cagir<TurnSunucu[]>("arama_turn_sunuculari");
export const aramaOlayiGonder = (istek: AramaGonderIstegi) => cagir<void>("arama_olayi_gonder", { istek });

// ---- End-to-end encryption · Uçtan uca şifreleme ----
export const sifrelemeDurumu = () => cagir<SifrelemeDurumu>("sifreleme_durumu");
/** The password is used for this one call only and never stored. · Şifre yalnızca bu çağrıda kullanılır, saklanmaz. */
export const capraziImzaKur = (parola: string) => cagir<void>("capraz_imza_kur", { parola });
/** Returns the NEW recovery key; show it once, never store it. · YENİ kurtarma anahtarını döndürür; bir kez göster, saklama. */
export const kurtarmaOlustur = () => cagir<string>("kurtarma_olustur");
export const kurtarmaKurtar = (anahtar: string) => cagir<void>("kurtarma_kurtar", { anahtar });
export const dogrulamaBaslat = () => cagir<void>("dogrulama_baslat");
export const dogrulamaKabulEt = () => cagir<void>("dogrulama_kabul_et");
export const dogrulamaOnayla = () => cagir<void>("dogrulama_onayla");
export const dogrulamaEslesmiyor = () => cagir<void>("dogrulama_eslesmiyor");
/** Cancels a running flow and resets; also dismisses a finished one. · Süren akışı iptal edip sıfırlar; biteni de kapatır. */
export const dogrulamaIptal = () => cagir<void>("dogrulama_iptal");
export const dogrulamaDurumu = () => cagir<DogrulamaDurumu>("dogrulama_durumu");

// ---- Media sending · Medya gönderme ----
export const medyaYetenekleri = () => cagir<MedyaYetenekleri>("medya_yetenekleri");
/** Appends one base64 chunk to a cache file; kimlik = null starts a new file. Returns the file id. · Önbellek dosyasına base64 parçası ekler; kimlik = null yeni dosya başlatır. Dosya kimliğini döndürür. */
export const medyaParcaYaz = (kimlik: string | null, uzanti: string, veri: string) =>
  cagir<string>("medya_parca_yaz", { kimlik, uzanti, veri });
export const medyaTemizle = (kimlikler: string[]) => cagir<void>("medya_temizle", { kimlikler });
/** Returns once the file is in the send queue; the local echo then shows the upload. · Dosya gönderim kuyruğuna girince döner; yükleme yerel yankıda görünür. */
export const medyaGonder = (istek: MedyaGonderIstegi) => cagir<void>("medya_gonder", { istek });
export const medyaGonderimiIptal = (odaId: string, ogeId: string) => cagir<void>("medya_gonderimi_iptal", { odaId, ogeId });
export const videoSikistir = (istek: VideoSikistirIstegi) => cagir<VideoSonucu>("video_sikistir", { istek });
export const videoSikistirmayiIptal = () => cagir<void>("video_sikistirmayi_iptal");
/** Saves received media to the gallery / downloads; returns a file name (Android) or a path (desktop). · Alınan medyayı galeriye / indirilenlere kaydeder; dosya adı (Android) ya da yol (masaüstü) döner. */
export const medyaKaydet = (kaynakId: string) => cagir<string>("medya_kaydet", { kaynakId });

// ---- Notifications · Bildirimler ----
export const bildirimIzniDurumu = () => cagir<BildirimIzni>("bildirim_izni_durumu");
/** Shows the system dialog and answers when the user has chosen. · Sistem penceresini gösterir, kullanıcı seçince cevap verir. */
export const bildirimIzniIste = () => cagir<BildirimIzni>("bildirim_izni_iste");
export const bildirimAyarlariniAc = () => cagir<void>("bildirim_ayarlarini_ac");
/** The room a tapped notification wants opened at cold start (consumed once). · Dokunulan bildirimin soğuk açılışta açılmasını istediği oda (bir kez tüketilir). */
export const bildirimBekleyenOda = () => cagir<string | null>("bildirim_bekleyen_oda");
export const uygulamaArkaPlanda = (arkaPlanda: boolean) => cagir<void>("uygulama_arka_planda", { arkaPlanda });

// ---- Members and moderation · Üyeler ve yönetim ----
export const uyeleriListele = (odaId: string) => cagir<Uye[]>("uyeleri_listele", { odaId });
export const benimYetkilerim = (odaId: string) => cagir<BenimYetkilerim>("benim_yetkilerim", { odaId });
export const uyeDavetEt = (odaId: string, kullaniciId: string) => cagir<void>("uye_davet_et", { odaId, kullaniciId });
export const uyeCikar = (odaId: string, kullaniciId: string, sebep?: string) => cagir<void>("uye_cikar", { odaId, kullaniciId, sebep: sebep ?? null });
/** Returns how many of the person's recent messages were deleted · Kişinin silinen son mesajlarının sayısını döndürür */
export const uyeYasakla = (odaId: string, kullaniciId: string, sebep: string | undefined, mesajlariSil: boolean) =>
  cagir<number>("uye_yasakla", { odaId, kullaniciId, sebep: sebep ?? null, mesajlariSil });
export const yasakKaldir = (odaId: string, kullaniciId: string) => cagir<void>("yasak_kaldir", { odaId, kullaniciId });
export const gucAyarla = (odaId: string, kullaniciId: string, guc: number) => cagir<void>("guc_ayarla", { odaId, kullaniciId, guc });
/** Opens (or creates) the DM with a person; returns the room id · Kişiyle DM'i açar (yoksa kurar); oda kimliğini döndürür */
/** Private encrypted group, or a space; returns the room id · Özel şifreli grup ya da alan; oda kimliğini döndürür */
export const odaOlustur = (ad: string, alan: boolean) => cagir<string>("oda_olustur", { ad, alan });
export const dmAc = (kullaniciId: string) => cagir<string>("dm_ac", { kullaniciId });
export const odaAyril = (odaId: string) => cagir<void>("oda_ayril", { odaId });

// ---- Element Call (calls) · Element Call (aramalar) ----
/** Builds the widget URL and starts the Matrix side of the call; returns the URL for the iframe · Widget adresini kurar, aramanın Matrix tarafını başlatır; iframe adresini döndürür */
// Native calls (Linux desktop): see src-tauri/src/matrix/yerel_arama.rs. · Yerel aramalar (Linux masaüstü).
export const yerelAramaVar = () => cagir<boolean>("yerel_arama_var");
export const yerelAramaBaslat = (odaId: string, dm: boolean, ara: boolean) => cagir<void>("yerel_arama_baslat", { odaId, dm, ara });
export const yerelAramaKapat = () => cagir<void>("yerel_arama_kapat");
export const yerelAramaSustur = (kapali: boolean) => cagir<void>("yerel_arama_sustur", { kapali });
export const yerelAramaDuzey = (anahtar: string, duzey: number) => cagir<void>("yerel_arama_duzey", { anahtar, duzey });
export const yerelAramaUygulamalar = () => cagir<string[]>("yerel_arama_uygulamalar");
export const yerelAramaPaylas = (uygulamalar: string[]) => cagir<void>("yerel_arama_paylas", { uygulamalar });
export const yerelAramaPaylasilanSesler = (uygulamalar: string[]) => cagir<void>("yerel_arama_paylasilan_sesler", { uygulamalar });
export const yerelAramaPaylasimiDurdur = () => cagir<void>("yerel_arama_paylasimi_durdur");
export const yerelAramaKare = (anahtar: string, sonra: number) => cagir<ArrayBuffer>("yerel_arama_kare", { anahtar, sonra });

export const ecAc = (i: EcAcIstegi) => cagir<EcAcilis>("ec_ac", { ...i });
/** One widget API message from the iframe to the Rust driver · iframe'den Rust sürücüsüne bir widget API mesajı */
export const ecGonder = (widgetId: string, mesaj: string) => cagir<void>("ec_gonder", { widgetId, mesaj });
export const ecKapat = (widgetId: string) => cagir<void>("ec_kapat", { widgetId });
export const ecAktifAramalar = () => cagir<EcAramaDurumu[]>("ec_aktif_aramalar");
/** Does the homeserver publish a MatrixRTC backend? · Anasunucu bir MatrixRTC arka ucu yayımlıyor mu? */
export const ecSunucuDestekliyor = () => cagir<boolean>("ec_sunucu_destekliyor");

// ---- Profile, sessions, backup, personal sticker pack (src-tauri/src/matrix/profil.rs) · Profil, oturumlar, yedek, kişisel çıkartma paketi ----
export const profilAdAyarla = (ad: string | null) => cagir<void>("profil_ad_ayarla", { ad });
export const profilAvatarAyarla = (kimlik: string, mime: string) => cagir<string>("profil_avatar_ayarla", { kimlik, mime });
export const profilAvatarKaldir = () => cagir<void>("profil_avatar_kaldir");
export const oturumlarListele = () => cagir<OturumCihazi[]>("oturumlar_listele");
export const cihazYenidenAdlandir = (cihazId: string, ad: string) => cagir<void>("cihaz_yeniden_adlandir", { cihazId, ad });
export const cihazCikis = (cihazId: string, parola: string | null) => cagir<void>("cihaz_cikis", { cihazId, parola });
export const yedekAyarla = (acik: boolean) => cagir<void>("yedek_ayarla", { acik });
export const kurtarmaSifirla = () => cagir<string>("kurtarma_sifirla");
export const cikartmaPaketineEkle = (kimlik: string, mime: string, kisaKod: string, genislik: number, yukseklik: number) =>
  cagir<string>("cikartma_paketine_ekle", { kimlik, mime, kisaKod, genislik, yukseklik });
export const hesapBilgisi = () => cagir<HesapBilgisi>("hesap_bilgisi");
export const sifreDegistir = (eski: string, yeni: string) => cagir<void>("sifre_degistir", { eski, yeni });
export const epostalarListele = () => cagir<EpostaAdresi[]>("epostalar_listele");
export const epostaSil = (adres: string) => cagir<void>("eposta_sil", { adres });
export const hesapKapat = (parola: string, veriyiSil: boolean) => cagir<void>("hesap_kapat", { parola, veriyiSil });

/** Desktop Linux clipboard · Masaüstü Linux panosu */
export const panoYaz = (metin: string) => cagir<boolean>("pano_yaz", { metin });
export const panoResim = () => cagir<ArrayBuffer>("pano_resim");

/** Sign in with the phone · Telefonla giriş */
export const cihazGirisiBaslat = (sunucu: string) => cagir<CihazKodu>("cihaz_girisi_baslat", { sunucu });
export const cihazGirisiBekle = () => cagir<Ben>("cihaz_girisi_bekle");
export const cihazGirisiIptal = () => cagir<void>("cihaz_girisi_iptal");
export const kayitPenceresiAc = (adres: string, baslik: string) => cagir<void>("kayit_penceresi_ac", { adres, baslik });
export const kayitPenceresiKapat = () => cagir<void>("kayit_penceresi_kapat");
export const kullaniciAra = (sorgu: string) => cagir<BulunanKisi[]>("kullanici_ara", { sorgu });
export const odalariKesfet = (sunucu: string, sorgu: string, tur: "" | "oda" | "alan", sonraki: string | null) =>
  cagir<KesifSayfasi>("odalari_kesfet", { sunucu, sorgu, tur, sonraki });
