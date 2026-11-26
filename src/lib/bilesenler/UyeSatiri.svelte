<!--
  One member row (design 22/06): avatar, name, mxid, role pill. Swipe LEFT reveals "Çıkar" / "Yasakla" (only the ones my power allows: the
  parent passes `cikarabilir` / `yasaklayabilir`; with neither, the row does not swipe). A plain tap opens the user card.
  Bir üye satırı (tasarım 22/06): avatar, ad, mxid, rol hapı. SOLA kaydırınca "Çıkar" / "Yasakla" çıkar (yalnızca yetkimin izin verdikleri:
  üst bileşen `cikarabilir` / `yasaklayabilir` verir; ikisi de yoksa satır kaymaz). Düz dokunuş kullanıcı kartını açar.
-->
<script lang="ts">
  import type { Uye } from "../api/tipler";
  import { rolAdi } from "../durum/uyeler.svelte";
  import { titret } from "../dokunma";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";

  let {
    uye,
    sec,
    cikarabilir = false,
    yasaklayabilir = false,
    cikar,
    yasakla,
    susturulmus = false,
    sag,
  }: {
    uye: Uye;
    sec: () => void;
    cikarabilir?: boolean;
    yasaklayabilir?: boolean;
    cikar?: () => void;
    yasakla?: () => void;
    susturulmus?: boolean;
    /** Replaces the role pill (e.g. "Yasağı kaldır") · Rol hapının yerine geçer (ör. "Yasağı kaldır") */
    sag?: import("svelte").Snippet;
  } = $props();

  const dugme = $derived((cikarabilir ? 1 : 0) + (yasaklayabilir ? 1 : 0));
  const genislik = $derived(dugme * 88);
  let x = $state(0);
  let acik = false;
  let baslangic = 0;
  let sapma = 0;
  let surukle = $state(false);
  let yutTikla = false;

  function asagi(e: PointerEvent) {
    if (!dugme) return;
    baslangic = e.clientX;
    sapma = e.clientY;
    surukle = false;
  }
  function oyna(e: PointerEvent) {
    if (!dugme || baslangic === null) return;
    const dx = e.clientX - baslangic;
    const dy = e.clientY - sapma;
    if (!surukle && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5 && e.buttons !== 0) {
      surukle = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (surukle) x = Math.max(-genislik, Math.min(0, dx + (acik ? -genislik : 0)));
  }
  function birak() {
    if (!surukle) return;
    surukle = false;
    yutTikla = true;
    acik = x < -genislik / 2;
    // Opening buzzes once, like the other tactile moments · Açılış, diğer dokunsal anlar gibi bir kez titretir
    if (acik) titret(10);
    x = acik ? -genislik : 0;
  }
  function tikla() {
    if (yutTikla) {
      yutTikla = false;
      return;
    }
    if (acik) {
      acik = false;
      x = 0;
      return;
    }
    sec();
  }
</script>

<div class="kap">
  {#if dugme}
    <div class="eylemler" style:width="{genislik}px">
      {#if cikarabilir}<button class="e cikar" onclick={() => { x = 0; acik = false; cikar?.(); }}>{t("uyeler.cikar")}</button>{/if}
      {#if yasaklayabilir}<button class="e yasakla" onclick={() => { x = 0; acik = false; yasakla?.(); }}>{t("uyeler.yasakla")}</button>{/if}
    </div>
  {/if}
  <div class="on" class:suruk={surukle} style:transform="translate3d({x}px, 0, 0)" onpointerdown={asagi} onpointermove={oyna} onpointerup={birak} onpointercancel={birak} role="presentation">
    <button class="satir" data-dalga onclick={tikla}>
      <Avatar harf={uye.ad.charAt(0).toUpperCase() || "#"} mxc={uye.avatarMxc} boyut={48} />
      <span class="orta"><strong>{uye.ad}</strong><small>{uye.kullaniciId}</small></span>
      {#if sag}{@render sag()}
      {:else if rolAdi(uye.guc) === "yonetici"}<span class="rol yonetici">{t("uyeler.yoneticiRol")}</span>
      {:else if rolAdi(uye.guc) === "moderator"}<span class="rol">{t("uyeler.moderatorRol")}</span>
      {:else if susturulmus}<span class="rol">{t("uyeler.susturulmus")}</span>{/if}
    </button>
  </div>
</div>

<style>
  .kap { content-visibility: auto; contain-intrinsic-size: auto 4rem; contain: layout style paint; position: relative; overflow: hidden; }
  .eylemler { position: absolute; right: 0; top: 0; bottom: 0; display: flex; }
  .e { flex: 1; font-weight: 600; font-size: .9375rem; }
  .cikar { background: var(--yuzey-3); color: var(--yazi); }
  .yasakla { background: var(--hata); color: var(--zemin); }
  .on { position: relative; background: var(--zemin); touch-action: pan-y; transition: transform var(--sure-orta) var(--egri-ac); }
  .on.suruk { transition: none; }
  .satir { width: 100%; min-height: 64px; padding: 8px 16px; display: flex; align-items: center; gap: 12px; text-align: left; }
  .orta { flex: 1; min-width: 0; display: grid; }
  strong { font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { font-size: .8125rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rol { flex: none; min-height: 28px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 14px; background: var(--yuzey-3); color: var(--yazi-2); font-size: .8125rem; font-weight: 600; }
  .rol.yonetici { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); }
</style>
