"""Data-only map bake probe. No browser, game mutation, or image export.

Usage: python probe.py SHOWCASE_LEVELS_JSON CONTENT_ICONS_ZIP GENERATOR_HTML OUTPUT_DIR
The source ZIP and HTML must be exported from the pinned Content commit.
"""

import hashlib
import json
import math
import sys
import zipfile
from pathlib import Path


CONTENT_SHA = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
PROFILE = "FIELD_TEST_LEGACY_v1"
VISUAL_VERSION = "map-probe-v1"
TYPES = {
    "open-ground", "forest", "mountain", "ridge", "water", "marsh",
    "rubble-field", "crater", "urban", "road", "river", "bridge",
}
EVEN = ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1))
ODD = ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1))
MASTER_FOREST_MASKS = (0, 1, 3, 5, 9, 7, 11, 21, 15, 23, 27, 31, 63)
ICON_PREFIX = "design-exports/uebergabe-karte/icons-terrain/"


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":")).encode("utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bake_matches(candidate, expected):
    return isinstance(candidate, dict) and candidate.get("fingerprint") == expected


def neighbor(x, y, direction):
    dx, dy = (ODD if y & 1 else EVEN)[direction]
    return x + dx, y + dy


def variant(scenario_id, x, y):
    key = stable([VISUAL_VERSION, scenario_id, x, y])
    return int.from_bytes(hashlib.sha256(key).digest()[:4], "big") % 6


def playable_grid(level):
    w, h = level["width"], level["height"]
    if (w, h) != (12, 8) or level["defaultTerrain"] not in TYPES:
        raise ValueError("Expected the validated 12×8 terrain course")
    grid = [[level["defaultTerrain"] for _ in range(w)] for _ in range(h)]
    seen = set()
    for cell in level["terrain"]:
        x, y, kind = cell["x"], cell["y"], cell["type"]
        if not (0 <= x < w and 0 <= y < h) or kind not in TYPES or (x, y) in seen:
            raise ValueError(f"Invalid or repeated terrain cell: {cell}")
        seen.add((x, y))
        grid[y][x] = kind
    return grid


def render_test_grid():
    # Separate visual fixture: overlay sets never become playable terrain types.
    grid = [["open-ground"] * 12 for _ in range(8)]
    types = {
        (2, 2): "mountain", (3, 2): "forest", (4, 2): "forest",
        (3, 3): "forest", (4, 3): "urban", (2, 3): "water",
        (3, 4): "marsh", (5, 2): "forest", (5, 4): "urban",
        (5, 5): "water",
    }
    for y in (2, 3):
        for x in (7, 8, 9):
            types[x, y] = "urban"
    for (x, y), kind in types.items():
        grid[y][x] = kind
    overlays = {
        "road": {(2, 2), (3, 2), (4, 2), (4, 3), (5, 3), (3, 4)},
        "river": {(5, 1), (5, 2), (5, 3), (5, 4)},
    }
    urban_variants = {(x, y): i for i, (x, y) in enumerate(
        ((7, 2), (8, 2), (9, 2), (7, 3), (8, 3), (9, 3)))}
    return grid, overlays, urban_variants


def cells_for(grid, scenario_id, overlays=None, urban_variants=None):
    overlays = overlays or {"road": set(), "river": set()}
    urban_variants = urban_variants or {}
    h, w = len(grid), len(grid[0])
    result = []
    for y in range(h):
        for x in range(w):
            kind = grid[y][x]
            nearby = []
            for direction in range(6):
                nx, ny = neighbor(x, y, direction)
                nearby.append(grid[ny][nx] if 0 <= nx < w and 0 <= ny < h else None)
            road = kind in ("road", "bridge") or (x, y) in overlays["road"]
            river = kind in ("river", "bridge") or (x, y) in overlays["river"]
            road_edges, river_edges = [], []
            for direction, adjacent in enumerate(nearby):
                nx, ny = neighbor(x, y, direction)
                if road and adjacent is not None and (
                        adjacent in ("road", "bridge") or (nx, ny) in overlays["road"]):
                    road_edges.append(direction)
                if river and adjacent is not None and (
                        adjacent in ("river", "bridge", "water")
                        or (nx, ny) in overlays["river"]):
                    river_edges.append(direction)
            result.append({
                "x": x, "y": y, "type": kind, "neighbors": nearby,
                "forestOpenMask": sum(1 << d for d, adjacent in enumerate(nearby)
                                      if adjacent != "forest") if kind == "forest" else None,
                "visualRoad": road, "visualRiver": river,
                "roadEdges": road_edges, "riverEdges": river_edges,
                "urbanVariant": urban_variants.get((x, y), variant(scenario_id, x, y))
                if kind == "urban" else None,
            })
    return result


def main(level_file, icon_zip, generator_html, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    levels = json.loads(level_file.read_text(encoding="utf-8"))["levels"]
    level = next(item for item in levels if item["id"] == "showcase-terrain-course")
    test_grid, test_overlays, test_urban = render_test_grid()
    scenes = ((level["id"], playable_grid(level), None, None),
              ("render-only-test-card", test_grid, test_overlays, test_urban))
    with zipfile.ZipFile(icon_zip) as archive:
        icons = {name.removeprefix(ICON_PREFIX): {
            "sha256": sha(archive.read(name)), "bytes": len(archive.read(name))}
            for name in archive.namelist() if name.startswith(ICON_PREFIX)
            and name.endswith(".png")}
    if len(icons) != 35:
        raise ValueError(f"Expected 35 pinned terrain masters, got {len(icons)}")
    shared = {"sourceRepository": "https://github.com/LuckyGeorge1975/tdc.game.goblin.content",
              "sourceCommit": CONTENT_SHA, "profile": PROFILE,
              "levelSourceSha256": sha(level_file.read_bytes()),
              "levelSemanticSha256": sha(stable(level)),
              "iconArchiveSha256": sha(icon_zip.read_bytes()),
              "generatorHtmlSha256": sha(generator_html.read_bytes()),
              "visualVersion": VISUAL_VERSION,
              "iconBytes": sum(item["bytes"] for item in icons.values()),
              "icons": icons}
    reports = []
    for scenario_id, grid, overlays, urban_variants in scenes:
        cells = cells_for(grid, scenario_id, overlays, urban_variants)
        unsupported = sorted({cell["forestOpenMask"] for cell in cells
                              if cell["type"] == "forest"
                              and cell["forestOpenMask"] not in MASTER_FOREST_MASKS})
        scene = {"scenario": scenario_id,
                 "playable": scenario_id == level["id"],
                 "width": 12, "height": 8, "cells": cells,
                 "visualOverlays": {kind: sorted([list(point) for point in points])
                                    for kind, points in overlays.items()} if overlays else None,
                 "urbanVariantOverrides": {f"{x},{y}": value for (x, y), value
                                           in sorted(urban_variants.items())} if urban_variants else None,
                 "unsupportedForestMasks": unsupported}
        (output_dir / f"{scenario_id}.cells.json").write_bytes(stable(scene) + b"\n")
        sizes = []
        for tile_width in (192, 256):
            height = tile_width / 0.8660254
            image_size = [math.ceil(12.5 * tile_width),
                          math.ceil(height * (1 + 0.75 * 7))]
            adapter_text = Path(__file__).read_text(encoding="utf-8").replace("\r\n", "\n")
            fingerprint_source = {key: value for key, value in shared.items()
                                  if key != "levelSourceSha256"}
            fingerprint = sha(stable({"source": fingerprint_source, "scene": scene,
                                      "adapterSha256": sha(adapter_text.encode("utf-8")),
                                      "tileWidth": tile_width}))
            if (bake_matches(None, fingerprint) or bake_matches(
                    {"fingerprint": "0" * 64}, fingerprint) or not bake_matches(
                    {"fingerprint": fingerprint}, fingerprint)):
                raise AssertionError("Missing/wrong/exact fingerprint gate failed")
            sizes.append({"tileWidth": tile_width, "expectedCanvasPx": image_size,
                          "decodedRGBABytes": image_size[0] * image_size[1] * 4,
                          "expectedFingerprint": fingerprint,
                          "gate": {"missing": False, "wrong": False, "exact": True}})
        reports.append({"scenario": scenario_id, "playable": scene["playable"],
                        "cellCount": len(cells), "unsupportedForestMasks": unsupported,
                        "sizes": sizes})
    report = {"source": shared, "scenes": reports,
              "scope": "Data/fingerprint and existing master-byte probe only; no bake or load measurement"}
    (output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceCommit": CONTENT_SHA, "iconBytes": shared["iconBytes"],
                      "scenes": reports}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
