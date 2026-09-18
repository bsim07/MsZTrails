"""
Fraction Trails — locked art palette.

GBA-era route palette. Every asset in assets/ is built from ONLY these colours.
If you add a colour here, add it for a reason and note the reason in the comment,
otherwise the art stops reading as one system.

Naming: <family><step>, step 1 = lightest highlight, 4 = darkest shade.
`OUT` is the single shared outline colour — a desaturated near-black with a
violet bias, which is what stops pixel art looking like clip-art.
"""

PALETTE = {
    # --- shared ---
    "OUT":  "#241f2e",   # universal outline
    "OUT2": "#3b3347",   # softer outline, used inside shapes
    "WHT":  "#fdf6e8",   # warm white (never pure #fff — it glares on a projector)
    "BLK":  "#1a1622",

    # --- grass field (the walkable floor) ---
    "GR1":  "#a9dc6a",
    "GR2":  "#84c44b",
    "GR3":  "#63a336",
    "GR4":  "#4a8128",

    # --- tall grass / encounter blades ---
    "TG1":  "#8fd455",
    "TG2":  "#5faa33",
    "TG3":  "#3d7d22",
    "TG4":  "#265616",

    # --- trampled / searched grass ---
    "DRY1": "#d9cf96",
    "DRY2": "#bfae74",
    "DRY3": "#9b8a56",

    # --- tree canopy + trunk ---
    "TR1":  "#5ba93c",
    "TR2":  "#3d8a2e",
    "TR3":  "#28671f",
    "TR4":  "#184515",
    "TR5":  "#0e2d10",
    "WD1":  "#a9753f",
    "WD2":  "#7d5228",
    "WD3":  "#513318",

    # --- dirt path ---
    "PA1":  "#e8d3a2",
    "PA2":  "#d4ba83",
    "PA3":  "#b99a63",
    "PA4":  "#96784a",

    # --- water ---
    "WA1":  "#a8e4f7",
    "WA2":  "#5cb4ea",
    "WA3":  "#3181c9",
    "WA4":  "#1e5896",

    # --- stone / cliff ---
    "ST1":  "#ded9cd",
    "ST2":  "#b0a999",
    "ST3":  "#82796a",
    "ST4":  "#564e43",

    # --- flowers & mushrooms (accent pops, used sparingly) ---
    "FY1":  "#ffe45c",
    "FY2":  "#d9a014",
    "FP1":  "#ff8fb0",
    "FP2":  "#c9476f",
    "MR1":  "#f2604a",
    "MR2":  "#b6291f",

    # --- skin ---
    "SK1":  "#ffdcb8",
    "SK2":  "#f0b98c",
    "SK3":  "#c9835a",
    "SK4":  "#8d5535",

    # --- hair ---
    "HB1":  "#a8683a",   # brown light
    "HB2":  "#7a4524",   # brown mid
    "HB3":  "#4d2a15",   # brown dark
    "HK1":  "#5a4a66",   # black-violet light
    "HK2":  "#3b2f47",   # black-violet mid
    "HK3":  "#241c2e",   # black-violet dark

    # --- clothing: explorer red (boy) ---
    "CR1":  "#f4705c",
    "CR2":  "#d8402f",
    "CR3":  "#9c2418",

    # --- clothing: explorer teal (girl) ---
    "CT1":  "#5fd6c0",
    "CT2":  "#2ea894",
    "CT3":  "#1a7263",

    # --- clothing: denim / trousers ---
    "DN1":  "#6f8fd0",
    "DN2":  "#41609e",
    "DN3":  "#2a406e",

    # --- clothing: plum / skirt ---
    "PL1":  "#c489e0",
    "PL2":  "#8e51b4",
    "PL3":  "#5f3279",

    # --- boots / straps ---
    "BT1":  "#8a6b4f",
    "BT2":  "#584130",

    # --- accents (packs, badges, UI) ---
    "AC1":  "#ffc94d",
    "AC2":  "#e09312",
    "AC3":  "#a2620a",

    # --- NPC: Scholar Zed (blue robe) ---
    "ZB1":  "#7aa8e8",
    "ZB2":  "#3f6fbc",
    "ZB3":  "#274a84",

    # --- NPC: Scholar Mei (mint coat) ---
    "ZM1":  "#eaf4ef",
    "ZM2":  "#bcd6c6",
    "ZM3":  "#8aa895",

    # --- rival trainer (orange) ---
    "RV1":  "#ffa552",
    "RV2":  "#e0721c",
    "RV3":  "#a04a0c",
}


def rgba(key):
    """'#rrggbb' -> (r, g, b, 255). '.' / ' ' / None -> fully transparent."""
    if key in (None, ".", " ", "_"):
        return (0, 0, 0, 0)
    hexv = PALETTE[key] if key in PALETTE else key
    hexv = hexv.lstrip("#")
    return (int(hexv[0:2], 16), int(hexv[2:4], 16), int(hexv[4:6], 16), 255)
