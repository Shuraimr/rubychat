<!--
  Chat look sheet, like WhatsApp: scope, a tall live preview, wallpaper tiles (solid colours + own photo), dimming and message text size.
  Everything is saved at once (localStorage via sohbetGorunum) and applied to the room.
  Sohbet görünümü sayfası, WhatsApp gibi: kapsam, uzun canlı önizleme, duvar kâğıdı karoları (düz renkler + kendi fotoğrafın), karartma ve
  mesaj yazı boyutu. Her şey anında kaydedilir (sohbetGorunum ile localStorage) ve odaya uygulanır.
-->
<script lang="ts">
  import { bildirim } from "../durum/bildirim.svelte";
  import { gorunumStili, sohbetGorunumu, ZEMINLER, ZEMIN_RENKLERI } from "../durum/sohbetGorunum.svelte";
  import { zeminKaydet, zeminSil } from "../durum/zeminResmi";
  import { t, type Anahtar as TrAnahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Ikon from "./Ikon.svelte";
  import Secici from "./Secici.svelte";
  import SohbetZemini from "./SohbetZemini.svelte";

  /** odaId null = global only (Ayarlar › Görünüm) · odaId null = yalnızca genel (Ayarlar › Görünüm) */
  let { odaId = null, onkapat }: { odaId?: string | null; onkapat: () => void } = $props();

  // Scope: "bu sohbet" is on while the room has its own override · Kapsam: odanın kendi ayarı varken "bu sohbet" açık
  const buSohbet = $derived(!!odaId && sohbetGorunumu.ozelMi(odaId));
  const g = $derived(sohbetGorunumu.al(odaId));
  const hedef = $derived(buSohbet ? odaId : null);

  const yaz = <K extends keyof typeof g>(k: K, v: (typeof g)[K]) => sohbetGorunumu.yaz(hedef, k, v);
  function kapsamSec(bu: boolean) {
    if (!odaId) return;
    if (bu) sohbetGorunumu.odaOzellestir(odaId);
    else sohbetGorunumu.odaSifirla(odaId);
  }

  const kapsamlar = $derived<{ id: "bu" | "tum"; ad: string }[]>([
    { id: "bu", ad: t("ozellestir.kapsamBu") },
    { id: "tum", ad: t("ozellestir.kapsamTum") },
  ]);
  /** The photo is replaced under the same key: remount the preview to show the new one · Fotoğraf aynı anahtarla değişir: yenisini göstermek için önizleme yeniden kurulur */
  let fotoSurum = $state(0);
  // Photo background: picked from the device, compressed and kept ONLY on this device (IndexedDB), never uploaded.
  // Fotoğraf arka planı: cihazdan seçilir, sıkıştırılır ve YALNIZCA bu cihazda (IndexedDB) durur, asla yüklenmez.
  async function fotoSec(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = "";
    if (!f) return;
    if (await zeminKaydet(hedef ?? "genel", f)) {
      fotoSurum++;
      yaz("resim", true);
    }
    else bildirim.goster(t("kirp.hata"), 4000, { tur: "hata" });
  }
  async function fotoKaldir() {
    await zeminSil(hedef ?? "genel");
    yaz("resim", false);
  }
</script>

<AltSayfa baslik={t("ozellestir.baslik")} {onkapat}>
  {#if odaId}<Secici secenekler={kapsamlar} deger={buSohbet ? "bu" : "tum"} sec={(id) => kapsamSec(id === "bu")} etiket={t("ozellestir.baslik")} />{/if}

  <!-- Live preview: the same variables the room uses · Canlı önizleme: odanın kullandığı aynı değişkenler -->
  <div class="onizleme" style={gorunumStili(g)} style:background={ZEMIN_RENKLERI[g.zemin]}>
    {#key fotoSurum}<SohbetZemini resim={g.resim} resimAnahtari={hedef ?? "genel"} karart={g.karart} />{/key}
    <div class="o-gelen" style:font-size="calc(.9375rem * {g.yazi})">{t("ozellestir.onizGelen")}</div>
    <div class="o-giden" style:font-size="calc(.9375rem * {g.yazi})">{t("ozellestir.onizGiden")}</div>
  </div>

  <section>
    <h3>{t("ozellestir.arkaPlan")}</h3>
    <div class="karolar" role="radiogroup" aria-label={t("ozellestir.arkaPlan")}>
      <label class="karo foto" class:aktif={g.resim}><Ikon ad="galeri" boyut={24} /><input type="file" accept="image/*" onchange={fotoSec} aria-label={t("ozellestir.fotoSec")} /></label>
      {#each ZEMINLER as z (z)}
        {@const secili = !g.resim && g.zemin === z}
        <button class="karo" class:aktif={secili} role="radio" aria-checked={secili} aria-label={t(`ozellestir.zemin.${z}` as TrAnahtar)} style:background={ZEMIN_RENKLERI[z]} onclick={() => { if (g.resim) void fotoKaldir(); yaz("zemin", z); }}>{#if secili}<Ikon ad="onay" boyut={22} />{/if}</button>
      {/each}
    </div>
    {#if g.resim}
      <label class="kaydirici"><span>{t("ozellestir.karart")}</span><input type="range" min="0" max="80" step="5" value={g.karart} aria-label={t("ozellestir.karart")} oninput={(e) => yaz("karart", Number(e.currentTarget.value))} /></label>
    {/if}
    <p class="not">{t("ozellestir.fotoNot")}</p>
  </section>

  <section>
    <h3>{t("ozellestir.yazi")}</h3>
    <input type="range" min="0.85" max="1.3" step="0.05" value={g.yazi} aria-label={t("ozellestir.yazi")} oninput={(e) => yaz("yazi", Number(e.currentTarget.value))} />
  </section>
</AltSayfa>

<style>
  .onizleme { position: relative; overflow: hidden; isolation: isolate; min-height: 11rem; display: grid; align-content: end; gap: .5rem; padding: 1rem; border-radius: 1.5rem; border: 1px solid var(--kenar-ince); transition: background var(--sure-orta) var(--egri-cikis); }
  .o-gelen, .o-giden { position: relative; z-index: 1; max-width: 78%; padding: var(--balon-dolgu); border-radius: var(--balon-r); }
  .o-gelen { background: var(--gelen-dolgu); justify-self: start; border-bottom-left-radius: .375rem; }
  .o-giden { background: var(--giden-dolgu); justify-self: end; border-bottom-right-radius: .375rem; }
  h3 { font-family: var(--yazi-tipi); font-size: .875rem; font-weight: 600; color: var(--vurgu); margin-bottom: .5rem; }
  .karolar { display: grid; grid-template-columns: repeat(auto-fill, minmax(4rem, 1fr)); gap: .5rem; }
  .karo { position: relative; aspect-ratio: 3 / 4; border-radius: 1rem; border: 1px solid var(--kenar); display: inline-flex; align-items: center; justify-content: center; color: var(--yazi); outline: 2px solid transparent; outline-offset: 2px; transition: outline-color var(--sure-orta) var(--egri-cikis), border-radius var(--sure-orta) var(--egri-cikis); }
  .karo.aktif { outline-color: var(--vurgu); border-radius: 1.5rem; }
  .foto { background: var(--ton); color: var(--ton-ustu); border-color: transparent; cursor: pointer; }
  .foto input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  .kaydirici { display: grid; margin-top: .75rem; font-size: .8125rem; color: var(--yazi-2); }
  .not { font-size: .75rem; color: var(--yazi-2); margin-top: .5rem; }
  input[type="range"] { width: 100%; height: 2.75rem; accent-color: var(--vurgu); }
</style>
