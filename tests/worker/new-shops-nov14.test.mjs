// New shops of 14 Nov 2026 (lessons L131): ANCHOR & CREW (Awin 131192, MGW/WGW), Haglöfs (CJ 5531758, MGW/WGW, the
// British catalogue only) and TORRO (Awin 24751, MGW; its device cases wait for Technology Gear World).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ac from '../../tools/import-rules/anchorcrew.mjs';
import * as hg from '../../tools/import-rules/haglofs.mjs';
import * as tr from '../../tools/import-rules/torro.mjs';
import { networkOf } from '../../tools/network-links.mjs';

test('L131: ANCHOR & CREW (database name "Anchor and Crew": wrangler refuses "&") prices come without VAT in the feed: the card shows the shop price (x 1.2)', () => {
  const col = { search_price: '45.83', store_price: '', product_name: 'Pink Agate Sienna Silver and Stone Bracelet No Gift Wrapping' };
  const get = c => col[c] ?? '';
  assert.equal(ac.RULES.retailer, 'Anchor and Crew');
  assert.equal(ac.displayBrand(), 'ANCHOR & CREW');
  assert.equal(ac.field('search_price', get), '55.00', 'Sienna bracelet: £45.83 in the feed, £55.00 on anchorandcrew.com');
  assert.equal(ac.field('product_name', get), col.product_name);
  assert.equal(ac.field('store_price', get), '');
  assert.equal(ac.field('search_price', c => (c === 'search_price' ? '62.50' : '')), '75.00');
});

test('L131: ANCHOR & CREW names lose the size and gift-wrap options; jewellery, clothing and extras go to the right place', () => {
  assert.equal(ac.displayName('Khaki Green Montrose Silver and Rope Bracelet M - 21cm (Most Popular)/No Gift Wrapping'), 'Khaki Green Montrose Silver and Rope Bracelet');
  assert.equal(ac.displayName('Fire Orange Blake Silver and Braided Leather Bracelet Gift Wrapped (Paper & Bow) +£1.50'), 'Fire Orange Blake Silver and Braided Leather Bracelet');
  assert.equal(ac.displayName('Athletic Grey Explorer Print Organic Cotton T-Shirt (Womens) 10 - 35"/36" (US 6 / EU 38)/No Gift Wrapping'), 'Athletic Grey Explorer Print Organic Cotton T-Shirt');
  const c = name => ac.classify({ name });
  assert.deepEqual(c('Coal Black Admiral Anchor Silver and Flat Leather Bracelet No Gift Wrapping'), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Bracelets' });
  assert.equal(c('Admiral Anchor Signature Silver Necklace Pendant M - 50cm/No Gift Wrapping').subcategory, 'Necklaces');
  assert.equal(c('Classic Grey Arthur Silver and Rope SKINNY Bracelet No Gift Wrapping').site, 'mgw', 'SKINNY is a thin bracelet, not a women\'s one');
  assert.equal(c('Pink Maisie Silver and Freshwater Shell SKINNY Bracelet M - 21cm/No Gift Wrapping').site, 'wgw');
  assert.equal(c('Athletic Grey Explorer Print Organic Cotton T-Shirt (Womens) 10 - 35"/36"/No Gift Wrapping').site, 'wgw');
  assert.deepEqual(c('Octopus Another Good Day Organic Cotton Sweatshirt L/No Gift Wrapping'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Sweatshirts' });
  assert.deepEqual(c('Samson Everyday Carry Silver Keyring No Gift Wrapping'), { site: 'mgw', siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC' }, 'MGW has no Keyrings place (L56)');
  assert.equal(c('GUSTATORY Coffee Bag Silver Bead No Gift Wrapping').siteCategory, "Men's Jewellery", 'a charm bead, not a bag');
  for (const n of ['Sunset Party Archival Giclée Paper A3 Wall Print', 'Grey Reykjavik Medium Hardcover Notebook', 'Small Graphite Black Standen Leather and Rope Phone Case', 'Handmade Candle Co. Sea Spice Scented Soy Wax Candle (180ml)'])
    assert.ok(c(n).reject, n);
});

test('L131: Haglöfs is a CJ shop; only British rows (haglofs.com/en/, pounds) are read; men, women, both', () => {
  assert.equal(networkOf(hg).label, 'CJ');
  const row = (link, currency) => c => ({ merchant_deep_link: link, currency, product_name: 'Korp Proof Jacket Women', search_price: '130' })[c] ?? '';
  assert.equal(hg.field('product_name', row('https://www.haglofs.com/en/women/korp-proof-jacket-women_1', 'GBP')), 'Korp Proof Jacket Women');
  assert.equal(hg.field('product_name', row('https://www.haglofs.com/nl/women/korp-proof-jacket-women_1', 'EUR')), '', 'a Dutch row gives no columns');
  assert.equal(hg.field('search_price', row('https://www.haglofs.com/en/women/x', 'EUR')), '', 'a euro price never reaches a card');
  assert.equal(hg.displayName('Haglöfs Rosson Proof Mid Men'), 'Rosson Proof Mid');
  const c = (name, feedCategory = '') => hg.classify({ name, feedCategory });
  assert.deepEqual(c('Korp Proof Jacket Women', 'Shell jackets'), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Jackets & Coats' });
  assert.deepEqual(c('Rosson Down Hood Men', 'Insulated jackets'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Jackets' });
  assert.equal(c('L.I.M Airak 2,5L Jacket Men', 'Shell jackets').subcategory, 'Jackets', '"2,5L" is the fabric, not a bag size');
  assert.equal(c('Magma 42L', 'Hiking backpacks').subcategory, 'Bags');
  assert.equal(c('Rosson Proof Mid Men', 'Shoes | Boots').subcategory, 'Boots');
  assert.equal(c('Vassi Beanie', 'Beanies | Hats | Caps').subcategory, 'Hats');
  assert.ok(c('Haglöfs Shoe Lace 4 mm', 'Shoelaces').reject);
  assert.ok(c('Mila Jacket Junior', 'Jackets').reject);
});

test('L131: TORRO on MGW: leather accessories in, device cases (also "wallet cases") out for Technology Gear World', () => {
  const c = name => tr.classify({ name });
  assert.equal(c('Trifold Leather Wallet (with RFID Protection) - Black').subcategory, 'Wallets & Purses', "MGW's own name (L56)");
  assert.ok(c('iPhone 17 2-in-1 Leather Wallet Case (with Detachable Cover & MagSafe Charging)').reject);
  assert.ok(c('Kindle Paperwhite & Kindle Colorsoft Leather Case (2024/2025) - Navy Blue').reject);
  assert.equal(c('Leather Weekend Duffle Bag - Black').subcategory, 'Bags');
  assert.equal(c('Leather Passport Holder & Travel Document Organiser - Black').subcategory, 'Accessories');
  assert.equal(c('Leather AirTag Keyring - Tan').siteCategory, 'Everyday Carry / EDC');
  assert.deepEqual(c('Leather Apple Watch & Watch Ultra Strap - Small'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' });
  assert.equal(c('Leather Golf Tee Holder for Golf Bags - Navy Blue').subcategory, 'Accessories');
  assert.ok(c('Large Leather Desk Mat (80x40cm) - Black').reject);
  assert.equal(tr.displayName('Slim Leather Card Holder with 5 Card Slots - Black with Red Detail'), 'Slim Leather Card Holder with 5 Card Slots');
});
