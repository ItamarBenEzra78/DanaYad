"""PDF inspection: page geometry, and ink analysis of each page's image."""
import io
import re

from PIL import Image, ImageChops
from pypdf import PdfReader

A4_PT = (595.28, 841.89)
SCALE = 2                      # device px per CSS px in exports
PAD_TOP, PAD_BOTTOM, PAD_SIDE = 60, 80, 60
PAGE_W, PAGE_H = 794, 1123
INK = 160 * 3                  # js/export/PdfExporter.js INK_THRESHOLD


def read(path):
    """Per page: media box size, and the images the page actually draws (jsPDF
    shares one XObject dictionary between pages, so resources alone mislead)."""
    reader = PdfReader(path)
    pages = []
    for p in reader.pages:
        w, h = float(p.mediabox.width), float(p.mediabox.height)
        drawn = re.findall(rb"/([^\s/]+)\s+Do", p.get_contents().get_data())
        xobjects = p["/Resources"]["/XObject"]
        imgs = []
        for name in drawn:
            obj = xobjects["/" + name.decode()].get_object()
            imgs.append(Image.open(io.BytesIO(obj.get_data())).convert("RGB"))
        pages.append({"size": (w, h), "image": imgs[0] if imgs else None, "image_count": len(imgs)})
    return pages


def ink_mask(img):
    """1 where a pixel is ink (dark), 0 elsewhere."""
    r, g, b = img.split()
    s = ImageChops.add(ImageChops.add(r.point(lambda v: v // 3), g.point(lambda v: v // 3)), b.point(lambda v: v // 3))
    return s.point(lambda v: 255 if v * 3 < INK else 0)


def row_ink(mask, y):
    return sum(1 for v in mask.crop((0, y, mask.width, y + 1)).getdata() if v)


def region_ink(mask, box):
    hist = mask.crop(box).histogram()
    return hist[255]


def ink_iou(a, b):
    ma, mb = ink_mask(a), ink_mask(b)
    inter = region_ink(ImageChops.multiply(ma, mb), (0, 0, ma.width, ma.height))
    union = region_ink(ImageChops.lighter(ma, mb), (0, 0, ma.width, ma.height))
    return inter / union if union else 1.0


def best_offset_iou(a, b, reach=2):
    """Ink IoU allowing a small shift: html2canvas draws text 1-2 device px
    lower than Chrome does, which is not a defect worth failing on."""
    return max(ink_iou(a, ImageChops.offset(b, dx, dy))
               for dx in range(-reach, reach + 1) for dy in range(-reach, reach + 1))


def split_shapes(page_a, top_a, page_b, top_b, nominal, band=40):
    """Ink shapes cut in two by the page break near sheet row `nominal`.

    page_a shows sheet row y at row y - top_a, page_b at y - top_b (the
    composer's window convention). Every ink pixel near the break must come
    from exactly one page; an 8-connected shape with pixels on both pages was
    split. Returns the bounding boxes (sheet coordinates) of split shapes."""
    ma, mb = ink_mask(page_a), ink_mask(page_b)
    w = ma.width
    y0 = nominal - band
    rows = 2 * band + 1
    a = list(ma.crop((0, y0 - top_a, w, y0 - top_a + rows)).getdata())
    b = list(mb.crop((0, y0 - top_b, w, y0 - top_b + rows)).getdata())
    seen = bytearray(w * rows)
    split = []
    for start in range(w * rows):
        if seen[start] or not (a[start] or b[start]):
            continue
        stack, on_a, on_b, box = [start], False, False, [w, rows, 0, 0]
        seen[start] = 1
        while stack:
            k = stack.pop()
            on_a |= bool(a[k]); on_b |= bool(b[k])
            y, x = divmod(k, w)
            box = [min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y)]
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < rows and 0 <= xx < w:
                        n = yy * w + xx
                        if not seen[n] and (a[n] or b[n]):
                            seen[n] = 1
                            stack.append(n)
        if on_a and on_b:
            split.append((box[0], box[1] + y0, box[2], box[3] + y0))
    return split
