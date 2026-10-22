import io, subprocess, os
from PIL import Image, ImageDraw, ImageFont
def r(f, w):
    import tempfile
    out = os.path.join(tempfile.gettempdir(), f'_r_{os.path.basename(f)}_{w}.png')
    if not os.path.exists(out): subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render.js'), f, out, str(w)], check=True)
    return Image.open(out).convert('RGBA')
def mask(im, kind):
    m = Image.new('L', im.size, 0); d = ImageDraw.Draw(m); w, h = im.size
    if kind == 'circle': d.ellipse([0, 0, w - 1, h - 1], fill=255)
    else: d.rounded_rectangle([0, 0, w - 1, h - 1], int(w * 0.22), fill=255)
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); o.paste(im, (0, 0), m); return o
def ios(s):  # render big then downsample like the OS does
    return mask(r('svg2/icon-1024.svg', 1024).resize((s, s), Image.LANCZOS), 'rr')
def android(s):
    big = Image.alpha_composite(r('svg2/android-adaptive-background.svg', 1024), r('svg2/android-adaptive-foreground.svg', 1024))
    o = 1024 // 6; return mask(big.crop((o, o, 1024 - o, 1024 - o)).resize((s, s), Image.LANCZOS), 'circle')
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = ImageFont.truetype(F, 26); small = ImageFont.truetype(F, 20)
orig = Image.open(os.environ.get('GW_OLD_LOGO', 'old-logo.png')).convert('RGBA')
rows = [('Current logo', lambda s: orig.resize((s, s), Image.LANCZOS)), ('New - iPhone', ios), ('New - Android', android)]
sheet = Image.new('RGB', (1400, 1070), '#f2f2f4'); d = ImageDraw.Draw(sheet)
d.text((40, 25), 'Gear World icon (original style, small text removed): actual pixel sizes', fill='#111', font=font)
y = 80
for label, fn in rows:
    d.text((40, y), label, fill='#111', font=font); y += 40; x = 40
    for bg in ('#1c1c1e', '#ffffff'):
        d.rectangle([x, y, x + 650, y + 270], fill=bg); xx = x + 20
        for s in (48, 96):
            im = fn(s); sheet.paste(im, (xx, y + 20), im); d.text((xx, y + 25 + s), f'{s}px', fill='#888', font=small); xx += s + 30
        z = fn(48).resize((144, 144), Image.NEAREST); sheet.paste(z, (xx, y + 20), z); d.text((xx, y + 170), '48px x3 zoom', fill='#888', font=small)
        x += 680
    y += 290
sheet.save('png2/preview-small-sizes.png')
big = Image.new('RGB', (1400, 2150), '#f2f2f4'); d = ImageDraw.Draw(big)
d.text((40, 25), '512px icon (iPhone, Android) + full logo + horizontal + splash', fill='#111', font=font)
a = ios(512); big.paste(a, (40, 70), a); b = android(512); big.paste(b, (620, 70), b)
f1 = r('svg2/logo-badge-full.svg', 640); big.paste(f1, (40, 620), f1)
sp = r('svg2/splash.svg', 300); big.paste(sp, (760, 610), sp)
y2 = 1300
hd = r('svg2/logo-horizontal-dark.svg', 1320); big.paste(hd, (40, y2), hd)
hl = r('svg2/logo-horizontal-light.svg', 1320); big.paste(hl, (40, y2 + hd.size[1] + 20), hl)
big.crop((0, 0, 1400, y2 + 2 * hd.size[1] + 60)).save('png2/preview-large.png')
