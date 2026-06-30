#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 maps/farm/bg/resized_bg_* 逐张放大生成 maps/farm/bgHD/resized_bg_*。

编号规则（与运行时一致，横着切 / 按行从左到右）：
  serial = row * 10 + col + 1
  第 1 行：01～10，第 2 行：11～20 …

每张图按自身宽高 × SCALE 放大（默认 4），边缘块 113×256 → 452×1024 等。

用法（项目根目录）:
  python3 tools/generate_bghd_tiles_from_bg.py
  python3 tools/generate_bghd_tiles_from_bg.py --scale 4
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("请先安装 Pillow: pip install Pillow", file=sys.stderr)
    raise SystemExit(1)

COLS = 10
ROWS = 9


def slice_name(serial: int) -> str:
    n = max(1, int(serial))
    if n < 100:
        s = str(n)
        return f"resized_bg_{s if len(s) >= 2 else '0' + s}"
    return f"resized_bg_{n}"


def generate(src_dir: Path, out_dir: Path, scale: float) -> int:
    if not src_dir.is_dir():
        print(f"源目录不存在: {src_dir}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0

    for row in range(ROWS):
        for col in range(COLS):
            serial = row * COLS + col + 1
            name = slice_name(serial)
            src_path = src_dir / f"{name}.png"
            if not src_path.is_file():
                print(f"缺少: {src_path}", file=sys.stderr)
                return 1

            im = Image.open(src_path).convert("RGBA")
            sw, sh = im.size
            tw = max(1, int(round(sw * scale)))
            th = max(1, int(round(sh * scale)))
            out_im = im.resize((tw, th), Image.Resampling.LANCZOS)
            out_path = out_dir / f"{name}.png"
            out_im.save(out_path, "PNG")
            count += 1
            print(f"  {name}.png  {sw}×{sh} → {tw}×{th}  (r{row} c{col})")

    print(f"完成：共 {count} 张 → {out_dir}")
    print("请在 Cocos Creator 中刷新 mapEditor 分包。")
    return 0


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="从 bg 切片放大生成 bgHD 切片")
    parser.add_argument(
        "--src",
        type=Path,
        default=root / "assets/bundles/mapEditor/maps/farm/bg",
        help="SD 切片目录",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "assets/bundles/mapEditor/maps/farm/bgHD",
        help="HD 输出目录",
    )
    parser.add_argument("--scale", type=float, default=4.0, help="放大倍数，默认 4")
    args = parser.parse_args()
    print(f"横切编号 row*10+col+1，scale={args.scale}")
    return generate(args.src, args.out, args.scale)


if __name__ == "__main__":
    raise SystemExit(main())
