<!--
  Chat list (design 22/01, 22/02). Header, filter chips (the user can hide / reorder them: "+" opens the editor), invite card and rows.
  The SEARCH FIELD lives at the BOTTOM (thumb zone), a pill above the dock with a "new chat" button inside its right end. Scrolling down
  collapses it to an icon and hides the dock with it; scrolling up brings both back. Focusing it opens the smart search: grouped results
  (Sohbetler = room names, Mesajlar = the instant message index, Son aramalar) while the pill sticks above the keyboard (the app is
  resized to the visible area by klavye.ts). `kimden:isim` filters message results by sender. First load: a mascot + a skeleton after 400 ms.
  Sohbet listesi (tasarım 22/01, 22/02). Başlık, süzgeç çipleri (kullanıcı gizleyip sıralayabilir: "+" düzenleyiciyi açar), davet kartı ve satırlar.
  ARAMA ALANI ALTTA (başparmak bölgesi), menünün üstünde bir hap ve sağ ucunda "yeni sohbet" düğmesi. Aşağı kaydırınca simgeye daralır ve
  menüyü de gizler; yukarı kaydırınca ikisi birlikte döner. Odaklanınca akıllı arama açılır: gruplu sonuçlar (Sohbetler = oda adları,
  Mesajlar = anlık mesaj dizini, Son aramalar); hap klavyenin üstüne yapışır (uygulama klavye.ts ile görünen alana boyutlanır).
  `kimden:isim` mesaj sonuçlarını göndericiye göre süzer. İlk yükleme: maskot + 400 ms sonra iskelet.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import MesajAramaSonuclari from "../arama-mesaj/MesajAramaSonuclari.svelte";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import EsitlemeSeridi from "../bilesenler/EsitlemeSeridi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import SohbetSatiri from "../bilesenler/SohbetSatiri.svelte";
  import YeniSohbet from "../bilesenler/YeniSohbet.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { altKaydirma, kabuk } from "../durum/kabuk.svelte";
  import { odalar, type Suzgec } from "../durum/odalar.svelte";
  import { sohbetChipleri } from "../durum/sohbetChipleri.svelte";
  import { sonAramaEkle, sonAramalariOku, sonAramalariTemizle, sorguAyir } from "../durum/sonAramalar";
  import { t, type Anahtar as TrAnahtar } from "../i18n";
  import { bildirimIzni, bildirimIzniAc } from "../bildirim-sistem";

  // Notification permission card (design 09): shown once at the top of the list while permission is missing; "Aç" asks Android.
  // Bildirim izni kartı (tasarım 09): izin yokken listenin üstünde gösterilir; "Aç" Android'e sorar.
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

  let kaydirildi = $state(false);
  let yeniAcik = $state(false);
  let cipDuzenle = $state(false);

  // Skeleton only after 400 ms of waiting: a quick load must not flash grey rows. · İskelet yalnızca 400 ms beklenince: hızlı yükleme gri satır yakıp söndürmemeli.
  let iskeletZamani = $state(false);
  onMount(() => {
    const z = setTimeout(() => (iskeletZamani = true), 400);
    return () => clearTimeout(z);
  });

  // ---- Smart search · Akıllı arama ----
  let aramaModu = $state(false);
  let ham = $state("");
  let alan: HTMLInputElement | undefined = $state();
  let sonlar = $state<string[]>(sonAramalariOku());
  let aramaKatmani = 0;
  const ayri = $derived(sorguAyir(ham));
  const yazi = $derived(ayri.sorgu.trim());
  const odaEslesmeleri = $derived.by(() => {
    const a = yazi.toLocaleLowerCase("tr");
    if (!a) return [];
    return odalar.liste.filter((o) => !o.davet && o.ad.toLocaleLowerCase("tr").includes(a)).slice(0, 5);
  });
  // The pill is collapsed to an icon while the dock is hidden by scrolling (never while searching). · Hap, menü kaydırmayla gizliyken simgeye daralır (arama sırasında asla).
  const kucuk = $derived(kabuk.altGizli && !aramaModu);

  function aramaAc() {
    if (aramaModu) return;
    aramaModu = true;
    kabuk.aramaOdakta = true;
    kabuk.altGizli = false;
    aramaKatmani = gezinme.katmanAc(() => {
      aramaKatmani = 0;
      aramaModu = false;
      kabuk.aramaOdakta = false;
      ham = "";
      alan?.blur();
    });
  }
  function aramaKapat() {
    if (aramaKatmani) gezinme.katmanKapat(aramaKatmani);
  }
  onDestroy(() => {
    if (aramaKatmani) gezinme.katmanBirak(aramaKatmani);
    kabuk.aramaOdakta = false;
  });

  function hapaDokun() {
    if (kucuk) {
      kabuk.altGizli = false;
      return;
    }
    alan?.focus();
  }
  function gonder(e: SubmitEvent) {
    e.preventDefault();
    sonlar = sonAramaEkle(ham);
    alan?.blur();
  }
  function sonSec(s: string) {
    ham = s;
    alan?.focus();
  }
  // A tapped result opens a room: remember the query. · Dokunulan sonuç bir oda açar: sorguyu hatırla.
  const hatirla = () => (sonlar = sonAramaEkle(ham));

  const suzgecAdi: Record<Suzgec, TrAnahtar> = { tumu: "sohbetler.tumu", okunmamis: "sohbetler.okunmamis", kisiler: "sohbetler.kisiler", gruplar: "sohbetler.gruplar", davetler: "sohbetler.davetler" };
  const sayiOf = (id: Suzgec) => (id === "okunmamis" ? odalar.okunmamisOda : id === "davetler" ? odalar.davetler.length : 0);
  // Invites show up only when there are some (or the chip is selected) · Davetler yalnızca varsa (ya da çip seçiliyse) görünür
  const cipler = $derived(sohbetChipleri.gorunur.filter((c) => c !== "davetler" || odalar.davetler.length > 0 || odalar.suzgec === "davetler"));

  const hata = $derived(odalar.esitleme.durum === "hata" && !odalar.ilkListeGeldi);
  const cevrimdisiBos = $derived(odalar.esitleme.durum === "cevrimdisi" && !odalar.ilkListeGeldi);
</script>

<div class="sohbetler">
  <Baslik baslik={t("sohbetler.baslik")} kenar={kaydirildi} />

  <div class="hapler" role="group" aria-label={t("sohbetler.suzgec")}>
    {#each cipler as id (id)}
      <button class="hap" class:aktif={odalar.suzgec === id} aria-pressed={odalar.suzgec === id} onclick={() => (odalar.suzgec = id)}>
        {t(suzgecAdi[id])}{#if sayiOf(id) > 0}<span class="rozet">{sayiOf(id)}</span>{/if}
      </button>
    {/each}
    <button class="hap ekle" aria-label={t("sohbetler.cipEkle")} onclick={() => (cipDuzenle = true)}><Ikon ad="artik" boyut={18} /></button>
  </div>

  <EsitlemeSeridi />

  <div class="liste" use:altKaydirma onscroll={(e) => (kaydirildi = e.currentTarget.scrollTop > 0)}>
    {#if izinKarti}
      <div class="izin-karti">
        <span class="izin-simge"><Ikon ad="zil" boyut={20} /></span>
        <span class="izin-metin"><b>{t("bildirim.izinBaslik")}</b><small>{t("bildirim.izinAciklama")}</small></span>
        <button class="izin-ac" onclick={izinIste}>{t("bildirim.izinAc")}</button>
      </div>
    {/if}
    {#if odalar.davetler.length > 0 && odalar.suzgec === "tumu"}
      <div class="davet-karti">
        <span class="davet-baslik">{t("sohbetler.davet", { n: odalar.davetler.length })}</span>
        {#each odalar.davetler as d (d.id)}
          <SohbetSatiri oda={d} sec={() => {}} />
        {/each}
      </div>
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
    {:else if odalar.gorunen.length === 0}
      {#if odalar.liste.length === 0}
        <BosDurum maskot="selam" baslik={t("sohbetler.bos")} metin={t("sohbetler.bosAlt")} eylem={t("sohbetler.yeniSohbet")} onEylem={() => (yeniAcik = true)} />
      {:else}
        <BosDurum maskot="arama" boyut={96} baslik={t("sohbetler.sonucYok")} />
      {/if}
    {:else}
      {#each odalar.gorunen as oda (oda.id)}
        <SohbetSatiri {oda} secili={gezinme.genis && gezinme.acikOdaId === oda.id} taslak={odalar.taslaklar[oda.id] ?? ""} sec={() => (oda.davet ? undefined : gezinme.odaAc(oda.id))} />
      {/each}
    {/if}
    <!-- Room for the search pill + dock · Arama hapı + menü için yer -->
    <div class="alt-bosluk"></div>
  </div>

  <!-- Smart search results cover the list while the search field is focused · Arama alanı odaktayken akıllı arama sonuçları listeyi örter -->
  {#if aramaModu}
    <div class="arama-paneli" role="region" aria-label={t("sohbetler.ara")}>
      <div class="panel-kayan">
        {#if ayri.kimden}
          <div class="op-cipleri"><button class="hap aktif" onclick={() => (ham = ayri.sorgu)}>{t("sohbetler.kimdenCip", { ad: ayri.kimden })}<Ikon ad="kapat" boyut={16} /></button></div>
        {/if}
        {#if !ham.trim()}
          {#if sonlar.length > 0}
            <div class="bolum-baslik"><span>{t("sohbetler.sonAramalar")}</span><button onclick={() => (sonlar = sonAramalariTemizle())}>{t("sohbetler.sonAramaTemizle")}</button></div>
            {#each sonlar as s (s)}
              <button class="son" data-dalga onclick={() => sonSec(s)}><Ikon ad="yenile" boyut={18} /><span>{s}</span></button>
            {/each}
          {:else}
            <BosDurum maskot="arama" baslik={t("sohbetler.aramaBosBaslik")} metin={t("sohbetler.aramaBosAlt")} />
          {/if}
        {:else}
          {#if odaEslesmeleri.length > 0}
            <div class="bolum-baslik"><span>{t("sohbetler.bolumSohbetler")}</span></div>
            {#each odaEslesmeleri as oda (oda.id)}
              <SohbetSatiri {oda} sec={() => { hatirla(); gezinme.odaAc(oda.id); }} />
            {/each}
          {/if}
          <MesajAramaSonuclari sorgu={yazi} kimden={ayri.kimden} />
        {/if}
      </div>
    </div>
  {/if}

  <!-- The search pill: collapses to an icon while scrolling down (with the dock), expands on scroll up · Arama hapı: aşağı kaydırınca (menüyle birlikte) simgeye daralır, yukarı kaydırınca açılır -->
  <div class="hap-kap" class:asagi={kabuk.altGizli || aramaModu} data-alt-cubuk={kabuk.altGizli && !aramaModu ? undefined : ""}>
    <form class="arama-hapi" class:kucuk class:odakta={aramaModu} onsubmit={gonder} role="search">
      <button class="ara-simge" type="button" aria-label={kucuk ? t("sohbetler.aramaIcon") : aramaModu ? t("sohbetler.aramaKapat") : t("sohbetler.ara")} onclick={aramaModu ? aramaKapat : hapaDokun}>
        <Ikon ad={aramaModu ? "geri" : "ara"} boyut={20} />
      </button>
      <input bind:this={alan} bind:value={ham} type="search" enterkeyhint="search" placeholder={t("sohbetler.aramaYer")} aria-label={t("sohbetler.ara")} onfocus={aramaAc} autocomplete="off" autocapitalize="off" spellcheck="false" tabindex={kucuk ? -1 : 0} />
      {#if ham}
        <button class="temizle" type="button" aria-label={t("eylem.temizle")} onclick={() => { ham = ""; alan?.focus(); }}><Ikon ad="kapat" boyut={18} /></button>
      {/if}
      <button class="yeni" type="button" aria-label={t("sohbetler.yeniSohbet")} onclick={() => (yeniAcik = true)}><Ikon ad="kalem" boyut={20} /></button>
    </form>
  </div>
</div>

{#if yeniAcik}<YeniSohbet onkapat={() => (yeniAcik = false)} />{/if}

{#if cipDuzenle}
  <AltSayfa baslik={t("sohbetler.cipBaslik")} onkapat={() => (cipDuzenle = false)}>
    <p class="cip-alt">{t("sohbetler.cipAlt")}</p>
    <div class="cip-liste">
      {#each sohbetChipleri.sira as id, i (id)}
        <div class="cip-satir">
          <span class="cip-ad">{t(suzgecAdi[id])}</span>
          <button class="simge-dugme" aria-label={t("sohbetler.yukari")} disabled={i < 2} onclick={() => sohbetChipleri.tasi(id, -1)}><Ikon ad="yukari" boyut={20} /></button>
          <button class="simge-dugme" aria-label={t("sohbetler.asagi")} disabled={i === 0 || i === sohbetChipleri.sira.length - 1} onclick={() => sohbetChipleri.tasi(id, 1)}><Ikon ad="asagi" boyut={20} /></button>
          <Anahtar acik={!sohbetChipleri.gizli.includes(id)} degis={(v) => sohbetChipleri.goster(id, v)} etiket={t(suzgecAdi[id])} kilitli={id === "tumu"} />
        </div>
      {/each}
    </div>
  </AltSayfa>
{/if}

<style>
  .sohbetler { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .hapler { flex: none; display: flex; gap: 8px; padding: 8px 16px 12px; overflow-x: auto; scrollbar-width: none; overscroll-behavior: contain; }
  .hap {
    flex: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 20px; background: var(--yuzey-2);
    font-size: .875rem; font-weight: 500; color: var(--yazi); transition: background var(--sure-hizli) var(--egri-cikis), color var(--sure-hizli) var(--egri-cikis);
  }
  /* 40px chip + 4px outer margin = 44px hit area · 40px hap + 4px dış boşluk = 44px dokunma alanı */
  .hap { margin: 2px 0; position: relative; }
  .hap::after { content: ""; position: absolute; inset: -2px 0; }
  .hap.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .hap.ekle { width: 44px; padding: 0; justify-content: center; color: var(--yazi-2); }
  .hap .rozet { min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; }
  .izin-karti { margin: 0 16px 8px; padding: 12px 8px 12px 16px; display: flex; align-items: center; gap: 12px; background: var(--yuzey-1); border: 1px solid var(--kenar); border-radius: 16px; }
  .izin-simge { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--ton); color: var(--ton-ustu); }
  .izin-metin { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: .875rem; }
  .izin-metin small { color: var(--yazi-2); font-size: .8125rem; }
  .izin-ac { flex: none; min-width: 56px; min-height: 44px; padding: 0 14px; border-radius: 12px; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .alt-bosluk { height: calc(var(--dock-yer, 16px) + 64px); }
  .davet-karti { margin: 0 16px 8px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); border-radius: 16px; overflow: hidden; }
  .davet-baslik { display: block; padding: 12px 16px 4px; font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  .yukleniyor-maskot { display: grid; justify-items: center; gap: 4px; padding: 16px 24px 8px; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .yukleniyor-maskot strong { color: var(--yazi); font-size: 1rem; }
  .iskelet { height: 72px; padding: 0 16px; display: flex; align-items: center; gap: 12px; }
  .i-avatar { width: 48px; height: 48px; border-radius: 12px; }
  .i-cizgiler { flex: 1; display: grid; gap: 8px; }
  .i-cizgiler span { height: 12px; border-radius: 6px; }

  /* Search results panel: covers header + list, below the pill · Arama sonuç paneli: başlığı + listeyi örter, hapın altında */
  .arama-paneli { position: absolute; inset: 0; z-index: 3; background: var(--zemin); display: flex; flex-direction: column; animation: belir var(--sure-orta) var(--egri-cikis); }
  @keyframes belir { from { opacity: 0; transform: translateY(8px); } }
  .panel-kayan { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: calc(env(safe-area-inset-top) + 8px) 0 88px; }
  .op-cipleri { display: flex; gap: 8px; padding: 0 16px 8px; }
  .bolum-baslik { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 4px; font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); }
  .bolum-baslik button { min-height: 44px; padding: 0 8px; margin: -12px -8px; color: var(--vurgu); text-transform: none; letter-spacing: 0; font-size: .8125rem; }
  .son { width: 100%; min-height: 48px; padding: 0 16px; display: flex; align-items: center; gap: 12px; text-align: left; color: var(--yazi); }
  .son :global(svg) { color: var(--yazi-2); }

  /* The pill sits above the dock; when the dock hides (scroll down / searching) it slides down to the bottom edge. */
  /* Hap menünün üstünde durur; menü gizlenince (aşağı kaydırma / arama) alt kenara iner. */
  .hap-kap { position: absolute; z-index: 4; left: 12px; right: 12px; bottom: calc(var(--dock-yer, 16px) - 4px); display: flex; justify-content: flex-end; pointer-events: none; transition: transform var(--sure-sayfa) var(--egri-cikis); }
  .hap-kap.asagi { transform: translateY(calc(var(--dock-yer, 16px) - 16px)); }
  .arama-hapi {
    pointer-events: auto; width: 100%; height: 56px; display: flex; align-items: center; border-radius: 28px; overflow: hidden;
    background: color-mix(in srgb, var(--yuzey-2) 88%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); transition: width var(--sure-sayfa) var(--egri-cikis), border-color var(--sure-hizli) var(--egri-cikis);
  }
  .arama-hapi.odakta { border-color: var(--vurgu); }
  .arama-hapi.kucuk { width: 56px; }
  .ara-simge { flex: none; width: 52px; height: 56px; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .arama-hapi input { flex: 1; min-width: 0; height: 56px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; transition: opacity var(--sure-hizli) var(--egri-cikis); }
  .arama-hapi input::placeholder { color: var(--yazi-2); }
  .arama-hapi.kucuk input, .arama-hapi.kucuk .yeni { opacity: 0; pointer-events: none; }
  .temizle { flex: none; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .yeni { flex: none; width: 44px; height: 44px; margin-right: 6px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--vurgu); color: var(--vurgu-ustu); transition: opacity var(--sure-hizli) var(--egri-cikis); }

  .cip-alt { font-size: .875rem; color: var(--yazi-2); }
  .cip-liste { display: grid; }
  .cip-satir { display: flex; align-items: center; gap: 4px; min-height: 56px; border-bottom: 1px solid var(--kenar-ince); }
  .cip-satir:last-child { border-bottom: 0; }
  .cip-ad { flex: 1; font-size: .9375rem; font-weight: 500; }
</style>
