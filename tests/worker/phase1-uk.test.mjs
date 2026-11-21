// Phase 1 of the mass import (chat 7 sheet «Λείπουν 20-11», 21 Nov 2026, lessons L207): the UK shops in pounds. Optica
// Bassol (eyewear, WGW/MGW) and Bioethanol-fireplace.co.uk (HGW/GGW) on the older sites, Alpinestars, MotardInn, Liforme,
// BikeInn, TrekkInn and WaveInn on the new-engine sites (sources.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as bassol from '../../tools/import-rules/opticabassol-uk.mjs';
import * as bio from '../../tools/import-rules/bioethanol-uk.mjs';

const link = (si, dl) => `https://bdt9.net/c/?si=${si}&li=1&wi=447289&pid=abc&dl=${encodeURIComponent(dl)}&ws=`;
const col = row => c => String(row[c] ?? '');

test('L207 Optica Bassol: sunglasses by gender to WGW or MGW, women\'s and unisex frames to WGW Eyeglasses, the rest out', () => {
  const row = { aw_deep_link: link(19032, 'en-gb/products/ray-ban-rb3689-aviator-metal-ii-004-48-62'), dc_gender: 'male', merchant_deep_link: '',
    product_name: 'Ray-Ban RB3689 AVIATOR METAL II 004/48 62', description: 'Ray-Ban aviator.' };
  assert.equal(bassol.field('merchant_deep_link', col(row)), 'https://www.opticabassol.com/en-gb/products/ray-ban-rb3689-aviator-metal-ii-004-48-62');
  assert.ok(bassol.RULES.shop.test(bassol.field('merchant_deep_link', col(row))));
  assert.equal(bassol.field('category_name', col(row)), 'male', 'Daisycon gender_target reaches the rules');
  assert.equal(bassol.field('merchant_category', col(row)), 'sunglasses', 'a Ray-Ban RB code is sunglasses');
  const c = (name, who, description = '') => bassol.classify({ name, awinCategory: who, feedCategory: bassol.kindOf(name, description) });
  assert.deepEqual(c('Ray-Ban RB3689 AVIATOR METAL II 004/48 62', 'male'),
    { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: 'Ray-Ban RB3689 AVIATOR METAL II 004/48 62 Sunglasses' });
  assert.equal(c('Longchamp LO685S 716 59', 'female', 'Introducing the exclusive Longchamp Lo685s sunglasses').site, 'wgw');
  assert.equal(c('Carolina Herrera HER 0258/G/S LHF 54', 'unisex', 'these sunglasses').site, 'wgw', 'unisex goes to WGW');
  assert.deepEqual(c('Guess GU50238 020 53', 'female', 'Discover the Guess GU50238 optical glasses'),
    { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: 'Guess GU50238 020 53 Glasses' });
  assert.match(c('Oakley OX8181 COGNITIVE R 818103 53', 'male').reject, /no Eyeglasses subcategory/);
  assert.match(c('Ray-Ban Kids RY1632 7509 48', 'unisex', 'sunglasses').reject, /children/);
  assert.match(c('Tommy Hilfiger TH 1941 086 48', 'male', 'A modern design.').reject, /do not say/);
  assert.equal(bassol.displayBrand('Ray-ban'), 'Ray-Ban');
  assert.equal(bassol.displayBrand('Tommy hilfiger'), 'Tommy Hilfiger');
  assert.equal(bassol.displayBrand('ProDesign'), 'ProDesign');
});

test('L207 Bioethanol-fireplace.co.uk: indoor fireplaces to HGW, outdoor fires and patio heaters to GGW, parts out', () => {
  const row = { aw_deep_link: link(15514, 'spin-1500-lantern-cover_2012r73256.html'), merchant_deep_link: '', category_name: 'Cover', dc_gender: '' };
  assert.equal(bio.field('merchant_deep_link', col(row)), 'https://www.bioethanol-fireplace.co.uk/spin-1500-lantern-cover_2012r73256.html');
  assert.ok(bio.RULES.shop.test(bio.field('merchant_deep_link', col(row))));
  const c = (name, cat) => bio.classify({ name, feedCategory: cat, awinCategory: cat });
  assert.deepEqual(c('Delaware round wall-mounted Biofireplace in black from ScandiFlames | Wall-mounted bioethanol fireplace', 'Bio Fireplace - Wall-mount'),
    { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Fireplaces' });
  assert.deepEqual(c('Muztag Malaga Patio Heater', 'Free-standing Heater'),
    { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Fire pits & heaters' });
  assert.equal(c('Heatstrip Design 2400 with remote | Bioethanol-fireplace.co.uk', 'Mounted Heaters').site, 'ggw');
  assert.equal(c('Cabo bioethanol fire table from Planika Fires - Automatic burner - Remote control - Dekton marble plates', 'Tables with fireplace').site, 'ggw',
    'features after the first dash are not an add-on');
  assert.equal(c('Planika Fires - Galio Manual 1000 Insert Gas Fireplace - For outdoor use', 'Gas burner insert').site, 'ggw', 'an insert for outdoor use is a garden fire');
  assert.equal(c('Elementi Kira Tabletop Bioethanol Fireplace – Grey Concrete Indoor & Outdoor Burner', 'Bio Fireplace - Tabletop').site, 'hgw', 'indoor and outdoor stays indoor');
  assert.match(c('Muztag Rain Cover | Bioethanol-fireplace.co.uk', 'Cover').reject, /parts, accessories/);
  assert.match(c('6L Bioethanol Fuel for Bioethanol Fireplaces', 'Bio Fireplace Acces - Bioethanol fuel').reject, /parts, accessories/);
  assert.match(c('Protective Cover for Sunwood Marino Gas Patio Fire', 'Free-standing Heater').reject, /add-on/);
  assert.match(c('Prime Fire upgrade for FOCO', '').reject, /add-on/);
  assert.match(c('Wine Cellar for 140 Bottles', 'Vinkælder').reject, /parts, accessories/);
  assert.equal(bio.displayName('Indus Freestanding Patio Heater - 2100W | Bioethanol-fireplace.co.uk'), 'Indus Freestanding Patio Heater - 2100W');
});

test('L207 phase 1 sources: the Daisycon UK shops on BGW and SGW, each with its own file and pounds', () => {
  const src = site => JSON.parse(readFileSync(new URL(`../../sites/${site}/sources.json`, import.meta.url), 'utf8')).sources;
  const want = { bgw: { 21020: 'Alpinestars', 20600: 'MotardInn' }, sgw: { 20256: 'Liforme', 20603: 'BikeInn', 20618: 'TrekkInn', 20619: 'WaveInn' } };
  for (const [site, shops] of Object.entries(want)) {
    const list = src(site);
    for (const [id, name] of Object.entries(shops)) {
      const s = list.filter(x => x.advertiserId === Number(id) && x.network === 'daisycon');
      assert.equal(s.length, 1, `${name} once on ${site}`);
      assert.equal(s[0].retailer, name);
      assert.equal(s[0].currency, 'GBP');
      assert.ok(new RegExp(s[0].file).test(`DAISYCON_${id}.csv.gz`), `${name}: its file`);
      assert.ok(!new RegExp(s[0].file).test(`DAISYCON_${id}_DE.csv.gz`), `${name}: not another country's file`);
      assert.equal(s[0].approved, true);
    }
  }
  const tradeinn = src('sgw').filter(x => [20603, 20618, 20619].includes(x.advertiserId));
  assert.ok(tradeinn.every(x => x.maxProducts === 6000 && x.sportShop && x.defaultSlug), 'the Tradeinn shops keep at most 6,000, as their sister shops (L170)');
});
