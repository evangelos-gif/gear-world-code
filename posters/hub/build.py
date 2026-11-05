# Gear World "Hub only" A3 poster (poster-hub), as PRINTED in Nov 2026: one big Hub QR over a gold-detailed Earth,
# the 13 Gear Worlds listed below. A3 landscape, 420 x 297 mm. Kept here so the code is never lost again (5/11/2026).
# The QR address is printed: it must NEVER change (lessons L76). Build: see posters/README.md.
import os, json, random, subprocess
import qrcode, cairosvg
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

W, H = 420, 297
URL = 'https://gearworldhub.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster-hub&utm_content=hub'
NAVY, DEEP, GOLD, GOLD2, WHITE, INK = '#0e2a66', '#060f26', '#d9ae4a', '#f3d78f', '#ffffff', '#0f1d3d'
WORLDS = ['Construction', "Men's", "Women's", "Kids'", 'Home', 'Garden', 'Technology',
          'Travel', 'Car', 'Sporty', 'Biker', 'Gaming', 'Pets']
CX, CY, R = 210, 152, 136
EARTH = os.path.join(HERE, 'earth.json')
if not os.path.exists(EARTH):
    subprocess.run(['node', os.path.join(HERE, '..', 'earth.mjs'), EARTH, str(CX), str(CY), str(R), '12', '14'], check=True)
E = json.load(open(EARTH))


def text(x, y, s, size, weight=400, fill=WHITE, anchor='middle', family='Inter', spacing=0):
    ls = f' letter-spacing="{spacing}"' if spacing else ''
    return f'<text x="{x:.2f}" y="{y:.2f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{ls}>{escape(s)}</text>'


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
o.append(f'<rect width="{W}" height="{H}" fill="url(#space)"/>')
random.seed(13)
for _ in range(260):  # stars, a few of them gold
    x, y = random.uniform(0, W), random.uniform(0, H)
    if (x - CX) ** 2 + (y - CY) ** 2 < (R + 6) ** 2: continue
    c = GOLD2 if random.random() < .25 else WHITE
    o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{random.uniform(.15, .55):.2f}" fill="{c}" opacity="{random.uniform(.35, .9):.2f}"/>')
# gold orbit behind the Earth
o.append(f'<ellipse cx="{CX}" cy="{CY + 8}" rx="{R + 58}" ry="{R * .34:.1f}" fill="none" stroke="url(#gold)" stroke-width=".7" opacity=".75" transform="rotate(-12 {CX} {CY})"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R + 9}" fill="url(#glow)"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#ocean)"/>')
o.append(f'<g clip-path="url(#disc)"><path d="{E["grat"]}" fill="none" stroke="{GOLD}" stroke-width=".22" opacity=".45"/>')
o.append(f'<path d="{E["land"]}" fill="{GOLD}" fill-opacity=".22" stroke="{GOLD2}" stroke-width=".34" stroke-linejoin="round"/></g>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#shade)"/>')
o.append(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="url(#gold)" stroke-width="1.1"/>')
ux, uy = E['uk']  # a gold spark on the UK
o.append(f'<circle cx="{ux:.2f}" cy="{uy:.2f}" r="1.6" fill="{GOLD2}"/><circle cx="{ux:.2f}" cy="{uy:.2f}" r="3.4" fill="none" stroke="{GOLD2}" stroke-width=".4" opacity=".8"/>')
o.append(f'<rect width="{W}" height="{H}" fill="url(#sides)"/>')
o.append(f'<rect y="200" width="{W}" height="{H - 200}" fill="url(#foot)"/>')
o.append(f'<rect x="6" y="6" width="{W - 12}" height="{H - 12}" rx="3" fill="none" stroke="url(#gold)" stroke-width=".8"/>')
o.append(f'<rect x="8.2" y="8.2" width="{W - 16.4}" height="{H - 16.4}" rx="2" fill="none" stroke="{GOLD}" stroke-width=".25" opacity=".7"/>')

# the Hub card
cw, ch = 100, 146
cx0, cy0 = CX - cw / 2, 64
o.append(f'<rect x="{cx0 - 1.6}" y="{cy0 - 1.6}" width="{cw + 3.2}" height="{ch + 3.2}" rx="5.5" fill="url(#gold)"/>')
o.append(f'<rect x="{cx0}" y="{cy0}" width="{cw}" height="{ch}" rx="4" fill="{WHITE}"/>')
o.append(text(CX, cy0 + 13, 'Gear World Hub', 9.2, 800, NAVY, family='Inter Display'))
o.append(text(CX, cy0 + 20.5, 'Search every world at once', 4.2, 600, INK))
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0); q.add_data(URL); q.make(fit=True)
m = q.get_matrix(); n = len(m); qs = 78; s = qs / n; qx, qy = CX - qs / 2, cy0 + 26
o.append('<path d="' + ''.join(f'M{qx + c * s:.3f} {qy + r * s:.3f}h{s:.3f}v{s:.3f}h-{s:.3f}z' for r, row in enumerate(m) for c, v in enumerate(row) if v) + f'" fill="{INK}" shape-rendering="crispEdges"/>')
o.append(text(CX, cy0 + 118, 'gearworldhub.com', 7.4, 800, NAVY))
o.append(f'<rect x="{CX - 26}" y="{cy0 + 125}" width="52" height="11" rx="5.5" fill="{NAVY}"/>')
o.append(text(CX, cy0 + 132.4, 'SCAN ME', 4.4, 800, GOLD2, spacing=.8))

# left and right words (as printed; the newer posters do not say "UK", see posters/README.md)
o.append(text(26, 98, 'GEAR WORLD', 6.2, 800, GOLD2, 'start', 'Inter Display', 1.6))
o.append(text(26, 118, 'One scan.', 13, 800, WHITE, 'start', 'Inter Display'))
o.append(text(26, 134, 'Every deal.', 13, 800, GOLD2, 'start', 'Inter Display'))
o.append(text(26, 148, 'Thousands of deals from UK shops,', 4.6, 500, '#d6e0f5', 'start'))
o.append(text(26, 155, 'sorted into 13 specialist worlds.', 4.6, 500, '#d6e0f5', 'start'))
rx0 = W - 26
o.append(text(rx0, 98, 'NEVER MISS A DEAL', 6.2, 800, GOLD2, 'end', 'Inter Display', 1.2))
o.append(text(rx0, 114, 'Sign up free at', 5.2, 500, '#d6e0f5', 'end'))
o.append(text(rx0, 123, 'gearworldhub.com', 6.4, 800, WHITE, 'end'))
o.append(text(rx0, 136, 'New deals and new Gear Worlds,', 4.6, 500, '#d6e0f5', 'end'))
o.append(text(rx0, 143, 'straight to your inbox.', 4.6, 500, '#d6e0f5', 'end'))

# the 13 worlds
o.append(text(CX, 232, 'GEAR WORLD ECOSYSTEM', 4.4, 800, GOLD2, spacing=1.4))
o.append(f'<line x1="{CX - 98}" y1="230.6" x2="{CX - 50}" y2="230.6" stroke="{GOLD}" stroke-width=".35"/><line x1="{CX + 50}" y1="230.6" x2="{CX + 98}" y2="230.6" stroke="{GOLD}" stroke-width=".35"/>')


def chips(names, y):
    widths = [len(nm) * 3.05 + 12 for nm in names]
    gap = 4; total = sum(widths) + gap * (len(names) - 1); x = CX - total / 2
    for nm, w in zip(names, widths):
        o.append(f'<rect x="{x:.2f}" y="{y}" width="{w:.2f}" height="11" rx="5.5" fill="{DEEP}" fill-opacity=".75" stroke="url(#gold)" stroke-width=".55"/>')
        o.append(text(x + w / 2, y + 7.5, nm, 5.0, 700, WHITE))
        x += w + gap


chips(WORLDS[:7], 240)
chips(WORLDS[7:], 256)
o.append(text(CX, 279, 'Tools  ·  Fashion  ·  Toys  ·  Home  ·  Garden  ·  Tech  ·  Travel  ·  Car  ·  Sport  ·  Motorbike  ·  Gaming  ·  Pets', 3.6, 500, '#b9c7e6'))
o.append(text(W - 13, 285.5, 'POSTER HUB', 2.2, 700, GOLD, 'end', spacing=.4))
o.append('</svg>')

svg = '\n'.join(o)
open(os.path.join(OUT, 'poster-hub.svg'), 'w').write(svg)
cairosvg.svg2pdf(bytestring=svg.encode(), write_to=os.path.join(OUT, 'GearWorld-Poster-Hub-A3.pdf'))
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'preview.png'), output_width=2480)
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, 'check.png'), output_width=5000)
json.dump({'hub': {'box': [cx0, cy0, cw, ch], 'url': URL, 'modules': n, 'module_mm': round(qs / n, 2)}},
          open(os.path.join(OUT, 'qr-boxes.json'), 'w'), indent=1)
print('poster-hub:', n, 'modules,', round(qs / n, 2), 'mm each')
