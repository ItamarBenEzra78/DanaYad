import { drawColor, saveCanvasState, getCanvasPos } from './DrawingTools.js';

let rulerMode = false;
let rulerStartX = 0, rulerStartY = 0;
let _rulerSnapshot = null;

export function isRulerMode() { return rulerMode; }

export function toggleRuler() {
  rulerMode = !rulerMode;
  const btn = document.getElementById('btn-ruler');
  const btnEraser = document.getElementById('btn-eraser');
  btn.classList.toggle('ruler-active', rulerMode);
  if (rulerMode) btnEraser.classList.remove('on');
}

export function startRuler(e) {
  const canvas = document.getElementById('draw-canvas');
  const pos = getCanvasPos(e, canvas);
  rulerStartX = pos.x;
  rulerStartY = pos.y;
  _rulerSnapshot = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
}

export function drawRulerPreview(e) {
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const pos = getCanvasPos(e, canvas);

  if (_rulerSnapshot) ctx.putImageData(_rulerSnapshot, 0, 0);

  let endX = pos.x, endY = pos.y;

  if (e.shiftKey) {
    const dx = endX - rulerStartX, dy = endY - rulerStartY;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.sqrt(dx * dx + dy * dy);
    endX = rulerStartX + Math.cos(snapped) * len;
    endY = rulerStartY + Math.sin(snapped) * len;
  }

  ctx.beginPath();
  ctx.moveTo(rulerStartX, rulerStartY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = drawColor;
  ctx.lineWidth = parseFloat(document.getElementById('draw-size').value);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.88;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function endRuler() {
  _rulerSnapshot = null;
  saveCanvasState();
}
