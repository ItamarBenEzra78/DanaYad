/*
 * Writing layout: how handwritten text sits on the page, as opposed to how
 * a word processor sets it. Applied by scrambleText() and undone by
 * unscrambleText(); every change is recorded on the element it touches so
 * the original markup comes back exactly.
 *
 *   grids      consecutive "label: n, n, n" lines (a matrix written row by
 *              row) become a hand-drawn table
 *   equations  a run of equations on one line ("A = 1, B = 3 + 1 = 4, ...")
 *              gets one line per equation
 *   headings   "שאלה 3" gets its number in a circle and a line under it
 *   rhythm     uneven vertical space between blocks, more before a heading
 *   formulas   x_j, x^2, sum_{j}, frac{a}{b}, sqrt{x} drawn as handwritten math
 *              (js/handwriting/Formulas.js)
 *   clauses    a line ends after a comma or full stop once it has run
 *              55–85% of the width, instead of at the margin (applied after
 *              scrambling, when words are measurable)
 */

import { renderFormulas, mathToHtml } from './Formulas.js';

const ORIG = 'hwOrig';          // dataset key: innerHTML before this module touched the block
const BLOCKS = 'div, p, li, h1, h2, h3, h4';
// A grid row: "label: cell, cell, ..." where a cell is a number, "-" (left empty) or a short symbol (y, F).
const CELL = String.raw`(?:-?\d+(?:\.\d+)?|-|[A-Za-z]\w{0,3})`;
const RE_GRID = new RegExp(String.raw`^([^:,]{1,24}):\s*(${CELL}(?:\s*,\s*${CELL})+)\s*$`);
const WIDE_GRID = 10;            // columns from which cells get tighter
const RE_HEADING = /^(שאלה|תרגיל|סעיף)\s+(\d+)\b(.*)$/;
// (\b is ASCII-only in JS, so Hebrew words are bounded with a lookahead instead)
const RE_SECTION = /^([א-ת])\.(?=\s|$)/;             // "א." at the start of a block
const RE_RESULT = /^(→|=>|<=|⇐|לכן(?=\s)|ולכן(?=\s)|סה"כ(?=\s))/;
const RE_MARK = /^(הוכחה|בדיקה)(?=[\s:])/;
const RE_EQ = /(^|[,;]\s*)([A-Za-z][\w'^]{0,5}\s*=)/g;
const RE_HEBREW = /[א-ת]/;

function blocksOf(ed) {
  return Array.from(ed.querySelectorAll(BLOCKS)).filter(b => !b.querySelector(BLOCKS) || b.tagName === 'LI');
}

function remember(block) {
  if (!(ORIG in block.dataset)) block.dataset[ORIG] = block.innerHTML;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── before scrambling: structure from the text ─────────────────────── */

function convertGrids(ed) {
  const blocks = blocksOf(ed);
  let i = 0;
  while (i < blocks.length) {
    const run = [];
    let cols = -1;
    for (let j = i; j < blocks.length; j++) {
      const b = blocks[j];
      if (b.children.length > 0 && b.textContent !== b.innerText) break;
      const m = RE_GRID.exec(b.textContent.trim());
      if (!m) break;
      const cells = m[2].split(/\s*,\s*/);
      if (cols >= 0 && cells.length !== cols) break;
      if (j > i && blocks[j].previousElementSibling !== blocks[j - 1]) break;
      cols = cells.length;
      run.push({ block: b, label: m[1].trim(), cells });
    }
    // a matrix written row by row; a single long row (5+ cells) is a matrix too
    if (run.length >= 2 || (run.length === 1 && run[0].cells.length >= 5)) {
      const first = run[0].block;
      const wrap = document.createElement('div');
      wrap.className = 'hw-grid-wrap';
      wrap.dataset[ORIG] = run.map(r => r.block.outerHTML).join('');
      // a label such as "V_t = Q_t" is a formula and reads left to right
      const th = label => `<th${RE_HEBREW.test(label) ? '' : ' dir="ltr"'}>${mathToHtml(label)}</th>`;
      const rows = run.map(r => `<tr>${th(r.label)}${r.cells.map(c => `<td>${c === '-' ? '' : esc(c)}</td>`).join('')}</tr>`).join('');
      wrap.innerHTML = `<table class="hw-grid${cols >= WIDE_GRID ? ' hw-grid-wide' : ''}" dir="rtl">${rows}</table>`;
      first.replaceWith(wrap);
      run.slice(1).forEach(r => r.block.remove());
      i += run.length;
    } else {
      i++;
    }
  }
}

function splitEquations(ed) {
  for (const b of blocksOf(ed)) {
    if (b.children.length > 0) continue;
    const text = b.textContent;
    const starts = [];
    for (const m of text.matchAll(RE_EQ)) starts.push(m.index + m[1].length);
    if (starts.length < 2) continue;
    // keep the lead-in ("כלומר:") on the first line, then one equation per line
    const parts = [];
    let prev = 0;
    for (const s of starts) {
      const piece = text.slice(prev, s).replace(/[,;]\s*$/, '').trim();
      if (piece) parts.push(piece);
      prev = s;
    }
    parts.push(text.slice(prev).trim());
    remember(b);
    b.innerHTML = parts.map((p, k) => `<span class="hw-eqline${k === 0 && RE_HEBREW.test(p) && !/=/.test(p) ? ' hw-eqlead' : ''}">${esc(p)}</span>`).join('');
  }
}

function markHeadings(ed) {
  for (const b of blocksOf(ed)) {
    const m = RE_HEADING.exec(b.textContent.trim());
    if (!m || b.children.length > 1) continue;
    remember(b);
    const color = b.firstElementChild && b.firstElementChild.style ? b.firstElementChild.style.color : '';
    b.innerHTML = `<span class="hw-heading"${color ? ` style="color:${color}"` : ''}>${esc(m[1])} <span class="hw-circ">${m[2]}</span>${esc(m[3])}</span>`;
  }
}

/** The first text node of a block, or null. */
function firstText(block) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = w.nextNode())) if (/\S/.test(t.data)) return t;
  return null;
}

/** "א. ..." → the letter in a circle (inside whatever span colours it). */
function circleSections(ed) {
  for (const b of blocksOf(ed)) {
    const t = firstText(b);
    if (!t) continue;
    const m = RE_SECTION.exec(t.data);
    if (!m || t.data.trimStart() !== t.data) continue;
    remember(b);
    const circ = document.createElement('span');
    circ.className = 'hw-circ';
    circ.textContent = m[1];
    const rest = t.data.slice(m[0].length);
    t.replaceWith(circ, ...(rest ? [document.createTextNode(rest)] : []));
  }
}

/** A result line gets a drawn arrow; a proof / check line gets a ⊗ mark, like a grader's pen. */
function markLines(ed) {
  for (const b of blocksOf(ed)) {
    const t = firstText(b);
    if (!t) continue;
    const text = t.data;
    let m;
    if ((m = RE_RESULT.exec(text))) {
      remember(b);
      const arrow = document.createElement('span');
      arrow.className = 'hw-arrow';
      const keep = /^[→⇐]|^=>|^<=/.test(m[1]) ? text.slice(m[0].length).trimStart() : text;
      t.replaceWith(arrow, document.createTextNode(keep));
      b.classList.add('hw-result');
    } else if ((m = RE_MARK.exec(text))) {
      remember(b);
      const mark = document.createElement('span');
      mark.className = 'hw-mark';
      t.replaceWith(mark, document.createTextNode(text));
    }
  }
}

function rhythm(ed, rand) {
  for (const b of blocksOf(ed)) {
    if (b.closest('table')) continue;
    const heading = !!b.querySelector('.hw-heading');
    const mt = heading ? 0.8 + rand() * 0.8 : rand() * 0.45;
    b.dataset.hwMt = '1';
    b.style.marginTop = `${mt.toFixed(2)}em`;
  }
}

export function layoutBeforeScramble(ed, rand) {
  convertGrids(ed);
  splitEquations(ed);
  markHeadings(ed);
  circleSections(ed);
  markLines(ed);
  renderFormulas(ed, remember);
  rhythm(ed, rand);
}

/* ── after scrambling: lines end where a hand would stop ─────────────── */

const CLAUSE_END = /[,.;:!?)׃]$/;

export function wrapClauses(ed, rand) {
  for (const b of blocksOf(ed)) {
    if (b.closest('table') || b.querySelector('.hw-eqline')) continue;
    const words = Array.from(b.querySelectorAll('.hw-w'));
    if (words.length < 6) continue;
    const width = b.clientWidth;
    if (!width) continue;
    const rtl = getComputedStyle(b).direction === 'rtl';
    let target = (0.55 + rand() * 0.3) * width;
    let lineStart = null;
    for (const w of words) {
      const r = w.getBoundingClientRect();
      if (lineStart === null || (rtl ? r.right > lineStart.edge + 2 : r.left < lineStart.edge - 2) ||
          Math.abs(r.top - lineStart.top) > r.height) {
        lineStart = { edge: rtl ? r.right : r.left, top: r.top };
      }
      const used = rtl ? lineStart.edge - r.left : r.right - lineStart.edge;
      // never inside a list of numbers ("1, 3, 5"): a clause continues with a word
      const next = words[words.indexOf(w) + 1];
      const intoNumber = next && /^[\d(]/.test(next.textContent);
      if (used >= target && CLAUSE_END.test(w.textContent) && next && !intoNumber) {
        const br = document.createElement('br');
        br.className = 'hw-br';
        w.after(br);
        lineStart = null;
        target = (0.55 + rand() * 0.3) * width;
      }
    }
  }
}

/* ── undo ──────────────────────────────────────────────────────────── */

export function undoLayout(ed) {
  ed.querySelectorAll('br.hw-br').forEach(br => br.remove());
  ed.querySelectorAll('[data-hw-mt]').forEach(b => {
    b.style.marginTop = '';
    delete b.dataset.hwMt;
    if (!b.getAttribute('style')) b.removeAttribute('style');
  });
  ed.querySelectorAll('.hw-grid-wrap').forEach(wrap => {
    const tpl = document.createElement('template');
    tpl.innerHTML = wrap.dataset[ORIG];
    wrap.replaceWith(tpl.content);
  });
  ed.querySelectorAll(`[data-hw-orig]`).forEach(b => {
    b.innerHTML = b.dataset[ORIG];
    delete b.dataset[ORIG];
    b.classList.remove('hw-result');
    if (!b.getAttribute('class')) b.removeAttribute('class');
  });
  ed.querySelectorAll('.hw-math').forEach(b => {
    b.classList.remove('hw-math');
    if (!b.getAttribute('class')) b.removeAttribute('class');
  });
}
