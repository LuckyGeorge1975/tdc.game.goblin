"""Copy one pinned generator HTML and one real level into an isolated cache.

Usage: python prepare.py GENERATOR_EXPORT_ZIP SHOWCASE_LEVELS_JSON OUTPUT_DIR
No source checkout files are read or modified.
"""

import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

CONTENT_SHA = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
EXPECTED_ARCHIVE_SHA = "0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2"
GENERATOR_MEMBER = "design-exports/uebergabe-karte/karte-generator.html"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main(archive_path, levels_path, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    if sha(archive_path.read_bytes()) != EXPECTED_ARCHIVE_SHA:
        raise ValueError("Generator export ZIP does not match the pinned archive")
    with zipfile.ZipFile(archive_path) as archive:
        members = [item for item in archive.namelist() if not item.endswith("/")]
        if members != [GENERATOR_MEMBER]:
            raise ValueError(f"Unexpected generator export members: {members}")
        html = archive.read(GENERATOR_MEMBER)
    levels = json.loads(levels_path.read_text(encoding="utf-8"))["levels"]
    level = next(item for item in levels if item["id"] == "showcase-terrain-course")
    if (level["width"], level["height"], level["defaultTerrain"], len(level["terrain"])) != (12, 8, "open-ground", 18):
        raise ValueError("Terrain course differs from the reviewed runtime data")
    level_bytes = json.dumps(level, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":")).encode("utf-8")
    (output_dir / "generator.html").write_bytes(html)
    (output_dir / "level.json").write_bytes(level_bytes)
    shutil.copyfile(Path(__file__).with_name("harness.html"), output_dir / "harness.html")
    test_card = Path(__file__).with_name("TEST-CARD.json").read_bytes()
    fixture = json.loads(test_card)
    if (fixture.get("scenario") != "render-only-test-card" or fixture.get("playable") is not False or len(fixture.get("cells", [])) != 96):
        raise ValueError("Unexpected non-playable render fixture")
    (output_dir / "render-only-test-card.cells.json").write_bytes(test_card)
    receipt = {"contentCommit": CONTENT_SHA, "sourcePath": GENERATOR_MEMBER,
               "generatorHtmlSha256": sha(html), "levelSourceSha256": sha(levels_path.read_bytes()),
               "levelJsonSha256": sha(level_bytes),
               "testCardSha256": sha(test_card),
               "files": ["harness.html", "generator.html", "level.json", "render-only-test-card.cells.json"],
               "scope": "Cache-only local render harness; no game runtime import"}
    (output_dir / "harness-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*(Path(arg) for arg in sys.argv[1:]))
