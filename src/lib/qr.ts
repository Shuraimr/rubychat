// Small QR code maker (byte mode, error level M, versions 1-10 = up to 213 bytes): enough for a web address, without a package.
// Küçük QR kodu üretici (bayt kipi, M düzeyi, sürüm 1-10 = en çok 213 bayt): bir web adresine yeter, paket gerektirmez.

// Per version: [error correction bytes per block, blocks in group 1, data bytes each, blocks in group 2 (one byte longer)]
// Sürüm başına: [blok başına düzeltme baytı, 1. gruptaki blok, her birindeki veri baytı, 2. gruptaki blok (bir bayt uzun)]
const BLOK: [number, number, number, number][] = [
  [10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0],
  [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1],
];
const HIZA = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const US = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  US[i] = US[i + 255] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
const carp = (a: number, b: number) => (a && b ? US[LOG[a] + LOG[b]] : 0);

/** Reed-Solomon check bytes · Reed-Solomon denetim baytları */
function duzeltme(veri: number[], n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const y = new Array<number>(g.length + 1).fill(0);
    g.forEach((c, j) => {
      y[j] ^= c;
      y[j + 1] ^= carp(c, US[i]);
    });
    g = y;
  }
  const k = [...veri, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < veri.length; i++) {
    const c = k[i];
    if (c) for (let j = 1; j < g.length; j++) k[i + j] ^= carp(g[j], c);
  }
  return k.slice(veri.length);
}

/** true = dark. null when the text is too long. · true = koyu. Metin çok uzunsa null. */
export function qr(metin: string): boolean[][] | null {
  const bayt = [...new TextEncoder().encode(metin)];
  const veriBoyu = ([, a, d, b]: (typeof BLOK)[number]) => a * d + b * (d + 1);
  const surum = BLOK.findIndex((b, i) => bayt.length + (i >= 9 ? 3 : 2) <= veriBoyu(b)) + 1;
  if (!surum) return null;
  const [ec, g1, d1, g2] = BLOK[surum - 1];
  const toplam = veriBoyu(BLOK[surum - 1]);

  // Data bits: mode, length, bytes, end, padding · Veri bitleri: kip, uzunluk, baytlar, son, dolgu
  const bit: number[] = [];
  const ekle = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bit.push((v >> i) & 1);
  };
  ekle(4, 4);
  ekle(bayt.length, surum >= 10 ? 16 : 8);
  bayt.forEach((b) => ekle(b, 8));
  ekle(0, Math.min(4, toplam * 8 - bit.length));
  while (bit.length % 8) bit.push(0);
  const kod: number[] = [];
  for (let i = 0; i < bit.length; i += 8) kod.push(bit.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let i = 0; kod.length < toplam; i++) kod.push(i % 2 ? 0x11 : 0xec);

  const bloklar: number[][] = [];
  for (let i = 0, p = 0; i < g1 + g2; i++) {
    const n = i < g1 ? d1 : d1 + 1;
    bloklar.push(kod.slice(p, p + n));
    p += n;
  }
  const denetim = bloklar.map((b) => duzeltme(b, ec));
  const son: number[] = [];
  for (let i = 0; i <= d1; i++) bloklar.forEach((b) => i < b.length && son.push(b[i]));
  for (let i = 0; i < ec; i++) denetim.forEach((d) => son.push(d[i]));

  const n = 17 + 4 * surum;
  const m: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const sabit: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const koy = (y: number, x: number, v: boolean) => {
    if (y < 0 || x < 0 || y >= n || x >= n) return;
    m[y][x] = v;
    sabit[y][x] = true;
  };
  for (let i = 0; i < n; i++) {
    koy(6, i, i % 2 === 0);
    koy(i, 6, i % 2 === 0);
  }
  for (const [cy, cx] of [[3, 3], [3, n - 4], [n - 4, 3]])
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++) {
        const u = Math.max(Math.abs(x), Math.abs(y));
        koy(cy + y, cx + x, u !== 2 && u !== 4);
      }
  const h = HIZA[surum - 1];
  const l = h.length - 1;
  h.forEach((cy, i) =>
    h.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === l) || (i === l && j === 0)) return;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) koy(cy + y, cx + x, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }),
  );
  const bicim = (maske: number) => {
    // Level M = 00 · M düzeyi = 00
    let k = maske;
    for (let i = 0; i < 10; i++) k = (k << 1) ^ ((k >> 9) * 0x537);
    const b = ((maske << 10) | k) ^ 0x5412;
    const bt = (i: number) => ((b >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) koy(i, 8, bt(i));
    koy(7, 8, bt(6));
    koy(8, 8, bt(7));
    koy(8, 7, bt(8));
    for (let i = 9; i < 15; i++) koy(8, 14 - i, bt(i));
    for (let i = 0; i < 8; i++) koy(8, n - 1 - i, bt(i));
    for (let i = 8; i < 15; i++) koy(n - 15 + i, 8, bt(i));
    koy(n - 8, 8, true);
  };
  bicim(0);
  if (surum >= 7) {
    let k = surum;
    for (let i = 0; i < 12; i++) k = (k << 1) ^ ((k >> 11) * 0x1f25);
    const b = (surum << 12) | k;
    for (let i = 0; i < 18; i++) {
      const v = ((b >> i) & 1) === 1;
      koy(Math.floor(i / 3), n - 11 + (i % 3), v);
      koy(n - 11 + (i % 3), Math.floor(i / 3), v);
    }
  }
  let s = 0;
  for (let sag = n - 1; sag >= 1; sag -= 2) {
    if (sag === 6) sag = 5;
    for (let v = 0; v < n; v++)
      for (let j = 0; j < 2; j++) {
        const x = sag - j;
        const y = ((sag + 1) & 2) === 0 ? n - 1 - v : v;
        if (!sabit[y][x] && s < son.length * 8) {
          m[y][x] = ((son[s >> 3] >> (7 - (s & 7))) & 1) === 1;
          s++;
        }
      }
  }

  const MASKE: ((y: number, x: number) => boolean)[] = [
    (y, x) => (x + y) % 2 === 0,
    (y) => y % 2 === 0,
    (_, x) => x % 3 === 0,
    (y, x) => (x + y) % 3 === 0,
    (y, x) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (y, x) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (y, x) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (y, x) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const uygula = (k: number) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!sabit[y][x] && MASKE[k](y, x)) m[y][x] = !m[y][x];
  };
  const ceza = () => {
    let c = 0;
    let koyu = 0;
    for (const dik of [false, true])
      for (let a = 0; a < n; a++) {
        const satir = Array.from({ length: n }, (_, b) => (dik ? m[b][a] : m[a][b]));
        for (let b = 0, u = 0; b < n; b++) {
          u = b && satir[b] === satir[b - 1] ? u + 1 : 1;
          if (u === 5) c += 3;
          else if (u > 5) c++;
        }
        const d = satir.map((v) => (v ? "1" : "0")).join("");
        for (const kalip of ["10111010000", "00001011101"]) for (let i = d.indexOf(kalip); i >= 0; i = d.indexOf(kalip, i + 1)) c += 40;
        if (!dik) koyu += satir.filter(Boolean).length;
      }
    for (let y = 1; y < n; y++) for (let x = 1; x < n; x++) if (m[y][x] === m[y - 1][x] && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x - 1]) c += 3;
    return c + Math.floor(Math.abs((koyu * 20) / (n * n) - 10)) * 10;
  };
  let enIyi = 0;
  let enAz = Infinity;
  for (let k = 0; k < 8; k++) {
    uygula(k);
    bicim(k);
    const c = ceza();
    if (c < enAz) {
      enAz = c;
      enIyi = k;
    }
    uygula(k);
  }
  uygula(enIyi);
  bicim(enIyi);
  return m;
}
