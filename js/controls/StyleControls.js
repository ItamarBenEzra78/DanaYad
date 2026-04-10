import { getEditor, getOutputEdit } from '../utils/dom.js';

export function updateFontSize(val) {
  const ed = getEditor();
  if (ed) ed.style.fontSize = val + 'px';
  document.getElementById('font-size-val').textContent = val + 'px';
}

export function updateLineHeight(val) {
  const ed = getEditor();
  if (ed) ed.style.lineHeight = val;
  document.getElementById('line-height-val').textContent = val;
}

export function updateLetterSpacing(val) {
  const ed = getEditor();
  if (ed) ed.style.letterSpacing = val + 'px';
  document.getElementById('letter-spacing-val').textContent = val + 'px';
}

export function setBackground(type) {
  const editor = getOutputEdit();
  editor.classList.remove('bg-paper', 'bg-lined', 'bg-dotted', 'bg-plain');
  editor.classList.add('bg-' + type);
  editor.dataset.bgType = type;
  document.querySelectorAll('.bg-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(
      type === 'paper' ? 'נייר' : type === 'lined' ? 'משורטט' : type === 'dotted' ? 'מנוקד' : 'חלק'
    ));
  });
}
