export const canvasHistory = [];
const CANVAS_HISTORY_MAX = 20;

export let drawColor = '#1a1a1a';
export let eraserMode = false;

export function setDrawColor(c, el) {
  drawColor = c;
  eraserMode = false;
  document.querySelectorAll('.draw-color').forEach(s => s.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('btn-eraser').classList.remove('on');
}

export function toggleEraser() {
  eraserMode = !eraserMode;
  document.getElementById('btn-eraser').classList.toggle('on', eraserMode);
}

export function clearCanvas() {
  if (!confirm('למחוק את כל הציור?')) return;
  const canvas = document.getElementById('draw-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

export function saveCanvasState() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas || canvas.width === 0) return;
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  canvasHistory.push(data);
  if (canvasHistory.length > CANVAS_HISTORY_MAX) canvasHistory.shift();
}

export function undoCanvas() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas) return;
  if (canvasHistory.length > 0) {
    canvasHistory.pop();
    const ctx = canvas.getContext('2d');
    if (canvasHistory.length > 0) {
      ctx.putImageData(canvasHistory[canvasHistory.length - 1], 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}
