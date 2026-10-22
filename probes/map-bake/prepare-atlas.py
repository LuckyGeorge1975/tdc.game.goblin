"""Prepare only the pinned Atlas generator probe in an isolated directory.

Usage: python prepare-atlas.py GENERATOR_ZIP ICONS_ZIP ATLAS_LEVEL_JSON OUTPUT_DIR
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
LEVEL_SOURCE_SHA = "1f4e6a6303e9e835f41556e57595cf6d2646bb30d028fb412e090b7ff223673d"
PROFILE_SOURCE_SHA = "5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad"
MANIFEST_SOURCE_SHA = "a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce"
LOADER_SOURCE_SHA = "03810e397afcfcda6e10bdb3933bdc3b2a871ac45e7fbd2eaac92f1fe3ddb66b"
GENERATOR_MEMBER = "design-exports/uebergabe-karte/karte-generator.html"
ICON_PREFIX = "design-exports/uebergabe-karte/icons-terrain/"
PROFILE = "FIELD_TEST_LEGACY_v1"
SCENARIO = "atlas-proving-grounds"
UNIT_DATA_PROFILE = "field-test-atlas-v1"
EVEN = ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1))
ODD = ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1))
TYPES = {"open-ground", "forest", "mountain", "ridge", "water", "marsh",
         "rubble-field", "crater", "urban", "road", "river", "bridge"}
EXPECTED_TERRAIN = {
    (5, 0, "open-ground"), (5, 1, "rubble-field"), (3, 4, "rubble-field"),
    (4, 2, "mountain"), (5, 2, "mountain"), (7, 3, "ridge"), (8, 3, "ridge"),
    (4, 0, "forest"), (4, 1, "forest"), (5, 7, "marsh"), (6, 7, "marsh"),
    (6, 0, "water"), (7, 0, "water"), (6, 1, "river"), (6, 2, "river"),
    (6, 4, "river"), (6, 5, "river"), (4, 3, "road"), (5, 3, "road"),
    (7, 5, "road"), (8, 5, "road"), (6, 3, "bridge"), (9, 1, "urban"),
    (10, 2, "urban"), (7, 4, "crater"), (8, 4, "crater")}


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
        raise ValueError("Pinned Atlas level/profile/terrain differs")
    grid = [[level["defaultTerrain"] for _ in range(12)] for _ in range(8)]
    for cell in level["terrain"]:
        x, y, kind = cell["x"], cell["y"], cell["type"]
        if not (0 <= x < 12 and 0 <= y < 8) or kind not in TYPES:
            raise ValueError("Invalid Atlas terrain cell")
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
        by_position[6, 3]["roadEdges"] != [3] or
        by_position[6, 3]["riverEdges"] != [2, 4] or
        by_position[6, 3]["neighbors"][0] != "ridge" or
        by_position[7, 3]["type"] != "ridge" or
        by_position[7, 5]["roadEdges"] != [0] or
        by_position[8, 5]["roadEdges"] != [3] or
        by_position[6, 1]["riverEdges"] != [2, 4, 5] or
        by_position[6, 2]["riverEdges"] != [1, 5] or
        by_position[6, 4]["riverEdges"] != [1, 5] or
        by_position[6, 5]["riverEdges"] != [4]):
        raise ValueError("Atlas bridge, separate road, water or river end differs")
    return cells


def main(generator_zip, icons_zip, levels_path, output_dir):
    if sha(generator_zip.read_bytes()) != GENERATOR_ZIP_SHA:
        raise ValueError("Pinned generator archive differs")
    if sha(icons_zip.read_bytes()) != ICON_ZIP_SHA:
        raise ValueError("Pinned terrain master archive differs")
    if sha(levels_path.read_bytes()) != LEVEL_SOURCE_SHA:
        raise ValueError("Pinned Atlas level differs")
    checkout = Path(__file__).resolve().parents[2]
    profile_path = checkout / "assets/unit-art/rules/unit-profiles.v1.json"
    manifest_path = checkout / "scenario-profile-manifest.js"
    loader_path = checkout / "atlas-level.js"
    if (sha(profile_path.read_bytes()) != PROFILE_SOURCE_SHA or
        sha(manifest_path.read_bytes()) != MANIFEST_SOURCE_SHA or
        sha(loader_path.read_bytes()) != LOADER_SOURCE_SHA):
        raise ValueError("Pinned Atlas runtime profile sources differ")
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    manifest = manifest_path.read_text(encoding="utf-8")
    loader = loader_path.read_text(encoding="utf-8")
    if (profile["legacyProfile"] != UNIT_DATA_PROFILE or profile["targetActive"] is not False or
        "'atlas-proving-grounds':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData})" not in manifest or
        "const product='FIELD_TEST_LEGACY_v1'" not in manifest or
        "const atlasData='field-test-atlas-v1'" not in manifest or
        "ruleProfileId:level.ruleProfileId??'FIELD_TEST_LEGACY_v1'" not in loader):
        raise ValueError("Atlas effective runtime profile differs")
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
    level = json.loads(levels_path.read_text(encoding="utf-8"))
    if "ruleProfileId" in level or "scenarioVersion" in level:
        raise ValueError("Atlas raw level gained an explicit profile/version")
    cells = cells_for(level)
    source = {"contentCommit": CONTENT_SHA, "generatorZipSha256": GENERATOR_ZIP_SHA,
              "generatorHtmlSha256": GENERATOR_HTML_SHA, "iconArchiveSha256": ICON_ZIP_SHA,
              "levelSha256": LEVEL_SOURCE_SHA, "levelSemanticSha256": sha(stable(level)),
              "unitProfileSha256": PROFILE_SOURCE_SHA,
              "scenarioManifestSha256": MANIFEST_SOURCE_SHA,
              "atlasLoaderSha256": LOADER_SOURCE_SHA}
    contract = {"schemaVersion": 1, "scenario": SCENARIO, "profile": PROFILE,
                "unitDataProfile": UNIT_DATA_PROFILE, "scenarioVersion": 1,
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
        raise ValueError("Atlas probe output must stay inside project .tools")
    if output_dir.exists():
        raise ValueError("Use a fresh isolated output directory")
    output_dir.mkdir(parents=True)
    (output_dir / "generator.html").write_bytes(generator)
    (output_dir / "level.json").write_bytes(json.dumps(level, ensure_ascii=False,
                                                       separators=(",", ":")).encode("utf-8"))
    (output_dir / "contract.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "harness.html").write_bytes(Path(__file__).with_name("harness-atlas.html").read_bytes())
    receipt = {"scenario": SCENARIO, "contentPin": CONTENT_SHA,
               "contractFingerprint": contract["fingerprint"],
               "contractSha256": sha((output_dir / "contract.json").read_bytes()),
               "files": ["generator.html", "level.json", "contract.json", "harness.html"],
               "scope": "Isolated Atlas 192 px generator input; image pending independent render"}
    (output_dir / "harness-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
