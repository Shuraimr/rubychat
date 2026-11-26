<!--
  Call screen (design section 11). Phone: full screen. Tablet: a centred card inside the room column (the parent is `position: relative`).
  Avatar in the middle with a pulsing ring while calling (static ring when the call is on), name, status or timer, controls in 64px circles
  (incoming call: two big buttons, decline on the left, accept on the right). Minimise (chevron) sends it to the green bar on the chat screen.
  Arama ekranı (tasarım bölüm 11). Telefon: tam ekran. Tablet: oda sütununda ortalanmış kart (üst eleman `position: relative`).
  Ortada avatar; ararken nabız atan halka (arama sürerken sabit halka), ad, durum ya da sayaç, 64px dairesel kontroller
  (gelen arama: iki büyük düğme, solda reddet, sağda aç). Küçültme (ok) onu sohbet ekranındaki yeşil çubuğa gönderir.
-->
<script lang="ts">
  import Avatar from "../bilesenler/Avatar.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { arama } from "../durum/arama.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import { sureYaz } from "../zaman-bicim";

  const durum = $derived(
    arama.asama === "ariyor"
      ? t("arama.ariyor")
      : arama.asama === "caliyor"
        ? t("arama.gelen")
        : arama.asama === "baglaniyor"
          ? t("arama.baglaniyor")
          : arama.asama === "bagli"
            ? sureYaz(arama.sure)
            : arama.bitisNedeni
              ? t(arama.bitisNedeni)
              : "",
  );
  const calarken = $derived(arama.asama === "ariyor" || arama.asama === "caliyor");
  const gelen = $derived(arama.asama === "caliyor");
  const bitti = $derived(arama.asama === "bitti");
  const bagli = $derived(arama.asama === "bagli");
  // The chip is shown only when the room really is end-to-end encrypted. · Çip yalnızca oda gerçekten uçtan uca şifreliyse gösterilir.
  const sifreli = $derived(!!odalar.liste.find((o) => o.id === arama.odaId)?.sifreli);
</script>

<div class="kapsam" class:genis={gezinme.genis} role="dialog" aria-modal="true" aria-label={arama.ad}>
  <div class="kart">
    <div class="ust">
      {#if !bitti}
        <button class="kucult simge-dugme" onclick={() => arama.ekranKapat()} aria-label={t("arama.ekraniKapat")}><Ikon ad="asagiOk" /></button>
      {:else}<span></span>{/if}
      {#if sifreli}<span class="sifre-cip"><Ikon ad="kilit" boyut={14} />{t("oda.sifreli")}</span>{/if}
    </div>

    <div class="orta">
      <span class="halka" class:calar={calarken && !gelen} class:gelen class:bagli>
        <Avatar harf={arama.avatarHarf} mxc={arama.avatarMxc} boyut={96} yaricap={24} />
      </span>
      <h2>{arama.ad}</h2>
      <p class="durum" class:sayac={bagli} role="status" aria-live="polite">{durum}</p>
      <button
        class="cip-dugme"
        class:acik={arama.gurultuAcik}
        onclick={() => arama.gurultuAyarla(!arama.gurultuAcik)}
        aria-pressed={arama.gurultuAcik}
        disabled={bitti}
      >
        <Ikon ad="mikrofon" boyut={16} />{arama.gurultuAcik ? t("arama.gurultuAcik") : t("arama.gurultuKapali")}
      </button>
    </div>

    <div class="kontroller" class:gelen>
      {#if gelen}
        <div class="dugme-kutu">
          <button class="dugme buyuk kirmizi" onclick={() => arama.reddet()} aria-label={t("arama.reddet")}><Ikon ad="kapat" boyut={28} /></button>
          <span>{t("arama.reddet")}</span>
        </div>
        <div class="dugme-kutu">
          <button class="dugme buyuk yesil" onclick={() => arama.yanitla()} aria-label={t("arama.yanitla")}><Ikon ad="telefon" boyut={28} /></button>
          <span>{t("arama.ac")}</span>
        </div>
      {:else if !bitti}
        <div class="dugme-kutu">
          <button class="dugme" class:aktif={arama.sessiz} onclick={() => arama.sessizToggle()} aria-pressed={arama.sessiz} aria-label={t("arama.sessiz")}>
            <Ikon ad={arama.sessiz ? "mikrofonKapali" : "mikrofon"} boyut={28} />
          </button>
          <span>{arama.sessiz ? t("arama.sesAc") : t("arama.sessiz")}</span>
        </div>
        {#if arama.hoparlorVar}
          <div class="dugme-kutu">
            <button class="dugme" class:aktif={arama.hoparlor} onclick={() => arama.hoparlorToggle()} aria-pressed={arama.hoparlor} aria-label={t("arama.hoparlor")}>
              <Ikon ad="hoparlor" boyut={28} />
            </button>
            <span>{t("arama.hoparlor")}</span>
          </div>
        {/if}
        <div class="dugme-kutu">
          <button class="dugme kirmizi" onclick={() => arama.kapat()} aria-label={t("arama.kapat")}><Ikon ad="telefonKapat" boyut={28} /></button>
          <span>{t("arama.kapat")}</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Phone: covers the whole app. · Telefon: bütün uygulamayı kaplar. */
  .kapsam { position: fixed; inset: 0; z-index: 40; background: var(--zemin); display: flex; }
  .kart {
    position: relative; flex: 1; display: flex; flex-direction: column; justify-content: space-between; align-items: center; min-height: 0;
    padding: calc(8px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
  }
  /* Tablet: centred card inside the room column. · Tablet: oda sütununda ortalı kart. */
  .kapsam.genis { position: absolute; z-index: 20; align-items: center; justify-content: center; background: color-mix(in srgb, var(--zemin) 50%, transparent); }
  .genis .kart { flex: none; width: min(420px, calc(100% - 32px)); min-height: 520px; background: var(--yuzey-1); border-radius: 24px; box-shadow: var(--kat-2); padding: 8px 24px 32px; }
  .ust { width: 100%; display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
  .kucult { margin-left: -4px; }
  .sifre-cip { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; font-weight: 500; color: var(--cozum); }

  .orta { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; min-height: 0; }
  .halka { position: relative; display: inline-flex; border-radius: 24px; margin-bottom: 12px; }
  /* Outgoing: the ring pulses (1.6 s); on a running call the ring stays; incoming: two quiet static rings. All of it stills under reduced motion. */
  /* Giden: halka nabız atar (1,6 sn); süren aramada halka sabit; gelen: iki sakin sabit halka. Azaltılmış harekette hepsi durur. */
  .halka::before, .halka::after { content: ""; position: absolute; border-radius: 32px; pointer-events: none; opacity: 0; }
  .halka.calar::after { inset: -8px; border: 2px solid var(--vurgu); animation: nabiz calc(1600ms * var(--hareket)) var(--egri-cikis) infinite; }
  @media (prefers-reduced-motion: reduce) { .halka.calar::after { animation: none; opacity: .55; } }
  :global([data-az-animasyon]) .halka.calar::after { animation: none; opacity: .55; }
  .halka.gelen::before { inset: -10px; border: 1px solid var(--vurgu); opacity: .9; border-radius: 34px; }
  .halka.gelen::after { inset: -22px; border: 1px solid var(--vurgu); opacity: .5; border-radius: 42px; }
  .halka.bagli::after { inset: -12px; border: 8px solid var(--ton); opacity: 1; border-radius: 36px; }
  @keyframes nabiz { 0% { opacity: .7; transform: scale(.94); } 100% { opacity: 0; transform: scale(1.18); } }
  h2 { font-family: var(--baslik-tipi); font-size: 1.5rem; line-height: 1.25; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .durum { font-size: .9375rem; color: var(--yazi-2); }
  .durum.sayac { font-variant-numeric: tabular-nums; }
  .cip-dugme {
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: 22px; border: 1px solid var(--kenar); color: var(--yazi); font-size: .8125rem; font-weight: 500;
  }
  .cip-dugme.acik { background: var(--ton); color: var(--ton-ustu); border-color: transparent; }
  .cip-dugme:active { background: var(--yuzey-3); }
  .cip-dugme:disabled { opacity: .38; }

  .kontroller { display: flex; justify-content: center; gap: 24px; width: 100%; }
  .kontroller.gelen { justify-content: space-around; max-width: 320px; }
  .dugme-kutu { display: grid; justify-items: center; gap: 8px; min-width: 64px; }
  .dugme-kutu span { font-size: .75rem; color: var(--yazi-2); }
  .dugme {
    width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center;
    background: var(--yuzey-2); color: var(--yazi); transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .dugme.buyuk { width: 72px; height: 72px; border-radius: 36px; }
  .dugme:active { background: var(--yuzey-3); }
  .dugme.aktif { background: var(--ton); color: var(--ton-ustu); }
  .dugme.kirmizi { background: var(--hata); color: var(--zemin); }
  .dugme.yesil { background: var(--cozum); color: var(--zemin); }
  .dugme.kirmizi:active, .dugme.yesil:active { opacity: .85; }
  /* Landscape phone: the call screen is short, so avatar and controls sit side by side. · Yatay telefon: arama ekranı kısa; avatar ile kontroller yan yana durur. */
  @media (max-height: 500px) {
    .kart { flex-direction: row; flex-wrap: wrap; align-content: center; padding-bottom: 8px; }
    .ust { position: absolute; top: calc(8px + env(safe-area-inset-top)); left: calc(16px + env(safe-area-inset-left)); right: calc(16px + env(safe-area-inset-right)); width: auto; }
    .orta { gap: 6px; }
    .halka { margin-bottom: 8px; }
    .kontroller { width: auto; flex: none; }
  }
</style>
