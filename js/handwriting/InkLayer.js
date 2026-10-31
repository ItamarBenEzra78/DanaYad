/*
 * Ink layer: makes a rendered text layer look like pen on paper.
 *
 * Input is an RGBA canvas of the text alone (transparent background), at
 * `scale` device px per CSS px. Fonts draw every stroke with the same
 * width and the same flat colour; a pen does not:
 *
 *   weight    stroke width swells and thins slowly along the writing
 *             (pen pressure): a smooth low-frequency field moves the
 *             coverage threshold of a slightly blurred alpha up or down
 *   pooling   ink is not one flat colour: medium-frequency noise lightens
 *             and darkens the colour within a letter
 *   crossings where strokes cross or the ink is dense it goes darker
 *   edges     optionally ragged (a dry marker); off by default, a ballpoint
 *             leaves a clean edge
 *
 * Deterministic for a given seed, so the backend and the browser agree.
 * Runs in horizontal bands so memory stays bounded for long documents.
 */
import { Turbulence, FieldGrid } from './InkDisplacement.js';

const DEFAULTS = {
  seed: 11,
  base: 0.52,      // coverage threshold: 0.5 keeps the font's stroke width, lower = bolder
  weight: 0.08,    // threshold swing: 0 = constant width, 0.2 = clearly varying
  pooling: 0.14,   // colour lightness swing within strokes
  crossings: 0.08, // extra darkness where ink is dense
  edge: 0,         // raggedness of stroke edges (0 = clean pen line, 0.3 = dry marker)
  sharpen: 0.1,    // half-width of the coverage ramp: small = crisp edge
};

const BAND_ROWS = 256;
const nextFrame = () => new Promise(r => setTimeout(r, 0));

/** Separable [1 2 1]/4 blur of a float plane (one pass each axis). */
function blur121(src, w, h, dst, tmp) {
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const l = src[o + (x > 0 ? x - 1 : x)], c = src[o + x], r = src[o + (x < w - 1 ? x + 1 : x)];
      tmp[o + x] = (l + 2 * c + r) * 0.25;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : y) * w, o = y * w, dn = (y < h - 1 ? y + 1 : y) * w;
    for (let x = 0; x < w; x++) dst[o + x] = (tmp[up + x] + 2 * tmp[o + x] + tmp[dn + x]) * 0.25;
  }
}

/** Box blur of radius r (density estimate), via running sums. */
function boxBlur(src, w, h, r, dst, tmp) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s / n;
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

function smoothstep(a, b, x) {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Cheap deterministic white noise in [0, 1) for pixel (x, y). */
function hashNoise(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export async function applyInkLayer(canvas, scale, options = {}) {
  const p = { ...DEFAULTS, ...options };
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Noise fields in CSS px. A displacement-style layer reads as (value - .5) * scale.
  const field = (fx, octaves, seed, fractal) => ({
    noise: new Turbulence({ fx, fy: fx, octaves, seed, fractal }), scale: 2, xCh: 0, yCh: 1,
  });
  const weightLayer = field(0.012, 2, p.seed, true);        // ~80 css px: changes over a word
  const poolLayer = field(0.09, 3, p.seed + 1, true);       // ~11 css px: within a letter

  const pad = 3 * scale + 2;              // blur reach between bands
  const d = new Float64Array(2);
  let pending = null;

  for (let y0 = 0; y0 < H; y0 += BAND_ROWS) {
    const y1 = Math.min(H, y0 + BAND_ROWS);
    const sy0 = Math.max(0, y0 - pad), sy1 = Math.min(H, y1 + pad);
    const h = sy1 - sy0;
    const img = ctx.getImageData(0, sy0, W, h);
    if (pending) ctx.putImageData(pending[0], 0, pending[1]);
    const data = img.data;
    const N = W * h;

    // Premultiplied planes: alpha and colour, so colour can spread into thickened pixels.
    const a = new Float32Array(N), r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0, q = 0; i < N; i++, q += 4) {
      const al = data[q + 3] / 255;
      a[i] = al; r[i] = data[q] * al; g[i] = data[q + 1] * al; b[i] = data[q + 2] * al;
    }
    const tmp = new Float32Array(N);
    const ab = new Float32Array(N), rb = new Float32Array(N), gb = new Float32Array(N), bb = new Float32Array(N);
    blur121(a, W, h, ab, tmp); blur121(r, W, h, rb, tmp); blur121(g, W, h, gb, tmp); blur121(b, W, h, bb, tmp);
    const dens = new Float32Array(N);
    boxBlur(a, W, h, 3 * scale, dens, tmp);

    const margin = 4;
    const wGrid = new FieldGrid(weightLayer, -margin, sy0 / scale - margin, W / scale + margin, sy1 / scale + margin, 1 / scale);
    const pGrid = new FieldGrid(poolLayer, -margin, sy0 / scale - margin, W / scale + margin, sy1 / scale + margin, 1 / scale);

    for (let yy = y0 - sy0, Y = y0; Y < y1; yy++, Y++) {
      for (let x = 0; x < W; x++) {
        const i = yy * W + x;
        const cov = ab[i];
        if (cov < 0.02 && a[i] < 0.02) continue;
        const cx = (x + 0.5) / scale, cy = (Y + 0.5) / scale;
        wGrid.at(cx, cy, d);
        const wv = d[0];                       // -1 .. 1
        pGrid.at(cx, cy, d);
        const pv = d[1];                       // -1 .. 1

        // Light pixels are a highlighter band, not ink: keep their coverage as drawn.
        const inv0 = cov > 0.001 ? 1 / cov : 0;
        const light = (0.299 * rb[i] + 0.587 * gb[i] + 0.114 * bb[i]) * inv0 > 150; // luma: yellow ~206, pens 50-90
        // weight: lower threshold = thicker stroke
        const t = p.base - p.weight * wv;
        let alpha = light ? a[i] : smoothstep(t - p.sharpen, t + p.sharpen, cov);
        // ragged edge
        if (alpha > 0.05 && alpha < 0.95) {
          alpha *= 1 - p.edge * (hashNoise(x, Y, p.seed) - 0.5);
        }
        if (alpha <= 0.003) { data[(i) * 4 + 3] = 0; continue; }
        alpha = alpha > 1 ? 1 : alpha;

        // colour from the blurred premultiplied planes
        const inv = cov > 0.001 ? 1 / cov : 0;
        let lum = 1 + p.pooling * pv * 0.5;
        const dense = dens[i];
        lum *= 1 - p.crossings * Math.max(0, dense - 0.4) / 0.6;
        const q = i * 4;
        data[q] = Math.min(255, rb[i] * inv * lum);
        data[q + 1] = Math.min(255, gb[i] * inv * lum);
        data[q + 2] = Math.min(255, bb[i] * inv * lum);
        data[q + 3] = alpha * 255;
      }
    }
    // Only the band's own rows are written back; the padding rows were read for context.
    const out = ctx.createImageData(W, y1 - y0);
    out.data.set(data.subarray((y0 - sy0) * W * 4, (y1 - sy0) * W * 4));
    pending = [out, y0];
    await nextFrame();
  }
  if (pending) ctx.putImageData(pending[0], 0, pending[1]);
}
