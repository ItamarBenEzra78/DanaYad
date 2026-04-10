import { getEditor } from '../utils/dom.js';
import { FONTS } from '../config.js';

let currentFont = FONTS[0];
const loadedFonts = new Set();

export function getCurrentFont() { return currentFont; }

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

export function detectInstalledFonts() {
  const badge = document.getElementById('font-badge');
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = '20px monospace'; const w1 = ctx.measureText('א').width;
  ctx.font = "20px 'Dana Yad AlefAlefAlef'"; const w2 = ctx.measureText('א').width;
  ctx.font = '20px monospace'; const w3 = ctx.measureText('a').width;
  ctx.font = "20px 'Playpen Sans Hebrew'"; const w4 = ctx.measureText('a').width;
  const danaOk = w1 !== w2, caveatOk = w3 !== w4;
  if (danaOk && caveatOk) { badge.textContent = '✓ דנה יד + Playpen'; }
  else if (danaOk) { badge.textContent = '✓ דנה יד | Playpen נטען'; }
  else { badge.textContent = '⚠ דנה יד לא מותקן'; badge.classList.add('missing'); }
}
