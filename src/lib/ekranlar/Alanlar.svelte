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
  import type { AlanOgesi } from "../api/tipler";
  import AlanSatiri from "../bilesenler/AlanSatiri.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { altKaydirma } from "../durum/kabuk.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { kayCik, kayGir } from "../gecis";
  import { geriKaydir } from "../geriKaydir";
  import { t } from "../i18n";
  import AlanGorunumu from "./AlanGorunumu.svelte";
  import OdaKesfet from "../bilesenler/OdaKesfet.svelte";

  /** gomulu = shown inside a folder tab of the chat list (no big header) · gomulu = sohbet listesinin bir klasör sekmesinin içinde (büyük başlık yok) */
  let { gomulu = false }: { gomulu?: boolean } = $props();
  let kesfetAcik = $state(false);
  // The graph lives in the state module (memory): coming back draws it at once. · Grafik durum modülünde (bellekte): geri gelince hemen çizilir.
  const grafik = $derived(alanlar.grafik);
  let kok: HTMLDivElement | undefined = $state();
  const katmanlar: (HTMLDivElement | null)[] = $state([]);

  // Refresh the graph whenever the room list changes (a space joined / left). Debounced: the list emits often.
  // Oda listesi değişince grafiği yenile (alana katılındı / ayrılındı). Bekletmeli: liste sık yayınlanır.
  $effect(() => {
    odalar.liste;
    const z = setTimeout(() => void alanlar.ustYenile(), 250);
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
  <div class="kok" class:itildi={alanlar.yigin.length > 0} inert={alanlar.yigin.length > 0} bind:this={kok}>
    {#if !gomulu}<Baslik baslik={t("alanlar.baslik")} />{/if}
    {#if liste.length === 0}
      <BosDurum maskot="selam" baslik={t("alanlar.bosBaslik")} metin={t("alanlar.aciklama")} eylem={t("alanlar.kesfet")} onEylem={() => (kesfetAcik = true)} />
    {:else}
      <div class="liste" use:altKaydirma>
        {#each liste as a (a.id)}
          <AlanSatiri oge={a} ac={() => alanlar.ac(a.id, a.ad)} />
        {/each}
      </div>
    {/if}
  </div>
  <!-- Every level is its own page: it slides over the one below and a swipe to the right takes it back. · Her düzey kendi sayfasıdır: alttakinin üstüne kayar, sağa kaydırınca geri gider. -->
  {#each alanlar.yigin as adim, i (i + adim.id)}
    <div class="katman" class:itildi={i < alanlar.yigin.length - 1} inert={i < alanlar.yigin.length - 1} bind:this={katmanlar[i]} in:kayGir out:kayCik use:geriKaydir={{ etkin: () => i === alanlar.yigin.length - 1 && alanlar.enUstte(), geri: () => alanlar.geri(), altta: () => (i === 0 ? kok : katmanlar[i - 1]) }}>
      <AlanGorunumu {adim} />
    </div>
  {/each}
</div>

{#if kesfetAcik}<OdaKesfet ilkTur="alan" onkapat={() => (kesfetAcik = false)} />{/if}

<style>
  .alanlar { position: relative; overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .kok { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .katman { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--zemin); box-shadow: -8px 0 24px rgb(0 0 0 / .25); touch-action: pan-y; }
  .kok, .katman { transition: transform var(--sure-ekran) var(--egri-ac); }
  .itildi { transform: translate3d(-25%, 0, 0); }
  .liste { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: calc(var(--dock-yer, 16px) + 8px); }
</style>
