"""Build the glyph-alternate subsets of Gveret Levin used by ScrambleEngine.

The font's ss01/ss02 glyphs are only reachable through OpenType features,
which a scrambled (one inline-block per letter) layout and html2canvas both
lose. Each subset maps the plain code points straight to one alternate set,
so CSS and canvas can select it with a font-family switch.

    python3 tools/make_alt_fonts.py      # writes fonts/GveretLevin-Alt1.ttf, -Alt2.ttf

Gveret Levin is SIL OFL 1.1 without a Reserved Font Name; the subsets stay OFL.
"""
import os
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "fonts", "GveretLevin-Regular.ttf")


def single_subst(font, tag):
    gsub = font["GSUB"].table
    mapping = {}
    for rec in gsub.FeatureList.FeatureRecord:
        if rec.FeatureTag != tag:
            continue
        for idx in rec.Feature.LookupListIndex:
            for st in gsub.LookupList.Lookup[idx].SubTable:
                st = getattr(st, "ExtSubTable", st)
                mapping.update(getattr(st, "mapping", {}))
    return mapping


def build(tag, family, out_name):
    font = TTFont(SRC)
    alt = single_subst(font, tag)
    cmap = font.getBestCmap()
    codepoints = [cp for cp, g in cmap.items() if g in alt]
    for table in font["cmap"].tables:
        for cp in codepoints:
            if table.cmap.get(cp) in alt:
                table.cmap[cp] = alt[table.cmap[cp]]

    opts = subset.Options()
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)

    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (4,):
            rec.string = f"{family} Regular"
        elif rec.nameID == 6:
            rec.string = family.replace(" ", "") + "-Regular"
    out = os.path.join(ROOT, "fonts", out_name)
    font.save(out)
    print(out, "".join(chr(c) for c in codepoints))


if __name__ == "__main__":
    build("ss01", "Gveret Levin Alt1", "GveretLevin-Alt1.ttf")
    build("ss02", "Gveret Levin Alt2", "GveretLevin-Alt2.ttf")
