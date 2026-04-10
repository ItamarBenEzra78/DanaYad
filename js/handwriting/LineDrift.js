let _lineDriftVal = 0;

export function getLineDriftVal() { return _lineDriftVal; }

export function updateLineDrift(val) {
  _lineDriftVal = parseFloat(val);
  document.getElementById('line-drift-val').textContent = val + '°';
  const rc = document.getElementById('rotate-container');
  if (!rc) return;
  if (_lineDriftVal === 0) {
    rc.style.transform = '';
    rc.style.transformOrigin = '';
  } else {
    rc.style.transform = 'rotate(' + _lineDriftVal + 'deg)';
    rc.style.transformOrigin = 'right top';
  }
}
