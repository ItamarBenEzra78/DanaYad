"""Starts the static frontend (Netlify-equivalent) and the FastAPI backend on
free ports, and provides Playwright pages and helpers for both."""
import os
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "test-output", "after")


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait(url, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"server did not start: {url}")


@pytest.fixture(scope="session")
def static_url():
    port = _free_port()
    os.makedirs(OUT_DIR, exist_ok=True)
    log = open(os.path.join(OUT_DIR, "static-server.log"), "w")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", ROOT],
        stdout=log, stderr=log)
    url = f"http://127.0.0.1:{port}/"
    _wait(url)
    yield url
    proc.terminate()


@pytest.fixture(scope="session")
def backend_url():
    port = _free_port()
    env = dict(os.environ, PORT=str(port))
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app", "--port", str(port), "--host", "127.0.0.1"],
        cwd=os.path.join(ROOT, "backend"), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"
    _wait(url + "api/health")
    yield url
    proc.terminate()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture(scope="session")
def out_dir():
    os.makedirs(OUT_DIR, exist_ok=True)
    return OUT_DIR


class App:
    """A loaded DanaYad page."""

    def __init__(self, page):
        self.page = page
        self.requests = []
        self.errors = []
        page.on("request", lambda r: self.requests.append(r.url))
        page.on("pageerror", lambda e: self.errors.append(str(e)))
        page.on("dialog", lambda d: (self.errors.append("dialog: " + d.message), d.dismiss()))

    def clear(self):
        self.page.evaluate("document.getElementById('rotate-container').innerHTML = ''; window.DanaYad && 0")

    def paste(self, text):
        self.page.evaluate("""(t) => {
            const ed = document.getElementById('rotate-container');
            ed.focus();
            const sel = getSelection(), r = document.createRange();
            r.selectNodeContents(ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
            const dt = new DataTransfer();
            dt.setData('text/plain', t);
            ed.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
        }""", text)
        self.settle()

    def set_html(self, html):
        self.page.evaluate("(h) => { const ed = document.getElementById('rotate-container'); ed.innerHTML = h; ed.dispatchEvent(new Event('input')); }", html)
        self.settle()

    def settle(self):
        self.page.wait_for_timeout(250)
        self.page.evaluate("document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))")

    def html(self):
        return self.page.evaluate("document.getElementById('rotate-container').innerHTML")

    def breaks(self):
        return self.page.evaluate("window.DanaYad.computePageBreaks(document.getElementById('rotate-container'))")

    def export(self, path):
        with self.page.expect_download(timeout=180000) as dl:
            self.page.evaluate("exportToPdf()")
        dl.value.save_as(path)
        return path

    def screenshot_sheet(self, path):
        # The formatting bar overlaps the sheet's top edge on screen; capture the sheet alone.
        self.page.evaluate("document.getElementById('output-wrap').scrollTop = 0")
        return self.page.locator("#output-edit").screenshot(path=path)


@pytest.fixture
def make_app(browser):
    contexts = []

    def _make(url):
        ctx = browser.new_context(viewport={"width": 1400, "height": 1000}, device_scale_factor=2, accept_downloads=True)
        contexts.append(ctx)
        page = ctx.new_page()
        app = App(page)
        console = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("requestfailed", lambda r: console.append(f"requestfailed: {r.url} {r.failure}"))
        page.goto(url, wait_until="networkidle")
        try:
            page.wait_for_function("!!(window.DanaYad && window.updateHwParam)", timeout=15000)
        except Exception:
            # A dropped module request leaves the app unloaded; record why, then load once more.
            with open(os.path.join(OUT_DIR, "load-failures.log"), "a") as f:
                f.write(f"{url}\n" + "\n".join(console) + "\n---\n")
            page.reload(wait_until="networkidle")
            page.wait_for_function("!!(window.DanaYad && window.updateHwParam)", timeout=30000)
        app.settle()
        return app

    yield _make
    for c in contexts:
        c.close()
