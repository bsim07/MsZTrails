#!/usr/bin/env python3
"""
Fraction Trails — art build.

    python3 tools/build_assets.py

Regenerates everything in assets/ from the definitions in this folder:

    palette.py   the locked colour list
    pixel.py     canvas / ASCII-grid / sheet-packing helpers
    tiles.py     16x16 terrain (generated — it has to tile)
    chars.py     16x24 characters (hand-drawn — they have to read)
    ui.py        avatar cards, parallax scenery, effect sprites

Nothing else in the repo generates art. If a sprite is wrong, it is wrong in
one of those five files, and one command fixes it everywhere it appears.

Outputs (all PNG, no interpolation anywhere — display with
`image-rendering: pixelated`):

    assets/tiles.png      128x80   34 terrain tiles, 16x16 cells
    assets/chars.png      192x120  5 characters x 12 frames, 16x24 cells
    assets/avatars.png     96x48   2 avatar-select cards, 48x48 cells
    assets/tree.png        16x24   free-standing tree, overhangs one tile
    assets/fx.png          64x16   sparkle x3, puff x2, 16x16 cells
    assets/alert.png       12x12   the "!" encounter bubble
    assets/clouds.png      32x6    two drifting clouds, 16x6 cells
    assets/treeline.png   160x40   tileable horizon strip
    assets/atlas.json              cell coordinates for every named sprite
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pixel import Canvas, save, sheet   # noqa: E402
import tiles as T                        # noqa: E402
import chars                             # noqa: E402
import ui                                # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), "assets")

# Tile atlas order. This list IS the contract — assets/atlas.json is generated
# from it, and sprites.css reads the same coordinates. Append to the end when
# you add a tile; never reorder, or every background-position shifts at once.
TILE_ORDER = [
    ("grass_0",      lambda: T.grass(0)),
    ("grass_1",      lambda: T.grass(1)),
    ("grass_2",      lambda: T.grass(2)),
    ("grass_3",      lambda: T.grass(3)),
    ("tall_0",       lambda: T.tall_grass(0)),
    ("tall_1",       lambda: T.tall_grass(1)),
    ("tall_caught",  T.tall_grass_caught),
    ("tall_empty",   T.tall_grass_empty),

    ("path_0",       lambda: T.path(0)),
    ("path_1",       lambda: T.path(1)),
    ("path_n",       lambda: T.path_edge("n")),
    ("path_s",       lambda: T.path_edge("s")),
    ("path_e",       lambda: T.path_edge("e")),
    ("path_w",       lambda: T.path_edge("w")),
    ("path_ne",      lambda: T.path_edge("ne")),
    ("path_nw",      lambda: T.path_edge("nw")),

    ("path_se",      lambda: T.path_edge("se")),
    ("path_sw",      lambda: T.path_edge("sw")),
    ("path_ns",      lambda: T.path_edge("ns")),
    ("path_ew",      lambda: T.path_edge("ew")),
    ("wall_0",       lambda: T.tree_wall(0)),
    ("wall_1",       lambda: T.tree_wall(1)),
    ("wall_2",       lambda: T.tree_wall(2)),
    ("wall_3",       lambda: T.tree_wall(3)),
    ("thicket",      T.thicket),
    ("cliff",        T.hill),

    ("water_0",      lambda: T.water(0)),
    ("water_1",      lambda: T.water(1)),
    ("water_2",      lambda: T.water(2)),
    ("flowers_0",    lambda: T.flowers(0)),
    ("flowers_1",    lambda: T.flowers(1)),
    ("rock",         T.rock),
    ("bush",         T.bush),
    ("mushroom",     T.mushroom),
]

TILE_COLS = 8

# Character atlas order: one row per character, 12 frames across.
CHAR_ORDER = ["explorer_a", "explorer_b", "guide_mei", "guide_zed", "rival"]
FRAME_ORDER = [("down", 0), ("down", 1), ("down", 2),
               ("up", 0), ("up", 1), ("up", 2),
               ("right", 0), ("right", 1), ("right", 2),
               ("left", 0), ("left", 1), ("left", 2)]


def build():
    os.makedirs(OUT, exist_ok=True)
    atlas = {}

    # ---- tiles
    canvases = [fn() for _, fn in TILE_ORDER]
    save(sheet(canvases, cols=TILE_COLS, cell_w=16, cell_h=16),
         os.path.join(OUT, "tiles.png"))
    atlas["tiles"] = {
        "file": "tiles.png", "cell": [16, 16], "cols": TILE_COLS,
        "sprites": {name: [(i % TILE_COLS) * 16, (i // TILE_COLS) * 16]
                    for i, (name, _) in enumerate(TILE_ORDER)},
    }

    # ---- characters
    specs = dict(chars.CHARACTERS)
    specs.update(chars.NPCS)
    frames, char_map = [], {}
    for r, key in enumerate(CHAR_ORDER):
        built = chars.build_set(specs[key])
        for cidx, fk in enumerate(FRAME_ORDER):
            frames.append(built[fk])
            char_map[f"{key}_{fk[0]}_{fk[1]}"] = [cidx * 16, r * 24]
    save(sheet(frames, cols=len(FRAME_ORDER), cell_w=16, cell_h=24),
         os.path.join(OUT, "chars.png"))
    atlas["chars"] = {
        "file": "chars.png", "cell": [16, 24], "cols": len(FRAME_ORDER),
        "rows": {k: i for i, k in enumerate(CHAR_ORDER)},
        "frame_order": [f"{f}_{n}" for f, n in FRAME_ORDER],
        "sprites": char_map,
    }

    # ---- avatar selection cards
    cards = [ui.avatar_card(chars.CHARACTERS["explorer_a"]),
             ui.avatar_card(chars.CHARACTERS["explorer_b"])]
    save(sheet(cards, cols=2, cell_w=48, cell_h=48),
         os.path.join(OUT, "avatars.png"))
    atlas["avatars"] = {
        "file": "avatars.png", "cell": [48, 48],
        "sprites": {"explorer_a": [0, 0], "explorer_b": [48, 0]},
    }

    # ---- scenery and effects
    save(T.tree(0), os.path.join(OUT, "tree.png"))
    save(sheet([ui.sparkle(0), ui.sparkle(1), ui.sparkle(2),
                ui.puff(0), ui.puff(1)], cols=5, cell_w=16, cell_h=16),
         os.path.join(OUT, "fx.png"))
    save(ui.alert(), os.path.join(OUT, "alert.png"))
    save(sheet([ui.cloud(0), ui.cloud(1)], cols=2, cell_w=16, cell_h=6),
         os.path.join(OUT, "clouds.png"))
    save(ui.treeline(), os.path.join(OUT, "treeline.png"))
    atlas["fx"] = {
        "file": "fx.png", "cell": [16, 16],
        "sprites": {"sparkle_0": [0, 0], "sparkle_1": [16, 0],
                    "sparkle_2": [32, 0], "puff_0": [48, 0], "puff_1": [64, 0]},
    }

    with open(os.path.join(OUT, "atlas.json"), "w") as f:
        json.dump(atlas, f, indent=2)

    for name in sorted(os.listdir(OUT)):
        print(f"  assets/{name}")
    print(f"\n{len(TILE_ORDER)} tiles, {len(frames)} character frames, "
          f"{len(cards)} avatar cards.")


if __name__ == "__main__":
    build()
