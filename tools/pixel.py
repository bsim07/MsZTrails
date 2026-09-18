"""
Tiny pixel-art toolkit: a 1-pixel-per-pixel canvas, ASCII-grid parsing, and
sheet packing. No anti-aliasing anywhere — every operation writes whole pixels.
"""

import random
from PIL import Image
from palette import rgba

TRANSPARENT = (0, 0, 0, 0)


class Canvas:
    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.px = [[rgba(fill) for _ in range(w)] for _ in range(h)]

    def set(self, x, y, key):
        if 0 <= x < self.w and 0 <= y < self.h:
            c = rgba(key)
            if c[3]:
                self.px[y][x] = c

    def get(self, x, y):
        return self.px[y][x]

    def rect(self, x, y, w, h, key):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, key)

    def hline(self, x, y, w, key):
        self.rect(x, y, w, 1, key)

    def vline(self, x, y, h, key):
        self.rect(x, y, 1, h, key)

    def blit(self, other, ox=0, oy=0):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][x]
                if c[3]:
                    px, py = x + ox, y + oy
                    if 0 <= px < self.w and 0 <= py < self.h:
                        self.px[py][px] = c

    def flip_x(self):
        out = Canvas(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                out.px[y][self.w - 1 - x] = self.px[y][x]
        return out

    def to_image(self):
        img = Image.new("RGBA", (self.w, self.h))
        img.putdata([self.px[y][x] for y in range(self.h) for x in range(self.w)])
        return img


def grid(rows, key, name="<grid>", width=None):
    """
    Parse an ASCII-art block into a Canvas.

    rows : list of equal-length strings
    key  : {char: palette_name}. '.' is always transparent.
    Raises loudly on a ragged grid — a one-character typo is otherwise
    invisible until the sprite renders wrong.
    """
    w = width or len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(
                f"{name}: row {i} is {len(r)} chars, expected {w}\n  {r!r}"
            )
    c = Canvas(w, len(rows))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in (".", " "):
                continue
            if ch not in key:
                raise ValueError(f"{name}: row {y} col {x}: char {ch!r} not in key")
            c.set(x, y, key[ch])
    return c


def sheet(frames, cols=None, cell_w=None, cell_h=None):
    """Pack canvases into one sheet, left-to-right then top-to-bottom."""
    cw = cell_w or max(f.w for f in frames)
    ch = cell_h or max(f.h for f in frames)
    cols = cols or len(frames)
    rows = (len(frames) + cols - 1) // cols
    out = Canvas(cw * cols, ch * rows)
    for i, f in enumerate(frames):
        out.blit(f, (i % cols) * cw, (i // cols) * ch)
    return out


def dither(c, x, y, w, h, key, density, seed, pattern="scatter"):
    """Seeded scatter/checker dithering — the main texture tool for tiles."""
    rnd = random.Random(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if pattern == "checker" and (xx + yy) % 2:
                continue
            if rnd.random() < density:
                c.set(xx, yy, key)


def save(canvas, path, scale=1):
    img = canvas.to_image()
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(path)
    return path
