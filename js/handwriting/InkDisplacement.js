/*
 * Canvas port of the #ink-tremor SVG filter (index.html) for exports that
 * cannot render SVG filters (html2canvas). The parameters are read from the
 * <filter> element itself, so the sliders and the markup stay the single
 * source of truth.
 *
 * feTurbulence follows the reference implementation in the SVG 1.1 spec
 * (filters, feTurbulence), which is what Chrome/Skia implement, so the noise
 * field matches the one drawn on screen. feDisplacementMap:
 *   out(x, y) = in(x + scale * (XC(x, y) - .5), y + scale * (YC(x, y) - .5))
 * applied layer after layer, sampled bilinearly.
 */

const BSIZE = 0x100;
const BM = 0xff;
const PERLIN_N = 0x1000;
const RAND_M = 2147483647;
const RAND_A = 16807;
const RAND_Q = 127773;
const RAND_R = 2836;

function setupSeed(seed) {
  if (seed <= 0) seed = -(seed % (RAND_M - 1)) + 1;
  if (seed > RAND_M - 1) seed = RAND_M - 1;
  return seed;
}

function nextRandom(seed) {
  let r = RAND_A * (seed % RAND_Q) - RAND_R * Math.floor(seed / RAND_Q);
  if (r <= 0) r += RAND_M;
  return r;
}

export class Turbulence {
  constructor({ fx, fy, octaves, seed, fractal }) {
    Object.assign(this, { fx, fy, octaves, fractal });
    const lattice = new Int32Array(BSIZE + BSIZE + 2);
    const grad = [0, 1, 2, 3].map(() => new Float64Array((BSIZE + BSIZE + 2) * 2));
    let s = setupSeed(Math.round(seed));
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < BSIZE; i++) {
        lattice[i] = i;
        for (let j = 0; j < 2; j++) {
          s = nextRandom(s);
          grad[k][i * 2 + j] = ((s % (BSIZE + BSIZE)) - BSIZE) / BSIZE;
        }
        const len = Math.hypot(grad[k][i * 2], grad[k][i * 2 + 1]) || 1;
        grad[k][i * 2] /= len;
        grad[k][i * 2 + 1] /= len;
      }
    }
    for (let i = BSIZE - 1; i > 0; i--) {
      const k = lattice[i];
      s = nextRandom(s);
      const j = s % BSIZE;
      lattice[i] = lattice[j];
      lattice[j] = k;
    }
    for (let i = 0; i < BSIZE + 2; i++) {
      lattice[BSIZE + i] = lattice[i];
      for (let k = 0; k < 4; k++) {
        grad[k][(BSIZE + i) * 2] = grad[k][i * 2];
        grad[k][(BSIZE + i) * 2 + 1] = grad[k][i * 2 + 1];
      }
    }
    this.lattice = lattice;
    this.grad = grad;
  }

  _noise2(g, x, y) {
    const L = this.lattice;
    let t = x + PERLIN_N;
    const ix = Math.trunc(t);
    const bx0 = ix & BM, bx1 = (bx0 + 1) & BM;
    const rx0 = t - ix, rx1 = rx0 - 1;
    t = y + PERLIN_N;
    const iy = Math.trunc(t);
    const by0 = iy & BM, by1 = (by0 + 1) & BM;
    const ry0 = t - iy, ry1 = ry0 - 1;
    const i = L[bx0], j = L[bx1];
    const b00 = L[i + by0] * 2, b10 = L[j + by0] * 2, b01 = L[i + by1] * 2, b11 = L[j + by1] * 2;
    const sx = rx0 * rx0 * (3 - 2 * rx0);
    const sy = ry0 * ry0 * (3 - 2 * ry0);
    let u = rx0 * g[b00] + ry0 * g[b00 + 1];
    let v = rx1 * g[b10] + ry0 * g[b10 + 1];
    const a = u + sx * (v - u);
    u = rx0 * g[b01] + ry1 * g[b01 + 1];
    v = rx1 * g[b11] + ry1 * g[b11 + 1];
    const b = u + sx * (v - u);
    return a + sy * (b - a);
  }

  /** Channel value in [0, 1] at user-space point (x, y), as the filter result stores it. */
  value(channel, x, y) {
    const g = this.grad[channel];
    let vx = x * this.fx, vy = y * this.fy, ratio = 1, sum = 0;
    for (let o = 0; o < this.octaves; o++) {
      const n = this._noise2(g, vx, vy);
      sum += (this.fractal ? n : Math.abs(n)) / ratio;
      vx *= 2; vy *= 2; ratio *= 2;
    }
    const v = this.fractal ? (sum + 1) / 2 : sum;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
}

const CHANNELS = 'RGBA';

/** The displacement layers of an SVG <filter>, in the order they apply to SourceGraphic. */
export function readFilterLayers(filterEl) {
  const noise = {};
  const layers = [];
  for (const el of filterEl.children) {
    if (el.localName === 'feTurbulence') {
      const [fx, fy = fx] = (el.getAttribute('baseFrequency') || '0').trim().split(/[\s,]+/).map(Number);
      noise[el.getAttribute('result')] = new Turbulence({
        fx, fy,
        octaves: parseInt(el.getAttribute('numOctaves') || '1', 10),
        seed: parseFloat(el.getAttribute('seed') || '0'),
        fractal: el.getAttribute('type') === 'fractalNoise',
      });
    } else if (el.localName === 'feDisplacementMap') {
      layers.push({
        scale: parseFloat(el.getAttribute('scale') || '0'),
        noise: noise[el.getAttribute('in2')],
        xCh: CHANNELS.indexOf(el.getAttribute('xChannelSelector') || 'A'),
        yCh: CHANNELS.indexOf(el.getAttribute('yChannelSelector') || 'A'),
      });
    }
  }
  return layers.filter(l => l.noise && l.scale);
}

/**
 * Displacement field of one layer sampled on a grid (CSS px), so later
 * layers can be read at displaced, off-grid points by bilinear lookup.
 * The grid step resolves the layer's highest octave.
 */
class FieldGrid {
  constructor(layer, x0, y0, x1, y1, minStep) {
    const n = layer.noise;
    const fmax = Math.max(n.fx, n.fy) * 2 ** (n.octaves - 1);
    this.step = Math.max(minStep, Math.floor((0.25 / fmax) / minStep) * minStep);
    this.x0 = x0; this.y0 = y0;
    this.cols = Math.ceil((x1 - x0) / this.step) + 2;
    this.rows = Math.ceil((y1 - y0) / this.step) + 2;
    const dx = new Float32Array(this.cols * this.rows);
    const dy = new Float32Array(this.cols * this.rows);
    for (let r = 0, k = 0; r < this.rows; r++) {
      const y = y0 + r * this.step;
      for (let c = 0; c < this.cols; c++, k++) {
        const x = x0 + c * this.step;
        dx[k] = layer.scale * (n.value(layer.xCh, x, y) - 0.5);
        dy[k] = layer.scale * (n.value(layer.yCh, x, y) - 0.5);
      }
    }
    this.dx = dx; this.dy = dy;
  }

  /** Writes the displacement at (x, y) into out[0], out[1]. */
  at(x, y, out) {
    let fx = (x - this.x0) / this.step, fy = (y - this.y0) / this.step;
    fx = fx < 0 ? 0 : fx > this.cols - 1.001 ? this.cols - 1.001 : fx;
    fy = fy < 0 ? 0 : fy > this.rows - 1.001 ? this.rows - 1.001 : fy;
    const c = fx | 0, r = fy | 0, tx = fx - c, ty = fy - r;
    const k = r * this.cols + c, k2 = k + this.cols;
    const { dx, dy } = this;
    const top = dx[k] + tx * (dx[k + 1] - dx[k]);
    const bot = dx[k2] + tx * (dx[k2 + 1] - dx[k2]);
    out[0] = top + ty * (bot - top);
    const topy = dy[k] + tx * (dy[k + 1] - dy[k]);
    const boty = dy[k2] + tx * (dy[k2 + 1] - dy[k2]);
    out[1] = topy + ty * (boty - topy);
  }
}

const BAND_ROWS = 256;
const nextFrame = () => new Promise(r => setTimeout(r, 0));

/**
 * Apply the filter layers in place to one or more same-sized canvases
 * (e.g. the sheet and its background), `scale` device px per CSS px, with
 * the canvas origin at the filtered element's border-box origin.
 * Works in horizontal bands so memory stays bounded for long documents.
 */
export async function applyInkFilter(canvases, layers, scale) {
  if (!layers.length || !canvases.length) return;
  const W = canvases[0].width, H = canvases[0].height;
  const ctxs = canvases.map(c => c.getContext('2d', { willReadFrequently: true }));
  const reachCss = layers.reduce((s, l) => s + Math.abs(l.scale) / 2, 0);
  const reach = Math.ceil(reachCss * scale) + 2;
  const minStep = 1 / scale;
  const d = new Float64Array(2);
  let pending = null;

  for (let y0 = 0; y0 < H; y0 += BAND_ROWS) {
    const y1 = Math.min(H, y0 + BAND_ROWS);
    const sy0 = Math.max(0, y0 - reach), sy1 = Math.min(H, y1 + reach);
    const srcs = ctxs.map(ctx => ctx.getImageData(0, sy0, W, sy1 - sy0));
    if (pending) pending.forEach(([ctx, img, y]) => ctx.putImageData(img, 0, y));

    // Layer k is read at points already displaced by the layers after it.
    const marginCss = reachCss + 2;
    const grids = layers.map(l => new FieldGrid(
      l, -marginCss, y0 / scale - marginCss, W / scale + marginCss, y1 / scale + marginCss, minStep));
    const outs = ctxs.map(() => new ImageData(W, y1 - y0));

    for (let Y = y0; Y < y1; Y++) {
      for (let X = 0; X < W; X++) {
        let x = (X + 0.5) / scale, y = (Y + 0.5) / scale;
        for (let k = grids.length - 1; k >= 0; k--) {
          grids[k].at(x, y, d);
          x += d[0]; y += d[1];
        }
        const sx = x * scale - 0.5, sy = y * scale - 0.5 - sy0;
        const o = ((Y - y0) * W + X) * 4;
        for (let c = 0; c < srcs.length; c++) sampleBilinear(srcs[c], sx, sy, outs[c].data, o);
      }
    }
    pending = ctxs.map((ctx, c) => [ctx, outs[c], y0]);
    await nextFrame();
  }
  if (pending) pending.forEach(([ctx, img, y]) => ctx.putImageData(img, 0, y));
}

/** Premultiplied bilinear sample; outside the image is transparent, as in SVG filters. */
function sampleBilinear(img, x, y, out, o) {
  const { width: w, height: h, data } = img;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  let r = 0, g = 0, b = 0, a = 0;
  for (let j = 0; j < 2; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= h) continue;
    const wy = j ? ty : 1 - ty;
    for (let i = 0; i < 2; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= w) continue;
      const wgt = wy * (i ? tx : 1 - tx);
      if (wgt === 0) continue;
      const p = (yy * w + xx) * 4, pa = data[p + 3] * wgt;
      r += data[p] * pa; g += data[p + 1] * pa; b += data[p + 2] * pa; a += pa;
    }
  }
  if (a > 0) {
    out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a;
  } else {
    out[o + 3] = 0;
  }
}
