// Types of the Element Call (EC) bridge. They mirror src-tauri/src/matrix/ec.rs (serde camelCase).
// Element Call (EC) köprüsünün tipleri. src-tauri/src/matrix/ec.rs ile aynıdır (serde camelCase).

/** "baslat" = start a call, "katil" = join the one already running · "baslat" = arama başlat, "katil" = süren aramaya katıl */
export type EcTuru = "baslat" | "katil";

export interface EcAcilis {
  url: string;
  widgetId: string;
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
