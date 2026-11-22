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
    // Not in rubyyard's set: written in the same style · rubyyard setinde yok: aynı stilde yazıldı
    geri: '<path d="m15 18-6-6 6-6"/>',
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
  } as const;
  export type IkonAdi = keyof typeof YOLLAR;
</script>

<script lang="ts">
  let { ad, boyut = 24 }: { ad: IkonAdi; boyut?: number } = $props();
</script>

<svg
  width={boyut}
  height={boyut}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags: static trusted constants above, never user input -->
  {@html YOLLAR[ad]}
</svg>
