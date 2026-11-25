<!--
  Picture of a native call: pulls the newest frame from Rust (raw I420) and draws it with WebGL. Independent of requestAnimationFrame, and
  always "latest wins", so a slow machine drops frames instead of falling behind.
  Yerel aramanın görüntüsü: Rust'tan en yeni kareyi (ham I420) çeker, WebGL ile çizer. requestAnimationFrame'e bağlı değildir ve hep "en yenisi"
  kazanır; yavaş makine geride kalmaz, kare atlar.
-->
<script lang="ts">
  import { yerelAramaKare } from "../api/komutlar";
  import { t } from "../i18n";

  let { anahtar }: { anahtar: string } = $props();
  let tuval = $state<HTMLCanvasElement | null>(null);
  let geldi = $state(false);

  const VS = "attribute vec2 k;varying vec2 v;void main(){gl_Position=vec4(k,0.,1.);v=vec2(k.x*.5+.5,.5-k.y*.5);}";
  // Limited-range BT.601, the matrix libyuv uses on the sending side. · Sınırlı aralık BT.601: gönderende libyuv'nin kullandığı matris.
  const FS =
    "precision mediump float;varying vec2 v;uniform sampler2D y,u,w;void main(){float Y=(texture2D(y,v).r-.0627)*1.1644,b=texture2D(u,v).r-.502,r=texture2D(w,v).r-.502;gl_FragColor=vec4(Y+1.596*r,Y-.3918*b-.813*r,Y+2.0172*b,1.);}";

  function kur(c: HTMLCanvasElement) {
    const gl = c.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    const p = gl.createProgram()!;
    for (const [tur, kaynak] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
      const s = gl.createShader(tur)!;
      gl.shaderSource(s, kaynak);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const k = gl.getAttribLocation(p, "k");
    gl.enableVertexAttribArray(k);
    gl.vertexAttribPointer(k, 2, gl.FLOAT, false, 0, 0);
    // Chroma rows are not multiples of four. · Renk satırları dördün katı değil.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    ["y", "u", "w"].forEach((ad, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      for (const [a, d] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, a, d);
      gl.uniform1i(gl.getUniformLocation(p, ad), i);
    });
    return (b: ArrayBuffer) => {
      const bas = new DataView(b);
      const g = bas.getUint32(4, true);
      const h = bas.getUint32(8, true);
      const cg = (g + 1) >> 1;
      const ch = (h + 1) >> 1;
      if (!g || !h || b.byteLength < 12 + g * h + 2 * cg * ch) return;
      const yeni = c.width !== g || c.height !== h;
      if (yeni) {
        c.width = g;
        c.height = h;
        gl.viewport(0, 0, g, h);
      }
      let yer = 12;
      for (const [i, w, y] of [[0, g, h], [1, cg, ch], [2, cg, ch]]) {
        const d = new Uint8Array(b, yer, w * y);
        yer += w * y;
        gl.activeTexture(gl.TEXTURE0 + i);
        if (yeni) gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, y, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, d);
        else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, y, gl.LUMINANCE, gl.UNSIGNED_BYTE, d);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  $effect(() => {
    const c = tuval;
    const ad = anahtar;
    if (!c) return;
    const ciz = kur(c);
    if (!ciz) return;
    let dur = false;
    void (async () => {
      let sira = 0;
      while (!dur) {
        try {
          const b = await yerelAramaKare(ad, sira);
          if (dur) break;
          if (b.byteLength < 12) {
            // The sharer stopped and started again: numbers begin anew. · Paylaşan durup yeniden başladı: numaralar baştan.
            sira = 0;
            continue;
          }
          sira = new DataView(b).getUint32(0, true);
          ciz(b);
          geldi = true;
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    })();
    return () => {
      dur = true;
      geldi = false;
    };
  });
</script>

<canvas bind:this={tuval}></canvas>
{#if !geldi}<p role="status">{t("yerel.ekranBekle")}</p>{/if}

<style>
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  p { position: absolute; inset: 0; display: grid; place-items: center; color: var(--yazi-2); }
</style>
