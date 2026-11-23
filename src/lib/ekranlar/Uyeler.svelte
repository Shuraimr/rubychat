<!--
  Members screen (design 22/06): filter chips (Tümü / Yöneticiler / Davetli / Yasaklı), an invite row, and the list (swipe left = Çıkar / Yasakla
  where my power allows). The banned tab lists banned people with "Yasağı kaldır"; empty = the lock mascot. Presence ("çevrimiçi") is not shown:
  the backend has no presence data yet. It is a full-screen layer inside the room (Android back closes it).
  Üyeler ekranı (tasarım 22/06): süzgeç çipleri (Tümü / Yöneticiler / Davetli / Yasaklı), davet satırı ve liste (sola kaydır = Çıkar / Yasakla,
  yetkim izin veriyorsa). Yasaklı sekmesi yasaklıları "Yasağı kaldır" ile listeler; boşsa kilit maskotu. Çevrimiçi durumu gösterilmez:
  arka uçta henüz varlık verisi yok. Oda içinde tam ekran bir katmandır (Android geri tuşu kapatır).
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { Uye } from "../api/tipler";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import UyeSatiri from "../bilesenler/UyeSatiri.svelte";
  import YasaklaPenceresi from "../bilesenler/YasaklaPenceresi.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { rolAdi, uyeler } from "../durum/uyeler.svelte";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";

  let { odaId, onkapat }: { odaId: string; onkapat: () => void } = $props();

  type Sekme = "tumu" | "yonetici" | "davetli" | "yasakli";
  let sekme = $state<Sekme>("tumu");
  let davetAcik = $state(false);
  let davetKimlik = $state("");
  let davetHata = $state<string | null>(null);
  let mesgul = $state(false);
  let yasaklanacak = $state<Uye | null>(null);
  let kenar = $state(false);
  let katman = 0;

  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
    void uyeler.yukle(odaId);
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  const d = $derived(uyeler.al(odaId));
  const yetki = $derived(d.yetki);
  const katilmis = $derived(d.liste.filter((u) => u.uyelik === "join").sort((a, b) => b.guc - a.guc || a.ad.localeCompare(b.ad, "tr")));
  const davetliler = $derived(d.liste.filter((u) => u.uyelik === "invite"));
  const yasaklilar = $derived(d.liste.filter((u) => u.uyelik === "ban"));
  const yoneticiler = $derived(katilmis.filter((u) => rolAdi(u.guc) !== "uye"));
  const gorunen = $derived(sekme === "tumu" ? katilmis : sekme === "yonetici" ? yoneticiler : sekme === "davetli" ? davetliler : yasaklilar);
  const yasakSekmesi = $derived(yasaklilar.length > 0 || !!yetki?.yasaklayabilir);

  async function davetEt(e: SubmitEvent) {
    e.preventDefault();
    const k = davetKimlik.trim();
    if (!/^@[^:\s]+:[^\s]+$/.test(k)) {
      davetHata = t("uyeler.davetGecersiz");
      return;
    }
    mesgul = true;
    davetHata = null;
    try {
      await uyeler.davet(odaId, k);
      bildirim.goster(t("uyeler.davetGonderildi"), 2500, { tur: "tamam" });
      davetKimlik = "";
      davetAcik = false;
    } catch (err) {
      davetHata = (err as { mesaj?: string }).mesaj ?? t("hata.diger");
    } finally {
      mesgul = false;
    }
  }
  async function yap(f: () => Promise<unknown>, tamam: string) {
    try {
      await f();
      bildirim.goster(tamam, 2500, { tur: "tamam" });
    } catch (err) {
      bildirim.goster(t("yasakla.hata", { mesaj: (err as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    }
  }
</script>

<div class="ekran" in:kayGir|global out:kayCik|global>
  <Baslik baslik="{t('uyeler.baslik')} {katilmis.length || ''}" geri={() => gezinme.katmanKapat(katman)} {kenar} />
  <div class="hapler" role="group">
    <button class="hap" class:aktif={sekme === "tumu"} onclick={() => (sekme = "tumu")}>{t("uyeler.tumu")}</button>
    <button class="hap" class:aktif={sekme === "yonetici"} onclick={() => (sekme = "yonetici")}>{t("uyeler.yoneticiler")}{#if yoneticiler.length}<span class="sayi">{yoneticiler.length}</span>{/if}</button>
    {#if davetliler.length > 0}<button class="hap" class:aktif={sekme === "davetli"} onclick={() => (sekme = "davetli")}>{t("uyeler.davetli")}<span class="sayi">{davetliler.length}</span></button>{/if}
    {#if yasakSekmesi}<button class="hap" class:aktif={sekme === "yasakli"} onclick={() => (sekme = "yasakli")}>{t("uyeler.yasakli")}{#if yasaklilar.length}<span class="sayi">{yasaklilar.length}</span>{/if}</button>{/if}
  </div>

  <div class="liste" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    {#if yetki?.davetEdebilir && sekme !== "yasakli"}
      <div class="davet">
        <button class="davet-satir" data-dalga onclick={() => (davetAcik = !davetAcik)}><Ikon ad="artik" boyut={20} />{t("uyeler.davetEt")}</button>
        {#if davetAcik}
          <form class="davet-form" onsubmit={davetEt}>
            <input bind:value={davetKimlik} placeholder={t("uyeler.davetYer")} autocapitalize="off" autocomplete="off" spellcheck="false" />
            <button class="buton birincil" type="submit" disabled={mesgul}>{t("uyeler.davetGonder")}</button>
          </form>
          {#if davetHata}<span class="alan-hata" role="alert">{davetHata}</span>{/if}
        {/if}
      </div>
    {/if}

    {#if d.hata && d.liste.length === 0}
      <BosDurum maskot="hata" baslik={t("uyeler.hata")} metin={t("uyeler.hataAlt")} eylem={t("eylem.tekrarDene")} onEylem={() => void uyeler.yukle(odaId)} />
    {:else if d.yukleniyor && d.liste.length === 0}
      {#each [0, 1, 2, 3, 4] as i (i)}<div class="iskelet"><span class="parilti av"></span><span class="parilti cizgi" style:width="{40 + i * 8}%"></span></div>{/each}
    {:else if gorunen.length === 0}
      {#if sekme === "yasakli"}
        <BosDurum maskot="kilit" baslik={t("uyeler.yasakBosBaslik")} metin={t("uyeler.yasakBosAlt")} />
      {:else}
        <BosDurum maskot="arama" boyut={96} baslik={t("uyeler.bosBaslik")} />
      {/if}
    {:else}
      {#each gorunen as u (u.kullaniciId)}
        {#if sekme === "yasakli"}
          <UyeSatiri uye={u} sec={() => kullaniciKartiAc(u.kullaniciId, odaId, u.ad, u.avatarMxc)}>
            {#snippet sag()}<button class="yasak-kaldir" onclick={(e) => { e.stopPropagation(); void yap(() => uyeler.yasagiKaldir(odaId, u.kullaniciId), t("uyeler.yasagiKaldirildi")); }}>{t("uyeler.yasagiKaldir")}</button>{/snippet}
          </UyeSatiri>
        {:else}
          <UyeSatiri
            uye={u}
            susturulmus={uyeler.susturulmus(odaId, u)}
            sec={() => kullaniciKartiAc(u.kullaniciId, odaId, u.ad, u.avatarMxc)}
            cikarabilir={uyeler.atabilir(odaId, u)}
            yasaklayabilir={uyeler.yasaklayabilir(odaId, u)}
            cikar={() => void yap(() => uyeler.cikar(odaId, u.kullaniciId), t("uyeler.cikarildi"))}
            yasakla={() => (yasaklanacak = u)}
          />
        {/if}
      {/each}
    {/if}
    <div class="alt-bosluk"></div>
  </div>
</div>

{#if yasaklanacak}
  <YasaklaPenceresi {odaId} kullaniciId={yasaklanacak.kullaniciId} ad={yasaklanacak.ad} avatarMxc={yasaklanacak.avatarMxc} onkapat={() => (yasaklanacak = null)} />
{/if}

<style>
  .ekran { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: var(--zemin); }
  .hapler { flex: none; display: flex; gap: 8px; padding: 4px 16px 12px; overflow-x: auto; scrollbar-width: none; }
  .hap { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; margin: 2px 0; border-radius: 20px; background: var(--yuzey-2); font-size: .875rem; font-weight: 500; position: relative; }
  .hap::after { content: ""; position: absolute; inset: -2px 0; }
  .hap.aktif { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .sayi { color: var(--yazi-2); font-weight: 400; }
  .hap.aktif .sayi { color: inherit; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .alt-bosluk { height: calc(24px + env(safe-area-inset-bottom)); }
  .davet { margin: 0 16px 8px; border-radius: 16px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); overflow: hidden; }
  .davet-satir { width: 100%; min-height: 56px; padding: 0 16px; display: flex; align-items: center; gap: 8px; color: var(--vurgu); font-weight: 600; text-align: left; }
  .davet-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 0 12px 12px; }
  .davet-form input { min-height: 48px; padding: 0 14px; border-radius: 14px; background: var(--yuzey-2); border: 1px solid var(--kenar); outline: none; color: var(--yazi); }
  .davet-form .buton { width: auto; height: 48px; }
  .alan-hata { padding: 0 16px 12px; }
  .iskelet { display: flex; align-items: center; gap: 12px; height: 64px; padding: 0 16px; }
  .av { width: 48px; height: 48px; border-radius: 12px; }
  .cizgi { height: 14px; border-radius: 7px; }
  .yasak-kaldir { flex: none; min-height: 44px; padding: 0 14px; border-radius: 22px; background: var(--yuzey-3); font-weight: 600; font-size: .8125rem; }
</style>
