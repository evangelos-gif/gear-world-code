// Gear World Hub: the Mega Stores bar (owner, 18/11/2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L192). One big bar above
// everything on gearworldhub.com: ONE plain link to megastoresgearworld.com, the title "Mega Stores", a line in the 11
// languages and the store names rolling past (CSS only, paused on hover and focus, still with "reduce motion"). The Stores
// card and the 13 world cards stay as they are. The sizes themselves are measured in a real browser by
// tools/gwh-hub-page-check.mjs (phone: one world card tall and the 2 columns wide; PC: half a card tall, the grid wide).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { BAD_WORDS } from '../../tools/gwh-stores.mjs';

const PUB = 'sites/gwh/public';
const read = rel => readFileSync(`${PUB}/${rel}`, 'utf8');
const html = read('index.html');
const css = read('hub-v2.css');
const STORES = [['amazon', 'Amazon'], ['joybuy', 'Joybuy'], ['tooled-up', 'Tooled Up'], ['my-tool-shed', 'My Tool Shed'], ['pchub-uk', 'PCHUB.UK'],
  ['gs-workwear', 'GS Workwear'], ['back-to-the-office', 'Back to the Office'], ['dhgate', 'DHgate']];
const LOGOS = { joybuy: 'joybuy.png', 'tooled-up': 'tooled-up.png', 'my-tool-shed': 'my-tool-shed.png', 'pchub-uk': 'pchub-uk.png', 'gs-workwear': 'gs-workwear.jpg', 'back-to-the-office': 'back-to-the-office.png' };
const start = html.indexOf('<div class="gwh2-mega-wrap">');
const bar = html.slice(start, html.indexOf('<section class="gwh2-top">'));

function hub() {
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(read('hub-v2.js'), { window, document: { readyState: 'loading', addEventListener() {} }, URL, URLSearchParams, Intl, console });
  return window.GearWorldHubV2;
}

test('L192: the bar is the first thing in <main>, above the search, and ONE plain link to megastoresgearworld.com', () => {
  assert.ok(start > 0, 'the bar is on the page');
  assert.ok(start > html.indexOf('</header>') && start < html.indexOf('<section class="gwh2-top">') && start < html.indexOf('id="hubSearch"'), 'under the header, above the search');
  assert.match(html, /<main>\s*<!-- Mega Stores[\s\S]*?-->\s*<div class="gwh2-mega-wrap">/, 'the first thing in <main>');
  const links = bar.match(/<a [^>]*>/g) || [];
  assert.deepEqual(links, ['<a class="gwh2-mega" href="https://megastoresgearworld.com/">'], 'one link, same tab, no rel sponsored');
  assert.equal((bar.match(/<\/a>/g) || []).length, 1);
  assert.ok(!/<(button|input|select|form)\b/.test(bar), 'nothing to press inside the link');
  assert.ok(!/rel="|target="|\/(out|go)\/|awin|amazon\.co|tag=/i.test(bar), 'not an affiliate link');
  assert.match(bar, /<strong class="gwh2-mega-title" translate="no">Mega Stores<\/strong>/);
  assert.match(bar, /<span class="gwh2-mega-line" data-gwh2="megaLine">Big stores in one place →<\/span>/);
});

test('L192: 8 store names in order, each with data-store, never translated; the copy and the strip are aria-hidden', () => {
  const strip = bar.slice(bar.indexOf('<span class="gwh2-mega-strip" aria-hidden="true">')).replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(strip.length > 0 && bar.includes('<span class="gwh2-mega-strip" aria-hidden="true">'), 'the moving strip is decorative');
  const lists = strip.split('<span class="gwh2-mega-list').slice(1);
  assert.equal(lists.length, 2, 'the list and its one copy (seamless loop)');
  assert.ok(lists[1].startsWith(' gwh2-mega-copy" aria-hidden="true">'), 'the copy is aria-hidden');
  for (const list of lists) {
    const pills = [...list.matchAll(/<span class="gwh2-mega-pill[^"]*" data-store="([a-z-]+)"[^>]*translate="no">([\s\S]*?)<\/span>\s*(?=<span class="gwh2-mega-pill|<\/span>)/g)];
    assert.deepEqual(pills.map(m => m[1]), STORES.map(s => s[0]), 'the 8 stores in the owner\'s order');
    pills.forEach((m, i) => {
      const [slug, name] = STORES[i];
      const inner = m[2];
      if (LOGOS[slug]) {
        assert.ok(inner.startsWith(`<img src="/mega/${LOGOS[slug]}" alt="${name}" `) && /loading="eager" decoding="async">/.test(inner), `${slug}: its own logo, alt = the store name`);
      } else {
        assert.equal(inner, name, `${slug}: a text pill`);
      }
    });
  }
  // The hidden sentence gives screen readers the names once, untranslated.
  const names = STORES.map(s => s[1]).join(', ');
  assert.ok(bar.includes(`<span class="sr-only" data-gwh2="megaNames" data-gwh2-name="${names}">Stores: <span translate="no">${names}</span>.</span>`));
  assert.equal((bar.match(/data-gwh2="megaNames"/g) || []).length, 1);
  assert.ok(bar.indexOf('data-gwh2="megaNames"') < bar.indexOf('gwh2-mega-strip'));
});

test('L192: Amazon stays text only (Amazon Associates Trademark Guidelines: a logo only next to an Amazon Special Link)', () => {
  const amazon = [...bar.matchAll(/<span class="gwh2-mega-pill[^"]*" data-store="amazon"[^>]*>([^<]*)<\/span>/g)];
  assert.equal(amazon.length, 2, 'both Amazon pills are plain text');
  for (const m of amazon) {
    assert.ok(m[0].includes('data-logo="text-only"') && !m[0].includes('gwh2-mega-logo'), 'marked text-only');
    assert.equal(m[1], 'Amazon');
  }
  assert.match(bar, /Amazon stays TEXT ONLY, always: the Amazon Associates Trademark Guidelines allow an Amazon logo only next to an\s+Amazon Special Link/);
  assert.ok(!/<img[^>]*(amazon)/i.test(bar) && !existsSync(`${PUB}/mega/amazon.png`) && !existsSync(`${PUB}/mega/amazon.svg`), 'no Amazon logo file or image');
  assert.equal((bar.match(/data-store="dhgate" data-logo="text-only"/g) || []).length, 2, 'DHgate is text too (no logo file)');
});

test('L192: the logos are the stores\' own files, unchanged, in the allowlist and described in the Hub tool', () => {
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split(/\r?\n/).map(s => s.trim());
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  for (const file of Object.values(LOGOS)) {
    const bytes = readFileSync(`${PUB}/mega/${file}`);
    assert.ok(bytes.length > 1000 && bytes.length < 20000, `${file}: a small logo (${bytes.length} bytes)`);
    if (file.endsWith('.png')) assert.equal(bytes.toString('latin1', 1, 4), 'PNG', file);
    else assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, file);
    assert.ok(allow.includes(`mega/${file}`), `allowlist: mega/${file} (L04)`);
    assert.ok(tool.includes(`'public/mega/${file}' = `), `the Hub tool describes public/mega/${file}`);
  }
  // Never stretched, recoloured or cropped: the height sets the size, the width follows, object-fit contain, no filter.
  assert.match(css, /\.gwh2-mega-logo img\{display:block;width:auto;height:100%;max-width:none;object-fit:contain;\}/);
  assert.ok(!/gwh2-mega[^{]*\{[^}]*(filter|mix-blend|object-fit:(cover|fill))/.test(css), 'no filter or crop on the logos');
  assert.match(css, /\.gwh2-mega-pill\{[^}]*background:#ffffff;color:#0b1626;/, 'white tiles, dark text');
});

test('L192: the strip moves with CSS only, by half its length (seamless), paused on hover and focus, still with reduce motion', () => {
  assert.match(css, /@keyframes gwh2Mega\{from\{transform:translateX\(0\);\}to\{transform:translateX\(-50%\);\}\}/);
  assert.match(css, /\.gwh2-mega-track\{display:flex;width:max-content;height:100%;animation:gwh2Mega 24s linear infinite;\}/);
  assert.equal((css.match(/infinite/g) || []).length, 1, 'the only endless animation of the Hub');
  assert.match(css, /\.gwh2-mega:hover \.gwh2-mega-track,\.gwh2-mega:focus \.gwh2-mega-track,\.gwh2-mega:focus-visible \.gwh2-mega-track,\.gwh2-mega:active \.gwh2-mega-track\{animation-play-state:paused;\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.gwh2-mega-track\{animation:none !important;transform:none;\}\.gwh2-mega-copy\{display:none;\}\}/);
  assert.match(css, /\.gwh2-mega-list\{[^}]*min-width:100cqw;/, 'each list at least as wide as the strip, so the loop never shows a gap');
  assert.match(css, /\.gwh2-mega-strip\{[^}]*overflow:hidden;container-type:inline-size;\}/);
  const js = read('hub-v2.js');
  assert.ok(!/gwh2-mega/.test(js.replace(/\/\/[^\n]*/g, '')) || !/setInterval|requestAnimationFrame/.test(js), 'no JavaScript moves it');
});

test('L192: the sizes in the CSS: phone one world card tall (72 px), from 621 px half a first-row card (126 px), PC 7 cards per row and half a card (145 px), grid width', () => {
  assert.match(css, /\.gwh-image-world,\.gwh2-stores-card\{display:flex;align-items:center;gap:8px;min-height:72px;/, 'a world card on the phone is 72 px');
  assert.match(css, /\.gwh2-mega\{display:flex;align-items:center;gap:10px;height:72px;/);
  assert.match(css, /@media \(min-width:621px\)\{[\s\S]*?\.gwh2-mega\{height:126px;[\s\S]*?\n\}/);
  assert.match(css, /\.gwh2-world-img\{width:100%;height:120px;border-radius:0;\}/, 'the PC card picture the 126 px were measured with');
  // The PC (owner, 18/11/2026): 7 cards per row, every card 290 px, the bar 145 px (half a card), two rows of 7.
  assert.match(css, /@media \(min-width:980px\)\{[\s\S]*?\.gwh-quick-worlds\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\);grid-auto-rows:290px;gap:12px;\}[\s\S]*?\.gwh2-mega\{height:145px;\}/);
  assert.match(css, /\.gwh-image-world-description,\.gwh2-rc-desc\{display:-webkit-box;-webkit-line-clamp:3;/, 'a long description never makes one card taller');
  assert.equal((html.match(/class="gwh-quick-world gwh-image-world"/g) || []).length + (html.match(/class="gwh-quick-world gwh2-stores-card"/g) || []).length, 14, '13 worlds and the Stores card: two rows of 7');
  // The bar sits in a .container like the grid of the cards: the same width.
  assert.match(bar, /<div class="gwh2-mega-wrap">\s*<div class="container">\s*<a class="gwh2-mega"/);
  // Colours: the Hub's own, no red or green (L35).
  const block = css.slice(css.indexOf('/* ---------- Mega Stores bar'), css.indexOf('/* ---------- top: search and campaigns'));
  for (const c of block.match(/#[0-9a-f]{6}\b/gi) || []) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    assert.ok(!(r > 150 && g < 90 && b < 90) && !(g > 150 && r < 110 && b < 110), c);
  }
});

test('L192: the texts in the 11 languages, translated, without shop, partner, deal, sale, saving or percentage words', () => {
  const h = hub();
  for (const key of ['megaLine', 'megaNames']) {
    const list = h.strings[key];
    assert.equal(list.length, 11, key);
    assert.equal(new Set(list).size, 11, `${key}: translated in every language`);
    for (const t of list) {
      assert.ok(!BAD_WORDS.test(t), `${key}: ${t}`);
      assert.ok(!/official|partner|shop|\bdeals?\b|\bsale\b|\bsave\b|%|lowest price/i.test(t), `${key}: ${t}`);
      assert.ok(!/Amazon|Joybuy|DHgate|Mega Stores/.test(t), `${key}: no store name inside a translated text`);
    }
  }
  assert.ok(h.strings.megaLine.every(t => t.endsWith(' →')));
  assert.ok(h.strings.megaNames.every(t => t.includes('{name}')), 'the names go in their own translate="no"');
  assert.equal(h.strings.megaLine[0], 'Big stores in one place →');
  const text = bar.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!BAD_WORDS.test(text) && !/official|partner|\bdeals?\b|\bsale\b|\bsave\b|lowest price/i.test(text), text.match(BAD_WORDS));
});

test('L192: the Stores card and the 13 world cards are unchanged, and the new ?v= of hub-v2.css and hub-v2.js (L31)', () => {
  assert.equal((html.match(/class="gwh-quick-world gwh-image-world"/g) || []).length, 13);
  assert.deepEqual([...html.matchAll(/data-world="([A-Z]{3})"/g)].map(m => m[1]), ['CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'TGW', 'AGW', 'VGW', 'SGW', 'BGW', 'PGW', 'ZGW']);
  assert.ok(html.includes('<a class="gwh-quick-world gwh2-stores-card" href="/stores/" data-world="STORES">'));
  assert.ok(html.includes('<small class="gwh2-rc-desc" data-gwh2="storesDesc" translate="no">Joybuy, Tooled Up, PCHUB.UK and more: codes, sales and where to find them.</small>'));
  assert.ok(!/gwh-quick-world|gwh-image-world|data-world=/.test(bar), 'the bar has its own classes: translations.js counts the world cards by class');
  assert.match(html, /<link rel="stylesheet" href="\/hub-v2\.css\?v=(20261123-mega1|20261123-app1)">/); // L218: a later version (the Google Play row)
  assert.match(html, /<script src="\/hub-v2\.js\?v=(20261123-mega1|20261123-app1)" defer><\/script>/);
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  assert.ok(tool.includes('Μπάρα Mega Stores στην κορυφή (L192)'), 'the preview and live page check');
  assert.match(readFileSync('docs/LESSONS.md', 'utf8'), /\n\| L192 \|/);
});
