import { getEditor, getOutputEdit } from '../utils/dom.js';
import { API_URL } from '../config.js';
import { HW } from '../handwriting/HandwritingEngine.js';

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

/**
 * Capture the current editor state so the backend can replicate it
 * inside the live app opened by Playwright.
 */
function _captureEditorState() {
  const outputEdit = getOutputEdit();
  const editor = getEditor();

  return {
    app_url: window.location.origin + window.location.pathname,
    editor_html: editor.innerHTML,
    output_edit_class: outputEdit.className,
    output_edit_style: outputEdit.style.cssText,
    editor_style: editor.style.cssText,
    root_style: document.documentElement.style.cssText,
    hw_params: {
      drift: HW.drift,
      jitter: HW.jitter,
      tremor: HW.tremor,
    },
  };
}

export async function exportToPdf() {
  const btn = document.getElementById('pdf-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="pdf-spinner"></span> מייצא...';

  const editor = getEditor();
  if (!editor || editor.textContent.trim() === '') {
    alert('אין תוכן להדפסה');
    btn.disabled = false;
    btn.innerHTML = 'שמור כ-PDF';
    return;
  }

  try {
    const state = _captureEditorState();

    const res = await fetch(`${API_URL}/api/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DanaYad_Document.pdf';
    a.click();
    URL.revokeObjectURL(url);

    closePdfModal();
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('שגיאה בייצוא PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'שמור כ-PDF';
  }
}
