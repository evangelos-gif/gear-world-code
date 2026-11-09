// Where each retailer delivers (lessons L62): the data, the cards and pages, the translations and the flag files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { deliveryCountries, deliveryConfigProblems, COUNTRY_NAMES, FLAGS, WORLDWIDE } from '../../src/lib/delivery.js';
import { productCard, retailerFlag, deliveryText, deliveryLine } from '../../src/pages/layout.js';
import { productPage } from '../../src/pages/product.js';
import { comparePage } from '../../src/pages/compare.js';
import { cartPage } from '../../src/pages/cart.js';
import { toString } from '../../src/lib/html.js';
import tgw from '../../sites/tgw/site.config.js';
import wgw from '../../sites/wgw/site.config.js';
import mgw from '../../sites/mgw/site.config.js';
import ggw from '../../sites/ggw/site.config.js';
import hgw from '../../sites/hgw/site.config.js';
import kgw from '../../sites/kgw/site.config.js';
import cgw from '../../sites/cgw/site.config.js';

const SITES = { tgw, wgw, mgw, ggw, hgw, kgw, cgw };
const product = (over = {}) => ({
  id: 101, product_name: 'Test Drill 18V', brand: 'Acme', retailer: 'Tooled Up', price: 59.99, was_price: null,
  currency: 'GBP', in_stock: 1, item_condition: 'new', image_url: 'https://img.example/a.jpg', category_slug: 'power-tools',
  last_seen_at: '2026-10-25 10:00:00', offer_count: 1, ...over
});
// Cards and labels are HTML fragments; whole pages (productPage, comparePage, cartPage) are already text.
const s = v => toString(v);

test('the countries come from the config: default, a named retailer, worldwide, and nothing without a config', () => {
  const site = { deliversTo: { default: ['GB'], retailers: { Reidl: ['de', 'AT', 'DE'], Far: ['US', 'GB', 'CA', 'AU'], Any: ['WORLD'], Typo: ['XX', 'NL'] } } };
  assert.deepEqual(deliveryCountries(site, 'Tooled Up'), ['GB']);
  assert.deepEqual(deliveryCountries(site, 'Reidl'), ['DE', 'AT'], 'upper case, each country once');
  assert.deepEqual(deliveryCountries(site, 'Any'), [WORLDWIDE]);
  assert.deepEqual(deliveryCountries(site, 'Typo'), ['NL'], 'an unknown code is never shown');
  assert.deepEqual(deliveryCountries(site, 'constructor'), ['GB'], 'a name like an object key gets the default');
  assert.deepEqual(deliveryCountries({}, 'Tooled Up'), []);
  assert.deepEqual(deliveryConfigProblems(site), ['Reidl: write "de" in capitals ("DE")', 'Typo: unknown country code "XX"']);
  assert.deepEqual(deliveryConfigProblems({ deliversTo: { default: ['GB', 'GB'], retailers: { A: ['WORLD', 'GB'] } } }),
    ['default: a country is listed twice', 'A: WORLD together with countries']);
  assert.deepEqual(deliveryConfigProblems({ deliversTo: { default: [] } }), ['default: no countries']);
});

test('every site on the engine says where its retailers deliver, with known country codes only', () => {
  for (const [code, site] of Object.entries(SITES)) {
    assert.ok(site.deliversTo, `${code}: deliversTo`);
    assert.deepEqual(deliveryConfigProblems(site), [], code);
    assert.deepEqual(site.deliversTo.default, ['GB'], `${code}: the retailers are UK shops`);
  }
  // From the retailers' own delivery pages (25 Oct 2026).
  assert.deepEqual(deliveryCountries(cgw, 'Reidl'), ['DE', 'AT']);
  // VEVOR (vevor.nl) delivers to the EU and the EEA, not to the UK (owner, 9 Nov 2026, lessons L107).
  assert.deepEqual(deliveryCountries(cgw, 'VEVOR'), ['EU', 'IS', 'LI', 'NO']);
  assert.deepEqual(deliveryCountries(cgw, 'Tooled Up'), ['GB']);
  assert.deepEqual(deliveryCountries(mgw, 'Wavytalk'), ['US']);
  assert.ok(!('retailerCountries' in cgw), 'CGW shows delivery countries instead of the old retailer flag');
});

// "<retailer> delivers to" (lessons L101, L102): the retailer delivers, never Gear World. The same regex as the QA gate.
const SHIP_WORD = /<span class="ship-word"><span data-i18n="\{0\} delivers to" data-i18n-0="[^"]+" data-i18n-keep="0"><span translate="no">[^<]+<\/span> delivers to<\/span><\/span>:/;

test('a card says "<retailer> delivers to" with the flag first and the country name; only the retailer name is untranslated', () => {
  const card = s(productCard(tgw, product({ retailer: 'Joybuy' })));
  const line = card.match(/<p class="label-ship"[\s\S]*?<\/p>/);
  assert.ok(line, 'the card has the delivery line');
  assert.equal(line[0], `<p class="label-ship" data-ship="GB"><span class="ship-flags"><img class="flag" src="/assets/flags/gb.svg?v=${encodeURIComponent(tgw.assetVersion)}" alt="" width="18" height="12"></span> <span class="ship-word"><span data-i18n="{0} delivers to" data-i18n-0="Joybuy" data-i18n-keep="0"><span translate="no">Joybuy</span> delivers to</span></span>: <span class="ship-names"><span data-country="GB">United Kingdom</span></span></p>`);
  assert.equal((line[0].match(/translate="no"/g) || []).length, 1, 'only the retailer name is kept: "delivers to" and the country are translated');
  assert.ok(!/<span class="ship-word">Delivers to<\/span>/.test(card), 'never a bare "Delivers to"');
  assert.ok(card.indexOf('class="label-ship"') > card.indexOf('class="label-meta"') && card.indexOf('class="label-ship"') < card.indexOf('class="btn btn-deal"'), 'under the retailer, above the button');
  assert.match(card, new RegExp(`<p class="label-ship" data-ship="[A-Z ]+">[\\s\\S]*?${SHIP_WORD.source}`));
  // A retailer name with markup characters stays text.
  assert.ok(s(deliveryLine(tgw, 'A&B <Tools>')).includes('data-i18n-0="A&amp;B &lt;Tools&gt;" data-i18n-keep="0"><span translate="no">A&amp;B &lt;Tools&gt;</span> delivers to</span>'));
});

test('a card names two countries and counts the rest; a page names them all; worldwide has the globe', () => {
  const site = { ...tgw, deliversTo: { default: ['GB'], retailers: { Far: ['US', 'GB', 'CA', 'AU'], Any: ['WORLD'] } } };
  const card = s(productCard(site, product({ retailer: 'Far' })));
  assert.match(card, /<span class="ship-names"><span data-country="US">United States<\/span>, <span data-country="GB">United Kingdom<\/span> <span class="ship-more">\+2<\/span><\/span><\/p>/);
  assert.equal((card.match(/class="flag"/g) || []).length, 2, 'flags only for the named countries');
  const full = s(deliveryText(site, 'Far'));
  assert.match(full, /United States<\/span>, <span data-country="GB">United Kingdom<\/span>, <span data-country="CA">Canada<\/span>, <span data-country="AU">Australia<\/span><\/span>$/);
  assert.equal((full.match(/class="flag"/g) || []).length, 2, 'Canada and Australia have no flag file yet: name only');
  const world = s(deliveryLine(site, 'Any'));
  assert.match(world, /data-ship="WORLD"/);
  assert.match(world, /^<p class="label-ship" data-ship="WORLD"><span class="ship-flags"><svg class="icon ship-globe"[^>]*><use href="[^"]*#globe"><\/use><\/svg><\/span> <span class="ship-word"><span data-i18n="\{0\} delivers to" data-i18n-0="Any" data-i18n-keep="0"><span translate="no">Any<\/span> delivers to<\/span><\/span>: <span class="ship-names"><span class="ship-world">Worldwide<\/span><\/span><\/p>$/);
  assert.equal(s(deliveryLine({ ...tgw, deliversTo: undefined }, 'Joybuy')), '', 'no config: no line');
  assert.equal(s(productCard({ ...tgw, deliversTo: undefined }, product({ retailer: 'Joybuy' }))).includes('delivers to'), false, 'a site without delivery data shows nothing');
});

test('the old retailer flag stays for sites without deliversTo, and gives way to the delivery line', () => {
  const old = { ...cgw, deliversTo: undefined, retailerCountries: { Reidl: 'DE' } };
  assert.match(s(retailerFlag(old, 'Reidl')), /<img class="flag" src="\/assets\/flags\/de\.svg\?v=[^"]+" alt="Germany"/);
  assert.equal(s(retailerFlag({ ...old, deliversTo: { default: ['GB'] } }, 'Reidl')), '');
});

test('the product page: "<retailer> delivers to" in the facts, and on every row of the price list', () => {
  const main = product({ id: 1, retailer: 'Reidl', currency: 'EUR', price: 89.9 });
  const offers = [main, product({ id: 2, retailer: 'Tooled Up', price: 79 })];
  const html = productPage(cgw, main, null, [], offers);
  assert.match(html, /<dt><span data-i18n="\{0\} delivers to" data-i18n-0="Reidl" data-i18n-keep="0"><span translate="no">Reidl<\/span> delivers to<\/span><\/dt><dd class="ship-dd"><span class="ship-flags">.*?<\/span> <span class="ship-names"><span data-country="DE">Germany<\/span>, <span data-country="AT">Austria<\/span><\/span><\/dd>/);
  assert.match(html, /<span class="offer-who"><span class="offer-retailer" translate="no">Reidl<\/span><span class="offer-ship" data-ship="DE AT"><span class="ship-flags">[\s\S]*?<\/span> <span class="ship-word"><span data-i18n="\{0\} delivers to" data-i18n-0="Reidl" data-i18n-keep="0"><span translate="no">Reidl<\/span> delivers to<\/span><\/span>:/);
  assert.match(html, /<span class="offer-retailer" translate="no">Tooled Up<\/span><span class="offer-ship" data-ship="GB">/);
  assert.ok(!/<span class="ship-word">Delivers to<\/span>|<dt>Delivers to<\/dt>/.test(html), 'never a bare "Delivers to"');
  // The same regex as the QA gate (tools/qa-gate.mjs, L62).
  assert.match(html, /<dt><span data-i18n="\{0\} delivers to"[^>]*><span translate="no">[^<]+<\/span> delivers to<\/span><\/dt><dd class="ship-dd">[\s\S]*?(data-country="[A-Z]{2}"|>Worldwide<)/);
});

test('compare and cart pages say where each retailer delivers', () => {
  const a = product({ id: 1, retailer: 'Reidl', currency: 'EUR' });
  const b = product({ id: 2, retailer: 'Tooled Up' });
  const compare = comparePage(cgw, [a, b], [1, 2]);
  // Who sells and who delivers (lessons L101, L102): never a bare "Retailer", "Stock" or "Delivers to" row.
  assert.match(compare, /<th scope="row">Sold by<\/th>/);
  assert.match(compare, /<th scope="row">Stock at the retailer<\/th>/);
  assert.match(compare, /<th scope="row">The retailer delivers to<\/th>/);
  assert.ok(!/<th scope="row">(Delivers to|Retailer|Stock)<\/th>/.test(compare));
  assert.match(compare, /<span data-country="AT">Austria<\/span>/);
  const cart = cartPage(cgw, [a, b], [{ id: 1, qty: 1 }, { id: 2, qty: 2 }]);
  assert.match(cart, /<p class="cart-ship" data-ship="DE AT">/);
  assert.match(cart, /<p class="cart-ship" data-ship="GB">/);
  assert.match(cart, /<p class="cart-ship" data-ship="DE AT">[\s\S]*?<span translate="no">Reidl<\/span> delivers to<\/span><\/span>:/);
});

test('every flag file exists, is small and drawn at 18 x 12; every site that shows flags may serve them', () => {
  for (const c of FLAGS) {
    assert.ok(COUNTRY_NAMES[c], `${c} has a name`);
    const f = `sites/tgw/public/assets/flags/${c.toLowerCase()}.svg`;
    assert.ok(existsSync(f), f);
    const svg = readFileSync(f, 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. ]+" width="18" height="12"/);
    assert.ok(svg.length < 2000 && !/<script|href=|on\w+=/i.test(svg), `${f}: small, no script or link`);
  }
  for (const [code, site] of Object.entries(SITES)) {
    assert.match(readFileSync(`sites/${code}/public-allowlist.txt`, 'utf8'), /^assets\/flags\/\*\.svg$/m, `${code}: allowlist`);
    for (const c of FLAGS) assert.ok(existsSync(`sites/${code}/public/assets/flags/${c.toLowerCase()}.svg`), `${code}: ${c} flag (run tools/theme-site.mjs ${code})`);
    assert.ok(site.assetVersion && !/^2026-10-20/.test(site.assetVersion), `${code}: new assetVersion, so browsers load the new site.js and site.css (L31)`);
  }
});

test('the label is in every dictionary of every site; the script takes country names from the browser', () => {
  for (const code of Object.keys(SITES)) {
    for (const lang of SITES[code].languages.map(l => l.code).filter(c => c !== 'en-GB')) {
      const d = JSON.parse(readFileSync(`sites/${code}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of ['{0} delivers to', 'The retailer delivers to', 'Worldwide']) assert.ok(d[k] && d[k] !== k, `${code} ${lang}: ${k}`);
      assert.match(d['{0} delivers to'], /\{0\}/, `${code} ${lang}: the retailer name has its place`);
      assert.ok(!('Delivers to' in d), `${code} ${lang}: the bare "Delivers to" is gone (L102)`);
    }
  }
  const js = readFileSync('sites/tgw/public/assets/site.js', 'utf8');
  assert.match(js, /new Intl\.DisplayNames\(\[lang\], \{ type: 'region' \}\)/);
  assert.match(js, /if \(node\.hasAttribute\('data-country'\)\) \{/);
  // The country name is swapped before data-i18n and before the text inside is looked up in the dictionary.
  assert.ok(js.indexOf("hasAttribute('data-country')") < js.indexOf("if (node.hasAttribute('data-i18n'))"));
});
