// Builds src/group-map.js, the world map of gearworldgroup.com (lessons L152, owner 14 Nov 2026): one SVG path per
// country, drawn once here and kept in the repo, so the page needs no map service, no file from another site and no
// script (CSP). The Worker only colours the shapes and links them to /countries/<cc>/ (src/group.js).
//
// Source: Natural Earth (public domain) through world-atlas 2.0.2 (countries-110m; countries-50m only for the place of
// the small countries the 110m file leaves out, such as Malta and Liechtenstein, drawn as dots). Projection: Equal
// Earth, 2000 wide, without Antarctica, whole units, each path as short as SVG allows (relative moves, no repeated
// points), so the page stays light.
//
// The packages are not part of the repo. To build again (only when the map itself must change):
//   mkdir map-deps && cd map-deps && npm init -y && npm i world-atlas@2.0.2 topojson-client@3.1.0 d3-geo@3.1.1 i18n-iso-countries@7.14.0
//   node <repo>/tools/group-map-build.mjs <path of map-deps> [<output file>]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const deps = process.argv[2];
if (!deps) {
  console.error('Usage: node tools/group-map-build.mjs <folder with node_modules of the map packages> [<output file>]');
  process.exit(2);
}
const out = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'group-map.js');
const req = createRequire(join(resolve(deps), 'package.json'));
const load = async name => import(pathToFileURL(req.resolve(name)).href);
const { feature } = await load('topojson-client');
const { geoEqualEarth, geoPath, geoCentroid } = await load('d3-geo');
const iso = (await load('i18n-iso-countries')).default;
const { COUNTRY_CODES } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'group.js')).href);

const topo = name => JSON.parse(readFileSync(req.resolve(`world-atlas/${name}`), 'utf8'));
const t110 = topo('countries-110m.json');
const t50 = topo('countries-50m.json');
const WIDTH = 4000;
// Antarctica (010) is left out: no retailer delivers there and it would take a fifth of the map.
const shapes = feature(t110, t110.objects.countries).features.filter(f => f.id !== '010');
// France without French Guiana: the retailers deliver to mainland France, and an outline in South America would read as
// a country of its own.
for (const f of shapes) {
  if (f.id !== '250' || f.geometry.type !== 'MultiPolygon') continue;
  const meanLon = poly => poly[0].reduce((t, p) => t + p[0], 0) / poly[0].length;
  f.geometry.coordinates = f.geometry.coordinates.filter(poly => meanLon(poly) > -20);
}
const projection = geoEqualEarth().fitWidth(WIDTH, { type: 'FeatureCollection', features: shapes });
const [[, y0], [, y1]] = geoPath(projection).bounds({ type: 'FeatureCollection', features: shapes });
const height = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

// A short SVG path: "M x,y" then relative lines ("l" once, then pairs), whole units, a point equal to the one before
// left out, "z" at the end of each ring. Rings that shrink to fewer than 3 points are dropped.
function shortPath(f) {
  const rings = [];
  let ring = null;
  geoPath(projection, {
    moveTo(x, y) { ring = [[Math.round(x), Math.round(y)]]; rings.push(ring); },
    lineTo(x, y) { const p = [Math.round(x), Math.round(y)]; const q = ring[ring.length - 1]; if (p[0] !== q[0] || p[1] !== q[1]) ring.push(p); },
    closePath() { ring = null; }
  })(f);
  const num = (a, first) => (first || a < 0 ? '' : ' ') + a;
  let out = '';
  for (const r of rings) {
    if (r.length > 1 && r[r.length - 1][0] === r[0][0] && r[r.length - 1][1] === r[0][1]) r.pop();
    if (r.length < 3) continue;
    out += `M${r[0][0]},${r[0][1]}l`;
    for (let i = 1; i < r.length; i++) {
      const dx = r[i][0] - r[i - 1][0];
      const dy = r[i][1] - r[i - 1][1];
      out += num(dx, i === 1) + (dy < 0 ? '' : ',') + dy;
    }
    out += 'z';
  }
  return out;
}

// The close-up of Europe (most listed countries are there): longitude -25 to 45, latitude 34 to 71.5, as a box of the
// same drawing, so the same paths serve both maps.
const corners = [];
for (let i = 0; i <= 20; i++) {
  const lon = -25 + (70 * i) / 20;
  const lat = 34 + (37.5 * i) / 20;
  corners.push(projection([lon, 34]), projection([lon, 71.5]), projection([-25, lat]), projection([45, lat]));
}
const ex0 = Math.floor(Math.min(...corners.map(p => p[0])));
const ey0 = Math.floor(Math.min(...corners.map(p => p[1])));
const europe = [ex0, ey0, Math.ceil(Math.max(...corners.map(p => p[0]))) - ex0, Math.ceil(Math.max(...corners.map(p => p[1]))) - ey0];
const inEurope = f => {
  const [[x0, y0b], [x1, y1b]] = geoPath(projection).bounds(f);
  return x1 >= europe[0] && x0 <= europe[0] + europe[2] && y1b >= europe[1] && y0b <= europe[1] + europe[3] ? 1 : 0;
};

const codeOf = f => {
  const cc = f.id ? iso.numericToAlpha2(f.id) : '';
  return /^[A-Z]{2}$/.test(cc || '') ? cc : '';
};
const rows = [];
const seen = new Set();
for (const f of shapes) {
  const d = shortPath(f);
  if (!d) continue;
  const cc = codeOf(f);
  rows.push([cc, d, inEurope(f)]);
  if (cc) seen.add(cc);
}
rows.sort((a, b) => (a[0] || '~').localeCompare(b[0] || '~') || a[1].localeCompare(b[1]));
// The listed countries (src/group.js COUNTRY_CODES) that the 110m file has no shape for: a dot at their centre.
const dots = [];
for (const cc of COUNTRY_CODES) {
  if (seen.has(cc)) continue;
  const f = feature(t50, t50.objects.countries).features.find(x => codeOf(x) === cc);
  if (!f) throw new Error(`no shape for ${cc} in countries-50m`);
  const [x, y] = projection(geoCentroid(f));
  dots.push([cc, Math.round(x), Math.round(y)]);
}

const text = `// Generated by tools/group-map-build.mjs (lessons L152): do not edit by hand, build it again.
// Natural Earth (public domain) through world-atlas 2.0.2, countries-110m; Equal Earth projection, without Antarctica,
// in whole units of a ${WIDTH}-wide drawing (the page scales it).
// MAP_SHAPES: [ISO 3166 code ('' for a place without one), SVG path, 1 when it is also on the close-up of Europe];
// MAP_DOTS: [code, x, y] of the listed countries too small for the 110m file. MAP_EUROPE: the close-up's box [x, y, w, h].
// France without French Guiana.
export const MAP_SIZE = [${WIDTH}, ${height}];
export const MAP_EUROPE = [${europe.join(', ')}];
export const MAP_SHAPES = [
${rows.map(([cc, d, eu]) => `  ['${cc}', '${d}', ${eu}]`).join(',\n')}
];
export const MAP_DOTS = [
${dots.map(([cc, x, y]) => `  ['${cc}', ${x}, ${y}]`).join(',\n')}
];
`;
writeFileSync(out, text);
console.log(`${out}: ${rows.length} shapes (${rows.filter(r => r[2]).length} in Europe ${europe.join(',')}), ${dots.length} dots (${dots.map(d => d[0]).join(', ') || 'none'}), ${WIDTH}x${height}, ${text.length} bytes`);
