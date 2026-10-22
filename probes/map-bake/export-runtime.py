"""Install the independently rendered, pinned 192 px course WebP and manifest.

Usage: python export-runtime.py RESULT_JSON RENDER_DIRECTORY
The script rejects any source, level, export or image drift. It never renders at game load.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEVELS = ROOT / "assets/unit-art/levels/showcase-levels.json"
REPORT = Path(__file__).with_name("RESULTS.json")
OUTPUT = ROOT / "assets/map-bakes"
SOURCE = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
GENERATOR_SHA = "47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385"
ARCHIVE_SHA = "7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a"
IMAGE_SHA = "065b930e386665629efd0c96e7d41d9f9a0ebe91b596885101269e5c3d03abc1"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main(result_file, render_dir):
    result = json.loads(result_file.read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    level = next(item for item in json.loads(LEVELS.read_text(encoding="utf-8"))["levels"]
                 if item["id"] == "showcase-terrain-course")
    source = report["source"]
    render = next(item for item in result["renders"] if item["run"] == 1 and item["hexPx"] == 192)
    image = (render_dir / render["webpFile"]).read_bytes()
    if source["generatorHtmlSha256"] != GENERATOR_SHA:
        raise ValueError("Pinned generator HTML SHA-256 differs")
    if source["iconArchiveSha256"] != ARCHIVE_SHA:
        raise ValueError("Pinned terrain archive SHA-256 differs")
    if (source["sourceCommit"] != SOURCE or result["contentPin"] != SOURCE or
        result["runtimeCommit"] != "3d50be780c3833d1ff8a160bc2342aa668fe7552" or
        source["profile"] != "FIELD_TEST_LEGACY_v1" or
        source["levelSourceSha256"] != sha(LEVELS.read_bytes()) or
        source["levelSemanticSha256"] != sha(json.dumps(level, sort_keys=True, ensure_ascii=False,
                                                        separators=(",", ":")).encode()) or
        source["visualVersion"] != "map-probe-v1" or len(source["icons"]) != 35 or
        render["dimensions"] != [2400, 1386] or render["webpBytes"] != 541444 or
        render["webpSha256"] != IMAGE_SHA or len(image) != 541444 or sha(image) != IMAGE_SHA):
        raise ValueError("Pinned bake source, level or image differs")
    cells = [[level["defaultTerrain"] for _ in range(level["width"])] for _ in range(level["height"])]
    for cell in level["terrain"]:
        cells[cell["y"]][cell["x"]] = cell["type"]
    even = ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1))
    odd = ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1))
    visual_cells = []
    for y, row in enumerate(cells):
        visual_row = []
        for x, kind in enumerate(row):
            neighbors = []
            for dx, dy in odd if y & 1 else even:
                nx, ny = x + dx, y + dy
                neighbors.append(cells[ny][nx] if 0 <= nx < 12 and 0 <= ny < 8 else None)
            mask = sum(1 << direction for direction, adjacent in enumerate(neighbors)
                       if adjacent != "forest") if kind == "forest" else None
            roads = [direction for direction, adjacent in enumerate(neighbors)
                     if kind in ("road", "bridge") and adjacent in ("road", "bridge")]
            rivers = [direction for direction, adjacent in enumerate(neighbors)
                      if kind in ("river", "bridge") and adjacent in ("river", "bridge", "water")]
            urban = [3, 1, 2, 3, 4, 0, 5][(x * 5 + y * 3) % 7] if kind == "urban" else None
            visual_row.append([mask, roads, rivers, urban])
        visual_cells.append(visual_row)
    key = {
        "scenarioId": level["id"], "scenarioVersion": level.get("scenarioVersion", 1),
        "profileId": level.get("ruleProfileId", "FIELD_TEST_LEGACY_v1"),
        "geometry": [12, 8, 34, 58, 48, "odd-row-right", "pointy-hex"],
        "defaultTerrain": level["defaultTerrain"], "cells": cells, "visualCells": visual_cells,
        "level": level,
        "visual": {"version": source["visualVersion"], "urbanVariant": "generator-levelToCfg-v1",
                   "overlays": "canonical-road-river-bridge-only", "metadata": []},
        "source": [SOURCE, source["levelSourceSha256"], source["levelSemanticSha256"],
                   source["generatorHtmlSha256"], source["iconArchiveSha256"]],
        "export": [192, 2400, 1386, "image/webp", 0.85],
    }
    key_text = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
    manifest = {"schemaVersion": 1, "key": key_text, "keySha256": sha(key_text.encode()),
                "image": "assets/map-bakes/showcase-terrain-course-192.webp",
                "imageSha256": IMAGE_SHA, "imageBytes": len(image), "width": 2400, "height": 1386,
                "sourceReport": "probes/map-bake/RESULTS.json",
                "renderReport": "goblin-nbg.10.2/.tools/diagnose-nbg-10-2/result.json"}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "showcase-terrain-course-192.webp").write_bytes(image)
    (OUTPUT / "showcase-terrain-course-192.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"keySha256": manifest["keySha256"], "imageSha256": IMAGE_SHA,
                      "imageBytes": len(image)}, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
