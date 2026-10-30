# DanaYad backend (optional)

FastAPI service for high-fidelity PDF rendering. The frontend works without it.

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && playwright install chromium
uvicorn server:app --port 8000        # also serves the frontend at http://localhost:8000
```

- Every response carries `Server-Timing: danayad-backend`; a page served by this server reads it from its own navigation entry and exports through `/api/pdf` (a static host is never probed).
- `GET  /api/health` — `{"status":"ok"}`; used only when `API_URL` in `js/config.js` points at a separate backend.
- `POST /api/pdf` — receives the editor state, opens the app in headless Chromium (so the SVG ink filter is rendered), screenshots the sheet with and without its text, and composes the A4 PDF in the page with the same pagination and page composer as the browser export (`window.DanaYad`).
- `POST /api/render` — experimental: renders plain text to SVG with per-glyph variation from `fonts/Rubik.ttf` (not used by the UI).
