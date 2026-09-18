"""
Fractlings — 56x56 pixel dragons with the fraction pie as their belly.

Three things are true of every sprite here, and they are what the design has
to reconcile:

  1. The PIE IS THE TEACHING. It shows num/den as shaded sectors, and it is the
     first thing a child sees when a Fractling appears. It is therefore drawn
     exactly (integer sector maths, no approximation) and placed unobscured on
     the dragon's belly, not behind a face.
  2. The SPECIES COLOUR IS IDENTITY. Each Fractling's `color` and `ear` already
     exist in data.js and are already used by the badge and the HP bar. The
     dragon takes those, and derives its own light/dark shades from them, so
     Halvo stays teal and Addix stays orange.
  3. RARITY MUST READ WITHOUT COLOUR. Rarity is assigned at runtime from how
     hard the question turns out to be, so it cannot ride on the species
     colour. It rides on SILHOUETTE — horns, wings, crest, tail — with a
     rarity accent colour as a second, redundant cue.

Built procedurally from ellipses and triangles rather than hand-drawn ASCII:
at 56x56 with five tiers and two frames, a parameterised body is the only way
the five tiers stay siblings instead of five unrelated drawings.
"""

import colorsys
import math

from pixel import Canvas, rgba

S = 56                      # cell size
PIE_CX, PIE_CY, PIE_R = 28, 37, 12
HEAD_CX, HEAD_CY = 28, 15

# Rarity accent: horns, wing membrane, crest, aura. Deliberately a cool-to-warm
# ramp ending in gold, which is the convention every child already knows from
# every other game they have played.
RARITY = [
    dict(key="common",    label="Common",    accent=("#c9c4bb", "#8d887f", "#5e5a53"),
         horns=2, wings=0, crest=0, tail=0, aura=0, sparkle=0),
    dict(key="uncommon",  label="Uncommon",  accent=("#9ee27a", "#5aa93c", "#357021"),
         horns=2, wings=1, crest=0, tail=1, aura=0, sparkle=0),
    dict(key="rare",      label="Rare",      accent=("#7fc7f5", "#3186cc", "#1d5890"),
         horns=3, wings=2, crest=1, tail=1, aura=0, sparkle=0),
    dict(key="epic",      label="Epic",      accent=("#cb92ee", "#8e51b4", "#5c3178"),
         horns=3, wings=3, crest=2, tail=2, aura=1, sparkle=0),
    dict(key="legendary", label="Legendary", accent=("#ffe066", "#f0a81c", "#a4650a"),
         horns=5, wings=4, crest=3, tail=3, aura=2, sparkle=1),
]

INK = "#241f2e"
INK_SOFT = "#3b3347"
PIE_EMPTY = "#fdf6e8"        # unshaded sectors — warm white, never pure white


# --------------------------------------------------------------- colour tools

def _hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _rgb_to_hex(r, g, b):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v * 255))) for v in (r, g, b))


def shades(base_hex, ear_hex):
    """
    Four tones from the species colour already in data.js.

    Shifting lightness in HLS rather than mixing toward white/black is what
    keeps a saturated teal reading as teal in its highlight instead of
    drifting to grey.
    """
    r, g, b = _hex_to_rgb(base_hex)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    light = colorsys.hls_to_rgb(h, min(0.92, l + 0.18), min(1.0, s * 0.92))
    dark = colorsys.hls_to_rgb(h, max(0.12, l - 0.16), min(1.0, s * 1.05))
    deep = colorsys.hls_to_rgb(h, max(0.08, l - 0.30), min(1.0, s * 1.05))
    return {
        "L": _rgb_to_hex(*light),
        "M": base_hex,
        "D": _rgb_to_hex(*dark),
        "X": _rgb_to_hex(*deep),
        "E": ear_hex,          # the existing "ear" colour, used for horns/claws
    }


# --------------------------------------------------------------- shape tools

def ellipse(c, cx, cy, rx, ry, key, squash_top=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if squash_top is not None and y < squash_top:
                continue
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                c.set(x, y, key)


def triangle(c, p0, p1, p2, key):
    xs = [p[0] for p in (p0, p1, p2)]
    ys = [p[1] for p in (p0, p1, p2)]
    def side(a, b, p):
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    for y in range(min(ys), max(ys) + 1):
        for x in range(min(xs), max(xs) + 1):
            d0, d1, d2 = side(p0, p1, (x, y)), side(p1, p2, (x, y)), side(p2, p0, (x, y))
            if (d0 >= 0 and d1 >= 0 and d2 >= 0) or (d0 <= 0 and d1 <= 0 and d2 <= 0):
                c.set(x, y, key)


def outline(c, key=INK):
    """
    Draw a 1px border OUTSIDE every opaque region.

    This one pass is what separates pixel art from a blob of coloured pixels,
    and doing it programmatically means the outline is never missed on an
    inside corner — which is exactly where hand-drawn outlines always fail.
    """
    ink = rgba(key)
    edge = []
    for y in range(c.h):
        for x in range(c.w):
            if c.px[y][x][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < c.w and 0 <= ny < c.h and c.px[ny][nx][3]:
                    edge.append((x, y))
                    break
    for (x, y) in edge:
        c.px[y][x] = ink


# ------------------------------------------------------------------- the pie

def pie(c, cx, cy, r, num, den, ring_key):
    """
    The fraction, drawn exactly.

    A pixel is shaded when the angle of its centre falls inside the first
    `num` of `den` equal sectors, measured clockwise from twelve o'clock. No
    rounding and no approximation — at den=11 the wedges come out thin, and
    they are thin *correctly*, which is the whole point of showing them.

    The belly is the same hue as the dragon, so three things keep it legible as
    a separate object: a dark rim, dark sector dividers, and an unshaded colour
    that is warm cream rather than a lighter tint of the body.
    """
    div_dark = "#6b6357"
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            dx, dy = (x + 0.5) - cx, (y + 0.5) - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            ang = math.degrees(math.atan2(dx, -dy)) % 360
            step = 360.0 / den
            sector = int(ang / step)
            inside = sector < num
            # Shaded sectors use the DARKER species tone, not the body tone.
            # Drawn in the body colour the shaded part vanished into the belly —
            # a yellow quarter on a yellow dragon is not a fraction, it is a
            # blank plate.
            c.set(x, y, ring_key["E"] if inside else PIE_EMPTY)
            # 1px shading along the lower-right of the disc, so it reads round
            if d > r - 2 and dx + dy > 0:
                c.set(x, y, ring_key["X"] if inside else "#e8ddc2")
            # Sector dividers. The tolerance shrinks with distance so the line
            # stays 1px all the way out; inside d=3 it is skipped entirely,
            # because near the hub every divider converges and the middle turns
            # into a grey smudge.
            if d > 3:
                off = ang % step
                tol = math.degrees(math.atan2(0.45, d))
                if off < tol or off > step - tol:
                    c.set(x, y, div_dark)

    # Hub, then a cream ring, then the ink rim. The cream ring is what keeps a
    # fully-shaded belly (Wholesome is 4/4) from disappearing into the dragon —
    # without it, "the whole thing" and "no plate at all" look identical.
    c.set(cx, cy, div_dark)
    for a in range(0, 3600):
        th = math.radians(a / 10.0)
        c.set(int(round(cx + math.sin(th) * (r - 1))),
              int(round(cy - math.cos(th) * (r - 1))), PIE_EMPTY)
        c.set(int(round(cx + math.sin(th) * r)),
              int(round(cy - math.cos(th) * r)), INK_SOFT)


# ----------------------------------------------------------------- the dragon

def _wings(c, tier, sh, acc, lift):
    """Wings grow with rarity: nubs, then a span, then a full membrane."""
    n = tier["wings"]
    if n == 0:
        return
    # Capped so the widest wing tip lands inside the 56px cell.
    span = [0, 7, 10, 12, 14][n]
    height = [0, 8, 11, 14, 16][n]
    top = 24 - lift
    for sign in (-1, 1):
        bx = 28 + sign * 12
        tipx = bx + sign * span
        # membrane
        triangle(c, (bx, top), (tipx, top - height // 2), (bx, top + height), acc[0])
        triangle(c, (bx, top + 2), (tipx - sign * 2, top + height // 2),
                 (bx, top + height), acc[1])
        # leading bone
        for i in range(span + 1):
            x = bx + sign * i
            y = top - int(i * (height / 2) / max(span, 1))
            c.set(x, y, acc[2])
        if n >= 3:                      # a second strut on the bigger wings
            for i in range(span):
                x = bx + sign * i
                y = top + int(i * (height * 0.55) / max(span, 1))
                c.set(x, y, acc[2])


def _horns(c, tier, sh, acc, lift):
    """
    Short and chunky. The first pass drew them tall and thin, which at 56px
    reads as antennae, not horns — a horn needs to be wider at the base than it
    is tall before the eye accepts it as one.
    Layout is (x-offset, height, outward lean).
    """
    n = tier["horns"]
    base = 8 - lift
    sets = {
        2: [(-7, 5, -1), (7, 5, 1)],
        3: [(-8, 5, -1), (0, 7, 0), (8, 5, 1)],
        5: [(-11, 4, -1), (-6, 6, -1), (0, 8, 0), (6, 6, 1), (11, 4, 1)],
    }
    for (ox, h, lean) in sets.get(n, sets[2]):
        x = 28 + ox
        apex = (x + lean * 2, base - h)
        triangle(c, (x - 2, base + 2), (x + 2, base + 2), apex, acc[1])
        triangle(c, (x - 2, base + 2), (x, base + 2), (apex[0] - lean, apex[1] + 1), acc[0])


def _crest(c, tier, sh, acc, lift):
    """Spikes down the spine. Only appears from Rare up."""
    n = tier["crest"]
    if n == 0:
        return
    count = [0, 2, 3, 4][n]
    for i in range(count):
        y = 26 + i * 4 - lift
        h = 4 + n
        # Spikes start at the body's silhouette (x = 28 +/- 15) and point
        # outward. Started any further in, the body ellipse simply covers them.
        triangle(c, (12, y), (12, y + 4), (12 - h, y + 2), acc[0])
        triangle(c, (44, y), (44, y + 4), (44 + h, y + 2), acc[0])


def _tail(c, tier, sh, acc, lift):
    """Sweeps out to the right and up, clear of the body silhouette — tucked
    behind it, the first pass made the tail invisible at every tier."""
    n = tier["tail"]
    pts = [(42, 47), (47, 45), (51, 41), (53, 36)]
    length = [2, 3, 4, 4, 4][min(n, 4)]
    tx, ty = pts[0]
    for i, (x, y) in enumerate(pts[:length]):
        tx, ty = x, y
        ellipse(c, x, y - lift, 3.4 - i * 0.5, 3.4 - i * 0.5, sh["D"])
    if n >= 1:                                   # fin
        triangle(c, (tx, ty - lift), (tx + 3, ty - 8 - lift), (tx - 3, ty - 6 - lift), acc[0])
    if n >= 2:                                   # spade
        triangle(c, (tx - 1, ty - 3 - lift), (tx + 4, ty - 9 - lift), (tx + 3, ty - 1 - lift), acc[1])


def _aura(c, tier, acc):
    """
    A sparse dotted halo. Drawn after the outline pass — outlining it is what
    turned the first pass into a wire hoop around the creature.
    """
    n = tier["aura"]
    if n == 0:
        return
    for ring, (r, step) in enumerate([(25, 24), (27, 16)][:n]):
        for a in range(0, 360, step):
            th = math.radians(a + ring * 8)
            x = int(round(28 + math.sin(th) * r))
            y = int(round(31 - math.cos(th) * r))
            if 0 <= x < S and 0 <= y < S and not c.px[y][x][3]:
                c.set(x, y, acc[0])


def _sparkles(c, tier, acc, frame):
    if not tier["sparkle"]:
        return
    spots = [(8, 10), (47, 14), (12, 46), (44, 48)] if frame == 0 else \
            [(10, 8), (45, 12), (10, 44), (46, 46)]
    for (x, y) in spots:
        c.set(x, y, "#fdf6e8")
        c.set(x - 1, y, acc[0]); c.set(x + 1, y, acc[0])
        c.set(x, y - 1, acc[0]); c.set(x, y + 1, acc[0])


def dragon(spec, rarity_index, frame=0):
    """One 56x56 Fractling. `spec` is a row from data.js."""
    tier = RARITY[rarity_index]
    sh = shades(spec["color"], spec["ear"])
    acc = tier["accent"]
    lift = 1 if frame else 0          # the whole creature breathes 1px

    c = Canvas(S, S)

    _tail(c, tier, sh, acc, lift)
    _wings(c, tier, sh, acc, lift)
    _crest(c, tier, sh, acc, lift)

    # --- legs (behind the body, so only the feet show)
    for ox in (-9, 9):
        ellipse(c, 28 + ox, 49 - lift, 4, 3.2, sh["D"])
        for k in range(3):
            c.set(28 + ox - 3 + k * 3, 51 - lift, sh["E"])

    # --- body: a wide egg that the pie sits in
    ellipse(c, 28, 37 - lift, 16, 15, sh["D"])
    ellipse(c, 28, 36 - lift, 15, 14, sh["M"])
    ellipse(c, 24, 31 - lift, 8, 6, sh["L"])

    # --- the fraction, unobscured
    pie(c, PIE_CX, PIE_CY - lift, PIE_R, spec["num"], spec["den"], sh)

    # --- neck
    ellipse(c, 28, 25 - lift, 6, 5, sh["M"])

    # --- head
    _horns(c, tier, sh, acc, lift)
    ellipse(c, HEAD_CX, HEAD_CY - lift, 12, 10, sh["D"])
    ellipse(c, HEAD_CX, HEAD_CY - 1 - lift, 11, 9, sh["M"])
    ellipse(c, HEAD_CX - 3, HEAD_CY - 4 - lift, 6, 4, sh["L"])
    # snout
    ellipse(c, HEAD_CX, HEAD_CY + 6 - lift, 6, 4, sh["L"])
    c.set(HEAD_CX - 2, HEAD_CY + 5 - lift, sh["X"])
    c.set(HEAD_CX + 2, HEAD_CY + 5 - lift, sh["X"])
    # mouth
    for x in range(HEAD_CX - 3, HEAD_CX + 4):
        c.set(x, HEAD_CY + 8 - lift, sh["X"])
    # eyes — 3x3 with a 1px highlight, the same trick the explorer sprites use
    for ox in (-5, 5):
        for dy in range(3):
            for dx in range(3):
                c.set(HEAD_CX + ox - 1 + dx, HEAD_CY - 2 - lift + dy, INK)
        c.set(HEAD_CX + ox - 1, HEAD_CY - 2 - lift, "#fdf6e8")

    outline(c)
    _aura(c, tier, acc)
    _sparkles(c, tier, acc, frame)
    return c
