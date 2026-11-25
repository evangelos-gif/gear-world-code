// Lessons L232: the read-only helper of tools/yadore.ps1 (tools/yadore-api.mjs): the key test, the plan of stores and
// category words, the report (300-click rule, 1% conversion) and the live check of the pages. Fake answers, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testKey, plan, report, readBox, siteCheck, RULE_CLICKS, SUGGEST, QA_UA } from '../../tools/yadore-api.mjs';
import { yadoreSection } from '../../src/pages/listing.js';
import { toString as htmlText } from '../../src/lib/html.js';
import { useYadoreStores } from '../../src/lib/yadore.js';
import { YADORE_WORDS } from '../../src/lib/yadore-words.js';
import tgw from '../../sites/tgw/site.config.js';

const KEY = 'api-key-for-tests-0123456789';
function fakeApi(routes) {
  const calls = [];
  const fn = async (url, init) => {
    const u = new URL(url);
    calls.push({ u, headers: init && init.headers });
    for (const [path, answer] of Object.entries(routes)) {
      if (u.pathname === path) {
        const a = typeof answer === 'function' ? answer(u) : answer;
        if (a instanceof Response) return a;
        return new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response('{"errors":{}}', { status: 404 });
  };
  fn.calls = calls;
  return fn;
}
const offer = (store, n) => ({ title: `Product ${store} ${n}`, clickUrl: `https://api.yadore.com/v2/r/${n}`, availability: 'AVAILABLE', merchant: { name: store }, price: { amount: '10.00', currency: 'EUR' }, thumbnail: { url: 'https://img.example/x.jpg' } });

test('L232 helper: the key test says whether Yadore took the key and which markets are open, never the key', async () => {
  const ok = await testKey(fakeApi({ '/v2/markets': { markets: [{ id: 'uk' }, { id: 'gr' }] } }), KEY);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.markets, ['gr', 'uk']);
  const bad = await testKey(fakeApi({ '/v2/markets': new Response('{"errors":{"auth":["Header \\"API-Key\\" is missing"]}}', { status: 400 }) }), KEY);
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'key');
  const api = fakeApi({ '/v2/markets': { markets: [] } });
  await testKey(api, KEY);
  assert.equal(api.calls[0].headers['API-Key'], KEY);
  assert.ok(!api.calls[0].u.toString().includes(KEY), 'the key in the header only');
});

test('L232 helper: the plan lists the stores of the market and proposes a few, never the forbidden ones or one without SEO traffic', async () => {
  useYadoreStores(null);
  const merchants = [
    { name: 'alpha.gr', offerCount: 900, trafficTypes: [{ type: 'seo', permission: 'allowed' }] },
    { name: 'beta.gr', offerCount: 50, trafficTypes: [{ type: 'seo', permission: 'not_allowed' }] },
    { name: 'public.gr', offerCount: 9000 }, { name: 'shopflix.gr', offerCount: 9000 }, { name: 'gamma.gr', offerCount: 10 }
  ];
  const api = fakeApi({
    '/v2/markets': { markets: [{ id: 'gr' }] },
    '/v2/merchant': { total: merchants.length, merchants },
    '/v2/offer': u => ({ offers: [offer('alpha.gr', 1), offer('beta.gr', 2), offer('public.gr', 3), offer('shopflix.gr', 4), offer(u.searchParams.get('keyword').length % 2 ? 'gamma.gr' : 'alpha.gr', 5)] })
  });
  const r = await plan(api, KEY, { market: 'gr', sites: ['tgw'], wait: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.categories, Object.keys(YADORE_WORDS.gr.tgw).length);
  assert.ok(r.suggest.includes('alpha.gr'));
  for (const s of ['beta.gr', 'public.gr', 'shopflix.gr']) assert.ok(!r.suggest.includes(s), s);
  assert.ok(r.suggest.length <= SUGGEST);
  const text = r.lines.join('\n');
  assert.match(text, /Λίστα του κώδικα τώρα \(0\): \(άδεια/);
  assert.match(text, /tgw\/laptops-computing/);
  assert.match(text, /κανένα κλικ/);
  assert.ok(!text.includes(KEY));
  for (const c of api.calls.filter(c => c.u.pathname === '/v2/offer')) {
    assert.equal(c.u.searchParams.get('market'), 'gr');
    assert.ok(!c.u.searchParams.has('placementId'), 'the plan is not traffic of a page');
  }
  const closed = await plan(fakeApi({ '/v2/markets': { markets: [{ id: 'uk' }] } }), KEY, { market: 'gr', wait: 0 });
  assert.equal(closed.ok, false);
  assert.equal(closed.error, 'market');
});

test('L232 helper: the report applies the 300-click rule and the 1% target per store, and gives our 70% of the revenue', async () => {
  const api = fakeApi({
    '/v2/conversion/detail/merchant': { total: { sales: 3, clicks: 760 }, salesByMerchant: [
      { market: 'gr', merchant: { name: 'alpha.gr' }, clicks: RULE_CLICKS, sales: 0 },
      { market: 'gr', merchant: { name: 'beta.gr' }, clicks: 250, sales: 1 },
      { market: 'gr', merchant: { name: 'gamma.gr' }, clicks: 200, sales: 2 },
      { market: 'gr', merchant: { name: 'delta.gr' }, clicks: 10, sales: 0 }
    ] },
    '/v2/report/status': { status: 'complete' },
    '/v2/report/general': u => ({ market: { gr: { total: { clicks: 100, revenue: u.searchParams.get('date') === '2026-12-02' ? 10 : 20 } } } })
  });
  const r = await report(api, KEY, { market: 'gr', from: '2026-12-02', to: '2026-12-03', wait: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.pause, ['alpha.gr']);
  assert.equal(r.clicks, 200);
  assert.equal(r.revenue, 30);
  const text = r.lines.join('\n');
  assert.match(text, /alpha\.gr.*ΠΑΥΣΗ \(κανόνας 300 κλικ χωρίς πώληση\)/);
  assert.match(text, /beta\.gr.*ΠΡΟΣΟΧΗ \(μετατροπή κάτω από 1%\)/);
  assert.match(text, /gamma\.gr.*ΕΝΤΑΞΕΙ/);
  assert.match(text, /delta\.gr.*290 κλικ μέχρι τον κανόνα/);
  assert.match(text, /δικά μας ~€21\.00 \(70%\)/);
  assert.match(text, /-Step pause -Stores 'alpha\.gr'/);
  assert.equal((await report(api, KEY, { from: '2026-12-05', to: '2026-12-01' })).ok, false, 'dates the wrong way round');
});

test('L232 helper: the live check reads the box as the site writes it, and every mark it must have', () => {
  const yd = { market: 'gr', checked: '2026-12-03', offers: [1, 2].map(n => ({ title: `T${n}`, store: 'alpha.gr', price: 10, currency: 'EUR', image: 'https://i.example/x.jpg', href: `/out/y/${'a'.repeat(40)}.${'b'.repeat(32)}` })) };
  const page = body => `<html><head><meta name="robots" content="noindex,follow"></head><body>${body}</body></html>`;
  const b = readBox(page(htmlText(yadoreSection(tgw, yd))));
  assert.deepEqual(b, { cards: 2, stores: ['alpha.gr', 'alpha.gr'], problems: [] });
  assert.equal(readBox(page('<main>no box</main>')), null);
  const broken = readBox(htmlText(yadoreSection(tgw, { ...yd, offers: [{ ...yd.offers[0], store: 'amazon.de', title: 'Big SALE' }] })).replace('rel="sponsored nofollow noopener"', 'rel="noopener"'));
  assert.ok(broken.problems.includes('links χωρίς sponsored nofollow'));
  assert.ok(broken.problems.includes('λέξη L107'));
  assert.ok(broken.problems.includes('κατάστημα που απαγορεύεται: amazon.de'));
});

test('L232 helper: the live check asks every category from Greece with the QA header and one page from the UK, never /out/', async () => {
  const seen = [];
  const yd = { market: 'gr', checked: '2026-12-03', offers: [{ title: 'T', store: 'alpha.gr', price: 10, currency: 'EUR', image: 'https://i.example/x.jpg', href: `/out/y/${'a'.repeat(40)}.${'b'.repeat(32)}` }] };
  const withBox = `<html><head><meta name="robots" content="noindex,follow"></head><body>${htmlText(yadoreSection(tgw, yd))}</body></html>`;
  const fetchFn = async (url, init) => {
    seen.push({ url, cc: init.headers['X-GW-QA-Country'], ua: init.headers['User-Agent'] });
    if (url.endsWith('/api/version')) return new Response('{"commit":"' + 'e'.repeat(40) + '"}');
    return new Response(init.headers['X-GW-QA-Country'] === 'GR' ? withBox : '<html></html>');
  };
  const r = await siteCheck(fetchFn, { sites: ['tgw'], wait: 0 });
  assert.equal(r.ok, true, r.lines.join('\n'));
  assert.equal(r.pages, Object.keys(YADORE_WORDS.gr.tgw).length);
  assert.equal(r.shown, r.pages);
  assert.ok(seen.every(s => s.ua === QA_UA && !/\/out\//.test(s.url)));
  assert.equal(seen.filter(s => s.cc === 'GB' && /\/category\//.test(s.url)).length, 1);
  const leak = await siteCheck(async (url, init) => new Response(url.endsWith('/api/version') ? '{}' : withBox), { sites: ['tgw'], wait: 0 });
  assert.equal(leak.ok, false, 'the box in the UK is a problem');
});
