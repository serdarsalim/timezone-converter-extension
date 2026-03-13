from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)


def write_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(rgba[start:start + stride])

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))
    path.write_bytes(png)


def alpha_blend(dst: tuple[int, int, int, int], src: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    sr, sg, sb, sa = src
    dr, dg, db, da = dst
    sa_f = sa / 255
    da_f = da / 255
    out_a = sa_f + da_f * (1 - sa_f)
    if out_a <= 0:
        return 0, 0, 0, 0
    out_r = int(round((sr * sa_f + dr * da_f * (1 - sa_f)) / out_a))
    out_g = int(round((sg * sa_f + dg * da_f * (1 - sa_f)) / out_a))
    out_b = int(round((sb * sa_f + db * da_f * (1 - sa_f)) / out_a))
    return out_r, out_g, out_b, int(round(out_a * 255))


def render_master(size: int = 128, scale: int = 4) -> bytes:
    width = size * scale
    height = size * scale
    pixels = [(0, 0, 0, 0)] * (width * height)

    white = (255, 255, 255, 255)
    ring = (17, 17, 17, 255)
    ink = (17, 17, 17, 255)

    center = size / 2
    face_radius = 61

    minute_angle = math.radians(35 - 90)
    hour_angle = math.radians(305 - 90)

    def dist_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
        abx = bx - ax
        aby = by - ay
        apx = px - ax
        apy = py - ay
        ab_len2 = abx * abx + aby * aby
        if ab_len2 == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
        closest_x = ax + abx * t
        closest_y = ay + aby * t
        return math.hypot(px - closest_x, py - closest_y)

    def sample(x: float, y: float) -> tuple[int, int, int, int]:
        color = (0, 0, 0, 0)

        dx = x - center
        dy = y - center
        distance = math.hypot(dx, dy)

        if distance <= face_radius:
            color = alpha_blend(color, white)
        if face_radius - 5 <= distance <= face_radius:
            color = alpha_blend(color, ring)

        for deg in (0, 90, 180, 270):
            radians = math.radians(deg - 90)
            inner = face_radius * 0.56
            outer = face_radius * 0.73
            ax = center + math.cos(radians) * inner
            ay = center + math.sin(radians) * inner
            bx = center + math.cos(radians) * outer
            by = center + math.sin(radians) * outer
            if dist_to_segment(x, y, ax, ay, bx, by) <= 3.6:
                color = alpha_blend(color, ink)

        minute_x = center + math.cos(minute_angle) * (face_radius * 0.92)
        minute_y = center + math.sin(minute_angle) * (face_radius * 0.92)
        if dist_to_segment(x, y, center, center, minute_x, minute_y) <= 4.1:
            color = alpha_blend(color, ink)

        hour_x = center + math.cos(hour_angle) * (face_radius * 0.48)
        hour_y = center + math.sin(hour_angle) * (face_radius * 0.48)
        if dist_to_segment(x, y, center, center, hour_x, hour_y) <= 4.8:
            color = alpha_blend(color, ink)

        if distance <= 6.8:
            color = alpha_blend(color, ink)

        return color

    offsets = (
        (0.125, 0.125),
        (0.375, 0.125),
        (0.625, 0.125),
        (0.875, 0.125),
        (0.125, 0.375),
        (0.375, 0.375),
        (0.625, 0.375),
        (0.875, 0.375),
        (0.125, 0.625),
        (0.375, 0.625),
        (0.625, 0.625),
        (0.875, 0.625),
        (0.125, 0.875),
        (0.375, 0.875),
        (0.625, 0.875),
        (0.875, 0.875),
    )

    out = bytearray(size * size * 4)
    for py in range(size):
        for px in range(size):
            samples = [sample(px + ox, py + oy) for ox, oy in offsets]
            r = sum(pixel[0] for pixel in samples) // len(samples)
            g = sum(pixel[1] for pixel in samples) // len(samples)
            b = sum(pixel[2] for pixel in samples) // len(samples)
            a = sum(pixel[3] for pixel in samples) // len(samples)
            index = (py * size + px) * 4
            out[index:index + 4] = bytes((r, g, b, a))

    return bytes(out)


master = render_master()
write_png(ICONS / "icon-128.png", 128, 128, master)
