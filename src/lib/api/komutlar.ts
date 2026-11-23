// The ONLY place that calls invoke(). Every Rust command gets one typed wrapper here.
// invoke() çağrısının YAPILDIĞI TEK yer. Her Rust komutunun burada tipli bir sarmalayıcısı var.
import { invoke } from "@tauri-apps/api/core";
import type {
  AramaGonderIstegi,
  Ben,
  DizinDurumu,
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
  SifrelemeDurumu,
  TurnSunucu,
  Uye,
  VideoSikistirIstegi,
  VideoSonucu,
} from "./tipler";

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
export const cikis = () => cagir<void>("cikis");
export const ben = () => cagir<Ben>("ben");
export const odalariAl = () => cagir<OdaOzeti[]>("odalari_al");
export const odayiAc = (odaId: string) => cagir<OdaBilgisi>("odayi_ac", { odaId });
export const odayiKapat = (odaId: string) => cagir<void>("odayi_kapat", { odaId });
export const geriSayfala = (odaId: string) => cagir<void>("geri_sayfala", { odaId });
// ---- Message search · Mesaj araması ----
export const mesajAra = (sorgu: string, odaId?: string, sinir?: number) =>
  cagir<MesajAramaSonucu[]>("mesaj_ara", { sorgu, odaId: odaId ?? null, sinir: sinir ?? null });
export const dizinDurumu = () => cagir<DizinDurumu>("dizin_durumu");
/** Loads history until the event is in the open room's timeline; false = not found within the limit · Olay açık odanın çizelgesine girene dek geçmişi yükler; false = sınır içinde bulunamadı */
export const olayaGit = (odaId: string, olayId: string) => cagir<boolean>("olaya_git", { odaId, olayId });
export const mesajGonder = (odaId: string, metin: string) => cagir<void>("mesaj_gonder", { odaId, metin });
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
export const dmAc = (kullaniciId: string) => cagir<string>("dm_ac", { kullaniciId });
export const odaAyril = (odaId: string) => cagir<void>("oda_ayril", { odaId });
