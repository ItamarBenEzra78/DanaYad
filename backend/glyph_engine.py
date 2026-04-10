"""
Glyph Variation Engine — extracts SVG paths from font files
and generates per-character variants with transforms.
"""
import math
import random
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen


class GlyphEngine:
    def __init__(self, font_path):
        self.font = TTFont(font_path)
        self.cmap = self.font.getBestCmap()
        self.glyph_set = self.font.getGlyphSet()
        self.upem = self.font['head'].unitsPerEm
        # Cache extracted paths
        self._cache = {}

    def get_glyph(self, char):
        """Get SVG path and width for a character (cached)."""
        if char in self._cache:
            return self._cache[char]

        code = ord(char)
        if code not in self.cmap:
            self._cache[char] = (None, 0)
            return None, 0

        glyph_name = self.cmap[code]
        pen = SVGPathPen(self.glyph_set)
        self.glyph_set[glyph_name].draw(pen)
        path = pen.getCommands()
        width = self.glyph_set[glyph_name].width

        self._cache[char] = (path, width)
        return path, width


class HandwritingRenderer:
    def __init__(self, font_path):
        self.engine = GlyphEngine(font_path)

    def render_text(self, text, font_size=16, seed=42, intensity=1.0):
        """Render text as SVG with per-character variation."""
        scale = font_size / self.engine.upem
        rng = random.Random(seed)

        lines = text.split('\n')
        line_height = font_size * 1.75
        elements = []
        max_x = 0

        for li, line in enumerate(lines):
            y_base = (li + 1) * line_height
            x = 10  # left margin

            for ci, ch in enumerate(line):
                if ch == ' ':
                    x += font_size * (0.35 + rng.random() * 0.15)
                    continue
                if ch == '\t':
                    x += font_size * 1.6
                    continue

                path, width = self.engine.get_glyph(ch)
                if not path:
                    x += font_size * 0.5
                    continue

                # Per-character variation
                rot = (rng.random() - 0.5) * 3.0 * intensity
                skew = (rng.random() - 0.5) * 2.5 * intensity
                dy = math.sin(ci * 0.6 + li * 2.1) * 3.0 * intensity
                dx = (rng.random() - 0.5) * 1.5 * intensity
                op = 0.72 + rng.random() * 0.28
                sz = 1.0 + (rng.random() - 0.5) * 0.08 * intensity

                s = scale * sz
                tx = x + dx
                ty = y_base + dy

                # Build transform: translate, flip Y, scale, rotate, skew
                transform = (
                    f'translate({tx:.1f},{ty:.1f}) '
                    f'scale({s:.5f},{-s:.5f}) '
                    f'rotate({rot:.1f}) '
                    f'skewX({skew:.1f})'
                )

                elements.append(f'  <path d="{path}" transform="{transform}" '
                                f'fill="#1a1a1a" opacity="{op:.2f}"/>')

                x += width * s + (rng.random() - 0.5) * 2 * intensity

            if x > max_x:
                max_x = x

        total_h = len(lines) * line_height + line_height
        svg_w = max(max_x + 40, 700)

        header = (f'<svg xmlns="http://www.w3.org/2000/svg" '
                  f'width="{svg_w:.0f}" height="{total_h:.0f}" '
                  f'viewBox="0 0 {svg_w:.0f} {total_h:.0f}">\n'
                  f'<defs><filter id="ink" x="-3%" y="-3%" width="106%" height="106%">'
                  f'<feTurbulence baseFrequency="0.04" numOctaves="3" seed="7"/>'
                  f'<feDisplacementMap in="SourceGraphic" scale="0.6"/>'
                  f'</filter></defs>\n'
                  f'<g filter="url(#ink)">\n')

        footer = '\n</g>\n</svg>'

        return header + '\n'.join(elements) + footer
