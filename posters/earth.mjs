// The Earth of the A3 posters: an orthographic globe in mm (Europe in the upper half), as SVG paths for the land
// (with its coastlines), the graticule and the point of the UK. READ-ONLY: it writes one file, nothing goes online.
// Usage (from posters/, after npm ci): node earth.mjs <out.json> <cx> <cy> <r> <lon> <lat>
// The Hub poster (posters/hub) was printed with: node earth.mjs hub/earth.json 210 152 136 12 14
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [out, ...nums] = process.argv.slice(2);
const [cx, cy, r, lon, lat] = nums.map(Number);
if (!out || [cx, cy, r, lon, lat].some(n => !Number.isFinite(n))) {
  console.error('usage: node earth.mjs <out.json> <cx> <cy> <r> <lon> <lat>');
  process.exit(2);
}
const atlas = fileURLToPath(new URL('./node_modules/world-atlas/land-50m.json', import.meta.url));
const topo = JSON.parse(readFileSync(atlas, 'utf8'));
const land = feature(topo, topo.objects.land);
const p = geoOrthographic().translate([cx, cy]).scale(r).rotate([-lon, -lat]).clipAngle(90).precision(0.2);
const path = geoPath(p).digits(2);
writeFileSync(out, JSON.stringify({ land: path(land), grat: path(geoGraticule10()), uk: p([-1.5, 52.5]) }));
console.log('ok', out, (path(land) || '').length);
