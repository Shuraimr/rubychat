<!--
  One space: its child rooms and sub-spaces from the server's `/hierarchy` (so rooms I have NOT joined are listed too, with name, topic and
  member count). Joined rooms open as normal chats, a room I am not in gets a "Katıl" button, a sub-space opens this same view one level deeper.
  Admins (`alanYetkim`) see create/add/invite actions, grouped sections (Featured / Rooms / Sub-spaces), and child context menus.
  The ← button / Android back goes up one level (see durum/alanlar.svelte.ts). Offline or a server error shows the mascot with "Tekrar dene".
  Bir alan: çocuk odaları ve alt alanları, sunucunun `/hierarchy`sinden (yani katılMADIĞIM odalar da ad, konu ve üye sayısıyla listelenir).
  Katılınmış odalar normal sohbet gibi açılır, içinde olmadığım odada "Katıl" düğmesi çıkar, alt alan bu aynı görünümü bir düzey derinde açar.
  Yöneticiler (`alanYetkim`) oluştur/ekle/davet eylemlerini, gruplanmış bölümleri (Öne çıkanlar / Odalar / Alt alanlar) ve çocuk menüsünü görür.
  ← düğmesi / Android geri tuşu bir düzey yukarı çıkar (bkz. durum/alanlar.svelte.ts). Çevrimdışı ya da sunucu hatasında maskot ve "Tekrar dene" görünür.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { alanIcerigi, alanaKatil, alandanCikar, alanOneCikar, alanYetkim, kullaniciAra } from "../api/komutlar";
  import type { AlanIcerigi, AlanOgesi, AlanYetkim, BulunanKisi, Hata } from "../api/tipler";
  import AlanOdaOlustur from "../bilesenler/AlanOdaOlustur.svelte";
  import AlanaOdaEkle from "../bilesenler/AlanaOdaEkle.svelte";
  import AlanSatiri from "../bilesenler/AlanSatiri.svelte";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import BaglamMenusu, { type MenuEylemi } from "../bilesenler/BaglamMenusu.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import SilOnay from "../bilesenler/SilOnay.svelte";
  import { alanlar, type AlanAdimi } from "../durum/alanlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekAc } from "../durum/istekler.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { uyeler } from "../durum/uyeler.svelte";
  import { t, type Anahtar as I18nAnahtar } from "../i18n";
  import { panoyaYaz } from "../pano";

  /** gomulu = the root of a folder tab in the chat list: no header (the tabs already name it) · gomulu = sohbet listesindeki bir klasör sekmesinin kökü: başlık yok (sekmeler zaten adını söyler) */
  let { adim, gomulu = false }: { adim: AlanAdimi; gomulu?: boolean } = $props();

  const BOS_YETKI: AlanYetkim = { cocukYonetebilir: false, ayarDegistirebilir: false, davetEdebilir: false };

  // svelte-ignore state_referenced_locally (the screen is re-created per space)
  let icerik = $state<AlanIcerigi | null>(alanlar.icerikler.get(adim.id) ?? null);
  let yetki = $state<AlanYetkim>({ ...BOS_YETKI });
  let yukleniyor = $state(true);
  let hata = $state<Hata | null>(null);
  let kenar = $state(false);
  /** Ids being joined right now (a Set in state so the buttons can show progress) · Şu an katılınan kimlikler (düğmeler ilerlemeyi göstersin diye state içinde) */
  let katilan = $state<Record<string, true>>({});
  let istek = 0;

  // Management modals & context menu state · Yönetim pencereleri ve bağlam menüsü durumu
  let olusturAcik = $state(false);
  let ekleAcik = $state(false);
  let davetAcik = $state(false);
  let davetKimlik = $state("");
  let davetSonuc = $state<BulunanKisi[]>([]);
  let davetAraniyor = $state(false);
  let davetHata = $state<string | null>(null);
  let davetMesgul = $state(false);
  let menu = $state<{ oge: AlanOgesi; x: number; y: number } | null>(null);
  let cikarHedef = $state<AlanOgesi | null>(null);

  const hataMetni = (e: unknown) => {
    const err = e as Hata | undefined;
    return err?.tur && err.tur !== "diger" ? t(`hata.${err.tur}` as I18nAnahtar) : err?.mesaj || t("hata.diger");
  };

  async function yukle() {
    const bu = ++istek;
    hata = null;
    // Keep the old content while refreshing (a join or edit must not flash the whole screen). · Yenilerken eski içeriği tut (katılma ya da düzenleme ekranı yanıp söndürmesin).
    if (!icerik) yukleniyor = true;
    const [icerikSonuc, yetkiSonuc] = await Promise.allSettled([alanIcerigi(adim.id), alanYetkim(adim.id)]);
    if (bu !== istek) return;
    if (icerikSonuc.status === "fulfilled") {
      alanlar.icerikler.set(adim.id, icerikSonuc.value);
      icerik = icerikSonuc.value;
    } else {
      hata = icerikSonuc.reason as Hata;
    }
    if (yetkiSonuc.status === "fulfilled") {
      yetki = yetkiSonuc.value;
    } else {
      yetki = { ...BOS_YETKI };
    }
    yukleniyor = false;
  }

  // Load when the screen opens (it is re-created per space with {#key}). · Ekran açılınca yükle ({#key} ile her alan için yeniden kurulur).
  $effect(() => {
    adim.id;
    // untrack: loading reads AND writes `icerik`; tracked, it would reload the space forever. · untrack: yükleme `icerik`i hem okur hem yazar; izlenirse alan sonsuza dek yeniden yüklenirdi.
    untrack(() => void yukle());
  });

  const baslik = $derived(icerik?.alan?.ad ?? adim.ad);
  const katildi = $derived(icerik?.alan ? icerik.alan.katildi : odalar.alanlar.some((a) => a.id === adim.id));
  const ayarAcilabilir = $derived(yetki.ayarDegistirebilir || katildi);

  // Grouped children: Featured (suggested) / Rooms / Sub-spaces; empty groups are omitted · Gruplanmış çocuklar: Öne çıkanlar / Odalar / Alt alanlar; boş gruplar gizlenir
  const oneCikanlar = $derived((icerik?.cocuklar ?? []).filter((c) => c.onerilen));
  const odalarGrup = $derived((icerik?.cocuklar ?? []).filter((c) => !c.onerilen && !c.alan));
  const altAlanlar = $derived((icerik?.cocuklar ?? []).filter((c) => !c.onerilen && c.alan));
  const gruplar = $derived(
    [
      { id: "one", baslik: t("alanYonet.oneCikanlar"), ogeler: oneCikanlar },
      { id: "oda", baslik: t("alanYonet.odalar"), ogeler: odalarGrup },
      { id: "alt", baslik: t("alanYonet.altAlanlar"), ogeler: altAlanlar },
    ].filter((g) => g.ogeler.length > 0),
  );

  function ac(c: AlanOgesi) {
    if (c.alan) alanlar.ac(c.id, c.ad);
    // Stay on the Alanlar tab so back returns to this space, not to the chat list. · Alanlar sekmesinde kal; geri bu alana döner, sohbet listesine değil.
    else if (c.katildi) gezinme.odaAc(c.id, true);
  }

  function alanAyarlariAc() {
    gezinme.odaAyarAc({
      odaId: adim.id,
      alanMi: true,
      degisti: () => void yukle(),
    });
  }

  async function katil(c: AlanOgesi) {
    if (katilan[c.id]) return;
    katilan[c.id] = true;
    try {
      // The `via` servers come from the space's m.space.child event: they know where the room lives. · `via` sunucuları alanın m.space.child olayından gelir: odanın nerede olduğunu bilirler.
      await alanaKatil(c.id, c.via);
      bildirim.goster(t("alanlar.katildin", { ad: c.ad }), 3500, { tur: "tamam" });
      await yukle();
    } catch (e) {
      // Not allowed to walk in: offer to ask for permission instead. · Doğrudan girilemiyor: onun yerine izin istemeyi öner.
      if ((e as Hata).tur === "giris") istekAc({ kimlik: c.id, ad: c.ad, via: c.via });
      else bildirim.goster(t(`hata.${(e as Hata).tur}` as I18nAnahtar), 4500, { tur: "hata" });
    } finally {
      delete katilan[c.id];
    }
  }

  // ---- Child context menu actions (admins only) · Çocuk bağlam menüsü eylemleri (yalnızca yöneticiler) ----
  async function oneCikarDegis(c: AlanOgesi) {
    try {
      await alanOneCikar(adim.id, c.id, !c.onerilen);
      bildirim.goster(t(!c.onerilen ? "alanYonet.oneCikarildi" : "alanYonet.oneCikarmaKaldirildi"), 2500, { tur: "tamam" });
      await yukle();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    }
  }

  async function baglantiKopyala(c: AlanOgesi) {
    const sunucu = c.via[0] ?? (c.id.includes(":") ? c.id.slice(c.id.indexOf(":") + 1) : oturum.ben?.sunucu ?? "");
    const url = `https://matrix.to/#/${encodeURIComponent(c.id)}${sunucu ? `?via=${encodeURIComponent(sunucu)}` : ""}`;
    try {
      await panoyaYaz(url);
      bildirim.goster(t("alanYonet.baglantiKopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  async function cocuguCikar(c: AlanOgesi) {
    try {
      await alandanCikar(adim.id, c.id);
      bildirim.goster(t("alanYonet.cikarildi"), 2500, { tur: "tamam" });
      await yukle();
      if (c.alan) void alanlar.ustYenile();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    }
  }

  const menuEylemleri = $derived.by((): MenuEylemi[] => {
    const c = menu?.oge;
    if (!c) return [];
    const liste: MenuEylemi[] = [
      {
        ikon: "yildiz",
        etiket: c.onerilen ? t("alanYonet.oneCikarmayiKaldir") : t("alanYonet.oneCikar"),
        calistir: () => void oneCikarDegis(c),
      },
    ];
    if (c.katildi) {
      liste.push({
        ikon: "disli",
        etiket: c.alan ? t("alanYonet.alanAyarlari") : t("alanYonet.odaAyarlari"),
        calistir: () =>
          gezinme.odaAyarAc({
            odaId: c.id,
            alanId: adim.id,
            alanAd: baslik,
            alanMi: c.alan,
            degisti: () => void yukle(),
          }),
      });
    }
    liste.push(
      {
        ikon: "baglanti",
        etiket: t("alanYonet.baglantiyiKopyala"),
        calistir: () => void baglantiKopyala(c),
      },
      {
        ikon: "cop",
        etiket: t("alanYonet.alandanCikar"),
        tehlike: true,
        calistir: () => (cikarHedef = c),
      },
    );
    return liste;
  });

  // ---- Space invite sheet (reuses the same uyeler.davet flow as Uyeler.svelte + user directory search) · Alan davet sayfası ----
  let davetTur = 0;
  $effect(() => {
    if (!davetAcik) {
      davetSonuc = [];
      davetAraniyor = false;
      return;
    }
    const s = davetKimlik.trim();
    if (s.length < 2) {
      ++davetTur;
      davetSonuc = [];
      davetAraniyor = false;
      return;
    }
    davetAraniyor = true;
    const bu = ++davetTur;
    const z = setTimeout(async () => {
      try {
        const r = await kullaniciAra(s);
        if (bu === davetTur) davetSonuc = r.filter((k) => k.kullaniciId !== oturum.ben?.kullaniciId);
      } catch {
        if (bu === davetTur) davetSonuc = [];
      } finally {
        if (bu === davetTur) davetAraniyor = false;
      }
    }, 300);
    return () => clearTimeout(z);
  });

  function davetKapat() {
    davetAcik = false;
    davetKimlik = "";
    davetHata = null;
    davetSonuc = [];
  }

  async function davetGonder(kimlik: string) {
    const k = kimlik.trim();
    if (!/^@[^:\s]+:[^\s]+$/.test(k)) {
      davetHata = t("uyeler.davetGecersiz");
      return;
    }
    davetMesgul = true;
    davetHata = null;
    try {
      await uyeler.davet(adim.id, k);
      bildirim.goster(t("uyeler.davetGonderildi"), 2500, { tur: "tamam" });
      davetKapat();
    } catch (e) {
      davetHata = hataMetni(e);
    } finally {
      davetMesgul = false;
    }
  }

  // Joined / left rooms elsewhere change the list: refresh quietly. · Başka yerde katılınan / ayrılınan odalar listeyi değiştirir: sessizce yenile.
  let oncekiSayi = -1;
  $effect(() => {
    const n = odalar.liste.length;
    if (oncekiSayi >= 0 && n !== oncekiSayi) untrack(() => !yukleniyor && void yukle());
    oncekiSayi = n;
  });

  const eylemSatiriGorunur = $derived(
    (!gezinme.genis && yetki.cocukYonetebilir) || (gomulu && (yetki.cocukYonetebilir || ayarAcilabilir)),
  );
</script>

<div class="alan-gorunumu">
  {#if !gomulu}
    <Baslik {baslik} geri={() => alanlar.geri()} {kenar}>
      {#snippet eylemler()}
        {#if gezinme.genis}
          <div class="baslik-butonlar">
            {#if yetki.cocukYonetebilir}
              <button type="button" class="baslik-eylem tonlu" onclick={() => (olusturAcik = true)} aria-label={t("alanYonet.odaOlustur")} title={t("alanYonet.odaOlustur")}>
                <Ikon ad="artik" boyut={20} /><span class="etiket">{t("alanYonet.odaOlustur")}</span>
              </button>
              <button type="button" class="baslik-eylem" onclick={() => (ekleAcik = true)} aria-label={t("alanYonet.odaEkle")} title={t("alanYonet.odaEkle")}>
                <Ikon ad="baglanti" boyut={20} /><span class="etiket">{t("alanYonet.odaEkle")}</span>
              </button>
              {#if yetki.davetEdebilir}
                <button type="button" class="baslik-eylem" onclick={() => (davetAcik = true)} aria-label={t("alanYonet.davetEt")} title={t("alanYonet.davetEt")}>
                  <Ikon ad="kisiEkle" boyut={20} /><span class="etiket">{t("alanYonet.davetEt")}</span>
                </button>
              {/if}
            {/if}
            {#if ayarAcilabilir}
              <button type="button" class="baslik-eylem" onclick={alanAyarlariAc} aria-label={t("alanYonet.ayarlar")} title={t("alanYonet.ayarlar")}>
                <Ikon ad="disli" boyut={20} /><span class="etiket">{t("alanYonet.ayarlar")}</span>
              </button>
            {/if}
          </div>
        {:else if ayarAcilabilir}
          <button type="button" class="simge-dugme" onclick={alanAyarlariAc} aria-label={t("alanYonet.alanAyarlari")} title={t("alanYonet.alanAyarlari")}>
            <Ikon ad="disli" boyut={22} />
          </button>
        {/if}
      {/snippet}
    </Baslik>
  {/if}

  {#if eylemSatiriGorunur}
    <div class="eylem-satiri" role="toolbar" aria-label={baslik}>
      {#if yetki.cocukYonetebilir}
        <button type="button" class="eylem-cip tonlu" data-dalga onclick={() => (olusturAcik = true)}>
          <Ikon ad="artik" boyut={18} /><span>{t("alanYonet.odaOlustur")}</span>
        </button>
        <button type="button" class="eylem-cip" data-dalga onclick={() => (ekleAcik = true)}>
          <Ikon ad="baglanti" boyut={18} /><span>{t("alanYonet.odaEkle")}</span>
        </button>
        {#if yetki.davetEdebilir}
          <button type="button" class="eylem-cip" data-dalga onclick={() => (davetAcik = true)}>
            <Ikon ad="kisiEkle" boyut={18} /><span>{t("alanYonet.davetEt")}</span>
          </button>
        {/if}
      {/if}
      {#if gomulu && ayarAcilabilir}
        <button type="button" class="eylem-cip" data-dalga onclick={alanAyarlariAc}>
          <Ikon ad="disli" boyut={18} /><span>{t("alanYonet.ayarlar")}</span>
        </button>
      {/if}
    </div>
  {/if}

  {#if yukleniyor && !icerik}
    <p class="orta">{t("alanlar.yukleniyor")}</p>
  {:else if hata && !icerik}
    <BosDurum maskot="hata" baslik={t("alanlar.acilamadi")} metin={t(`hata.${hata.tur}` as I18nAnahtar)} eylem={t("oda.yeniden")} onEylem={() => void yukle()} />
  {:else if icerik}
    <div class="liste" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
      {#if icerik.alan && !icerik.alan.katildi}
        <!-- A space I only look at: joining it is one tap. · Yalnızca baktığım bir alan: katılmak tek dokunuş. -->
        <div class="onizleme-kart">
          <p>{icerik.alan.konu ?? t("alanlar.katilmadin")}</p>
          <button class="buton birincil" onclick={() => icerik?.alan && void katil(icerik.alan)} disabled={!!katilan[icerik.alan.id]}>
            {katilan[icerik.alan.id] ? t("alanlar.katiliyor") : t("alanlar.katil")}
          </button>
        </div>
      {:else if icerik.alan?.konu}
        <p class="konu">{icerik.alan.konu}</p>
      {/if}

      {#if gruplar.length > 0}
        {#each gruplar as g (g.id)}
          <h2 class="grup-baslik">{g.baslik}</h2>
          {#each g.ogeler as c (c.id)}
            <AlanSatiri
              oge={c}
              ac={() => ac(c)}
              katil={() => void katil(c)}
              katiliyor={!!katilan[c.id]}
              uzun={yetki.cocukYonetebilir ? (x, y) => (menu = { oge: c, x, y }) : undefined}
              menuDugmesi={gezinme.genis}
            />
          {/each}
        {/each}
      {:else}
        <BosDurum maskot="selam" baslik={t("alanlar.altiBos")} metin={t("alanlar.altiBosAlt")} />
      {/if}
    </div>
  {/if}
</div>

{#if olusturAcik}
  <AlanOdaOlustur alanId={adim.id} alanAd={baslik} onolustu={() => void yukle()} onkapat={() => (olusturAcik = false)} />
{/if}

{#if ekleAcik}
  <AlanaOdaEkle alanId={adim.id} oneklendi={() => void yukle()} onkapat={() => (ekleAcik = false)} />
{/if}

{#if davetAcik}
  <AltSayfa baslik={t("alanYonet.davetBaslik", { alan: baslik })} onkapat={davetKapat}>
    <form class="davet-form" onsubmit={(e) => { e.preventDefault(); void davetGonder(davetKimlik); }}>
      <p class="davet-alt">{t("alanYonet.davetAciklama")}</p>
      <div class="davet-satir">
        <label class="alan-kutu">
          <input bind:value={davetKimlik} placeholder={t("uyeler.davetYer")} aria-label={t("uyeler.davetEt")} autocapitalize="off" autocomplete="off" spellcheck="false" disabled={davetMesgul} />
          {#if davetAraniyor}<span class="yuklenme"></span>{/if}
        </label>
        <button class="buton birincil" type="submit" disabled={!davetKimlik.trim() || davetMesgul}>{t("uyeler.davetGonder")}</button>
      </div>
      {#if davetHata}<span class="alan-hata" role="alert">{davetHata}</span>{/if}
      {#if davetSonuc.length > 0}
        <div class="davet-liste">
          {#each davetSonuc as k (k.kullaniciId)}
            <button type="button" class="davet-kisi" disabled={davetMesgul} onclick={() => void davetGonder(k.kullaniciId)}>
              <Avatar harf={(k.ad ?? k.kullaniciId.slice(1)).slice(0, 1).toUpperCase()} mxc={k.avatarMxc} boyut={36} />
              <span class="davet-metin">
                <strong>{k.ad ?? k.kullaniciId}</strong>
                {#if k.ad}<small>{k.kullaniciId}</small>{/if}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </form>
  </AltSayfa>
{/if}

{#if menu}
  {@const hedef = menu.oge}
  <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri} onkapat={() => (menu = null)}>
    {#snippet baslik()}
      <div class="menu-baslik">
        <Avatar harf={hedef.avatarHarf} mxc={hedef.avatarMxc} boyut={36} />
        <span class="menu-kimlik">
          <strong>{hedef.ad}</strong>
          <small class="mono">{hedef.id}</small>
        </span>
      </div>
    {/snippet}
  </BaglamMenusu>
{/if}

{#if cikarHedef}
  {@const hedef = cikarHedef}
  <SilOnay
    baslik={t("alanYonet.cikarBaslik")}
    metin={t("alanYonet.cikarOnay")}
    eylem={t("alanYonet.alandanCikar")}
    onay={() => void cocuguCikar(hedef)}
    onkapat={() => (cikarHedef = null)}
  />
{/if}

<style>
  .alan-gorunumu { flex: 1; min-height: 0; display: flex; flex-direction: column; container-type: inline-size; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: calc(var(--dock-yer, 16px) + 8px); }
  .orta { text-align: center; font-size: .875rem; color: var(--yazi-2); padding: 24px; }
  .konu { padding: 4px 16px 8px; font-size: .875rem; color: var(--yazi-2); }
  .onizleme-kart { margin: 4px 16px 8px; padding: 16px; border-radius: 16px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); display: grid; gap: 12px; }
  .onizleme-kart p { font-size: .875rem; color: var(--yazi-2); }

  /* Phone horizontal scrollable chip bar (44px target height) · Telefonda yatay kaydırılabilir çip sırası (44px yükseklik) */
  .eylem-satiri {
    flex: none; display: flex; align-items: center; gap: 8px; padding: 4px 16px 10px;
    overflow-x: auto; scrollbar-width: none;
  }
  .eylem-satiri::-webkit-scrollbar { display: none; }
  .eylem-cip {
    flex: none; min-height: 44px; padding: 0 14px; border-radius: 22px;
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--yuzey-2); color: var(--yazi); font-size: .875rem; font-weight: 600; white-space: nowrap;
  }
  .eylem-cip.tonlu { background: var(--ton); color: var(--ton-ustu); }

  /* Wide-screen header action buttons: 44px icon buttons in narrow sidebar, labelled pills when container is wide · Geniş ekran başlık düğmeleri: dar sütunda 44px simge, geniş alanda etiketli */
  .baslik-butonlar { display: flex; align-items: center; gap: 4px; }
  .baslik-eylem {
    min-width: 44px; min-height: 44px; padding: 0 10px; border-radius: 22px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    color: var(--yazi); font-size: .8125rem; font-weight: 600; white-space: nowrap;
  }
  .baslik-eylem.tonlu { background: var(--ton); color: var(--ton-ustu); }
  @media (hover: hover) {
    .baslik-eylem:not(.tonlu):hover { background: var(--yuzey-3); }
  }
  .baslik-eylem .etiket { display: none; }
  @container (min-width: 560px) {
    .baslik-eylem { padding: 0 14px; background: var(--yuzey-2); }
    .baslik-eylem.tonlu { background: var(--ton); }
    .baslik-eylem .etiket { display: inline; }
  }

  .grup-baslik {
    font-family: var(--yazi-tipi); font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: var(--yazi-2); padding: 14px 16px 4px;
  }

  .menu-baslik { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .menu-kimlik { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .menu-kimlik strong { font-size: .9375rem; font-weight: 600; color: var(--yazi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .menu-kimlik small { font-size: .75rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .davet-form { display: grid; gap: 12px; }
  .davet-alt { font-size: .875rem; color: var(--yazi-2); }
  .davet-satir { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
  .davet-satir .buton { width: auto; min-height: 52px; }
  .davet-liste { display: grid; gap: 2px; margin: 0 -8px; }
  .davet-kisi { width: 100%; min-height: 52px; padding: 6px 8px; border-radius: 14px; display: flex; align-items: center; gap: 10px; text-align: left; }
  @media (hover: hover) { .davet-kisi:hover { background: var(--yuzey-2); } }
  .davet-metin { flex: 1; min-width: 0; display: grid; }
  .davet-metin strong, .davet-metin small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .davet-metin strong { font-size: .9375rem; font-weight: 600; }
  .davet-metin small { font-size: .8125rem; color: var(--yazi-2); }
</style>
