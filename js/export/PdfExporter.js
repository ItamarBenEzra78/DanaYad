import { getEditor, getOutputEdit } from '../utils/dom.js';
import { PAGE_HEIGHT } from '../config.js';

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

function _overlayDrawCanvas(ctx, pageIndex, canvasWidth, canvasHeight) {
  const drawCanvas = document.getElementById('draw-canvas');
  if (!drawCanvas || drawCanvas.width === 0 || drawCanvas.height === 0) return;

  const sy = drawCanvas.height / drawCanvas.offsetHeight;

  ctx.drawImage(
    drawCanvas,
    0, pageIndex * PAGE_HEIGHT * sy,
    drawCanvas.width, PAGE_HEIGHT * sy,
    0, 0,
    canvasWidth, canvasHeight
  );
}

export async function exportToPdf() {
  const btn = document.getElementById('pdf-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="pdf-spinner"></span> מייצא...';

  const editor = getEditor();
  const outputEdit = getOutputEdit();

  if (!editor || editor.textContent.trim() === '') {
    alert('אין תוכן להדפסה');
    btn.disabled = false;
    btn.innerHTML = 'שמור כ-PDF';
    return;
  }

  const markers = outputEdit.querySelectorAll('.page-break-marker');
  markers.forEach(m => { m.style.display = 'none'; });

  try {
    const fullCanvas = await html2canvas(outputEdit, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
    });

    const scale = fullCanvas.width / outputEdit.offsetWidth;
    const pageWidthPx = fullCanvas.width;
    const pageHeightPx = Math.round(PAGE_HEIGHT * scale);
    const totalPages = Math.max(1, Math.ceil(fullCanvas.height / pageHeightPx));

    const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      const srcY = i * pageHeightPx;
      const srcH = Math.min(pageHeightPx, fullCanvas.height - srcY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = pageWidthPx;
      pageCanvas.height = pageHeightPx;
      const ctx = pageCanvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
      ctx.drawImage(fullCanvas, 0, srcY, pageWidthPx, srcH, 0, 0, pageWidthPx, srcH);

      _overlayDrawCanvas(ctx, i, pageWidthPx, pageHeightPx);

      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }

    pdf.save('DanaYad_Document.pdf');
    closePdfModal();
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('שגיאה בייצוא PDF: ' + err.message);
  } finally {
    markers.forEach(m => { m.style.display = ''; });
    btn.disabled = false;
    btn.innerHTML = 'שמור כ-PDF';
  }
}
