// Gear World Hub: the Black Friday 2026 page (owner, «ΕΓΚΡΙΝΩ ΙΔΕΑ 11 Β» and «ΕΓΚΡΙΝΩ SITEMAP BLACK FRIDAY», 18/11/2026,
// lessons L188). An honest page: the retailers' own dates and codes, Gear World links only, no saving or percentage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData, validate, page, build, PAGE } from '../../tools/gwh-black-friday.mjs';
import { BAD_WORDS } from '../../tools/gwh-stores.mjs';
import { sitemapBody } from '../../tools/gwh-sitemap.mjs';

const read = rel => readFileSync(new URL(`../../sites/gwh/${rel}`, import.meta.url), 'utf8');
const data = loadData();

test('L188: the data is valid on its day, and the page in the Hub is exactly the one the tool builds', () => {
  assert.deepEqual(validate(data), []);
  assert.equal(read(`public/${PAGE}`), build(data)[PAGE], 'node tools/gwh-black-friday.mjs build was run');
  assert.ok(read('public-allowlist.txt').split(/\r?\n/).includes('black-friday/index.html'));
});

test('L188: the page says the dates, the retailers that started with their own dates, and the codes with end dates', () => {
  const html = page(data);
  assert.ok(html.includes('<link rel="canonical" href="https://gearworldhub.com/black-friday/">'));
  assert.ok(html.includes('<h1>Black Friday 2026 on Gear World</h1>'));
  assert.ok(html.includes('Black Friday is on Friday 27 Nov 2026 and Cyber Monday on Monday 30 Nov 2026.'));
  for (const r of data.started) assert.ok(html.includes(`<li class="gd-item rt-item rt-offer" data-end="${r.hide}">`) && html.includes(`Black Friday from ${r.from.slice(8).replace(/^0/, '')} `), r.name);
  for (const c of data.codes) assert.ok(html.includes(`<li class="gd-item rt-item rt-offer" data-end="${c.end}">`), c.code || c.title);
  for (const code of ['CLAIMFIFTY', 'CLAIMSEVFY', 'EIN15PCDD', 'EARLYBF10']) assert.ok(html.includes(`<strong class="rt-code" translate="no">${code}</strong>`), code);
  assert.ok(html.includes('/stores/stores.js?v='), 'the script that hides what ended');
});

test('L188: no saving, percentage, shop or partner words, and only Gear World links (never /out/, /go/ or a retailer)', () => {
  const html = page(data);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!BAD_WORDS.test(text), (text.match(BAD_WORDS) || [])[0]);
  assert.ok(!/\b(sale|save|savings?|deals?|was)\b/i.test(text), (text.match(/\b(sale|save|savings?|deals?|was)\b/i) || [])[0]);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    assert.ok(/^\/([^/]|$)/.test(href) || /^https:\/\/([a-z]+gearworld\.com|gearworldhub\.com)\//.test(href) || href === 'mailto:contact@gearworldhub.com', href);
    assert.ok(!/\/(out|go)\//.test(href), href);
  }
});

test('L188: validate refuses an ended code, a percentage and a retailer that is not in the list', () => {
  const ended = { ...data, codes: [{ ...data.codes[0], end: '2026-11-17' }] };
  assert.ok(validate(ended).some(p => p.includes('ended on 2026-11-17')));
  const pct = { ...data, codes: [{ ...data.codes[0], title: '15% off' }] };
  assert.ok(validate(pct).some(p => p.includes('L103/L107')));
  const other = { ...data, codes: [{ ...data.codes[0], slug: 'nobody' }] };
  assert.ok(validate(other).length > 0);
});

test('L188: the home page links to /black-friday/ in 11 languages, and the sitemap has the page', async () => {
  const home = read('public/index.html');
  assert.ok(home.includes('<span data-gwh2="bfLead">Black Friday, 27 Nov:</span>'));
  assert.ok(home.includes('<a href="/black-friday/" data-gwh2="bfLink">dates and discount codes</a>'));
  assert.ok(/\/hub-v2\.js\?v=(20261118-bf1|20261123-mega1)/.test(home)); // L192: a later version (the Mega Stores bar)
  const js = read('public/hub-v2.js');
  for (const key of ['bfLead', 'bfLink']) {
    const m = js.match(new RegExp(`\\n\\s+${key}: (\\[[^\\n]+\\]),`));
    assert.ok(m, key);
    const list = JSON.parse(m[1]);
    assert.equal(list.length, 11, key);
    assert.ok(list.every(t => t && !/%|\bsale\b|\bdeals?\b/i.test(t)), key);
  }
  assert.ok((await sitemapBody('new')).includes('<loc>https://gearworldhub.com/black-friday/</loc>'));
});

test('L188: every item with an end date inside a counted section is counted (no "Nothing running" while items show)', () => {
  const html = page(data);
  for (const sec of html.split('<section ').slice(1).filter(x => x.startsWith('class="gd-group rt-offers"'))) {
    const items = [...sec.matchAll(/<li class="([^"]+)" data-end=/g)].map(m => m[1]);
    assert.ok(items.length > 0 && items.every(c => c.split(' ').includes('rt-offer')), items.join(' | '));
  }
});

test('L188: on 22 Nov 2026 the data is refused (EARLYBF10 ended on 21 Nov), so no Hub release ships an ended code', () => {
  assert.ok(validate(data, '2026-11-22').some(p => p.includes('EARLYBF10') && p.includes('2026-11-21')));
  assert.throws(() => build(data, '2026-11-22'), /EARLYBF10/);
});
