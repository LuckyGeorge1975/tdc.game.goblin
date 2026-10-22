"""Export twelve 48 px terrain type representatives from the pinned Content PNGs.

Usage: python -B export.py ICONS_ZIP MANIFEST_ZIP OUTPUT_DIR [--contact CONTACT_PNG]
The archives come from tools/content-source.ps1 -Action Export at the checked main SHA.
All 35 originals are verified before any output is written. OUTPUT_DIR must not exist.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageChops, ImageDraw, __version__ as PIL_VERSION


ROOT = Path(__file__).resolve().parents[2]
SOURCE_COMMIT = "c01ecb80bcdd813772d1433d9ae63b39e54ef050"
READ_COMMIT = "2fdce6ac1be30e8b2a360250b37724586469e71c"
SOURCE_ROOT = "beratung-ui-ux/design-exports/uebergabe-karte"
MANIFEST_SHA = "9ba53ce86fa4440947d18d8e0ff9153f193de5329c3c9d59df577661049c854f"
RESULTS_SHA = "a4d3f0291d0ed4e72a4a7f486d48b687e0489fd14ae060c52b28f2f9cf51d143"
REPRESENTATIVES = {
    "open-ground": "open-ground.png", "rubble-field": "rubble-field.png",
    "mountain": "mountain.png", "ridge": "ridge.png", "forest": "forest.png",
    "marsh": "marsh.png", "water": "water.png", "river": "river-straight.png",
    "road": "road-straight.png", "bridge": "bridge.png", "urban": "urban-s0.png",
    "crater": "crater.png",
}
SINGLES = {"open-ground", "rubble-field", "mountain", "ridge", "marsh", "water", "bridge", "crater"}
EXPECTED_FILES = ({f"{item}.png" for item in SINGLES} |
                  {"forest.png", "river-straight.png", "river-curve-120.png", "river-y.png",
                   "road-straight.png", "road-curve-120.png", "road-curve-60.png", "road-y.png"} |
                  {f"forest-edge-w{i:02d}.png" for i in range(13)} |
                  {f"urban-s{i}.png" for i in range(6)})


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_zip_file(archive, name):
    matches = [item for item in archive.infolist() if not item.is_dir() and item.filename == name]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one archived source: {name}")
    return archive.read(matches[0])


def assert_manifest(tiles):
    if len(tiles) != 35 or {tile["file"] for tile in tiles} != EXPECTED_FILES:
        raise ValueError("Source manifest does not enumerate the approved 35 icons")
    if len({tile["file"] for tile in tiles}) != 35:
        raise ValueError("Duplicate source file in manifest")
    if {tile["id"] for tile in tiles} != set(REPRESENTATIVES):
        raise ValueError("Terrain type IDs differ")
    for tile in tiles:
        name, terrain_id = tile["file"], tile["id"]
        if (tile["width"], tile["height"]) != (256, 296):
            raise ValueError(f"Source manifest dimensions differ: {name}")
        expected_id = ("forest" if name.startswith("forest-edge-") else
                       "road" if name.startswith("road-") else
                       "river" if name.startswith("river-") else
                       "urban" if name.startswith("urban-") else name.removesuffix(".png"))
        expected_kind = ("waldrand" if name.startswith("forest-edge-") else
                         "stadtfeld" if expected_id == "urban" else
                         "overlay" if expected_id in {"road", "river", "bridge"} else "gelaende")
        if terrain_id != expected_id or tile["kind"] != expected_kind:
            raise ValueError(f"Source ID or variant kind differs: {name}")
        if terrain_id == "urban" and (tile["kind"] != "stadtfeld" or
                                      tile.get("variant") != int(name[7])):
            raise ValueError(f"Urban variant mapping differs: {name}")
    edges = [tile for tile in tiles if tile["kind"] == "waldrand"]
    if len({tile.get("mask") for tile in edges}) != 13:
        raise ValueError("Forest edge masks are not unique")
    for terrain_id, filename in REPRESENTATIVES.items():
        if sum(tile["file"] == filename and tile["id"] == terrain_id for tile in tiles) != 1:
            raise ValueError(f"Representative mapping differs: {terrain_id}")


def encode(image, fmt, **options):
    output = io.BytesIO()
    image.save(output, format=fmt, **options)
    return output.getvalue()


def draw_contact(icons, path):
    sheet = Image.new("RGB", (620, 52 + len(icons) * 75), (27, 31, 37))
    draw = ImageDraw.Draw(sheet)
    draw.text((146, 15), "PNG 48x56", fill="white")
    draw.text((378, 15), "WebP lossless 48x56", fill="white")
    for index, (terrain_id, png_image, webp_image) in enumerate(icons):
        y = 48 + index * 75
        draw.text((8, y + 21), terrain_id, fill="white")
        for x, image in ((154, png_image), (386, webp_image)):
            for shade, color in enumerate(((235, 237, 239), (49, 55, 63))):
                background = Image.new("RGBA", (48, 56), color + (255,))
                background.alpha_composite(image)
                sheet.paste(background.convert("RGB"), (x + shade * 54, y))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, format="PNG", optimize=True)


def export(icon_zip_path, manifest_zip_path, output, contact=None):
    if output.exists():
        raise ValueError("Output directory already exists; refusing to overwrite")
    if contact is not None and contact.exists():
        raise ValueError("Contact sheet already exists; refusing to overwrite")
    results_bytes = (ROOT / "probes/map-bake/RESULTS.json").read_bytes()
    if sha(results_bytes) != RESULTS_SHA:
        raise ValueError("Pinned map-probe icon hash receipt differs")
    results = json.loads(results_bytes)["source"]
    if results["sourceCommit"] != SOURCE_COMMIT or results["iconBytes"] != 3458216:
        raise ValueError("Map-probe source pin or total bytes differ")
    with ZipFile(icon_zip_path) as icons, ZipFile(manifest_zip_path) as manifest_archive:
        manifest_bytes = read_zip_file(manifest_archive, f"{SOURCE_ROOT}/terrain-icons.json")
        if sha(manifest_bytes) != MANIFEST_SHA:
            raise ValueError("Pinned terrain source manifest differs")
        manifest = json.loads(manifest_bytes)
        if "256 px breit" not in manifest["format"] or "transparent" not in manifest["format"]:
            raise ValueError("Source manifest format differs")
        tiles = manifest["tiles"]
        assert_manifest(tiles)
        archived = {item.filename.removeprefix(f"{SOURCE_ROOT}/icons-terrain/")
                    for item in icons.infolist() if not item.is_dir()}
        if archived != EXPECTED_FILES or len([item for item in icons.infolist() if not item.is_dir()]) != 35:
            raise ValueError("Icon archive contents differ from the 35-file manifest")
        if set(results["icons"]) != EXPECTED_FILES:
            raise ValueError("Map-probe hash receipt does not cover all source icons")
        originals = {}
        for tile in tiles:
            name = tile["file"]
            data = read_zip_file(icons, f"{SOURCE_ROOT}/icons-terrain/{name}")
            receipt = results["icons"][name]
            if sha(data) != receipt["sha256"] or len(data) != receipt["bytes"]:
                raise ValueError(f"Original source hash or byte count differs: {name}")
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                if image.format != "PNG" or image.mode != "RGBA" or image.size != (256, 296):
                    raise ValueError(f"Original is not the specified RGBA PNG: {name}")
                alpha = image.getchannel("A")
                if (alpha.getextrema() != (0, 255) or
                    any(alpha.getpixel(corner) for corner in ((0, 0), (255, 0), (0, 295), (255, 295)))):
                    raise ValueError(f"Original transparency differs: {name}")
                originals[name] = image.copy()
        if sum(results["icons"][name]["bytes"] for name in EXPECTED_FILES) != results["iconBytes"]:
            raise ValueError("Original total bytes differ")
    mapping, files, contact_icons = {}, {}, []
    for terrain_id, filename in REPRESENTATIVES.items():
        scaled = originals[filename].resize((48, 56), Image.Resampling.LANCZOS)
        png = encode(scaled, "PNG", optimize=True)
        webp = encode(scaled, "WEBP", lossless=True, method=6, exact=True)
        decoded = Image.open(io.BytesIO(webp)).convert("RGBA")
        if decoded.size != (48, 56) or ImageChops.difference(scaled, decoded).getbbox() is not None:
            raise ValueError(f"Lossless WebP pixel or alpha mismatch: {terrain_id}")
        if len(webp) >= len(png):
            raise ValueError(f"Lossless WebP is not smaller than PNG: {terrain_id}")
        if scaled.getchannel("A").getbbox() is None:
            raise ValueError(f"Downscaled silhouette disappeared: {terrain_id}")
        output_name = f"{terrain_id}.webp"
        files[output_name] = webp
        mapping[terrain_id] = {
            "icon": f"assets/terrain-icons/{output_name}",
            "source": f"{SOURCE_ROOT}/icons-terrain/{filename}",
            "sourceSha256": results["icons"][filename]["sha256"],
            "sha256": sha(webp), "bytes": len(webp),
            "png48Bytes": len(png),
            "representativeOnly": terrain_id in {"forest", "river", "road", "urban"},
        }
        contact_icons.append((terrain_id, Image.open(io.BytesIO(png)).convert("RGBA"), decoded))
    receipt = {
        "schemaVersion": 1, "contentPin": SOURCE_COMMIT, "verifiedMain": READ_COMMIT,
        "sourceManifest": f"{SOURCE_ROOT}/terrain-icons.json", "sourceManifestSha256": MANIFEST_SHA,
        "sourceHashReceipt": "probes/map-bake/RESULTS.json", "sourceHashReceiptSha256": RESULTS_SHA,
        "sourceFilesVerified": 35, "sourceBytesVerified": results["iconBytes"],
        "export": {"width": 48, "height": 56, "format": "image/webp", "lossless": True,
                   "resampling": "Pillow LANCZOS", "pillowVersion": PIL_VERSION,
                   "colorAndAlpha": "exact match to 48x56 PNG after decoding"},
        "png48TotalBytes": sum(item["png48Bytes"] for item in mapping.values()),
        "webpTotalBytes": sum(item["bytes"] for item in mapping.values()),
        "types": mapping,
    }
    output.mkdir(parents=True)
    for name, data in files.items():
        (output / name).write_bytes(data)
    (output / "manifest.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if contact is not None:
        draw_contact(contact_icons, contact)
    print(json.dumps({"types": len(mapping), "sourcesVerified": 35,
                      "png48Bytes": receipt["png48TotalBytes"],
                      "webpBytes": receipt["webpTotalBytes"],
                      "output": str(output), "contact": str(contact) if contact else None}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("icons_zip", type=Path)
    parser.add_argument("manifest_zip", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--contact", type=Path)
    args = parser.parse_args()
    export(args.icons_zip, args.manifest_zip, args.output, args.contact)
