<!--
  Rich link card under a message. YouTube: 16:9 thumbnail with a play button, title + channel (oEmbed), tap plays INLINE (youtube-nocookie).
  GitHub: social image + owner/repo, type icon (repo / issue / PR) and stars. X, Spotify, Reddit, Wikipedia: branded compact cards (no fetching).
  Other links: a clean compact card (letter tile + domain + full address; no favicon fetch, so no third party learns about the link).
  Network parts run only when `agIzni` allows (setting + encrypted-room rule); otherwise the same cards render without images / titles.
  Mesajın altında zengin bağlantı kartı. YouTube: oynat düğmeli 16:9 küçük resim, başlık + kanal (oEmbed), dokununca SATIR İÇİ oynar (youtube-nocookie).
  GitHub: sosyal görsel + sahip/depo, tür simgesi (depo / konu / ÇI) ve yıldız. X, Spotify, Reddit, Vikipedi: markalı kompakt kartlar (ağ yok).
  Diğer bağlantılar: temiz kompakt kart (harf karosu + alan adı + tam adres; favicon çekilmez, üçüncü taraf bağlantıdan haberdar olmaz).
  Ağ kısımları yalnızca `agIzni` izin verirse çalışır (ayar + şifreli oda kuralı); yoksa aynı kartlar görsel / başlıksız çizilir.
-->
<script lang="ts">
  import type { Baglanti } from "../baglanti/bul";
  import { agIzni, githubGorsel, githubYildiz, youtubeBilgi, youtubeGomme, youtubeKucukResim, type YoutubeBilgi } from "../baglanti/onizleme";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { t, type Anahtar } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let { b, sifreli = false }: { b: Baglanti; sifreli?: boolean } = $props();

  const ag = $derived(agIzni(sifreli));
  let yt = $state<YoutubeBilgi | null>(null);
  let yildiz = $state<number | null>(null);
  let oynuyor = $state(false);
  let gorselHata = $state(false);

  $effect(() => {
    if (!ag) return;
    if (b.tur === "youtube") void youtubeBilgi(b.url).then((x) => (yt = x));
    if (b.tur === "github" && b.sahip && b.depo && !b.alt) void githubYildiz(b.sahip, b.depo).then((x) => (yildiz = x));
  });

  const marka = $derived(
    ({ x: ["X", "𝕏", "#8E8E96"], spotify: ["Spotify", "♪", "#1ED760"], reddit: ["Reddit", "◉", "#FF5700"], wikipedia: ["Vikipedi", "W", "#8E8E96"] } as Record<string, string[]>)[b.tur] ?? null,
  );
  const ghTur = $derived(b.alt?.tur === "pull" ? t("baglanti.cekme") : b.alt ? t("baglanti.konu") : t("baglanti.depo"));
  const baslik = $derived(b.tur === "genel" ? b.host : b.tur === "github" ? `${b.sahip}/${b.depo}${b.alt ? ` #${b.alt.no}` : ""}` : (marka?.[0] ?? b.host));
</script>

{#if b.tur === "youtube" && b.videoId}
  <div class="kart yt">
    {#if oynuyor && ag}
      <div class="oran">
        <iframe src={youtubeGomme(b.videoId)} title={yt?.baslik ?? t("baglanti.video")} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
    {:else}
      <button class="oran kapak" aria-label={t("baglanti.oynat")} onclick={() => (ag ? (oynuyor = true) : baglantiAc(b.url))}>
        {#if ag && !gorselHata}<img src={youtubeKucukResim(b.videoId)} alt="" loading="lazy" decoding="async" onerror={() => (gorselHata = true)} />{/if}
        <span class="oynat"><Ikon ad="sagOk" boyut={28} /></span>
      </button>
    {/if}
    <button class="metin" data-dalga onclick={() => baglantiAc(b.url)}>
      <strong>{yt?.baslik ?? t("baglanti.video")}</strong>
      <small>{yt?.kanal || "youtube.com"}</small>
    </button>
  </div>
{:else if b.tur === "github"}
  <button class="kart gh" data-dalga onclick={() => baglantiAc(b.url)}>
    {#if ag && !gorselHata}<span class="oran gorsel"><img src={githubGorsel(b)} alt="" loading="lazy" decoding="async" onerror={() => (gorselHata = true)} /></span>{/if}
    <span class="metin">
      <strong><Ikon ad={b.alt ? "sohbet" : "dosya"} boyut={16} />{baslik}</strong>
      <small>GitHub · {ghTur}{#if yildiz !== null} · ★ {t("baglanti.yildiz", { n: yildiz.toLocaleString("tr") })}{/if}</small>
    </span>
  </button>
{:else}
  <button class="kart kompakt" data-dalga onclick={() => baglantiAc(b.url)}>
    <span class="karo" style:--marka={marka?.[2] ?? "var(--vurgu)"}>{marka?.[1] ?? (b.host.charAt(0).toUpperCase() || "#")}</span>
    <span class="metin">
      <strong>{baslik}</strong>
      <small>{b.url}</small>
    </span>
  </button>
{/if}

<style>
  .kart { display: block; width: 100%; max-width: 320px; margin-top: 8px; border-radius: 12px; overflow: hidden; background: color-mix(in srgb, var(--yuzey-1) 70%, transparent); border: 1px solid var(--kenar-ince); text-align: left; color: var(--yazi); }
  .oran { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; background: var(--yuzey-3); overflow: hidden; }
  .oran img, .oran iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; object-fit: cover; }
  .kapak { padding: 0; }
  .oynat { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 28px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, #000 62%, transparent); color: #fff; }
  .metin { display: grid; gap: 2px; padding: 10px 12px; min-height: 44px; width: 100%; text-align: left; }
  .metin strong { display: flex; align-items: center; gap: 6px; font-size: .875rem; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .gh .metin strong { display: flex; -webkit-line-clamp: unset; line-clamp: unset; }
  .metin small { font-size: .75rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kompakt { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 6px; min-height: 56px; }
  .kompakt .metin { padding: 0; min-width: 0; flex: 1; }
  .karo { flex: none; width: 44px; height: 44px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.125rem; color: var(--marka); background: color-mix(in srgb, var(--marka) 16%, var(--zemin)); }
  .gh .gorsel { aspect-ratio: 2 / 1; }
</style>
