<!--
  One open room: header (back, avatar, name, encryption chip, call button in 1:1 rooms), timeline and the composer.
  Timeline: grouped by day (sticky date chip) and by sender (5 min, Tek/İlk/Orta/Son corners), "Yeni mesajlar" divider, jump-to-bottom button with
  an unread count, load older on scroll to top, stick to bottom for new messages (also when the keyboard resizes the view), new messages rise in.
  Encryption is said ONCE (header chip, start of the conversation); messages carry only a small status icon. Long press / right click = context menu.
  Açık bir oda: başlık (geri, avatar, ad, şifreleme çipi, 1:1 odalarda arama düğmesi), zaman çizelgesi ve yazma alanı.
  Zaman çizelgesi: güne (yapışkan tarih hapı) ve gönderene (5 dk, Tek/İlk/Orta/Son köşeleri) göre gruplu, "Yeni mesajlar" ayırıcısı, sayılı en alta in düğmesi,
  üste kaydırınca eskileri yükler, yeni mesajda alta yapışır (klavye görünümü yeniden boyutlasa da), yeni mesajlar yükselerek gelir.
  Şifreleme BİR kez söylenir (başlık çipi, konuşmanın başı); mesajlarda yalnızca küçük durum simgesi var. Uzun basma / sağ tık = bağlam menüsü.
  Context menu (long press): a quick reaction bar on top, then only the actions that work for that message (Yanıtla, Düzenle, Kopyala, İlet, Sabitle,
  Sil), gated by ownership and the room's power levels. Nothing can leave this screen black: a load error, a 15 s timeout and any render error
  all end in the mascot error state (the whole screen sits inside a <svelte:boundary>).
  Bağlam menüsü (uzun basma): üstte hızlı tepki çubuğu, altında yalnızca o mesaj için çalışan eylemler (Yanıtla, Düzenle, Kopyala, İlet, Sabitle, Sil);
  sahiplik ve odanın yetki düzeylerine bağlı. Hiçbir şey bu ekranı siyah bırakamaz: yükleme hatası, 15 sn zaman aşımı ve her çizim hatası maskotlu hata
  durumuna varır (ekranın tamamı bir <svelte:boundary> içindedir).
-->
<script lang="ts">
  import { panoyaYaz } from "../pano";
  import { medyaKaydet } from "../api/komutlar";
  import { saatYaz } from "../zaman-bicim";
  import { egri, hareketVar, sureMs } from "../hareket";
  import { odalar } from "../durum/odalar.svelte";
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
  import { hizliGecis } from "../durum/hizliGecis.svelte";
  import EsitlemeSeridi from "../bilesenler/EsitlemeSeridi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import OdaAramasi from "../arama-mesaj/OdaAramasi.svelte";
  import MesajBalonu, { type Konum } from "../bilesenler/MesajBalonu.svelte";
  import MedyaBekleyenler from "../medya/MedyaBekleyenler.svelte";
  import YazmaAlani from "../bilesenler/YazmaAlani.svelte";
  import EmojiSayfasi from "../bilesenler/EmojiSayfasi.svelte";
  import IletSayfasi from "../bilesenler/IletSayfasi.svelte";
  import OkuyanListesi from "../bilesenler/OkuyanListesi.svelte";
  import SabitCubugu from "../bilesenler/SabitCubugu.svelte";
  import KisilerPaneli from "../bilesenler/KisilerPaneli.svelte";
  import GonderilemediSayfasi from "../bilesenler/GonderilemediSayfasi.svelte";
  import SilOnay from "../bilesenler/SilOnay.svelte";
  import TepkiCubugu from "../bilesenler/TepkiCubugu.svelte";
  import TepkiKimler from "../bilesenler/TepkiKimler.svelte";
  import TepkiMenusu from "../bilesenler/TepkiMenusu.svelte";
  import VarlikRozeti from "../bilesenler/VarlikRozeti.svelte";
  import { mesajaGit } from "../arama-mesaj/atla";
  import { gercekOlay, iletilebilir, sil as mesajiSil, sabitle as mesajiSabitle, tepkiVer } from "../mesaj/eylemler";
  import { yazma } from "../durum/yazma.svelte";
  import type { Tepki } from "../api/tipler";
  import { arama } from "../durum/arama.svelte";
  import { ec } from "../arama-ec/ec.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { duzen } from "../durum/duzen.svelte";
  import { klavye, type OdaKlavye } from "../klavyeKisayol.svelte";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { uyeler } from "../durum/uyeler.svelte";
  import { varlik } from "../durum/varlik.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t, type Anahtar } from "../i18n";
  import { gunEtiketi } from "../zaman-bicim";
  import SohbetZemini from "../bilesenler/SohbetZemini.svelte";
  import { GRUP_ARALIGI } from "../gruplama";

  let { odaId }: { odaId: string } = $props();

  // A call running in this room that we are not in: the header's call button becomes a green "Katıl" (no separate strip above the app).
  // Bu odada süren ve içinde olmadığımız arama: başlıktaki arama düğmesi yeşil "Katıl" olur (uygulamanın üstünde ayrı şerit yok).
  const surenArama = $derived(!ec.etkin ? ec.aktifler[odaId] : undefined);
  const katilinabilir = $derived(!!surenArama && !surenArama.benIcinde);
  function aramayaKatil() {
    const o = odalar.liste.find((x) => x.id === odaId);
    if (o) ec.katil({ id: o.id, ad: o.ad, avatarHarf: o.avatarHarf, avatarMxc: o.avatarMxc, dm: o.dm, sesli: o.dm });
  }

  // This room's header, kept until the screen is gone: jumping straight to another room clears `zaman.bilgi` while this screen is still
  // drawn, and reading it then crashed the whole room. · Bu odanın başlığı, ekran gidene dek tutulur: doğrudan başka odaya geçmek,
  // bu ekran hâlâ çizilirken `zaman.bilgi`yi siler; o an okumak bütün odayı çökertiyordu.
  const buOda = untrack(() => odaId);
  let sonBilgi: typeof zaman.bilgi = null;
  const bilgi = $derived.by(() => {
    if (zaman.bilgi?.id === buOda) sonBilgi = zaman.bilgi;
    return sonBilgi;
  });

  let kutu: HTMLDivElement | undefined = $state();
  /** Height of the floating header: the timeline starts below it and scrolls under it · Yüzen başlığın yüksekliği: çizelge onun altından başlar, altına kayar */
  let tepeYuk = $state(64);
  /** Height of the floating composer: the timeline ends above it and scrolls under it · Yüzen yazma alanının yüksekliği: çizelge onun üstünde biter, altına kayar */
  let altYuk = $state(76);
  let kutuBoyu = 0;
  let altaYapisik = true;
  /** Mirror of `altaYapisik` for the template (the jump button) · `altaYapisik`in şablon için yansısı (en alta in düğmesi) */
  let altaGorunur = $state(true);
  let oncekiIlkId: string | null = null;
  let oncekiSonId: string | null = null;
  let oncekiYukseklik = 0;
  /** First visible event row captured right before a list DOM update (keeps position across Clear/refill) */
  /** Liste DOM güncellemesinden hemen önce yakalanan ilk görünür olay satırı (Clear/yeniden doldurmada konumu korur) */
  let capa: { olayId: string; ust: number } | null = null;
  /** Consecutive automatic (non-scroll) pagination attempts that did not change the oldest visible row */
  /** En eski görünür satırı değiştirmeyen ardışık otomatik (kaydırmasız) sayfalama denemeleri */
  let otoBosSayac = 0;
  let otoSonIlk: string | null | undefined = undefined;
  let programatikKaydirma = false;
  let programatikKonum = 0;
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

  // If the room has not answered in 15 s, show the error state instead of waiting forever (a hung command used to leave an empty dark screen).
  // Oda 15 sn içinde cevap vermediyse sonsuza dek beklemek yerine hata durumunu göster (takılan bir komut boş, karanlık bir ekran bırakıyordu).
  let zamanAsimi = $state(false);
  $effect(() => {
    if (!zaman.yukleniyor || bilgi) {
      zamanAsimi = false;
      return;
    }
    const z = setTimeout(() => (zamanAsimi = true), 15_000);
    return () => clearTimeout(z);
  });
  function yenidenAc() {
    zamanAsimi = false;
    void zaman.kapat().then(() => zaman.ac(odaId));
  }

  // Open on mount (the parent re-creates this component per room with {#key}). · Bağlanınca aç (üst bileşen {#key} ile her odada yeniden kurar).
  $effect(() => {
    const id = odaId;
    untrack(() => zaman.ac(id));
  });
  onDestroy(() => {
    clearTimeout(okunduZamanlayici);
    void zaman.kapat(odaId);
  });

  const GERCEK = new Set(["metin", "resim", "diger", "sifre_cozulemedi", "cikartma", "anket", "silindi"]);
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

  /** Sets `scrollTop` programmatically so the resulting `scroll` event is not mistaken for a user scroll.
   *  `scrollTop`ı programlı ayarlar; oluşan `scroll` olayı kullanıcı kaydırması sanılmasın. */
  function kaydirAyarla(hedef: number) {
    if (!kutu) return;
    const onceki = kutu.scrollTop;
    kutu.scrollTop = hedef;
    if (kutu.scrollTop !== onceki) {
      programatikKaydirma = true;
      programatikKonum = kutu.scrollTop;
      requestAnimationFrame(() => (programatikKaydirma = false));
    }
  }

  /** First message row visible below the floating header and its top offset inside `kutu`.
   *  Yüzen başlığın altında görünür ilk mesaj satırı ve `kutu` içindeki üst konumu. */
  function ilkGorunurOlay(): { olayId: string; ust: number } | null {
    if (!kutu) return null;
    const satirlar = kutu.querySelectorAll<HTMLElement>("[data-olay-id]");
    if (satirlar.length === 0) return null;
    const kutuUst = kutu.getBoundingClientRect().top;
    const sinir = kutuUst + untrack(() => tepeYuk);
    let lo = 0;
    let hi = satirlar.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (satirlar[mid].getBoundingClientRect().bottom <= sinir) lo = mid + 1;
      else hi = mid;
    }
    const el = satirlar[lo];
    const olayId = el?.dataset.olayId;
    if (!el || !olayId) return null;
    return { olayId, ust: el.getBoundingClientRect().top - kutuUst };
  }

  // WebKitGTK (the desktop) has no CSS scroll anchoring: anything that grows or shrinks ABOVE the view (a late image, a row painted for the
  // first time, the start-of-chat card) pushes the messages being read. A ResizeObserver on the content puts the first visible row back
  // where it was before the frame is painted, the way Chromium (Android) already does natively.
  // WebKitGTK'de (masaüstü) CSS kaydırma çapası yok: görünümün ÜSTÜNDE büyüyen ya da küçülen her şey (geç gelen görsel, ilk kez boyanan
  // satır, sohbetin başı kartı) okunan mesajları iter. İçerikteki ResizeObserver ilk görünür satırı kare boyanmadan eski yerine koyar;
  // Chromium (Android) bunu zaten kendisi yapar.
  const yerelCapa = typeof CSS !== "undefined" && CSS.supports("overflow-anchor", "auto");
  let surekliCapa: { olayId: string; ust: number } | null = null;
  function capaTut() {
    surekliCapa = !yerelCapa && kutu && ilkKaydirmaYapildi && !altaYapisik ? ilkGorunurOlay() : null;
  }
  function capayaDon() {
    if (yerelCapa || !kutu || !surekliCapa || altaYapisik) return;
    const el = kutu.querySelector<HTMLElement>(`[data-olay-id="${CSS.escape(surekliCapa.olayId)}"]`);
    if (!el) return;
    const fark = el.getBoundingClientRect().top - kutu.getBoundingClientRect().top - surekliCapa.ust;
    if (Math.abs(fark) > 0.5) kaydirAyarla(kutu.scrollTop + fark);
  }

  /** Event id (or unique id) of the oldest rendered message row, used to stop empty automatic pagination.
   *  Çizilen en eski mesaj satırının olay kimliği (veya tekil kimliği); boş otomatik sayfalamayı durdurmak için. */
  function ilkListeOlayi(): string | null {
    for (const g of gunler) {
      for (const s of g.satirlar) {
        if (s.tur === "oge") return s.oge.olayId ?? s.oge.id;
      }
    }
    return null;
  }

  /** Requests older messages whenever the top buffer is short (scroll, list update or resize).
   *  Üst tampon kısaldığında eski mesajları ister (kaydırma, liste güncellemesi veya boyut değişimi). */
  function eskiGerekli(kaydirmadan = false) {
    if (!kutu || !ilkKaydirmaYapildi || zaman.onbellekten || zaman.yukleniyor || zaman.eskiYukleniyor || zaman.basaUlasildi || zaman.hata || zamanAsimi) return;
    // Ask early (about three screens before the top): a fast flick must not reach the top before the page has arrived.
    // Erken iste (tepeye yaklaşık üç ekran kala): hızlı bir savurma sayfa gelmeden tepeye varmamalı.
    if (kutu.scrollTop >= Math.max(1600, kutu.clientHeight * 3)) return;
    if (!kaydirmadan) {
      const ilk = ilkListeOlayi();
      if (otoSonIlk !== undefined && ilk === otoSonIlk) {
        if (otoBosSayac >= 9) {
          otoBosSayac = 10;
          return;
        }
        otoBosSayac++;
      } else {
        otoBosSayac = 0;
        otoSonIlk = ilk;
      }
    }
    oncekiYukseklik = kutu.scrollHeight;
    void zaman.eskileriYukle();
  }

  // Capture the first visible row BEFORE Svelte mutates the DOM for the next item list.
  // Svelte sonraki öğe listesi için DOM'u değiştirmeden ÖNCE ilk görünür satırı yakala.
  $effect.pre(() => {
    void zaman.ogeler;
    void yeniKilit;
    if (!kutu || !ilkKaydirmaYapildi || altaYapisik) {
      capa = null;
      return;
    }
    capa = ilkGorunurOlay();
  });

  // After every list change: keep the view where the user expects it. · Her liste değişiminden sonra görünümü kullanıcının beklediği yerde tut.
  $effect(() => {
    const ogeler = zaman.ogeler;
    const ilkId = ogeler[0]?.id ?? null;
    const sonId = ogeler.at(-1)?.id ?? null;
    const anlikCapa = capa;
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
        // A list from memory is only a preview: the real one decides where to open. · Bellekten gelen liste yalnızca ön izlemedir: nerede açılacağına gerçeği karar verir.
        ilkKaydirmaYapildi = !zaman.onbellekten;
        const yeni = yeniKilit ? kutu.querySelector<HTMLElement>(`[data-yeni]`) : null;
        if (yeni) {
          // Open at the first unread message. · İlk okunmamış mesajda aç.
          altaYapisik = false;
          kaydirAyarla(kutu.scrollTop + yeni.getBoundingClientRect().top - kutu.getBoundingClientRect().top - tepeYuk - 40);
          // A short room may already show everything: no scroll event will come, so measure. · Kısa oda zaten her şeyi gösteriyor olabilir: kaydırma olayı gelmez, ölç.
          altaYapisik = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < 80;
          if (altaYapisik) okunduPlanla();
        } else {
          kaydirAyarla(kutu.scrollHeight);
        }
      } else if (ilkId !== oncekiIlkId && oncekiIlkId !== null && !altaYapisik) {
        // Older messages were added on top or rows were re-created after a Clear: restore the anchored event row,
        // falling back to the scroll-height delta if no event row was anchored.
        // Üste eski mesajlar eklendi ya da Clear sonrası satırlar yeniden kuruldu: çapalanan olay satırını geri koy,
        // çapalanan olay satırı yoksa yükseklik farkına düş.
        const el = anlikCapa ? kutu.querySelector<HTMLElement>(`[data-olay-id="${CSS.escape(anlikCapa.olayId)}"]`) : null;
        if (el && anlikCapa) {
          const duzelt = () => {
            const yeniUst = el.getBoundingClientRect().top - kutu!.getBoundingClientRect().top;
            const fark = yeniUst - anlikCapa.ust;
            if (Math.abs(fark) > 0.5) kaydirAyarla(kutu!.scrollTop + fark);
            return Math.abs(fark);
          };
          if (duzelt() > 200) duzelt();
        } else {
          kaydirAyarla(kutu.scrollTop + (kutu.scrollHeight - oncekiYukseklik));
        }
      } else if (altaYapisik) {
        kaydirAyarla(kutu.scrollHeight);
      }
      oncekiIlkId = ilkId;
      oncekiYukseklik = kutu.scrollHeight;
      altaGorunur = altaYapisik;
      if (altaYapisik) sonGorulenId = sonId;
      capaTut();
      eskiGerekli();
    });
    if (altaYapisik) okunduPlanla();
  });

  // Keyboard / window resize: stay glued to the newest message. · Klavye / pencere boyutu değişince en yeni mesaja yapışık kal.
  $effect(() => {
    if (!kutu) return;
    const g = new ResizeObserver(() => {
      if (!kutu) return;
      kutuBoyu = kutu.clientHeight - altYuk;
      if (altaYapisik) kaydirAyarla(kutu.scrollHeight);
      else capayaDon();
      capaTut();
      eskiGerekli();
    });
    g.observe(kutu);
    // Late images make the content taller · Geç yüklenen görseller içeriği uzatır
    if (kutu.firstElementChild) g.observe(kutu.firstElementChild);
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
    const kullanici = !programatikKaydirma || Math.abs(kutu.scrollTop - programatikKonum) > 2;
    programatikKaydirma = false;
    const alttaydi = altaYapisik;
    // The box itself changed size (keyboard, emoji panel): this is not the user scrolling away, stay glued. · Kutunun boyu değişti (klavye, emoji paneli): kullanıcı kaydırmadı, yapışık kal.
    if (kutu.clientHeight - altYuk !== kutuBoyu) {
      kutuBoyu = kutu.clientHeight - altYuk;
      if (altaYapisik) {
        kaydirAyarla(kutu.scrollHeight);
        return;
      }
    }
    if (kullanici) {
      otoBosSayac = 0;
      otoSonIlk = undefined;
    }
    // Two thresholds, so the button does not flicker at the edge. · İki eşik; düğme sınırda titremesin.
    altaYapisik = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < (alttaydi ? 160 : 60);
    altaGorunur = altaYapisik;
    if (altaYapisik) {
      sonGorulenId = zaman.ogeler.at(-1)?.id ?? null;
      if (!alttaydi) okunduPlanla();
    }
    capaTut();
    eskiGerekli(kullanici);
  }

  function asagiIn() {
    if (!kutu) return;
    // Far away: jump near the end first, so the smooth part is always short. · Uzaktaysa önce sona yakın atla; yumuşak kısım hep kısa olsun.
    const uzak = kutu.scrollHeight - kutu.clientHeight * 2.5;
    if (kutu.scrollTop < uzak) kutu.scrollTop = uzak;
    const hareket = hareketVar();
    kutu.scrollTo({ top: kutu.scrollHeight, behavior: hareket ? "smooth" : "instant" });
  }

  async function gonder(metin: string, html: string | null, yanitOlayId: string | null, bahsedilenler: string[] = [], odaBahset = false) {
    altaYapisik = true;
    kendiGonderildi = true;
    try {
      await zaman.gonder(metin, html, yanitOlayId, bahsedilenler, odaBahset);
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

  async function vazgec(oge: ZamanOgesi) {
    try {
      await zaman.vazgec(oge.id);
    } catch {
      bildirim.goster(t("hata.diger"), 4000, { tur: "hata" });
    }
  }

  // Ask once per failed message; `sorulan` is not reactive on purpose. · Başarısız mesaj başına bir kez sor; `sorulan` bilerek reaktif değil.
  let basarisizHedef = $state<ZamanOgesi | null>(null);
  const sorulan = new Set<string>();
  $effect(() => {
    const b = zaman.ogeler.find((o) => o.kendi && o.durum === "hata" && !sorulan.has(o.id));
    if (!b || untrack(() => basarisizHedef)) return;
    sorulan.add(b.id);
    basarisizHedef = b;
  });

  // ---- Layers owned by the room: info, members, customize sheet, in-chat search · Odanın sahip olduğu katmanlar: bilgi, üyeler, özelleştir sayfası, sohbet içi arama ----
  let bilgiAcik = $state(false);
  let uyelerAcik = $state(false);
  let ozellestirAcik = $state(false);
  let aramaAcik = $state(false);
  let aramaVim = $state(false);
  let aramaApi: { adim: (yon: -1 | 1) => string | null; odakla: () => void; kapat: () => void } | null = null;
  let aramaDurum = $state({ sira: 0, toplam: 0 });
  /** Words of the CURRENT results and the events they matched: only those bubbles highlight (others keep their formatting).
   *  GÜNCEL sonuçların kelimeleri ve eşleştikleri olaylar: yalnızca o balonlar vurgulanır (diğerleri biçimini korur). */
  let aramaVurgu = $state.raw<{ sorgu: string; idler: Set<string> }>({ sorgu: "", idler: new Set() });
  let aktifOlay = $state<string | null>(null);
  let aramaSorgu = $state("");
  const gorunum = $derived(sohbetGorunumu.al(odaId));

  // ---- Context menu: only actions that really work · Bağlam menüsü: yalnızca gerçekten çalışan eylemler ----
  let menu = $state<{ x: number; y: number; oge: ZamanOgesi } | null>(null);
  let hizliTepki = $state<{ x: number; y: number; oge: ZamanOgesi } | null>(null);
  // Sheets opened from the menu · Menüden açılan sayfalar
  let tepkiSecici = $state<ZamanOgesi | null>(null);
  let tepkiKimlerHedef = $state<{ oge: ZamanOgesi; anahtar: string } | null>(null);
  let okuyanHedef = $state<ZamanOgesi | null>(null);
  let silHedef = $state<ZamanOgesi | null>(null);
  let iletHedef = $state<ZamanOgesi | null>(null);

  async function medyayiKaydet(oge: ZamanOgesi) {
    try {
      const ad = await medyaKaydet(oge.medya!.kaynakId);
      bildirim.goster(t("menu.kaydedildi", { ad }), 3500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("hata.diger"), 4000, { tur: "hata" });
    }
  }
  /** One line that tells what the message is · Mesajın ne olduğunu söyleyen tek satır */
  const ozet = (o: ZamanOgesi) => o.metin || o.medya?.dosyaAdi || t("menu.mesaj");

  async function panoya(metin: string) {
    // navigator.clipboard can be missing/blocked in a webview: say so instead of failing silently. · navigator.clipboard webview'da olmayabilir/engellenebilir: sessizce başarısız olmak yerine söyle.
    try {
      await panoyaYaz(metin);
      bildirim.goster(t("bildirim.kopyalandi"), 4000, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  function eylemleriKur(oge: ZamanOgesi): MenuEylemi[] {
    const liste: MenuEylemi[] = [];
    const gercek = gercekOlay(oge);
    // The four frequent ones are tiles, the rest a list. · Sık kullanılan dördü karo, gerisi liste.
    if (gercek) liste.push({ ikon: "yanitla", etiket: t("menu.yanitla"), karo: true, calistir: () => yazma.yanitla(oge) });
    if (oge.metin) liste.push({ ikon: "kopya", etiket: t("menu.kopyala"), karo: true, calistir: () => void panoya(oge.metin!) });
    if (gercek && iletilebilir(oge)) liste.push({ ikon: "ilet", etiket: t("menu.ilet"), karo: true, calistir: () => (iletHedef = oge) });
    if (oge.duzenlenebilir) liste.push({ ikon: "kalem", etiket: t("menu.duzenle"), karo: true, calistir: () => yazma.duzenleBaslat(oge) });
    if (gercek && zaman.sabitleyebilir) liste.push({ ikon: "sabitle", etiket: oge.sabit ? t("menu.sabitiKaldir") : t("menu.sabitle"), calistir: () => void mesajiSabitle(oge, !oge.sabit) });
    const adres = /https?:\/\/[^\s<>"]+/.exec(oge.metin ?? "")?.[0];
    if (adres) liste.push({ ikon: "atac", etiket: t("menu.adresKopyala"), calistir: () => void panoya(adres) });
    if (oge.medya && !oge.medya.ilerleme) liste.push({ ikon: "asagi", etiket: t("menu.kaydet"), calistir: () => void medyayiKaydet(oge) });
    if (oge.okuyanlar.length > 0) liste.push({ ikon: "tikCift", etiket: t("menu.gorenler", { n: oge.okuyanlar.length }), calistir: () => (okuyanHedef = oge) });
    if (gercek) liste.push({ ikon: "dosya", etiket: t("menu.mesajBaglantisi"), calistir: () => void panoya(`https://matrix.to/#/${encodeURIComponent(odaId)}/${encodeURIComponent(oge.olayId!)}`) });
    if (oge.kendi && oge.durum === "hata") liste.push({ ikon: "yenile", etiket: t("eylem.yenidenDene"), calistir: () => void yenidenDene(oge.id) });
    if (oge.kendi && !oge.olayId && oge.durum !== "gonderildi") liste.push({ ikon: "cop", etiket: oge.durum === "hata" ? t("menu.sil") : t("gonderilemedi.iptal"), tehlike: true, calistir: () => void vazgec(oge) });
    if (oge.silinebilir) liste.push({ ikon: "cop", etiket: t("menu.sil"), tehlike: true, calistir: () => (silHedef = oge) });
    return liste;
  }
  const menuEylemleri = $derived(menu ? eylemleriKur(menu.oge) : []);
  const menuTepkiler = $derived(new Set(menu?.oge.tepkiler.filter((r) => r.benim).map((r) => r.anahtar) ?? []));
  const hizliTepkiTepkiler = $derived(new Set(hizliTepki?.oge.tepkiler.filter((r) => r.benim).map((r) => r.anahtar) ?? []));
  const seciliOge = $derived(klavye.seciliId ? zaman.ogeler.find((o) => o.olayId === klavye.seciliId) ?? null : null);

  function menuAc(x: number, y: number, oge: ZamanOgesi) {
    if (eylemleriKur(oge).length === 0 && !gercekOlay(oge)) return;
    menu = { x, y, oge };
  }

  /** Event id currently in view (selected row, else newest when at bottom, else centred visible row) for Ctrl+O. */
  /** Ctrl+O için şu an bakılan olay kimliği (seçili satır, yoksa en alttayken en yeni, yoksa ortadaki görünür satır). */
  function mevcutKonum(): string | null {
    if (klavye.seciliId) return klavye.seciliId;
    if (!kutu) return null;
    const satirlar = [...kutu.querySelectorAll<HTMLElement>(".satir[data-olay-id]")];
    if (satirlar.length === 0) return null;
    if (altaYapisik) return satirlar.at(-1)?.dataset.olayId ?? null;
    const kr = kutu.getBoundingClientRect();
    const orta = (kr.top + untrack(() => tepeYuk) + kr.bottom - untrack(() => altYuk)) / 2;
    let enYakin: HTMLElement | null = null;
    let enAz = Infinity;
    for (const s of satirlar) {
      const r = s.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - orta);
      if (d < enAz) {
        enAz = d;
        enYakin = s;
      }
    }
    return enYakin?.dataset.olayId ?? null;
  }

  // Keyboard shortcuts act on the open room through this. · Klavye kısayolları açık odada bununla iş görür.
  $effect(() => {
    const k: OdaKlavye = {
      odaId: buOda,
      kutu: () => kutu,
      seciliOge: () => seciliOge,
      konum: mevcutKonum,
      enYeniId: () => {
        for (let i = zaman.ogeler.length - 1; i >= 0; i--) {
          if (zaman.ogeler[i].olayId) return zaman.ogeler[i].olayId;
        }
        return null;
      },
      aramaAcik: () => aramaAcik,
      sabitleyebilir: () => zaman.sabitleyebilir,
      ara: (metin?: string, vim = false) => {
        aramaVim = vim;
        if (metin !== undefined) aramaSorgu = metin;
        if (aramaAcik) {
          if (metin === undefined) aramaApi?.odakla();
          else document.querySelector<HTMLInputElement>('.oda .cubuk input[type="search"]')?.blur();
        } else {
          aramaAcik = true;
        }
      },
      aramaKapat: () => {
        if (aramaApi) aramaApi.kapat();
        else aramaAcik = false;
      },
      aramaAdim: (yon) => aramaApi?.adim(yon) ?? null,
      enAlta: asagiIn,
      olayaAtla: (olayId) => void mesajaGit(buOda, olayId, false),
      menu: (o, x, y) => menuAc(x, y, o),
      menuVar: (o) => eylemleriKur(o).length > 0 || gercekOlay(o),
      yanitla: (o) => {
        if (gercekOlay(o)) yazma.yanitla(o);
      },
      duzenle: (o) => {
        if (o.duzenlenebilir) yazma.duzenleBaslat(o);
      },
      sil: (o) => {
        if (o.silinebilir) silHedef = o;
      },
      tepki: (o, x, y) => {
        if (gercekOlay(o)) hizliTepki = { x, y, oge: o };
      },
      kopyala: (o) => {
        if (o.metin) void panoya(o.metin);
      },
      sabitle: (o) => {
        if (gercekOlay(o) && zaman.sabitleyebilir) void mesajiSabitle(o, !o.sabit);
      },
      ilet: (o) => {
        if (gercekOlay(o) && iletilebilir(o)) iletHedef = o;
      },
      profil: (o) => {
        if (o.gonderen) kullaniciKartiAc(o.gonderen, buOda, o.gonderenAd, o.gonderenAvatarMxc);
      },
    };
    klavye.oda = k;
    return () => {
      if (klavye.oda === k) klavye.oda = null;
    };
  });

  // Mirror in-room search state to the mode indicator and sync message selection while browsing matches in Normal mode.
  // Oda içi arama durumunu kip göstergesine yansıt ve Normal kipte eşleşmeleri gezerken mesaj seçimini eşle.
  $effect(() => {
    klavye.aramaAcik = aramaAcik;
    klavye.aramaSira = aramaAcik ? aramaDurum.sira : 0;
    klavye.aramaToplam = aramaAcik ? aramaDurum.toplam : 0;
    if (aramaAcik && aramaSorgu.trim()) klavye.sonArama.set(buOda, aramaSorgu.trim());
    if (aramaAcik && aktifOlay && !klavye.odakAramada) klavye.seciliId = aktifOlay;
    return () => {
      if (klavye.oda?.odaId === buOda) {
        klavye.aramaAcik = false;
        klavye.aramaSira = 0;
        klavye.aramaToplam = 0;
      }
    };
  });

  function tepkiKimleri(oge: ZamanOgesi, r: Tepki) {
    tepkiKimlerHedef = { oge, anahtar: r.anahtar };
  }

  // ---- 1:1 chats: double tick on my messages up to the one the other person has read ----
  // ---- 1:1 sohbetler: karşı kişinin okuduğu mesaja kadar benim mesajlarımda çift tik ----
  const okunanlar = $derived.by(() => {
    const k = new Set<string>();
    if (!aranabilir) return k;
    let son = -1;
    for (let i = zaman.ogeler.length - 1; i >= 0; i--) {
      if (zaman.ogeler[i].okuyanlar.length > 0) {
        son = i;
        break;
      }
    }
    for (let i = 0; i <= son; i++) if (zaman.ogeler[i].kendi) k.add(zaman.ogeler[i].id);
    return k;
  });

  // ---- Day and sender grouping · Gün ve gönderen gruplama ----
  type Satir = { tur: "oge"; oge: ZamanOgesi; ilk: boolean; son: boolean; uzak: boolean } | { tur: "yeni" };
  interface Gun { id: string; zaman: number | null; satirlar: Satir[] }

  // Row objects are reused while their message and grouping flags stay the same, so an unchanged bubble gets identical props.
  // Satır nesneleri mesajları ve gruplama bayrakları aynı kaldıkça yeniden kullanılır; değişmeyen balon aynı prop'ları alır.
  const YENI_SATIR: Satir = { tur: "yeni" };
  let oncekiSatirlar = new Map<string, Satir & { tur: "oge" }>();
  const gunler = $derived.by(() => {
    const sonuc: Gun[] = [];
    let gun: Gun = { id: "basla", zaman: null, satirlar: [] };
    sonuc.push(gun);
    let onceki: (Satir & { tur: "oge" }) | null = null;
    // Only rows well above the newest screenfuls skip painting: estimates never touch the part that sticks to the bottom.
    // Yalnızca en yeni ekranların epey üstündeki satırlar boyanmaz: tahminler dibe yapışan kısma hiç dokunmaz.
    const sinir = zaman.ogeler.length - 50;
    for (const [sira, o] of zaman.ogeler.entries()) {
      if (o.tur === "tarih_ayirici") {
        gun = { id: o.id, zaman: o.zaman, satirlar: [] };
        sonuc.push(gun);
        onceki = null;
        continue;
      }
      if (o.tur === "okunmamis_ayirici") continue;
      if (o.id === yeniKilit) {
        gun.satirlar.push(YENI_SATIR);
        onceki = null;
      }
      const s: Satir & { tur: "oge" } = { tur: "oge", oge: o, ilk: true, son: true, uzak: sira < sinir };
      const grupluMu = (x: ZamanOgesi) => x.tur !== "arama";
      if (onceki && grupluMu(o) && grupluMu(onceki.oge) && onceki.oge.gonderen === o.gonderen && o.zaman - onceki.oge.zaman < GRUP_ARALIGI) {
        onceki.son = false;
        s.ilk = false;
      }
      gun.satirlar.push(s);
      onceki = s;
    }
    const yeniSatirlar = new Map<string, Satir & { tur: "oge" }>();
    for (const g of sonuc) {
      g.satirlar = g.satirlar.map((x) => {
        if (x.tur !== "oge") return x;
        const e = oncekiSatirlar.get(x.oge.id);
        const r = e && e.oge === x.oge && e.ilk === x.ilk && e.son === x.son && e.uzak === x.uzak ? e : x;
        yeniSatirlar.set(x.oge.id, r);
        return r;
      });
    }
    oncekiSatirlar = yeniSatirlar;
    return sonuc.filter((g) => g.satirlar.length > 0);
  });

  const konumu = (s: { ilk: boolean; son: boolean }): Konum => (s.ilk && s.son ? "tek" : s.ilk ? "ilk" : s.son ? "son" : "orta");

  /** New messages from others after the last thing the user saw at the bottom · Kullanıcının altta gördüğü son şeyden sonraki başkalarının mesajları */
  const yeniSayi = $derived.by(() => {
    if (altaGorunur) return 0;
    let i = sonGorulenId ? zaman.ogeler.findIndex((o) => o.id === sonGorulenId) : -1;
    // Not seen the bottom yet (opened at the first unread), or that id was replaced: count from the "new messages" line, never from the start.
    // Dibi hiç görmedi (ilk okunmamışta açıldı) ya da o kimlik değişti: "yeni mesajlar" çizgisinden say, asla en baştan değil.
    if (i < 0) {
      const k = yeniKilit ? zaman.ogeler.findIndex((o) => o.id === yeniKilit) : -1;
      if (k < 0) return 0;
      i = k - 1;
    }
    return zaman.ogeler.slice(i + 1).filter((o) => gercekMi(o) && !o.kendi).length;
  });

  // Sender names only matter in rooms with more than two people. · Gönderen adları yalnızca ikiden çok kişilik odalarda anlamlıdır.
  const grupOdasi = $derived(!!bilgi && bilgi.uyeSayisi > 2);

  // Calls only in rooms with exactly two joined members. · Arama yalnızca tam iki üyeli odalarda.
  const aranabilir = $derived(!!bilgi && bilgi.uyeSayisi === 2 && !!bilgi.karsiKullanici);

  // Face stack for the header People button: DM = other person; group = last 3 speakers (enriched/topped up from cached member list when loaded).
  // Başlıktaki Kişiler düğmesi yüz yığını: DM = karşıdaki; grup = son 3 konuşan (üye listesi yüklüyse ondan zenginleştirilir / tamamlanır).
  interface Yuz {
    id: string;
    harf: string;
    mxc: string | null;
  }
  const katilmisUyeler = $derived(uyeler.al(buOda).liste.filter((u) => u.uyelik === "join"));
  const yuzYigini = $derived.by((): Yuz[] => {
    if (!bilgi) return [];
    if (aranabilir && bilgi.karsiKullanici) {
      return [{ id: bilgi.karsiKullanici, harf: bilgi.avatarHarf, mxc: bilgi.avatarMxc }];
    }
    const uyeHarita = new Map(katilmisUyeler.map((u) => [u.kullaniciId, u]));
    const sonuc: Yuz[] = [];
    const goruldu = new Set<string>();
    for (let i = zaman.ogeler.length - 1; i >= 0 && sonuc.length < 3; i--) {
      const o = zaman.ogeler[i];
      if (!o.gonderen || goruldu.has(o.gonderen)) continue;
      if (!gercekMi(o) && o.tur !== "arama") continue;
      goruldu.add(o.gonderen);
      const u = uyeHarita.get(o.gonderen);
      const ad = u?.ad ?? o.gonderenAd;
      sonuc.push({
        id: o.gonderen,
        harf: ad.charAt(0).toUpperCase() || "#",
        mxc: u?.avatarMxc ?? o.gonderenAvatarMxc,
      });
    }
    if (sonuc.length < 3 && katilmisUyeler.length > 0) {
      for (const u of katilmisUyeler) {
        if (sonuc.length >= 3) break;
        if (goruldu.has(u.kullaniciId)) continue;
        goruldu.add(u.kullaniciId);
        sonuc.push({ id: u.kullaniciId, harf: u.ad.charAt(0).toUpperCase() || "#", mxc: u.avatarMxc });
      }
    }
    return sonuc;
  });

  /** Known online member count for group rooms (0 when presence is off or not yet loaded). · Grup odalarında bilinen çevrimiçi üye sayısı (varlık kapalı ya da yüklenmediyse 0). */
  const cevrimiciSayi = $derived.by(() => {
    if (!bilgi || aranabilir) return 0;
    const idler = katilmisUyeler.length > 0 ? katilmisUyeler.map((u) => u.kullaniciId) : yuzYigini.map((y) => y.id);
    return varlik.cevrimiciSayisi(idler);
  });

  /** Unread total across all other chats (excluding this open room), shown on the phone back button. · Açık oda dışındaki diğer sohbetlerdeki okunmamış toplamı (telefonda geri düğmesinde). */
  const digerOkunmamis = $derived(
    odalar.liste.reduce((n, o) => (o.id === buOda || o.davet || o.alan ? n : n + Math.max(o.okunmamis, o.bahsedilme)), 0),
  );

  /** Pulses the badge (or icon) once when a flying top banner lands on this button. · Uçan üst şerit bu düğmeye inince rozeti (ya da simgeyi) bir kez nabızlandırır. */
  function zilNabiz(node: HTMLElement) {
    const inis = () => {
      if (!hareketVar()) return;
      const hedef = node.querySelector<HTMLElement>(".geri-rozet") ?? node.querySelector<HTMLElement>("svg") ?? node;
      const sure = sureMs("--sure-orta") || 200;
      hedef.style.willChange = "transform";
      const temizle = () => {
        if (hedef.style.willChange === "transform") hedef.style.removeProperty("will-change");
      };
      const a = hedef.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.25)", offset: 0.45 },
          { transform: "scale(1)" },
        ],
        { duration: sure, easing: egri("--egri-cikis") },
      );
      a.onfinish = temizle;
      a.oncancel = temizle;
    };
    node.addEventListener("zil-inis", inis);
    return {
      destroy() {
        node.removeEventListener("zil-inis", inis);
      },
    };
  }
</script>

<div class="oda" class:itildi={bilgiAcik || uyelerAcik} style="{gorunumStili(gorunum)};--tepe-yer:{tepeYuk}px;--yazma-yer:{aramaAcik ? 0 : altYuk}px">
<svelte:boundary onerror={(e) => console.error("oda çizimi başarısız", e)}>
  <div class="oda-govde">
  <!-- Floating header: wide screens = single two-storey polished card (C); phone = three separated capsules over messages (B). -->
  {#snippet katilDugmesi(n: number, boyut: number, sayi = true)}
    <!-- 44px tap area, 36px green pill inside. · 44px dokunma alanı, içinde 36px yeşil hap. -->
    <button class="katil-dugme" aria-label={t("arama.ec.suruyor", { n })} title={t("arama.ec.suruyor", { n })} onclick={aramayaKatil}>
      <span class="katil-hap"><Ikon ad="telefon" {boyut} /><span class="katil-metin">{t("arama.ec.katil")}</span>{#if sayi}<span class="katil-sayi">{n}</span>{/if}</span>
    </button>
  {/snippet}
  <!-- Yüzen başlık: geniş ekran = tek iki katlı cilalı kart (C); telefon = mesajların üstünde üç ayrık kapsül (B). -->
  <div class="tepe" class:telefon={!gezinme.genis} data-oda-tepe bind:clientHeight={tepeYuk}>
    {#if gezinme.genis}
      <div class="kart">
        <header class="ust">
          {#if duzen.listeGizli}
            <button class="simge-dugme geri" data-zil-hedef="yanPanel" use:zilNabiz aria-label={t("klavye.listeAc")} title="{t("klavye.listeAc")} (Ctrl+B)" onclick={() => duzen.degistir()}><Ikon ad="yanPanel" /></button>
          {/if}
          <!-- Tap = room info, long press = customize sheet (both tactile) · Dokun = oda bilgisi, uzun bas = özelleştir sayfası (ikisi de dokunsal) -->
          {#if bilgi}
            <button class="kimlik" aria-label={t("oda.bilgiAc")} onclick={() => (bilgiAcik = true)} use:uzunBasma={{ ac: () => (ozellestirAcik = true) }}>
              <Avatar harf={bilgi.avatarHarf} mxc={bilgi.avatarMxc} boyut={40} anahtar={bilgi.id} />
              <span class="adlar">
                <span class="ad-satir"><span class="ad">{bilgi.ad}</span>{#if bilgi.sifreli}<span class="kilit" role="img" aria-label={t("oda.sifreli")}><Ikon ad="kilit" boyut={14} /></span>{/if}</span>
                {@render altSatir()}
              </span>
            </button>
          {:else}
            <!-- The header keeps its shape while the room opens. · Oda açılırken başlık biçimini korur. -->
            <div class="kimlik bekle" aria-hidden="true"><span class="b-yuz parilti"></span><span class="b-ad parilti"></span></div>
          {/if}
          <OdaAramasi {odaId} />
          {#if bilgi}
            <button
              class="kisiler-dugme"
              class:tonlu={duzen.kisilerAcik}
              aria-label={duzen.kisilerAcik ? t("baslik.kisilerKapat") : t("baslik.kisilerAc")}
              aria-pressed={duzen.kisilerAcik}
              title="{t("baslik.kisiler")} (Ctrl+Shift+L)"
              onclick={() => duzen.kisilerDegistir()}
            >
              {@render yuzler(24)}
              {#if !aranabilir}<span class="kisiler-sayi">{bilgi.uyeSayisi}</span>{/if}
            </button>
            <span class="ayrac" aria-hidden="true"></span>
          {/if}
          <button class="simge-dugme" class:tonlu={aramaAcik} aria-label={t("mesajAra.odadaAra")} aria-pressed={aramaAcik} use:hizliGecis onclick={() => (aramaAcik = true)}><Ikon ad="ara" /></button>
          {#if katilinabilir && surenArama}
            {@render katilDugmesi(surenArama.katilimcilar.length, 18)}
          {:else if aranabilir && bilgi}
            <button
              class="simge-dugme"
              aria-label={t("oda.ara")}
              onclick={() => bilgi && arama.ara({ id: bilgi.id, ad: bilgi.ad, avatarHarf: bilgi.avatarHarf, avatarMxc: bilgi.avatarMxc })}
            >
              <Ikon ad="telefon" />
            </button>
          {/if}
          {#if bilgi}
            <button class="simge-dugme" aria-label={t("baslik.bilgi")} onclick={() => (bilgiAcik = true)}><Ikon ad="bilgi" /></button>
          {/if}
        </header>
        <SabitCubugu {odaId} idler={zaman.sabitler} />
        <EsitlemeSeridi />
      </div>
    {:else}
      <header class="kapsuller">
        <!-- Landscape phone keeps the list beside the room, so no back button. · Yatay telefonda liste odanın yanında durur; geri düğmesi gerekmez. -->
        {#if !gezinme.yatay}
        <button
          class="simge-dugme geri kapsul"
          data-zil-hedef="geri"
          use:zilNabiz
          aria-label={digerOkunmamis > 0 ? t("oda.digerOkunmamis", { n: digerOkunmamis }) : t("oda.geri")}
          onclick={() => gezinme.odaKapat()}
        >
          <Ikon ad="geri" />
          {#if digerOkunmamis > 0}
            <span class="rozet geri-rozet" aria-hidden="true">{digerOkunmamis > 99 ? "99+" : digerOkunmamis}</span>
          {/if}
        </button>
        {/if}

        {#if bilgi}
          <button class="kapsul kapsul-kimlik" aria-label={t("oda.bilgiAc")} onclick={() => (bilgiAcik = true)} use:uzunBasma={{ ac: () => (ozellestirAcik = true) }}>
            <Avatar harf={bilgi.avatarHarf} mxc={bilgi.avatarMxc} boyut={32} anahtar={bilgi.id} />
            <span class="adlar">
              <span class="ad-satir"><span class="ad">{bilgi.ad}</span>{#if bilgi.sifreli}<span class="kilit" role="img" aria-label={t("oda.sifreli")}><Ikon ad="kilit" boyut={13} /></span>{/if}</span>
              {@render altSatir()}
            </span>
          </button>
        {:else}
          <div class="kapsul kapsul-kimlik bekle" aria-hidden="true"><span class="b-yuz kucuk parilti"></span><span class="b-ad parilti"></span></div>
        {/if}

        <div class="kapsul kapsul-eylem">
          <!-- While "Katıl" is shown the face stack steps aside, otherwise the room name has no room left on a phone; people are still one tap away in the room capsule.
               "Katıl" görünürken yüz yığını çekilir, yoksa telefonda oda adına yer kalmaz; kişiler oda kapsülünden yine bir dokunuş uzakta. -->
          {#if bilgi && !katilinabilir}
            <button
              class="kisiler-dugme kompakt"
              aria-label={t("baslik.kisiler")}
              onclick={() => (uyelerAcik = true)}
            >
              {@render yuzler(aranabilir ? 24 : 22)}
              {#if !aranabilir}<span class="kisiler-sayi">{bilgi.uyeSayisi}</span>{/if}
            </button>
          {/if}
          <button class="simge-dugme" class:tonlu={aramaAcik} aria-label={t("mesajAra.odadaAra")} aria-pressed={aramaAcik} use:hizliGecis onclick={() => (aramaAcik = true)}><Ikon ad="ara" boyut={20} /></button>
          {#if katilinabilir && surenArama}
            {@render katilDugmesi(surenArama.katilimcilar.length, 18, false)}
          {:else if aranabilir && bilgi}
            <button
              class="simge-dugme"
              aria-label={t("oda.ara")}
              onclick={() => bilgi && arama.ara({ id: bilgi.id, ad: bilgi.ad, avatarHarf: bilgi.avatarHarf, avatarMxc: bilgi.avatarMxc })}
            >
              <Ikon ad="telefon" boyut={20} />
            </button>
          {/if}
        </div>
        <OdaAramasi {odaId} />
      </header>
      {#if zaman.sabitler.length > 0}
        <div class="telefon-sabit"><SabitCubugu {odaId} idler={zaman.sabitler} /></div>
      {/if}
      <div class="telefon-esitle"><EsitlemeSeridi /></div>
    {/if}
  </div>

  <SohbetZemini resim={gorunum.resim} resimAnahtari={odaId} karart={gorunum.karart} />
  <div class="zaman-sarmal">
    <!-- Over the list, not in it: a line inside the scrolled content would push the messages every time a page starts and ends.
         Listenin içinde değil üstünde: kayan içerikteki bir satır her sayfa başlayıp bittiğinde mesajları iterdi. -->
    {#if zaman.eskiYukleniyor}<p class="eski-yukleniyor" role="status">{t("oda.eskiYukleniyor")}</p>{/if}
    <div class="zaman" bind:this={kutu} onscroll={kaydir}>
      <div class="sutun">
        {#if zaman.hata}
          <!-- A room that cannot be opened as a chat (a space) says so; everything else is a normal load error. · Sohbet olarak açılamayan oda (alan) bunu söyler; gerisi normal yükleme hatası. -->
          <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={zaman.hata.tur === "oda_turu" ? t("hata.oda_turu") : t("oda.acilamadiAlt")} eylem={zaman.hata.tur === "oda_turu" ? undefined : t("oda.yeniden")} onEylem={yenidenAc} />
        {:else if zamanAsimi}
          <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={t("oda.zamanAsimi")} eylem={t("oda.yeniden")} onEylem={yenidenAc} />
        {:else}
          {#if zaman.basaUlasildi && zaman.ogeler.length > 0 && bilgi}
            <!-- Start of the conversation (design section 13) · Konuşmanın başı (tasarım bölüm 13) -->
            <div class="basi">
              <span class="basi-kutu"><Ikon ad="kilit" boyut={24} /></span>
              <strong>{t("oda.basinaGeldin")}</strong>
              {#if bilgi.sifreli}<span>{bilgi.karsiKullanici && bilgi.uyeSayisi === 2 ? t("oda.basiSifreliDm", { ad: bilgi.ad }) : t("oda.basiSifreliGrup")}</span>{/if}
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
              {#each gun.satirlar as s (s.tur === "oge" ? s.oge.id : "__yeni__")}
                {#if s.tur === "yeni"}
                  <div class="yeni" data-yeni><span>{t("oda.yeniMesajlar")}</span></div>
                {:else}
                  <MesajBalonu oge={s.oge} konum={konumu(s)} uzak={s.uzak} gonderenGoster={grupOdasi} yeni={!!yeniGelenler[s.oge.id]} vurgulu={menu?.oge.id === s.oge.id || hizliTepki?.oge.id === s.oge.id} secili={!!s.oge.olayId && klavye.seciliId === s.oge.olayId} eslesme={aramaAcik && !!aktifOlay && s.oge.olayId === aktifOlay} vurguSorgu={aramaAcik && s.oge.olayId && aramaVurgu.idler.has(s.oge.olayId) ? aramaVurgu.sorgu : ""} dm={aranabilir} okundu={okunanlar.has(s.oge.id)} yanitla={(o) => yazma.yanitla(o)} {tepkiKimleri} okuyanlarAc={(o) => (okuyanHedef = o)} {yenidenDene} vazgec={(o) => void vazgec(o)} {menuAc} />
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
  </div>

  {#if aramaAcik}
    <OdaIciArama
      {odaId}
      onkapat={() => { aramaAcik = false; aramaVim = false; }}
      bind:aktifOlay
      bind:sorgu={aramaSorgu}
      vimKipi={aramaVim}
      adimBagla={(a) => (aramaApi = a)}
      durumDegis={(d) => (aramaDurum = d)}
      vurguDegis={(v) => (aramaVurgu = v)}
    />
  {:else}
    <YazmaAlani {odaId} sifreli={bilgi?.sifreli ?? false} {gonder} altta={altaGorunur} {yeniSayi} enAlta={asagiIn} {seciliOge} bind:yukseklik={altYuk} />
  {/if}
  </div>

  {#if gezinme.genis && duzen.kisilerAcik}
    <KisilerPaneli {odaId} {bilgi} dm={aranabilir} kaplama={duzen.kisilerKaplama} onkapat={() => duzen.kisilerKapat()} />
  {/if}

  {#if bilgiAcik}
    <OdaBilgisi {odaId} onkapat={() => (bilgiAcik = false)} uyelerAc={() => (uyelerAcik = true)} gorunumAc={() => (ozellestirAcik = true)} ara={() => { bilgiAcik = false; aramaAcik = true; }} />
  {/if}
  {#if uyelerAcik}<Uyeler {odaId} onkapat={() => (uyelerAcik = false)} />{/if}

  {#snippet failed(_hata, sifirla)}
    <!-- Last line of defence: a render error ends here, with a way back, instead of a black screen. · Son savunma hattı: çizim hatası siyah ekran yerine burada, geri dönüş yoluyla biter. -->
    <div class="oda-govde">
      <div class="tepe"><header class="ust">
        {#if !gezinme.genis}<button class="simge-dugme geri" aria-label={t("oda.geri")} onclick={() => gezinme.odaKapat()}><Ikon ad="geri" /></button>{/if}
      </header></div>
      <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={t("oda.cizimHatasi")} eylem={t("oda.yeniden")} onEylem={sifirla} />
    </div>
  {/snippet}
</svelte:boundary>
</div>

{#snippet altSatir()}
  {#if zaman.yazanlar.length > 0}
    <!-- Someone is typing: the subtitle turns accent coloured · Biri yazıyor: alt başlık vurgu rengine döner -->
    <span class="alt yaziyor" role="status" aria-live="polite">{zaman.yazanlar.length === 1 ? t("yaziyor.bir", { ad: zaman.yazanlar[0].ad }) : zaman.yazanlar.length === 2 ? t("yaziyor.iki", { a: zaman.yazanlar[0].ad, b: zaman.yazanlar[1].ad }) : t("yaziyor.cok", { n: zaman.yazanlar.length })}</span>
  {:else if bilgi && aranabilir && bilgi.karsiKullanici}
    <span class="alt"><VarlikRozeti kullaniciId={bilgi.karsiKullanici} /></span>
  {:else if bilgi}
    <span class="alt">
      <span class="uye">{t("oda.uyeler", { n: bilgi.uyeSayisi })}</span>
      {#if cevrimiciSayi > 0}
        <span class="alt-ayrac" aria-hidden="true">·</span>
        <span class="cevrimici"><i class="cevrimici-nokta" aria-hidden="true"></i>{t("baslik.cevrimici", { n: cevrimiciSayi })}</span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet yuzler(boyut: number)}
  {#if yuzYigini.length > 0}
    <span class="yuz-yigini" aria-hidden="true">
      {#each yuzYigini as y (y.id)}
        <span class="yuz-oge"><Avatar harf={y.harf} mxc={y.mxc} {boyut} yaricap={Math.round(boyut * 0.28)} anahtar={y.id} /></span>
      {/each}
    </span>
  {:else}
    <Ikon ad="kisi" boyut={18} />
  {/if}
{/snippet}

{#if ozellestirAcik}<OzellestirSayfasi {odaId} onkapat={() => (ozellestirAcik = false)} />{/if}

{#snippet tepkiUst(kapat: () => void)}
  {#if menu}
    {@const hedef = menu.oge}
    <TepkiCubugu
      benim={menuTepkiler}
      sec={(e) => { void tepkiVer(hedef, e); kapat(); }}
      dahaFazla={() => { kapat(); tepkiSecici = hedef; }}
    />
  {/if}
{/snippet}
{#if menu && (menuEylemleri.length > 0 || gercekOlay(menu.oge))}
  <BaglamMenusu x={menu.x} y={menu.y} eylemler={menuEylemleri} ust={gercekOlay(menu.oge) ? tepkiUst : undefined} onizleme={{ ad: menu.oge.kendi ? t("menu.sen") : menu.oge.gonderenAd, zaman: saatYaz(menu.oge.zaman), metin: ozet(menu.oge) }} onkapat={() => (menu = null)} />
{/if}
{#if hizliTepki}
  {@const hedef = hizliTepki.oge}
  <TepkiMenusu
    x={hizliTepki.x}
    y={hizliTepki.y}
    benim={hizliTepkiTepkiler}
    sec={(e) => void tepkiVer(hedef, e)}
    dahaFazla={() => (tepkiSecici = hedef)}
    onkapat={() => (hizliTepki = null)}
  />
{/if}

{#if tepkiSecici}
  {@const hedef = tepkiSecici}
  <EmojiSayfasi ekle={(e) => { void tepkiVer(hedef, e); tepkiSecici = null; }} onkapat={() => (tepkiSecici = null)} />
{/if}
{#if tepkiKimlerHedef}
  <TepkiKimler tepkiler={tepkiKimlerHedef.oge.tepkiler} {odaId} baslangic={tepkiKimlerHedef.anahtar} onkapat={() => (tepkiKimlerHedef = null)} />
{/if}
{#if okuyanHedef}<OkuyanListesi kisiler={okuyanHedef.okuyanlar} {odaId} onkapat={() => (okuyanHedef = null)} />{/if}
{#if silHedef}
  {@const hedef = silHedef}
  <SilOnay baskasininki={!hedef.kendi} onay={() => void mesajiSil(hedef)} onkapat={() => (silHedef = null)} />
{/if}
{#if basarisizHedef}
  {@const b = basarisizHedef}
  <GonderilemediSayfasi oge={b} yeniden={() => void yenidenDene(b.id)} sil={() => void vazgec(b)} onkapat={() => (basarisizHedef = null)} />
{/if}
{#if iletHedef}<IletSayfasi oge={iletHedef} {odaId} onkapat={() => (iletHedef = null)} />{/if}

<style>
  /* The room moves aside under its info page (same parallax as list → room). · Oda, bilgi sayfasının altında kenara çekilir (liste → oda ile aynı paralaks). */
  .oda > :global(*:not(.ekran)) { transition: transform var(--sure-ekran) var(--egri-ac); }
  .oda.itildi > :global(*:not(.ekran)) { transform: translate3d(-25%, 0, 0); }
  .oda { position: relative; overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: row; min-width: 0; height: 100%; background: var(--sohbet-zemin, var(--zemin)); }
  .oda-govde { position: relative; overflow: hidden; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; height: 100%; }
  .tepe { position: absolute; z-index: 3; top: 0; left: 0; right: 0; padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left)); pointer-events: none; }
  /* Desktop / tablet C polished card: surface-1, hairline border, 20px radius, no shadow, no top gradient. */
  /* Masaüstü / tablet C cilalı kart: yüzey-1, ince kenar, 20px köşe, gölge yok, üst gradyan yok. */
  .kart { pointer-events: auto; overflow: hidden; border-radius: 20px; background: var(--yuzey-1); border: 1px solid var(--kenar-ince); }
  .kart :global(.cubuk) { width: 100%; }
  .kart :global(.serit) { border-bottom: 0; border-top: 1px solid var(--kenar-ince); }
  .ust { min-height: 60px; display: flex; align-items: center; gap: 4px; padding: 6px 8px; }
  .geri { position: relative; }
  .geri-rozet { position: absolute; top: 2px; right: 0; min-width: 1.125rem; height: 1.125rem; padding: 0 .25rem; border-radius: .5625rem; font-size: .6875rem; border: 2px solid var(--yuzey-2); box-sizing: content-box; pointer-events: none; }
  .kimlik { flex: 1; min-width: 0; min-height: 44px; padding: 4px 10px 4px 6px; display: flex; align-items: center; gap: .625rem; text-align: left; border-radius: 14px; transition: background-color var(--sure-hizli) var(--egri-cikis); }
  @media (hover: hover) {
    .kimlik:hover { background: var(--yuzey-2); }
  }
  .kimlik:active { background: var(--yuzey-3); }
  .adlar { flex: 1; min-width: 0; display: grid; }
  .ad-satir { display: flex; align-items: center; gap: 5px; min-width: 0; }
  .kilit { flex: none; display: inline-flex; color: var(--cozum); }
  .b-yuz { width: 40px; height: 40px; border-radius: 10px; flex: none; }
  .b-yuz.kucuk { width: 32px; height: 32px; border-radius: 8px; }
  .b-ad { width: 96px; max-width: 45%; height: 14px; border-radius: 7px; }
  .ad { font-weight: 600; font-size: .9375rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alt.yaziyor { color: var(--vurgu); font-weight: 500; overflow: hidden; text-overflow: ellipsis; display: block; }
  .alt { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: .75rem; line-height: 1.25; color: var(--yazi-2); white-space: nowrap; overflow: hidden; }
  .uye { overflow: hidden; text-overflow: ellipsis; }
  .alt-ayrac { flex: none; opacity: .7; }
  .cevrimici { flex: none; display: inline-flex; align-items: center; gap: 4px; color: var(--cozum); font-weight: 500; }
  .cevrimici-nokta { width: 6px; height: 6px; border-radius: 50%; background: var(--cozum); flex: none; }

  /* Header People button (face stack + count) and thin divider · Başlıktaki Kişiler düğmesi (yüz yığını + sayı) ve ince ayraç */
  .kisiler-dugme {
    flex: none;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--yazi);
    --yuz-kenar: var(--yuzey-1);
    transition: background-color var(--sure-hizli) var(--egri-cikis), color var(--sure-hizli) var(--egri-cikis);
  }
  @media (hover: hover) {
    .kisiler-dugme:not(.tonlu):hover { background: var(--yuzey-2); --yuz-kenar: var(--yuzey-2); }
  }
  .kisiler-dugme:not(.tonlu):active { background: var(--yuzey-3); --yuz-kenar: var(--yuzey-3); }
  .kisiler-dugme.tonlu { background: var(--ton); color: var(--ton-ustu); --yuz-kenar: var(--ton); }
  .kisiler-dugme.kompakt { padding: 0 6px 0 8px; border-radius: 22px; gap: 4px; --yuz-kenar: var(--yuzey-2); }
  .yuz-yigini { display: inline-flex; align-items: center; }
  .yuz-oge { display: inline-flex; border-radius: 8px; border: 2px solid var(--yuz-kenar); }
  .yuz-oge + .yuz-oge { margin-left: -7px; }
  .kisiler-sayi { font-size: .8125rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ayrac { flex: none; width: 1px; height: 20px; background: var(--kenar-ince); margin: 0 2px; }

  /* Phone B separated capsules over messages (no background gradient) · Telefon B mesajların üstünde üç ayrık kapsül (zemin geçişi yok) */
  .katil-dugme { flex: none; min-height: 44px; padding: 0 4px; display: inline-flex; align-items: center; }
  .katil-hap {
    display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px 0 10px; border-radius: 18px;
    background: var(--cozum); color: var(--zemin); font-weight: 600; font-size: .875rem; white-space: nowrap;
  }
  .katil-sayi { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: .75rem; background: color-mix(in srgb, var(--zemin) 18%, transparent); }
  .katil-dugme:active .katil-hap { opacity: .85; }
  /* Narrow phones: icon only, so the room name keeps its place (the label stays for screen readers). · Dar telefon: yalnız simge, oda adı yerini korur (etiket ekran okuyucuda kalır). */
  @media (max-width: 360px) { .kapsuller .katil-metin { display: none; } .kapsuller .katil-hap { padding: 0 10px; } }
  .katil-dugme:focus-visible { outline: none; }
  .katil-dugme:focus-visible .katil-hap { outline: 2px solid var(--vurgu); outline-offset: 2px; }
  .kapsuller { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; pointer-events: none; }
  .kapsul {
    pointer-events: auto;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    border-radius: 24px;
    height: 46px;
    min-height: 46px;
  }
  .kapsul.geri { width: 46px; min-width: 46px; }
  /* With an unread count the back capsule widens and shows the count beside the arrow instead of on top of it.
     Okunmamış sayısı varken geri kapsülü genişler; sayı okun üstüne binmez, yanında durur. */
  .kapsul.geri:has(.geri-rozet) { width: auto; padding: 0 12px 0 8px; gap: 2px; }
  .kapsul.geri .geri-rozet { position: static; border: 0; box-sizing: border-box; }
  .kapsul-kimlik {
    flex: 0 1 auto;
    min-width: 0;
    margin-right: auto;
    padding: 0 12px 0 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    max-width: 100%;
  }
  .kapsul-kimlik:active { background: var(--yuzey-3); }
  .kapsul-eylem { flex: none; display: inline-flex; align-items: center; padding: 0 2px; }
  .telefon-sabit {
    pointer-events: auto;
    margin-top: 6px;
    border-radius: 18px;
    background: var(--yuzey-2);
    border: 1px solid var(--kenar-ince);
    overflow: hidden;
  }
  .telefon-sabit :global(.cubuk) { border-top: 0; }
  .telefon-esitle { pointer-events: auto; margin-top: 6px; }
  .telefon-esitle:empty { margin-top: 0; }
  .telefon-esitle :global(.serit) { border-radius: 16px; border: 1px solid var(--kenar-ince); }
  .zaman-sarmal { contain: layout style; position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  /* Desktop chat zoom (--sohbet-olcek) applies here via font-size so every em inside the timeline scales without zoom/transform. */
  /* Masaüstü sohbet ölçeği (--sohbet-olcek) burada font-size ile uygulanır; çizelgedeki tüm em değerleri zoom/transform olmadan ölçeklenir. */
  .zaman { touch-action: pan-y; position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; font-size: calc(1rem * var(--sohbet-olcek, 1)); padding: calc(var(--tepe-yer) + 4px) var(--sohbet-yatay-dolgu, .75rem) calc(var(--yazma-yer) + 4px); scroll-padding-top: calc(var(--tepe-yer) + 8px); scroll-padding-bottom: calc(var(--yazma-yer) + 8px); overscroll-behavior: contain; }
  :global([data-yogunluk="kompakt"]) .ust { min-height: 54px; padding: 5px 6px; }
  /* Landscape phone (height <= 500px): header 48px, message column at most 680px and centred (design section 15). */
  /* Yatay telefon (yükseklik <= 500px): başlık 48px, mesaj sütunu en fazla 680px ve ortalı (tasarım bölüm 15). */
  .sutun { width: 100%; }
  @media (max-height: 500px) {
    .tepe { padding-top: 4px; }
    .ust { min-height: 48px; padding: 1px 5px; }
    .sutun { max-width: 680px; margin: 0 auto; }
  }
  .eski-yukleniyor {
    position: absolute; z-index: 3; top: calc(var(--tepe-yer) + 8px); left: 50%; translate: -50% 0; pointer-events: none;
    padding: 6px 14px; border-radius: 16px; background: var(--yuzey-2); box-shadow: var(--kat-1);
    font-size: .75rem; font-weight: 500; color: var(--yazi-2); white-space: nowrap;
    /* Appears only when a page takes a moment (no flash on a quick one) · Yalnızca sayfa biraz sürerse görünür (hızlısında yanıp sönmez) */
    animation: eski-belir var(--sure-hizli) var(--egri-cikis) 300ms both;
  }
  @keyframes eski-belir { from { opacity: 0; } }
  .orta { text-align: center; font-size: .8125em; color: var(--yazi-2); padding: .75em; }
  .basi { display: grid; justify-items: center; gap: .375em; padding: 1.5em 1.5em .5em; text-align: center; font-size: .875em; color: var(--yazi-2); }
  .basi strong { font-family: var(--baslik-tipi); font-size: 1.2em; color: var(--yazi); }
  .basi-kutu { width: 3em; height: 3em; border-radius: .75em; display: inline-flex; align-items: center; justify-content: center; background: var(--ton); color: var(--ton-ustu); margin-bottom: .25em; }

  /* Sticky date chip: sticks to the top while its day scrolls by, bounded by its own <section>. */
  /* Yapışkan tarih hapı: günü kayarken üstte kalır, kendi <section>'ıyla sınırlıdır. */
  .tarih { position: sticky; top: calc(var(--tepe-yer) - 4px); z-index: 2; display: flex; justify-content: center; padding: .5em 0 .25em; pointer-events: none; }
  :global([data-yogunluk="kompakt"]) .tarih { padding: .25em 0 .125em; }
  .tarih span { background: var(--yuzey-2); color: var(--yazi); font-size: .75em; font-weight: 600; padding: .25em .75em; border-radius: .75em; }

  .yeni { display: flex; align-items: center; gap: .75em; margin: .875em 0 .375em; color: var(--vurgu); font-size: .75em; font-weight: 600; }
  .yeni::before, .yeni::after { content: ""; flex: 1; height: 1px; background: var(--vurgu); opacity: .5; }

  .iskelet { display: flex; margin-top: 10px; }
  .iskelet.sag { justify-content: flex-end; }
  .iskelet span { height: 40px; border-radius: 16px; }
</style>
