// Mass import of 15 Nov 2026 (Manager: known brands that ship to the UK first). Timberland UK: the pound feed of the
// Daisycon programme 15048 (lessons L163), men's clothing, shoes and watches on Men's Gear World.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tim from '../../tools/import-rules/timberland-uk.mjs';

const col = row => c => String(row[c] ?? '');

test('Timberland UK: the pound feed on MGW, each product by the last word of its name, https pictures, UK default delivery', () => {
  assert.equal(tim.RULES.network, 'daisycon');
  assert.equal(tim.RULES.advertiserId, 15048);
  assert.equal(tim.RULES.currency, 'GBP');
  assert.deepEqual(tim.RULES.sites, ['mgw']);
  assert.ok(tim.RULES.shop.test('https://www.timberland.co.uk/en-gb/p/men-10029/euro-sprint-hiking-boot-for-men-in-yellow-TB0A1NHJ231'));
  assert.ok(!tim.RULES.shop.test('https://www.timberland.de/de-de/p/herren/x'), 'the German shop is another feed');
  const row = { merchant_image_url: 'http://assets.timberland.eu/images/t_Thumbnail/v1/TB0A6DZBA11-HERO/x.png', dc_gender: 'male', merchant_deep_link: 'https://www.timberland.co.uk/en-gb/p/men-10029/x' };
  assert.equal(tim.field('merchant_image_url', col(row)), 'https://assets.timberland.eu/images/t_Thumbnail/v1/TB0A6DZBA11-HERO/x.png');
  assert.equal(tim.field('category_name', col(row)), 'male');
  assert.equal(tim.displayName('Timberland - Euro Sprint Hiking Boot for Men in Yellow, Man, Yellow/Black, Size: 8.5'), 'Euro Sprint Hiking Boot in Yellow');
  assert.equal(tim.displayName("Timberland - Men's Timberland C. F. Stead Indigo Suede Heritage 6-Inch Boot in Dark Blue, Man, Blue, Size: 10"), 'C. F. Stead Indigo Suede Heritage 6-Inch Boot in Dark Blue');
  const c = n => { const r = tim.classify({ name: n, awinCategory: 'male' }); return r.reject ? `out: ${r.reject}` : `${r.siteCategory} > ${r.subcategory}`; };
  assert.equal(c('Timberland - Baboosic Brook Oxford Polo for Men in Teal, Man, Teal, Size: XXL'), 'Clothing > Shirts', 'an Oxford polo is a shirt, not a shoe');
  assert.equal(c('Timberland - Winsor Park Oxford Shoe for Men in Beige, Man, Beige, Size: 9'), 'Shoes > Shoes');
  assert.equal(c('Timberland - Graphic T-Shirt in Teal, Man, Teal, Size: XXL'), 'Clothing > T-Shirts', 'a T-shirt is not a shirt');
  assert.equal(c('Timberland - Williams River Crewneck Jumper for Men in Navy, Man, Navy, Size: M'), 'Clothing > Knitwear');
  assert.equal(c('Timberland - Est. 1973 Logo Crewneck Sweatshirt for Men in Blue, Man, Blue, Size: L'), 'Clothing > Sweatshirts');
  assert.equal(c('Timberland - Euro Hiker Mid Lace-Up With Gore-Tex Bootie For Men in Black, Man, Black, Size: 8'), 'Shoes > Boots', 'a lace-up is not laces');
  assert.equal(c('Timberland - Mylo Bay Low Slip-on Trainer for Men in Black, Man, Black, Size: 9'), 'Shoes > Trainers');
  assert.equal(c('Timberland - Stretch Core Jeans for Men in Blue, Man, Blue, Size: 34'), 'Clothing > Jeans');
  assert.equal(c('Timberland - Polartec Ultralight Packable Vest for Men in Black, Man, Black, Size: M'), 'Clothing > Jackets');
  assert.equal(c('Timberland - Carrigan Watch for Men in Black, Man, Black'), "Watches > Men's Watches");
  assert.match(c('Timberland - Replacement Laces for Men in Brown, Man, Brown'), /^out:/);
  assert.match(tim.classify({ name: "Timberland - Women's Courmayeur Valley Boot in Black", awinCategory: 'female' }).reject, /men's/);
});
