<!--
  Shared settings screen for both rooms and spaces (full-screen sub-screen on phones, side panel on wide screens where OdaBilgisi opens).
  Loads `odaAyarlari(odaId)` and saves each change immediately (text fields on blur/Enter, switches and join rules on toggle) with rollback on error.
  Oda ve alan için ORTAK ayarlar ekranı (telefonda tam ekran alt ekran, geniş ekranda OdaBilgisi'nin açıldığı yan panel).
  `odaAyarlari(odaId)` ile yükler; her değişikliği anında kaydeder (metin alanları odak kaybında/Enter'da, anahtarlar ve katılma kuralı dokununca), hatada geri alır.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { alanYetkim, odaAyarlari, odaAyarlariniYaz, odaAvatarAyarla, odaAvatarKaldir, odaAyril } from "../api/komutlar";
  import type { AlanYetkim, Hata, Katilim, OdaAyarlari as OdaAyarBilgisi } from "../api/tipler";
  import AlanOdaOlustur from "../bilesenler/AlanOdaOlustur.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import KareKirp from "../bilesenler/KareKirp.svelte";
  import SilOnay from "../bilesenler/SilOnay.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme, type OdaAyarHedefi } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { kayCik, kayGir } from "../gecis";
  import { geriKaydir } from "../geriKaydir";
  import { t, type Anahtar as I18nAnahtar } from "../i18n";
  import { dosyaYukle } from "../medya/isleme";
  import { panoyaYaz } from "../pano";
  import Uyeler from "./Uyeler.svelte";

  type YazilabilirKatilim = Exclude<Katilim, "diger">;

  let { hedef }: { hedef: OdaAyarHedefi } = $props();

  let ayar = $state<OdaAyarBilgisi | null>(null);
  let alanYetki = $state<AlanYetkim | null>(null);
  let yukleniyor = $state(true);
  let hata = $state<Hata | null>(null);
  let kenar = $state(false);

  // Local editable drafts for text inputs (saved on blur / Enter) · Metin alanlarının yerel taslakları (odak kaybında / Enter'da kaydedilir)
  let adDeger = $state("");
  let konuDeger = $state("");

  // Per-row saving flags so only the edited control is disabled during its request · Satır başına kayıt bayrağı: yalnızca düzenlenen denetim kilitlenir
  let kaydedilen = $state({
    avatar: false,
    ad: false,
    konu: false,
    katilim: false,
    dizinde: false,
    duyuru: false,
    sifrele: false,
    ayril: false,
  });

  // Sub-layers & dialogs · Alt katmanlar ve onay pencereleri
  let kirpDosya = $state<Blob | null>(null);
  let sifreOnay = $state(false);
  let ayrilOnay = $state(false);
  let uyelerAcik = $state(false);
  let altAlanAcik = $state(false);

  const hataMetni = (e: unknown) => {
    const err = e as Hata | undefined;
    return err?.tur && err.tur !== "diger" ? t(`hata.${err.tur}` as I18nAnahtar) : err?.mesaj || t("hata.diger");
  };

  let istek = 0;
  async function yukle() {
    const bu = ++istek;
    yukleniyor = true;
    hata = null;
    try {
      const sonuc = await odaAyarlari(hedef.odaId);
      if (bu !== istek) return;
      ayar = sonuc;
      adDeger = sonuc.ad;
      konuDeger = sonuc.konu;
      if (sonuc.alan) {
        try {
          const y = await alanYetkim(hedef.odaId);
          if (bu === istek) alanYetki = y;
        } catch {
          if (bu === istek) alanYetki = null;
        }
      }
    } catch (e) {
      if (bu === istek) hata = e as Hata;
    } finally {
      if (bu === istek) yukleniyor = false;
    }
  }

  $effect(() => {
    hedef.odaId;
    untrack(() => void yukle());
  });

  const baslik = $derived((ayar?.alan ?? hedef.alanMi) ? t("alanYonet.alanAyarlari") : t("alanYonet.odaAyarlari"));
  const harf = $derived((ayar?.ad || hedef.odaId).replace(/^[!#]/, "").charAt(0).toUpperCase() || "#");
  /** Space id used for the "Space members" join rule (never offered on a space's own settings) · "Alan üyeleri" kuralı için alan kimliği (alanın kendi ayarında hiç sunulmaz) */
  const hedefKatilimAlani = $derived(ayar && !ayar.alan ? (ayar.katilimAlani ?? hedef.alanId ?? null) : null);
  const hedefKatilimAlanAdi = $derived.by(() => {
    if (!hedefKatilimAlani) return null;
    if (hedef.alanId === hedefKatilimAlani && hedef.alanAd) return hedef.alanAd;
    return odalar.alanlar.find((a) => a.id === hedefKatilimAlani)?.ad ?? alanlar.ust.find((a) => a.id === hedefKatilimAlani)?.ad ?? null;
  });

  const katilimSecenekleri: { id: YazilabilirKatilim; baslik: string; alt: string }[] = $derived.by(() => {
    const liste: { id: YazilabilirKatilim; baslik: string; alt: string }[] = [
      { id: "acik", baslik: t("alanYonet.herkeseAcik"), alt: t("alanYonet.herkeseAcikAlt") },
    ];
    if (hedefKatilimAlani) {
      liste.push({
        id: "alan",
        baslik: t("alanYonet.alanUyeleri"),
        alt: hedefKatilimAlanAdi ? t("alanYonet.alanUyeleriAlt", { alan: hedefKatilimAlanAdi }) : t("alanYonet.alanUyeleriAltGenel"),
      });
    }
    liste.push(
      { id: "istek", baslik: t("alanYonet.katilmaIstegiyle"), alt: t("alanYonet.katilmaIstegiyleAlt") },
      { id: "davet", baslik: t("alanYonet.yalnizcaDavetle"), alt: t("alanYonet.yalnizcaDavetleAlt") },
    );
    return liste;
  });

  const katilimEtiketi = (k: Katilim): string => {
    if (k === "acik") return t("alanYonet.herkeseAcik");
    if (k === "alan") return t("alanYonet.alanUyeleri");
    if (k === "istek") return t("alanYonet.katilmaIstegiyle");
    if (k === "davet") return t("alanYonet.yalnizcaDavetle");
    return t("alanYonet.katilimDiger");
  };

  /** Keep the currently open room header / OdaBilgisi in sync when name, avatar or encryption changes · Ad, avatar ya da şifreleme değişince açık oda başlığını ve OdaBilgisi'ni güncel tut */
  function acikOdayiGuncelle(parca: Partial<{ ad: string; avatarHarf: string; avatarMxc: string | null; sifreli: boolean }>) {
    if (zaman.bilgi && zaman.bilgi.id === hedef.odaId) {
      zaman.bilgi = { ...zaman.bilgi, ...parca };
    }
  }

  // ---- Avatar (same pick → crop → temp upload flow as ProfilDuzenle.svelte) · Avatar (ProfilDuzenle.svelte ile aynı akış) ----
  function avatarSec(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = "";
    if (f) kirpDosya = f;
  }

  async function avatarYukle(blob: Blob, _g: number, _y: number, mime: string) {
    kirpDosya = null;
    if (!ayar) return;
    kaydedilen.avatar = true;
    try {
      const id = await dosyaYukle(blob, mime.includes("webp") ? "webp" : "jpg");
      const mxc = await odaAvatarAyarla(hedef.odaId, id, mime);
      ayar.avatarMxc = mxc;
      acikOdayiGuncelle({ avatarMxc: mxc });
      bildirim.goster(t("profil.avatarKaydedildi"), 3000, { tur: "tamam" });
      hedef.degisti?.();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.avatar = false;
    }
  }

  async function avatarKaldir() {
    if (!ayar || kaydedilen.avatar) return;
    const eski = ayar.avatarMxc;
    kaydedilen.avatar = true;
    try {
      await odaAvatarKaldir(hedef.odaId);
      ayar.avatarMxc = null;
      acikOdayiGuncelle({ avatarMxc: null });
      hedef.degisti?.();
    } catch (e) {
      ayar.avatarMxc = eski;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.avatar = false;
    }
  }

  // ---- Text fields: saved on blur / Enter, only when changed · Metin alanları: odak kaybında / Enter'da, yalnızca değiştiyse kaydedilir ----
  async function adKaydet() {
    if (!ayar || !ayar.adDegistirebilir || kaydedilen.ad) return;
    const yeni = adDeger.trim();
    if (!yeni) {
      adDeger = ayar.ad;
      return;
    }
    if (yeni === ayar.ad.trim()) {
      adDeger = ayar.ad;
      return;
    }
    const eski = ayar.ad;
    kaydedilen.ad = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, { ad: yeni });
      ayar.ad = yeni;
      adDeger = yeni;
      acikOdayiGuncelle({ ad: yeni, avatarHarf: yeni.charAt(0).toUpperCase() || "#" });
      hedef.degisti?.();
    } catch (e) {
      ayar.ad = eski;
      adDeger = eski;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.ad = false;
    }
  }

  async function konuKaydet() {
    if (!ayar || !ayar.konuDegistirebilir || kaydedilen.konu) return;
    const yeni = konuDeger.trim();
    if (yeni === ayar.konu.trim()) {
      konuDeger = ayar.konu;
      return;
    }
    const eski = ayar.konu;
    kaydedilen.konu = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, { konu: yeni });
      ayar.konu = yeni;
      konuDeger = yeni;
      hedef.degisti?.();
    } catch (e) {
      ayar.konu = eski;
      konuDeger = eski;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.konu = false;
    }
  }

  // ---- Immediate-save controls (join rule, directory, announcement, encryption) · Anında kaydeden denetimler ----
  async function katilimSec(secilen: YazilabilirKatilim) {
    if (!ayar || !ayar.katilimDegistirebilir || kaydedilen.katilim || ayar.katilim === secilen) return;
    const eski = ayar.katilim;
    const eskiAlan = ayar.katilimAlani;
    ayar.katilim = secilen;
    if (secilen === "alan") ayar.katilimAlani = hedefKatilimAlani;
    kaydedilen.katilim = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, {
        katilim: secilen,
        katilimAlani: secilen === "alan" ? (hedefKatilimAlani ?? undefined) : undefined,
      });
      hedef.degisti?.();
    } catch (e) {
      ayar.katilim = eski;
      ayar.katilimAlani = eskiAlan;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.katilim = false;
    }
  }

  function radyoKlavye(e: KeyboardEvent, i: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const sonraki = (i + (e.key === "ArrowDown" ? 1 : -1) + katilimSecenekleri.length) % katilimSecenekleri.length;
    void katilimSec(katilimSecenekleri[sonraki].id);
    const grup = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    grup?.querySelectorAll<HTMLButtonElement>('[role="radio"]')?.[sonraki]?.focus();
  }

  async function dizindeDegis(yeni: boolean) {
    if (!ayar || kaydedilen.dizinde) return;
    const eski = ayar.dizinde;
    ayar.dizinde = yeni;
    kaydedilen.dizinde = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, { dizinde: yeni });
      hedef.degisti?.();
    } catch (e) {
      ayar.dizinde = eski;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.dizinde = false;
    }
  }

  async function duyuruDegis(yeni: boolean) {
    if (!ayar || !ayar.gucDegistirebilir || kaydedilen.duyuru) return;
    const eski = ayar.duyuru;
    ayar.duyuru = yeni;
    kaydedilen.duyuru = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, { duyuru: yeni });
      hedef.degisti?.();
    } catch (e) {
      ayar.duyuru = eski;
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.duyuru = false;
    }
  }

  async function sifrelemeyiAc() {
    if (!ayar || ayar.sifreli || kaydedilen.sifrele) return;
    kaydedilen.sifrele = true;
    try {
      await odaAyarlariniYaz(hedef.odaId, { sifrele: true });
      ayar.sifreli = true;
      acikOdayiGuncelle({ sifreli: true });
      bildirim.goster(t("alanYonet.sifrelemeAcildi"), 3000, { tur: "tamam" });
      hedef.degisti?.();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.sifrele = false;
    }
  }

  async function adresKopyala(deger: string) {
    try {
      await panoyaYaz(deger);
      bildirim.goster(t("bildirim.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  async function alandanAyril() {
    if (kaydedilen.ayril) return;
    kaydedilen.ayril = true;
    try {
      await odaAyril(hedef.odaId);
      bildirim.goster(t("alanYonet.alandanAyrildin"), 3000, { tur: "tamam" });
      gezinme.odaAyarKapat();
      alanlar.kapatId(hedef.odaId);
      void alanlar.ustYenile();
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      kaydedilen.ayril = false;
    }
  }
</script>

<div
  class="ekran"
  in:kayGir|global
  out:kayCik|global
  use:geriKaydir={{ etkin: () => !gezinme.genis && gezinme.ustKatmanMi("odaAyar") && !uyelerAcik, geri: () => gezinme.odaAyarKapat() }}
>
  <Baslik {baslik} geri={() => gezinme.odaAyarKapat()} {kenar} />

  <div class="kaydir" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <div class="icerik">
      {#if yukleniyor && !ayar}
        <p class="orta">{t("alanYonet.yukleniyor")}</p>
      {:else if hata && !ayar}
        <BosDurum maskot="hata" baslik={t("alanYonet.ayarlarYuklenemedi")} metin={t(`hata.${hata.tur}` as I18nAnahtar)} eylem={t("eylem.tekrarDene")} onEylem={() => void yukle()} />
      {:else if ayar}
        <!-- Avatar + change / remove buttons · Avatar + değiştir / kaldır düğmeleri -->
        <div class="avatar-bolum">
          <Avatar {harf} mxc={ayar.avatarMxc} boyut={72} />
          {#if ayar.avatarDegistirebilir}
            <div class="avatar-eylemler">
              <label class="buton tonlu dosya" class:kilitli={kaydedilen.avatar}>
                {#if kaydedilen.avatar}<span class="yuklenme"></span>{:else}<Ikon ad="galeri" boyut={18} />{/if}
                {t("alanYonet.resmiDegistir")}
                <input type="file" accept="image/*" onchange={avatarSec} disabled={kaydedilen.avatar} />
              </label>
              {#if ayar.avatarMxc}
                <button type="button" class="buton metin kirmizi" onclick={() => void avatarKaldir()} disabled={kaydedilen.avatar}>
                  {t("alanYonet.kaldir")}
                </button>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Identity card: Name, Topic, Address · Kimlik kartı: Ad, Konu, Adres -->
        <div class="kart">
          <div class="alan-satir">
            <span class="satir-etiket">{t("alanYonet.ad")}</span>
            {#if ayar.adDegistirebilir}
              <div class="girdi-satir">
                <input
                  type="text"
                  bind:value={adDeger}
                  maxlength="255"
                  disabled={kaydedilen.ad}
                  aria-label={t("alanYonet.ad")}
                  onblur={() => void adKaydet()}
                  onkeydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
                {#if kaydedilen.ad}<span class="yuklenme kucuk"></span>{/if}
              </div>
            {:else}
              <p class="salt">{ayar.ad}</p>
            {/if}
          </div>

          <div class="alan-satir">
            <span class="satir-etiket">{t("alanYonet.konu")}</span>
            {#if ayar.konuDegistirebilir}
              <div class="girdi-satir">
                <textarea
                  rows="2"
                  bind:value={konuDeger}
                  maxlength="500"
                  placeholder={t("alanYonet.konuYok")}
                  disabled={kaydedilen.konu}
                  aria-label={t("alanYonet.konu")}
                  onblur={() => void konuKaydet()}
                  onkeydown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                ></textarea>
                {#if kaydedilen.konu}<span class="yuklenme kucuk"></span>{/if}
              </div>
            {:else}
              <p class="salt" class:soluk={!ayar.konu}>{ayar.konu || t("alanYonet.konuYok")}</p>
            {/if}
          </div>

          {#if ayar.adres}
            <button type="button" class="adres-satir" data-dalga onclick={() => ayar?.adres && void adresKopyala(ayar.adres)}>
              <span class="adres-metin">
                <span class="satir-etiket">{t("alanYonet.adres")}</span>
                <span class="mono adres-deger">{ayar.adres}</span>
              </span>
              <Ikon ad="kopya" boyut={18} />
            </button>
          {/if}
        </div>

        <!-- Who can join · Kim katılabilir -->
        <section class="bolum">
          <h2 id="ayar-katilim-baslik">{t("alanYonet.kimKatilabilir")}</h2>
          <div class="kart">
            {#if ayar.katilimDegistirebilir}
              <div role="radiogroup" aria-labelledby="ayar-katilim-baslik">
                {#each katilimSecenekleri as s, i (s.id)}
                  <button
                    type="button"
                    class="radyo-satir"
                    class:secili={ayar.katilim === s.id}
                    role="radio"
                    aria-checked={ayar.katilim === s.id}
                    disabled={kaydedilen.katilim}
                    data-dalga
                    onclick={() => void katilimSec(s.id)}
                    onkeydown={(e) => radyoKlavye(e, i)}
                  >
                    <span class="radyo-daire" aria-hidden="true"><span class="radyo-nokta"></span></span>
                    <span class="satir-metin">
                      <strong>{s.baslik}</strong>
                      <span>{s.alt}</span>
                    </span>
                  </button>
                {/each}
              </div>
            {:else}
              <div class="salt-satir">
                <strong>{katilimEtiketi(ayar.katilim)}</strong>
              </div>
            {/if}
          </div>
        </section>

        <!-- Switches: Explore directory, Announcement room, E2EE · Anahtarlar: Keşfet dizini, Duyuru odası, Uçtan uca şifreleme -->
        <div class="kart">
          <div class="anahtar-satir">
            <span class="satir-metin">
              <strong>{t("alanYonet.kesfetteListele")}</strong>
              <span>{t("alanYonet.kesfetteListeleAlt")}</span>
            </span>
            <Anahtar
              acik={ayar.dizinde}
              degis={(v) => void dizindeDegis(v)}
              etiket={t("alanYonet.kesfetteListele")}
              kilitli={!ayar.katilimDegistirebilir || kaydedilen.dizinde}
            />
          </div>

          {#if !ayar.alan}
            <div class="anahtar-satir">
              <span class="satir-metin">
                <strong>{t("alanYonet.duyuruOdasi")}</strong>
                <span>{t("alanYonet.duyuruOdasiAlt")}</span>
              </span>
              <Anahtar
                acik={ayar.duyuru}
                degis={(v) => void duyuruDegis(v)}
                etiket={t("alanYonet.duyuruOdasi")}
                kilitli={!ayar.gucDegistirebilir || kaydedilen.duyuru}
              />
            </div>

            {#if !ayar.sifreli}
              <button
                type="button"
                class="eylem-satir"
                data-dalga
                disabled={(!ayar.katilimDegistirebilir && !ayar.gucDegistirebilir) || kaydedilen.sifrele}
                onclick={() => (sifreOnay = true)}
              >
                <Ikon ad="kilit" boyut={20} />
                <span class="satir-metin">
                  <strong>{t("alanYonet.sifrelemeyiAc")}</strong>
                  <span>{t("alanYonet.sifrelemeyiAcAlt")}</span>
                </span>
                {#if kaydedilen.sifrele}<span class="yuklenme kucuk"></span>{:else}<Ikon ad="sagOk" boyut={20} />{/if}
              </button>
            {/if}
          {/if}
        </div>

        <!-- Space-only management & leave rows · Yalnızca alan ayarlarındaki yönetim ve ayrılma satırları -->
        {#if ayar.alan}
          <div class="kart">
            <button type="button" class="eylem-satir" data-dalga onclick={() => (uyelerAcik = true)}>
              <Ikon ad="kisi" boyut={20} />
              <span class="satir-metin"><strong>{t("alanYonet.uyelerYetkiler")}</strong></span>
              <Ikon ad="sagOk" boyut={20} />
            </button>
            {#if alanYetki?.cocukYonetebilir}
              <button type="button" class="eylem-satir" data-dalga onclick={() => (altAlanAcik = true)}>
                <Ikon ad="izgara" boyut={20} />
                <span class="satir-metin"><strong>{t("alanYonet.altAlanOlustur")}</strong></span>
                <Ikon ad="sagOk" boyut={20} />
              </button>
            {/if}
          </div>

          <div class="kart">
            <button type="button" class="eylem-satir tehlike" data-dalga disabled={kaydedilen.ayril} onclick={() => (ayrilOnay = true)}>
              <Ikon ad="cikis" boyut={20} />
              <span class="satir-metin"><strong>{t("alanYonet.alandanAyril")}</strong></span>
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if uyelerAcik}
    <Uyeler odaId={hedef.odaId} onkapat={() => (uyelerAcik = false)} />
  {/if}
</div>

{#if kirpDosya}
  <KareKirp dosya={kirpDosya} cikti={512} onbitti={avatarYukle} onkapat={() => (kirpDosya = null)} />
{/if}

{#if altAlanAcik && ayar}
  <AlanOdaOlustur
    alanId={hedef.odaId}
    alanAd={ayar.ad}
    altAlan
    onolustu={() => {
      hedef.degisti?.();
      gezinme.odaAyarKapat();
    }}
    onkapat={() => (altAlanAcik = false)}
  />
{/if}

{#if sifreOnay}
  <SilOnay
    baslik={t("alanYonet.sifrelemeyiAc")}
    metin={t("alanYonet.sifrelemeOnay")}
    eylem={t("alanYonet.sifrelemeAcEylem")}
    tehlike={false}
    onay={() => void sifrelemeyiAc()}
    onkapat={() => (sifreOnay = false)}
  />
{/if}

{#if ayrilOnay}
  <SilOnay
    baslik={t("alanYonet.alandanAyril")}
    metin={t("alanYonet.alandanAyrilOnay")}
    eylem={t("bilgi.ayrilEvet")}
    onay={() => void alandanAyril()}
    onkapat={() => (ayrilOnay = false)}
  />
{/if}

<style>
  .ekran { touch-action: pan-y; position: absolute; inset: 0; z-index: 22; display: flex; flex-direction: column; background: var(--zemin); }
  .kaydir { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .icerik {
    max-width: 640px; width: 100%; margin: 0 auto;
    padding: 8px 16px calc(24px + env(safe-area-inset-bottom));
    display: grid; grid-auto-rows: max-content; gap: 16px; align-content: start;
  }
  .orta { text-align: center; font-size: .875rem; color: var(--yazi-2); padding: 24px 0; }
  .avatar-bolum { display: flex; align-items: center; gap: 16px; padding: 8px 4px; flex-wrap: wrap; }
  .avatar-eylemler { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .avatar-eylemler .buton { width: auto; min-height: 44px; padding: 0 16px; }
  .dosya { cursor: pointer; position: relative; }
  .dosya.kilitli { opacity: .5; pointer-events: none; }
  .dosya input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }

  .bolum { display: grid; gap: 8px; }
  .bolum > h2 { font-family: var(--yazi-tipi); font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); padding: 0 4px; }

  .kart { background: var(--yuzey-1); border: 1px solid var(--kenar-ince); border-radius: 14px; overflow: hidden; display: grid; }
  .alan-satir { padding: 12px 14px; display: grid; gap: 4px; border-bottom: 1px solid var(--kenar-ince); }
  .alan-satir:last-child { border-bottom: 0; }
  .satir-etiket { font-size: .75rem; font-weight: 600; color: var(--yazi-2); }
  .girdi-satir { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .girdi-satir input, .girdi-satir textarea {
    flex: 1; min-width: 0; min-height: 44px; padding: 8px 10px; margin: 0 -10px; border-radius: 10px;
    background: transparent; border: 1px solid transparent; outline: none; color: var(--yazi); font-size: 1rem; resize: none;
  }
  .girdi-satir input:focus, .girdi-satir textarea:focus { background: var(--yuzey-2); border-color: var(--vurgu); }
  .girdi-satir input:disabled, .girdi-satir textarea:disabled { opacity: .5; }
  .girdi-satir textarea::placeholder { color: var(--yazi-2); }
  .salt { font-size: 1rem; line-height: 1.4; color: var(--yazi); padding: 4px 0; white-space: pre-wrap; }
  .salt.soluk { color: var(--yazi-2); }
  .kucuk { width: 16px; height: 16px; color: var(--yazi-2); }

  .adres-satir {
    width: 100%; min-height: 56px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; text-align: left;
  }
  .adres-satir :global(svg) { color: var(--yazi-2); flex: none; }
  .adres-metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .adres-deger { font-size: .875rem; color: var(--yazi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .radyo-satir {
    width: 100%; min-height: 56px; padding: 12px 14px; display: flex; align-items: flex-start; gap: 12px; text-align: left;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .radyo-satir:last-child { border-bottom: 0; }
  .radyo-satir:disabled { opacity: .5; }
  .radyo-daire {
    flex: none; width: 20px; height: 20px; margin-top: 2px; border-radius: 50%; border: 2px solid var(--kenar);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .radyo-satir.secili .radyo-daire { border-color: var(--vurgu); }
  .radyo-nokta { width: 10px; height: 10px; border-radius: 50%; background: var(--vurgu); transform: scale(0); transition: transform var(--sure-hizli) var(--egri-ac); }
  .radyo-satir.secili .radyo-nokta { transform: scale(1); }
  .salt-satir { min-height: 48px; padding: 12px 14px; display: flex; align-items: center; font-size: .9375rem; }

  .anahtar-satir {
    min-height: 60px; padding: 10px 8px 10px 14px; display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .anahtar-satir:last-child { border-bottom: 0; }
  .satir-metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .satir-metin strong { font-size: .9375rem; font-weight: 500; line-height: 1.3; color: var(--yazi); }
  .satir-metin span { font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); }

  .eylem-satir {
    width: 100%; min-height: 52px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; text-align: left;
    border-bottom: 1px solid var(--kenar-ince);
  }
  .eylem-satir:last-child { border-bottom: 0; }
  .eylem-satir:disabled { opacity: .45; }
  .eylem-satir :global(svg) { color: var(--yazi-2); flex: none; }
  .eylem-satir.tehlike, .eylem-satir.tehlike .satir-metin strong, .eylem-satir.tehlike :global(svg) { color: var(--hata); }
</style>
