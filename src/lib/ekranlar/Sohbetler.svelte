<!--
  Chat list: header with a search toggle, local search, filter chips with counts (Tümü / Okunmamış / Kişiler / Gruplar / Davetler),
  invite card, rows. First load: nothing for 300 ms, then a skeleton (no flash); failures and empty results have their own states (design section 13).
  Sohbet listesi: arama düğmeli başlık, yerel arama, sayılı süzgeç hapları (Tümü / Okunmamış / Kişiler / Gruplar / Davetler),
  davet kartı, satırlar. İlk yükleme: 300 ms hiçbir şey, sonra iskelet (yanıp sönme olmasın); hata ve boş sonuçların kendi hâlleri var (tasarım bölüm 13).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import EsitlemeSeridi from "../bilesenler/EsitlemeSeridi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import SohbetSatiri from "../bilesenler/SohbetSatiri.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar, type Suzgec } from "../durum/odalar.svelte";
  import { t } from "../i18n";
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

  let aramaAcik = $state(false);
  let kaydirildi = $state(false);
  let aramaKutusu: HTMLInputElement | undefined = $state();

  // Skeleton only after 300 ms of waiting: a quick load must not flash grey rows. · İskelet yalnızca 300 ms beklenince: hızlı yükleme gri satır yakıp söndürmemeli.
  let iskeletZamani = $state(false);
  onMount(() => {
    const z = setTimeout(() => (iskeletZamani = true), 300);
    return () => clearTimeout(z);
  });

  function aramaDegistir() {
    aramaAcik = !aramaAcik;
    if (aramaAcik) queueMicrotask(() => aramaKutusu?.focus());
    else odalar.arama = "";
  }

  const suzgecler = $derived<{ id: Suzgec; etiket: string; sayi: number }[]>([
    { id: "tumu", etiket: t("sohbetler.tumu"), sayi: 0 },
    { id: "okunmamis", etiket: t("sohbetler.okunmamis"), sayi: odalar.okunmamisOda },
    { id: "kisiler", etiket: t("sohbetler.kisiler"), sayi: 0 },
    { id: "gruplar", etiket: t("sohbetler.gruplar"), sayi: 0 },
    ...(odalar.davetler.length > 0 || odalar.suzgec === "davetler" ? [{ id: "davetler" as Suzgec, etiket: t("sohbetler.davetler"), sayi: odalar.davetler.length }] : []),
  ]);

  const hata = $derived(odalar.esitleme.durum === "hata" && !odalar.ilkListeGeldi);
  const cevrimdisiBos = $derived(odalar.esitleme.durum === "cevrimdisi" && !odalar.ilkListeGeldi);
</script>

<div class="sohbetler">
  <Baslik baslik={t("sohbetler.baslik")} kenar={kaydirildi}>
    {#snippet eylemler()}
      <button class="simge-dugme" class:tonlu={aramaAcik} type="button" aria-label={t("sohbetler.ara")} aria-pressed={aramaAcik} onclick={aramaDegistir}><Ikon ad="ara" /></button>
    {/snippet}
  </Baslik>

  {#if aramaAcik || odalar.arama}
    <div class="arama alan-kutu">
      <Ikon ad="ara" boyut={18} />
      <input bind:this={aramaKutusu} type="search" bind:value={odalar.arama} placeholder={t("sohbetler.ara")} aria-label={t("sohbetler.ara")} />
      {#if odalar.arama}<button class="simge-dugme temizle" type="button" aria-label={t("eylem.temizle")} onclick={() => (odalar.arama = "")}><Ikon ad="kapat" boyut={18} /></button>{/if}
    </div>
  {/if}

  <div class="hapler" role="group" aria-label={t("sohbetler.suzgec")}>
    {#each suzgecler as s (s.id)}
      <button class="hap" class:aktif={odalar.suzgec === s.id} aria-pressed={odalar.suzgec === s.id} onclick={() => (odalar.suzgec = s.id)}>
        {s.etiket}{#if s.sayi > 0}<span class="rozet">{s.sayi}</span>{/if}
      </button>
    {/each}
  </div>

  <EsitlemeSeridi />

  <div class="liste" onscroll={(e) => (kaydirildi = e.currentTarget.scrollTop > 0)}>
    {#if izinKarti}
      <div class="izin-karti">
        <span class="izin-simge"><Ikon ad="zil" boyut={20} /></span>
        <span class="izin-metin"><b>{t("bildirim.izinBaslik")}</b><small>{t("bildirim.izinAciklama")}</small></span>
        <button class="izin-ac" onclick={izinIste}>{t("bildirim.izinAc")}</button>
      </div>
    {/if}
    {#if odalar.davetler.length > 0 && odalar.suzgec === "tumu" && !odalar.arama}
      <div class="davet-karti">
        <span class="davet-baslik">{t("sohbetler.davet", { n: odalar.davetler.length })}</span>
        {#each odalar.davetler as d (d.id)}
          <SohbetSatiri oda={d} sec={() => {}} />
        {/each}
      </div>
    {/if}

    {#if hata}
      <BosDurum ikon="uyari" ton="hata" baslik={t("sohbetler.yuklenemedi")} metin={t("sohbetler.yuklenemediAlt")} eylem={t("eylem.tekrarDene")} onEylem={() => void odalar.baslat()} />
    {:else if cevrimdisiBos}
      <BosDurum ikon="bulutYok" ton="bekliyor" baslik={t("sohbetler.baglantiYok")} metin={t("sohbetler.baglantiYokAlt")} />
    {:else if !odalar.ilkListeGeldi}
      {#if iskeletZamani}
        <div class="iskelet-kap" aria-busy="true" aria-label={t("sohbetler.esitleniyor")}>
          {#each [0, 1, 2, 3, 4, 5] as i (i)}
            <div class="iskelet"><span class="i-avatar"></span><span class="i-cizgiler"><span style:width="{58 + ((i * 17) % 30)}%"></span><span style:width="{74 - ((i * 13) % 30)}%"></span></span></div>
          {/each}
        </div>
      {/if}
    {:else if odalar.gorunen.length === 0}
      {#if odalar.arama.trim()}
        <BosDurum ikon="ara" baslik={t("sohbetler.sonucYokAra", { ara: odalar.arama.trim() })} metin={t("sohbetler.sonucYokAlt")} />
      {:else if odalar.liste.length === 0}
        <BosDurum ikon="sohbet" baslik={t("sohbetler.bos")} metin={t("sohbetler.bosAlt")} />
      {:else if odalar.suzgec !== "tumu"}
        <BosDurum ikon="sohbet" baslik={t("sohbetler.sonucYok")} />
      {/if}
    {:else}
      {#each odalar.gorunen as oda (oda.id)}
        <SohbetSatiri {oda} secili={gezinme.genis && gezinme.acikOdaId === oda.id} taslak={odalar.taslaklar[oda.id] ?? ""} sec={() => (oda.davet ? undefined : gezinme.odaAc(oda.id))} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .sohbetler { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .arama { flex: none; margin: 0 16px 4px; min-height: 44px; padding-right: 0; }
  .arama input { min-height: 40px; }
  .temizle { width: 44px; height: 44px; color: var(--yazi-2); }
  .hapler { flex: none; display: flex; gap: 8px; padding: 8px 16px 12px; overflow-x: auto; scrollbar-width: none; overscroll-behavior: contain; }
  .hap {
    flex: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--kenar);
    font-size: .875rem; font-weight: 500; color: var(--yazi); transition: background var(--sure-hizli) var(--egri-cikis);
  }
  /* 40px chip + 4px outer margin = 44px hit area · 40px hap + 4px dış boşluk = 44px dokunma alanı */
  .hap { margin: 2px 0; position: relative; }
  .hap::after { content: ""; position: absolute; inset: -2px 0; }
  .hap:active { background: var(--yuzey-3); }
  .hap.aktif { background: var(--ton); color: var(--ton-ustu); border-color: var(--vurgu); font-weight: 600; }
  .hap .rozet { min-width: 18px; height: 18px; padding: 0 5px; font-size: .6875rem; }
  .izin-karti { margin: 0 16px 8px; padding: 12px 8px 12px 16px; display: flex; align-items: center; gap: 12px; background: var(--yuzey-1); border: 1px solid var(--kenar); border-radius: 16px; }
  .izin-simge { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--ton); color: var(--ton-ustu); }
  .izin-metin { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: .875rem; }
  .izin-metin small { color: var(--yazi-2); font-size: .8125rem; }
  .izin-ac { flex: none; min-width: 56px; min-height: 44px; padding: 0 14px; border-radius: 12px; background: var(--vurgu); color: var(--vurgu-ustu); font-weight: 600; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .davet-karti { margin: 0 16px 8px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); border-radius: 16px; overflow: hidden; }
  .davet-baslik { display: block; padding: 12px 16px 4px; font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  /* Skeleton: soft pulse (1.2 s), transform-free; reduced motion makes --hareket 0 so it holds still. */
  /* İskelet: yumuşak nabız (1,2 sn); azaltılmış harekette --hareket 0 olur, sabit kalır. */
  .iskelet { height: 72px; padding: 0 16px; display: flex; align-items: center; gap: 12px; }
  .i-avatar { width: 48px; height: 48px; border-radius: 12px; background: var(--yuzey-2); animation: nabiz calc(1200ms * var(--hareket)) ease-in-out infinite alternate; }
  .i-cizgiler { flex: 1; display: grid; gap: 8px; }
  .i-cizgiler span { height: 12px; border-radius: 6px; background: var(--yuzey-2); animation: nabiz calc(1200ms * var(--hareket)) ease-in-out infinite alternate; }
  @keyframes nabiz { from { opacity: .5; } to { opacity: 1; } }
</style>
