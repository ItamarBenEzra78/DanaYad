"""The canvas port of the #ink-tremor filter against Chrome's own SVG filter."""
import io

from PIL import Image

SVG = """<body style="margin:0"><svg width="300" height="200" style="display:block">
<filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="{type}" baseFrequency="{freq}" numOctaves="{octaves}" seed="{seed}"/>
<feComponentTransfer><feFuncA type="discrete" tableValues="1 1"/></feComponentTransfer></filter>
<rect width="300" height="200" filter="url(#f)"/></svg></body>"""

CASES = [  # the three layers of index.html #ink-tremor, and a single octave
    ("fractalNoise", "0.02", 1, 8, 0.012),
    ("turbulence", "0.006 0.003", 2, 1, 0.03),
    ("turbulence", "0.035 0.025", 3, 5, 0.03),
    ("fractalNoise", "0.09", 4, 8, 0.04),
]


def test_turbulence_matches_chrome(browser, static_url):
    page = browser.new_page(viewport={"width": 400, "height": 300})
    page.goto(static_url + "js/config.js")
    for typ, freq, octaves, seed, tolerance in CASES:
        page.set_content(SVG.format(type=typ, freq=freq, octaves=octaves, seed=seed))
        shot = Image.open(io.BytesIO(page.screenshot(clip={"x": 0, "y": 0, "width": 300, "height": 200}))).convert("RGB")
        values = page.evaluate("""async ([url, typ, freq, octaves, seed]) => {
            const m = await import(url + 'js/handwriting/InkDisplacement.js');
            const [fx, fy = fx] = freq.split(' ').map(Number);
            const t = new m.Turbulence({fx, fy, octaves, seed, fractal: typ === 'fractalNoise'});
            const out = [];
            for (let y = 0; y < 200; y += 7) for (let x = 0; x < 300; x += 7)
              out.push([x, y, t.value(0, x + 0.5, y + 0.5), t.value(1, x + 0.5, y + 0.5)]);
            return out; }""", [static_url, typ, freq, octaves, seed])
        err = [abs(shot.getpixel((x, y))[0] / 255 - r) + abs(shot.getpixel((x, y))[1] / 255 - g) for x, y, r, g in values]
        mean = sum(err) / len(err) / 2
        assert mean < tolerance, f"{typ} {freq} x{octaves}: mean error {mean:.4f}"
    page.close()
