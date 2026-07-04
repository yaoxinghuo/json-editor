#!/usr/bin/env python3
"""
Generate all Tauri app icons from a source PNG image.

Requirements:
  - macOS (uses sips and iconutil)
  - Python 3 with Pillow (pip3 install Pillow)

Usage:
  python3 scripts/gen-icons.py [source_png]

Defaults to src/assets/json-editor.png if no source is provided.
"""

import struct
import io
import os
import subprocess
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "src-tauri", "icons")
DEFAULT_SRC = os.path.join(ROOT, "src", "assets", "json-editor.png")

# PNG sizes for Tauri bundle icons
PNG_SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 1024,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

# ICNS sizes (name, size, retina size)
ICNS_SIZES = [
    ("icon_16x16", 16, 32),
    ("icon_32x32", 32, 64),
    ("icon_128x128", 128, 256),
    ("icon_256x256", 256, 512),
    ("icon_512x512", 512, 1024),
]

# ICO sizes
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def run_sips(src, size, out_path):
    subprocess.run(["sips", "-z", str(size), str(size), src, "--out", out_path],
                   capture_output=True, check=True)


def gen_pngs(src):
    print("Generating PNG icons...")
    for name, size in PNG_SIZES.items():
        out_path = os.path.join(ICONS_DIR, name)
        run_sips(src, size, out_path)
    print(f"  {len(PNG_SIZES)} PNGs done")


def gen_icns(src):
    print("Generating ICNS (with 10% transparent padding for macOS)...")
    iconset = os.path.join(ICONS_DIR, "tmp.iconset")
    os.makedirs(iconset, exist_ok=True)

    # macOS icons require ~10% transparent padding (content at 80%)
    img = Image.open(src).convert("RGBA")
    padded = Image.new("RGBA", img.size, (0, 0, 0, 0))
    content_size = int(img.width * 0.8)
    resized = img.resize((content_size, content_size), Image.LANCZOS)
    offset = (img.width - content_size) // 2
    padded.paste(resized, (offset, offset))

    padded_src = os.path.join(iconset, "_padded_src.png")
    padded.save(padded_src)

    for name, base, retina in ICNS_SIZES:
        run_sips(padded_src, base, os.path.join(iconset, f"{name}.png"))
        run_sips(padded_src, retina, os.path.join(iconset, f"{name}@2x.png"))

    icns_path = os.path.join(ICONS_DIR, "icon.icns")
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", icns_path], check=True)

    # clean up
    for f in os.listdir(iconset):
        os.remove(os.path.join(iconset, f))
    os.rmdir(iconset)
    print("  ICNS done")


def gen_ico(src):
    print("Generating ICO...")
    img = Image.open(src).convert("RGBA")
    png_blobs = []
    for s in ICO_SIZES:
        resized = img.resize((s, s), Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format="PNG")
        png_blobs.append(buf.getvalue())
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    with open(ico_path, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(ICO_SIZES)))
        offset = 6 + 16 * len(ICO_SIZES)
        for i, s in enumerate(ICO_SIZES):
            w = s if s < 256 else 0
            h = s if s < 256 else 0
            f.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(png_blobs[i]), offset))
            offset += len(png_blobs[i])
        for blob in png_blobs:
            f.write(blob)
    print("  ICO done")


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.exists(src):
        print(f"Error: source file not found: {src}")
        sys.exit(1)
    os.makedirs(ICONS_DIR, exist_ok=True)
    print(f"Source: {src}")
    print(f"Output: {ICONS_DIR}")
    gen_pngs(src)
    gen_icns(src)
    gen_ico(src)
    print("All icons generated!")


if __name__ == "__main__":
    main()
