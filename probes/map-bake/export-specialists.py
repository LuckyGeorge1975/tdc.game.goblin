"""Install only the independently approved Specialists 192 px bake.

Usage: python export-specialists.py RENDER_REPORT CONTRACT_JSON WEBP PNG
All inputs are pinned; this script never renders or changes the Terrain Course bake.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEVELS = ROOT / "assets/unit-art/levels/showcase-levels.json"
OUTPUT = ROOT / "assets/map-bakes"
SOURCE = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
LEVEL_SOURCE_SHA = "eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140"
LEVEL_SEMANTIC_SHA = "b06f113b9021593a95e7c6657c91113a5d88d6f1d7ad88c72e8c937fa9aa07e4"
GENERATOR_SHA = "47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385"
ARCHIVE_SHA = "7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a"
CONTRACT_SHA = "a17da5326c2ecdf613f44ea2ac84ef2a42b0c9175d07cee7a174c083a3864853"
CONTRACT_FINGERPRINT = "8f2fb7de4ecb0e322adaf233b8b6c40ac41065fc1f60c7d9a6199ce359c74ca0"
REPORT_SHA = "068a9139c5666225c2f2a4f446de2dcd79be90b62b8327c3ef5eb7660c6d8d60"
WEBP_SHA = "4fb50c38bc308a3f5c08ba8b9d166376934a2a960844accc87a687b4126cc747"
PNG_SHA = "4569b09f28e04c767effe061c21ccd7cbf357c08acc057d30a4a7c8270c80a4d"
KEY_SHA = "1b67cf4081eced7e79ddffd5d97a870c2f0c8a884043edde2e42cb2efda7b1c9"
PROFILE = "FIELD_TEST_LEGACY_v1"
SCENARIO = "showcase-specialists"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def main(report_path, contract_path, webp_path, png_path):
    if sha(report_path.read_bytes()) != REPORT_SHA:
        raise ValueError("Approved Specialists render report differs")
    if sha(contract_path.read_bytes()) != CONTRACT_SHA:
        raise ValueError("Pinned Specialists contract differs")
    if sha(LEVELS.read_bytes()) != LEVEL_SOURCE_SHA:
        raise ValueError("Pinned showcase level bundle differs")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    level = next(item for item in json.loads(LEVELS.read_text(encoding="utf-8"))["levels"]
                 if item["id"] == SCENARIO)
    image = webp_path.read_bytes()
    png = png_path.read_bytes()
    if (report["candidate"] != "753ec6c10d902d074b8ff06cec293d93ee185ae8" or
        report["scenario"] != SCENARIO or report["profile"] != PROFILE or
        report["sourcePin"] != SOURCE or report["contractFingerprint"] != CONTRACT_FINGERPRINT or
        report["contractSha256"] != CONTRACT_SHA or
        report["parameters"] != {"tilePx": 192, "canvasPx": [2400, 1386], "webpQuality": 0.85} or
        report["savedArtifactsFromRun"] != 2 or len(report["runs"]) != 2 or
        report["repeatability"] != {"pngHashesMatch": True, "webpHashesMatch": True} or
        any(run["webpBytes"] != 538068 or run["webpSha256"] != WEBP_SHA or
            run["pngBytes"] != 6656954 or run["pngSha256"] != PNG_SHA
            for run in report["runs"]) or
        sha(image) != WEBP_SHA or len(image) != 538068 or
        sha(png) != PNG_SHA or len(png) != 6656954):
        raise ValueError("Approved Specialists render or image differs")
    artifacts = {entry["format"]: entry for entry in report["savedArtifacts"]}
    if (set(artifacts) != {"PNG", "WebP"} or
        artifacts["PNG"]["sha256"] != PNG_SHA or artifacts["PNG"]["bytes"] != len(png) or
        artifacts["WebP"]["sha256"] != WEBP_SHA or artifacts["WebP"]["bytes"] != len(image) or
        artifacts["PNG"]["dimensions"] != [2400, 1386] or
        artifacts["WebP"]["dimensions"] != [2400, 1386] or
        contract["fingerprint"] != CONTRACT_FINGERPRINT or contract["scenario"] != SCENARIO or
        contract["profile"] != PROFILE or len(contract["cells"]) != 96 or
        contract["level"] != level or sha(stable(level)) != LEVEL_SEMANTIC_SHA or
        contract["source"]["contentCommit"] != SOURCE or
        contract["source"]["generatorHtmlSha256"] != GENERATOR_SHA or
        contract["source"]["iconArchiveSha256"] != ARCHIVE_SHA or
        contract["source"]["levelBundleSha256"] != LEVEL_SOURCE_SHA or
        contract["source"]["levelSemanticSha256"] != LEVEL_SEMANTIC_SHA or
        contract["visualVersion"] != "generator-levelToCfg-v1" or
        contract["visualMetadata"] != {"overlays": [], "urbanVariantOverrides": []}):
        raise ValueError("Pinned Specialists source, profile or visual contract differs")
    cells = [[level["defaultTerrain"] for _ in range(12)] for _ in range(8)]
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
    by_position = {(cell["x"], cell["y"]): cell for cell in contract["cells"]}
    if (len(by_position) != 96 or by_position[6, 3]["roadEdges"] != [0, 3] or
        by_position[6, 3]["riverEdges"] != [2] or
        by_position[7, 3]["roadEdges"] != [3] or
        by_position[7, 3]["neighbors"][5] != "urban"):
        raise ValueError("Specialists route contract differs")
    source = [SOURCE, LEVEL_SOURCE_SHA, LEVEL_SEMANTIC_SHA, GENERATOR_SHA, ARCHIVE_SHA,
              CONTRACT_FINGERPRINT, CONTRACT_SHA]
    key = {
        "scenarioId": SCENARIO, "scenarioVersion": level.get("scenarioVersion", 1),
        "profileId": level.get("ruleProfileId", PROFILE),
        "geometry": [12, 8, 34, 58, 48, "odd-row-right", "pointy-hex"],
        "defaultTerrain": level["defaultTerrain"], "cells": cells, "visualCells": visual_cells,
        "level": level,
        "visual": {"version": contract["visualVersion"], "urbanVariant": "generator-levelToCfg-v1",
                   "overlays": "canonical-road-river-bridge-only", "metadata": []},
        "source": source, "export": [192, 2400, 1386, "image/webp", 0.85],
    }
    key_text = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
    if sha(key_text.encode()) != KEY_SHA:
        raise ValueError("Pinned Specialists export fingerprint differs")
    manifest = {"schemaVersion": 1, "key": key_text, "keySha256": sha(key_text.encode()),
                "image": "assets/map-bakes/showcase-specialists-192.webp",
                "imageSha256": WEBP_SHA, "imageBytes": len(image), "width": 2400, "height": 1386,
                "sourceReport": "probes/map-bake/SPECIALISTS.md",
                "renderReport": "goblin-nbg.12.2/.tools/diagnose-nbg-12-2/render-report.json",
                "pngOriginalSha256": PNG_SHA}
    if (OUTPUT / "showcase-specialists-192.webp").exists() or (OUTPUT / "showcase-specialists-192.json").exists():
        raise ValueError("Specialists export already exists")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "showcase-specialists-192.webp").write_bytes(image)
    (OUTPUT / "showcase-specialists-192.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"keySha256": manifest["keySha256"], "imageSha256": WEBP_SHA,
                      "imageBytes": len(image)}, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
