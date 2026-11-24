<!--
  Ben › Sohbet: Enter ile gönder, bağlantı önizlemeleri (+ şifreli odalarda önizle), fotoğraf gönderim kalitesi. Every option here is read by real code
  (YazmaAlani, BaglantiKarti, MedyaAkisi). Read/typing receipts are not listed: the backend cannot switch them off yet.
  Ben › Sohbet: Enter ile gönder, bağlantı önizlemeleri (+ şifreli odalarda önizle), fotoğraf gönderim kalitesi. Buradaki her seçeneği gerçek kod okur
  (YazmaAlani, BaglantiKarti, MedyaAkisi). Okundu/yazıyor bilgisi listelenmez: arka uç henüz kapatamıyor.
-->
<script lang="ts">
  import Anahtar from "../bilesenler/Anahtar.svelte";
  import Baslik from "../bilesenler/Baslik.svelte";
  import { baglantiAc } from "../durum/baglantiOnay.svelte";
  import { baglantiTercihi, type GenelYol } from "../durum/baglantiTercihi.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import Secici from "../bilesenler/Secici.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { tercihler, type OnizlemeKipi } from "../durum/tercihler.svelte";
  import { t } from "../i18n";
  import type { ResimKalitesi } from "../medya/isleme";

  const acma = $derived<{ id: GenelYol; ad: string }[]>([
    { id: "sekme", ad: t("ayar.acSekme") },
    { id: "tarayici", ad: t("ayar.acTarayici") },
    { id: "sor", ad: t("ayar.acSor") },
  ]);
  const onizlemeler = $derived<{ id: OnizlemeKipi; ad: string }[]>([
    { id: "hepsi", ad: t("ayar.onizlemeHepsi") },
    { id: "yt-gh", ad: t("ayar.onizlemeYtGh") },
    { id: "kapali", ad: t("ayar.onizlemeKapali") },
  ]);
  const kaliteler = $derived<{ id: ResimKalitesi; ad: string }[]>([
    { id: "standart", ad: t("ayar.kaliteStandart") },
    { id: "yuksek", ad: t("ayar.kaliteYuksek") },
    { id: "orijinal", ad: t("ayar.kaliteOrijinal") },
  ]);
</script>

<div class="ay-sayfa">
  <Baslik baslik={t("ayar.sohbet")} geri={() => gezinme.benAltKapat()} />
  <div class="ay-icerik">
    <section class="ay-bolum">
      <div class="ay-kart">
        <div class="ay-satir">
          <span class="ay-metin"><strong>{t("ayar.enter")}</strong><span>{t("ayar.enterAlt")}</span></span>
          <Anahtar acik={tercihler.d.enterGonder} degis={(v) => tercihler.yaz("enterGonder", v)} etiket={t("ayar.enter")} />
        </div>
      </div>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.baglantilar")}</h2>
      <div class="ay-kart">
        <div class="ay-secici"><Secici secenekler={acma} deger={baglantiTercihi.genel} sec={(id) => baglantiTercihi.genelYaz(id)} etiket={t("ayar.baglantilar")} /></div>
        {#each Object.entries(baglantiTercihi.siteler) as [site, k] (site)}
          <div class="ay-satir"><span class="ay-metin"><strong>{site}</strong><span>{k.ad}</span></span><button class="simge-dugme" aria-label={t("baglanti.kuralSil")} onclick={() => baglantiTercihi.siteYaz(site, null)}><Ikon ad="cop" boyut={20} /></button></div>
        {/each}
      </div>
      <p class="ay-not">{t("ayar.baglantilarAlt")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.onizleme")}</h2>
      <div class="ay-kart">
        <div class="ay-secici"><Secici secenekler={onizlemeler} deger={tercihler.d.baglantiOnizleme} sec={(id) => tercihler.yaz("baglantiOnizleme", id)} etiket={t("ayar.onizleme")} /></div>
        <div class="ay-satir">
          <span class="ay-metin"><strong>{t("ayar.sifreliOnizle")}</strong><span>{t("ayar.sifreliOnizleAlt")}</span></span>
          <Anahtar acik={tercihler.d.sifreliOnizle} degis={(v) => tercihler.yaz("sifreliOnizle", v)} etiket={t("ayar.sifreliOnizle")} kilitli={tercihler.d.baglantiOnizleme === "kapali"} />
        </div>
      </div>
      <p class="ay-not">{t("ayar.onizlemeAlt")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.gif")}</h2>
      <div class="ay-kart govde">
        <div class="alan-kutu"><input type="password" value={tercihler.d.klipyAnahtar} oninput={(e) => tercihler.yaz("klipyAnahtar", e.currentTarget.value.trim())} placeholder={t("ayar.klipyAnahtar")} aria-label={t("ayar.klipyAnahtar")} autocomplete="off" autocapitalize="off" spellcheck="false" /></div>
        <button class="buton metin" onclick={() => baglantiAc("https://partner.klipy.com")}>{t("ayar.klipyAl")}</button>
      </div>
      <p class="ay-not">{t("ayar.klipyNot")}</p>
    </section>

    <section class="ay-bolum">
      <h2>{t("ayar.kalite")}</h2>
      <div class="ay-kart"><div class="ay-secici"><Secici secenekler={kaliteler} deger={tercihler.d.resimKalitesi} sec={(id) => tercihler.yaz("resimKalitesi", id)} etiket={t("ayar.kalite")} /></div></div>
      <p class="ay-not">{t("ayar.kaliteAlt")}</p>
    </section>
  </div>
</div>
