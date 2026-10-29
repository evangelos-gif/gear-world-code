// L83: Cufflinks Gift Hub on Men's Gear World (29 Oct 2026): its new feed, into places MGW already has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, RULES } from '../../tools/import-rules/cufflinksgifthub.mjs';

const place = (name, feedCategory = '') => {
  const c = classify({ name, feedCategory });
  return c.reject ? 'out' : `${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`;
};

test('L83: cufflinks, tie clips, ties and wallets go to the MGW places that exist', () => {
  assert.equal(place('Silver Football Cufflinks in Gift Box'), "Men's Jewellery/Cufflinks");
  assert.equal(place('Personalised Engraved Oval Cuff Links'), "Men's Jewellery/Cufflinks");
  assert.equal(place('Black Onyx Tuxedo Shirt Studs Set'), "Men's Jewellery/Cufflinks");
  assert.equal(place('Brushed Steel Tie Clip'), "Men's Jewellery/Jewellery");
  assert.equal(place('Navy Silk Bow Tie and Pocket Square Set'), 'Bags & Accessories/Ties');
  assert.equal(place('Leather Money Clip Wallet'), 'Bags & Accessories/Wallets & Purses');
  assert.equal(place('Golf Ball Marker Keyring'), 'Bags & Accessories/Accessories');
  assert.equal(place('Stainless Steel Cuff Bracelet'), "Men's Jewellery/Jewellery");
  assert.equal(place('Classic Gold Plated Gift Set', 'Cufflinks > Gift Sets'), "Men's Jewellery/Cufflinks (doubt)");
});

test("L83: women's jewellery, gift cards and packaging stay out", () => {
  for (const n of ['Rose Gold Earrings for Her', "Women's Pearl Necklace", 'Gift Card £25', 'Empty Cufflink Gift Box Replacement Backs', 'Mystery Item'])
    assert.equal(place(n), 'out', n);
  assert.equal(RULES.advertiserId, 130341);
  assert.ok(RULES.shop.test('https://www.cufflinksgifthub.co.uk/products/football-cufflinks'));
});
