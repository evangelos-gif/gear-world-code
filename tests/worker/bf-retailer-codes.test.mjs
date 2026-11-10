// Lessons L114 (owner's decision «Γ1», 10 Nov 2026): only the retailers' own Black Friday voucher codes show, while the
// Black Friday season stays switched off (no Gear World banner, countdown or slide). Source: the Awin emails of Tooled Up
// (496) and My Tool Shed (49385), "Black Friday 2026 Is Live: Four Weekly Drops", received 9 Nov 2026: CLAIMFIFTY £50
// off £500+ and CLAIMSEVFY £75 off £750+, 9 Nov - 6 Dec 2026 (UK time). Only on the sites where the retailer has products
// in the UK view (live /api/stats, 10 Nov 2026): Tooled Up on CGW, GGW, AGW, BGW; My Tool Shed on CGW and GGW.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { PROMOS, SEASONS_ON, promosFor } from '../../promos/promos.js';
import { activePromos } from '../../src/lib/promos.js';
import { seasonFor } from '../../src/lib/seasons.js';
import { deliveryCountries } from '../../src/lib/delivery.js';
import { listCovers, viewFor } from '../../src/lib/visibility.js';
import { offersIndexPage, retailerOffersPage, promoBarHtml } from '../../src/pages/offers.js';
import { createWorker } from '../../src/engine.js';
import { toString } from '../../src/lib/html.js';

const at = (day, time = '12:00:00') => Date.parse(`${day}T${time}Z`);
const LANGS = ['de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
const BF_IDS = ['tooled-up-claimfifty', 'tooled-up-claimsevfy', 'my-tool-shed-claimfifty', 'my-tool-shed-claimsevfy'];
// Which site shows which of the four (the retailer has products there, and it delivers to the UK).
const WANT = {
  CGW: BF_IDS,
  GGW: BF_IDS,
  AGW: ['tooled-up-claimfifty', 'tooled-up-claimsevfy'],
  BGW: ['tooled-up-claimfifty', 'tooled-up-claimsevfy']
};

// All 13 site configs, by code.
async function allSites() {
  const out = {};
  for (const name of readdirSync('sites').sort()) {
    const file = `sites/${name}/site.config.js`;
    if (!existsSync(file) || !existsSync(`sites/${name}/public/assets/i18n`)) continue;
    const site = (await import(pathToFileURL(file).href)).default;
    out[site.code] = site;
  }
  return out;
}
const bfOn = (site, now) => activePromos(site, now).filter(p => BF_IDS.includes(p.id)).map(p => p.id).sort();

test('L114: the four codes are exactly what the emails of 9 Nov 2026 say (code, amount, minimum, days, landing page)', () => {
  const bf = PROMOS.filter(p => BF_IDS.includes(p.id));
  assert.equal(bf.length, 4);
  const rows = bf.map(p => [p.id, p.retailer, p.slug, p.awinMid, p.kind, p.code, p.off, p.minSpend, p.currency, p.start, p.end, p.sites.join(','), p.url]);
  assert.deepEqual(rows, [
    ['tooled-up-claimfifty', 'Tooled Up', 'tooled-up', 496, 'code', 'CLAIMFIFTY', 50, 500, 'GBP', '2026-11-09', '2026-12-06', 'CGW,GGW,AGW,BGW', 'https://www.tooled-up.com/black-friday-offers-while-stocks-last/landing/336/'],
    ['tooled-up-claimsevfy', 'Tooled Up', 'tooled-up', 496, 'code', 'CLAIMSEVFY', 75, 750, 'GBP', '2026-11-09', '2026-12-06', 'CGW,GGW,AGW,BGW', 'https://www.tooled-up.com/black-friday-offers-while-stocks-last/landing/336/'],
    ['my-tool-shed-claimfifty', 'My Tool Shed', 'my-tool-shed', 49385, 'code', 'CLAIMFIFTY', 50, 500, 'GBP', '2026-11-09', '2026-12-06', 'CGW,GGW', 'https://www.mytoolshed.co.uk/black-friday-offers-while-stocks-last/landing/336/'],
    ['my-tool-shed-claimsevfy', 'My Tool Shed', 'my-tool-shed', 49385, 'code', 'CLAIMSEVFY', 75, 750, 'GBP', '2026-11-09', '2026-12-06', 'CGW,GGW', 'https://www.mytoolshed.co.uk/black-friday-offers-while-stocks-last/landing/336/']
  ]);
  for (const p of bf) {
    // The retailer's event name, small print of the code card; never "offers" or "deals" (qa-gate L102 refuses
    // "Black Friday offers"), never a top bar.
    assert.equal(p.campaign, 'Black Friday', p.id);
    assert.ok(!('bar' in p), `${p.id}: no top bar`);
    assert.match(p.source, new RegExp(`^Awin email "${p.retailer} \\(${p.awinMid}\\): Black Friday 2026 Is Live: Four Weekly Drops", received 9 Nov 2026`), p.id);
    assert.ok(!('upTo' in p) && !('extraOff' in p), `${p.id}: no percentage`);
  }
  // The Einhell "coming soon" offer is not live yet: nothing of it here.
  assert.ok(!PROMOS.some(p => /einhell|15%/i.test(`${p.id} ${p.campaign} ${p.code || ''}`)));
});

test('L114: the codes are only on the sites where the retailer has products and delivers to the UK, under the name the site shows', async () => {
  const sites = await allSites();
  assert.equal(Object.keys(sites).length, 13);
  for (const [code, site] of Object.entries(sites)) {
    const ids = site.promos.filter(p => BF_IDS.includes(p.id)).map(p => p.id).sort();
    assert.deepEqual(ids, [...(WANT[code] || [])].sort(), `${code}: the right codes`);
    assert.deepEqual(promosFor(code).map(p => p.id), site.promos.map(p => p.id), `${code}: site.promos is promosFor()`);
    for (const p of site.promos.filter(x => BF_IDS.includes(x.id))) {
      // The name as the site shows it: not a feed name that the site renames, not renamed into something else.
      const names = (site.database && site.database.retailerNames) || {};
      assert.ok(!(p.retailer in names), `${code}: "${p.retailer}" is not renamed by retailerNames`);
      // Where the site turns plain links into Awin links (GGW), the same advertiser id.
      if (site.awin && site.awin.advertisers && p.retailer in site.awin.advertisers) assert.equal(site.awin.advertisers[p.retailer], p.awinMid, `${code}: Awin id of ${p.retailer}`);
      // The retailer delivers to the UK on this site (lessons L107).
      assert.ok(listCovers(deliveryCountries(site, p.retailer), 'GB'), `${code}: ${p.retailer} delivers to GB`);
    }
  }
});

test('L114: the codes show only from 9 Nov to 6 Dec 2026 (UK days), on every site, then go by themselves', async () => {
  const sites = await allSites();
  // November and December are GMT: UTC midnight is UK midnight.
  const days = [
    [at('2026-11-08', '23:59:59'), false], [at('2026-11-09', '00:00:00'), true], [at('2026-11-20'), true], [at('2026-11-27'), true],
    [at('2026-12-01'), true], [at('2026-12-06', '23:59:59'), true], [at('2026-12-07', '00:00:00'), false], [at('2026-12-31'), false],
    [at('2027-11-26'), false], [at('2026-10-21'), false]
  ];
  for (const [code, site] of Object.entries(sites)) {
    for (const [now, on] of days) {
      assert.deepEqual(bfOn(site, now), on ? [...(WANT[code] || [])].sort() : [], `${code} ${new Date(now).toISOString()}`);
    }
  }
  // The retailer pages: both codes with their minimum spend and end date while they run; "No codes right now" and
  // noindex before and after.
  for (const [code, slugs] of [['CGW', ['tooled-up', 'my-tool-shed']], ['GGW', ['tooled-up', 'my-tool-shed']], ['AGW', ['tooled-up']], ['BGW', ['tooled-up']]]) {
    for (const slug of slugs) {
      const page = retailerOffersPage(sites[code], slug, at('2026-11-20'));
      assert.match(page, /<meta name="robots" content="index,follow">/, `${code} ${slug}`);
      for (const [c, off, min] of [['CLAIMFIFTY', '£50', '£500'], ['CLAIMSEVFY', '£75', '£750']]) {
        assert.ok(page.includes(`<strong translate="no">${c}</strong>`), `${code} ${slug}: ${c} untranslated`);
        assert.ok(page.includes(`data-copy="${c}"`), `${code} ${slug}: copy ${c}`);
        assert.ok(page.includes(`${off} off when you spend ${min}</span>`), `${code} ${slug}: ${off} off ${min}`);
        assert.ok(page.includes(`href="/go/${slug}-${c.toLowerCase()}" rel="sponsored nofollow noopener"`), `${code} ${slug}: /go/ for ${c}`);
      }
      assert.equal((page.match(/data-i18n="Valid until \{0\}" data-i18n-0="6 Dec 2026" data-i18n-0-date="2026-12-06">Valid until 6 Dec 2026<\/span>/g) || []).length, 2, `${code} ${slug}: until 6 Dec 2026`);
      assert.ok(!/awin1\.com/.test(page), `${code} ${slug}: no direct Awin link`);
      for (const day of [at('2026-11-08'), at('2026-12-07')]) {
        const off = retailerOffersPage(sites[code], slug, day);
        assert.match(off, /No codes right now/);
        assert.match(off, /<meta name="robots" content="noindex,follow">/);
        assert.ok(!/CLAIMFIFTY|CLAIMSEVFY|Black Friday/.test(off), `${code} ${slug}: nothing after the end`);
      }
    }
  }
  // A site without the retailer has no page for it.
  assert.equal(retailerOffersPage(sites.AGW, 'my-tool-shed', at('2026-11-20')), null);
  assert.equal(retailerOffersPage(sites.TGW, 'tooled-up', at('2026-11-20')), null);
});

test('L114: Black Friday stays switched off: no banner, countdown or bar; "Black Friday" only as the campaign in the code card', async () => {
  assert.equal(SEASONS_ON['black-friday'], false);
  for (const d of ['2026-11-20', '2026-11-27', '2026-11-30', '2026-12-01']) assert.notEqual((seasonFor(at(d)) || {}).id, 'black-friday', d);
  const sites = await allSites();
  const CARD = '<p class="promo-campaign"><span data-i18n="Black Friday">Black Friday</span></p>';
  for (const code of Object.keys(WANT)) {
    const site = sites[code];
    for (const d of ['2026-11-10', '2026-11-28', '2026-12-05']) {
      const now = at(d);
      assert.equal(toString(promoBarHtml(site, now)), '', `${code} ${d}: no top bar`);
      const pages = [offersIndexPage(site, now), ...[...new Set(site.promos.filter(p => BF_IDS.includes(p.id)).map(p => p.slug))].map(s => retailerOffersPage(site, s, now))];
      for (const page of pages) {
        assert.ok(!/season-black-friday|data-season-countdown|aria-label="Black Friday"/.test(page), `${code} ${d}: no Black Friday banner or countdown`);
        const cards = page.split(CARD).length - 1;
        assert.ok(cards >= 2, `${code} ${d}: the campaign in the code cards`);
        // Take the card lines away: no "Black Friday" is left anywhere (title, description, headings, banner, schema).
        assert.ok(!/black ?friday/i.test(page.split(CARD).join('')), `${code} ${d}: "Black Friday" only in the code cards`);
        for (const tag of ['title', 'h1', 'h2', 'h3']) {
          for (const m of page.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))) assert.ok(!/black ?friday|\bdeals?\b|\bshop/i.test(m[1]), `${code} ${d}: <${tag}> ${m[1]}`);
        }
        const desc = (page.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
        assert.ok(!/black ?friday|\bdeals?\b|\bshop|partner|official|trusted|UK retailers/i.test(desc), `${code} ${d}: description ${desc}`);
      }
      // The season banner on the codes page is Christmas ("Gifts for everyone"), only because codes are listed under it.
      const idx = offersIndexPage(site, now);
      assert.ok(idx.includes('season-christmas') && idx.indexOf('season-christmas') < idx.indexOf('id="offers-list"'), `${code} ${d}: the Christmas banner, then the list`);
    }
  }
});

test('L114: the code cards say nothing of our own: no saving, percentage, "deals", shop or partner words; names and codes untranslated', async () => {
  const sites = await allSites();
  const BAD_EN = /Save \d|\d+ ?%|% off|\bdeals?\b|shopping|\bcart\b|basket|Buy now|Shop now|\bpartners?\b|\bofficial\b|trusted|UK retailers|black friday deals|black friday offers/i;
  for (const code of Object.keys(WANT)) {
    const site = sites[code];
    for (const slug of [...new Set(site.promos.filter(p => BF_IDS.includes(p.id)).map(p => p.slug))]) {
      const page = retailerOffersPage(site, slug, at('2026-11-20'));
      const retailer = site.promos.find(p => p.slug === slug).retailer;
      const cards = page.slice(page.indexOf('<ul class="promo-list">'), page.indexOf('<p class="promo-note">') + 400);
      assert.ok(cards.length > 400, `${code} ${slug}: the cards`);
      // What a visitor reads (the text, the data-i18n keys and the attributes a screen reader says), not class names.
      const words = [cards.replace(/<[^>]*>/g, ' '), ...[...cards.matchAll(/(?:data-i18n|aria-label|title)="([^"]*)"/g)].map(m => m[1])].join(' ');
      assert.ok(!BAD_EN.test(words), `${code} ${slug}: "${(words.match(BAD_EN) || [])[0]}"`);
      // The button of every code card is "View at <retailer>" (owner's rule, stricter than L103: never "shop"), with the
      // retailer name untranslated, as in the heading and the note.
      assert.equal((cards.match(new RegExp(`<span data-i18n="View at \\{0\\}" data-i18n-0="${retailer}" data-i18n-keep="0">View at <span translate="no">${retailer}</span></span></a>`, 'g')) || []).length, 2, `${code} ${slug}: View at`);
      assert.ok(!/shop/i.test(words.replace(new RegExp(retailer, 'g'), '')), `${code} ${slug}: no "shop" word`);
      assert.ok(page.includes(`<h1><span data-i18n="{0} discount codes" data-i18n-0="${retailer}" data-i18n-keep="0"><span translate="no">${retailer}</span> discount codes</span></h1>`), `${code} ${slug}: h1`);
      assert.ok(cards.includes(`open <span translate="no">${retailer}</span> with the button and enter the code at checkout. <span translate="no">${retailer}</span> sets the final terms`), `${code} ${slug}: the note`);
    }
  }
});

test('L114: every text of the code cards is in every dictionary of the 4 sites, without partner, official, trusted or basket words', () => {
  const KEYS = ['Black Friday', 'Code', 'Copy code', '{0} off when you spend {1}', 'Valid until {0}', 'View at {0}', 'Discount codes',
    '{0} discount codes', 'Discount codes and offers', 'No codes right now', 'Check back soon. In the meantime, compare prices in the categories.',
    'Codes and sales that retailers publish through their affiliate programmes. Every code has an end date and is removed when it ends.',
    'Codes and sales that {0} publishes through its affiliate programme. Every code has an end date and is removed when it ends.',
    'Copy the code, open {0} with the button and enter the code at checkout. {0} sets the final terms, so check the discount before you pay.'];
  // Partner, official, trusted and basket/cart words in the 10 languages (lessons L103: a translation may add them).
  const BAD = /partner|partenai|partener|партн|συνεργ|parceir|offiziell|officiel|ufficial|oficial|officieel|zyrtar|επίσημ|официальн|vertrauens|de confiance|affidabil|de confianza|de confiança|betrouwba|besueshm|de încredere|αξιόπιστ|надёжн|надежн|warenkorb|panier|carrell|carrito|carrinho|winkelwagen|winkelmand|shport|coșul|καλάθι|корзин|\bcart\b|basket|trusted/i;
  const ph = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
  for (const code of ['cgw', 'ggw', 'agw', 'bgw']) {
    for (const lang of LANGS) {
      const d = JSON.parse(readFileSync(`sites/${code}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of KEYS) {
        assert.ok(typeof d[k] === 'string' && d[k].trim(), `${code}/${lang}: "${k}"`);
        assert.equal(ph(d[k]), ph(k), `${code}/${lang}: "${k}" keeps its placeholders`);
        assert.ok(!BAD.test(d[k]), `${code}/${lang}: "${k}" => "${d[k]}"`);
      }
      // The campaign is only the event's name, with no "deals", "offers" or "sale" of our own in any language.
      assert.ok(['Black Friday', 'Чёрная пятница'].includes(d['Black Friday']), `${code}/${lang}: "${d['Black Friday']}"`);
    }
  }
});

test('L114: /go/ sends each code to the retailer\'s own landing page as an Awin deep link with our id and clickref', async () => {
  const sites = await allSites();
  const fakeDb = () => {
    const rows = [];
    const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => { rows.push({ sql, args }); return { meta: {} }; }, first: async () => null, all: async () => ({ results: [] }) });
    return { rows, prepare: sql => stmt(sql), batch: async l => Promise.all(l.map(s => s.all())) };
  };
  const go = async (site, id) => createWorker(site).fetch(new Request(`https://${site.domain}/go/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), { DB: fakeDb() }, { waitUntil: p => p });
  for (const [code, id, mid, landing] of [
    ['CGW', 'tooled-up-claimfifty', '496', 'https://www.tooled-up.com/black-friday-offers-while-stocks-last/landing/336/'],
    ['GGW', 'my-tool-shed-claimsevfy', '49385', 'https://www.mytoolshed.co.uk/black-friday-offers-while-stocks-last/landing/336/'],
    ['BGW', 'tooled-up-claimsevfy', '496', 'https://www.tooled-up.com/black-friday-offers-while-stocks-last/landing/336/']
  ]) {
    const r = await go(sites[code], id);
    assert.equal(r.status, 302, `${code} ${id}`);
    const loc = new URL(r.headers.get('location'));
    assert.equal(loc.origin + loc.pathname, 'https://www.awin1.com/cread.php');
    assert.equal(loc.searchParams.get('awinmid'), mid);
    assert.equal(loc.searchParams.get('awinaffid'), '3057233');
    assert.equal(loc.searchParams.get('clickref'), `${code.toLowerCase()}-promo-${id}`);
    assert.equal(loc.searchParams.get('ued'), landing);
  }
  // Not a code of that site: 404.
  assert.equal((await go(sites.BGW, 'my-tool-shed-claimfifty')).status, 404);
  assert.equal((await go(sites.TGW, 'tooled-up-claimfifty')).status, 404);
});

test('L114: the Hub (hub-deals.json) lists the four codes without the code itself, while its Black Friday slides stay off', () => {
  const deals = JSON.parse(readFileSync('sites/gwh/public/hub-deals.json', 'utf8')).deals;
  const bf = deals.filter(d => BF_IDS.includes(d.id));
  assert.deepEqual(bf.map(d => [d.id, d.kind, d.off, d.minSpend, d.start, d.end, d.link]), [
    ['tooled-up-claimfifty', 'code', 50, 500, '2026-11-09', '2026-12-06', 'https://constructiongearworld.com/discount-codes/tooled-up/'],
    ['tooled-up-claimsevfy', 'code', 75, 750, '2026-11-09', '2026-12-06', 'https://constructiongearworld.com/discount-codes/tooled-up/'],
    ['my-tool-shed-claimfifty', 'code', 50, 500, '2026-11-09', '2026-12-06', 'https://constructiongearworld.com/discount-codes/my-tool-shed/'],
    ['my-tool-shed-claimsevfy', 'code', 75, 750, '2026-11-09', '2026-12-06', 'https://constructiongearworld.com/discount-codes/my-tool-shed/']
  ]);
  for (const d of bf) assert.ok(!('code' in d) && !('url' in d) && !('bar' in d), d.id);
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(readFileSync('sites/gwh/public/hub-v2.js', 'utf8'), { window, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams, Intl, console });
  const h = window.GearWorldHubV2;
  assert.equal(h.seasonsOn['black-friday'], false);
  for (const d of ['2026-11-15', '2026-11-28', '2026-11-30']) {
    const ids = JSON.parse(JSON.stringify(h.activeCampaigns(at(d)).map(c => c.id)));
    assert.ok(!ids.some(x => /black-friday/.test(x)), `${d}: no Black Friday slide (${ids})`);
    assert.notEqual((h.seasonFor(at(d)) || {}).id, 'black-friday', `${d}: no Black Friday video`);
  }
  const running = d => JSON.parse(JSON.stringify(h.activeDeals(deals, at(d)).map(x => x.id))).filter(x => BF_IDS.includes(x)).sort();
  assert.deepEqual(running('2026-11-20'), [...BF_IDS].sort());
  assert.deepEqual(running('2026-11-08'), []);
  assert.deepEqual(running('2026-12-07'), []);
});

// ---------- The owner's rules of 10 Nov 2026 on top of L103 and L107 (lessons L114) ----------

test('L114: no code card on any of the 13 sites says "Shop at": the button is "View at <retailer>", the name untranslated', async () => {
  const sites = await allSites();
  const day = at('2026-11-20');
  const running = p => ({ ...p, start: '2026-11-01', end: '2026-12-31' });
  const sample = { id: 'joybuy-sample', retailer: 'Joybuy', slug: 'joybuy', awinMid: 123932, currency: 'GBP', kind: 'code', campaign: 'Black Friday', code: 'SAMPLE10',
    off: 10, minSpend: 50, url: 'https://www.joybuy.co.uk/', sites: [], start: '2026-11-01', end: '2026-12-31' };
  let cards = 0;
  for (const [code, config] of Object.entries(sites)) {
    // The site's own codes and sales (made to run on the day), and one code of every kind for the sites without any.
    const site = { ...config, promos: config.promos.length ? config.promos.map(running) : [sample, { ...sample, id: 'joybuy-sample-sale', kind: 'sale', code: undefined, campaign: 'Baby' }] };
    const pages = [offersIndexPage(site, day), ...[...new Set(site.promos.map(p => p.slug))].map(s => retailerOffersPage(site, s, day))];
    for (const page of pages) {
      assert.ok(!/Shop at|data-i18n="Shop at/.test(page), `${code}: "Shop at" on a code card`);
      const buttons = [...page.matchAll(/<a class="btn btn-deal" href="\/go\/[a-z0-9-]+" rel="sponsored nofollow noopener" target="_blank">([\s\S]*?)<\/a>/g)].map(m => m[1]);
      assert.ok(buttons.length > 0, `${code}: code cards`);
      for (const b of buttons) assert.match(b, /^<span data-i18n="View at \{0\}" data-i18n-0="[^"]+" data-i18n-keep="0">View at <span translate="no">[^<]+<\/span><\/span>$/, `${code}: ${b}`);
      cards += buttons.length;
    }
  }
  assert.ok(cards >= 13, `${cards} buttons`);
  // The page code itself: no "Shop at" left anywhere in src/.
  for (const f of ['src/pages/offers.js', 'src/pages/layout.js', 'src/engine.js']) {
    assert.ok(!/'Shop at/.test(readFileSync(f, 'utf8')), `${f}: no 'Shop at' text`);
  }
});

// The codes follow the visitor's view, like the products (lessons L107, L114). The engine reads the real clock for the
// codes, so the test copies run around today.
const UK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dayFrom = n => { const d = new Date(`${UK_DAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const runningToday = site => ({ ...site, promos: site.promos.map(p => ({ ...p, start: dayFrom(-1), end: dayFrom(5) })) });
const FOOTER_LINK = '<li><a href="/discount-codes/">Discount codes</a></li>';
function memoryDb() {
  const rows = [];
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => { rows.push({ sql, args }); return { meta: {} }; }, first: async () => null, all: async () => ({ results: [] }) });
  return { rows, prepare: sql => stmt(sql), batch: async l => Promise.all(l.map(s => s.all())) };
}
function visitor(site) {
  const worker = createWorker(site);
  return (path, env, country = '', headers = {}) => {
    const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, { waitUntil: p => p });
  };
}

test('L114: the views of the codes: CGW Germany sees none (no footer link either); the UK, unknown and US visitors and Google see them', async () => {
  const sites = await allSites();
  const now = at('2026-11-20');
  const ids = (site, country) => activePromos(site, now, viewFor(site, country, now)).filter(p => BF_IDS.includes(p.id)).map(p => p.id).sort();
  // CGW: Germany has a view of its own (Reidl, VEVOR, GRABO): Tooled Up and My Tool Shed (UK only) are not in it.
  assert.deepEqual(ids(sites.CGW, 'DE'), []);
  for (const cc of ['GB', '', 'US', 'XX']) assert.deepEqual(ids(sites.CGW, cc), [...BF_IDS].sort(), `CGW ${cc || 'unknown'}`);
  // AGW: Belgium (Pneus.be, VEVOR) and Germany (VEVOR): no Tooled Up code.
  assert.deepEqual(ids(sites.AGW, 'BE'), []);
  assert.deepEqual(ids(sites.AGW, 'DE'), []);
  assert.deepEqual(ids(sites.AGW, 'GB'), ['tooled-up-claimfifty', 'tooled-up-claimsevfy']);
  // GGW and BGW have no retailer for Germany: a German visitor gets the UK view with its bar, products and codes alike.
  assert.deepEqual(ids(sites.GGW, 'DE'), [...BF_IDS].sort());
  // Without a view (tools, tests) every code shows; the sitemap gets the UK view.
  assert.deepEqual(activePromos(sites.CGW, now).filter(p => BF_IDS.includes(p.id)).length, 4);

  const cgw = runningToday(sites.CGW);
  const get = visitor(cgw);
  const env = { DB: memoryDb(), CLICK_LOG: 'off' };
  // Germany: the codes pages behave as when no code runs, and no page has the footer link.
  const deIndex = await (await get('/discount-codes/', env, 'DE')).text();
  assert.match(deIndex, /No codes right now/);
  assert.match(deIndex, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!/CLAIMFIFTY|CLAIMSEVFY|Tooled Up|My Tool Shed|season-banner/.test(deIndex), 'no code, retailer or banner for Germany');
  const deRetailer = await get('/discount-codes/tooled-up/', env, 'DE');
  assert.equal(deRetailer.status, 200);
  const deRetailerHtml = await deRetailer.text();
  assert.match(deRetailerHtml, /No codes right now/);
  assert.match(deRetailerHtml, /noindex,follow/);
  assert.ok(!/CLAIMFIFTY|CLAIMSEVFY/.test(deRetailerHtml));
  for (const path of ['/about/', '/discount-codes/', '/this-page-does-not-exist/']) {
    assert.ok(!(await (await get(path, env, 'DE')).text()).includes(FOOTER_LINK), `DE ${path}: no footer link`);
  }
  // /go/ of a code not in the visitor's view: to its codes page, never to the retailer, no click.
  const logged = { DB: memoryDb() };
  const deGo = await get('/go/tooled-up-claimfifty', logged, 'DE');
  assert.equal(deGo.status, 302);
  assert.equal(deGo.headers.get('location'), `https://${cgw.domain}/discount-codes/tooled-up/`);
  assert.equal(logged.DB.rows.length, 0, 'no click recorded');
  // The UK, an unknown country, the US and Google's crawler (the UK view): the codes, the footer link, /go/ to Awin.
  for (const [cc, headers] of [['GB', {}], ['', {}], ['US', {}], ['DE', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }]]) {
    const tag = headers['User-Agent'] ? 'Googlebot' : cc || 'unknown';
    const index = await (await get('/discount-codes/', env, cc, headers)).text();
    for (const c of ['CLAIMFIFTY', 'CLAIMSEVFY']) assert.ok(index.includes(`<strong translate="no">${c}</strong>`), `${tag}: ${c}`);
    assert.match(index, /<meta name="robots" content="index,follow">/, tag);
    assert.ok(index.includes(FOOTER_LINK), `${tag}: footer link`);
    assert.ok((await (await get('/about/', env, cc, headers)).text()).includes(FOOTER_LINK), `${tag}: footer link on /about/`);
    const go = await get('/go/my-tool-shed-claimsevfy', env, cc, headers);
    assert.equal(go.status, 302, tag);
    assert.equal(new URL(go.headers.get('location')).hostname, 'www.awin1.com', tag);
  }
  // The sitemap is the UK view, whoever asks.
  for (const cc of ['DE', 'GB']) {
    const map = await (await get('/sitemap-static.xml', env, cc)).text();
    assert.ok(map.includes(`https://${cgw.domain}/discount-codes/tooled-up/`) && map.includes(`https://${cgw.domain}/discount-codes/my-tool-shed/`), `sitemap asked from ${cc}`);
  }
  // The shared config never carries a visitor's view (each answer gets its own copy).
  assert.ok(!('promoView' in cgw) && !('promoView' in sites.CGW));
});

test('L114: cached pages keep one copy per view group, so the codes and their footer link never reach another group', async () => {
  const sites = await allSites();
  const cgw = runningToday(sites.CGW);
  const get = visitor(cgw);
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    const env = { DB: memoryDb(), CLICK_LOG: 'off' };
    const gb = await (await get('/', env, 'GB')).text();
    const de = await (await get('/', env, 'DE')).text();
    const keys = [...store.keys()].sort();
    const deGroup = viewFor(cgw, 'DE').group;
    assert.deepEqual(keys, [`https://${cgw.domain}/?gw-view=${deGroup}`, `https://${cgw.domain}/?gw-view=gb`].sort(), 'one copy per group');
    assert.ok(gb.includes(FOOTER_LINK), 'the UK copy links to the codes');
    assert.ok(!de.includes(FOOTER_LINK), 'the German copy does not');
    // Later visits get their own group's copy: an unknown country and the US get the UK one, Germany its own.
    assert.ok((await (await get('/', env, '')).text()).includes(FOOTER_LINK));
    assert.ok((await (await get('/', env, 'US')).text()).includes(FOOTER_LINK));
    assert.ok(!(await (await get('/', env, 'DE')).text()).includes(FOOTER_LINK));
    assert.equal(store.size, 2, 'no other copy');
    assert.ok(!(await store.get(`https://${cgw.domain}/?gw-view=${deGroup}`).clone().text()).includes(FOOTER_LINK));
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});
