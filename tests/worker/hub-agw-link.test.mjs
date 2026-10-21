// Gear World Hub: Car Gear World (AGW) becomes the 8th card, after the hub already has Technology (TGW).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tgw from '../../tools/gwh-tgw-link.mjs';
import { patchIndexHtml, patchTranslations, AGW_URL } from '../../tools/gwh-agw-link.mjs';
import { hubIndexHtml, hubTranslationsJs } from '../fixtures/make-hub-fixture.mjs';

// The hub as it is after the TGW link.
const withTgwHtml = () => tgw.patchIndexHtml(hubIndexHtml()).text;
const withTgwJs = () => tgw.patchTranslations(hubTranslationsJs()).text;

test('hub index.html: Car card after Technology, 8-card layout, texts; a second run changes nothing', () => {
  const r = patchIndexHtml(withTgwHtml());
  assert.equal(r.already, false);
  assert.equal(r.text.split('  data-world="AGW"').length - 1, 1, 'one card');
  assert.ok(r.text.indexOf('  data-world="AGW"') > r.text.indexOf('  data-world="TGW"'), 'card comes after Technology');
  assert.ok(r.text.includes(AGW_URL));
  assert.ok(r.text.includes('<style id="gwh-agw-card">'));
  assert.ok(!r.text.includes('<style id="gwh-tgw-card">'), 'the 7-card layout is replaced');
  assert.ok(r.text.includes('Home, Garden, Technology and Car Gear World'));
  assert.ok(r.text.includes('Car Gear World is now live, expanding the Gear World network to eight specialist shopping worlds.'));
  assert.equal(patchIndexHtml(r.text).already, true);
});

test('hub index.html: without the TGW card nothing changes', () => {
  assert.throws(() => patchIndexHtml(hubIndexHtml()), /Technology \(TGW\)/);
});

test('hub translations.js: 11 languages, valid JavaScript, eight cards each', () => {
  const r = patchTranslations(withTgwJs());
  assert.equal(r.already, false);
  assert.doesNotThrow(() => new Function(r.text));
  const blocks = r.text.split(/"[a-z]{2}-[A-Z]{2}": \{/).slice(1);
  assert.equal(blocks.length, 11);
  for (const b of blocks) {
    const titles = b.slice(b.indexOf('titles: ['), b.indexOf(']', b.indexOf('titles: [')));
    assert.equal((titles.match(/"/g) || []).length / 2, 8);
  }
  assert.ok(r.text.includes('"Αυτοκίνητο"') && r.text.includes('"Авто"'));
  assert.ok(r.text.includes('Home, Garden, Technology και Car Gear World'));
  assert.ok(r.text.includes('Car Gear World ru-RU восьми worlds.'));
  assert.ok(r.text.includes('Car Gear World ro-RO opt worlds.'));
  assert.ok(r.text.includes('Car Gear World el-GR οκτώ worlds.'));
  assert.equal(patchTranslations(r.text).already, true);
});
