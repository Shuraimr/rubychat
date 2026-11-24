<!--
  Room info (design 22/03 → tap on the room header): avatar, name, encryption chip with the small lock mascot, quick actions, and the rows
  Üyeler N › / Görünüm › / Odadan ayrıl. Rows for things the backend cannot do yet (Medya, Bildirimler) are left out instead of being dead.
  A full-screen layer inside the room (Android back closes it).
  Oda bilgisi (tasarım 22/03 → oda başlığına dokun): avatar, ad, küçük kilit maskotlu şifreleme çipi, hızlı eylemler ve Üyeler N › / Görünüm › /
  Odadan ayrıl satırları. Arka ucun henüz yapamadığı şeylerin (Medya, Bildirimler) satırı ölü durmasın diye konmadı.
  Oda içinde tam ekran katman (Android geri tuşu kapatır).
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { onDestroy, onMount } from "svelte";
  import { odaAyril } from "../api/komutlar";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { kayCik, kayGir, menuCik, menuGir, perdeCik, perdeGir } from "../gecis";
  import { istekler } from "../durum/istekler.svelte";
  import { geriKaydir } from "../geriKaydir";
  import { t } from "../i18n";

  let { odaId, onkapat, uyelerAc, gorunumAc, ara }: { odaId: string; onkapat: () => void; uyelerAc: () => void; gorunumAc: () => void; ara: () => void } = $props();
  const buOda = untrack(() => odaId);

  let katman = 0;
  let ayrilOnay = $state(false);
  let mesgul = $state(false);
  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  // Kept while the page is leaving (see Oda.svelte). · Sayfa giderken tutulur (bkz. Oda.svelte).
  let son: typeof zaman.bilgi = null;
  const b = $derived.by(() => (son = zaman.bilgi?.id === buOda ? zaman.bilgi : son));
  const aranabilir = $derived(!!b && b.uyeSayisi === 2 && !!b.karsiKullanici);

  // The confirm is a back-button layer too · Onay da bir geri tuşu katmanıdır
  let onayKatman = 0;
  $effect(() => {
    if (!ayrilOnay) return;
    onayKatman = gezinme.katmanAc(() => {
      onayKatman = 0;
      ayrilOnay = false;
    });
    return () => {
      if (onayKatman) gezinme.katmanBirak(onayKatman);
    };
  });

  const kapida = $derived(istekler.veri.odalar.find((o) => o.oda.id === odaId)?.kisiler.length ?? 0);
  async function adresKopyala() {
    try {
      await navigator.clipboard.writeText(odaId);
      bildirim.goster(t("bildirim.kopyalandi"), 3000, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }
  async function ayril() {
    mesgul = true;
    try {
      await odaAyril(odaId);
      bildirim.goster(t("bilgi.ayrildi"), 3000, { tur: "tamam" });
      // Close the info layer first, then the room · Önce bilgi katmanını, sonra odayı kapat
      gezinme.katmanKapat(katman);
      gezinme.odaKapat();
    } catch (e) {
      bildirim.goster(t("yasakla.hata", { mesaj: (e as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    } finally {
      mesgul = false;
      ayrilOnay = false;
    }
  }
</script>

<div class="ekran" in:kayGir|global out:kayCik|global use:geriKaydir={{ etkin: () => gezinme.katmanUstteMi(katman), geri: () => gezinme.katmanKapat(katman) }}>
  <Baslik baslik={t("bilgi.baslik")} geri={() => gezinme.katmanKapat(katman)} />
  <div class="icerik">
    {#if b}
      <div class="kimlik">
        <Avatar harf={b.avatarHarf} mxc={b.avatarMxc} boyut={96} />
        <h2>{b.ad}</h2>
        <span class="sifre" class:yok={!b.sifreli}>
          {#if b.sifreli}<Maskot poz="kilit" boyut={28} />{t("bilgi.sifreli")}{:else}{t("bilgi.sifresiz")}{/if}
        </span>
      </div>

      <div class="eylemler">
        <button class="eylem" data-dalga onclick={ara}><Ikon ad="ara" boyut={22} />{t("dock.ara")}</button>
        {#if aranabilir}
          <button class="eylem" data-dalga onclick={() => b.karsiKullanici && arama.ara({ id: b.id, ad: b.ad, avatarHarf: b.avatarHarf, avatarMxc: b.avatarMxc })}><Ikon ad="telefon" boyut={22} />{t("oda.sesliAra")}</button>
          <button class="eylem" data-dalga onclick={() => b.karsiKullanici && kullaniciKartiAc(b.karsiKullanici, odaId, b.ad, b.avatarMxc)}><Ikon ad="kisi" boyut={22} />{t("bilgi.kisi")}</button>
        {/if}
      </div>

      <div class="ay-kart">
        <button class="ay-satir dugme" data-dalga onclick={uyelerAc}><span class="ay-simge" style:--r="var(--tas-safir)"><Ikon ad="kisi" boyut={20} /></span><span class="ay-metin"><strong>{t("bilgi.uyeler")}</strong><span>{t("oda.uyeler", { n: b.uyeSayisi })}</span></span></button>
        {#if kapida > 0}<button class="ay-satir dugme" data-dalga onclick={() => istekler.ac()}><span class="ay-simge" style:--r="var(--tas-kehribar)"><Ikon ad="zil" boyut={20} /></span><span class="ay-metin"><strong>{t("istek.baslik")}</strong><span>{t("istek.bekleyenKisi", { n: kapida })}</span></span><span class="rozet">{kapida}</span></button>{/if}
        <button class="ay-satir dugme" data-dalga onclick={gorunumAc}><span class="ay-simge" style:--r="var(--tas-ametist)"><Ikon ad="palet" boyut={20} /></span><span class="ay-metin"><strong>{t("bilgi.gorunum")}</strong></span></button>
        <button class="ay-satir dugme" data-dalga onclick={adresKopyala}><span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="kopya" boyut={20} /></span><span class="ay-metin"><strong>{t("bilgi.adres")}</strong><span class="tek">{odaId}</span></span></button>
      </div>
      <div class="ay-kart">
        <button class="ay-satir dugme tehlike" data-dalga onclick={() => (ayrilOnay = true)}><span class="ay-simge" style:--r="var(--hata)"><Ikon ad="cikis" boyut={20} /></span><span class="ay-metin"><strong>{t("bilgi.ayril")}</strong></span></button>
      </div>
    {/if}
  </div>
</div>

{#if ayrilOnay}
  <!-- A small confirm: leaving cannot be undone without a new invite · Küçük bir onay: ayrılmak yeni davet olmadan geri alınamaz -->
  <div class="onay-perde" role="presentation" onclick={() => !mesgul && (ayrilOnay = false)} in:perdeGir out:perdeCik></div>
  <div class="onay" role="alertdialog" aria-label={t("bilgi.ayril")} in:menuGir out:menuCik>
    <p>{t("bilgi.ayrilOnay")}</p>
    <div class="dugmeler">
      <button class="buton tonlu-yuzey" onclick={() => (ayrilOnay = false)} disabled={mesgul}>{t("yasakla.vazgec")}</button>
      <button class="buton tehlike" onclick={ayril} disabled={mesgul}>{t("bilgi.ayrilEvet")}</button>
    </div>
  </div>
{/if}

<style>
  .ekran { touch-action: pan-y; position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: var(--zemin); }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px calc(24px + env(safe-area-inset-bottom)); display: grid; grid-auto-rows: max-content; gap: 20px; align-content: start; }
  .kimlik { display: grid; justify-items: center; gap: 8px; padding-top: 8px; text-align: center; }
  h2 { font-size: 1.5rem; }
  .sifre { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px 0 6px; border-radius: 16px; background: color-mix(in srgb, var(--cozum) 16%, var(--zemin)); color: var(--cozum); font-size: .8125rem; font-weight: 600; }
  .sifre.yok { background: var(--yuzey-3); color: var(--yazi-2); padding-left: 12px; }
  .eylemler { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 12px; }
  .eylem { min-width: 0; min-height: 72px; border-radius: 1.5rem; background: var(--yuzey-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0 4px; font-size: min(.8125rem, 14px); font-weight: 600; white-space: nowrap; }
  .tek { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .onay-perde { position: fixed; inset: 0; z-index: 40; background: color-mix(in srgb, var(--zemin) 70%, transparent); }
  .onay { position: fixed; z-index: 41; left: 16px; right: 16px; top: 50%; transform: translateY(-50%); max-width: 360px; margin: 0 auto; padding: 20px; border-radius: 24px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); display: grid; gap: 16px; text-align: center; }
  .dugmeler { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .buton { border-radius: 24px; }
  .tonlu-yuzey { background: var(--yuzey-2); color: var(--yazi); }
  .buton.tehlike { background: var(--hata); color: var(--zemin); }
</style>
