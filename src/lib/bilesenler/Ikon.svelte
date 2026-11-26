<!--
  Inline SVG icon set (24 viewBox, stroke currentColor, width 2). Paths copied from rubyyard's ikon.ejs.
  Satır içi SVG simge seti (24 viewBox, stroke currentColor, kalınlık 2). Yollar rubyyard'ın ikon.ejs dosyasından alındı.
-->
<script lang="ts" module>
  export const YOLLAR = {
    ara: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    kisi: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    kalkan: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    kalem: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    sohbet: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    izgara: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    cikis: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    onay: '<path d="M20 6 9 17l-5-5"/>',
    yukari: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    kapat: '<path d="M18 6 6 18M6 6l12 12"/>',
    klavye: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12.500h.01M18 12.500h.01M10 12.500h4M8 16h8"/>',
    geriSil: '<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="m12 9.500 5 5m0-5-5 5"/>',
    ayar: '<path d="M4 7h9m5 0h2M4 17h2m5 0h9"/><circle cx="15.500" cy="7" r="2.500"/><circle cx="8.500" cy="17" r="2.500"/>',
    // Not in rubyyard's set: written in the same style · rubyyard setinde yok: aynı stilde yazıldı
    geri: '<path d="m15 18-6-6 6-6"/>',
    telefonCihaz: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    yanPanel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.500 4v16"/>',
    artik: '<path d="M12 5v14M5 12h14"/>',
    ucNokta: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    uyari: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>',
    bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    telefon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    // The same handset turned down = hang up · Aynı ahize aşağı çevrilmiş = kapat
    telefonKapat: '<g transform="rotate(135 12 12)"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></g>',
    mikrofon: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
    mikrofonKapali: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M3 3l18 18"/>',
    hoparlor: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    saat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    asagi: '<path d="m19 12-7 7-7-7"/><path d="M12 5v14"/>',
    // Added for the design pass (same style) · Tasarım turu için eklendi (aynı stil)
    sagOk: '<path d="m9 18 6-6-6-6"/>',
    asagiOk: '<path d="m6 9 6 6 6-6"/>',
    kopya: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    galeri: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    kamera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    atac: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    gonder: '<path fill="currentColor" d="M3.71 3.05a.5.5 0 0 0-.68.63l2.84 7.62a2 2 0 0 1 0 1.4l-2.84 7.62a.5.5 0 0 0 .68.63l18-8.5a.5.5 0 0 0 0-.9z"/><path d="M7 12h6" stroke="var(--vurgu)"/>',
    dosya: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    bulutYok: '<path d="M22.6 17A5 5 0 0 0 18 10h-1.3A8 8 0 0 0 9.7 4M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><path d="m2 2 20 20"/>',
    zil: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    palet: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.7-1.7H16c3 0 5.5-2.5 5.5-5.5C21.5 6 17.5 2 12 2z"/>',
    gunes: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    emoji: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    anahtar: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    kalkanOnay: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    yenile: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    tikCift: '<path d="M2 12.5 6.5 17 15 7"/><path d="M11 15.5 12.5 17 21 7"/>',
    yazi: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    // Message actions (same style) · Mesaj eylemleri (aynı stil)
    yanitla: '<path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
    ilet: '<path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
    sabitle: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    cop: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    // Added for design D (GIF, sticker/GIF making, devices, backup) · D tasarımı için eklendi (GIF, çıkartma/GIF yapma, cihazlar, yedek)
    gif: '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8.5 10.5H7a1.5 1.5 0 0 0 0 3h1.5V12M12 10v4M15 14v-4h2.5M15 12h2"/>',
    makas: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    cihaz: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    bulut: '<path d="M17.5 19a4.5 4.5 0 1 0-1-8.9A6 6 0 1 0 6 17.5"/><path d="m12 12 0 8M9 15l3-3 3 3"/>',
    pusula: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    yildiz: '<path d="m12 2 3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9Z"/>',
    // Call screen · Arama ekranı
    ekranPaylas: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 14V8M9 11l3-3 3 3"/>',
    sesler: '<path d="M4 9v6h4l5 4V5L8 9ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
    sesYok: '<path d="M4 9v6h4l5 4V5L8 9ZM17 9l5 6M22 9l-5 6"/>',
    tamEkran: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    pencere: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    anket: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/>',
    indir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    klasor: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    // Space management & room settings · Alan yönetimi ve oda ayarları
    baglanti: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    kisiEkle: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
    disli: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  } as const;
  export type IkonAdi = keyof typeof YOLLAR;
</script>

<script lang="ts">
  import { material } from "../ikonlar/material";

  /** `dolu` = the filled variant for an active state · `dolu` = etkin hal için dolu varyant */
  let { ad, boyut = 24, dolu = false }: { ad: IkonAdi; boyut?: number; dolu?: boolean } = $props();
  // A bit larger than asked everywhere: the glyphs have their own padding. · Her yerde istenenden biraz büyük: gliflerin kendi iç boşluğu var.
  const rem = $derived(Math.round(boyut * 1.1) / 16);
  const govde = $derived((dolu && material.dolu[ad]) || material.simgeler[ad] || null);
</script>

<svg
  style:width="{rem}rem"
  style:height="{rem}rem"
  style:flex="none"
  viewBox={govde ? material.viewBox : "0 0 24 24"}
  fill={govde ? "currentColor" : "none"}
  stroke={!govde ? "currentColor" : "none"}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags: vendored SVG constants (src/lib/ikonlar), never user input -->
  {@html govde ?? YOLLAR[ad]}
</svg>
