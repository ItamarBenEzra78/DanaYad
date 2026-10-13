import { getOutputEdit } from '../utils/dom.js';

/** Slider-driven scales of the three displacement layers in #ink-tremor (index.html). */
export const HW = {
  enabled: true,
  drift: 7,   // layer 1: baseline wobble
  jitter: 4,  // layer 2: per-character jitter
  tremor: 2,  // layer 3: ink micro-tremor
};

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
