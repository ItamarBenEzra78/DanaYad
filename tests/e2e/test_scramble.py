"""Scramble (per-letter jitter): reading order, structure, niqqud, wrapping, alternates."""
import pytest

from samples import BIDI_LINES, HEBREW, MIXED, RICH_HTML

VISUAL_ORDER_JS = """() => {
  const ed = document.getElementById('rotate-container');
  const seg = new Intl.Segmenter('he', {granularity: 'grapheme'});
  return Array.from(ed.children).map(block => {
    const items = [];
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) {
      for (const s of seg.segment(t.data)) {
        if (!s.segment.trim()) continue;
        const r = document.createRange();
        r.setStart(t, s.index); r.setEnd(t, s.index + s.segment.length);
        const b = r.getBoundingClientRect();
        items.push([b.left + b.width / 2, s.segment]);
      }
    }
    return items.sort((a, b) => b[0] - a[0]).map(x => x[1]).join('');
  });
}"""


def _lines_html(lines):
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")
    return "".join(f"<div>{esc(l)}</div>" for l in lines)


def test_visual_order_matches_plain_text(make_app, static_url):
    app = make_app(static_url)
    app.set_html(_lines_html(BIDI_LINES))
    plain = app.page.evaluate(VISUAL_ORDER_JS)
    app.page.evaluate("scrambleText(3)")
    app.settle()
    scrambled = app.page.evaluate(VISUAL_ORDER_JS)
    for line, a, b in zip(BIDI_LINES, plain, scrambled):
        assert a == b, f"visual order changed for {line!r}: {a!r} -> {b!r}"


def test_ltr_runs_read_left_to_right(make_app, static_url):
    app = make_app(static_url)
    app.paste(MIXED)
    app.page.evaluate("scrambleText(11)")
    app.settle()
    bad = app.page.evaluate("""() => Array.from(document.querySelectorAll('.hw-ltr')).filter(run => {
        const xs = Array.from(run.querySelectorAll('.hw-c')).map(c => c.getBoundingClientRect());
        // within one visual line, each letter starts right of the previous one
        for (let i = 1; i < xs.length; i++)
          if (Math.abs(xs[i].top - xs[i-1].top) < 8 && xs[i].left < xs[i-1].left) return true;
        return false;
      }).map(r => r.textContent)""")
    assert bad == []
    texts = app.page.evaluate("Array.from(document.querySelectorAll('.hw-ltr')).map(r => r.textContent)")
    for token in ["120", "108%", "12.50", "Q3-2025", "15/03/2025", "054-1234567", "17:30", "report_v2.pdf"]:
        assert any(token in t for t in texts), token


def test_structure_survives_scramble_and_reset(make_app, static_url):
    app = make_app(static_url)
    app.set_html(RICH_HTML)
    before = app.html()
    count = "sel => document.querySelectorAll('#rotate-container ' + sel).length"
    shape = {sel: app.page.evaluate(count, sel) for sel in ["div", "b", "i", "a", "ol", "ul", "li", "table", "tr", "td"]}
    text_before = app.page.evaluate("document.getElementById('rotate-container').textContent")

    app.page.evaluate("scrambleText(1)")
    app.settle()
    assert app.page.evaluate("document.querySelectorAll('#rotate-container .hw-c').length") > 100
    for sel, n in shape.items():
        assert app.page.evaluate(count, sel) == n, f"{sel} count changed by scrambling"
    assert app.page.evaluate("document.getElementById('rotate-container').textContent") == text_before

    app.page.evaluate("scrambleText(2)")  # re-scramble replaces, does not nest
    app.settle()
    assert app.page.evaluate("document.querySelectorAll('.hw-c .hw-c').length") == 0

    app.page.evaluate("unscrambleText()")
    app.settle()
    assert app.html() == before


def test_reset_keeps_edits_made_after_scrambling(make_app, static_url):
    app = make_app(static_url)
    app.paste("שלום עולם")
    app.page.evaluate("scrambleText(1)")
    app.page.evaluate("""() => { const ed = document.getElementById('rotate-container');
        ed.appendChild(document.createTextNode(' תוספת')); }""")
    app.page.evaluate("unscrambleText()")
    assert app.page.evaluate("document.getElementById('rotate-container').textContent") == "שלום עולם תוספת"


def test_niqqud_stays_with_its_letter(make_app, static_url):
    app = make_app(static_url)
    app.paste("בַּבֹּקֶר הַשֶּׁמֶשׁ זָרְחָה")
    app.page.evaluate("scrambleText(4)")
    atoms = app.page.evaluate("Array.from(document.querySelectorAll('.hw-c')).map(c => c.textContent)")
    assert atoms[:3] == ["בַּ", "בֹּ", "קֶ"]
    assert not [a for a in atoms if a and "֑" <= a[0] <= "ׇ" and a[0] not in "־׀׃׆"]


def test_words_are_not_split_across_lines(make_app, static_url):
    app = make_app(static_url)
    app.paste((HEBREW + " ") * 3)
    app.page.evaluate("scrambleText(5)")
    app.settle()
    split = app.page.evaluate("""() => Array.from(document.querySelectorAll('.hw-w:not(.hw-w-long)')).filter(w => {
        const tops = Array.from(w.querySelectorAll('.hw-c')).map(c => c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2);
        return Math.max(...tops) - Math.min(...tops) > 12;
      }).map(w => w.textContent)""")
    assert split == []


def test_long_strings_stay_inside_the_page(make_app, static_url):
    app = make_app(static_url)
    app.paste("קישור ארוך: https://example.com/" + "a1b2c3d4e5" * 14 + " ומילה " + "א" * 120)
    app.page.evaluate("scrambleText(6)")
    app.settle()
    overflow = app.page.evaluate("""() => {
        const ed = document.getElementById('rotate-container').getBoundingClientRect();
        return Array.from(document.querySelectorAll('.hw-c')).filter(c => {
          const r = c.getBoundingClientRect(); return r.left < ed.left - 4 || r.right > ed.right + 4; }).length; }""")
    assert overflow == 0
    assert app.page.evaluate("document.querySelectorAll('.hw-w-long').length") == 2


def test_scramble_is_reproducible_per_seed(make_app, static_url):
    app = make_app(static_url)
    app.paste(HEBREW)
    app.page.evaluate("scrambleText(42)")
    first = app.html()
    app.page.evaluate("scrambleText(42)")
    assert app.html() == first
    app.page.evaluate("scrambleText(43)")
    assert app.html() != first


def test_contextual_alternates_follow_the_font_rules(make_app, static_url):
    app = make_app(static_url)
    app.paste("לל צף לץ נן ננ")
    app.page.evaluate("scrambleText(9)")
    atoms = app.page.evaluate("""Array.from(document.querySelectorAll('.hw-c')).map(c =>
        [c.textContent, c.classList.contains('hw-alt1') ? 1 : c.classList.contains('hw-alt2') ? 2 : 0])""")
    alt = dict(enumerate(atoms))
    assert alt[1] == ["ל", 1]          # ל after ל
    assert alt[3] == ["ף", 1]          # ף after צ
    assert alt[5] == ["ץ", 1]          # ץ after ל
    assert alt[6] == ["נ", 2]          # נ before ן
    # נ after נ is ss01, unless the first נ already is ss01 (then ss02), as in the font's calt
    assert alt[9] == ["נ", 2 if alt[8][1] == 1 else 1]


def test_alternate_glyphs_render_differently_in_css_and_canvas(make_app, static_url):
    app = make_app(static_url)
    diff = app.page.evaluate("""async () => {
        await document.fonts.load("40px 'GveretLevinAlt1'");
        await document.fonts.load("40px 'GveretLevin'");
        const draw = fam => { const c = document.createElement('canvas'); c.width = c.height = 60;
          const x = c.getContext('2d'); x.font = `40px ${fam}`; x.fillText('ל', 10, 45);
          return x.getImageData(0, 0, 60, 60).data; };
        const a = draw("'GveretLevin'"), b = draw("'GveretLevinAlt1', 'GveretLevin'");
        let d = 0; for (let i = 3; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) > 64;
        return d; }""")
    assert diff > 30, "alternate ל should differ visibly from the default glyph"


def test_alternates_only_with_gveret_levin(make_app, static_url):
    app = make_app(static_url)
    assert app.page.evaluate("document.getElementById('output-edit').classList.contains('glyph-alts')")
    app.page.locator(".font-card", has_text="Rubik").first.click()
    assert not app.page.evaluate("document.getElementById('output-edit').classList.contains('glyph-alts')")
    app.page.locator(".font-card", has_text="גברת לווין").first.click()
    assert app.page.evaluate("document.getElementById('output-edit').classList.contains('glyph-alts')")


def test_formulas_render_and_reset(make_app, static_url):
    app = make_app(static_url)
    app.set_html("<div>Q = I + P + P^2 = (I − P)^-1</div><div>sum_{j} W_j = frac{319}{16}, sqrt{x^2}</div><div>report_v2.pdf</div>")
    before = app.html()
    app.page.evaluate("scrambleText(3)")
    app.settle()
    n = lambda sel: app.page.evaluate("s => document.querySelectorAll('#rotate-container ' + s).length", sel)
    assert n(".hw-sup") == 3 and n(".hw-sub") == 1
    assert n(".hw-sum") == 1 and n(".hw-frac") == 1 and n(".hw-sqrt") == 1
    assert n("svg.hw-sym") == 2
    assert app.page.evaluate("document.querySelector('#rotate-container div:last-child').innerHTML").count("hw-sub") == 0, \
        "a file name outside a math block must stay plain"
    app.page.evaluate("unscrambleText()")
    app.settle()
    assert app.html() == before


LEFT_TO_RIGHT_JS = """(sel) => Array.from(document.querySelectorAll(sel)).map(el =>
    Array.from(el.querySelectorAll('.hw-c')).map(c => [c.getBoundingClientRect().left, c.textContent])
      .sort((a, b) => a[0] - b[0]).map(x => x[1]).join(''))"""


def test_math_line_reads_left_to_right(make_app, static_url):
    app = make_app(static_url)
    app.set_html("<div>Y_t = max{SS, Y_{t-1} − R_t + X_t}</div><div>80 ≤ k &lt; 200</div><div>1-2: C = frac{k + 40}{2}</div>")
    before = app.html()
    app.page.evaluate("scrambleText(5)")
    app.settle()
    lines = app.page.evaluate(LEFT_TO_RIGHT_JS, "#rotate-container .hw-math")
    assert lines[0] == "Yt=max{SS,Yt-1−Rt+Xt}"
    assert lines[1] == "80≤k<200"
    assert lines[2].startswith("1-2:C=")
    # ≤ comes from the handwriting math font, not a fallback face
    assert app.page.evaluate("document.fonts.check(\"16px 'GveretLevinMath'\", '≤')")
    app.page.evaluate("unscrambleText()")
    app.settle()
    assert app.html() == before


def test_variables_in_hebrew_keep_their_scripts(make_app, static_url):
    app = make_app(static_url)
    app.set_html("<div>הווקטור V_t הוא D_t מוזז L.T תקופות אחורה, ולפיו נקבע Q_t. הקובץ report_v2.pdf נשאר.</div>")
    app.page.evaluate("scrambleText(6)")
    app.settle()
    tokens = app.page.evaluate(LEFT_TO_RIGHT_JS, "#rotate-container .hw-var")
    assert tokens == ["Vt", "Dt", "Qt"], "each variable is its letter followed by its subscript"
    assert app.page.evaluate("document.querySelectorAll('#rotate-container .hw-sub').length") == 3


def test_grid_with_empty_cells_and_formula_labels(make_app, static_url):
    app = make_app(static_url)
    app.set_html("<div>t: 8, 9, 10</div><div>X_t: -, 400, -</div><div>V_t = Q_t: 200, 0, -</div><div>טקסט רגיל</div>")
    before = app.html()
    app.page.evaluate("scrambleText(7)")
    app.settle()
    n = lambda sel: app.page.evaluate("s => document.querySelectorAll('#rotate-container ' + s).length", sel)
    assert n("table.hw-grid") == 1 and n("table.hw-grid tr") == 3 and n("table.hw-grid td") == 9
    assert app.page.evaluate("Array.from(document.querySelectorAll('#rotate-container td')).filter(td => !td.textContent).length") == 3
    assert n("th .hw-sub") == 3
    label = app.page.evaluate(LEFT_TO_RIGHT_JS, "#rotate-container tr:last-child th")
    assert label == ["Vt=Qt"]
    app.page.evaluate("unscrambleText()")
    app.settle()
    assert app.html() == before


def test_no_line_break_inside_a_number_list(make_app, static_url):
    app = make_app(static_url)
    app.set_html("<div>מאילוצי ספק מזמינים פעם בשתי תקופות ולא בכל תקופה, כלומר בתקופות 8, 10, 12, 14, 16, 18, 20, 22, 24, 26 וכך הלאה, וכל הזמנה מכסה שתי תקופות.</div>")
    app.page.evaluate("scrambleText(8)")
    app.settle()
    bad = app.page.evaluate("""() => Array.from(document.querySelectorAll('br.hw-br'))
        .filter(br => br.nextElementSibling && /^[\\d(]/.test(br.nextElementSibling.textContent)).length""")
    assert bad == 0
