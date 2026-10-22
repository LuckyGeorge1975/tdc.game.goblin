"""Prepare one of two pinned inner-road missions for an independent 192 px render.

Usage: python -B prepare-roads.py SCENARIO GENERATOR_ZIP ICONS_ZIP SHOWCASE_LEVELS_JSON OUTPUT_DIR
Only showcase-siege and los-supercover-showcase are accepted. No browser or runtime write.
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
LEVEL_BUNDLE_SHA = "eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140"
PROFILE_SOURCE_SHA = "5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad"
MANIFEST_SOURCE_SHA = "a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce"
LOADER_SOURCE_SHA = "159f286acbd46f17d19ef817c47427fb2c04811e925fff4199c4136804c56727"
GENERATOR_MEMBER = "design-exports/uebergabe-karte/karte-generator.html"
ICON_PREFIX = "design-exports/uebergabe-karte/icons-terrain/"
UNIT_DATA_PROFILE = "field-test-atlas-v1"
EVEN = ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1))
ODD = ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1))
MISSIONS = {
    "showcase-siege": {
        "profile": "FIELD_TEST_LEGACY_v1", "losMode": None,
        "terrain": {(4, 3, "road"), (5, 3, "road"), (6, 3, "road"),
                    (7, 3, "road"), (7, 4, "rubble-field")},
        "roads": {(4, 3): [0], (5, 3): [0, 3],
                  (6, 3): [0, 3], (7, 3): [3]}},
    "los-supercover-showcase": {
        "profile": "FIELD_TEST_SUPERCOVER_v1", "losMode": "strict-supercover",
        "terrain": {(1, 1, "rubble-field"), (5, 4, "forest"),
                    (7, 2, "ridge"), (6, 3, "road"), (7, 3, "road")},
        "roads": {(6, 3): [0], (7, 3): [3]}}
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def cells_for(level, spec):
    terrain = level["terrain"]
    if (level["schemaVersion"] != 1 or level["id"] not in MISSIONS or
        (level["width"], level["height"], level["defaultTerrain"]) != (12, 8, "open-ground") or
        level["objective"] != "core-and-escort" or
        level.get("scenarioVersion", 1) != 1 or
        (level.get("ruleProfileId") if spec["losMode"] else level.get("ruleProfileId", spec["profile"])) != spec["profile"] or
        len(terrain) != len(spec["terrain"]) or
        {(cell["x"], cell["y"], cell["type"]) for cell in terrain} != spec["terrain"]):
        raise ValueError("Pinned road mission level/profile/terrain differs")
    if spec["losMode"] and (level.get("ruleProfileId") != "FIELD_TEST_SUPERCOVER_v1" or
                            level.get("scenarioVersion") != 1):
        raise ValueError("Supercover must declare its own profile and version")
    if not spec["losMode"] and ("ruleProfileId" in level or "scenarioVersion" in level):
        raise ValueError("Siege profile/version must come from the loader default")
    grid = [["open-ground" for _ in range(12)] for _ in range(8)]
    for cell in terrain:
        x, y = cell["x"], cell["y"]
        if not (0 <= x < 12 and 0 <= y < 8):
            raise ValueError("Road terrain coordinate outside board")
        grid[y][x] = cell["type"]
    cells = []
    for y in range(8):
        for x in range(12):
            kind = grid[y][x]
            adjacent = []
            for dx, dy in ODD if y & 1 else EVEN:
                nx, ny = x + dx, y + dy
                adjacent.append(grid[ny][nx] if 0 <= nx < 12 and 0 <= ny < 8 else None)
            cells.append({
                "x": x, "y": y, "type": kind, "neighbors": adjacent,
                "forestOpenMask": sum(1 << direction for direction, other in enumerate(adjacent)
                                      if other != "forest") if kind == "forest" else None,
                "roadEdges": [direction for direction, other in enumerate(adjacent)
                              if kind == "road" and other == "road"],
                "riverEdges": [],
                "urbanVariant": None})
    by_position = {(cell["x"], cell["y"]): cell for cell in cells}
    if (len(cells) != 96 or len(by_position) != 96 or
        {position: cell["roadEdges"] for position, cell in by_position.items()
         if cell["roadEdges"]} != spec["roads"] or
        any(cell["type"] in ("river", "bridge", "water") or cell["riverEdges"]
            for cell in cells)):
        raise ValueError("Pinned inner road caps or absence of river/bridge differs")
    return cells


def main(scenario, generator_zip, icons_zip, levels_path, output_dir):
    if scenario not in MISSIONS:
        raise ValueError("Only Siege and Supercover are approved for this probe")
    spec = MISSIONS[scenario]
    if sha(generator_zip.read_bytes()) != GENERATOR_ZIP_SHA:
        raise ValueError("Pinned generator archive differs")
    if sha(icons_zip.read_bytes()) != ICON_ZIP_SHA:
        raise ValueError("Pinned terrain master archive differs")
    if sha(levels_path.read_bytes()) != LEVEL_BUNDLE_SHA:
        raise ValueError("Pinned showcase level bundle differs")
    checkout = Path(__file__).resolve().parents[2]
    profile_path = checkout / "assets/unit-art/rules/unit-profiles.v1.json"
    manifest_path = checkout / "scenario-profile-manifest.js"
    loader_path = checkout / "atlas-level.js"
    if (sha(profile_path.read_bytes()) != PROFILE_SOURCE_SHA or
        sha(manifest_path.read_bytes()) != MANIFEST_SOURCE_SHA or
        sha(loader_path.read_bytes()) != LOADER_SOURCE_SHA):
        raise ValueError("Pinned runtime profile sources differ")
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    manifest = manifest_path.read_text(encoding="utf-8")
    loader = loader_path.read_text(encoding="utf-8")
    manifest_entry = ("'showcase-siege':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData})"
                      if scenario == "showcase-siege" else
                      "'los-supercover-showcase':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:'FIELD_TEST_SUPERCOVER_v1',unitDataProfile:atlasData,losMode:'strict-supercover'})")
    if (profile["legacyProfile"] != UNIT_DATA_PROFILE or profile["targetActive"] is not False or
        manifest_entry not in manifest or
        "const product='FIELD_TEST_LEGACY_v1'" not in manifest or
        "const atlasData='field-test-atlas-v1'" not in manifest or
        "ruleProfileId:level.ruleProfileId??'FIELD_TEST_LEGACY_v1'" not in loader or
        "level.id==='los-supercover-showcase'?{losMode:'strict-supercover'}:{}" not in loader or
        "ruleProfile:profile.legacyProfile" not in loader):
        raise ValueError("Effective mission rule/unit profile differs")
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
    levels = json.loads(levels_path.read_text(encoding="utf-8"))
    level = next(item for item in levels["levels"] if item["id"] == scenario)
    cells = cells_for(level, spec)
    source = {"contentCommit": CONTENT_SHA, "generatorZipSha256": GENERATOR_ZIP_SHA,
              "generatorHtmlSha256": GENERATOR_HTML_SHA, "iconArchiveSha256": ICON_ZIP_SHA,
              "levelBundleSha256": LEVEL_BUNDLE_SHA, "levelSemanticSha256": sha(stable(level)),
              "unitProfileSha256": PROFILE_SOURCE_SHA,
              "scenarioManifestSha256": MANIFEST_SOURCE_SHA,
              "atlasLoaderSha256": LOADER_SOURCE_SHA}
    contract = {"schemaVersion": 1, "scenario": scenario, "profile": spec["profile"],
                "unitDataProfile": UNIT_DATA_PROFILE, "losMode": spec["losMode"],
                "scenarioVersion": 1, "playable": True,
                "geometry": [12, 8, "odd-row-right", "pointy-hex"],
                "visualVersion": "generator-levelToCfg-v1",
                "visualMetadata": {"overlays": [], "urbanVariantOverrides": []},
                "source": source, "level": level, "cells": cells,
                "render": {"tileWidth": 192, "canvasPx": [2400, 1386],
                           "imageFormat": "image/webp", "webpQuality": 0.85,
                           "pngOriginalRequired": True}}
    contract["fingerprint"] = sha(stable(contract))
    diagnostic_root = Path(__file__).resolve().parents[3] / ".tools"
    if diagnostic_root.resolve() not in output_dir.resolve().parents:
        raise ValueError("Road probe output must stay inside project .tools")
    if output_dir.exists():
        raise ValueError("Use a fresh isolated output directory")
    harness = Path(__file__).with_name("harness-roads.html").read_text(encoding="utf-8")
    harness = harness.replace("__SCENARIO__", scenario).replace("__CONTRACT_FINGERPRINT__", contract["fingerprint"])
    output_dir.mkdir(parents=True)
    (output_dir / "generator.html").write_bytes(generator)
    (output_dir / "level.json").write_bytes(json.dumps(level, ensure_ascii=False,
                                                       separators=(",", ":")).encode("utf-8"))
    (output_dir / "contract.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "harness.html").write_text(harness, encoding="utf-8")
    receipt = {"scenario": scenario, "contentPin": CONTENT_SHA,
               "contractFingerprint": contract["fingerprint"],
               "contractSha256": sha((output_dir / "contract.json").read_bytes()),
               "files": ["generator.html", "level.json", "contract.json", "harness.html"],
               "scope": "Isolated 192 px inner-road input; image pending independent render"}
    (output_dir / "harness-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 6:
        raise SystemExit(__doc__)
    main(sys.argv[1], *(Path(arg) for arg in sys.argv[2:]))
