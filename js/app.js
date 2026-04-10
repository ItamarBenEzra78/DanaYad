/* ── DanaYad App Entry Point ── */

// Controls
import { updateFontSize, updateLineHeight, updateLetterSpacing, setBackground } from './controls/StyleControls.js';

// Editor
import { toggleBold, toggleItalic, toggleUnderline, alignLeft, alignCenter, alignRight, insertBullet, insertNumbered, syncToolbar } from './editor/FormattingToolbar.js';
import { toggleTextEraser, handleKey } from './editor/TextEraser.js';
import { toggleTablePopup, insertTable } from './editor/TableManager.js';
import { insertSymbol, showSymbolGrid } from './editor/SymbolInserter.js';

// Font
import { buildFontGrid, filterFonts, detectInstalledFonts } from './font/FontManager.js';

// Handwriting
import { updateHwParam, toggleHandwriting, HW } from './handwriting/HandwritingEngine.js';
import { scrambleText, unscrambleText } from './handwriting/ScrambleEngine.js';
import { updateLineDrift } from './handwriting/LineDrift.js';

// Pagination
import { reflowPages, updatePageIndicator } from './pagination/PaginationEngine.js';

// Drawing
import { toggleDrawMode, isDrawMode, initCanvasEvents } from './drawing/DrawingCanvas.js';
import { setDrawColor, toggleEraser, clearCanvas, undoCanvas, canvasHistory } from './drawing/DrawingTools.js';
import { toggleRuler } from './drawing/RulerTool.js';

// Export
import { openPdfModal, closePdfModal, exportToPdf, initPrintEvents } from './export/PdfExporter.js';

// Auth
import { handleGoogleLogin, handleLogout, checkSession, checkAndExport, initAuthListener } from './auth/AuthManager.js';

// ── Expose functions to window for inline onclick handlers ──
window.updateFontSize = updateFontSize;
window.updateLineHeight = updateLineHeight;
window.updateLetterSpacing = updateLetterSpacing;
window.setBackground = setBackground;

window.toggleBold = toggleBold;
window.toggleItalic = toggleItalic;
window.toggleUnderline = toggleUnderline;
window.alignLeft = alignLeft;
window.alignCenter = alignCenter;
window.alignRight = alignRight;
window.insertBullet = insertBullet;
window.insertNumbered = insertNumbered;
window.syncToolbar = syncToolbar;

window.toggleTextEraser = toggleTextEraser;
window.handleKey = handleKey;
window.toggleTablePopup = toggleTablePopup;
window.insertTable = () => insertTable(reflowPages);
window.insertSymbol = insertSymbol;
window.showSymbolGrid = showSymbolGrid;

window.filterFonts = filterFonts;

window.updateHwParam = updateHwParam;
window.toggleHandwriting = toggleHandwriting;
window.scrambleText = scrambleText;
window.unscrambleText = unscrambleText;
window.updateLineDrift = updateLineDrift;

window.toggleDrawMode = toggleDrawMode;
window.setDrawColor = setDrawColor;
window.toggleEraser = toggleEraser;
window.clearCanvas = clearCanvas;
window.undoCanvas = undoCanvas;
window.toggleRuler = toggleRuler;

window.openPdfModal = openPdfModal;
window.closePdfModal = closePdfModal;
window.exportToPdf = exportToPdf;
window.checkAndExport = checkAndExport;

window.handleGoogleLogin = handleGoogleLogin;
window.handleLogout = handleLogout;

window.globalUndo = function () {
  if (isDrawMode()) {
    undoCanvas();
  } else {
    document.getElementById('rotate-container').focus();
    document.execCommand('undo');
  }
};

window.clearAll = function () {
  if (!confirm('האם אתה בטוח? כל התוכן יימחק')) return;
  const editor = document.getElementById('rotate-container');
  if (editor) editor.innerHTML = '';
  const canvas = document.getElementById('draw-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  canvasHistory.length = 0;
  reflowPages();
};

// ── Initialize on DOM ready ──
window.onload = () => {
  checkSession();
  detectInstalledFonts();
  buildFontGrid();
  initCanvasEvents();
  initPrintEvents();
  initAuthListener();

  const editor = document.getElementById('rotate-container');
  const wrap = document.getElementById('output-wrap');

  if (editor) {
    editor.focus();
    editor.addEventListener('input', () => { syncToolbar(); reflowPages(); });
    editor.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
      setTimeout(reflowPages, 50);
    });
  }

  if (wrap) {
    wrap.addEventListener('scroll', () => updatePageIndicator());
  }

  // Ctrl+Z global undo
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && isDrawMode()) {
      e.preventDefault();
      undoCanvas();
    }
  });

  // Close table popup on outside click
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('table-popup');
    if (popup && popup.classList.contains('open') && !e.target.closest('.table-popup') && !e.target.closest('[onclick*="toggleTablePopup"]')) {
      popup.classList.remove('open');
    }
  });

  // Initial pagination
  reflowPages();

  // Reflow on window resize
  window.addEventListener('resize', () => reflowPages());

  // Screen preview: SVG filter handles all visual effects
  const outputEdit = document.getElementById('output-edit');
  if (outputEdit && HW.enabled) outputEdit.classList.add('hw-filter');
};
