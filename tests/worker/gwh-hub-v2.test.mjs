// Gear World Hub V2 ("Συνδυασμός", 27/10/2026): the new home page. Texts in 11 languages, campaigns by date (Black
// Friday only 27-30/11), the gift finder (only the right Gear Worlds, a price), deals from promos.js with end dates
// and site links (never /go/ or /out/), the ids the other scripts need, no red or green, nothing that moves by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { PROMOS } from '../../promos/promos.js';
import { buildDeals, dealsJson, siteDomains } from '../../tools/gwh-deals.mjs';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const LOCALES = ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];

function hub(locationLike) {
  const window = { addEventListener() {}, dispatchEvent() {} };
  const document = { readyState: 'loading', addEventListener() {} };
  const context = { window, document, URLSearchParams, Intl, console };
  if (locationLike) context.location = locationLike;
  vm.runInNewContext(read('public/hub-v2.js'), context);
  return window.GearWorldHubV2;
}
const at = day => Date.parse(`${day}T12:00:00Z`);

test('hub v2: every text in the 11 languages of the Hub, translated, with the same {placeholders}', () => {
  const h = hub();
  assert.deepEqual([...h.locales], LOCALES);
  const translations = read('public/translations.js');
  for (const l of LOCALES) assert.ok(translations.includes(`"${l}"`), `translations.js has ${l}`);
  const keys = Object.keys(h.strings);
  assert.ok(keys.length >= 30, `about 30 new texts or more (${keys.length})`);
  for (const key of keys) {
    const list = h.strings[key];
    assert.equal(list.length, 11, key);
    const same = (h.sameAsEnglish[key] || []);
    list.forEach((text, i) => {
      assert.ok(typeof text === 'string' && text.trim().length > 0, `${key} ${LOCALES[i]}`);
      if (i > 0 && !same.includes(LOCALES[i])) assert.notEqual(text, list[0], `${key} is translated in ${LOCALES[i]}`);
    });
    const vars = (list[0].match(/\{[a-z]+\}/g) || []).sort().join();
    list.forEach((text, i) => assert.equal((text.match(/\{[a-z]+\}/g) || []).sort().join(), vars, `${key} keeps its {placeholders} in ${LOCALES[i]}`));
  }
  assert.equal(h.strings.lead[1], 'Γράψτε το, πείτε το ή φωτογραφίστε το. Ψάχνουμε σε όλα τα 10 Gear Worlds μαζί.');
  assert.equal(h.strings.photoBtn[1], 'Αναζήτηση με φωτογραφία');
  // Every text the page or the script asks for exists.
  const html = read('public/index.html');
  const asked = new Set([...html.matchAll(/data-gwh2(?:-aria)?="([A-Za-z]+)"/g)].map(m => m[1]));
  const code = read('public/hub-v2.js');
  for (const m of code.matchAll(/tx\("([A-Za-z]+)"/g)) asked.add(m[1]);
  for (const c of [...h.campaigns, h.fallbackCampaign]) for (const k of ['eyebrow', 'title', 'text', 'cta']) if (c[k]) asked.add(c[k]);
  for (const g of h.gifts) { asked.add(g.label); for (const idea of g.ideas) asked.add(idea[0]); }
  for (const p of h.popular) asked.add(p[0]);
  for (const k of asked) assert.ok(h.strings[k], `text "${k}" exists`);
});

test('hub v2: campaigns follow their UK dates; Black Friday only 27-30 November; nothing outside the dates', () => {
  const h = hub();
  const ids = day => h.activeCampaigns(at(day)).map(c => c.id).join(',');
  assert.equal(ids('2026-10-28'), 'sporty-gear-world');
  assert.equal(ids('2026-11-12'), 'christmas,sporty-gear-world');
  assert.equal(ids('2026-11-13'), 'black-friday-soon,christmas,sporty-gear-world');
  assert.equal(ids('2026-11-26'), 'black-friday-soon,christmas,sporty-gear-world');
  assert.equal(ids('2026-11-27'), 'black-friday,christmas,sporty-gear-world');
  assert.equal(ids('2026-11-30'), 'black-friday,christmas,sporty-gear-world');
  assert.equal(ids('2026-12-01'), 'christmas,sporty-gear-world');
  assert.equal(ids('2026-12-25'), 'sporty-gear-world');
  assert.equal(ids('2027-01-01'), 'all-worlds', 'without campaigns: the general slide');
  // 30/11 at 23:30 in London is still Black Friday week; 1/12 00:30 London is not.
  assert.ok(h.activeCampaigns(Date.parse('2026-11-30T23:30:00Z')).some(c => c.id === 'black-friday'));
  assert.ok(!h.activeCampaigns(Date.parse('2026-12-01T00:30:00Z')).some(c => c.id === 'black-friday'));
  const bf = h.campaigns.find(c => c.id === 'black-friday');
  assert.deepEqual([bf.start, bf.end], ['2026-11-27', '2026-11-30']);
  for (const c of h.campaigns) {
    assert.match(c.start, /^\d{4}-\d{2}-\d{2}$/, c.id);
    assert.match(c.end, /^\d{4}-\d{2}-\d{2}$/, c.id);
    assert.ok(c.start <= c.end, c.id);
    assert.ok(/^(#[a-z]+|https:\/\/[a-z]+gearworld\.com\/)$/.test(c.href), `${c.id}: a part of the page or a Gear World site`);
    assert.ok(existsSync(new URL(`public${c.image}`, ROOT)), `${c.id}: its picture is in the Hub folder`);
  }
});

test('hub v2: ?gwh-date= changes the slides only on the test address, never on gearworldhub.com', () => {
  const preview = hub({ hostname: 'gear-world-hub-preview.example.workers.dev', search: '?gwh-date=2026-11-28' });
  assert.ok(preview.activeCampaigns().some(c => c.id === 'black-friday'));
  const live = hub({ hostname: 'gearworldhub.com', search: '?gwh-date=2026-11-28' });
  const today = live.ukToday();
  if (today < '2026-11-27' || today > '2026-11-30') assert.ok(!live.activeCampaigns().some(c => c.id === 'black-friday'));
  const bad = hub({ hostname: 'gear-world-hub-preview.example.workers.dev', search: '?gwh-date=<script>' });
  assert.deepEqual(bad.activeCampaigns().map(c => c.id), bad.activeCampaigns(Date.now()).map(c => c.id));
});

test('hub v2: the gift finder asks only Gear Worlds that exist, with a price, and the search accepts its parameters', () => {
  const h = hub();
  const codes = readdirSync(new URL('../../sites/', import.meta.url)).filter(n => existsSync(new URL(`../../sites/${n}/site.config.js`, import.meta.url)));
  assert.equal(h.gifts.length, 8);
  for (const g of h.gifts) {
    assert.equal(g.ideas.length, 3, g.id);
    for (const [label, q, worlds] of g.ideas) {
      assert.ok(q.length >= 2 && /^[a-z ]+$/.test(q), `${label}: English search words`);
      assert.ok(worlds.length >= 1 && worlds.length <= 3, label);
      for (const w of worlds) assert.ok(codes.includes(w), `${label}: ${w} is a Gear World`);
    }
  }
  assert.deepEqual([...h.budgets], [25, 50, 100, 0]);
  assert.equal(h.giftSearchUrl(['ideaPlanter', 'planter', ['ggw', 'hgw']], 50), '/api/search?q=planter&worlds=ggw%2Chgw&max_price=50');
  assert.equal(h.giftSearchUrl(['ideaDrill', 'drill', ['cgw']], 0), '/api/search?q=drill&worlds=cgw', 'any price: no price sent');
  const worker = read('worker.js');
  assert.match(worker, /searchParams\.get\("worlds"\)/);
  assert.match(worker, /readPrice\("max_price"\)/);
});

test('hub v2: deals come from promos.js (hub-deals.json is up to date), keep the end date, link to a site page only', async () => {
  const domains = await siteDomains();
  assert.equal(Object.keys(domains).length, 10, 'the 10 Gear Worlds');
  const want = dealsJson(buildDeals(PROMOS, domains));
  assert.equal(read('public/hub-deals.json'), want, 'run: node tools/gwh-deals.mjs');
  const { deals } = JSON.parse(want);
  assert.ok(deals.length > 0);
  for (const d of deals) {
    assert.match(d.end, /^\d{4}-\d{2}-\d{2}$/, `${d.id}: end date`);
    assert.match(d.link, /^https:\/\/[a-z]+gearworld\.com\/discount-codes\/[a-z0-9-]+\/$/, `${d.id}: a retailer page of a site`);
    assert.ok(!/\/(go|out)\//.test(d.link));
    assert.ok(!('code' in d), `${d.id}: the code itself stays on the site page`);
    assert.ok(!('url' in d) && !('awinMid' in d) && !('source' in d), `${d.id}: only what the page needs`);
    assert.ok(d.sites.includes(Object.keys(domains).find(k => d.link.includes(domains[k]))), `${d.id}: the link is a site that has the deal`);
  }
  // The page shows only running deals, codes first, never a link outside the site pages.
  const h = hub();
  const list = h.activeDeals([
    ...deals,
    { ...deals[0], id: 'old', start: '2020-01-01', end: '2020-01-31' },
    { ...deals[0], id: 'evil', link: 'https://technologygearworld.com/go/x/' },
    { ...deals[0], id: 'noend', end: '' }
  ], at('2026-10-28'));
  assert.ok(list.length >= 1);
  assert.ok(!list.some(d => ['old', 'evil', 'noend'].includes(d.id)));
  const kinds = list.map(d => d.kind);
  assert.deepEqual(kinds, [...kinds].sort((a, b) => (a === b ? 0 : a === 'code' ? -1 : 1)), 'codes first');
  assert.equal(h.activeDeals(deals, at('2027-01-01')).length, 0, 'after their end date the deals disappear by themselves');
});

test('hub v2: the page keeps every id and class the other scripts need, and loads the new files (new ?v=, L31)', () => {
  const html = read('public/index.html');
  for (const id of ['hubSearch', 'hubSearchInput', 'searchMessage', 'gwhLanguage', 'gwhEmailForm', 'gwhEmailInput', 'gwhEmailConsent', 'gwhEmailSubmit', 'gwhEmailMessage', 'gwhEmailTitle', 'gwhAnalyticsConsent', 'gwhAnalyticsConsentText', 'gwhAnalyticsAccept', 'gwhAnalyticsReject', 'year', 'worlds', 'about', 'gifts', 'deals', 'newsletter', 'gwh2Campaigns', 'gwh2Dock']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /<body class="gwh2" data-gwh-compact-v2="true">/);
  assert.match(html, /<div class="hero-copy">\s*<span class="eyebrow">/);
  assert.match(html, /<link rel="stylesheet" href="\/hub-v2\.css\?v=20261027-hub2">/);
  assert.match(html, /<script src="\/hub-v2\.js\?v=20261027-hub2" defer><\/script>/);
  assert.ok(html.indexOf('/gear-world-camera.js?v=') < html.indexOf('/hub-v2.js?v='), 'hub-v2.js after the camera script');
  assert.ok(!html.includes('/styles.css'), 'the old styles.css is not loaded');
  assert.ok(!html.includes('gwh-hero.png'), 'the 2.8 MB picture is gone from the page');
  // The 10 worlds in the order of the V2 translations (translations.js translates them by position).
  const order = [...html.matchAll(/data-world="([A-Z]{3})"/g)].map(m => m[1]);
  assert.deepEqual(order, ['CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'TGW', 'AGW', 'VGW', 'SGW']);
  for (const cls of ['gwh-image-world-title', 'gwh-image-world-description', 'gwh-image-world-cta', 'gwh-choose-world-label', 'gwh-compact-how-heading', 'gwh-compact-how-grid', 'gwh-compact-disclosure', 'gwh-business-banner', 'gwh-sponsored', 'gwh-business-copy', 'gwh-business-link', 'footer-inner', 'about-box']) {
    assert.ok(html.includes(cls), cls);
  }
  // The sponsored card: the same Awin link, at the bottom (after the sign-up), never blinking.
  assert.ok(html.includes('href="https://www.awin1.com/cread.php?awinmid=116725&awinaffid=3057233&ued=https%3A%2F%2Fworldbusinessesforsale.com%2Fpages%2Fsell-business"'));
  assert.ok(html.indexOf('class="gwh-business-banner"') > html.indexOf('id="newsletter"'));
  assert.ok(!/gwhBusinessBlink|@keyframes/.test(html));
  assert.ok(!/href="[^"]*\/(go|out)\//.test(html), 'no /go/ or /out/ link');
  const allow = read('public-allowlist.txt').split('\n').map(s => s.trim());
  for (const f of ['hub-v2.css', 'hub-v2.js', 'hub-deals.json']) assert.ok(allow.includes(f), `allow-list has ${f} (L04)`);
});

test('hub v2: no red or green (L35), nothing that moves by itself, buttons at least 44 px in the styles', () => {
  for (const file of ['public/hub-v2.css', 'public/hub-v2.js']) {
    const code = read(file);
    for (const c of code.match(/#[0-9a-f]{6}\b/gi) || []) {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
      assert.ok(!(r > 150 && g < 90 && b < 90), `${file}: ${c} is not red`);
      assert.ok(!(g > 150 && r < 110 && b < 110), `${file}: ${c} is not green`);
    }
    assert.ok(!/@keyframes|setInterval\(/.test(code), `${file}: no animation and no timer that changes the page`);
  }
  const js = read('public/hub-v2.js');
  assert.ok(!/setTimeout\([^)]*slide/.test(js), 'slides change only with the arrows');
  const css = read('public/hub-v2.css');
  assert.match(css, /\.gwh2-chip\{min-height:44px;/);
  assert.match(css, /\.gwh2-round\{[^}]*width:44px;height:44px;/);
  assert.match(css, /\.gwh-business-link\{[^}]*animation:none !important;/);
  assert.match(css, /prefers-reduced-motion/);
});
