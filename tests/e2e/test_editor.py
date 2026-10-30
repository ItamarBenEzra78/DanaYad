"""Paste normalisation, pagination and backend detection."""
from samples import PASTED_LIST, long_document

LINES_THROUGH_BREAK_JS = """(breaks) => {
  // A break must not pass through the middle half of any text line.
  const ed = document.getElementById('rotate-container');
  const origin = ed.getBoundingClientRect().top;
  const bad = [];
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  for (let t; (t = w.nextNode());) {
    r.selectNodeContents(t);
    for (const b of r.getClientRects()) {
      const top = b.top - origin, bot = b.bottom - origin, q = b.height / 4;
      for (const y of breaks.slice(1)) if (y > top + q && y < bot - q) bad.push([y, top, bot]);
    }
  }
  return bad;
}"""


def test_pasted_lines_become_paragraphs_and_list_items(make_app, static_url):
    app = make_app(static_url)
    app.paste(PASTED_LIST)
    blocks = app.page.evaluate("Array.from(document.querySelectorAll('#rotate-container > div')).map(d => d.textContent)")
    assert blocks == ["לקנות חלב", "להתקשר לרופא", "לשלוח דוח", "", "אחרי שורה ריקה"]
    assert "\r" not in app.html()
    app.page.evaluate("""() => { const ed = document.getElementById('rotate-container');
        const r = document.createRange(); r.setStartBefore(ed.children[0]); r.setEndAfter(ed.children[2]);
        getSelection().removeAllRanges(); getSelection().addRange(r); insertNumbered(); }""")
    items = app.page.evaluate("Array.from(document.querySelectorAll('#rotate-container ol > li')).map(l => l.textContent)")
    assert items == ["לקנות חלב", "להתקשר לרופא", "לשלוח דוח"]


def test_single_line_paste_stays_inline(make_app, static_url):
    app = make_app(static_url)
    app.paste("שלום")
    app.paste(" עולם")
    assert app.html() == "שלום עולם"


def test_breaks_fall_between_lines_in_long_paragraphs(make_app, static_url):
    app = make_app(static_url)
    app.paste(long_document())
    breaks = app.breaks()
    assert len(breaks) >= 5
    assert app.page.evaluate(LINES_THROUGH_BREAK_JS, breaks) == []
    gaps = [b - a for a, b in zip(breaks, breaks[1:])]
    assert all(800 < g <= 983 for g in gaps), gaps   # full pages, never over the content height


def test_breaks_with_scramble_and_line_drift(make_app, static_url):
    app = make_app(static_url)
    app.paste(long_document(12))
    plain = app.breaks()
    app.page.evaluate("updateLineDrift(3)")
    assert app.breaks() == plain, "Line Drift rotation must not change the pagination"
    app.page.evaluate("updateLineDrift(0); scrambleText(2)")
    app.settle()
    scrambled = app.breaks()
    assert len(scrambled) >= 3
    assert app.page.evaluate(LINES_THROUGH_BREAK_JS, scrambled) == []


def test_static_site_makes_no_backend_probe(make_app, static_url, tmp_path):
    app = make_app(static_url)
    app.paste("בדיקה")
    app.export(str(tmp_path / "x.pdf"))
    assert not [u for u in app.requests if "/api/" in u]


def test_backend_is_detected_without_probe(make_app, backend_url, tmp_path):
    app = make_app(backend_url)
    app.paste("בדיקה")
    app.export(str(tmp_path / "x.pdf"))
    api = [u.split("/api/")[1] for u in app.requests if "/api/" in u]
    assert api == ["pdf"]
