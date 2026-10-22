"""Simplified globe (land masses) in orthographic projection, as one SVG path. Natural Earth 1:110m (public domain)."""
import json, math, os
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
LAT0, LON0 = 24.0, -28.0   # view over the Atlantic: Americas left, Europe/Africa right, open ocean behind the GW

def _project(lon, lat):
    la, lo = math.radians(lat), math.radians(lon - LON0)
    la0 = math.radians(LAT0)
    x = math.cos(la) * math.sin(lo)
    y = math.cos(la0) * math.sin(la) - math.sin(la0) * math.cos(la) * math.cos(lo)
    cosc = math.sin(la0) * math.sin(la) + math.cos(la0) * math.cos(la) * math.cos(lo)
    if cosc < 0:  # far side: pin to the edge of the disc
        n = math.hypot(x, y) or 1
        x, y = x / n, y / n
    return x, -y  # SVG y goes down

def _densify(coords, step=1.0):
    out = []
    for (a, b), (c, d) in zip(coords[:-1], coords[1:]):
        n = max(1, int(max(abs(c - a), abs(d - b)) / step))
        for i in range(n):
            out.append((a + (c - a) * i / n, b + (d - b) * i / n))
    out.append(coords[-1])
    return out

_cache = None
def land_unit():
    """land shapes on a unit disc (radius 1, centre 0,0), simplified for icon use"""
    global _cache
    if _cache is not None:
        return _cache
    data = json.load(open(os.path.join(HERE, 'data', 'land110.geojson'), encoding='utf-8'))
    # visible hemisphere in lon/lat: latitude above the horizon curve (works because LAT0 > 0)
    t0 = math.tan(math.radians(LAT0))
    edge = [(lo, math.degrees(math.atan(-math.cos(math.radians(lo - LON0)) / t0))) for lo in range(-180, 181)]
    visible = Polygon(edge + [(180, 90), (-180, 90)])
    polys = []
    for f in data['features']:
        g = shape(f['geometry']).buffer(0).intersection(visible)
        for p in getattr(g, 'geoms', [g]):
            if p.is_empty or p.geom_type != 'Polygon':
                continue
            pts = [_project(lo, la) for lo, la in _densify(list(p.exterior.coords))]
            q = Polygon(pts).buffer(0)
            if not q.is_empty:
                polys.append(q)
    land = unary_union(polys)
    # round off and drop small islands so nothing turns into specks at small sizes
    land = land.buffer(0.012).buffer(-0.012).simplify(0.006)
    parts = [p for p in getattr(land, 'geoms', [land]) if p.area > 0.0025]
    _cache = unary_union(parts).intersection(Polygon([(math.cos(t / 90 * math.pi), math.sin(t / 90 * math.pi)) for t in range(180)]))
    return _cache

def land_path(cx, cy, r):
    g = land_unit()
    out = []
    for p in getattr(g, 'geoms', [g]):
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)
            out.append('M' + ' L'.join(f'{cx + x * r:.1f} {cy + y * r:.1f}' for x, y in c[:-1]) + ' Z')
    return ' '.join(out)
