import { getEditor, getOutputEdit } from '../utils/dom.js';
import { API_URL, PAGE_HEIGHT, PAGE_PADDING_TOP } from '../config.js';
import { HW } from '../handwriting/HandwritingEngine.js';
import { getLastBreaks } from '../pagination/PaginationEngine.js';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CAPTURE_SCALE = 2;
const INK_THRESHOLD = 160 * 3; // sum of RGB below this counts as ink (backgrounds are lighter)
const PDF_FILENAME = 'DanaYad_Document.pdf';

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

/* ── Backend path (optional, high fidelity) ────────────────────────── */

/**
 * The backend is used only when /api/health answers with JSON.
 * On a static host (Netlify) the SPA redirect returns index.html with
 * status 200, so checking `res.ok` alone would be a false positive.
 */
async function _backendAvailable() {
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

/* ── Client-side path (default) ────────────────────────────────────── */

/**
 * Overlay the free-hand drawing layer onto the captured sheet.
 * The draw canvas lives in #output-wrap, so its origin is offset from
 * #output-edit by the sheet's position inside the wrap.
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

/**
 * A page break from the engine is the content-box bottom of a line, but
 * handwriting glyphs overflow that box, so a cut exactly there leaves
 * descender slivers on the next page. Scan the captured bitmap within
 * +-window px of the nominal cut and return the row with the least ink.
 */
function _inkFreeCut(sheet, nominal, window) {
  const y0 = Math.max(0, nominal - window);
  const rows = Math.min(sheet.height, nominal + window) - y0;
  if (rows <= 0) return nominal;
  const { data } = sheet.getContext('2d').getImageData(0, y0, sheet.width, rows);
  let best = nominal;
  let bestInk = Infinity;
  for (let r = 0; r < rows; r++) {
    let ink = 0;
    for (let p = r * sheet.width * 4, end = p + sheet.width * 4; p < end; p += 4) {
      if (data[p] + data[p + 1] + data[p + 2] < INK_THRESHOLD) ink++;
    }
    const closer = Math.abs(y0 + r - nominal) < Math.abs(best - nominal);
    if (ink < bestInk || (ink === bestInk && closer)) { bestInk = ink; best = y0 + r; }
  }
  return best;
}

/**
 * Convert the pagination engine's breaks (editor-relative y, CSS px) into
 * slices of the captured sheet (device px). Page 0 keeps the sheet's own
 * top padding; every later page starts right at its first line and gets
 * the same top margin re-applied when placed on the A4 page.
 */
function _sliceBounds(sheet, breaks, window) {
  const s = CAPTURE_SCALE;
  const cuts = breaks.map((y, i) => (i === 0 ? 0 : _inkFreeCut(sheet, (y + PAGE_PADDING_TOP) * s, window * s)));
  return cuts.map((top, i) => {
    const next = i + 1 < cuts.length ? cuts[i + 1] : sheet.height;
    const maxSlice = (i === 0 ? PAGE_HEIGHT : PAGE_HEIGHT - PAGE_PADDING_TOP) * s;
    return { top, bottom: Math.min(next, top + maxSlice, sheet.height) };
  });
}

async function _exportClientSide() {
  const outputEdit = getOutputEdit();

  const sheet = await html2canvas(outputEdit, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone: (doc) => {
      const clone = doc.getElementById('output-edit');
      clone.classList.remove('hw-filter'); // html2canvas cannot render SVG filters
      clone.style.boxShadow = 'none';
      clone.querySelectorAll('.page-break-marker').forEach(m => m.remove());
    },
  });
  _overlayDrawing(sheet.getContext('2d'), outputEdit);

  const mmPerPx = A4_WIDTH_MM / sheet.width;
  const lineHeight = parseFloat(getComputedStyle(getEditor()).lineHeight) || 24;
  const slices = _sliceBounds(sheet, getLastBreaks(), lineHeight / 2);

  const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  slices.forEach(({ top, bottom }, i) => {
    if (i > 0) pdf.addPage();
    const h = bottom - top;
    if (h <= 0) return;

    const page = document.createElement('canvas');
    page.width = sheet.width;
    page.height = h;
    page.getContext('2d').drawImage(sheet, 0, top, sheet.width, h, 0, 0, sheet.width, h);

    // Shrink-to-fit guards narrow (mobile) layouts whose sheet is not A4-shaped.
    const yMm = i === 0 ? 0 : PAGE_PADDING_TOP * CAPTURE_SCALE * mmPerPx;
    let wMm = A4_WIDTH_MM;
    let hMm = h * mmPerPx;
    const availMm = A4_HEIGHT_MM - yMm;
    if (hMm > availMm) { wMm *= availMm / hMm; hMm = availMm; }

    pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, yMm, wMm, hMm);
  });

  pdf.save(PDF_FILENAME);
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
