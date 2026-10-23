"""Export only the two approved objective pins, preserving their full canvas anchor."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
ARCHIVE_HASH = "a3d254c78d3accbf084d658e9ba4d95d0776e3d90fcfd75a675494cfe3ec39eb"
SOURCE = "design-exports/einheitengrafiken/zielmarke/"
FILES = {"zielmarke-c-nadel.png": "objective-pin.webp",
         "zielmarke-c-nadel-unten.png": "objective-pin-below.webp"}
digest = lambda data: hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    args = parser.parse_args()
    archive_bytes = args.archive.read_bytes()
    if digest(archive_bytes) != ARCHIVE_HASH:
        raise ValueError("pinned source archive SHA-256 mismatch")
    outputs, entries = [], []
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        for source_name, target_name in FILES.items():
            source_path = SOURCE + source_name
            source = archive.read(source_path)
            with Image.open(io.BytesIO(source)) as image:
                if image.format != "PNG" or image.mode != "RGBA" or image.size != (600, 780):
                    raise ValueError("unexpected source pin format")
                source_bounds = image.getchannel("A").getbbox()
                if not source_bounds:
                    raise ValueError("empty source pin")
                resized = image.resize((300, 390), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            resized.save(buffer, format="WEBP", lossless=True, quality=100, method=6, exact=True)
            data = buffer.getvalue()
            with Image.open(io.BytesIO(data)) as check:
                if check.size != (300, 390) or check.mode != "RGBA":
                    raise ValueError("invalid runtime pin")
                runtime_bounds = check.getchannel("A").getbbox()
            target = "assets/unit-art/markers/" + target_name
            outputs.append((target, data))
            entries.append({"sourcePath": source_path, "sourceSha256": digest(source),
                            "sourceBytes": len(source), "sourceAlphaBounds": source_bounds,
                            "runtimePath": target, "runtimeSha256": digest(data),
                            "runtimeBytes": len(data), "runtimeAlphaBounds": runtime_bounds})
    receipt = {"schemaVersion": 1, "sourceRepository": "tdc.game.goblin.content",
               "sourceCommit": COMMIT, "sourceArchiveSha256": ARCHIVE_HASH,
               "export": {"script": "scripts/export-objective-pins.py", "pillowVersion": pillow_version,
                          "size": [300, 390], "format": "WebP", "lossless": True,
                          "resampling": "Lanczos", "canvasAnchor": [150, 195],
                          "referenceCanvas": [200, 260], "referenceHexWidth": 112}, "pins": entries}
    outputs.append(("assets/unit-art/objective-pins-source.json",
                    (json.dumps(receipt, indent=2) + "\n").encode("utf-8")))
    for relative, data in outputs:
        path = ROOT / relative
        if path.exists() and path.read_bytes() != data:
            raise ValueError("refusing to replace different runtime asset: " + relative)
    for relative, data in outputs:
        path = ROOT / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(f"2 objective pins: {sum(entry['runtimeBytes'] for entry in entries)} bytes")

if __name__ == "__main__":
    main()
