"""
DanaYad Handwriting Backend — FastAPI server
Renders text as SVG with per-character glyph variation.
Generates pixel-perfect PDFs by screenshotting the live app via Playwright.
"""
import io
import json
import math
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image
from playwright.async_api import async_playwright

from glyph_engine import HandwritingRenderer

app = FastAPI(title="DanaYad Handwriting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FONT_PATH = os.environ.get("FONT_PATH", "Rubik.ttf")
renderer = HandwritingRenderer(FONT_PATH)

PAGE_WIDTH = 794
PAGE_HEIGHT = 1123
SERVER_PORT = int(os.environ.get("PORT", 8000))
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


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
            device_scale_factor=2,
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

            // Set content before detaching
            oe.className = oeClass;
            editor.style.cssText = edStyle;
            editor.innerHTML = editorHtml;

            // Update SVG filter parameters
            [['hw-wobble-scale', hw.drift],
             ['hw-jitter-scale', hw.jitter],
             ['hw-ink-scale', hw.tremor]].forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('scale', val);
            });

            // Remove markers
            oe.querySelectorAll('.page-break-marker').forEach(m => m.remove());

            // Detach output-edit from all parent containers —
            // rebuild body with just SVG filter + output-edit
            document.body.replaceChildren();
            document.body.style.cssText = 'margin:0;padding:0;background:#fff;';
            if (svg) document.body.appendChild(svg);
            document.body.appendChild(oe);

            // Exact A4 at 96dpi: 794×1123, padding acts as page margins
            oe.style.cssText = [
                oeStyle,
                'margin:0',
                'box-shadow:none',
                'box-sizing:border-box',
                'width:794px',
                'min-height:1123px',
            ].join(';');

            return { w: oe.offsetWidth, h: oe.scrollHeight };
        }"""

        dims = await page.evaluate(inject_js, {
            "editorHtml": req.editor_html,
            "oeClass": req.output_edit_class,
            "oeStyle": req.output_edit_style,
            "edStyle": req.editor_style,
            "rootStyle": req.root_style,
            "hw": hw,
        })

        print(f"[PDF] element dims: {dims['w']}x{dims['h']}px")
        await page.wait_for_timeout(1500)

        element = await page.query_selector("#output-edit")
        shot = await element.screenshot(type="png")
        await browser.close()

    scale = 2  # must match device_scale_factor
    full_img = Image.open(io.BytesIO(shot))
    img_w, img_h = full_img.size
    page_h_px = PAGE_HEIGHT * scale
    total_pages = max(1, math.ceil(img_h / page_h_px))

    target_w = PAGE_WIDTH * scale
    target_h = PAGE_HEIGHT * scale

    pages = []
    for i in range(total_pages):
        y_start = i * page_h_px
        y_end = min(y_start + page_h_px, img_h)
        crop = full_img.crop((0, y_start, img_w, y_end))

        page_img = Image.new("RGB", (target_w, target_h), "white")
        resized = crop.resize((target_w, int(crop.height * target_w / crop.width)), Image.LANCZOS)
        page_img.paste(resized, (0, 0))

        pages.append(page_img)

    pdf_buf = io.BytesIO()
    a4_width_inches = 210 / 25.4
    dpi = round(target_w / a4_width_inches)
    pages[0].save(
        pdf_buf, "PDF", save_all=True, append_images=pages[1:], resolution=dpi,
    )

    return Response(
        content=pdf_buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=DanaYad_Document.pdf"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "font": FONT_PATH}


# Serve the frontend — must be LAST (catch-all)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
