// "Jump to a message in the open room": the same steps the search result jump uses (find the row, else load history until the event is in
// the timeline, scroll, flash). Used by reply quotes and the pinned bar; the search jump has its own copy tied to its target state.
// "Açık odadaki bir mesaja atla": arama sonucu atlamasının kullandığı adımların aynısı (satırı bul, yoksa olay çizelgeye girene dek
// geçmişi yükle, kaydır, yakıp söndür). Yanıt alıntıları ve sabit çubuğu kullanır; arama atlamasının hedef durumuna bağlı kendi kopyası var.
import { tick } from "svelte";
import { olayaGit } from "../api/komutlar";
import { bildirim } from "../durum/bildirim.svelte";
import { t } from "../i18n";
import { konumKaydet } from "../klavyeKisayol.svelte";
import { kaydirVeVurgula, satiriBul } from "./vurgula";

/** Returns whether the message was found · Mesajın bulunup bulunmadığını döndürür */
export async function mesajaGit(odaId: string, olayId: string, kaydet = true): Promise<boolean> {
  if (kaydet) konumKaydet(odaId, olayId);
  let bulundu = !!satiriBul(olayId);
  if (!bulundu) {
    try {
      bulundu = await olayaGit(odaId, olayId);
    } catch (e) {
      console.error(e);
    }
  }
  if (!bulundu) {
    bildirim.goster(t("mesajAra.bulunamadi"), 4000, { tur: "hata" });
    return false;
  }
  // The row appears once the backend update reached the list: wait a few frames. · Satır, arka uç güncellemesi listeye ulaşınca belirir: birkaç kare bekle.
  for (let i = 0; i < 30; i++) {
    await tick();
    const el = satiriBul(olayId);
    if (el) {
      kaydirVeVurgula(el);
      // Scroll twice: older pages landing can shift the timeline. · İki kez kaydır: inen eski sayfalar çizelgeyi kaydırabilir.
      setTimeout(() => {
        const e2 = satiriBul(olayId);
        if (e2) kaydirVeVurgula(e2);
      }, 300);
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}
