<!--
  Room / space preview: modal sheet (AltSayfa) on phones & Matrix links, or embedded in the desktop room column (`gomulu`)
  when browsing the Explore section. Shows avatar, name, alias, chips, topic, Join / Copy actions and recent cached messages.
  Oda / alan önizleme: telefonlarda ve Matrix bağlantılarında alt sayfa (AltSayfa), Keşfet bölümünde masaüstü oda sütununda
  gömülü (`gomulu`). Avatar, ad, takma ad, çipler, konu, Katıl / Kopyala düğmeleri ve son mesajları gösterir.
-->
<script lang="ts">
  import { odaOnizleme } from "../api/komutlar";
  import type { BulunanOda, OnizlemeMesaji } from "../api/tipler";
  import { bildirim } from "../durum/bildirim.svelte";
  import { t } from "../i18n";
  import { panoyaYaz } from "../pano";
  import { goreliZaman } from "../zaman-bicim";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    oda,
    kimlik = "",
    yukleniyor = false,
    onizlemeYok = false,
    mesgul = false,
    gomulu = false,
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
    /** Render embedded in the room column instead of an AltSayfa modal · AltSayfa penceresi yerine oda sütununda gömülü çiz */
    gomulu?: boolean;
    onkatil: () => void | Promise<void>;
    onkapat?: () => void;
  } = $props();

  let mesajlar = $state<OnizlemeMesaji[]>([]);
  let mesajYukleniyor = $state(false);
  let iskeletGoster = $state(false);
  let mesajIskelet = $state(false);
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

  // Same 400 ms shimmer guard for recent preview messages · Son önizleme mesajları için aynı 400 ms parıltı koruması
  $effect(() => {
    if (!mesajYukleniyor) {
      mesajIskelet = false;
      return;
    }
    const z = setTimeout(() => (mesajIskelet = true), 400);
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

  async function adresiKopyala() {
    const hedef = adres ?? oda?.odaId ?? kimlik;
    if (!hedef) return;
    try {
      await panoyaYaz(hedef);
      bildirim.goster(t("bildirim.kopyalandi"));
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"));
    }
  }
</script>

{#if gomulu}
  <div class="oniz-gomulu">
    <div class="oniz-gomulu-ic">
      {#if oda}
        <Avatar {harf} mxc={oda.avatarMxc} boyut={80} anahtar={oda.odaId} />
        <div class="gomulu-baslik">
          <h2>{ad}</h2>
          {#if adres}
            <span class="gomulu-adres">{adres}</span>
          {/if}
        </div>

        <div class="gomulu-cipler">
          <span class="gomulu-cip">{t("kesfet.uye", { n: sayi(oda.uyeSayisi) })}</span>
          <span class="gomulu-cip">{oda.katilim === "kapi" ? t("istek.gonderBaslik") : t("kesfet.herkeseAcik")}</span>
          {#if oda.alan}
            <span class="gomulu-cip">{t("kesfet.alanEtiket")}</span>
          {:else if mesajlar.length > 0}
            <span class="gomulu-cip">{t("kesfet.gecmisGorulur")}</span>
          {/if}
        </div>

        {#if oda.konu}
          <p class="gomulu-konu">{oda.konu}</p>
        {/if}

        <div class="gomulu-eylemler">
          <button
            class="buton {oda.uye ? 'tonlu' : 'birincil'} gomulu-katil"
            type="button"
            disabled={mesgul || yukleniyor}
            onclick={() => void onkatil()}
          >
            {#if mesgul}<span class="yuklenme"></span>{/if}
            {dugmeMetin}
          </button>
          <button
            class="buton cizgili gomulu-kopya"
            type="button"
            aria-label={t("bilgi.adres")}
            title={t("bilgi.adres")}
            onclick={() => void adresiKopyala()}
          >
            <Ikon ad="kopya" boyut={18} />
            {t("menu.kopyala")}
          </button>
        </div>

        {#if !oda.alan}
          {#if mesajYukleniyor}
            {#if mesajIskelet}
              <div class="oniz-iskelet gomulu-iskelet" aria-hidden="true">
                <div class="parilti satir-1"></div>
                <div class="parilti satir-2"></div>
              </div>
            {/if}
          {:else if mesajlar.length > 0}
            <section class="oniz-mesajlar gomulu-mesajlar">
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
        <Avatar {harf} boyut={80} />
        <div class="gomulu-baslik">
          <h2>{ad}</h2>
          {#if yukleniyor}
            <span class="gomulu-alt">{t("matrisBaglanti.yukleniyor")}</span>
          {/if}
        </div>
        {#if yukleniyor && iskeletGoster}
          <div class="oniz-iskelet gomulu-iskelet" aria-hidden="true">
            <div class="parilti satir-1"></div>
            <div class="parilti satir-2"></div>
          </div>
        {:else if onizlemeYok}
          <p class="oniz-not">{t("matrisBaglanti.onizlemeYok")}</p>
        {/if}
        <div class="gomulu-eylemler">
          <button
            class="buton birincil gomulu-katil"
            type="button"
            disabled={mesgul || yukleniyor}
            onclick={() => void onkatil()}
          >
            {#if mesgul}<span class="yuklenme"></span>{/if}
            {dugmeMetin}
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <AltSayfa baslik={ad} onkapat={() => onkapat?.()}>
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
          {#if mesajIskelet}
            <div class="oniz-iskelet" aria-hidden="true">
              <div class="parilti satir-1"></div>
              <div class="parilti satir-2"></div>
            </div>
          {/if}
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
{/if}

<style>
  .oniz-gomulu {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    justify-content: center;
    padding: 32px 24px;
  }
  .oniz-gomulu-ic {
    width: 100%;
    max-width: 520px;
    margin: auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }
  .gomulu-baslik {
    display: grid;
    gap: 4px;
    justify-items: center;
    max-width: 100%;
  }
  .gomulu-baslik h2 {
    font-family: var(--baslik-tipi);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--yazi);
    overflow-wrap: anywhere;
  }
  .gomulu-adres {
    font-family: var(--mono-tipi);
    font-size: .875rem;
    color: var(--yazi-2);
    overflow-wrap: anywhere;
  }
  .gomulu-alt {
    font-size: .875rem;
    color: var(--yazi-2);
  }
  .gomulu-cipler {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .gomulu-cip {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    font-size: .8125rem;
    font-weight: 500;
    color: var(--yazi-2);
    white-space: nowrap;
  }
  .gomulu-konu {
    font-size: .9375rem;
    line-height: 1.55;
    color: var(--yazi-2);
    max-width: 46ch;
    overflow-wrap: anywhere;
  }
  .gomulu-eylemler {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
  }
  .gomulu-katil,
  .gomulu-kopya {
    width: auto;
    min-height: 44px;
    white-space: nowrap;
  }
  .gomulu-katil {
    min-width: 140px;
    padding: 0 24px;
  }
  .gomulu-kopya {
    padding: 0 18px;
  }
  .gomulu-mesajlar {
    width: 100%;
    text-align: left;
    margin-top: 8px;
  }
  .gomulu-iskelet {
    width: 100%;
    margin-top: 8px;
  }
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
