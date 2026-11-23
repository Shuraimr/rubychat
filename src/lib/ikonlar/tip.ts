// Shape of a vendored icon pack. `mod` tells Ikon.svelte how to paint: "cizgi" = stroked outline icons (Lucide, Tabler),
// "dolgu" = filled glyph paths (Material Symbols, Phosphor). `dolu` = optional filled variants for active states (Material only).
// Alınmış bir simge paketinin biçimi. `mod`, Ikon.svelte'e nasıl boyayacağını söyler: "cizgi" = çizgili dış hat simgeler (Lucide, Tabler),
// "dolgu" = dolu glif yolları (Material Symbols, Phosphor). `dolu` = etkin haller için isteğe bağlı dolu varyantlar (yalnızca Material).
export interface SimgePaketi {
  viewBox: string;
  mod: "cizgi" | "dolgu";
  simgeler: Record<string, string>;
  dolu: Record<string, string>;
}
