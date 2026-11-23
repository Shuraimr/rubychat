// What the composer is doing with a message: replying to one, or editing one. Shared between the room screen (context menu, swipe)
// and the composer; cleared when the room closes.
// Yazma alanının bir mesajla ne yaptığı: birine yanıt vermek ya da birini düzenlemek. Oda ekranı (bağlam menüsü, kaydırma) ile
// yazma alanı arasında paylaşılır; oda kapanınca temizlenir.
import type { ZamanOgesi } from "../api/tipler";

class Yazma {
  yanit = $state<ZamanOgesi | null>(null);
  duzenle = $state<ZamanOgesi | null>(null);

  yanitla(o: ZamanOgesi) {
    this.duzenle = null;
    this.yanit = o;
  }
  duzenleBaslat(o: ZamanOgesi) {
    this.yanit = null;
    this.duzenle = o;
  }
  iptal() {
    this.yanit = null;
    this.duzenle = null;
  }
}
export const yazma = new Yazma();
