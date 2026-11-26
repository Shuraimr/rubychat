<!--
  Desktop in-app camera capture dialog (photo only, no video recording): live getUserMedia preview (mirrored only in preview),
  camera picker when multiple video devices exist, canvas → JPEG File capture, retake / use confirmation, and clear error states
  when no camera is found or permission is denied. Stops every MediaStream track on close or hand-off.
  Masaüstü uygulama içi kamera penceresi (yalnızca fotoğraf, video kaydı yok): canlı getUserMedia önizlemesi (yalnızca önizlemede
  aynalı), birden çok kamera varsa seçim, canvas → JPEG File çekimi, yeniden çek / kullan onayı ve kamera yokluğu / izin reddi
  için açık hata durumları. Kapanınca ya da devredince bütün MediaStream izlerini durdurur.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { kameraPenceresi } from "../api/komutlar";
  import BosDurum from "../bilesenler/BosDurum.svelte";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { menuCik, menuGir, perdeCik, perdeGir } from "../gecis";
  import { t } from "../i18n";
  import { katmanAc } from "./katman";

  let {
    oncek,
    onkapat,
  }: {
    /** Hand the captured JPEG file into the existing media flow · Çekilen JPEG dosyasını mevcut medya akışına verir */
    oncek: (dosya: File) => void;
    onkapat: () => void;
  } = $props();

  type KameraHatasi = "izin" | "yok" | "mesgul" | "diger";

  let kok: HTMLDivElement;
  let pencere: HTMLDivElement | undefined = $state();
  let videoEl: HTMLVideoElement | undefined = $state();
  let akis = $state.raw<MediaStream | null>(null);
  let hazir = $state(false);
  let yukleniyor = $state(true);
  let hata = $state<KameraHatasi | null>(null);
  let kameralar = $state<MediaDeviceInfo[]>([]);
  let seciliCihaz = $state("");
  let cekilen = $state<{ dosya: File; url: string } | null>(null);
  let cekiliyor = $state(false);
  let devredildi = false;
  let kapandi = false;
  let istekNo = 0;
  let katman: ReturnType<typeof katmanAc> | undefined;

  function akisDurdur() {
    if (akis) {
      for (const iz of akis.getTracks()) iz.stop();
      akis = null;
    }
    if (videoEl) videoEl.srcObject = null;
    hazir = false;
  }

  function cekilenTemizle() {
    if (!cekilen) return;
    URL.revokeObjectURL(cekilen.url);
    cekilen = null;
  }

  async function cihazlariListele(aktifId?: string) {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const hepsi = await navigator.mediaDevices.enumerateDevices();
      const liste = hepsi.filter((c) => c.kind === "videoinput");
      if (kapandi) return;
      kameralar = liste;
      if (aktifId && liste.some((c) => c.deviceId === aktifId)) seciliCihaz = aktifId;
      else if (!seciliCihaz && liste[0]) seciliCihaz = liste[0].deviceId;
    } catch {
      /* ignore device enumeration failure · cihaz listesi alınamazsa yoksay */
    }
  }

  async function baslat(cihazId?: string) {
    const bu = ++istekNo;
    akisDurdur();
    cekilenTemizle();
    hata = null;
    yukleniyor = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      hata = "yok";
      yukleniyor = false;
      return;
    }
    const videoKisiti: MediaTrackConstraints = cihazId
      ? { deviceId: { exact: cihazId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { width: { ideal: 1920 }, height: { ideal: 1080 } };
    try {
      const yeni = await navigator.mediaDevices.getUserMedia({ video: videoKisiti, audio: false });
      // Stop tracks immediately if closed or superseded by another camera switch while waiting.
      // Beklerken kapandıysa ya da başka kamera seçildiyse izleri hemen durdur.
      if (kapandi || bu !== istekNo) {
        for (const iz of yeni.getTracks()) iz.stop();
        return;
      }
      akis = yeni;
      const aktifId = yeni.getVideoTracks()[0]?.getSettings?.().deviceId;
      void cihazlariListele(aktifId || cihazId);
    } catch (e) {
      if (kapandi || bu !== istekNo) return;
      const ad = (e as DOMException | undefined)?.name ?? "";
      // A previously chosen camera may have been unplugged: fall back once to the default camera.
      // Önceden seçili kamera çıkarılmış olabilir: bir kez varsayılan kameraya düş.
      if (cihazId && (ad === "OverconstrainedError" || ad === "NotFoundError")) {
        seciliCihaz = "";
        void baslat();
        return;
      }
      if (ad === "NotAllowedError" || ad === "PermissionDeniedError" || ad === "SecurityError") hata = "izin";
      else if (ad === "NotFoundError" || ad === "DevicesNotFoundError" || ad === "OverconstrainedError") hata = "yok";
      else if (ad === "NotReadableError" || ad === "TrackStartError") hata = "mesgul";
      else hata = "diger";
      yukleniyor = false;
    }
  }

  // Bind the live MediaStream whenever the <video> element or stream changes. · <video> öğesi ya da akış değişince canlı akışı bağla.
  $effect(() => {
    const el = videoEl;
    const s = akis;
    if (!el) return;
    el.srcObject = s;
    if (s) void el.play().catch(() => {});
  });

  onMount(() => {
    katman = katmanAc("medya-kamera", onkapat);
    // Move to <body> so a transformed ancestor cannot trap position: fixed. · Dönüşümlü üst öğe position: fixed'i bozmasın diye <body>'ye taşı.
    document.body.appendChild(kok);
    pencere?.focus();
    // The backend grants camera access only while this window is open (see ec.rs). · Arka uç kamera iznini yalnızca bu pencere açıkken verir (bkz. ec.rs).
    void kameraPenceresi(true)
      .catch(() => {})
      .then(() => baslat());
    const cihazDegisti = () => void cihazlariListele(seciliCihaz || undefined);
    navigator.mediaDevices?.addEventListener?.("devicechange", cihazDegisti);
    return () => {
      kapandi = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", cihazDegisti);
      akisDurdur();
      void kameraPenceresi(false).catch(() => {});
      cekilenTemizle();
      katman?.birak();
      kok.remove();
    };
  });

  function videoHazir() {
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;
    hazir = true;
    yukleniyor = false;
  }

  function cihazDegistir(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    seciliCihaz = id;
    void baslat(id || undefined);
  }

  async function cek() {
    if (!videoEl || !hazir || cekiliyor || cekilen || devredildi) return;
    const g = videoEl.videoWidth;
    const y = videoEl.videoHeight;
    if (!g || !y) return;
    cekiliyor = true;
    try {
      const tuval = document.createElement("canvas");
      tuval.width = g;
      tuval.height = y;
      const c = tuval.getContext("2d");
      if (!c) throw new Error("canvas yok");
      // Mirroring stays preview-only; draw unmirrored so text and faces match reality.
      // Aynalama yalnızca önizlemede kalır; yazılar ve görüntü gerçekle uyuşsun diye aynasız çizilir.
      c.drawImage(videoEl, 0, 0, g, y);
      const blob = await new Promise<Blob | null>((coz) => tuval.toBlob(coz, "image/jpeg", 0.92));
      if (!blob) throw new Error("kodlanamadı");
      if (kapandi) return;
      const damga = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const dosya = new File([blob], `kamera-${damga}.jpg`, { type: "image/jpeg" });
      cekilenTemizle();
      cekilen = { dosya, url: URL.createObjectURL(dosya) };
      await tick();
      pencere?.focus();
    } catch {
      bildirim.goster(t("kamera.cekimHatasi"), 3500, { tur: "hata" });
    } finally {
      cekiliyor = false;
    }
  }

  async function yenidenCek() {
    if (devredildi) return;
    cekilenTemizle();
    await tick();
    if (videoEl && akis) void videoEl.play().catch(() => {});
    pencere?.focus();
  }

  function kullan() {
    if (!cekilen || devredildi) return;
    devredildi = true;
    const dosya = cekilen.dosya;
    // Stop camera tracks immediately; keep the still preview until unmount revokes its URL so the exit transition does not flash.
    // Kamera izlerini hemen durdur; kapanış geçişi titremesin diye hareketsiz önizleme URL'si bileşen kalkarken bırakılır.
    akisDurdur();
    // Release our back layer before MedyaAkisi mounts its own so the stack stays ordered.
    // MedyaAkisi kendi katmanını açmadan önce bizimkini bırak; geri yığını düzgün sıralansın.
    katman?.birak();
    katman = undefined;
    oncek(dosya);
  }

  function kapat() {
    if (katman) katman.kapat();
    else onkapat();
  }

  function tus(e: KeyboardEvent) {
    if (e.defaultPrevented || e.isComposing || e.repeat) return;
    if (e.key === "Escape") {
      e.preventDefault();
      kapat();
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const hedef = e.target as HTMLElement | null;
    // Keep Space/Enter working naturally on focused buttons and the camera selector.
    // Odak düğmede ya da kamera seçicideyken Space/Enter doğal çalışsın.
    if (hedef?.closest("button, a, select, input, textarea")) return;
    if (!cekilen && !hata && hazir && (e.key === " " || e.code === "Space" || e.key === "Enter")) {
      e.preventDefault();
      void cek();
      return;
    }
    if (cekilen && e.key === "Enter" && tercihler.d.enterGonder) {
      e.preventDefault();
      kullan();
    }
  }

  const hataMetni = $derived.by(() => {
    if (hata === "izin") return { baslik: t("kamera.izinYokBaslik"), metin: t("kamera.izinYokMetin") };
    if (hata === "yok") return { baslik: t("kamera.yokBaslik"), metin: t("kamera.yokMetin") };
    if (hata === "mesgul") return { baslik: t("kamera.mesgulBaslik"), metin: t("kamera.mesgulMetin") };
    return { baslik: t("kamera.hataBaslik"), metin: t("kamera.hataMetin") };
  });
</script>

<svelte:window onkeydown={tus} />

<div bind:this={kok} class="kamera-kok">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="perde" onclick={kapat} in:perdeGir|global out:perdeCik|global></div>
  <div class="kap">
    <div
      class="pencere"
      role="dialog"
      aria-modal="true"
      aria-label={t("kamera.baslik")}
      tabindex="-1"
      bind:this={pencere}
      in:menuGir|global
      out:menuCik|global
    >
      <header class="ust">
        <h2>{t("kamera.baslik")}</h2>
        <div class="ust-sag">
          {#if kameralar.length > 1 && !cekilen && !hata}
            <select class="cihaz-sec" value={seciliCihaz} onchange={cihazDegistir} aria-label={t("kamera.sec")}>
              {#each kameralar as c, i (c.deviceId || i)}
                <option value={c.deviceId}>{c.label || t("kamera.ad", { n: i + 1 })}</option>
              {/each}
            </select>
          {/if}
          <button type="button" class="simge-dugme" onclick={kapat} aria-label={t("eylem.kapat")}>
            <Ikon ad="kapat" boyut={20} />
          </button>
        </div>
      </header>

      <div class="sahne">
        {#if hata}
          <BosDurum
            ikon="kamera"
            ton="hata"
            baslik={hataMetni.baslik}
            metin={hataMetni.metin}
            eylem={t("eylem.tekrarDene")}
            onEylem={() => void baslat(seciliCihaz || undefined)}
          />
        {:else}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            bind:this={videoEl}
            class="canli"
            class:gizli={!!cekilen}
            autoplay
            playsinline
            muted
            onloadedmetadata={videoHazir}
            onloadeddata={videoHazir}
            onplaying={videoHazir}
          ></video>
          {#if yukleniyor && !cekilen}
            <div class="bekle" role="status">
              <span class="yuklenme"></span>
              <span>{t("kamera.hazirlaniyor")}</span>
            </div>
          {/if}
          {#if cekilen}
            <img class="onizleme" src={cekilen.url} alt={t("kamera.baslik")} draggable="false" />
          {/if}
        {/if}
      </div>

      {#if !hata}
        <footer class="alt">
          {#if cekilen}
            <div class="dugmeler">
              <button type="button" class="buton cizgili" onclick={() => void yenidenCek()}>
                <Ikon ad="yenile" boyut={18} />
                <span>{t("kamera.yenidenCek")}</span>
              </button>
              <button type="button" class="buton birincil" onclick={kullan}>
                <Ikon ad="onay" boyut={18} />
                <span>{t("kamera.kullan")}</span>
              </button>
            </div>
            {#if tercihler.d.enterGonder}
              <p class="ipucu">{t("kamera.onizlemeIpucu")}</p>
            {/if}
          {:else}
            <button type="button" class="buton birincil cek" onclick={() => void cek()} disabled={!hazir || cekiliyor}>
              <Ikon ad="kamera" boyut={20} />
              <span>{t("kamera.cek")}</span>
            </button>
            <p class="ipucu">{t("kamera.ipucu")}</p>
          {/if}
        </footer>
      {/if}
    </div>
  </div>
</div>

<style>
  .kamera-kok {
    position: fixed;
    inset: 0;
    z-index: 150;
  }
  .perde {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--zemin) 60%, transparent);
  }
  .kap {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    pointer-events: none;
  }
  .pencere {
    pointer-events: auto;
    width: min(760px, 100%);
    max-height: calc(100dvh - 32px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    outline: none;
    border-radius: 24px;
    background: var(--yuzey-1);
    border: 1px solid var(--kenar-ince);
    box-shadow: var(--kat-2);
    color: var(--yazi);
  }
  .ust {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 8px 8px 8px 20px;
    border-bottom: 1px solid var(--kenar-ince);
  }
  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .ust-sag {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .cihaz-sec {
    max-width: 240px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--kenar);
    background: var(--yuzey-2);
    color: var(--yazi);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .sahne {
    position: relative;
    flex: 1;
    min-height: 280px;
    display: grid;
    place-items: center;
    background: var(--zemin);
    overflow: hidden;
  }
  /* Mirror only the live preview; the captured image is drawn unmirrored. · Yalnızca canlı önizleme aynalı; çekilen fotoğraf aynasız çizilir. */
  .canli {
    width: 100%;
    height: 100%;
    max-height: min(62dvh, 520px);
    object-fit: contain;
    display: block;
    transform: scaleX(-1);
  }
  .canli.gizli {
    display: none;
  }
  .onizleme {
    width: 100%;
    height: 100%;
    max-height: min(62dvh, 520px);
    object-fit: contain;
    display: block;
  }
  .bekle {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--zemin);
    color: var(--yazi-2);
    font-size: 0.875rem;
  }
  .alt {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 20px 16px;
    border-top: 1px solid var(--kenar-ince);
    background: var(--yuzey-1);
  }
  .cek {
    width: auto;
    min-width: 180px;
  }
  .dugmeler {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .ipucu {
    font-size: 0.75rem;
    color: var(--yazi-2);
    text-align: center;
  }
</style>
