<!--
  Room info (design 22/03 → tap on the room header): avatar, name, encryption chip with the small lock mascot, quick actions, and the rows
  Üyeler N › / Görünüm › / Odadan ayrıl. Rows for things the backend cannot do yet (Medya, Bildirimler) are left out instead of being dead.
  A full-screen layer inside the room (Android back closes it).
  Oda bilgisi (tasarım 22/03 → oda başlığına dokun): avatar, ad, küçük kilit maskotlu şifreleme çipi, hızlı eylemler ve Üyeler N › / Görünüm › /
  Odadan ayrıl satırları. Arka ucun henüz yapamadığı şeylerin (Medya, Bildirimler) satırı ölü durmasın diye konmadı.
  Oda içinde tam ekran katman (Android geri tuşu kapatır).
-->
<script lang="ts">
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
  import { kayCik, kayGir } from "../gecis";
  import { t } from "../i18n";

  let { odaId, onkapat, uyelerAc, gorunumAc, ara }: { odaId: string; onkapat: () => void; uyelerAc: () => void; gorunumAc: () => void; ara: () => void } = $props();

  let katman = 0;
  let ayrilOnay = $state(false);
  let mesgul = $state(false);
  onMount(() => {
    katman = gezinme.katmanAc(() => onkapat());
  });
  onDestroy(() => gezinme.katmanBirak(katman));

  const b = $derived(zaman.bilgi);
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

<div class="ekran" in:kayGir|global out:kayCik|global>
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
        <button class="eylem" data-dalga onclick={ara}><Ikon ad="ara" boyut={22} />{t("aramaOda.liste")}</button>
        {#if aranabilir}
          <button class="eylem" data-dalga onclick={() => b.karsiKullanici && arama.ara({ id: b.id, ad: b.ad, avatarHarf: b.avatarHarf, avatarMxc: b.avatarMxc })}><Ikon ad="telefon" boyut={22} />{t("oda.sesliAra")}</button>
          <button class="eylem" data-dalga onclick={() => b.karsiKullanici && kullaniciKartiAc(b.karsiKullanici, odaId, b.ad, b.avatarMxc)}><Ikon ad="kisi" boyut={22} />{t("bilgi.kisi")}</button>
        {/if}
      </div>

      <div class="kart">
        <button class="satir" data-dalga onclick={uyelerAc}><span class="etiket">{t("bilgi.uyeler")}</span><span class="deger">{b.uyeSayisi}</span><Ikon ad="sagOk" boyut={20} /></button>
        <button class="satir" data-dalga onclick={gorunumAc}><span class="etiket">{t("bilgi.gorunum")}</span><Ikon ad="sagOk" boyut={20} /></button>
        <button class="satir kirmizi" data-dalga onclick={() => (ayrilOnay = true)}><span class="etiket">{t("bilgi.ayril")}</span></button>
      </div>
    {/if}
  </div>
</div>

{#if ayrilOnay}
  <!-- A small confirm: leaving cannot be undone without a new invite · Küçük bir onay: ayrılmak yeni davet olmadan geri alınamaz -->
  <div class="onay-perde" role="presentation" onclick={() => !mesgul && (ayrilOnay = false)}></div>
  <div class="onay" role="alertdialog" aria-label={t("bilgi.ayril")}>
    <p>{t("bilgi.ayrilOnay")}</p>
    <div class="dugmeler">
      <button class="buton tonlu-yuzey" onclick={() => (ayrilOnay = false)} disabled={mesgul}>{t("yasakla.vazgec")}</button>
      <button class="buton tehlike" onclick={ayril} disabled={mesgul}>{t("bilgi.ayrilEvet")}</button>
    </div>
  </div>
{/if}

<style>
  .ekran { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: var(--zemin); }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px calc(24px + env(safe-area-inset-bottom)); display: grid; grid-auto-rows: max-content; gap: 20px; align-content: start; }
  .kimlik { display: grid; justify-items: center; gap: 8px; padding-top: 8px; text-align: center; }
  h2 { font-size: 1.5rem; }
  .sifre { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px 0 6px; border-radius: 16px; background: color-mix(in srgb, var(--cozum) 16%, var(--zemin)); color: var(--cozum); font-size: .8125rem; font-weight: 600; }
  .sifre.yok { background: var(--yuzey-3); color: var(--yazi-2); padding-left: 12px; }
  .eylemler { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 12px; }
  .eylem { min-height: 72px; border-radius: 16px; background: var(--yuzey-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: .8125rem; font-weight: 600; }
  .kart { display: grid; border-radius: 16px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); overflow: hidden; }
  .satir { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; text-align: left; border-bottom: 1px solid var(--kenar-ince); }
  .satir:last-child { border-bottom: 0; }
  .etiket { flex: 1; font-size: .9375rem; }
  .deger { color: var(--yazi-2); }
  .satir :global(svg) { color: var(--yazi-2); }
  .kirmizi, .kirmizi .etiket { color: var(--hata); font-weight: 600; }
  .onay-perde { position: fixed; inset: 0; z-index: 40; background: color-mix(in srgb, var(--zemin) 70%, transparent); }
  .onay { position: fixed; z-index: 41; left: 16px; right: 16px; top: 50%; transform: translateY(-50%); max-width: 360px; margin: 0 auto; padding: 20px; border-radius: 24px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); box-shadow: var(--kat-2); display: grid; gap: 16px; text-align: center; }
  .dugmeler { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .buton { border-radius: 24px; }
  .tonlu-yuzey { background: var(--yuzey-2); color: var(--yazi); }
  .tehlike { background: var(--hata); color: var(--zemin); }
</style>
