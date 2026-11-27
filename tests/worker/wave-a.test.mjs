// Priority A of «Λείπουν 25-11» (lessons L234): the delivery lines of the approved shops that come to the 13 sites
// (sites/_shared/wave-a.js). Each one is seen only where its shop delivers (and speaks its feed's language), never in
// the UK view, by Google's crawlers or in the sitemaps, and no site goes over 10 page groups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliveryConfigProblems, deliveryCountries, shownCountries, feedLanguage, FEED_LANGUAGES, COUNTRY_NAMES } from '../../src/lib/delivery.js';
import { viewFor, countryGroups, isShown, homeView } from '../../src/lib/visibility.js';
import { WAVE_A, WAVE_A_SITES, LEGACY_SITES, LEGACY_NAME, waveDelivery } from '../../sites/_shared/wave-a.js';
import { TEST_DAY } from './test-clock.mjs';

const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);
const config = {};
for (const s of WAVE_A_SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
// Countries a visitor may come from: the UK, every country of a feed language, the EU, a few others, unknown.
const VISITORS = [...new Set(['GB', 'US', 'IE', 'PL', 'GR', 'CY', 'CA', 'AU', 'XX', '', ...Object.values(FEED_LANGUAGES).flat(),
  'BG', 'CZ', 'DK', 'EE', 'HR', 'HU', 'LT', 'LV', 'MT', 'PT', 'RO', 'SE', 'SI', 'SK'])];

test('L234: each Priority A line names its site, its shop as the import writes it, real countries outside the UK, its row', () => {
  const seen = new Set();
  for (const e of WAVE_A) {
    const id = `${e.site} ${e.retailer}`;
    assert.ok(WAVE_A_SITES.includes(e.site), `${id}: one of the 13 sites`);
    assert.equal(typeof e.retailer, 'string', id);
    assert.equal(e.retailer, e.retailer.trim(), `${id}: no space at either end`);
    assert.ok(e.retailer.length >= 2, id);
    if (LEGACY_SITES.includes(e.site)) assert.match(e.retailer, LEGACY_NAME, `${id}: a name tools/legacy-import.ps1 accepts`);
    assert.ok(!seen.has(id), `${id}: once`);
    seen.add(id);
    assert.ok(Array.isArray(e.countries) && e.countries.length > 0, `${id}: countries`);
    for (const c of e.countries) {
      assert.ok(Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, c), `${id}: a known country code (${c})`);
      assert.notEqual(c, 'GB', `${id}: Priority A is outside the UK (a UK shop keeps the default)`);
    }
    assert.equal(new Set(e.countries).size, e.countries.length, `${id}: a country once`);
    if (e.language !== undefined) assert.ok(Object.prototype.hasOwnProperty.call(FEED_LANGUAGES, e.language), `${id}: a feed language (${e.language})`);
    assert.ok(Number.isInteger(e.row) && e.row >= 2 && e.row <= 541, `${id}: the row of «Λείπουν 25-11»`);
    assert.ok(typeof e.source === 'string' && e.source.length >= 5, `${id}: who gave the facts`);
  }
});

test('L234: the site configs carry exactly the Priority A lines, which never replace a line of their own', () => {
  for (const s of WAVE_A_SITES) {
    const site = config[s];
    const text = readFileSync(`sites/${s}/site.config.js`, 'utf8');
    assert.match(text, new RegExp(`waveDelivery\\('${s}'\\)`), `${s}: spreads its own lines`);
    assert.match(text, /\.\.\.WAVE_A\.retailers \}/, `${s}: the retailers`);
    assert.match(text, /\.\.\.WAVE_A\.languages \}/, `${s}: the languages`);
    const own = waveDelivery(s);
    for (const [name, list] of Object.entries(own.retailers)) {
      assert.deepEqual(site.deliversTo.retailers[name], list, `${s} ${name}: the line`);
      assert.equal(feedLanguage(site, name), own.languages[name] || '', `${s} ${name}: the feed language`);
      // A name the config writes itself would be overwritten silently.
      const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.doesNotMatch(text, new RegExp(`(?:'${quoted}'|\\b${quoted}): \\[`), `${s} ${name}: not also a line of the config`);
    }
    assert.deepEqual(deliveryConfigProblems(site), [], `${s}: deliversTo`);
  }
});

test('L234: a Priority A shop is seen only where it delivers (and its feed language is spoken), never in the UK view or by Google', () => {
  for (const e of WAVE_A) {
    const site = config[e.site];
    const id = `${e.site} ${e.retailer}`;
    const row = { retailer: e.retailer, last_seen_at: `${TEST_DAY} 06:00:00` };
    const where = shownCountries(site, e.retailer);
    assert.ok(where.length > 0, `${id}: seen somewhere`);
    assert.deepEqual(deliveryCountries(site, e.retailer), [...e.countries], `${id}: the card says where it delivers`);
    assert.equal(isShown(homeView(site, NOW), row), false, `${id}: the sitemaps, /api/stats of the UK and Google (the UK view)`);
    const usOnly = !e.language && e.countries.every(c => c === 'US');
    for (const cc of VISITORS) {
      const shown = isShown(viewFor(site, cc, NOW), row);
      if (cc === 'GB') assert.equal(shown, false, `${id}: never the UK view`);
      else if (e.language || usOnly) assert.equal(shown, where.includes(cc), `${id} ${cc || 'unknown'}: only ${where.join(', ')}`);
    }
  }
});

test('L234, L199, L202: no site goes over 10 page groups', () => {
  for (const s of WAVE_A_SITES) {
    const { list } = countryGroups(config[s]);
    assert.ok(list.length <= 10, `${s}: ${list.length} groups (${list.map(g => g.id).join(', ')})`);
    for (const g of list) assert.ok((g.hidden || g.only || []).length <= 600, `${s} ${g.id}: names in one statement`);
  }
});
