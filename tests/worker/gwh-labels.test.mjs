// Gear World Hub search labels (26/10/2026): every search result shows the code of its own Gear World, and the
// waiting text names no fixed list of sites. Before, app.js knew only the first 6 sites: TGW, AGW, VGW and SGW
// results said "GEAR WORLD", and the waiting text listed "CGW, MGW, WGW, KGW, HGW and GGW" (lessons L01:
// the code writes no list of sites by hand).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const LOCALES = ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];

// The label function exactly as the page runs it, taken out of public/app.js.
function siteShortName() {
  const code = read('public/app.js');
  const m = code.match(/function siteShortName\(site\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'app.js has siteShortName()');
  const sandbox = {};
  vm.runInNewContext(`${m[0]}\nthis.siteShortName = siteShortName;`, sandbox);
  return sandbox.siteShortName;
}

test('search labels: each of the 10 Gear Worlds shows its own code, never "GEAR WORLD"', () => {
  const name = siteShortName();
  for (const code of ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw']) {
    assert.equal(name(code), code.toUpperCase(), code);
  }
  assert.equal(name('SGW'), 'SGW', 'a code in capitals stays the same');
  assert.equal(name(' xgw '), 'XGW', 'a new Gear World needs no change of the code');
});

test('search labels: anything that is not a 3-letter code keeps the general label', () => {
  const name = siteShortName();
  for (const value of ['', undefined, null, 'gear-world', 'gw', '<b>', 'sgw1', 'ab c']) {
    assert.equal(name(value), 'GEAR WORLD', String(value));
  }
});

test('search labels: the results escape the label (no HTML from the API reaches the page)', () => {
  const code = read('public/app.js');
  assert.match(code, /\$\{escapeHtml\(siteShortName\(product\.site\)\)\}/);
});

test('search labels: the waiting text names no list of sites, in all 11 languages of the Hub', () => {
  const code = read('public/translations.js');
  const m = code.match(/searchingWorlds:\s*(\[[^\]]*\])/);
  assert.ok(m, 'translations.js has searchingWorlds');
  const list = JSON.parse(m[1]);
  assert.equal(list.length, LOCALES.length);
  for (const l of LOCALES) assert.ok(code.includes(`"${l}"`), `the Hub has ${l}`);
  assert.equal(list[0], 'Searching all Gear Worlds...');
  assert.equal(list[1], 'Αναζήτηση σε όλα τα Gear Worlds...');
  list.forEach((text, i) => {
    assert.ok(typeof text === 'string' && text.trim().length > 10, LOCALES[i]);
    assert.ok(!/\b[A-Z]GW\b/.test(text), `no site codes in ${LOCALES[i]}: ${text}`);
    assert.ok(text.includes('Gear Worlds'), `the name "Gear Worlds" stays in ${LOCALES[i]}`);
    assert.ok(text.endsWith('...'), `${LOCALES[i]} ends like the other waiting texts`);
    if (i > 0) assert.notEqual(text, list[0], `translated in ${LOCALES[i]}`);
  });
  assert.ok(!/CGW, MGW, WGW, KGW, HGW/.test(code), 'the old list of 6 sites is gone');
});

test('search labels: the page loads the new app.js and translations.js (new ?v=, lessons L31)', () => {
  const html = read('public/index.html');
  assert.match(html, /<script src="\/app\.js\?v=20261026-labels1"><\/script>/);
  assert.match(html, /<script src="\/translations\.js\?v=20261026-labels1"><\/script>/);
  assert.ok(!html.includes('app.js?v=20261005-mobile3') && !html.includes('translations.js?v=20261005-search-gr-final'), 'old ?v= gone');
});

test('search labels: the Hub folder has only allowed files, and the baseline names every one (lessons L04)', () => {
  const allow = read('public-allowlist.txt').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  for (const f of ['app.js', 'translations.js', 'index.html', 'hub-sgw.jpg']) assert.ok(allow.includes(f), f);
  const base = read('live-baseline.txt').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(' | ')[0]);
  // The 3 new files of the Hub V2 (tools/gwh-hub-v2.ps1) are not live yet: they enter the baseline after its live step.
  const notLiveYet = ['hub-v2.css', 'hub-v2.js', 'hub-deals.json', ...['halloween', 'black-friday', 'christmas'].flatMap(n => [`seasonal/${n}.mp4`, `seasonal/${n}.jpg`])];
  for (const f of allow) if (!notLiveYet.includes(f)) assert.ok(base.includes(`public/${f}`), `baseline has public/${f}`);
  assert.ok(base.includes('worker.js') && base.includes('photo-search.js'));
});
