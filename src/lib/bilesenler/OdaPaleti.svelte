<!--
  Ctrl+Space: multi-mode room, message and command palette with an optional side preview panel.
  Tab / Shift+Tab switches modes (remembered for the session); Ctrl+I toggles the right-hand preview of the selected chat's
  recent cached messages without opening the room.
  Ctrl+Space: isteğe bağlı yan önizleme panelli çok kipli oda, mesaj ve komut paleti.
  Tab / Shift+Tab kipler arasında geçer (oturum boyunca hatırlanır); Ctrl+I odayı açmadan seçili sohbetin önbellekteki son
  mesajlarını gösteren sağ önizleme panelini açıp kapatır.
-->
<script lang="ts" module>
  import { mount, unmount } from "svelte";
  import type { OnizlemeMesaji } from "../api/tipler";

  type Kip = "tumu" | "okunmamis" | "kisiler" | "gruplar" | "alanlar" | "mesajlar" | "komutlar";

  interface OnizlemeKaydi {
    sonZaman: number | null;
    alinma: number;
    mesajlar: OnizlemeMesaji[];
  }

  // Remembered for the session so reopening Ctrl+Space stays in the mode the user picked.
  // Oturum boyunca hatırlanır; Ctrl+Space yeniden açılınca kullanıcının seçtiği kipte kalır.
  let sonKip: Kip = "tumu";

  // Small in-memory preview cache (per account, short TTL) to avoid re-reading SQLite on rapid arrow movement.
  // Hızlı ok tuşu hareketinde SQLite'ı tekrar okumamak için küçük bellek önbelleği (hesap başına, kısa ömürlü).
  const ONIZLEME_EN_COK = 24;
  const ONIZLEME_OMUR_MS = 30_000;
  let onbellekSahibi = "";
  const onizlemeOnbellek = new Map<string, OnizlemeKaydi>();

  function onbellekYaz(odaId: string, kayit: OnizlemeKaydi) {
    onizlemeOnbellek.delete(odaId);
    onizlemeOnbellek.set(odaId, kayit);
    if (onizlemeOnbellek.size > ONIZLEME_EN_COK) {
      const ilk = onizlemeOnbellek.keys().next().value;
      if (ilk !== undefined) onizlemeOnbellek.delete(ilk);
    }
  }

  const ONIZLEME_ANAHTARI = "rubychat.paletOnizleme";
  function onizlemeTercihOku(): boolean {
    try {
      return localStorage.getItem(ONIZLEME_ANAHTARI) === "1";
    } catch {
      return false;
    }
  }
  function onizlemeTercihYaz(acik: boolean) {
    try {
      localStorage.setItem(ONIZLEME_ANAHTARI, acik ? "1" : "0");
    } catch {
      /* storage blocked: kept for this session · depolama engelli: bu oturum için tutulur */
    }
  }

  /** Mounted OdaKesfet instance when opened from the Commands mode · Komutlar kipinden açılan OdaKesfet örneği */
  let aktifKesfet: ReturnType<typeof mount> | null = null;
</script>

<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { odaOnizleme } from "../api/komutlar";
  import type { MesajAramaSonucu, OdaOzeti } from "../api/tipler";
  import { atlama, EN_AZ_KARAKTER, MesajAramasi } from "../arama-mesaj/durum.svelte";
  import { alanlar } from "../durum/alanlar.svelte";
  import { ayarlar, type Tema } from "../durum/ayarlar.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { istekler } from "../durum/istekler.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { menuGir, perdeGir } from "../gecis";
  import { t, type Anahtar } from "../i18n";
  import { klavye } from "../klavyeKisayol.svelte";
  import { goreliZaman, gunEtiketi, saatYaz } from "../zaman-bicim";
  import Avatar from "./Avatar.svelte";
  import Ikon, { type IkonAdi } from "./Ikon.svelte";
  import OdaKesfet from "./OdaKesfet.svelte";

  interface PaletKomutu {
    id: string;
    etiket: string;
    alt?: string;
    ikon: IkonAdi;
    kisayol?: string;
    anahtarlar: string;
    calistir: () => void;
  }

  const KIPLER: readonly { id: Kip; ad: Anahtar; yer: Anahtar }[] = [
    { id: "tumu", ad: "sohbetler.tumu", yer: "palet.yerTumu" },
    { id: "okunmamis", ad: "sohbetler.okunmamis", yer: "palet.yerOkunmamis" },
    { id: "kisiler", ad: "sohbetler.kisiler", yer: "palet.yerKisiler" },
    { id: "gruplar", ad: "sohbetler.gruplar", yer: "palet.yerGruplar" },
    { id: "alanlar", ad: "alanlar.baslik", yer: "palet.yerAlanlar" },
    { id: "mesajlar", ad: "mesajAra.baslik", yer: "palet.yerMesajlar" },
    { id: "komutlar", ad: "palet.kipKomutlar", yer: "palet.yerKomutlar" },
  ];

  const ONIZLEME_ESIK = "(min-width: 760px)";

  let kip = $state<Kip>(sonKip);
  let sorgu = $state("");
  let sira = $state(0);
  let genislet = $state(onizlemeTercihOku());
  let genisEkran = $state(typeof window !== "undefined" ? window.matchMedia(ONIZLEME_ESIK).matches : true);

  let alan: HTMLInputElement | undefined = $state();
  let liste: HTMLDivElement | undefined = $state();
  let sekmeSerit: HTMLDivElement | undefined = $state();
  let onizListe: HTMLDivElement | undefined = $state();

  let onizlemeMesajlar = $state.raw<OnizlemeMesaji[]>([]);
  let onizlemeYukleniyor = $state(false);
  let onizlemeHata = $state(false);
  let onizlemeIstek = 0;

  let katman = 0;
  // Frozen at opening: a new message must not move the rows under the finger. · Açılışta dondurulur: yeni mesaj satırları oynatmamalı.
  const ziyaret = [...klavye.ziyaret];
  const mesajArama = new MesajAramasi();

  const onizlemeAktif = $derived(genislet && genisEkran);
  const aktifKipBilgi = $derived(KIPLER.find((x) => x.id === kip) ?? KIPLER[0]);

  onMount(() => {
    katman = gezinme.katmanAc(() => {
      klavye.palet = false;
    });
    const mq = window.matchMedia(ONIZLEME_ESIK);
    genisEkran = mq.matches;
    const guncelle = (e: MediaQueryListEvent) => (genisEkran = e.matches);
    mq.addEventListener("change", guncelle);
    alan?.focus();
    return () => mq.removeEventListener("change", guncelle);
  });
  onDestroy(() => {
    onizlemeIstek++;
    mesajArama.temizle();
    gezinme.katmanBirak(katman);
  });

  const katla = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");

  /** Smaller = better, -1 = no match: start, word start, inside, letters in order · Küçük = iyi, -1 = yok: baş, kelime başı, içinde, harfler sırayla */
  function puan(ad: string, s: string): number {
    if (!s) return 0;
    const a = katla(ad);
    if (a.startsWith(s)) return 0;
    if (a.includes(` ${s}`)) return 1;
    if (a.includes(s)) return 2;
    let i = 0;
    for (const h of a) if (h === s[i]) i++;
    return i >= s.length ? 3 : -1;
  }

  function yeniSira(id: string): number {
    if (id === gezinme.acikOdaId) return 1e6;
    const i = ziyaret.indexOf(id);
    return i < 0 ? 1e5 : i;
  }

  function odaSuz(havuz: readonly OdaOzeti[]): OdaOzeti[] {
    const s = katla(sorgu.trim());
    return havuz
      .map((o) => ({ o, p: puan(o.ad, s), y: yeniSira(o.id) }))
      .filter((x) => x.p >= 0)
      .sort((a, b) => a.p - b.p || a.y - b.y || (b.o.sonZaman ?? 0) - (a.o.sonZaman ?? 0))
      .slice(0, 30)
      .map((x) => x.o);
  }

  const sohbetKipi = $derived(kip === "tumu" || kip === "okunmamis" || kip === "kisiler" || kip === "gruplar");

  const odaSonuc = $derived.by<OdaOzeti[]>(() => {
    if (!sohbetKipi) return [];
    const havuz = odalar.liste.filter((o) => {
      if (o.davet || o.alan) return false;
      if (kip === "okunmamis") return o.okunmamis > 0 || o.bahsedilme > 0;
      if (kip === "kisiler") return o.dm;
      if (kip === "gruplar") return !o.dm;
      return true;
    });
    return odaSuz(havuz);
  });

  const alanSonuc = $derived.by<OdaOzeti[]>(() => {
    if (kip !== "alanlar") return [];
    return odaSuz(odalar.alanlar);
  });

  // Mount OdaKesfet on document.body so it outlives OdaPaleti after the palette closes.
  // Palet kapandıktan sonra yaşamaya devam etmesi için OdaKesfet'i document.body üzerine bağla.
  function kesfetAc() {
    if (aktifKesfet) return;
    const ornek = mount(OdaKesfet, {
      target: document.body,
      props: {
        onkapat: () => {
          const eski = aktifKesfet;
          aktifKesfet = null;
          if (eski) void unmount(eski);
        },
      },
    });
    aktifKesfet = ornek;
  }

  function temaAdi(deger: Tema): string {
    return deger === "koyu" ? t("gorunum.koyu") : deger === "acik" ? t("gorunum.acik") : t("gorunum.sistem");
  }

  const tumKomutlar = $derived.by<PaletKomutu[]>(() => {
    const temalar: Tema[] = ["sistem", "koyu", "acik"];
    const sonrakiTema = temalar[(temalar.indexOf(ayarlar.tema) + 1) % temalar.length];
    const listeGizliSimdi = duzen.kompakt ? !duzen.cekmece : duzen.listeGizli;
    const ogeler: PaletKomutu[] = [
      {
        id: "yeni-sohbet",
        etiket: t("palet.komutYeniSohbet"),
        alt: t("palet.komutYeniSohbetAlt"),
        ikon: "kalem",
        anahtarlar: "yeni sohbet dm kisi baslat new chat message",
        calistir: () => {
          duzen.listeGoster();
          if (gezinme.sekme !== "sohbetler") gezinme.sekmeSec("sohbetler");
          klavye.yeniSohbetBekleyen = true;
        },
      },
      {
        id: "oda-kesfet",
        etiket: t("palet.komutKesfet"),
        alt: t("palet.komutKesfetAlt"),
        ikon: "pusula",
        anahtarlar: "oda kesfet ara katil adres explore discover join room public",
        calistir: kesfetAc,
      },
      {
        id: "ayarlar",
        etiket: t("palet.komutAyarlar"),
        alt: t("palet.komutAyarlarAlt"),
        ikon: "ayar",
        anahtarlar: "ayarlar ben profil hesap settings preferences",
        calistir: () => {
          duzen.listeGoster();
          gezinme.sekmeSec("ben");
        },
      },
      {
        id: "gorunum",
        etiket: t("palet.komutGorunum"),
        alt: t("palet.komutGorunumAlt"),
        ikon: "palet",
        anahtarlar: "gorunum yazi tipi boyut yogunluk vurgu renk appearance font density",
        calistir: () => {
          duzen.listeGoster();
          gezinme.benAltAc("gorunum");
        },
      },
      {
        id: "tema",
        etiket: t("palet.komutTema"),
        alt: t("palet.komutTemaAlt", { tema: temaAdi(ayarlar.tema) }),
        ikon: "gunes",
        anahtarlar: "tema koyu acik sistem dark light theme",
        calistir: () => {
          ayarlar.gorunumYaz("tema", sonrakiTema);
          bildirim.goster(t("palet.komutTemaBildirim", { tema: temaAdi(sonrakiTema) }), 1800);
        },
      },
      {
        id: "amoled",
        etiket: t("palet.komutAmoled"),
        alt: t(ayarlar.amoled ? "durum.acik" : "durum.kapali"),
        ikon: "palet",
        anahtarlar: "amoled siyah oled black dark",
        calistir: () => {
          ayarlar.gorunumYaz("amoled", !ayarlar.amoled);
        },
      },
      {
        id: "az-animasyon",
        etiket: t("palet.komutAzAnimasyon"),
        alt: t(ayarlar.azAnimasyon === "acik" ? "durum.acik" : "gorunum.sistem"),
        ikon: "ayar",
        anahtarlar: "animasyon hareket azalt reduced motion",
        calistir: () => {
          ayarlar.gorunumYaz("azAnimasyon", ayarlar.azAnimasyon === "acik" ? "sistem" : "acik");
        },
      },
    ];
    if (gezinme.genis) {
      ogeler.push({
        id: "liste-gizle",
        etiket: t(listeGizliSimdi ? "palet.komutListeGoster" : "palet.komutListeGizle"),
        alt: t("palet.komutListeAlt"),
        ikon: "yanPanel",
        kisayol: "Ctrl+B",
        anahtarlar: "liste gizle goster yan panel sidebar toggle",
        calistir: () => duzen.degistir(),
      });
    }
    ogeler.push(
      {
        id: "istekler",
        etiket: t("palet.komutIstekler"),
        alt: istekler.bekleyen > 0 ? String(istekler.bekleyen) : undefined,
        ikon: "zil",
        anahtarlar: "davet istek katilma invites requests",
        calistir: () => istekler.ac(),
      },
      {
        id: "guvenlik",
        etiket: t("palet.komutGuvenlik"),
        alt: t("palet.komutGuvenlikAlt"),
        ikon: "kalkan",
        anahtarlar: "guvenlik anahtar sifreleme dogrulama oturum security encryption keys",
        calistir: () => {
          duzen.listeGoster();
          gezinme.benAltAc("guvenlik");
        },
      },
      {
        id: "sohbet-ayar",
        etiket: t("palet.komutSohbetAyar"),
        alt: t("ayar.sohbetAlt"),
        ikon: "sohbet",
        anahtarlar: "sohbet ayar gonder kalite enter chat settings",
        calistir: () => {
          duzen.listeGoster();
          gezinme.benAltAc("sohbet");
        },
      },
      {
        id: "bildirim-ayar",
        etiket: t("palet.komutBildirimAyar"),
        alt: t("ayar.bildirimlerAlt"),
        ikon: "zil",
        anahtarlar: "bildirim ses titresim notifications",
        calistir: () => {
          duzen.listeGoster();
          gezinme.benAltAc("bildirimler");
        },
      },
      {
        id: "klavye-ayar",
        etiket: t("palet.komutKlavyeAyar"),
        ikon: "klavye",
        anahtarlar: "klavye kisayol vim keyboard shortcuts settings",
        calistir: () => {
          duzen.listeGoster();
          gezinme.benAltAc("klavye");
        },
      },
      {
        id: "klavye-yardim",
        etiket: t("palet.komutKlavyeYardim"),
        ikon: "bilgi",
        kisayol: "Ctrl+/",
        anahtarlar: "yardim kisayol liste help shortcuts",
        calistir: () => {
          klavye.yardim = true;
        },
      },
    );
    return ogeler;
  });

  const komutSonuc = $derived.by<PaletKomutu[]>(() => {
    if (kip !== "komutlar") return [];
    const s = katla(sorgu.trim());
    if (!s) return tumKomutlar;
    return tumKomutlar
      .map((k) => {
        const p1 = puan(k.etiket, s);
        const p2 = k.alt ? puan(k.alt, s) : -1;
        const p3 = puan(k.anahtarlar, s);
        const adaylar = [p1, p2 >= 0 ? p2 + 1 : -1, p3 >= 0 ? p3 + 2 : -1].filter((x) => x >= 0);
        return { k, p: adaylar.length ? Math.min(...adaylar) : -1 };
      })
      .filter((x) => x.p >= 0)
      .sort((a, b) => a.p - b.p)
      .map((x) => x.k);
  });

  const mesajGecerli = $derived([...sorgu.trim()].length >= EN_AZ_KARAKTER);

  // Poll search index status only while in the Messages mode. · Dizin durumunu yalnızca Mesajlar kipindeyken izle.
  $effect(() => {
    if (kip !== "mesajlar") {
      mesajArama.temizle();
      return;
    }
    return mesajArama.durumuIzle();
  });
  $effect(() => {
    if (kip === "mesajlar") mesajArama.ara(sorgu);
  });

  const sonucSayisi = $derived(
    sohbetKipi
      ? odaSonuc.length
      : kip === "alanlar"
        ? alanSonuc.length
        : kip === "mesajlar"
          ? mesajArama.sonuclar.length
          : komutSonuc.length,
  );

  $effect(() => {
    void sorgu;
    void kip;
    sira = 0;
  });
  $effect(() => {
    if (sonucSayisi === 0) sira = 0;
    else if (sira >= sonucSayisi) sira = sonucSayisi - 1;
  });

  const odaBul = (id: string) => odalar.liste.find((o) => o.id === id) ?? null;
  const gonderenKisa = (m: MesajAramaSonucu) => m.gonderenAd ?? m.gonderen.replace(/^@/, "").split(":")[0];

  // Selected room for the side preview (in chat modes, or the room of the selected search hit in Messages mode).
  // Yan önizleme için seçili oda (sohbet kiplerinde seçili oda, Mesajlar kipinde seçili sonucun odası).
  const seciliOda = $derived.by<OdaOzeti | null>(() => {
    if (sohbetKipi) return odaSonuc[sira] ?? null;
    if (kip === "mesajlar") {
      const m = mesajArama.sonuclar[sira];
      return m ? odaBul(m.odaId) : null;
    }
    return null;
  });
  const seciliMesajId = $derived(kip === "mesajlar" ? (mesajArama.sonuclar[sira]?.olayId ?? null) : null);
  const seciliAlan = $derived(kip === "alanlar" ? (alanSonuc[sira] ?? null) : null);
  const seciliKomut = $derived(kip === "komutlar" ? (komutSonuc[sira] ?? null) : null);

  // Debounced (120 ms) room preview fetch with request-id race guard and small memory cache.
  // 120 ms bekletmeli oda önizleme yüklemesi: istek kimliğiyle yarış koruması ve küçük bellek önbelleği.
  $effect(() => {
    const aktif = onizlemeAktif;
    const oda = seciliOda;
    const odaId = oda?.id ?? null;
    const sonZaman = oda?.sonZaman ?? null;
    if (!aktif || !odaId) {
      onizlemeIstek++;
      onizlemeYukleniyor = false;
      onizlemeHata = false;
      onizlemeMesajlar = [];
      return;
    }
    const sahip = oturum.ben?.kullaniciId ?? "";
    if (sahip !== onbellekSahibi) {
      onizlemeOnbellek.clear();
      onbellekSahibi = sahip;
    }
    const kayit = onizlemeOnbellek.get(odaId);
    const taze = !!kayit && kayit.sonZaman === sonZaman && Date.now() - kayit.alinma < ONIZLEME_OMUR_MS;
    if (taze && kayit) {
      onizlemeIstek++;
      onizlemeMesajlar = kayit.mesajlar;
      onizlemeYukleniyor = false;
      onizlemeHata = false;
      void tick().then(() => {
        if (onizListe) onizListe.scrollTop = onizListe.scrollHeight;
      });
      return;
    }
    const bu = ++onizlemeIstek;
    onizlemeMesajlar = kayit ? kayit.mesajlar : [];
    onizlemeYukleniyor = !kayit;
    onizlemeHata = false;
    const z = setTimeout(async () => {
      try {
        const sonuc = await odaOnizleme(odaId, 20);
        if (bu !== onizlemeIstek) return;
        onbellekYaz(odaId, { sonZaman, alinma: Date.now(), mesajlar: sonuc });
        onizlemeMesajlar = sonuc;
        onizlemeHata = false;
        await tick();
        if (bu === onizlemeIstek && onizListe) onizListe.scrollTop = onizListe.scrollHeight;
      } catch (e) {
        if (bu !== onizlemeIstek) return;
        console.error(e);
        onizlemeHata = true;
        onizlemeMesajlar = [];
      } finally {
        if (bu === onizlemeIstek) onizlemeYukleniyor = false;
      }
    }, 120);
    return () => clearTimeout(z);
  });

  function kipSec(yeni: Kip) {
    if (kip === yeni) return;
    kip = yeni;
    sonKip = yeni;
    sira = 0;
    alan?.focus();
    void tick().then(() => {
      sekmeSerit?.querySelector(".aktif")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (liste) liste.scrollTop = 0;
    });
  }

  function genisletDegistir() {
    genislet = !genislet;
    onizlemeTercihYaz(genislet);
    alan?.focus();
  }

  async function git(id: string) {
    gezinme.katmanKapat(katman);
    gezinme.odaAc(id);
    // Focus the composer right away so typing (and modeless Ctrl shortcuts) work at once. · Yazma alanını hemen odakla; yazma (ve kipsiz Ctrl kısayolları) anında çalışsın.
    await tick();
    setTimeout(() => document.querySelector<HTMLElement>(".yazma textarea")?.focus(), 50);
  }

  function alanAc(o: OdaOzeti) {
    gezinme.katmanKapat(katman);
    duzen.listeGoster();
    gezinme.sekmeSec("alanlar");
    if (alanlar.gecerli?.id !== o.id) alanlar.ac(o.id, o.ad);
  }

  function mesajaGit(m: MesajAramaSonucu) {
    gezinme.katmanKapat(katman);
    atlama.git(m.odaId, m.olayId);
  }

  function komutCalistir(k: PaletKomutu) {
    gezinme.katmanKapat(katman);
    k.calistir();
  }

  function seciliyiAc() {
    if (sohbetKipi) {
      if (odaSonuc[sira]) void git(odaSonuc[sira].id);
    } else if (kip === "alanlar") {
      if (alanSonuc[sira]) alanAc(alanSonuc[sira]);
    } else if (kip === "mesajlar") {
      if (mesajArama.sonuclar[sira]) mesajaGit(mesajArama.sonuclar[sira]);
    } else if (kip === "komutlar") {
      if (komutSonuc[sira]) komutCalistir(komutSonuc[sira]);
    }
  }

  function tus(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      gezinme.katmanKapat(katman);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const i = KIPLER.findIndex((x) => x.id === kip);
      const sonraki = (i + (e.shiftKey ? -1 : 1) + KIPLER.length) % KIPLER.length;
      kipSec(KIPLER[sonraki].id);
      return;
    }
    // Ctrl+I toggles the side preview panel without clashing with global shortcuts or Turkish layouts.
    // Ctrl+I genel kısayollarla ve Türkçe klavyeyle çakışmadan yan önizleme panelini açıp kapatır.
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.code === "KeyI" || k === "i" || e.key === "ı")) {
      e.preventDefault();
      e.stopPropagation();
      if (genisEkran) genisletDegistir();
      return;
    }
    const yon = k === "arrowdown" || (e.ctrlKey && (k === "j" || k === "n")) ? 1 : k === "arrowup" || (e.ctrlKey && (k === "k" || k === "p")) ? -1 : 0;
    if (yon) {
      e.preventDefault();
      e.stopPropagation();
      if (sonucSayisi > 0) sira = (sira + yon + sonucSayisi) % sonucSayisi;
      void tick().then(() => liste?.querySelector(".secili")?.scrollIntoView({ block: "nearest" }));
    } else if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      seciliyiAc();
    }
  }

  const bosMetin = $derived<Anahtar>(
    kip === "okunmamis"
      ? "palet.bosOkunmamis"
      : kip === "kisiler"
        ? "palet.bosKisiler"
        : kip === "gruplar"
          ? "palet.bosGruplar"
          : kip === "alanlar"
            ? "palet.bosAlanlar"
            : kip === "komutlar"
              ? "palet.bosKomutlar"
              : "klavye.paletBos",
  );

  function gunFarkli(i: number): boolean {
    const m = onizlemeMesajlar[i];
    if (!m) return false;
    if (i === 0) return new Date(m.zaman).toDateString() !== new Date().toDateString();
    return new Date(m.zaman).toDateString() !== new Date(onizlemeMesajlar[i - 1].zaman).toDateString();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={() => gezinme.katmanKapat(katman)} in:perdeGir></div>
<div class="palet" class:genis={onizlemeAktif} role="dialog" aria-modal="true" aria-label={t("klavye.kPalet")} in:menuGir>
  <div class="alan">
    <Ikon ad="ara" boyut={20} />
    <input
      bind:this={alan}
      bind:value={sorgu}
      onkeydown={tus}
      placeholder={t(aktifKipBilgi.yer)}
      aria-label={t(aktifKipBilgi.yer)}
      role="combobox"
      aria-expanded="true"
      aria-controls="palet-liste"
      aria-activedescendant={sonucSayisi > 0 ? `palet-${sira}` : undefined}
      autocomplete="off"
      spellcheck="false"
    />
    {#if genisEkran}
      <button
        type="button"
        class="genislet-dugme"
        class:acik={genislet}
        aria-pressed={genislet}
        aria-label={t(genislet ? "palet.onizlemeKapat" : "palet.onizlemeAc")}
        title={t(genislet ? "palet.onizlemeKapat" : "palet.onizlemeAc")}
        onmousedown={(e) => e.preventDefault()}
        onclick={genisletDegistir}
      >
        <Ikon ad="yanPanel" boyut={18} />
        <span>{t("palet.onizlemeDugme")}</span>
      </button>
    {/if}
    <kbd>Esc</kbd>
  </div>

  <div class="kipler" role="tablist" aria-label={t("palet.kipler")} bind:this={sekmeSerit}>
    {#each KIPLER as k (k.id)}
      <button
        type="button"
        class="kip"
        class:aktif={kip === k.id}
        role="tab"
        aria-selected={kip === k.id}
        tabindex="-1"
        onmousedown={(e) => e.preventDefault()}
        onclick={() => kipSec(k.id)}
      >
        <span>{t(k.ad)}</span>
        {#if k.id === "okunmamis" && odalar.okunmamisOda > 0}
          <span class="kip-sayi">{odalar.okunmamisOda > 99 ? "99+" : odalar.okunmamisOda}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="govde">
    <div class="liste" id="palet-liste" role="listbox" bind:this={liste}>
      {#if sohbetKipi}
        {#each odaSonuc as o, i (o.id)}
          <button
            type="button"
            class="satir"
            class:secili={i === sira}
            id="palet-{i}"
            role="option"
            aria-selected={i === sira}
            tabindex="-1"
            onpointermove={() => (sira = i)}
            onclick={() => void git(o.id)}
          >
            <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={36} />
            <span class="ad">{o.ad}</span>
            {#if o.bahsedilme > 0}<span class="rozet">@</span>{:else if o.okunmamis > 0}<span class="rozet">{o.okunmamis > 99 ? "99+" : o.okunmamis}</span>{/if}
            <span class="zaman">{goreliZaman(o.sonZaman)}</span>
          </button>
        {:else}
          <p class="bos">{t(bosMetin)}</p>
        {/each}
      {:else if kip === "alanlar"}
        {#each alanSonuc as a, i (a.id)}
          <button
            type="button"
            class="satir"
            class:secili={i === sira}
            id="palet-{i}"
            role="option"
            aria-selected={i === sira}
            tabindex="-1"
            onpointermove={() => (sira = i)}
            onclick={() => alanAc(a)}
          >
            <Avatar harf={a.avatarHarf} mxc={a.avatarMxc} boyut={36} />
            <span class="ad">{a.ad}</span>
            <span class="etiket"><Ikon ad="izgara" boyut={14} /></span>
          </button>
        {:else}
          <p class="bos">{t(bosMetin)}</p>
        {/each}
      {:else if kip === "mesajlar"}
        {#if mesajArama.dizin?.dolduruluyor}
          <p class="durum" role="status">{t("mesajAra.dizin", { n: mesajArama.dizin.belgeSayisi })}</p>
        {/if}
        {#if !mesajGecerli}
          <p class="bos">{t("palet.mesajIpucu")}</p>
        {:else if mesajArama.hata}
          <p class="bos hata">{t("mesajAra.hata")}</p>
        {:else if mesajArama.yukleniyor && mesajArama.sonuclar.length === 0}
          <p class="bos">{t("palet.mesajYukleniyor")}</p>
        {:else}
          {#each mesajArama.sonuclar as m, i (m.olayId)}
            {@const o = odaBul(m.odaId)}
            <button
              type="button"
              class="satir mesaj-satir"
              class:secili={i === sira}
              id="palet-{i}"
              role="option"
              aria-selected={i === sira}
              tabindex="-1"
              onpointermove={() => (sira = i)}
              onclick={() => mesajaGit(m)}
            >
              <Avatar harf={o?.avatarHarf ?? "#"} mxc={o?.avatarMxc ?? null} boyut={34} />
              <span class="iki-satir">
                <span class="ust-satir">
                  <span class="ad">{o?.ad ?? m.odaId} · {gonderenKisa(m)}</span>
                  <span class="zaman">{goreliZaman(m.zaman)}</span>
                </span>
                <span class="ozet">
                  {#each m.parcalar as p, j (j)}{#if p.vurgu}<mark>{p.metin}</mark>{:else}{p.metin}{/if}{/each}
                </span>
              </span>
            </button>
          {:else}
            <p class="bos">{t("mesajAra.sonucYok", { ara: sorgu.trim() })}</p>
          {/each}
        {/if}
      {:else}
        {#each komutSonuc as k, i (k.id)}
          <button
            type="button"
            class="satir"
            class:secili={i === sira}
            id="palet-{i}"
            role="option"
            aria-selected={i === sira}
            tabindex="-1"
            onpointermove={() => (sira = i)}
            onclick={() => komutCalistir(k)}
          >
            <span class="komut-ikon"><Ikon ad={k.ikon} boyut={18} /></span>
            <span class="iki-satir">
              <span class="ad">{k.etiket}</span>
              {#if k.alt}<span class="alt">{k.alt}</span>{/if}
            </span>
            {#if k.kisayol}<kbd>{k.kisayol}</kbd>{/if}
          </button>
        {:else}
          <p class="bos">{t(bosMetin)}</p>
        {/each}
      {/if}
    </div>

    {#if onizlemeAktif}
      <aside class="onizleme" aria-label={t("palet.onizlemeBaslik")}>
        {#if seciliOda}
          <div class="oniz-ust">
            <Avatar harf={seciliOda.avatarHarf} mxc={seciliOda.avatarMxc} boyut={28} />
            <div class="oniz-baslik">
              <span class="oniz-ad">
                <span class="oniz-ad-metin">{seciliOda.ad}</span>
                {#if seciliOda.sifreli}<span class="kilit" title={t("oda.sifreli")}><Ikon ad="kilit" boyut={13} /></span>{/if}
              </span>
              <span class="oniz-not">{t("palet.onizlemeAcilmadan")}</span>
            </div>
          </div>
          <div class="oniz-liste" bind:this={onizListe}>
            {#if onizlemeYukleniyor}
              <p class="bos">{t("palet.onizlemeYukleniyor")}</p>
            {:else if onizlemeHata}
              <p class="bos hata">{t("palet.onizlemeHata")}</p>
            {:else if onizlemeMesajlar.length === 0}
              <p class="bos">{t("palet.onizlemeBos")}</p>
            {:else}
              {#each onizlemeMesajlar as m, i (m.olayId)}
                {#if gunFarkli(i)}
                  <div class="gun-ayirici"><span>{gunEtiketi(m.zaman)}</span></div>
                {/if}
                <div class="oniz-mesaj" class:kendi={m.kendi} class:vurgulu={seciliMesajId === m.olayId}>
                  <div class="oniz-mesaj-ust">
                    <span class="oniz-kim">{m.kendi ? t("yerel.ben") : m.gonderenAd}</span>
                    <span class="oniz-saat">{saatYaz(m.zaman)}</span>
                  </div>
                  {#if m.tur === "sifreli"}
                    <p class="oniz-metin sifreli"><Ikon ad="kilit" boyut={13} /><span>{t("palet.sifreliNot")}</span></p>
                  {:else if m.tur === "medya"}
                    <p class="oniz-metin medya"><Ikon ad="galeri" boyut={13} /><span>{m.metin}</span></p>
                  {:else}
                    <p class="oniz-metin">{m.metin}</p>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {:else if seciliAlan}
          <div class="oniz-ozet">
            <Avatar harf={seciliAlan.avatarHarf} mxc={seciliAlan.avatarMxc} boyut={44} />
            <strong>{seciliAlan.ad}</strong>
            <p class="bos">{t("palet.onizlemeAlanNot")}</p>
          </div>
        {:else if seciliKomut}
          <div class="oniz-ozet">
            <span class="komut-ikon buyuk"><Ikon ad={seciliKomut.ikon} boyut={22} /></span>
            <strong>{seciliKomut.etiket}</strong>
            {#if seciliKomut.alt}<p class="bos">{seciliKomut.alt}</p>{/if}
            {#if seciliKomut.kisayol}<kbd>{seciliKomut.kisayol}</kbd>{/if}
            <p class="bos kucuk">{t("palet.onizlemeKomutNot")}</p>
          </div>
        {:else}
          <div class="oniz-ozet">
            <p class="bos">{t("palet.onizlemeSec")}</p>
          </div>
        {/if}
      </aside>
    {/if}
  </div>

  <div class="altlik">
    <span>{t("palet.ipucu")}</span>
  </div>
</div>

<style>
  .perde { position: fixed; inset: 0; z-index: 46; background: color-mix(in srgb, var(--zemin) 55%, transparent); }
  .palet {
    position: fixed; z-index: 47; top: min(12vh, 96px); left: 50%; translate: -50% 0;
    width: min(560px, calc(100vw - 32px)); max-height: min(600px, 76vh);
    display: flex; flex-direction: column; border-radius: 1.5rem;
    background: var(--yuzey-2); box-shadow: var(--kat-2); overflow: hidden;
  }
  .palet.genis { width: min(920px, calc(100vw - 32px)); }

  .alan {
    flex: none; display: flex; align-items: center; gap: .625rem;
    height: 3.5rem; padding: 0 1rem 0 1.125rem;
    color: var(--yazi-2); border-bottom: 1px solid var(--kenar-ince);
  }
  input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  input::placeholder { color: var(--yazi-2); }
  kbd { font: inherit; font-size: .75rem; padding: .125rem .5rem; border-radius: 6px; background: var(--yuzey-3); color: var(--yazi-2); flex: none; }

  .genislet-dugme {
    flex: none; display: inline-flex; align-items: center; gap: .375rem;
    height: 2rem; padding: 0 .625rem; border-radius: .75rem;
    background: var(--yuzey-3); color: var(--yazi-2); font-size: .8125rem; font-weight: 500;
    transition: opacity var(--sure-hizli) var(--egri-cikis);
  }
  .genislet-dugme:hover { color: var(--yazi); }
  .genislet-dugme.acik { background: var(--ton); color: var(--ton-ustu); }

  .kipler {
    flex: none; display: flex; align-items: center; gap: .25rem;
    padding: .375rem .75rem; overflow-x: auto; scrollbar-width: none;
    border-bottom: 1px solid var(--kenar-ince); background: var(--yuzey-1);
  }
  .kipler::-webkit-scrollbar { display: none; }
  .kip {
    flex: none; display: inline-flex; align-items: center; gap: .375rem;
    height: 2rem; padding: 0 .75rem; border-radius: .75rem;
    font-size: .8125rem; font-weight: 500; color: var(--yazi-2); white-space: nowrap;
  }
  .kip:hover { color: var(--yazi); background: var(--yuzey-3); }
  .kip.aktif { background: var(--ton); color: var(--ton-ustu); font-weight: 600; }
  .kip-sayi {
    font-size: .6875rem; font-weight: 700; line-height: 1;
    padding: .125rem .375rem; border-radius: 999px;
    background: var(--vurgu); color: var(--vurgu-ustu); font-variant-numeric: tabular-nums;
  }

  .govde { flex: 1; min-height: 0; display: flex; overflow: hidden; }
  .liste {
    flex: 1; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    padding: 8px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 2px;
  }
  .palet.genis .liste { flex: 0 0 46%; max-width: 420px; }

  .satir {
    min-height: 3.125rem; padding: .375rem .75rem; border-radius: 1rem;
    display: flex; align-items: center; gap: .75rem; text-align: left; color: var(--yazi);
  }
  .satir.mesaj-satir { align-items: flex-start; padding-top: .5rem; padding-bottom: .5rem; }
  .satir.secili { background: var(--ton); color: var(--ton-ustu); }
  .ad { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zaman { flex: none; font-size: .75rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .secili .zaman, .secili .alt, .secili .ozet, .secili .etiket { color: inherit; opacity: .88; }
  .etiket { flex: none; display: inline-flex; color: var(--yazi-2); }

  .iki-satir { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ust-satir { display: flex; align-items: baseline; gap: .5rem; min-width: 0; }
  .alt { font-size: .75rem; color: var(--yazi-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ozet {
    font-size: .8125rem; line-height: 1.35; color: var(--yazi-2); overflow: hidden; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
  }
  .ozet mark { background: var(--ton); color: var(--ton-ustu); border-radius: 4px; padding: 0 2px; font-weight: 600; }
  .secili .ozet mark { background: var(--vurgu); color: var(--vurgu-ustu); }

  .komut-ikon {
    flex: none; width: 2.25rem; height: 2.25rem; border-radius: .75rem;
    display: grid; place-items: center; background: var(--yuzey-3); color: var(--yazi-2);
  }
  .komut-ikon.buyuk { width: 2.75rem; height: 2.75rem; border-radius: .875rem; color: var(--vurgu); }
  .secili .komut-ikon { background: color-mix(in srgb, var(--ton-ustu) 14%, transparent); color: inherit; }

  .durum { margin: 0; padding: .375rem .75rem; font-size: .75rem; color: var(--yazi-2); }
  .bos { margin: 0; padding: 1.5rem 1rem; text-align: center; font-size: .875rem; color: var(--yazi-2); }
  .bos.hata { color: var(--hata); }
  .bos.kucuk { padding-top: .25rem; font-size: .75rem; }

  /* Side preview panel · Yan önizleme paneli */
  .onizleme {
    flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;
    border-left: 1px solid var(--kenar-ince); background: var(--yuzey-1);
    animation: oniz-gir var(--sure-gecis) var(--egri-ac);
  }
  @keyframes oniz-gir { from { opacity: 0; transform: translate3d(8px, 0, 0); } }
  .oniz-ust {
    flex: none; display: flex; align-items: center; gap: .625rem;
    padding: .625rem .875rem; border-bottom: 1px solid var(--kenar-ince);
  }
  .oniz-baslik { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .oniz-ad {
    display: flex; align-items: center; gap: .375rem; min-width: 0;
    font-size: .875rem; font-weight: 600; color: var(--yazi);
  }
  .oniz-ad-metin { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kilit { flex: none; display: inline-flex; color: var(--yazi-2); }
  .oniz-not { font-size: .75rem; color: var(--yazi-2); }

  .oniz-liste {
    flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    padding: .625rem .75rem; display: flex; flex-direction: column; gap: .375rem;
  }
  .gun-ayirici { display: flex; justify-content: center; padding: .25rem 0; }
  .gun-ayirici span {
    font-size: .6875rem; font-weight: 500; color: var(--yazi-2);
    padding: .125rem .5rem; border-radius: 999px; background: var(--yuzey-2);
  }
  .oniz-mesaj {
    padding: .375rem .625rem; border-radius: .75rem; background: var(--yuzey-2);
    display: grid; gap: 2px;
  }
  .oniz-mesaj.kendi { background: var(--yuzey-3); }
  .oniz-mesaj.vurgulu { outline: 1px solid var(--vurgu); }
  .oniz-mesaj-ust { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; min-width: 0; }
  .oniz-kim {
    flex: 1; min-width: 0; font-size: .75rem; font-weight: 600; color: var(--vurgu);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .oniz-mesaj.kendi .oniz-kim { color: var(--yazi); }
  .oniz-saat { flex: none; font-size: .6875rem; color: var(--yazi-2); font-variant-numeric: tabular-nums; }
  .oniz-metin {
    margin: 0; font-size: .8125rem; line-height: 1.38; color: var(--yazi);
    overflow: hidden; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
  }
  .oniz-metin.medya, .oniz-metin.sifreli {
    display: inline-flex; align-items: center; gap: .375rem;
    color: var(--yazi-2); font-style: italic;
  }

  .oniz-ozet {
    flex: 1; display: grid; align-content: center; justify-items: center; gap: .5rem;
    padding: 1.5rem; text-align: center;
  }
  .oniz-ozet strong { font-size: .9375rem; color: var(--yazi); }
  .oniz-ozet .bos { padding: 0; }

  .altlik {
    flex: none; padding: .4375rem 1rem; border-top: 1px solid var(--kenar-ince);
    background: var(--yuzey-1); font-size: .75rem; color: var(--yazi-2);
  }

  @media (max-width: 759px) {
    .genislet-dugme, .onizleme { display: none; }
    .palet.genis { width: min(560px, calc(100vw - 32px)); }
    .palet.genis .liste { flex: 1; max-width: none; }
  }
</style>
