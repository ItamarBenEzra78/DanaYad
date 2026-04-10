import { getEditor } from '../utils/dom.js';

let _scrambleBackup = null;

export function scrambleText() {
  const ed = getEditor();
  if (!ed) return;
  _scrambleBackup = ed.innerHTML;
  const baseFontSize = parseFloat(getComputedStyle(ed).fontSize) || 16;
  const text = ed.innerText;
  let html = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { html += '\n'; continue; }
    if (ch === ' ' || ch === '\t') { html += ch; continue; }
    const rot = (Math.random() - 0.5) * 6;
    const sz = baseFontSize + (Math.random() - 0.5) * 4;
    const top = (Math.random() - 0.5) * 4;
    html += '<span class="hw-scramble" style="display:inline-block;direction:rtl;unicode-bidi:embed;' +
      'transform:rotate(' + rot.toFixed(1) + 'deg);' +
      'font-size:' + sz.toFixed(1) + 'px;' +
      'position:relative;top:' + top.toFixed(1) + 'px;">' +
      ch.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
  }
  ed.innerHTML = html;
}

export function unscrambleText() {
  const ed = getEditor();
  if (!ed) return;
  if (_scrambleBackup !== null) {
    ed.innerHTML = _scrambleBackup;
    _scrambleBackup = null;
  } else {
    ed.querySelectorAll('.hw-scramble').forEach(s => s.replaceWith(s.textContent));
    ed.normalize();
  }
}
