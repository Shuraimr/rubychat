<!--
  Root: decides between loading, login and the main shell. The shell is chosen by the SHAPE of the screen (design section 15):
   - tablet  (width >= 768 and height > 500): 76px labelled rail | 360px list (380px from 1180px) | room, side by side
   - landscape phone (height <= 500, even if 844px wide): 72px labelled rail | ~300px list | room, side by side (swipe-right / back still closes the room)
   - portrait phone: three swipeable main pages + floating bottom dock (hidden inside a room)
  Kök: yükleniyor, giriş ve ana kabuk arasında karar verir. Kabuk ekranın ŞEKLİNE göre seçilir (tasarım bölüm 15):
   - tablet (genişlik >= 768 ve yükseklik > 500): 76px etiketli ray | 360px liste (1180px'ten sonra 380px) | oda, yan yana
   - yatay telefon (yükseklik <= 500, 844px geniş olsa bile): 72px etiketli ray | ~300px liste | oda, yan yana (sağa kaydırma / geri tuşu odayı kapatır)
   - dikey telefon: kaydırılabilir üç ana sayfa + yüzen alt dock (odada gizli)
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { alanaKatil, uygulamadanCik } from "./lib/api/komutlar";
  import type { BulunanOda } from "./lib/api/tipler";
  import { masaustuLinux } from "./lib/pano";
  import { altYeriOlc } from "./lib/alt-yer";
  import { kayCik, kayGir } from "./lib/gecis";
  import { klavyeyiIzle } from "./lib/klavye";
  import { dokunmaBaslat, titret } from "./lib/dokunma";
  import { fareGezinmeBaslat } from "./lib/fareGezinme";
  import { capaBaslat } from "./lib/capa";
  import Acilis from "./lib/bilesenler/Acilis.svelte";
  import KullaniciKarti from "./lib/bilesenler/KullaniciKarti.svelte";
  import IstekKatmani from "./lib/bilesenler/IstekKatmani.svelte";
  import HizliGecis from "./lib/bilesenler/HizliGecis.svelte";
  import BaglantiOnay from "./lib/bilesenler/BaglantiOnay.svelte";
  import OdaKesfet from "./lib/bilesenler/OdaKesfet.svelte";
  import OdaOnizlemeSayfasi from "./lib/bilesenler/OdaOnizlemeSayfasi.svelte";
  import { matrisBaglanti, matrisBaglantiBaslat } from "./lib/durum/matrisBaglanti.svelte";
  import { kabuk } from "./lib/durum/kabuk.svelte";
  import { paketler } from "./lib/emoji/paketler.svelte";
  import { tercihler } from "./lib/durum/tercihler.svelte";
  import AramaCubugu from "./lib/bilesenler/AramaCubugu.svelte";
  import EcCubuk from "./lib/arama-ec/EcCubuk.svelte";
  import EcKatilSeridi from "./lib/arama-ec/EcKatilSeridi.svelte";
  import EcKatman from "./lib/arama-ec/EcKatman.svelte";
  import UstBildirim from "./lib/bilesenler/UstBildirim.svelte";
  import Bildirim from "./lib/bilesenler/Bildirim.svelte";
  import BildirimPaneli from "./lib/bilesenler/BildirimPaneli.svelte";
  import GuncellemeSayfasi from "./lib/bilesenler/GuncellemeSayfasi.svelte";
  import KurulumRaporu from "./lib/bilesenler/KurulumRaporu.svelte";
  import Tur from "./lib/bilesenler/Tur.svelte";
  import SifrelemeKatmani from "./lib/bilesenler/SifrelemeKatmani.svelte";
  import AltDock from "./lib/bilesenler/AltDock.svelte";
  import Sayfalayici from "./lib/bilesenler/Sayfalayici.svelte";
  import SohbetAramasi from "./lib/ekranlar/SohbetAramasi.svelte";
  import { geriKaydir } from "./lib/geriKaydir";
  import OdaSeridi from "./lib/bilesenler/OdaSeridi.svelte";
  import Ikon from "./lib/bilesenler/Ikon.svelte";
  import OdaPaleti from "./lib/bilesenler/OdaPaleti.svelte";
  import KlavyeYardim from "./lib/bilesenler/KlavyeYardim.svelte";
  import { duzen } from "./lib/durum/duzen.svelte";
  import { klavye, klavyeBaslat } from "./lib/klavyeKisayol.svelte";
  import { perdeCik, perdeGir } from "./lib/gecis";
  import Ray from "./lib/bilesenler/Ray.svelte";
  import Arama from "./lib/ekranlar/Arama.svelte";
  import Alanlar from "./lib/ekranlar/Alanlar.svelte";
  import Ben from "./lib/ekranlar/Ben.svelte";
  import Giris from "./lib/ekranlar/Giris.svelte";
  import Oda from "./lib/ekranlar/Oda.svelte";
  import OdaAyarlari from "./lib/ekranlar/OdaAyarlari.svelte";
  import Sohbetler from "./lib/ekranlar/Sohbetler.svelte";
  import { alanlar } from "./lib/durum/alanlar.svelte";
  import { arama } from "./lib/durum/arama.svelte";
  import { ayarlar } from "./lib/durum/ayarlar.svelte";
  import { bildirim } from "./lib/durum/bildirim.svelte";
  import { bildirimMerkezi } from "./lib/durum/bildirimMerkezi.svelte";
  import { gezinme, type Sekme } from "./lib/durum/gezinme.svelte";
  import { guncelleme } from "./lib/durum/guncelleme.svelte";
  import { istekAc, istekler } from "./lib/durum/istekler.svelte";
  import { kurulum, kurulumRaporuAc } from "./lib/durum/kurulum.svelte";
  import { odalar } from "./lib/durum/odalar.svelte";
  import { oturum } from "./lib/durum/oturum.svelte";
  import { sifreleme } from "./lib/durum/sifreleme.svelte";
  import { onYukle } from "./lib/durum/onYukle.svelte";
  import { zamanHazir } from "./lib/api/olaylar";
  import { zaman } from "./lib/durum/zaman.svelte";
  import { t } from "./lib/i18n";
  import { hataBildir } from "./lib/mesaj/eylemler";
  import { arkaPlanAyarla, bildirimSistemiBaslat } from "./lib/bildirim-sistem";
  import { ustBildirim } from "./lib/durum/ustBildirim.svelte";

  const ANA: Sekme[] = ["sohbetler", "alanlar", "ben"];
  let ekran: HTMLDivElement | undefined = $state();
  const dockGorunur = $derived(gezinme.sekil === "telefon" && !gezinme.acikOdaId && !gezinme.benAlt && !gezinme.odaAyar && !kabuk.aramaOdakta);
  // Selected directory room preview shown in the desktop room column while on the Explore tab.
  // Keşfet sekmesindeyken masaüstü oda sütununda gösterilen seçili dizin odası önizlemesi.
  let kesfetSecili = $state<{ oda: BulunanOda; sunucu: string } | null>(null);
  let kesfetKatiliyorId = $state<string | null>(null);
  const kesfetAcik = $derived(gezinme.sekme === "kesfet");
  const cekmeceAcik = $derived(duzen.kompakt && duzen.cekmece && !kesfetAcik);

  async function kesfetKatil(o: BulunanOda, sunucu: string) {
    const ad = o.ad ?? o.adres ?? o.odaId;
    if (o.uye) {
      kesfetSecili = null;
      if (o.alan) {
        gezinme.sekmeSec("alanlar");
        alanlar.ac(o.odaId, ad);
      } else gezinme.odaAc(o.odaId);
      return;
    }
    if (o.katilim === "kapi") {
      istekAc({ kimlik: o.adres ?? o.odaId, ad, via: [sunucu] });
      return;
    }
    kesfetKatiliyorId = o.odaId;
    try {
      const id = await alanaKatil(o.adres ?? o.odaId, [sunucu]);
      kesfetSecili = null;
      if (o.alan) {
        gezinme.sekmeSec("alanlar");
        alanlar.ac(id, ad);
      } else gezinme.odaAc(id);
    } catch (err) {
      hataBildir(err);
    } finally {
      kesfetKatiliyorId = null;
    }
  }

  onMount(() => {
    // Register keyboard shortcuts before gezinme so Esc drops message selection before closing a room on narrow viewports.
    // Klavye kısayollarını gezinme'den önce kaydet; dar ekranda Esc odayı kapatmadan önce mesaj seçimini bıraksın.
    const birak = [altYeriOlc(), klavyeyiIzle(), dokunmaBaslat(), capaBaslat(), klavyeBaslat(), matrisBaglantiBaslat(), fareGezinmeBaslat()];
    // Desktop: Ctrl+Q quits for real, since the close button only hides the window while it runs in the background.
    // Masaüstü: Ctrl+Q gerçekten çıkar; arka planda çalışırken kapatma düğmesi pencereyi yalnızca gizler.
    if (masaustuLinux) {
      const cik = (e: KeyboardEvent) => {
        if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "q") {
          e.preventDefault();
          void uygulamadanCik().catch(() => {});
        }
      };
      window.addEventListener("keydown", cik);
      birak.push(() => window.removeEventListener("keydown", cik));
    }
    // Desktop: Ctrl+= / Ctrl+- / Ctrl+0 scale only the chat area, without zooming the rest of the app.
    // Masaüstü: Ctrl+= / Ctrl+- / Ctrl+0 uygulamanın geri kalanını büyütmeden yalnızca sohbet alanını ölçekler.
    if (window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) {
      const sohbetOlcekle = (e: KeyboardEvent) => {
        if (e.defaultPrevented || !oturum.ben || !(e.ctrlKey || e.metaKey) || e.altKey) return;
        let degisti = false;
        if (e.key === "=" || e.key === "+" || e.code === "Equal" || e.code === "NumpadAdd") {
          e.preventDefault();
          ayarlar.sohbetOlcekAdim(1);
          degisti = true;
        } else if (e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") {
          e.preventDefault();
          ayarlar.sohbetOlcekAdim(-1);
          degisti = true;
        } else if (!e.shiftKey && (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0")) {
          e.preventDefault();
          ayarlar.sohbetOlcekSifirla();
          degisti = true;
        }
        if (degisti) bildirim.goster(t("gorunum.sohbetBoyutuBildirim", { yuzde: Math.round(ayarlar.sohbetOlcek * 100) }), 1400);
      };
      window.addEventListener("keydown", sohbetOlcekle);
      birak.push(() => window.removeEventListener("keydown", sohbetOlcekle));
    }
    gezinme.baslat();
    oturum.baslat();
    return () => birak.forEach((f) => f());
  });

  // Keep the likely next rooms warm (see onYukle). · Sıradaki muhtemel odaları sıcak tut (bkz. onYukle).
  $effect(() => {
    if (!oturum.ben) return;
    const birak = untrack(() => onYukle.baslat());
    const abone = zamanHazir((g) => zaman.hazirla(g));
    return () => {
      birak();
      void abone.then((f) => f());
    };
  });
  $effect(() => {
    onYukle.guncelle(odalar.liste, odalar.ilkListeGeldi && odalar.esitleme.durum === "calisiyor");
  });

  // Drain any Matrix link that arrived before login or initial sync finished · Giriş ya da ilk eşitleme bitmeden gelen Matrix bağlantısını işle
  $effect(() => {
    if (matrisBaglanti.hazir && matrisBaglanti.bekleyen) {
      untrack(() => matrisBaglanti.bekleyeniIsle());
    }
  });

  // Mirror pending incoming invitations into the notification center without duplicating them.
  // Bekleyen gelen davetleri yinelemeden bildirim merkezine yansıt.
  $effect(() => {
    if (!oturum.ben || !istekler.yuklendi) return;
    const gelen = istekler.veri.gelen;
    untrack(() => bildirimMerkezi.davetleriEsle(gelen));
  });

  // Start/stop room-list tracking with the login state. · Oda listesi izlemesini giriş durumuna göre başlat/durdur.
  $effect(() => {
    if (oturum.ben) {
      // An account is already signed in (e.g. upgraded from an older build): mark the first-run tour as seen.
      // Zaten giriş yapılmış bir hesap var (ör. eski sürümden yükseltme): ilk kurulum turunu görüldü say.
      if (!untrack(() => tercihler.d.turGoruldu)) untrack(() => tercihler.yaz("turGoruldu", true));
      odalar.baslat(oturum.ben.kullaniciId);
      untrack(() => oturum.profilYenile());
      arama.baslat(oturum.ben.kullaniciId);
      // untrack: starting listeners must not make this effect depend on the encryption state. · untrack: dinleyici başlatmak bu etkiyi şifreleme durumuna bağımlı yapmasın.
      const cihazId = oturum.ben.cihazId;
      untrack(() => void sifreleme.baslat(cihazId));
      // System + in-app notifications live as long as the session. · Sistem + uygulama içi bildirimler oturum boyunca yaşar.
      untrack(() => arkaPlanAyarla(tercihler.d.arkaPlan));
      const guncellemeBirak = untrack(() => guncelleme.otomatikBaslat());
      let birak: (() => void) | null = null;
      let bitti = false;
      untrack(() =>
        bildirimSistemiBaslat({
          odaAc: (id) => gezinme.odaAc(id),
          uygulamaIci: (b) => {
            // In-app banner follows Ayarlar › Bildirimler (on/off, preview, vibration). · Uygulama içi şerit Ayarlar › Bildirimler'i izler (aç/kapa, önizleme, titreşim).
            if (!tercihler.d.bildirimAcik) return;
            if (tercihler.d.bildirimTitresim) titret("dokunus");
            const metin = tercihler.d.bildirimOnizleme ? b.metin : "";
            const bahsetme = "bahsetme" in b && Boolean((b as { bahsetme?: unknown }).bahsetme);
            bildirimMerkezi.ekle({
              tur: bahsetme ? "bahsetme" : "mesaj",
              baslik: b.gonderenAd || b.odaAd,
              baglam: b.odaAd,
              metin: metin || t("ustBildirim.yeni"),
              odaId: b.odaId,
              avatarMxc: b.avatarMxc,
              harf: (b.odaAd || b.gonderenAd).charAt(0).toUpperCase() || "#",
            });
            ustBildirim.goster(tercihler.d.bildirimOnizleme ? b : { ...b, metin: "" });
          },
        })
          .then((f) => (bitti ? f() : (birak = f)))
          .catch((e) => console.error(e)),
      );
      return () => {
        bitti = true;
        birak?.();
        guncellemeBirak();
        arkaPlanAyarla(false);
        ustBildirim.kapat();
      };
    } else {
      sifreleme.durdur();
      odalar.durdur();
      arama.durdur();
      gezinme.sifirla();
      alanlar.sifirla();
      kesfetSecili = null;
      kesfetKatiliyorId = null;
      matrisBaglanti.kapat();
      zaman.bellekSil();
      onYukle.sil();
      kabuk.sifirla();
      // Only wipe persisted notifications once session restore settled (not during the pre-restore splash). · Kalıcı bildirimleri yalnızca oturum geri yükleme bittikten sonra sil (açılış öncesi değil).
      if (oturum.hazir) bildirimMerkezi.temizle();
      // The next account must not see this one's emoji and sticker packs. · Sonraki hesap bunun emoji ve çıkartma paketlerini görmemeli.
      paketler.temizle();
    }
  });
  /** Finishes or skips the first-run tour and opens the setup report once automatically. · İlk kurulum turunu bitirir/geçer ve kurulum raporunu bir kez otomatik açar. */
  function ilkTurBitir() {
    tercihler.yaz("turGoruldu", true);
    if (!tercihler.d.raporGosterildi) {
      tercihler.yaz("raporGosterildi", true);
      kurulumRaporuAc();
    }
  }
</script>

{#if !oturum.hazir}
  <!-- Splash (fades over the app once it is drawn) only while the saved session is restored; cached rooms never wait behind it. · Açılış ekranı yalnızca kayıtlı oturum geri yüklenirken; önbellekteki odalar onun arkasında beklemez. -->
  <Acilis />
{:else if !oturum.ben && !tercihler.d.turGoruldu}
  <Tur onbitir={ilkTurBitir} />
{:else if !oturum.ben}
  <Giris />
{:else}
  <div class="uygulama">
    <!-- While the phone dock is on screen the call bar is its upper storey, not a second bar. · Telefon dock'u görünürken arama çubuğu onun üst katıdır, ikinci bir çubuk değil. -->
    {#if !dockGorunur}<AramaCubugu /><EcCubuk />{/if}
    <EcKatilSeridi />
    {#if gezinme.genis}
      <div class="kabuk">
        {#if duzen.kompakt}
          <OdaSeridi />
          {#if duzen.cekmece && !kesfetAcik}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="cekmece-perde" onclick={() => duzen.cekmeceKapat()} in:perdeGir out:perdeCik></div>
          {/if}
        {:else if !duzen.listeGizli || kesfetAcik}
          <Ray />
        {/if}
        {#if duzen.kompakt ? kesfetAcik || duzen.cekmece || (!gezinme.acikOdaId && !gezinme.odaAyar) : !duzen.listeGizli || kesfetAcik}
          <section
            class="liste-sutunu"
            class:cekmece={cekmeceAcik}
            class:sohbet-cekmece={cekmeceAcik && gezinme.sekme === "sohbetler"}
            class:dolu={duzen.kompakt && !kesfetAcik && !gezinme.acikOdaId && !gezinme.odaAyar}
            class:kesfet-sabit={duzen.kompakt && kesfetAcik}
          >
            {#if cekmeceAcik}
              <button
                type="button"
                class="cekmece-kapat"
                aria-label={t("palet.komutListeGizle")}
                title="{t("palet.komutListeGizle")} (Ctrl+B)"
                onclick={() => duzen.cekmeceKapat()}
              >
                <Ikon ad="yanPanel" boyut={20} />
              </button>
            {/if}
            {#if gezinme.sekme === "sohbetler"}
              <Sohbetler />
            {:else if gezinme.sekme === "alanlar"}
              <Alanlar />
            {:else if gezinme.sekme === "kesfet"}
              <OdaKesfet gomulu seciliId={kesfetSecili?.oda.odaId ?? null} onsec={(oda, sunucu) => (kesfetSecili = { oda, sunucu })} />
            {:else}
              <Ben />
            {/if}
          </section>
        {/if}
        <section class="oda-sutunu" class:yok={duzen.kompakt && !kesfetAcik && !gezinme.acikOdaId && !gezinme.odaAyar}>
          {#if kesfetAcik && kesfetSecili}
            {#key kesfetSecili.oda.odaId}
              <OdaOnizlemeSayfasi
                gomulu
                oda={kesfetSecili.oda}
                mesgul={kesfetKatiliyorId === kesfetSecili.oda.odaId}
                onkatil={() => {
                  if (kesfetSecili) void kesfetKatil(kesfetSecili.oda, kesfetSecili.sunucu);
                }}
                onkapat={() => (kesfetSecili = null)}
              />
            {/key}
          {:else if gezinme.acikOdaId}
            {#key gezinme.acikOdaId}<Oda odaId={gezinme.acikOdaId} />{/key}
          {:else}
            <div class="bos"><p>{t("oda.sec")}</p></div>
          {/if}
          {#if gezinme.odaAyar}
            {#key gezinme.odaAyar.odaId}<OdaAyarlari hedef={gezinme.odaAyar} />{/key}
          {/if}
          {#if arama.gorunur && arama.ekranAcik}<Arama />{/if}
        </section>
      </div>
    {:else if gezinme.yatay}
      <!-- Landscape phone: labelled compact rail + ~300px list + room side by side; opening a room never hides the list, and swipe-right / back still closes it. -->
      <!-- Yatay telefon: etiketli kompakt ray + ~300px liste + oda yan yana; oda açılınca liste gizlenmez, sağa kaydırma ve geri tuşu odayı kapatır. -->
      <div class="telefon yatay">
        <Ray kompakt />
        <section class="liste-sutunu yatay-liste">
          {#if gezinme.sekme === "sohbetler"}
            <Sohbetler />
          {:else if gezinme.sekme === "alanlar"}
            <Alanlar />
          {:else if gezinme.sekme === "kesfet"}
            <OdaKesfet gomulu />
          {:else}
            <Ben />
          {/if}
        </section>
        <section class="oda-sutunu yatay-oda">
          <div class="bos" aria-hidden={!!gezinme.acikOdaId || undefined} inert={!!gezinme.acikOdaId}><p>{t("oda.sec")}</p></div>
          {#if gezinme.acikOdaId}
            <div class="yatay-oda-katman" in:kayGir out:kayCik use:geriKaydir={{ etkin: () => gezinme.ustKatmanMi("oda"), geri: () => gezinme.odaKapat() }}>
              {#key gezinme.acikOdaId}<Oda odaId={gezinme.acikOdaId} />{/key}
            </div>
          {/if}
          {#if gezinme.odaAyar}
            {#key gezinme.odaAyar.odaId}<OdaAyarlari hedef={gezinme.odaAyar} />{/key}
          {/if}
        </section>
      </div>
      {#if arama.gorunur && arama.ekranAcik}<Arama />{/if}
    {:else}
      <!-- Portrait phone: the list stays underneath (moves 25% left); the room slides in over it from the right and a swipe to the right closes it. -->
      <!-- Dikey telefon: liste altta kalır (%25 sola kayar); oda üstüne sağdan girer, sağa kaydırınca kapanır. -->
      <div class="telefon">
        <div class="ekran dikey" class:itildi={!!gezinme.acikOdaId || !!gezinme.odaAyar} bind:this={ekran} inert={!!gezinme.acikOdaId || !!gezinme.odaAyar}>
          <!-- Portrait phone: the three main pages side by side; swipe or use the dock. · Dikey telefon: üç ana sayfa yan yana; kaydır ya da dock'u kullan. -->
          <Sayfalayici sayfalar={ANA} secili={gezinme.sekme} sec={(id) => { gezinme.sekmeSec(id as Sekme); kabuk.altGizli = false; titret(6); }} ilerle={(f) => (kabuk.ilerleme = f)} kilitli={!!gezinme.benAlt || !!gezinme.odaAyar || kabuk.aramaOdakta || (gezinme.sekme === "alanlar" && alanlar.yigin.length > 0)}>
            {#snippet sayfa(id)}
              {#if id === "sohbetler"}<Sohbetler />{:else if id === "alanlar"}<Alanlar />{:else}<Ben />{/if}
            {/snippet}
          </Sayfalayici>
          <SohbetAramasi dock />
          <AltDock gizli={!dockGorunur} />
        </div>
        {#if gezinme.acikOdaId}
          <div class="oda-katman" in:kayGir out:kayCik use:geriKaydir={{ etkin: () => gezinme.ustKatmanMi("oda"), geri: () => gezinme.odaKapat(), altta: () => ekran }}>
            {#key gezinme.acikOdaId}<Oda odaId={gezinme.acikOdaId} />{/key}
          </div>
        {/if}
        {#if gezinme.odaAyar}
          {#key gezinme.odaAyar.odaId}<OdaAyarlari hedef={gezinme.odaAyar} />{/key}
        {/if}
      </div>
      {#if arama.gorunur && arama.ekranAcik}<Arama />{/if}
    {/if}
  </div>
{/if}

<!-- Encryption sheets (verification, recovery key, ...) float above everything else. · Şifreleme sayfaları (doğrulama, kurtarma anahtarı...) her şeyin üstünde durur. -->
{#if oturum.ben}<SifrelemeKatmani />{/if}
<!-- Element Call layer: outside .uygulama so it covers everything; stays mounted while minimised. · Element Call katmanı: her şeyi kaplasın diye .uygulama dışında; küçültülünce de takılı kalır. -->
{#if oturum.ben}<EcKatman />{/if}
<KullaniciKarti />
{#if oturum.ben}<IstekKatmani />{/if}
{#if oturum.ben && matrisBaglanti.onizleme}
  <OdaOnizlemeSayfasi
    oda={matrisBaglanti.onizleme.oda}
    kimlik={matrisBaglanti.onizleme.kimlik}
    yukleniyor={matrisBaglanti.onizleme.yukleniyor}
    onizlemeYok={matrisBaglanti.onizleme.hata}
    mesgul={matrisBaglanti.onizleme.katiliyor}
    onkatil={() => matrisBaglanti.katil()}
    onkapat={() => matrisBaglanti.kapat()}
  />
{/if}
<BaglantiOnay />
{#if oturum.ben}<HizliGecis />{/if}
{#if oturum.ben && klavye.palet}<OdaPaleti />{/if}
{#if klavye.yardim}<KlavyeYardim />{/if}
{#if oturum.ben}<BildirimPaneli />{/if}
{#if oturum.ben}<UstBildirim />{/if}
{#if kurulum.turAcik}<Tur tekrar onbitir={() => kurulum.turKapat()} />{/if}
<KurulumRaporu />
<GuncellemeSayfasi />
<Bildirim />

<style>
  .uygulama { height: 100%; display: flex; flex-direction: column; min-height: 0; }
  .kabuk { --serit-en: max(76px, 4.75rem); position: relative; flex: 1; min-height: 0; display: flex; }
  .liste-sutunu { width: 360px; flex: none; min-width: 0; border-right: 1px solid var(--kenar-ince); background: var(--zemin); display: flex; flex-direction: column; }
  @media (min-width: 1180px) { .liste-sutunu { width: 380px; } }
  /* Compact: the list slides over the room beside the strip; without a room it takes the room's place. · Kompakt: liste şeridin yanında odanın üstüne gelir; oda yoksa onun yerini alır. */
  .liste-sutunu.cekmece { position: absolute; z-index: 5; top: 0; bottom: 0; left: var(--serit-en, 76px); width: min(380px, calc(100% - var(--serit-en, 76px) - 32px)); box-shadow: 8px 0 24px rgb(0 0 0 / .25); animation: cekmece-gel var(--sure-orta) var(--egri-ac); }
  /* Drawer close button sits on the right side of the drawer header; leave space so header actions never collide. */
  /* Çekmece kapatma düğmesi çekmece başlığının sağında durur; başlık eylemleriyle çakışmaması için yer bırakılır. */
  .cekmece-kapat { position: absolute; z-index: 4; top: calc(env(safe-area-inset-top) + .75rem); right: .75rem; width: 44px; height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; background: var(--yuzey-2); color: var(--yazi-2); }
  @media (hover: hover) { .cekmece-kapat:hover { background: var(--yuzey-3); color: var(--yazi); } }
  .cekmece-kapat:active { background: var(--yuzey-3); }
  .liste-sutunu.cekmece :global(header.ust), .liste-sutunu.cekmece :global(header.baslik) { padding-right: calc(.75rem + 44px + 8px); }
  :global([data-yogunluk="kompakt"]) .liste-sutunu.sohbet-cekmece > .cekmece-kapat { top: calc(env(safe-area-inset-top) + .5rem); }
  @keyframes cekmece-gel { from { transform: translate3d(-32px, 0, 0); opacity: 0; } }
  .liste-sutunu.dolu { flex: 1; width: auto; border-right: 0; }
  /* Compact Explore: permanent 400px directory column beside the strip (never a drawer). · Kompakt Keşfet: şeridin yanında kalıcı 400px dizin sütunu (çekmece değil). */
  .liste-sutunu.kesfet-sabit { width: min(400px, 46vw); }
  .cekmece-perde { position: absolute; z-index: 4; inset: 0; background: color-mix(in srgb, var(--zemin) 55%, transparent); }
  .oda-sutunu.yok { display: none; }
  .oda-sutunu { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--zemin); }
  .telefon { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  /* Landscape phone: rail on the left, ~300px list and room side by side. · Yatay telefon: solda ray, ~300px liste ve oda yan yana. */
  .telefon.yatay { flex-direction: row; }
  .liste-sutunu.yatay-liste { width: min(300px, 42vw); }
  .yatay-oda { overflow: hidden; padding-right: env(safe-area-inset-right); }
  .yatay-oda-katman { touch-action: pan-y; position: absolute; inset: 0; padding-right: env(safe-area-inset-right); background: var(--zemin); display: flex; flex-direction: column; }
  /* No z-index on purpose: a stacking context here would trap the context menu's highlighted message under its own scrim. */
  /* Bilerek z-index yok: burada bir yığın bağlamı, bağlam menüsünün vurgulu mesajını kendi perdesinin altında hapseder. */
  .oda-katman { touch-action: pan-y; box-shadow: -8px 0 24px rgb(0 0 0 / .25); position: absolute; inset: 0; background: var(--zemin); display: flex; flex-direction: column; }
  .ekran { position: relative; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; transition: transform var(--sure-ekran) var(--egri-ac); }
  .ekran[inert] :global(*) { animation-play-state: paused !important; }
  .ekran.itildi { transform: translate3d(-25%, 0, 0); }
  .ekran.dikey { --dock-yer: calc(92px + env(safe-area-inset-bottom)); }
  .bos { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--yazi-2); padding: 24px; text-align: center; }
</style>
