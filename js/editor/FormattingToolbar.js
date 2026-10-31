import { getEditor } from '../utils/dom.js';

export function toggleBold() { getEditor().focus(); document.execCommand('bold'); syncToolbar(); }
export function toggleItalic() { getEditor().focus(); document.execCommand('italic'); syncToolbar(); }
export function toggleUnderline() { getEditor().focus(); document.execCommand('underline'); syncToolbar(); }

export function alignLeft() { getEditor().focus(); document.execCommand('justifyLeft'); syncToolbar(); }
export function alignCenter() { getEditor().focus(); document.execCommand('justifyCenter'); syncToolbar(); }
export function alignRight() { getEditor().focus(); document.execCommand('justifyRight'); syncToolbar(); }

export function insertBullet() { getEditor().focus(); document.execCommand('insertUnorderedList'); syncToolbar(); }
export function insertNumbered() { getEditor().focus(); document.execCommand('insertOrderedList'); syncToolbar(); }

/** Pen colour for new and selected text; the swatch stays lit as the current pen. */
export function setPenColor(color, btn) {
  getEditor().focus();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, color);
  document.querySelectorAll('.pen-swatch').forEach(b => b.classList.toggle('active', b === btn));
}

export const HIGHLIGHT = 'rgba(255, 221, 0, 0.55)';

/** Yellow marker over the selection; on an already highlighted selection, removes it. */
export function toggleHighlight() {
  getEditor().focus();
  document.execCommand('styleWithCSS', false, true);
  const on = document.queryCommandValue('hiliteColor');
  const lit = on && on !== 'transparent' && on !== 'rgba(0, 0, 0, 0)';
  document.execCommand('hiliteColor', false, lit ? 'transparent' : HIGHLIGHT);
  syncToolbar();
}

export function syncToolbar() {
  const map = {
    'toggleBold()': 'bold',
    'toggleItalic()': 'italic',
    'toggleUnderline()': 'underline',
    'alignLeft()': 'justifyLeft',
    'alignCenter()': 'justifyCenter',
    'alignRight()': 'justifyRight',
    'insertBullet()': 'insertUnorderedList',
    'insertNumbered()': 'insertOrderedList'
  };
  Object.entries(map).forEach(([fn, cmd]) => {
    const el = document.querySelector(`[onclick="${fn}"]`);
    if (el) el.classList.toggle('active', document.queryCommandState(cmd));
  });
  const hl = document.getElementById('btn-highlight');
  if (hl) {
    const v = document.queryCommandValue('hiliteColor');
    hl.classList.toggle('active', !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)');
  }
}
