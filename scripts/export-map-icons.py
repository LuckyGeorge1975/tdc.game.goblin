"""Export the 52 pinned shadowless map icons from a content-source ZIP.

Run locally after content-source.ps1 Export. The game build only reads the
committed WebP files and receipt; it never needs the private source repository.
"""

import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from PIL import Image, __version__ as pillow_version


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = "design-exports/einheitengrafiken/icons-ohne-schatten"
TARGET_DIR = "assets/unit-art/sets/02-technical-illustration/map-icons"
RECEIPT = "assets/unit-art/map-icons-source.json"
SIDE_DIRS = {"eigen": "own", "gegner": "enemy"}
OUTPUT_SIZE = 192


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.source_sha):
        parser.error("--source-sha must be a full commit SHA")
    if not re.fullmatch(r"[0-9a-f]{64}", args.archive_sha256):
        parser.error("--archive-sha256 must be a SHA-256 digest")
    archive_bytes = args.archive.read_bytes()
    if digest(archive_bytes) != args.archive_sha256:
        raise ValueError("source archive SHA-256 mismatch")

    manifest = json.loads((ROOT / "assets/unit-art/manifest.json").read_text(encoding="utf-8"))
    ids = [unit["id"] for unit in manifest["units"]]
    if len(ids) != 26 or len(set(ids)) != 26:
        raise ValueError("expected 26 distinct canonical unit IDs")
    expected = {
        f"{SOURCE_DIR}/{unit_id}-{side}.png"
        for unit_id in ids for side in SIDE_DIRS
    }
    outputs = []
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        actual = [name for name in archive.namelist() if name.endswith(".png")]
        if len(actual) != len(expected) or set(actual) != expected:
            raise ValueError(f"source pair mismatch: missing={sorted(expected - set(actual))}, "
                             f"extra={sorted(set(actual) - expected)}")
        for unit_id in ids:
            for side, directory in SIDE_DIRS.items():
                source_path = f"{SOURCE_DIR}/{unit_id}-{side}.png"
                source = archive.read(source_path)
                with Image.open(io.BytesIO(source)) as image:
                    if image.format != "PNG" or image.mode != "RGBA" or image.size != (256, 256):
                        raise ValueError(f"unexpected PNG format: {source_path}")
                    alpha_box = image.getchannel("A").getbbox()
                    if not alpha_box:
                        raise ValueError(f"empty icon: {source_path}")
                    resized = image.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
                encoded = io.BytesIO()
                resized.save(encoded, format="WEBP", lossless=True, quality=100, method=6, exact=True)
                output = encoded.getvalue()
                with Image.open(io.BytesIO(output)) as check:
                    if check.format != "WEBP" or check.size != (OUTPUT_SIZE, OUTPUT_SIZE) or "A" not in check.getbands():
                        raise ValueError(f"invalid exported alpha image: {source_path}")
                    output_box = check.getchannel("A").getbbox()
                target = f"{TARGET_DIR}/{directory}/{unit_id}.webp"
                outputs.append((target, output, {
                    "unitId": unit_id, "team": "player" if side == "eigen" else "enemy",
                    "sourcePath": source_path, "sourceSha256": digest(source),
                    "sourceBytes": len(source), "sourceAlphaBounds": alpha_box,
                    "runtimePath": target, "runtimeSha256": digest(output),
                    "runtimeBytes": len(output), "runtimeAlphaBounds": output_box
                }))

    receipt = {
        "schemaVersion": 1, "sourceRepository": "tdc.game.goblin.content",
        "sourceCommit": args.source_sha, "sourceArchiveSha256": args.archive_sha256,
        "sourceDirectory": SOURCE_DIR, "runtimeDirectory": TARGET_DIR,
        "export": {"script": "scripts/export-map-icons.py", "size": OUTPUT_SIZE,
                   "format": "WebP", "lossless": True, "resampling": "Lanczos",
                   "pillowVersion": pillow_version},
        "sourceTotalBytes": sum(item[2]["sourceBytes"] for item in outputs),
        "runtimeTotalBytes": sum(item[2]["runtimeBytes"] for item in outputs),
        "icons": [item[2] for item in outputs]
    }
    receipt_bytes = (json.dumps(receipt, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    for relative, data in [(path, blob) for path, blob, _ in outputs] + [(RECEIPT, receipt_bytes)]:
        destination = ROOT / relative
        if destination.exists() and destination.read_bytes() != data:
            raise ValueError(f"refusing to replace a different file: {destination}")
    for relative, data in [(path, blob) for path, blob, _ in outputs] + [(RECEIPT, receipt_bytes)]:
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    print(f"{len(outputs)} icons: {receipt['sourceTotalBytes']} source bytes -> "
          f"{receipt['runtimeTotalBytes']} runtime bytes")


if __name__ == "__main__":
    main()
