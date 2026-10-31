"""
DanaYad Handwriting Backend — FastAPI server
Renders text as SVG with per-character glyph variation.
Generates PDFs by screenshotting the live app via Playwright (so Chrome
renders the real SVG ink filter) and composing pages with the same code as
the browser export (window.DanaYad in js/app.js).
"""
import base64
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from playwright.async_api import async_playwright

from glyph_engine import HandwritingRenderer

app = FastAPI(title="DanaYad Handwriting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.environ.get("FONT_PATH", os.path.join(BACKEND_DIR, "fonts", "Rubik.ttf"))
renderer = HandwritingRenderer(FONT_PATH)

PAGE_HEIGHT = 1123
CAPTURE_SCALE = 2
BACKEND_TIMING = "danayad-backend"  # js/export/PdfExporter.js looks for it
SERVER_PORT = int(os.environ.get("PORT", 8000))
FRONTEND_DIR = os.path.join(BACKEND_DIR, "..")


@app.middleware("http")
async def advertise_backend(request, call_next):
    """Lets the frontend detect this server from its own page load, without a probe request."""
    response = await call_next(request)
    response.headers["Server-Timing"] = BACKEND_TIMING
    return response


class RenderRequest(BaseModel):
    text: str
    font_size: float = 16
    seed: int = 42
    intensity: float = 1.0


class PdfRequest(BaseModel):
    editor_html: str
    output_edit_class: str
    output_edit_style: str
    editor_style: str
    root_style: str
    hw_params: dict
    ink_layer: bool = True


@app.post("/api/render")
def render_handwriting(req: RenderRequest):
    svg = renderer.render_text(
        text=req.text,
        font_size=req.font_size,
        seed=req.seed,
        intensity=req.intensity,
    )
    return Response(content=svg, media_type="image/svg+xml")


@app.post("/api/pdf")
async def generate_pdf(req: PdfRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": 1200, "height": PAGE_HEIGHT},
            device_scale_factor=CAPTURE_SCALE,
        )

        local_url = f"http://127.0.0.1:{SERVER_PORT}/"
        await page.goto(local_url, wait_until="networkidle")

        hw = req.hw_params
        inject_js = """(args) => {
            const { editorHtml, oeClass, oeStyle, edStyle, rootStyle, hw } = args;

            document.documentElement.style.cssText = rootStyle;

            const oe = document.getElementById('output-edit');
            const editor = document.getElementById('rotate-container');
            const svg = document.querySelector('svg');

            oe.className = oeClass;
            oe.style.cssText = oeStyle;
            editor.style.cssText = edStyle;
            editor.innerHTML = editorHtml;

            // Update SVG filter parameters
            [['hw-wobble-scale', hw.drift],
             ['hw-jitter-scale', hw.jitter],
             ['hw-ink-scale', hw.tremor]].forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('scale', val);
            });

            // Keep only the SVG filter and the sheet on the page.
            document.body.replaceChildren();
            document.body.style.cssText = 'margin:0;padding:0;background:#fff;';
            if (svg) document.body.appendChild(svg);
            document.body.appendChild(oe);
        }"""

        await page.evaluate(inject_js, {
            "editorHtml": req.editor_html,
            "oeClass": req.output_edit_class,
            "oeStyle": req.output_edit_style,
            "edStyle": req.editor_style,
            "rootStyle": req.root_style,
            "hw": hw,
        })

        # Same print geometry and page breaks as the browser export.
        breaks = await page.evaluate("""async () => {
            await document.fonts.ready;
            return DanaYad.prepareSheet(document.getElementById('output-edit'));
        }""")
        line_height = await page.evaluate(
            "parseFloat(getComputedStyle(document.getElementById('rotate-container')).lineHeight) || 24")
        await page.wait_for_timeout(500)

        sheet = page.locator("#output-edit")
        # Text alone on a transparent background (the SVG filter is already rendered), then the paper alone.
        await page.evaluate("""() => {
            document.body.style.background = 'transparent';
            DanaYad.hideSheetPaper(document.getElementById('output-edit'));
        }""")
        content = await sheet.screenshot(type="png", omit_background=True)
        await page.evaluate("""() => {
            const oe = document.getElementById('output-edit');
            oe.style.removeProperty('background');
            document.body.style.background = '#fff';
            DanaYad.hideSheetText(oe);
        }""")
        background = await sheet.screenshot(type="png")

        def data_url(png):
            return "data:image/png;base64," + base64.b64encode(png).decode("ascii")

        pdf_b64 = await page.evaluate("(args) => DanaYad.pdfFromScreenshots(args)", {
            "content": data_url(content),
            "background": data_url(background),
            "breaks": breaks,
            "lineHeight": line_height,
            "scale": CAPTURE_SCALE,
            "ink": req.ink_layer and "hw-filter" in req.output_edit_class.split(),
        })
        await browser.close()

    return Response(
        content=base64.b64decode(pdf_b64),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=DanaYad_Document.pdf"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "font": os.path.basename(FONT_PATH)}


# Serve the frontend — must be LAST (catch-all)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
