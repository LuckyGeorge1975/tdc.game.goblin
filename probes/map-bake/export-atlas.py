"""Install only the independently approved Atlas 192 px WebP and manifest.

Usage: python -B export-atlas.py RENDER_REPORT CONTRACT_JSON WEBP PNG
Every input is checked before either output is written. No rendering occurs here.
"""
import hashlib
import json
import runpy
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEVEL = ROOT / "assets/unit-art/levels/atlas-proving-grounds.json"
OUTPUT = ROOT / "assets/map-bakes"
SOURCE = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
PROFILE = "FIELD_TEST_LEGACY_v1"
UNIT_DATA_PROFILE = "field-test-atlas-v1"
SCENARIO = "atlas-proving-grounds"
LEVEL_SHA = "1f4e6a6303e9e835f41556e57595cf6d2646bb30d028fb412e090b7ff223673d"
LEVEL_SEMANTIC_SHA = "eb2388bbf56c848ce6898378f399fd842a8449b2992ac7d517cd1a388758fb18"
GENERATOR_ZIP_SHA = "0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2"
GENERATOR_SHA = "47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385"
ARCHIVE_SHA = "7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a"
PROFILE_SHA = "5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad"
MANIFEST_SOURCE_SHA = "a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce"
LOADER_SOURCE_SHA = "03810e397afcfcda6e10bdb3933bdc3b2a871ac45e7fbd2eaac92f1fe3ddb66b"
CONTRACT_SHA = "127b06239a4fc81d249b39b00ca285e8d0b2b6dd73fe8ee2d897e22ac5a4e64d"
CONTRACT_FINGERPRINT = "612b1b8c29c68f973758d24739f78dd30efaef9028bcfb9efa97febf15e98bcb"
REPORT_SHA = "35c74d3af3ae6a646fe3df5438e4e99d0de4cdc6bf238655c73076a9cf8fed3e"
WEBP_SHA = "ceec086c39fef8c85cda01f445e61c577ee2576579c861e1bad02a5a148b9114"
PNG_SHA = "a4ff77758d36842c8ede2e6c1aec174b54c534e61b7b7aa274ad390fef54575b"
WEBP_BYTES = 543180
PNG_BYTES = 6723844
KEY_SHA = "ec1cb67ce9e42f8e0f391b1574e0b58200f13b5ba72322aaed50e396de136e14"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def dimensions(png, webp):
    if png[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
        raise ValueError("PNG header differs")
    png_size = struct.unpack(">II", png[16:24])
    if (webp[:4] != b"RIFF" or webp[8:16] != b"WEBPVP8X" or
        struct.unpack("<I", webp[4:8])[0] != len(webp) - 8):
        raise ValueError("WebP header differs")
    webp_size = (int.from_bytes(webp[24:27], "little") + 1,
                 int.from_bytes(webp[27:30], "little") + 1)
    if png_size != (2400, 1386) or webp_size != (2400, 1386):
        raise ValueError("Atlas image dimensions differ")


def main(report_path, contract_path, webp_path, png_path):
    if sha(report_path.read_bytes()) != REPORT_SHA:
        raise ValueError("Approved Atlas render report differs")
    if sha(contract_path.read_bytes()) != CONTRACT_SHA:
        raise ValueError("Pinned Atlas contract differs")
    if sha(LEVEL.read_bytes()) != LEVEL_SHA:
        raise ValueError("Pinned Atlas level differs")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    level = json.loads(LEVEL.read_text(encoding="utf-8"))
    webp = webp_path.read_bytes()
    png = png_path.read_bytes()
    if (sha(webp) != WEBP_SHA or len(webp) != WEBP_BYTES or
        sha(png) != PNG_SHA or len(png) != PNG_BYTES):
        raise ValueError("Approved Atlas images differ")
    dimensions(png, webp)
    expected_source = {
        "contentCommit": SOURCE, "generatorZipSha256": GENERATOR_ZIP_SHA,
        "generatorHtmlSha256": GENERATOR_SHA, "iconArchiveSha256": ARCHIVE_SHA,
        "levelSha256": LEVEL_SHA, "levelSemanticSha256": LEVEL_SEMANTIC_SHA,
        "unitProfileSha256": PROFILE_SHA,
        "scenarioManifestSha256": MANIFEST_SOURCE_SHA,
        "atlasLoaderSha256": LOADER_SOURCE_SHA}
    if (report["candidate"] != "518f67eaa4acb69dd6cc1fefed1fe86162acae5e" or
        report["scenario"] != SCENARIO or report["contentPin"] != SOURCE or
        report["ruleProfile"] != PROFILE or report["unitDataProfile"] != UNIT_DATA_PROFILE or
        report["contractFingerprint"] != CONTRACT_FINGERPRINT or
        report["contractSha256"] != CONTRACT_SHA or
        report["semanticLevelHash"] != LEVEL_SEMANTIC_SHA or
        report["sourceHashes"] != {key: value for key, value in expected_source.items()
                                    if key != "contentCommit" and key != "generatorHtmlSha256" and
                                    key != "levelSemanticSha256"} or
        report["cellCount"] != 96 or report["explicitTerrainEntries"] != 26 or
        report["parameters"] != {"tileWidthPx": 192, "canvasPx": [2400, 1386],
                                  "webpQuality": 0.85} or
        report["savedRun"] != 2 or len(report["runs"]) != 2 or
        report["repeatability"] != {"pngHashesMatch": True, "webpHashesMatch": True} or
        any(run["pngBytes"] != PNG_BYTES or run["pngSha256"] != PNG_SHA or
            run["webpBytes"] != WEBP_BYTES or run["webpSha256"] != WEBP_SHA
            for run in report["runs"])):
        raise ValueError("Approved Atlas render report differs semantically")
    artifacts = {entry["format"].upper(): entry for entry in report["savedFiles"]}
    if (set(artifacts) != {"PNG", "WEBP"} or
        any(artifacts[kind]["sha256"] != digest or artifacts[kind]["bytes"] != size or
            artifacts[kind]["dimensions"] != [2400, 1386]
            for kind, digest, size in (("PNG", PNG_SHA, PNG_BYTES), ("WEBP", WEBP_SHA, WEBP_BYTES)))):
        raise ValueError("Saved Atlas artifacts differ")
    if (contract["fingerprint"] != CONTRACT_FINGERPRINT or
        sha(stable({k: v for k, v in contract.items() if k != "fingerprint"})) != CONTRACT_FINGERPRINT or
        contract["scenario"] != SCENARIO or contract["profile"] != PROFILE or
        contract["unitDataProfile"] != UNIT_DATA_PROFILE or contract["scenarioVersion"] != 1 or
        contract["playable"] is not True or contract["geometry"] != [12, 8, "odd-row-right", "pointy-hex"] or
        contract["source"] != expected_source or contract["level"] != level or
        sha(stable(level)) != LEVEL_SEMANTIC_SHA or
        contract["visualVersion"] != "generator-levelToCfg-v1" or
        contract["visualMetadata"] != {"overlays": [], "urbanVariantOverrides": []} or
        contract["render"] != {"tileWidth": 192, "canvasPx": [2400, 1386],
                               "imageFormat": "image/webp", "webpQuality": 0.85,
                               "pngOriginalRequired": True}):
        raise ValueError("Pinned Atlas source, profile or visual contract differs")
    prepared = runpy.run_path(str(Path(__file__).with_name("prepare-atlas.py")))
    cells = prepared["cells_for"](level)
    if contract["cells"] != cells:
        raise ValueError("Atlas canonical cells differ")
    grid = [[level["defaultTerrain"] for _ in range(12)] for _ in range(8)]
    visual_cells = [[None for _ in range(12)] for _ in range(8)]
    for cell in cells:
        x, y = cell["x"], cell["y"]
        grid[y][x] = cell["type"]
        visual_cells[y][x] = [cell["forestOpenMask"], cell["roadEdges"],
                              cell["riverEdges"], cell["urbanVariant"]]
    source = [SOURCE, LEVEL_SHA, LEVEL_SEMANTIC_SHA, GENERATOR_ZIP_SHA,
              GENERATOR_SHA, ARCHIVE_SHA, PROFILE_SHA, MANIFEST_SOURCE_SHA,
              LOADER_SOURCE_SHA, CONTRACT_FINGERPRINT, CONTRACT_SHA]
    key = {
        "scenarioId": SCENARIO, "scenarioVersion": 1, "profileId": PROFILE,
        "unitDataProfile": UNIT_DATA_PROFILE,
        "geometry": [12, 8, 34, 58, 48, "odd-row-right", "pointy-hex"],
        "defaultTerrain": level["defaultTerrain"], "cells": grid,
        "visualCells": visual_cells, "level": level,
        "visual": {"version": contract["visualVersion"],
                   "urbanVariant": "generator-levelToCfg-v1",
                   "overlays": "canonical-road-river-bridge-only", "metadata": []},
        "source": source, "export": [192, 2400, 1386, "image/webp", 0.85]}
    key_text = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
    if sha(key_text.encode("utf-8")) != KEY_SHA:
        raise ValueError("Pinned Atlas export fingerprint differs")
    manifest = {
        "schemaVersion": 1, "key": key_text, "keySha256": KEY_SHA,
        "image": "assets/map-bakes/atlas-proving-grounds-192.webp",
        "imageSha256": WEBP_SHA, "imageBytes": WEBP_BYTES,
        "width": 2400, "height": 1386,
        "sourceReport": "probes/map-bake/ATLAS.md",
        "renderReport": "goblin-nbg.12.5/.tools/diagnose-nbg-12-5/render-report.json",
        "pngOriginalSha256": PNG_SHA}
    image_out = OUTPUT / "atlas-proving-grounds-192.webp"
    manifest_out = OUTPUT / "atlas-proving-grounds-192.json"
    if image_out.exists() or manifest_out.exists():
        raise ValueError("Atlas export already exists")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image_out.write_bytes(webp)
    manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"keySha256": manifest["keySha256"], "imageSha256": WEBP_SHA,
                      "imageBytes": WEBP_BYTES}, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
