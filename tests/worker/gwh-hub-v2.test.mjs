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
  assert.equal(ids('2026-10-28'), 'halloween');
  assert.equal(ids('2026-10-31'), 'halloween');
  assert.equal(ids('2026-11-12'), 'christmas');
  assert.equal(ids('2026-11-13'), 'black-friday-soon,christmas');
  assert.equal(ids('2026-11-26'), 'black-friday-soon,christmas');
  assert.equal(ids('2026-11-27'), 'black-friday,christmas');
  assert.equal(ids('2026-11-30'), 'black-friday,christmas');
  assert.equal(ids('2026-12-01'), 'christmas');
  assert.equal(ids('2026-12-25'), 'all-worlds');
  assert.equal(ids('2026-12-26'), 'winter-sales');
  assert.equal(ids('2027-01-05'), 'winter-sales,new-year-fitness');
  assert.equal(ids('2027-02-14'), 'valentines-day');
  assert.equal(ids('2027-02-15'), 'all-worlds', 'without campaigns: the general slide');
  // Shopping seasons only: no slide about a new site (the owner, 27/10/2026).
  assert.ok(!h.campaigns.some(c => /new-?site|gear-world$|sporty-gear-world/.test(c.id)));
  for (const c of h.campaigns) for (const k of ['eyebrow', 'title', 'text']) if (c[k]) assert.ok(!/NEW GEAR WORLD|ΝΕΟ GEAR WORLD/i.test(h.strings[c[k]][0] + h.strings[c[k]][1]), `${c.id}: no "new Gear World" text`);
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
    assert.ok(typeof h.art[c.art] === 'string' && h.art[c.art].startsWith('<svg class="gwh2-art"') && h.art[c.art].endsWith('</svg>'), `${c.id}: its own drawn picture (no photo of our sites)`);
    assert.ok(!/<img|\.jpg|\.png|href=/.test(h.art[c.art]), `${c.id}: the picture is drawn, not a photo or a link`);
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
  assert.match(html, /<link rel="stylesheet" href="\/hub-v2\.css\?v=20261027-hub6">/);
  assert.match(html, /<script src="\/hub-v2\.js\?v=20261027-hub6" defer><\/script>/);
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
    assert.ok(!/setInterval\(|requestAnimationFrame\(|infinite/.test(code), `${file}: no timer or endless animation that changes the page`);
  }
  // Campaign pictures: things drop in ONCE (at most 2 s, at most 1 s late), then stay still; none with "reduce motion".
  const css = read('public/hub-v2.css');
  assert.deepEqual([...css.matchAll(/@keyframes\s+([A-Za-z0-9]+)/g)].map(m => m[1]).sort(), ['gwh2Drop', 'gwh2Fall']);
  for (const m of css.matchAll(/animation:([a-zA-Z0-9]+) ([0-9.]+)s/g)) assert.ok(Number(m[2]) <= 2, `${m[1]} lasts at most 2 s`);
  for (const m of css.matchAll(/animation-delay:([0-9.]+)s/g)) assert.ok(Number(m[1]) <= 1, 'starts within 1 s');
  assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\*\{[^}]*animation:none !important;/);
  const js = read('public/hub-v2.js');
  assert.ok(!/setTimeout\([^)]*slide/.test(js), 'slides change only with the arrows');
  assert.match(css, /\.gwh2-chip\{min-height:44px;/);
  assert.match(css, /\.gwh2-round\{[^}]*width:44px;height:44px;/);
  assert.match(css, /\.gwh-business-link\{[^}]*animation:none !important;/);
  assert.match(css, /prefers-reduced-motion/);
});

test('hub v2: the seasonal video banner of the deals follows its own yearly calendar, with a countdown for Black Friday', () => {
  const h = hub();
  const id = day => { const x = h.seasonFor(at(day)); return x ? x.id : ''; };
  // The owner's dates for 2026: Halloween 20/10-31/10, Black Friday 20/11-1/12 (countdown to 30/11 23:59), Christmas 2/12-24/12.
  assert.deepEqual(['2026-10-19', '2026-10-20', '2026-10-31', '2026-11-01', '2026-11-19', '2026-11-20', '2026-12-01', '2026-12-02', '2026-12-24', '2026-12-25'].map(id),
    ['', 'halloween', 'halloween', '', '', 'black-friday', 'black-friday', 'christmas', 'christmas', '']);
  const bf = h.seasonsOf(2026).find(x => x.id === 'black-friday');
  assert.equal(bf.countdownTo, '2026-11-30T23:59:00Z', '30/11 23:59 UK time (GMT in November)');
  // Every year by itself: Black Friday is the day after the 4th Thursday of November.
  assert.deepEqual([2026, 2027, 2028, 2029].map(h.blackFridayDay), [27, 26, 24, 23]);
  assert.equal(id('2027-11-19'), 'black-friday');
  assert.equal(id('2027-11-30'), 'black-friday');
  assert.equal(id('2027-12-01'), '');
  // The countdown: days, hours and minutes; nothing after the end.
  assert.equal(h.countdownText(bf, Date.parse('2026-11-28T10:30:00Z')), 'Ends in 2 d 13 h 29 min');
  assert.equal(h.countdownText(bf, Date.parse('2026-11-30T22:00:00Z')), 'Ends in 1 h 59 min');
  assert.equal(h.countdownText(bf, Date.parse('2026-12-01T00:00:00Z')), '');
  assert.equal(h.countdownText(h.seasonsOf(2026)[0], at('2026-10-25')), '', 'no countdown for Halloween');
});

test('hub v2: the seasonal files are ready for the web and are served from the Hub itself', () => {
  const allow = read('public-allowlist.txt').split('\n').map(x => x.trim());
  for (const name of ['halloween', 'black-friday', 'christmas']) {
    const mp4 = readFileSync(new URL(`public/seasonal/${name}.mp4`, ROOT));
    const jpg = readFileSync(new URL(`public/seasonal/${name}.jpg`, ROOT));
    assert.ok(mp4.length > 20000 && mp4.length <= 200 * 1024, `${name}.mp4 is small (${mp4.length} bytes)`);
    assert.ok(jpg.length > 5000 && jpg.length <= 80 * 1024, `${name}.jpg is small (${jpg.length} bytes)`);
    assert.equal(mp4.toString('latin1', 4, 8), 'ftyp', `${name}.mp4 is an MP4`);
    const moov = mp4.indexOf('moov', 0, 'latin1');
    const mdat = mp4.indexOf('mdat', 0, 'latin1');
    assert.ok(moov > 0 && moov < mdat, `${name}.mp4 can start before it is fully downloaded (moov first)`);
    assert.ok(mp4.indexOf('soun', 0, 'latin1') < 0, `${name}.mp4 has no sound track`);
    assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8);
    assert.ok(allow.includes(`seasonal/${name}.mp4`) && allow.includes(`seasonal/${name}.jpg`), `${name}: in the allow-list (L04)`);
  }
  const js = read('public/hub-v2.js');
  // The video: muted, loops, plays inline, nothing loaded before it is needed, the still picture as its poster.
  for (const a of ['"muted"', '"loop"', '"playsinline"', '"autoplay"', '"preload", "none"', '"poster"']) assert.ok(js.includes(a), `video ${a}`);
  assert.match(js, /\/seasonal\/\$\{season\.file\}\.\$\{ext\}\?v=\$\{SEASON_MEDIA_VERSION\}/, 'files from our own domain, with ?v= (L31)');
  assert.ok(!/raw\.githubusercontent|github\.com\/.*seasonal/.test(js), 'never straight from GitHub');
  // Only the still picture with "reduce motion", Save-Data or a slow connection; a Pause button; starts after load.
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /saveData/);
  assert.match(js, /slow-2g\|2g\|3g/);
  assert.match(js, /gwh2-season-pause/);
  assert.match(js, /window\.addEventListener\("load", allowVideo/);
  const css = read('public/hub-v2.css');
  assert.match(css, /\.gwh2-season-pause\{[^}]*min-width:44px;min-height:44px;/);
  assert.match(css, /\.gwh2-season-shade\{[^}]*linear-gradient\(90deg,rgba\(5,8,16,\.95\)/, 'dark gradient on the left (wider screens)');
  const html = read('public/index.html');
  assert.ok(html.indexOf('id="gwh2Season"') > html.indexOf('id="deals"') && html.indexOf('id="gwh2Season"') < html.indexOf('id="gwh2Deals"'), 'the banner is at the top of the deals');
});

test('hub v2: the Worker answers byte ranges for the seasonal files (iPhone Safari needs 206), with a long cache', async () => {
  const { default: worker } = await import('../../sites/gwh/worker.js');
  const file = readFileSync(new URL('public/seasonal/halloween.mp4', ROOT));
  const asked = [];
  const env = {
    ASSETS: {
      fetch: async (req) => {
        asked.push(`${req.method} ${new URL(req.url).pathname}${new URL(req.url).search} ${req.headers.get('Range') || ''}`.trim());
        const path = new URL(req.url).pathname;
        if (path === '/seasonal/halloween.mp4') return new Response(file, { status: 200, headers: { 'Content-Type': 'video/mp4', ETag: '"abc"' } });
        return new Response('not found', { status: 404 });
      }
    }
  };
  const get = (path, headers = {}, method = 'GET') => worker.fetch(new Request(`https://gearworldhub.com${path}`, { method, headers }), env, { waitUntil() {} });

  const whole = await get('/seasonal/halloween.mp4?v=29bd24c');
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(whole.headers.get('Content-Type'), 'video/mp4');
  assert.equal(whole.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal((await whole.arrayBuffer()).byteLength, file.length);
  assert.equal(asked[0], 'GET /seasonal/halloween.mp4', 'the static file is read whole, without ?v= or Range');

  const first = await get('/seasonal/halloween.mp4?v=29bd24c', { Range: 'bytes=0-1' });
  assert.equal(first.status, 206);
  assert.equal(first.headers.get('Content-Range'), `bytes 0-1/${file.length}`);
  assert.equal(first.headers.get('Content-Length'), '2');
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [...file.subarray(0, 2)]);

  const tail = await get('/seasonal/halloween.mp4', { Range: 'bytes=-10' });
  assert.equal(tail.status, 206);
  assert.equal(tail.headers.get('Content-Range'), `bytes ${file.length - 10}-${file.length - 1}/${file.length}`);
  const open = await get('/seasonal/halloween.mp4', { Range: `bytes=${file.length - 5}-` });
  assert.equal((await open.arrayBuffer()).byteLength, 5);
  const big = await get('/seasonal/halloween.mp4', { Range: 'bytes=0-99999999' });
  assert.equal(big.status, 206);
  assert.equal(big.headers.get('Content-Range'), `bytes 0-${file.length - 1}/${file.length}`);
  const bad = await get('/seasonal/halloween.mp4', { Range: `bytes=${file.length}-` });
  assert.equal(bad.status, 416);
  assert.equal(bad.headers.get('Content-Range'), `bytes */${file.length}`);
  const head = await get('/seasonal/halloween.mp4', { Range: 'bytes=0-1' }, 'HEAD');
  assert.equal(head.status, 206);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await get('/seasonal/missing.mp4')).status, 404);
  assert.equal((await get('/seasonal/halloween.mp4', {}, 'POST')).status !== 206, true, 'only GET and HEAD');
});
