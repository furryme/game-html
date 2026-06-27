#!/usr/bin/env python3
"""
去噪精灵图 - 饱和度 + 亮度双阈值法

用法:
  python3 tools/denoise-sprite.py input.png                      # 输出 input.png.denoised.png
  python3 tools/denoise-sprite.py input.png -o output.png        # 指定输出路径
  python3 tools/denoise-sprite.py frames/*.png                   # 批量处理
  python3 tools/denoise-sprite.py input.png -i                   # 原地覆盖
  python3 tools/denoise-sprite.py input.png -s 40 -b 220        # 自定义阈值

原理:
  两遍扫描，将背景噪点转为透明：
    1. 纯白像素: R,G,B 都 > 240
    2. 低饱和度亮像素: max(R,G,B) - min(R,G,B) < SAT_THRESHOLD 且 max(R,G,B) > BRIGHT_THRESHOLD

  角色像素有颜色（饱和度高），背景噪点是白/灰（饱和度低 + 亮度高）。
  通过饱和度区分两者，只清除背景。

依赖: pip install pillow numpy
"""

import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image


def denoise(img, sat_threshold=30, bright_threshold=200):
    """
    去除图像中的白色/灰色背景噪点。

    Args:
        img: PIL Image (任意模式，自动转 RGBA)
        sat_threshold: 饱和度阈值，max(R,G,B)-min(R,G,B) 低于此值视为灰色噪点
        bright_threshold: 亮度阈值，max(R,G,B) 高于此值才检查饱和度

    Returns:
        RGBA PIL Image，噪点已转为透明
    """
    arr = np.array(img.convert("RGBA"))
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Step 1: pure white (R,G,B > 240)
    pure_white = (r > 240) & (g > 240) & (b > 240)
    a[pure_white] = 0

    # Step 2: low-saturation bright pixels
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    low_sat_bright = (max_c - min_c < sat_threshold) & (max_c > bright_threshold) & (a > 0)
    a[low_sat_bright] = 0

    arr[:, :, 3] = a
    return Image.fromarray(arr, "RGBA")


def main():
    parser = argparse.ArgumentParser(description="精灵图去噪（饱和度法）")
    parser.add_argument("files", nargs="+", help="输入 PNG 文件（支持 glob）")
    parser.add_argument("-o", "--output", help="输出文件（单文件模式），默认加 .denoised 后缀")
    parser.add_argument("-i", "--inplace", action="store_true", help="原地覆盖输入文件")
    parser.add_argument("-s", "--sat", type=int, default=30, help="饱和度阈值 (default: 30)")
    parser.add_argument("-b", "--bright", type=int, default=200, help="亮度阈值 (default: 200)")
    args = parser.parse_args()

    # Expand glob patterns
    expanded = []
    for p in args.files:
        expanded.extend(sorted(glob.glob(p)))
    files = expanded if expanded else args.files

    if len(files) > 1 and args.output:
        print("错误: -o 只能在单文件模式下使用", file=sys.stderr)
        sys.exit(1)

    for fpath in files:
        if not os.path.isfile(fpath):
            print(f"跳过（不存在）: {fpath}", file=sys.stderr)
            continue

        img = Image.open(fpath)
        result = denoise(img, sat_threshold=args.sat, bright_threshold=args.bright)

        if args.inplace:
            outpath = fpath
        elif args.output:
            outpath = args.output
        else:
            base, ext = os.path.splitext(fpath)
            outpath = f"{base}.denoised{ext}"

        result.save(outpath)

        orig = np.array(img.convert("RGBA"))[:, :, 3]
        dnse = np.array(result)[:, :, 3]
        total = orig.size
        still_visible = (dnse > 0).sum()
        removed = ((orig > 0) & (dnse == 0)).sum()

        print(
            f"{os.path.basename(fpath)} -> {os.path.basename(outpath)}  "
            f"size={img.size}  removed={removed} ({100*removed/total:.1f}%)"
        )


if __name__ == "__main__":
    main()
