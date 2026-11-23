<!--
  One open room: header (back, avatar, name, encryption chip, call button in 1:1 rooms), timeline and the composer.
  Timeline: grouped by day (sticky date chip) and by sender (5 min, Tek/İlk/Orta/Son corners), "Yeni mesajlar" divider, jump-to-bottom button with
  an unread count, load older on scroll to top, stick to bottom for new messages (also when the keyboard resizes the view), new messages rise in.
  Encryption is said ONCE (header chip, start of the conversation); messages carry only a small status icon. Long press / right click = context menu.
  Açık bir oda: başlık (geri, avatar, ad, şifreleme çipi, 1:1 odalarda arama düğmesi), zaman çizelgesi ve yazma alanı.
  Zaman çizelgesi: güne (yapışkan tarih hapı) ve gönderene (5 dk, Tek/İlk/Orta/Son köşeleri) göre gruplu, "Yeni mesajlar" ayırıcısı, sayılı en alta in düğmesi,
  üste kaydırınca eskileri yükler, yeni mesajda alta yapışır (klavye görünümü yeniden boyutlasa da), yeni mesajlar yükselerek gelir.
  Şifreleme BİR kez söylenir (başlık çipi, konuşmanın başı); mesajlarda yalnızca küçük durum simgesi var. Uzun basma / sağ tık = bağlam menüsü.
-->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import type { ZamanOgesi } from "../api/tipler";
  import Avatar from "../bilesenler/Avatar.svelte";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import OzellestirSayfasi from "../bilesenler/OzellestirSayfasi.svelte";
  import OdaBilgisi from "./OdaBilgisi.svelte";
  import Uyeler from "./Uyeler.svelte";
  import OdaIciArama from "../arama-mesaj/OdaIciArama.svelte";
  import { uzunBasma } from "../dokunma";
  import { gorunumStili, sohbetGorunumu } from "../durum/sohbetGorunum.svelte";
  import BaglamMenusu, { type MenuEylemi } from "../bilesenler/BaglamMenusu.svelte";
  import EsitlemeSeridi from "../bilesenler/EsitlemeSeridi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import OdaAramasi from "../arama-mesaj/OdaAramasi.svelte";
  import MesajBalonu, { type Konum } from "../bilesenler/MesajBalonu.svelte";
  import MedyaBekleyenler from "../medya/MedyaBekleyenler.svelte";
  import YazmaAlani from "../bilesenler/YazmaAlani.svelte";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t, type Anahtar } from "../i18n";
  import { gunEtiketi } from "../zaman-bicim";

  let { odaId }: { odaId: string } = $props();

  let kutu: HTMLDivElement | undefined = $state();
  let altaYapisik = true;
  /** Mirror of `altaYapisik` for the template (the jump button) · `altaYapisik`in şablon için yansısı (en alta in düğmesi) */
  let altaGorunur = $state(true);
  let oncekiIlkId: string | null = null;
  let oncekiSonId: string | null = null;
  let oncekiYukseklik = 0;
  let okunduZamanlayici: ReturnType<typeof setTimeout> | undefined;
  /** Id of the first unread message, remembered while the room stays open (the SDK marker moves once we mark as read) */
  /** İlk okunmamış mesajın kimliği; oda açıkken hatırlanır (okundu işaretleyince SDK işareti kayar) */
  let yeniKilit = $state<string | null>(null);
  let ilkKaydirmaYapildi = false;
  /** Last item the user has seen at the bottom · Kullanıcının altta gördüğü son öğe */
  let sonGorulenId = $state<string | null>(null);
  /** Ids that arrived after the room was opened: they play the rise animation once · Oda açıldıktan sonra gelen kimlikler: yükselme animasyonunu bir kez oynar */
  let yeniGelenler = $state<Record<string, true>>({});
  let kendiGonderildi = false;

  // Skeleton only after 400 ms of waiting (no flash on a quick open). · İskelet yalnızca 400 ms beklenince (hızlı açılışta yanıp sönme olmasın).
  let iskeletZamani = $state(false);
  $effect(() => {
    if (!zaman.yukleniyor) {
      iskeletZamani = false;
      return;
    }
    const z = setTimeout(() => (iskeletZamani = true), 400);
    return () => clearTimeout(z);
  });

  // Open on mount (the parent re-creates this component per room with {#key}). · Bağlanınca aç (üst bileşen {#key} ile her odada yeniden kurar).
  $effect(() => {
    const id = odaId;
    untrack(() => zaman.ac(id));
  });
  onDestroy(() => {
    clearTimeout(okunduZamanlayici);
    zaman.kapat();
  });

  const GERCEK = new Set(["metin", "resim", "diger", "sifre_cozulemedi"]);
  // Kinds the media work adds later still count as real messages. · Medya işinin sonradan ekleyeceği türler de gerçek mesaj sayılır.
  const gercekMi = (o: ZamanOgesi) => GERCEK.has(o.tur) || o.tur === ("video" as string) || o.tur === ("dosya" as string);

  // Latch the "new messages" position the first time the SDK reports it. · SDK bildirince "yeni mesajlar" konumunu bir kez kilitle.
  $effect(() => {
    const ogeler = zaman.ogeler;
    if (yeniKilit) return;
    const i = ogeler.findIndex((o) => o.tur === "okunmamis_ayirici");
    if (i < 0) return;
    const sonraki = ogeler.slice(i + 1).find((o) => gercekMi(o) || o.tur === "arama");
    if (sonraki && !sonraki.kendi) yeniKilit = sonraki.id;
  });

  // After every list change: keep the view where the user expects it. · Her liste değişiminden sonra görünümü kullanıcının beklediği yerde tut.
  $effect(() => {
    const ogeler = zaman.ogeler;
    const ilkId = ogeler[0]?.id ?? null;
    const sonId = ogeler.at(-1)?.id ?? null;
    void yeniKilit;

    // Mark what arrived at the bottom since the last run (not older pages added on top, not the first load).
    // Son çalışmadan beri altta gelenleri işaretle (üste eklenen eski sayfaları ve ilk yüklemeyi değil).
    if (ilkKaydirmaYapildi && oncekiSonId && sonId !== oncekiSonId) {
      const i = ogeler.findIndex((o) => o.id === oncekiSonId);
      if (i >= 0) {
        for (const o of ogeler.slice(i + 1)) {
          if (!gercekMi(o)) continue;
          // Own messages animate once, when sent; their later id swap (local echo → real event) must not replay it.
          // Giden mesajlar gönderilirken bir kez canlanır; sonraki kimlik değişimi (yerel yankı → gerçek olay) tekrar oynatmamalı.
          if (o.kendi && !kendiGonderildi) continue;
          yeniGelenler[o.id] = true;
          if (o.kendi) kendiGonderildi = false;
        }
      }
    }
    oncekiSonId = sonId;

    tick().then(() => {
      if (!kutu) return;
      if (!ilkKaydirmaYapildi && ogeler.length > 0) {
        ilkKaydirmaYapildi = true;
        const yeni = yeniKilit ? kutu.querySelector<HTMLElement>(`[data-yeni]`) : null;
        if (yeni) {
          // Open at the first unread message. · İlk okunmamış mesajda aç.
          altaYapisik = false;
          kutu.scrollTop += yeni.getBoundingClientRect().top - kutu.getBoundingClientRect().top - 48;
        } else {
          kutu.scrollTop = kutu.scrollHeight;
        }
      } else if (ilkId !== oncekiIlkId && oncekiIlkId !== null && !altaYapisik) {
        // Older messages were added on top: keep the same message under the finger. · Üste eski mesajlar eklendi: aynı mesaj parmağın altında kalsın.
        kutu.scrollTop += kutu.scrollHeight - oncekiYukseklik;
      } else if (altaYapisik) {
        kutu.scrollTop = kutu.scrollHeight;
      }
      oncekiIlkId = ilkId;
      oncekiYukseklik = kutu.scrollHeight;
      altaGorunur = altaYapisik;
      if (altaYapisik) sonGorulenId = sonId;
    });
    if (altaYapisik) okunduPlanla();
  });

  // Keyboard / window resize: stay glued to the newest message. · Klavye / pencere boyutu değişince en yeni mesaja yapışık kal.
  $effect(() => {
    if (!kutu) return;
    const g = new ResizeObserver(() => {
      if (altaYapisik && kutu) kutu.scrollTop = kutu.scrollHeight;
    });
    g.observe(kutu);
    return () => g.disconnect();
  });

  function okunduPlanla() {
    const son = [...zaman.ogeler].reverse().find(gercekMi);
    if (!son || son.kendi) return;
    clearTimeout(okunduZamanlayici);
    okunduZamanlayici = setTimeout(() => zaman.okundu(), 600);
  }

  function kaydir() {
    if (!kutu) return;
    const alttaydi = altaYapisik;
    altaYapisik = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < 80;
    altaGorunur = altaYapisik;
    if (altaYapisik) {
      sonGorulenId = zaman.ogeler.at(-1)?.id ?? null;
      if (!alttaydi) okunduPlanla();
    }
    if (kutu.scrollTop < 120) {
      oncekiYukseklik = kutu.scrollHeight;
      zaman.eskileriYukle();
    }
  }

  function asagiIn() {
    if (!kutu) return;
    kutu.scrollTo({ top: kutu.scrollHeight, behavior: "smooth" });
  }

  async function gonder(metin: string) {
    altaYapisik = true;
    kendiGonderildi = true;
    try {
      await zaman.gonder(metin);
    } catch (e) {
      bildirim.goster(t(`hata.${(e as { tur: string }).tur}` as Anahtar), 4000, { tur: "hata" });
    }
  }

  async function yenidenDene(ogeId: string) {
    try {
      await zaman.yenidenDene(ogeId);
    } catch {
      bildirim.goster(t("oda.yenidenDeneHata"), 4000, { tur: "hata" });
    }
  }

  // ---- Layers owned by the room: info, members, customize sheet, in-chat search · Odanın sahip olduğu katmanlar: bilgi, üyeler, özelleştir sayfası, sohbet içi arama ----
  let bilgiAcik = $state(false);
  let uyelerAcik = $state(false);
  let ozellestirAcik = $state(false);
  let aramaAcik = $state(false);
  let aktifOlay = $state<string | null>(null);
  let aramaSorgu = $state("");
  const gorunum = $derived(sohbetGorunumu.al(odaId));

  // ---- Context menu: only actions that really work · Bağlam menüsü: yalnızca gerçekten çalışan eylemler ----
  let menu = $state<{ x: number; y: number; oge: ZamanOgesi } | null>(null);

  async function kopyala(oge: ZamanOgesi) {
    // navigator.clipboard can be missing/blocked in a webview: say so instead of failing silently. · navigator.clipboard webview'da olmayabilir/engellenebilir: sessizce başarısız olmak yerine söyle.
    try {
      await navigator.clipboard.writeText(oge.metin ?? "");
      bildirim.goster(t("bildirim.kopyalandi"), 4000, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  function eylemleriKur(oge: ZamanOgesi): MenuEylemi[] {
    const liste: MenuEylemi[] = [];
    if (oge.tur === "metin" && oge.metin) liste.push({ ikon: "kopya", etiket: t("menu.kopyala"), calistir: () => void kopyala(oge) });
    if (oge.kendi && oge.durum === "hata") liste.push({ ikon: "yenile", etiket: t("eylem.yenidenDene"), calistir: () => void yenidenDene(oge.id) });
    return liste;
  }
  const menuEylemleri = $derived(menu ? eylemleriKur(menu.oge) : []);

  function menuAc(x: number, y: number, oge: ZamanOgesi) {
    if (eylemleriKur(oge).length === 0) return;
    menu = { x, y, oge };
  }

  // ---- Day and sender grouping · Gün ve gönderen gruplama ----
  type Satir = { tur: "oge"; oge: ZamanOgesi; ilk: boolean; son: boolean } | { tur: "yeni" };
  interface Gun { id: string; zaman: number | null; satirlar: Satir[] }
  const GRUP_ARALIGI = 5 * 60_000;

  const gunler = $derived.by(() => {
    const sonuc: Gun[] = [];
    let gun: Gun = { id: "basla", zaman: null, satirlar: [] };
    sonuc.push(gun);
    let onceki: (Satir & { tur: "oge" }) | null = null;
    for (const o of zaman.ogeler) {
      if (o.tur === "tarih_ayirici") {
        gun = { id: o.id, zaman: o.zaman, satirlar: [] };
        sonuc.push(gun);
        onceki = null;
        continue;
      }
      if (o.tur === "okunmamis_ayirici") continue;
      if (o.id === yeniKilit) {
        gun.satirlar.push({ tur: "yeni" });
        onceki = null;
      }
      const s: Satir & { tur: "oge" } = { tur: "oge", oge: o, ilk: true, son: true };
      const grupluMu = (x: ZamanOgesi) => x.tur !== "arama";
      if (onceki && grupluMu(o) && grupluMu(onceki.oge) && onceki.oge.gonderen === o.gonderen && o.zaman - onceki.oge.zaman < GRUP_ARALIGI) {
        onceki.son = false;
        s.ilk = false;
      }
      gun.satirlar.push(s);
      onceki = s;
    }
    return sonuc.filter((g) => g.satirlar.length > 0);
  });

  const konumu = (s: { ilk: boolean; son: boolean }): Konum => (s.ilk && s.son ? "tek" : s.ilk ? "ilk" : s.son ? "son" : "orta");

  /** New messages from others after the last thing the user saw at the bottom · Kullanıcının altta gördüğü son şeyden sonraki başkalarının mesajları */
  const yeniSayi = $derived.by(() => {
    if (altaGorunur) return 0;
    const i = sonGorulenId ? zaman.ogeler.findIndex((o) => o.id === sonGorulenId) : -1;
    return zaman.ogeler.slice(i + 1).filter((o) => gercekMi(o) && !o.kendi).length;
  });

  // Sender names only matter in rooms with more than two people. · Gönderen adları yalnızca ikiden çok kişilik odalarda anlamlıdır.
  const grupOdasi = $derived(!!zaman.bilgi && zaman.bilgi.uyeSayisi > 2);

  // Calls only in rooms with exactly two joined members. · Arama yalnızca tam iki üyeli odalarda.
  const aranabilir = $derived(!!zaman.bilgi && zaman.bilgi.uyeSayisi === 2 && !!zaman.bilgi.karsiKullanici);
</script>

<div class="oda" data-balon={gorunum.balon} data-saat={gorunum.saat ? undefined : "yok"} data-avatar={gorunum.avatar ? undefined : "yok"} style={gorunumStili(gorunum)}>
  <header class="ust">
    {#if !gezinme.genis}
      <button class="simge-dugme geri" aria-label={t("oda.geri")} onclick={() => gezinme.odaKapat()}><Ikon ad="geri" /></button>
    {/if}
    <!-- Tap = room info, long press = customize sheet (both tactile) · Dokun = oda bilgisi, uzun bas = özelleştir sayfası (ikisi de dokunsal) -->
    {#if zaman.bilgi}
      <button class="kimlik" aria-label={t("oda.bilgiAc")} onclick={() => (bilgiAcik = true)} use:uzunBasma={{ ac: () => (ozellestirAcik = true) }}>
        <Avatar harf={zaman.bilgi.avatarHarf} mxc={zaman.bilgi.avatarMxc} boyut={40} />
        <span class="adlar">
          <span class="ad">{zaman.bilgi.ad}</span>
          <span class="alt">
            <!-- Encryption is said once, here, as a small chip with a shield-like lock · Şifreleme burada bir kez, kilitli küçük çiple söylenir -->
            {#if zaman.bilgi.sifreli}<span class="sifre-cip"><Ikon ad="kilit" boyut={12} />{t("oda.sifreli")}</span>{:else}<span class="sifre-cip yok">{t("oda.sifreSiz")}</span>{/if}
            <span class="uye">{t("oda.uyeler", { n: zaman.bilgi.uyeSayisi })}</span>
          </span>
        </span>
      </button>
    {:else}
      <div class="adlar"></div>
    {/if}
    <OdaAramasi {odaId} />
    <button class="simge-dugme" class:tonlu={aramaAcik} aria-label={t("mesajAra.odadaAra")} aria-pressed={aramaAcik} onclick={() => (aramaAcik = true)}><Ikon ad="ara" /></button>
    {#if aranabilir && zaman.bilgi}
      <button
        class="simge-dugme"
        aria-label={t("oda.ara")}
        onclick={() => zaman.bilgi && arama.ara({ id: zaman.bilgi.id, ad: zaman.bilgi.ad, avatarHarf: zaman.bilgi.avatarHarf, avatarMxc: zaman.bilgi.avatarMxc })}
      >
        <Ikon ad="telefon" />
      </button>
    {/if}
  </header>
  <EsitlemeSeridi />

  <div class="zaman-sarmal">
    <div class="zaman" bind:this={kutu} onscroll={kaydir}>
      <div class="sutun">
        {#if zaman.hata}
          <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={t("oda.acilamadiAlt")} eylem={t("oda.yeniden")} onEylem={() => { void zaman.kapat().then(() => zaman.ac(odaId)); }} />
        {:else}
          {#if zaman.eskiYukleniyor}<p class="orta">{t("oda.eskiYukleniyor")}</p>{/if}
          {#if zaman.basaUlasildi && zaman.ogeler.length > 0 && zaman.bilgi}
            <!-- Start of the conversation (design section 13) · Konuşmanın başı (tasarım bölüm 13) -->
            <div class="basi">
              <span class="basi-kutu"><Ikon ad="kilit" boyut={24} /></span>
              <strong>{t("oda.basinaGeldin")}</strong>
              {#if zaman.bilgi.sifreli}<span>{zaman.bilgi.karsiKullanici && zaman.bilgi.uyeSayisi === 2 ? t("oda.basiSifreliDm", { ad: zaman.bilgi.ad }) : t("oda.basiSifreliGrup")}</span>{/if}
            </div>
          {/if}

          {#if zaman.yukleniyor && zaman.ogeler.length === 0 && iskeletZamani}
            <!-- Skeleton while the first page loads · İlk sayfa yüklenirken iskelet -->
            {#each [0, 1, 2, 3, 4] as i (i)}
              <div class="iskelet" class:sag={i % 2 === 1}><span class="parilti" style:width="{i % 2 ? 46 : 62}%"></span></div>
            {/each}
          {/if}

          {#each gunler as gun (gun.id)}
            <section class="gun">
              {#if gun.zaman !== null}<div class="tarih"><span>{gunEtiketi(gun.zaman)}</span></div>{/if}
              {#each gun.satirlar as s, i (s.tur === "oge" ? s.oge.id : `yeni-${i}`)}
                {#if s.tur === "yeni"}
                  <div class="yeni" data-yeni><span>{t("oda.yeniMesajlar")}</span></div>
                {:else}
                  <MesajBalonu oge={s.oge} konum={konumu(s)} gonderenGoster={grupOdasi} yeni={!!yeniGelenler[s.oge.id]} vurgulu={menu?.oge.id === s.oge.id} eslesme={aramaAcik && !!aktifOlay && s.oge.olayId === aktifOlay} vurguSorgu={aramaAcik ? aramaSorgu : ""} {yenidenDene} {menuAc} />
                {/if}
              {/each}
            </section>
          {/each}
          <!-- Media still being compressed (before the SDK's local echo takes over) · Hâlâ sıkıştırılan medya (SDK'nın yerel yankısı devralmadan önce) -->
          <MedyaBekleyenler {odaId} />
          {#if !zaman.yukleniyor && zaman.ogeler.length === 0}<p class="orta">{t("oda.bos")}</p>{/if}
        {/if}
      </div>
    </div>

    {#if !altaGorunur}
      <button class="asagi" onclick={asagiIn} aria-label={yeniSayi > 0 ? t("oda.asagiInSayi", { n: yeniSayi }) : t("oda.asagiIn")}>
        <Ikon ad="asagi" />
        {#if yeniSayi > 0}<span class="rozet sayi">{yeniSayi > 99 ? "99+" : yeniSayi}</span>{/if}
      </button>
    {/if}
  </div>

  {#if aramaAcik}
    <OdaIciArama {odaId} onkapat={() => (aramaAcik = false)} bind:aktifOlay bind:sorgu={aramaSorgu} />
  {:else}
    <YazmaAlani {odaId} sifreli={zaman.bilgi?.sifreli ?? false} {gonder} />
  {/if}

  {#if bilgiAcik}
    <OdaBilgisi {odaId} onkapat={() => (bilgiAcik = false)} uyelerAc={() => (uyelerAcik = true)} gorunumAc={() => (ozellestirAcik = true)} ara={() => { bilgiAcik = false; aramaAcik = true; }} />
  {/if}
  {#if uyelerAcik}<Uyeler {odaId} onkapat={() => (uyelerAcik = false)} />{/if}
</div>

{#if ozellestirAcik}<OzellestirSayfasi {odaId} onkapat={() => (ozellestirAcik = false)} />{/if}

{#if menu && menuEylemleri.length > 0}
  <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri} onkapat={() => (menu = null)} />
{/if}

<style>
  .oda { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; min-width: 0; height: 100%; background: var(--zemin); }
  .ust {
    flex: none; height: 56px; display: flex; align-items: center; gap: 10px; box-sizing: content-box;
    padding: env(safe-area-inset-top) calc(8px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));
    background: var(--yuzey-1); border-bottom: 1px solid var(--kenar-ince);
  }
  .geri { margin-left: -8px; }
  .kimlik { flex: 1; min-width: 0; min-height: 52px; display: flex; align-items: center; gap: 10px; text-align: left; border-radius: 12px; }
  .adlar { flex: 1; min-width: 0; display: grid; }
  .ad { font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alt { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: .75rem; color: var(--yazi-2); white-space: nowrap; overflow: hidden; }
  .sifre-cip { display: inline-flex; align-items: center; gap: 4px; flex: none; color: var(--cozum); font-weight: 500; }
  .sifre-cip.yok { color: var(--yazi-2); }
  .uye { overflow: hidden; text-overflow: ellipsis; }
  .zaman-sarmal { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--sohbet-zemin, var(--zemin)); }
  .zaman { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 12px; overscroll-behavior: contain; }
  /* Landscape phone (height <= 500px): header 48px, message column at most 680px and centred (design section 15). */
  /* Yatay telefon (yükseklik <= 500px): başlık 48px, mesaj sütunu en fazla 680px ve ortalı (tasarım bölüm 15). */
  .sutun { width: 100%; }
  @media (max-height: 500px) {
    .ust { height: 48px; padding-top: 0; }
    .sutun { max-width: 680px; margin: 0 auto; }
  }
  .orta { text-align: center; font-size: .8125rem; color: var(--yazi-2); padding: 12px; }
  .basi { display: grid; justify-items: center; gap: 6px; padding: 24px 24px 8px; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .basi strong { font-family: var(--baslik-tipi); font-size: 1.0625rem; color: var(--yazi); }
  .basi-kutu { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--ton); color: var(--ton-ustu); margin-bottom: 4px; }

  /* Sticky date chip: sticks to the top while its day scrolls by, bounded by its own <section>. */
  /* Yapışkan tarih hapı: günü kayarken üstte kalır, kendi <section>'ıyla sınırlıdır. */
  .tarih { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; padding: 8px 0 4px; pointer-events: none; }
  .tarih span { background: var(--yuzey-2); color: var(--yazi-2); font-size: .75rem; font-weight: 500; padding: 4px 12px; border-radius: 10px; border: 1px solid var(--kenar-ince); }

  .yeni { display: flex; align-items: center; gap: 12px; margin: 14px 0 6px; color: var(--vurgu); font-size: .75rem; font-weight: 600; }
  .yeni::before, .yeni::after { content: ""; flex: 1; height: 1px; background: var(--vurgu); opacity: .5; }

  .iskelet { display: flex; margin-top: 10px; }
  .iskelet.sag { justify-content: flex-end; }
  .iskelet span { height: 40px; border-radius: 16px; }

  .asagi {
    position: absolute; right: 12px; bottom: 12px; width: 44px; height: 44px; border-radius: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--yuzey-3); color: var(--yazi); border: 1px solid var(--kenar); box-shadow: var(--kat-1);
    transition: background var(--sure-hizli) var(--egri-cikis);
    animation: belir var(--sure-orta) var(--egri-cikis);
  }
  @keyframes belir { from { transform: translateY(8px); opacity: 0; } }
  .asagi:active { background: var(--yuzey-2); }
  .sayi { position: absolute; top: -10px; left: -10px; }
</style>
