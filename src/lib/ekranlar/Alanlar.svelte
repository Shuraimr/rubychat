<!--
  Spaces tab. Lists the spaces I have joined that are not inside another joined space (sub-spaces are reached through their parent);
  tapping one opens the space view (child rooms, sub-spaces, "Katıl" for rooms I am not in). A space is NOT a chat: it has no message
  timeline, so it never opens in the room view. The list is first drawn from the room list the app already has, then refined with the
  space graph from the backend (names, child counts); if that call fails the first version simply stays.
  Alanlar sekmesi. Katıldığım ve başka bir katılmış alanın içinde olmayan alanları listeler (alt alanlara ebeveynleri üzerinden ulaşılır);
  birine dokunmak alan görünümünü açar (çocuk odalar, alt alanlar, içinde olmadığım odalar için "Katıl"). Alan bir sohbet DEĞİLDİR: mesaj
  çizelgesi yoktur, bu yüzden oda görünümünde asla açılmaz. Liste önce uygulamanın zaten sahip olduğu oda listesinden çizilir, sonra
  arka uçtaki alan grafiğiyle (adlar, çocuk sayıları) inceltilir; o çağrı başarısız olursa ilk sürüm olduğu gibi kalır.
-->
<script lang="ts">
  import { alanlariAl } from "../api/komutlar";
  import type { AlanOgesi } from "../api/tipler";
  import AlanSatiri from "../bilesenler/AlanSatiri.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { altKaydirma } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import AlanGorunumu from "./AlanGorunumu.svelte";

  /** gomulu = shown inside a folder tab of the chat list (no big header) · gomulu = sohbet listesinin bir klasör sekmesinin içinde (büyük başlık yok) */
  let { gomulu = false }: { gomulu?: boolean } = $props();
  let grafik = $state<AlanOgesi[] | null>(null);

  // Refresh the graph whenever the room list changes (a space joined / left). Debounced: the list emits often.
  // Oda listesi değişince grafiği yenile (alana katılındı / ayrılındı). Bekletmeli: liste sık yayınlanır.
  $effect(() => {
    odalar.liste;
    const z = setTimeout(async () => {
      try {
        grafik = await alanlariAl();
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(z);
  });

  // First version: straight from the room list (only fields it carries). · İlk sürüm: doğrudan oda listesinden (taşıdığı alanlarla).
  const yedek = $derived<AlanOgesi[]>(
    odalar.alanlar.map((o) => ({
      id: o.id, ad: o.ad, avatarHarf: o.avatarHarf, avatarMxc: o.avatarMxc, konu: null, uyeSayisi: 0, alan: true, altSayisi: 0, katildi: true, dm: false, onerilen: false, via: [],
    })),
  );
  const liste = $derived(grafik ?? yedek);
</script>

<div class="alanlar">
  {#if alanlar.gecerli}
    {#key alanlar.gecerli.id}<AlanGorunumu adim={alanlar.gecerli} />{/key}
  {:else}
    {#if !gomulu}<Baslik baslik={t("alanlar.baslik")} />{/if}
    {#if liste.length === 0}
      <BosDurum maskot="selam" baslik={t("alanlar.bosBaslik")} metin={t("alanlar.aciklama")} />
    {:else}
      <div class="liste" use:altKaydirma>
        {#each liste as a (a.id)}
          <AlanSatiri oge={a} ac={() => alanlar.ac(a.id, a.ad)} />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .alanlar { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: calc(var(--dock-yer, 16px) + 8px); }
</style>
