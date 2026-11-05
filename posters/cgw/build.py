# Construction Gear World A3 poster (poster-cgw), PORTRAIT 297 x 420 mm, 5/11/2026. Laid out like the owner's example
# (a photo of a CGW poster on a site hoarding): header with the CGW logo, "Compare gear, save money" badge, a big photo
# with the SCAN ME box, four reasons on the right, a phone with the real site, the categories, and a "Part of Gear World
# Hub" bar. Differences from the example, on purpose: no brand logos or brand names (the owner's rule, and they are
# trademarks); the photo is the site's own hero image (docs/IMAGE-CREDITS.md), the phone shows the real site.
# Colours: the CGW colours (warm black #1d1b17 and amber #ffc21a), as in the example; no red or green.
# The QR address is printed: it must NEVER change (lessons L76). poster-cgw is known to the counter (src/posters.js,
# lessons L95; tests/worker/posters.test.mjs checks it). Build and checks: posters/README.md.
import os, io, json, base64, random
import qrcode, cairosvg
from PIL import Image, ImageFilter, ImageEnhance
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

W, H = 297, 420
URL_CGW = 'https://constructiongearworld.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster-cgw&utm_content=cgw'
URL_HUB = 'https://gearworldhub.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster-cgw&utm_content=hub'
BLACK, BLACK2, AMBER, AMBER2, WHITE, GREY = '#1d1b17', '#121110', '#ffc21a', '#ffd75e', '#ffffff', '#c9c3b4'
COND = 'Barlow Condensed'  # SIL Open Font License; weights as families: SemiBold, (Bold), ExtraBold, Black
HERO = os.path.join(REPO, 'sites', 'cgw', 'public', 'assets', 'img', 'hero-1774.webp')
PHONE = os.path.join(HERE, 'phone-screen.jpg')
CATS = ['Power tools', 'Hand tools', 'Safety boots', 'Workwear', 'PPE', 'Site equipment']
# The 13 Gear Worlds in the order of the Hub home page (gearworldhub.com, 5/11/2026); Construction is this poster.
WORLDS = ['Construction', "Men's", "Women's", "Kids'", 'Home', 'Garden', 'Technology',
          'Car', 'Travel', 'Sporty', 'Biker', 'Gaming', 'Pets']
HERE_WORLD = 'Construction'


def text(x, y, s, size, weight=400, fill=WHITE, anchor='middle', family='Inter', spacing=0, extra=''):
    ls = f' letter-spacing="{spacing}"' if spacing else ''
    return f'<text x="{x:.2f}" y="{y:.2f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{ls}{extra}>{escape(s)}</text>'


def cond(x, y, s, size, weight='Black', fill=WHITE, anchor='start', spacing=0, extra=''):
    fam = COND if weight == 'Bold' else f'{COND} {weight}'
    w = 700 if weight == 'Bold' else 400
    return text(x, y, s, size, w, fill, anchor, fam, spacing, extra)


def jpeg_uri(img, quality=90):
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=quality, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def qr_path(url, x, y, size, fill=BLACK2):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m); s = size / n
    d = ''.join(f'M{x + c * s:.3f} {y + r * s:.3f}h{s:.3f}v{s:.3f}h-{s:.3f}z' for r, row in enumerate(m) for c, v in enumerate(row) if v)
    return f'<path d="{d}" fill="{fill}" shape-rendering="crispEdges"/>', n


def brush(x, y, w, h, seed, fill=AMBER, rot=0):
    # A paint-stroke shape: ragged left and right ends, slightly wavy top and bottom.
    rnd = random.Random(seed)
    pts = []
    for i in range(13):
        pts.append((x + w * i / 12, y + rnd.uniform(-.6, .9)))
    for i in range(9):
        pts.append((x + w + rnd.uniform(-2.4, 1.2), y + h * (i + .5) / 9))
    for i in range(12, -1, -1):
        pts.append((x + w * i / 12, y + h + rnd.uniform(-.9, .6)))
    for i in range(8, -1, -1):
        pts.append((x + rnd.uniform(-1.2, 2.4), y + h * (i + .5) / 9))
    d = 'M' + ' L'.join(f'{a:.2f} {b:.2f}' for a, b in pts) + ' Z'
    t = f' transform="rotate({rot} {x + w / 2:.1f} {y + h / 2:.1f})"' if rot else ''
    return f'<path d="{d}" fill="{fill}"{t}/>'


def ecosystem(x0, y_head, y_rows, max_w, size_head, hub_card, tagline_y, labels=True):
    """GEAR WORLD ECOSYSTEM: every site of the Hub home page (in its order) as chips, Construction picked out, and the
    smaller QR of the Hub in a white card (hub_card = x, y, w, h). The band itself is drawn by the caller."""
    o.append(cond(x0, y_head, 'GEAR WORLD ECOSYSTEM', size_head, 'Black', BLACK2, spacing=.6))
    widths = [len(nm) * 2.75 + 8 for nm in WORLDS]
    split = 6  # 6 names on the first row, 7 on the second
    for row, names in enumerate((WORLDS[:split], WORLDS[split:])):
        x = x0
        for nm in names:
            w = len(nm) * 2.75 + 8
            y = y_rows + row * 14
            if nm == HERE_WORLD:
                o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="10.5" rx="5.25" fill="{WHITE}" stroke="{BLACK2}" stroke-width=".8"/>')
                o.append(cond(x + w / 2, y + 7.4, nm.upper(), 5.2, 'Black', BLACK2, 'middle', spacing=.3))
            else:
                o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="10.5" rx="5.25" fill="{BLACK2}"/>')
                o.append(cond(x + w / 2, y + 7.4, nm.upper(), 5.2, 'ExtraBold', WHITE, 'middle', spacing=.3))
            x += w + 3
        assert x - x0 <= max_w + 3, ('the names do not fit', x - x0, max_w)
    o.append(cond(x0, tagline_y, 'ONE HUB. EVERY GEAR WORLD.', 8.4, 'Black', BLACK2, spacing=.3))
    hx, hy, hw, hh = hub_card
    o.append(f'<rect x="{hx}" y="{hy}" width="{hw}" height="{hh}" rx="4" fill="{WHITE}" stroke="{BLACK2}" stroke-width=".8"/>')
    hqs = 45  # 41 squares of 1.1 mm, at least 5 mm of white above and beside it
    path, n_hub = qr_path(URL_HUB, hx + (hw - hqs) / 2, hy + 5.5, hqs)
    o.append(path)
    boxes['hub'] = {'box': [hx, hy, hw, hh], 'url': URL_HUB, 'modules': n_hub, 'module_mm': round(hqs / n_hub, 2)}
    if labels:  # the words under the QR; without them the card is the QR and its white border only
        o.append(cond(hx + hw / 2, hy + 5.5 + hqs + 9.4, 'GEAR WORLD HUB', 6.4, 'Black', BLACK2, 'middle', spacing=.4))
        o.append(cond(hx + hw / 2, hy + 5.5 + hqs + 14.6, 'SCAN FOR EVERY WORLD', 3.8, 'ExtraBold', BLACK2, 'middle', spacing=.5))


# ---------- the photo: the site's own hero image, right part (helmet, gloves, boots, tools, the site at sunset) ----------
PX0, PY0, PX1, PY1 = 0, 64, 206, 286  # photo area on the poster (mm)
hero = Image.open(HERO).convert('RGB')
pw, ph = PX1 - PX0, PY1 - PY0
cw = round(hero.height * pw / ph)
crop = hero.crop((hero.width - cw, 0, hero.width, hero.height))
crop = crop.resize((crop.width * 5 // 2, crop.height * 5 // 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
crop = ImageEnhance.Contrast(crop).enhance(1.04)
photo_uri = jpeg_uri(crop, 88)

phone = Image.open(PHONE).convert('RGB')
phone_uri = jpeg_uri(phone, 90)

boxes = {}
o = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">']
o.append(f'''<defs>
<linearGradient id="phTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLACK2}" stop-opacity=".85"/><stop offset=".22" stop-color="{BLACK2}" stop-opacity="0"/><stop offset=".72" stop-color="{BLACK2}" stop-opacity="0"/><stop offset="1" stop-color="{BLACK2}" stop-opacity=".92"/></linearGradient>
<linearGradient id="phSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{BLACK2}" stop-opacity=".55"/><stop offset=".42" stop-color="{BLACK2}" stop-opacity="0"/><stop offset=".86" stop-color="{BLACK2}" stop-opacity="0"/><stop offset="1" stop-color="{BLACK2}" stop-opacity=".95"/></linearGradient>
<linearGradient id="amber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{AMBER2}"/><stop offset="1" stop-color="{AMBER}"/></linearGradient>
<clipPath id="photo"><rect x="{PX0}" y="{PY0}" width="{pw}" height="{ph}"/></clipPath>
<clipPath id="screen"><rect x="0" y="0" width="58" height="113" rx="5"/></clipPath>
</defs>''')
o.append(f'<rect width="{W}" height="{H}" fill="{BLACK}"/>')
# faint diagonal hazard texture on the dark parts
o.append('<g opacity=".05">' + ''.join(f'<path d="M{-60 + i * 9} {H} L{60 + i * 9 + 120} {H - 240}" stroke="{AMBER}" stroke-width="2.2"/>' for i in range(60)) + '</g>')

# photo
o.append(f'<g clip-path="url(#photo)"><image x="{PX0}" y="{PY0}" width="{pw}" height="{ph}" preserveAspectRatio="xMidYMid slice" xlink:href="{photo_uri}"/>')
o.append(f'<rect x="{PX0}" y="{PY0}" width="{pw}" height="{ph}" fill="url(#phTop)"/><rect x="{PX0}" y="{PY0}" width="{pw}" height="{ph}" fill="url(#phSide)"/></g>')

# ---------- header ----------
o.append(f'<rect width="{W}" height="{PY0}" fill="{BLACK2}"/>')
o.append(f'<rect y="{PY0 - 1.2}" width="{W}" height="1.2" fill="{AMBER}"/>')
lx, ly, ls_ = 14, 13, 34  # the CGW logo (sites/cgw/public/assets/logo.svg), drawn at 34 mm
sc = ls_ / 64
o.append(f'''<g transform="translate({lx} {ly}) scale({sc:.4f})">
<rect width="64" height="64" rx="12" fill="{BLACK}" stroke="{AMBER}" stroke-opacity=".35" stroke-width="1"/>
<path d="M14 40c0-10.5 8-19 18-19s18 8.5 18 19z" fill="{AMBER}"/><path d="M28 21.5V16h8v5.5" fill="{AMBER}"/>
<path d="M27 24v14M37 24v14" stroke="{BLACK}" stroke-width="2.5" stroke-linecap="round"/>
<rect x="9" y="40" width="46" height="6" rx="3" fill="{AMBER}"/><path d="M17 52h30" stroke="{AMBER}" stroke-width="3" stroke-linecap="round" opacity=".55"/></g>''')
o.append(cond(lx + ls_ + 6, 30.5, 'CONSTRUCTION', 19.5, 'Black', WHITE, spacing=.2))
o.append(cond(lx + ls_ + 6, 48.5, 'GEAR WORLD', 19.5, 'Black', AMBER, spacing=.2))
o.append(cond(lx, 58.4, 'TOOLS   |   WORKWEAR   |   PPE   |   SAFETY BOOTS   |   SITE EQUIPMENT', 4.9, 'SemiBold', GREY, spacing=.5))
# badge
o.append(brush(196, 12, 88, 40, 7, rot=-5))
o.append(f'<g transform="rotate(-5 240 32) skewX(-6)">')
o.append(cond(243, 29.5, 'COMPARE GEAR.', 11.6, 'Black', BLACK2, 'middle'))
o.append(cond(243, 43.5, 'SAVE MONEY.', 11.6, 'Black', BLACK2, 'middle'))
o.append('</g>')

# ---------- SCAN ME box on the photo ----------
qx0, qy0, qw = 16, 84, 84
o.append(f'<rect x="{qx0 + 10}" y="{qy0}" width="{qw - 20}" height="13" rx="2.5" fill="{BLACK2}" stroke="{AMBER}" stroke-width=".8"/>')
o.append(cond(qx0 + qw / 2 - 5, qy0 + 10, 'SCAN ME', 10.4, 'Black', WHITE, 'middle', spacing=.6))
# small phone icon next to SCAN ME (the words are about 40 mm wide)
px, py = qx0 + qw / 2 + 18.5, qy0 + 2.6
o.append(f'<rect x="{px}" y="{py}" width="4.6" height="7.8" rx="1" fill="none" stroke="{AMBER}" stroke-width=".9"/><circle cx="{px + 2.3}" cy="{py + 6.4}" r=".45" fill="{AMBER}"/>')
cy_ = qy0 + 16
o.append(f'<rect x="{qx0 - 1.4}" y="{cy_ - 1.4}" width="{qw + 2.8}" height="{qw + 2.8}" rx="6" fill="{AMBER}"/>')
o.append(f'<rect x="{qx0}" y="{cy_}" width="{qw}" height="{qw}" rx="5" fill="{WHITE}"/>')
qs = 66  # 41 squares of 1.61 mm, 9 mm of white around it (more than the 4 squares the QR standard asks for)
path, n = qr_path(URL_CGW, qx0 + (qw - qs) / 2, cy_ + (qw - qs) / 2, qs)
o.append(path)
boxes['cgw'] = {'box': [qx0, cy_, qw, qw], 'url': URL_CGW, 'modules': n, 'module_mm': round(qs / n, 2)}
ty = cy_ + qw + 6
o.append(brush(qx0 - 3, ty, qw + 6, 22, 11, rot=-3))
o.append(f'<g transform="rotate(-3 {qx0 + qw / 2} {ty + 11})">')
o.append(cond(qx0 + qw / 2, ty + 9.6, 'VISIT CONSTRUCTION', 8.6, 'Black', BLACK2, 'middle'))
o.append(cond(qx0 + qw / 2, ty + 18.2, 'GEAR WORLD', 8.6, 'Black', BLACK2, 'middle'))
o.append('</g>')

# ---------- four reasons, right column ----------
rx = 214
o.append(f'<rect x="{PX1}" y="{PY0}" width="{W - PX1}" height="{PY1 - PY0}" fill="{BLACK2}" fill-opacity=".86"/>')


def icon(kind, cx, cy):
    s = [f'<circle cx="{cx}" cy="{cy}" r="8.2" fill="{AMBER}"/><circle cx="{cx}" cy="{cy}" r="9.6" fill="none" stroke="{AMBER}" stroke-width=".5" opacity=".6"/>']
    st = f'fill="none" stroke="{BLACK2}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"'
    if kind == 'tag':
        s.append(f'<path d="M{cx - 4.6} {cy - 1} L{cx - 1} {cy - 4.6} L{cx + 4.6} {cy - 4.6} L{cx + 4.6} {cy + 1} L{cx + 1} {cy + 4.6} Z" {st}/><circle cx="{cx + 2.2}" cy="{cy - 2.2}" r=".9" fill="{BLACK2}"/>')
    elif kind == 'helmet':
        s.append(f'<path d="M{cx - 5} {cy + 2} C{cx - 5} {cy - 3.5} {cx - 2} {cy - 5} {cx} {cy - 5} C{cx + 2} {cy - 5} {cx + 5} {cy - 3.5} {cx + 5} {cy + 2} Z" {st}/><path d="M{cx - 6.2} {cy + 2.6} H{cx + 6.2}" {st}/><path d="M{cx} {cy - 5} V{cy - 1.5}" {st}/>')
    elif kind == 'shop':
        s.append(f'<path d="M{cx - 5.6} {cy - 4} H{cx - 3.8} L{cx - 2.2} {cy + 2} H{cx + 4} L{cx + 5.2} {cy - 2.2} H{cx - 3.2}" {st}/><circle cx="{cx - 1.4}" cy="{cy + 4.4}" r=".95" fill="{BLACK2}"/><circle cx="{cx + 3.2}" cy="{cy + 4.4}" r=".95" fill="{BLACK2}"/>')
    elif kind == 'shield':
        s.append(f'<path d="M{cx} {cy - 5.4} L{cx + 4.6} {cy - 3.6} V{cy + .2} C{cx + 4.6} {cy + 3.2} {cx + 2.4} {cy + 4.8} {cx} {cy + 5.6} C{cx - 2.4} {cy + 4.8} {cx - 4.6} {cy + 3.2} {cx - 4.6} {cy + .2} V{cy - 3.6} Z" {st}/><path d="M{cx - 2} {cy} L{cx - .4} {cy + 1.7} L{cx + 2.4} {cy - 1.6}" {st}/>')
    return ''.join(s)


reasons = [('tag', 'COMPARE PRICES', 'IN ONE PLACE'), ('helmet', 'TOOLS, WORKWEAR,', 'PPE & MORE'),
           ('shop', 'BUY DIRECT', 'FROM THE SHOP'), ('shield', 'FREE TO USE,', 'NO SIGN-UP')]
for i, (k, a, b) in enumerate(reasons):
    yy = 86 + i * 27
    o.append(icon(k, rx + 9, yy))
    o.append(cond(rx + 22, yy - 1, a, 7.0, 'ExtraBold', WHITE))
    o.append(cond(rx + 22, yy + 6.4, b, 7.0, 'ExtraBold', AMBER))

# ---------- the phone with the real site ----------
fx, fy, fw, fh, frot = 214, 186, 64, 120, 7
o.append(f'<g transform="rotate({frot} {fx + fw / 2} {fy + fh / 2})">')
o.append(f'<rect x="{fx + 1.5}" y="{fy + 2.5}" width="{fw}" height="{fh}" rx="8" fill="#000" opacity=".45"/>')
o.append(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="8" fill="#0b0b0a" stroke="#3a3833" stroke-width=".8"/>')
sx, sy = fx + 3, fy + 3.5
o.append(f'<g transform="translate({sx} {sy})"><g clip-path="url(#screen)"><image x="0" y="0" width="58" height="113" preserveAspectRatio="xMidYMin slice" xlink:href="{phone_uri}"/></g></g>')
o.append(f'<rect x="{fx + fw / 2 - 7}" y="{fy + 1.6}" width="14" height="2.6" rx="1.3" fill="#0b0b0a"/>')
o.append('</g>')

# ---------- everything for the job ----------
o.append(brush(14, 288, 120, 17, 21, fill=BLACK2))
o.append(cond(18, 297.6, 'EVERYTHING FOR', 11, 'Black', WHITE, spacing=.2))
o.append(cond(18, 310.8, 'THE JOB IN ONE PLACE', 12, 'Black', AMBER, spacing=.2))
# arrow to the phone
o.append(f'<path d="M136 306 C150 308 160 306 170 300" fill="none" stroke="{AMBER}" stroke-width="1.6" stroke-linecap="round"/><path d="M164.5 298.6 L170.6 299.6 L168.2 305.2" fill="none" stroke="{AMBER}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>')


def chip(x, y, name):
    w = len(name) * 3.35 + 11
    o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="11.5" rx="2.2" fill="{BLACK2}" stroke="{AMBER}" stroke-width=".7"/>')
    o.append(cond(x + w / 2, y + 8.3, name.upper(), 6.4, 'ExtraBold', WHITE, 'middle', spacing=.3))
    return w


x = 16
for nm in CATS[:3]:
    x += chip(x, 313.6, nm) + 4
x = 16
for nm in CATS[3:]:
    x += chip(x, 327.2, nm) + 4

# ---------- the Gear World ecosystem: every site and the smaller QR of the Hub ----------
EY = 343  # the Hub card ends 8.5 mm above the bottom edge
o.append(f'<rect y="{EY}" width="{W}" height="{H - EY}" fill="url(#amber)"/>')
ecosystem(16, EY + 14, EY + 20, 200, 13, (225, EY + 1.5, 58, 67), EY + 59)
o.append(text(W - 6, H - 3, 'POSTER CGW', 2.0, 700, BLACK2, 'end', spacing=.4, extra=' opacity=".6"'))
o.append('</svg>')

svg = '\n'.join(o)
open(os.path.join(OUT, 'poster-cgw.svg'), 'w').write(svg)
cairosvg.svg2pdf(bytestring=svg.encode(), write_to=os.path.join(OUT, 'GearWorld-Poster-Construction-A3.pdf'))
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'preview.png'), output_width=1754)
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'check.png'), output_width=4200)
json.dump(boxes, open(os.path.join(OUT, 'qr-boxes.json'), 'w'), indent=1)
print('poster-cgw:', {k: (v['modules'], v['module_mm']) for k, v in boxes.items()})
