// Kids' Gear World: the general category rules (phase 4 of "every product through the Hub", 31 Oct 2026).
// Names are real products from the live site and the shops' feeds; the rules were tuned on them (86% of KGW in the same category).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as KGW from '../../sites/kgw/category-rules.js';
import kgwConfig from '../../sites/kgw/site.config.js';

const on = (name, feed = '', source = null) => {
  const c = KGW.classify(KGW.cleanProductName(name), feed, '', source);
  return c.ok ? `${c.slug}/${c.subcategory}` : `no: ${c.reason}`;
};

test('the slugs and names are the ones KGW already uses (site.config.js, database.categories)', () => {
  const cats = kgwConfig.database.categories;
  for (const slug of KGW.CATEGORY_SLUGS) {
    assert.ok(cats[slug], `${slug} is a page of the site`);
    assert.ok(cats[slug].includes(KGW.CATEGORY_DB_NAMES[slug]), `${slug} is stored as "${KGW.CATEGORY_DB_NAMES[slug]}"`);
  }
});

test('toys, games and baby items are for children by themselves; the shop\'s leaf section names the subcategory', () => {
  const cases = [
    ['LEGO Ideas Floating Sea Otters 21366 Building Set for Adults and Kids Aged 10+', 'Toys & Games > Toys > Building Toys > Construction Set Toys', 'toys-games/Construction Set Toys'],
    ['Schleich Crocodile - 14736', 'Toys', 'toys-games/Action & Toy Figures'],
    ['Tommee Tippee Closer to Nature Baby Bottles 260ml', '', 'baby-toddler/Baby Bottles'],
    ['Grow With Peppa Pig Baby Lotion - 350 ml', 'Bathroom & care', 'baby-toddler/Baby Bathing'],
    ['Baby Stacking Rings Toy – 7-Piece Colourful Ring Set', '', 'baby-toddler/Sorting & Stacking Toys'],
    ['Tomy Boon Tubes Bath Toy - 3 pcs.', 'Water toys', 'baby-toddler/Bath Toys']
  ];
  for (const [name, feed, want] of cases) assert.equal(on(name, feed), want, name);
});

test('clothes, shoes, bags, tech and sport only with a sign that they are for children', () => {
  const cases = [
    ['Adidas Copa Pure 3 League Turf Junior Boots', 'Sports', 'shoes/Shoes'],
    ['Adidas Copa Pure 3 League Turf Boots', 'Sports', 'no: shoes (Men\'s / Women\'s Gear World)'],
    ['Kids Pyjamas Dinosaur 3-4 Years', '', 'clothing/Nightwear & Loungewear'],
    ['Womens Floral Midi Dress', '', 'no: clothing (Men\'s / Women\'s Gear World)'],
    ['Peppa Pig Kids Backpack', '', 'school-backpacks/School Bags'],
    ['Paw Patrol Pencil Case', '', 'school-backpacks/Pencil Cases'],
    ['VTech KidiZoom Smartwatch DX4', '', 'kids-tech/Kids Smartwatches'],
    ['Micro Scooter Maxi Deluxe Kids Scooter', '', 'sports-outdoors/Riding Scooters'],
    ['Xiaomi Electric Scooter 4 Pro', '', 'no: sports or outdoor product (Sporty / Garden Gear World)'],
    ['Intex Paddling Pool 1.5m', '', 'sports-outdoors/Water Play Equipment'],
    ['Kids Duvet Cover Set Dinosaur Single', '', 'bedroom-home/Duvet Covers']
  ];
  for (const [name, feed, want] of cases) assert.equal(on(name, feed), want, name);
});

test('never on a children\'s site: adult, pet, video game and look-alike products', () => {
  assert.equal(on('Rabbit Vibrator for Women'), 'no: adult product (not for a children\'s site)');
  assert.equal(on('Good Boy Dog Toy Squeaky Plush', 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Toys'), 'no: pet item (not shown yet)');
  assert.equal(on('Bluey The Videogame Nintendo Switch Game for Kids', 'Toys & Games > Games > Board Games'), 'no: video games or computer (Technology Gear World)');
  assert.match(on('Baby Bio Citrus Plant Feed 175ml'), /^no: /, 'Baby Bio is a plant food brand');
  assert.equal(on('Gift Card £50'), 'no: gift card or voucher');
  assert.match(on('Girls Ballet Shoes Friendship Bracelet & Gift Card'), /^accessories\//, 'a bracelet with a greeting card is not a gift card');
  assert.equal(on('OKI 44844469 printer drum Original 1 pc(s)'), 'no: office or computer part (Technology Gear World)');
  assert.match(on('Kids Drum Kit with Microphone'), /^(?:toys-games|kids-tech)\//, 'a toy drum kit is not a printer drum');
});
