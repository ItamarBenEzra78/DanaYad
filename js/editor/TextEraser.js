import { getEditor } from '../utils/dom.js';

let eraserSize = 2;

export function toggleTextEraser() {
  const btn = document.getElementById('btn-text-eraser');
  const label = document.getElementById('eraser-size-label');
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    label.style.display = 'none';
  } else {
    btn.classList.add('active');
    label.style.display = 'inline';
    eraserSize = 2;
    label.textContent = 'מילה';
  }
}

export function handleKey(e) {
  if (!document.getElementById('btn-text-eraser').classList.contains('active')) return;
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    eraseAtCursor(eraserSize);
  }
}

function eraseAtCursor(size) {
  const ed = getEditor();

  let range;
  const sel = window.getSelection();
  if (sel.rangeCount) {
    range = sel.getRangeAt(0).cloneRange();
  }
  if (!range) return;

  const node = range.startContainer;
  if (node.nodeType !== 3) return;
  const offset = range.startOffset;
  const text = node.textContent;
  if (!text || text.trim() === '') return;

  if (size === 1) {
    if (offset < text.length) {
      node.textContent = text.slice(0, offset) + text.slice(offset + 1);
    } else if (text.length > 0) {
      node.textContent = text.slice(0, -1);
    }
  } else if (size === 2) {
    let start = offset, end = offset;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    while (end < text.length && !/\s/.test(text[end])) end++;
    if (end < text.length && /\s/.test(text[end])) end++;
    if (start !== end) {
      node.textContent = text.slice(0, start) + text.slice(end);
    }
  } else if (size === 3) {
    let block = node.parentNode;
    while (block && block !== ed && !['DIV', 'P', 'BR'].includes(block.nodeName)) {
      block = block.parentNode;
    }
    if (block && block !== ed) {
      block.remove();
    } else {
      node.textContent = '';
    }
  }

  ed.querySelectorAll('*').forEach(el => {
    if (el.textContent.trim() === '' && el !== ed && el.childNodes.length === 0) el.remove();
  });
}
