// Plain Node tests (no React): language choice, texts in all 11 languages, Hub/site API parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOCALES, pickLocale, fill, lookup } from '../src/i18n/core.ts';
import { APP_STRINGS, APP_KEYS } from '../src/i18n/app-strings.ts';
import {
  parseRegistry, parseSearch, parseSiteProduct, parseHubResult, worldProductsUrl, safeBase, safeHttps, outUrl, isValidEmail, FALLBACK_WORLDS,
  checkedDay, productsByIdUrl, pickAsked
} from '../src/lib/api.ts';
import { FEATURE_KEYS, FEATURE_STRINGS } from '../src/i18n/feature-strings.ts';
import { toSaved, addSaved, removeSaved, mergeFresh, idsByWorld, parseSaved, imageFileName, MAX_SAVED } from '../src/lib/saved.ts';
import { formatPrice } from '../src/lib/format.ts';
import {
  parsePhotoAnswer, photoErrorMessage, shrinkSize, base64ToBytes, isJpeg, searchPlan, isBrand, mergeResults, photoResults,
  orderByBest, countByWorld, photoWords, encodePhotoParam, decodePhotoParam, PHOTO_MAX_BYTES
} from '../src/lib/photo.ts';
import {
  ukDay, blackFridayDay, heroSlides, countdownParts, seasonFor, parseDeals, activeDeals, campaignLabel, CAMPAIGNS, FALLBACK_CAMPAIGN, seasonsOf,
  SEASONS_ON_DEFAULT, parseSeasonsOn, seasonOn
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
    for (const k of ['viewAt', 'moreOnSite', 'searchIn', 'visitSite', 'version', 'worldProducts', 'aboutText', 'runBy']) {
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
  // Screens opened over the tabs end their list above the phone's buttons themselves.
  for (const f of ['search.tsx', 'world/[key].tsx']) {
    const src = readFileSync(new URL(`../src/app/${f}`, import.meta.url), 'utf8');
    assert.match(src, /useSafeAreaInsets\(\)\.bottom/, `${f} ends its list above the phone's buttons`);
  }
  // The tab screens sit above the tab bar, which keeps clear of the phone's buttons on its own (version 1.0.1).
  const tabs = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /from 'expo-router\/js-tabs'/);
  for (const name of ['index', 'saved', 'settings']) {
    assert.match(tabs, new RegExp(`Tabs\\.Screen name="${name}"`), `tab ${name}`);
    readFileSync(new URL(`../src/app/(tabs)/${name}.tsx`, import.meta.url), 'utf8');
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
  // With every season switched on, the dates say when each one may show (the same windows as the Hub).
  const ALL_ON = Object.fromEntries(Object.keys(SEASONS_ON_DEFAULT).map(k => [k, true]));
  const ids = (iso: string) => heroSlides(Date.parse(iso), ALL_ON).map(x => x.id);
  assert.deepEqual(ids('2026-11-04T12:00:00Z'), ['season-christmas']);
  assert.deepEqual(ids('2026-11-15T12:00:00Z'), ['season-christmas', 'black-friday-soon'], 'from 13/11 the Black Friday countdown slide, no offers promised');
  assert.deepEqual(ids('2026-11-28T12:00:00Z'), ['season-black-friday', 'christmas']);
  assert.deepEqual(ids('2026-12-27T12:00:00Z'), ['winter-sales']);
  assert.deepEqual(ids('2027-03-10T12:00:00Z'), ['all-worlds'], 'outside every season: the "13 Gear Worlds" slide');
  // The campaigns repeat every year: no new app version is needed for them (owner, 8/11/2026).
  assert.deepEqual(ids('2027-01-10T12:00:00Z'), ['winter-sales', 'new-year-fitness'], 'sales over New Year, then the January slide');
  assert.deepEqual(ids('2027-02-10T12:00:00Z'), ['valentines-day']);
  assert.deepEqual(ids('2027-10-25T12:00:00Z'), ['season-halloween']);
  assert.deepEqual(ids('2027-11-13T12:00:00Z'), ['season-christmas', 'black-friday-soon'], 'Black Friday 2027 is 26/11, so its countdown starts on 12/11');
  assert.deepEqual(ids('2027-11-27T12:00:00Z'), ['season-black-friday', 'christmas']);
  assert.deepEqual(ids('2028-01-10T12:00:00Z'), ['winter-sales', 'new-year-fitness']);
  assert.deepEqual(ids('2030-12-27T12:00:00Z'), ['winter-sales']);
  const bf = seasonFor('2026-11-28')!;
  assert.deepEqual(countdownParts(bf, Date.parse('2026-11-28T00:00:00Z')), { d: 2, h: 23, m: 59 });
  assert.equal(countdownParts(bf, Date.parse('2026-12-01T00:00:00Z')), null, 'no countdown once it is over');
  assert.equal(countdownParts(seasonFor('2026-11-04')!, Date.now()), null, 'Christmas has no countdown');
  const xmas = seasonFor('2026-11-04')!;
  assert.equal(xmas.title, 'xmasTitle', 'the Christmas picture promises no offers (none from the retailers yet)');
  assert.ok(!/offer/i.test(SEASON['en-GB'][xmas.title]));
});

test('seasons: nothing switches on by its dates alone, like the Hub (lessons L107)', () => {
  // The Hub's switches on 9/11/2026: only Christmas; Black Friday stays closed until the owner opens it.
  assert.deepEqual(SEASONS_ON_DEFAULT, {
    halloween: false, 'black-friday': false, christmas: true, 'winter-sales': false, 'new-year-fitness': false, 'valentines-day': false
  });
  const ids = (iso: string, on = SEASONS_ON_DEFAULT) => heroSlides(Date.parse(iso), on).map(x => x.id);
  assert.deepEqual(ids('2026-11-15T12:00:00Z'), ['season-christmas'], 'no "Black Friday is coming" while Black Friday is closed');
  assert.deepEqual(ids('2026-11-21T12:00:00Z'), ['season-christmas'], 'no countdown picture either');
  assert.deepEqual(ids('2026-11-28T12:00:00Z'), ['season-christmas'], 'on Black Friday itself only the Christmas picture');
  assert.deepEqual(ids('2026-12-27T12:00:00Z'), ['all-worlds'], 'the winter slide waits for its switch');
  assert.deepEqual(ids('2027-10-25T12:00:00Z'), ['all-worlds'], 'Halloween waits for its switch');
  // The owner opens Black Friday on the Hub: the same file brings the switch, no new app version.
  const open = parseSeasonsOn({ seasons_on: { ...SEASONS_ON_DEFAULT, 'black-friday': true } });
  assert.equal(seasonOn(open, 'black-friday-soon'), true, '"Black Friday is coming" belongs to Black Friday');
  assert.deepEqual(ids('2026-11-15T12:00:00Z', open), ['season-christmas', 'black-friday-soon']);
  assert.deepEqual(ids('2026-11-28T12:00:00Z', open), ['season-black-friday', 'christmas']);
  // Only true switches on; anything else, unknown names or a broken file keep the app's own copy.
  assert.equal(parseSeasonsOn({ seasons_on: { 'black-friday': 'yes', christmas: true } })['black-friday'], false);
  assert.equal(parseSeasonsOn({ seasons_on: { christmas: true, extra: true } }).extra, undefined);
  assert.deepEqual(parseSeasonsOn({ deals: [] }), SEASONS_ON_DEFAULT);
  assert.deepEqual(parseSeasonsOn(null), SEASONS_ON_DEFAULT);
  assert.deepEqual(parseSeasonsOn({ seasons_on: ['x'] }), SEASONS_ON_DEFAULT);
});

test('seasons: every campaign text exists in all 11 languages, with the same placeholders', () => {
  const keys = new Set<string>();
  for (const c of [...CAMPAIGNS, FALLBACK_CAMPAIGN]) [c.eyebrow, c.title, c.text, c.cta].forEach(k => keys.add(k));
  for (const s2 of seasonsOf(2026)) [s2.name, s2.title].forEach(k => keys.add(k));
  for (const k of ['countdown', 'countdownHours', 'bfCta', 'soonCta', 'allCta', 'prev', 'next', 'slideAria', 'seasonAria', 'navDeals',
    'dealsTitle', 'dealsSub', 'dealCode', 'dealCodeNoMin', 'dealWithCode', 'dealSale', 'dealUntil', 'dealCta', 'soonText']) keys.add(k);
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
    { id: 'f', retailer: 'Zero', kind: 'sale', start: '2026-10-01', end: '2026-12-31', link: 'https://constructiongearworld.com/discount-codes/zero/', upTo: 0 },
    { id: 'g', retailer: 'Joybuy', kind: 'sale', campaign: 'Household & Cleaning', currency: 'GBP', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', link: 'https://homegearworld.com/discount-codes/joybuy/' }
  ] };
  const deals = parseDeals(raw);
  assert.deepEqual(deals.map(d => d.id), ['a', 'b', 'c', 'd', 'f', 'g'], 'a /go/ link is never taken');
  assert.deepEqual(deals[0].sites, ['TGW', 'MGW']);
  // Like the Hub (lessons L107): a sale needs its name and shows no percentage; one that still says "up to N%" is left out.
  assert.deepEqual(activeDeals(deals, '2026-11-04').map(d => d.id), ['b', 'a', 'g'], 'codes by smaller minimum spend, then named sales');
  const dealsSrc = readFileSync(new URL('../src/components/deals.tsx', import.meta.url), 'utf8');
  assert.ok(!/dealUpTo|upTo|%/.test(dealsSrc), 'the deals card never shows a percentage');
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

test('texts: the app never sounds like a shop (no shop, cart or basket) and says who runs it', () => {
  // Gear World sells nothing: people compare products and buy on the retailer's website (owner and Manager, 7/11/2026).
  const SEASONS = JSON.parse(readFileSync(new URL('../src/i18n/season-strings.json', import.meta.url), 'utf8'));
  const english = [APP_STRINGS['en-GB'], HUB['en-GB'], SEASONS['en-GB']]
    .flatMap(d => Object.values(d)).map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
  for (const s of english) {
    assert.ok(!/\b(shop|shops|shopping|cart|basket|checkout)\b/i.test(s), `no shop wording: ${s}`);
    assert.ok(!/UK retailers/i.test(s), `never "UK retailers": ${s}`);
  }
  for (const l of LOCALES) {
    assert.ok(!/shop/i.test(SEASONS[l.code].allTitle) && !/shop/i.test(HUB[l.code].shopInterest), `${l.code}: no shop words`);
  }
  const settings = readFileSync(new URL('../src/app/(tabs)/settings.tsx', import.meta.url), 'utf8');
  assert.match(settings, /t\('runBy', \{ name: LEGAL\.operator \}\)/);
  const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  assert.match(api, /operator: 'Evangelos Kalogerakis, United Kingdom'/);
});

// ---------- version 1.0.1 (10/11/2026): the app's own features after Apple's 4.2.2 review ----------

test('products: the check day, "check at the retailer" and the RRP come from the sites as they say them', () => {
  const world = { key: 'CGW', name: 'Construction Gear World', base: 'https://constructiongearworld.com' };
  const p = parseSiteProduct({ id: 1047, product_name: 'Makita M9400', price: 157.95, was_price: 199.99, stock_status: 'check_retailer', price_checked: '2026-11-08T03:12:00Z' }, world)!;
  assert.equal(p.checkRetailer, true);
  assert.equal(p.inStock, null, 'no stock claim for a price checked 14-30 days ago (lessons L107)');
  assert.equal(p.checked, '2026-11-08');
  assert.equal(p.wasPrice, 199.99);
  assert.equal(checkedDay('2026-11-08', '2026-11-10'), '2026-11-08');
  assert.equal(checkedDay('2026-12-01', '2026-11-10'), null, 'never a day in the future');
  assert.equal(checkedDay('yesterday'), null);
  const h = parseHubResult({ site: 'cgw', site_url: 'constructiongearworld.com', id: 5, product_name: 'X', stock_status: 'in_stock', last_seen_at: '2026-11-09 06:00:00' })!;
  assert.equal(h.checked, '2026-11-09');
  assert.equal(h.inStock, true);
  assert.equal(h.checkRetailer, false);
  // Saved products: one request per world for exactly their ids; an answer with other products is not trusted.
  assert.equal(productsByIdUrl(world, ['1047', 'x', '12']), 'https://constructiongearworld.com/api/products?ids=1047%2C12&limit=2');
  const a = parseSiteProduct({ id: 1047, product_name: 'A' }, world)!;
  const b = parseSiteProduct({ id: 9, product_name: 'B' }, world)!;
  assert.deepEqual(pickAsked([a], ['1047', '12']), { found: [a], listed: true });
  assert.deepEqual(pickAsked([a, b], ['1047', '12']), { found: [a], listed: false }, 'a site without ids= answers with other products');
  // The product screen says who sells it and never crosses out a price.
  const screen = readFileSync(new URL('../src/app/product.tsx', import.meta.url), 'utf8');
  for (const k of ['soldBy', 'stockAt', 'priceChecked', 'rrp', 'checkRetailer', 'saveBtn', 'share']) assert.match(screen, new RegExp(`t\\('${k}'`), k);
  assert.ok(!/line-through|<s>|wasPrice > product\.price \? formatPrice\(product\.wasPrice[^)]*\) : '';\s*\n\s*.*was/.test(screen), 'no crossed-out "was" price');
});

test('saved: kept on the phone, newest first, refreshed per world, broken data dropped', () => {
  const world = { key: 'CGW', name: 'Construction Gear World', base: 'https://constructiongearworld.com' };
  const p1 = parseSiteProduct({ id: 1, product_name: 'One', price: 10, image_url: 'https://img.example.com/a.JPEG?x=1' }, world)!;
  const p2 = parseSiteProduct({ id: 2, product_name: 'Two', price: 20 }, world)!;
  let list = addSaved([], toSaved(p1, '2026-11-10'));
  list = addSaved(list, toSaved(p2, '2026-11-10'));
  list = addSaved(list, toSaved(p1, '2026-11-11'));
  assert.deepEqual(list.map(x => x.key), ['CGW:1', 'CGW:2'], 'newest first, no duplicates');
  assert.deepEqual(idsByWorld(list), { CGW: ['1', '2'] });
  const fresh = parseSiteProduct({ id: 1, product_name: 'One', price: 9.5, stock_status: 'in_stock', price_checked: '2026-11-09' }, world)!;
  const merged = mergeFresh(list, 'CGW', [fresh], true, '2026-11-12');
  assert.equal(merged[0].price, 9.5);
  assert.equal(merged[0].checked, '2026-11-09');
  assert.equal(merged[1].notListed, true, 'the site answered for exactly these ids and no longer lists it');
  assert.equal(mergeFresh(list, 'CGW', [fresh], false, '2026-11-12')[1].notListed, false, 'an answer that cannot be trusted marks nothing');
  assert.deepEqual(removeSaved(merged, 'CGW:2').map(x => x.key), ['CGW:1']);
  const back = parseSaved(JSON.stringify([...merged, { key: 'BAD', id: '3', worldKey: 'CGW', base: 'https://x' }, { key: 'CGW:4', id: '4', worldKey: 'CGW', base: 'http://x' }]));
  assert.deepEqual(back.map(x => x.key), ['CGW:1', 'CGW:2'], 'only well-formed https items come back');
  assert.equal(back[0].price, 9.5);
  assert.deepEqual(parseSaved('not json'), []);
  assert.deepEqual(parseSaved(null), []);
  assert.equal(imageFileName(list[0]), 'cgw-1.jpg');
  let many: ReturnType<typeof addSaved> = [];
  for (let i = 0; i < MAX_SAVED + 5; i++) many = addSaved(many, toSaved({ ...p2, id: String(i), key: `CGW:${i}` }, '2026-11-10'));
  assert.equal(many.length, MAX_SAVED);
});

test('texts: the 1.0.1 texts exist in all 11 languages, with the same placeholders', () => {
  for (const l of LOCALES) {
    for (const k of FEATURE_KEYS) {
      const v = FEATURE_STRINGS[l.code]?.[k];
      assert.ok(typeof v === 'string' && v.trim(), `${l.code}.${k}`);
      assert.deepEqual((v.match(/\{\w+\}/g) ?? []).sort(), (FEATURE_STRINGS['en-GB'][k].match(/\{\w+\}/g) ?? []).sort(), `${l.code}.${k} placeholders`);
    }
    assert.equal(Object.keys(FEATURE_STRINGS[l.code]).length, FEATURE_KEYS.length, `${l.code}: no extra keys`);
  }
});

test('texts: no shop, partner, cart or "our retailers" words in any of the 11 languages (lessons L101-L103)', () => {
  const SEASONS = JSON.parse(readFileSync(new URL('../src/i18n/season-strings.json', import.meta.url), 'utf8'));
  // The words the Hub and the sites removed (tests/worker/ads-cleanup.test.mjs), in every language. "партнёрские ссылки"
  // is the Russian term for affiliate links, as the Hub keeps "партнёрская сеть" for affiliate network.
  const BAD = /\bshops?\b|shopping|\bpartners?\b|partnership|sponsor|\bcart\b|basket|checkout|our retailers|Gear World retailers|trusted|Boxing Day and January sales|price drop|\bSave \d|Partnerhändler|vertrauenswürdig|einkaufen|unsere Händler|Warenkorb|συνεργαζόμεν|αξιόπιστ|Αγορές ανά|καλάθι|καταστήματά μας|tiendas? asociadas?|de confianza|Compra por|nuestras tiendas|carrito|partenaires?|de confiance|Acheter par|nos marchands|boutique|paniers?|negozi? partner|affidabil|Acquista per|nostri negozi|carrello|partnerwinkels?|betrouwba|Winkelen|onze winkels|winkelwagen|lojas? parceiras?|de confiança|Compre por|nossas lojas|carrinho|partener|de încredere|Cumpără pe|magazinele noastre|магазин(ов)?-партн|надёжн|Покупки по категориям|наши магазины|корзин|dyqane? partner|partnerëve|besueshm|Bli sipas|dyqanet tona|shport/i;
  for (const [name, dicts] of [['app', APP_STRINGS], ['features', FEATURE_STRINGS], ['hub', HUB], ['seasons', SEASONS]] as const) {
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries((dicts as Record<string, Record<string, unknown>>)[l.code] ?? {})) {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        assert.ok(!BAD.test(s), `${name} ${l.code}.${k}: ${s}`);
      }
    }
  }
  // The retailer is named in each language, as the Hub does, never left as the English word (lessons L103).
  for (const l of LOCALES.filter(x => !['en-GB', 'nl-NL', 'de-DE'].includes(x.code))) {
    assert.ok(!/\bretailer/i.test(String(HUB[l.code].disclosure)), `${l.code} disclosure names the retailer in its own language`);
  }
  for (const l of LOCALES) assert.match(String(HUB[l.code].footerRights), /Evangelos Kalogerakis/, `${l.code}: the footer says who runs Gear World`);
});

test('no barcode scanner in 1.0.1 (owner, 10/11/2026): no camera package, no scan screen, no scan words', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-camera'), undefined);
  assert.equal(pkg.dependencies['expo-camera'], undefined);
  const tabs = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.ok(!/name="scan"/.test(tabs));
  for (const l of LOCALES) assert.ok(!Object.keys(FEATURE_STRINGS[l.code]).some(k => /^scan|barcode/i.test(k)), `${l.code}: no scanner texts`);
});

test('store screenshots: the photo and voice buttons are drawn only in the screenshot build, never in a phone build', () => {
  const box = readFileSync(new URL('../src/components/search-box.tsx', import.meta.url), 'utf8');
  assert.match(box, /process\.env\.EXPO_PUBLIC_STORE_SHOTS === '1'/);
  for (const f of ['../eas.json', '../app.json', '../package.json']) {
    assert.ok(!readFileSync(new URL(f, import.meta.url), 'utf8').includes('STORE_SHOTS'), `${f} never sets the screenshot flag`);
  }
});
