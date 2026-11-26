<!--
  "Odaları keşfet" sheet: a server's public room directory (`odalari_kesfet`), searchable, with Rooms / Spaces filter and a server
  switch (mine, matrix.org, or any typed server). A room address (#oda:sunucu or !kimlik) typed in the search joins directly.
  "Katıl" joins (the directory's server as `via`), a knock room opens the join request, a room I am already in just opens.
  This sheet replaced "Adresle odaya katıl".
  "Odaları keşfet" sayfası: bir sunucunun herkese açık oda dizini (`odalari_kesfet`); aranabilir, Odalar / Alanlar süzgeci ve sunucu
  seçimi var (benimki, matrix.org ya da yazılan herhangi biri). Aramaya oda adresi (#oda:sunucu ya da !kimlik) yazılırsa doğrudan
  katılınır. "Katıl" katılır (dizinin sunucusu `via` olarak), kapı çalınan odada katılma isteği açılır, zaten içinde olduğum oda açılır.
  Bu sayfa "Adresle odaya katıl"ın yerini aldı.
-->
<script lang="ts">
  import { alanaKatil, odalariKesfet } from "../api/komutlar";
  import type { BulunanOda } from "../api/tipler";
  import { alanlar } from "../durum/alanlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekAc } from "../durum/istekler.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let { onkapat, ilkTur = "" }: { onkapat: () => void; ilkTur?: "" | "oda" | "alan" } = $props();

  const benimSunucum = oturum.ben?.kullaniciId.split(":").slice(1).join(":") ?? "";
  const sunucular = [...new Set([benimSunucum, "matrix.org"].filter(Boolean))];
  let sunucu = $state(sunucular[0] ?? "matrix.org");
  let baskaAcik = $state(false);
  let baskaSunucu = $state("");
  let sorgu = $state("");
  // svelte-ignore state_referenced_locally
  let tur = $state<"" | "oda" | "alan">(ilkTur);
  let odalarListe = $state<BulunanOda[]>([]);
  let sonraki = $state<string | null>(null);
  let yukleniyor = $state(false);
  let hata = $state(false);
  let mesgul = $state<string | null>(null);

  const adres = $derived(/^[#!][^\s:]+:[^\s]+$/.test(sorgu.trim()) ? sorgu.trim() : null);

  let istekNo = 0;
  async function yukle(devam: boolean) {
    const bu = ++istekNo;
    yukleniyor = true;
    hata = false;
    try {
      const s = await odalariKesfet(sunucu, adres ? "" : sorgu.trim(), tur, devam ? sonraki : null);
      if (bu !== istekNo) return;
      odalarListe = devam ? [...odalarListe, ...s.odalar.filter((o) => !odalarListe.some((x) => x.odaId === o.odaId))] : s.odalar;
      sonraki = s.sonraki;
    } catch (e) {
      if (bu !== istekNo) return;
      console.error(e);
      hata = true;
      if (!devam) odalarListe = [];
    } finally {
      if (bu === istekNo) yukleniyor = false;
    }
  }

  // New search / server / filter → first page, a moment after typing stops. · Yeni arama / sunucu / süzgeç → ilk sayfa, yazma durunca.
  $effect(() => {
    void sunucu;
    void tur;
    const s = sorgu.trim();
    if (adres) return;
    const z = setTimeout(() => void yukle(false), s ? 350 : 0);
    return () => clearTimeout(z);
  });

  function baskaUygula(e: SubmitEvent) {
    e.preventDefault();
    const s = baskaSunucu.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    if (!s) return;
    sunucu = s;
    baskaAcik = false;
  }

  function ac(id: string, ad: string, alan: boolean) {
    onkapat();
    if (alan) {
      gezinme.sekmeSec("alanlar");
      alanlar.ac(id, ad);
    } else gezinme.odaAc(id);
  }

  async function katil(o: BulunanOda) {
    const ad = o.ad ?? o.adres ?? o.odaId;
    if (o.uye) return ac(o.odaId, ad, o.alan);
    if (o.katilim === "kapi") {
      onkapat();
      istekAc({ kimlik: o.adres ?? o.odaId, ad, via: [sunucu] });
      return;
    }
    mesgul = o.odaId;
    try {
      const id = await alanaKatil(o.adres ?? o.odaId, [sunucu]);
      ac(id, ad, o.alan);
    } catch (err) {
      hataBildir(err);
    } finally {
      mesgul = null;
    }
  }

  async function adresleKatil() {
    if (!adres) return;
    const d = adres;
    const via = d.startsWith("!") ? [d.slice(d.indexOf(":") + 1)] : [];
    mesgul = d;
    try {
      ac(await alanaKatil(d, via), d, false);
    } catch (err) {
      // Not open to everyone: offer to ask for permission. · Herkese açık değil: izin istemeyi öner.
      if ((err as { tur?: string }).tur === "giris") {
        onkapat();
        istekAc({ kimlik: d, ad: d, via });
      } else hataBildir(err);
    } finally {
      mesgul = null;
    }
  }

  const sayi = (n: number) => new Intl.NumberFormat(undefined, { notation: n >= 10000 ? "compact" : "standard" }).format(n);
</script>

<AltSayfa baslik={t("kesfet.baslik")} {onkapat}>
  <div class="kesfet">
    <form class="alan-kutu ara" onsubmit={(e) => { e.preventDefault(); if (adres) void adresleKatil(); }}>
      <Ikon ad="ara" boyut={20} />
      <input bind:value={sorgu} placeholder={t("kesfet.araYer")} aria-label={t("kesfet.araYer")} autocapitalize="off" autocomplete="off" spellcheck="false" enterkeyhint="search" />
      {#if yukleniyor}<span class="yuklenme"></span>{/if}
    </form>

    <div class="cipler" role="group" aria-label={t("kesfet.sunucu")}>
      {#each sunucular as s (s)}
        <button type="button" class="cip" class:secili={sunucu === s} aria-pressed={sunucu === s} onclick={() => (sunucu = s)}>{s}</button>
      {/each}
      {#if !sunucular.includes(sunucu)}<button type="button" class="cip secili" aria-pressed="true">{sunucu}</button>{/if}
      <button type="button" class="cip" aria-expanded={baskaAcik} onclick={() => (baskaAcik = !baskaAcik)}><Ikon ad="artik" boyut={16} />{t("kesfet.baska")}</button>
    </div>
    {#if baskaAcik}
      <form class="baska" onsubmit={baskaUygula}>
        <span class="alan-kutu"><input bind:value={baskaSunucu} placeholder={t("kesfet.baskaYer")} aria-label={t("kesfet.baskaYer")} inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" /></span>
        <button class="buton tonlu" type="submit">{t("kesfet.goster")}</button>
      </form>
    {/if}

    <div class="bolum" role="radiogroup" aria-label={t("kesfet.tur")}>
      {#each [["", "kesfet.hepsi"], ["oda", "kesfet.odalar"], ["alan", "kesfet.alanlar"]] as [d, a] (d)}
        <button type="button" role="radio" aria-checked={tur === d} class:secili={tur === d} onclick={() => (tur = d as typeof tur)}>{t(a as "kesfet.hepsi")}</button>
      {/each}
    </div>

    <ul class="liste">
      {#if adres}
        <li>
          <button class="satir" type="button" disabled={!!mesgul} onclick={() => void adresleKatil()}>
            <span class="yer"><Ikon ad="sohbet" boyut={22} /></span>
            <span class="metin"><b>{adres}</b><small>{t("kesfet.adresleKatil")}</small></span>
            {#if mesgul === adres}<span class="yuklenme"></span>{/if}
          </button>
        </li>
      {:else}
        {#each odalarListe as o (o.odaId)}
          {@const ad = o.ad ?? o.adres ?? o.odaId}
          <li class="oda">
            <Avatar harf={ad.replace(/^[#!]/, "").slice(0, 1).toUpperCase()} mxc={o.avatarMxc} boyut={44} />
            <div class="metin">
              <b>{ad}{#if o.alan}<span class="etiket">{t("kesfet.alanEtiket")}</span>{/if}</b>
              <small>{t("kesfet.uye", { n: sayi(o.uyeSayisi) })}{#if o.adres && o.adres !== ad} · {o.adres}{/if}</small>
              {#if o.konu}<p class="konu">{o.konu}</p>{/if}
            </div>
            <button class="buton {o.uye ? 'tonlu' : 'birincil'} kucuk" type="button" disabled={!!mesgul} onclick={() => void katil(o)}>
              {#if mesgul === o.odaId}<span class="yuklenme"></span>{/if}{o.uye ? t("kesfet.ac") : o.katilim === "kapi" ? t("kesfet.iste") : t("kesfet.katil")}
            </button>
          </li>
        {/each}
        {#if hata}
          <li class="bos">{t("kesfet.hata")} <button class="buton metin" type="button" onclick={() => void yukle(false)}>{t("giris.tekrarDene")}</button></li>
        {:else if !yukleniyor && odalarListe.length === 0}
          <li class="bos">{sorgu.trim() ? t("kesfet.yok") : t("kesfet.bos")}</li>
        {/if}
        {#if sonraki && !hata}
          <li class="devam"><button class="buton metin" type="button" disabled={yukleniyor} onclick={() => void yukle(true)}>{t("kesfet.dahaFazla")}</button></li>
        {/if}
      {/if}
    </ul>
  </div>
</AltSayfa>

<style>
  .kesfet { display: grid; gap: 12px; }
  .ara { display: flex; align-items: center; gap: 10px; padding: 0 14px; color: var(--yazi-2); }
  .ara input { flex: 1; min-width: 0; height: 48px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .cipler { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 0 4px; }
  .cip { flex: none; min-height: 40px; padding: 0 14px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; background: var(--yuzey-2); color: var(--yazi); font-size: .875rem; font-weight: 500; }
  .cip.secili { background: var(--vurgu); color: var(--vurgu-ustu, #fff); }
  .baska { display: flex; gap: 8px; }
  .baska .alan-kutu { flex: 1; min-width: 0; }
  .baska input { width: 100%; height: 44px; padding: 0 14px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .bolum { display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px; gap: 4px; border-radius: 16px; background: var(--yuzey-2); }
  .bolum button { min-height: 40px; border-radius: 12px; font-size: .875rem; font-weight: 600; color: var(--yazi-2); }
  .bolum button.secili { background: var(--yuzey-1); color: var(--yazi); }
  .liste { list-style: none; margin: 0 -8px; padding: 0; display: grid; gap: 2px; }
  .satir { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 16px; text-align: left; color: var(--yazi); }
  .satir:hover, .satir:focus-visible { background: var(--yuzey-2); }
  .yer { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--yuzey-2); color: var(--vurgu); flex: none; }
  .oda { display: flex; align-items: flex-start; gap: 12px; padding: 10px 8px; }
  .metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .metin b, .metin small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metin b { font-weight: 600; font-size: .9375rem; }
  .metin small { font-size: .8125rem; color: var(--yazi-2); }
  .etiket { margin-left: 6px; padding: 1px 6px; border-radius: 6px; background: var(--yuzey-2); font-size: .6875rem; font-weight: 600; color: var(--yazi-2); vertical-align: 2px; }
  .konu { margin: 2px 0 0; font-size: .8125rem; line-height: 1.4; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .kucuk { flex: none; min-height: 40px; min-width: 72px; padding: 0 14px; align-self: center; }
  .bos { padding: 24px 8px; font-size: .875rem; color: var(--yazi-2); text-align: center; }
  .devam { display: flex; justify-content: center; }
</style>
