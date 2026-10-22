// Gear World Hub: Travel Gear World (VGW) becomes the 9th card, after the hub already has Technology (TGW) and Car (AGW).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tgw from '../../tools/gwh-tgw-link.mjs';
import * as agw from '../../tools/gwh-agw-link.mjs';
import { patchIndexHtml, patchTranslations, VGW_URL } from '../../tools/gwh-vgw-link.mjs';
import { hubIndexHtml, hubTranslationsJs } from '../fixtures/make-hub-fixture.mjs';

// The hub as it is after the TGW and AGW links.
const withAgwHtml = () => agw.patchIndexHtml(tgw.patchIndexHtml(hubIndexHtml()).text).text;
const withAgwJs = () => agw.patchTranslations(tgw.patchTranslations(hubTranslationsJs()).text).text;

test('hub index.html: Travel card after Car, 9-card layout, texts; a second run changes nothing', () => {
  const r = patchIndexHtml(withAgwHtml());
  assert.equal(r.already, false);
  assert.equal(r.text.split('  data-world="VGW"').length - 1, 1, 'one card');
  assert.ok(r.text.indexOf('  data-world="VGW"') > r.text.indexOf('  data-world="AGW"'), 'card comes after Car');
  assert.ok(r.text.includes(VGW_URL));
  assert.ok(r.text.includes("url('/hub-vgw.jpg')"));
  assert.ok(r.text.includes('<style id="gwh-vgw-card">'));
  assert.ok(!r.text.includes('<style id="gwh-agw-card">'), 'the 8-card layout is replaced');
  assert.ok(r.text.includes('Garden, Technology, Car and Travel Gear World'));
  assert.ok(r.text.includes('Travel Gear World is now live, expanding the Gear World network to nine specialist shopping worlds.'));
  assert.equal(patchIndexHtml(r.text).already, true);
});

test('hub index.html: without the Car card nothing changes', () => {
  assert.throws(() => patchIndexHtml(tgw.patchIndexHtml(hubIndexHtml()).text), /Car \(AGW\)/);
});

test('hub translations.js: 11 languages, valid JavaScript, nine cards each', () => {
  const r = patchTranslations(withAgwJs());
  assert.equal(r.already, false);
  assert.doesNotThrow(() => new Function(r.text));
  const blocks = r.text.split(/"[a-z]{2}-[A-Z]{2}": \{/).slice(1);
  assert.equal(blocks.length, 11);
  for (const b of blocks) {
    const titles = b.slice(b.indexOf('titles: ['), b.indexOf(']', b.indexOf('titles: [')));
    assert.equal((titles.match(/"/g) || []).length / 2, 9);
  }
  assert.ok(r.text.includes('"Ταξίδι"') && r.text.includes('"Путешествия"'));
  assert.ok(r.text.includes('Technology, Car και Travel Gear World'));
  assert.ok(r.text.includes('Travel Gear World ru-RU девяти worlds.'));
  assert.ok(r.text.includes('Travel Gear World de-DE neun worlds.'));
  assert.ok(r.text.includes('Travel Gear World el-GR εννέα worlds.'));
  assert.equal(patchTranslations(r.text).already, true);
});
