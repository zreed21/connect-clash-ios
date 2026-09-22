"""Build framed App Store screenshot variants with marketing captions."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "/home/user/connect-clash-ios/appstore/screenshots"
OUT = SRC + "/framed"
import os
os.makedirs(OUT, exist_ok=True)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

AMBER = (251, 178, 56)
VIOLET = (167, 139, 250)
CYAN = (103, 232, 249)
WHITE = (247, 242, 255)
MUTED = (175, 165, 200)

FRAMES = [
    ("6-7in_menu.png", "RACE A RIVAL.", "CONNECT FOUR."),
    ("6-7in_board.png", "IDENTICAL BOARDS.", "FIRST CLEAN SWEEP WINS."),
    ("6-7in_duel.png", "A 4-LETTER CODE.", "PEER-TO-PEER DUELS."),
]


def gradient(w, h):
    top, bot = (26, 11, 51), (10, 6, 20)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / h
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def draw_orbs(d, cx, cy, r):
    d.ellipse([cx - 5.4 * r, cy - r, cx - 3.4 * r, cy + r], fill=AMBER)
    d.ellipse([cx + 3.4 * r, cy - r, cx + 5.4 * r, cy + r], fill=VIOLET)
    d.line([cx - 3.2 * r, cy, cx + 3.2 * r, cy], fill=CYAN, width=max(2, r // 3))


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, img.size[0], img.size[1]], radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


for fname, line1, line2 in FRAMES:
    shot = Image.open(f"{SRC}/{fname}").convert("RGB")
    W, H = shot.size  # 1290x2796
    canvas = gradient(W, H)
    d = ImageDraw.Draw(canvas)

    # brand row
    f_brand = ImageFont.truetype(BOLD, 44)
    draw_orbs(d, 150, 132, 16)
    d.text((270, 104), "P A I R S T O R M", font=f_brand, fill=WHITE)

    # captions
    f_cap = ImageFont.truetype(BOLD, 108)
    d.text((96, 210), line1, font=f_cap, fill=AMBER)
    d.text((96, 340), line2, font=f_cap, fill=WHITE)
    f_sub = ImageFont.truetype(REG, 42)
    d.text((100, 486), "Solo vs CPU  ·  Online 2-player duels  ·  No accounts",
           font=f_sub, fill=MUTED)

    # phone shot, rounded + bordered, fill lower area
    target_w = int(W * 0.86)
    scale = target_w / shot.size[0]
    new_h = int(shot.size[1] * scale)
    shot_r = shot.resize((target_w, new_h), Image.LANCZOS)
    y0 = 600
    x0 = (W - target_w) // 2
    # soft glow behind the phone frame
    glow_mask = Image.new("L", (W, H), 0)
    gm = ImageDraw.Draw(glow_mask)
    gm.rounded_rectangle([x0 - 8, y0 - 8, x0 + target_w + 8, min(y0 + new_h, H - 1) + 8],
                         70, fill=110)
    glow_mask = glow_mask.filter(ImageFilter.GaussianBlur(45))
    glow_layer = Image.new("RGB", (W, H), (96, 62, 168))
    canvas.paste(glow_layer, (0, 0), glow_mask.point(lambda v: v // 2))
    shot_rgba = rounded(shot_r, 60)
    canvas.paste(shot_r, (x0, y0), shot_rgba.split()[-1])
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([x0 - 3, y0 - 3, x0 + target_w + 3, y0 + new_h + 3],
                        62, outline=(120, 105, 160), width=3)

    out_path = f"{OUT}/{fname.replace('.png', '_framed.png')}"
    canvas.crop((0, 0, W, H)).save(out_path)
    print("framed:", out_path, canvas.size)
