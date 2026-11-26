<!--
  Add existing rooms to a space (bottom sheet on phones, 480px dialog on wide screens via AltSayfa).
  Lists joined rooms not already in the space (`eklenebilirOdalar`), filters by name, dims rooms where the user is not an admin,
  and adds selected rooms in one batch (`alanaOdaEkle`).
  Var olan odaları alana ekleme (telefonda AltSayfa, geniş ekranda 480px pencere).
  Alanda henüz olmayan katılınmış odaları listeler (`eklenebilirOdalar`), ada göre süzer, yetkisiz odaları soluk gösterir ve seçilenleri tek seferde ekler (`alanaOdaEkle`).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { alanaOdaEkle, eklenebilirOdalar } from "../api/komutlar";
  import type { EklenebilirOda, Hata } from "../api/tipler";
  import { bildirim } from "../durum/bildirim.svelte";
  import { t, type Anahtar as I18nAnahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import BosDurum from "./BosDurum.svelte";
  import Ikon from "./Ikon.svelte";

  let {
    alanId,
    oneklendi,
    onkapat,
  }: {
    alanId: string;
    /** Runs after rooms are added so the parent refreshes the space · Odalar eklendikten sonra çağrılır; üst bileşen alanı yeniler */
    oneklendi?: () => void;
    onkapat: () => void;
  } = $props();

  let liste = $state<EklenebilirOda[]>([]);
  let yukleniyor = $state(true);
  let hata = $state<Hata | null>(null);
  let islemHata = $state<string | null>(null);
  let sorgu = $state("");
  let secili = $state<Record<string, true>>({});
  let mesgul = $state(false);

  async function yukle() {
    yukleniyor = true;
    hata = null;
    try {
      liste = await eklenebilirOdalar(alanId);
    } catch (e) {
      hata = e as Hata;
    } finally {
      yukleniyor = false;
    }
  }

  onMount(() => {
    void yukle();
  });

  const suzulen = $derived.by(() => {
    const q = sorgu.trim().toLocaleLowerCase("tr");
    return q ? liste.filter((o) => o.ad.toLocaleLowerCase("tr").includes(q)) : liste;
  });
  const seciliIdler = $derived(Object.keys(secili));
  const seciliSayi = $derived(seciliIdler.length);

  function degistir(o: EklenebilirOda) {
    if (!o.yetkili || mesgul) return;
    if (secili[o.id]) delete secili[o.id];
    else secili[o.id] = true;
  }

  async function ekle() {
    if (seciliSayi === 0 || mesgul) return;
    mesgul = true;
    islemHata = null;
    try {
      const eklenen = await alanaOdaEkle(alanId, seciliIdler);
      bildirim.goster(
        eklenen === 1 ? t("alanYonet.birOdaEklendi") : t("alanYonet.nOdaEklendi", { n: eklenen }),
        3000,
        { tur: "tamam" },
      );
      oneklendi?.();
      onkapat();
    } catch (e) {
      const err = e as Hata | undefined;
      islemHata = err?.tur && err.tur !== "diger" ? t(`hata.${err.tur}` as I18nAnahtar) : err?.mesaj || t("hata.diger");
    } finally {
      mesgul = false;
    }
  }
</script>

<AltSayfa baslik={t("alanYonet.odaEkleBaslik")} {onkapat}>
  <p class="aciklama">{t("alanYonet.odaEkleAciklama")}</p>

  {#if liste.length > 0}
    <label class="alan-kutu ara">
      <Ikon ad="ara" boyut={20} />
      <input bind:value={sorgu} placeholder={t("alanYonet.odaAra")} aria-label={t("alanYonet.odaAra")} autocomplete="off" spellcheck="false" />
      {#if sorgu}
        <button type="button" class="temizle" onclick={() => (sorgu = "")} aria-label={t("eylem.temizle")}>
          <Ikon ad="kapat" boyut={16} />
        </button>
      {/if}
    </label>
  {/if}

  {#if yukleniyor}
    <p class="orta">{t("alanYonet.yukleniyor")}</p>
  {:else if hata}
    <BosDurum maskot="hata" boyut={84} baslik={t("alanYonet.yuklenemedi")} metin={t(`hata.${hata.tur}` as I18nAnahtar)} eylem={t("eylem.tekrarDene")} onEylem={() => void yukle()} />
  {:else if liste.length === 0}
    <BosDurum maskot="selam" boyut={84} baslik={t("alanYonet.eklenecekYok")} metin={t("alanYonet.eklenecekYokAlt")} />
  {:else if suzulen.length === 0}
    <BosDurum maskot="arama" boyut={84} baslik={t("alanYonet.sonucYok")} />
  {:else}
    <div class="liste" role="group" aria-label={t("alanYonet.odaEkleBaslik")}>
      {#each suzulen as o (o.id)}
        {@const isaretli = !!secili[o.id]}
        <button
          type="button"
          class="satir"
          class:soluk={!o.yetkili}
          role="checkbox"
          aria-checked={isaretli}
          disabled={!o.yetkili || mesgul}
          data-dalga={o.yetkili ? "" : undefined}
          onclick={() => degistir(o)}
        >
          <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={40} />
          <span class="metin">
            <span class="ust">
              <strong class="ad">{o.ad}</strong>
              {#if o.alan}<span class="etiket">{t("alanlar.alan")}</span>{/if}
            </span>
            <span class="alt">
              {#if !o.yetkili}
                {t("alanYonet.yetkinYok")}
              {:else if o.sifreli}
                {t("alanYonet.uyeSifreli", { n: o.uyeSayisi })}
              {:else}
                {t("oda.uyeler", { n: o.uyeSayisi })}
              {/if}
            </span>
          </span>
          <span class="kutu" class:secili={isaretli} aria-hidden="true">
            {#if isaretli}<Ikon ad="onay" boyut={16} />{/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if islemHata}
    <p class="alan-hata" role="alert"><Ikon ad="uyari" boyut={16} /><span>{islemHata}</span></p>
  {/if}

  {#snippet altlik()}
    <button type="button" class="buton birincil" disabled={seciliSayi === 0 || mesgul} onclick={() => void ekle()}>
      {#if mesgul}
        <span class="yuklenme"></span>{t("alanYonet.ekleniyor")}
      {:else if seciliSayi === 1}
        {t("alanYonet.birOdayiEkle")}
      {:else}
        {t("alanYonet.nOdayiEkle", { n: seciliSayi })}
      {/if}
    </button>
  {/snippet}
</AltSayfa>

<style>
  .aciklama { font-size: .875rem; line-height: 1.4; color: var(--yazi-2); }
  .ara { min-height: 48px; padding: 0 12px; }
  .temizle { flex: none; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--yazi-2); }
  .orta { text-align: center; font-size: .875rem; color: var(--yazi-2); padding: 24px 0; }
  .liste { display: grid; gap: 2px; margin: 0 -8px; }
  .satir {
    width: 100%; min-height: 56px; padding: 8px; border-radius: 14px; display: flex; align-items: center; gap: 12px; text-align: left;
  }
  @media (hover: hover) { .satir:not(:disabled):hover { background: var(--yuzey-2); } }
  .satir:not(:disabled):active { background: var(--yuzey-2); }
  .satir.soluk { opacity: .45; }
  .metin { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .ad { font-size: .9375rem; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .etiket { flex: none; padding: 1px 6px; border-radius: 6px; font-size: .6875rem; font-weight: 600; background: var(--ton); color: var(--ton-ustu); }
  .alt { font-size: .8125rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kutu {
    flex: none; width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--kenar);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .kutu.secili { background: var(--vurgu); border-color: var(--vurgu); color: var(--vurgu-ustu); }
</style>
