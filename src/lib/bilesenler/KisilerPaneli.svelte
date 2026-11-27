<!--
  Right-side People panel (desktop / tablet only): 300px, surface-1, hairline left border.
  Group rooms: search box, Admins (power >= 50), Online, Others, 36px avatars with green online dot, typing / last-seen / mxid subtitle,
  click opens KullaniciKarti, paginated for large rooms, 400ms delayed row skeleton.
  DM rooms: other person's profile (80px avatar, name, copyable mxid, presence, verification status, shared rooms from cached room lists,
  quick actions and Block / Unblock via YasaklaPenceresi where power allows).
  Wide desktop (>1180px) shrinks the message area; tablet / narrow desktop overlays the room with a light scrim.
  Sağ Kişiler paneli (yalnızca masaüstü / tablet): 300px, yüzey-1, solda ince çizgi.
  Grup odaları: arama kutusu, Yöneticiler (güç >= 50), Çevrimiçi, Diğerleri, 36px avatar ve çevrimiçi yeşil nokta, yazıyor / son görülme /
  mxid alt satırı, tıkla = KullaniciKarti, büyük odalarda sayfalama, 400ms gecikmeli satır iskeleti.
  DM'de karşıdaki kişinin profili: büyük avatar, ad, kopyalanabilir mxid, varlık, doğrulama durumu, ortak odalar, hızlı eylemler ve Engelle.
  Geniş masaüstünde (>1180px) mesaj alanını daraltır; tablet / dar masaüstünde hafif karartmayla üstüne kayar.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { OdaBilgisi, Uye } from "../api/tipler";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { rolAdi, uyeler } from "../durum/uyeler.svelte";
  import { varlik } from "../durum/varlik.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { perdeCik, perdeGir } from "../gecis";
  import { egri, sureMs } from "../hareket";
  import { t } from "../i18n";
  import { panoyaYaz } from "../pano";
  import { goreliZaman } from "../zaman-bicim";
  import Avatar from "./Avatar.svelte";
  import BosDurum from "./BosDurum.svelte";
  import Ikon from "./Ikon.svelte";
  import VarlikRozeti from "./VarlikRozeti.svelte";
  import YasaklaPenceresi from "./YasaklaPenceresi.svelte";

  let {
    odaId,
    bilgi,
    dm,
    kaplama,
    onkapat,
  }: {
    odaId: string;
    bilgi: OdaBilgisi | null;
    dm: boolean;
    kaplama: boolean;
    onkapat: () => void;
  } = $props();

  const SAYFA = 60;
  let sorgu = $state("");
  let gorunenLimit = $state(SAYFA);
  let yasakAcik = $state(false);
  let mesgul = $state(false);
  let panelEl: HTMLElement | undefined = $state();

  // 200ms translateX slide-in / slide-out; instant under reduced motion (--sure-orta = 0ms).
  // 200ms translateX giriş / çıkış; azaltılmış harekette anında (--sure-orta = 0ms).
  function panelKay(giris: boolean) {
    return (node: Element) => {
      const sure = sureMs("--sure-orta");
      if (sure > 0) {
        const el = node as HTMLElement;
        el.style.willChange = "transform";
        const temizle = () => {
          if (el.style.willChange === "transform") el.style.removeProperty("will-change");
        };
        const dis = { transform: "translate3d(100%, 0, 0)" };
        const ic = { transform: "translate3d(0, 0, 0)" };
        const a = node.animate(giris ? [dis, ic] : [ic, dis], {
          duration: sure,
          easing: egri(giris ? "--egri-ac" : "--egri-giris"),
          fill: giris ? "backwards" : "forwards",
        });
        a.onfinish = temizle;
        a.oncancel = temizle;
      }
      return { duration: sure };
    };
  }
  const gir = panelKay(true);
  const cik = panelKay(false);

  // Load room members when the panel opens or switches rooms (reuses Uyeler cache).
  // Panel açılınca ya da oda değişince üyeleri yükle (Uyeler önbelleğini yeniden kullanır).
  $effect(() => {
    const id = odaId;
    sorgu = "";
    gorunenLimit = SAYFA;
    yasakAcik = false;
    untrack(() => {
      const mevcut = uyeler.al(id);
      if (mevcut.liste.length === 0 && !mevcut.yukleniyor) void uyeler.yukle(id);
    });
  });

  $effect(() => {
    void sorgu;
    gorunenLimit = SAYFA;
  });

  const d = $derived(uyeler.al(odaId));
  const yazanIdler = $derived(new Set(zaman.yazanlar.map((k) => k.id)));

  // Skeleton only after 400 ms of waiting (docs/gorevler/yukleme-iskeletleri.md).
  // İskelet yalnızca 400 ms beklenince görünür (docs/gorevler/yukleme-iskeletleri.md).
  let iskeletZamani = $state(false);
  $effect(() => {
    if (!(d.yukleniyor && d.liste.length === 0)) {
      iskeletZamani = false;
      return;
    }
    const z = setTimeout(() => (iskeletZamani = true), 400);
    return () => clearTimeout(z);
  });

  // ---- Group room lists · Grup odası listeleri ----
  const katilmis = $derived(d.liste.filter((u) => u.uyelik === "join"));
  const suzulmus = $derived.by(() => {
    const q = sorgu.trim().toLocaleLowerCase("tr");
    if (!q) return katilmis;
    return katilmis.filter((u) => u.ad.toLocaleLowerCase("tr").includes(q) || u.kullaniciId.toLocaleLowerCase("tr").includes(q));
  });

  const yoneticiler = $derived(
    suzulmus
      .filter((u) => u.guc >= 50)
      .sort((a, b) => b.guc - a.guc || a.ad.localeCompare(b.ad, "tr")),
  );
  const cevrimiciler = $derived(
    suzulmus
      .filter((u) => u.guc < 50 && varlik.al(u.kullaniciId)?.durum === "cevrimici")
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
  );
  const digerleri = $derived(
    suzulmus
      .filter((u) => u.guc < 50 && varlik.al(u.kullaniciId)?.durum !== "cevrimici")
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
  );

  // Paginate across groups so rooms with thousands of members stay crisp.
  // Binlerce üyeli odalar akıcı kalsın diye gruplar genelinde sayfala.
  const gYoneticiler = $derived(yoneticiler.slice(0, gorunenLimit));
  const gCevrimiciler = $derived(cevrimiciler.slice(0, Math.max(0, gorunenLimit - gYoneticiler.length)));
  const gDigerleri = $derived(digerleri.slice(0, Math.max(0, gorunenLimit - gYoneticiler.length - gCevrimiciler.length)));
  const kalanSayi = $derived(
    yoneticiler.length + cevrimiciler.length + digerleri.length - (gYoneticiler.length + gCevrimiciler.length + gDigerleri.length),
  );

  // Gently query presence for the first visible slice when the server supports it.
  // Sunucu destekliyorsa ilk görünür dilim için varlığı nazikçe sorgula.
  $effect(() => {
    if (dm || katilmis.length === 0) return;
    const hedefler = [...gYoneticiler, ...gCevrimiciler, ...gDigerleri].slice(0, 24).map((u) => u.kullaniciId);
    untrack(() => void varlik.topluSor(hedefler, 24));
  });

  function listeKaydir(e: Event) {
    if (kalanSayi <= 0) return;
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) gorunenLimit += SAYFA;
  }

  // ---- DM profile data · DM profil verisi ----
  const karsiId = $derived(dm ? bilgi?.karsiKullanici ?? null : null);
  const karsiUye = $derived(karsiId ? uyeler.uye(odaId, karsiId) : undefined);
  const karsiAd = $derived(karsiUye?.ad ?? bilgi?.ad ?? (karsiId ?? "").replace(/^@/, "").split(":")[0]);
  const karsiAvatar = $derived(karsiUye?.avatarMxc ?? bilgi?.avatarMxc ?? null);
  const ortakOdalar = $derived.by(() => {
    if (!karsiId) return [];
    return odalar.liste.filter((o) => !o.alan && !o.davet && o.id !== odaId && uyeler.uye(o.id, karsiId)?.uyelik === "join");
  });

  async function kopyala(id: string) {
    try {
      await panoyaYaz(id);
      bildirim.goster(t("kart.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  function bahset() {
    if (!karsiId) return;
    odalar.taslakBahisEkle(odaId, karsiId, karsiAd);
    if (kaplama) onkapat();
    document.querySelector<HTMLElement>(".oda .yazma textarea")?.focus();
  }

  async function engeliKaldir() {
    if (!karsiId || mesgul) return;
    mesgul = true;
    try {
      await uyeler.yasagiKaldir(odaId, karsiId);
      bildirim.goster(t("uyeler.yasagiKaldirildi"), 2500, { tur: "tamam" });
    } catch (e) {
      bildirim.goster(t("yasakla.hata", { mesaj: (e as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  function panelTus(e: KeyboardEvent) {
    if (e.key !== "Escape" || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    if (!panelEl || !document.activeElement || !panelEl.contains(document.activeElement)) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    if (e.target instanceof HTMLInputElement && sorgu) {
      e.preventDefault();
      sorgu = "";
      return;
    }
    e.preventDefault();
    onkapat();
  }
</script>

<svelte:window onkeydown={panelTus} />

{#if kaplama}
  <div class="perde" role="presentation" onclick={onkapat} in:perdeGir out:perdeCik></div>
{/if}

<aside
  class="panel"
  class:kaplama
  data-kisiler-paneli
  tabindex="-1"
  bind:this={panelEl}
  aria-label={t("kisiler.baslik")}
  in:gir
  out:cik
>
  <header class="baslik">
    <h2>{t("kisiler.baslik")}</h2>
    <kbd class="kisayol-ipucu" aria-hidden="true">Ctrl+L</kbd>
    <button class="simge-dugme kapat" aria-label={t("kisiler.kapat")} onclick={onkapat}>
      <Ikon ad="kapat" boyut={18} />
    </button>
  </header>

  {#if dm && karsiId && bilgi}
    <div class="govde dm-govde">
      <div class="profil-kimlik">
        <Avatar harf={karsiAd.charAt(0).toUpperCase() || "#"} mxc={karsiAvatar} boyut={80} anahtar={karsiId} />
        <h3>{karsiAd}</h3>
        <button class="mxid" onclick={() => void kopyala(karsiId)} aria-label={t("kart.kimlikKopyala")}>
          <span>{karsiId}</span>
          <Ikon ad="kopya" boyut={14} />
        </button>
        <div class="dm-varlik"><VarlikRozeti kullaniciId={karsiId} /></div>
      </div>

      <div class="dm-eylemler">
        <button
          class="dm-eylem"
          data-dalga
          onclick={() => arama.ara({ id: bilgi.id, ad: bilgi.ad, avatarHarf: bilgi.avatarHarf, avatarMxc: bilgi.avatarMxc })}
        >
          <Ikon ad="telefon" boyut={20} />
          <span>{t("oda.sesliAra")}</span>
        </button>
        <button class="dm-eylem" data-dalga onclick={bahset}>
          <Ikon ad="kisi" boyut={20} />
          <span>{t("kart.bahset")}</span>
        </button>
      </div>

      <section class="bolum">
        <h4>{t("kisiler.dogrulama")}</h4>
        <div class="durum-kart" class:sifreli={bilgi.sifreli}>
          <Ikon ad={bilgi.sifreli ? "kalkanOnay" : "uyari"} boyut={18} />
          <span>{bilgi.sifreli ? t("kisiler.dogrulamaSifreli") : t("kisiler.dogrulamaSifresiz")}</span>
        </div>
      </section>

      <section class="bolum">
        <h4>{t("kisiler.ortakOdalar")}{#if ortakOdalar.length > 0} · {ortakOdalar.length}{/if}</h4>
        {#if ortakOdalar.length === 0}
          <p class="bos-metin">{t("kisiler.ortakOdaYok")}</p>
        {:else}
          <div class="ortak-liste">
            {#each ortakOdalar as o (o.id)}
              <button class="ortak-satir" data-kisi-satir data-dalga onclick={() => gezinme.odaAc(o.id)}>
                <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={32} anahtar={o.id} />
                <span class="ortak-ad">{o.ad}</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <section class="bolum dm-alt">
        <button class="alt-satir" data-kisi-satir onclick={() => kullaniciKartiAc(karsiId, odaId, karsiAd, karsiAvatar)}>
          <Ikon ad="bilgi" boyut={18} />
          <span>{t("kisiler.kullaniciKarti")}</span>
        </button>
        {#if karsiUye && uyeler.yasaklayabilir(odaId, karsiUye)}
          <button class="alt-satir tehlike" data-kisi-satir onclick={() => (yasakAcik = true)}>
            <Ikon ad="kapat" boyut={18} />
            <span>{t("kisiler.engelle")}</span>
          </button>
        {:else if karsiUye && uyeler.yasagiKaldirabilir(odaId, karsiUye)}
          <button class="alt-satir" data-kisi-satir disabled={mesgul} onclick={() => void engeliKaldir()}>
            <Ikon ad="onay" boyut={18} />
            <span>{t("kisiler.engeliKaldir")}</span>
          </button>
        {/if}
      </section>
    </div>
  {:else}
    <div class="arama-kap">
      <div class="arama-kutu">
        <Ikon ad="ara" boyut={16} />
        <input
          type="search"
          bind:value={sorgu}
          placeholder={t("kisiler.araYer")}
          aria-label={t("kisiler.araYer")}
          autocomplete="off"
          spellcheck="false"
        />
        {#if sorgu}
          <button class="ara-temizle" aria-label={t("kisiler.araTemizle")} onclick={() => (sorgu = "")}>
            <Ikon ad="kapat" boyut={14} />
          </button>
        {/if}
      </div>
    </div>

    <div class="govde liste" onscroll={listeKaydir}>
      {#if d.hata && d.liste.length === 0}
        <BosDurum maskot="hata" boyut={84} baslik={t("uyeler.hata")} metin={t("uyeler.hataAlt")} eylem={t("eylem.tekrarDene")} onEylem={() => void uyeler.yukle(odaId)} />
      {:else if d.yukleniyor && d.liste.length === 0}
        {#if iskeletZamani}
          {#each [0, 1, 2, 3, 4, 5] as i (i)}
            <div class="iskelet-satir" aria-hidden="true">
              <span class="parilti isk-av"></span>
              <span class="isk-metin">
                <span class="parilti isk-ad" style:width="{46 + (i % 3) * 14}%"></span>
                <span class="parilti isk-alt" style:width="{58 + (i % 2) * 16}%"></span>
              </span>
            </div>
          {/each}
        {/if}
      {:else if gYoneticiler.length === 0 && gCevrimiciler.length === 0 && gDigerleri.length === 0}
        <p class="bos-liste">{sorgu.trim() ? t("kisiler.sonucYok") : t("uyeler.bosBaslik")}</p>
      {:else}
        {#if gYoneticiler.length > 0}
          <div class="grup-baslik">{t("kisiler.yoneticiler")} · {yoneticiler.length}</div>
          {#each gYoneticiler as u (u.kullaniciId)}
            {@render kisiSatiri(u)}
          {/each}
        {/if}
        {#if gCevrimiciler.length > 0}
          <div class="grup-baslik">{t("kisiler.cevrimici")} · {cevrimiciler.length}</div>
          {#each gCevrimiciler as u (u.kullaniciId)}
            {@render kisiSatiri(u)}
          {/each}
        {/if}
        {#if gDigerleri.length > 0}
          <div class="grup-baslik">{t("kisiler.digerleri")} · {digerleri.length}</div>
          {#each gDigerleri as u (u.kullaniciId)}
            {@render kisiSatiri(u)}
          {/each}
        {/if}
        {#if kalanSayi > 0}
          <button class="daha-fazla" onclick={() => (gorunenLimit += SAYFA)}>
            {t("kisiler.dahaFazla", { n: kalanSayi })}
          </button>
        {/if}
      {/if}
    </div>
  {/if}

  {#if tercihler.d.ctrlKisayol && tercihler.d.kisayolIpucuAcik}
    <footer class="panel-ipucu" aria-hidden="true">{t("kisiler.ipucu")}</footer>
  {/if}
</aside>

{#if yasakAcik && karsiId}
  <YasaklaPenceresi {odaId} kullaniciId={karsiId} ad={karsiAd} avatarMxc={karsiAvatar} onkapat={() => (yasakAcik = false)} />
{/if}

{#snippet kisiSatiri(u: Uye)}
  {@const v = varlik.al(u.kullaniciId)}
  {@const cevrimici = v?.durum === "cevrimici"}
  {@const cevrimdisi = v !== null && !cevrimici}
  {@const yaziyor = yazanIdler.has(u.kullaniciId)}
  {@const altMetin = yaziyor
    ? t("kisiler.yaziyor")
    : !cevrimici && v?.sonEtkinlikMs != null
      ? t("varlik.sonGorulme", { zaman: goreliZaman(Date.now() - v.sonEtkinlikMs) })
      : u.kullaniciId}
  <button
    class="satir"
    data-kisi-satir
    data-dalga
    onclick={() => kullaniciKartiAc(u.kullaniciId, odaId, u.ad, u.avatarMxc)}
  >
    <span class="av-kap">
      <Avatar harf={u.ad.charAt(0).toUpperCase() || "#"} mxc={u.avatarMxc} boyut={36} anahtar={u.kullaniciId} />
      {#if cevrimici}<span class="nokta" aria-hidden="true"></span>{/if}
    </span>
    <span class="metin">
      <strong class:soluk={cevrimdisi}>{u.ad}</strong>
      <small class:yaziyor class:mono={!yaziyor && (cevrimici || v?.sonEtkinlikMs == null)}>{altMetin}</small>
    </span>
    {#if rolAdi(u.guc) === "yonetici"}
      <span class="rol yonetici">{t("uyeler.yoneticiRol")}</span>
    {:else if rolAdi(u.guc) === "moderator"}
      <span class="rol">{t("uyeler.moderatorRol")}</span>
    {/if}
  </button>
{/snippet}

<style>
  .perde {
    position: absolute;
    inset: 0;
    z-index: 14;
    background: color-mix(in srgb, var(--zemin) 48%, transparent);
  }
  .panel {
    position: relative;
    flex: none;
    width: 300px;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--yuzey-1);
    border-left: 1px solid var(--kenar-ince);
    outline: none;
    min-height: 0;
  }
  .panel.kaplama {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 15;
  }

  .baslik {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 6px 8px 6px 16px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .baslik h2 {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .kisayol-ipucu {
    margin-right: auto;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    color: var(--yazi-2);
    font-family: var(--mono-tipi);
    font-size: .6875rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .kapat { flex: none; }

  .arama-kap { flex: none; padding: 10px 12px 6px; }
  .arama-kutu {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 14px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    color: var(--yazi-2);
  }
  .arama-kutu:focus-within { border-color: var(--vurgu); }
  .arama-kutu input {
    flex: 1;
    min-width: 0;
    min-height: 36px;
    background: none;
    border: 0;
    outline: none;
    color: var(--yazi);
    font-size: .875rem;
  }
  .arama-kutu input::placeholder { color: var(--yazi-2); }
  .ara-temizle {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--yazi-2);
  }
  @media (hover: hover) {
    .ara-temizle:hover { background: var(--yuzey-3); color: var(--yazi); }
  }

  .govde {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .liste { padding: 4px 8px 16px; }

  .grup-baslik {
    padding: 12px 8px 4px;
    font-size: .6875rem;
    font-weight: 600;
    letter-spacing: .06em;
    color: var(--yazi-2);
  }
  .satir {
    content-visibility: auto;
    contain-intrinsic-size: auto 52px;
    width: 100%;
    min-height: 52px;
    padding: 6px 8px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
  }
  @media (hover: hover) {
    .satir:hover { background: var(--yuzey-2); }
  }
  .satir:focus-visible {
    outline: 2px solid var(--vurgu);
    outline-offset: -2px;
    background: var(--yuzey-2);
  }
  .av-kap { position: relative; flex: none; display: inline-flex; }
  .nokta {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--cozum);
    border: 2px solid var(--yuzey-1);
  }
  .metin { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .metin strong {
    font-size: .875rem;
    font-weight: 600;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .metin strong.soluk { color: var(--yazi-2); font-weight: 500; }
  .metin small {
    font-size: .75rem;
    color: var(--yazi-2);
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .metin small.yaziyor { color: var(--vurgu); font-weight: 500; }
  .rol {
    flex: none;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--yuzey-3);
    color: var(--yazi-2);
    font-size: .6875rem;
    font-weight: 600;
  }
  .rol.yonetici {
    background: var(--ton);
    color: var(--ton-ustu);
  }

  .daha-fazla {
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    border-radius: 12px;
    background: var(--yuzey-2);
    color: var(--vurgu);
    font-size: .8125rem;
    font-weight: 600;
    text-align: center;
  }
  @media (hover: hover) {
    .daha-fazla:hover { background: var(--yuzey-3); }
  }
  .bos-liste {
    padding: 24px 12px;
    text-align: center;
    font-size: .875rem;
    color: var(--yazi-2);
  }

  /* Row skeleton matches exact 52px row height and 36px avatar geometry · Satır iskeleti tam 52px satır yüksekliği ve 36px avatar biçimine uyar */
  .iskelet-satir {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 6px 8px;
  }
  .isk-av { flex: none; width: 36px; height: 36px; border-radius: 9px; }
  .isk-metin { flex: 1; min-width: 0; display: grid; gap: 6px; }
  .isk-ad { height: 12px; border-radius: 6px; }
  .isk-alt { height: 10px; border-radius: 5px; }

  /* ---- DM profile layout · DM profil düzeni ---- */
  .dm-govde {
    padding: 20px 16px 24px;
    display: grid;
    grid-auto-rows: max-content;
    gap: 18px;
    align-content: start;
  }
  .profil-kimlik {
    display: grid;
    justify-items: center;
    gap: 6px;
    text-align: center;
  }
  .profil-kimlik h3 {
    margin-top: 4px;
    font-family: var(--baslik-tipi);
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .mxid {
    min-height: 36px;
    padding: 4px 8px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono-tipi);
    font-size: .75rem;
    color: var(--yazi-2);
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  @media (hover: hover) {
    .mxid:hover { background: var(--yuzey-2); color: var(--yazi); }
  }
  .dm-varlik { font-size: .8125rem; color: var(--yazi-2); min-height: 18px; }
  .dm-eylemler { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .dm-eylem {
    min-height: 56px;
    border-radius: 14px;
    background: var(--yuzey-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: .75rem;
    font-weight: 600;
  }
  @media (hover: hover) {
    .dm-eylem:hover { background: var(--yuzey-3); }
  }
  .bolum { display: grid; gap: 8px; }
  .bolum h4 {
    margin: 0;
    font-size: .6875rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--yazi-2);
  }
  .durum-kart {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--yuzey-2);
    color: var(--yazi-2);
    font-size: .8125rem;
    font-weight: 500;
  }
  .durum-kart.sifreli {
    background: color-mix(in srgb, var(--cozum) 14%, var(--yuzey-1));
    color: var(--cozum);
  }
  .bos-metin { font-size: .8125rem; color: var(--yazi-2); }
  .ortak-liste { display: grid; gap: 4px; }
  .ortak-satir {
    width: 100%;
    min-height: 44px;
    padding: 6px 8px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    font-size: .875rem;
    font-weight: 500;
  }
  @media (hover: hover) {
    .ortak-satir:hover { background: var(--yuzey-2); }
  }
  .ortak-ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-alt { border-top: 1px solid var(--kenar-ince); padding-top: 12px; gap: 4px; }
  .alt-satir {
    width: 100%;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: .875rem;
    font-weight: 500;
    text-align: left;
  }
  @media (hover: hover) {
    .alt-satir:hover { background: var(--yuzey-2); }
  }
  .alt-satir.tehlike { color: var(--hata); font-weight: 600; }

  .panel-ipucu {
    flex: none;
    padding: 6px 12px;
    border-top: 1px solid var(--kenar-ince);
    font-size: .6875rem;
    color: var(--yazi-2);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
