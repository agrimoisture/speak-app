#!/usr/bin/env python3
"""Draw simple PNG icons without third-party libraries."""

import struct
import zlib
from pathlib import Path


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, size, pixel):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def icon_pixel(x, y, size):
    nx = (x + 0.5) / size
    ny = (y + 0.5) / size
    forest = (31, 107, 74, 255)
    deep = (18, 61, 44, 255)
    cream = (255, 250, 242, 255)
    # Rounded square, with padding so a maskable crop still shows the mark.
    inset = 0.08
    radius = 0.22
    left, top, right, bottom = inset, inset, 1 - inset, 1 - inset
    inside = left <= nx <= right and top <= ny <= bottom
    if inside:
        dx = 0
        if nx < left + radius:
            dx = left + radius - nx
        elif nx > right - radius:
            dx = nx - (right - radius)
        dy = 0
        if ny < top + radius:
            dy = top + radius - ny
        elif ny > bottom - radius:
            dy = ny - (bottom - radius)
        if dx * dx + dy * dy > radius * radius:
            inside = False
    if not inside:
        return (0, 0, 0, 0)
    # Speech bubble.
    bx = (nx - 0.50) / 0.30
    by = (ny - 0.44) / 0.22
    if bx * bx + by * by <= 1:
        return cream
    if 0.46 <= nx <= 0.62 and 0.60 <= ny <= 0.74 and (nx - 0.46) * 1.3 + 0.60 >= ny:
        return cream
    # Microphone.
    mx = (nx - 0.50) / 0.055
    my = (ny - 0.40) / 0.09
    if mx * mx + my * my <= 1:
        return deep
    if abs(nx - 0.50) <= 0.012 and 0.47 <= ny <= 0.56:
        return deep
    if abs(ny - 0.56) <= 0.012 and abs(nx - 0.50) <= 0.045:
        return deep
    return forest


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "site" / "icons"
    root.mkdir(parents=True, exist_ok=True)
    write_png(root / "icon-192.png", 192, icon_pixel)
    write_png(root / "icon-512.png", 512, icon_pixel)
