<!--
  Customize sheet (design 22/05): scope ("Yalnızca bu sohbet" / "Tüm sohbetler"), live preview, bubble style, text size, density, background,
  chat colour, timestamps/receipts and group avatars. Everything is saved at once (localStorage via sohbetGorunum) and applied to the room.
  Özelleştir sayfası (tasarım 22/05): kapsam ("Yalnızca bu sohbet" / "Tüm sohbetler"), canlı önizleme, baloncuk stili, yazı boyutu, yoğunluk,
  arka plan, sohbet rengi, saat/okundu bilgisi ve gruplarda avatar. Her şey anında kaydedilir (sohbetGorunum ile localStorage) ve odaya uygulanır.
-->
<script lang="ts">
  import { gorunumStili, SOHBET_RENKLERI, sohbetGorunumu, ZEMIN_RENKLERI, type BalonStili, type SohbetRengi, type SohbetZemini, type Yogunluk } from "../durum/sohbetGorunum.svelte";
  import { t, type Anahtar as TrAnahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Anahtar from "./Anahtar.svelte";
  import Ikon from "./Ikon.svelte";

  /** odaId null = global only (Ayarlar › Görünüm) · odaId null = yalnızca genel (Ayarlar › Görünüm) */
  let { odaId = null, onkapat }: { odaId?: string | null; onkapat: () => void } = $props();

  let kapsamAcik = $state(false);
  // Scope: "bu sohbet" is on while the room has its own override · Kapsam: odanın kendi ayarı varken "bu sohbet" açık
  const buSohbet = $derived(!!odaId && sohbetGorunumu.ozelMi(odaId));
  const g = $derived(sohbetGorunumu.al(odaId));
  const hedef = $derived(buSohbet ? odaId : null);

  const yaz = <K extends keyof typeof g>(k: K, v: (typeof g)[K]) => sohbetGorunumu.yaz(hedef, k, v);
  function kapsamSec(bu: boolean) {
    kapsamAcik = false;
    if (!odaId) return;
    if (bu) sohbetGorunumu.odaOzellestir(odaId);
    else sohbetGorunumu.odaSifirla(odaId);
  }

  const balonlar: BalonStili[] = ["yuvarlak", "koseli", "cizgisiz"];
  const yogunluklar: Yogunluk[] = ["rahat", "siki"];
  const zeminler: SohbetZemini[] = ["varsayilan", "amoled", "mavi", "kirmizi", "yesil"];
  const renkler: SohbetRengi[] = ["vurgu", "mor", "mavi", "yesil", "sari", "gri"];
  const renkDeger = (r: SohbetRengi) => (r === "vurgu" ? "var(--vurgu)" : SOHBET_RENKLERI[r]);
</script>

<AltSayfa baslik={t("ozellestir.baslik")} {onkapat}>
  {#if odaId}
    <div class="kapsam">
      <button class="kapsam-dugme" aria-haspopup="listbox" aria-expanded={kapsamAcik} onclick={() => (kapsamAcik = !kapsamAcik)}>
        {buSohbet ? t("ozellestir.kapsamBu") : t("ozellestir.kapsamTum")}<Ikon ad="asagiOk" boyut={16} />
      </button>
      {#if kapsamAcik}
        <div class="kapsam-menu" role="listbox">
          <button role="option" aria-selected={buSohbet} onclick={() => kapsamSec(true)}>{t("ozellestir.kapsamBu")}</button>
          <button role="option" aria-selected={!buSohbet} onclick={() => kapsamSec(false)}>{t("ozellestir.kapsamTum")}</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Live preview: the same variables the room uses · Canlı önizleme: odanın kullandığı aynı değişkenler -->
  <div class="onizleme oda" data-balon={g.balon} data-saat={g.saat ? undefined : "yok"} style={gorunumStili(g)} style:background={ZEMIN_RENKLERI[g.zemin]}>
    <div class="o-gelen" style:font-size="calc(.9375rem * {g.yazi})">{t("ozellestir.onizGelen")}</div>
    <div class="o-giden" style:font-size="calc(.9375rem * {g.yazi})">{t("ozellestir.onizGiden")}</div>
  </div>

  <section>
    <h3>{t("ozellestir.baloncuk")}</h3>
    <div class="secenekler uc">
      {#each balonlar as b (b)}<button class="secenek" class:aktif={g.balon === b} aria-pressed={g.balon === b} onclick={() => yaz("balon", b)}>{t(`ozellestir.${b}` as TrAnahtar)}</button>{/each}
    </div>
  </section>

  <section>
    <h3>{t("ozellestir.yazi")}</h3>
    <input class="aralik" type="range" min="0.85" max="1.3" step="0.05" value={g.yazi} aria-label={t("ozellestir.yazi")} oninput={(e) => yaz("yazi", Number(e.currentTarget.value))} />
  </section>

  <section>
    <h3>{t("ozellestir.yogunluk")}</h3>
    <div class="secenekler iki">
      {#each yogunluklar as y (y)}<button class="secenek" class:aktif={g.yogunluk === y} aria-pressed={g.yogunluk === y} onclick={() => yaz("yogunluk", y)}>{t(`ozellestir.${y}` as TrAnahtar)}</button>{/each}
    </div>
  </section>

  <section>
    <h3>{t("ozellestir.arkaPlan")}</h3>
    <div class="renkler" role="radiogroup" aria-label={t("ozellestir.arkaPlan")}>
      {#each zeminler as z (z)}
        <button class="orneg kare" class:aktif={g.zemin === z} role="radio" aria-checked={g.zemin === z} aria-label={t(`ozellestir.zemin.${z}` as TrAnahtar)} style:background={ZEMIN_RENKLERI[z]} onclick={() => yaz("zemin", z)}></button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t("ozellestir.renk")}</h3>
    <div class="renkler" role="radiogroup" aria-label={t("ozellestir.renk")}>
      {#each renkler as r (r)}
        <button class="orneg yuvarlak" class:aktif={g.renk === r} role="radio" aria-checked={g.renk === r} aria-label={t(`ozellestir.renk.${r}` as TrAnahtar)} style:background={renkDeger(r)} onclick={() => yaz("renk", r)}></button>
      {/each}
    </div>
  </section>

  <div class="satir"><span>{t("ozellestir.saat")}</span><Anahtar acik={g.saat} degis={(v) => yaz("saat", v)} etiket={t("ozellestir.saat")} /></div>
  <div class="satir"><span>{t("ozellestir.avatar")}</span><Anahtar acik={g.avatar} degis={(v) => yaz("avatar", v)} etiket={t("ozellestir.avatar")} /></div>
</AltSayfa>

<style>
  .kapsam { position: relative; justify-self: end; margin-top: -48px; margin-bottom: -8px; }
  .kapsam-dugme { min-height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 4px; color: var(--vurgu); font-weight: 600; font-size: .9375rem; }
  .kapsam-menu { position: absolute; right: 0; top: 44px; z-index: 5; min-width: 200px; padding: 6px; border-radius: 16px; background: var(--yuzey-3); border: 1px solid var(--kenar); box-shadow: var(--kat-2); animation: ac var(--sure-menu) var(--egri-cikis); transform-origin: top right; }
  @keyframes ac { from { transform: scale(.92); opacity: 0; } }
  .kapsam-menu button { width: 100%; min-height: 44px; padding: 0 12px; text-align: left; border-radius: 10px; }
  .kapsam-menu button[aria-selected="true"] { color: var(--vurgu); font-weight: 600; }
  .onizleme { display: grid; gap: 8px; padding: 16px; border-radius: 16px; border: 1px solid var(--kenar-ince); }
  .o-gelen, .o-giden { max-width: 78%; padding: var(--balon-dolgu); border-radius: var(--balon-r); }
  .o-gelen { background: var(--yuzey-2); justify-self: start; }
  .o-giden { background: var(--giden-bg, var(--ton)); color: var(--giden-yazi, var(--ton-ustu)); justify-self: end; }
  .onizleme[data-balon="cizgisiz"] .o-gelen { background: transparent; padding-left: 0; }
  h3 { font-size: .8125rem; font-weight: 600; color: var(--yazi-2); margin-bottom: 8px; }
  .secenekler { display: grid; gap: 8px; }
  .secenekler.uc { grid-template-columns: repeat(3, 1fr); }
  .secenekler.iki { grid-template-columns: repeat(2, 1fr); }
  .secenek { min-height: 52px; border-radius: 14px; background: var(--yuzey-2); font-weight: 500; }
  .secenek.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .aralik { width: 100%; height: 44px; accent-color: var(--vurgu); }
  .renkler { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px; }
  .orneg { width: 48px; height: 48px; border: 1px solid var(--kenar); outline: 2px solid transparent; outline-offset: 3px; transition: outline-color var(--sure-hizli) var(--egri-cikis); }
  .orneg.kare { border-radius: 14px; width: 56px; }
  .orneg.yuvarlak { border-radius: 24px; }
  .orneg.aktif { outline-color: var(--vurgu); }
  .satir { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 48px; font-size: .9375rem; }
</style>
