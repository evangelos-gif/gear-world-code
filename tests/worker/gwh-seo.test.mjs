// Gear World Hub, Bing Webmaster Tools (31 Oct 2026): robots.txt with the Sitemap line, the title of the home page,
// meta descriptions of 120-160 characters without a number of worlds, and the IndexNow key file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const pub = new URL('../../sites/gwh/public/', import.meta.url);
const read = p => readFileSync(new URL(p, pub), 'utf8');
const TITLE = 'Gear World Hub – Gear, Gifts & Deals From Every Gear World';
const desc = html => (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
const okLength = s => [...s].length >= 120 && [...s].length <= 160;

test('robots.txt: the Hub has its own, with the sitemap the gwh-sitemap Worker serves', () => {
  const r = read('robots.txt');
  assert.match(r, /^User-agent: \*$/m);
  assert.match(r, /^Allow: \/$/m);
  assert.match(r, /^Disallow: \/api\/$/m);
  assert.match(r, /^Sitemap: https:\/\/gearworldhub\.com\/sitemap\.xml$/m);
  assert.ok(!readdirSync(pub).includes('sitemap.xml'), 'the sitemap stays with the gwh-sitemap Worker');
});

test('IndexNow: the key file holds its own name, and the tool knows the same key', () => {
  const files = readdirSync(pub).filter(f => /^gearworldhub-indexnow-[a-z0-9]+\.txt$/.test(f));
  assert.equal(files.length, 1);
  const key = files[0].slice(0, -4);
  assert.match(key, /^[A-Za-z0-9-]{8,128}$/);
  assert.equal(read(files[0]).trim(), key);
  const tool = readFileSync(new URL('../../tools/gwh-hub-v2.ps1', import.meta.url), 'utf8');
  assert.ok(tool.includes(`$IndexNowKey = '${key}'`));
  assert.ok(readFileSync(new URL('../../sites/gwh/public-allowlist.txt', import.meta.url), 'utf8').includes(files[0]));
});

test('home page: the new title in index.html and in translations.js (which sets document.title)', () => {
  const html = read('index.html');
  assert.ok(html.includes(`<title>${TITLE.replace('&', '&amp;')}</title>`));
  const js = read('translations.js');
  assert.ok(js.includes('document.title = "Gear World Hub \\u2013 Gear, Gifts & Deals From Every Gear World";'));
  assert.ok(!js.includes('`${tr("heroDesc")} Gear World Hub.`'), 'the 85-character description is gone');
});

test('meta descriptions: 120-160 characters, no number of worlds, in every language of the home page', () => {
  for (const page of ['index.html', 'terms/index.html', 'contact/index.html']) {
    const d = desc(read(page));
    assert.ok(okLength(d), `${page}: ${[...d].length} characters`);
    assert.doesNotMatch(d, /\d/, `${page}: no number`);
  }
  // translations.js: run it in a small fake browser and read the description for each language.
  const js = read('translations.js');
  const locales = JSON.parse(js.match(/const LOCALES = (\[[^\]]*\])/)[1].replace(/\s+/g, ''));
  const metaDesc = js.match(/metaDesc: \[([\s\S]*?)\n    \]/)[1];
  const list = vm.runInNewContext(`[${metaDesc}]`);
  assert.equal(list.length, locales.length);
  for (const [i, d] of list.entries()) {
    assert.ok(okLength(d), `${locales[i]}: ${[...d].length} characters`);
    assert.doesNotMatch(d, /\d/, `${locales[i]}: no number`);
  }
  assert.equal(list[0], desc(read('index.html')), 'English is the same as the page itself');
});
