<!--
  Ban dialog (design 22/08): avatar, "<ad> yasaklansın mı?", optional reason, a toggle "Son 24 saatteki mesajlarını sil", Vazgeç (left) /
  Yasakla (right, red). Centred dialog on every screen size; it is a back-button layer. Backend: `uye_yasakla`.
  Yasaklama penceresi (tasarım 22/08): avatar, "<ad> yasaklansın mı?", isteğe bağlı sebep, "Son 24 saatteki mesajlarını sil" anahtarı,
  Vazgeç (solda) / Yasakla (sağda, kırmızı). Her ekran boyutunda ortada pencere; geri tuşu katmanıdır. Arka uç: `uye_yasakla`.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { uyeler } from "../durum/uyeler.svelte";
  import { perdeCik, perdeGir } from "../gecis";
  import { t } from "../i18n";
  import Anahtar from "./Anahtar.svelte";
  import Avatar from "./Avatar.svelte";

  let { odaId, kullaniciId, ad, avatarMxc = null, onkapat, onbitti }: { odaId: string; kullaniciId: string; ad: string; avatarMxc?: string | null; onkapat: () => void; onbitti?: () => void } = $props();

  let sebep = $state("");
  let mesajlariSil = $state(false);
  let mesgul = $state(false);
  let katman = 0;
  onMount(() => {
    katman = gezinme.katmanAc(() => {
      if (mesgul) return false; // finish the request first · önce isteği bitir
      onkapat();
    });
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  async function yasakla() {
    mesgul = true;
    try {
      const n = await uyeler.yasakla(odaId, kullaniciId, sebep.trim() || undefined, mesajlariSil);
      bildirim.goster(n > 0 ? t("yasakla.bittiSilinen", { n }) : t("yasakla.bitti"), 3000, { tur: "tamam" });
      mesgul = false;
      gezinme.katmanKapat(katman);
      onbitti?.();
    } catch (e) {
      mesgul = false;
      bildirim.goster(t("yasakla.hata", { mesaj: (e as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => !mesgul && gezinme.katmanKapat(katman)} in:perdeGir|global out:perdeCik|global></div>
<div class="kap">
  <div class="pencere" role="alertdialog" aria-modal="true" aria-label={t("yasakla.baslik", { ad })}>
    <Avatar harf={ad.charAt(0).toUpperCase() || "#"} mxc={avatarMxc} boyut={72} />
    <h2>{t("yasakla.baslik", { ad })}</h2>
    <p class="alt">{t("yasakla.alt")}</p>
    <label class="sebep"><input bind:value={sebep} placeholder={t("yasakla.sebep")} maxlength="200" /></label>
    <div class="satir"><span>{t("yasakla.mesajlariSil")}</span><Anahtar acik={mesajlariSil} degis={(v) => (mesajlariSil = v)} etiket={t("yasakla.mesajlariSil")} /></div>
    <div class="dugmeler">
      <button class="buton tonlu-yuzey" onclick={() => gezinme.katmanKapat(katman)} disabled={mesgul}>{t("yasakla.vazgec")}</button>
      <button class="buton tehlike" onclick={yasakla} disabled={mesgul}>{#if mesgul}<span class="yuklenme"></span>{/if}{t("yasakla.onayla")}</button>
    </div>
  </div>
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 40; background: color-mix(in srgb, var(--zemin) 70%, transparent); }
  .kap { position: fixed; inset: 0; z-index: 41; display: flex; align-items: center; justify-content: center; padding: 16px; pointer-events: none; }
  .pencere { pointer-events: auto; width: min(380px, 100%); display: grid; justify-items: center; gap: 12px; padding: 24px 20px 20px; border-radius: 24px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); animation: ac var(--sure-menu) var(--egri-yay); }
  @keyframes ac { from { transform: scale(.92); opacity: 0; } }
  h2 { font-size: 1.25rem; text-align: center; }
  .alt { font-size: .875rem; color: var(--yazi-2); text-align: center; }
  .sebep { width: 100%; border-radius: 16px; background: var(--yuzey-2); }
  .sebep input { width: 100%; height: 52px; padding: 0 16px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .satir { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .9375rem; }
  .dugmeler { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
  .buton { border-radius: 24px; width: 100%; padding: 0 8px; }
  .tonlu-yuzey { background: var(--yuzey-2); color: var(--yazi); }
  .tehlike { background: var(--hata); color: var(--zemin); }
</style>
