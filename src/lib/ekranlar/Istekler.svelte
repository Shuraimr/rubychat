<!--
  "İstekler": one card per invitation (who invites, what the room is, decline / accept), the people waiting at the door of my rooms,
  and the requests I sent. Empty = the waving mascot.
  "İstekler": davet başına bir kart (kim çağırıyor, oda nedir, reddet / katıl), odalarımın kapısında bekleyenler ve gönderdiğim istekler.
  Boşsa el sallayan maskot.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import { titret } from "../dokunma";
  import { geriKaydir } from "../geriKaydir";
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";
  import { hataBildir } from "../mesaj/eylemler";
  import type { IstekOdasi } from "../api/tipler";

  let { onkapat }: { onkapat: () => void } = $props();
  let katman = 0;
  let kenar = $state(false);
  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  const v = $derived(istekler.veri);
  const bos = $derived(v.gelen.length + v.giden.length + v.odalar.length === 0);

  async function dene(f: () => Promise<void>, tamam?: string) {
    titret("tik");
    try {
      await f();
      if (tamam) bildirim.goster(tamam, 2500, { tur: "tamam" });
      return true;
    } catch (e) {
      hataBildir(e);
      return false;
    }
  }
  async function katil(o: IstekOdasi) {
    if (!(await dene(() => istekler.kabul(o.id)))) return;
    gezinme.katmanKapat(katman);
    // After the layer is gone, open what was joined. · Katman gidince katılınanı aç.
    setTimeout(() => (o.alan ? (gezinme.sekmeSec("alanlar"), alanlar.ac(o.id, o.ad)) : gezinme.odaAc(o.id)), 60);
  }
</script>

<div class="ekran" in:kayGir|global out:kayCik|global use:geriKaydir={{ etkin: () => gezinme.katmanUstteMi(katman), geri: () => gezinme.katmanKapat(katman) }}>
  <Baslik baslik={t("istek.baslik")} geri={() => gezinme.katmanKapat(katman)} {kenar} />
  <div class="icerik" onscroll={(e) => (kenar = e.currentTarget.scrollTop > 0)}>
    {#if bos}
      <BosDurum maskot="selam" baslik={t("istek.bos")} metin={t("istek.bosAlt")} />
    {/if}

    {#if v.gelen.length > 0}
      <section>
        <h2>{t("istek.gelen")}<span class="rozet">{v.gelen.length}</span></h2>
        {#each v.gelen as { oda, davetEden } (oda.id)}
          <article class="davet">
            <div class="ust">
              <Avatar harf={oda.avatarHarf} mxc={oda.avatarMxc} boyut={56} />
              <div class="metin">
                <strong>{oda.ad}</strong>
                <span>{[t(oda.dm ? "istek.turDm" : oda.alan ? "istek.turAlan" : "istek.turGrup"), oda.uyeSayisi > 1 && !oda.dm ? t("oda.uyeler", { n: oda.uyeSayisi }) : null].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            {#if oda.konu}<p class="konu">{oda.konu}</p>{/if}
            {#if davetEden}
              <div class="eden">
                <Avatar harf={davetEden.ad.charAt(0).toUpperCase()} mxc={davetEden.avatarMxc} boyut={28} />
                <span><b>{davetEden.ad}</b><small>{davetEden.id}</small></span>
              </div>
            {/if}
            <div class="ikili">
              <button class="buton tonlu" disabled={!!istekler.suren[oda.id]} onclick={() => void dene(() => istekler.reddet(oda.id), t("istek.reddedildi"))}>{t("istek.reddet")}</button>
              <button class="buton birincil" disabled={!!istekler.suren[oda.id]} onclick={() => void katil(oda)}>{#if istekler.suren[oda.id]}<span class="yuklenme"></span>{/if}{t("istek.katil")}</button>
            </div>
          </article>
        {/each}
      </section>
    {/if}

    {#each v.odalar as o (o.oda.id)}
      <section>
        <h2><span class="tek">{t("istek.kapida", { ad: o.oda.ad })}</span><span class="rozet">{o.kisiler.length}</span></h2>
        <div class="ay-kart">
          {#each o.kisiler as k (k.id)}
            <div class="ay-satir">
              <Avatar harf={k.ad.charAt(0).toUpperCase()} mxc={k.avatarMxc} boyut={44} />
              <span class="ay-metin"><strong class="tek">{k.ad}</strong><span class="tek">{k.id}</span></span>
              <button class="yuvarlak" aria-label={t("istek.reddet")} disabled={!!istekler.suren[o.oda.id + k.id]} onclick={() => void dene(() => istekler.yanitla(o.oda.id, k.id, false), t("istek.geriCevrildi"))}><Ikon ad="kapat" boyut={22} /></button>
              <button class="yuvarlak evet" aria-label={t("istek.iceriAl")} disabled={!!istekler.suren[o.oda.id + k.id]} onclick={() => void dene(() => istekler.yanitla(o.oda.id, k.id, true), t("istek.iceriAlindi"))}><Ikon ad="onay" boyut={22} /></button>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if v.giden.length > 0}
      <section>
        <h2>{t("istek.giden")}</h2>
        <div class="ay-kart">
          {#each v.giden as o (o.id)}
            <div class="ay-satir">
              <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={44} />
              <span class="ay-metin"><strong class="tek">{o.ad}</strong><span class="bekliyor"><Ikon ad="saat" boyut={14} />{t("istek.bekliyor")}</span></span>
              <button class="geri-cek" disabled={!!istekler.suren[o.id]} onclick={() => void dene(() => istekler.reddet(o.id), t("istek.geriCekildi"))}>{t("istek.geriCek")}</button>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .ekran { position: fixed; inset: 0; z-index: 22; display: flex; flex-direction: column; background: var(--zemin); touch-action: pan-y; }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px calc(24px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: minmax(0, 40rem); justify-content: center; grid-auto-rows: max-content; align-content: start; gap: 20px; }
  section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
  h2 { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 0 4px; font-family: var(--yazi-tipi); font-size: .875rem; font-weight: 600; color: var(--vurgu); }
  .tek { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .davet { padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; border-radius: 1.75rem; background: var(--yuzey-2); }
  .ust { display: flex; align-items: center; gap: 14px; }
  .metin { min-width: 0; display: grid; }
  .metin strong { font-size: 1.0625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metin span { font-size: .8125rem; color: var(--yazi-2); }
  .konu { font-size: .875rem; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .eden { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 1rem; background: var(--yuzey-3); }
  .eden span { min-width: 0; display: grid; font-size: .875rem; line-height: 1.3; }
  .eden b, .eden small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .eden small { color: var(--yazi-2); font-size: .75rem; }
  .ikili { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .yuvarlak { flex: none; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--yuzey-3); color: var(--yazi-2); }
  .yuvarlak.evet { background: var(--vurgu); color: var(--vurgu-ustu); }
  .yuvarlak:disabled, .geri-cek:disabled { opacity: .38; }
  .bekliyor { display: inline-flex; align-items: center; gap: 4px; color: var(--bekliyor) !important; }
  .geri-cek { flex: none; min-height: 44px; padding: 0 16px; border-radius: 22px; background: var(--yuzey-3); font-size: .875rem; font-weight: 600; white-space: nowrap; }
</style>
