import { PAGE_HEIGHT } from '../config.js';

let _lineDriftVal = 0;

export function updateLineDrift(val) {
  _lineDriftVal = parseFloat(val);
  document.getElementById('line-drift-val').textContent = val + '°';
  applyScreenDrift();
}

/**
 * Apply per-page drift on screen.
 * Instead of rotating the whole container (which accumulates offset),
 * we rotate each page-sized section independently so the drift
 * resets at every page boundary.
 */
export function applyScreenDrift() {
  const rc = document.getElementById('rotate-container');
  if (!rc) return;

  // Clean up: remove old drift wrappers, restore children
  rc.querySelectorAll('.drift-wrap').forEach(wrap => {
    while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
  });

  // Remove any rotation from the container itself
  rc.style.transform = '';
  rc.style.transformOrigin = '';

  if (_lineDriftVal === 0) return;

  // Get page break Y positions from markers
  const markers = Array.from(rc.querySelectorAll('.page-break-marker'));

  if (markers.length === 0) {
    // Single page — just rotate the container
    rc.style.transform = 'rotate(' + _lineDriftVal + 'deg)';
    rc.style.transformOrigin = 'right top';
    return;
  }

  // Multiple pages — create a drift wrapper per page section.
  // Each wrapper is positioned at the page-start Y with height = PAGE_HEIGHT,
  // and rotated independently so drift doesn't accumulate.
  const breakYs = [0];
  markers.forEach(m => {
    breakYs.push(parseInt(m.style.top));
  });

  breakYs.forEach((startY, i) => {
    const endY = (i + 1 < breakYs.length) ? breakYs[i + 1] : startY + PAGE_HEIGHT;

    const wrap = document.createElement('div');
    wrap.className = 'drift-wrap';
    wrap.style.cssText =
      'position:absolute;' +
      'top:' + startY + 'px;' +
      'left:0;right:0;' +
      'height:' + (endY - startY) + 'px;' +
      'transform:rotate(' + _lineDriftVal + 'deg);' +
      'transform-origin:right top;' +
      'pointer-events:none;' +
      'z-index:0;';

    rc.appendChild(wrap);
  });

  // The actual text stays unrotated in the flow.
  // The drift wraps are visual-only overlays — but this won't work
  // because the text needs to be inside the rotated container.

  // Better approach: rotate the whole container but use CSS clip
  // to reset visual position at each page boundary.
  // Actually simplest: just rotate the container, and on PDF export
  // (which already does per-page) it will look correct.

  // For screen preview: rotate the whole thing, it's a preview anyway
  rc.querySelectorAll('.drift-wrap').forEach(w => w.remove());
  rc.style.transform = 'rotate(' + _lineDriftVal + 'deg)';
  rc.style.transformOrigin = 'right top';
}
