<!--
  In-app heads-up banner for incoming messages and update alerts.
  When a room is open, aligns directly beneath the room's floating header card ([data-oda-tepe]); otherwise sits at the top of the screen.
  Tap opens the target, swipe up dismisses immediately; natural 4000 ms expiry flies the card along a curved arc into the visible bell target.
  Gelen mesajlar ve güncelleme uyarıları için uygulama içi üst şerit.
  Oda açıkken odanın yüzen başlık kartının ([data-oda-tepe]) hemen altında hizalanır; değilse ekranın üstünde durur.
  Dokunma hedefi açar, yukarı kaydırma anında kapatır; 4000 ms kendiliğinden dolunca kart eğri yolla görünür zil hedefine uçar.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { titret } from "../dokunma";
  import { duzen } from "../durum/duzen.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { guncelleme } from "../durum/guncelleme.svelte";
  import { ustBildirim } from "../durum/ustBildirim.svelte";
  import { ustCik, ustGir } from "../gecis";
  import { egri, hareketVar } from "../hareket";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let basY = 0;
  let dy = $state(0);
  let basili = $state(false);
  let ucuyor = $state(false);
  let cikisAtla = false;
  let kartEl: HTMLButtonElement | undefined = $state();
  let yerKonum = $state<{ top: number; left: number; width: number } | null>(null);
  let aktifAnim: Animation | null = null;
  let sonUcus = untrack(() => ustBildirim.ucusIstegi);

  const k = $derived(ustBildirim.kart);

  function animDurdur() {
    if (aktifAnim) {
      aktifAnim.onfinish = null;
      aktifAnim.oncancel = null;
      aktifAnim.cancel();
      aktifAnim = null;
    }
    if (kartEl?.style.willChange) kartEl.style.removeProperty("will-change");
    ucuyor = false;
  }

  function konumOlc() {
    const tepe = document.querySelector<HTMLElement>("[data-oda-tepe]");
    const hedef = tepe?.querySelector<HTMLElement>(".kart") ?? tepe;
    if (hedef && !hedef.closest("[inert]") && hedef.getClientRects().length > 0) {
      const r = hedef.getBoundingClientRect();
      if (r.width > 0 && r.bottom > 0 && r.left >= -2 && r.right <= window.innerWidth + 2) {
        yerKonum = { top: Math.round(r.bottom + 8), left: Math.round(r.left), width: Math.round(r.width) };
        return;
      }
    }
    yerKonum = null;
  }

  function gorunurMu(el: HTMLElement): boolean {
    if (el.closest("[inert]")) return false;
    if (el.getClientRects().length === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || parseFloat(s.opacity) < 0.1) return false;
    return true;
  }

  function hedefBul(): HTMLElement | null {
    const hepsi = Array.from(document.querySelectorAll<HTMLElement>("[data-zil-hedef]"));
    // Prefer the bell itself when visible (e.g. compact drawer open over room strip). · Görünürken zilin kendisini yeğle.
    const zil = hepsi.find((el) => el.dataset.zilHedef === "zil" && gorunurMu(el));
    if (zil) return zil;
    return hepsi.find(gorunurMu) ?? null;
  }

  // The room got opened some other way: the banner has nothing more to say. · Oda başka yoldan açıldı: şeridin söyleyeceği kalmadı.
  $effect(() => {
    if (k?.tur === "mesaj" && gezinme.acikOdaId === k.odaId) {
      animDurdur();
      cikisAtla = false;
      ustBildirim.kapat();
    }
  });

  // Reset drag/flight state and re-measure alignment whenever the card or layout changes. · Kart ya da düzen değişince sürükleme/uçuşu sıfırla ve konumu yeniden ölç.
  $effect(() => {
    const anahtar = k?.anahtar;
    void gezinme.acikOdaId;
    void gezinme.genis;
    void duzen.listeGizli;
    void duzen.kompakt;
    animDurdur();
    dy = 0;
    basili = false;
    cikisAtla = false;
    if (!anahtar) {
      yerKonum = null;
      return;
    }
    konumOlc();
    const raf = requestAnimationFrame(konumOlc);
    window.addEventListener("resize", konumOlc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", konumOlc);
    };
  });

  // Auto-dismiss flight animation (4000 ms expiry only): shrink (0-200 ms) then curve into the bell target (200-520 ms).
  // Kendiliğinden kapanış uçuşu (yalnızca 4000 ms dolunca): küçülme (0-200 ms) ardından zil hedefine eğri uçuş (200-520 ms).
  $effect(() => {
    const istek = ustBildirim.ucusIstegi;
    if (istek === sonUcus) return;
    sonUcus = istek;
    const gecerli = k;
    if (!gecerli) return;
    const anahtar = gecerli.anahtar;
    const el = kartEl;
    if (!el) {
      ustBildirim.bitir(anahtar);
      return;
    }

    animDurdur();
    ucuyor = true;
    cikisAtla = true;

    const bitir = (hedef?: HTMLElement | null) => {
      aktifAnim = null;
      if (el.style.willChange) el.style.removeProperty("will-change");
      if (hedef) hedef.dispatchEvent(new CustomEvent("zil-inis"));
      ucuyor = false;
      ustBildirim.bitir(anahtar);
    };

    const hedef = hareketVar() ? hedefBul() : null;
    if (!hareketVar() || !hedef) {
      // Reduced motion or no visible target: calm 160 ms fade. · Azaltılmış hareket veya görünür hedef yok: 160 ms sakin solma.
      el.style.willChange = "opacity";
      const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "linear", fill: "forwards" });
      aktifAnim = a;
      a.onfinish = () => bitir(null);
      a.oncancel = () => {
        if (el.style.willChange) el.style.removeProperty("will-change");
      };
      return;
    }

    const kR = el.getBoundingClientRect();
    const hR = hedef.getBoundingClientRect();
    const dx = hR.left + hR.width / 2 - (kR.left + kR.width / 2);
    const dyUcus = hR.top + hR.height / 2 - (kR.top + kR.height / 2);
    const cikisEgrisi = egri("--egri-cikis");

    el.style.willChange = "transform, opacity";
    const faz1 = el.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
        { transform: "translate3d(0, 0, 0) scale(0.55)", opacity: 1 },
      ],
      { duration: 200, easing: cikisEgrisi, fill: "forwards" },
    );
    aktifAnim = faz1;
    faz1.onfinish = () => {
      if (ustBildirim.kart?.anahtar !== anahtar || !ucuyor) return;
      const faz2 = el.animate(
        [
          { transform: "translate3d(0, 0, 0) scale(0.55)", opacity: 1, offset: 0 },
          { transform: `translate3d(${dx * 0.65}px, ${dyUcus * 0.35 + 24}px, 0) scale(0.35)`, opacity: 0.9, offset: 0.5 },
          { transform: `translate3d(${dx}px, ${dyUcus}px, 0) scale(0.15)`, opacity: 0, offset: 1 },
        ],
        { duration: 320, easing: cikisEgrisi, fill: "forwards" },
      );
      aktifAnim = faz2;
      faz2.onfinish = () => bitir(hedef);
      faz2.oncancel = () => {
        if (el.style.willChange) el.style.removeProperty("will-change");
      };
    };
    faz1.oncancel = () => {
      if (el.style.willChange) el.style.removeProperty("will-change");
    };
  });

  function acHedef() {
    const gecerli = k;
    if (!gecerli) return;
    animDurdur();
    cikisAtla = false;
    ustBildirim.kapat();
    if (gecerli.tur === "mesaj") gezinme.odaAc(gecerli.odaId);
    else guncelleme.sayfaAc();
  }

  function asagi(e: PointerEvent) {
    if (ucuyor) {
      animDurdur();
      cikisAtla = false;
    }
    basY = e.clientY;
    basili = true;
    ustBildirim.bekle();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function oyna(e: PointerEvent) {
    if (!basili) return;
    const f = e.clientY - basY;
    // Follows up 1:1, resists down. · Yukarı birebir izler, aşağı direnir.
    dy = f < 0 ? f : f / 6;
  }

  function birak(e: PointerEvent) {
    if (!basili) return;
    basili = false;
    if (e.type === "pointerup" && Math.abs(e.clientY - basY) < 8) {
      acHedef();
      return;
    }
    if (dy < -24) {
      titret("tik");
      cikisAtla = false;
      ustBildirim.kapat();
      return;
    }
    dy = 0;
    ustBildirim.sur();
  }

  const cikis = (node: Element) => (cikisAtla ? { duration: 0 } : ustCik(node));
</script>

{#if k}{#key k.anahtar}
  <div
    class="yer"
    class:odada={!!yerKonum}
    style:top={yerKonum ? `${yerKonum.top}px` : undefined}
    style:left={yerKonum ? `${yerKonum.left}px` : undefined}
    style:width={yerKonum ? `${yerKonum.width}px` : undefined}
    in:ustGir
    out:cikis
    role="status"
  >
    <button
      bind:this={kartEl}
      class="kart"
      class:basili
      class:ucuyor
      type="button"
      data-bas="yok"
      style:transform={!ucuyor && dy !== 0 ? `translateY(${dy}px)` : undefined}
      onpointerdown={asagi}
      onpointermove={oyna}
      onpointerup={birak}
      onpointercancel={birak}
      onclick={(e) => { if (e.detail === 0) acHedef(); }}
    >
      {#if k.tur === "mesaj"}
        <Avatar harf={(k.odaAd || k.gonderenAd).charAt(0).toUpperCase() || "#"} mxc={k.avatarMxc} boyut={44} />
        <span class="metin">
          <span class="ust"><strong>{k.odaAd || k.gonderenAd}</strong>{#if k.n > 1}<span class="rozet">{k.n}</span>{/if}</span>
          {#if !ucuyor}
            <span class="ileti">{#if k.odaAd && k.gonderenAd && k.odaAd !== k.gonderenAd}<b>{k.gonderenAd}:</b>{/if} {k.metin || t("ustBildirim.yeni")}</span>
          {/if}
        </span>
      {:else}
        <span class="guncelle-simge" aria-hidden="true"><Ikon ad="indir" boyut={22} /></span>
        <span class="metin">
          <span class="ust"><strong>{t("guncelleme.seritBaslik", { surum: k.surum })}</strong></span>
        </span>
        {#if !ucuyor}
          <span class="guncelle-eylem">{t("guncelleme.guncelle")}</span>
        {/if}
      {/if}
    </button>
  </div>
{/key}{/if}

<style>
  .yer { position: fixed; z-index: 48; top: calc(env(safe-area-inset-top) + .5rem); left: .75rem; right: .75rem; max-width: 30rem; margin: 0 auto; pointer-events: none; }
  .yer.odada { right: auto; max-width: none; margin: 0; }
  .kart { pointer-events: auto; position: relative; width: 100%; max-width: 30rem; margin: 0 auto; min-height: 4.5rem; padding: .75rem 1rem 1rem; display: flex; align-items: center; gap: .875rem; text-align: left; border-radius: 1.75rem; background: var(--yuzey-3); color: var(--yazi); box-shadow: var(--kat-2); touch-action: none; transition: transform var(--sure-orta) var(--egri-cikis); }
  .kart.basili, .kart.ucuyor { transition: none; }
  .kart.ucuyor { border-radius: 999px; pointer-events: none; }
  .kart.ucuyor::after { opacity: 0; }
  .kart::after { content: ""; position: absolute; left: 50%; bottom: .375rem; width: 2rem; height: 4px; margin-left: -1rem; border-radius: 2px; background: var(--kenar); }
  .metin { flex: 1; min-width: 0; display: grid; gap: .125rem; }
  .ust { display: flex; align-items: center; gap: .5rem; min-width: 0; }
  strong { min-width: 0; font-size: .9375rem; line-height: 1.3; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ileti { font-size: .875rem; line-height: 1.35; color: var(--yazi-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  b { font-weight: 600; color: var(--yazi); }
  .guncelle-simge { flex: none; width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--ton); color: var(--ton-ustu); }
  .guncelle-eylem { flex: none; padding: 0 4px; font-size: .875rem; font-weight: 600; color: var(--vurgu); white-space: nowrap; }
</style>
