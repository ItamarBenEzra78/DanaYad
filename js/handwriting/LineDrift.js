let _lineDriftVal = 0;

export function getLineDriftVal() { return _lineDriftVal; }

export function updateLineDrift(val) {
  _lineDriftVal = parseFloat(val);
  document.getElementById('line-drift-val').textContent = val + '°';
  applyScreenDrift();
}

/**
 * Apply line drift per-page on screen.
 * Each page section (between page-break-markers) gets its own
 * rotation, so drift resets at every page boundary — like placing
 * a new sheet of paper.
 */
export function applyScreenDrift() {
  const rc = document.getElementById('rotate-container');
  if (!rc) return;

  // Remove old drift wrappers
  rc.querySelectorAll('.drift-page-wrap').forEach(wrap => {
    while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
  });

  // Remove transform from container itself
  rc.style.transform = '';
  rc.style.transformOrigin = '';

  if (_lineDriftVal === 0) return;

  // Get page break positions from markers
  const markers = Array.from(rc.querySelectorAll('.page-break-marker'));
  if (markers.length === 0) {
    // Single page — rotate the whole container
    rc.style.transform = 'rotate(' + _lineDriftVal + 'deg)';
    rc.style.transformOrigin = 'right top';
    return;
  }

  // Multiple pages — wrap content between markers
  // Collect all direct children into page groups
  const children = Array.from(rc.childNodes);
  const pages = [];
  let currentPage = [];

  children.forEach(node => {
    if (node.classList && node.classList.contains('page-break-marker')) {
      pages.push({ nodes: currentPage, marker: node });
      currentPage = [];
    } else {
      currentPage.push(node);
    }
  });
  // Last page (after last marker)
  if (currentPage.length > 0) {
    pages.push({ nodes: currentPage, marker: null });
  }

  // First page is everything before the first marker
  // Wrap each page group in a drift container
  pages.forEach((page) => {
    if (page.nodes.length === 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'drift-page-wrap';
    wrap.style.transform = 'rotate(' + _lineDriftVal + 'deg)';
    wrap.style.transformOrigin = 'right top';

    // Insert wrap before the first node of this group
    const firstNode = page.nodes[0];
    firstNode.parentNode.insertBefore(wrap, firstNode);

    // Move nodes into wrap
    page.nodes.forEach(n => wrap.appendChild(n));

    // Re-insert the marker after the wrap (so it stays outside)
    if (page.marker) {
      wrap.parentNode.insertBefore(page.marker, wrap.nextSibling);
    }
  });
}
