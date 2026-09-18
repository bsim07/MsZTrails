"""
Terrain tiles — 16x16, built procedurally from tuned parameters.

Why procedural and not hand-placed ASCII: these tiles have to TILE. Seam-free
wrap-around is something code gets right every time and a human gets wrong on
the third revision. Character sprites are the opposite (see chars.py) — there
the silhouette matters more than the seam, so those are hand-authored.

Every function returns a 16x16 Canvas.
"""

import math
import random
from pixel import Canvas, dither, grid

T = 16  # tile size


def _blob(c, cx, cy, rx, ry, key, wrap=True, jitter=0.0, seed=0):
    """Filled ellipse, optionally wrapping at the tile edge so the tile is seamless."""
    rnd = random.Random(seed)
    for y in range(-int(ry) - 2, int(ry) + 3):
        for x in range(-int(rx) - 2, int(rx) + 3):
            d = (x / max(rx, 0.01)) ** 2 + (y / max(ry, 0.01)) ** 2
            if d <= 1.0 + (rnd.random() - 0.5) * jitter:
                px, py = cx + x, cy + y
                if wrap:
                    px, py = px % T, py % T
                c.set(px, py, key)


# ---------------------------------------------------------------- grass field

_GRASS_KEY = {"l": "GR1", "d": "GR3", "D": "GR4", "t": "GR1"}

# Hand-placed, deliberately CALM. The commonest mistake in generated tile art is
# per-pixel noise: it looks like texture at 8x zoom and like TV static in game.
# GBA route grass is a flat base plus a few sparse marks. That's all this is.
_GRASS_VARIANTS = [
    [  # 0 — plainest. Use this for ~70% of the field.
        "................",
        "...ll.......dd..",
        "................",
        ".......ll.......",
        "..dd............",
        "............ll..",
        "................",
        ".ll......dd.....",
        "................",
        "......ll........",
        "...dd...........",
        "................",
        "..........ll....",
        "....dd..........",
        "................",
        ".........dd.....",
    ],
    [  # 1 — a tuft, lower left
        "................",
        "......dd........",
        "................",
        "...ll...........",
        "...........dd...",
        "................",
        ".......ll.......",
        "................",
        "..dd............",
        "...........ll...",
        "................",
        "....l...........",
        "...lDl..........",
        "....D......dd...",
        "................",
        "........ll......",
    ],
    [  # 2 — a tuft, upper right
        "................",
        "....ll..........",
        "...........l....",
        "..........lDl...",
        "...........D....",
        "..dd............",
        "................",
        "........ll......",
        "................",
        "...ll.......dd..",
        "................",
        "......dd........",
        "................",
        "............ll..",
        "...dd...........",
        "................",
    ],
    [  # 3 — two small stones' worth of wear
        "................",
        ".........dd.....",
        "...ll...........",
        "................",
        "......dd........",
        "...........ll...",
        "................",
        "..ll............",
        ".........dd.....",
        "................",
        "..............ll",
        "....dd..........",
        "................",
        "........ll......",
        "..dd............",
        "................",
    ],
]


def grass(variant=0):
    """
    The walkable floor. Four variants so a big field doesn't read as wallpaper.
    Variant 0 is the plainest — scatter it most often (roughly 7:1:1:1).
    """
    c = Canvas(T, T, "GR2")
    g = grid(_GRASS_VARIANTS[variant % 4], _GRASS_KEY, f"grass{variant}")
    c.blit(g)
    return c


# ------------------------------------------------------------------ tall grass

# Encounter grass, hand-authored so the SILHOUETTE is right — this tile is the
# single most important one in the game, because it is the one the player is
# hunting for. It has to be unmistakable at a glance and at small size.
#   1 = light blade edge   2 = blade body   3 = blade shade   4 = cast shadow
_TALL_KEY = {"1": "TG1", "2": "TG2", "3": "TG3", "4": "TG4"}
_TALL_FRAMES = [
    [  # frame A — upright
        "................",
        "................",
        "......1.........",
        ".1...12....1....",
        ".12..12...12....",
        "312..12...12..1.",
        "312.312.1.12.12.",
        "3121312.12312312",
        "3321312312312312",
        "3323312312312312",
        "3323332313312312",
        "3333332333312332",
        "3333333333332333",
        "3333333333333333",
        "4333333333333333",
        "4444444444444444",
    ],
]

# Frame B is frame A with everything above the root line nudged 1px right.
# Deriving it rather than hand-drawing it guarantees the two frames stay in
# sync when you edit the blades — edit frame A only.
_SWAY_ROOT = 10      # rows below this don't move
_SWAY_PX = 1


def _blades(c, phase=0):
    a = grid(_TALL_FRAMES[0], _TALL_KEY, "tall_grass")
    if phase % 2 == 0:
        c.blit(a)
        return c
    b = Canvas(T, T)
    for y in range(T):
        dx = _SWAY_PX if y < _SWAY_ROOT else 0
        for x in range(T):
            px = a.px[y][x]
            if px[3]:
                tx = x + dx
                if 0 <= tx < T:
                    b.px[y][tx] = px
    c.blit(b)
    return c


def tall_grass(frame=0):
    c = grass(0)
    _blades(c, phase=frame)
    return c


_FLAT_KEY = {"1": "TG1", "2": "TG2", "3": "TG3", "l": "DRY1", "d": "DRY3"}

# Flattened grass: horizontal strokes read as "trodden down" the way vertical
# strokes read as "standing up". Same shape language, rotated 90 degrees.
_FLAT_ROWS = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "..111.....11....",
    ".22222...2222...",
    "2233222.2233222.",
    ".3322233223322..",
    "..1111...111....",
    ".222222.22222...",
    "2333222233332222",
    ".33322..333322..",
    "..3333...3333...",
    "................",
    "................",
]


def tall_grass_caught():
    """Searched and a Fractling was found — flattened, still green, a win."""
    c = grass(0)
    c.blit(grid(_FLAT_ROWS, _FLAT_KEY, "flattened"))
    return c


def tall_grass_empty():
    """Searched, nothing there — same flattening, drained of colour. Reads as
    'done, move on' from across the map without shouting."""
    c = Canvas(T, T, "DRY2")
    c.blit(grid(_GRASS_VARIANTS[0], {"l": "DRY1", "d": "DRY3", "D": "DRY3", "t": "DRY1"},
                "dry_base"))
    c.blit(grid(_FLAT_ROWS, {"1": "DRY1", "2": "DRY2", "3": "DRY3",
                             "l": "DRY1", "d": "DRY3"}, "dry_flat"))
    return c


# ------------------------------------------------------------------ dirt path

_PATH_KEY = {"l": "PA1", "d": "PA3", "D": "PA4"}
_PATH_VARIANTS = [
    [
        "................",
        "....ll..........",
        "..........dd....",
        "................",
        "..dd............",
        "................",
        ".........ll.....",
        "................",
        "...ll......dd...",
        "................",
        "................",
        ".....dd.........",
        "............ll..",
        "................",
        "..ll............",
        ".........dd.....",
    ],
    [
        "................",
        ".........dd.....",
        "................",
        "...ll...........",
        "................",
        "...........Dl...",
        "......dd....D...",
        "................",
        "............ll..",
        "..dd............",
        "................",
        ".......ll.......",
        "................",
        "....dd..........",
        "................",
        "...........ll...",
    ],
]


def path(variant=0):
    c = Canvas(T, T, "PA2")
    c.blit(grid(_PATH_VARIANTS[variant % 2], _PATH_KEY, f"path{variant}"))
    return c


def path_edge(sides):
    """
    A path tile where grass encroaches on the given sides.

    The edge is TWO rows deep: a solid row of grass shade at the very edge, then
    a checkerboard row where grass and dirt interleave. That two-step dither is
    the whole GBA vocabulary for "one surface meeting another" — a single hard
    line reads as a cut-out, and a random scatter reads as dirt, not as an edge.

    `sides` is any of 'nsew'; corners and straight corridors come free by
    combining letters ('ne', 'ns', ...).
    """
    c = path(0)

    def band(outer, inner):
        for i, (x, y) in enumerate(outer):
            c.set(x, y, "GR3" if i % 4 else "GR4")
        for i, (x, y) in enumerate(inner):
            if i % 2 == 0:
                c.set(x, y, "GR3")

    if "n" in sides:
        band([(x, 0) for x in range(T)], [(x, 1) for x in range(T)])
    if "s" in sides:
        band([(x, T - 1) for x in range(T)], [(x, T - 2) for x in range(T)])
    if "w" in sides:
        band([(0, y) for y in range(T)], [(1, y) for y in range(T)])
    if "e" in sides:
        band([(T - 1, y) for y in range(T)], [(T - 2, y) for y in range(T)])
    return c


# ---------------------------------------------------------------- forest wall

def tree_wall(variant=0):
    """
    The map border. This replaces the current per-tile tree, which is what made
    the border read as a row of neon blocks: at 16px a whole tree cannot
    resolve, so we draw CANOPY — four leaf clumps that wrap at the tile edge and
    merge with their neighbours into one continuous forest mass.

    Clump centres sit at multiples of 8, which is why it tiles: a clump that
    runs off the right edge is the same clump arriving on the left.
    """
    c = Canvas(T, T, "TR5")                       # dark gaps between clumps
    # Small per-variant jitter keeps a long border from looking stamped,
    # but stays under 2px so the wrap still lines up.
    # Per-variant offsets and radii. Because _blob wraps, a clump pushed off one
    # edge reappears on the other, so the tile stays seamless no matter the
    # offset — that is what lets us break up the "grid of identical balls" look
    # that a fixed layout gives you across a long border.
    layouts = [
        [(4, 4, 4.2), (12, 4, 4.0), (4, 12, 4.0), (12, 12, 4.4)],
        [(6, 3, 4.5), (13, 6, 3.8), (2, 11, 4.2), (10, 13, 4.0)],
        [(3, 6, 4.0), (11, 2, 4.4), (6, 13, 3.8), (14, 10, 4.2)],
        [(5, 5, 3.8), (13, 3, 4.2), (3, 13, 4.4), (11, 11, 3.9)],
    ][variant % 4]
    for (cx, cy, r) in layouts:
        _blob(c, cx, cy, r, r * 0.95, "TR4")            # clump edge
        _blob(c, cx, cy, r - 0.7, r * 0.78, "TR3")      # body
        _blob(c, cx - 1, cy - 1, r - 1.6, r * 0.57, "TR2")   # lit side
        _blob(c, cx - 1, cy - 2, 1.4, 1.2, "TR1")       # highlight
    return c


def thicket():
    """Impassable but clearly *bushes*, not forest — lighter, rounder, lower."""
    c = grass(0)
    for cx, cy, r in [(4, 9, 4.2), (11, 8, 4.6), (7, 11, 4.0)]:
        _blob(c, cx, cy, r, r * 0.78, "TR3", wrap=False, jitter=0.5, seed=int(cx * 7))
    for cx, cy, r in [(4, 8, 3.0), (11, 7, 3.2), (7, 10, 2.8)]:
        _blob(c, cx, cy, r, r * 0.72, "TR2", wrap=False, jitter=0.5, seed=int(cx * 5))
    for cx, cy, r in [(3, 7, 1.6), (10, 6, 1.8), (6, 9, 1.4)]:
        _blob(c, cx, cy, r, r * 0.8, "TR1", wrap=False, jitter=0.4, seed=int(cx * 3))
    for x in range(3, 13):
        c.set(x, 14, "TR4")
    for x in range(5, 11):
        c.set(x, 15, "TR5")
    return c


def tree(variant=0):
    """
    A single free-standing tree, 16 wide x 24 tall. Overhangs the tile above,
    which is what gives a route depth. Returns a 16x24 canvas.
    """
    c = Canvas(16, 24)
    # trunk
    for y in range(15, 22):
        c.set(7, y, "WD2")
        c.set(8, y, "WD1")
        c.set(6, y, "WD3")
        c.set(9, y, "WD3")
    c.set(6, 21, "WD3"); c.set(5, 21, "WD3"); c.set(10, 21, "WD3")
    # canopy
    for cx, cy, rx, ry, k in [
        (8, 9, 7.2, 6.4, "TR4"),
        (8, 8, 6.6, 5.8, "TR3"),
        (7, 7, 5.2, 4.4, "TR2"),
        (6, 5, 3.2, 2.6, "TR1"),
        (11, 8, 2.4, 2.0, "TR1"),
    ]:
        _blob(c, cx, cy, rx, ry, k, wrap=False, jitter=0.45, seed=int(cx * 13 + variant))
    # ground shadow
    for x in range(4, 12):
        c.set(x, 22, "TR5")
    for x in range(5, 11):
        c.set(x, 23, "TR5")
    return c


# ---------------------------------------------------------------------- water

def water(frame=0):
    c = Canvas(T, T, "WA3")
    for y in range(T):
        # gentle horizontal banding, scrolled by frame
        if (y + frame) % 5 == 0:
            for x in range(T):
                c.set(x, y, "WA2")
        if (y + frame) % 7 == 3:
            for x in range(T):
                c.set(x, y, "WA4")
    dither(c, 0, 0, T, T, "WA2", 0.12, 900 + frame)
    # sparkles — the only thing that really sells water at this size
    sparks = [[(3, 4), (4, 4), (11, 10), (12, 10)],
              [(6, 7), (7, 7), (13, 3), (14, 3)],
              [(2, 12), (3, 12), (9, 6), (10, 6)]][frame % 3]
    for (x, y) in sparks:
        c.set(x, y, "WA1")
        c.set(x, y + 1, "WA2")
    return c


# ---------------------------------------------------------- scatter decoration

def flowers(frame=0):
    """
    Four blooms on grass. A flower needs exactly 3x3 to read: four petals, a
    centre, and a 2px stem. Anything smaller is a coloured dot; anything larger
    competes with the player sprite for attention.
    """
    c = grass(0)
    spots = [(3, 9, "FY1", "FY2"), (8, 12, "FP1", "FP2"),
             (12, 7, "FY1", "FY2"), (6, 5, "FP1", "FP2")]
    for i, (x, y, lt, dk) in enumerate(spots):
        # alternate blooms bob 1px on the off frame — a whole-field shimmer
        y -= (1 if (frame and i % 2 == 0) else 0)
        c.set(x, y + 2, "GR4")             # stem
        c.set(x, y + 1, "GR4")
        c.set(x - 1, y - 1, lt)            # petals
        c.set(x + 1, y - 1, lt)
        c.set(x - 1, y + 1, dk)
        c.set(x + 1, y + 1, dk)
        c.set(x, y - 1, lt)
        c.set(x - 1, y, lt)
        c.set(x + 1, y, dk)
        c.set(x, y + 1, dk)
        c.set(x, y, "WHT")                 # centre
    return c


def rock():
    c = grass(0)
    body = [(5, 8), (6, 7), (7, 7), (8, 7), (9, 8), (10, 8),
            (4, 9), (5, 9), (6, 9), (7, 9), (8, 9), (9, 9), (10, 9), (11, 9),
            (4, 10), (5, 10), (6, 10), (7, 10), (8, 10), (9, 10), (10, 10), (11, 10),
            (5, 11), (6, 11), (7, 11), (8, 11), (9, 11), (10, 11)]
    for (x, y) in body:
        c.set(x, y, "ST2")
    for (x, y) in [(6, 7), (7, 7), (8, 7), (5, 8), (6, 8), (7, 8)]:
        c.set(x, y, "ST1")
    for (x, y) in [(5, 11), (6, 11), (7, 11), (8, 11), (9, 11), (10, 11), (11, 10)]:
        c.set(x, y, "ST3")
    for (x, y) in [(6, 12), (7, 12), (8, 12), (9, 12), (10, 12)]:
        c.set(x, y, "ST4")
    return c


def bush():
    c = grass(0)
    for cx, cy, r, k in [(8, 10, 5.0, "TR4"), (8, 9, 4.4, "TR3"),
                         (7, 8, 3.4, "TR2"), (6, 7, 1.8, "TR1")]:
        _blob(c, cx, cy, r, r * 0.8, k, wrap=False, jitter=0.5, seed=int(cx + r))
    for x in range(5, 12):
        c.set(x, 14, "TR4")
    for x in range(7, 10):
        c.set(x, 15, "TR5")
    # a couple of berries so it isn't just a green lump
    for (x, y) in [(10, 9), (6, 11)]:
        c.set(x, y, "MR1")
    return c


def mushroom():
    c = grass(0)
    # big one
    for (x, y) in [(6, 8), (7, 8), (8, 8), (9, 8), (5, 9), (6, 9), (7, 9),
                   (8, 9), (9, 9), (10, 9)]:
        c.set(x, y, "MR1")
    for (x, y) in [(5, 10), (6, 10), (7, 10), (8, 10), (9, 10), (10, 10)]:
        c.set(x, y, "MR2")
    for (x, y) in [(6, 8), (9, 9), (7, 10)]:
        c.set(x, y, "WHT")
    for y in (11, 12):
        c.set(7, y, "PA1"); c.set(8, y, "PA2")
    c.set(7, 13, "PA3"); c.set(8, 13, "PA3")
    # small one
    for (x, y) in [(11, 11), (12, 11), (13, 11)]:
        c.set(x, y, "MR1")
    c.set(12, 10, "MR1"); c.set(12, 10, "WHT")
    c.set(12, 12, "PA2"); c.set(12, 13, "PA3")
    return c


_CLIFF_KEY = {"g": "GR2", "G": "GR3", "D": "GR4",
              "1": "ST1", "2": "ST2", "3": "ST3", "4": "ST4"}

# Cliff face. The grass lip on top plus the lit band directly under it is the
# whole trick — that one bright row is what makes the eye read a drop rather
# than a grey square.
_CLIFF_ROWS = [
    "gggggggggggggggg",
    "GGGGGGGGGGGGGGGG",
    "DDDDDDDDDDDDDDDD",
    "1111111111111111",
    "2222222222222222",
    "2332233223322332",
    "3333333333333333",
    "3343333433433343",
    "3333333333333333",
    "3343343343333433",
    "3333333333333333",
    "4334433443344334",
    "3333333333333333",
    "3433343334333433",
    "4444444444444444",
    "4444444444444444",
]


def hill():
    """Cliff face with a grass lip — impassable, and it reads as height."""
    return grid(_CLIFF_ROWS, _CLIFF_KEY, "cliff")
