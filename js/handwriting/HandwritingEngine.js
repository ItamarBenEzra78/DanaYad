import { getOutputEdit } from '../utils/dom.js';

export const HW = {
  enabled: true,
  rotation: 2,
  sizeVar: 1.5,
  drift: 2,
  tremor: 1.2,
  opacity: 0.2,
  charMode: true,       // per-character variation (more realistic)
  skew: 1.5,            // max skew degrees per character
  pressureFade: 0.12,   // ink pressure fade along word (0-0.3)
  spacingVar: 0.8,      // letter spacing variation in px
  _seed: Math.random() * 1000
};

function _hwRand(seed) {
  let x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

export function updateHwParam() {
  HW.rotation = parseFloat(document.getElementById('hw-rotation').value);
  HW.sizeVar  = parseFloat(document.getElementById('hw-size-var').value);
  HW.drift    = parseFloat(document.getElementById('hw-drift').value);
  HW.tremor   = parseFloat(document.getElementById('hw-tremor').value);
  HW.opacity  = parseFloat(document.getElementById('hw-opacity').value);

  document.getElementById('hw-rotation-val').textContent = HW.rotation + '°';
  document.getElementById('hw-size-val').textContent     = HW.sizeVar;
  document.getElementById('hw-drift-val').textContent    = HW.drift + 'px';
  document.getElementById('hw-tremor-val').textContent   = HW.tremor;
  document.getElementById('hw-opacity-val').textContent  = HW.opacity;

  const disp = document.querySelector('#ink-tremor feDisplacementMap');
  if (disp) disp.setAttribute('scale', HW.tremor);
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

export function applyHandwriting(root) {
  if (!HW.enabled) return;

  const baseFontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
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
        const sp = document.createTextNode(token);
        frag.appendChild(sp);
        return;
      }

      if (HW.charMode) {
        // Per-character mode — each letter gets its own variation
        const wordSpan = document.createElement('span');
        wordSpan.className = 'hw-word';
        wordSpan.style.cssText = 'display:inline-block;direction:rtl;unicode-bidi:embed;';

        const wordSeed = HW._seed + lineIdx * 137 + wordIdx;
        const wordLen = token.length;

        for (let ci = 0; ci < wordLen; ci++) {
          const ch = token[ci];
          const charSpan = document.createElement('span');
          charSpan.className = 'hw-char';
          charSpan.textContent = ch;

          const cSeed = wordSeed + ci * 31 + globalCharIdx * 7;

          // Rotation — per character, subtle
          const rot = ((_hwRand(cSeed) - 0.5) * 2) * HW.rotation * 0.35;

          // Skew — makes each letter lean differently
          const skew = ((_hwRand(cSeed + 1) - 0.5) * 2) * HW.skew;

          // Size variation — per character
          const sizeOff = ((_hwRand(cSeed + 2) - 0.5) * 2) * HW.sizeVar * 0.4;

          // Baseline wobble — sinusoidal drift per character
          const phase = _hwRand(wordSeed * 0.01 + lineIdx * 7.3) * Math.PI * 2;
          const driftY = Math.sin(phase + ci * 0.7 + wordIdx * 0.4) * HW.drift * 0.6;

          // Ink pressure — darker at word start, lighter toward end
          const pressurePos = ci / Math.max(wordLen - 1, 1);
          const pressureFade = pressurePos * HW.pressureFade;
          const opVar = (1.0 - _hwRand(cSeed + 3) * HW.opacity) - pressureFade;

          // Letter spacing variation
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
      } else {
        // Legacy per-word mode
        const span = document.createElement('span');
        span.className = 'hw-word';
        span.textContent = token;

        const seed = HW._seed + lineIdx * 137 + wordIdx;
        const rot = ((_hwRand(seed) - 0.5) * 2) * HW.rotation * 0.5;
        const sizeOff = ((_hwRand(seed + 1) - 0.5) * 2) * HW.sizeVar * 0.6;
        const linePhase = _hwRand(seed * 0.01 + lineIdx * 7.3) * Math.PI * 2;
        const driftY = Math.sin(linePhase + wordIdx * 0.4) * HW.drift;
        const opVar = 1.0 - _hwRand(seed + 2) * HW.opacity;

        span.style.cssText =
          'display:inline-block;direction:rtl;unicode-bidi:embed;' +
          'transform:rotate(' + rot.toFixed(2) + 'deg);' +
          'font-size:' + (baseFontSize + sizeOff).toFixed(1) + 'px;' +
          'position:relative;top:' + driftY.toFixed(1) + 'px;' +
          'opacity:' + opVar.toFixed(3) + ';';

        frag.appendChild(span);
      }
      wordIdx++;
    });

    tNode.parentNode.replaceChild(frag, tNode);
  });
}
