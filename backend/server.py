"""
DanaYad Handwriting Backend — FastAPI server
Renders text as SVG with per-character glyph variation.
Generates pixel-perfect PDFs via headless browser screenshot.
"""
import io
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
    html: str


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
        await page.set_content(req.html, wait_until="networkidle")
        await page.wait_for_timeout(500)

        full_height = await page.evaluate("document.body.scrollHeight")
        total_pages = max(1, math.ceil(full_height / PAGE_HEIGHT))

        shot = await page.screenshot(
            full_page=True,
            type="png",
        )
        await browser.close()

    full_img = Image.open(io.BytesIO(shot))
    img_w, img_h = full_img.size
    page_h_px = img_h / max(total_pages, 1)
    page_h_px = int(PAGE_HEIGHT * (img_w / PAGE_WIDTH))

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
    pages[0].save(pdf_buf, "PDF", save_all=True, append_images=pages[1:], resolution=150)
    pdf_bytes = pdf_buf.getvalue()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=DanaYad_Document.pdf"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "font": FONT_PATH}
