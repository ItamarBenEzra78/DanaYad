import { getOutputEdit } from '../utils/dom.js';

export const HW = {
  enabled: true,
  drift: 7,
  jitter: 4,
  tremor: 2,
  charMode: true,
  rotation: 2,
  skew: 1.5,
  sizeVar: 1.5,
  opacity: 0.2,
  pressureFade: 0.12,
  spacingVar: 0.8,
  _seed: Math.random() * 1000
};

function _hwRand(seed) {
  let x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Update SVG filter attributes from slider values.
 * Screen + browser print use the SVG filter (no DOM manipulation).
 */
export function updateHwParam() {
  HW.drift  = parseFloat(document.getElementById('hw-drift').value);
  HW.jitter = parseFloat(document.getElementById('hw-jitter').value);
  HW.tremor = parseFloat(document.getElementById('hw-tremor').value);

  document.getElementById('hw-drift-val').textContent  = HW.drift;
  document.getElementById('hw-jitter-val').textContent = HW.jitter;
  document.getElementById('hw-tremor-val').textContent = HW.tremor;

  _syncFilter();
}

function _syncFilter() {
  const wobbleScale = document.getElementById('hw-wobble-scale');
  const jitterScale = document.getElementById('hw-jitter-scale');
  const inkScale    = document.getElementById('hw-ink-scale');

  if (wobbleScale) wobbleScale.setAttribute('scale', HW.drift);
  if (jitterScale) jitterScale.setAttribute('scale', HW.jitter);
  if (inkScale)    inkScale.setAttribute('scale', HW.tremor);
}

export function toggleHandwriting(on) {
  HW.enabled = on;
  const editor = getOutputEdit();
  if (!on) {
    editor.classList.remove('hw-filter');
  } else {
    editor.classList.add('hw-filter');
  }
}

/**
 * Apply per-character transforms to a DOM clone (for PDF export only).
 * Screen display uses the SVG filter instead.
 */
export function applyHandwriting(root) {
  const baseFontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && (
      node.parentElement.closest('.page-break-marker') ||
      node.parentElement.classList.contains('hw-word') ||
      node.parentElement.classList.contains('hw-char')
    )) continue;
    if (node.textContent.length === 0) continue;
    textNodes.push(node);
  }

  let wordIdx = 0;
  let lineIdx = 0;
  let globalCharIdx = 0;

  textNodes.forEach(tNode => {
    const text = tNode.textContent;
    if (!text) return;

    const frag = document.createDocumentFragment();
    const tokens = text.match(/[^\s]+|[\s]/g);
    if (!tokens) return;

    tokens.forEach(token => {
      if (token === '\n') {
        frag.appendChild(document.createTextNode('\n'));
        lineIdx++;
        return;
      }
      if (token === ' ' || token === '\t') {
        frag.appendChild(document.createTextNode(token));
        return;
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = 'hw-word';
      wordSpan.style.cssText = 'display:inline-block;direction:rtl;unicode-bidi:embed;';

      const wordSeed = HW._seed + lineIdx * 137 + wordIdx;
      const wordLen = token.length;

      for (let ci = 0; ci < wordLen; ci++) {
        const charSpan = document.createElement('span');
        charSpan.className = 'hw-char';
        charSpan.textContent = token[ci];

        const cSeed = wordSeed + ci * 31 + globalCharIdx * 7;

        const rot = ((_hwRand(cSeed) - 0.5) * 2) * HW.rotation;
        const skew = ((_hwRand(cSeed + 1) - 0.5) * 2) * HW.skew;
        const sizeOff = ((_hwRand(cSeed + 2) - 0.5) * 2) * HW.sizeVar;
        const phase = _hwRand(wordSeed * 0.01 + lineIdx * 7.3) * Math.PI * 2;
        const driftY = Math.sin(phase + ci * 0.7 + wordIdx * 0.4) * HW.drift * 0.3;
        const pressurePos = ci / Math.max(wordLen - 1, 1);
        const pressureFade = pressurePos * HW.pressureFade;
        const opVar = (1.0 - _hwRand(cSeed + 3) * HW.opacity) - pressureFade;
        const spacingOff = ((_hwRand(cSeed + 4) - 0.5) * 2) * HW.spacingVar;

        charSpan.style.cssText =
          'display:inline-block;' +
          'transform:rotate(' + rot.toFixed(2) + 'deg) skewY(' + skew.toFixed(2) + 'deg);' +
          'font-size:' + (baseFontSize + sizeOff).toFixed(1) + 'px;' +
          'position:relative;top:' + driftY.toFixed(1) + 'px;' +
          'opacity:' + Math.max(opVar, 0.55).toFixed(3) + ';' +
          'margin-left:' + spacingOff.toFixed(1) + 'px;';

        wordSpan.appendChild(charSpan);
        globalCharIdx++;
      }

      frag.appendChild(wordSpan);
      wordIdx++;
    });

    tNode.parentNode.replaceChild(frag, tNode);
  });
}

export function stripHandwriting(root) {
  root.querySelectorAll('.hw-char').forEach(span => {
    const text = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(text, span);
  });
  root.querySelectorAll('.hw-word').forEach(span => {
    while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
    span.remove();
  });
  root.normalize();
}
