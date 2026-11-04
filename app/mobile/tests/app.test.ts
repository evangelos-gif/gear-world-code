// Plain Node tests (no React): language choice, texts in all 11 languages, Hub/site API parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOCALES, pickLocale, fill, lookup } from '../src/i18n/core.ts';
import { APP_STRINGS, APP_KEYS } from '../src/i18n/app-strings.ts';
import { parseRegistry, parseSearch, parseSiteProduct, worldProductsUrl, safeBase, safeHttps, outUrl, isValidEmail, FALLBACK_WORLDS } from '../src/lib/api.ts';
import { formatPrice } from '../src/lib/format.ts';
import {
  parsePhotoAnswer, photoErrorMessage, shrinkSize, base64ToBytes, isJpeg, searchPlan, isBrand, mergeResults, photoResults,
  orderByBest, countByWorld, photoWords, encodePhotoParam, decodePhotoParam, PHOTO_MAX_BYTES
} from '../src/lib/photo.ts';
import {
  ukDay, blackFridayDay, heroSlides, countdownParts, seasonFor, parseDeals, activeDeals, campaignLabel, CAMPAIGNS, FALLBACK_CAMPAIGN, seasonsOf
} from '../src/lib/seasons.ts';
import { apiSlug, categoriesFor } from '../src/lib/site-categories.ts';

const HUB = JSON.parse(readFileSync(new URL('../src/i18n/hub-strings.json', import.meta.url), 'utf8'));
// The world order the Hub uses for its titles and descriptions (src/lib/worlds-meta.ts, read as text).
const HUB_ORDER: string[] = JSON.parse(
  /HUB_ORDER = (\[[^\]]*\])/.exec(readFileSync(new URL('../src/lib/worlds-meta.ts', import.meta.url), 'utf8'))![1].replace(/'/g, '"')
);

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
    assert.equal(h.worldTitles.length, HUB_ORDER.length);
    assert.equal(h.worldDescriptions.length, HUB_ORDER.length);
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
  assert.equal(FALLBACK_WORLDS.length, HUB_ORDER.length);
  assert.deepEqual(FALLBACK_WORLDS.map(w => w.key), HUB_ORDER);
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
  // The photo library and camera reasons now come from the image picker (photo search); no hand-written one is left.
  assert.equal(app.ios.infoPlist.NSPhotoLibraryUsageDescription, undefined);
  assert.deepEqual([...app.android.blockedPermissions].sort(), [
    'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.WRITE_EXTERNAL_STORAGE',
    'com.google.android.gms.permission.AD_ID'
  ].sort(), 'storage, overlay and advertising ID permissions are removed: the app does not need them');
});

test('photo: the camera and gallery are asked for with a clear reason, and the microphone keeps working', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const picker = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-image-picker');
  assert.ok(picker, 'image picker configured');
  assert.match(picker[1].cameraPermission, /camera button/);
  assert.match(picker[1].cameraPermission, /not saved/);
  assert.match(picker[1].photosPermission, /not saved/);
  // `false` would block RECORD_AUDIO on Android and break voice search; it must be the same text as the speech plugin.
  const speech = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-speech-recognition');
  assert.equal(picker[1].microphonePermission, speech[1].microphonePermission);
});

test('screens: Android draws no grey band over the bottom of the app', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const nav = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-navigation-bar');
  assert.ok(nav, 'navigation bar plugin configured');
  assert.equal(nav[1].enforceContrast, false);
  for (const f of ['index.tsx', 'search.tsx', 'settings.tsx', 'world/[key].tsx']) {
    const src = readFileSync(new URL(`../src/app/${f}`, import.meta.url), 'utf8');
    assert.match(src, /useSafeAreaInsets\(\)\.bottom/, `${f} ends its list above the phone's buttons`);
  }
});

test('photo: the Hub answer is checked, and every failure has its own message', () => {
  const a = parsePhotoAnswer({ ok: true, found: true, product: 'cordless drill', query: 'Bosch cordless drill', keywords: ['drill', 'cordless', 'green'], brand: 'Bosch', world: { key: 'cgw', name: 'Construction Gear World', domain: 'constructiongearworld.com' } });
  assert.deepEqual(a, { product: 'cordless drill', query: 'Bosch cordless drill', keywords: ['drill', 'cordless', 'green'], brand: 'Bosch', world: { key: 'CGW', name: 'Construction Gear World' } });
  assert.equal(parsePhotoAnswer({ ok: true, found: false, query: '' }), null);
  assert.equal(parsePhotoAnswer({ ok: true, found: true, query: 'x' }), null, 'a query needs 2 characters');
  assert.equal(parsePhotoAnswer(null), null);
  assert.equal(parsePhotoAnswer({ ok: true, found: true, query: 'lamp', world: { key: '<script>' } })!.world, null);
  assert.equal(photoErrorMessage(429, { error: 'limit_day' }), 'photoLimitDay');
  assert.equal(photoErrorMessage(429, { error: 'limit_hour' }), 'photoLimitHour');
  assert.equal(photoErrorMessage(413, null), 'photoTooBig');
  assert.equal(photoErrorMessage(415, null), 'photoNotPhoto');
  assert.equal(photoErrorMessage(400, null), 'photoNotPhoto');
  assert.equal(photoErrorMessage(200, { ok: true, found: false }), 'photoNoProduct');
  assert.equal(photoErrorMessage(503, { error: 'busy' }), 'photoUnavailable');
  assert.equal(photoErrorMessage(403, { error: 'origin' }), 'photoUnavailable');
  for (const k of ['photoStart', 'photoNote', 'photoTake', 'photoPick', 'photoCancel', 'photoLooking', 'photoFound', 'photoBrand',
    'photoBestMatch', 'photoEditHint', 'photoNoProduct', 'photoLimitHour', 'photoLimitDay', 'photoTooBig', 'photoNotPhoto',
    'photoUnavailable', 'photoDenied', 'photoBlocked']) {
    assert.ok(APP_KEYS.includes(k as never), `${k} is an app text`);
  }
  for (const l of LOCALES) {
    for (const k of ['photoFound', 'photoBrand', 'photoBestMatch']) {
      assert.deepEqual(APP_STRINGS[l.code][k].match(/\{\w+\}/g), APP_STRINGS['en-GB'][k].match(/\{\w+\}/g), `${l.code}.${k} keeps its placeholder`);
    }
  }
});

test('photo: the photo is made small, and only a real JPEG is sent', () => {
  assert.deepEqual(shrinkSize(4000, 3000), { width: 1024 });
  assert.deepEqual(shrinkSize(3000, 4000), { height: 1024 });
  assert.equal(shrinkSize(800, 600), null);
  assert.deepEqual(shrinkSize(0, 0), { width: 1024 });
  assert.deepEqual(shrinkSize(2000, 1000, 800), { width: 800 });
  const bytes = base64ToBytes('/9j/4AAQSkZJRgABAQ==');
  assert.deepEqual([...bytes.slice(0, 4)], [0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(bytes.length, 13);
  assert.ok(isJpeg(bytes));
  assert.equal(base64ToBytes('data:image/jpeg;base64,/9j/').length, 3);
  assert.ok(!isJpeg(base64ToBytes('iVBORw0KGgo=')), 'a PNG is not sent as a JPEG');
  assert.equal(PHOTO_MAX_BYTES, 1024 * 1024);
});

const item = (world: string, id: number, brand = '', name = 'thing') => ({ key: `${world}:${id}`, worldKey: world, brand, name });

test('photo: brand first, then similar products, like the Hub camera', async () => {
  const answer = { product: 'cordless drill', query: 'Bosch cordless drill', keywords: [], brand: 'Bosch', world: null };
  assert.deepEqual(searchPlan(answer).map(p => p.q), ['Bosch cordless drill', 'cordless drill']);
  assert.deepEqual(searchPlan({ ...answer, query: 'cordless drill' }).map(p => p.q), ['Bosch cordless drill', 'cordless drill']);
  assert.deepEqual(searchPlan({ ...answer, brand: '', query: 'desk lamp', product: 'lamp' }).map(p => p.q), ['desk lamp', 'lamp']);
  assert.ok(isBrand(item('CGW', 1, 'Bosch Professional'), 'Bosch'));
  assert.ok(isBrand(item('CGW', 2, '', 'Bosch GSR 18V drill'), 'Bosch'));
  assert.ok(!isBrand(item('CGW', 3, 'Makita', 'drill'), 'Bosch'));

  const asked: string[] = [];
  const fewBrand = await photoResults(answer, async q => {
    asked.push(q);
    return q.startsWith('Bosch') ? [item('CGW', 1, 'Bosch'), item('CGW', 9, 'Makita')] : [item('CGW', 2, 'Makita'), item('HGW', 3)];
  });
  assert.deepEqual(asked.sort(), ['Bosch cordless drill', 'cordless drill'], 'both searched at once');
  assert.deepEqual(fewBrand!.products.map(p => p.key), ['CGW:1', 'CGW:2', 'HGW:3'], 'one Bosch product, then the similar ones');
  assert.equal(fewBrand!.query, 'Bosch cordless drill');

  const manyBrand = await photoResults(answer, async q =>
    q.startsWith('Bosch') ? [1, 2, 3, 4].map(i => item('CGW', i, 'Bosch')) : [item('HGW', 9)]);
  assert.deepEqual(manyBrand!.products.map(p => p.key), ['CGW:1', 'CGW:2', 'CGW:3', 'CGW:4'], 'enough of the brand: only those');

  const noBrand = await photoResults(answer, async q => (q.startsWith('Bosch') ? [] : [item('CGW', 5, 'Makita')]));
  assert.deepEqual(noBrand!.products.map(p => p.key), ['CGW:5']);
  assert.equal(noBrand!.query, 'cordless drill');

  const failed = await photoResults(answer, async () => null);
  assert.equal(failed, null, 'every search failed: the screen shows the load error');

  const typeOnly = await photoResults({ ...answer, brand: '', query: 'blue desk lamp', product: 'lamp' }, async q => (q === 'lamp' ? [item('HGW', 7)] : []));
  assert.deepEqual(typeOnly!.products.map(p => p.key), ['HGW:7']);
  assert.equal(typeOnly!.query, 'lamp');

  const capped = mergeResults(Array.from({ length: 12 }, (_, i) => item('CGW', i)), []);
  assert.equal(capped.length, 8, 'at most 8 per Gear World');
});

test('photo: best Gear World first, words shown, and the screen address is checked', () => {
  const list = [item('HGW', 1), item('CGW', 2), item('HGW', 3), item('KGW', 4), item('CGW', 5), item('HGW', 6)];
  assert.deepEqual(orderByBest(list, 'cgw').map(p => p.key), ['CGW:2', 'CGW:5', 'HGW:1', 'HGW:3', 'HGW:6', 'KGW:4']);
  assert.deepEqual(orderByBest(list, null).map(p => p.worldKey), ['HGW', 'HGW', 'HGW', 'CGW', 'CGW', 'KGW']);
  assert.deepEqual(Object.keys(countByWorld(orderByBest(list, 'KGW'))), ['KGW', 'HGW', 'CGW']);
  const answer = { product: 'cordless drill', query: 'Bosch cordless drill', keywords: ['drill', 'battery', 'green'], brand: 'Bosch', world: { key: 'CGW', name: 'Construction Gear World' } };
  assert.equal(photoWords(answer, answer.query), 'cordless drill · battery · green');
  assert.equal(photoWords({ ...answer, product: '', keywords: [] }, 'lamp'), 'lamp');
  assert.deepEqual(decodePhotoParam(encodePhotoParam(answer)), answer);
  assert.equal(decodePhotoParam(''), null);
  assert.equal(decodePhotoParam('{not json'), null);
  assert.equal(decodePhotoParam(undefined), null);
});


const SEASON = JSON.parse(readFileSync(new URL('../src/i18n/season-strings.json', import.meta.url), 'utf8'));

test('seasons: UK days, Black Friday and the slides of each period, like the Hub', () => {
  assert.equal(ukDay(Date.parse('2026-11-04T23:30:00Z')), '2026-11-04', 'November is GMT');
  assert.equal(ukDay(Date.parse('2026-07-01T23:30:00Z')), '2026-07-02', 'summer is BST (+1 h)');
  assert.equal(ukDay(Date.parse('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(ukDay(Date.parse('2026-03-29T23:30:00Z')), '2026-03-30', 'BST starts on the last Sunday of March');
  assert.equal(blackFridayDay(2026), 27);
  assert.equal(blackFridayDay(2027), 26);
  const ids = (iso: string) => heroSlides(Date.parse(iso)).map(x => x.id);
  assert.deepEqual(ids('2026-11-04T12:00:00Z'), ['season-christmas']);
  assert.deepEqual(ids('2026-11-15T12:00:00Z'), ['season-christmas', 'black-friday-soon'], 'from 13/11 the Black Friday countdown slide, no offers promised');
  assert.deepEqual(ids('2026-11-28T12:00:00Z'), ['season-black-friday', 'christmas']);
  assert.deepEqual(ids('2026-12-27T12:00:00Z'), ['winter-sales']);
  assert.deepEqual(ids('2027-03-10T12:00:00Z'), ['all-worlds'], 'outside every season: the "13 Gear Worlds" slide');
  const bf = seasonFor('2026-11-28')!;
  assert.deepEqual(countdownParts(bf, Date.parse('2026-11-28T00:00:00Z')), { d: 2, h: 23, m: 59 });
  assert.equal(countdownParts(bf, Date.parse('2026-12-01T00:00:00Z')), null, 'no countdown once it is over');
  assert.equal(countdownParts(seasonFor('2026-11-04')!, Date.now()), null, 'Christmas has no countdown');
  const xmas = seasonFor('2026-11-04')!;
  assert.equal(xmas.title, 'xmasTitle', 'the Christmas picture promises no offers (none from the retailers yet)');
  assert.ok(!/offer/i.test(SEASON['en-GB'][xmas.title]));
});

test('seasons: every campaign text exists in all 11 languages, with the same placeholders', () => {
  const keys = new Set<string>();
  for (const c of [...CAMPAIGNS, FALLBACK_CAMPAIGN]) [c.eyebrow, c.title, c.text, c.cta].forEach(k => keys.add(k));
  for (const s2 of seasonsOf(2026)) [s2.name, s2.title].forEach(k => keys.add(k));
  for (const k of ['countdown', 'countdownHours', 'bfCta', 'soonCta', 'allCta', 'prev', 'next', 'slideAria', 'seasonAria', 'navDeals',
    'dealsTitle', 'dealsSub', 'dealCode', 'dealCodeNoMin', 'dealUpTo', 'dealWithCode', 'dealSale', 'dealUntil', 'dealCta']) keys.add(k);
  for (const l of LOCALES) {
    for (const k of keys) {
      const v = SEASON[l.code]?.[k];
      assert.ok(typeof v === 'string' && v.trim(), `${l.code}.${k}`);
      assert.deepEqual((v.match(/\{\w+\}/g) ?? []).sort(), (SEASON['en-GB'][k].match(/\{\w+\}/g) ?? []).sort(), `${l.code}.${k} placeholders`);
    }
  }
  for (const c of CAMPAIGNS) assert.ok(!/gift/i.test(SEASON['en-GB'][c.cta]), `${c.id}: no gift-finder button (the app has none yet)`);
});

test('deals: only checked site links, only running deals, codes first, old season names hidden', () => {
  const raw = { deals: [
    { id: 'a', retailer: 'Joybuy', kind: 'code', campaign: 'Halloween', currency: 'GBP', sites: ['TGW', 'mgw', 'x'], start: '2026-10-20', end: '2026-12-31', link: 'https://technologygearworld.com/discount-codes/joybuy/', off: 5, minSpend: 30 },
    { id: 'b', retailer: 'Joybuy', kind: 'code', campaign: '', currency: 'GBP', sites: ['TGW'], start: '2026-10-20', end: '2026-12-31', link: 'https://technologygearworld.com/discount-codes/joybuy/', off: 4, minSpend: 20 },
    { id: 'c', retailer: 'SGS', kind: 'sale', campaign: 'Black Friday', currency: 'GBP', sites: ['CGW'], start: '2026-11-02', end: '2026-11-30', link: 'https://constructiongearworld.com/discount-codes/sgs/', upTo: 25 },
    { id: 'd', retailer: 'Old', kind: 'code', start: '2026-09-01', end: '2026-10-01', link: 'https://cgw.example.com/discount-codes/old/', off: 3 },
    { id: 'e', retailer: 'Bad', kind: 'code', start: '2026-10-01', end: '2026-12-31', link: 'https://constructiongearworld.com/go/123', off: 3 },
    { id: 'f', retailer: 'Zero', kind: 'sale', start: '2026-10-01', end: '2026-12-31', link: 'https://constructiongearworld.com/discount-codes/zero/', upTo: 0 }
  ] };
  const deals = parseDeals(raw);
  assert.deepEqual(deals.map(d => d.id), ['a', 'b', 'c', 'd', 'f'], 'a /go/ link is never taken');
  assert.deepEqual(deals[0].sites, ['TGW', 'MGW']);
  assert.deepEqual(activeDeals(deals, '2026-11-04').map(d => d.id), ['b', 'a', 'c'], 'codes by smaller minimum spend, then sales; old and empty deals out');
  assert.equal(campaignLabel(deals[0], '2026-11-04'), '', 'Halloween is over: the name is not shown, the code still runs');
  assert.equal(campaignLabel(deals[2], '2026-11-04'), 'Black Friday');
  assert.deepEqual(parseDeals(null), []);
  assert.deepEqual(parseDeals({ deals: 'x' }), []);
});


test('categories: every world has categories the site understands', () => {
  const none = (key: string) => ({ key, categories: [] as { key: string; name: string; slug: string }[] });
  for (const key of ['TGW', 'AGW', 'VGW', 'SGW', 'BGW', 'PGW', 'ZGW']) {
    const list = categoriesFor(none(key));
    assert.ok(list.length >= 5, `${key} has its own categories while the Hub gives none`);
    for (const c of list) assert.match(c.slug, /^[a-z0-9-]+$/);
  }
  // The Hub's own list wins when it has one.
  assert.deepEqual(categoriesFor({ key: 'TGW', categories: [{ key: 'x', name: 'X', slug: 'x' }] }).map(c => c.slug), ['x']);
  // Older sites: the four names their product API does not know are corrected, the unfilterable gifts are left out.
  assert.equal(apiSlug('CGW', 'safety-boots'), 'safety-footwear');
  assert.equal(apiSlug('MGW', 'mens-jewellery'), 'jewellery');
  assert.equal(apiSlug('WGW', 'everyday-carry-edc'), 'everyday-essentials');
  assert.equal(apiSlug('MGW', 'gifts-for-men'), null);
  assert.equal(apiSlug('HGW', 'lighting'), 'lighting');
  const mgw = categoriesFor({ key: 'MGW', categories: [{ key: 'g', name: 'Gifts', slug: 'gifts-for-men' }, { key: 'j', name: 'Jewellery', slug: 'mens-jewellery' }] });
  assert.deepEqual(mgw.map(c => c.slug), ['jewellery']);
});
