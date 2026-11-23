// What the message UI does to the OPEN room, in one place: every call shows the same Turkish error toast on failure.
// Mesaj arayüzünün AÇIK odaya yaptıkları tek yerde: her çağrı başarısızlıkta aynı Türkçe hata bildirimini gösterir.
import { anketBitir, anketOyVer, mesajSabitle, mesajSil, tepkiDegistir } from "../api/komutlar";
import type { Hata, ZamanOgesi } from "../api/tipler";
import { bildirim } from "../durum/bildirim.svelte";
import { zaman } from "../durum/zaman.svelte";
import { t, type Anahtar } from "../i18n";

export function hataBildir(e: unknown) {
  const tur = (e as Hata | undefined)?.tur ?? "diger";
  bildirim.goster(t(`hata.${tur}` as Anahtar), 4000, { tur: "hata" });
}

const odaId = () => zaman.bilgi?.id ?? null;

/** Adds my reaction or removes it when I already reacted with that key · Tepkimi ekler; aynı anahtarla zaten verdiysem kaldırır */
export async function tepkiVer(oge: ZamanOgesi, anahtar: string) {
  const o = odaId();
  if (!o || !oge.olayId) return;
  try {
    await tepkiDegistir(o, oge.olayId, anahtar);
  } catch (e) {
    hataBildir(e);
  }
}

export async function sil(oge: ZamanOgesi) {
  const o = odaId();
  if (!o || !oge.olayId) return;
  try {
    await mesajSil(o, oge.olayId);
  } catch (e) {
    hataBildir(e);
  }
}

export async function sabitle(oge: ZamanOgesi, sabitle: boolean) {
  const o = odaId();
  if (!o || !oge.olayId) return;
  try {
    await mesajSabitle(o, oge.olayId, sabitle);
    bildirim.goster(t(sabitle ? "sabit.sabitlendi" : "sabit.kaldirildi"), 2500, { tur: "tamam" });
  } catch (e) {
    hataBildir(e);
  }
}

export async function oyVer(oge: ZamanOgesi, secenekler: string[]) {
  const o = odaId();
  if (!o || !oge.olayId) return;
  try {
    await anketOyVer(o, oge.olayId, secenekler);
  } catch (e) {
    hataBildir(e);
  }
}

export async function anketiBitir(oge: ZamanOgesi) {
  const o = odaId();
  if (!o || !oge.olayId) return;
  try {
    await anketBitir(o, oge.olayId);
  } catch (e) {
    hataBildir(e);
  }
}
