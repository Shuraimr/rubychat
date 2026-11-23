<!--
  Message search results for a query (and an optional room). Self-contained: give it `sorgu`, it debounces, searches, shows the list
  (room avatar, room name, sender, highlighted snippet, time) and handles the tap (opens the room and jumps to the message).
  It has NO search field and no layout opinion: place it anywhere and feed it the text of whatever field you like.
  Bir sorgu (ve isteğe bağlı oda) için mesaj arama sonuçları. Bağımsız: `sorgu` ver; bekletir, arar, listeyi gösterir
  (oda avatarı, oda adı, gönderen, vurgulu özet, zaman) ve dokunmayı işler (odayı açar ve mesaja atlar).
  Arama alanı YOK, düzen görüşü YOK: istediğin yere koy, istediğin alanın metnini ver.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { MesajAramaSonucu } from "../api/tipler";
  import Avatar from "../bilesenler/Avatar.svelte";
  import Maskot from "../bilesenler/Maskot.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import { goreliZaman } from "../zaman-bicim";
  import { atlama, EN_AZ_KARAKTER, MesajAramasi } from "./durum.svelte";

  let {
    sorgu,
    odaId,
    odaAdiGoster = true,
    sec,
    kimden = null,
  }: {
    sorgu: string;
    /** Limit the search to one room · Aramayı tek odayla sınırla */
    odaId?: string;
    /** Show the room name + avatar on each row (off inside a single room) · Her satırda oda adı + avatarı göster (tek oda içinde kapalı) */
    odaAdiGoster?: boolean;
    /** Called instead of the default jump (the in-room layer closes itself first) · Varsayılan atlama yerine çağrılır (oda içi katman önce kendini kapatır) */
    sec?: (s: MesajAramaSonucu) => void;
    /** Client-side sender filter ("kimden:ayse"): matches the display name or the Matrix id · İstemci tarafı gönderen süzgeci ("kimden:ayse"): görünen ad ya da Matrix kimliğiyle eşleşir */
    kimden?: string | null;
  } = $props();

  const arama = new MesajAramasi();
  onMount(() => arama.durumuIzle());
  $effect(() => arama.ara(sorgu, odaId));

  const gorunen = $derived.by(() => {
    const k = kimden?.trim().toLocaleLowerCase("tr");
    if (!k) return arama.sonuclar;
    return arama.sonuclar.filter((s) => `${s.gonderenAd ?? ""} ${s.gonderen}`.toLocaleLowerCase("tr").includes(k));
  });
  const gecerli = $derived([...sorgu.trim()].length >= EN_AZ_KARAKTER);
  const oda = (id: string) => odalar.liste.find((o) => o.id === id);
  const ad = (s: MesajAramaSonucu) => s.gonderenAd ?? s.gonderen.replace(/^@/, "").split(":")[0];
  const tikla = (s: MesajAramaSonucu) => (sec ? sec(s) : atlama.git(s.odaId, s.olayId));
</script>

{#if gecerli}
  <section class="sonuclar" aria-label={t("mesajAra.baslik")}>
    {#if odaAdiGoster}<h2 class="baslik">{t("mesajAra.baslik")}</h2>{/if}
    {#if arama.dizin?.dolduruluyor}
      <p class="dizin" role="status"><Maskot poz="yukleniyor" boyut={40} />{t("mesajAra.dizin", { n: arama.dizin.belgeSayisi })}</p>
    {/if}
    {#if arama.hata}
      <p class="bos hata">{t("mesajAra.hata")}</p>
    {:else if gorunen.length === 0 && !arama.yukleniyor && arama.sorgu === sorgu.trim()}
      <div class="bos"><Maskot poz="arama" boyut={96} /><p>{t("mesajAra.sonucYok", { ara: sorgu.trim() })}</p></div>
    {:else}
      <ul>
        {#each gorunen as s (s.olayId)}
          {@const o = oda(s.odaId)}
          <li>
            <button class="satir" data-dalga onclick={() => tikla(s)}>
              {#if odaAdiGoster}<Avatar harf={o?.avatarHarf ?? "#"} mxc={o?.avatarMxc ?? null} boyut={40} />{/if}
              <span class="orta">
                <span class="ust">
                  <span class="ad">{#if odaAdiGoster}{o?.ad ?? s.odaId} · {/if}{ad(s)}</span>
                  <span class="zaman">{goreliZaman(s.zaman)}</span>
                </span>
                <span class="ozet">{#each s.parcalar as p, i (i)}{#if p.vurgu}<mark>{p.metin}</mark>{:else}{p.metin}{/if}{/each}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .sonuclar { display: block; }
  .baslik { margin: 0; padding: 12px 16px 4px; font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  .dizin { margin: 0; padding: 4px 16px 8px; display: flex; align-items: center; gap: 8px; font-size: .8125rem; color: var(--yazi-2); }
  .bos { margin: 0; padding: 16px; font-size: .875rem; color: var(--yazi-2); text-align: center; display: grid; justify-items: center; gap: 4px; }
  .bos p { margin: 0; }
  .bos.hata { color: var(--hata); }
  ul { list-style: none; margin: 0; padding: 0; }
  .satir {
    width: 100%; min-height: 64px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; text-align: left;
    transition: background var(--sure-hizli) var(--egri-cikis);
  }
  @media (hover: hover) { .satir:hover { background: var(--yuzey-1); } }
  .satir:active { background: var(--yuzey-2); }
  .orta { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .ad { flex: 1; min-width: 0; font-weight: 600; font-size: .9375rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zaman { flex: none; font-size: .8125rem; color: var(--yazi-2); }
  /* Two lines of snippet at most · En çok iki satır özet */
  .ozet {
    font-size: .875rem; line-height: 1.4; color: var(--yazi-2); overflow: hidden; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
  }
  mark { background: var(--ton); color: var(--ton-ustu); border-radius: 4px; padding: 0 2px; font-weight: 600; }
</style>
