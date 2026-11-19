// Massive import of 19 Nov 2026 (lessons L198), the day the older sites stopped reading whole categories (L193):
// the caps that only kept categories under 20,000 go, and five more tyre shops come to Car Gear World, each shown only in
// its own country.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAR_TYRE_CATEGORY, tyreBracketProduct } from '../../tools/tgw-import-plan.mjs';
import agw from '../../sites/agw/site.config.js';

const sources = s => JSON.parse(readFileSync(new URL(`../../sites/${s}/sources.json`, import.meta.url), 'utf8')).sources;

test('L198: the Delticom seasons in French, Italian, Finnish and Greek; motorbike, truck and tubes stay out', () => {
  for (const c of ['Pneus été', "Pneus d'hiver", 'Pneus d’hiver', 'Pneus toutes saisons', 'Pneumatici estivi', 'Pneumatici invernali',
    'Pneumatici per tutte le stagioni', 'Kesärenkaat', 'Talvirenkaat', 'Ympärivuotiset renkaat', 'Θερινά ελαστικά', 'Χειμερινά ελαστικά',
    'Eλαστικά όλων των εποχών', 'Ελαστικά όλων των εποχών']) assert.ok(CAR_TYRE_CATEGORY.test(c), c);
  for (const c of ['Pneus moto', 'Pneumatici per moto', 'Ελαστικά μοτοσικλέτας', 'σωλήνας', "Camera d'aria", 'Motorsykkel dekk',
    'Kuorma-autonrenkaat, erikoisrenkaat ja teollisuusr', 'Les pneus industriels, pneus camion et les pneus u', '20', 'PKW']) assert.ok(!CAR_TYRE_CATEGORY.test(c), c);
  assert.equal(tyreBracketProduct('Pirelli Cinturato P7 ( 215/50 R17 95W XL, con protezione del cerchio (MFS) )', 'Pirelli', 'Pneumatici estivi').name,
    'Pirelli Cinturato P7 215/50 R17 95W XL');
  assert.equal(tyreBracketProduct('Heidenau K66 Snowtex ( 120/80-14 TL 58S ruota posteriore, M/C, ruota anteriore )', 'Heidenau', 'Pneumatici per moto').ok, false);
});

test('L198: the five new tyre shops, each only in its own country; the three Delticom shops without the 3,000 cap', () => {
  const want = { '123pneus.be': ['BE', 38765, 'tyreBracket'], 'gommadiretto.it': ['IT', 22547, 'tyreBracket'], 'rengas-online.com': ['FI', 22601, 'tyreBracket'],
    'Elastika-Online GR': ['GR', 50239, 'tyreBracket'], 'Elastiko GR': ['GR', 93976, 'tyreNames'] };
  const s = sources('agw');
  for (const [name, [cc, feed, kind]] of Object.entries(want)) {
    const x = s.find(e => e.retailer === name);
    assert.ok(x, name);
    assert.deepEqual(x.feedIds, [feed], name);
    assert.equal(x[kind], true, name);
    assert.equal(x.currency, 'EUR', name);
    assert.equal(x.maxProducts, undefined, name);
    assert.deepEqual(agw.deliversTo.retailers[name], [cc], name);
  }
  for (const name of ['ReifenDirekt.at', 'neumaticos-online.es', 'Autobandenmarkt.nl']) assert.equal(s.find(e => e.retailer === name).maxProducts, undefined, name);
  assert.ok(!s.some(e => e.advertiserId === 8965), 'dekkonline.com NO stays out: Norwegian kroner are not a currency of AGW');
  // The UK view hides every shop that does not deliver there; one query binds each name once (L193), far under the 100 of D1.
  const hidden = Object.entries(agw.deliversTo.retailers).filter(([, c]) => !c.includes('GB')).length;
  assert.ok(hidden <= 30, `AGW hides ${hidden} shops in the UK view`);
});
