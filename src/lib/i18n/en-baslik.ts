// Chat header redesign and right-side People panel strings (English) · Sohbet başlığı yenileme ve sağ Kişiler paneli metinleri (İngilizce)
import type { trBaslik } from "./tr-baslik";

export const enBaslik: Record<keyof typeof trBaslik, string> = {
  // Chat header · Sohbet başlığı
  "baslik.kisiler": "People",
  "baslik.kisilerAc": "Open people panel",
  "baslik.kisilerKapat": "Close people panel",
  "baslik.cevrimici": "{n} online",
  "baslik.bilgi": "Room info",

  // People panel · Kişiler paneli
  "kisiler.baslik": "People",
  "kisiler.kapat": "Close people panel",
  "kisiler.araYer": "Search people…",
  "kisiler.araTemizle": "Clear search",
  "kisiler.yoneticiler": "ADMINS",
  "kisiler.cevrimici": "ONLINE",
  "kisiler.digerleri": "OTHERS",
  "kisiler.sonucYok": "No matching people",
  "kisiler.dahaFazla": "Show {n} more",
  "kisiler.yaziyor": "typing…",
  "kisiler.cevrimiciDurum": "online",
  "kisiler.ortakOdalar": "Shared rooms",
  "kisiler.ortakOdaYok": "No shared rooms",
  "kisiler.dogrulama": "Verification",
  "kisiler.dogrulamaSifreli": "End-to-end encrypted chat",
  "kisiler.dogrulamaSifresiz": "Unencrypted chat",
  "kisiler.engelle": "Block",
  "kisiler.engeliKaldir": "Unblock",
  "kisiler.kullaniciKarti": "Open profile",
  "kisiler.ipucu": "j/k row · Enter card · Ctrl+H room · Esc close",

  // Keyboard shortcuts · Klavye kısayolları
  "klavye.kKisiler": "Show / hide people panel",
  "klavye.kSolaGec": "Focus room list or room",
  "klavye.kSagaGec": "Focus room or people panel",
  "klavye.kPanelSatir": "Move row in people panel",
  "klavye.kPanelAc": "Open selected person's card",
};
