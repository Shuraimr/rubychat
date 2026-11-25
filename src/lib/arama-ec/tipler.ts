// Types of the Element Call (EC) bridge. They mirror src-tauri/src/matrix/ec.rs (serde camelCase).
// Element Call (EC) köprüsünün tipleri. src-tauri/src/matrix/ec.rs ile aynıdır (serde camelCase).

/** "baslat" = start a call, "katil" = join the one already running · "baslat" = arama başlat, "katil" = süren aramaya katıl */
export type EcTuru = "baslat" | "katil";

export interface EcAcilis {
  url: string;
  widgetId: string;
}

/** A sound the listener can turn up or down alone (native calls). Mirrors src-tauri/src/matrix/yerel_arama/motor.rs. · Dinleyenin tek başına kısıp açabildiği ses (yerel aramalar). */
export interface YerelSes {
  anahtar: string;
  tur: "mikrofon" | "ekran" | "uygulama";
  ad: string | null;
  duzey: number;
}

export interface YerelKatilimci {
  uye: string;
  kullaniciId: string;
  ad: string;
  avatarMxc: string | null;
  ben: boolean;
  susturulmus: boolean;
  konusuyor: boolean;
  /** Keys of the pictures, null = none · Görüntülerin anahtarları, null = yok */
  ekran: string | null;
  kamera: string | null;
  sesler: YerelSes[];
  sorun: "baglaniyor" | "cozulemiyor" | "dogrulanmamis" | null;
}

export interface YerelDurum {
  odaId: string;
  asama: "baglaniyor" | "caliyor" | "acik" | "koptu" | "bitti";
  neden: "biz" | "reddedildi" | "cevapsiz" | "ayrildilar" | "ag" | "hata" | null;
  katilimcilar: YerelKatilimci[];
  mikrofonKapali: boolean;
  paylasim: "yok" | "seciliyor" | "acik";
  paylasilan: string[];
  paylasimHatasi: boolean;
}

/** One JSON message of the widget API, Rust → webview · Widget API'sinin bir JSON mesajı, Rust → webview */
export interface EcGelen {
  widgetId: string;
  mesaj: string;
}

export interface EcBitti {
  widgetId: string;
}

/** Roster of the MatrixRTC call in a room · Bir odadaki MatrixRTC aramasının katılımcı listesi */
export interface EcAramaDurumu {
  odaId: string;
  aktif: boolean;
  katilimcilar: string[];
  benIcinde: boolean;
}

export interface EcAcIstegi {
  odaId: string;
  tur: EcTuru;
  sesliMi: boolean;
  dmMi: boolean;
  ustUrl: string;
  tema: string | null;
  yedek: boolean;
}
