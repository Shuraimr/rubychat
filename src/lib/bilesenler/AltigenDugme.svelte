<!--
  Hexagonal ruby button (the "new chat" FAB and the composer's send / jump button). The faces are an inline SVG: the top-left face is
  lit, the bottom ones darker, like a cut ruby, all derived from the accent with white / black overlays so every theme and accent works.
  The SVG shape (not a clip-path) carries the drop shadow. Size is in rem (clamped) so it grows with the text size; the hit area is >= 44px.
  Altıgen yakut düğme ("yeni sohbet" FAB'ı ve yazma alanının gönder / aşağı in düğmesi). Yüzler satır içi SVG: sol üst yüz aydınlık,
  alttakiler koyu; kesilmiş yakut gibi. Hepsi vurgudan beyaz / siyah katmanlarla türetilir; her tema ve vurguda çalışır.
  Gölgeyi clip-path değil SVG biçimi taşır. Boyut rem (sınırlı): yazı boyutuyla büyür; dokunma alanı >= 44px.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { etiket, onclick, children, boyut = 3.5, devre = false, tur = "button" }: {
    etiket: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    /** size in rem · rem cinsinden boyut */
    boyut?: number;
    devre?: boolean;
    tur?: "button" | "submit";
  } = $props();
</script>

<button class="altigen-dugme" type={tur} aria-label={etiket} {onclick} disabled={devre} style:width="clamp(44px, {boyut}rem, {boyut * 1.6}rem)" style:height="clamp(44px, {boyut}rem, {boyut * 1.6}rem)">
  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <!-- Rounded hexagon: a fat stroke of the same colour rounds the corners · Yuvarlak köşeli altıgen: aynı renkte kalın çizgi köşeleri yuvarlar -->
    <path d="M50 6 88 28v44L50 94 12 72V28z" fill="var(--vurgu)" stroke="var(--vurgu)" stroke-width="8" stroke-linejoin="round" />
    <path d="M50 6 88 28 50 50 12 28z" fill="#fff" opacity=".2" />
    <path d="M50 50 88 28v44z" fill="#fff" opacity=".05" />
    <path d="M50 50 88 72 50 94z" fill="#000" opacity=".14" />
    <path d="M50 50 50 94 12 72z" fill="#000" opacity=".24" />
    <path d="M12 28 50 6 88 28" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" stroke-linejoin="round" />
  </svg>
  <span class="ic">{@render children()}</span>
</button>

<style>
  button { -webkit-tap-highlight-color: transparent; }
  button:disabled { opacity: .5; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .ic { position: relative; display: inline-flex; transition: transform var(--sure-yay) var(--egri-yay-capkin); }
</style>
