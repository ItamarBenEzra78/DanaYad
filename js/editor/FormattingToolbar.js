import { getEditor } from '../utils/dom.js';

export function toggleBold() { getEditor().focus(); document.execCommand('bold'); syncToolbar(); }
export function toggleItalic() { getEditor().focus(); document.execCommand('italic'); syncToolbar(); }
export function toggleUnderline() { getEditor().focus(); document.execCommand('underline'); syncToolbar(); }

export function alignLeft() { getEditor().focus(); document.execCommand('justifyLeft'); syncToolbar(); }
export function alignCenter() { getEditor().focus(); document.execCommand('justifyCenter'); syncToolbar(); }
export function alignRight() { getEditor().focus(); document.execCommand('justifyRight'); syncToolbar(); }

export function insertBullet() { getEditor().focus(); document.execCommand('insertUnorderedList'); syncToolbar(); }
export function insertNumbered() { getEditor().focus(); document.execCommand('insertOrderedList'); syncToolbar(); }

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
}
