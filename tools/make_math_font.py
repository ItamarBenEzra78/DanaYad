"""Build fonts/GveretLevin-Math.ttf: the comparison signs Gveret Levin lacks.

≤ ≥ ≠ are composed from the font's own strokes (< > = − /), so they match
the handwriting instead of falling back to a different typeface. The font
sits in the CSS stack right after Gveret Levin and only ever supplies these
code points.

    python3 tools/make_math_font.py

Gveret Levin is SIL OFL 1.1 without a Reserved Font Name; the derived font stays OFL.
"""
import os

from fontTools import subset
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "fonts", "GveretLevin-Regular.ttf")
OUT = os.path.join(ROOT, "fonts", "GveretLevin-Math.ttf")

# code point: (glyph name, [(source glyph, (xx, xy, yx, yy, dx, dy)), ...])
COMPOSED = {
    0x2264: ("lessequal", [("less", (1, 0, 0, 0.9, 0, 135)), ("minus", (0.92, 0.06, 0, 1, 20, -215))]),
    0x2265: ("greaterequal", [("greater", (1, 0, 0, 0.9, 0, 125)), ("minus", (0.92, -0.06, 0, 1, 20, -205))]),
    0x2260: ("notequal", [("equal", (1, 0, 0, 1, 0, 0)), ("slash", (1, 0, 0, 1, 60, 0))]),
}


def main():
    font = TTFont(SRC)
    glyphs = font.getGlyphSet()
    glyf, hmtx = font["glyf"], font["hmtx"]
    order = font.getGlyphOrder()
    for cp, (name, parts) in COMPOSED.items():
        pen = TTGlyphPen(None)
        for source, matrix in parts:
            glyphs[source].draw(TransformPen(pen, matrix))
        glyph = pen.glyph()
        order.append(name)
        font.setGlyphOrder(order)
        glyf[name] = glyph
        glyph.recalcBounds(glyf)
        hmtx[name] = (hmtx["equal"][0], glyph.xMin)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[cp] = name

    opts = subset.Options()
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=list(COMPOSED))
    sub.subset(font)
    family = "Gveret Levin Math"
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID == 4:
            rec.string = f"{family} Regular"
        elif rec.nameID == 6:
            rec.string = "GveretLevinMath-Regular"
    font.save(OUT)
    print(OUT, "".join(chr(c) for c in COMPOSED), os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
