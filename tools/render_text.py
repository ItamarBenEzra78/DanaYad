"""Render a plain-text file through the app into a handwritten PDF.

    python3 tools/render_text.py docs/solution.txt out.pdf [--seed 2026] [--pages-dir DIR]

Starts a local static server, loads the editor in headless Chromium, puts
each line of the text in its own paragraph, turns on scramble (per-letter
variants, writing layout, formulas) and runs the app's own PDF export.
Conventions applied to the text, like a pen-colour habit: a line starting
with "שאלה N" / "תרגיל" is written in blue, and "סעיף N" or a section letter ("א.") in red.

Needs: pip install playwright pypdf Pillow && playwright install chromium
"""
import argparse
import html
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLUE, RED = "#1D4ED8", "#B91C1C"
RE_HEADING = re.compile(r"^(שאלה \d|תרגיל)")
RE_SECTION = re.compile(r"^[א-ת]\. ")
RE_SUBHEADING = re.compile(r"^סעיף \d")


def text_to_html(text):
    out = []
    for line in text.split("\n"):
        if not line.strip():
            out.append("<div><br></div>")
            continue
        e = html.escape(line, quote=False)
        if RE_HEADING.match(line):
            e = f'<span style="color:{BLUE}">{e}</span>'
        elif RE_SUBHEADING.match(line):
            e = f'<span style="color:{RED}">{e}</span>'
        elif RE_SECTION.match(line):
            e = f'<span style="color:{RED}">{e[:2]}</span>{e[2:]}'
        out.append(f"<div>{e}</div>")
    return "".join(out)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("text")
    ap.add_argument("pdf")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--pages-dir", help="also save every page as PNG here")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "tests", "e2e", "static_server.py"), str(port), ROOT],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(url, timeout=2)
                break
            except Exception:
                time.sleep(0.2)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1400, "height": 1000}, device_scale_factor=2, accept_downloads=True)
            ctx.route("**/*google-analytics.com/**", lambda r: r.abort())
            ctx.route("**/*googletagmanager.com/**", lambda r: r.abort())
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("!!window.DanaYad")
            page.evaluate("(h) => { const ed = document.getElementById('rotate-container'); ed.innerHTML = h; ed.dispatchEvent(new Event('input')); }",
                          text_to_html(open(args.text, encoding="utf-8").read()))
            page.wait_for_timeout(400)
            page.evaluate("(seed) => scrambleText(seed)", args.seed)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(900)
            stats = page.evaluate("""() => ({
                pages: DanaYad.computePageBreaks(document.getElementById('rotate-container')).length,
                grids: document.querySelectorAll('table.hw-grid').length,
                fractions: document.querySelectorAll('.hw-frac').length,
                overflow: Array.from(document.querySelectorAll('#rotate-container table')).filter(t =>
                    t.getBoundingClientRect().width > document.getElementById('rotate-container').clientWidth + 1).length })""")
            with page.expect_download(timeout=600000) as dl:
                page.evaluate("exportToPdf()")
            dl.value.save_as(args.pdf)
            browser.close()
        print("exported", args.pdf, stats, "errors:", errors)
        if args.pages_dir:
            import io
            from pypdf import PdfReader
            from PIL import Image
            os.makedirs(args.pages_dir, exist_ok=True)
            for i, pg in enumerate(PdfReader(args.pdf).pages, 1):
                # jsPDF shares one XObject dictionary between pages: take the image this page draws
                name = re.search(rb"/([^\s/]+)\s+Do", pg.get_contents().get_data()).group(1).decode()
                data = pg["/Resources"]["/XObject"]["/" + name].get_object().get_data()
                Image.open(io.BytesIO(data)).save(os.path.join(args.pages_dir, f"page{i}.png"))
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
