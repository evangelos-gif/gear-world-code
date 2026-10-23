// Plain Node tests (no React): language choice, texts in all 11 languages, Hub/site API parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOCALES, pickLocale, fill, lookup } from '../src/i18n/core.ts';
import { APP_STRINGS, APP_KEYS } from '../src/i18n/app-strings.ts';
import { parseRegistry, parseSearch, parseSiteProduct, worldProductsUrl, safeBase, safeHttps, outUrl, isValidEmail, FALLBACK_WORLDS } from '../src/lib/api.ts';
import { formatPrice } from '../src/lib/format.ts';

const HUB = JSON.parse(readFileSync(new URL('../src/i18n/hub-strings.json', import.meta.url), 'utf8'));

test('language: phone language picks the right one, unknown falls back to English', () => {
  assert.equal(pickLocale(['el-GR']), 'el-GR');
  assert.equal(pickLocale(['el-CY']), 'el-GR');
  assert.equal(pickLocale(['de-AT', 'en-US']), 'de-DE');
  assert.equal(pickLocale(['ja-JP', 'pt-BR']), 'pt-PT');
  assert.equal(pickLocale(['ja-JP']), 'en-GB');
  assert.equal(pickLocale([null, undefined]), 'en-GB');
});

test('texts: every app text exists and is filled in all 11 languages', () => {
  for (const l of LOCALES) {
    const dict = APP_STRINGS[l.code];
    assert.ok(dict, l.code);
    for (const k of APP_KEYS) assert.ok(typeof dict[k] === 'string' && dict[k].trim().length > 0, `${l.code}.${k}`);
    for (const k of ['viewAt', 'moreOnSite', 'searchIn', 'visitSite', 'version', 'worldProducts', 'aboutText']) {
      const en = APP_STRINGS['en-GB'][k].match(/\{\w+\}/g);
      assert.deepEqual(dict[k].match(/\{\w+\}/g), en, `${l.code}.${k} keeps its placeholders`);
    }
  }
});

test('texts: Hub texts (worlds, steps, newsletter) exist in all 11 languages', () => {
  for (const l of LOCALES) {
    const h = HUB[l.code];
    assert.ok(h, l.code);
    assert.equal(h.worldTitles.length, 8);
    assert.equal(h.worldDescriptions.length, 8);
    assert.equal(h.steps.length, 3);
    for (const k of ['searchPlaceholder', 'searchButton', 'disclosure', 'nl_consent', 'nl_button', 'productsFound', 'noProductsFor']) assert.ok(h[k], `${l.code}.${k}`);
  }
  assert.equal(fill(HUB['en-GB'].noProductsFor, { query: 'x' }), 'No products found for "x".');
  assert.equal(lookup({ 'en-GB': { a: 'A' }, 'el-GR': {} }, 'el-GR', 'a'), 'A');
});

test('registry: worlds come from the Hub; bad rows are skipped', () => {
  const w = parseRegistry({ ok: true, sites: [
    { site_key: 'cgw', site_name: 'Construction Gear World', domain: 'constructiongearworld.com', categories: [{ category_key: 'pt', category_name: 'Power Tools', slug: 'power-tools' }, { category_key: 'x', category_name: 'Bad', slug: 'bad slug!' }] },
    { site_key: 'VGW', site_name: 'Travel Gear World', domain: 'travelgearworld.com' },
    { site_key: 'EVIL', site_name: 'x', domain: 'javascript:alert(1)' }
  ] });
  assert.deepEqual(w.map(x => x.key), ['CGW', 'VGW']);
  assert.equal(w[0].base, 'https://constructiongearworld.com');
  assert.deepEqual(w[0].categories.map(c => c.slug), ['power-tools']);
  assert.throws(() => parseRegistry({ ok: false }));
  assert.equal(FALLBACK_WORLDS.length, 8);
});

test('search: Hub results become products with an /out/ link on the same site', () => {
  const r = parseSearch({ ok: true, partial: true, sites: { cgw: 1, tgw: 0 }, results: [
    { id: 111401, site: 'cgw', site_name: 'Construction Gear World', site_url: 'https://constructiongearworld.com', product_name: 'Drill', brand: 'Dormer', retailer: 'GS Workwear', category: 'Power Tools', price: 75.99, currency: 'GBP', stock_status: 'in_stock', image_url: 'https://cdn.example.com/a.jpg', product_url: 'https://constructiongearworld.com/?search=drill&highlight=111401' },
    { id: 1, site: 'x', site_url: 'http://insecure.example.com', product_name: 'bad' }
  ] });
  assert.equal(r.products.length, 1);
  const p = r.products[0];
  assert.equal(p.key, 'CGW:111401');
  assert.equal(p.outUrl, 'https://constructiongearworld.com/out/111401');
  assert.equal(p.inStock, true);
  assert.equal(p.price, 75.99);
  assert.deepEqual(r.counts, { CGW: 1 });
  assert.equal(r.partial, true);
});

test('world: site products and request URL', () => {
  const world = { key: 'TGW', name: 'Technology Gear World', base: 'https://technologygearworld.com' };
  const p = parseSiteProduct({ id: 1695, product_name: 'Mic', price: 35.9, was_price: 40, currency: 'GBP', stock_status: 'out_of_stock', image_url: 'javascript:x', product_url: 'https://technologygearworld.com/product/mic-1695/' }, world);
  assert.ok(p);
  assert.equal(p.inStock, false);
  assert.equal(p.image, '', 'only https images');
  assert.equal(p.wasPrice, 40);
  assert.equal(worldProductsUrl(world, { search: ' usb c ', category: 'audio', sort: 'price-asc', page: 2, limit: 500 }),
    'https://technologygearworld.com/api/products?search=usb%20c&category=audio&sort=price-asc&page=2&limit=60');
  assert.equal(worldProductsUrl(world, {}), 'https://technologygearworld.com/api/products?page=1&limit=24');
});

test('safety helpers', () => {
  assert.equal(safeBase('Example.com'), 'https://example.com');
  assert.equal(safeBase('https://a.b/'), 'https://a.b');
  assert.equal(safeBase('localhost'), null);
  assert.equal(safeHttps('http://x.com'), null);
  assert.equal(safeHttps('https://x.com/a?b=1'), 'https://x.com/a?b=1');
  assert.equal(outUrl('https://a.com', '12/3'), 'https://a.com/out/12%2F3');
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('nope'), false);
  assert.equal(formatPrice(75.99, 'GBP', 'en-GB'), '£75.99');
  assert.equal(formatPrice(null, 'GBP', 'en-GB'), '');
});

test('voice: what was heard becomes a clean search, errors become a clear message', async () => {
  const { cleanTranscript, transcriptOf, voiceErrorMessage, voiceOptions } = await import('../src/lib/voice.ts');
  assert.equal(cleanTranscript('  cordless   drill. '), 'cordless drill');
  assert.equal(cleanTranscript('δράπανο μπαταρίας…'), 'δράπανο μπαταρίας');
  assert.equal(cleanTranscript(null), '');
  assert.equal(cleanTranscript('x'.repeat(200)).length, 80);
  assert.deepEqual(transcriptOf({ isFinal: true, results: [{ transcript: 'Running shoes.' }] }), { text: 'Running shoes', isFinal: true });
  assert.deepEqual(transcriptOf({ results: 'bad' }), { text: '', isFinal: false });
  assert.deepEqual(transcriptOf(null), { text: '', isFinal: false });
  assert.equal(voiceErrorMessage('aborted'), null);
  assert.equal(voiceErrorMessage('not-allowed'), 'voiceDenied');
  assert.equal(voiceErrorMessage('no-speech'), 'voiceNoSpeech');
  assert.equal(voiceErrorMessage('language-not-supported'), 'voiceLanguage');
  assert.equal(voiceErrorMessage('network'), 'voiceFailed');
  assert.equal(voiceErrorMessage(undefined), 'voiceFailed');
  const o = voiceOptions('el-GR');
  assert.equal(o.lang, 'el-GR');
  assert.equal(o.continuous, false);
  assert.equal(o.interimResults, true);
  for (const k of ['voiceDenied', 'voiceBlocked', 'voiceNoSpeech', 'voiceLanguage', 'voiceUnavailable', 'voiceFailed']) {
    assert.ok(APP_KEYS.includes(k as never), `${k} is an app text`);
  }
  for (const l of LOCALES) assert.ok(!/keyboard|πληκτρολόγιο|Tastatur|clavier|tastiera|teclado|toetsenbord|tastierë|tastatură|клавиатур/i.test(APP_STRINGS[l.code].voiceTip), `${l.code}.voiceTip points to the app's own microphone`);
});

test('voice: the app asks for the microphone with a clear reason, and nothing else', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const plugin = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-speech-recognition');
  assert.ok(plugin, 'speech plugin configured');
  assert.match(plugin[1].microphonePermission, /microphone button/);
  assert.match(plugin[1].speechRecognitionPermission, /does not keep any recordings/);
  assert.equal(app.android.permissions, undefined, 'no extra Android permissions listed by hand');
  // Apple rejects a build when a library references the photo library without a purpose string (ITMS-90683).
  assert.match(app.ios.infoPlist.NSPhotoLibraryUsageDescription, /does not use your photos/);
  assert.deepEqual([...app.android.blockedPermissions].sort(), [
    'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.WRITE_EXTERNAL_STORAGE'
  ], 'storage and overlay permissions are removed: the app does not need them');
});
