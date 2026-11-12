"""清绪之屿 品牌图标抠图脚本。

输入：贴纸风格灯塔海岛图（米白背景 + 白色贴纸描边 + 极细外阴影）
输出：透明背景 PNG（多尺寸）+ favicon + 圆形头像

算法：
1. 降采样到 1024，从四角容差洪泛去除米白背景；
2. 取最大连通域，剔除背景中的悬浮噪点；
3. 形态学腐蚀吃掉描边外侧的细阴影环与 JPEG 噪点，再轻微膨胀回补；
4. alpha 羽化 + 按内容包围盒裁切居中。
"""
from __future__ import annotations

import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = r"C:\Users\Administrator\Documents\Tencent Files\2691587785\nt_qq\nt_data\Pic\2026-11\Ori\8843aebb2607534f0d13862359e91540.jpg"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "brand")

WORK = 1024        # 处理分辨率
TOL = 26           # 背景色容差
ERODE = 5          # 腐蚀半径（像素，WORK 尺度上）
DILATE = 2         # 膨胀回补
FEATHER = 1.1      # 羽化半径
PAD_RATIO = 0.03   # 裁切后留白比例


def flood_bg(arr: np.ndarray, tol: int) -> np.ndarray:
    """从图像边缘洪泛标记背景，返回背景布尔图。"""
    h, w, _ = arr.shape
    corners = np.concatenate([arr[0, :8].reshape(-1, 3), arr[-1, :8].reshape(-1, 3),
                              arr[:8, 0].reshape(-1, 3), arr[:8, -1].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    close = np.sqrt(((arr.astype(np.int16) - bg) ** 2).sum(axis=2)) < tol

    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))

    # 用 numpy 做多源 BFS：逐波前推进，比逐像素 python 循环快
    while q:
        y, x = q.pop()
        if y > 0 and close[y - 1, x] and not seen[y - 1, x]:
            seen[y - 1, x] = True; q.append((y - 1, x))
        if y < h - 1 and close[y + 1, x] and not seen[y + 1, x]:
            seen[y + 1, x] = True; q.append((y + 1, x))
        if x > 0 and close[y, x - 1] and not seen[y, x - 1]:
            seen[y, x - 1] = True; q.append((y, x - 1))
        if x < w - 1 and close[y, x + 1] and not seen[y, x + 1]:
            seen[y, x + 1] = True; q.append((y, x + 1))
    return seen


def largest_component(mask: np.ndarray) -> np.ndarray:
    """保留最大连通域。"""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    best: list[tuple[int, int]] = []
    for sy in range(0, h, 4):
        for sx in range(0, w, 4):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            comp: list[tuple[int, int]] = []
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            while q:
                y, x = q.pop()
                comp.append((y, x))
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            if len(comp) > len(best):
                best = comp
    out = np.zeros((h, w), dtype=bool)
    for y, x in best:
        out[y, x] = True
    return out


def erode(mask: np.ndarray, n: int) -> np.ndarray:
    m = mask.copy()
    for _ in range(n):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        m = e
    return m


def dilate(mask: np.ndarray, n: int) -> np.ndarray:
    m = mask.copy()
    for _ in range(n):
        d = m.copy()
        d[1:, :] |= m[:-1, :]
        d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d
    return m


def build_alpha(rgb: Image.Image) -> np.ndarray:
    arr = np.asarray(rgb)
    bg = flood_bg(arr, TOL)
    fg = largest_component(~bg)
    fg = erode(fg, ERODE)
    fg = dilate(fg, DILATE)
    alpha = (fg * 255).astype(np.uint8)
    return alpha


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    src = Image.open(SRC).convert("RGB").resize((WORK, WORK), Image.LANCZOS)
    alpha = build_alpha(src)
    rgba = src.convert("RGBA")
    rgba.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(FEATHER)))

    bbox = rgba.split()[-1].getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    side = int(max(rgba.size) * (1 + PAD_RATIO * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2), rgba)
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)

    for size in (1024, 512, 256, 128, 64):
        canvas.resize((size, size), Image.LANCZOS).save(
            os.path.join(OUT_DIR, f"icon-{size}.png"), optimize=True
        )

    canvas.resize((64, 64), Image.LANCZOS).save(
        os.path.join(OUT_DIR, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )

    # 圆形头像版
    glyph = canvas.resize((int(1024 * 0.86), int(1024 * 0.86)), Image.LANCZOS)
    mask = Image.new("L", glyph.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, glyph.width, glyph.height), fill=255)
    glyph.putalpha(Image.composite(glyph.split()[-1], Image.new("L", glyph.size, 0), mask))
    avatar = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    glyph = glyph.resize((512, 512), Image.LANCZOS)
    avatar.paste(glyph, (0, 0), glyph)
    avatar.save(os.path.join(OUT_DIR, "avatar-512.png"), optimize=True)

    print("done ->", OUT_DIR, canvas.size)


if __name__ == "__main__":
    main()
