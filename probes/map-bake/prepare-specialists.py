"""Prepare only the pinned Specialists generator probe in an isolated directory.

Usage: python prepare-specialists.py GENERATOR_ZIP ICONS_ZIP SHOWCASE_LEVELS_JSON OUTPUT_DIR
No browser is opened, no image is accepted, and no runtime files are changed.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

CONTENT_SHA = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
GENERATOR_ZIP_SHA = "0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2"
GENERATOR_HTML_SHA = "47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385"
ICON_ZIP_SHA = "7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a"
LEVEL_SOURCE_SHA = "eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140"
GENERATOR_MEMBER = "design-exports/uebergabe-karte/karte-generator.html"
ICON_PREFIX = "design-exports/uebergabe-karte/icons-terrain/"
PROFILE = "FIELD_TEST_LEGACY_v1"
SCENARIO = "showcase-specialists"
EVEN = ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1))
ODD = ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1))
TYPES = {"open-ground", "forest", "mountain", "ridge", "water", "marsh",
         "rubble-field", "crater", "urban", "road", "river", "bridge"}
EXPECTED_TERRAIN = {(6, 4, "river"), (6, 5, "river"), (6, 3, "bridge"),
                    (4, 3, "road"), (5, 3, "road"), (7, 3, "road"), (8, 2, "urban")}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def cells_for(level):
    if (level["id"] != SCENARIO or level["schemaVersion"] != 1 or
        (level["width"], level["height"], level["defaultTerrain"]) != (12, 8, "open-ground") or
        level.get("scenarioVersion", 1) != 1 or level.get("ruleProfileId", PROFILE) != PROFILE or
        {(cell["x"], cell["y"], cell["type"]) for cell in level["terrain"]} != EXPECTED_TERRAIN or
        len(level["terrain"]) != len(EXPECTED_TERRAIN)):
        raise ValueError("Pinned Specialists level/profile/terrain differs")
    grid = [[level["defaultTerrain"] for _ in range(12)] for _ in range(8)]
    for cell in level["terrain"]:
        x, y, kind = cell["x"], cell["y"], cell["type"]
        if not (0 <= x < 12 and 0 <= y < 8) or kind not in TYPES:
            raise ValueError("Invalid Specialists terrain cell")
        grid[y][x] = kind
    cells = []
    for y in range(8):
        for x in range(12):
            kind = grid[y][x]
            adjacent = []
            for dx, dy in ODD if y & 1 else EVEN:
                nx, ny = x + dx, y + dy
                adjacent.append(grid[ny][nx] if 0 <= nx < 12 and 0 <= ny < 8 else None)
            road = kind in ("road", "bridge")
            river = kind in ("river", "bridge")
            cells.append({"x": x, "y": y, "type": kind, "neighbors": adjacent,
                          "forestOpenMask": sum(1 << d for d, other in enumerate(adjacent)
                                                if other != "forest") if kind == "forest" else None,
                          "roadEdges": [d for d, other in enumerate(adjacent)
                                        if road and other in ("road", "bridge")],
                          "riverEdges": [d for d, other in enumerate(adjacent)
                                         if river and other in ("river", "bridge", "water")],
                          "urbanVariant": [3, 1, 2, 3, 4, 0, 5][(x * 5 + y * 3) % 7]
                          if kind == "urban" else None})
    by_position = {(cell["x"], cell["y"]): cell for cell in cells}
    if (len(cells) != 96 or len(by_position) != 96 or
        by_position[6, 3]["roadEdges"] != [0, 3] or
        by_position[6, 3]["riverEdges"] != [2] or
        by_position[7, 3]["roadEdges"] != [3] or
        by_position[7, 3]["neighbors"][5] != "urban" or
        by_position[6, 5]["riverEdges"] != [4]):
        raise ValueError("Specialists bridge, end or city adjacency differs")
    return cells


def main(generator_zip, icons_zip, levels_path, output_dir):
    if sha(generator_zip.read_bytes()) != GENERATOR_ZIP_SHA:
        raise ValueError("Pinned generator archive differs")
    if sha(icons_zip.read_bytes()) != ICON_ZIP_SHA:
        raise ValueError("Pinned terrain master archive differs")
    if sha(levels_path.read_bytes()) != LEVEL_SOURCE_SHA:
        raise ValueError("Pinned showcase level bundle differs")
    with zipfile.ZipFile(generator_zip) as archive:
        members = [item for item in archive.namelist() if not item.endswith("/")]
        if members != [GENERATOR_MEMBER]:
            raise ValueError("Unexpected generator export members")
        generator = archive.read(GENERATOR_MEMBER)
    if sha(generator) != GENERATOR_HTML_SHA:
        raise ValueError("Pinned generator HTML differs")
    with zipfile.ZipFile(icons_zip) as archive:
        masters = [name for name in archive.namelist()
                   if name.startswith(ICON_PREFIX) and name.endswith(".png")]
        if len(masters) != 35:
            raise ValueError("Expected 35 pinned terrain masters")
    level = next(item for item in json.loads(levels_path.read_text(encoding="utf-8"))["levels"]
                 if item["id"] == SCENARIO)
    cells = cells_for(level)
    source = {"contentCommit": CONTENT_SHA, "generatorZipSha256": GENERATOR_ZIP_SHA,
              "generatorHtmlSha256": GENERATOR_HTML_SHA, "iconArchiveSha256": ICON_ZIP_SHA,
              "levelBundleSha256": LEVEL_SOURCE_SHA, "levelSemanticSha256": sha(stable(level))}
    contract = {"schemaVersion": 1, "scenario": SCENARIO, "profile": PROFILE,
                "playable": True, "geometry": [12, 8, "odd-row-right", "pointy-hex"],
                "visualVersion": "generator-levelToCfg-v1",
                "visualMetadata": {"overlays": [], "urbanVariantOverrides": []},
                "source": source,
                "level": level, "cells": cells,
                "render": {"tileWidth": 192, "canvasPx": [2400, 1386],
                           "imageFormat": "image/webp", "webpQuality": 0.85,
                           "pngOriginalRequired": True}}
    contract["fingerprint"] = sha(stable(contract))
    diagnostic_root = Path(__file__).resolve().parents[3] / ".tools"
    if diagnostic_root.resolve() not in output_dir.resolve().parents:
        raise ValueError("Specialists probe output must stay inside project .tools")
    if output_dir.exists():
        raise ValueError("Use a fresh isolated output directory")
    output_dir.mkdir(parents=True)
    (output_dir / "generator.html").write_bytes(generator)
    (output_dir / "level.json").write_bytes(json.dumps(level, ensure_ascii=False,
                                                       separators=(",", ":")).encode("utf-8"))
    (output_dir / "contract.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "harness.html").write_bytes(Path(__file__).with_name("harness-specialists.html").read_bytes())
    receipt = {"scenario": SCENARIO, "contentPin": CONTENT_SHA,
               "contractFingerprint": contract["fingerprint"],
               "contractSha256": sha((output_dir / "contract.json").read_bytes()),
               "files": ["generator.html", "level.json", "contract.json", "harness.html"],
               "scope": "Isolated Specialists 192 px generator input; image pending independent render"}
    (output_dir / "harness-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
