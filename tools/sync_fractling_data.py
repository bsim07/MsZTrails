#!/usr/bin/env python3
"""
Pull the Fractling roster out of data.js into tools/fractling_data.json.

    python3 tools/sync_fractling_data.py

The art build reads the JSON rather than parsing data.js directly, so that a
change to the game's data format can never silently produce wrong sprites — it
fails here, loudly, with the line it could not read.

Run this after adding or recolouring a Fractling, then run build_assets.py.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA_JS = os.path.join(REPO, "data.js")
OUT = os.path.join(HERE, "fractling_data.json")

FIELD = {
    "id": r"id\s*:\s*(\d+)",
    "name": r'name\s*:\s*"([^"]*)"',
    "tag": r'tag\s*:\s*"([^"]*)"',
    "num": r"num\s*:\s*(\d+)",
    "den": r"den\s*:\s*(\d+)",
    "color": r'color\s*:\s*"(#[0-9A-Fa-f]{6})"',
    "ear": r'ear\s*:\s*"(#[0-9A-Fa-f]{6})"',
}


def main():
    if not os.path.exists(DATA_JS):
        sys.exit(f"data.js not found at {DATA_JS}")
    src = open(DATA_JS, encoding="utf-8").read()

    # Each entry opens with `id:<n>,` at the start of a Fractling literal.
    chunks = re.split(r"\n\s*\{\s*\n?\s*(?=id\s*:\s*\d+)", src)
    rows, problems = [], []
    for chunk in chunks:
        if not re.match(r"\s*id\s*:\s*\d+", chunk):
            continue
        head = chunk[:600]                    # fields all sit near the top
        row = {}
        for key, pattern in FIELD.items():
            m = re.search(pattern, head)
            if not m:
                problems.append((head.splitlines()[0].strip()[:60], key))
                row = None
                break
            row[key] = int(m.group(1)) if key in ("id", "num", "den") else m.group(1)
        if row:
            rows.append(row)

    if problems:
        for entry, key in problems:
            print(f"  could not read '{key}' from: {entry}", file=sys.stderr)
        sys.exit(f"{len(problems)} Fractling(s) unreadable — fix data.js or FIELD above")

    rows.sort(key=lambda r: r["id"])
    expected = list(range(len(rows)))
    if [r["id"] for r in rows] != expected:
        sys.exit("Fractling ids must be 0..N-1 with no gaps — id IS the sheet "
                 f"column. Got: {[r['id'] for r in rows]}")

    json.dump(rows, open(OUT, "w"), indent=1)
    print(f"{len(rows)} Fractlings -> tools/fractling_data.json")
    print("now run: python3 tools/build_assets.py")
    print(f"and set background-size width in assets/fractlings.css to "
          f"{len(rows) * 56}px")


if __name__ == "__main__":
    main()
