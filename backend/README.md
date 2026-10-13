# DanaYad backend (optional)

FastAPI service for high-fidelity PDF rendering. The frontend works without it.

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && playwright install chromium
uvicorn server:app --port 8000        # also serves the frontend at http://localhost:8000
```

- `GET  /api/health` — `{"status":"ok"}`; the frontend uses the backend only when this returns JSON.
- `POST /api/pdf` — receives the editor state, opens the app in headless Chromium (so the SVG ink filter is rendered), screenshots the sheet and returns an A4 PDF.
- `POST /api/render` — experimental: renders plain text to SVG with per-glyph variation from `fonts/Rubik.ttf` (not used by the UI).
