import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseCartItems, cartQuery } from '../../src/pages/cart.js';
import { parseRates, exchangeRates, _resetForTests } from '../../src/lib/fx.js';
import { tr, priceTag } from '../../src/pages/layout.js';
import { toString } from '../../src/lib/html.js';
import site from '../../sites/tgw/site.config.js';

test('cart items: whole numbers only, no repeats, quantity 1-99, at most 30 (lessons L26)', () => {
  const u = q => new URL(`https://x.test/cart/?items=${q}`);
  assert.deepEqual(parseCartItems(u('12:2,34,12:5,abc,0:1,-3:2,56:0,78:500')), [
    { id: 12, qty: 2 }, { id: 34, qty: 1 }, { id: 56, qty: 1 }, { id: 78, qty: 99 }
  ]);
  const many = Array.from({ length: 40 }, (_, i) => `${i + 1}:1`).join(',');
  assert.equal(parseCartItems(u(many), { maxItems: 30 }).length, 30);
  assert.equal(cartQuery([]), '/cart/');
  assert.equal(cartQuery([{ id: 5, qty: 2 }, { id: 9, qty: 1 }]), '/cart/?items=5:2,9:1');
});

test('exchange rates: only the asked currencies, positive numbers, from the site currency (lessons L25)', () => {
  const rows = [
    { date: '2026-10-19', base: 'GBP', quote: 'EUR', rate: 1.18 },
    { date: '2026-10-18', base: 'GBP', quote: 'RON', rate: 6.3 },
    { date: '2026-10-19', base: 'GBP', quote: 'USD', rate: 1.3 },
    { date: '2026-10-19', base: 'USD', quote: 'ALL', rate: 90 },
    { date: '2026-10-19', base: 'GBP', quote: 'RUB', rate: -1 }
  ];
  assert.deepEqual(parseRates('GBP', ['EUR', 'ALL', 'RON', 'RUB'], rows), { rates: { EUR: 1.18, RON: 6.3 }, date: '2026-10-19' });
  assert.deepEqual(parseRates('GBP', ['EUR'], { not: 'a list' }), { rates: {}, date: '' });
});

test('exchange rates: a failed request gives ok:false, so pages show pounds only', async () => {
  _resetForTests();
  const failing = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const d = await exchangeRates(site, null, failing);
  assert.equal(d.ok, false);
  assert.equal(d.base, 'GBP');
  assert.deepEqual(d.rates, {});
  _resetForTests();
  const working = async url => {
    assert.match(url, /base=GBP&quotes=EUR,ALL,RON,RUB$/);
    return { ok: true, json: async () => [{ base: 'GBP', quote: 'EUR', rate: 1.2, date: '2026-10-19' }] };
  };
  const ok = await exchangeRates(site, null, working);
  assert.equal(ok.ok, true);
  assert.equal(ok.rates.EUR, 1.2);
  _resetForTests();
});

test('tr(): English text in the HTML, key and parts in attributes, everything escaped (lessons L24)', () => {
  assert.equal(toString(tr('View at {0}', 'A&B <Shop>')),
    '<span data-i18n="View at {0}" data-i18n-0="A&amp;B &lt;Shop&gt;">View at A&amp;B &lt;Shop&gt;</span>');
  assert.equal(toString(tr('Prices last updated {0}.', { date: '2026-10-18', text: '18 Oct 2026' })),
    '<span data-i18n="Prices last updated {0}." data-i18n-0="18 Oct 2026" data-i18n-0-date="2026-10-18">Prices last updated 18 Oct 2026.</span>');
  assert.equal(toString(priceTag(site, 35.9, 'gbp')), '<span class="price" data-price="35.90" data-currency="GBP">£35.90</span>');
});

test('site config: 11 languages like the hub, 5 currencies, a dictionary file for every language', () => {
  const codes = site.languages.map(l => l.code);
  assert.deepEqual(codes, ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU']);
  assert.deepEqual(site.displayCurrencies, ['GBP', 'EUR', 'ALL', 'RON', 'RUB']);
  assert.equal(site.displayCurrencies[0], site.currency);
  const en = new Set(Object.keys(JSON.parse(readFileSync('sites/tgw/public/assets/i18n/el-GR.json', 'utf8'))));
  for (const c of codes.filter(c => c !== 'en-GB')) {
    const f = `sites/tgw/public/assets/i18n/${c}.json`;
    assert.ok(existsSync(f), f);
    const d = JSON.parse(readFileSync(f, 'utf8'));
    assert.deepEqual(new Set(Object.keys(d)), en, `${c} has the same texts as el-GR`);
    for (const [k, v] of Object.entries(d)) {
      assert.equal((k.match(/\{\d+\}/g) || []).sort().join(), (v.match(/\{\d+\}/g) || []).sort().join(), `${c}: ${k}`);
    }
  }
});
