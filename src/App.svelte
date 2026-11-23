<!--
  Root: decides between loading, login and the main shell. The shell is chosen by the SHAPE of the screen (design section 15):
   - tablet  (width >= 768 and height > 500): 72px labelled rail | 360px list (380px from 1180px) | room, side by side
   - landscape phone (height <= 500, even if 844px wide): 64px icon rail + full-width list; opening a room hides rail and list
   - portrait phone: one screen at a time + bottom menu (hidden inside a room)
  Kök: yükleniyor, giriş ve ana kabuk arasında karar verir. Kabuk ekranın ŞEKLİNE göre seçilir (tasarım bölüm 15):
   - tablet (genişlik >= 768 ve yükseklik > 500): 72px etiketli ray | 360px liste (1180px'ten sonra 380px) | oda, yan yana
   - yatay telefon (yükseklik <= 500, 844px geniş olsa bile): 64px simgeli ray + tam genişlik liste; oda açılınca ray ve liste gizlenir
   - dikey telefon: tek seferde tek ekran + alt menü (odada gizli)
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { altYeriOlc } from "./lib/alt-yer";
  import { kayCik, kayGir } from "./lib/gecis";
  import { klavyeyiIzle } from "./lib/klavye";
  import { dokunmaBaslat, titret } from "./lib/dokunma";
  import Acilis from "./lib/bilesenler/Acilis.svelte";
  import KullaniciKarti from "./lib/bilesenler/KullaniciKarti.svelte";
  import BaglantiOnay from "./lib/bilesenler/BaglantiOnay.svelte";
  import { kabuk } from "./lib/durum/kabuk.svelte";
  import { tercihler } from "./lib/durum/tercihler.svelte";
  import AramaCubugu from "./lib/bilesenler/AramaCubugu.svelte";
  import AltMenu from "./lib/bilesenler/AltMenu.svelte";
  import Bildirim from "./lib/bilesenler/Bildirim.svelte";
  import SifrelemeKatmani from "./lib/bilesenler/SifrelemeKatmani.svelte";
  import Ray from "./lib/bilesenler/Ray.svelte";
  import Arama from "./lib/ekranlar/Arama.svelte";
  import Alanlar from "./lib/ekranlar/Alanlar.svelte";
  import Ben from "./lib/ekranlar/Ben.svelte";
  import Giris from "./lib/ekranlar/Giris.svelte";
  import Oda from "./lib/ekranlar/Oda.svelte";
  import Sohbetler from "./lib/ekranlar/Sohbetler.svelte";
  import { arama } from "./lib/durum/arama.svelte";
  import { gezinme } from "./lib/durum/gezinme.svelte";
  import { odalar } from "./lib/durum/odalar.svelte";
  import { oturum } from "./lib/durum/oturum.svelte";
  import { sifreleme } from "./lib/durum/sifreleme.svelte";
  import { t } from "./lib/i18n";
  import { bildirimSistemiBaslat } from "./lib/bildirim-sistem";
  import { bildirim } from "./lib/durum/bildirim.svelte";

  onMount(() => {
    gezinme.baslat();
    oturum.baslat();
    const birak = [altYeriOlc(), klavyeyiIzle(), dokunmaBaslat()];
    return () => birak.forEach((f) => f());
  });

  // Start/stop room-list tracking with the login state. · Oda listesi izlemesini giriş durumuna göre başlat/durdur.
  $effect(() => {
    if (oturum.ben) {
      odalar.baslat();
      untrack(() => oturum.profilYenile());
      arama.baslat(oturum.ben.kullaniciId);
      // untrack: starting listeners must not make this effect depend on the encryption state. · untrack: dinleyici başlatmak bu etkiyi şifreleme durumuna bağımlı yapmasın.
      const cihazId = oturum.ben.cihazId;
      untrack(() => void sifreleme.baslat(cihazId));
      // System + in-app notifications live as long as the session. · Sistem + uygulama içi bildirimler oturum boyunca yaşar.
      let birak: (() => void) | null = null;
      let bitti = false;
      untrack(() =>
        bildirimSistemiBaslat({
          odaAc: (id) => gezinme.odaAc(id),
          uygulamaIci: (b) => {
            // In-app banner follows Ayarlar › Bildirimler (on/off, preview, vibration, quiet hours). · Uygulama içi şerit Ayarlar › Bildirimler'i izler (aç/kapa, önizleme, titreşim, sessiz saatler).
            if (!tercihler.d.bildirimAcik || tercihler.sessizMi()) return;
            if (tercihler.d.bildirimTitresim) titret(15);
            bildirim.goster(tercihler.d.bildirimOnizleme ? `${b.gonderenAd}: ${b.metin}` : b.gonderenAd, 4000, { eylem: { etiket: t("bildirim.ac"), calistir: () => gezinme.odaAc(b.odaId) } });
          },
        })
          .then((f) => (bitti ? f() : (birak = f)))
          .catch((e) => console.error(e)),
      );
      return () => {
        bitti = true;
        birak?.();
      };
    } else {
      sifreleme.durdur();
      odalar.durdur();
      arama.durdur();
      gezinme.sifirla();
      kabuk.sifirla();
    }
  });
</script>

{#if !oturum.hazir}
  <!-- Splash only while the saved session is restored; cached rooms never wait behind it. · Açılış ekranı yalnızca kayıtlı oturum geri yüklenirken; önbellekteki odalar onun arkasında beklemez. -->
  <Acilis />
{:else if !oturum.ben}
  <Giris />
{:else}
  <div class="uygulama">
    <AramaCubugu />
    {#if gezinme.genis}
      <div class="kabuk">
        <Ray />
        <section class="liste-sutunu">
          {#if gezinme.sekme === "sohbetler"}<Sohbetler />{:else if gezinme.sekme === "alanlar"}<Alanlar />{:else}<Ben />{/if}
        </section>
        <section class="oda-sutunu">
          {#if gezinme.acikOdaId}
            {#key gezinme.acikOdaId}<Oda odaId={gezinme.acikOdaId} />{/key}
          {:else}
            <div class="bos"><p>{t("oda.sec")}</p></div>
          {/if}
          {#if arama.gorunur && arama.ekranAcik}<Arama />{/if}
        </section>
      </div>
    {:else}
      <!-- Phone: the list stays underneath (nudged 4% left); the room slides in over it from the right (12%, 260ms). -->
      <!-- Telefon: liste altta kalır (%4 sola itilir); oda üstüne sağdan (%12, 260ms) kayarak girer. -->
      <div class="telefon" class:yatay={gezinme.yatay}>
        {#if gezinme.yatay}<Ray kompakt />{/if}
        <div class="ekran" class:itildi={!!gezinme.acikOdaId}>
          {#if gezinme.sekme === "sohbetler"}<Sohbetler />{:else if gezinme.sekme === "alanlar"}<Alanlar />{:else}<Ben />{/if}
        </div>
        {#if !gezinme.yatay}<AltMenu />{/if}
        {#if gezinme.acikOdaId}
          <div class="oda-katman" in:kayGir out:kayCik>
            {#key gezinme.acikOdaId}<Oda odaId={gezinme.acikOdaId} />{/key}
          </div>
        {/if}
      </div>
      {#if arama.gorunur && arama.ekranAcik}<Arama />{/if}
    {/if}
  </div>
{/if}

<!-- Encryption sheets (verification, recovery key, ...) float above everything else. · Şifreleme sayfaları (doğrulama, kurtarma anahtarı...) her şeyin üstünde durur. -->
{#if oturum.ben}<SifrelemeKatmani />{/if}
<KullaniciKarti />
<BaglantiOnay />
<Bildirim />

<style>
  .uygulama { height: 100%; display: flex; flex-direction: column; min-height: 0; }
  .kabuk { flex: 1; min-height: 0; display: flex; }
  .liste-sutunu { width: 360px; flex: none; min-width: 0; border-right: 1px solid var(--kenar-ince); background: var(--zemin); display: flex; flex-direction: column; }
  @media (min-width: 1180px) { .liste-sutunu { width: 380px; } }
  .oda-sutunu { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--zemin); }
  .telefon { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  /* Landscape phone: rail on the left, the list takes the rest. · Yatay telefon: solda ray, liste kalanı alır. */
  .telefon.yatay { flex-direction: row; }
  /* Room the floating dock (+ the search pill) needs at the bottom of scrolling lists · Yüzen menünün (+ arama hapının) kaydırılan listelerin altında istediği yer */
  .telefon:not(.yatay) { --dock-yer: calc(64px + 24px + env(safe-area-inset-bottom)); }
  /* No z-index on purpose: a stacking context here would trap the context menu's highlighted message under its own scrim. */
  /* Bilerek z-index yok: burada bir yığın bağlamı, bağlam menüsünün vurgulu mesajını kendi perdesinin altında hapseder. */
  .oda-katman { position: absolute; inset: 0; background: var(--zemin); display: flex; flex-direction: column; }
  .ekran { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; transition: transform var(--sure-ekran) var(--egri-vurgulu); }
  .ekran.itildi { transform: translateX(-4%); }
  .telefon.yatay .ekran { padding-right: env(safe-area-inset-right); }
  .bos { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--yazi-2); padding: 24px; text-align: center; }
</style>
