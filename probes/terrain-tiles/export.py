"""Export all 35 pinned Content terrain tiles at runtime size (`goblin-owdw`).

Usage: python -B export.py ICONS_ZIP MANIFEST_ZIP OUTPUT_DIR [--width 192] [--quality 85] [--contact PNG]
The archives come from tools/content-source.ps1 -Action Export at the checked main SHA.
Source verification is shared with probes/terrain-icons/export.py. OUTPUT_DIR must not exist.
"""

import argparse
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageDraw, __version__ as PIL_VERSION

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "terrain-icons"))
import export as icons  # noqa: E402  pylint: disable=wrong-import-position

# Sides follow the source manifest: bit/index i = E, SE, SW, W, NW, NE.
OVERLAY_EDGES = {
    "road-straight": [3, 0], "road-curve-120": [3, 1], "road-curve-60": [3, 2], "road-y": [3, 0, 5],
    "river-straight": [3, 0], "river-curve-120": [3, 1], "river-y": [3, 0, 5],
    "bridge": {"road": [3, 0], "river": [2, 5]},
}


def load_originals(icon_zip_path, manifest_zip_path):
    results_bytes = (icons.ROOT / "probes/map-bake/RESULTS.json").read_bytes()
    if icons.sha(results_bytes) != icons.RESULTS_SHA:
        raise ValueError("Pinned map-probe icon hash receipt differs")
    results = json.loads(results_bytes)["source"]
    if results["sourceCommit"] != icons.SOURCE_COMMIT or results["iconBytes"] != 3458216:
        raise ValueError("Map-probe source pin or total bytes differ")
    with ZipFile(icon_zip_path) as archive, ZipFile(manifest_zip_path) as manifest_archive:
        manifest_bytes = icons.read_zip_file(manifest_archive, f"{icons.SOURCE_ROOT}/terrain-icons.json")
        if icons.sha(manifest_bytes) != icons.MANIFEST_SHA:
            raise ValueError("Pinned terrain source manifest differs")
        tiles = json.loads(manifest_bytes)["tiles"]
        icons.assert_manifest(tiles)
        originals = {}
        for tile in tiles:
            name = tile["file"]
            data = icons.read_zip_file(archive, f"{icons.SOURCE_ROOT}/icons-terrain/{name}")
            receipt = results["icons"][name]
            if icons.sha(data) != receipt["sha256"] or len(data) != receipt["bytes"]:
                raise ValueError(f"Original source hash or byte count differs: {name}")
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                if image.format != "PNG" or image.mode != "RGBA" or image.size != (256, 296):
                    raise ValueError(f"Original is not the specified RGBA PNG: {name}")
                originals[name] = (tile, image.copy(), receipt["sha256"])
    return originals


def draw_contact(images, path):
    columns, cell_w, cell_h = 7, 210, 262
    rows = -(-len(images) // columns)
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), (27, 31, 37))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(images):
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        ground = Image.new("RGBA", image.size, (96, 120, 88, 255))
        ground.alpha_composite(image)
        sheet.paste(ground.convert("RGB"), (x + 9, y + 26))
        draw.text((x + 9, y + 8), name, fill="white")
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, format="PNG", optimize=True)


def export(icon_zip_path, manifest_zip_path, output, width, quality, contact=None):
    if output.exists():
        raise ValueError("Output directory already exists; refusing to overwrite")
    if contact is not None and contact.exists():
        raise ValueError("Contact sheet already exists; refusing to overwrite")
    height = round(width * 296 / 256)
    originals = load_originals(icon_zip_path, manifest_zip_path)
    files, entries, contact_images = {}, {}, []
    for name, (tile, original, source_sha) in sorted(originals.items()):
        stem = name.removesuffix(".png")
        scaled = original.resize((width, height), Image.Resampling.LANCZOS)
        if scaled.getchannel("A").getbbox() is None:
            raise ValueError(f"Downscaled tile is empty: {stem}")
        webp = icons.encode(scaled, "WEBP", quality=quality, alpha_quality=100, method=6)
        decoded = Image.open(io.BytesIO(webp))
        decoded.load()
        if decoded.size != (width, height) or decoded.mode != "RGBA":
            raise ValueError(f"WebP decode differs: {stem}")
        files[f"{stem}.webp"] = webp
        entry = {"file": f"{stem}.webp", "id": tile["id"], "kind": tile["kind"],
                 "source": f"{icons.SOURCE_ROOT}/icons-terrain/{name}", "sourceSha256": source_sha,
                 "sha256": icons.sha(webp), "bytes": len(webp)}
        if tile["kind"] == "waldrand":
            entry["mask"] = tile["mask"]
        if tile["kind"] == "stadtfeld":
            entry["variant"] = tile["variant"]
        if stem in OVERLAY_EDGES:
            entry["edges"] = OVERLAY_EDGES[stem]
        entries[stem] = entry
        contact_images.append((stem, decoded.convert("RGBA")))
    receipt = {
        "schemaVersion": 1, "issue": "goblin-owdw",
        "contentPin": icons.SOURCE_COMMIT, "verifiedMain": icons.READ_COMMIT,
        "sourceManifest": f"{icons.SOURCE_ROOT}/terrain-icons.json", "sourceManifestSha256": icons.MANIFEST_SHA,
        "sourceHashReceipt": "probes/map-bake/RESULTS.json", "sourceHashReceiptSha256": icons.RESULTS_SHA,
        "sourceFilesVerified": len(originals),
        "sides": ["E", "SE", "SW", "W", "NW", "NE"],
        "export": {"width": width, "height": height, "format": "image/webp", "lossless": False,
                   "quality": quality, "alphaQuality": 100, "resampling": "Pillow LANCZOS",
                   "pillowVersion": PIL_VERSION},
        "webpTotalBytes": sum(len(data) for data in files.values()),
        "tiles": entries,
    }
    output.mkdir(parents=True)
    for name, data in files.items():
        (output / name).write_bytes(data)
    (output / "manifest.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if contact is not None:
        draw_contact(contact_images, contact)
    print(json.dumps({"tiles": len(entries), "size": [width, height],
                      "webpBytes": receipt["webpTotalBytes"], "output": str(output)}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("icons_zip", type=Path)
    parser.add_argument("manifest_zip", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=192)
    parser.add_argument("--quality", type=int, default=85)
    parser.add_argument("--contact", type=Path)
    args = parser.parse_args()
    export(args.icons_zip, args.manifest_zip, args.output, args.width, args.quality, args.contact)
