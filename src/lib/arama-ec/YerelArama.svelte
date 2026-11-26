<!--
  Native call screen (Figma page 25): people as tiles, a shared screen as the stage, one dock, and a "Sesler" panel where the listener turns
  every sound (microphone, each shared application) up or down alone. Back / Escape / the chevron minimise, the red button hangs up.
  Yerel arama ekranı (Figma sayfa 25): kişiler kutularda, paylaşılan ekran sahnede, tek dock ve dinleyenin her sesi (mikrofon, paylaşılan her
  uygulama) tek başına kısıp açtığı "Sesler" paneli. Geri / Escape / ok küçültür, kırmızı düğme kapatır.
-->
<script lang="ts">
  import { yerelAramaDuzey, yerelAramaPaylas, yerelAramaPaylasilanSesler, yerelAramaPaylasimiDurdur, yerelAramaSustur, yerelAramaUygulamalar } from "../api/komutlar";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { t } from "../i18n";
  import { sureYaz } from "../zaman-bicim";
  import { ec } from "./ec.svelte";
  import type { YerelKatilimci, YerelSes } from "./tipler";
  import YerelVideo from "./YerelVideo.svelte";
  import { androidMi, sesCihaziSec, sesCihazlari, sesVarsayilan } from "./ses";

  const d = $derived(ec.yerelDurum);
  const kisiler = $derived(d?.katilimcilar ?? []);
  const digerleri = $derived(kisiler.filter((k) => !k.ben));
  const paylasanlar = $derived(kisiler.filter((k) => k.ekran));
  let secilen = $state<string | null>(null);
  const sahne = $derived(paylasanlar.find((k) => k.uye === secilen) ?? paylasanlar[0] ?? null);
  let panel = $state(false);
  let paylasAcik = $state(false);
  let uygulamalar = $state<string[]>([]);
  let secili = $state<string[]>([]);
  let tam = $state(false);
  // Android: no screen sharing yet; the slot holds the speaker switch instead. · Android: henüz ekran paylaşımı yok; o yerde hoparlör anahtarı durur.
  const android = androidMi();
  let hoparlor = $state(android && !!sesCihazlari().find((c) => c.isSpeaker && c.id === sesVarsayilan(!ec.sesli || !ec.dm)));
  function hoparlorDegis() {
    const hedef = hoparlor ? sesVarsayilan(false) : sesCihazlari().find((c) => c.isSpeaker)?.id;
    if (hedef) sesCihaziSec(hedef);
    hoparlor = !hoparlor;
  }
  let genislik = $state(0);
  const genis = $derived(genislik >= 800);

  const altYazi = $derived.by(() => {
    if (!d || d.asama === "baglaniyor") return t("arama.baglaniyor");
    if (d.asama === "caliyor") return t("yerel.caliyor");
    const bas = d.paylasim === "acik" ? t("yerel.sen") : sahne ? t("yerel.paylasiyor", { ad: sahne.ad }) : t("yerel.kisi", { n: kisiler.length });
    return `${bas} · ${sureYaz(ec.sure)}`;
  });

  // Local copy, so the slider moves under the finger and not with the next snapshot. · Yerel kopya: sürgü sonraki anlık görüntüyle değil parmakla oynar.
  let duzeyler = $state<Record<string, number>>({});
  let onceki: Record<string, number> = {};
  const duzey = (s: YerelSes) => duzeyler[s.anahtar] ?? s.duzey;
  function ver(s: YerelSes, v: number) {
    duzeyler[s.anahtar] = v;
    void yerelAramaDuzey(s.anahtar, v).catch(() => {});
  }
  function sustur(s: YerelSes) {
    const v = duzey(s);
    if (v > 0) onceki[s.anahtar] = v;
    ver(s, v > 0 ? 0 : (onceki[s.anahtar] ?? 1));
  }
  const sesAdi = (s: YerelSes) => (s.tur === "mikrofon" ? t("yerel.mikrofon") : s.tur === "ekran" ? t("yerel.ekranSesi") : (s.ad ?? t("yerel.uygulama")));

  async function paylasAc() {
    secili = d?.paylasilan ? [...d.paylasilan] : [];
    paylasAcik = true;
    const l = await yerelAramaUygulamalar().catch(() => []);
    uygulamalar = [...new Set([...secili, ...l])];
  }
  function uygulamaDegis(ad: string, acik: boolean) {
    secili = acik ? [...secili, ad] : secili.filter((a) => a !== ad);
    if (d?.paylasim !== "yok") void yerelAramaPaylasilanSesler(secili).catch(() => {});
  }
  function basla() {
    paylasAcik = false;
    void yerelAramaPaylas(secili).catch(() => bildirim.goster(t("yerel.paylasimHata"), 4000, { tur: "hata" }));
  }
  function durdur() {
    paylasAcik = false;
    void yerelAramaPaylasimiDurdur().catch(() => {});
  }
  let hataVardi = false;
  $effect(() => {
    const h = d?.paylasimHatasi ?? false;
    if (h && !hataVardi) bildirim.goster(t("yerel.paylasimHata"), 4000, { tur: "hata" });
    hataVardi = h;
  });
  $effect(() => {
    if (!sahne) tam = false;
  });
</script>

{#snippet kutu(k: YerelKatilimci, kucuk: boolean)}
  <div class="kutu" class:konusuyor={k.konusuyor && !k.susturulmus} class:kucuk>
    {#if k.kamera}<YerelVideo anahtar={k.kamera} />{:else}<Avatar harf={k.ad.charAt(0).toUpperCase()} boyut={kucuk ? 40 : 88} mxc={k.avatarMxc} />{/if}
    <span class="etiket">
      {#if k.susturulmus}<span class="kirmizi"><Ikon ad="mikrofonKapali" boyut={14} /></span>{/if}
      <span class="ad">{k.ben ? t("yerel.ben") : k.ad}</span>
      {#if k.sorun}<span class="sorun" title={t(`yerel.sorun.${k.sorun}`)}>{#if kucuk}<Ikon ad="uyari" boyut={14} /><span class="gizli-metin">{t(`yerel.sorun.${k.sorun}`)}</span>{:else}{t(`yerel.sorun.${k.sorun}`)}{/if}</span>{/if}
    </span>
  </div>
{/snippet}

{#snippet sesListesi()}
  {#each digerleri as k (k.uye)}
    {#if k.sesler.length}
      <div class="kisi"><Avatar harf={k.ad.charAt(0).toUpperCase()} boyut={28} mxc={k.avatarMxc} /><strong>{k.ad}</strong></div>
      {#each k.sesler as s (s.anahtar)}
        {@const v = duzey(s)}
        <div class="ses">
          <button class="simge-dugme" class:kirmizi={v === 0} onclick={() => sustur(s)} aria-label={t(v ? "yerel.sustur" : "yerel.sesAc", { ad: `${k.ad}, ${sesAdi(s)}` })}>
            <Ikon ad={s.tur === "mikrofon" ? (v ? "mikrofon" : "mikrofonKapali") : v ? (s.tur === "uygulama" ? "pencere" : "sesler") : "sesYok"} boyut={20} />
          </button>
          <span class="ses-adi">{sesAdi(s)}</span>
          <input type="range" min="0" max="2" step="0.05" value={v} aria-label={`${k.ad}, ${sesAdi(s)}`} oninput={(e) => ver(s, Number(e.currentTarget.value))} />
          <span class="yuzde">{v ? `%${Math.round(v * 100)}` : t("yerel.sessiz")}</span>
        </div>
      {/each}
    {/if}
  {:else}
    <p class="not">{t("yerel.seslerBos")}</p>
  {/each}
  {#if digerleri.length}<p class="not">{t("yerel.seslerNot")}</p>{/if}
{/snippet}

<div class="kapsam" class:gizli={!ec.ekranAcik} inert={!ec.ekranAcik} role="dialog" aria-modal="true" aria-label={ec.ad} bind:clientWidth={genislik}>
  {#if !tam}
    <header>
      <button class="simge-dugme" onclick={() => ec.kucult()} aria-label={t("arama.ekraniKapat")}><Ikon ad="asagiOk" /></button>
      <div class="adlar"><strong>{ec.ad}</strong><span class="durum" role="status">{altYazi}</span></div>
    </header>
    {#if d?.asama === "koptu"}<p class="serit" role="alert">{t("yerel.koptu")}</p>{/if}
  {/if}

  <div class="govde">
    <div class="orta">
      {#if sahne?.ekran}
        <div class="sahne">
          {#key sahne.ekran}<YerelVideo anahtar={sahne.ekran} />{/key}
          <button class="yuzen" onclick={() => (tam = !tam)} aria-label={t(tam ? "yerel.kucult" : "yerel.tamEkran")}><Ikon ad={tam ? "kapat" : "tamEkran"} boyut={20} /></button>
        </div>
        {#if !tam}
          <div class="dizi">
            {#each kisiler as k (k.uye)}
              {#if k.ekran && paylasanlar.length > 1}
                <button class="sec" aria-pressed={k === sahne} onclick={() => (secilen = k.uye)}>{@render kutu(k, true)}</button>
              {:else}{@render kutu(k, true)}{/if}
            {/each}
          </div>
        {/if}
      {:else}
        <div class="izgara" style:--sutun={genis ? Math.min(3, Math.max(1, kisiler.length)) : kisiler.length > 4 ? 2 : 1}>
          {#each kisiler as k (k.uye)}{@render kutu(k, false)}{/each}
        </div>
        {#if d && !digerleri.length && d.asama !== "baglaniyor"}<p class="not ortala">{t("yerel.bekleniyor")}</p>{/if}
      {/if}
    </div>
    {#if panel && genis && !tam}<aside aria-label={t("yerel.sesler")}><h2>{t("yerel.sesler")}</h2>{@render sesListesi()}</aside>{/if}
  </div>

  {#if !tam}
    <div class="dock" data-alt-cubuk>
      <button class="tus" class:kapali={d?.mikrofonKapali} aria-pressed={d?.mikrofonKapali ?? false} disabled={!d} onclick={() => void yerelAramaSustur(!d?.mikrofonKapali)} aria-label={t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}>
        <Ikon ad={d?.mikrofonKapali ? "mikrofonKapali" : "mikrofon"} />
      </button>
      {#if android}
        <button class="tus" class:acik={hoparlor} aria-pressed={hoparlor} onclick={hoparlorDegis} aria-label={t("yerel.hoparlor")}><Ikon ad="hoparlor" /></button>
      {:else}
        <button class="tus" class:acik={d && d.paylasim !== "yok"} disabled={ec.asama !== "acik"} onclick={paylasAc} aria-label={t("yerel.paylas")}><Ikon ad="ekranPaylas" /></button>
      {/if}
      <button class="tus" class:acik={panel} aria-pressed={panel} onclick={() => (panel = !panel)} aria-label={t("yerel.sesler")}><Ikon ad="sesler" /></button>
      <button class="tus son" onclick={() => void ec.kapat()} aria-label={t("arama.kapat")}><Ikon ad="telefonKapat" /></button>
    </div>
  {/if}

  {#if panel && !genis && ec.ekranAcik}
    <AltSayfa baslik={t("yerel.sesler")} onkapat={() => (panel = false)}><div class="liste">{@render sesListesi()}</div></AltSayfa>
  {/if}
  {#if paylasAcik && ec.ekranAcik && d}
    <AltSayfa baslik={t(d.paylasim === "yok" ? "yerel.paylas" : "yerel.paylasimAyar")} onkapat={() => (paylasAcik = false)}>
      <p class="not">{t("yerel.paylasNot")}</p>
      <div class="liste">
        {#each uygulamalar as a (a)}
          <div class="uygulama"><Ikon ad="pencere" boyut={20} /><span class="ad">{a}</span><Anahtar acik={secili.includes(a)} degis={(v) => uygulamaDegis(a, v)} etiket={a} /></div>
        {:else}<p class="not">{t("yerel.sesYok")}</p>{/each}
      </div>
      {#snippet altlik()}
        {#if d?.paylasim === "yok"}<button class="ana" onclick={basla}>{t("yerel.sec")}</button>
        {:else}
          {#if d?.paylasim === "seciliyor"}<p class="not">{t("yerel.seciliyor")}</p>{/if}
          <button class="ana tehlike" onclick={durdur}>{t("yerel.durdur")}</button>
        {/if}
      {/snippet}
    </AltSayfa>
  {/if}
</div>

<style>
  .kapsam { position: fixed; inset: 0; z-index: 40; background: var(--zemin); color: var(--yazi); display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
  .kapsam.gizli { visibility: hidden; pointer-events: none; }
  header { flex: none; display: flex; align-items: center; gap: 4px; min-height: 60px; padding: 0 8px; }
  .adlar { min-width: 0; display: grid; }
  .adlar strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .durum { font-size: .8125rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .serit { flex: none; margin: 0 16px 8px; padding: 10px 14px; border-radius: 12px; background: var(--yuzey-2); color: var(--bekliyor); font-size: .875rem; }
  .govde { flex: 1; min-height: 0; display: flex; gap: 16px; padding: 4px 16px 12px; }
  .orta { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: safe center; gap: 12px; }
  .izgara { display: grid; gap: 16px; grid-template-columns: repeat(var(--sutun), minmax(0, 360px)); justify-content: center; overflow-y: auto; }
  .kutu { position: relative; display: grid; place-items: center; min-height: 160px; aspect-ratio: 4 / 3; border-radius: 16px; background: var(--yuzey-1); box-shadow: inset 0 0 0 1px var(--kenar-ince); overflow: hidden; }
  .kutu.kucuk { width: 170px; min-height: 90px; height: 90px; aspect-ratio: auto; }
  .kutu.konusuyor { box-shadow: inset 0 0 0 2px var(--vurgu); }
  .etiket { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 16px); display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 10px; background: var(--yuzey-3); font-size: .8125rem; }
  .ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sorun { color: var(--bekliyor); white-space: nowrap; }
  .kirmizi { color: var(--hata); }
  .gizli-metin { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .sahne { position: relative; flex: 1; min-height: 120px; border-radius: 16px; overflow: hidden; background: var(--yuzey-1); }
  .yuzen { position: absolute; right: 10px; bottom: 10px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: var(--yuzey-2); color: var(--yazi); }
  .dizi { flex: none; display: flex; gap: 12px; overflow-x: auto; }
  .sec[aria-pressed="true"] .kutu { box-shadow: inset 0 0 0 2px var(--ton-ustu); }
  aside { flex: none; width: 340px; overflow-y: auto; padding: 14px 16px; border-radius: 16px; background: var(--yuzey-1); align-self: flex-start; max-height: 100%; box-sizing: border-box; }
  h2 { font-size: 1.0625rem; font-weight: 600; margin-bottom: 4px; }
  .liste { display: grid; gap: 4px; }
  .kisi { display: flex; align-items: center; gap: 10px; padding-top: 10px; }
  .ses { display: flex; align-items: center; gap: 8px; min-height: 48px; }
  .ses-adi { flex: 0 1 92px; min-width: 56px; font-size: .875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ses input { flex: 1; min-width: 60px; height: 44px; accent-color: var(--vurgu); }
  .yuzde { flex: none; width: 48px; text-align: right; font-size: .75rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .not { font-size: .8125rem; color: var(--yazi-2); line-height: 1.5; }
  .ortala { text-align: center; }
  .dock { flex: none; align-self: center; display: flex; gap: 8px; padding: 8px; margin-bottom: 16px; border-radius: 26px; background: var(--yuzey-2); }
  .tus { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 18px; background: var(--yuzey-3); color: var(--yazi); transition: background var(--sure-hizli) var(--egri-cikis); }
  .tus:disabled { opacity: .4; }
  .tus.acik { background: var(--ton); color: var(--ton-ustu); }
  .tus.kapali { color: var(--hata); box-shadow: inset 0 0 0 2px var(--hata); }
  .tus.son { background: var(--hata); color: var(--zemin); }
  .uygulama { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 12px; border-radius: 12px; background: var(--yuzey-2); }
  .ana { min-height: 48px; border-radius: 14px; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; }
  .ana.tehlike { background: var(--hata); color: var(--zemin); }
</style>
