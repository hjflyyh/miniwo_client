#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把一张大图切成多块 tile×tile 的 PNG 文件（保存到磁盘）。

用法（在项目根目录执行）:
  python3 tools/split_image_to_1024.py \\
    assets/bundles/mapEditor/maps/farm/bg.png \\
    assets/bundles/mapEditor/maps/farm/tiles_1024

可选参数:
  --tile 1024       块边长，默认 1024
  --prefix tile     文件名前缀，默认用输入文件主名
  --pad             边缘不足一整块的区域 pad 透明像素至整块宽高（仅 Pillow 路径支持）
  --backend auto    auto|pillow|sips ；无 Pillow 时在 macOS 上可用 sips

依赖:
  - 推荐: pip install Pillow
  - 或 macOS 自带 sips（无 Pillow 时自动尝试，不支持 --pad）
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

_HAS_PIL = False
try:
    from PIL import Image

    _HAS_PIL = True
except ImportError:
    pass


def _size_with_sips(path: Path) -> tuple[int, int]:
    r = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    out = r.stdout + r.stderr
    mw = re.search(r"pixelWidth:\s*(\d+)", out)
    mh = re.search(r"pixelHeight:\s*(\d+)", out)
    if not mw or not mh:
        raise RuntimeError(f"无法解析 sips 输出尺寸:\n{out}")
    return int(mw.group(1)), int(mh.group(1))


def split_image_pillow(
    src: Path,
    out_dir: Path,
    tile: int,
    prefix: str,
    pad: bool,
) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    cols = (w + tile - 1) // tile
    rows = (h + tile - 1) // tile
    n = 0
    for row in range(rows):
        for col in range(cols):
            x0 = col * tile
            y0 = row * tile
            x1 = min(x0 + tile, w)
            y1 = min(y0 + tile, h)
            crop = im.crop((x0, y0, x1, y1))
            if pad and (crop.size[0] < tile or crop.size[1] < tile):
                canvas = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
                canvas.paste(crop, (0, 0))
                out_im = canvas
            else:
                out_im = crop
            name = f"{prefix}_r{row:02d}_c{col:02d}.png"
            out_path = out_dir / name
            out_im.save(out_path, "PNG")
            n += 1
    print(
        f"已输出 {n} 张图到: {out_dir}（原图 {w}×{h}，格 {rows} 行 × {cols} 列，块 {tile}，后端 Pillow）"
    )
    return 0


def split_image_sips(
    src: Path,
    out_dir: Path,
    tile: int,
    prefix: str,
) -> int:
    """macOS sips：裁剪坐标为左下角原点（与 Pillow 自上而下 row 一致）。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    w, h = _size_with_sips(src)
    cols = (w + tile - 1) // tile
    rows = (h + tile - 1) // tile
    n = 0
    for row in range(rows):
        for col in range(cols):
            x0 = col * tile
            y_top = row * tile
            crop_w = min(tile, w - x0)
            crop_h = min(tile, h - y_top)
            if crop_w <= 0 or crop_h <= 0:
                continue
            # 自下而上的垂直偏移：矩形底边距图像底边的像素数
            y_bottom_bl = h - y_top - crop_h
            name = f"{prefix}_r{row:02d}_c{col:02d}.png"
            out_path = out_dir / name
            # 注意：--cropOffset 必须在 -c 之前，否则裁剪不生效
            cmd = [
                "sips",
                "--cropOffset",
                str(x0),
                str(y_bottom_bl),
                "-c",
                str(crop_h),
                str(crop_w),
                str(src),
                "--out",
                str(out_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            n += 1
    print(
        f"已输出 {n} 张图到: {out_dir}（原图 {w}×{h}，格 {rows} 行 × {cols} 列，块 {tile}，后端 sips）"
    )
    return 0


def split_image(
    src: Path,
    out_dir: Path,
    tile: int,
    prefix: str,
    pad: bool,
    backend: str,
) -> int:
    if not src.is_file():
        print(f"文件不存在: {src}", file=sys.stderr)
        return 1

    use_pillow = backend == "pillow" or (backend == "auto" and _HAS_PIL)
    use_sips = backend == "sips" or (backend == "auto" and not _HAS_PIL)

    if pad and not _HAS_PIL:
        print("--pad 需要 Pillow，请先执行: pip install Pillow", file=sys.stderr)
        return 1

    if use_pillow and _HAS_PIL:
        return split_image_pillow(src, out_dir, tile, prefix, pad)

    if use_sips and sys.platform == "darwin":
        if pad:
            # 已在上方拦截；此处仅为类型完整性
            return 1
        try:
            return split_image_sips(src, out_dir, tile, prefix)
        except (subprocess.CalledProcessError, FileNotFoundError, RuntimeError) as e:
            print(f"sips 失败: {e}", file=sys.stderr)
            return 1

    if not _HAS_PIL:
        print(
            "未安装 Pillow，且当前环境不可用 sips（需 macOS）。请执行: pip install Pillow",
            file=sys.stderr,
        )
        return 1

    print(f"未知 backend: {backend}", file=sys.stderr)
    return 1


def main() -> int:
    p = argparse.ArgumentParser(description="大图切成多块 tile×tile PNG")
    p.add_argument("input", type=Path, help="输入 PNG 路径")
    p.add_argument("output_dir", type=Path, help="输出目录")
    p.add_argument("--tile", type=int, default=1024, help="块边长，默认 1024")
    p.add_argument("--prefix", type=str, default=None, help="输出文件名前缀，默认同输入主名")
    p.add_argument("--pad", action="store_true", help="边缘块 pad 到 tile×tile（需 Pillow）")
    p.add_argument(
        "--backend",
        choices=("auto", "pillow", "sips"),
        default="auto",
        help="auto：有 Pillow 用 Pillow，否则在 macOS 上用 sips",
    )
    args = p.parse_args()
    prefix = args.prefix or args.input.stem
    return split_image(args.input, args.output_dir, args.tile, prefix, args.pad, args.backend)


if __name__ == "__main__":
    raise SystemExit(main())
