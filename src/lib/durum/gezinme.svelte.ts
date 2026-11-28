// Navigation state: which tab and which room are open, the screen SHAPE (phone / landscape phone / tablet), and the LAYER STACK
// that makes the Android back button (and Escape) close the top-most thing instead of leaving the app.
// Gezinme durumu: hangi sekme ve hangi oda açık, ekranın ŞEKLİ (telefon / yatay telefon / tablet) ve Android geri tuşunun
// (ile Escape'in) uygulamadan çıkmak yerine en üstteki şeyi kapatmasını sağlayan KATMAN YIĞINI.
import { arama } from "./arama.svelte";

export type Sekme = "sohbetler" | "alanlar" | "kesfet" | "ben";
/** Sub-pages under "Ben" · "Ben" altındaki alt sayfalar */
export type BenAlt = "gorunum" | "sohbet" | "bildirimler" | "klavye" | "guvenlik" | "guncellemeler" | "hakkinda" | "profil" | "hesap";
/** Target for the shared room / space settings screen · Ortak oda / alan ayarları ekranının hedefi */
export interface OdaAyarHedefi {
  odaId: string;
  /** Space id when opened from inside a space (enables the "Space members" join rule) · Bir alanın içinden açıldıysa alan kimliği ("Alan üyeleri" kuralını açar) */
  alanId?: string;
  /** Name of the space above, if known · Yukarıdaki alanın adı (biliniyorsa) */
  alanAd?: string;
  /** Hint for the initial header title before settings finish loading · Ayarlar yüklenmeden önceki ilk başlık için ipucu */
  alanMi?: boolean;
  /** Callback after a setting changes or the user leaves, so the caller can refresh · Bir ayar değişince ya da ayrılınca çağıranı yenilemek için */
  degisti?: () => void;
}
/**
 * Layout by SHAPE, not by width alone (design section 15):
 *  - yatay   = height <= 500px (a landscape phone, even if it is 844px wide): 64px rail, room replaces the list
 *  - tablet  = width >= 768px and height > 500px: rail + list + room side by side
 *  - telefon = everything else (portrait phone): one screen at a time + bottom menu
 * Düzen yalnızca genişliğe değil ŞEKLE göre (tasarım bölüm 15): yatay = yükseklik <= 500px (844px geniş olsa bile yatay telefon),
 * tablet = genişlik >= 768px ve yükseklik > 500px, telefon = geri kalan (dikey telefon).
 */
export type Sekil = "telefon" | "yatay" | "tablet";

const YATAY_SORGU = "(max-height: 500px)";
const TABLET_SORGU = "(min-width: 768px) and (min-height: 501px)";
const GECMIS_SINIR = 50;

interface AnlikGoruntu {
  sekme: Sekme;
  acikOdaId: string | null;
  benAlt: BenAlt | null;
}

interface Katman {
  id: number;
  /** Close it. Return false to refuse (a step the user must finish): the history entry is pushed again. · Kapat. false dönerse reddeder (kullanıcının bitirmesi gereken adım): history girdisi yeniden eklenir. */
  kapat: () => void | false;
  /** Has its history entry been pushed yet? (pushes wait while a back() is in flight) · history girdisi eklendi mi? (back() sürerken ekleme bekler) */
  eklendi: boolean;
}

class Gezinme {
  sekme = $state<Sekme>("sohbetler");
  acikOdaId = $state<string | null>(null);
  benAlt = $state<BenAlt | null>(null);
  odaAyar = $state<OdaAyarHedefi | null>(null);
  sekil = $state<Sekil>("telefon");
  /** Side-by-side layout (tablet and bigger) · Yan yana düzen (tablet ve üstü) */
  genis = $derived(this.sekil === "tablet");
  yatay = $derived(this.sekil === "yatay");

  #katmanlar: Katman[] = [];
  #sayac = 0;
  /** How many history.back() calls we made that have not produced their popstate yet · Yaptığımız ama popstate'i henüz gelmemiş history.back() sayısı */
  #geriBekleyen = 0;
  #bekleyenEklemeler: { id: number; ekle: () => void }[] = [];
  #odaKatmani = 0;
  #benAltKatmani = 0;
  #odaAyarKatmani = 0;
  #sekmeKatmani = 0;
  /** In-app back/forward navigation history stacks (desktop mouse buttons & Alt+Arrows) · Uygulama içi geri/ileri gezinme geçmişi yığınları (masaüstü fare tuşları ve Alt+Oklar) */
  #geriYigin: AnlikGoruntu[] = [];
  #ileriYigin: AnlikGoruntu[] = [];
  /** Nesting counter that suppresses history recording during internal sub-calls and history replay · İç alt çağrılar ve geçmiş uygulaması sırasında kayıt yapmayı durduran iç içe sayaç */
  #gecmisDuraklat = 0;

  baslat() {
    // A reload keeps the old entry's layer id; new ids start from 1 again, so forget it. · Yeniden yükleme eski girdinin katman kimliğini korur; yeni kimlikler 1'den başlar, unut.
    if (history.state) history.replaceState(null, "");
    const yatay = window.matchMedia(YATAY_SORGU);
    const tablet = window.matchMedia(TABLET_SORGU);
    const guncelle = () => {
      this.sekil = yatay.matches ? "yatay" : tablet.matches ? "tablet" : "telefon";
      // Portrait phone has no Explore tab: fall back to Spaces when entering portrait phone.
      // Dikey telefonda Keşfet sekmesi yok: dikey telefona geçilirken Alanlar'a düş.
      if (this.sekil === "telefon" && this.sekme === "kesfet") this.#sekmeyeGec("alanlar");
    };
    guncelle();
    yatay.addEventListener("change", guncelle);
    tablet.addEventListener("change", guncelle);

    // Android back button / swipe-back = history pop. The call screen has its own entry (arama.svelte.ts); every other layer
    // pushes an entry with {kat: id}: a pop closes every layer whose id is higher than the entry we landed on.
    // Android geri tuşu / kaydırma = history pop. Arama ekranının kendi girdisi var (arama.svelte.ts); diğer her katman {kat: id}
    // girdisi ekler: bir pop, ulaştığımız girdiden daha yüksek kimlikli her katmanı kapatır.
    window.addEventListener("popstate", () => {
      if (this.#geriBekleyen > 0) {
        // Our own back(): the layer was already released, nothing to close. · Kendi back()'imiz: katman zaten bırakılmış, kapatılacak bir şey yok.
        this.#geriBekleyen--;
        if (this.#geriBekleyen === 0) this.#ekleBosalt();
        return;
      }
      const s = history.state as { kat?: number; arama?: boolean } | null;
      if (arama.ekranAcik && !s?.arama) {
        arama.ekranGizle();
        return;
      }
      if (s?.arama) return;
      const simdi = s?.kat ?? 0;
      let kapanan = 0;
      while (this.#katmanlar.length > 0 && this.#katmanlar[this.#katmanlar.length - 1].id > simdi) {
        const ust = this.#katmanlar.pop()!;
        if (ust.kapat() === false) {
          // Refused: put it back and restore its history entry so back does nothing visible. · Reddedildi: geri koy ve history girdisini yenile; geri hiçbir şey göstermesin.
          this.#katmanlar.push(ust);
          history.pushState({ kat: ust.id }, "");
          kapanan = -1;
          break;
        }
        kapanan++;
      }
      // We closed layers and now rest on an entry whose layer is gone (a sheet that closed while a newer layer was already stacked on
      // top of it leaves such an orphan): one press must not need a second one that shows nothing, so step over it with our own back().
      // Katman(lar) kapattık ve şimdi katmanı artık olmayan bir girdide duruyoruz (üstüne yeni katman binmişken kapanan bir sayfa
      // böyle yetim girdi bırakır): bir basış, hiçbir şey göstermeyen ikinci bir basışa muhtaç olmamalı; kendi back()'imizle atla.
      if (kapanan > 0 && simdi > 0 && !this.#katmanlar.some((k) => k.id === simdi)) this.#geri();
      // We landed on the entry of a layer that already closed while it was not on top (its entry could not be removed then).
      // Such a press would do nothing visible: close the top layer instead, or go on back when none is open.
      // Üstte değilken kapanmış bir katmanın girdisine düştük (o zaman girdisi silinemezdi). Böyle bir basış görünür hiçbir
      // şey yapmazdı: bunun yerine en üstteki katmanı kapat, açık katman yoksa geri gitmeyi sürdür.
      if (kapanan === 0 && simdi > 0 && !this.#katmanlar.some((k) => k.id === simdi)) {
        const ust = this.#katmanlar.pop();
        if (!ust) history.back();
        else if (ust.kapat() === false) this.#katmanlar.push(ust);
      }
    });

    // Escape (desktop) does what back does. · Escape (masaüstü) geri tuşunun yaptığını yapar.
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const ust = this.#katmanlar[this.#katmanlar.length - 1];
      if (!ust) return;
      e.preventDefault();
      this.#geriGit(ust);
    });
  }

  /**
   * Open a layer (room on phones, sheet, dialog, context menu, full-screen media flow, settings sub-page).
   * Returns its id; give it to katmanBirak() when the layer closes by itself (button, finished flow).
   * Bir katman aç (telefonda oda, sayfa, pencere, bağlam menüsü, tam ekran medya akışı, ayar alt sayfası).
   * Kimliğini döndürür; katman kendiliğinden kapanınca (düğme, biten akış) katmanBirak()'a ver.
   */
  katmanAc(kapat: () => void | false): number {
    const k: Katman = { id: ++this.#sayac, kapat, eklendi: false };
    this.#katmanlar.push(k);
    const ekle = () => {
      history.pushState({ kat: k.id }, "");
      k.eklendi = true;
    };
    // A back() still in flight would pop the entry we are about to push: wait for its popstate.
    // Süren bir back() az sonra ekleyeceğimiz girdiyi silerdi: onun popstate'ini bekle.
    if (this.#geriBekleyen > 0) this.#bekleyenEklemeler.push({ id: k.id, ekle });
    else ekle();
    return k.id;
  }

  /** The layer closed by itself: drop it and, if it is the top one, remove its history entry. · Katman kendiliğinden kapandı: bırak ve en üstteyse history girdisini sil. */
  katmanBirak(id: number) {
    const i = this.#katmanlar.findIndex((k) => k.id === id);
    if (i < 0) return; // already closed by a pop · pop ile zaten kapanmış
    const [k] = this.#katmanlar.splice(i, 1);
    if (!k.eklendi) {
      // Its push never ran: cancel it. · Eklemesi hiç çalışmadı: iptal et.
      this.#bekleyenEklemeler = this.#bekleyenEklemeler.filter((b) => b.id !== id);
      return;
    }
    if (i === this.#katmanlar.length) this.#geri();
  }

  /** UI-initiated close of a layer (✕, scrim): back() makes the pop handler do the closing. · Arayüzden katman kapatma (✕, perde): back() kapatma işini pop işleyicisine yaptırır. */
  #geriGit(k: Katman) {
    // Close it HERE, then consume its history entry with our own back() (the pop handler ignores our own pops). Leaving the
    // closing to the pop handler was a bug: it skips pops we caused, so ✕ never closed anything.
    // Katmanı BURADA kapat, sonra history girdisini kendi back()'imizle tüket (pop işleyicisi kendi pop'larımızı yok sayar).
    // Kapatmayı pop işleyicisine bırakmak hataydı: bizim yaptığımız pop'ları atlıyor, bu yüzden ✕ hiçbir şeyi kapatmıyordu.
    if (k.kapat() === false) return;
    const i = this.#katmanlar.indexOf(k);
    const enUstte = i === this.#katmanlar.length - 1;
    if (i >= 0) this.#katmanlar.splice(i, 1);
    if (!k.eklendi) this.#bekleyenEklemeler = this.#bekleyenEklemeler.filter((b) => b.id !== k.id);
    else if (enUstte) this.#geri();
  }

  #geri() {
    this.#geriBekleyen++;
    history.back();
    // Safety net: if no popstate arrives (nothing to go back to), do not wait forever. · Güvenlik ağı: popstate gelmezse sonsuza dek bekleme.
    setTimeout(() => {
      if (this.#geriBekleyen > 0) {
        this.#geriBekleyen = 0;
        this.#ekleBosalt();
      }
    }, 500);
  }

  #ekleBosalt() {
    const f = this.#bekleyenEklemeler;
    this.#bekleyenEklemeler = [];
    f.forEach((b) => b.ekle());
  }

  /** Ask the layer to close (used by ✕ buttons and scrims). · Katmanın kapanmasını iste (✕ düğmeleri ve perdeler kullanır). */
  katmanKapat(id: number) {
    const k = this.#katmanlar.find((x) => x.id === id);
    if (k) this.#geriGit(k);
  }

  sekmeSec(s: Sekme) {
    this.#gecmisle(() => {
      // Portrait phone has no Explore tab: keep it on Spaces if requested. · Dikey telefonda Keşfet sekmesi yok: istenirse Alanlar'da tut.
      const hedef: Sekme = this.sekil === "telefon" && s === "kesfet" ? "alanlar" : s;
      this.odaAyarKapat();
      this.benAltKapat();
      this.#sekmeyeGec(hedef);
      // Where a room covers the tab panels (portrait phone), leaving to a tab closes it; landscape phone keeps list and room side by side.
      // Odanın sekme panellerini örttüğü yerde (dikey telefon) sekmeye geçmek odayı kapatır; yatay telefonda liste ve oda yan yana kalır.
      if (this.sekil === "telefon") this.odaKapat();
    });
  }

  /**
   * On phones any main page other than Sohbetler is one back-button layer: back returns to Sohbetler instead of leaving the app.
   * Telefonda Sohbetler dışındaki her ana sayfa tek bir geri tuşu katmanıdır: geri, uygulamadan çıkmak yerine Sohbetler'e döner.
   */
  #sekmeyeGec(s: Sekme) {
    this.sekme = s;
    if (this.sekil !== "telefon") return;
    if (s === "sohbetler") this.#sekmeBirak();
    else if (!this.#sekmeKatmani) {
      this.#sekmeKatmani = this.katmanAc(() => {
        this.#sekmeKatmani = 0;
        this.#benAltKatmani = 0;
        this.benAlt = null;
        this.sekme = "sohbetler";
      });
    }
  }

  /** Is the open room / Ben sub-page / room settings the top-most layer? Then a swipe to the right may close it. · Açık oda / Ben alt sayfası / oda ayarları en üst katman mı? Öyleyse sağa kaydırma kapatabilir. */
  ustKatmanMi(hangi: "oda" | "benAlt" | "odaAyar"): boolean {
    const k = hangi === "oda" ? this.#odaKatmani : hangi === "benAlt" ? this.#benAltKatmani : this.#odaAyarKatmani;
    return !!k && this.#katmanlar.at(-1)?.id === k;
  }

  katmanUstteMi(id: number): boolean {
    return !!id && this.#katmanlar.at(-1)?.id === id;
  }

  /**
   * Open a room. `sekmeyiKoru`: stay on the current tab (a room opened from inside a space must return to that space on back,
   * not to the chat list).
   * Bir odayı aç. `sekmeyiKoru`: mevcut sekmede kal (bir alanın içinden açılan oda geri dönüşte sohbet listesine değil o alana dönmeli).
   */
  odaAc(id: string, sekmeyiKoru = false) {
    this.#gecmisle(() => {
      // Switching to a room closes any open room/space settings panel so the chat is visible · Odaya geçmek açık oda/alan ayarları panelini kapatır ki sohbet görünsün
      this.odaAyarKapat();
      // Phone: opening a room (a notification tap, a search hit) also leaves the other main page. · Telefon: oda açmak (bildirime dokunma, arama sonucu) diğer ana sayfadan da çıkarır.
      if (!sekmeyiKoru) {
        this.benAltKapat();
        this.#sekmeyeGec("sohbetler");
      }
      // Where the room replaces the list it is a layer, so the hardware back button closes it. · Oda listenin yerini aldığı yerde bir katmandır; donanım geri tuşu onu kapatır.
      if (!this.genis && !this.#odaKatmani) {
        this.#odaKatmani = this.katmanAc(() => {
          this.#odaKatmani = 0;
          this.acikOdaId = null;
        });
      }
      this.acikOdaId = id;
    });
  }

  odaKapat() {
    this.#gecmisle(() => {
      this.odaAyarKapat();
      if (this.#odaKatmani) {
        const k = this.#odaKatmani;
        this.#odaKatmani = 0;
        this.acikOdaId = null;
        this.katmanBirak(k);
      } else this.acikOdaId = null;
    });
  }

  /** Opens the shared room / space settings screen as a back-button layer · Ortak oda / alan ayarları ekranını geri tuşu katmanı olarak açar */
  odaAyarAc(hedef: OdaAyarHedefi) {
    if (this.#odaAyarKatmani) this.katmanBirak(this.#odaAyarKatmani);
    this.odaAyar = hedef;
    this.#odaAyarKatmani = this.katmanAc(() => {
      this.#odaAyarKatmani = 0;
      this.odaAyar = null;
    });
  }

  odaAyarKapat() {
    if (!this.#odaAyarKatmani) {
      this.odaAyar = null;
      return;
    }
    const k = this.#odaAyarKatmani;
    this.#odaAyarKatmani = 0;
    this.odaAyar = null;
    this.katmanBirak(k);
  }

  #sekmeBirak() {
    if (!this.#sekmeKatmani) return;
    const k = this.#sekmeKatmani;
    this.#sekmeKatmani = 0;
    this.katmanBirak(k);
  }

  benAltAc(ad: BenAlt) {
    this.#gecmisle(() => {
      this.#sekmeyeGec("ben");
      if (this.#benAltKatmani) this.katmanBirak(this.#benAltKatmani);
      this.benAlt = ad;
      this.#benAltKatmani = this.katmanAc(() => {
        this.#benAltKatmani = 0;
        this.benAlt = null;
      });
    });
  }

  benAltKapat() {
    this.#gecmisle(() => {
      if (!this.#benAltKatmani) {
        this.benAlt = null;
        return;
      }
      const k = this.#benAltKatmani;
      this.#benAltKatmani = 0;
      this.benAlt = null;
      this.katmanBirak(k);
    });
  }

  #goruntu(): AnlikGoruntu {
    return { sekme: this.sekme, acikOdaId: this.acikOdaId, benAlt: this.benAlt };
  }

  #ayniGoruntu(a: AnlikGoruntu, b: AnlikGoruntu): boolean {
    return a.sekme === b.sekme && a.acikOdaId === b.acikOdaId && a.benAlt === b.benAlt;
  }

  #geriyeEkle(g: AnlikGoruntu) {
    const son = this.#geriYigin[this.#geriYigin.length - 1];
    if (son && this.#ayniGoruntu(son, g)) return;
    this.#geriYigin.push(g);
    if (this.#geriYigin.length > GECMIS_SINIR) this.#geriYigin.shift();
  }

  #ileriyeEkle(g: AnlikGoruntu) {
    const son = this.#ileriYigin[this.#ileriYigin.length - 1];
    if (son && this.#ayniGoruntu(son, g)) return;
    this.#ileriYigin.push(g);
    if (this.#ileriYigin.length > GECMIS_SINIR) this.#ileriYigin.shift();
  }

  /** Run a navigation change while recording the previous snapshot once (nested calls and replays do not record). · Bir gezinme değişikliğini önceki görüntüyü tek kez kaydederek çalıştır (iç içe çağrılar ve tekrar oynatmalar kaydetmez). */
  #gecmisle(islem: () => void) {
    if (this.#gecmisDuraklat > 0) {
      islem();
      return;
    }
    const onceki = this.#goruntu();
    this.#gecmisDuraklat++;
    try {
      islem();
    } finally {
      this.#gecmisDuraklat--;
    }
    const sonraki = this.#goruntu();
    if (!this.#ayniGoruntu(onceki, sonraki)) {
      this.#geriyeEkle(onceki);
      this.#ileriYigin = [];
    }
  }

  /** Apply a navigation snapshot through existing methods without writing back into history. · Bir gezinme görüntüsünü geçmişe yeniden yazmadan var olan yöntemlerle uygula. */
  #goruntuUygula(hedef: AnlikGoruntu) {
    this.#gecmisDuraklat++;
    try {
      if (hedef.sekme !== this.sekme) {
        this.sekmeSec(hedef.sekme);
      } else if (!hedef.benAlt && this.benAlt) {
        this.benAltKapat();
      }
      if (hedef.acikOdaId) {
        if (hedef.acikOdaId !== this.acikOdaId) this.odaAc(hedef.acikOdaId, true);
      } else if (this.acikOdaId) {
        this.odaKapat();
      }
      if (hedef.benAlt) {
        if (hedef.benAlt !== this.benAlt) this.benAltAc(hedef.benAlt);
      } else if (this.benAlt) {
        this.benAltKapat();
      }
    } finally {
      this.#gecmisDuraklat--;
    }
  }

  /**
   * Go back: close the top-most open layer first (same as Android back / Escape); when no layer is open, step back through in-app history.
   * Geri git: önce en üstteki açık katmanı kapat (Android geri / Escape gibi); açık katman yoksa uygulama içi geçmişte bir adım geri dön.
   */
  geriGit() {
    const ust = this.#katmanlar[this.#katmanlar.length - 1];
    if (ust) {
      const onceki = this.#goruntu();
      this.#geriGit(ust);
      const sonraki = this.#goruntu();
      if (!this.#ayniGoruntu(onceki, sonraki)) {
        // A layer that is part of the snapshot closed (e.g. a Ben sub-page): keep forward history coherent and drop the matching back top.
        // Görüntünün parçası olan bir katman kapandı (ör. Ben alt sayfası): ileri geçmişi tutarlı tut ve eşleşen geri tepesini düş.
        const son = this.#geriYigin[this.#geriYigin.length - 1];
        if (son && this.#ayniGoruntu(son, sonraki)) this.#geriYigin.pop();
        this.#ileriyeEkle(onceki);
      }
      return;
    }
    const simdi = this.#goruntu();
    let hedef: AnlikGoruntu | undefined;
    while (this.#geriYigin.length > 0) {
      const aday = this.#geriYigin.pop()!;
      if (!this.#ayniGoruntu(aday, simdi)) {
        hedef = aday;
        break;
      }
    }
    if (!hedef) return;
    this.#ileriyeEkle(simdi);
    this.#goruntuUygula(hedef);
  }

  /** Go forward one step in in-app navigation history. · Uygulama içi gezinme geçmişinde bir adım ileri git. */
  ileriGit() {
    const simdi = this.#goruntu();
    let hedef: AnlikGoruntu | undefined;
    while (this.#ileriYigin.length > 0) {
      const aday = this.#ileriYigin.pop()!;
      if (!this.#ayniGoruntu(aday, simdi)) {
        hedef = aday;
        break;
      }
    }
    if (!hedef) return;
    this.#geriyeEkle(simdi);
    this.#goruntuUygula(hedef);
  }

  sifirla() {
    this.sekme = "sohbetler";
    this.acikOdaId = null;
    this.benAlt = null;
    this.odaAyar = null;
    this.#katmanlar = [];
    this.#bekleyenEklemeler = [];
    this.#geriBekleyen = 0;
    this.#odaKatmani = 0;
    this.#benAltKatmani = 0;
    this.#odaAyarKatmani = 0;
    this.#sekmeKatmani = 0;
    this.#geriYigin = [];
    this.#ileriYigin = [];
    this.#gecmisDuraklat = 0;
  }
}

export const gezinme = new Gezinme();
