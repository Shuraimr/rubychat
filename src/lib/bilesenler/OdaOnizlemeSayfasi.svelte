<!--
  Room / space preview sheet (AltSayfa): avatar, name, alias, member count, topic, recent cached messages (when available)
  and the Join / Ask to join / Open action button. Shared by OdaKesfet and global matrix.to / matrix: links (App.svelte).
  Oda / alan önizleme alt sayfası (AltSayfa): avatar, ad, takma ad, üye sayısı, konu, son mesajlar (varsa) ve Katıl / Katılma
  isteği / Aç düğmesi. OdaKesfet ile global matrix.to / matrix: bağlantıları (App.svelte) ortak kullanır.
-->
<script lang="ts">
  import { odaOnizleme } from "../api/komutlar";
  import type { BulunanOda, OnizlemeMesaji } from "../api/tipler";
  import { t } from "../i18n";
  import { goreliZaman } from "../zaman-bicim";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";

  let {
    oda,
    kimlik = "",
    yukleniyor = false,
    onizlemeYok = false,
    mesgul = false,
    onkatil,
    onkapat,
  }: {
    oda: BulunanOda | null;
    /** Fallback room id or alias while preview is loading or unavailable · Önizleme yüklenirken ya da alınamadığında yedek oda kimliği veya takma ad */
    kimlik?: string;
    /** Fetching summary from the server · Sunucudan oda özeti getiriliyor */
    yukleniyor?: boolean;
    /** Server refused preview: show only the identity and Join · Sunucu önizleme vermedi: yalnızca kimlik ve Katıl göster */
    onizlemeYok?: boolean;
    /** Join / open action in progress · Katılma işlemi sürüyor */
    mesgul?: boolean;
    onkatil: () => void | Promise<void>;
    onkapat: () => void;
  } = $props();

  let mesajlar = $state<OnizlemeMesaji[]>([]);
  let mesajYukleniyor = $state(false);
  let iskeletGoster = $state(false);
  let istekNo = 0;

  // Show the shimmer skeleton only after 400 ms so fast responses never flash · Hızlı yanıtlar parlamasın diye parıltı iskeleti 400 ms sonra görünür
  $effect(() => {
    if (!yukleniyor) {
      iskeletGoster = false;
      return;
    }
    const z = setTimeout(() => (iskeletGoster = true), 400);
    return () => clearTimeout(z);
  });

  // Fetch cached recent messages for non-space rooms (same behaviour OdaKesfet had) · Alan olmayan odalarda önbellekteki son mesajları getir
  $effect(() => {
    const id = oda?.odaId ?? null;
    const alan = oda?.alan ?? false;
    const bu = ++istekNo;
    mesajlar = [];
    if (!id || alan) {
      mesajYukleniyor = false;
      return;
    }
    mesajYukleniyor = true;
    void odaOnizleme(id, 3)
      .then((m) => {
        if (bu === istekNo) mesajlar = m.slice(-3);
      })
      .catch(() => {
        if (bu === istekNo) mesajlar = [];
      })
      .finally(() => {
        if (bu === istekNo) mesajYukleniyor = false;
      });
  });

  const sayi = (n: number) => new Intl.NumberFormat(undefined, { notation: n >= 10000 ? "compact" : "standard" }).format(n);
  const ad = $derived(oda ? (oda.ad ?? oda.adres ?? oda.odaId) : kimlik);
  const harf = $derived(ad.replace(/^[#!]/, "").slice(0, 1).toUpperCase() || "#");
  const adres = $derived(oda?.adres ?? (kimlik.startsWith("#") ? kimlik : null));
  const dugmeMetin = $derived(
    oda
      ? oda.uye
        ? t("kesfet.ac")
        : oda.katilim === "kapi"
          ? t("kesfet.iste")
          : t("kesfet.katil")
      : t("kesfet.katil"),
  );
</script>

<AltSayfa baslik={ad} {onkapat}>
  {#if oda}
    <div class="oniz-ust">
      <Avatar {harf} mxc={oda.avatarMxc} boyut={56} anahtar={oda.odaId} />
      <div class="oniz-kimlik">
        <strong>{ad}{#if oda.alan}<span class="etiket">{t("kesfet.alanEtiket")}</span>{/if}</strong>
        <span>{#if adres}{adres} · {/if}{t("kesfet.uye", { n: sayi(oda.uyeSayisi) })}</span>
      </div>
    </div>

    {#if oda.konu}
      <p class="oniz-konu">{oda.konu}</p>
    {/if}

    {#if !oda.alan}
      {#if mesajYukleniyor}
        <p class="oniz-not"><span class="yuklenme"></span>{t("kesfet.onizlemeYukleniyor")}</p>
      {:else if mesajlar.length > 0}
        <section class="oniz-mesajlar">
          <h3>{t("kesfet.sonMesajlar")}</h3>
          <div class="oniz-kutu">
            {#each mesajlar as m (m.olayId)}
              <div class="oniz-satir">
                <div class="oniz-meta">
                  <strong>{m.gonderenAd}</strong>
                  <span>{goreliZaman(m.zaman)}</span>
                </div>
                <p>{m.metin}</p>
              </div>
            {/each}
          </div>
        </section>
      {:else}
        <p class="oniz-not">{t("kesfet.onizlemeKapali")}</p>
      {/if}
    {/if}
  {:else}
    <div class="oniz-ust">
      <Avatar {harf} boyut={56} />
      <div class="oniz-kimlik">
        <strong>{ad}</strong>
        {#if yukleniyor}
          <span>{t("matrisBaglanti.yukleniyor")}</span>
        {/if}
      </div>
    </div>
    {#if yukleniyor && iskeletGoster}
      <div class="oniz-iskelet" aria-hidden="true">
        <div class="parilti satir-1"></div>
        <div class="parilti satir-2"></div>
      </div>
    {:else if onizlemeYok}
      <p class="oniz-not">{t("matrisBaglanti.onizlemeYok")}</p>
    {/if}
  {/if}

  {#snippet altlik()}
    <button
      class="buton {oda?.uye ? 'tonlu' : 'birincil'}"
      type="button"
      disabled={mesgul || yukleniyor}
      onclick={() => void onkatil()}
    >
      {#if mesgul}<span class="yuklenme"></span>{/if}
      {dugmeMetin}
    </button>
  {/snippet}
</AltSayfa>

<style>
  .oniz-ust {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .oniz-kimlik {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .oniz-kimlik strong {
    font-family: var(--baslik-tipi);
    font-size: 1.0625rem;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .oniz-kimlik span {
    font-size: .8125rem;
    color: var(--yazi-2);
    overflow-wrap: anywhere;
  }
  .etiket {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--yuzey-2);
    font-size: .6875rem;
    font-weight: 600;
    color: var(--yazi-2);
    vertical-align: 2px;
  }
  .oniz-konu {
    font-size: .9375rem;
    line-height: 1.5;
    color: var(--yazi);
    overflow-wrap: anywhere;
  }
  .oniz-mesajlar {
    display: grid;
    gap: 8px;
  }
  .oniz-mesajlar h3 {
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--yazi-2);
  }
  .oniz-kutu {
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    border-radius: 16px;
    overflow: hidden;
  }
  .oniz-satir {
    padding: 10px 14px;
    display: grid;
    gap: 4px;
  }
  .oniz-satir + .oniz-satir {
    border-top: 1px solid var(--kenar-ince);
  }
  .oniz-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .oniz-meta strong {
    font-size: .8125rem;
    font-weight: 600;
    color: var(--yazi);
  }
  .oniz-meta span {
    font-size: .75rem;
    color: var(--yazi-2);
    flex: none;
  }
  .oniz-satir p {
    font-size: .875rem;
    line-height: 1.4;
    color: var(--yazi-2);
    overflow-wrap: anywhere;
  }
  .oniz-not {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .oniz-iskelet {
    display: grid;
    gap: 8px;
  }
  .oniz-iskelet .satir-1 {
    height: 14px;
    width: 85%;
    border-radius: 6px;
  }
  .oniz-iskelet .satir-2 {
    height: 14px;
    width: 60%;
    border-radius: 6px;
  }
</style>
