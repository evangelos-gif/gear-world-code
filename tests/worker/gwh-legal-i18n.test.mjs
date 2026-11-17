// Lessons L176 (owner, 17 Nov 2026: the policies in the language of every country). The Hub's legal pages are
// translated by legal.js from public/legal/i18n/<language>.json: each block of the page by its English HTML, the
// translation with the same links and tags. These checks run without a browser; the page check opens them in one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const PUB = 'sites/gwh/public';
const LANGS = ['el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];
const PAGES = ['privacy', 'cookies', 'terms', 'affiliate-disclosure', 'contact', 'about'];
const read = f => readFileSync(`${PUB}/${f}`, 'utf8');
const tags = s => (s.match(/<[^>]+>/g) || []).sort();
const NOTE = 'This is a translation. If it differs from the English text, the English text applies.';

test('L176: one file per language of the Hub, the same English texts in each, every link and tag kept', () => {
  assert.deepEqual(readdirSync(`${PUB}/legal/i18n`).sort(), LANGS.map(l => `${l}.json`).sort());
  const dicts = Object.fromEntries(LANGS.map(l => [l, JSON.parse(read(`legal/i18n/${l}.json`))]));
  const keys = Object.keys(dicts['el-GR']).sort();
  assert.ok(keys.length >= 100, `${keys.length} texts`);
  assert.ok(keys.includes(NOTE));
  for (const l of LANGS) {
    const raw = read(`legal/i18n/${l}.json`);
    const d = dicts[l];
    assert.deepEqual(Object.keys(d).sort(), keys, `${l}: the same texts`);
    const sorted = {};
    for (const k of Object.keys(d).sort()) sorted[k] = d[k];
    assert.equal(raw, JSON.stringify(sorted, null, 1) + '\n', `${l}: sorted, one space, a new line at the end`);
    for (const [k, v] of Object.entries(d)) {
      assert.ok(typeof v === 'string' && v.trim() === v && v.length > 0, `${l}: "${k}"`);
      assert.deepEqual(tags(v), tags(k), `${l}: the same links and tags in "${k.slice(0, 60)}"`);
      for (const name of ['Gear World', 'Awin', 'CJ', 'Google', 'Cloudflare', 'MailerLite', 'Evangelos Kalogerakis', 'gearworldhub.com']) {
        // German joins a name into a word with hyphens (Gear-World-Website): still the name.
        if (k.includes(name)) assert.ok(v.replace(/-/g, ' ').includes(name), `${l}: "${name}" stays in "${v.slice(0, 80)}"`);
      }
    }
    assert.notEqual(d[NOTE], NOTE, `${l}: the note is translated`);
  }
});

test('L176: every text of the dictionaries is on a legal page (or said by legal.js), and the pages ask for it', () => {
  const legalJs = read('legal/legal.js');
  const html = PAGES.map(p => read(`${p}/index.html`)).join('\n');
  // The browser's HTML of a block: the same text with © for &copy; and one space for each run of white space.
  const flat = html.replace(/&copy;/g, '©').replace(/\s+/g, ' ');
  for (const k of Object.keys(JSON.parse(read('legal/i18n/el-GR.json')))) {
    assert.ok(flat.includes(k) || legalJs.includes(`"${k}"`) || flat.includes(`>${k}<`) || flat.includes(`"${k}"`), `on a page: ${k.slice(0, 80)}`);
  }
  for (const p of PAGES) {
    const h = read(`${p}/index.html`);
    assert.match(h, /<html lang="en" data-lg-i18n>/, p);
    assert.match(h, /<script src="\/legal\/legal\.js\?v=20261120-search1" defer><\/script>/, p);
  }
  assert.match(legalJs, /var VERSION = "20261120-search1";/, 'the dictionaries are asked with the same ?v= as the script (L180: the privacy sentence of 20/11/2026)');
  // The order of the language: the visitor's choice (English only with the mark of the menu), then the country.
  assert.match(legalJs, /LOCALES\.indexOf\(lang\) < 0 \|\| \(lang === "en-GB" && !chosen\)/);
  assert.match(legalJs, /document\.documentElement\.getAttribute\("data-country-lang"\)/);
  assert.match(legalJs, /hasAttribute\("data-lg-i18n"\)/, 'only pages that ask for it (the guides and stores stay English)');
  const allow = read('../public-allowlist.txt');
  for (const l of LANGS) assert.match(allow, new RegExp(`^legal/i18n/${l}\\.json$`, 'm'));
  for (const g of readdirSync(`${PUB}/guides`, { withFileTypes: true }).filter(d => d.isDirectory())) {
    assert.ok(!read(`guides/${g.name}/index.html`).includes('data-lg-i18n'), `guides/${g.name}: English only`);
  }
});

test('L176: the cookies page lists the new browser storage of L175 and the seasonal pause', () => {
  const c = read('cookies/index.html');
  for (const name of ['gwh-language', 'gwh-language-chosen', 'gwh2-season-paused', 'gwh_cookie_consent']) assert.ok(c.includes(`<code>${name}</code>`), name);
  assert.match(c, /<p class="lg-updated">Last updated: 17 November 2026<\/p>/);
  const p = read('privacy/index.html');
  assert.match(p, /<li><strong>Language\.<\/strong> If you have not chosen a language, the Hub shows its pages in the language of your country, as reported by our hosting provider\. Your country is not stored\.<\/li>/);
  assert.match(p, /may process data outside the UK and the European Economic Area\./);
});

// The other way round (the check of 17/11/2026): every block that legal.js translates on a page has its text in the
// dictionaries, so no English is left inside a translated page. Blocks of code names only (gwh-language, _ga, _ga_*), the
// e-mail link and the brand stay as they are. The /about/ article is translated by about.js (data-about), and the status
// line of the cookies page and the reset button are written by legal.js itself.
test('L176: every block of the legal pages is in the dictionaries (page to dictionary)', () => {
  const dict = JSON.parse(read('legal/i18n/el-GR.json'));
  const norm = h => h.replace(/&copy;/g, '©').replace(/\s+/g, ' ').trim();
  const part = (h, re) => (h.match(re) || [, ''])[1];
  const KEEP = /^(<a href="mailto:[^"]+">[^<]+<\/a>|<code>[^<]+<\/code>(, <code>[^<]+<\/code>)*|Gear <span>World<\/span> Hub)$/;
  let counted = 0;
  for (const p of PAGES) {
    const h = read(`${p}/index.html`);
    const prose = p === 'about' ? '' : part(h, /<article class="lg-prose">([\s\S]*?)<\/article>/);
    const crumbs = part(h, /<nav class="lg-crumbs"[^>]*>([\s\S]*?)<\/nav>/);
    const blocks = [];
    for (const m of prose.matchAll(/<(h1|h2|p|li|th)( [^>]*)?>([\s\S]*?)<\/\1>/g)) if (!/id="gwhAnalyticsStatus"/.test(m[2] || '')) blocks.push(m[3]);
    for (const m of prose.matchAll(/<td[^>]*><span>([\s\S]*?)<\/span><\/td>/g)) blocks.push(m[1]);
    for (const m of crumbs.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)) blocks.push(m[1]);
    const last = crumbs.match(/<span>([^<]*)<\/span>\s*$/);
    if (last) blocks.push(last[1]);
    for (const m of part(h, /<nav class="lg-legal"[^>]*>([\s\S]*?)<\/nav>/).matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)) blocks.push(m[1]);
    for (const m of part(h, /<footer class="lg-footer">([\s\S]*?)<\/footer>/).matchAll(/<p>([\s\S]*?)<\/p>/g)) blocks.push(m[1]);
    for (const b of blocks.map(norm)) {
      if (/<button /.test(b) || !/[A-Za-z]/.test(b.replace(/<[^>]+>/g, '')) || KEEP.test(b)) continue;
      counted++;
      assert.ok(Object.prototype.hasOwnProperty.call(dict, b), `${p}: not in the dictionaries: ${b.slice(0, 120)}`);
    }
  }
  assert.ok(counted >= 150, `${counted} blocks`);
  // The three cells of the cookies table with words next to the code names (the gap of the first version).
  for (const k of ['<code>gwh_cookie_consent</code> (before 3 November 2026: <code>gwh_analytics_consent</code>)',
    '<code>_gcl_au</code>, <code>_gcl_aw</code> and similar', '<code>__cf_bm</code> and similar']) assert.ok(k in dict, k);
});

// Since L121 (14/11/2026) the "Featured pick" card of the home page is a Sovrn Commerce link: the disclosure, privacy and
// cookies pages say so in every language, with the words of the card itself (its title and badge in hub-v2.js).
test('L176: the Featured pick (Sovrn Commerce) is named in every language, with the words of the card', () => {
  const hub = read('hub-v2.js');
  const list = key => JSON.parse(hub.match(new RegExp(`${key}: (\\[[^\\]]+\\])`))[1]);
  const titles = list('featuredTitle');
  const badges = list('featuredBadge');
  const ORDER = ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];
  const disc = 'The one exception is the "Featured pick" card on the home page, marked "Affiliate link". It takes you straight to the retailer through another affiliate network, Sovrn Commerce. If you then buy something, the retailer may pay Gear World a commission, at no extra cost to you. The Hub has no paid placements.';
  for (const l of LANGS) {
    const d = JSON.parse(read(`legal/i18n/${l}.json`));
    const i = ORDER.indexOf(l);
    assert.ok(d[disc].includes(titles[i]) && d[disc].includes(badges[i]) && d[disc].includes('Sovrn Commerce'), `${l}: ${d[disc].slice(0, 90)}`);
    const sovrn = Object.entries(d).filter(([k]) => k.includes('Sovrn'));
    assert.equal(sovrn.length, 3, `${l}: disclosure, privacy and cookies`);
    for (const [, v] of sovrn) assert.ok(v.includes('Sovrn') && v.includes(titles[i]), `${l}: ${v.slice(0, 90)}`);
    assert.ok(!Object.values(d).some(v => /Hub[^.]{0,30}(δεν έχει affiliate|keine Affiliate-Links|n'a pas de liens d'affiliation|non ha link di affiliazione|no tiene enlaces de afiliación|não tem links de afiliados|geen affiliatelinks|nuk ka lidhje afiliimi|nu are linkuri de afiliere|нет партнёрских ссылок)/.test(v)), `${l}: no "the Hub has no affiliate links"`);
  }
  const about = read('about/about.js');
  assert.equal((about.match(/Sovrn Commerce/g) || []).length, 11, 'the /about/ lead names Sovrn in the 11 languages');
});
