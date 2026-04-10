import { drawColor, eraserMode, saveCanvasState } from './DrawingTools.js';
import { isRulerMode, startRuler, drawRulerPreview, endRuler } from './RulerTool.js';

let drawMode = false;
let isDrawing = false;
let lastX = 0, lastY = 0;

export function isDrawMode() { return drawMode; }

export function toggleDrawMode() {
  drawMode = !drawMode;
  const canvas = document.getElementById('draw-canvas');
  const toolbar = document.getElementById('draw-toolbar');
  const btn = document.getElementById('btn-draw-mode');
  canvas.classList.toggle('active', drawMode);
  toolbar.style.display = drawMode ? 'flex' : 'none';
  btn.classList.toggle('on', drawMode);
  if (drawMode) {
    resizeCanvas();
    btn.style.background = 'var(--accent-bg)';
    btn.style.borderColor = 'var(--accent)';
  } else {
    btn.style.background = '';
    btn.style.borderColor = '';
  }
}

export function resizeCanvas() {
  const canvas = document.getElementById('draw-canvas');
  const wrap = document.getElementById('output-wrap');
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').drawImage(canvas, 0, 0);
  canvas.width = wrap.offsetWidth;
  canvas.height = wrap.offsetHeight;
  canvas.getContext('2d').drawImage(tmp, 0, 0);
}

function getPos(e, canvas) {
  const r = canvas.getBoundingClientRect();
  if (e.touches) {
    return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
  }
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function startDraw(e) {
  if (!drawMode) return;
  e.preventDefault();
  if (isRulerMode()) { startRuler(e); isDrawing = true; return; }
  isDrawing = true;
  const canvas = document.getElementById('draw-canvas');
  const pos = getPos(e, canvas);
  lastX = pos.x; lastY = pos.y;
}

function draw(e) {
  if (!drawMode || !isDrawing) return;
  e.preventDefault();
  if (isRulerMode()) { drawRulerPreview(e); return; }
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const pos = getPos(e, canvas);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.strokeStyle = eraserMode ? 'rgba(255,255,255,1)' : drawColor;
  ctx.lineWidth = eraserMode
    ? parseFloat(document.getElementById('draw-size').value) * 4
    : parseFloat(document.getElementById('draw-size').value);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (eraserMode) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.88;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  lastX = pos.x; lastY = pos.y;
}

function endDraw(e) {
  if (isRulerMode() && isDrawing) { endRuler(e); isDrawing = false; return; }
  if (isDrawing) saveCanvasState();
  isDrawing = false;
}

export function initCanvasEvents() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas) return;
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
  window.addEventListener('resize', () => { if (drawMode) resizeCanvas(); });
}
