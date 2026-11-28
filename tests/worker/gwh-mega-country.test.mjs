// Gear World Hub: the Mega Stores bar and /black-friday/ by the visitor's country (owner, 21 Nov 2026: "on Mega Stores in
// Greece, why does the bar we have on the Hub still show the UK retailers?" / "and not the Greek stores?", lessons L211).
// The bar names the stores megastoresgearworld.com lists for the country (L210), as text outside the UK, and no bar where
// none is listed; /black-friday/ lists only what delivers to the country. The UK page is the file itself. Never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ogw from '../../sites/ogw/site.config.js';
import {
  MEGA_BAR_STORES, megaCountry, megaStoresFor, coversCountry, megaBarHtml, blackFridayHtml, withMegaCountry, elementEnd,
  BF_COUNTRY_NOTE, BF_NONE_HERE, QA_COUNTRY_HEADER, MEGA_HIDDEN_NETWORKS, megaHomeFor, megaCardNames, MEGA_EDITION_HOME, bfMegaNote
} from '../../sites/gwh/worker.js';

const HOME = readFileSync('sites/gwh/public/index.html', 'utf8');
const BF = readFileSync('sites/gwh/public/black-friday/index.html', 'utf8');
const WORKER = readFileSync('sites/gwh/worker.js', 'utf8');
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const UK_SLUGS = ['amazon', 'aliexpress-uk', 'joybuy', 'tooled-up', 'my-tool-shed', 'pchub-uk', 'gs-workwear', 'back-to-the-office', 'dhgate'];
const GR_NAMES = ['Kouzinika GR', 'Katoikein GR', 'Minipini GR', 'XXXL Leo GR', 'CasualShoes GR', 'Parex GR', 'Tsakiris Mallas GR'];

function req(path, { cc, ua = BROWSER, headers = {}, method = 'GET' } = {}) {
  const r = new Request(`https://gearworldhub.com${path}`, { method, headers: { 'User-Agent': ua, ...headers } });
  if (cc !== undefined) Object.defineProperty(r, 'cf', { value: cc === null ? {} : { country: cc } });
  return r;
}
const page = (text, cache = 'public, max-age=0, must-revalidate') => new Response(text, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, ETag: '"abc"' } });
const bar = html => {
  const at = html.indexOf('<div class="gwh2-mega-wrap">');
  return at < 0 ? '' : html.slice(at, elementEnd(html, at, 'div'));
};
const slugsOf = text => [...text.matchAll(/data-store="([a-z0-9-]+)"/g)].map(m => m[1]);
const offerItems = html => (html.match(/<li class="[^"]*\brt-offer\b/g) || []).length;

test('L211: the bar\'s stores are the stores of megastoresgearworld.com, Amazon UK first, each where it delivers', () => {
  const fromOgw = [{ slug: 'amazon', name: 'Amazon', deliversTo: ogw.amazon.deliversTo }]
    .concat(ogw.stores.filter(s => !s.amazon && Array.isArray(s.sites) && s.sites.length).map(s => ({ slug: s.slug, ...(s.network ? { network: s.network } : {}), name: s.name, deliversTo: s.deliversTo || ['GB'] })));
  assert.deepEqual(MEGA_BAR_STORES, fromOgw, 'MEGA_BAR_STORES in sites/gwh/worker.js = sites/ogw/site.config.js (add a store to both)');
  assert.deepEqual(MEGA_HIDDEN_NETWORKS, ogw.hiddenNetworks || [], 'the same networks hidden on the Hub bar as on megastoresgearworld.com (L215)');
  assert.deepEqual(megaStoresFor('GB').map(s => s.slug), UK_SLUGS);
  const fileSlugs = slugsOf(bar(HOME));
  assert.deepEqual(fileSlugs, [...UK_SLUGS, ...UK_SLUGS], 'the UK bar of public/index.html = the stores listed for the UK (the list and its copy)');
  // After Linkwise approves megastoresgearworld.com (no network hidden); until then Greece and Cyprus get none (L215).
  assert.deepEqual(megaStoresFor('GR', []).map(s => s.name), GR_NAMES);
  assert.deepEqual(megaStoresFor('CY', []).map(s => s.name), ['Parex GR', 'Tsakiris Mallas GR']);
  for (const cc of ['FI', 'JP', 'XX']) assert.deepEqual(megaStoresFor(cc), [], `${cc}: none`);
  // L232: the editions of Germany, Austria, the Netherlands, Belgium, the US, Poland and Ireland.
  assert.deepEqual(['DE', 'AT', 'NL', 'BE', 'US', 'PL', 'IE'].map(cc => megaStoresFor(cc).length), [6, 5, 8, 6, 11, 5, 5]);
  assert.ok(coversCountry(['WORLD'], 'JP') && coversCountry('GB GR', 'GR') && coversCountry('', 'GB') && !coversCountry('', 'GR'));
});

test('L211: the country: Cloudflare\'s, the UK for every crawler, the QA check\'s own, the UK with none, XX unknown', () => {
  assert.equal(megaCountry(req('/', { cc: 'GR' })), 'GR');
  assert.equal(megaCountry(req('/', { cc: 'gr' })), 'GR');
  assert.equal(megaCountry(req('/', { cc: 'GR', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })), 'GB');
  assert.equal(megaCountry(req('/', { cc: 'GR', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' })), 'GB');
  assert.equal(megaCountry(req('/', { cc: 'GB', ua: QA, headers: { [QA_COUNTRY_HEADER]: 'gr' } })), 'GR', 'the QA check names a country');
  assert.equal(megaCountry(req('/', { cc: 'GB', ua: BROWSER, headers: { [QA_COUNTRY_HEADER]: 'GR' } })), 'GB', 'only the QA check may');
  assert.equal(megaCountry(req('/', { cc: 'GB', ua: QA })), 'GB', 'the QA check without the header: Cloudflare\'s');
  assert.equal(megaCountry(req('/')), 'GB', 'no country at all (a local test): the UK page');
  assert.equal(megaCountry(req('/', { cc: null })), 'XX');
  assert.equal(megaCountry(req('/', { cc: 'T1' })), 'XX', 'Tor');
});

test('L211: from Greece the bar names the 7 Greek stores as text, one link to Mega Stores, no UK store and no logo', async () => {
  const r = await withMegaCountry(req('/', { cc: 'GR' }), page(HOME), []);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'private, max-age=60');
  assert.equal(r.headers.get('ETag'), null);
  const html = await r.text();
  const b = bar(html);
  assert.ok(b, 'the bar is there');
  const slugs = slugsOf(b);
  assert.deepEqual(slugs, [...megaStoresFor('GR', []).map(s => s.slug), ...megaStoresFor('GR', []).map(s => s.slug)], 'the 7 Greek stores, the list and its copy');
  for (const s of UK_SLUGS) assert.ok(!html.includes(`data-store="${s}"`), `no ${s}`);
  for (const n of ['Amazon', 'Joybuy', 'Tooled Up', 'PCHUB.UK', 'DHgate']) assert.ok(!b.includes(n), `no ${n} in the bar`);
  assert.ok(!b.includes('<img'), 'no logo: the Greek stores have none yet');
  // L214: the bar and the Stores card open Mega Stores for Greece, /gr/ (no link to its UK page, none to the Hub's UK stores).
  assert.equal((html.match(/href="https:\/\/megastoresgearworld\.com\/"/g) || []).length, 0, 'no link to the UK page');
  assert.ok(b.includes('<a class="gwh2-mega" href="https://megastoresgearworld.com/gr/">'), 'the bar opens /gr/');
  assert.ok(html.includes('<a class="gwh-quick-world gwh2-stores-card" href="https://megastoresgearworld.com/gr/" data-world="STORES">'), 'the Stores card opens /gr/');
  assert.equal((html.match(/href="https:\/\/megastoresgearworld\.com\/gr\/"/g) || []).length, 2, 'the bar and the card');
  assert.ok(!html.includes('Joybuy, Tooled Up, PCHUB.UK') && !html.includes('data-gwh2="storesDesc"'), 'no UK names on the card, and the page script cannot write them back');
  assert.ok(html.includes('<small class="gwh2-rc-desc" translate="no">Kouzinika GR, Katoikein GR, Minipini GR +4</small>'), 'the Greek names on the card');
  assert.ok(b.includes('<span class="gwh2-mega-list gwh2-mega-copy" aria-hidden="true">'), 'the copy stays aria-hidden');
  assert.ok(b.includes(`data-gwh2-name="${GR_NAMES.join(', ')}"`) && b.includes(`Stores: <span translate="no">${GR_NAMES.join(', ')}</span>.`), 'the sentence for screen readers');
  for (const n of GR_NAMES) assert.ok(b.includes(`data-logo="text-only" translate="no">${n}</span>`), n);
  // Everything else on the page is the file itself.
  assert.equal(html.slice(0, html.indexOf('<div class="gwh2-mega-wrap">')), HOME.slice(0, HOME.indexOf('<div class="gwh2-mega-wrap">')));
  const card = s => s.replace(/<a class="gwh-quick-world gwh2-stores-card" href="[^"]*"/, '<a CARD').replace(/<small class="gwh2-rc-desc"[^>]*>[^<]*<\/small>/, '<small CARD>');
  assert.equal(card(html.slice(html.indexOf('<section class="gwh2-top">'))), card(HOME.slice(HOME.indexOf('<section class="gwh2-top">'))), 'and the card');
});

test('L214: Greece opens Mega Stores /gr/, every other country with stores its home page; the card names its stores', async () => {
  assert.deepEqual(Object.keys(MEGA_EDITION_HOME), ['GR', 'DE', 'AT', 'NL', 'BE', 'US', 'PL', 'IE'], 'Greece (L214) and the editions of L232');
  for (const [cc, url] of Object.entries(MEGA_EDITION_HOME)) assert.equal(url, `https://megastoresgearworld.com/${cc.toLowerCase()}/`);
  assert.equal(megaHomeFor('us'), 'https://megastoresgearworld.com/us/');
  // L232 (review 25/11/2026): an edition with fewer than 3 stores is closed there too, so the Hub opens the home page.
  const fewer = MEGA_BAR_STORES.filter(x => !['invicta-stores', 'oponytanio-pl', 'tanie-opony-pl'].includes(x.slug));
  assert.equal(megaHomeFor('PL', [], fewer), 'https://megastoresgearworld.com/', 'Poland with 2 stores: the home page');
  assert.equal(megaHomeFor('DE', [], fewer), 'https://megastoresgearworld.com/de/', 'Germany keeps 5');
  assert.equal(megaHomeFor('PL'), 'https://megastoresgearworld.com/pl/', 'Poland has 5');
  assert.equal(megaHomeFor('IE'), 'https://megastoresgearworld.com/ie/', 'Ireland has 5 (25 Nov 2026 evening)');
  // The /black-friday/ line takes the same hidden networks as the bar (L215).
  assert.ok(bfMegaNote('IE').includes('href="https://megastoresgearworld.com/ie/"') && bfMegaNote('GR', ['linkwise']).includes('href="https://megastoresgearworld.com/gr/"'));
  assert.equal(megaHomeFor('GR', ['linkwise']), 'https://megastoresgearworld.com/gr/', 'Greece always (L214)');
  assert.equal(megaHomeFor('GR'), 'https://megastoresgearworld.com/gr/');
  assert.equal(megaHomeFor('gr'), 'https://megastoresgearworld.com/gr/');
  for (const cc of ['CY', 'GB', 'FI', 'JP', '', null]) assert.equal(megaHomeFor(cc), 'https://megastoresgearworld.com/', String(cc));
  assert.equal(megaCardNames('GR'), 'Kouzinika GR, Katoikein GR, Minipini GR +4');
  assert.equal(megaCardNames('CY'), 'Parex GR, Tsakiris Mallas GR');
  assert.ok(!megaCardNames('GB').includes('Amazon'), 'never Amazon on the card');
  const cy = await (await withMegaCountry(req('/', { cc: 'CY' }), page(HOME))).text();
  assert.ok(cy.includes('<a class="gwh2-mega" href="https://megastoresgearworld.com/">'), 'Cyprus: the bar opens the home page (it shows Cyprus its stores)');
  assert.ok(cy.includes('<a class="gwh-quick-world gwh2-stores-card" href="https://megastoresgearworld.com/" data-world="STORES">'));
  assert.ok(cy.includes('<small class="gwh2-rc-desc" translate="no">Parex GR, Tsakiris Mallas GR</small>'));
  const de = await (await withMegaCountry(req('/', { cc: 'DE' }), page(HOME))).text();
  assert.ok(de.includes('<a class="gwh2-mega" href="https://megastoresgearworld.com/de/">'), 'Germany: the bar opens /de/ (L232)');
  assert.ok(de.includes('<a class="gwh-quick-world gwh2-stores-card" href="https://megastoresgearworld.com/de/" data-world="STORES">'));
  assert.ok(de.includes('<small class="gwh2-rc-desc" translate="no">Westwing DE, La Redoute DE, Reidl +3</small>'));
  const ie = await (await withMegaCountry(req('/', { cc: 'IE' }), page(HOME))).text();
  assert.ok(ie.includes('<a class="gwh2-mega" href="https://megastoresgearworld.com/ie/">'), 'Ireland: the bar opens /ie/ (L232)');
  assert.ok(ie.includes('<a class="gwh-quick-world gwh2-stores-card" href="https://megastoresgearworld.com/ie/" data-world="STORES">'));
  assert.ok(ie.includes('<small class="gwh2-rc-desc" translate="no">Invicta Stores, Plusshop IE, Bazta IE +2</small>'));
  assert.ok(!/data-store="(amazon|joybuy|temu)"/.test(bar(ie)), 'Ireland: no store of the UK or the US on the bar');
  for (const cc of ['JP', 'FI']) {
    const html = await (await withMegaCountry(req('/', { cc }), page(HOME))).text();
    assert.ok(html.includes('<a class="gwh-quick-world gwh2-stores-card" href="/stores/" data-world="STORES">') && html.includes('data-gwh2="storesDesc"'), `${cc}: no Mega Stores there, the card as in the file`);
  }
  const gb = await (await withMegaCountry(req('/', { cc: 'GB' }), page(HOME))).text();
  assert.equal(gb, HOME, 'the UK: the file itself');
  // The file still has the card exactly as the worker looks for it.
  assert.ok(HOME.includes('<a class="gwh-quick-world gwh2-stores-card" href="/stores/"') && HOME.includes('<small class="gwh2-rc-desc" data-gwh2="storesDesc"'));
  assert.ok(HOME.includes('<a class="gwh2-mega" href="https://megastoresgearworld.com/">'));
});

test('L211: from Cyprus only Parex and Tsakiris Mallas; from Japan, Finland or an unknown country no bar at all', async () => {
  const cy = await (await withMegaCountry(req('/', { cc: 'CY' }), page(HOME), [])).text();
  assert.deepEqual(slugsOf(bar(cy)), ['parex-gr', 'tsakiris-mallas-gr', 'parex-gr', 'tsakiris-mallas-gr']);
  for (const cc of ['JP', 'FI', null]) {
    const html = await (await withMegaCountry(req('/', { cc }), page(HOME))).text();
    assert.ok(!html.includes('gwh2-mega-wrap') && !html.includes('megastoresgearworld.com/"') && !html.includes('data-store='), `${cc}: no bar`);
    assert.ok(html.includes('id="hubSearch"') && html.includes('<section class="gwh2-top">') && html.includes('</html>'), `${cc}: the rest of the page`);
    assert.ok(html.includes('<!-- Mega Stores') && /-->\s*<section class="gwh2-top">/.test(html), `${cc}: only the bar left out`);
  }
});

test('L211: the UK, Google and the other crawlers get the file itself, byte for byte, kept by no shared cache', async () => {
  for (const r of [req('/', { cc: 'GB' }), req('/', { cc: 'GR', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), req('/'), req('/index.html', { cc: 'GB' })]) {
    const res = await withMegaCountry(r, page(HOME));
    assert.equal(await res.text(), HOME);
    assert.equal(res.headers.get('Cache-Control'), 'private, max-age=60');
    assert.equal(res.headers.get('ETag'), '"abc"', 'the UK answer keeps its ETag (L119: the page is the file)');
  }
  assert.equal(megaBarHtml(HOME, 'GB'), HOME);
  assert.equal(blackFridayHtml(BF, 'GB'), BF);
});

test('L211: other pages, other methods and other answers are not touched', async () => {
  const p = page(HOME);
  assert.equal(await withMegaCountry(req('/about/', { cc: 'GR' }), p), p);
  const head = await withMegaCountry(req('/', { cc: 'GR', method: 'HEAD' }), new Response(null, { status: 200, headers: { 'Content-Type': 'text/html', 'Content-Length': '999', ETag: '"x"', 'Cache-Control': 'public, max-age=300' } }));
  assert.equal(head.headers.get('Cache-Control'), 'private, max-age=60', 'HEAD: the same headers as the GET');
  assert.equal(head.headers.get('Content-Length'), null);
  assert.equal(head.headers.get('ETag'), null);
  assert.equal(head.body, null);
  const post = page(HOME);
  assert.equal(await withMegaCountry(req('/', { cc: 'GR', method: 'POST' }), post), post);
  const json = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  assert.equal(await withMegaCountry(req('/', { cc: 'GR' }), json), json);
  const missing = new Response('no', { status: 404, headers: { 'Content-Type': 'text/html' } });
  assert.equal(await withMegaCountry(req('/black-friday/', { cc: 'GR' }), missing), missing);
  assert.ok(WORKER.includes('await withCountryBar(request, await withAppCountry(request, await withMegaCountry(request, await hubFetch(request, env, ctx))))'), 'the Worker uses it on every answer (L218: then the Google Play row)');
});

test('L211: /black-friday/ from Greece: no UK retailer or code, "Nothing listed for your country yet." and Mega Stores named', async () => {
  assert.equal(offerItems(BF), (BF.match(/data-delivers="GB"/g) || []).length, 'every item of the file says where it delivers');
  const r = await withMegaCountry(req('/black-friday/', { cc: 'GR' }), page(BF), []);
  assert.equal(r.headers.get('Cache-Control'), 'private, max-age=60');
  const html = await r.text();
  assert.equal(offerItems(html), 0, 'every retailer and code of the page delivers to the UK only');
  for (const w of ['CLAIMFIFTY', 'Tooled Up', 'Joybuy', '£50']) assert.ok(!html.includes(w), `no ${w}`);
  assert.equal((html.match(new RegExp(`<p class="gd-note rt-none">${BF_NONE_HERE}</p>`, 'g')) || []).length, 2, 'both lists say so, shown at once');
  assert.ok(html.includes(`<p class="gd-note rt-country">${BF_COUNTRY_NOTE} The stores listed for your country are on <a href="https://megastoresgearworld.com/gr/" translate="no">Mega Stores</a>.</p>`), 'Greece: Mega Stores /gr/ (L214)');
  const cyBf = await (await withMegaCountry(req('/black-friday/', { cc: 'CY' }), page(BF))).text();
  assert.ok(cyBf.includes('are on <a href="https://megastoresgearworld.com/" translate="no">Mega Stores</a>.</p>'), 'Cyprus: the home page');
  assert.equal(BF_COUNTRY_NOTE, 'Only the retailers we list for your country are shown here.', 'what we show, never where a retailer delivers (L210)');
  assert.ok(html.includes('<h2 id="bf-dates-h">The dates</h2>') && html.includes('Friday 27 Nov 2026'), 'the dates stay');
  assert.ok(html.includes('<link rel="canonical" href="https://gearworldhub.com/black-friday/">'));
  const us = await (await withMegaCountry(req('/black-friday/', { cc: 'JP' }), page(BF))).text();
  assert.ok(us.includes(`<p class="gd-note rt-country">${BF_COUNTRY_NOTE}</p>`), 'Japan: the line without Mega Stores (none listed there; the US has its own since L232)');
  const usBf = await (await withMegaCountry(req('/black-friday/', { cc: 'US' }), page(BF))).text();
  assert.ok(usBf.includes('are on <a href="https://megastoresgearworld.com/us/" translate="no">Mega Stores</a>.</p>'), 'the US: its edition (L232)');
  assert.equal(offerItems(us), 0);
});

test('L211: /black-friday/ keeps an item that delivers to the country, and its list says nothing more', () => {
  const both = BF.replace('data-delivers="GB"', 'data-delivers="GB GR"');
  const html = blackFridayHtml(both, 'GR');
  assert.equal(offerItems(html), 1, 'the one that delivers to Greece stays');
  assert.equal((html.match(new RegExp(`<p class="gd-note rt-none" hidden>${BF_NONE_HERE}</p>`, 'g')) || []).length, 1, 'its list: the line stays hidden');
  assert.equal((html.match(new RegExp(`<p class="gd-note rt-none">${BF_NONE_HERE}</p>`, 'g')) || []).length, 1, 'the other list: shown');
  const world = blackFridayHtml(BF.replace(/data-delivers="GB"/g, 'data-delivers="WORLD"'), 'JP');
  assert.equal(offerItems(world), offerItems(BF), 'WORLD: everywhere');
});

test('L215: Linkwise approved megastoresgearworld.com (23 Nov 2026): no network hidden, Greece 7 stores, Cyprus 2', () => {
  assert.deepEqual(MEGA_HIDDEN_NETWORKS, [], 'nothing hidden after the approval');
  assert.equal(MEGA_BAR_STORES.filter(s => s.network === 'linkwise').length, 7, 'the 7 Greek stores are Linkwise stores');
  assert.deepEqual(megaStoresFor('GR').map(s => s.slug), MEGA_BAR_STORES.filter(s => s.network === 'linkwise').map(s => s.slug), 'Greece: the 7');
  assert.deepEqual(megaStoresFor('CY').map(s => s.slug), ['parex-gr', 'tsakiris-mallas-gr'], 'Cyprus: Parex and Tsakiris Mallas');
});

test('L215: a hidden network (as Linkwise was until its approval): Greece and Cyprus get no bar and no Mega Stores line', async () => {
  const hidden = ['linkwise'];
  for (const cc of ['GR', 'CY']) {
    assert.deepEqual(megaStoresFor(cc, hidden), [], `${cc}: none while hidden`);
    assert.equal(megaCardNames(cc, hidden), '', `${cc}: no store names for the card`);
    const html = await (await withMegaCountry(req('/', { cc }), page(HOME), hidden)).text();
    assert.ok(!html.includes('gwh2-mega-wrap') && !html.includes('data-store=') && !/href="https:\/\/megastoresgearworld\.com\//.test(html), `${cc}: no bar, no link to Mega Stores (/gr/ either)`);
    for (const n of GR_NAMES) assert.ok(!html.includes(n), `${cc}: no ${n}`);
    assert.ok(html.includes('id="hubSearch"') && html.includes('<section class="gwh2-top">') && html.includes('</html>'), `${cc}: the rest of the page`);
    const bf = await (await withMegaCountry(req('/black-friday/', { cc }), page(BF), hidden)).text();
    assert.ok(bf.includes(`<p class="gd-note rt-country">${BF_COUNTRY_NOTE}</p>`), `${cc}: the line without Mega Stores`);
    assert.ok(!bf.includes('megastoresgearworld.com'), `${cc}: no link to Mega Stores`);
  }
  const gb = await (await withMegaCountry(req('/', { cc: 'GB' }), page(HOME), hidden)).text();
  assert.equal(gb, HOME, 'the UK: the file itself');
});
