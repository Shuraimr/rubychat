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
  import { hareketVar } from "../hareket";
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
  import SilOnay from "../bilesenler/SilOnay.svelte";
  import TepkiCubugu from "../bilesenler/TepkiCubugu.svelte";
  import TepkiKimler from "../bilesenler/TepkiKimler.svelte";
  import VarlikRozeti from "../bilesenler/VarlikRozeti.svelte";
  import { sil as mesajiSil, sabitle as mesajiSabitle, tepkiVer } from "../mesaj/eylemler";
  import { yazma } from "../durum/yazma.svelte";
  import type { Tepki } from "../api/tipler";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { duzen } from "../durum/duzen.svelte";
  import { klavye, type OdaKlavye } from "../klavyeKisayol.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t, type Anahtar } from "../i18n";
  import { gunEtiketi } from "../zaman-bicim";
  import SohbetZemini from "../bilesenler/SohbetZemini.svelte";

  let { odaId }: { odaId: string } = $props();

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
    zaman.kapat();
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
        // A list from memory is only a preview: the real one decides where to open. · Bellekten gelen liste yalnızca ön izlemedir: nerede açılacağına gerçeği karar verir.
        ilkKaydirmaYapildi = !zaman.onbellekten;
        const yeni = yeniKilit ? kutu.querySelector<HTMLElement>(`[data-yeni]`) : null;
        if (yeni) {
          // Open at the first unread message. · İlk okunmamış mesajda aç.
          altaYapisik = false;
          kutu.scrollTop += yeni.getBoundingClientRect().top - kutu.getBoundingClientRect().top - tepeYuk - 40;
          // A short room may already show everything: no scroll event will come, so measure. · Kısa oda zaten her şeyi gösteriyor olabilir: kaydırma olayı gelmez, ölç.
          altaYapisik = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < 80;
          if (altaYapisik) okunduPlanla();
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
      if (!kutu) return;
      kutuBoyu = kutu.clientHeight - altYuk;
      if (altaYapisik) kutu.scrollTop = kutu.scrollHeight;
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
    const alttaydi = altaYapisik;
    // The box itself changed size (keyboard, emoji panel): this is not the user scrolling away, stay glued. · Kutunun boyu değişti (klavye, emoji paneli): kullanıcı kaydırmadı, yapışık kal.
    if (kutu.clientHeight - altYuk !== kutuBoyu) {
      kutuBoyu = kutu.clientHeight - altYuk;
      if (altaYapisik) {
        kutu.scrollTop = kutu.scrollHeight;
        return;
      }
    }
    // Two thresholds, so the button does not flicker at the edge. · İki eşik; düğme sınırda titremesin.
    altaYapisik = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < (alttaydi ? 160 : 60);
    altaGorunur = altaYapisik;
    if (altaYapisik) {
      sonGorulenId = zaman.ogeler.at(-1)?.id ?? null;
      if (!alttaydi) okunduPlanla();
    }
    // The next page is asked for well before the end is reached. · Sonraki sayfa sona varmadan çok önce istenir.
    if (kutu.scrollTop < Math.max(400, kutu.clientHeight * 1.5)) {
      oncekiYukseklik = kutu.scrollHeight;
      zaman.eskileriYukle();
    }
  }

  function asagiIn() {
    if (!kutu) return;
    // Far away: jump near the end first, so the smooth part is always short. · Uzaktaysa önce sona yakın atla; yumuşak kısım hep kısa olsun.
    const uzak = kutu.scrollHeight - kutu.clientHeight * 2.5;
    if (kutu.scrollTop < uzak) kutu.scrollTop = uzak;
    const hareket = hareketVar();
    kutu.scrollTo({ top: kutu.scrollHeight, behavior: hareket ? "smooth" : "instant" });
  }

  async function gonder(metin: string, html: string | null, yanitOlayId: string | null) {
    altaYapisik = true;
    kendiGonderildi = true;
    try {
      await zaman.gonder(metin, html, yanitOlayId);
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

  /** A real, delivered event (not a deleted / undecryptable message or a system line): reactions, replies, pins and forwards need an event id. · Gerçek, ulaşmış olay (silinmiş / çözülemeyen mesaj ya da sistem satırı değil): tepki, yanıt, sabitleme ve iletme olay kimliği ister. */
  const gercekOlay = (o: ZamanOgesi) => !!o.olayId && o.durum === "gonderildi" && !["silindi", "sifre_cozulemedi", "arama"].includes(o.tur);
  const iletilebilir = (o: ZamanOgesi) => ["metin", "resim", "video", "dosya"].includes(o.tur);

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
    if (oge.silinebilir) liste.push({ ikon: "cop", etiket: t("menu.sil"), tehlike: true, calistir: () => (silHedef = oge) });
    return liste;
  }
  const menuEylemleri = $derived(menu ? eylemleriKur(menu.oge) : []);
  const menuTepkiler = $derived(new Set(menu?.oge.tepkiler.filter((r) => r.benim).map((r) => r.anahtar) ?? []));

  function menuAc(x: number, y: number, oge: ZamanOgesi) {
    if (eylemleriKur(oge).length === 0 && !gercekOlay(oge)) return;
    menu = { x, y, oge };
  }

  // Keyboard shortcuts act on the open room through this. · Klavye kısayolları açık odada bununla iş görür.
  $effect(() => {
    const bul = (id: string) => zaman.ogeler.find((o) => o.olayId === id);
    const k: OdaKlavye = {
      kutu: () => kutu,
      ara: () => (aramaAcik = true),
      bilgi: () => (bilgiAcik = true),
      enAlta: asagiIn,
      menu: (id, x, y) => {
        const o = bul(id);
        if (o) menuAc(x, y, o);
      },
      yanitla: (id) => {
        const o = bul(id);
        if (o && gercekOlay(o)) yazma.yanitla(o);
      },
      duzenle: (id) => {
        const o = bul(id);
        if (o?.duzenlenebilir) yazma.duzenleBaslat(o);
      },
      kopyala: (id) => {
        const o = bul(id);
        if (o?.metin) void panoya(o.metin);
      },
    };
    klavye.oda = k;
    return () => {
      if (klavye.oda === k) klavye.oda = null;
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
  const GRUP_ARALIGI = 5 * 60_000;

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
        gun.satirlar.push({ tur: "yeni" });
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
</script>

<div class="oda" class:itildi={bilgiAcik || uyelerAcik} style="{gorunumStili(gorunum)};--tepe-yer:{tepeYuk}px;--yazma-yer:{aramaAcik ? 0 : altYuk}px">
<svelte:boundary onerror={(e) => console.error("oda çizimi başarısız", e)}>
  <!-- Floating header card (the dock's counterpart): identity + actions; the pinned message and the sync strip are its lower storeys. -->
  <!-- Yüzen başlık kartı (dock'un karşılığı): kimlik + eylemler; sabit mesaj ve eşitleme şeridi onun alt katlarıdır. -->
  <div class="tepe" bind:clientHeight={tepeYuk}>
  <div class="kart">
  <header class="ust">
    {#if !gezinme.genis}
      <button class="simge-dugme geri" aria-label={t("oda.geri")} onclick={() => gezinme.odaKapat()}><Ikon ad="geri" /></button>
    {:else if duzen.listeGizli}
      <button class="simge-dugme geri" aria-label={t("klavye.listeAc")} title="{t("klavye.listeAc")} (Ctrl+E)" onclick={() => duzen.degistir()}><Ikon ad="yanPanel" /></button>
    {/if}
    <!-- Tap = room info, long press = customize sheet (both tactile) · Dokun = oda bilgisi, uzun bas = özelleştir sayfası (ikisi de dokunsal) -->
    {#if bilgi}
      <button class="kimlik" aria-label={t("oda.bilgiAc")} onclick={() => (bilgiAcik = true)} use:uzunBasma={{ ac: () => (ozellestirAcik = true) }}>
        <Avatar harf={bilgi.avatarHarf} mxc={bilgi.avatarMxc} boyut={40} />
        <span class="adlar">
          <span class="ad-satir"><span class="ad">{bilgi.ad}</span>{#if bilgi.sifreli}<span class="kilit" role="img" aria-label={t("oda.sifreli")}><Ikon ad="kilit" boyut={14} /></span>{/if}</span>
          {#if zaman.yazanlar.length > 0}
            <!-- Someone is typing: the subtitle turns accent coloured (design D) · Biri yazıyor: alt başlık vurgu rengine döner (tasarım D) -->
            <span class="alt yaziyor" role="status" aria-live="polite">{zaman.yazanlar.length === 1 ? t("yaziyor.bir", { ad: zaman.yazanlar[0].ad }) : zaman.yazanlar.length === 2 ? t("yaziyor.iki", { a: zaman.yazanlar[0].ad, b: zaman.yazanlar[1].ad }) : t("yaziyor.cok", { n: zaman.yazanlar.length })}</span>
          {:else}
            <!-- Encryption is the lock beside the name; only its absence is spelled out. · Şifreleme adın yanındaki kilittir; yalnızca yokluğu yazılır. -->
            <span class="alt">
              <span class="uye">{bilgi.sifreli ? "" : t("oda.sifreSiz") + " · "}{t("oda.uyeler", { n: bilgi.uyeSayisi })}</span>
              {#if aranabilir && bilgi.karsiKullanici}<VarlikRozeti kullaniciId={bilgi.karsiKullanici} />{/if}
            </span>
          {/if}
        </span>
      </button>
    {:else}
      <!-- The header keeps its shape while the room opens. · Oda açılırken başlık biçimini korur. -->
      <div class="kimlik bekle" aria-hidden="true"><span class="b-yuz parilti"></span><span class="b-ad parilti"></span></div>
    {/if}
    <OdaAramasi {odaId} />
    <button class="simge-dugme" class:tonlu={aramaAcik} aria-label={t("mesajAra.odadaAra")} aria-pressed={aramaAcik} use:hizliGecis onclick={() => (aramaAcik = true)}><Ikon ad="ara" /></button>
    {#if aranabilir && bilgi}
      <button
        class="simge-dugme"
        aria-label={t("oda.ara")}
        onclick={() => bilgi && arama.ara({ id: bilgi.id, ad: bilgi.ad, avatarHarf: bilgi.avatarHarf, avatarMxc: bilgi.avatarMxc })}
      >
        <Ikon ad="telefon" />
      </button>
    {/if}
  </header>
  <SabitCubugu {odaId} idler={zaman.sabitler} />
  <EsitlemeSeridi />
  </div>
  </div>

  <SohbetZemini resim={gorunum.resim} resimAnahtari={odaId} karart={gorunum.karart} />
  <div class="zaman-sarmal">
    <div class="zaman" bind:this={kutu} onscroll={kaydir}>
      <div class="sutun">
        {#if zaman.hata}
          <!-- A room that cannot be opened as a chat (a space) says so; everything else is a normal load error. · Sohbet olarak açılamayan oda (alan) bunu söyler; gerisi normal yükleme hatası. -->
          <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={zaman.hata.tur === "oda_turu" ? t("hata.oda_turu") : t("oda.acilamadiAlt")} eylem={zaman.hata.tur === "oda_turu" ? undefined : t("oda.yeniden")} onEylem={yenidenAc} />
        {:else if zamanAsimi}
          <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={t("oda.zamanAsimi")} eylem={t("oda.yeniden")} onEylem={yenidenAc} />
        {:else}
          {#if zaman.eskiYukleniyor}<p class="orta">{t("oda.eskiYukleniyor")}</p>{/if}
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
              {#each gun.satirlar as s, i (s.tur === "oge" ? s.oge.id : `yeni-${i}`)}
                {#if s.tur === "yeni"}
                  <div class="yeni" data-yeni><span>{t("oda.yeniMesajlar")}</span></div>
                {:else}
                  <MesajBalonu oge={s.oge} konum={konumu(s)} uzak={s.uzak} gonderenGoster={grupOdasi} yeni={!!yeniGelenler[s.oge.id]} vurgulu={menu?.oge.id === s.oge.id} eslesme={aramaAcik && !!aktifOlay && s.oge.olayId === aktifOlay} vurguSorgu={aramaAcik ? aramaSorgu : ""} dm={aranabilir} okundu={okunanlar.has(s.oge.id)} yanitla={(o) => yazma.yanitla(o)} {tepkiKimleri} okuyanlarAc={(o) => (okuyanHedef = o)} {yenidenDene} {menuAc} />
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
    <OdaIciArama {odaId} onkapat={() => (aramaAcik = false)} bind:aktifOlay bind:sorgu={aramaSorgu} />
  {:else}
    <YazmaAlani {odaId} sifreli={bilgi?.sifreli ?? false} {gonder} altta={altaGorunur} {yeniSayi} enAlta={asagiIn} bind:yukseklik={altYuk} />
  {/if}

  {#if bilgiAcik}
    <OdaBilgisi {odaId} onkapat={() => (bilgiAcik = false)} uyelerAc={() => (uyelerAcik = true)} gorunumAc={() => (ozellestirAcik = true)} ara={() => { bilgiAcik = false; aramaAcik = true; }} />
  {/if}
  {#if uyelerAcik}<Uyeler {odaId} onkapat={() => (uyelerAcik = false)} />{/if}

  {#snippet failed(_hata, sifirla)}
    <!-- Last line of defence: a render error ends here, with a way back, instead of a black screen. · Son savunma hattı: çizim hatası siyah ekran yerine burada, geri dönüş yoluyla biter. -->
    <div class="tepe"><header class="ust">
      {#if !gezinme.genis}<button class="simge-dugme geri" aria-label={t("oda.geri")} onclick={() => gezinme.odaKapat()}><Ikon ad="geri" /></button>{/if}
    </header></div>
    <BosDurum maskot="hata" baslik={t("oda.acilamadi")} metin={t("oda.cizimHatasi")} eylem={t("oda.yeniden")} onEylem={sifirla} />
  {/snippet}
</svelte:boundary>
</div>

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
{#if iletHedef}<IletSayfasi oge={iletHedef} {odaId} onkapat={() => (iletHedef = null)} />{/if}

<style>
  /* The room moves aside under its info page (same parallax as list → room). · Oda, bilgi sayfasının altında kenara çekilir (liste → oda ile aynı paralaks). */
  .oda > :global(*:not(.ekran)) { transition: transform var(--sure-ekran) var(--egri-ac); }
  .oda.itildi > :global(*:not(.ekran)) { transform: translate3d(-25%, 0, 0); }
  .oda { position: relative; overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: column; min-width: 0; height: 100%; background: var(--sohbet-zemin, var(--zemin)); }
  .tepe { position: absolute; z-index: 3; top: 0; left: 0; right: 0; padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left)); pointer-events: none; }
  /* Messages fade out under the status bar and the card instead of being cut by a line. · Mesajlar durum çubuğunun ve kartın altında çizgiyle kesilmek yerine solar. */
  .tepe::before { content: ""; position: absolute; z-index: -1; inset: 0 0 -12px; background: linear-gradient(var(--sohbet-zemin, var(--zemin)) 55%, transparent); }
  .kart { pointer-events: auto; overflow: hidden; border-radius: 32px; background: var(--yuzey-2); box-shadow: var(--kat-2); }
  .kart :global(.cubuk) { width: 100%; border-bottom: 0; border-top: 1px solid var(--kenar-ince); }
  .kart :global(.serit) { border-bottom: 0; }
  .ust { min-height: 64px; display: flex; align-items: center; gap: 2px; padding: 8px; }
    .kimlik { flex: 1; min-width: 0; min-height: 44px; padding: 0 6px 0 2px; display: flex; align-items: center; gap: .75rem; text-align: left; border-radius: 22px; }
  .adlar { flex: 1; min-width: 0; display: grid; }
  .ad-satir { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .kilit { flex: none; display: inline-flex; color: var(--cozum); }
  .b-yuz { width: 40px; height: 40px; border-radius: 10px; }
  .b-ad { width: 45%; height: 14px; border-radius: 7px; }
  .ad { font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alt.yaziyor { color: var(--vurgu); font-weight: 500; overflow: hidden; text-overflow: ellipsis; display: block; }
  .alt { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: .75rem; color: var(--yazi-2); white-space: nowrap; overflow: hidden; }
  .uye { overflow: hidden; text-overflow: ellipsis; }
  .zaman-sarmal { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .zaman { touch-action: pan-y; position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; padding: calc(var(--tepe-yer) + 4px) .75rem calc(var(--yazma-yer) + 4px); scroll-padding-top: calc(var(--tepe-yer) + 8px); scroll-padding-bottom: calc(var(--yazma-yer) + 8px); overscroll-behavior: contain; }
  /* Landscape phone (height <= 500px): header 48px, message column at most 680px and centred (design section 15). */
  /* Yatay telefon (yükseklik <= 500px): başlık 48px, mesaj sütunu en fazla 680px ve ortalı (tasarım bölüm 15). */
  .sutun { width: 100%; }
  @media (max-height: 500px) {
    .tepe { padding-top: 4px; }
    .ust { min-height: 48px; padding: 1px 5px; }
    .sutun { max-width: 680px; margin: 0 auto; }
  }
  .orta { text-align: center; font-size: .8125rem; color: var(--yazi-2); padding: 12px; }
  .basi { display: grid; justify-items: center; gap: 6px; padding: 24px 24px 8px; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .basi strong { font-family: var(--baslik-tipi); font-size: 1.0625rem; color: var(--yazi); }
  .basi-kutu { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--ton); color: var(--ton-ustu); margin-bottom: 4px; }

  /* Sticky date chip: sticks to the top while its day scrolls by, bounded by its own <section>. */
  /* Yapışkan tarih hapı: günü kayarken üstte kalır, kendi <section>'ıyla sınırlıdır. */
  .tarih { position: sticky; top: calc(var(--tepe-yer) - 4px); z-index: 2; display: flex; justify-content: center; padding: 8px 0 4px; pointer-events: none; }
  .tarih span { background: var(--yuzey-2); color: var(--yazi); font-size: .75rem; font-weight: 600; padding: .25rem .75rem; border-radius: .75rem; }

  .yeni { display: flex; align-items: center; gap: 12px; margin: 14px 0 6px; color: var(--vurgu); font-size: .75rem; font-weight: 600; }
  .yeni::before, .yeni::after { content: ""; flex: 1; height: 1px; background: var(--vurgu); opacity: .5; }

  .iskelet { display: flex; margin-top: 10px; }
  .iskelet.sag { justify-content: flex-end; }
  .iskelet span { height: 40px; border-radius: 16px; }
</style>
