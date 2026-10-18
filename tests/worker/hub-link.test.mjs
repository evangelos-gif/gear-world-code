import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchIndexHtml, patchTranslations, TGW_URL } from '../../tools/gwh-tgw-link.mjs';
import { hubIndexHtml, hubTranslationsJs } from '../fixtures/make-hub-fixture.mjs';

test('hub index.html: Technology card, layout and texts are added once', () => {
  const r = patchIndexHtml(hubIndexHtml());
  assert.equal(r.already, false);
  assert.equal(r.text.split('  data-world="TGW"').length - 1, 1, 'one card');
  assert.ok(r.text.indexOf('  data-world="TGW"') > r.text.indexOf('data-world="GGW"'), 'card comes after Garden');
  assert.ok(r.text.includes(TGW_URL));
  assert.ok(r.text.includes('<style id="gwh-tgw-card">') && r.text.indexOf('gwh-tgw-card') < r.text.indexOf('</head>'));
  assert.ok(r.text.includes("Home, Garden and Technology Gear World"));
  assert.ok(r.text.includes('Technology Gear World is now live, expanding the Gear World network to seven specialist shopping worlds.'));
  assert.equal(patchIndexHtml(r.text).already, true, 'second run changes nothing');
});

test('hub index.html: an unexpected layout changes nothing', () => {
  assert.throws(() => patchIndexHtml(hubIndexHtml().replace('data-world="GGW"', 'data-world="XXX"')), /Garden/);
  assert.throws(() => patchIndexHtml(hubIndexHtml().replace('six specialist', '6 specialist')), /Growing/);
});

test('hub translations.js: 11 languages, valid JavaScript, seven cards each', () => {
  const r = patchTranslations(hubTranslationsJs());
  assert.equal(r.already, false);
  assert.doesNotThrow(() => new Function(r.text));
  const blocks = r.text.split(/"[a-z]{2}-[A-Z]{2}": \{/).slice(1);
  assert.equal(blocks.length, 11);
  for (const b of blocks) {
    const titles = b.slice(b.indexOf('titles: ['), b.indexOf(']', b.indexOf('titles: [')));
    assert.equal((titles.match(/"/g) || []).length / 2, 7);
  }
  assert.ok(r.text.includes('"Τεχνολογία"') && r.text.includes('"Технологии"'));
  assert.ok(r.text.includes('Home, Garden και Technology Gear World'));
  assert.ok(r.text.includes('Technology Gear World ru-RU семи worlds.'));
  assert.ok(r.text.includes('Technology Gear World ro-RO șapte worlds.'));
  assert.equal(patchTranslations(r.text).already, true, 'second run changes nothing');
});

test('hub translations.js: a missing language changes nothing', () => {
  assert.throws(() => patchTranslations(hubTranslationsJs().replace('    "ru-RU"\n  ];', '  ];')), /languages/);
});
