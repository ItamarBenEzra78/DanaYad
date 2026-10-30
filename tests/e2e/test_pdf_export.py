"""Both PDF paths, end to end: browser (static site) and backend (Playwright).

For every scenario the exported PDF is checked for A4 geometry, one page per
pagination break, empty margins, cuts that do not pass through text, and,
for single-page documents, ink overlap with the on-screen preview (so a lost
handwriting filter, mirrored text or misplaced list markers fail the test).
Pages, previews and PDFs are kept in test-output/after/ as visual evidence.
"""
import os

import pytest
from PIL import Image

import pdfcheck as pc
from samples import HEBREW, MIXED, PASTED_LIST, RICH_HTML, long_document

PATHS = ["browser", "backend"]
MARGIN_SLACK = 16       # CSS px: the ink filter displaces up to 6.5px, scrambled glyphs overhang a little
MIN_PREVIEW_IOU = 0.6   # PDF vs screen ink overlap (best of +-2px); the pre-fix browser PDF scored 0.31
# html2canvas draws collapsed table borders about twice as thick as Chrome; text matches.
PREVIEW_IOU_OVERRIDE = {"rich_browser": 0.5, "rich_scrambled_browser": 0.5}


def _numbered_paste(app):
    app.paste(PASTED_LIST)
    app.page.evaluate("""() => { const ed = document.getElementById('rotate-container');
        const r = document.createRange(); r.setStartBefore(ed.children[0]); r.setEndAfter(ed.children[2]);
        getSelection().removeAllRanges(); getSelection().addRange(r); insertNumbered(); }""")


SCENARIOS = {
    "hebrew_niqqud": lambda app: app.paste(HEBREW),
    "mixed": lambda app: app.paste(MIXED),
    "rich": lambda app: app.set_html(RICH_HTML),
    "pasted_list": _numbered_paste,
    "mixed_scrambled": lambda app: (app.paste(MIXED), app.page.evaluate("scrambleText(7)")),
    "rich_scrambled": lambda app: (app.set_html(RICH_HTML), app.page.evaluate("scrambleText(8)")),
    "max_distortion": lambda app: (app.paste(HEBREW), app.page.evaluate("""() => {
        for (const [id, v] of [['hw-drift', 12], ['hw-jitter', 8], ['hw-tremor', 5]]) document.getElementById(id).value = v;
        updateHwParam(); }""")),
    "effects_off": lambda app: (app.paste(MIXED), app.page.evaluate("document.getElementById('hw-enabled').click()")),
    "long": lambda app: app.paste(long_document()),
    "long_scrambled": lambda app: (app.paste(long_document()), app.page.evaluate("scrambleText(12)")),
}


def _url(path, static_url, backend_url):
    return static_url if path == "browser" else backend_url


@pytest.mark.parametrize("scenario", list(SCENARIOS))
@pytest.mark.parametrize("path", PATHS)
def test_export(make_app, static_url, backend_url, out_dir, path, scenario):
    app = make_app(_url(path, static_url, backend_url))
    SCENARIOS[scenario](app)
    app.settle()
    breaks = app.breaks()
    name = f"{scenario}_{path}"
    preview = os.path.join(out_dir, f"{scenario}_screen.png")
    app.screenshot_sheet(preview)
    pdf_path = app.export(os.path.join(out_dir, name + ".pdf"))
    assert app.errors == []

    pages = pc.read(pdf_path)
    assert len(pages) == len(breaks), f"{len(pages)} pages for {len(breaks)} breaks"
    s = pc.SCALE
    for i, p in enumerate(pages):
        assert abs(p["size"][0] - pc.A4_PT[0]) < 0.01 and abs(p["size"][1] - pc.A4_PT[1]) < 0.01, p["size"]
        img = p["image"]
        assert p["image_count"] == 1 and img.size == (pc.PAGE_W * s, pc.PAGE_H * s), img.size
        img.save(os.path.join(out_dir, f"{name}_p{i + 1}.png"))
        ink = pc.ink_mask(img)
        assert pc.region_ink(ink, (0, 0, img.width, (pc.PAD_TOP - MARGIN_SLACK) * s)) == 0, "ink in top margin"
        bottom = (pc.PAGE_H - pc.PAD_BOTTOM + MARGIN_SLACK) * s
        assert pc.region_ink(ink, (0, bottom, img.width, img.height)) == 0, "ink in bottom margin"
        assert pc.region_ink(ink, (0, 0, (pc.PAD_SIDE - MARGIN_SLACK) * s, img.height)) == 0, "ink in left margin"
        right = (pc.PAGE_W - pc.PAD_SIDE + MARGIN_SLACK) * s
        assert pc.region_ink(ink, (right, 0, img.width, img.height)) == 0, "ink in right margin"
        assert pc.region_ink(ink, (0, 0, img.width, img.height)) > 500, "page has no text"

    # Stitch neighbouring pages back together: no letter may be split between them.
    nominal = [round((b + pc.PAD_TOP) * s) for b in breaks]
    win_top = [0] + [n - pc.PAD_TOP * s for n in nominal[1:]]
    for i in range(1, len(pages)):
        split = pc.split_shapes(pages[i - 1]["image"], win_top[i - 1], pages[i]["image"], win_top[i], nominal[i])
        assert split == [], f"letters split between pages {i} and {i + 1}: {split[:5]}"

    if len(pages) == 1:
        screen = Image.open(preview).convert("RGB")
        top = 100  # the formatting bar overlaps the sheet's top edge in the preview
        iou = pc.best_offset_iou(screen.crop((0, top, screen.width, pc.PAGE_H * s)),
                         pages[0]["image"].crop((0, top, screen.width, pc.PAGE_H * s)))
        with open(os.path.join(out_dir, "iou.txt"), "a") as f:
            f.write(f"{name}\t{iou:.3f}\n")
        assert iou >= PREVIEW_IOU_OVERRIDE.get(name, MIN_PREVIEW_IOU), f"PDF differs from the preview (ink IoU {iou:.2f})"
