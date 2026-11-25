<!--
  Sign in with the phone: QR to the account page + short code; the app waits until it is approved in a browser (matrix/cihaz_giris.rs).
  Telefonla giriş: hesap sayfasının QR'ı + kısa kod; uygulama tarayıcıda onaylanana dek bekler (matrix/cihaz_giris.rs).
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cihazGirisiBaslat, cihazGirisiBekle, cihazGirisiIptal } from "../api/komutlar";
  import type { CihazKodu, Hata } from "../api/tipler";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { disariAc } from "../disAc";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t, type Anahtar } from "../i18n";
  import { panoyaYaz } from "../pano";
  import { qr } from "../qr";

  let { sunucu, onkapat }: { sunucu: string; onkapat: () => void } = $props();

  let kod = $state<CihazKodu | null>(null);
  let hata = $state<Anahtar | null>(null);
  let kalan = $state(0);
  let bitti = false;
  let tur = 0;

  const kare = $derived(kod ? qr(kod.adres) : null);
  const yol = $derived(kare ? kare.map((s, y) => s.map((v, x) => (v ? `M${x} ${y}h1v1h-1z` : "")).join("")).join("") : "");

  function hataAnahtari(e: unknown): Anahtar {
    const h = e as Hata;
    if (h.mesaj?.includes("desteklenmiyor")) return "telefonla.desteksiz";
    if (h.mesaj === "ret") return "telefonla.ret";
    if (h.mesaj === "sure") return "telefonla.sure";
    return `hata.${h.tur ?? "diger"}` as Anahtar;
  }

  async function basla() {
    const bu = ++tur;
    kod = null;
    hata = null;
    try {
      const k = await cihazGirisiBaslat(sunucu);
      if (bitti || bu !== tur) return;
      kod = k;
      kalan = k.saniye;
      const ben = await cihazGirisiBekle();
      bitti = true;
      sifreleme.girisSonrasiDogrula = true;
      oturum.girildi(ben);
    } catch (e) {
      if (bitti || bu !== tur || (e as Hata).mesaj === "iptal") return;
      console.error(e);
      hata = hataAnahtari(e);
    }
  }

  let katman = 0;
  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
    void basla();
    const z = setInterval(() => (kalan = Math.max(0, kalan - 1)), 1000);
    return () => clearInterval(z);
  });
  onDestroy(() => {
    if (!bitti) void cihazGirisiIptal().catch(() => {});
    bitti = true;
    gezinme.katmanBirak(katman);
  });

  async function kopyala() {
    try {
      await panoyaYaz(kod?.kod ?? "");
      bildirim.goster(t("bildirim.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }
  const ac = () => kod && void disariAc(kod.adres, "sekme").catch(() => bildirim.goster(t("hata.diger"), 4000, { tur: "hata" }));
</script>

<section class="kart">
  <header><button class="simge-dugme" type="button" aria-label={t("telefonla.geri")} onclick={() => gezinme.katmanKapat(katman)}><Ikon ad="geri" /></button><h1>{t("telefonla.baslik")}</h1></header>
  {#if hata}
    <div class="merkez">
      <Maskot poz="hata" boyut={140} />
      <p role="alert">{t(hata)}</p>
      {#if hata !== "telefonla.desteksiz"}<button class="buton birincil" type="button" onclick={() => void basla()}>{t("telefonla.yeniKod")}</button>{/if}
    </div>
  {:else}
    <ol>
      <li>{t("telefonla.adim1")}</li>
      <li>{t(kod && !kod.kodYazilir ? "telefonla.adim2Hazir" : "telefonla.adim2")}</li>
      <li>{t("telefonla.adim3", { sunucu })}</li>
    </ol>
    <div class="qr" class:bekle={!kod}>
      {#if kare}<svg viewBox="-4 -4 {kare.length + 8} {kare.length + 8}" role="img" aria-label={t("telefonla.qr")} shape-rendering="crispEdges"><path d={yol} fill="#000" /></svg>{:else}<span class="yuklenme"></span>{/if}
    </div>
    <button class="kod" type="button" disabled={!kod} aria-label={t("telefonla.kodKopyala", { kod: kod?.kod ?? "" })} onclick={kopyala}><span>{kod?.kod ?? "······"}</span><Ikon ad="kopya" boyut={20} /></button>
    <button class="buton tonlu" type="button" disabled={!kod} onclick={ac}>{t("telefonla.tarayici")}</button>
    <p class="bekliyor" role="status"><span class="yuklenme"></span>{t("telefonla.bekliyor")}{#if kod} · {Math.floor(kalan / 60)}:{String(kalan % 60).padStart(2, "0")}{/if}</p>
    <p class="uyari">{t("telefonla.uyari")}</p>
  {/if}
</section>

<style>
  .kart { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 700px) { .kart { margin-block: auto; } }
  header { display: flex; align-items: center; gap: 4px; margin-left: -10px; }
  h1 { font-size: 1.25rem; font-weight: 600; }
  ol { margin: 0; padding-left: 1.25rem; display: grid; gap: 4px; font-size: .9375rem; line-height: 1.4; color: var(--yazi-2); }
  /* A QR is always dark on white: cameras need the contrast in every theme. · QR hep beyaz üstüne koyudur: kameralar her temada karşıtlık ister. */
  .qr { align-self: center; width: min(220px, 60vw); aspect-ratio: 1; border-radius: 24px; background: #fff; overflow: hidden; display: grid; place-items: center; color: #000; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .qr.bekle { background: var(--yuzey-2); color: var(--yazi); }
  .kod { align-self: center; min-height: 56px; padding: 0 1.25rem; border-radius: 20px; display: inline-flex; align-items: center; gap: .75rem; background: var(--yuzey-2); color: var(--yazi); }
  .kod span { font-family: var(--mono-tipi); font-size: 1.75rem; font-weight: 600; letter-spacing: .15em; }
  .bekliyor { display: flex; align-items: center; justify-content: center; gap: .5rem; font-size: .875rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .uyari { font-size: .8125rem; line-height: 1.4; color: var(--yazi-2); text-align: center; }
  .merkez { display: grid; justify-items: center; gap: 1rem; padding: 2rem 0; text-align: center; }
</style>
