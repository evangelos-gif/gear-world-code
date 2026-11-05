# DRAFT 1 (5/11/2026, not chosen for print): the Construction poster in the style of the Hub poster. The printed one is posters/cgw.
# Construction Gear World A3 poster (poster-cgw), 5/11/2026. The same look as the Hub poster (posters/hub): navy space,
# the gold-detailed Earth, gold frame, the gold GW mark. Top centre: Construction Gear World with a big QR to its home
# page. Bottom: the GEAR WORLD ECOSYSTEM strip with every site of the Hub home page and a smaller QR to the Hub.
# A3 landscape, 420 x 297 mm. Rules (Manager, 5/11/2026): Gear World is the hero; no prices, codes or Black Friday (the
# poster stays up for months); no logos or photos of shops or brands; never "UK retailers"; every name in words; colours
# navy, blue, orange and gold only (white only behind the QR codes and for text).
# The QR addresses are printed: they must NEVER change (lessons L76). Both poster names are known to the counter
# (src/posters.js, lessons L95; tests/worker/posters.test.mjs checks it). Build: see posters/README.md.
import os, json, random, subprocess
import qrcode, cairosvg
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

W, H = 420, 297
URL_CGW = 'https://constructiongearworld.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster-cgw&utm_content=cgw'
URL_HUB = 'https://gearworldhub.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster-cgw&utm_content=hub'
NAVY, DEEP, GOLD, GOLD2, WHITE, INK = '#0e2a66', '#060f26', '#d9ae4a', '#f3d78f', '#ffffff', '#0f1d3d'
ORANGE, BLUE_TXT, BLUE_SOFT = '#f08a24', '#d6e0f5', '#b9c7e6'
# The 13 Gear Worlds in the order of the Hub home page (gearworldhub.com, 5/11/2026); Construction is this poster.
WORLDS = ['Construction', "Men's", "Women's", "Kids'", 'Home', 'Garden', 'Technology',
          'Car', 'Travel', 'Sporty', 'Biker', 'Gaming', 'Pets']
HERE_WORLD = 'Construction'
CX, CY, R = 210, 152, 136
EARTH = os.path.join(HERE, 'earth.json')
if not os.path.exists(EARTH):
    subprocess.run(['node', os.path.join(HERE, '..', 'earth.mjs'), EARTH, str(CX), str(CY), str(R), '12', '14'], check=True)
E = json.load(open(EARTH))


def text(x, y, s, size, weight=400, fill=WHITE, anchor='middle', family='Inter', spacing=0):
    ls = f' letter-spacing="{spacing}"' if spacing else ''
    return f'<text x="{x:.2f}" y="{y:.2f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{ls}>{escape(s)}</text>'


def qr_path(url, x, y, size, fill=INK):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m); s = size / n
    d = ''.join(f'M{x + c * s:.3f} {y + r * s:.3f}h{s:.3f}v{s:.3f}h-{s:.3f}z' for r, row in enumerate(m) for c, v in enumerate(row) if v)
    return f'<path d="{d}" fill="{fill}" shape-rendering="crispEdges"/>', n


def gw_mark(x, y, size):
    # The Gear World mark of the Hub header (a rounded square with GW), in gold.
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{size * .24:.2f}" fill="url(#gold)"/>'
            + text(x + size / 2, y + size * .66, 'GW', size * .46, 900, NAVY, family='Inter Display', spacing=-.1))


boxes = {}
o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">']
o.append(f'''<defs>
<radialGradient id="space" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#10224f"/><stop offset="1" stop-color="{DEEP}"/></radialGradient>
<radialGradient id="ocean" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#2a63c9"/><stop offset=".55" stop-color="#143a8a"/><stop offset="1" stop-color="#071a45"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="#4f86ff" stop-opacity=".0"/><stop offset=".93" stop-color="#4f86ff" stop-opacity=".35"/><stop offset="1" stop-color="#4f86ff" stop-opacity="0"/></radialGradient>
<radialGradient id="shade" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GOLD2}"/><stop offset=".5" stop-color="{GOLD}"/><stop offset="1" stop-color="#a9802a"/></linearGradient>
<linearGradient id="sides" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{DEEP}" stop-opacity=".95"/><stop offset=".33" stop-color="{DEEP}" stop-opacity="0"/><stop offset=".67" stop-color="{DEEP}" stop-opacity="0"/><stop offset="1" stop-color="{DEEP}" stop-opacity=".95"/></linearGradient>
<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{DEEP}" stop-opacity="0"/><stop offset=".45" stop-color="{DEEP}" stop-opacity=".85"/><stop offset="1" stop-color="{DEEP}" stop-opacity=".95"/></linearGradient>
<clipPath id="disc"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath>
</defs>''')

# ---------- background: the same space, Earth, orbit and frame as the Hub poster ----------
o.append(f'<rect width="{W}" height="{H}" fill="url(#space)"/>')
random.seed(13)
for _ in range(260):  # stars, a few of them gold
    x, y = random.uniform(0, W), random.uniform(0, H)
    if (x - CX) ** 2 + (y - CY) ** 2 < (R + 6) ** 2: continue
    c = GOLD2 if random.random() < .25 else WHITE
    o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{random.uniform(.15, .55):.2f}" fill="{c}" opacity="{random.uniform(.35, .9):.2f}"/>')
o.append(f'<ellipse cx="{CX}" cy="{CY + 8}" rx="{R + 58}" ry="{R * .34:.1f}" fill="none" stroke="url(#gold)" stroke-width=".7" opacity=".75" transform="rotate(-12 {CX} {CY})"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R + 9}" fill="url(#glow)"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#ocean)"/>')
o.append(f'<g clip-path="url(#disc)"><path d="{E["grat"]}" fill="none" stroke="{GOLD}" stroke-width=".22" opacity=".45"/>')
o.append(f'<path d="{E["land"]}" fill="{GOLD}" fill-opacity=".22" stroke="{GOLD2}" stroke-width=".34" stroke-linejoin="round"/></g>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#shade)"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="url(#gold)" stroke-width="1.1"/>')
o.append(f'<rect width="{W}" height="{H}" fill="url(#sides)"/>')
o.append(f'<rect y="186" width="{W}" height="{H - 186}" fill="url(#foot)"/>')
o.append(f'<rect x="6" y="6" width="{W - 12}" height="{H - 12}" rx="3" fill="none" stroke="url(#gold)" stroke-width=".8"/>')
o.append(f'<rect x="8.2" y="8.2" width="{W - 16.4}" height="{H - 16.4}" rx="2" fill="none" stroke="{GOLD}" stroke-width=".25" opacity=".7"/>')

# ---------- top centre: the Construction Gear World card with the big QR ----------
cw, ch = 106, 160
cx0, cy0 = CX - cw / 2, 17
o.append(f'<rect x="{cx0 - 1.6}" y="{cy0 - 1.6}" width="{cw + 3.2}" height="{ch + 3.2}" rx="5.5" fill="url(#gold)"/>')
o.append(f'<rect x="{cx0}" y="{cy0}" width="{cw}" height="{ch}" rx="4" fill="{WHITE}"/>')
o.append(text(CX, cy0 + 11.5, 'Construction Gear World', 7.4, 800, NAVY, family='Inter Display'))
o.append(text(CX, cy0 + 18.6, 'Tools  ·  Workwear  ·  Safety', 4.4, 700, INK, spacing=.2))
qs = 76  # 41 modules of 1.85 mm; at least 4 modules of white on every side (the quiet zone of the QR standard)
path, n_cgw = qr_path(URL_CGW, CX - qs / 2, cy0 + 26.5, qs)
o.append(path)
boxes['cgw'] = {'box': [cx0, cy0, cw, ch], 'url': URL_CGW, 'modules': n_cgw, 'module_mm': round(qs / n_cgw, 2)}
o.append(text(CX, cy0 + 116, 'constructiongearworld.com', 6.2, 800, NAVY))
o.append(f'<rect x="{CX - 26}" y="{cy0 + 121.5}" width="52" height="11" rx="5.5" fill="{NAVY}"/>')
o.append(text(CX, cy0 + 128.9, 'SCAN ME', 4.4, 800, GOLD2, spacing=.8))
o.append(f'<line x1="{cx0 + 12}" y1="{cy0 + 139}" x2="{cx0 + cw - 12}" y2="{cy0 + 139}" stroke="{GOLD}" stroke-width=".35"/>')
o.append(text(CX, cy0 + 146, 'Power tools  ·  Hand tools  ·  Workwear', 4.0, 600, INK))
o.append(text(CX, cy0 + 152.5, 'Safety boots  ·  PPE  ·  Site equipment', 4.0, 600, INK))

# ---------- left: Gear World first (the gold GW mark) ----------
lx = 26
o.append(gw_mark(lx, 56, 13))
o.append(text(lx + 17, 64.8, 'GEAR WORLD', 6.2, 800, GOLD2, 'start', 'Inter Display', 1.6))
o.append(text(lx, 90, 'Built for', 13, 800, WHITE, 'start', 'Inter Display'))
o.append(text(lx, 106, 'the job.', 13, 800, GOLD2, 'start', 'Inter Display'))
o.append(text(lx, 120, 'Compare prices on tools, workwear', 4.6, 500, BLUE_TXT, 'start'))
o.append(text(lx, 127, 'and safety gear in one place.', 4.6, 500, BLUE_TXT, 'start'))

# ---------- right: how it works (orange steps) ----------
rx1 = W - 26
bw, bh = 112, 44
bx, by = rx1 - bw, 66
o.append(text(rx1, 60, 'HOW IT WORKS', 6.2, 800, GOLD2, 'end', 'Inter Display', 1.2))
o.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="3" fill="{NAVY}" fill-opacity=".9" stroke="url(#gold)" stroke-width=".55"/>')
for i, step in enumerate(['Scan the code', 'Compare the deals', 'Buy direct from the shop']):
    yy = by + 12 + i * 11
    o.append(f'<circle cx="{bx + 10}" cy="{yy - 1.5}" r="3.4" fill="{ORANGE}"/>')
    o.append(text(bx + 10, yy, str(i + 1), 4.0, 800, WHITE))
    o.append(text(bx + 17, yy, step, 4.8, 600, WHITE, 'start'))
o.append(text(rx1, 122, 'Free to use.', 5.2, 700, WHITE, 'end'))
o.append(text(rx1, 129.5, 'No sign-up needed.', 4.6, 500, BLUE_TXT, 'end'))

# ---------- bottom: the GEAR WORLD ECOSYSTEM strip and the smaller Hub QR ----------
px0, py0, px1, py1 = 18, 187, W - 18, 283
o.append(f'<rect x="{px0}" y="{py0}" width="{px1 - px0}" height="{py1 - py0}" rx="4" fill="{DEEP}" fill-opacity=".82" stroke="url(#gold)" stroke-width=".7"/>')
hw, hh = 70, 88  # the Hub card, right of the strip
hx0, hy0 = px1 - 6 - hw, py0 + 4
LX = (px0 + hx0) / 2  # centre of the names area
o.append(text(LX, 203, 'GEAR WORLD ECOSYSTEM', 5.0, 800, GOLD2, spacing=1.6))
o.append(f'<line x1="{LX - 112}" y1="201.4" x2="{LX - 58}" y2="201.4" stroke="{GOLD}" stroke-width=".35"/><line x1="{LX + 58}" y1="201.4" x2="{LX + 112}" y2="201.4" stroke="{GOLD}" stroke-width=".35"/>')


def chips(names, y):
    widths = [len(nm) * 3.05 + 12 for nm in names]
    gap = 4; total = sum(widths) + gap * (len(names) - 1); x = LX - total / 2
    for nm, w in zip(names, widths):
        if nm == HERE_WORLD:
            o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="11" rx="5.5" fill="url(#gold)"/>')
            o.append(text(x + w / 2, y + 7.5, nm, 5.0, 800, NAVY))
        else:
            o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="11" rx="5.5" fill="{NAVY}" fill-opacity=".85" stroke="url(#gold)" stroke-width=".55"/>')
            o.append(text(x + w / 2, y + 7.5, nm, 5.0, 700, WHITE))
        x += w + gap


chips(WORLDS[:7], 211)
chips(WORLDS[7:], 226.5)
o.append(text(LX, 247, 'Tools  ·  Fashion  ·  Kids  ·  Home  ·  Garden  ·  Tech  ·  Car  ·  Travel  ·  Sport  ·  Motorbike  ·  Gaming  ·  Pets', 3.6, 500, BLUE_SOFT))
o.append(text(LX, 262, 'Looking for more than tools?', 5.6, 800, WHITE))
o.append(text(LX, 270.5, 'Search all 13 Gear Worlds at once in the Gear World Hub', 4.6, 500, BLUE_TXT))
# arrow to the Hub card
ax = hx0 - 9
o.append(f'<path d="M{ax - 14} 266.3 H{ax}" stroke="{ORANGE}" stroke-width="1.1" stroke-linecap="round"/><path d="M{ax - 3.2} 263.2 L{ax + .6} 266.3 L{ax - 3.2} 269.4" fill="none" stroke="{ORANGE}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>')
o.append(f'<rect x="{hx0 - 1.2}" y="{hy0 - 1.2}" width="{hw + 2.4}" height="{hh + 2.4}" rx="4.5" fill="url(#gold)"/>')
o.append(f'<rect x="{hx0}" y="{hy0}" width="{hw}" height="{hh}" rx="3.4" fill="{WHITE}"/>')
hcx = hx0 + hw / 2
o.append(text(hcx, hy0 + 8.6, 'Gear World Hub', 5.8, 800, NAVY, family='Inter Display'))
o.append(text(hcx, hy0 + 13.6, 'Every world in one search', 3.3, 600, INK))
hqs = 50  # 41 modules of 1.22 mm, at least 4 modules of white around it
path, n_hub = qr_path(URL_HUB, hcx - hqs / 2, hy0 + 19, hqs)
o.append(path)
boxes['hub'] = {'box': [hx0, hy0, hw, hh], 'url': URL_HUB, 'modules': n_hub, 'module_mm': round(hqs / n_hub, 2)}
o.append(text(hcx, hy0 + 78.2, 'gearworldhub.com', 4.8, 800, NAVY))
o.append(text(hcx, hy0 + 84.2, 'SCAN FOR THE HUB', 2.9, 800, ORANGE, spacing=.5))

o.append(text(W - 13, 287.4, 'POSTER CGW', 2.2, 700, GOLD, 'end', spacing=.4))
o.append('</svg>')

svg = '\n'.join(o)
open(os.path.join(OUT, 'poster-cgw.svg'), 'w').write(svg)
cairosvg.svg2pdf(bytestring=svg.encode(), write_to=os.path.join(OUT, 'GearWorld-Poster-Construction-Earth-A3.pdf'))
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'preview.png'), output_width=2480)
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'check.png'), output_width=6000)
json.dump(boxes, open(os.path.join(OUT, 'qr-boxes.json'), 'w'), indent=1)
print('poster-cgw:', {k: (v['modules'], v['module_mm']) for k, v in boxes.items()})
