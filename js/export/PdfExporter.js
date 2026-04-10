import { getEditor, getOutputEdit } from '../utils/dom.js';
import { API_URL } from '../config.js';

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

/**
 * Build a self-contained HTML page from the current editor state.
 * Uses absolute URLs for CSS/fonts so the headless browser can fetch them.
 */
function _buildExportHtml() {
  const outputEdit = getOutputEdit();

  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(el => `<link rel="stylesheet" href="${el.href}">`)
    .join('\n');

  const fontLinks = Array.from(
    document.querySelectorAll('link[href*="fonts.googleapis"]')
  ).map(el => `<link rel="stylesheet" href="${el.href}">`).join('\n');

  const svgEl = document.querySelector('svg[style*="position:absolute"]');
  const svgHtml = svgEl ? svgEl.outerHTML : '';

  const clone = outputEdit.cloneNode(true);
  clone.querySelectorAll('.page-break-marker').forEach(m => m.remove());
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
${fontLinks}
${cssLinks}
<style>
body { margin: 0; padding: 0; background: #fff; }
#output-edit { margin: 0 !important; box-shadow: none !important; }
</style>
</head>
<body>
${svgHtml}
${clone.outerHTML}
</body>
</html>`;
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
    const html = _buildExportHtml();

    const res = await fetch(`${API_URL}/api/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
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
