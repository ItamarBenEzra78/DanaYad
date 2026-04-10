import { getEditor } from '../utils/dom.js';
import { PAGE_HEIGHT } from '../config.js';

let _rafPending = false;
let _lastBreaks = [0];

export function getLastBreaks() { return _lastBreaks; }

export function reflowPages() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(_doReflow);
}

function _collectLineEnds(editor) {
  const editorRect = editor.getBoundingClientRect();
  const scrollOff = editor.scrollTop;
  const results = [];
  const seen = new Set();

  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let tNode;
  while (tNode = walker.nextNode()) {
    if (tNode.parentElement && tNode.parentElement.closest('.page-break-marker')) continue;
    const text = tNode.textContent;
    let searchFrom = 0;
    while (true) {
      const nl = text.indexOf('\n', searchFrom);
      if (nl === -1) break;
      searchFrom = nl + 1;

      const range = document.createRange();
      range.setStart(tNode, nl);
      range.setEnd(tNode, Math.min(nl + 1, text.length));
      const rects = range.getClientRects();
      if (rects.length === 0) continue;

      const y = Math.round(rects[0].bottom - editorRect.top + scrollOff);
      if (y > 0 && !seen.has(y)) {
        seen.add(y);
        const prevNl = text.lastIndexOf('\n', nl - 1);
        const lineText = text.substring(prevNl + 1, nl);
        results.push({ y, lineText });
      }
    }
  }

  for (const child of editor.children) {
    if (!child.getBoundingClientRect) continue;
    if (child.classList && child.classList.contains('page-break-marker')) continue;
    const rect = child.getBoundingClientRect();
    if (rect.height === 0) continue;
    const y = Math.round(rect.bottom - editorRect.top + scrollOff);
    if (y > 0 && !seen.has(y)) {
      seen.add(y);
      results.push({ y, lineText: (child.textContent || '').trim().substring(0, 80) });
    }
  }

  results.sort((a, b) => a.y - b.y);
  return results;
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
  const lines = _collectLineEnds(editor);
  if (lines.length === 0) return [0];

  const breaks = [0];
  let targetEnd = PAGE_HEIGHT;
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
      targetEnd += PAGE_HEIGHT;
      while (searchFrom < lines.length && lines[searchFrom].y <= breaks[breaks.length - 1]) searchFrom++;
      continue;
    }

    let adjusted = bestIdx;
    while (adjusted > searchFrom && _isHeadingLike(lines[adjusted].lineText)) {
      adjusted--;
    }
    const lastBreakY = breaks[breaks.length - 1];
    if (adjusted >= searchFrom && (lines[adjusted].y - lastBreakY) >= PAGE_HEIGHT * 0.5) {
      bestIdx = adjusted;
    }

    const breakY = lines[bestIdx].y;
    breaks.push(breakY);
    targetEnd = breakY + PAGE_HEIGHT;
    searchFrom = bestIdx + 1;
  }

  return breaks;
}

function _doReflow() {
  _rafPending = false;
  const editor = getEditor();
  if (!editor) return;

  editor.querySelectorAll('.page-break-marker,.page-gap').forEach(el => el.remove());
  editor.style.minHeight = PAGE_HEIGHT + 'px';

  const breaks = computePageBreaks(editor);
  _lastBreaks = breaks;
  const totalPages = breaks.length;

  const lastBreak = breaks[breaks.length - 1];
  editor.style.minHeight = (lastBreak + PAGE_HEIGHT) + 'px';

  for (let p = 1; p < breaks.length; p++) {
    const yPos = breaks[p];
    const marker = document.createElement('div');
    marker.className = 'page-break-marker';
    marker.setAttribute('data-page', String(p + 1));
    marker.style.top = yPos + 'px';
    editor.appendChild(marker);
  }

  updatePageIndicator(totalPages);
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
