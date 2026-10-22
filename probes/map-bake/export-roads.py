"""Install one independently verified Siege or Supercover 192 px WebP and manifest.

Usage: python -B export-roads.py SCENARIO VERIFIED_RECEIPT RENDER_REPORT CONTRACT_JSON WEBP PNG
Every pinned input is checked before output. No browser or generator runs here.
"""
import hashlib
import json
import runpy
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEVELS = ROOT / "assets/unit-art/levels/showcase-levels.json"
OUTPUT = ROOT / "assets/map-bakes"
SOURCE = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
RECEIPT_SHA = "d57769b878b9df863a3a489147aa9a6719ddcb6429c735c6863c833fd95c15bf"
LEVEL_BUNDLE_SHA = "eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140"
GENERATOR_ZIP_SHA = "0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2"
GENERATOR_SHA = "47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385"
ARCHIVE_SHA = "7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a"
PROFILE_SHA = "5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad"
MANIFEST_SOURCE_SHA = "a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce"
LOADER_SOURCE_SHA = "159f286acbd46f17d19ef817c47427fb2c04811e925fff4199c4136804c56727"
INTEGRATED_LOADER_SHA = "0739819875d52163d32d8167eedd83c8eb1d1bed916f8ad00e4105e669b8af1a"
UNIT_DATA_PROFILE = "field-test-atlas-v1"
PINS = {
    "showcase-siege": {
        "profile": "FIELD_TEST_LEGACY_v1", "losMode": None,
        "levelSemanticSha256": "4eaa4dbc62ea06057a92bd276f6e3734cdbfd431ec8c64fda3db51e085045204",
        "contractSha256": "eb4d7338a014b2ec7374b67062dccd12e164c95fbcd30e4cda823c3e0aec09e3",
        "fingerprint": "05f763f2b6e73eb34d6ef82cbf16de7c7ac0b8f8eca2928831446ab4157e11ce",
        "reportSha256": "430e6fa9682988086ba2c6654c30fdeb50fc797b165bfc17539962a245435b95",
        "pngSha256": "5c3d72414e366636a64366aa03e54ef9605cf2b02a048d36de5072db4c413b35",
        "pngBytes": 6639160,
        "webpSha256": "b44d8b607cdcb4c4eae71a6a3c8c1aed197b716f7908e272c221dae3f95abdb4",
        "webpBytes": 548576,
        "keySha256": "3a2ccfe314aeb8f3885682924dad295cdcf83fba83f75c54d45714b85c6fb38b",
        "runs": 2},
    "los-supercover-showcase": {
        "profile": "FIELD_TEST_SUPERCOVER_v1", "losMode": "strict-supercover",
        "levelSemanticSha256": "d3d235e0f69c3bdd9ab182f2d7937ababdd016cfe1d161946d44100d96ef883f",
        "contractSha256": "cdcafbb94ca7e4c08e7694e68a74379ec79cc433d94591a173283942aa67d69e",
        "fingerprint": "3286ef8baa56417c58be12a5899470b1c4221a926c24e7d4d82c7831e6929bb6",
        "reportSha256": "b3ae0d3c60b1230eea018b5363a21e7b9e802df19aad64f682d36ce958a1ae50",
        "pngSha256": "749ec6be33aeeffb5dee54617f2d9e4e66749f410b175cf66f334670dd5db6cf",
        "pngBytes": 6678113,
        "webpSha256": "b886a662f9c878cd603dde3090866b679d6eb74510b84777322edceedd1c06a6",
        "webpBytes": 540976,
        "keySha256": "d41b2eb4135a4d83dc82fa7ebd9fdfb3389ed319e0b04feadd3a3e0015715ec1",
        "runs": 3}}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def check_dimensions(png, webp):
    if png[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
        raise ValueError("PNG header differs")
    png_size = struct.unpack(">II", png[16:24])
    if (webp[:4] != b"RIFF" or webp[8:16] != b"WEBPVP8X" or
        struct.unpack("<I", webp[4:8])[0] != len(webp) - 8):
        raise ValueError("WebP header differs")
    webp_size = (int.from_bytes(webp[24:27], "little") + 1,
                 int.from_bytes(webp[27:30], "little") + 1)
    if png_size != (2400, 1386) or webp_size != (2400, 1386):
        raise ValueError("Road image dimensions differ")


def main(scenario, receipt_path, report_path, contract_path, webp_path, png_path):
    if scenario not in PINS:
        raise ValueError("Only Siege and Supercover exports are approved")
    pin = PINS[scenario]
    if sha(receipt_path.read_bytes()) != RECEIPT_SHA:
        raise ValueError("Verified render receipt differs")
    if sha(report_path.read_bytes()) != pin["reportSha256"]:
        raise ValueError("Approved mission render report differs")
    if sha(contract_path.read_bytes()) != pin["contractSha256"]:
        raise ValueError("Pinned mission contract differs")
    if sha(LEVELS.read_bytes()) != LEVEL_BUNDLE_SHA:
        raise ValueError("Pinned showcase level bundle differs")
    checkout = Path(__file__).resolve().parents[2]
    for relative, digest in (("assets/unit-art/rules/unit-profiles.v1.json", PROFILE_SHA),
                             ("scenario-profile-manifest.js", MANIFEST_SOURCE_SHA)):
        if sha((checkout / relative).read_bytes()) != digest:
            raise ValueError("Pinned runtime profile source differs")
    if sha((checkout / "atlas-level.js").read_bytes()) not in {LOADER_SOURCE_SHA, INTEGRATED_LOADER_SHA}:
        raise ValueError("Pinned road probe/integrated loader differs")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    report = json.loads(report_path.read_text(encoding="utf-8"))
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    level = next(item for item in json.loads(LEVELS.read_text(encoding="utf-8"))["levels"]
                 if item["id"] == scenario)
    webp, png = webp_path.read_bytes(), png_path.read_bytes()
    if (sha(webp) != pin["webpSha256"] or len(webp) != pin["webpBytes"] or
        sha(png) != pin["pngSha256"] or len(png) != pin["pngBytes"]):
        raise ValueError("Approved mission images differ")
    check_dimensions(png, webp)
    receipt_missions = {item["scenario"]: item for item in receipt["missions"]}
    if (receipt["probeCommit"] != "b1964a2596922aefa487cb92e1334fffdbda2df9" or
        receipt["contentSourcePin"] != SOURCE or
        set(receipt_missions) != set(PINS) or
        receipt_missions[scenario]["contractSha256"] != pin["contractSha256"] or
        receipt_missions[scenario]["fingerprint"] != pin["fingerprint"] or
        receipt_missions[scenario]["profile"] != pin["profile"] or
        receipt_missions[scenario]["unitDataProfile"] != UNIT_DATA_PROFILE or
        receipt_missions[scenario]["losMode"] != pin["losMode"] or
        receipt_missions[scenario]["cells"] != 96 or
        receipt_missions[scenario]["repeatHashesMatch"] is not True or
        len(receipt_missions[scenario]["renders"]) != pin["runs"] or
        any(run["pngBytes"] != pin["pngBytes"] or run["pngSha256"] != pin["pngSha256"] or
            run["webpBytes"] != pin["webpBytes"] or run["webpSha256"] != pin["webpSha256"] or
            run["dimensions"] != [2400, 1386]
            for run in receipt_missions[scenario]["renders"])):
        raise ValueError("Verified mission receipt differs semantically")
    if (report["scenario"] != scenario or report["playable"] is not True or
        report["profile"] != pin["profile"] or report["unitDataProfile"] != UNIT_DATA_PROFILE or
        report["losMode"] != pin["losMode"] or report["contentPin"] != SOURCE or
        report["contractFingerprint"] != pin["fingerprint"] or
        report["width"] != 192 or report["size"] != [2400, 1386] or
        report["pngBytes"] != pin["pngBytes"] or report["pngSha256"] != pin["pngSha256"] or
        report["webpBytes"] != pin["webpBytes"] or report["webpSha256"] != pin["webpSha256"]):
        raise ValueError("Mission render report differs semantically")
    expected_source = {
        "contentCommit": SOURCE, "generatorZipSha256": GENERATOR_ZIP_SHA,
        "generatorHtmlSha256": GENERATOR_SHA, "iconArchiveSha256": ARCHIVE_SHA,
        "levelBundleSha256": LEVEL_BUNDLE_SHA,
        "levelSemanticSha256": pin["levelSemanticSha256"],
        "unitProfileSha256": PROFILE_SHA,
        "scenarioManifestSha256": MANIFEST_SOURCE_SHA,
        "atlasLoaderSha256": LOADER_SOURCE_SHA}
    if (contract["schemaVersion"] != 1 or contract["fingerprint"] != pin["fingerprint"] or
        sha(stable({key: value for key, value in contract.items() if key != "fingerprint"})) != pin["fingerprint"] or
        contract["scenario"] != scenario or contract["profile"] != pin["profile"] or
        contract["unitDataProfile"] != UNIT_DATA_PROFILE or contract["losMode"] != pin["losMode"] or
        contract["scenarioVersion"] != 1 or contract["playable"] is not True or
        contract["geometry"] != [12, 8, "odd-row-right", "pointy-hex"] or
        contract["source"] != expected_source or contract["level"] != level or
        sha(stable(level)) != pin["levelSemanticSha256"] or
        contract["visualVersion"] != "generator-levelToCfg-v1" or
        contract["visualMetadata"] != {"overlays": [], "urbanVariantOverrides": []} or
        contract["render"] != {"tileWidth": 192, "canvasPx": [2400, 1386],
                               "imageFormat": "image/webp", "webpQuality": 0.85,
                               "pngOriginalRequired": True}):
        raise ValueError("Mission contract source, profile or render differs")
    prepared = runpy.run_path(str(Path(__file__).with_name("prepare-roads.py")))
    cells = prepared["cells_for"](level, prepared["MISSIONS"][scenario])
    if contract["cells"] != cells:
        raise ValueError("Mission canonical cells differ")
    grid = [[level["defaultTerrain"] for _ in range(12)] for _ in range(8)]
    visual_cells = [[None for _ in range(12)] for _ in range(8)]
    for cell in cells:
        x, y = cell["x"], cell["y"]
        grid[y][x] = cell["type"]
        visual_cells[y][x] = [cell["forestOpenMask"], cell["roadEdges"],
                              cell["riverEdges"], cell["urbanVariant"]]
    source = [SOURCE, LEVEL_BUNDLE_SHA, pin["levelSemanticSha256"], GENERATOR_ZIP_SHA,
              GENERATOR_SHA, ARCHIVE_SHA, PROFILE_SHA, MANIFEST_SOURCE_SHA,
              LOADER_SOURCE_SHA, pin["fingerprint"], pin["contractSha256"]]
    key = {
        "scenarioId": scenario, "scenarioVersion": 1, "profileId": pin["profile"],
        "unitDataProfile": UNIT_DATA_PROFILE,
        **({"losMode": pin["losMode"]} if pin["losMode"] else {}),
        "geometry": [12, 8, 34, 58, 48, "odd-row-right", "pointy-hex"],
        "defaultTerrain": level["defaultTerrain"], "cells": grid,
        "visualCells": visual_cells, "level": level,
        "visual": {"version": contract["visualVersion"],
                   "urbanVariant": "generator-levelToCfg-v1",
                   "overlays": "canonical-road-river-bridge-only", "metadata": []},
        "source": source, "export": [192, 2400, 1386, "image/webp", 0.85]}
    key_text = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
    if sha(key_text.encode("utf-8")) != pin["keySha256"]:
        raise ValueError("Pinned mission export fingerprint differs")
    manifest = {"schemaVersion": 1, "key": key_text, "keySha256": pin["keySha256"],
                "image": f"assets/map-bakes/{scenario}-192.webp",
                "imageSha256": pin["webpSha256"], "imageBytes": pin["webpBytes"],
                "width": 2400, "height": 1386,
                "sourceReport": "probes/map-bake/ROADS.md",
                "renderReport": f"goblin-nbg.12.8/.tools/diagnose-nbg-12-8/{'siege' if scenario == 'showcase-siege' else 'supercover'}/run-2/render-report.json",
                "pngOriginalSha256": pin["pngSha256"]}
    image_out = OUTPUT / f"{scenario}-192.webp"
    manifest_out = OUTPUT / f"{scenario}-192.json"
    if image_out.exists() or manifest_out.exists():
        raise ValueError("Mission export already exists")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image_out.write_bytes(webp)
    manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"scenario": scenario, "keySha256": manifest["keySha256"],
                      "imageSha256": pin["webpSha256"], "imageBytes": pin["webpBytes"]}, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 7:
        raise SystemExit(__doc__)
    main(sys.argv[1], *(Path(arg) for arg in sys.argv[2:]))
