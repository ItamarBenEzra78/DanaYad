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


class RenderRequest(BaseModel):
    text: str
    font_size: float = 16
    seed: int = 42
    intensity: float = 1.0


class PdfRequest(BaseModel):
    app_url: str
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
            viewport={"width": PAGE_WIDTH, "height": PAGE_HEIGHT},
            device_scale_factor=2,
        )

        await page.goto(req.app_url, wait_until="networkidle")

        hw = req.hw_params
        inject_js = """(args) => {
            const { editorHtml, oeClass, oeStyle, edStyle, rootStyle, hw } = args;

            // Hide auth overlay
            const auth = document.getElementById('auth-overlay');
            if (auth) auth.style.display = 'none';

            // Apply CSS variables
            document.documentElement.style.cssText = rootStyle;

            // Set output-edit state
            const oe = document.getElementById('output-edit');
            oe.className = oeClass;
            oe.style.cssText = oeStyle + ';margin:0;box-shadow:none;';

            // Set editor content
            const editor = document.getElementById('rotate-container');
            editor.style.cssText = edStyle;
            editor.innerHTML = editorHtml;

            // Update SVG filter parameters
            const ids = [
                ['hw-wobble-scale', hw.drift],
                ['hw-jitter-scale', hw.jitter],
                ['hw-ink-scale', hw.tremor],
            ];
            ids.forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('scale', val);
            });

            // Clean up for export
            oe.querySelectorAll('.page-break-marker').forEach(m => m.remove());

            // Hide all UI except the editor
            ['header', '.sidebar', '.fmt-bar', '#draw-toolbar',
             '#page-indicator', '.pdf-overlay'].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) el.style.display = 'none';
            });
        }"""

        await page.evaluate(inject_js, {
            "editorHtml": req.editor_html,
            "oeClass": req.output_edit_class,
            "oeStyle": req.output_edit_style,
            "edStyle": req.editor_style,
            "rootStyle": req.root_style,
            "hw": hw,
        })

        await page.wait_for_timeout(1500)

        element = await page.query_selector("#output-edit")
        shot = await element.screenshot(type="png")
        await browser.close()

    full_img = Image.open(io.BytesIO(shot))
    img_w, img_h = full_img.size
    page_h_px = int(PAGE_HEIGHT * (img_w / PAGE_WIDTH))
    total_pages = max(1, math.ceil(img_h / page_h_px))

    pages = []
    for i in range(total_pages):
        y_start = i * page_h_px
        y_end = min(y_start + page_h_px, img_h)
        crop = full_img.crop((0, y_start, img_w, y_end))

        if crop.height < page_h_px:
            padded = Image.new("RGB", (img_w, page_h_px), "white")
            padded.paste(crop, (0, 0))
            crop = padded

        pages.append(crop.convert("RGB"))

    pdf_buf = io.BytesIO()
    pages[0].save(
        pdf_buf, "PDF", save_all=True, append_images=pages[1:], resolution=150,
    )

    return Response(
        content=pdf_buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=DanaYad_Document.pdf"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "font": FONT_PATH}
