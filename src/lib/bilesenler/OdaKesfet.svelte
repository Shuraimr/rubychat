<!--
  "Odaları keşfet" sheet: a server's public room directory (`odalari_kesfet`), searchable, with Rooms / Spaces filter, a server
  switch (mine, matrix.org, or any typed server), the official rubychat space card at the top, and tap-to-preview room details.
  A room address (#oda:sunucu or !kimlik) typed in the search joins directly.
  "Katıl" joins (the directory's server as `via`), a knock room opens the join request, a room I am already in just opens.
  "Odaları keşfet" sayfası: bir sunucunun herkese açık oda dizini (`odalari_kesfet`); aranabilir, Odalar / Alanlar süzgeci, sunucu
  seçimi (benimki, matrix.org ya da yazılan herhangi biri), en üstte resmi rubychat alanı kartı ve katılmadan oda önizlemesi var.
  Aramaya oda adresi (#oda:sunucu ya da !kimlik) yazılırsa doğrudan katılınır.
  "Katıl" katılır (dizinin sunucusu `via` olarak), kapı çalınan odada katılma isteği açılır, zaten içinde olduğum oda açılır.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { alanIcerigi, alanaKatil, odalariKesfet, odaOnizleme } from "../api/komutlar";
  import type { BulunanOda, OnizlemeMesaji } from "../api/tipler";
  import { alanlar } from "../durum/alanlar.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekAc } from "../durum/istekler.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { RUBYCHAT_ALAN_AD, RUBYCHAT_ALAN_ID, rubychatUyeMi, rubychatVia } from "../durum/rubychatAlan";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import { goreliZaman } from "../zaman-bicim";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";
  import Maskot from "./Maskot.svelte";

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
  // The server the shown list really came from (the chip may already point at another one while a new list loads): it is the `via` of "Katıl".
  // Gösterilen listenin gerçekte geldiği sunucu (yeni liste yüklenirken çip başka sunucuyu gösteriyor olabilir): "Katıl"ın `via`sı odur.
  let listeSunucusu = $state("");

  // Official rubychat space card metadata (fetched quietly from space hierarchy if available).
  // Resmi rubychat alanı kartının üst verisi (alınabiliyorsa alan hiyerarşisinden sessizce çekilir).
  let rubychatOdaSayisi = $state(0);
  let rubychatUyeSayisi = $state(0);
  const rubychatUye = $derived(rubychatUyeMi());
  const rubychatKartGorunur = $derived(!tercihler.d.rubychatKartiKapali && !sorgu.trim());

  // Room preview sheet state · Oda önizleme alt sayfası durumu
  let onizlenen = $state<BulunanOda | null>(null);
  let onizlemeMesajlar = $state<OnizlemeMesaji[]>([]);
  let onizlemeYukleniyor = $state(false);
  let onizlemeIstekNo = 0;

  // #alias:server, !id:server, or a Room v12 id (`!hash`, no server part). · #takma:sunucu, !kimlik:sunucu ya da Room v12 kimliği (`!özet`, sunucu kısmı yok).
  const adres = $derived(/^(#[^\s:]+:[^\s]+|![^\s:]+(:[^\s]+)?)$/.test(sorgu.trim()) ? sorgu.trim() : null);

  onMount(() => {
    if (tercihler.d.rubychatKartiKapali) return;
    const onbellek = alanlar.icerikler.get(RUBYCHAT_ALAN_ID);
    if (onbellek) {
      rubychatOdaSayisi = onbellek.cocuklar.length || onbellek.alan?.altSayisi || 0;
      rubychatUyeSayisi = onbellek.alan?.uyeSayisi ?? 0;
      return;
    }
    void alanIcerigi(RUBYCHAT_ALAN_ID)
      .then((s) => {
        alanlar.icerikler.set(RUBYCHAT_ALAN_ID, s);
        rubychatOdaSayisi = s.cocuklar.length || s.alan?.altSayisi || 0;
        rubychatUyeSayisi = s.alan?.uyeSayisi ?? 0;
      })
      .catch(() => {
        /* Space metadata unavailable before joining: card falls back to "Alan". · Katılmadan alan bilgisi alınamadı: kart "Alan" gösterir. */
      });
  });

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
      listeSunucusu = s.sunucu || sunucu;
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
    if (adres) {
      // An address replaces the list: an answer still on the way must not leave the spinner on. · Adres listeyi değiştirir: yoldaki yanıt yükleme göstergesini açık bırakmamalı.
      ++istekNo;
      yukleniyor = false;
      return;
    }
    // The server changed: the old server's rooms must not stay clickable under the new chip. · Sunucu değişti: eski sunucunun odaları yeni çipin altında tıklanabilir kalmamalı.
    // untrack: loading sets listeSunucusu; it must not re-run this effect. · untrack: yükleme listeSunucusu'nu yazar; bu efekti yeniden çalıştırmamalı.
    if (untrack(() => listeSunucusu) && untrack(() => listeSunucusu) !== sunucu) {
      odalarListe = [];
      sonraki = null;
    }
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
    onizlenen = null;
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
      onizlenen = null;
      onkapat();
      istekAc({ kimlik: o.adres ?? o.odaId, ad, via: [listeSunucusu || sunucu] });
      return;
    }
    mesgul = o.odaId;
    try {
      const id = await alanaKatil(o.adres ?? o.odaId, [listeSunucusu || sunucu]);
      ac(id, ad, o.alan);
    } catch (err) {
      hataBildir(err);
    } finally {
      mesgul = null;
    }
  }

  async function rubychatKatil() {
    if (rubychatUye) return ac(RUBYCHAT_ALAN_ID, RUBYCHAT_ALAN_AD, true);
    mesgul = RUBYCHAT_ALAN_ID;
    try {
      const id = await alanaKatil(RUBYCHAT_ALAN_ID, rubychatVia(oturum.ben?.kullaniciId));
      ac(id, RUBYCHAT_ALAN_AD, true);
    } catch (err) {
      hataBildir(err);
    } finally {
      mesgul = null;
    }
  }

  function rubychatOdalariGor() {
    ac(RUBYCHAT_ALAN_ID, RUBYCHAT_ALAN_AD, true);
  }

  function onizle(o: BulunanOda) {
    onizlenen = o;
    onizlemeMesajlar = [];
    const bu = ++onizlemeIstekNo;
    if (o.alan) {
      onizlemeYukleniyor = false;
      return;
    }
    onizlemeYukleniyor = true;
    // `oda_onizleme` currently returns cached messages for joined rooms and errors for unjoined ones; fail quietly to the closed-history note.
    // `oda_onizleme` şu an katılınmış odaların önbellekteki mesajlarını döner, katılınmayanlarda hata verir; sessizce önizlemeye kapalı notuna düş.
    void odaOnizleme(o.odaId, 3)
      .then((m) => {
        if (bu === onizlemeIstekNo) onizlemeMesajlar = m.slice(-3);
      })
      .catch(() => {
        if (bu === onizlemeIstekNo) onizlemeMesajlar = [];
      })
      .finally(() => {
        if (bu === onizlemeIstekNo) onizlemeYukleniyor = false;
      });
  }

  async function adresleKatil() {
    if (!adres) return;
    const d = adres;
    const via = d.startsWith("!") && d.includes(":") ? [d.slice(d.indexOf(":") + 1)] : [];
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

  const rubychatMeta = $derived.by(() => {
    if (rubychatOdaSayisi > 0 && rubychatUyeSayisi > 0) {
      return t("rubychatAlan.meta", { oda: sayi(rubychatOdaSayisi), uye: sayi(rubychatUyeSayisi) });
    }
    if (rubychatOdaSayisi > 0) return t("rubychatAlan.metaOda", { oda: sayi(rubychatOdaSayisi) });
    if (rubychatUyeSayisi > 0) return t("rubychatAlan.metaUye", { uye: sayi(rubychatUyeSayisi) });
    return t("kesfet.alanEtiket");
  });
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

    {#if rubychatKartGorunur}
      <section class="rc-kart" aria-label={RUBYCHAT_ALAN_AD}>
        <div class="rc-ust">
          <div class="rc-maskot">
            <Maskot poz="selam" boyut={44} />
          </div>
          <div class="rc-baslik">
            <strong>{RUBYCHAT_ALAN_AD}</strong>
            <span>{rubychatMeta}</span>
          </div>
          <button
            class="simge-dugme rc-kapat"
            type="button"
            onclick={() => tercihler.yaz("rubychatKartiKapali", true)}
            aria-label={t("rubychatAlan.kapat")}
          >
            <Ikon ad="kapat" boyut={18} />
          </button>
        </div>
        <p class="rc-metin">{t("rubychatAlan.aciklama")}</p>
        <div class="rc-dugmeler">
          <button
            class="buton {rubychatUye ? 'tonlu' : 'birincil'} rc-dugme"
            type="button"
            disabled={!!mesgul}
            onclick={() => void rubychatKatil()}
          >
            {#if mesgul === RUBYCHAT_ALAN_ID}<span class="yuklenme"></span>{/if}
            {rubychatUye ? t("rubychatAlan.ac") : t("rubychatAlan.katil")}
          </button>
          {#if !rubychatUye}
            <button
              class="buton cizgili rc-dugme"
              type="button"
              disabled={!!mesgul}
              onclick={rubychatOdalariGor}
            >
              {t("rubychatAlan.odalariGor")}
            </button>
          {/if}
        </div>
      </section>
    {/if}

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
            <button
              class="oda-bilgi"
              type="button"
              onclick={() => onizle(o)}
              aria-label={t("kesfet.onizle", { ad })}
            >
              <Avatar harf={ad.replace(/^[#!]/, "").slice(0, 1).toUpperCase()} mxc={o.avatarMxc} boyut={44} />
              <div class="metin">
                <b>{ad}{#if o.alan}<span class="etiket">{t("kesfet.alanEtiket")}</span>{/if}</b>
                <small>{t("kesfet.uye", { n: sayi(o.uyeSayisi) })}{#if o.adres && o.adres !== ad} · {o.adres}{/if}</small>
                {#if o.konu}<p class="konu">{o.konu}</p>{/if}
              </div>
            </button>
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

{#if onizlenen}
  {@const o = onizlenen}
  {@const ad = o.ad ?? o.adres ?? o.odaId}
  <AltSayfa baslik={ad} onkapat={() => (onizlenen = null)}>
    <div class="oniz-ust">
      <Avatar harf={ad.replace(/^[#!]/, "").slice(0, 1).toUpperCase()} mxc={o.avatarMxc} boyut={56} />
      <div class="oniz-kimlik">
        <strong>{ad}{#if o.alan}<span class="etiket">{t("kesfet.alanEtiket")}</span>{/if}</strong>
        <span>{#if o.adres}{o.adres} · {/if}{t("kesfet.uye", { n: sayi(o.uyeSayisi) })}</span>
      </div>
    </div>

    {#if o.konu}
      <p class="oniz-konu">{o.konu}</p>
    {/if}

    {#if !o.alan}
      {#if onizlemeYukleniyor}
        <p class="oniz-not"><span class="yuklenme"></span>{t("kesfet.onizlemeYukleniyor")}</p>
      {:else if onizlemeMesajlar.length > 0}
        <section class="oniz-mesajlar">
          <h3>{t("kesfet.sonMesajlar")}</h3>
          <div class="oniz-kutu">
            {#each onizlemeMesajlar as m (m.olayId)}
              <div class="oniz-satir">
                <div class="oniz-meta">
                  <strong>{m.gonderenAd}</strong>
                  <span>{goreliZaman(m.zaman)}</span>
                </div>
                <p>{m.metin}</p>
              </div>
            {/each}
          </div>
        </section>
      {:else}
        <p class="oniz-not">{t("kesfet.onizlemeKapali")}</p>
      {/if}
    {/if}

    {#snippet altlik()}
      <button
        class="buton {o.uye ? 'tonlu' : 'birincil'}"
        type="button"
        disabled={!!mesgul}
        onclick={() => void katil(o)}
      >
        {#if mesgul === o.odaId}<span class="yuklenme"></span>{/if}
        {o.uye ? t("kesfet.ac") : o.katilim === "kapi" ? t("kesfet.iste") : t("kesfet.katil")}
      </button>
    {/snippet}
  </AltSayfa>
{/if}

<style>
  .kesfet { display: grid; gap: 12px; }
  .ara { display: flex; align-items: center; gap: 10px; padding: 0 14px; color: var(--yazi-2); }
  .ara input { flex: 1; min-width: 0; height: 48px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .cipler { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 0 4px; }
  .cip { flex: none; min-height: 44px; padding: 0 14px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; background: var(--yuzey-2); color: var(--yazi); font-size: .875rem; font-weight: 500; }
  .cip.secili { background: var(--vurgu); color: var(--vurgu-ustu, #fff); }
  .baska { display: flex; gap: 8px; }
  .baska .alan-kutu { flex: 1; min-width: 0; }
  /* The global .buton is width:100%: here it must keep its own size beside the field. · Genel .buton width:100%: burada alanın yanında kendi boyutunu korumalı. */
  .baska .buton { width: auto; flex: none; min-height: 44px; }
  .baska input { width: 100%; height: 44px; padding: 0 14px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .bolum { display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px; gap: 4px; border-radius: 16px; background: var(--yuzey-2); }
  .bolum button { min-height: 44px; border-radius: 12px; font-size: .875rem; font-weight: 600; color: var(--yazi-2); }
  .bolum button.secili { background: var(--yuzey-1); color: var(--yazi); }

  /* Official rubychat space card · Resmi rubychat alanı kartı */
  .rc-kart {
    background: var(--yuzey-2);
    border: 1px solid var(--kenar);
    border-radius: 16px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .rc-ust {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .rc-maskot {
    flex: none;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: var(--yuzey-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .rc-baslik {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .rc-baslik strong {
    font-family: var(--baslik-tipi);
    font-size: 1rem;
    font-weight: 600;
    color: var(--yazi);
  }
  .rc-baslik span {
    font-size: .8125rem;
    color: var(--yazi-2);
  }
  .rc-kapat {
    margin: -6px -6px 0 0;
    align-self: flex-start;
    color: var(--yazi-2);
  }
  .rc-metin {
    font-size: .875rem;
    line-height: 1.45;
    color: var(--yazi-2);
  }
  .rc-dugmeler {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .rc-dugme {
    flex: 1 1 8rem;
    width: auto;
    min-height: 44px;
  }

  .liste { list-style: none; margin: 0 -8px; padding: 0; display: grid; gap: 2px; }
  .satir { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 16px; text-align: left; color: var(--yazi); }
  .satir:hover, .satir:focus-visible { background: var(--yuzey-2); }
  .yer { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--yuzey-2); color: var(--vurgu); flex: none; }
  .oda { display: flex; align-items: center; gap: 8px; padding: 2px 8px 2px 0; }
  .oda-bilgi {
    flex: 1;
    min-width: 0;
    min-height: 56px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px;
    border-radius: 16px;
    text-align: left;
    color: var(--yazi);
  }
  @media (hover: hover) {
    .oda-bilgi:hover { background: var(--yuzey-2); }
  }
  .oda-bilgi:active { background: var(--yuzey-3); }
  .metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .metin b, .metin small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metin b { font-weight: 600; font-size: .9375rem; }
  .metin small { font-size: .8125rem; color: var(--yazi-2); }
  .etiket { margin-left: 6px; padding: 1px 6px; border-radius: 6px; background: var(--yuzey-2); font-size: .6875rem; font-weight: 600; color: var(--yazi-2); vertical-align: 2px; }
  .konu { margin: 2px 0 0; font-size: .8125rem; line-height: 1.4; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .kucuk { flex: none; width: auto; min-height: 44px; min-width: 72px; padding: 0 14px; align-self: center; }
  .bos { padding: 24px 8px; font-size: .875rem; color: var(--yazi-2); text-align: center; }
  .devam { display: flex; justify-content: center; }

  /* Room preview sheet · Oda önizleme alt sayfası */
  .oniz-ust {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .oniz-kimlik {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .oniz-kimlik strong {
    font-family: var(--baslik-tipi);
    font-size: 1.0625rem;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .oniz-kimlik span {
    font-size: .8125rem;
    color: var(--yazi-2);
    overflow-wrap: anywhere;
  }
  .oniz-konu {
    font-size: .9375rem;
    line-height: 1.5;
    color: var(--yazi);
    overflow-wrap: anywhere;
  }
  .oniz-mesajlar {
    display: grid;
    gap: 8px;
  }
  .oniz-mesajlar h3 {
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--yazi-2);
  }
  .oniz-kutu {
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    border-radius: 16px;
    overflow: hidden;
  }
  .oniz-satir {
    padding: 10px 14px;
    display: grid;
    gap: 4px;
  }
  .oniz-satir + .oniz-satir {
    border-top: 1px solid var(--kenar-ince);
  }
  .oniz-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .oniz-meta strong {
    font-size: .8125rem;
    font-weight: 600;
    color: var(--yazi);
  }
  .oniz-meta span {
    font-size: .75rem;
    color: var(--yazi-2);
    flex: none;
  }
  .oniz-satir p {
    font-size: .875rem;
    line-height: 1.4;
    color: var(--yazi-2);
    overflow-wrap: anywhere;
  }
  .oniz-not {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: .875rem;
    color: var(--yazi-2);
  }
</style>
