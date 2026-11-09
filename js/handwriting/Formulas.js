/*
 * Formulas written the way a hand writes them. Plain-text notation inside a
 * block that contains an equals sign becomes handwritten math:
 *
 *   x_j   x_{max}      subscript            x^2   x^{-1}     superscript
 *   sum_{j}^{n}        Σ with limits below and above (either optional)
 *   frac{a}{b}         a over b with a drawn fraction bar
 *   sqrt{x}            a drawn root sign over x
 *
 * Σ and √ are not in the handwriting font, so they are drawn as small
 * stroked SVG paths; the ink filter and the ink layer treat them like any
 * other stroke. Everything is markup inside the block, so scrambling,
 * pagination and the reset button work as for any other text.
 *
 * Direction: a line without Hebrew that looks like math (=, <, ≤, ^, frac…)
 * is a math line: converted whole and written left to right (.hw-math). In
 * a Hebrew line only self-contained tokens (D_t, P^2, frac{a}{b}) are
 * converted, each wrapped in its own left-to-right isolate (.hw-var), so a
 * subscript can never end up on the wrong side of its letter.
 */

const RE_HEBREW = /[\u05D0-\u05EA]/;
const RE_MATH_LINE = /[=<>≤≥^]|\b(frac|sum|sqrt)\b/;
const RE_TRIGGER = /[_^]|\b(frac|sum|sqrt)\b/;
// A token that stands on its own inside a sentence: frac{..}{..}, sqrt{..}, sum with limits,
// or a one/two-letter variable with scripts (D_t, Y_{t-1}, P^2). Not "report_v2".
const RE_TOKEN = new RegExp([
  String.raw`(?<![A-Za-z])frac\{[^{}]*\}\{[^{}]*\}`,
  String.raw`(?<![A-Za-z])sqrt\{[^{}]*\}`,
  String.raw`(?<![A-Za-z])sum(?:_(?:\{[^}]*\}|\w+))?(?:\^(?:\{[^}]*\}|\w+))?(?![A-Za-z])`,
  String.raw`(?<![A-Za-z0-9_^])[A-Za-z]{1,2}(?:_(?:\{[^}]*\}|[A-Za-z0-9]{1,3})|\^(?:\{[^}]*\}|-?\d+))+(?![A-Za-z0-9_])`,
].join('|'), 'g');

const SIGMA = '<svg class="hw-sym" viewBox="0 0 20 26" aria-label="Σ"><path d="M17 3 H4 L11 13 L4 23 H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ROOT = '<svg class="hw-sym hw-root" viewBox="0 0 16 26" aria-label="√"><path d="M1 15 L5 24 L11 2 H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The argument after `pos` (which points at '{'): its text and the index past '}'. */
function braced(s, pos) {
  if (s[pos] !== '{') return null;
  let depth = 0;
  for (let i = pos; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return { text: s.slice(pos + 1, i), end: i + 1 };
  }
  return null;
}

/** A sub/superscript argument: braces, or a single token (digits, letters, a sign and digits). */
function scriptArg(s, pos) {
  const b = braced(s, pos);
  if (b) return b;
  const m = /^(-?\d+|[A-Za-z]\w*|[+-])/.exec(s.slice(pos));
  return m ? { text: m[1], end: pos + m[1].length } : null;
}

/** Text with the notation above → HTML. Recursive for nested arguments. */
export function mathToHtml(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m;
    if ((m = /^(frac|sqrt|sum)(?![A-Za-z])/.exec(rest))) {
      const word = m[1];
      let p = i + word.length;
      if (word === 'frac') {
        const a = braced(text, p);
        const b = a && braced(text, a.end);
        if (b) {
          out += `<span class="hw-frac"><span class="hw-num">${mathToHtml(a.text)}</span><span class="hw-den">${mathToHtml(b.text)}</span></span>`;
          i = b.end;
          continue;
        }
      } else if (word === 'sqrt') {
        const a = braced(text, p);
        if (a) {
          out += `<span class="hw-sqrt">${ROOT}<span class="hw-rad">${mathToHtml(a.text)}</span></span>`;
          i = a.end;
          continue;
        }
      } else {
        let lo = null, hi = null;
        for (let k = 0; k < 2; k++) {
          if (text[p] === '_' && !lo) { lo = scriptArg(text, p + 1); if (lo) p = lo.end; }
          else if (text[p] === '^' && !hi) { hi = scriptArg(text, p + 1); if (hi) p = hi.end; }
        }
        out += `<span class="hw-sum"><span class="hw-lim hw-hi">${hi ? mathToHtml(hi.text) : ''}</span>${SIGMA}<span class="hw-lim hw-lo">${lo ? mathToHtml(lo.text) : ''}</span></span>`;
        i = p;
        continue;
      }
    }
    if ((text[i] === '_' || text[i] === '^') && i > 0 && /[A-Za-z0-9)}א-ת]/.test(text[i - 1])) {
      const a = scriptArg(text, i + 1);
      if (a) {
        out += `<span class="${text[i] === '_' ? 'hw-sub' : 'hw-sup'}">${mathToHtml(a.text)}</span>`;
        i = a.end;
        continue;
      }
    }
    out += esc(text[i]);
    i++;
  }
  return out;
}

const BLOCKS = 'div, p, li, h1, h2, h3, h4, span.hw-eqline';

/**
 * Convert the notation in the editor. `remember` records a block's original
 * markup so the reset button can restore it.
 */
export function renderFormulas(ed, remember) {
  const blocks = Array.from(ed.querySelectorAll(BLOCKS)).filter(b => !b.querySelector(BLOCKS) || b.tagName === 'LI');
  for (const b of blocks) {
    if (b.closest('table')) continue;
    const text = b.textContent;
    const mathLine = !RE_HEBREW.test(text) && RE_MATH_LINE.test(text);
    if (mathLine) b.classList.add('hw-math');
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let t; (t = walker.nextNode());) if (RE_TRIGGER.test(t.data)) nodes.push(t);
    if (!nodes.length) continue;
    const owner = b.closest('div, p, li') || b;
    let touched = false;
    for (const t of nodes) {
      let html;
      if (mathLine) {
        html = mathToHtml(t.data);
      } else {
        let last = 0;
        html = '';
        for (const m of t.data.matchAll(RE_TOKEN)) {
          html += esc(t.data.slice(last, m.index)) + `<span class="hw-var" dir="ltr">${mathToHtml(m[0])}</span>`;
          last = m.index + m[0].length;
        }
        if (last === 0) continue;
        html += esc(t.data.slice(last));
      }
      if (!touched) { remember(owner); touched = true; }
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      t.replaceWith(tpl.content);
    }
  }
}
