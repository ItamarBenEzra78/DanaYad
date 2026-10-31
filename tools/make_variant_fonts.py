"""Build per-letter shape variants of Gveret Levin: fonts/GveretLevin-Var<N>.ttf.

A font has one outline per letter, so every repeated letter is identical,
which is the first thing that gives a "handwriting" font away. Each variant
font here carries the same letters with their outlines deformed: a smooth
random warp of the control points (a different "hand tremor" per variant),
a slight shear and stretch, and a small shift in stroke weight. The
displacement field is smooth in space, so strokes bend instead of
rippling; corners and curves keep their character.

ScrambleEngine picks a variant per letter by seed, so the same letter
gets a different shape at every occurrence.

    python3 tools/make_variant_fonts.py          # writes Var1..Var<COUNT>

Gveret Levin is SIL OFL 1.1 without a Reserved Font Name; the derived
fonts stay OFL.
"""
import math
import os
import random

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._g_l_y_f import Glyph

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "fonts", "GveretLevin-Regular.ttf")
COUNT = 12

# Deformation strengths, in font units (1000 per em; a letter is ~600 wide).
WARP_AMPLITUDE = 40      # max control-point displacement from the smooth field
WARP_WAVELENGTH = 320    # field feature size: larger than a stroke, smaller than a letter
SHEAR_MAX = 0.10         # tan of the slant jitter
STRETCH_MAX = 0.08       # relative width / height jitter
WEIGHT_UNITS = 0          # stroke weight jitter, ± units (via normal-direction push)


class SmoothField:
    """A smooth 2-D displacement field: a sum of a few random sine waves."""

    def __init__(self, rng, amplitude, wavelength, waves=5):
        self.waves = []
        for _ in range(waves):
            angle = rng.uniform(0, math.pi)
            k = 2 * math.pi / rng.uniform(wavelength * 0.7, wavelength * 1.4)
            self.waves.append((math.cos(angle) * k, math.sin(angle) * k, rng.uniform(0, 2 * math.pi),
                               rng.uniform(0.5, 1.0) * amplitude / math.sqrt(waves)))

    def __call__(self, x, y):
        return sum(a * math.sin(kx * x + ky * y + ph) for kx, ky, ph, a in self.waves)


def warp_contours(contours, rng, phase):
    """contours: list of lists of (x, y, on_curve). Returns deformed copies."""
    fx = SmoothField(rng, WARP_AMPLITUDE, WARP_WAVELENGTH)
    fy = SmoothField(rng, WARP_AMPLITUDE, WARP_WAVELENGTH)
    shear = rng.uniform(-SHEAR_MAX, SHEAR_MAX)
    sx = 1 + rng.uniform(-STRETCH_MAX, STRETCH_MAX)
    sy = 1 + rng.uniform(-STRETCH_MAX, STRETCH_MAX)
    weight = rng.uniform(-WEIGHT_UNITS, WEIGHT_UNITS)
    out = []
    for pts in contours:
        n = len(pts)
        new = []
        for i, (x, y, on) in enumerate(pts):
            # outward normal from neighbours, for the weight push
            px, py, _ = pts[i - 1]
            nx_, ny_, _ = pts[(i + 1) % n]
            tx, ty = nx_ - px, ny_ - py
            tl = math.hypot(tx, ty) or 1
            nxv, nyv = ty / tl, -tx / tl
            wx, wy = x + fx(x + phase, y), y + fy(x, y + phase)
            if weight:
                wx, wy = wx + nxv * weight, wy + nyv * weight
            wx, wy = wx * sx + wy * shear, wy * sy
            new.append((round(wx), round(wy), on))
        out.append(new)
    return out


def glyph_contours(glyph, glyf):
    coords, ends, flags = glyph.getCoordinates(glyf)
    contours, start = [], 0
    for end in ends:
        contours.append([(x, y, bool(f & 1)) for (x, y), f in zip(coords[start:end + 1], flags[start:end + 1])])
        start = end + 1
    return contours


def build_glyph(contours):
    pen = TTGlyphPen(None)
    for pts in contours:
        # TTGlyphPen wants on-curve starts; rotate so the first point is on-curve
        k = next((i for i, p in enumerate(pts) if p[2]), None)
        if k is None:
            pen.qCurveTo(*[(x, y) for x, y, _ in pts], None)
            pen.closePath()
            continue
        pts = pts[k:] + pts[:k]
        pen.moveTo(pts[0][:2])
        off = []
        for x, y, on in pts[1:]:
            if on:
                if off:
                    pen.qCurveTo(*off, (x, y))
                    off = []
                else:
                    pen.lineTo((x, y))
            else:
                off.append((x, y))
        if off:
            pen.qCurveTo(*off, pts[0][:2])
        pen.closePath()
    return pen.glyph()


def build(index):
    rng = random.Random(1000 + index)
    font = TTFont(SRC)
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    cmap = font.getBestCmap()
    targets = {g for cp, g in cmap.items() if 0x5D0 <= cp <= 0x5F4 or chr(cp).isalnum() or cp == 0x20AA}
    for name in targets:
        g = glyf[name]
        if g.isComposite() or g.numberOfContours <= 0:
            continue
        contours = warp_contours(glyph_contours(g, glyf), rng, phase=index * 137)
        new = build_glyph(contours)
        new.recalcBounds(glyf)
        glyf[name] = new
        adv, lsb = hmtx[name]
        hmtx[name] = (adv, new.xMin)
    # Hinting instructions no longer match the outlines; drop them.
    from fontTools.ttLib.tables import ttProgram
    for name in glyf.keys():
        g = glyf[name]
        if hasattr(g, "program"):
            g.program = ttProgram.Program()
            g.program.fromBytecode(b"")
    for t in ("fpgm", "prep", "cvt "):
        if t in font:
            del font[t]
    family = f"Gveret Levin Var{index}"
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID == 4:
            rec.string = f"{family} Regular"
        elif rec.nameID == 6:
            rec.string = family.replace(" ", "") + "-Regular"
    out = os.path.join(ROOT, "fonts", f"GveretLevin-Var{index}.ttf")
    font.save(out)
    return out


if __name__ == "__main__":
    for i in range(1, COUNT + 1):
        print(build(i))
