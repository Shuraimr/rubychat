<!--
  Ben › Profil: change my display name, change / remove my avatar (pick a photo → square crop → upload → set as avatar), see my mxid and
  device id. The server calls live in src-tauri/src/matrix/profil.rs.
  Ben › Profil: görünen adımı değiştir, avatarımı değiştir / kaldır (fotoğraf seç → kare kırp → yükle → avatar yap), mxid'imi ve cihaz
  kimliğimi gör. Sunucu çağrıları src-tauri/src/matrix/profil.rs içinde.
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
  import { t, type Anahtar } from "../i18n";
  import { dosyaYukle } from "../medya/isleme";

  let kenar = $state(false);
  let ad = $state(oturum.profil?.ad ?? "");
  let mesgul = $state(false);
  let kirpDosya = $state<Blob | null>(null);
  const kimlik = $derived(oturum.ben?.kullaniciId ?? "");
  const harf = $derived((ad || kimlik).replace(/^@/, "").charAt(0).toUpperCase() || "#");
  const degisti = $derived(ad.trim() !== (oturum.profil?.ad ?? "").trim());

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
    <!-- What others see · Başkalarının gördüğü -->
    <div class="onizleme">
      <Avatar {harf} boyut={112} mxc={oturum.profil?.avatarMxc ?? null} />
      <strong>{oturum.profil?.ad ?? kimlik}</strong>
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
  .onizleme { display: grid; justify-items: center; gap: .75rem; padding: .5rem 0; text-align: center; }
  .onizleme strong { font-family: var(--baslik-tipi); font-size: 1.375rem; line-height: 1.25; overflow-wrap: anywhere; }
  .eylem-satir { display: flex; flex-wrap: wrap; gap: .5rem; padding: .75rem; }
  .eylem-satir .buton { width: auto; flex: 1 1 10rem; }
  .dosya { cursor: pointer; position: relative; }
  .dosya input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  .mono { font-family: var(--mono-tipi); overflow-wrap: anywhere; }
</style>
