"""Gear World logo v2 - faithful vector rebuild of the original badge (globe with city lights, gold arcs,
metallic GW, gold ring), with the small blurry text removed. Renders need resvg (filters)."""
import math, os, random, sys
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from shapely import affinity
import globe
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = sys.argv[1] if len(sys.argv) > 1 else 'svg2'
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

# Europe in the upper right, Americas on the left edge, Africa lower right - like the original artwork
globe.LAT0, globe.LON0 = 36.0, -24.0
globe._cache = None

# ---------------- GW monogram, traced from the original (1254 px artwork coordinates) ----------------
def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

G_OUT = [(628, 334), (642, 348), (594, 420), (425, 420)]
G_OUT += arc(425, 558, 138, 270, 90)[1:]           # inner bowl, top -> left -> bottom
G_OUT += [(505, 696), (505, 614), (410, 614), (379, 546), (557, 546), (677, 782), (420, 782)]
G_OUT += arc(420, 558, 224, 90, 270)[1:]           # outer bowl, bottom -> left -> top
G_POLY = Polygon(G_OUT).buffer(0)

W_POLY = Polygon([(498, 460), (655, 460), (731, 603), (806, 488), (828, 488), (897, 605), (1066, 358),
                  (1074, 362), (1074, 528), (899, 792), (885, 792), (805, 655), (727, 780), (707, 780),
                  (578, 518), (525, 515)]).buffer(0)
MONO = unary_union([G_POLY, W_POLY])
MX0, MY0, MX1, MY1 = MONO.bounds

def poly_d(geom, tx):
    out = []
    for p in getattr(geom, 'geoms', [geom]):
        for ring in [p.exterior] + list(p.interiors):
            c = [tx(x, y) for x, y in list(ring.coords)[:-1]]
            out.append('M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in c) + ' Z')
    return ' '.join(out)

def mono_d(cx, cy, width):
    s = width / (MX1 - MX0); mx, my = (MX0 + MX1) / 2, (MY0 + MY1) / 2
    return poly_d(MONO, lambda x, y: (cx + (x - mx) * s, cy + (y - my) * s)), s

# ---------------- text as outlines ----------------
FONT = TTFont(os.path.join(HERE, 'fonts', 'poppins-latin-800-normal.woff'))
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT['head'].unitsPerEm
def text_d(txt, x, base, size, tracking=0.0):
    s = size / UPM; out = []; px = x
    for ch in txt:
        gn = CMAP.get(ord(ch))
        if gn is None: continue
        pen = SVGPathPen(GS); GS[gn].draw(TransformPen(pen, (s, 0, 0, -s, px, base)))
        out.append(pen.getCommands()); px += GS[gn].width * s + tracking
    return ' '.join(out), px - tracking - x
def text_w(txt, size, tracking=0.0):
    return text_d(txt, 0, 0, size, tracking)[1]

# ---------------- shared defs ----------------
def defs(p):
    """gradients and filters, ids prefixed with p so several badges can share one SVG"""
    return f'''
<linearGradient id="{p}ring" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#C98A12"/><stop offset=".16" stop-color="#FFD866"/><stop offset=".28" stop-color="#FFF6C6"/>
  <stop offset=".42" stop-color="#F2BE3A"/><stop offset=".58" stop-color="#C88A14"/><stop offset=".74" stop-color="#FFD35C"/>
  <stop offset=".86" stop-color="#FFEFB4"/><stop offset="1" stop-color="#C08412"/></linearGradient>
<linearGradient id="{p}gold" x1="0" y1="0" x2=".35" y2="1">
  <stop offset="0" stop-color="#FFF6C4"/><stop offset=".22" stop-color="#FFD75A"/><stop offset=".5" stop-color="#F0B21E"/>
  <stop offset=".68" stop-color="#FFDC6A"/><stop offset=".86" stop-color="#D99512"/><stop offset="1" stop-color="#A86A06"/></linearGradient>
<linearGradient id="{p}silver" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F1F3F7"/><stop offset="1" stop-color="#B9C2CF"/></linearGradient>
<radialGradient id="{p}ocean" cx=".42" cy=".22" r=".95">
  <stop offset="0" stop-color="#13408F"/><stop offset=".4" stop-color="#0A2560"/><stop offset="1" stop-color="#020A22"/></radialGradient>
<radialGradient id="{p}shade" cx=".42" cy=".18" r="1.0">
  <stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
<linearGradient id="{p}rimfade" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fff" stop-opacity=".6"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="{p}spark">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset=".18" stop-color="#FFE9A6"/><stop offset=".45" stop-color="#FFB627" stop-opacity=".55"/>
  <stop offset="1" stop-color="#FF9F00" stop-opacity="0"/></radialGradient>
<filter id="{p}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="{p}glowS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="{p}shadow" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dx="6" dy="12"/>
  <feComponentTransfer><feFuncA type="linear" slope=".75"/></feComponentTransfer>
  <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
'''

# ---------------- city lights (lon, lat, weight) ----------------
CLUSTERS = [(-1, 52, 8, 5, 140), (10, 48, 9, 5, 170), (16, 44, 10, 5, 90), (-4, 40, 6, 3, 60), (28, 50, 10, 6, 70),
            (-78, 40, 8, 5, 110), (-90, 34, 10, 6, 70), (-118, 36, 5, 4, 30), (-99, 20, 5, 4, 30),
            (31, 30, 4, 3, 30), (7, 6, 5, 3, 25), (-46, -23, 5, 4, 30), (-58, -34, 4, 3, 15), (36, 0, 6, 6, 15)]
def city_lights(cx, cy, r, rng):
    land = globe.land_unit()
    dots = []
    for lon, lat, sx, sy, n in CLUSTERS:
        for _ in range(n):
            lo, la = rng.gauss(lon, sx), rng.gauss(lat, sy)
            la0, lo0 = math.radians(globe.LAT0), math.radians(lo - globe.LON0)
            cosc = math.sin(la0) * math.sin(math.radians(la)) + math.cos(la0) * math.cos(math.radians(la)) * math.cos(lo0)
            if cosc < 0.08: continue
            x, y = globe._project(lo, la)
            if not land.contains(Point(x, y)): continue
            dots.append((cx + x * r, cy + y * r, rng.uniform(.6, 1.6) * r / 452))
    return dots

def arcs(cx, cy, r):
    """golden network lines: soft curves across the globe (in unit coords), ending in sparks"""
    A = [((-1.05, 0.05), (-0.15, -1.0), (1.05, -0.62)),
         ((-1.05, 0.42), (-0.05, -0.38), (1.05, -0.12)),
         ((-0.85, 0.75), (0.25, 0.25), (1.05, 0.30)),
         ((-0.62, -0.30), (0.05, -0.78), (0.58, -0.42)),
         ((0.58, -0.42), (0.85, -0.62), (1.05, -0.88))]
    sparks = [(0.58, -0.42), (0.36, -0.56), (-0.62, -0.30), (-0.62, 0.02), (0.84, -0.20), (0.15, -0.66)]
    T = lambda u, v: (cx + u * r, cy + v * r)
    d = ' '.join('M{:.1f} {:.1f} Q{:.1f} {:.1f} {:.1f} {:.1f}'.format(*T(*a), *T(*b), *T(*c)) for a, b, c in A)
    return d, [T(u, v) for u, v in sparks]

def badge(cx, cy, R, p, rng, mono_width=None, mono_cy=None, ring=True):
    """the round badge: gold ring, night globe, gold lines, metallic GW. R = outer radius of the ring"""
    rg = R * 0.905 if ring else R          # globe radius
    w = R / 512                             # line weight unit
    out = []
    if ring:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#{p}ring)"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{R - 3*w}" fill="none" stroke="#FFF2B0" stroke-opacity=".7" stroke-width="{2.5*w}"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{rg + 5*w}" fill="none" stroke="#5A3A00" stroke-width="{7*w}"/>')
    out.append(f'<clipPath id="{p}clip"><circle cx="{cx}" cy="{cy}" r="{rg}"/></clipPath>')
    out.append(f'<g clip-path="url(#{p}clip)">')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rg}" fill="url(#{p}ocean)"/>')
    out.append(f'<path d="{globe.land_path(cx, cy, rg)}" fill="#17418C" fill-opacity=".85"/>')
    out.append(f'<path d="{globe.land_path(cx, cy, rg)}" fill="none" stroke="#3E80E0" stroke-opacity=".3" stroke-width="{1.6*w}"/>')
    dots = city_lights(cx, cy, rg, rng)
    out.append(f'<g fill="#FFC23D" filter="url(#{p}glowS)">' + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{s*2.6*w:.2f}"/>' for x, y, s in dots) + '</g>')
    out.append(f'<g fill="#FFF1C2">' + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{s*1.1*w:.2f}"/>' for x, y, s in dots) + '</g>')
    ad, sparks = arcs(cx, cy, rg)
    out.append(f'<path d="{ad}" fill="none" stroke="#FFB21E" stroke-width="{9*w}" stroke-opacity=".55" filter="url(#{p}glow)"/>')
    out.append(f'<path d="{ad}" fill="none" stroke="#FFD36A" stroke-width="{2.8*w}" stroke-linecap="round"/>')
    out.append(''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{30*w:.1f}" fill="url(#{p}spark)"/>' for x, y in sparks))
    for x, y in sparks[:2]:
        L = 44 * w
        out.append(f'<g stroke="#FFF4CF" stroke-linecap="round"><line x1="{x-L}" y1="{y}" x2="{x+L}" y2="{y}" stroke-width="{1.6*w}"/>'
                   f'<line x1="{x}" y1="{y-L*0.7}" x2="{x}" y2="{y+L*0.7}" stroke-width="{1.2*w}"/></g>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rg}" fill="url(#{p}shade)"/>')
    out.append('</g>')
    # atmosphere: blue rim light on the upper left, like the original
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rg - 6*w}" fill="none" stroke="#47B4FF" stroke-width="{22*w}" stroke-opacity=".9" filter="url(#{p}glow)" mask="url(#{p}rimmask)"/>')
    out.append(f'<mask id="{p}rimmask"><rect x="{cx-R}" y="{cy-R}" width="{2*R}" height="{2*R}" fill="url(#{p}rimfade)"/></mask>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rg - 2*w}" fill="none" stroke="#A9DBFF" stroke-width="{2.5*w}" stroke-opacity=".8" mask="url(#{p}rimmask)"/>')
    # GW: drop shadow, metallic fill, dark edge, light top edge
    mw = mono_width or rg * 1.66
    d, s = mono_d(cx, mono_cy if mono_cy is not None else cy + rg * 0.02, mw)
    out.append(f'<path d="{d}" fill="#000" filter="url(#{p}shadow)" opacity=".85"/>')
    out.append(f'<path d="{d}" fill="url(#{p}gold)" stroke="#7A4A00" stroke-width="{3.2*w}" stroke-linejoin="round"/>')
    out.append(f'<path d="{d}" fill="none" stroke="#FFF7CF" stroke-opacity=".55" stroke-width="{1.6*w}" stroke-linejoin="round" transform="translate({-1.5*w},{-1.5*w})"/>')
    return ''.join(out)

def svg(w, h, body, p='a'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{defs(p)}</defs>{body}</svg>\n'

def save(name, s):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(s)

BG = '#030A1F'
def bg_rect(w, h): return f'<rect width="{w}" height="{h}" fill="{BG}"/>'

# (a) app icon: badge only, no text (iOS needs a full square without transparency)
save('icon-1024.svg', svg(1024, 1024, bg_rect(1024, 1024) + badge(512, 512, 496, 'a', random.Random(7))))
# Android adaptive icon: background colour + badge inside the 66% safe circle
save('android-adaptive-foreground.svg', svg(1024, 1024, badge(512, 512, 336, 'a', random.Random(7))))
save('android-adaptive-background.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{bg_rect(1024,1024)}</svg>\n')
mono_only, _ = mono_d(512, 512, 600)
save('android-monochrome.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><path d="{mono_only}" fill="#000"/></svg>\n')
save('gw-monogram-gold.svg', svg(1024, 1024, f'<path d="{mono_only}" fill="url(#agold)" stroke="#7A4A00" stroke-width="4" stroke-linejoin="round"/>'))

# (b) full badge like the original: GW + "Gear World" inside the badge; slogan only in this large version
def badge_full(slogan=True, size=1254, p='a'):
    R = size / 2 - 4; cx = cy = size / 2
    body = badge(cx, cy, R, p, random.Random(7), mono_width=R * 1.30, mono_cy=cy - R * 0.13)
    ts = R * 0.235
    tw = text_w('Gear ', ts) + text_w('World', ts)
    x0 = cx - tw / 2; base = cy + R * 0.47
    dg, wg = text_d('Gear ', x0, base, ts)
    dw, _ = text_d('World', x0 + wg, base, ts)
    body += f'<g filter="url(#{p}shadow)"><path d="{dg}" fill="url(#{p}silver)"/><path d="{dw}" fill="url(#{p}gold)" stroke="#7A4A00" stroke-width="{R/512*2}"/></g>'
    if slogan:
        ss = R * 0.072; tr = ss * 0.08
        sw = text_w('ONE HUB. EVERY GEAR WORLD.', ss, tr)
        ds, _ = text_d('ONE HUB. EVERY GEAR WORLD.', cx - sw / 2, base + R * 0.15, ss, tr)
        ly = base + R * 0.15 - ss * 0.36; gap = ss * 0.5; ln = R * 0.11
        body += (f'<path d="{ds}" fill="url(#{p}gold)"/>'
                 f'<g stroke="url(#{p}gold)" stroke-width="{ss*0.12}" stroke-linecap="round">'
                 f'<line x1="{cx - sw/2 - gap - ln}" y1="{ly}" x2="{cx - sw/2 - gap}" y2="{ly}"/>'
                 f'<line x1="{cx + sw/2 + gap}" y1="{ly}" x2="{cx + sw/2 + gap + ln}" y2="{ly}"/></g>')
    return body

save('logo-badge-full.svg', svg(1254, 1254, badge_full(True)))            # transparent corners: dark and light backgrounds
save('logo-badge-name.svg', svg(1254, 1254, badge_full(False)))           # without slogan, for mid sizes

# (c) horizontal logo: badge + name, dark and light backgrounds
def horizontal(dark):
    H = 400; R = 180; cx = cy = 200
    ts = 150; x0 = cx + R + 50; base = 255
    dg, wg = text_d('Gear ', x0, base, ts); dw, ww = text_d('World', x0 + wg, base, ts)
    W = int(x0 + wg + ww + 50)
    body = (f'<rect width="{W}" height="{H}" fill="{BG if dark else "#FFFFFF"}"/>' + badge(cx, cy, R, 'a', random.Random(7)))
    if dark:
        body += f'<g filter="url(#ashadow)"><path d="{dg}" fill="url(#asilver)"/><path d="{dw}" fill="url(#agold)" stroke="#7A4A00" stroke-width="1"/></g>'
    else:
        body += f'<path d="{dg}" fill="#0B1F4B"/><path d="{dw}" fill="#8A5E00"/>'
    return svg(W, H, body)
save('logo-horizontal-dark.svg', horizontal(True))
save('logo-horizontal-light.svg', horizontal(False))

# splash screen (1284x2778): full badge with name and slogan, centred on the dark background
def splash():
    W, H = 1284, 2778; S = 1000
    inner = badge_full(True, S, 'a')
    return svg(W, H, bg_rect(W, H) + f'<g transform="translate({(W-S)/2},{(H-S)/2 - 60})">{inner}</g>')
save('splash.svg', splash())
print('ok', OUT)

# Google Play feature graphic 1024x500 (required for the store listing)
def feature_graphic():
    W, H = 1024, 500; R = 190; cx, cy = 250, 250
    ts = 82; x0 = 462
    dg, wg = text_d('Gear ', x0, 245, ts); dw, ww = text_d('World', x0 + wg, 245, ts)
    ss = 27; tr = 2.2
    ds, sw = text_d('ONE HUB. EVERY GEAR WORLD.', x0 + 4, 305, ss * 0.92, tr)
    body = (f'<rect width="{W}" height="{H}" fill="{BG}"/>'
            f'<radialGradient id="fgglow" cx="{cx}" cy="{cy}" r="520" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#123A86" stop-opacity=".9"/><stop offset="1" stop-color="{BG}" stop-opacity="0"/></radialGradient>'
            f'<rect width="{W}" height="{H}" fill="url(#fgglow)"/>'
            + badge(cx, cy, R, 'a', random.Random(7))
            + f'<g filter="url(#ashadow)"><path d="{dg}" fill="url(#asilver)"/><path d="{dw}" fill="url(#agold)" stroke="#7A4A00" stroke-width="1"/></g>'
            + f'<path d="{ds}" fill="url(#agold)"/>')
    return svg(W, H, body)
save('play-feature-graphic.svg', feature_graphic())
