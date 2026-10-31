import { getEditor, getOutputEdit } from '../utils/dom.js';
import { API_URL, PAGE_HEIGHT, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM, CONTENT_HEIGHT } from '../config.js';
import { HW } from '../handwriting/HandwritingEngine.js';
import { readFilterLayers, applyInkFilter } from '../handwriting/InkDisplacement.js';
import { applyInkLayer } from '../handwriting/InkLayer.js';
import { computePageBreaks } from '../pagination/PaginationEngine.js';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const SHEET_WIDTH = 794; // A4 at 96dpi; css/editor.css #output-edit
const PAGE_PADDING_SIDE = 60;
const CAPTURE_SCALE = 2;
const SHEET_TAIL = 100;  // extra background below the text, for the last page's bottom margin
const INK_THRESHOLD = 160 * 3; // sum of RGB below this counts as ink (backgrounds are lighter)
const PDF_FILENAME = 'DanaYad_Document.pdf';
const BACKEND_TIMING = 'danayad-backend';

/** Export switches; `ink` is the pen-on-paper layer (js/handwriting/InkLayer.js). */
export const exportOptions = { ink: true };

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

/* ── Sheet preparation (shared by both export paths) ───────────────── */

/**
 * Put a copy of the sheet into print geometry: exact A4 width and margins
 * (also on narrow screens), no on-screen decorations, and enough height for
 * every page. Returns the page breaks of that layout, so the cuts always
 * match the text that is rendered.
 */
export function prepareSheet(sheet) {
  const editor = sheet.querySelector('#rotate-container');
  sheet.classList.add('print-sheet'); // PaginationEngine leaves a print sheet alone (no markers)
  sheet.querySelectorAll('.page-break-marker').forEach(m => m.remove());
  const set = (el, prop, val) => el.style.setProperty(prop, val, 'important');
  set(sheet, 'width', SHEET_WIDTH + 'px');
  set(sheet, 'min-width', SHEET_WIDTH + 'px');
  set(sheet, 'padding', `${PAGE_PADDING_TOP}px ${PAGE_PADDING_SIDE}px ${PAGE_PADDING_BOTTOM}px`);
  set(sheet, 'margin', '0');
  set(sheet, 'box-shadow', 'none');

  editor.style.minHeight = '0px';
  const breaks = computePageBreaks(editor);
  editor.style.minHeight = (breaks[breaks.length - 1] + CONTENT_HEIGHT) + 'px';
  sheet.style.minHeight = (breaks[breaks.length - 1] + PAGE_HEIGHT + SHEET_TAIL) + 'px';
  return breaks;
}

/** Hide the text but keep the layout, to capture the sheet's background alone. */
export function hideSheetText(sheet) {
  sheet.querySelector('#rotate-container').style.visibility = 'hidden';
}

/** Drop the paper, to capture the text alone on a transparent background. */
export function hideSheetPaper(sheet) {
  sheet.style.setProperty('background', 'transparent', 'important');
}

/* ── Page composition (shared by both export paths) ────────────────── */

/**
 * The cut between two pages. A page break from the engine is the bottom of
 * a line box, but handwriting (and the ink filter) overflows line boxes, and
 * once letters are scrambled the descenders of one line can reach below the
 * ascenders of the next, so often no straight row is free of ink. The cut is
 * therefore a seam: one row per column, between `up` above and `down` below the nominal row,
 * stepping at most one row between neighbouring columns, chosen by dynamic
 * programming to stay clearest of ink (then: fewest steps, closest to nominal).
 */
function _seam(sheet, nominal, up, down) {
  const W = sheet.width;
  const y0 = Math.max(0, nominal - up);
  const R = Math.min(sheet.height, nominal + down + 1) - y0;
  const seam = new Int32Array(W).fill(nominal);
  if (R <= 0) return seam;
  const { data } = sheet.getContext('2d', { willReadFrequently: true }).getImageData(0, y0, W, R);
  // Distance (0, 1, 2 or more px) from each pixel to the nearest ink, so the seam
  // keeps clear of letters instead of slipping between diagonal or faint pixels.
  // Slightly more sensitive than INK_THRESHOLD, for JPEG ringing around strokes.
  const near = new Uint8Array(W * R).fill(3);
  for (let r = 0; r < R; r++) {
    for (let x = 0; x < W; x++) {
      const p = (r * W + x) * 4;
      if (data[p + 3] <= 128 || data[p] + data[p + 1] + data[p + 2] >= INK_THRESHOLD + 45) continue;
      for (let dr = -2; dr <= 2; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= R) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const d = Math.max(Math.abs(dr), Math.abs(dx));
          if (d < near[rr * W + xx]) near[rr * W + xx] = d;
        }
      }
    }
  }
  const CLEARANCE_COST = [1e4, 2e3, 300, 0];
  const STEP_COST = 1;
  const DIST_COST = 0.05;
  const cost = (x, r) => CLEARANCE_COST[near[r * W + x]] + Math.abs(y0 + r - nominal) * DIST_COST;
  let acc = new Float64Array(R);
  let nextAcc = new Float64Array(R);
  const from = new Int8Array(W * R);
  for (let r = 0; r < R; r++) acc[r] = cost(0, r);
  for (let x = 1; x < W; x++) {
    for (let r = 0; r < R; r++) {
      let best = acc[r], step = 0;
      if (r > 0 && acc[r - 1] + STEP_COST < best) { best = acc[r - 1] + STEP_COST; step = -1; }
      if (r < R - 1 && acc[r + 1] + STEP_COST < best) { best = acc[r + 1] + STEP_COST; step = 1; }
      nextAcc[r] = best + cost(x, r);
      from[x * R + r] = step;
    }
    [acc, nextAcc] = [nextAcc, acc];
  }
  let r = 0;
  for (let k = 1; k < R; k++) if (acc[k] < acc[r]) r = k;
  for (let x = W - 1; x >= 0; x--) {
    seam[x] = y0 + r;
    r += from[x * R + r];
  }
  return seam;
}

/** Clip ctx to the rows between two seams (sheet rows, shifted by -offset). */
function _clipBetween(ctx, top, bottom, offset) {
  ctx.beginPath();
  ctx.moveTo(0, top[0] - offset);
  for (let x = 0; x < top.length; x++) {
    ctx.lineTo(x, top[x] - offset);
    ctx.lineTo(x + 1, top[x] - offset);
  }
  for (let x = bottom.length - 1; x >= 0; x--) {
    ctx.lineTo(x + 1, bottom[x] - offset);
    ctx.lineTo(x, bottom[x] - offset);
  }
  ctx.closePath();
  ctx.clip();
}

/**
 * Cut the rendered sheet into A4 page canvases.
 * content / background: the whole sheet with and without its text, `scale`
 * device px per CSS px, origin at the sheet's top-left. Every page shows the
 * background edge to edge. Page i > 0 maps sheet row y to page row
 * y - (nominal_i - top margin), nominal_i being its break row, and shows the
 * text between its two seams.
 */
export function composePages(content, background, breaks, lineHeight, scale) {
  const W = content.width;
  const pageH = Math.round(PAGE_HEIGHT * scale);
  const padTop = Math.round(PAGE_PADDING_TOP * scale);
  // The nominal cut is the bottom of the last line box. Descenders of that line reach
  // below it, so the seam may dip a full line height down; above it lies the line itself,
  // so it may rise only a little (otherwise a line's lower half lands on the next page).
  const up = Math.round((lineHeight / 4) * scale);
  const down = Math.round(lineHeight * scale);
  const nominal = breaks.map(y => Math.round((y + PAGE_PADDING_TOP) * scale));
  const seams = nominal.map((y, i) => (i === 0 ? new Int32Array(W) : _seam(content, y, up, down)));
  seams.push(new Int32Array(W).fill(content.height));

  return breaks.map((_, i) => {
    const winTop = i === 0 ? 0 : nominal[i] - padTop;
    const page = document.createElement('canvas');
    page.width = W;
    page.height = pageH;
    const ctx = page.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, pageH);
    const blit = src => {
      const y0 = Math.max(0, winTop), y1 = Math.min(src.height, winTop + pageH);
      if (y1 > y0) ctx.drawImage(src, 0, y0, src.width, y1 - y0, 0, y0 - winTop, src.width, y1 - y0);
    };
    blit(background);
    ctx.save();
    _clipBetween(ctx, seams[i], seams[i + 1], winTop);
    blit(content);
    ctx.restore();
    return page;
  });
}

export function pagesToPdf(pages) {
  const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  });
  return pdf;
}

function _loadCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/**
 * Backend entry: screenshots (data URLs; `content` is the text alone on a
 * transparent background, with the SVG filter already rendered by Chrome)
 * → base64 PDF, through the same ink layer and composer as the browser path.
 */
export async function pdfFromScreenshots({ content, background, breaks, lineHeight, scale, ink = true }) {
  const [c, b] = await Promise.all([_loadCanvas(content), _loadCanvas(background)]);
  if (ink) await applyInkLayer(c, scale);
  const uri = pagesToPdf(composePages(c, b, breaks, lineHeight, scale)).output('datauristring');
  return uri.slice(uri.indexOf(',') + 1);
}

/* ── Backend path (optional, Chrome renders the real SVG filter) ───── */

/**
 * Same origin (API_URL empty): the backend marks every page it serves with
 * a Server-Timing entry, so a static host needs no probe request at all.
 * A configured API_URL is probed; the static SPA fallback answers that with
 * index.html, so a JSON body is required.
 */
async function _backendAvailable() {
  if (!API_URL) {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      return !!nav && (nav.serverTiming || []).some(t => t.name === BACKEND_TIMING);
    } catch (_e) {
      return false;
    }
  }
  try {
    const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('application/json')) return false;
    const body = await res.json();
    return body.status === 'ok';
  } catch (_e) {
    return false;
  }
}

/**
 * Capture the current editor state so the backend can replicate it
 * inside the live app opened by Playwright.
 */
function _captureEditorState() {
  const outputEdit = getOutputEdit();
  const editor = getEditor();

  return {
    editor_html: editor.innerHTML,
    output_edit_class: outputEdit.className,
    output_edit_style: outputEdit.style.cssText,
    editor_style: editor.style.cssText,
    root_style: document.documentElement.style.cssText,
    hw_params: {
      drift: HW.drift,
      jitter: HW.jitter,
      tremor: HW.tremor,
    },
    ink_layer: exportOptions.ink,
  };
}

async function _exportViaBackend() {
  const res = await fetch(`${API_URL}/api/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_captureEditorState()),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = PDF_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Client-side path (default, static hosting) ────────────────────── */

const BULLETS = { disc: '•', circle: '◦', square: '▪' };

function _listLabel(n, type) {
  if (type === 'lower-alpha' || type === 'lower-latin') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
  if (type === 'upper-alpha' || type === 'upper-latin') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
  if (type === 'lower-roman' || type === 'upper-roman') {
    const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let s = '';
    for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
    return type === 'upper-roman' ? s.toUpperCase() : s;
  }
  return String(n);
}

/**
 * html2canvas draws list markers itself and places them as if the text were
 * left-to-right. Replace each marker with a real element in the marker's
 * place (the list's start-side padding) so the browser lays it out.
 */
function _materializeListMarkers(root) {
  const view = root.ownerDocument.defaultView;
  root.querySelectorAll('li').forEach(li => {
    const cs = view.getComputedStyle(li);
    if (cs.display !== 'list-item' || cs.listStyleType === 'none') return;
    const list = li.parentElement;
    let label;
    if (list && list.tagName === 'OL') {
      const n = (parseInt(list.getAttribute('start'), 10) || 1) +
        Array.from(list.children).filter(c => c.tagName === 'LI').indexOf(li);
      label = _listLabel(n, cs.listStyleType) + '.';
    } else {
      label = BULLETS[cs.listStyleType] || BULLETS.disc;
    }
    const marker = li.ownerDocument.createElement('span');
    marker.className = 'pdf-list-marker';
    marker.textContent = label;
    const rtl = cs.direction === 'rtl';
    marker.style.cssText =
      'position:absolute;top:0;white-space:nowrap;unicode-bidi:isolate;' +
      (rtl ? 'left:100%;padding-left:0.5em;' : 'right:100%;padding-right:0.5em;');
    li.style.position = 'relative';
    li.style.listStyleType = 'none';
    li.insertBefore(marker, li.firstChild);
  });
}

/**
 * Overlay the free-hand drawing layer onto the captured sheet.
 * The draw canvas lives in #output-wrap (outside the ink filter), so its
 * origin is offset from #output-edit by the sheet's position in the wrap.
 */
function _overlayDrawing(ctx, outputEdit) {
  const draw = document.getElementById('draw-canvas');
  if (!draw || draw.width === 0 || draw.height === 0) return;
  ctx.drawImage(
    draw,
    -outputEdit.offsetLeft * CAPTURE_SCALE,
    -outputEdit.offsetTop * CAPTURE_SCALE,
    draw.width * CAPTURE_SCALE,
    draw.height * CAPTURE_SCALE
  );
}

async function _exportClientSide() {
  const outputEdit = getOutputEdit();
  const filtered = outputEdit.classList.contains('hw-filter');
  let breaks = null;
  let lineHeight = 24;

  // Two captures: the text alone (transparent) and the paper alone. The ink
  // filter and the ink layer touch the text only, so the paper stays flat.
  const capture = (textless) => html2canvas(outputEdit, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: textless ? '#ffffff' : null,
    onclone: (doc) => {
      const sheet = doc.getElementById('output-edit');
      sheet.classList.remove('hw-filter'); // applied below, on the bitmap
      const b = prepareSheet(sheet);
      _materializeListMarkers(sheet);
      if (textless) {
        hideSheetText(sheet);
      } else {
        hideSheetPaper(sheet);
        breaks = b;
        lineHeight = parseFloat(doc.defaultView.getComputedStyle(sheet.querySelector('#rotate-container')).lineHeight) || lineHeight;
      }
    },
  });

  const content = await capture(false);
  const background = await capture(true);
  if (filtered) {
    // The screen filter sits on #rotate-container, i.e. inside the sheet's padding.
    await applyInkFilter([content], readFilterLayers(document.getElementById('ink-tremor')), CAPTURE_SCALE,
      { x: PAGE_PADDING_SIDE, y: PAGE_PADDING_TOP });
    if (exportOptions.ink) await applyInkLayer(content, CAPTURE_SCALE);
  }
  _overlayDrawing(content.getContext('2d'), outputEdit);

  pagesToPdf(composePages(content, background, breaks, lineHeight, CAPTURE_SCALE)).save(PDF_FILENAME);
}

/* ── Entry point ───────────────────────────────────────────────────── */

export async function exportToPdf() {
  const btn = document.getElementById('pdf-btn');
  const editor = getEditor();
  if (!editor || editor.textContent.trim() === '') {
    alert('אין תוכן להדפסה');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="pdf-spinner"></span> מייצא...';

  try {
    if (await _backendAvailable()) {
      await _exportViaBackend();
    } else {
      await _exportClientSide();
    }
    closePdfModal();
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('שגיאה בייצוא PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'שמור כ-PDF';
  }
}
