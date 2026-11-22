<!--
  Full-screen media viewer (design 10-medya, part 4). Photos: pinch to zoom, double tap = 2x, drag to pan when zoomed, swipe left / right
  for the neighbour, swipe down to close; one tap fades the tools. Videos use the native controls. "Kaydet" writes the (decrypted) file to
  the gallery. The thumbnail shows at once and the full image fades in over it.
  Layer rule: opening pushes a history entry ({rubychatKatman: "medya"}) and the Android back button / swipe-back pops it, which closes the
  viewer; closing by hand calls history.back() so the stack stays balanced.
  The viewer is always dark (a photo viewer should not turn white in the light theme), so it carries its own two colour constants.
  Tam ekran medya görüntüleyici (10-medya tasarımı, 4. bölüm). Fotoğraf: iki parmakla yakınlaştır, çift dokunma = 2x, yakınken sürükleyerek
  gez, komşuya sola / sağa kaydır, kapatmak için aşağı kaydır; tek dokunma araçları soldurur. Videolar yerel denetimleri kullanır. "Kaydet"
  (şifresi çözülmüş) dosyayı galeriye yazar. Küçük resim hemen görünür, tam resim üstüne belirir.
  Katman kuralı: açılış bir history girdisi ekler ({rubychatKatman: "medya"}); Android geri tuşu / geri kaydırma onu çıkarır ve görüntüleyici kapanır;
  elle kapatma history.back() çağırır, böylece yığın dengede kalır.
  Görüntüleyici hep koyudur (fotoğraf görüntüleyicisi açık temada beyaza dönmemeli), bu yüzden iki renk sabiti taşır.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { medyaKaydet } from "../api/komutlar";
  import type { ZamanOgesi } from "../api/tipler";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { katmanAc } from "./katman";
  import { m } from "./metin";
  import { medyaUrl } from "./url";

  let { baslangicId, onkapat }: { baslangicId: string; onkapat: () => void } = $props();

  // A snapshot of the room's pictures / videos at open time: the list must not shift under the viewer when new messages arrive.
  // Açılış anındaki odanın resim / videolarının kopyası: yeni mesaj gelince liste görüntüleyicinin altında kaymamalı.
  const liste: ZamanOgesi[] = zaman.ogeler.filter((o) => o.medya && (o.medya.tur === "resim" || o.medya.tur === "video"));
  let sira = $state(Math.max(0, liste.findIndex((o) => o.id === baslangicId)));
  const oge = $derived(liste[sira]);
  const md = $derived(oge?.medya ?? null);

  let kok: HTMLDivElement;
  let sahne = $state<HTMLDivElement>();
  let araclarGorunur = $state(true);
  let kapaniyor = $state(false);
  let tamYuklendi = $state(false);

  // ---- Gesture state · Hareket durumu ----
  let olcek = $state(1);
  let x = $state(0);
  let y = $state(0);
  let suruklemeY = $state(0);
  let yatayKayma = $state(0);
  let anim = $state(false);
  const isaretciler = new Map<number, { x: number; y: number }>();
  let baslangic = { mesafe: 0, olcek: 1, x: 0, y: 0, ox: 0, oy: 0, tx: 0, ty: 0 };
  let hareket = 0; // how far the finger travelled (to tell a tap from a drag) · parmağın aldığı yol (dokunma ile sürüklemeyi ayırmak için)
  let sonDokunma = { t: 0, x: 0, y: 0 };
  let tekZamanlayici: ReturnType<typeof setTimeout> | undefined;

  const video = $derived(md?.tur === "video");

  function sureMs(): number {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--sure-orta").trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 200;
  }

  // ---- History / back button · Geri tuşu ----
  let katman: ReturnType<typeof katmanAc> | undefined;
  onMount(() => {
    // The layer's pop (back button or kapat()) fades the viewer out. · Katmanın çıkarılması (geri tuşu ya da kapat()) görüntüleyiciyi soldurur.
    katman = katmanAc("medya", bitir);
    window.addEventListener("keydown", tus);
    // Move to <body>: a transformed ancestor (room slide transition) would break position: fixed.
    // <body>'ye taşı: dönüşümlü bir üst öğe (oda kayma geçişi) position: fixed'i bozardı.
    document.body.appendChild(kok);
    kok.focus();
    return () => {
      window.removeEventListener("keydown", tus);
      clearTimeout(tekZamanlayici);
      kok.remove();
      katman?.birak();
    };
  });

  /** Fade out, then tell the parent. · Soldur, sonra üst bileşene haber ver. */
  function bitir() {
    kapaniyor = true;
    setTimeout(onkapat, sureMs());
  }
  function kapat() {
    if (!kapaniyor) katman?.kapat();
  }

  function tus(e: KeyboardEvent) {
    if (e.key === "Escape") kapat();
    else if (e.key === "ArrowLeft") git(-1);
    else if (e.key === "ArrowRight") git(1);
  }

  async function git(yon: number) {
    const yeni = sira + yon;
    if (yeni < 0 || yeni >= liste.length) return;
    sira = yeni;
    sifirla(false);
    tamYuklendi = false;
    araclarGorunur = true;
    await tick();
  }

  function sifirla(canlandir: boolean) {
    anim = canlandir;
    olcek = 1;
    x = 0;
    y = 0;
    suruklemeY = 0;
    yatayKayma = 0;
  }

  function sinirla(o: number, px: number, py: number) {
    // offsetWidth / offsetHeight ignore the CSS transform (getBoundingClientRect would already include the zoom).
    // offsetWidth / offsetHeight CSS dönüşümünü yok sayar (getBoundingClientRect yakınlaştırmayı zaten içerirdi).
    const g = sahne!.offsetWidth;
    const h = sahne!.offsetHeight;
    const mx = Math.max(0, (g * o - g) / 2);
    const my = Math.max(0, (h * o - h) / 2);
    return { x: Math.min(mx, Math.max(-mx, px)), y: Math.min(my, Math.max(-my, py)) };
  }

  function mesafe(): number {
    const [a, b] = [...isaretciler.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function basildi(e: PointerEvent) {
    if (video) return;
    sahne!.setPointerCapture(e.pointerId);
    isaretciler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anim = false;
    if (isaretciler.size === 1) {
      hareket = 0;
      baslangic = { ...baslangic, ox: e.clientX, oy: e.clientY, tx: x, ty: y };
    } else if (isaretciler.size === 2) {
      baslangic = { ...baslangic, mesafe: mesafe(), olcek, x, y };
      hareket = 99;
    }
  }

  function hareketEtti(e: PointerEvent) {
    const p = isaretciler.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (isaretciler.size >= 2) {
      const yeniOlcek = Math.min(5, Math.max(1, baslangic.olcek * (mesafe() / Math.max(1, baslangic.mesafe))));
      olcek = yeniOlcek;
      const s = sinirla(yeniOlcek, x, y);
      x = s.x;
      y = s.y;
      return;
    }
    const dx = e.clientX - baslangic.ox;
    const dy = e.clientY - baslangic.oy;
    hareket = Math.max(hareket, Math.hypot(dx, dy));
    if (olcek > 1.02) {
      const s = sinirla(olcek, baslangic.tx + dx, baslangic.ty + dy);
      x = s.x;
      y = s.y;
    } else if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
      suruklemeY = dy; // swipe down to close · kapatmak için aşağı kaydır
      yatayKayma = 0;
    } else if (Math.abs(dx) > 10) {
      yatayKayma = dx; // swipe to the neighbour · komşuya kaydır
      suruklemeY = 0;
    }
  }

  function birakildi(e: PointerEvent) {
    if (!isaretciler.has(e.pointerId)) return;
    isaretciler.delete(e.pointerId);
    if (isaretciler.size === 1) {
      // Pinch ended but one finger remains: continue as a pan from here. · Kıstırma bitti ama bir parmak kaldı: buradan gezinmeye devam.
      const [kalan] = [...isaretciler.values()];
      baslangic = { ...baslangic, ox: kalan.x, oy: kalan.y, tx: x, ty: y };
      return;
    }
    if (isaretciler.size > 0) return;
    anim = true;
    if (olcek < 1.05) olcek = 1;
    if (suruklemeY > 110) {
      kapat();
      return;
    }
    if (Math.abs(yatayKayma) > 70 && olcek === 1) {
      git(yatayKayma < 0 ? 1 : -1);
      return;
    }
    suruklemeY = 0;
    yatayKayma = 0;
    if (olcek === 1) {
      x = 0;
      y = 0;
    }
    if (hareket < 10) dokunma(e);
  }

  /** A tap: a second one within 280 ms zooms; a lone one toggles the tools. · Dokunma: 280 ms içinde ikincisi yakınlaştırır; tek başınaysa araçları açıp kapatır. */
  function dokunma(e: PointerEvent) {
    const simdi = performance.now();
    const cift = simdi - sonDokunma.t < 280 && Math.hypot(e.clientX - sonDokunma.x, e.clientY - sonDokunma.y) < 40;
    sonDokunma = { t: simdi, x: e.clientX, y: e.clientY };
    clearTimeout(tekZamanlayici);
    if (cift) {
      sonDokunma.t = 0;
      if (olcek > 1.05) {
        sifirla(true);
      } else {
        // Zoom 2x around the tapped point. · Dokunulan noktanın etrafında 2x yakınlaştır.
        const r = sahne!.getBoundingClientRect();
        const s = sinirla(2, r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY);
        olcek = 2;
        x = s.x;
        y = s.y;
      }
      return;
    }
    tekZamanlayici = setTimeout(() => (araclarGorunur = !araclarGorunur), 260);
  }

  async function kaydet() {
    if (!md) return;
    try {
      const ad = await medyaKaydet(md.kaynakId);
      bildirim.goster(m("kaydedildi", { ad: ad.split("/").pop() ?? ad }), 3500, { tur: "tamam" });
    } catch {
      bildirim.goster(m("kaydedilemedi"), 4000, { tur: "hata" });
    }
  }

  const zamanYazi = $derived(
    oge ? new Date(oge.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
  );
  const sahneStil = $derived(
    `transform: translate(${x + yatayKayma}px, ${y + suruklemeY}px) scale(${olcek});`,
  );
  const perdeOpaklik = $derived(kapaniyor ? 0 : 1 - Math.min(0.7, suruklemeY / 400));
</script>

<div bind:this={kok} class="gor" class:kapaniyor role="dialog" aria-modal="true" aria-label={m("gorsel")} tabindex="-1" style:--perde={perdeOpaklik}>
  <div class="perde"></div>

  {#if oge && md}
    {#key oge.id}
      <div
        bind:this={sahne}
        class="sahne"
        class:anim
        class:video
        style={sahneStil}
        onpointerdown={basildi}
        onpointermove={hareketEtti}
        onpointerup={birakildi}
        onpointercancel={birakildi}
        role="presentation"
      >
        {#if md.tur === "resim"}
          {#if md.kucukId}<img class="alt" src={medyaUrl(md.kucukId)} alt="" draggable="false" />{/if}
          <img class="tam" class:hazir={tamYuklendi} src={medyaUrl(md.kaynakId)} alt={md.dosyaAdi} draggable="false" onload={() => (tamYuklendi = true)} />
        {:else}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={medyaUrl(md.kaynakId)} poster={md.kucukId ? medyaUrl(md.kucukId) : undefined} controls playsinline autoplay preload="metadata"></video>
        {/if}
      </div>
    {/key}
  {/if}

  <header class="ust arac" class:gizli={!araclarGorunur && !video}>
    <button type="button" class="dugme" onclick={kapat} aria-label={m("geriDon")}><Ikon ad="geri" /></button>
    <div class="baslik">
      <strong>{oge?.gonderenAd ?? ""}</strong>
      <span>{zamanYazi}{liste.length > 1 ? ` · ${sira + 1}/${liste.length}` : ""}</span>
    </div>
    {#if liste.length > 1}
      <button type="button" class="dugme" onclick={() => git(-1)} disabled={sira === 0} aria-label={m("onceki")}><Ikon ad="geri" /></button>
      <button type="button" class="dugme" onclick={() => git(1)} disabled={sira === liste.length - 1} aria-label={m("sonraki")}><Ikon ad="sagOk" /></button>
    {/if}
  </header>

  <footer class="alt arac" class:gizli={!araclarGorunur && !video} data-alt-cubuk>
    <p class="aciklama">{oge?.metin ?? ""}</p>
    <div class="eylemler">
      <button type="button" class="dugme yazili" onclick={kaydet}><Ikon ad="asagi" /><span>{m("kaydet")}</span></button>
    </div>
  </footer>
</div>

<style>
  .gor {
    --gor-yazi: #ededed; /* the viewer is always dark · görüntüleyici hep koyu */
    --gor-zemin: #000;
    position: fixed;
    inset: 0;
    z-index: 200;
    color: var(--gor-yazi);
    touch-action: none;
    outline: none;
    opacity: 1;
    transition: opacity var(--sure-orta) var(--egri-cikis);
  }
  .gor.kapaniyor {
    opacity: 0;
    transition-timing-function: var(--egri-giris);
  }
  .perde {
    position: absolute;
    inset: 0;
    background: var(--gor-zemin);
    opacity: calc(0.96 * var(--perde, 1));
  }
  .sahne {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    touch-action: none;
    will-change: transform;
  }
  .sahne.anim {
    transition: transform var(--sure-orta) var(--egri-cikis);
  }
  .sahne.video {
    touch-action: auto;
  }
  img,
  video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
  .sahne img {
    grid-area: 1 / 1;
  }
  .tam {
    opacity: 0;
    transition: opacity var(--sure-orta) var(--egri-cikis);
  }
  .tam.hazir {
    opacity: 1;
  }
  video {
    width: 100%;
    height: 100%;
  }
  .arac {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 8px;
    background: rgb(0 0 0 / 0.55);
    transition: opacity var(--sure-orta) var(--egri-cikis);
  }
  .arac.gizli {
    opacity: 0;
    pointer-events: none;
  }
  .ust {
    top: 0;
    padding-top: calc(8px + env(safe-area-inset-top));
  }
  .alt {
    bottom: 0;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    justify-content: space-between;
    gap: 12px;
  }
  .baslik {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .baslik strong,
  .baslik span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .baslik span {
    font-size: 12px;
    opacity: 0.75;
  }
  .aciklama {
    flex: 1;
    margin: 0;
    padding-left: 8px;
    max-height: 4.5em;
    overflow: auto;
    overflow-wrap: anywhere;
  }
  .eylemler {
    display: flex;
    gap: 4px;
  }
  .dugme {
    min-width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--gor-yazi);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 10px;
    cursor: pointer;
  }
  .dugme:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .dugme.yazili {
    background: rgb(255 255 255 / 0.12);
  }
</style>
