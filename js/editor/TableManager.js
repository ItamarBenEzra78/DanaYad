import { getEditor } from '../utils/dom.js';

export function toggleTablePopup() {
  document.getElementById('table-popup').classList.toggle('open');
}

export function insertTable(reflowPages) {
  const rows = parseInt(document.getElementById('table-rows').value) || 3;
  const cols = parseInt(document.getElementById('table-cols').value) || 3;
  const ed = getEditor();

  let html = '<table dir="rtl">';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += '<td>&nbsp;</td>';
    }
    html += '</tr>';
  }
  html += '</table><br>';

  const sel = window.getSelection();
  if (sel.rangeCount && ed.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    range.insertNode(frag);
    range.collapse(false);
  } else {
    ed.insertAdjacentHTML('beforeend', html);
  }

  document.getElementById('table-popup').classList.remove('open');
  ed.focus();
  reflowPages();
}
