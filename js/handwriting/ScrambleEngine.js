import { getEditor } from '../utils/dom.js';
import { reflowPages } from '../pagination/PaginationEngine.js';
import { layoutBeforeScramble, wrapClauses, undoLayout } from './WritingLayout.js';

/*
 * Per-letter jitter ("scramble"). Every text node is replaced in place, so
 * paragraphs, lists, tables and inline formatting survive; unscrambleText()
 * unwraps the spans and merges the text back.
 *
 *   <span class="hw-ltr" dir="ltr">  isolates a Latin / number run: inline-blocks are
 *                                    bidi-neutral, so without it "120" would read "021"
 *   <span class="hw-w">              one word: no line break between its letters
 *   <span class="hw-c">              one grapheme (letter + niqqud), rotated and resized,
 *                                    in one of the shape-variant fonts (.hw-v1 .. .hw-v12)
 */

const ROTATE_SPREAD = 6;   // degrees, total
const SIZE_SPREAD = 0.25;  // em, total
const SHIFT_SPREAD = 0.25; // em, total
const ALT_CHANCE = 0.35;   // letters with a Gveret Levin alternate that get one
const VARIANTS = 12;       // fonts/GveretLevin-Var1..12.ttf: shape variants, one per letter
const WORD_GAP_MIN = 0.04; // em, extra space before a word (a hand never writes words touching)
const WORD_GAP_SPREAD = 0.14; // em, random extra on top
const INDENT_SPREAD = 0.4; // em, random indent of a paragraph's first word
const DRIFT_STEP = 0.07;   // em, baseline random walk per word
const DRIFT_MAX = 0.2;     // em, bound of that walk
const SKIP = '.page-break-marker, .math, .katex, script, style';
const GENERATED = '.hw-c, .hw-w, .hw-ltr, .hw-scramble'; // .hw-scramble: pre-2026-10 format

let _seed = 0;

/* ── Text analysis ─────────────────────────────────────────────────── */

const _segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('he', { granularity: 'grapheme' })
  : null;

function graphemes(text) {
  if (_segmenter) return Array.from(_segmenter.segment(text), s => s.segment);
  return text.match(/\r\n|\P{M}\p{M}*|\p{M}+/gsu) || [];
}

const RE_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const RE_LETTER = /\p{L}/u;
const RE_DIGIT = /\p{Nd}/u;
const RE_TERMINATOR = /[#$%°¢£¤¥₪€‰‱]/;      // bidi ET: sticks to an adjacent number
const RE_SEPARATOR = /^[+\-.,:/ ]$/;    // bidi ES/CS: joins two digits

/**
 * Simplified Unicode bidi classes for an RTL paragraph:
 * R, L, EN (a number after Hebrew), ET, SEP, WS, B (line break), N.
 * A number after Latin text is L, as in rule W7.
 */
function classify(gs) {
  let strong = 'R';
  return gs.map(g => {
    if (g === '\n' || g === '\r\n' || g === '\r') { strong = 'R'; return 'B'; }
    if (/^\s+$/.test(g)) return 'WS';
    if (RE_RTL.test(g)) { strong = 'R'; return 'R'; }
    if (RE_DIGIT.test(g)) return strong === 'L' ? 'L' : 'EN';
    if (RE_LETTER.test(g)) { strong = 'L'; return 'L'; }
    if (RE_TERMINATOR.test(g)) return 'ET';
    if (RE_SEPARATOR.test(g)) return 'SEP';
    return 'N';
  });
}

/** Left-to-right runs as [start, end] grapheme indices (inclusive). */
function ltrRuns(cls) {
  const runs = [];
  // Latin: from one L to the next, across neutrals, unless Hebrew or a number intervenes.
  let open = -1, last = -1;
  for (let i = 0; i <= cls.length; i++) {
    const c = cls[i];
    if (c === 'L') {
      if (open < 0) open = i;
      last = i;
    } else if (c === undefined || c === 'R' || c === 'EN' || c === 'B') {
      if (open >= 0) runs.push([open, last]);
      open = -1;
    }
  }
  // Numbers: digits joined by single separators, plus adjacent terminators (12.50, 054-1234567, 108%, ₪12).
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] !== 'EN') continue;
    let a = i, b = i;
    for (;;) {
      if (cls[b + 1] === 'EN') b++;
      else if (cls[b + 1] === 'SEP' && cls[b + 2] === 'EN') b += 2;
      else break;
    }
    while (cls[a - 1] === 'ET') a--;
    while (cls[b + 1] === 'ET') b++;
    runs.push([a, b]);
    i = b;
  }
  return runs.sort((x, y) => x[0] - y[0]);
}

/* ── Glyph alternates (Gveret Levin ss01 / ss02) ───────────────────── */

/*
 * The font's 'calt' swaps in these alternates to keep neighbouring letters
 * from colliding. One inline-block per letter breaks that shaping context,
 * so the same rules are applied here, and the remaining letters get a
 * random alternate for variety. Classes resolve to fonts/GveretLevin-Alt*.ttf
 * only while Gveret Levin is the active font (#output-edit.glyph-alts).
 */
const ALT1 = 'לנףץ₪';

function pickAlt(base, prevBase, prevAlt, nextBase, rand) {
  if (base === 'נ' && 'ךן'.includes(nextBase)) return 2;
  if (base === 'נ' && prevBase === 'נ' && prevAlt === 1) return 2;
  if (base === 'ל' && prevBase === 'ל') return 1;
  if ('ףץ'.includes(base) && prevBase && 'לעצ'.includes(prevBase)) return 1;
  if (base === 'נ' && prevBase && 'נת'.includes(prevBase)) return 1;
  if (!ALT1.includes(base) || rand() >= ALT_CHANCE) return 0;
  return base === 'נ' && rand() < 0.5 ? 2 : 1;
}

/* ── DOM building ──────────────────────────────────────────────────── */

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scrambleNode(textNode, rand) {
  const gs = graphemes(textNode.data);
  const cls = classify(gs);
  const runs = ltrRuns(cls);
  const runAt = new Array(gs.length).fill(null);
  runs.forEach(r => { for (let k = r[0]; k <= r[1]; k++) runAt[k] = r; });
  const isSpace = i => cls[i] === 'WS' || cls[i] === 'B';
  const spansWords = r => cls.slice(r[0], r[1] + 1).some((c, k) => isSpace(r[0] + k));
  const base = i => (gs[i] || '')[0];
  let prevAlt = 0;
  // Baseline wanders slowly along the text (a random walk, one step per word), and
  // word gaps vary, so lines are not ruler-straight and spacing is not metronomic.
  let drift = 0;
  let firstWord = !textNode.previousSibling;
  let afterSpace = firstWord;
  const wordGap = () => {
    let gap = WORD_GAP_MIN + rand() * WORD_GAP_SPREAD;
    if (firstWord) { gap += rand() * INDENT_SPREAD; firstWord = false; }
    return `${gap.toFixed(3)}em`;
  };
  // The gap goes on the side facing the previous text: inline-start of a word, or
  // inline-end of a multi-word LTR run (its own direction is LTR, so that is its right).
  const styleWord = word => {
    drift = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, drift + (rand() - 0.5) * 2 * DRIFT_STEP));
    word.style.top = `${drift.toFixed(3)}em`;
    if (afterSpace) word.style.marginInlineStart = wordGap();
    afterSpace = false;
  };

  const atom = i => {
    const span = document.createElement('span');
    span.className = 'hw-c';
    const alt = pickAlt(base(i), base(i - 1), prevAlt, base(i + 1), rand);
    prevAlt = alt;
    if (alt) span.classList.add('hw-alt' + alt);
    else span.classList.add('hw-v' + (1 + Math.floor(rand() * VARIANTS)));
    span.style.transform = `rotate(${((rand() - 0.5) * ROTATE_SPREAD).toFixed(1)}deg)`;
    span.style.fontSize = `${(1 + (rand() - 0.5) * SIZE_SPREAD).toFixed(3)}em`;
    span.style.top = `${((rand() - 0.5) * SHIFT_SPREAD).toFixed(3)}em`;
    span.textContent = gs[i];
    return span;
  };
  const ltrSpan = () => {
    const s = document.createElement('span');
    s.className = 'hw-ltr';
    s.dir = 'ltr';
    return s;
  };

  // Emits graphemes [from, to) into parent; `inRun` marks content of a multi-word run.
  const emit = (parent, from, to, inRun) => {
    let i = from;
    while (i < to) {
      if (isSpace(i)) {
        let j = i;
        while (j < to && isSpace(j)) j++;
        parent.appendChild(document.createTextNode(gs.slice(i, j).join('')));
        afterSpace = true;
        i = j;
        continue;
      }
      const run = runAt[i];
      if (!inRun && run && spansWords(run)) {
        const s = ltrSpan();
        if (afterSpace) s.style.marginInlineEnd = wordGap();
        afterSpace = false;
        emit(s, run[0], run[1] + 1, true);
        parent.appendChild(s);
        i = run[1] + 1;
        continue;
      }
      const word = document.createElement('span');
      word.className = 'hw-w';
      styleWord(word);
      while (i < to && !isSpace(i)) {
        const r = runAt[i];
        if (!inRun && r && spansWords(r)) break;
        if (!inRun && r) {
          const s = ltrSpan();
          for (let k = r[0]; k <= r[1]; k++) s.appendChild(atom(k));
          word.appendChild(s);
          i = r[1] + 1;
        } else {
          word.appendChild(atom(i++));
        }
      }
      parent.appendChild(word);
    }
  };

  const frag = document.createDocumentFragment();
  emit(frag, 0, gs.length, false);
  textNode.replaceWith(frag);
}

/** Words wider than their block cannot stay unbreakable, or they would overflow the page. */
function releaseLongWords(ed) {
  const words = Array.from(ed.querySelectorAll('.hw-w'));
  const tooLong = words.filter(w => {
    const block = w.closest('td, th, li, p, div') || ed;
    return w.getBoundingClientRect().width > block.clientWidth;
  });
  tooLong.forEach(w => w.classList.add('hw-w-long'));
}

/* ── Public API ────────────────────────────────────────────────────── */

export function scrambleText(seed) {
  const ed = getEditor();
  if (!ed) return;
  if (ed.querySelector(GENERATED)) unwrapGenerated(ed);
  _seed = Number.isFinite(seed) ? seed : _seed + 1;
  const rand = mulberry32(_seed);
  layoutBeforeScramble(ed, rand);

  const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && n.parentElement.closest(SKIP)) || !/\S/.test(n.data)
      ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => scrambleNode(n, rand));

  releaseLongWords(ed);
  wrapClauses(ed, rand);
  reflowPages();
}

function unwrapGenerated(ed) {
  ed.querySelectorAll(GENERATED).forEach(el => el.replaceWith(...el.childNodes));
  undoLayout(ed);
  ed.normalize();
}

export function unscrambleText() {
  const ed = getEditor();
  if (!ed) return;
  unwrapGenerated(ed);
  reflowPages();
}
