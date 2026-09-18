"""
UI and scenery art: avatar-select cards, title-screen parallax strips, and the
small effect sprites (sparkle, alert bubble, footstep puff).
"""

import random
from pixel import Canvas, grid
import chars


def scale2x(src):
    out = Canvas(src.w * 2, src.h * 2)
    for y in range(src.h):
        for x in range(src.w):
            c = src.px[y][x]
            if c[3]:
                for dy in (0, 1):
                    for dx in (0, 1):
                        out.px[y * 2 + dy][x * 2 + dx] = c
    return out


def avatar_card(spec):
    """
    48x48 selection card: a rounded badge in the character's colourway with the
    character standing on it at 2x. Built from the SAME sprite that walks around
    the map, so what a child picks is exactly what they get — the current
    version picks an emoji and then hands you an unrelated CSS figure.
    """
    c = Canvas(48, 48)
    accent, dark = spec["cloth"][0], spec["cloth"][2]

    def rounded(x0, y0, x1, y1, r, fill, border=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = max(x0 + r - x, x - (x1 - r), 0)
                dy = max(y0 + r - y, y - (y1 - r), 0)
                if dx + dy > r:
                    continue
                on_edge = (x <= x0 + 1 or x >= x1 - 1 or
                           y <= y0 + 1 or y >= y1 - 1 or dx + dy > r - 2)
                c.set(x, y, border if (border and on_edge) else fill)

    rounded(2, 2, 45, 45, 6, accent, dark)      # badge
    rounded(6, 6, 41, 41, 4, "WHT")             # inner panel to stand against

    big = scale2x(chars.build(spec, "down", 0))      # 32x48
    c.blit(big, 8, 0)
    return c


# ------------------------------------------------------------------- scenery

def treeline(width=160, height=40):
    """
    Tileable silhouette strip for the title screen and the map's far background.
    Two depths: a dark back row and a lighter front row, which is all you need
    for parallax to read.
    """
    c = Canvas(width, height)
    rnd = random.Random(31)

    def row(base_y, light, mid, dark, scale):
        x = 0
        while x < width:
            w = rnd.randrange(8, 16)
            h = rnd.randrange(int(8 * scale), int(16 * scale))
            top = base_y - h
            for yy in range(top, height):
                for xx in range(x, min(x + w, width)):
                    # round the crown
                    if yy < top + 3 and (xx < x + 2 or xx > x + w - 3):
                        continue
                    c.set(xx, yy, mid)
            for xx in range(x + 2, min(x + w - 2, width)):
                c.set(xx, top + 1, light)
            for yy in range(top + 3, height):
                c.set(min(x + w - 1, width - 1), yy, dark)
            x += w - 2

    row(height - 4, "TR3", "TR4", "TR5", 1.5)
    row(height, "TR2", "TR3", "TR4", 1.0)
    return c


def cloud(size=0):
    specs = [
        [
            "....oooo........",
            "..oowwwwoo......",
            ".owwwwwwwwoo....",
            "owwwwwwwwwwwo...",
            ".oowwwwwwwwoo...",
            "...oooooooo.....",
        ],
        [
            "......oooooo....",
            "...oooowwwwoo...",
            ".oowwwwwwwwwwo..",
            "owwwwwwwwwwwwwo.",
            ".oowwwwwwwwwwoo.",
            "...oooooooooo...",
        ],
    ]
    return grid(specs[size % 2], {"o": "ST1", "w": "WHT"}, f"cloud{size}")


# -------------------------------------------------------------------- effects

SPARKLE = [
    [
        "....a...",
        "....a...",
        "..aawaa.",
        "aaawwwaa",
        "..aawaa.",
        "....a...",
        "....a...",
        "........",
    ],
    [
        "........",
        "...a....",
        "..awa...",
        ".awwwa..",
        "..awa...",
        "...a....",
        "........",
        "........",
    ],
    [
        "........",
        "........",
        "...a....",
        "..awa...",
        "...a....",
        "........",
        "........",
        "........",
    ],
]

ALERT = [
    "..oooooooo..",
    ".owwwwwwwwo.",
    "owwwwAAwwwwo",
    "owwwwAAwwwwo",
    "owwwwAAwwwwo",
    "owwwwAAwwwwo",
    "owwwwwwwwwwo",
    "owwwwAAwwwwo",
    "owwwwAAwwwwo",
    ".owwwwwwwwo.",
    "..oooooooo..",
    "....oo......",
]

PUFF = [
    [
        "........",
        "........",
        "...dd...",
        "..dddd..",
        "...dd...",
        "........",
        "........",
        "........",
    ],
    [
        "........",
        "..d..d..",
        ".d.dd.d.",
        "d.dddd.d",
        ".d.dd.d.",
        "..d..d..",
        "........",
        "........",
    ],
]


def sparkle(frame=0):
    return grid(SPARKLE[frame % 3], {"a": "AC1", "w": "WHT"}, "sparkle")


def alert():
    return grid(ALERT, {"o": "OUT", "w": "WHT", "A": "MR2"}, "alert")


def puff(frame=0):
    return grid(PUFF[frame % 2], {"d": "PA3"}, "puff")
