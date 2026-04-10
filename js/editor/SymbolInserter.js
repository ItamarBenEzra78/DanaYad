import { getEditor } from '../utils/dom.js';

export function insertSymbol(sym) {
  const ed = getEditor();
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(sym));
    range.collapse(false);
    if (ed) ed.focus();
  }
}

export function showSymbolGrid(type) {
  document.querySelectorAll('.sym-grid').forEach(g => g.classList.add('hidden'));
  document.getElementById('sym-' + type).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active',
    t.textContent.includes(type === 'math' ? 'מתמטיקה' : type === 'arrows' ? 'חצים' : type === 'greek' ? 'יוונית' : 'שונות')
  ));
}
