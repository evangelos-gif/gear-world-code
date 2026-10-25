// Gear World Hub: Sporty Gear World (SGW) becomes the 10th card, after the hub already has TGW, AGW and VGW.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tgw from '../../tools/gwh-tgw-link.mjs';
import * as agw from '../../tools/gwh-agw-link.mjs';
import * as vgw from '../../tools/gwh-vgw-link.mjs';
import { patchIndexHtml, patchTranslations, SGW_URL, SGW_STYLE } from '../../tools/gwh-sgw-link.mjs';
import { hubIndexHtml, hubTranslationsJs } from '../fixtures/make-hub-fixture.mjs';

// The hub as it is after the TGW, AGW and VGW links.
const withVgwHtml = () => vgw.patchIndexHtml(agw.patchIndexHtml(tgw.patchIndexHtml(hubIndexHtml()).text).text).text;
const withVgwJs = () => vgw.patchTranslations(agw.patchTranslations(tgw.patchTranslations(hubTranslationsJs()).text).text).text;

test('hub index.html: Sport card after Travel, 10-card layout, texts; a second run changes nothing', () => {
  const r = patchIndexHtml(withVgwHtml());
  assert.equal(r.already, false);
  assert.equal(r.text.split('  data-world="SGW"').length - 1, 1, 'one card');
  assert.ok(r.text.indexOf('  data-world="SGW"') > r.text.indexOf('  data-world="VGW"'), 'card comes after Travel');
  assert.ok(r.text.includes(SGW_URL));
  assert.ok(r.text.includes("url('/hub-sgw.jpg')"));
  assert.ok(r.text.includes('<style id="gwh-sgw-card">'));
  assert.ok(!r.text.includes('<style id="gwh-vgw-card">'), 'the 9-card layout is replaced');
  assert.ok(r.text.includes('Garden, Technology, Car, Travel and Sporty Gear World'));
  assert.ok(r.text.includes('Sporty Gear World is now live, expanding the Gear World network to ten specialist shopping worlds.'));
  assert.equal(patchIndexHtml(r.text).already, true);
});

test('hub layout: no 5 columns (cards too small); Sport spans the last row only where the hub shows 3 per row', () => {
  const css = SGW_STYLE.join('\n');
  assert.ok(!/repeat\(5/.test(css));
  assert.match(css, /@media \(min-width:621px\)\{\nbody\[data-gwh-compact-v2="true"\] \.gwh-quick-worlds > \[data-world="SGW"\]\{grid-column:1 \/ -1;aspect-ratio:5 \/ 1;/);
});

test('hub index.html: without the Travel card nothing changes', () => {
  assert.throws(() => patchIndexHtml(agw.patchIndexHtml(tgw.patchIndexHtml(hubIndexHtml()).text).text), /Travel \(VGW\)/);
});

test('hub translations.js: 11 languages, valid JavaScript, ten cards each', () => {
  const r = patchTranslations(withVgwJs());
  assert.equal(r.already, false);
  assert.doesNotThrow(() => new Function(r.text));
  const blocks = r.text.split(/"[a-z]{2}-[A-Z]{2}": \{/).slice(1);
  assert.equal(blocks.length, 11);
  for (const b of blocks) {
    const titles = b.slice(b.indexOf('titles: ['), b.indexOf(']', b.indexOf('titles: [')));
    assert.equal((titles.match(/"/g) || []).length / 2, 10);
  }
  assert.ok(r.text.includes('"Αθλητισμός"') && r.text.includes('"Спорт"') && r.text.includes('"Deporte"'));
  assert.ok(r.text.includes('Technology, Car, Travel και Sporty Gear World'));
  assert.ok(r.text.includes('Sporty Gear World ru-RU десяти worlds.'));
  assert.ok(r.text.includes('Sporty Gear World de-DE zehn worlds.'));
  assert.ok(r.text.includes('Sporty Gear World el-GR δέκα worlds.'));
  assert.ok(r.text.includes('Sporty Gear World pt-PT dez worlds.') && r.text.includes('Sporty Gear World it-IT dieci worlds.'));
  assert.equal(patchTranslations(r.text).already, true);
});
