import { getOutputEdit } from '../utils/dom.js';

export const HW = {
  enabled: true,
  rotation: 2,
  sizeVar: 1.5,
  drift: 2,
  tremor: 1.2,
  opacity: 0.2,
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
      node.parentElement.classList.contains('hw-word')
    )) continue;
    if (node.textContent.length === 0) continue;
    textNodes.push(node);
  }

  let wordIdx = 0;
  let lineIdx = 0;

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
      wordIdx++;
    });

    tNode.parentNode.replaceChild(frag, tNode);
  });
}
