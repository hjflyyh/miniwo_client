#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 maps/farm/bgHD/bg.png 按与 maps/farm/bg 相同的「横切」规则切成 90 张 PNG。

编号（与 FarmMapBackgroundLayer 一致，按行从左到右）::
  for row in 0..8:
    for col in 0..9:
      serial = row * 10 + col + 1   # 01～10 第一行，11～20 第二行 …

若需与 bg 完全一致，推荐优先使用::
  python3 tools/generate_bghd_tiles_from_bg.py

本脚本仅在有独立 HD 整图时使用。

用法（项目根目录）:
  python3 tools/split_farm_bg_hd_to_tiles.py

  python3 tools/split_farm_bg_hd_to_tiles.py \\
    assets/bundles/mapEditor/maps/farm/bgHD/bg.png \\
    assets/bundles/mapEditor/maps/farm/bgHD
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_HAS_PIL = False
try:
    from PIL import Image

    _HAS_PIL = True
except ImportError:
    pass

COLS = 10
ROWS = 9
LAYOUT = 256
RIGHT_COL_W = 113
BOTTOM_ROW_H = 52


def col_width(col: int) -> int:
    return RIGHT_COL_W if col == COLS - 1 else LAYOUT


def row_height(row: int) -> int:
    return BOTTOM_ROW_H if row == ROWS - 1 else LAYOUT


def col_left(col: int) -> int:
    return sum(col_width(i) for i in range(col))


def row_top(row: int) -> int:
    return sum(row_height(j) for j in range(row))


DESIGN_W = sum(col_width(c) for c in range(COLS))
DESIGN_H = sum(row_height(r) for r in range(ROWS))


def slice_name(serial: int) -> str:
    n = max(1, int(serial))
    if n < 100:
        s = str(n)
        return f"resized_bg_{s if len(s) >= 2 else '0' + s}"
    return f"resized_bg_{n}"


def split_farm_bg_hd_pillow(src: Path, out_dir: Path, im: "Image.Image") -> int:
    iw, ih = im.size
    scale_x = iw / DESIGN_W
    scale_y = ih / DESIGN_H

    print(f"源图 {iw}×{ih}，设计网格 {DESIGN_W}×{DESIGN_H}，缩放 {scale_x:.4f}×{scale_y:.4f} (Pillow)")

    count = 0
    # 横切：先 row 再 col，serial 按行递增
    for row in range(ROWS):
        for col in range(COLS):
            serial = row * COLS + col + 1
            x0 = round(col_left(col) * scale_x)
            y0 = round(row_top(row) * scale_y)
            w = max(1, round(col_width(col) * scale_x))
            h = max(1, round(row_height(row) * scale_y))
            x1 = min(iw, x0 + w)
            y1 = min(ih, y0 + h)
            crop = im.crop((x0, y0, x1, y1))
            out_path = out_dir / f"{slice_name(serial)}.png"
            crop.save(out_path, "PNG")
            count += 1
            print(f"  {out_path.name}  {crop.size[0]}×{crop.size[1]}  (grid r{row} c{col})")
    return count


def _sips_size(src: Path) -> tuple[int, int]:
    r = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(src)],
        check=True,
        capture_output=True,
        text=True,
    )
    out = r.stdout + r.stderr
    import re

    mw = re.search(r"pixelWidth:\s*(\d+)", out)
    mh = re.search(r"pixelHeight:\s*(\d+)", out)
    if not mw or not mh:
        raise RuntimeError(f"无法解析 sips 尺寸:\n{out}")
    return int(mw.group(1)), int(mh.group(1))


def split_farm_bg_hd_sips(src: Path, out_dir: Path) -> int:
    iw, ih = _sips_size(src)
    scale_x = iw / DESIGN_W
    scale_y = ih / DESIGN_H
    print(f"源图 {iw}×{ih}，设计网格 {DESIGN_W}×{DESIGN_H}，缩放 {scale_x:.4f}×{scale_y:.4f} (sips)")

    count = 0
    # 横切：先 row 再 col，serial 按行递增
    for row in range(ROWS):
        for col in range(COLS):
            serial = row * COLS + col + 1
            x0 = round(col_left(col) * scale_x)
            y0 = round(row_top(row) * scale_y)
            w = max(1, round(col_width(col) * scale_x))
            h = max(1, round(row_height(row) * scale_y))
            y_bl = ih - y0 - h
            out_path = out_dir / f"{slice_name(serial)}.png"
            cmd = [
                "sips",
                "--cropOffset",
                str(x0),
                str(y_bl),
                "-c",
                str(h),
                str(w),
                str(src),
                "--out",
                str(out_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            count += 1
            cw, ch = _sips_size(out_path)
            print(f"  {out_path.name}  {cw}×{ch}  (grid r{row} c{col})")
    return count


def split_farm_bg_hd(src: Path, out_dir: Path) -> int:
    if not src.is_file():
        print(f"源图不存在: {src}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)

    if _HAS_PIL:
        im = Image.open(src).convert("RGBA")
        count = split_farm_bg_hd_pillow(src, out_dir, im)
    elif sys.platform == "darwin":
        count = split_farm_bg_hd_sips(src, out_dir)
    else:
        print("请安装 Pillow: pip install Pillow", file=sys.stderr)
        return 1

    print(f"完成：共 {count} 张 → {out_dir}")
    print("请在 Cocos Creator 中刷新 mapEditor 分包资源。")
    return 0


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    default_src = root / "assets/bundles/mapEditor/maps/farm/bgHD/bg.png"
    default_out = root / "assets/bundles/mapEditor/maps/farm/bgHD"

    src = Path(sys.argv[1]) if len(sys.argv) > 1 else default_src
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else default_out
    return split_farm_bg_hd(src, out_dir)


if __name__ == "__main__":
    raise SystemExit(main())
