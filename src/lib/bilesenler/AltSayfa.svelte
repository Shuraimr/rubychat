<!--
  Modal sheet: a bottom sheet on phones (24px top corners, rises 280ms with a slight spring, drag the handle down >=30% to close)
  and a centred dialog on tablets. It is a LAYER (gezinme.katmanAc): the Android back button / Escape / scrim / ✕ all close it the same way.
  On phones it counts as a fixed bottom bar (`data-alt-cubuk`) so toasts sit above it and nothing overlaps.
  Kipli sayfa: telefonda alttan sayfa (üst köşeler 24px, 280ms hafif yayla çıkar, tutamacı >=%30 aşağı sürüklemek kapatır),
  tablette ortada pencere. Bir KATMANDIR (gezinme.katmanAc): Android geri tuşu / Escape / perde / ✕ hepsi aynı yolla kapatır.
  Telefonda sabit alt çubuk sayılır (`data-alt-cubuk`); bildirimler üstünde durur, hiçbir şey üst üste binmez.
-->
<script lang="ts">
  import { sureMs } from "../hareket";
  import { onDestroy, onMount, type Snippet } from "svelte";
  import { perdeCik, perdeGir, sayfaCik, sayfaGir } from "../gecis";
  import { gezinme } from "../durum/gezinme.svelte";
  import { t } from "../i18n";
  import Ikon from "./Ikon.svelte";

  let {
    baslik,
    onkapat,
    kapatilabilir = true,
    children,
    altlik,
  }: {
    baslik: string;
    onkapat: () => void;
    /** false = no backdrop/Escape/back/✕/drag close (a step the user must finish) · false = arka plan/Escape/geri/✕/sürükleme ile kapanmaz (kullanıcının bitirmesi gereken adım) */
    kapatilabilir?: boolean;
    children: Snippet;
    /** Buttons row pinned under the content · İçeriğin altına sabit düğme satırı */
    altlik?: Snippet;
  } = $props();

  let kutu: HTMLDivElement | undefined = $state();
  let katmanId = 0;
  let gizli = $state(false);

  onMount(() => {
    // Refusing (false) when the step cannot be dismissed keeps the sheet and restores the history entry. · Adım kapatılamıyorsa reddetmek (false) sayfayı tutar ve history girdisini yeniler.
    katmanId = gezinme.katmanAc(() => {
      if (!kapatilabilir) return false;
      onkapat();
    });
    // Focus the sheet when it opens so keyboard / screen reader users land inside it. · Sayfa açılınca odağı içine al; klavye / ekran okuyucu kullanıcıları içeride başlasın.
    kutu?.focus();
  });
  onDestroy(() => gezinme.katmanBirak(katmanId));

  const kapat = () => kapatilabilir && gezinme.katmanKapat(katmanId);

  // ---- Drag the handle down to close · Tutamacı aşağı sürükleyerek kapat ----
  let dy = $state(0);
  let surukleniyor = $state(false);
  let baslangicY = 0;
  // Release speed (px/ms): a fast flick closes the sheet even below 30% (> 0.5 px/ms) · Bırakma hızı (px/ms): hızlı fırlatma %30'un altında bile kapatır (> 0.5 px/ms)
  let sonY = 0;
  let sonT = 0;
  let hiz = 0;

  function basla(e: PointerEvent) {
    if (!kapatilabilir || gezinme.genis) return;
    // The ✕ button inside the header must stay a normal click. · Başlıktaki ✕ düğmesi normal tıklama kalmalı.
    if ((e.target as HTMLElement).closest("button")) return;
    surukleniyor = true;
    baslangicY = e.clientY;
    sonY = e.clientY;
    sonT = performance.now();
    hiz = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function surukle(e: PointerEvent) {
    if (!surukleniyor) return;
    const simdi = performance.now();
    if (simdi > sonT) hiz = (e.clientY - sonY) / (simdi - sonT);
    sonY = e.clientY;
    sonT = simdi;
    dy = Math.max(0, e.clientY - baslangicY);
  }
  function birak() {
    if (!surukleniyor) return;
    surukleniyor = false;
    const yukseklik = kutu?.offsetHeight ?? 1;
    if ((dy >= yukseklik * 0.3 || (hiz > 0.5 && dy > 24)) && kutu) {
      // >=30%: finish the motion from where the finger left it, then close (hidden so the exit transition is not seen).
      // >=%30: hareketi parmağın bıraktığı yerden bitir, sonra kapat (çıkış geçişi görünmesin diye gizlenir).
      const sure = sureMs("--sure-hizli");
      const bitir = () => {
        gizli = true;
        kapat();
      };
      if (sure > 0) kutu.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(100%)" }], { duration: sure, easing: "linear", fill: "both" }).onfinish = bitir;
      else bitir();
    } else {
      // Less than 30%: spring back (the CSS transition below uses the sheet curve). · %30'dan az: geri yaylan (aşağıdaki CSS geçişi sayfa eğrisini kullanır).
      dy = 0;
    }
  }

  const giris = (n: Element) => (gezinme.genis ? perdeGir(n) : sayfaGir(n));
  const cikis = (n: Element) => (gezinme.genis ? perdeCik(n) : sayfaCik(n));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="perde" onclick={kapat} in:perdeGir|global out:perdeCik|global></div>
<div class="kap" class:dialog={gezinme.genis}>
  <div
    class="sayfa"
    class:suruklenen={surukleniyor}
    role="dialog"
    aria-modal="true"
    aria-label={baslik}
    tabindex="-1"
    bind:this={kutu}
    data-alt-cubuk={gezinme.genis ? undefined : ""}
    style:transform={dy > 0 ? `translateY(${dy}px)` : undefined}
    style:visibility={gizli ? "hidden" : undefined}
    in:giris|global
    out:cikis|global
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tutamak-alani" onpointerdown={basla} onpointermove={surukle} onpointerup={birak} onpointercancel={birak}>
      {#if !gezinme.genis && kapatilabilir}<span class="tutamak"></span>{/if}
      <header>
        <h2>{baslik}</h2>
        {#if kapatilabilir}
          <button class="simge-dugme" onclick={kapat} aria-label={t("eylem.kapat")}><Ikon ad="kapat" boyut={20} /></button>
        {/if}
      </header>
    </div>
    <div class="icerik">{@render children()}</div>
    {#if altlik}<footer>{@render altlik()}</footer>{/if}
  </div>
</div>

<style>
  /* Scrim = the page background at 50% (design section 8; no separate colour token). · Perde = sayfa zemini %50 (tasarım bölüm 8; ayrı renk değişkeni yok). */
  .perde { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--zemin) 50%, transparent); }
  /* The wrapper centres/bottom-aligns the sheet, so the sheet's own transform stays free for the animations. */
  /* Kapsayıcı sayfayı ortalar/alta hizalar; böylece sayfanın kendi transform'u animasyonlara serbest kalır. */
  .kap { position: fixed; inset: 0; z-index: 31; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
  .kap.dialog { align-items: center; }
  .sayfa {
    pointer-events: auto; display: flex; flex-direction: column; outline: none; width: 100%;
    background: var(--yuzey-1); box-shadow: var(--kat-2); color: var(--yazi);
    max-height: min(88%, calc(var(--gorunen-yukseklik, 100vh) - 24px));
    border-radius: 1.75rem 1.75rem 0 0;
    padding-bottom: env(safe-area-inset-bottom);
    /* Dragging follows the finger with no transition; releasing springs back with one. · Sürüklerken geçiş yok, parmağı izler; bırakınca geçişle geri yaylanır. */
    transition: transform var(--sure-sayfa) var(--egri-sayfa);
  }
  .sayfa.suruklenen { transition: none; }
  .dialog .sayfa { width: min(480px, calc(100% - 32px)); max-height: min(85%, 720px); border-radius: 1.75rem; padding-bottom: 0; }
  /* Landscape phone: a sheet this wide would be too long a line, so it is capped and centred. · Yatay telefon: bu kadar geniş sayfa çok uzun satır olurdu; sınırlanır ve ortalanır. */
  @media (max-height: 500px) { .sayfa { width: min(560px, 100%); } }
  .tutamak-alani { flex: none; touch-action: none; }
  .tutamak { display: block; width: 32px; height: 4px; border-radius: 2px; background: var(--kenar); margin: 8px auto 0; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px 4px 20px; min-height: 56px; }
  h2 { font-size: 1.25rem; line-height: 1.3; font-weight: 600; }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 20px 16px; display: grid; grid-auto-rows: max-content; gap: 16px; align-content: start; }
  footer { flex: none; display: grid; gap: 8px; padding: 8px 20px 16px; border-top: 1px solid var(--kenar-ince); }
</style>
