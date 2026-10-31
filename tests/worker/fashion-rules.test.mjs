// Men's and Women's Gear World: the general category rules (phase 4 of "every product through the Hub", 31 Oct 2026).
// Names are real products from both live sites; the rules were tuned on them (94% of MGW and 96% of WGW in the same category).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as MGW from '../../sites/mgw/category-rules.js';
import * as WGW from '../../sites/wgw/category-rules.js';
import { audience, headOf } from '../../sites/_shared/fashion-rules.js';
import mgwConfig from '../../sites/mgw/site.config.js';
import wgwConfig from '../../sites/wgw/site.config.js';

const on = (R, name, feed = '', source = null) => {
  const c = R.classify(R.cleanProductName(name), feed, '', source);
  return c.ok ? `${c.slug}/${c.subcategory}` : `no: ${c.reason}`;
};

test('the slugs and names are the ones each site already uses (site.config.js, database.categories)', () => {
  for (const [R, cfg] of [[MGW, mgwConfig], [WGW, wgwConfig]]) {
    const cats = cfg.database.categories;
    for (const slug of R.CATEGORY_SLUGS) {
      assert.ok(cats[slug], `${cfg.code}: ${slug} is a page of the site`);
      assert.ok(cats[slug].includes(R.CATEGORY_DB_NAMES[slug]), `${cfg.code}: ${slug} is stored as "${R.CATEGORY_DB_NAMES[slug]}"`);
    }
  }
});

test('Men\'s Gear World: the product type is the last noun of the name, not the first word that matches', () => {
  const cases = [
    ['Barbour Beaufort Wax Jacket', 'Menswear', 'clothing/Jackets'],
    ['Oxford Shirt (Light Blue Stripe) | XS | Stan Ray®', '', 'clothing/Shirts'],
    ['Oxford Leathercraft Feather Edge Leather Belt in Brown', 'Menswear', 'bags-accessories/Belts'],
    ['Mens Ultimate Cotton Work Socks for Steel Toe Boots (Multipack Options)', '', 'clothing/Socks'],
    ['Working Watch Cufflinks In Silver and Grey', '', 'jewellery/Cufflinks'],
    ['Golding Horse Shoe Tie', 'Menswear', 'bags-accessories/Ties'],
    ['Calvin Klein Men\'s Dark Sapphire Cotton Stretch Stripe T-Shirt', '', 'clothing/T-Shirts'],
    ['Emporio Armani Sea Explorer AR11590 Men\'s Watch – 42mm Blue Dial Stainless Steel', 'Men\'s Watches', 'watches/Watches'],
    ['Polo Ralph Lauren Heritage Court II Trainers', 'Menswear', 'shoes/Trainers'],
    ['Olight Seeker 4 Pro High Power Flashlight – Matte Black', '', 'everyday-carry/Everyday Carry / EDC'],
    ['29 in 1 Multi Tool', '', 'everyday-carry/Everyday Carry / EDC'],
    ['Armaf Odyssey Homme Mega Eau de Parfum for Men – 100ml', 'Fragrances', 'grooming-fragrances/Fragrance'],
    ['Montblanc Legend Red Eau de Parfum 50ml', '', 'grooming-fragrances/Fragrance'],
    ['Philips 3000 Wet & Dry Electric Shaver, 5D Pivot & Flex Heads', '', 'grooming-fragrances/Shaving'],
    ['Black Cat Cufflinks', '', 'jewellery/Cufflinks'],
    ['Fred Bennett Gunmetal Plated Square Signet Ring', 'Women\'s Jewellery', 'jewellery/Jewellery'],
    ['Wide 5 (Washed Black) | 28 | Stan Ray®', '', 'clothing/Clothing']
  ];
  const stanRay = { defaultCategory: 'clothing' };
  for (const [name, feed, want] of cases) assert.equal(on(MGW, name, feed, /Stan Ray/.test(name) ? stanRay : null), want, name);
});

test('Women\'s Gear World: women\'s items, beauty and jewellery', () => {
  const cases = [
    ['Barbour Maisy Showerproof Jacket', 'Womenswear', 'clothing/Jackets & Coats'],
    ['Fabienne Chapot Ronny Sweater', 'Womenswear', 'clothing/Knitwear'],
    ['NYDJ Tuxedo Blouse', 'Womenswear', 'clothing/Tops & Blouses'],
    ['Orelia Jewellery Statement Flower & Pearl Stud Earring', 'Womenswear', 'jewellery/Earrings'],
    ['Elements Gold Toi et Moi Quartz and Amethyst Pendant', 'Women\'s Jewellery', 'jewellery/Necklaces'],
    ['L\'Oreal Paris Double Extension Waterproof Mascara Black', 'Health & Beauty > Personal Care > Cosmetics', 'beauty-fragrances/Make-up'],
    ['OLAY 24 Hour Night Serum 40ml', '', 'beauty-fragrances/Skincare'],
    ['John Frieda Go Blonder Lightening Conditioner 250ml', '', 'beauty-fragrances/Hair care'],
    ['Sapil Sarab Glow EDP 100ml', 'Perfume', 'beauty-fragrances/Fragrance'],
    ['Fairfax & Favor Regina Suede Boots in Navy', 'Womenswear', 'shoes/Boots'],
    ['Coes Soya Concept Panna Belt', 'Womenswear', 'bags-accessories/Belts'],
    ['Casio Ladies Digital Green Dial with White Resin Band Watch', '', 'watches/Watches']
  ];
  for (const [name, feed, want] of cases) assert.equal(on(WGW, name, feed), want, name);
});

test('who it is for: one site, both sites (unisex) or Kids\' Gear World', () => {
  assert.equal(audience('Barbour Beaufort Wax Jacket', 'Menswear'), 'men');
  assert.equal(audience('Joules Ladies Dress'), 'women');
  assert.equal(audience('Tilley Unisex Tec-Wool Hat'), 'both');
  assert.equal(audience('Hunters Jacket (Navy Heather)'), 'both');
  assert.equal(audience('Kids Puffer Jacket'), 'kids');
  assert.equal(audience('Barbour Claymore Baker Boy Cap', 'Menswear'), 'men', 'a baker boy cap is not for children');
  assert.equal(audience('Carolina Herrera Bad Boy Cobalt Eau de Parfum 100ml'), 'men');
  assert.equal(audience('Fred Bennett Double Oval Dog Tag Necklace', 'Women\'s Jewellery', { genderSections: false }), 'men');
  assert.equal(audience('Emerald Cut Stud Earrings', 'Men\'s Jewellery', { audience: 'men' }), 'men', 'a men\'s jewellery shop');
  // Unisex products go to both sites; a dress only to WGW; shaving only to MGW.
  assert.match(on(MGW, 'Hunters Jacket (Navy Heather)'), /^clothing/);
  assert.match(on(WGW, 'Hunters Jacket (Navy Heather)'), /^clothing/);
  assert.match(on(MGW, 'Joules Ladies Dress'), /^no: for women/);
  assert.match(on(WGW, 'Gillette Mach3 Turbo Razor'), /^no: for men/);
  assert.match(on(MGW, 'OLAY 24 Hour Night Serum 40ml'), /^no: beauty or perfume/);
  assert.match(on(WGW, 'Kids Puffer Jacket'), /Kids' Gear World/);
});

test('other Gear Worlds\' products and look-alikes stay out', () => {
  for (const name of ['Tease Torch for Cats', 'Flashlight Flex Cable for iPhone 13 Pro', 'PAPO Wild Animal Kingdom Male Zebra Toy Figure', 'Stattics Gift Card',
    'Xiaomi Luggage Classic Pro 28" Black - Unisex Travel Suitcase', 'Multi Tool RJ45 RJ12 RJ11 Wire Cable Crimper', 'Garden Hose Reel 30m']) {
    assert.match(on(MGW, name), /^no:/, name);
    assert.match(on(WGW, name), /^no:/, name);
  }
  // A word of another kind of product BEFORE the type does not matter.
  assert.equal(on(MGW, 'Boxx Picture Pocket watch Labrador Dogs'), 'watches/Watches');
  assert.equal(on(MGW, 'Moschino Men\'s Toy 2 Eau de Parfum Spray'), 'grooming-fragrances/Fragrance');
  assert.equal(headOf('Mens Merino Wool Socks for Steel Toe Boots'), 'Mens Merino Wool Socks');
});

test('legacy-rules-compare: live products against the new rules, per shop, read-only', async () => {
  const { compareRules } = await import('../../tools/legacy-rules-compare.mjs');
  const rows = {
    mgw: [['Coes', 'Barbour Beaufort Wax Jacket', 'Menswear', 'Clothing', 'Jackets'], ['Coes', 'Golding Horse Shoe Tie', 'Menswear', 'Bags & Accessories', 'Ties'],
      ['InStock UK', 'Tease Torch for Cats', '', 'Everyday Carry / EDC', 'Everyday Carry / EDC'], ['InStock UK', 'Mens Thermal Winter Hat', '', 'Clothing', 'Clothing']],
    wgw: [['Coes', 'NYDJ Tuxedo Blouse', 'Womenswear', 'Clothing', 'Tops & Blouses'], ['Stan Ray UK', 'Hunters Jacket (Navy Heather)', '', 'Clothing', 'Jackets & Coats']]
  };
  const { report, stats } = await compareRules({ rows, sites: ['mgw', 'wgw'], examples: 2 });
  assert.deepEqual(stats.mgw, { n: 4, same: 2, sub: 2, moved: 1, out: 1, alsoHere: 1 });
  assert.equal(stats.wgw.same, 2);
  assert.match(report, /pet item/);
  assert.match(report, /Clothing -> Bags & Accessories/);
});
