import { getEditor, getOutputEdit } from '../utils/dom.js';
import { PAGE_HEIGHT } from '../config.js';
import { computePageBreaks, reflowPages } from '../pagination/PaginationEngine.js';
import { HW, applyHandwriting, stripHandwriting } from '../handwriting/HandwritingEngine.js';
import { getLineDriftVal } from '../handwriting/LineDrift.js';

export function openPdfModal() {
  document.getElementById('pdf-overlay').classList.add('open');
}

export function closePdfModal() {
  document.getElementById('pdf-overlay').classList.remove('open');
}

function _renderPageBg(type, w, h, lineH) {
  if (type === 'plain') return null;

  const scale = 2;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);

  if (type === 'paper') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
  } else if (type === 'lined') {
    ctx.fillStyle = '#FFFEF8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180,200,220,0.35)';
    ctx.lineWidth = 1;
    const startY = 60;
    for (let y = startY; y <= h; y += lineH) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke();
    }
  } else if (type === 'dotted') {
    ctx.fillStyle = '#FEFEFA';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 10; x < w; x += 20) {
      for (let y = 10; y < h; y += 20) {
        ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else {
    return null;
  }

  return c;
}

export function buildPrintPages() {
  const editor = getEditor();
  if (!editor) return null;

  editor.querySelectorAll('.page-break-marker,.page-gap').forEach(el => el.remove());
  const savedMin = editor.style.minHeight;
  editor.style.minHeight = PAGE_HEIGHT + 'px';

  const breaks = computePageBreaks(editor);
  const contentH = editor.scrollHeight;

  editor.style.minHeight = savedMin;

  const cs = getComputedStyle(editor);
  const styleProps = ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing',
    'color', 'whiteSpace', 'padding', 'direction', 'fontWeight'];

  const bgType = (getOutputEdit() || editor).dataset.bgType || 'paper';
  const lineDriftVal = getLineDriftVal();

  const container = document.createElement('div');
  container.id = 'print-container';
  container.style.cssText = 'position:absolute;left:-9999px;top:0;';

  for (let p = 0; p < breaks.length; p++) {
    const pageStart = breaks[p];
    const pageEnd = (p + 1 < breaks.length) ? breaks[p + 1] : contentH;

    const page = document.createElement('div');
    page.className = 'print-page';
    page.style.cssText = 'width:794px;height:1123px;overflow:hidden;position:relative;background:#fff;';

    const bgCanvas = _renderPageBg(bgType, 794, 1123, parseFloat(cs.lineHeight) || 25.6);
    if (bgCanvas) {
      bgCanvas.style.cssText = 'position:absolute;top:0;left:0;width:794px;height:1123px;z-index:0;';
      page.appendChild(bgCanvas);
    }

    const inner = document.createElement('div');
    inner.className = 'print-page-inner';
    inner.innerHTML = editor.innerHTML;
    inner.querySelectorAll('.page-break-marker,.page-gap').forEach(el => el.remove());

    inner.style.cssText =
      `position:absolute;top:${-pageStart}px;left:0;width:794px;` +
      `height:${pageEnd}px;overflow:hidden;background:transparent;z-index:1;`;

    for (const prop of styleProps) {
      inner.style[prop] = cs[prop];
    }
    inner.style.overflowWrap = cs.overflowWrap || cs.wordWrap;

    // Apply line drift to print clone
    if (lineDriftVal !== 0) {
      const wrapper = document.createElement('div');
      wrapper.style.transform = 'rotate(' + lineDriftVal + 'deg)';
      wrapper.style.transformOrigin = 'right top';
      while (inner.firstChild) wrapper.appendChild(inner.firstChild);
      inner.appendChild(wrapper);
    }

    // Strip screen effects from clone before applying boosted print effects.
    stripHandwriting(inner);

    // Apply handwriting effects to print clone.
    // html2canvas cannot render SVG filters, so we heavily boost
    // per-character transforms to simulate the ink-tremor effect.
    if (HW.enabled) {
      const saved = {
        rotation: HW.rotation, skew: HW.skew, drift: HW.drift,
        spacingVar: HW.spacingVar, opacity: HW.opacity,
        pressureFade: HW.pressureFade, charMode: HW.charMode,
      };
      // Force per-character mode for maximum realism in PDF
      HW.charMode = true;
      // Aggressively boost to compensate for missing SVG filter
      HW.rotation = Math.max(saved.rotation * 1.8, 1.5);
      HW.skew = Math.max((saved.skew || 1.5) * 2.0, 2.0);
      HW.drift = Math.max(saved.drift * 1.8, 1.5);
      HW.spacingVar = Math.max((saved.spacingVar || 0.8) * 1.8, 1.0);
      // Subtle opacity variation for ink feel
      HW.opacity = 0.08;
      HW.pressureFade = 0.06;
      applyHandwriting(inner);
      // Restore
      Object.assign(HW, saved);
    }

    // Ink tremor noise layer — replaces SVG filter that html2canvas can't render.
    // Draws subtle pixel displacement noise over the text area.
    const noiseCanvas = document.createElement('canvas');
    const nw = 794, nh = 1123, nScale = 2;
    noiseCanvas.width = nw * nScale;
    noiseCanvas.height = nh * nScale;
    noiseCanvas.style.cssText = 'position:absolute;top:0;left:0;width:794px;height:1123px;pointer-events:none;z-index:3;mix-blend-mode:multiply;opacity:0.12;';
    const nCtx = noiseCanvas.getContext('2d');
    nCtx.scale(nScale, nScale);
    // Generate ink speckle noise
    const tremorScale = HW.tremor || 1.2;
    for (let ny = 0; ny < nh; ny += 3) {
      for (let nx = 0; nx < nw; nx += 3) {
        if (Math.random() < 0.03 * tremorScale) {
          const gray = Math.floor(30 + Math.random() * 40);
          const size = 0.5 + Math.random() * 1.5 * tremorScale;
          nCtx.fillStyle = `rgba(${gray},${gray},${gray},${0.3 + Math.random() * 0.4})`;
          nCtx.beginPath();
          nCtx.arc(nx + Math.random() * 3, ny + Math.random() * 3, size, 0, Math.PI * 2);
          nCtx.fill();
        }
      }
    }
    page.appendChild(noiseCanvas);

    // Merge draw canvas
    const srcCanvas = document.getElementById('draw-canvas');
    if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
      const drawLayer = document.createElement('canvas');
      drawLayer.width = 794 * 2;
      drawLayer.height = 1123 * 2;
      drawLayer.style.cssText = 'position:absolute;top:0;left:0;width:794px;height:1123px;pointer-events:none;z-index:2;';
      const dCtx = drawLayer.getContext('2d');
      const scaleX = srcCanvas.width / srcCanvas.offsetWidth;
      const scaleY = srcCanvas.height / srcCanvas.offsetHeight;
      dCtx.drawImage(srcCanvas,
        0, pageStart * scaleY,
        srcCanvas.width, 1123 * scaleY,
        0, 0,
        drawLayer.width, drawLayer.height
      );
      page.appendChild(drawLayer);
    }

    page.appendChild(inner);
    container.appendChild(page);
  }

  return { container, totalPages: breaks.length };
}

export function exportToPdf() {
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

  const result = buildPrintPages();
  if (!result) { btn.disabled = false; btn.innerHTML = 'שמור כ-PDF'; return; }
  const { container } = result;

  document.body.appendChild(container);

  const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages = container.querySelectorAll('.print-page');

  (async () => {
    try {
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: null,
          width: 794,
          height: 1123,
          windowWidth: 794
        });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
      }
      pdf.save('DanaYad_Document.pdf');
      closePdfModal();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('שגיאה בייצוא PDF: ' + err.message);
    } finally {
      container.remove();
      btn.disabled = false;
      btn.innerHTML = 'שמור כ-PDF';
      reflowPages();
    }
  })();
}

export function initPrintEvents() {
  window.addEventListener('beforeprint', () => {
    const result = buildPrintPages();
    if (!result) return;
    result.container.style.position = 'static';
    result.container.style.left = 'auto';
    document.body.appendChild(result.container);
  });
  window.addEventListener('afterprint', () => {
    const c = document.getElementById('print-container');
    if (c) c.remove();
    reflowPages();
  });
}
