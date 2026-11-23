<!--
  Ben › Profil: change my display name, change / remove my avatar (pick a photo → square crop → upload → set as avatar), see my mxid and
  device id, and decorate MY card with an app-local banner + colour. Matrix has no profile banner, so the banner never leaves this
  device; the page says so in a quiet note. The server calls live in src-tauri/src/matrix/profil.rs.
  Ben › Profil: görünen adımı değiştir, avatarımı değiştir / kaldır (fotoğraf seç → kare kırp → yükle → avatar yap), mxid'imi ve cihaz
  kimliğimi gör, KENDİ kartımı uygulamaya yerel banner + renkle süsle. Matrix'te profil banner'ı yok; banner bu cihazdan çıkmaz ve sayfa
  bunu sessiz bir notla söyler. Sunucu çağrıları src-tauri/src/matrix/profil.rs içinde.
-->
<script lang="ts">
  import { profilAdAyarla, profilAvatarAyarla, profilAvatarKaldir } from "../api/komutlar";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import KareKirp from "../bilesenler/KareKirp.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { profilYerel } from "../durum/profilYerel.svelte";
  import { zeminKaydet, zeminSil, zeminUrl } from "../durum/zeminResmi";
  import { t, type Anahtar } from "../i18n";
  import { dosyaYukle } from "../medya/isleme";

  let kenar = $state(false);
  let ad = $state(oturum.profil?.ad ?? "");
  let mesgul = $state(false);
  let kirpDosya = $state<Blob | null>(null);
  let bannerUrl = $state<string | null>(null);
  const kimlik = $derived(oturum.ben?.kullaniciId ?? "");
  const harf = $derived((ad || kimlik).replace(/^@/, "").charAt(0).toUpperCase() || "#");
  const degisti = $derived(ad.trim() !== (oturum.profil?.ad ?? "").trim());

  $effect(() => {
    if (profilYerel.resim) void zeminUrl("banner").then((u) => (bannerUrl = u));
    else bannerUrl = null;
  });

  const hataMetni = (e: unknown) => t(`hata.${(e as { tur?: string })?.tur ?? "diger"}` as Anahtar);

  async function adKaydet() {
    if (mesgul || !degisti) return;
    mesgul = true;
    try {
      await profilAdAyarla(ad.trim() || null);
      oturum.profilYaz({ ad: ad.trim() || null });
      bildirim.goster(t("profil.adKaydedildi"), 3000, { tur: "tamam" });
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  function avatarSec(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = "";
    if (f) kirpDosya = f;
  }

  async function avatarYukle(blob: Blob, _g: number, _y: number, mime: string) {
    kirpDosya = null;
    mesgul = true;
    try {
      const id = await dosyaYukle(blob, mime.includes("webp") ? "webp" : "jpg");
      const mxc = await profilAvatarAyarla(id, mime);
      oturum.profilYaz({ avatarMxc: mxc });
      bildirim.goster(t("profil.avatarKaydedildi"), 3000, { tur: "tamam" });
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  async function avatarKaldir() {
    mesgul = true;
    try {
      await profilAvatarKaldir();
      oturum.profilYaz({ avatarMxc: null });
    } catch (e) {
      bildirim.goster(hataMetni(e), 4500, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  async function bannerSec(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = "";
    if (!f) return;
    if (await zeminKaydet("banner", f)) profilYerel.resimYaz(true);
    else bildirim.goster(t("kirp.hata"), 4000, { tur: "hata" });
  }
  async function bannerKaldir() {
    await zeminSil("banner");
    profilYerel.resimYaz(false);
  }

  async function kopyala(m: string) {
    try {
      await navigator.clipboard.writeText(m);
      bildirim.goster(t("kart.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("profil.baslik")} geri={() => gezinme.benAltKapat()} {kenar} />
  <div class="ay-icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    <!-- Preview: my card as others see it (the banner only on this device) · Önizleme: kartım başkalarına göründüğü gibi (banner yalnızca bu cihazda) -->
    <div class="onizleme">
      <div class="banner" style:--banner-renk={profilYerel.renk || undefined}>{#if bannerUrl}<img src={bannerUrl} alt="" draggable="false" />{/if}</div>
      <div class="kimlik"><Avatar {harf} boyut={72} mxc={oturum.profil?.avatarMxc ?? null} /></div>
    </div>

    <section class="ay-bolum">
      <h2>{t("profil.avatar")}</h2>
      <div class="ay-kart">
        <div class="eylem-satir">
          <label class="buton tonlu dosya"><Ikon ad="galeri" boyut={20} />{t("profil.avatarSec")}<input type="file" accept="image/*" onchange={avatarSec} /></label>
          {#if oturum.profil?.avatarMxc}<button class="buton cizgili kirmizi" onclick={avatarKaldir} disabled={mesgul}>{t("profil.avatarKaldir")}</button>{/if}
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <h2>{t("profil.gorunenAd")}</h2>
      <div class="ay-kart govde">
        <div class="alan-kutu"><input type="text" bind:value={ad} maxlength="64" placeholder={kimlik} aria-label={t("profil.gorunenAd")} /></div>
        <button class="buton birincil" onclick={adKaydet} disabled={!degisti || mesgul}>{t("eylem.kaydet")}</button>
      </div>
    </section>

    <section class="ay-bolum">
      <h2>{t("profil.banner")}</h2>
      <div class="ay-kart govde">
        <div class="eylem-satir">
          <label class="buton tonlu dosya"><Ikon ad="galeri" boyut={20} />{t("profil.bannerSec")}<input type="file" accept="image/*" onchange={bannerSec} /></label>
          {#if profilYerel.resim}<button class="buton cizgili kirmizi" onclick={bannerKaldir}>{t("profil.bannerKaldir")}</button>{/if}
        </div>
        <label class="renk-satir"><span>{t("profil.bannerRenk")}</span>
          <span class="renk-sec"><input type="color" value={profilYerel.renk || "#9DB4FF"} oninput={(e) => profilYerel.renkYaz(e.currentTarget.value)} aria-label={t("profil.bannerRenk")} />{#if profilYerel.renk}<button type="button" class="sifirla" onclick={() => profilYerel.renkYaz("")}>{t("profil.renkSifirla")}</button>{/if}</span>
        </label>
      </div>
      <p class="ay-not">{t("profil.bannerNot")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("profil.hesap")}</h2>
      <div class="ay-kart">
        <button class="ay-satir dugme" data-dalga onclick={() => void kopyala(kimlik)}><span class="ay-metin"><strong>{t("ben.kullaniciId")}</strong><span class="mono">{kimlik}</span></span><Ikon ad="kopya" boyut={18} /></button>
        <button class="ay-satir dugme" data-dalga onclick={() => void kopyala(oturum.ben?.cihazId ?? "")}><span class="ay-metin"><strong>{t("ben.cihazId")}</strong><span class="mono">{oturum.ben?.cihazId}</span></span><Ikon ad="kopya" boyut={18} /></button>
        <button class="ay-satir dugme" data-dalga onclick={() => gezinme.benAltAc("guvenlik")}><span class="ay-metin"><strong>{t("profil.cihazlarim")}</strong><span>{t("profil.cihazlarimAlt")}</span></span><Ikon ad="sagOk" boyut={20} /></button>
      </div>
    </section>
  </div>
</div>

{#if kirpDosya}<KareKirp dosya={kirpDosya} cikti={512} onbitti={avatarYukle} onkapat={() => (kirpDosya = null)} />{/if}

<style>
  .onizleme { position: relative; border-radius: 1rem; overflow: hidden; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-1); }
  .banner { position: relative; height: 5.5rem; background: color-mix(in srgb, var(--banner-renk, var(--vurgu)) 45%, var(--yuzey-2)); }
  .banner img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .kimlik { margin: -2.25rem 1rem 1rem; }
  .kimlik :global(.avatar) { box-shadow: 0 0 0 3px var(--yuzey-1); }
  .govde { padding: .75rem; gap: .75rem; }
  .eylem-satir { display: flex; flex-wrap: wrap; gap: .5rem; padding: .75rem; }
  .eylem-satir .buton { width: auto; flex: 1 1 10rem; }
  .dosya { cursor: pointer; position: relative; }
  .dosya input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  .renk-satir { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 2.75rem; font-size: .9375rem; }
  .renk-sec { display: inline-flex; align-items: center; gap: .5rem; }
  .renk-sec input { width: 2.75rem; height: 2.75rem; border: 0; background: none; padding: 0; }
  .sifirla { min-height: 2.75rem; padding: 0 .5rem; color: var(--vurgu); font-size: .8125rem; }
  .mono { font-family: var(--mono-tipi); overflow-wrap: anywhere; }
</style>
