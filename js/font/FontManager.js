import { getEditor } from '../utils/dom.js';
import { FONTS } from '../config.js';

let currentFont = FONTS[0];
const loadedFonts = new Set();

export function loadGoogleFont(font) {
  if (loadedFonts.has(font.css)) return;
  loadedFonts.add(font.css);
  if (!font.google) return; // bundled font, already loaded via CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
}

export function applyFont(font) {
  currentFont = font;
  loadGoogleFont(font);
  const stack = `'${font.css}','GveretLevin','Playpen Sans Hebrew',cursive`;
  document.documentElement.style.setProperty('--font', stack);
  const ed = getEditor();
  if (ed) {
    ed.style.fontFamily = stack;
    ed.style.fontWeight = font.weight;
  }
  const prev = document.querySelector('.font-preview');
  if (prev) { prev.style.fontFamily = `'${font.css}','GveretLevin',cursive`; prev.textContent = 'אבג abc'; }
  document.querySelectorAll('.font-card').forEach(c => c.classList.toggle('active', c.dataset.css === font.css));
}

export function filterFonts(cat, btn) {
  btn.closest('.tabs').querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buildFontGrid(cat);
}

export function buildFontGrid(cat = 'all') {
  const grid = document.getElementById('font-grid');
  grid.innerHTML = '';
  const filtered = cat === 'all' ? FONTS : FONTS.filter(f => f.cat === cat);
  filtered.forEach(font => {
    const card = document.createElement('div');
    card.className = 'font-card' + (font.css === currentFont.css ? ' active' : '');
    card.dataset.css = font.css;
    loadGoogleFont(font);
    card.innerHTML = `
      <span class="font-card-name">${font.name}</span>
      <span class="font-card-preview" style="font-family:'${font.css}',cursive;font-weight:${font.weight};">${font.preview}</span>
    `;
    card.onclick = () => applyFont(font);
    grid.appendChild(card);
  });
}

/**
 * Confirm the bundled handwriting fonts (css/variables.css @font-face)
 * actually loaded, and say so in the header badge.
 */
export async function checkBundledFonts() {
  const badge = document.getElementById('font-badge');
  const bundled = FONTS.filter(f => !f.google).map(f => f.css);
  try {
    await Promise.all(bundled.map(css => document.fonts.load(`20px '${css}'`)));
    const ok = bundled.every(css => document.fonts.check(`20px '${css}'`));
    badge.textContent = ok ? '✓ גופני כתב יד נטענו' : '⚠ גופני כתב יד לא נטענו';
    badge.classList.toggle('missing', !ok);
  } catch (err) {
    console.error('Font check failed:', err);
    badge.textContent = '⚠ לא ניתן לבדוק גופנים';
    badge.classList.add('missing');
  }
}
