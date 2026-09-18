"""
Character sprites — 16x24, hand-authored.

Tiles are generated (tiles.py) because they have to tile. Characters are drawn
by hand because they have to READ: at 16x24 a silhouette is the whole
performance, and no amount of procedural cleverness gets a convincing head.

Layout, fixed for every character so the parts stay interchangeable:
    row 0        headroom (the sprite overhangs the tile above)
    rows 1-11    head
    rows 12-18   torso and arms
    rows 19-23   legs

Symbolic characters, resolved per character by a palette map:
    o  outline          1/2/3  hair light / mid / dark
    s  skin             k  skin shade      K  skin deep shade
    e  eye
    c  clothing light   v  clothing mid    V  clothing dark
    p  trousers         b  boot
    a  accent light     A  accent dark
    w  white            n  neutral/metal
"""

from pixel import Canvas, grid

W, H = 16, 24

# --------------------------------------------------------------- head: facing

# Row budget inside the head, and the reason for each row. Getting this wrong is
# what makes a 16x24 character look like a bobblehead:
#   1-4  hair mass and fringe          8   cheeks (1px blush, warmth)
#   5    forehead (ONE row, not two)   9   mouth  (2px, narrowed jaw)
#   6-7  eyes, 2x2 with a white        10  chin
#        highlight in the top-left     11  neck
# The white highlight is doing most of the work: without it a 2x2 dark block
# reads as a scowl, which is exactly how the first pass came out.

HEAD_DOWN_SHORT = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2211111122o..",
    "..o2111111112o..",
    "..o2ssssssss2o..",
    "..o2swesswes2o..",
    "..o2seessees2o..",
    "..o2kssssssk2o..",
    "...o2ssKKss2o...",
    "....okkkkkko....",
    ".....oKKKKo.....",
]

HEAD_DOWN_LONG = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2211111122o..",
    ".o221111111122o.",
    ".o22ssssssss22o.",
    ".o22swesswes22o.",
    ".o22seessees22o.",
    ".o23kssssssk32o.",
    ".o23sssKKsss32o.",
    ".o23okkkkkko32o.",
    ".o3o.oKKKKo.o3o.",
]

HEAD_UP_SHORT = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2211111122o..",
    "..o2111111112o..",
    "..o2111111112o..",
    "..o2211111122o..",
    "..o2221111222o..",
    "..o2222222222o..",
    "...o22222222o...",
    "....okkkkkko....",
    ".....oKKKKo.....",
]

HEAD_UP_LONG = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2211111122o..",
    ".o221111111122o.",
    ".o221111111122o.",
    ".o222111111222o.",
    ".o222222222222o.",
    ".o232222222232o.",
    ".o232222222232o.",
    ".o233okkkko332o.",
    ".o3o..oKKo..o3o.",
]

# Side view faces RIGHT. The left build mirrors it, which is why only one
# exists — two hand-drawn side views never quite match, and the mismatch shows
# up as a twitch when the player turns around.
HEAD_SIDE_SHORT = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2221111112o..",
    "..o2221111112o..",
    "..o2222sssssso..",
    "..o2222sssweso..",
    "..o2222ssseeso..",
    "..o2222sskssso..",
    "...o222sssKso...",
    "....okkkkkko....",
    ".....oKKKKo.....",
]

HEAD_SIDE_LONG = [
    "................",
    ".....oooooo.....",
    "...oo222222oo...",
    "..o2221111112o..",
    ".o22221111112o..",
    ".o22222sssssso..",
    ".o22222sssweso..",
    ".o22222ssseeso..",
    ".o22322sskssso..",
    ".o2232sssKso....",
    ".o233okkkkkko...",
    ".o3o..oKKKKo....",
]

# ---------------------------------------------------------------------- torso

TORSO_DOWN = [
    "..oaccccccccao..",
    ".osaccccccccaso.",
    ".osvccccccccvso.",
    ".osvccccccccvso.",
    "..ovVVVVVVVVvo..",
    "..oVVVVVVVVVVo..",
    "..oppppppppppo..",
]

TORSO_UP = [
    "..oaAAAAAAAAao..",
    ".osaAaaaaaaAaso.",
    ".osvAaaaaaaAvso.",
    ".osvAAaaaaAAvso.",
    "..ovVAAAAAAVvo..",
    "..oVVVVVVVVVVo..",
    "..oppppppppppo..",
]

TORSO_SIDE = [
    "..oacccccccao...",
    "..oacccccccao...",
    "..ovcccccccvso..",
    "..ovcccccccvso..",
    "..ovVVVVVVVvo...",
    "..oVVVVVVVVVo...",
    "..opppppppo.....",
]

# ----------------------------------------------------------------------- legs
# Three frames. Stand, then one leg forward, then the other. The walk cycle
# plays 0-1-0-2 so the character passes through a neutral pose each step,
# which is what reads as walking rather than skating.

LEGS = [
    [  # 0 stand
        "..oppppppppppo..",
        "..opppp..ppppo..",
        "..opppp..ppppo..",
        "..obbbb..bbbbo..",
        "..oooo....oooo..",
    ],
    [  # 1 left forward
        "..oppppppppppo..",
        "..opppp..ppppo..",
        "..obbbb..ppppo..",
        "..oooo...bbbbo..",
        "..........oooo..",
    ],
    [  # 2 right forward
        "..oppppppppppo..",
        "..opppp..ppppo..",
        "..opppp..bbbbo..",
        "..obbbb...oooo..",
        "..oooo..........",
    ],
]

LEGS_SIDE = [
    [  # 0 stand
        "..opppppppo.....",
        "..opppppppo.....",
        "..opppppppo.....",
        "..obbbbbbbo.....",
        "..ooooooooo.....",
    ],
    [  # 1 stride open
        "..opppppppo.....",
        "..oppp.pppo.....",
        ".oppo...oppo....",
        ".obbo...obbo....",
        ".oooo...oooo....",
    ],
    [  # 2 stride closed
        "..opppppppo.....",
        "..opppppppo.....",
        "..opppp.ppo.....",
        "..obbbo.bbo.....",
        "..ooooo.ooo.....",
    ],
]

# ----------------------------------------------------------- palette mappings

BASE = {"o": "OUT", "e": "OUT", "w": "WHT", "n": "ST2"}


def palette(hair, cloth, trousers, accent, skin=("SK1", "SK2", "SK3")):
    m = dict(BASE)
    m.update({
        "1": hair[0], "2": hair[1], "3": hair[2],
        "s": skin[0], "k": skin[1], "K": skin[2],
        "c": cloth[0], "v": cloth[1], "V": cloth[2],
        "p": trousers[1], "b": "BT1",
        "a": accent[0], "A": accent[1],
    })
    return m


CHARACTERS = {
    # Two explorers. Deliberately NOT "boy/girl blue/pink" — one is red-and-denim,
    # one is teal-and-plum, both get the same pack, the same build and the same
    # animation. The only differences are hair length and colourway.
    "explorer_a": dict(
        label="Rowan",
        hair=("HB1", "HB2", "HB3"),
        cloth=("CR1", "CR2", "CR3"),
        trousers=("DN1", "DN2", "DN3"),
        accent=("AC1", "AC2"),
        long_hair=False,
    ),
    "explorer_b": dict(
        label="Nia",
        hair=("HK1", "HK2", "HK3"),
        cloth=("CT1", "CT2", "CT3"),
        trousers=("PL1", "PL2", "PL3"),
        accent=("AC1", "AC2"),
        long_hair=True,
    ),
}

NPCS = {
    "guide_mei": dict(
        label="Scholar Mei",
        hair=("HK1", "HK2", "HK3"),
        cloth=("ZM1", "ZM2", "ZM3"),
        trousers=("HK1", "HK2", "HK3"),
        accent=("AC1", "AC2"),
        long_hair=True,
        prop="band_book",
    ),
    "guide_zed": dict(
        label="Scholar Zed",
        hair=("ZB1", "ZB2", "ZB3"),
        cloth=("ZB1", "ZB2", "ZB3"),
        trousers=("ZB2", "ZB3", "ZB3"),
        accent=("AC1", "AC2"),
        long_hair=False,
        prop="hat_beard",
    ),
    "rival": dict(
        label="Rival Trainer",
        hair=("HB1", "HB2", "HB3"),
        cloth=("RV1", "RV2", "RV3"),
        trousers=("DN2", "DN3", "DN3"),
        accent=("RV1", "RV3"),
        long_hair=False,
        prop="cap",
    ),
}

# Props sit on top of the finished head. Each is a 16x12 overlay aligned to
# rows 0-11, so a prop never has to know anything about the body.
# Props are full 16x24 overlays composited last, so a prop never has to know
# anything about the body underneath it. Rows it leaves blank show the character
# through unchanged.
PROPS = {
    # Rival trainer: a cap. The brim is drawn in the ACCENT colour rather than
    # the cap colour — a same-colour brim just reads as a bigger hat.
    "cap": {
        "down": [
            "................",
            ".....oooooo.....",
            "...oovvvvvvoo...",
            "..ovvccccccvvo..",
            "..ovccccccccvo..",
            "..oAAAAAAAAAAo..",
        ],
        "side": [
            "................",
            ".....oooooo.....",
            "...oovvvvvvoo...",
            "..ovvccccccvvo..",
            "..ovccccccccvo..",
            "..oAAAAAAAAAAAo.",
        ],
    },
    # Scholar Zed: pointed hat and a beard. The beard covers the mouth and chin
    # rows, which is the cheapest way to say "old" at this size.
    "hat_beard": {
        "down": [
            "......oooo......",
            ".....ovccvo.....",
            "....ovccccvo....",
            "...ovccccccvo...",
            "..ovccccccccvo..",
            ".oVVVVVVVVVVVVo.",
            "................",
            "................",
            "................",
            "....owwwwwwo....",
            ".....owwwwo.....",
            "......owwo......",
        ],
        "side": [
            "......oooo......",
            ".....ovccvo.....",
            "....ovccccvo....",
            "...ovccccccvo...",
            "..ovccccccccvo..",
            ".oVVVVVVVVVVVVo.",
            "................",
            "................",
            "................",
            "....owwwwwwo....",
            ".....owwwwo.....",
            "......owwo......",
        ],
    },
    # Scholar Mei: a headband and a held book. A book reads instantly as
    # "this person will tell you something"; glasses at 16px just read as a
    # blindfold, which is what the first pass produced.
    "band_book": {
        "down": [
            "................",
            "................",
            "................",
            "................",
            "..oaaaaaaaaaao..",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "....oAAAAAAo....",
            "....oAwwwwAo....",
            "....oAAAAAAo....",
        ],
        "side": [
            "................",
            "................",
            "................",
            "................",
            "..oaaaaaaaaaao..",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            ".....oAAAAAo....",
            ".....oAwwwAo....",
            ".....oAAAAAo....",
        ],
    },
}


def build(spec, facing, frame):
    """
    Compose one 16x24 sprite.
    facing : 'down' | 'up' | 'side'  (side faces right; mirror it for left)
    frame  : 0 stand, 1 step, 2 step
    """
    pal = palette(spec["hair"], spec["cloth"], spec["trousers"], spec["accent"])
    long_hair = spec.get("long_hair", False)

    head_rows = {
        ("down", False): HEAD_DOWN_SHORT, ("down", True): HEAD_DOWN_LONG,
        ("up", False): HEAD_UP_SHORT,     ("up", True): HEAD_UP_LONG,
        ("side", False): HEAD_SIDE_SHORT, ("side", True): HEAD_SIDE_LONG,
    }[(facing, long_hair)]
    torso_rows = {"down": TORSO_DOWN, "up": TORSO_UP, "side": TORSO_SIDE}[facing]
    legs_rows = (LEGS_SIDE if facing == "side" else LEGS)[frame % 3]

    c = Canvas(W, H)
    c.blit(grid(head_rows, pal, f"head:{facing}"), 0, 0)
    c.blit(grid(torso_rows, pal, f"torso:{facing}"), 0, 12)
    c.blit(grid(legs_rows, pal, f"legs:{facing}:{frame}"), 0, 19)

    prop = spec.get("prop")
    if prop:
        rows = PROPS[prop]["side" if facing == "side" else "down"]
        c.blit(grid(rows, pal, f"prop:{prop}"), 0, 0)
    return c


def build_set(spec):
    """All 12 frames for one character: down, up, left, right x 3 frames."""
    out = {}
    for facing in ("down", "up", "side"):
        for f in range(3):
            out[(facing, f)] = build(spec, facing, f)
    for f in range(3):
        out[("left", f)] = out[("side", f)].flip_x()
        out[("right", f)] = out[("side", f)]
    return out
