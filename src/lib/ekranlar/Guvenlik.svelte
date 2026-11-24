<!--
  Ben › Güvenlik (design section 12d): device verification, recovery key, key backup and where the secrets are kept, as one status card.
  Ben › Güvenlik (tasarım bölüm 12d): cihaz doğrulama, kurtarma anahtarı, anahtar yedeği ve gizli bilgilerin yeri; tek durum kartı olarak.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { cihazCikis, cihazYenidenAdlandir, kurtarmaSifirla, oturumlarListele, yedekAyarla } from "../api/komutlar";
  import type { OturumCihazi } from "../api/tipler";
  import AltSayfa from "../bilesenler/AltSayfa.svelte";
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { goreliZaman } from "../zaman-bicim";
  import Baslik from "../bilesenler/Baslik.svelte";
  import GuvenlikSatiri from "../bilesenler/GuvenlikSatiri.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { t } from "../i18n";

  const g = $derived(sifreleme.durum);

  // ---- Key backup toggle, recovery key reset · Anahtar yedeği anahtarı, kurtarma anahtarı sıfırlama ----
  let yedekMesgul = $state(false);
  async function yedekDegis(acik: boolean) {
    yedekMesgul = true;
    try {
      await yedekAyarla(acik);
    } catch (e) {
      bildirim.goster(sifreleme.hataMetniVer(e), 4500, { tur: "hata" });
    } finally {
      yedekMesgul = false;
    }
  }
  let yeniAnahtar = $state<string | null>(null);
  async function anahtarSifirla() {
    try {
      yeniAnahtar = await kurtarmaSifirla();
    } catch (e) {
      bildirim.goster(sifreleme.hataMetniVer(e), 4500, { tur: "hata" });
    }
  }
  async function kopyala(m: string) {
    try {
      await navigator.clipboard.writeText(m);
      bildirim.goster(t("bildirim.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  // ---- My sessions (devices) · Oturumlarım (cihazlar) ----
  let cihazlar = $state<OturumCihazi[] | null>(null);
  let cihazHata = $state(false);
  async function cihazlariYukle() {
    try {
      cihazlar = await oturumlarListele();
      cihazHata = false;
    } catch {
      cihazHata = true;
    }
  }
  onMount(() => void cihazlariYukle());
  let adDegisen = $state<OturumCihazi | null>(null);
  let yeniAd = $state("");
  let cikisHedef = $state<OturumCihazi | null>(null);
  let parola = $state("");
  let parolaIste = $state(false);
  let islemMesgul = $state(false);

  async function adKaydet() {
    if (!adDegisen) return;
    islemMesgul = true;
    try {
      await cihazYenidenAdlandir(adDegisen.cihazId, yeniAd);
      adDegisen = null;
      await cihazlariYukle();
    } catch (e) {
      bildirim.goster(sifreleme.hataMetniVer(e), 4500, { tur: "hata" });
    } finally {
      islemMesgul = false;
    }
  }
  async function cikisYap() {
    if (!cikisHedef) return;
    islemMesgul = true;
    try {
      await cihazCikis(cikisHedef.cihazId, parolaIste ? parola : null);
      cikisHedef = null;
      parola = "";
      parolaIste = false;
      await cihazlariYukle();
    } catch (e) {
      // The server wants the password (UIA): ask for it and call again. · Sunucu şifre ister (UIA): sor ve yeniden çağır.
      if ((e as { mesaj?: string }).mesaj === "parola_gerekli") parolaIste = true;
      else bildirim.goster(sifreleme.hataMetniVer(e), 4500, { tur: "hata" });
    } finally {
      islemMesgul = false;
    }
  }
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("guvenlik.baslik")} geri={() => gezinme.benAltKapat()} />
  <div class="ay-icerik">
    <!-- The lock mascot: encryption / recovery / verification live here (design 22/13) · Kilit maskotu: şifreleme / kurtarma / doğrulama burada (tasarım 22/13) -->
    <div class="maskot-yer"><Maskot poz="kilit" boyut={112} /></div>
    <div class="ay-kart satirlar">
      {#if g}
        <GuvenlikSatiri
          baslik={t("guvenlik.cihazDogrulama")}
          durum={g.cihazDogrulandi ? t("durum.dogrulandi") : g.caprazImza === "bekliyor" ? t("durum.bekliyor") : t("durum.dogrulanmadi")}
          ton={g.cihazDogrulandi ? "tamam" : g.caprazImza === "bekliyor" ? "notr" : "bekliyor"}
          eylem={!g.cihazDogrulandi && g.caprazImza !== "bekliyor" ? t("eylem.dogrula") : undefined}
          onEylem={() => sifreleme.ac("kurulum")}
        />
        <GuvenlikSatiri
          baslik={t("guvenlik.kurtarma")}
          durum={g.kurtarma === "hazir" ? t("durum.hazir") : g.kurtarma === "eksik" ? t("durum.gerekli") : g.kurtarma === "kapali" ? t("durum.kurulmadi") : t("durum.bekliyor")}
          ton={g.kurtarma === "hazir" ? "tamam" : g.kurtarma === "bilinmiyor" ? "notr" : "bekliyor"}
          eylem={g.kurtarma === "kapali" ? t("eylem.olustur") : g.kurtarma === "eksik" ? t("eylem.anahtariGir") : undefined}
          onEylem={() => (g.kurtarma === "kapali" ? sifreleme.ac("kurtarma-olustur") : sifreleme.ac("kurtarma-gir"))}
          eylemKilitli={g.kurtarma === "kapali" && g.caprazImza !== "hazir"}
        />
        <GuvenlikSatiri
          baslik={t("guvenlik.yedek")}
          durum={g.yedek === "acik" ? t("durum.acik") : g.yedek === "yukleniyor" ? t("durum.indiriliyor") : t("durum.kapali")}
          ton={g.yedek === "acik" ? "tamam" : g.yedek === "yukleniyor" ? "bekliyor" : "notr"}
        />
        <div class="anahtar-satir">
          <span class="metin"><strong>{t("guvenlik.yedekAc")}</strong><small>{t("guvenlik.yedekAcAlt")}</small></span>
          <Anahtar acik={g.yedek !== "kapali"} degis={(v) => void yedekDegis(v)} etiket={t("guvenlik.yedekAc")} kilitli={yedekMesgul || g.kurtarma === "kapali"} />
        </div>
        <GuvenlikSatiri
          baslik={t("guvenlik.caprazImza")}
          durum={g.caprazImza === "hazir" ? t("durum.hazir") : g.caprazImza === "bekliyor" ? t("durum.bekliyor") : t("durum.kurulmadi")}
          ton={g.caprazImza === "hazir" ? "tamam" : g.caprazImza === "bekliyor" ? "notr" : "bekliyor"}
        />
        {#if g.kurtarma === "hazir"}
          <div class="anahtar-satir">
            <span class="metin"><strong>{t("guvenlik.anahtarSifirla")}</strong><small>{t("guvenlik.anahtarSifirlaAlt")}</small></span>
            <button class="buton cizgili kucuk" onclick={anahtarSifirla}>{t("guvenlik.sifirla")}</button>
          </div>
        {/if}
      {:else}
        <GuvenlikSatiri baslik={t("guvenlik.cihazDogrulama")} durum={t("durum.bekliyor")} ton="notr" />
      {/if}
      <GuvenlikSatiri
        baslik={t("guvenlik.gizliDepo")}
        durum={t(`guvenlik.gizli.${oturum.ben?.gizliDepo ?? "dosya"}`)}
        ton={oturum.ben?.gizliDepo === "dosya" ? "bekliyor" : "tamam"}
      />
    </div>
    {#if oturum.ben?.gizliDepo === "dosya"}<p class="not">{t("guvenlik.gizliDosyaNotu")}</p>{/if}

    <h2 class="bolum">{t("guvenlik.oturumlar")}</h2>
    <div class="ay-kart">
      {#if cihazHata}
        <div class="bos"><Maskot poz="hata" boyut={72} /><p>{t("guvenlik.oturumlarYuklenemedi")}</p><button class="buton cizgili kucuk" onclick={cihazlariYukle}>{t("eylem.tekrarDene")}</button></div>
      {:else if !cihazlar}
        <div class="bos"><Maskot poz="kilit" boyut={72} /><p>{t("guvenlik.oturumlarYukleniyor")}</p></div>
      {:else}
        {#each cihazlar as c (c.cihazId)}
          <div class="cihaz">
            <span class="cihaz-ikon"><Ikon ad="cihaz" boyut={22} /></span>
            <div class="cihaz-metin">
              <strong>{c.ad ?? c.cihazId}{#if c.buCihaz} <span class="cip ton sade">{t("guvenlik.buCihaz")}</span>{/if}</strong>
              <small class="mono">{c.cihazId}</small>
              <small>{c.sonGorulme ? t("guvenlik.sonGorulme", { zaman: goreliZaman(c.sonGorulme) }) : t("guvenlik.sonGorulmeYok")}</small>
              <span class="cip {c.dogrulandi ? 'tamam' : 'bekliyor'}">{c.dogrulandi ? t("durum.dogrulandi") : t("durum.dogrulanmadi")}</span>
            </div>
            <div class="cihaz-eylem">
              <button class="simge-dugme" aria-label={t("guvenlik.yenidenAdlandir")} onclick={() => { adDegisen = c; yeniAd = c.ad ?? ""; }}><Ikon ad="kalem" boyut={20} /></button>
              {#if !c.buCihaz}<button class="simge-dugme kirmizi" aria-label={t("guvenlik.cikisYap")} onclick={() => { cikisHedef = c; parola = ""; parolaIste = false; }}><Ikon ad="cikis" boyut={20} /></button>{/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  {#if yeniAnahtar}
    <AltSayfa baslik={t("guvenlik.yeniAnahtar")} onkapat={() => (yeniAnahtar = null)}>
      <p class="not nrm">{t("guvenlik.yeniAnahtarAlt")}</p>
      <code class="anahtar-kod">{yeniAnahtar}</code>
      <button class="buton tonlu" onclick={() => yeniAnahtar && void kopyala(yeniAnahtar)}><Ikon ad="kopya" boyut={20} />{t("kart.kimlikKopyala")}</button>
      <button class="buton birincil" onclick={() => (yeniAnahtar = null)}>{t("guvenlik.kaydettim")}</button>
    </AltSayfa>
  {/if}
  {#if adDegisen}
    <AltSayfa baslik={t("guvenlik.yenidenAdlandir")} onkapat={() => (adDegisen = null)}>
      <div class="alan-kutu"><input type="text" bind:value={yeniAd} maxlength="64" aria-label={t("guvenlik.cihazAdi")} placeholder={adDegisen.cihazId} /></div>
      <button class="buton birincil" onclick={adKaydet} disabled={islemMesgul}>{t("eylem.kaydet")}</button>
    </AltSayfa>
  {/if}
  {#if cikisHedef}
    <AltSayfa baslik={t("guvenlik.cikisYap")} onkapat={() => (cikisHedef = null)}>
      <p class="not nrm">{t("guvenlik.cikisAlt", { ad: cikisHedef.ad ?? cikisHedef.cihazId })}</p>
      {#if parolaIste}
        <div class="alan-kutu"><input type="password" bind:value={parola} autocomplete="current-password" aria-label={t("giris.sifre")} placeholder={t("giris.sifre")} /></div>
      {/if}
      <button class="buton tehlike" onclick={cikisYap} disabled={islemMesgul || (parolaIste && !parola)}>{t("guvenlik.cikisYap")}</button>
    </AltSayfa>
  {/if}
</div>

<style>
  /* Rows are rendered by a child component, so the selector must reach into it with :global. · Satırları alt bileşen çizer; seçici :global ile içeri uzanmalı. */
  .satirlar > :global(*) { padding: 1rem; }
  .bolum { font-family: var(--yazi-tipi); font-size: .875rem; font-weight: 600; color: var(--vurgu); padding: 0 1rem; margin-bottom: -.75rem; }
  .anahtar-satir { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
  .anahtar-satir .metin { flex: 1 1 9rem; min-width: 0; display: grid; gap: 2px; }
  .anahtar-satir strong { font-size: .9375rem; font-weight: 500; }
  .anahtar-satir small, .cihaz-metin small { font-size: .8125rem; color: var(--yazi-2); }
  .kucuk { width: auto; min-height: 2.75rem; padding: 0 1rem; }
  .cihaz { display: flex; align-items: flex-start; gap: .75rem; padding: 1rem; }
  .cihaz-ikon { flex: none; color: var(--yazi-2); padding-top: .125rem; }
  .cihaz-metin { flex: 1; min-width: 0; display: grid; gap: 2px; justify-items: start; }
  .cihaz-metin strong { font-size: .9375rem; font-weight: 600; overflow-wrap: anywhere; }
  .cihaz-eylem { flex: none; display: flex; }
  .kirmizi { color: var(--hata); }
  .mono { font-family: var(--mono-tipi); overflow-wrap: anywhere; }
  .bos { display: grid; justify-items: center; gap: .5rem; padding: 1rem; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .nrm { color: var(--yazi-2); }
  .anahtar-kod { display: block; padding: .875rem 1rem; border-radius: .75rem; background: var(--yuzey-2); font-family: var(--mono-tipi); font-size: .9375rem; line-height: 1.6; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
  .maskot-yer { display: flex; justify-content: center; }
  .not { font-size: .8125rem; color: var(--bekliyor); padding: 0 4px; }
</style>
