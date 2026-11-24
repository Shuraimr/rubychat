<!--
  One space: its child rooms and sub-spaces from the server's `/hierarchy` (so rooms I have NOT joined are listed too, with name, topic and
  member count). Joined rooms open as normal chats, a room I am not in gets a "Katıl" button, a sub-space opens this same view one level deeper.
  The ← button / Android back goes up one level (see durum/alanlar.svelte.ts). Offline or a server error shows the mascot with "Tekrar dene".
  Bir alan: çocuk odaları ve alt alanları, sunucunun `/hierarchy`sinden (yani katılMADIĞIM odalar da ad, konu ve üye sayısıyla listelenir).
  Katılınmış odalar normal sohbet gibi açılır, içinde olmadığım odada "Katıl" düğmesi çıkar, alt alan bu aynı görünümü bir düzey derinde açar.
  ← düğmesi / Android geri tuşu bir düzey yukarı çıkar (bkz. durum/alanlar.svelte.ts). Çevrimdışı ya da sunucu hatasında maskot ve "Tekrar dene" görünür.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { alanIcerigi, alanaKatil } from "../api/komutlar";
  import type { AlanIcerigi, AlanOgesi, Hata } from "../api/tipler";
  import AlanSatiri from "../bilesenler/AlanSatiri.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import { alanlar, type AlanAdimi } from "../durum/alanlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekAc } from "../durum/istekler.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t, type Anahtar } from "../i18n";

  /** gomulu = the root of a folder tab in the chat list: no header (the tabs already name it) · gomulu = sohbet listesindeki bir klasör sekmesinin kökü: başlık yok (sekmeler zaten adını söyler) */
  let { adim, gomulu = false }: { adim: AlanAdimi; gomulu?: boolean } = $props();

  // svelte-ignore state_referenced_locally (the screen is re-created per space)
  let icerik = $state<AlanIcerigi | null>(alanlar.icerikler.get(adim.id) ?? null);
  let yukleniyor = $state(true);
  let hata = $state<Hata | null>(null);
  /** Ids being joined right now (a Set in state so the buttons can show progress) · Şu an katılınan kimlikler (düğmeler ilerlemeyi göstersin diye state içinde) */
  let katilan = $state<Record<string, true>>({});
  let istek = 0;

  async function yukle() {
    const bu = ++istek;
    hata = null;
    // Keep the old content while refreshing (a join must not flash the whole screen). · Yenilerken eski içeriği tut (bir katılma bütün ekranı yanıp söndürmesin).
    if (!icerik) yukleniyor = true;
    try {
      const sonuc = await alanIcerigi(adim.id);
      alanlar.icerikler.set(adim.id, sonuc);
      if (bu === istek) icerik = sonuc;
    } catch (e) {
      if (bu === istek) hata = e as Hata;
    } finally {
      if (bu === istek) yukleniyor = false;
    }
  }

  // Load when the screen opens (it is re-created per space with {#key}). · Ekran açılınca yükle ({#key} ile her alan için yeniden kurulur).
  $effect(() => {
    adim.id;
    // untrack: loading reads AND writes `icerik`; tracked, it would reload the space forever. · untrack: yükleme `icerik`i hem okur hem yazar; izlenirse alan sonsuza dek yeniden yüklenirdi.
    untrack(() => void yukle());
  });

  const baslik = $derived(icerik?.alan?.ad ?? adim.ad);

  function ac(c: AlanOgesi) {
    if (c.alan) alanlar.ac(c.id, c.ad);
    // Stay on the Alanlar tab so back returns to this space, not to the chat list. · Alanlar sekmesinde kal; geri bu alana döner, sohbet listesine değil.
    else if (c.katildi) gezinme.odaAc(c.id, true);
  }

  async function katil(c: AlanOgesi) {
    if (katilan[c.id]) return;
    katilan[c.id] = true;
    try {
      // The `via` servers come from the space's m.space.child event: they know where the room lives. · `via` sunucuları alanın m.space.child olayından gelir: odanın nerede olduğunu bilirler.
      await alanaKatil(c.id, c.via);
      bildirim.goster(t("alanlar.katildin", { ad: c.ad }), 3500, { tur: "tamam" });
      await yukle();
    } catch (e) {
      // Not allowed to walk in: offer to ask for permission instead. · Doğrudan girilemiyor: onun yerine izin istemeyi öner.
      if ((e as Hata).tur === "giris") istekAc({ kimlik: c.id, ad: c.ad, via: c.via });
      else bildirim.goster(t(`hata.${(e as Hata).tur}` as Anahtar), 4500, { tur: "hata" });
    } finally {
      delete katilan[c.id];
    }
  }

  // Joined / left rooms elsewhere change the list: refresh quietly. · Başka yerde katılınan / ayrılınan odalar listeyi değiştirir: sessizce yenile.
  let oncekiSayi = -1;
  $effect(() => {
    const n = odalar.liste.length;
    if (oncekiSayi >= 0 && n !== oncekiSayi) untrack(() => !yukleniyor && void yukle());
    oncekiSayi = n;
  });
</script>

<div class="alan-gorunumu">
  {#if !gomulu}<Baslik baslik={baslik} geri={() => alanlar.geri()} />{/if}
  {#if yukleniyor && !icerik}
    <p class="orta">{t("alanlar.yukleniyor")}</p>
  {:else if hata && !icerik}
    <BosDurum maskot="hata" baslik={t("alanlar.acilamadi")} metin={t(`hata.${hata.tur}` as Anahtar)} eylem={t("oda.yeniden")} onEylem={() => void yukle()} />
  {:else if icerik}
    <div class="liste">
      {#if icerik.alan && !icerik.alan.katildi}
        <!-- A space I only look at: joining it is one tap. · Yalnızca baktığım bir alan: katılmak tek dokunuş. -->
        <div class="onizleme-kart">
          <p>{icerik.alan.konu ?? t("alanlar.katilmadin")}</p>
          <button class="buton birincil" onclick={() => icerik?.alan && void katil(icerik.alan)} disabled={!!katilan[icerik.alan.id]}>
            {katilan[icerik.alan.id] ? t("alanlar.katiliyor") : t("alanlar.katil")}
          </button>
        </div>
      {:else if icerik.alan?.konu}
        <p class="konu">{icerik.alan.konu}</p>
      {/if}
      {#each icerik.cocuklar as c (c.id)}
        <AlanSatiri oge={c} ac={() => ac(c)} katil={() => void katil(c)} katiliyor={!!katilan[c.id]} />
      {:else}
        <BosDurum maskot="selam" baslik={t("alanlar.altiBos")} metin={t("alanlar.altiBosAlt")} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .alan-gorunumu { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: calc(var(--dock-yer, 16px) + 8px); }
  .orta { text-align: center; font-size: .875rem; color: var(--yazi-2); padding: 24px; }
  .konu { padding: 0 16px 8px; font-size: .875rem; color: var(--yazi-2); }
  .onizleme-kart { margin: 4px 16px 8px; padding: 16px; border-radius: 16px; background: var(--yuzey-2); border: 1px solid var(--kenar-ince); display: grid; gap: 12px; }
  .onizleme-kart p { font-size: .875rem; color: var(--yazi-2); }
</style>
