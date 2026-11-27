// Priority A on the six older sites (chat 3, 27 Nov 2026, lessons L234, L237): the rules files tools/import-rules/wa-*.mjs
// and their pairs file. Each shop is imported under exactly the name of its delivery line (sites/_shared/wave-a.js), on
// the line's site, and its products go to the subcategories the rules give (the site's own names, L56).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAVE_A, LEGACY_SITES, LEGACY_NAME } from '../../sites/_shared/wave-a.js';
import { noSale, hgwPlace, hgwEuPlace, wgwFashion, mgwFashion } from '../../tools/import-rules/lib/wave-a.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(HERE, '../../tools/import-rules');
const KEYS = readdirSync(RULES_DIR).filter(f => /^wa-[a-z0-9-]+\.mjs$/.test(f)).map(f => f.replace(/\.mjs$/, ''));
const load = key => import(join(RULES_DIR, `${key}.mjs`));
const PAIRS = readFileSync(join(HERE, '../../tools/massive/wave-a-legacy-1128.txt'), 'utf8').split(/\r?\n/)
  .map(l => l.replace(/#.*$/, '').trim()).filter(Boolean);

test('L237: every Priority A rules file has its key, a legacy site, and the name of its delivery line on that site', async () => {
  assert.ok(KEYS.length >= 50, `${KEYS.length} rules files`);
  for (const key of KEYS) {
    const r = await load(key);
    assert.equal(r.RULES.key, key, `${key}: key`);
    assert.equal(r.RULES.sites.length, 1, `${key}: one site`);
    const site = r.RULES.sites[0];
    assert.ok(LEGACY_SITES.includes(site), `${key}: ${site} is one of the older sites`);
    assert.match(r.RULES.retailer, LEGACY_NAME, `${key}: a name tools/legacy-import.ps1 accepts`);
    assert.ok(WAVE_A.some(e => e.site === site && e.retailer === r.RULES.retailer), `${key}: "${r.RULES.retailer}" has a delivery line on ${site}`);
    assert.ok(r.RULES.shop instanceof RegExp, `${key}: shop pattern`);
    assert.ok(r.RULES.maxPrice > r.RULES.minPrice, `${key}: prices`);
    assert.equal(typeof r.classify, 'function', `${key}: classify`);
  }
});

// L238: shops whose feed is old (Awin refreshed it last on 15 May 2026, or the Daisycon feed last changed in July and
// August): their rules are kept, but they wait in a comment of the pairs file until a check against the live shop.
const WAITING = ['wa-airdog-us', 'wa-bioethanol-kamin-de', 'wa-bioethanolhaard-nl', 'wa-cuckoo-us', 'wa-efeglasses-us', 'wa-enjoythewood-us',
  'wa-goally-us', 'wa-homeleader-us', 'wa-naghedi-us', 'wa-puredown-us', 'wa-sebastiancruz-us', 'wa-youcustomizeit-us'];

test('L237 / L238: the pairs file lists every rules file once (except the waiting ones), on its own site, the two largest feeds last', async () => {
  assert.equal(PAIRS.length + WAITING.length, KEYS.length);
  for (const k of WAITING) {
    assert.ok(KEYS.includes(k), `${k}: rules file kept`);
    assert.ok(!PAIRS.some(p => p.startsWith(`${k}:`)), `${k}: waits (L238)`);
  }
  assert.equal(new Set(PAIRS).size, PAIRS.length);
  for (const p of PAIRS) {
    const [key, site] = p.split(':');
    assert.ok(KEYS.includes(key), `${p}: rules file`);
    assert.deepEqual((await load(key)).RULES.sites, [site], `${p}: site`);
  }
  assert.deepEqual(PAIRS.slice(-2).map(p => p.split(':')[0]).sort(), ['wa-1800lighting-us', 'wa-zulily-us']);
});

test('L237: shops that are not imported have no rules file (rentals, sample vials, no photos, too large for now)', () => {
  for (const k of ['wa-directwonen-nl', 'wa-microperfumes-us', 'wa-ssimder-us', 'wa-meubelo-nl', 'wa-moebel-de', 'wa-rasendoktor-de']) assert.ok(!KEYS.includes(k), k);
});

const place = async (key, name, feedCategory = '', extra = {}) => {
  const r = await load(key);
  const c = r.classify({ name, feedCategory, url: '', brand: '', info: null, ...extra });
  return c.reject ? `reject: ${c.reject}` : `${c.siteCategory} > ${c.subcategory}`;
};

test('L237: HGW English shops place appliances, bathroom furniture, lighting and furniture, and leave out outdoor, pet and parts', async () => {
  const cases = [
    ['wa-maytag-us', 'Maytag Smart Top Load Dryer W/ Pet Pro Option In White', '', 'Home Appliances > Tumble Dryer'],
    ['wa-maytag-us', 'Maytag 30 In. Wide Gas Range W/ Grill Mode, 5.0 Cu. Ft. In Fingerprint Resistant Stainless Steel', '', 'Home Appliances > Cooker'],
    ['wa-whirlpool-us', 'Whirlpool Convertible Under-Cabinet Hood in Stainless Steel 36" UXT5536AAS', '', 'Home Appliances > Cooker Hood'],
    ['wa-whirlpool-us', 'Whirlpool Undercounter Wine Center with Towel Handle Bar in Stainless Steel 15"', '', 'Home Appliances > Refrigerator'],
    ['wa-whirlpool-us', 'Whirlpool Commercial Top-Load Washer, Coin Equipped in White', '', /^reject/],
    ['wa-arielbath-us', 'ARIEL Colton 54 Inch Single Sink Base Cabinet in White', 'Furniture > Cabinets & Storage > Vanities > Bathroom Vanities', 'Bedding & Bath > Bathroom Furniture'],
    ['wa-1800lighting-us', 'Hubbardton Forge Brooklyn 22 Inch Bath Vanity Light White - 201375-1043 - Modern Contemporary', 'Home & Garden > Lighting', 'Lighting > Wall Light'],
    ['wa-1800lighting-us', 'WAC Lighting Cubical 24 Inch Bollard Granite - 6705-27GT - Modern Contemporary', 'Home & Garden > Lighting', /^reject: garden/],
    ['wa-1800lighting-us', 'Westgate 5 Inch 5 Inch 12 Watt Wall Washers LED 60 Degree Bronze - LFL', 'Home & Garden > Lighting', /^(?!Home Appliances)/],
    ['wa-homsee-us', 'Vestia Kitchen Cabinet Set with Range Hood Opening', '', 'Storage & Organisation > Storage Unit'],
    ['wa-cuckoo-us', 'Replacement Inner Pot for CR-0375F', 'Inner Pot', /^reject: spare part/],
    ['wa-cuckoo-us', 'NELLO Air Shower & Pet Dryer', '', /^reject/],
    ['wa-youcustomizeit-us', 'Custom Neoprene Oven Mitts', '', 'Kitchen & Dining > Table Linen'],
    ['wa-youcustomizeit-us', 'Custom Square Fridge Magnets', '', /^reject/],
    ['wa-homeleader-us', 'AECOJOY 12\'x10\' Wall Gazebo with Curtains and Mosquito Netting, Gray', '', /^reject: garden/],
    ['wa-airdog-us', 'XCover Protection Plan 3', '', /^reject/]
  ];
  for (const [key, name, cat, want] of cases) {
    const got = await place(key, name, cat);
    if (want instanceof RegExp) assert.match(got, want, `${key}: ${name}`); else assert.equal(got, want, `${key}: ${name}`);
  }
});

test('L237: HGW German and Dutch shops read compound words, their folders, and leave out covers, socks and professional lights', async () => {
  const cases = [
    ['wa-cosori-de', 'COSORI 5,5-Liter Heißluftfritteuse', 'Other Appliances', 'Home Appliances > Air Fryer'],
    ['wa-cosori-de', 'COSORI TurboBlaze Keramik-Backblech – Original Ersatzteil', 'Other Appliances', /^reject: spare part/],
    ['wa-kochblume-de', 'Gourmetzange - Taupe', 'Spatulas', 'Kitchen & Dining > Kitchen Utensil'],
    ['wa-sheepworld-de', 'Espressobecher »Herzensmensch«', '', 'Kitchen & Dining > Drinkware'],
    ['wa-sheepworld-de', 'Zaubersocken »Mama, du bist toll!«', '', /^reject/],
    ['wa-mattenwelt-de', 'Fussmatte Royalblau', 'Fussmatten', 'Home Decor > Rug'],
    ['wa-profichemie-de', 'S-Pro® Duschkabinenreiniger', '', 'Cleaning & Laundry > Cleaning Products'],
    ['wa-janine-de', 'Janine Janine Elastic-Jersey Betttücher Deluxe 5010 sonnengelb (63) 63 150x200 cm', 'Heim & Garten|Bett- und Haushaltswäsche|Bettwäsche|Bettlaken > Bettlaken', 'Bedding & Bath > Bed Sheet'],
    ['wa-bioethanol-kamin-de', 'S500 Sicherheitsglas | Bioethanol-kamin-shop.de', 'Bio Fireplace Acces - Safety glass', 'Home Decor > Fireplaces'],
    ['wa-bioethanolhaard-nl', 'Mix 600 Heel-Jaars Beschermhoes | Bioethanolhaard-shop.nl', 'Bio Fireplace Acces - Cover', /^reject/],
    ['wa-sanifun-nl', 'Sanifun doucheslang Raban 250.', 'Douche|Doucheslang > Douche', 'Bedding & Bath > Shower'],
    ['wa-leuchtmittel-de', 'OSRAM PLANTASTAR®-T 600 W 230 V E40', 'LED-Lampen|Hochdruck', /^reject: professional/],
    ['wa-dekotopia-de', 'Dekotopia Podestverkleidung aus Bühnenmolton schwarz, 200 x 60 cm', 'Diverses|Stoffe & Netze', /^reject/],
    ['wa-vincasa-de', 'Weinregal OPTIPLUS Modell 5, Holz natur', 'Möbel|Schränke|Weinregale > Weinregale', 'Storage & Organisation > Storage Rack']
  ];
  for (const [key, name, cat, want] of cases) {
    const got = await place(key, name, cat);
    if (want instanceof RegExp) assert.match(got, want, `${key}: ${name}`); else assert.equal(got, want, `${key}: ${name}`);
  }
});

test('L237: clothes, shoes and beauty go to the sites\' own subcategories; men\'s, testers, costumes and rude names stay out', async () => {
  const cases = [
    ['wa-hanes-us', "Hanes Originals Men's SuperSoft Boxer Brief Underwear, Total Support Pouch, Black, 3-Pack Assorted", '', 'Clothing > Underwear'],
    ['wa-hanes-us', "Hanes Premium Scrubs Women's 3-Pocket Scrub Top Ceil Blue 2 XL", '', /^reject: not men's/],
    ['wa-sebastiancruz-us', 'Black Raso with Aqua Flake Signature Border', '', 'Bags & Accessories > Ties'],
    ['wa-brunomarc-us', 'BRUNO MARC Men s Stylish Suede Chukka Boots', 'Apparel', 'Shoes > Boots'],
    ['wa-efeglasses-us', 'Cat-eye Black Eyeglasses', 'Eyeglasses', /^reject/],
    ['wa-maidenform-us', "Maidenform Natural Boost Demi T-Shirt Underwire Push-Up Bra, Lace Trim Sandshell 36D Women's", 'Apparel & Accessories > Clothing > Underwear & Socks > Bras', 'Clothing > Underwear'],
    ['wa-amiclubwear-us', 'Black Red Sequin Halter Sexy Nurse 5 Piece Halloween Costume', 'Apparel & Accessories > Costumes & Accessories', /^reject: costume/],
    ['wa-amiclubwear-us', 'BEAU-601', 'Apparel & Accessories > Clothing', /^reject: named only/],
    ['wa-fragrancenet-us', 'Red by Giorgio Beverly Hills EDT SPRAY 3 OZ *TESTER for WOMEN', 'Fragrance > Fragrances', /^reject: tester/],
    ['wa-fragrancenet-us', 'Salvatore Ferragamo by Salvatore Ferragamo EDT SPRAY 3.4 OZ for MEN', 'Fragrance > Fragrances', /^reject: men's/],
    ['wa-fragrancenet-us', 'Lou Lou by Cacharel EAU DE PARFUM SPRAY 1 OZ for WOMEN', 'Fragrance > Fragrances', 'Beauty & Fragrances > Fragrance'],
    ['wa-iedm-us', 'On Cue Apparel Alien Gangbang Jogger Sweatpants in Black - L by iEDM', '', /^reject: rude/],
    ['wa-sachinbabi-us', 'MARTA MIDNIGHT BLUE FLORAL MIKADO BALL GOWN - FINAL SALE', 'GOWN', 'Clothing > Dresses'],
    ['wa-princesspolly-us', 'Faubert Mini Dress White', 'Mini dresses', 'Clothing > Dresses'],
    ['wa-zanotti-us', 'Gz-kobe Sneakers', 'Apparel & Accessories > Shoes', /^reject: not known/],
    ['wa-zanotti-us', 'Venere Sandal 120', 'Apparel & Accessories > Shoes', 'Shoes > Sandals'],
    ['wa-zulily-us', 'Birkenstock Arizona Suede Leather Sandals', 'Apparel & Accessories > Shoes > Sandals', /^reject: not for children/],
    ['wa-zulily-us', "Girls' Pink Sparkle Sneakers", 'Sneakers', 'Shoes > Trainers'],
    ['wa-bakerross-ie', 'Wooden Stand-up Castles (Pack of 6) Wood Craft Kits For Kids', 'decoration craft kits', 'Toys & Games > Toy Craft Kits'],
    ['wa-tushbaby-us', 'Personalization', 'Stylux Personalization', /^reject/],
    ['wa-wildguarder-us', 'WILDGUARDER® WG-T009 256x192 Thermal Imaging Monocular', 'Thermal Imager', /^reject/],
    ['wa-wildguarder-us', 'WILDGUARDER TL3100 4K WiFi Time Lapse Camera', 'Time Lapse Camera', 'Outdoor Lighting & Garden Electrical > Wildlife cameras']
  ];
  for (const [key, name, cat, want] of cases) {
    const got = await place(key, name, cat);
    if (want instanceof RegExp) assert.match(got, want, `${key}: ${name}`); else assert.equal(got, want, `${key}: ${name}`);
  }
});

test('L237 / L107: no sale words on a card name', async () => {
  assert.equal(noSale('Marta Sky Blue Gown - FINAL SALE'), 'Marta Sky Blue Gown');
  assert.equal(noSale('Lip Crayon (Sale)'), 'Lip Crayon');
  assert.equal((await load('wa-sachinbabi-us')).displayName('MARTA MIDNIGHT BLUE FLORAL MIKADO BALL GOWN - FINAL SALE'), 'Marta Midnight Blue Floral Mikado Ball Gown');
  assert.equal(hgwPlace('Custom Oven Mitts').subcategory, 'Table Linen');
  assert.equal(hgwEuPlace({ name: 'Wandlamp | lumo | 2 lichts', lang: 'nl' }).subcategory, 'Wall Light');
  assert.equal(wgwFashion("Women's No Show Socks, Shoe Size 5-9").subcategory, 'Socks');
  assert.equal(mgwFashion("Men's Boxer Briefs with Pouch").subcategory, 'Underwear');
});
