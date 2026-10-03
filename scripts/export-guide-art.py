"""Export the five graphical Unit Guide sets from Content-08 PNG masters.

Run from the integration checkout with --source pointing at the sibling
Unit-Art checkout's proposals/content-08/sets directory. Requires Pillow.
The source files are read only; the runtime outputs are named by pixel width.
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops


HERE = Path(__file__).resolve().parent.parent
STYLES = (
    "01-tabletop-miniatures",
    "02-technical-illustration",
    "03-industrial-realism",
    "04-pixel-strategy",
    "05-cel-shaded-comic",
)
WEBP_SIZE = (1024, 683)
PNG_SIZE = (768, 512)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True,
                        help="Content-08 sets directory in the Unit-Art checkout")
    args = parser.parse_args()
    source = args.source.resolve()
    target = HERE / "assets" / "unit-art" / "sets"
    units = json.loads((HERE / "assets" / "unit-art" / "manifest.json").read_text(encoding="utf-8"))["units"]
    ids = {unit["id"] for unit in units}
    total_webp = total_png = 0

    for style in STYLES:
        input_dir = source / style / "library"
        output_dir = target / style / "library"
        actual = {path.stem for path in input_dir.glob("*.png")}
        if actual != ids:
            raise ValueError(f"{style}: missing={sorted(ids - actual)}, extra={sorted(actual - ids)}")
        webp_bytes = png_bytes = 0
        for unit_id in sorted(ids):
            with Image.open(input_dir / f"{unit_id}.png") as original:
                if original.size != (1536, 1024) or original.mode != "RGBA":
                    raise ValueError(f"{style}/{unit_id}: expected 1536x1024 RGBA master")
                webp_image = original.resize(WEBP_SIZE, Image.Resampling.LANCZOS)
                png_image = original.resize(PNG_SIZE, Image.Resampling.LANCZOS)
            webp = output_dir / f"{unit_id}@{WEBP_SIZE[0]}.webp"
            png = output_dir / f"{unit_id}@{PNG_SIZE[0]}.png"
            webp_image.save(webp, format="WEBP", quality=85, method=4)
            png_image.save(png, format="PNG", optimize=True, compress_level=9)
            for path, expected, image in ((webp, WEBP_SIZE, webp_image), (png, PNG_SIZE, png_image)):
                with Image.open(path) as exported:
                    if exported.size != expected:
                        raise ValueError(f"{path}: wrong dimensions")
                    if ImageChops.difference(image.getchannel("A"), exported.getchannel("A")).getbbox():
                        raise ValueError(f"{path}: changed transparency mask")
            webp_bytes += webp.stat().st_size
            png_bytes += png.stat().st_size
        total_webp += webp_bytes
        total_png += png_bytes
        print(f"{style}: 26 WebP={webp_bytes} bytes, 26 PNG fallback={png_bytes} bytes", flush=True)

    print(f"TOTAL: 130 WebP={total_webp} bytes; 130 PNG fallback={total_png} bytes; "
          f"combined={total_webp + total_png} bytes", flush=True)


if __name__ == "__main__":
    main()
