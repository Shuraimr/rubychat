<!--
  In-app sign-up. OAuth (MAS) servers such as matrix.org only allow sign-up on their own account page, so the device login is started
  and its page opens inside the app (desktop: a window, src-tauri/src/kayit_penceresi.rs; Android: a WebView dialog, KayitPenceresi.kt),
  already turned to "create account". When the person allows rubychat there, this screen signs in by itself.
  Uygulama içi kayıt. matrix.org gibi OAuth (MAS) sunucuları kaydı yalnızca kendi hesap sayfasında açar; bu yüzden cihazla giriş
  başlatılır ve sayfası uygulamanın içinde açılır (masaüstü: pencere, src-tauri/src/kayit_penceresi.rs; Android: WebView penceresi,
  KayitPenceresi.kt), doğrudan "hesap oluştur"a çevrilmiş olarak. Kişi orada rubychat'e izin verince bu ekran kendiliğinden giriş yapar.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cihazGirisiBaslat, cihazGirisiBekle, cihazGirisiIptal, kayitPenceresiAc, kayitPenceresiKapat } from "../api/komutlar";
  import { kayitKapandi } from "../api/olaylar";
  import type { Hata } from "../api/tipler";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t, type Anahtar } from "../i18n";

  let { sunucu, onkapat }: { sunucu: string; onkapat: () => void } = $props();

  interface AndroidKopru {
    kayitAc(url: string, baslik: string, zemin: string, yazi: string): void;
    kayitKapat(): void;
  }
  const android = () => {
    const k = (window as unknown as { RubyBaglanti?: Partial<AndroidKopru> }).RubyBaglanti;
    return k?.kayitAc ? (k as AndroidKopru) : null;
  };

  let adres = $state<string | null>(null);
  let acik = $state(false);
  let hata = $state<Anahtar | null>(null);
  let bitti = false;
  let tur = 0;

  function hataAnahtari(e: unknown): Anahtar {
    const h = e as Hata;
    if (h.mesaj?.includes("desteklenmiyor")) return "kayit.desteksiz";
    if (h.mesaj === "ret") return "telefonla.ret";
    if (h.mesaj === "sure") return "telefonla.sure";
    return `hata.${h.tur ?? "diger"}` as Anahtar;
  }

  async function sayfayiAc() {
    if (!adres) return;
    try {
      const a = android();
      if (a) {
        const stil = getComputedStyle(document.documentElement);
        a.kayitAc(adres, t("kayit.baslik"), stil.getPropertyValue("--yuzey-1").trim(), stil.getPropertyValue("--yazi").trim());
      } else {
        await kayitPenceresiAc(adres, t("kayit.pencere"));
      }
      acik = true;
    } catch (e) {
      console.error(e);
      hata = "kayit.acilamadi";
    }
  }

  function sayfayiKapat() {
    acik = false;
    const a = android();
    if (a) a.kayitKapat();
    else void kayitPenceresiKapat().catch(() => {});
  }

  async function basla() {
    const bu = ++tur;
    adres = null;
    hata = null;
    try {
      const k = await cihazGirisiBaslat(sunucu);
      if (bitti || bu !== tur) return;
      adres = k.adres;
      await sayfayiAc();
      const ben = await cihazGirisiBekle();
      bitti = true;
      sayfayiKapat();
      sifreleme.girisSonrasiDogrula = true;
      oturum.girildi(ben);
    } catch (e) {
      if (bitti || bu !== tur || (e as Hata).mesaj === "iptal") return;
      console.error(e);
      sayfayiKapat();
      hata = hataAnahtari(e);
    }
  }

  let katman = 0;
  let birak: (() => void) | null = null;
  const androidKapandi = () => (acik = false);
  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
    window.addEventListener("rubychat-kayit-kapandi", androidKapandi);
    void kayitKapandi(() => (acik = false)).then((f) => (bitti ? f() : (birak = f)));
    void basla();
  });
  onDestroy(() => {
    window.removeEventListener("rubychat-kayit-kapandi", androidKapandi);
    birak?.();
    if (!bitti) {
      void cihazGirisiIptal().catch(() => {});
      sayfayiKapat();
    }
    bitti = true;
    gezinme.katmanBirak(katman);
  });
</script>

<section class="kart">
  <header><button class="simge-dugme" type="button" aria-label={t("telefonla.geri")} onclick={() => gezinme.katmanKapat(katman)}><Ikon ad="geri" /></button><h1>{t("kayit.baslik")}</h1></header>
  <div class="merkez">
    {#if hata}
      <Maskot poz="hata" boyut={140} />
      <p role="alert">{t(hata)}</p>
      {#if hata !== "kayit.desteksiz"}<button class="buton birincil buyuk" type="button" onclick={() => void basla()}>{t("telefonla.yeniKod")}</button>{/if}
    {:else}
      <Maskot poz={adres ? "selam" : "yukleniyor"} boyut={140} />
      <p class="durum" role="status">
        {#if !adres}<span class="yuklenme"></span>{t("kayit.hazirlaniyor")}{:else if acik}{t("kayit.acik")}{:else}{t("kayit.kapandi")}{/if}
      </p>
      <p class="alt">{t("kayit.sunucu", { sunucu })}</p>
      {#if adres && !acik}<button class="buton birincil buyuk" type="button" onclick={() => void sayfayiAc()}>{t("kayit.ac")}</button>{/if}
    {/if}
    <button class="buton metin" type="button" onclick={() => gezinme.katmanKapat(katman)}>{t("kayit.vazgec")}</button>
  </div>
</section>

<style>
  .kart { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 700px) { .kart { margin-block: auto; } }
  header { display: flex; align-items: center; gap: 4px; margin-left: -10px; }
  h1 { font-size: 1.25rem; font-weight: 600; }
  .merkez { display: grid; justify-items: center; gap: 1rem; padding: 1.5rem 0; text-align: center; }
  .durum { display: flex; align-items: center; justify-content: center; gap: .5rem; font-size: 1rem; line-height: 1.45; max-width: 34ch; }
  .alt { font-size: .8125rem; line-height: 1.45; color: var(--yazi-2); max-width: 38ch; }
  .buyuk { width: 100%; height: 56px; border-radius: 28px; font-size: 1rem; }
</style>
