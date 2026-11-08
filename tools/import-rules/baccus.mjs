// Import rules for Baccus (UK) (Awin advertiser 130505, feed 118153) on Men's Gear World (owner, 8 Nov 2026: "feed
// download and import"). New on every site. Feed facts (awin-feed-sample 8 Nov 2026): 286 products, all in stock, GBP,
// shop baccusstore.co.uk, category_name "Men's Clothing" (248), "Accessories" (27), "Men's Footwear" (8), "Men's
// Trousers" (2), one gift voucher; no brand column (the brand starts the name and stays there) ("Ed Hardy - Laser Etched Dragon
// Repeat Jeans - Blue", "HUGO - Yarrow Trainers - Light Beige", "Goorin Bros - The Boss Trucker Cap - Grey"). Search and store
// price are the same (with VAT). Subcategories are the ones MGW already has (live MGW database 8 Nov 2026).
export const RULES = {
  key: 'baccus',
  advertiserId: 130505,
  retailer: 'Baccus',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?baccusstore\.co\.uk\//i,
  sites: ['mgw'],
  maxPrice: 1000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const CLOTHES = [
  ['Jeans', /\bjeans?\b/i], ['Shorts', /\bshorts\b/i], ['Trousers', /\b(trousers|cargos?|joggers?|chinos?|pants)\b/i],
  ['Hoodies', /\bhood(ie|ed|y)s?\b/i], ['Sweatshirts', /\b(sweatshirts?|crew ?necks?|sweats?)\b/i], ['Knitwear', /\b(knit|knitted|jumpers?|cardigans?)\b/i],
  ['Jackets', /\b(jackets?|coats?|gilets?|parkas?|bombers?|overshirts?)\b/i], ['T-Shirts', /\b(t-?shirts?|tees?|vests?|tank)\b/i], ['Shirts', /\b(shirts?|polos?)\b/i],
  ['Tracksuits', /\btracksuits?\b/i]
];

export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = String(name || '');
  const cat = `${feedCategory} ${awinCategory}`;
  if (/gift voucher|gift card/i.test(n) || /gift voucher/i.test(cat)) return { reject: 'gift voucher, not a product' };
  if (/women'?s|ladies/i.test(cat) || /\b(women'?s|ladies)\b/i.test(n)) return { reject: "women's item (this shop goes to Men's Gear World)" };
  if (/footwear/i.test(cat) || /\b(trainers?|sneakers?|boots?|shoes?|loafers?|sliders?|sandals?)\b/i.test(n)) {
    return { site: 'mgw', siteCategory: 'Shoes', subcategory: /\b(trainers?|sneakers?)\b/i.test(n) ? 'Trainers' : 'Shoes' };
  }
  if (/accessor/i.test(cat) || /\b(caps?|hats?|beanies?|belts?|wallets?|bags?|scarf|scarves|gloves|sunglasses)\b/i.test(n)) {
    const sub = /\b(caps?|hats?|beanies?)\b/i.test(n) ? 'Hats & Caps' : /\bbelts?\b/i.test(n) ? 'Belts' : /\b(wallets?|bags?)\b/i.test(n) ? 'Bags' : 'Accessories';
    return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: sub };
  }
  for (const [sub, re] of CLOTHES) if (re.test(n)) return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Clothing' };
}
