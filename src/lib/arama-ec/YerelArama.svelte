<!--
  Native call screen (Figma "08 · Arama"): people as tiles, own screen share as the first tile, shared screen stage with a right strip on wide
  screens or a bottom strip on narrow screens, split dock buttons on desktop, labelled dock + "Daha fazla" sheet on phones, and a "Sesler" panel.
  Yerel arama ekranı (Figma "08 · Arama"): kişiler kutularda, kendi paylaşımın ilk kutuda, paylaşılan ekran sahnesi genişte sağ şeritli / darda
  alt şeritli, masaüstünde bölünmüş dock düğmeleri, telefonda etiketli dock + "Daha fazla" sayfası ve "Sesler" paneli.
-->
<script lang="ts">
  import {
    yerelAramaAygitlar,
    yerelAramaDuzey,
    yerelAramaPaylas,
    yerelAramaPaylasilanSesler,
    yerelAramaPaylasimiDurdur,
    yerelAramaSustur,
    yerelAramaUygulamalar,
  } from "../api/komutlar";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { ayarlar } from "../durum/ayarlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { t, yerel } from "../i18n";
  import { sureYaz } from "../zaman-bicim";
  import { ec } from "./ec.svelte";
  import { sesAyarlari } from "./sesAyarlari.svelte";
  import type { YerelKatilimci, YerelSes } from "./tipler";
  import SesAyarlariSayfasi from "./SesAyarlariSayfasi.svelte";
  import YerelVideo from "./YerelVideo.svelte";
  import { androidMi, sesCihaziSec, sesCihazlari, sesVarsayilan } from "./ses";

  const d = $derived(ec.yerelDurum);
  const kisiler = $derived(d?.katilimcilar ?? []);
  const digerleri = $derived(kisiler.filter((k) => !k.ben));
  const paylasanlar = $derived(kisiler.filter((k) => k.ekran));
  let secilen = $state<string | null>(null);
  const sahne = $derived(paylasanlar.find((k) => k.uye === secilen) ?? paylasanlar[0] ?? null);
  let panel = $state(false);
  let sesAyarAcik = $state(false);
  let paylasAcik = $state(false);
  let dahaFazlaAcik = $state(false);
  let uygulamalar = $state<string[]>([]);
  let secili = $state<string[]>([]);
  let tam = $state(false);
  // Cached map from OS device id to display label for the narrow "Daha fazla" subtitle.
  // Dar ekrandaki "Daha fazla" alt metni için işletim sistemi aygıt kimliğinden görünen ada önbellek.
  let aygitAdlari = $state<Record<string, string>>({});

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

  const aktifMi = $derived(!!d && d.asama !== "baglaniyor" && d.asama !== "caliyor");
  const yiginKisiler = $derived(kisiler.slice(0, 3));
  const yiginFazla = $derived(Math.max(0, kisiler.length - 3));
  const kutuSayisi = $derived(kisiler.length + (d?.onizleme ? 1 : 0));
  const sutunSayisi = $derived(genis ? Math.min(3, Math.max(1, kutuSayisi)) : kutuSayisi > 2 ? 2 : 1);

  const altYazi = $derived.by(() => {
    if (!d || d.asama === "baglaniyor") return t("arama.baglaniyor");
    if (d.asama === "caliyor") return t("yerel.caliyor");
    const bas =
      d.paylasim === "acik"
        ? t("yerel.sen")
        : sahne
          ? t("yerel.paylasiyor", { ad: sahne.ad })
          : t(genis ? "yerel.sifreliKisi" : "yerel.kisi", { n: kisiler.length });
    return `${bas} · ${sureYaz(ec.sure)}`;
  });

  // Format real WebRTC send bitrate for the own-share tile footer. · Kendi paylaşım kutusu alt satırı için gerçek WebRTC gönderim hızını biçimle.
  function hizYaz(kbps: number): string {
    if (kbps >= 1000) {
      const mb = (kbps / 1000).toLocaleString(yerel, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return t("yerel.hizMb", { n: mb });
    }
    return t("yerel.hizKb", { n: Math.round(kbps) });
  }
  const yayinDurum = $derived(d?.paylasim === "acik" ? (d.yayin?.durum ?? "basliyor") : null);
  const yayinMetni = $derived.by(() => {
    if (!d?.onizleme) return "";
    if (d.paylasim === "seciliyor") return t("yerel.onizlemeSec");
    if (d.yayin?.durum === "yayinda") return t("yerel.yayinda", { hiz: hizYaz(d.yayin.kbps), kare: d.yayin.kareHizi });
    if (d.yayin?.durum === "gitmiyor") return t("yerel.yayinGitmiyor");
    return t("yerel.yayinBasliyor");
  });
  // Strip tiles are compact, so show only the live bitrate when streaming. · Şerit kutuları küçük olduğu için yayındayken yalnız kısa hızı göster.
  const kisaYayinMetni = $derived.by(() => {
    if (!d?.onizleme) return "";
    if (d.yayin?.durum === "yayinda") return hizYaz(d.yayin.kbps);
    return yayinMetni;
  });

  const seciliGirisAdi = $derived.by(() => {
    if (android) return t("yerel.sistemVarsayilani");
    const g = sesAyarlari.giris;
    if (!g) return t("yerel.sistemVarsayilani");
    return aygitAdlari[g] ?? g;
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
  function dahaFazlaSesAc() {
    dahaFazlaAcik = false;
    sesAyarAcik = true;
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
  $effect(() => {
    if (genis) dahaFazlaAcik = false;
  });
  $effect(() => {
    if (!dahaFazlaAcik || android) return;
    let etkin = true;
    void yerelAramaAygitlar()
      .then((sonuc) => {
        if (!etkin) return;
        const harita: Record<string, string> = {};
        for (const a of sonuc.girisler) harita[a.ad] = a.aciklama || a.ad;
        aygitAdlari = harita;
      })
      .catch(() => {});
    return () => {
      etkin = false;
    };
  });
</script>

{#snippet kutu(k: YerelKatilimci, kucuk: boolean)}
  <div class="kutu" class:konusuyor={k.konusuyor && !k.susturulmus} class:kucuk>
    {#if k.kamera}
      <YerelVideo anahtar={k.kamera} />
    {:else}
      <Avatar
        harf={k.ad.charAt(0).toUpperCase()}
        boyut={kucuk ? (genis ? 48 : 40) : !genis && kutuSayisi > 2 ? 48 : 88}
        mxc={k.avatarMxc}
        anahtar={k.ben ? null : k.kullaniciId}
      />
    {/if}
    {#if k.sorun}
      <span class="sorun-cip" title={t(`yerel.sorun.${k.sorun}`)}>
        <Ikon ad="uyari" boyut={14} />
        {#if kucuk || (!genis && kutuSayisi > 2)}
          <span class="gizli-metin">{t(`yerel.sorun.${k.sorun}`)}</span>
        {:else}
          <span class="sorun-metin">{t(`yerel.sorun.${k.sorun}`)}</span>
        {/if}
      </span>
    {/if}
    <span class="etiket">
      {#if k.susturulmus}<span class="kirmizi"><Ikon ad="mikrofonKapali" boyut={14} /></span>{/if}
      <span class="ad">{k.ben ? t("yerel.ben") : k.ad}</span>
    </span>
  </div>
{/snippet}

{#snippet onizlemeKutu(kucuk: boolean)}
  {#if d?.onizleme}
    <!-- Own screen share rendered as the first tile in the grid or strip instead of a floating card. -->
    <!-- Kendi ekran paylaşımımız yüzen kart yerine ızgarada ya da şeritte ilk kutu olarak çizilir. -->
    <section
      class="kutu onizleme-kutu"
      class:kucuk
      class:paylasim-hata={yayinDurum === "gitmiyor"}
      aria-label={t("yerel.onizleme")}
    >
      {#key d.onizleme}<YerelVideo anahtar={d.onizleme} />{/key}
      <button type="button" class="onizleme-durdur" onclick={durdur} aria-label={t("yerel.durdur")} title={t("yerel.durdur")}>
        <span>{t("yerel.paylasimiDurdur")}</span>
      </button>
      <div class="onizleme-alt-sar">
        {#if !kucuk && d.paylasilan.length}
          <span class="ses-cipi" title={t("yerel.sesCipi", { adlar: d.paylasilan.join(", ") })}>
            {t("yerel.sesCipi", { adlar: d.paylasilan.join(", ") })}
          </span>
        {/if}
        <div
          class="onizleme-serit"
          class:yayinda={yayinDurum === "yayinda"}
          class:hata={yayinDurum === "gitmiyor"}
          role="status"
          title={yayinMetni}
        >
          <span class="nokta" class:yesil={yayinDurum === "yayinda"} class:hata={yayinDurum === "gitmiyor"} aria-hidden="true"></span>
          <span class="onizleme-metin">{kucuk ? kisaYayinMetni : yayinMetni}</span>
        </div>
      </div>
    </section>
  {/if}
{/snippet}

{#snippet sesListesi()}
  {#each digerleri as k (k.uye)}
    {#if k.sesler.length}
      <div class="kisi"><Avatar harf={k.ad.charAt(0).toUpperCase()} boyut={28} mxc={k.avatarMxc} anahtar={k.kullaniciId} /><strong>{k.ad}</strong></div>
      {#each k.sesler as s (s.anahtar)}
        {@const v = duzey(s)}
        <div class="ses">
          <button
            type="button"
            class="simge-dugme"
            class:kirmizi={v === 0}
            onclick={() => sustur(s)}
            aria-label={t(v ? "yerel.sustur" : "yerel.sesAc", { ad: `${k.ad}, ${sesAdi(s)}` })}
            title={t(v ? "yerel.sustur" : "yerel.sesAc", { ad: `${k.ad}, ${sesAdi(s)}` })}
          >
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
    <header class:genis>
      <button type="button" class="simge-dugme" onclick={() => ec.kucult()} aria-label={t("arama.ekraniKapat")} title={t("arama.ekraniKapat")}>
        <Ikon ad="asagiOk" />
      </button>
      <div class="adlar">
        <strong>{ec.ad}</strong>
        <span class="durum" role="status">
          {#if genis && aktifMi}<span class="kilit-simge"><Ikon ad="kilit" boyut={14} /></span>{/if}
          <span class="durum-metin">{altYazi}</span>
        </span>
      </div>
      {#if genis && yiginKisiler.length}
        <div class="avatar-yigin" aria-hidden="true">
          {#each yiginKisiler as k (k.uye)}
            <span class="yigin-oge">
              <Avatar harf={k.ad.charAt(0).toUpperCase()} boyut={28} mxc={k.avatarMxc} anahtar={k.ben ? null : k.kullaniciId} />
            </span>
          {/each}
          {#if yiginFazla > 0}
            <span class="yigin-fazla">+{yiginFazla}</span>
          {/if}
        </div>
      {/if}
    </header>
    {#if d?.asama === "koptu"}
      <p class="serit" role="alert"><Ikon ad="uyari" boyut={18} /><span>{t("yerel.koptu")}</span></p>
    {/if}
  {/if}

  <div class="govde">
    <div class="orta" class:izleme-genis={!!sahne?.ekran && genis && !tam} class:izleme-dar={!!sahne?.ekran && !genis && !tam} class:tam>
      {#if sahne?.ekran}
        {#if genis}
          <div class="sahne">
            {#key sahne.ekran}<YerelVideo anahtar={sahne.ekran} />{/key}
            <button
              type="button"
              class="yuzen"
              onclick={() => (tam = !tam)}
              aria-label={t(tam ? "yerel.kucult" : "yerel.tamEkran")}
              title={t(tam ? "yerel.kucult" : "yerel.tamEkran")}
            >
              <Ikon ad={tam ? "kapat" : "tamEkran"} boyut={20} />
            </button>
          </div>
        {:else}
          <!-- On phones the whole stage toggles full screen on tap, avoiding a nested button. -->
          <!-- Telefonda sahnenin tamamı dokunuşla tam ekranı açıp kapatır; iç içe düğme oluşmaz. -->
          <button
            type="button"
            class="sahne sahne-dugme"
            onclick={() => (tam = !tam)}
            aria-label={t(tam ? "yerel.kucult" : "yerel.tamEkran")}
            title={t(tam ? "yerel.kucult" : "yerel.tamEkran")}
          >
            {#key sahne.ekran}<YerelVideo anahtar={sahne.ekran} />{/key}
          </button>
          {#if !tam}
            <p class="not">{t("yerel.tamEkranIpucu")}</p>
          {/if}
        {/if}
        {#if !tam}
          <div class="dizi" class:dikey={genis}>
            {#if d?.onizleme}{@render onizlemeKutu(true)}{/if}
            {#each kisiler as k (k.uye)}
              {#if k.ekran && paylasanlar.length > 1}
                <button type="button" class="sec" aria-pressed={k === sahne} onclick={() => (secilen = k.uye)}>{@render kutu(k, true)}</button>
              {:else}
                {@render kutu(k, true)}
              {/if}
            {/each}
          </div>
        {/if}
      {:else}
        <div class="izgara" style:--sutun={sutunSayisi}>
          {#if d?.onizleme}{@render onizlemeKutu(false)}{/if}
          {#each kisiler as k (k.uye)}{@render kutu(k, false)}{/each}
        </div>
        {#if d && !digerleri.length && d.asama !== "baglaniyor"}<p class="not ortala">{t("yerel.bekleniyor")}</p>{/if}
      {/if}
    </div>
    {#if panel && genis && !tam}<aside aria-label={t("yerel.sesler")}><h2>{t("yerel.sesler")}</h2>{@render sesListesi()}</aside>{/if}
  </div>

  {#if !tam}
    {#if genis}
      <div class="dock" data-alt-cubuk>
        <div class="bolunmus" class:kapali={d?.mikrofonKapali}>
          <button
            type="button"
            class="bol-ana"
            aria-pressed={d?.mikrofonKapali ?? false}
            disabled={!d}
            onclick={() => void yerelAramaSustur(!d?.mikrofonKapali)}
            aria-label={t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}
            title={t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}
          >
            <Ikon ad={d?.mikrofonKapali ? "mikrofonKapali" : "mikrofon"} />
          </button>
          <span class="bol-cizgi" aria-hidden="true"></span>
          <button
            type="button"
            class="bol-ok"
            aria-expanded={sesAyarAcik}
            aria-haspopup="dialog"
            onclick={() => (sesAyarAcik = !sesAyarAcik)}
            aria-label={t("yerel.sesAyarlari")}
            title={t("yerel.sesAyarlari")}
          >
            <Ikon ad="asagiOk" boyut={16} />
          </button>
        </div>

        {#if android}
          <button
            type="button"
            class="tus"
            class:acik={hoparlor}
            aria-pressed={hoparlor}
            onclick={hoparlorDegis}
            aria-label={t("yerel.hoparlor")}
            title={t("yerel.hoparlor")}
          >
            <Ikon ad="hoparlor" />
          </button>
        {:else}
          <div class="bolunmus" class:paylasim-acik={!!d && d.paylasim !== "yok"}>
            <button
              type="button"
              class="bol-ana"
              disabled={ec.asama !== "acik"}
              onclick={paylasAc}
              aria-label={t("yerel.paylasBaslik")}
              title={t("yerel.paylasBaslik")}
            >
              <Ikon ad="ekranPaylas" />
            </button>
            <span class="bol-cizgi" aria-hidden="true"></span>
            <button
              type="button"
              class="bol-ok"
              disabled={ec.asama !== "acik"}
              aria-expanded={paylasAcik}
              aria-haspopup="dialog"
              onclick={paylasAc}
              aria-label={t("yerel.paylasimAyar")}
              title={t("yerel.paylasimAyar")}
            >
              <Ikon ad="asagiOk" boyut={16} />
            </button>
          </div>
        {/if}

        <button
          type="button"
          class="tus"
          class:acik={panel}
          aria-pressed={panel}
          onclick={() => (panel = !panel)}
          aria-label={t("yerel.sesler")}
          title={t("yerel.sesler")}
        >
          <Ikon ad="sesler" />
        </button>

        <span class="dock-ayrac" aria-hidden="true"></span>

        <button
          type="button"
          class="tus son"
          onclick={() => void ec.kapat()}
          aria-label={t("yerel.bitir")}
          title={t("yerel.bitir")}
        >
          <Ikon ad="telefonKapat" />
        </button>
      </div>
    {:else}
      <div class="dock dar" data-alt-cubuk>
        <button
          type="button"
          class="dar-tus"
          class:kapali={d?.mikrofonKapali}
          aria-pressed={d?.mikrofonKapali ?? false}
          disabled={!d}
          onclick={() => void yerelAramaSustur(!d?.mikrofonKapali)}
          aria-label={t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}
          title={t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}
        >
          <Ikon ad={d?.mikrofonKapali ? "mikrofonKapali" : "mikrofon"} boyut={24} />
          <span class="dar-etiket">{t(d?.mikrofonKapali ? "arama.sesAc" : "arama.sessiz")}</span>
        </button>

        {#if android}
          <button
            type="button"
            class="dar-tus"
            class:acik={hoparlor}
            aria-pressed={hoparlor}
            onclick={hoparlorDegis}
            aria-label={t("yerel.hoparlor")}
            title={t("yerel.hoparlor")}
          >
            <Ikon ad="hoparlor" boyut={24} />
            <span class="dar-etiket">{t("yerel.hoparlor")}</span>
          </button>
        {:else}
          <button
            type="button"
            class="dar-tus"
            class:paylasim-acik={!!d && d.paylasim !== "yok"}
            disabled={ec.asama !== "acik"}
            onclick={paylasAc}
            aria-label={t("yerel.paylasBaslik")}
            title={t("yerel.paylasBaslik")}
          >
            <Ikon ad="ekranPaylas" boyut={24} />
            <span class="dar-etiket">{t("yerel.paylasKisa")}</span>
          </button>
        {/if}

        <button
          type="button"
          class="dar-tus"
          class:acik={panel}
          aria-pressed={panel}
          onclick={() => (panel = !panel)}
          aria-label={t("yerel.sesler")}
          title={t("yerel.sesler")}
        >
          <Ikon ad="sesler" boyut={24} />
          <span class="dar-etiket">{t("yerel.sesler")}</span>
        </button>

        <button
          type="button"
          class="dar-tus"
          class:acik={dahaFazlaAcik}
          aria-expanded={dahaFazlaAcik}
          aria-haspopup="dialog"
          onclick={() => (dahaFazlaAcik = !dahaFazlaAcik)}
          aria-label={t("yerel.dahaFazla")}
          title={t("yerel.dahaFazla")}
        >
          <Ikon ad="ucNokta" boyut={24} />
          <span class="dar-etiket">{t("yerel.dahaFazla")}</span>
        </button>

        <button
          type="button"
          class="dar-tus son"
          onclick={() => void ec.kapat()}
          aria-label={t("yerel.bitir")}
          title={t("yerel.bitir")}
        >
          <Ikon ad="telefonKapat" boyut={24} />
          <span class="dar-etiket">{t("yerel.bitir")}</span>
        </button>
      </div>
    {/if}
  {/if}

  {#if panel && !genis && ec.ekranAcik}
    <AltSayfa baslik={t("yerel.sesler")} onkapat={() => (panel = false)}><div class="liste">{@render sesListesi()}</div></AltSayfa>
  {/if}
  {#if dahaFazlaAcik && !genis && ec.ekranAcik}
    <AltSayfa baslik={t("yerel.dahaFazla")} onkapat={() => (dahaFazlaAcik = false)}>
      <div class="daha-liste">
        <button type="button" class="daha-satir" onclick={dahaFazlaSesAc}>
          <span class="daha-simge"><Ikon ad="mikrofon" boyut={20} /></span>
          <span class="daha-metin">
            <strong>{t("yerel.mikrofonVeCikis")}</strong>
            <span class="not">{seciliGirisAdi}</span>
          </span>
          <span class="daha-ok"><Ikon ad="sagOk" boyut={18} /></span>
        </button>
        <div class="daha-satir">
          <span class="daha-simge"><Ikon ad="ayar" boyut={20} /></span>
          <span class="daha-metin">
            <strong>{t("yerel.gurultu")}</strong>
            <span class="not">{t("yerel.gurultuAlt")}</span>
          </span>
          <Anahtar acik={ayarlar.gurultuEngelleme} degis={(v) => sesAyarlari.gurultuSec(v)} etiket={t("yerel.gurultu")} />
        </div>
        <div class="daha-satir bilgi">
          <span class="daha-simge kilit-simge"><Ikon ad="kilit" boyut={20} /></span>
          <span class="daha-metin">
            <strong>{t("yerel.sifreleme")}</strong>
            <span class="not">{t("yerel.sifreli")}</span>
          </span>
        </div>
      </div>
    </AltSayfa>
  {/if}
  {#if paylasAcik && ec.ekranAcik && d}
    <AltSayfa baslik={t(d.paylasim === "yok" ? "yerel.paylasBaslik" : "yerel.paylasimAyar")} onkapat={() => (paylasAcik = false)}>
      <p class="not">{t("yerel.paylasAciklama")}</p>
      <div class="paylas-bolum">
        <h3 class="bolum-baslik">{t("yerel.sesCalanlar")}</h3>
        <div class="liste">
          {#each uygulamalar as a (a)}
            <div class="uygulama"><Ikon ad="pencere" boyut={20} /><span class="ad">{a}</span><Anahtar acik={secili.includes(a)} degis={(v) => uygulamaDegis(a, v)} etiket={a} /></div>
          {:else}<p class="not">{t("yerel.sesYok")}</p>{/each}
        </div>
      </div>
      {#snippet altlik()}
        {#if d?.paylasim === "yok"}
          <button type="button" class="ana" onclick={basla}>{t("yerel.sec")}</button>
          <p class="not dipnot">{t("yerel.secDipnot")}</p>
        {:else}
          {#if d?.paylasim === "seciliyor"}<p class="not">{t("yerel.seciliyor")}</p>{/if}
          <button type="button" class="ana tehlike" onclick={durdur}>{t("yerel.durdur")}</button>
        {/if}
      {/snippet}
    </AltSayfa>
  {/if}
  {#if sesAyarAcik && ec.ekranAcik}
    <SesAyarlariSayfasi onkapat={() => (sesAyarAcik = false)} />
  {/if}
</div>

<style>
  .kapsam { position: fixed; inset: 0; z-index: 40; background: var(--zemin); color: var(--yazi); display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
  .kapsam.gizli { visibility: hidden; pointer-events: none; }
  header { flex: none; display: flex; align-items: center; gap: 6px; min-height: 60px; padding: 0 8px; }
  header.genis { padding: 0 16px 0 8px; }
  .adlar { flex: 1; min-width: 0; display: grid; }
  .adlar strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .durum { display: flex; align-items: center; gap: 5px; font-size: .8125rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; min-width: 0; }
  .durum-metin { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kilit-simge { flex: none; display: inline-flex; color: var(--cozum); }
  .avatar-yigin { flex: none; display: flex; align-items: center; }
  .yigin-oge { display: inline-flex; border-radius: .4375rem; box-shadow: 0 0 0 2px var(--zemin); }
  .yigin-oge + .yigin-oge { margin-left: -8px; }
  .yigin-fazla {
    flex: none; margin-left: 6px; min-width: 1.75rem; height: 1.75rem; padding: 0 6px;
    border-radius: .5rem; background: var(--yuzey-3); color: var(--yazi-2);
    font-size: .75rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;
    white-space: nowrap;
  }
  .serit { flex: none; display: flex; align-items: center; gap: 8px; margin: 0 16px 8px; padding: 10px 14px; border-radius: 12px; background: var(--yuzey-2); color: var(--bekliyor); font-size: .875rem; }
  .govde { flex: 1; min-height: 0; display: flex; gap: 16px; padding: 4px 16px 12px; }
  .orta { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: safe center; gap: 12px; }
  .orta.izleme-genis { flex-direction: row; align-items: stretch; justify-content: flex-start; }
  .orta.izleme-dar { justify-content: flex-start; }
  .orta.tam { justify-content: stretch; }
  .izgara { display: grid; gap: 12px; grid-template-columns: repeat(var(--sutun), minmax(0, 360px)); justify-content: center; overflow-y: auto; }
  .kutu { position: relative; display: grid; place-items: center; min-height: 160px; aspect-ratio: 4 / 3; border-radius: 16px; background: var(--yuzey-1); box-shadow: inset 0 0 0 1px var(--kenar-ince); overflow: hidden; }
  /* Grid tiles follow the column width; the 160px floor only made sense with 360px columns and pushed phone tiles over each other.
     Izgara kutuları sütun genişliğine uyar; 160px taban yalnızca 360px sütunlarda anlamlıydı, telefonda kutuları üst üste bindiriyordu. */
  .izgara .kutu { width: 100%; min-height: 0; }
  .kutu.konusuyor { box-shadow: inset 0 0 0 2px var(--vurgu); }
  .sorun-cip {
    position: absolute; top: 8px; right: 8px; z-index: 2; max-width: calc(100% - 16px);
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 10px;
    background: var(--yuzey-3); color: var(--bekliyor); font-size: .75rem; font-weight: 500; line-height: 1.2;
  }
  .kutu.kucuk .sorun-cip { padding: 4px; }
  .sorun-metin { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .etiket { position: absolute; left: 8px; bottom: 8px; z-index: 2; max-width: calc(100% - 16px); display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 10px; background: var(--yuzey-3); font-size: .8125rem; }
  .ad { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kirmizi { color: var(--hata); display: inline-flex; flex: none; }
  .gizli-metin { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  .sahne { position: relative; flex: 1; min-width: 0; min-height: 120px; border-radius: 16px; overflow: hidden; background: var(--yuzey-1); }
  .orta.izleme-dar .sahne { flex: none; width: 100%; aspect-ratio: 16 / 9; min-height: 0; }
  .orta.tam .sahne { flex: 1; width: 100%; aspect-ratio: auto; min-height: 0; }
  .sahne-dugme { display: block; padding: 0; border: 0; text-align: left; }
  .yuzen { position: absolute; right: 10px; bottom: 10px; z-index: 2; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: var(--yuzey-2); color: var(--yazi); }

  /* Own screen-share tile: inset ring via ::after so the WebGL canvas never paints over it. */
  /* Kendi ekran paylaşım kutusu: WebGL tuvali kenarı örtmesin diye iç halka ::after ile çizilir. */
  .onizleme-kutu::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px var(--cozum); pointer-events: none; z-index: 2; }
  .onizleme-kutu.paylasim-hata::after { box-shadow: inset 0 0 0 2px var(--hata); }
  .onizleme-kutu :global(p) { font-size: .75rem; padding: 8px; text-align: center; }
  /* Compact red chip inside a >=44px hit target so phones can tap Stop without covering the preview. */
  /* Önizlemeyi kapatmadan telefonda rahat dokunmak için >=44px dokunma alanı içinde küçük kırmızı çip. */
  .onizleme-durdur { position: absolute; top: 0; right: 0; z-index: 3; min-width: 44px; min-height: 44px; padding: 8px; display: flex; align-items: flex-start; justify-content: flex-end; background: transparent; }
  .onizleme-durdur span { padding: 4px 8px; border-radius: 8px; background: var(--hata); color: var(--zemin); font-size: .75rem; font-weight: 600; line-height: 1.2; white-space: nowrap; }
  .onizleme-alt-sar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; }
  .ses-cipi {
    margin-left: 8px; max-width: calc(100% - 16px); padding: 3px 8px; border-radius: 8px;
    background: var(--yuzey-3); color: var(--yazi); font-size: .75rem; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .onizleme-serit {
    width: 100%; display: flex; align-items: center; gap: 6px; padding: 6px 10px;
    background: var(--yuzey-3); font-size: .75rem; color: var(--yazi-2); font-variant-numeric: tabular-nums;
  }
  .kutu.kucuk .onizleme-serit { padding: 4px 8px; }
  .onizleme-serit.yayinda { color: var(--yazi); }
  .onizleme-serit.hata { color: var(--hata); }
  .nokta { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--yazi-2); }
  .nokta.yesil { background: var(--cozum); }
  .nokta.hata { background: var(--hata); }
  .onizleme-metin { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dizi { flex: none; display: flex; flex-direction: row; gap: 12px; overflow-x: auto; }
  .dizi > * { flex: none; }
  .dizi.dikey { width: 220px; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
  .dizi.dikey .kutu.kucuk { width: 220px; height: 140px; min-height: 140px; aspect-ratio: auto; }
  .dizi:not(.dikey) .kutu.kucuk { width: 112px; height: 112px; min-height: 112px; aspect-ratio: auto; }
  .sec { display: block; padding: 0; text-align: left; }
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

  /* Wide dock: split capsules for mic & share, Sounds, divider, End. */
  /* Geniş dock: mikrofon ve paylaşım için bölünmüş kapsüller, Sesler, ayraç, Bitir. */
  .dock { flex: none; align-self: center; display: flex; align-items: center; gap: 8px; padding: 8px; margin-bottom: 16px; border-radius: 26px; background: var(--yuzey-2); }
  .bolunmus {
    display: inline-flex; align-items: stretch; height: 52px; border-radius: 18px;
    background: var(--yuzey-3); color: var(--yazi); overflow: hidden;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  .bolunmus.kapali { color: var(--hata); box-shadow: inset 0 0 0 2px var(--hata); }
  .bolunmus.paylasim-acik { background: var(--cozum); color: var(--zemin); }
  .bol-ana { width: 52px; height: 52px; display: grid; place-items: center; white-space: nowrap; }
  .bol-cizgi { flex: none; width: 1px; background: var(--kenar-ince); }
  .bolunmus.paylasim-acik .bol-cizgi { background: color-mix(in srgb, var(--zemin) 24%, transparent); }
  .bol-ok { width: 24px; height: 52px; display: grid; place-items: center; color: var(--yazi-2); }
  .bolunmus.kapali .bol-ok { color: var(--hata); }
  .bolunmus.paylasim-acik .bol-ok { color: var(--zemin); }
  .bol-ana:disabled, .bol-ok:disabled { opacity: .4; }
  @media (hover: hover) {
    .bol-ana:not(:disabled):hover, .bol-ok:not(:disabled):hover { background: color-mix(in srgb, var(--yazi) 8%, transparent); }
    .bolunmus.paylasim-acik .bol-ana:not(:disabled):hover, .bolunmus.paylasim-acik .bol-ok:not(:disabled):hover { background: color-mix(in srgb, var(--zemin) 12%, transparent); }
  }
  .dock-ayrac { flex: none; width: 1px; height: 32px; background: var(--kenar-ince); }
  .tus { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 18px; background: var(--yuzey-3); color: var(--yazi); white-space: nowrap; transition: background var(--sure-hizli) var(--egri-cikis); }
  .tus:disabled { opacity: .4; }
  .tus.acik { background: var(--ton); color: var(--ton-ustu); }
  .tus.son { width: 72px; background: var(--hata); color: var(--zemin); }

  /* Narrow dock: full width with 12px side margin, five equal labelled buttons. */
  /* Dar dock: 12px yan boşlukla tam genişlik, beş eşit etiketli düğme. */
  .dock.dar {
    align-self: stretch; width: calc(100% - 24px); margin: 0 12px 12px; padding: 6px;
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px;
    border-radius: 26px; overflow-x: auto; scrollbar-width: none;
  }
  .dar-tus {
    min-width: 0; min-height: 60px; padding: 8px 0; border-radius: 20px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    background: var(--yuzey-3); color: var(--yazi); white-space: nowrap;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  .dar-tus:disabled { opacity: .4; }
  .dar-tus.acik { background: var(--ton); color: var(--ton-ustu); }
  .dar-tus.kapali { color: var(--hata); box-shadow: inset 0 0 0 2px var(--hata); }
  .dar-tus.paylasim-acik { background: var(--cozum); color: var(--zemin); }
  .dar-tus.son { background: var(--hata); color: var(--zemin); }
  .dar-etiket { font-size: .6875rem; font-weight: 500; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  /* Below 360px five labels only fit at 10px. · 360px altında beş etiket ancak 10px ile sığar. */
  @media (max-width: 359px) { .dar-etiket { font-size: .625rem; } }

  /* "Daha fazla" bottom sheet rows · "Daha fazla" alt sayfası satırları */
  .daha-liste { display: grid; gap: 6px; }
  .daha-satir {
    display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 12px;
    border-radius: 12px; background: var(--yuzey-2); color: var(--yazi); text-align: left;
  }
  .daha-satir.bilgi { min-height: 52px; }
  .daha-simge { flex: none; display: inline-flex; color: var(--yazi-2); }
  .daha-simge.kilit-simge { color: var(--cozum); }
  .daha-metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .daha-metin strong { font-size: .9375rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .daha-ok { flex: none; display: inline-flex; color: var(--yazi-2); }

  /* Share sheet · Paylaş kartı */
  .paylas-bolum { display: grid; gap: 8px; }
  .bolum-baslik { text-transform: uppercase; letter-spacing: .06em; font-size: .75rem; font-weight: 600; color: var(--yazi-2); }
  .uygulama { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 12px; border-radius: 12px; background: var(--yuzey-2); }
  .ana { width: 100%; min-height: 48px; padding: 0 16px; border-radius: 14px; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; white-space: nowrap; }
  .ana.tehlike { background: var(--hata); color: var(--zemin); }
  .dipnot { text-align: center; }
</style>
