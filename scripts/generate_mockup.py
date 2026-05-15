from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "mockup.png"

W, H = 1400, 980
BG = "#eef2f6"
CARD = "#ffffff"
SOFT = "#f5f7fa"
TEXT = "#17202a"
MUTED = "#5b6573"
BORDER = "#d7dde5"
PANEL = "#080b0f"
OK = "#28c76f"
WARN = "#ffb020"
CRIT = "#ff4d4f"
UNKNOWN = "#8a94a6"


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


F = {
    "eyebrow": font(15, True),
    "h1": font(34, True),
    "h2": font(22, True),
    "body": font(18),
    "small": font(14, True),
    "tiny": font(12, True),
    "value": font(24, True),
}


def rr(draw, box, r=8, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill=TEXT, f="body", anchor=None):
    draw.text(xy, str(value), fill=fill, font=F[f], anchor=anchor)


def dot(draw, x, y, color):
    draw.ellipse((x, y, x + 12, y + 12), fill=color)
    draw.ellipse((x - 5, y - 5, x + 17, y + 17), outline=color, width=2)


def icon_server(draw, x, y, color, scale=1.0):
    w, h = int(42 * scale), int(9 * scale)
    gap = int(6 * scale)
    for i in range(3):
        yy = y + i * (h + gap)
        rr(draw, (x, yy, x + w, yy + h), 3, outline=color, width=max(2, int(3 * scale)))
        draw.line((x + 8 * scale, yy + h / 2, x + 9 * scale, yy + h / 2), fill=color, width=max(2, int(3 * scale)))


def icon_disk(draw, x, y, color, scale=1.0):
    rr(draw, (x, y, x + 38 * scale, y + 44 * scale), 6, outline=color, width=max(2, int(3 * scale)))
    draw.ellipse((x + 11 * scale, y + 13 * scale, x + 27 * scale, y + 29 * scale), outline=color, width=max(2, int(3 * scale)))
    draw.ellipse((x + 18 * scale, y + 20 * scale, x + 20 * scale, y + 22 * scale), fill=color)


def icon_chip(draw, x, y, color, scale=1.0):
    rr(draw, (x + 11 * scale, y + 11 * scale, x + 35 * scale, y + 35 * scale), 4, outline=color, width=max(2, int(3 * scale)))
    for i in range(4):
        p = x + (8 + i * 9) * scale
        draw.line((p, y + 2 * scale, p, y + 10 * scale), fill=color, width=max(2, int(3 * scale)))
        draw.line((p, y + 36 * scale, p, y + 44 * scale), fill=color, width=max(2, int(3 * scale)))
        p2 = y + (8 + i * 9) * scale
        draw.line((x + 2 * scale, p2, x + 10 * scale, p2), fill=color, width=max(2, int(3 * scale)))
        draw.line((x + 36 * scale, p2, x + 44 * scale, p2), fill=color, width=max(2, int(3 * scale)))


def icon_storage(draw, x, y, color, scale=1.0):
    draw.ellipse((x, y, x + 46 * scale, y + 14 * scale), outline=color, width=max(2, int(3 * scale)))
    draw.line((x, y + 7 * scale, x, y + 35 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 46 * scale, y + 7 * scale, x + 46 * scale, y + 35 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.arc((x, y + 27 * scale, x + 46 * scale, y + 41 * scale), 0, 180, fill=color, width=max(2, int(3 * scale)))
    draw.arc((x, y + 14 * scale, x + 46 * scale, y + 28 * scale), 0, 180, fill=color, width=max(2, int(3 * scale)))


def icon_gauge(draw, x, y, color, scale=1.0):
    draw.arc((x, y + 8 * scale, x + 46 * scale, y + 54 * scale), 200, 340, fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 23 * scale, y + 35 * scale, x + 34 * scale, y + 17 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 12 * scale, y + 38 * scale, x + 36 * scale, y + 38 * scale), fill=color, width=max(2, int(3 * scale)))


def icon_guest(draw, x, y, color, scale=1.0):
    s = 17 * scale
    gap = 8 * scale
    for row in range(2):
        for col in range(2):
            rr(draw, (x + col * (s + gap), y + row * (s + gap), x + col * (s + gap) + s, y + row * (s + gap) + s), 3, outline=color, width=max(2, int(3 * scale)))


def icon_temp(draw, x, y, color, scale=1.0):
    draw.line((x + 23 * scale, y + 6 * scale, x + 23 * scale, y + 33 * scale), fill=color, width=max(2, int(4 * scale)))
    draw.ellipse((x + 14 * scale, y + 29 * scale, x + 32 * scale, y + 47 * scale), outline=color, width=max(2, int(3 * scale)))
    rr(draw, (x + 16 * scale, y, x + 30 * scale, y + 34 * scale), 7, outline=color, width=max(2, int(3 * scale)))


def icon_update(draw, x, y, color, scale=1.0):
    draw.arc((x + 4 * scale, y + 4 * scale, x + 42 * scale, y + 42 * scale), 35, 330, fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 36 * scale, y + 8 * scale, x + 43 * scale, y + 8 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 42 * scale, y + 8 * scale, x + 42 * scale, y + 16 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 23 * scale, y + 15 * scale, x + 23 * scale, y + 29 * scale), fill=color, width=max(2, int(3 * scale)))
    draw.line((x + 23 * scale, y + 29 * scale, x + 32 * scale, y + 29 * scale), fill=color, width=max(2, int(3 * scale)))


ICONS = [icon_server, icon_guest, icon_gauge, icon_chip, icon_storage, icon_disk, icon_temp, icon_update]


def gauge(draw, cx, cy, pct, label, color):
    size = 92
    box = (cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2)
    draw.ellipse(box, outline="#e3e8ef", width=12)
    draw.arc(box, -90, -90 + int(360 * pct / 100), fill=color, width=12)
    text(draw, (cx, cy - 8), f"{pct}%", f="small", anchor="mm")
    text(draw, (cx, cy + 18), label, fill=MUTED, f="tiny", anchor="mm")


def bar(draw, x, y, w, pct, color, label):
    text(draw, (x, y - 22), label, f="small")
    text(draw, (x + w, y - 22), f"{pct}%", f="small", anchor="ra")
    rr(draw, (x, y, x + w, y + 10), 5, fill="#e3e8ef")
    rr(draw, (x, y, x + int(w * pct / 100), y + 10), 5, fill=color)


def draw_indicator(draw, x, y, label, color, icon_fn):
    rr(draw, (x, y, x + 116, y + 96), 8, fill="#111821")
    icon_fn(draw, x + 35, y + 15, color, 0.9)
    text(draw, (x + 58, y + 76), label, fill=color, f="tiny", anchor="mm")


def node_card(draw, x, y, name, level, values, storages, disks, guests):
    color = {"ok": OK, "warn": WARN, "critical": CRIT}.get(level, UNKNOWN)
    rr(draw, (x, y, x + 405, y + 430), 8, fill=CARD, outline=BORDER)
    draw.rounded_rectangle((x, y, x + 405, y + 5), radius=3, fill=color)
    text(draw, (x + 18, y + 24), level.upper(), fill=color, f="tiny")
    text(draw, (x + 18, y + 44), name, f="h2")
    icon_server(draw, x + 342, y + 24, color, 0.8)

    gauge(draw, x + 75, y + 130, values[0], "CPU", OK if values[0] < 70 else WARN if values[0] < 90 else CRIT)
    gauge(draw, x + 202, y + 130, values[1], "MEM", OK if values[1] < 75 else WARN if values[1] < 90 else CRIT)
    gauge(draw, x + 328, y + 130, values[2], "DISK", OK if values[2] < 75 else WARN if values[2] < 90 else CRIT)

    stats = [("VMs", values[3]), ("LXCs", values[4]), ("Boot", values[5]), ("Updates", values[6])]
    for idx, (label, value) in enumerate(stats):
        sx = x + 18 + (idx % 2) * 184
        sy = y + 196 + (idx // 2) * 54
        rr(draw, (sx, sy, sx + 170, sy + 42), 8, fill=SOFT)
        text(draw, (sx + 12, sy + 8), value, f="small")
        text(draw, (sx + 12, sy + 25), label, fill=MUTED, f="tiny")

    text(draw, (x + 18, y + 312), "STORAGE", fill=MUTED, f="tiny")
    for i, (label, pct) in enumerate(storages):
        bar_color = OK if pct < 75 else WARN if pct < 90 else CRIT
        bar(draw, x + 18, y + 348 + i * 42, 164, pct, bar_color, label)

    text(draw, (x + 220, y + 312), "DISKS", fill=MUTED, f="tiny")
    for i, (label, state, temp) in enumerate(disks):
        dy = y + 332 + i * 42
        dcolor = OK if state == "OK" and temp < 50 else WARN if state == "OK" else CRIT
        dot(draw, x + 222, dy + 7, dcolor)
        text(draw, (x + 244, dy), label, f="small")
        text(draw, (x + 244, dy + 19), f"{state} | {temp} C", fill=MUTED, f="tiny")

    text(draw, (x + 18, y + 405), ", ".join(guests), fill=MUTED, f="tiny")


def main():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    rr(draw, (34, 30, W - 34, H - 30), 8, fill=CARD, outline=BORDER)
    text(draw, (60, 58), "PROXMOX OBSERVABILITY", fill=MUTED, f="eyebrow")
    text(draw, (60, 82), "Proxmox Cluster", f="h1")
    rr(draw, (1160, 64, 1324, 108), 8, fill=SOFT, outline=BORDER)
    dot(draw, 1180, 80, CRIT)
    text(draw, (1210, 80), "Critical", f="body")

    rr(draw, (60, 142, 1340, 258), 8, fill=PANEL)
    labels = [("Nodes", OK), ("VM/LXC", WARN), ("Load", WARN), ("Memory", WARN), ("Storage", CRIT), ("Disks", CRIT), ("Temp", CRIT), ("Updates", WARN)]
    for i, (label, color) in enumerate(labels):
        draw_indicator(draw, 82 + i * 154, 152, label, color, ICONS[i])

    summary = [("Nodes", 3), ("Guests", 21), ("Storage", 6), ("Disks", 12), ("Attention", 2)]
    for i, (label, value) in enumerate(summary):
        sx = 60 + i * 256
        rr(draw, (sx, 282, sx + 232, 354), 8, fill=SOFT, outline=BORDER)
        text(draw, (sx + 20, 299), value, f="value")
        text(draw, (sx + 20, 328), label, fill=MUTED, f="small")

    node_card(draw, 60, 386, "Node A", "ok", [31, 63, 48, "5", "3", "6 days", "0"], [("local-zfs", 64), ("local", 52)], [("NVMe 0", "OK", 44), ("SATA 0", "OK", 39)], ["Router VM", "DNS LXC"])
    node_card(draw, 498, 386, "Node B", "warn", [76, 82, 71, "4", "2", "13 days", "12"], [("local", 78), ("backup", 69)], [("NVMe 0", "OK", 55), ("SATA 0", "OK", 47)], ["Media VM", "Monitoring LXC"])
    node_card(draw, 936, 386, "Node C", "critical", [21, 48, 88, "3", "4", "3 weeks", "35"], [("local", 91), ("ceph", 86)], [("NVMe 0", "OK", 62), ("SATA 0", "Failed", 58)], ["Database VM", "Backup LXC"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
