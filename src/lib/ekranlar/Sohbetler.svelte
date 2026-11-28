<!--
  Chat list: title, folder tabs (Telegram style; hide / reorder with the sliders button) over a swipeable pager with one page per folder. On phones
  the bottom dock holds search, new chat and the profile; on wider shapes the search pill + hexagon stay at the bottom of this column.
  Sohbet listesi: başlık, klasör sekmeleri (Telegram tarzı; ayar düğmesiyle gizle / sırala) ve klasör başına bir sayfası olan kaydırılabilir sayfalayıcı.
  Telefonda arama, yeni sohbet ve profil alt dock'tadır; geniş şekillerde arama hapı + altıgen bu sütunun altında kalır.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { odaSabitle, okunduIsaretle } from "../api/komutlar";
  import type { OdaOzeti } from "../api/tipler";
  import BaglamMenusu, { type MenuEylemi } from "../bilesenler/BaglamMenusu.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import EsitlemeSeridi from "../bilesenler/EsitlemeSeridi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Zil from "../bilesenler/Zil.svelte";
  import KlasorSekmeleri, { type Sekme } from "../bilesenler/KlasorSekmeleri.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { klavye } from "../klavyeKisayol.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import SohbetSatiri from "../bilesenler/SohbetSatiri.svelte";
  import Sayfalayici from "../bilesenler/Sayfalayici.svelte";
  import SohbetAramasi from "./SohbetAramasi.svelte";
  import YeniSohbet from "../bilesenler/YeniSohbet.svelte";
  import type { YeniSayfa } from "../bilesenler/YeniMenusu.svelte";
  import OdaKesfet from "../bilesenler/OdaKesfet.svelte";
  import OdaOlustur from "../bilesenler/OdaOlustur.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { altKaydirma, kabuk } from "../durum/kabuk.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import { odalar, type Suzgec } from "../durum/odalar.svelte";
  import { sohbetChipleri, type SekmeId } from "../durum/sohbetChipleri.svelte";
  import { t, type Anahtar as TrAnahtar } from "../i18n";
  import { bildirimIzni, bildirimIzniAc } from "../bildirim-sistem";
  import Alanlar from "./Alanlar.svelte";
  import AlanGorunumu from "./AlanGorunumu.svelte";

  // Notification permission card (design 09). · Bildirim izni kartı (tasarım 09).
  let izinKarti = $state(false);
  onMount(() => {
    bildirimIzni().then((d) => (izinKarti = d === "verilmedi")).catch(() => {});
  });
  async function izinIste() {
    try {
      izinKarti = (await bildirimIzniAc()) === "verilmedi";
    } catch {
      izinKarti = false;
    }
  }

  let yeniSayfa = $state<YeniSayfa | null>(null);
  // Opened by the Vim ":yeni" command · Vim ":yeni" komutuyla açılır
  $effect(() => {
    if (!klavye.yeniSohbetBekleyen) return;
    klavye.yeniSohbetBekleyen = false;
    yeniSayfa = "kisi";
  });

  // Long press on a row: pin it (quick switcher, top of the list) · Satıra uzun bas: sabitle (hızlı geçiş, listenin başı)
  let menu = $state<{ x: number; y: number; eylemler: MenuEylemi[] } | null>(null);
  function odaMenusu(o: OdaOzeti, x: number, y: number) {
    if (o.davet) return;
    const eylemler: MenuEylemi[] = [{ ikon: "sabitle", etiket: t(o.sabit ? "sohbetler.sabitKaldir" : "sohbetler.sabitle"), calistir: () => void odaSabitle(o.id, !o.sabit).catch(() => bildirim.goster(t("sohbetler.sabitHata"), 4000, { tur: "hata" })) }];
    if (o.okunmamis > 0) eylemler.push({ ikon: "onay", etiket: t("sohbetler.okundu"), calistir: () => void okunduIsaretle(o.id).catch(() => {}) });
    menu = { x, y, eylemler };
  }
  let cipDuzenle = $state(false);
  const telefon = $derived(gezinme.sekil === "telefon");

  // Skeleton only after 400 ms of waiting. · İskelet yalnızca 400 ms beklenince.
  let iskeletZamani = $state(false);
  onMount(() => {
    const z = setTimeout(() => (iskeletZamani = true), 400);
    return () => clearTimeout(z);
  });

  // ---- Folder tabs · Klasör sekmeleri ----
  const adlar: Record<SekmeId, TrAnahtar> = { tumu: "sohbetler.tumu", okunmamis: "sohbetler.okunmamis", kisiler: "sohbetler.kisiler", gruplar: "sohbetler.gruplar", davetler: "sohbetler.davetler", alanlar: "alanlar.baslik" };
  const sayiOf = (id: SekmeId) => (id === "okunmamis" ? odalar.okunmamisOda : id === "davetler" ? odalar.davetler.length : 0);

  let tepeYuk = $state(132);
  let secili = $state<string>("tumu");
  /** Fractional folder position while the finger swipes (drives the tab indicator) · Parmak kaydırırken kesirli klasör konumu (sekme göstergesini sürer) */
  let ilerleme = $state(0);

  // Spaces are tabs only on phones: the rail already reaches "Alanlar" on the wider shapes (no repeated destinations).
  // Alanlar yalnızca telefonda sekmedir: geniş şekillerde ray "Alanlar"a zaten ulaştırır (hedefler tekrarlanmaz).
  const sekmeler = $derived.by<Sekme[]>(() => {
    const sonuc: Sekme[] = [];
    for (const id of sohbetChipleri.gorunur) {
      if (id === "davetler" && odalar.davetler.length === 0 && secili !== "davetler") continue;
      // "Alanlar" itself is a dock / rail destination; only the joined spaces become folders. · "Alanlar" zaten dock / ray hedefi; yalnızca katılınan alanlar klasör olur.
      if (id !== "alanlar") sonuc.push({ id, ad: t(adlar[id]), sayi: sayiOf(id) });
      if (id === "alanlar" && telefon && sohbetChipleri.alanSekmeleri) {
        for (const a of alanlar.ust) sonuc.push({ id: `alan:${a.id}`, ad: a.ad, acilir: true });
      }
    }
    return sonuc;
  });
  // A tab that disappeared (hidden, space left) falls back to "Tümü". · Kaybolan sekme "Tümü"ne düşer.
  $effect(() => {
    if (!sekmeler.some((s) => s.id === secili)) secili = "tumu";
  });
  // Filter tabs drive the room list filter. · Süzgeç sekmeleri oda listesi süzgecini sürer.
  $effect(() => {
    if (secili !== "alanlar" && !secili.startsWith("alan:")) odalar.suzgec = secili as Suzgec;
  });
  // Keep the top-level space list fresh (debounced). · Üst düzey alan listesini taze tut (bekletmeli).
  $effect(() => {
    const l = odalar.liste;
    const z = setTimeout(() => alanlar.listeDegisti(l), 250);
    return () => clearTimeout(z);
  });

  function sekmeSec(id: string) {
    secili = id;
    kabuk.altGizli = false;
  }
  // On phones a space opened from here is shown by the Alanlar page: go there (only when it opens, so swiping back stays possible).
  // Telefonda buradan açılan alanı Alanlar sayfası gösterir: oraya git (yalnızca açılırken; geri kaydırmak mümkün kalsın).
  let oncekiAlan: string | null = null;
  $effect(() => {
    const id = alanlar.gecerli?.id ?? null;
    if (telefon && id && !oncekiAlan) gezinme.sekmeSec("alanlar");
    oncekiAlan = id;
  });

  const hata = $derived(odalar.esitleme.durum === "hata" && !odalar.ilkListeGeldi);
  const cevrimdisiBos = $derived(odalar.esitleme.durum === "cevrimdisi" && !odalar.ilkListeGeldi);
</script>

<div class="sohbetler">
  {#if alanlar.gecerli && !telefon}
    <!-- Deeper inside a space: the full space screen with its own ← covers the tabs. · Bir alanın içinde: kendi ←'sı olan tam alan ekranı sekmeleri örter. -->
    <Alanlar />
  {:else}
    <!-- Two storeys: the title row slides away while reading down (with the dock), the folder tray stays. Lists scroll under both. -->
    <!-- İki kat: başlık satırı aşağı okurken (dock ile birlikte) kayıp gider, klasör tepsisi kalır. Listeler ikisinin altına kayar. -->
    <div class="tepe" class:kompakt={telefon && kabuk.altGizli} bind:clientHeight={tepeYuk}>
      <header class="ust" inert={telefon && kabuk.altGizli}>
        <span class="basliklar">
          <h1>{t("sohbetler.baslik")}</h1>
          {#if odalar.ilkListeGeldi}<span class="ozet" class:var={odalar.okunmamisOda > 0}>{odalar.okunmamisOda > 0 ? t("sohbetler.ozetOkunmamis", { o: odalar.okunmamisOda, n: odalar.suz("tumu").length }) : t("sohbetler.ozet", { n: odalar.suz("tumu").length })}</span>{/if}
        </span>
        <span class="ust-eylemler">
          <!-- Bell stays here only on portrait phones; wider layouts and landscape phones keep it in the rail/strip. -->
          <!-- Zil burada yalnızca dikey telefonda durur; geniş düzenlerde ve yatay telefonda rayda/şerittedir. -->
          {#if telefon}<Zil />{/if}
          <button class="duzenle" aria-label={t("sohbetler.cipEkle")} onclick={() => (cipDuzenle = true)}><Ikon ad="ayar" boyut={22} /></button>
        </span>
      </header>
      <div class="tepsi"><KlasorSekmeleri {sekmeler} {secili} {ilerleme} sec={sekmeSec} /><EsitlemeSeridi /></div>
    </div>
    <div class="perde" aria-hidden="true"></div>

    <!-- Folders. On phones a swipe belongs to the main pages (Sohbetler · Alanlar · Ben) unless the folder swipe is switched on; folders are then chosen from the tray. -->
    <!-- Klasörler. Telefonda kaydırma, klasör kaydırması açılmadıkça ana sayfalarındır (Sohbetler · Alanlar · Ben); klasör tepsiden seçilir. -->
    <Sayfalayici sayfalar={sekmeler.map((s) => s.id)} {secili} sec={sekmeSec} ilerle={(f) => (ilerleme = f)} kilitli={telefon && !sohbetChipleri.klasorKaydir}>
      {#snippet sayfa(id)}
        {@const alan = id.startsWith("alan:") ? alanlar.ust.find((a) => `alan:${a.id}` === id) : undefined}
        {@const satirlar = odalar.suz(id as Suzgec)}
        <div class="sayfa" class:alan={!!alan} style="--tepe-yer:{tepeYuk}px">
          {#if alan}
            <AlanGorunumu adim={{ id: alan.id, ad: alan.ad }} gomulu />
          {:else}
            <div class="liste" use:altKaydirma>
              {#if izinKarti}
                <div class="izin-karti">
                  <span class="izin-simge"><Ikon ad="zil" boyut={20} /></span>
                  <span class="izin-metin"><b>{t("bildirim.izinBaslik")}</b><small>{t("bildirim.izinAciklama")}</small></span>
                  <button class="izin-ac" onclick={izinIste}>{t("bildirim.izinAc")}</button>
                </div>
              {/if}
              {#if odalar.davetler.length > 0 && id === "tumu"}
                <button class="istek-karti" data-dalga onclick={() => istekler.ac()}>
                  <span class="yuzler">{#each odalar.davetler.slice(0, 3) as d (d.id)}<Avatar harf={d.avatarHarf} mxc={d.avatarMxc} boyut={36} />{/each}</span>
                  <span class="izin-metin"><b>{t("istek.baslik")}</b><small>{odalar.davetler.length === 1 ? t("istek.kartTek", { ad: odalar.davetler[0].ad }) : t("istek.kart", { n: odalar.davetler.length })}</small></span>
                  <span class="rozet">{odalar.davetler.length}</span>
                </button>
              {/if}

              {#if hata}
                <BosDurum maskot="hata" baslik={t("sohbetler.yuklenemedi")} metin={t("sohbetler.yuklenemediAlt")} eylem={t("eylem.tekrarDene")} onEylem={() => void odalar.baslat()} />
              {:else if cevrimdisiBos}
                <BosDurum maskot="uyku" baslik={t("sohbetler.baglantiYok")} metin={t("sohbetler.baglantiYokAlt")} />
              {:else if !odalar.ilkListeGeldi}
                {#if iskeletZamani}
                  <div class="iskelet-kap" aria-busy="true" aria-label={t("sohbetler.esitleniyor")}>
                    <div class="yukleniyor-maskot"><Maskot poz="yukleniyor" boyut={96} /><strong>{t("sohbetler.esitleniyorBaslik")}</strong><span>{t("sohbetler.esitleniyorAlt")}</span></div>
                    {#each [0, 1, 2, 3] as i (i)}
                      <div class="iskelet"><span class="i-avatar parilti"></span><span class="i-cizgiler"><span class="parilti" style:width="{58 + ((i * 17) % 30)}%"></span><span class="parilti" style:width="{74 - ((i * 13) % 30)}%"></span></span></div>
                    {/each}
                  </div>
                {/if}
              {:else if satirlar.length === 0}
                {#if odalar.liste.length === 0}
                  <BosDurum maskot="selam" baslik={t("sohbetler.bos")} metin={t("sohbetler.bosAlt")} eylem={t("sohbetler.yeniSohbet")} onEylem={() => (yeniSayfa = "kisi")} />
                {:else}
                  <BosDurum maskot="arama" boyut={96} baslik={t("sohbetler.sonucYok")} />
                {/if}
              {:else}
                {#each satirlar as oda (oda.id)}
                  <SohbetSatiri {oda} secili={!telefon && gezinme.acikOdaId === oda.id} taslak={odalar.taslaklar[oda.id] ?? ""} sec={() => (oda.davet ? istekler.ac() : gezinme.odaAc(oda.id))} uzun={(x, y) => odaMenusu(oda, x, y)} />
                {/each}
              {/if}
              <!-- Room for the bottom bar (dock on portrait phone, search pill + "+" on wide desktop & landscape phone) · Alt çubuk için yer (dikey telefonda dock, geniş masaüstü ve yatay telefonda arama hapı + "+") -->
              {#if !duzen.kompakt}<div class="alt-bosluk"></div>{/if}
            </div>
          {/if}
        </div>
      {/snippet}
    </Sayfalayici>

    {#if !telefon && !duzen.kompakt}<SohbetAramasi onsec={(s) => (yeniSayfa = s)} />{/if}
  {/if}
</div>

{#if menu}<BaglamMenusu x={menu.x} y={menu.y} eylemler={menu.eylemler} onkapat={() => (menu = null)} />{/if}
{#if yeniSayfa === "kisi"}<YeniSohbet onkapat={() => (yeniSayfa = null)} />{:else if yeniSayfa === "kesfet"}<OdaKesfet onkapat={() => (yeniSayfa = null)} />{:else if yeniSayfa}<OdaOlustur tur={yeniSayfa} onkapat={() => (yeniSayfa = null)} />{/if}

{#if cipDuzenle}
  <AltSayfa baslik={t("sohbetler.cipBaslik")} onkapat={() => (cipDuzenle = false)}>
    <p class="cip-alt">{t("sohbetler.cipAlt")}</p>
    <div class="cip-liste">
      {#each sohbetChipleri.sira as id, i (id)}
        <div class="cip-satir">
          <span class="cip-ad">{t(adlar[id])}</span>
          <button class="simge-dugme" aria-label={t("sohbetler.yukari")} disabled={i < 2} onclick={() => sohbetChipleri.tasi(id, -1)}><Ikon ad="yukari" boyut={20} /></button>
          <button class="simge-dugme" aria-label={t("sohbetler.asagi")} disabled={i === 0 || i === sohbetChipleri.sira.length - 1} onclick={() => sohbetChipleri.tasi(id, 1)}><Ikon ad="asagi" boyut={20} /></button>
          <Anahtar acik={!sohbetChipleri.gizli.includes(id)} degis={(v) => sohbetChipleri.goster(id, v)} etiket={t(adlar[id])} kilitli={id === "tumu"} />
        </div>
      {/each}
      <div class="cip-satir">
        <span class="cip-ad cip-metinli"><strong>{t("sohbetler.alanSekmeleri")}</strong><small>{t("sohbetler.alanSekmeleriAlt")}</small></span>
        <Anahtar acik={sohbetChipleri.alanSekmeleri} degis={(v) => sohbetChipleri.alanSekmeleriYaz(v)} etiket={t("sohbetler.alanSekmeleri")} />
      </div>
      {#if telefon}
        <div class="cip-satir">
          <span class="cip-ad cip-metinli"><strong>{t("sohbetler.klasorKaydir")}</strong><small>{t("sohbetler.klasorKaydirAlt")}</small></span>
          <Anahtar acik={sohbetChipleri.klasorKaydir} degis={(v) => sohbetChipleri.klasorKaydirYaz(v)} etiket={t("sohbetler.klasorKaydir")} />
        </div>
      {/if}
    </div>
  </AltSayfa>
{/if}

<style>
  .sohbetler { position: relative; isolation: isolate; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .tepe { position: absolute; z-index: 3; top: 0; left: 0; right: 0; padding-top: env(safe-area-inset-top); transition: transform var(--sure-yavas) var(--egri-cikis); }
  .tepe.kompakt { transform: translate3d(0, -4rem, 0); }
  .kompakt .ust { opacity: 0; pointer-events: none; }
  .perde { position: absolute; z-index: 2; top: 0; left: 0; right: 0; height: calc(env(safe-area-inset-top) + 5rem); background: linear-gradient(var(--zemin) 70%, color-mix(in srgb, var(--zemin) 70%, transparent) 86%, transparent); pointer-events: none; }
  .ust { height: 4.25rem; display: flex; align-items: center; gap: 12px; padding: 0 .75rem 0 1rem; transition: opacity var(--sure-orta) var(--egri-cikis); }
  .basliklar { flex: 1; min-width: 0; display: grid; }
  h1 { min-width: 0; font-family: var(--baslik-tipi); font-size: 1.625rem; line-height: 1.2; font-weight: 700; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* The title floats over the list: a soft halo in the background colour keeps it readable. · Başlık listenin üstünde yüzer: zemin renginde yumuşak bir hale okunur kılar. */
  h1, .ozet { text-shadow: 0 0 3px var(--zemin), 0 0 10px var(--zemin), 0 1px 14px var(--zemin); padding: 0 .25rem; margin: 0 -.25rem; }
  .ozet { font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ozet.var { color: var(--vurgu); font-weight: 500; }
  .duzenle { flex: none; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--yuzey-2); color: var(--yazi-2); }
  .ust-eylemler { flex: none; display: inline-flex; align-items: center; gap: 8px; }
  .duzenle:active { background: var(--yuzey-3); }
  .tepsi { margin: 0 12px 8px; overflow: hidden; border-radius: 28px; background: var(--yuzey-2); box-shadow: var(--kat-2); }
  /* The sync strip is the tray's lower storey. · Eşitleme şeridi tepsinin alt katıdır. */
  .tepsi :global(.serit) { border-bottom: 0; border-top: 1px solid var(--kenar-ince); }

  .sayfa { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .sayfa.alan { padding-top: var(--tepe-yer); }
  .izin-karti { margin: 0 .75rem .5rem; padding: .75rem .5rem .75rem 1rem; display: flex; align-items: center; gap: .75rem; background: var(--yuzey-2); border-radius: 1.5rem; }
  .izin-simge { flex: none; width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center; background: var(--ton); color: var(--ton-ustu); }
  .izin-metin { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: .875rem; }
  .izin-metin small { color: var(--yazi-2); font-size: .8125rem; }
  .izin-ac { flex: none; min-width: 3.5rem; min-height: 2.75rem; padding: 0 1rem; border-radius: 1.375rem; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; }
  .liste { contain: layout style; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-top: var(--tepe-yer); scroll-padding: var(--tepe-yer) 0 var(--dock-yer, 96px); }
  :global([data-yogunluk="kompakt"]) .ust { height: 3.75rem; padding: 0 .625rem 0 .75rem; }
  :global([data-yogunluk="kompakt"]) .tepsi { margin: 0 10px 6px; }
  :global([data-yogunluk="kompakt"]) .iskelet { min-height: var(--liste-satir-boy); padding: 0 .75rem; }
  .alt-bosluk { height: var(--dock-yer, 4.75rem); }
  .istek-karti { width: calc(100% - 1.5rem); margin: 0 .75rem .5rem; min-height: 4rem; padding: .625rem 1rem; display: flex; align-items: center; gap: .75rem; text-align: left; background: var(--ton); color: var(--ton-ustu); border-radius: 1.5rem; }
  .istek-karti small { color: inherit; opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .yuzler { display: flex; flex: none; }
  .yuzler > :global(* + *) { margin-left: -.75rem; }
  .yukleniyor-maskot { display: grid; justify-items: center; gap: 4px; padding: 1rem 1.5rem .5rem; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .yukleniyor-maskot strong { color: var(--yazi); font-size: 1rem; }
  .iskelet { min-height: 4.5rem; padding: 0 1rem; display: flex; align-items: center; gap: .75rem; }
  .i-avatar { width: 3rem; height: 3rem; border-radius: .75rem; flex: none; }
  .i-cizgiler { flex: 1; display: grid; gap: .5rem; }
  .i-cizgiler span { height: .75rem; border-radius: .375rem; }

  .cip-alt { font-size: .875rem; color: var(--yazi-2); }
  .cip-liste { display: grid; }
  .cip-satir { display: flex; align-items: center; gap: 4px; min-height: 3.5rem; border-bottom: 1px solid var(--kenar-ince); }
  .cip-satir:last-child { border-bottom: 0; }
  .cip-ad { flex: 1; min-width: 0; font-size: .9375rem; font-weight: 500; }
  .cip-metinli { display: grid; padding: .5rem 0; }
  .cip-metinli strong { font-weight: 500; }
  .cip-metinli small { font-size: .8125rem; color: var(--yazi-2); font-weight: 400; }
</style>
