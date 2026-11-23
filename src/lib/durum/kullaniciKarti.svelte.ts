// The one place that opens the user card: `kullaniciKartiAc(kullaniciId, odaId?)` from ANY avatar / name / result row.
// The card itself (KullaniciKarti.svelte) is mounted once in App.svelte and reads this state.
// Kullanıcı kartını açan tek yer: HERHANGİ bir avatar / ad / sonuç satırından `kullaniciKartiAc(kullaniciId, odaId?)`.
// Kartın kendisi (KullaniciKarti.svelte) App.svelte'te bir kez bağlanır ve bu durumu okur.
export interface KartHedefi {
  kullaniciId: string;
  /** Room context: moderation shows only here, and only where I have power · Oda bağlamı: yönetim yalnızca burada ve yetkim varsa görünür */
  odaId?: string;
  /** Names we already know (avoid an empty card while the member list loads) · Bildiğimiz adlar (üye listesi yüklenirken kartın boş kalmaması için) */
  ad?: string;
  avatarMxc?: string | null;
}

class KullaniciKartiDurumu {
  hedef = $state<KartHedefi | null>(null);
}
export const kullaniciKarti = new KullaniciKartiDurumu();

export function kullaniciKartiAc(kullaniciId: string, odaId?: string, ad?: string, avatarMxc?: string | null) {
  kullaniciKarti.hedef = { kullaniciId, odaId, ad, avatarMxc };
}
