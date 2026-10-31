import { getEditor } from '../utils/dom.js';
import { CONTENT_HEIGHT } from '../config.js';
import { applyScreenDrift } from '../handwriting/LineDrift.js';

let _rafPending = false;
let _lastBreaks = [0];

export function getLastBreaks() { return _lastBreaks; }

export function reflowPages() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(_doReflow);
}

/**
 * Every visual line of the editor as {y, lineText} (y = line bottom, editor
 * coordinates), sorted top to bottom.
 *
 * Text fragments come from Range.getClientRects(): one rect per line box,
 * or one per letter once the text is scrambled. Fragments whose middle
 * halves overlap sit on the same line and are merged; a table row, image or
 * math block is one unbreakable unit, so the lines inside it merge into it.
 */
function _collectLineEnds(editor) {
  const doc = editor.ownerDocument;
  const origin = editor.getBoundingClientRect().top - editor.scrollTop;
  const items = [];
  const range = doc.createRange();
  const addRect = (r, text, seg, atomic) => {
    if (r.height <= 0) return;
    const top = r.top - origin, bottom = r.bottom - origin;
    const inset = atomic ? 0 : r.height / 4;
    items.push({ top, bottom, coreTop: top + inset, coreBottom: bottom - inset, text, seg });
  };

  const walker = doc.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let seg = 0;
  for (let t; (t = walker.nextNode());) {
    if (t.parentElement && t.parentElement.closest('.page-break-marker')) continue;
    const text = t.data;
    for (let start = 0; start <= text.length; seg++) {
      let end = text.indexOf('\n', start);
      if (end === -1) end = text.length;
      if (end > start) {
        range.setStart(t, start);
        range.setEnd(t, end);
        const piece = text.slice(start, end);
        for (const r of range.getClientRects()) addRect(r, piece, seg, false);
      }
      start = end + 1;
    }
  }
  editor.querySelectorAll('tr, img, hr, .math, .katex').forEach(el => {
    addRect(el.getBoundingClientRect(), '', seg++, true);
  });

  items.sort((a, b) => a.coreTop - b.coreTop);
  const lines = [];
  for (const it of items) {
    const line = lines[lines.length - 1];
    if (line && it.coreTop < line.coreBottom) {
      line.coreBottom = Math.max(line.coreBottom, it.coreBottom);
      line.bottom = Math.max(line.bottom, it.bottom);
      line.parts.push(it);
    } else {
      lines.push({ coreBottom: it.coreBottom, bottom: it.bottom, parts: [it] });
    }
  }

  return lines.map(line => {
    const seen = new Set();
    const text = line.parts
      .sort((a, b) => a.seg - b.seg)
      .filter(p => !seen.has(p.seg) && seen.add(p.seg))
      .map(p => p.text)
      .join('');
    return { y: Math.round(line.bottom), lineText: text.trim().substring(0, 80) };
  }).filter(l => l.y > 0);
}

function _isSeparator(t) { return /^[═─━]{5,}$/.test(t.trim()); }

function _isHeadingLike(t) {
  const s = t.trim();
  if (!s || s.length > 60) return false;
  if (_isSeparator(s)) return true;
  if (/^תרגיל\s/.test(s)) return true;
  if (/^[א-ת][\.\)]/.test(s) && s.length < 45) return true;
  if (s.endsWith(':') && s.length < 45) return true;
  if (/^סיכום/.test(s)) return true;
  return false;
}

export function computePageBreaks(editor) {
  // Line Drift rotates the editor; measure the unrotated layout.
  const transform = editor.style.transform;
  if (transform) editor.style.transform = 'none';
  let lines;
  try {
    lines = _collectLineEnds(editor);
  } finally {
    if (transform) editor.style.transform = transform;
  }
  if (lines.length === 0) return [0];

  const breaks = [0];
  let targetEnd = CONTENT_HEIGHT;
  let searchFrom = 0;

  while (searchFrom < lines.length) {
    if (lines[lines.length - 1].y <= targetEnd) break;

    let bestIdx = -1;
    for (let i = searchFrom; i < lines.length; i++) {
      if (lines[i].y <= targetEnd) bestIdx = i;
      else break;
    }

    if (bestIdx < searchFrom) {
      breaks.push(targetEnd);
      targetEnd += CONTENT_HEIGHT;
      while (searchFrom < lines.length && lines[searchFrom].y <= breaks[breaks.length - 1]) searchFrom++;
      continue;
    }

    let adjusted = bestIdx;
    while (adjusted > searchFrom && _isHeadingLike(lines[adjusted].lineText)) {
      adjusted--;
    }
    const lastBreakY = breaks[breaks.length - 1];
    if (adjusted >= searchFrom && (lines[adjusted].y - lastBreakY) >= CONTENT_HEIGHT * 0.5) {
      bestIdx = adjusted;
    }

    const breakY = lines[bestIdx].y;
    breaks.push(breakY);
    targetEnd = breakY + CONTENT_HEIGHT;
    searchFrom = bestIdx + 1;
  }

  return breaks;
}

function _doReflow() {
  _rafPending = false;
  const editor = getEditor();
  if (!editor || editor.closest('.print-sheet')) return; // an export in progress: keep its layout

  editor.querySelectorAll('.page-break-marker,.page-gap').forEach(el => el.remove());
  editor.style.minHeight = CONTENT_HEIGHT + 'px';

  const breaks = computePageBreaks(editor);
  _lastBreaks = breaks;
  const totalPages = breaks.length;

  const lastBreak = breaks[breaks.length - 1];
  editor.style.minHeight = (lastBreak + CONTENT_HEIGHT) + 'px';

  for (let p = 1; p < breaks.length; p++) {
    const yPos = breaks[p];
    const marker = document.createElement('div');
    marker.className = 'page-break-marker';
    marker.setAttribute('data-page', String(p + 1));
    marker.style.top = yPos + 'px';
    editor.appendChild(marker);
  }

  updatePageIndicator(totalPages);
  applyScreenDrift();
}

export function updatePageIndicator(totalPages) {
  const indicator = document.getElementById('page-indicator');
  if (!indicator) return;

  if (typeof totalPages === 'undefined') totalPages = _lastBreaks.length;

  const wrap = document.getElementById('output-wrap');
  let currentPage = 1;
  if (wrap && _lastBreaks.length > 1) {
    const scrollY = wrap.scrollTop;
    for (let i = _lastBreaks.length - 1; i >= 0; i--) {
      if (scrollY >= _lastBreaks[i] - 50) {
        currentPage = i + 1;
        break;
      }
    }
  }
  indicator.textContent = `עמוד ${currentPage} מתוך ${totalPages}`;
}
