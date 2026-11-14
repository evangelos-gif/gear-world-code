// Import rules for Fila UK (Awin advertiser 19475, fila.co.uk) on Men's, Women's and Kids' Gear World (12 Nov 2026, lessons
// L117). New on every site. The feed comes only in the Google format (19475-retail-en_GB.csv.gz, Awin feed F295): 19,420
// rows = one row per size, 4,550 in stock on 1,206 product pages, prices in pounds; brands FILA and FILA Tennis; Google
// categories Shirts & Tops, Activewear, Coats & Jackets, Shoes, Trousers, Shorts, Skorts, Hats ... The feed has no gender
// or age column, so:
//  - Kids: "Junior", "Kids", "Boys", "Girls", "Infant", "Baby" in the name -> KGW (but a "Baby Tee", "Baby Tank" or
//    "Baby Ringer T-Shirt" is a women's fitted top, sold in women's sizes: WGW).
//  - Women: "Women's"/"Womens"/"Ladies" in the name, a women's garment (skirt, skort, dress, bikini, leggings, bralette,
//    sports bra, cropped, bandeau), or Fila's style code with the women's letter (the last part of the page address:
//    "tennis-essential-a-line-skirt-tw31e370" = Tennis Women, "loligo-trainer_ffw0296" = Footwear Women, "...-ss24w..." =
//    a women's season line) -> WGW.
//  - Everything else (men's and unisex) -> MGW.
//  - One card per product page (all sizes), at the lowest in-stock size price; the card name is what all sizes share.
//  - Left out: gift sets with a speaker and other non-clothing extras.
import { googleFeedFiles, googleField, stripOption } from './lib/google-feed.mjs';

export const RULES = {
  key: 'fila',
  advertiserId: 19475,
  retailer: 'Fila',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?fila\.co\.uk\//i,
  sites: ['mgw', 'wgw', 'kgw'],
  maxPrice: 400,
  minPrice: 5,
  commonVariantName: true
};

export const feedFiles = googleFeedFiles(RULES.advertiserId);
export const field = googleField;

export function displayBrand(brand) {
  return /tennis/i.test(String(brand || '')) ? 'FILA Tennis' : 'FILA';
}

export function displayName(name) {
  return stripOption(name);
}

// Fila's style code: the last part of the page address with letters and digits ("s22mh040", "tw31e370", "ffw0296").
export function styleCode(url) {
  let slug = '';
  try { slug = new URL(url).pathname.split('/').filter(Boolean).pop() || ''; } catch { return ''; }
  const parts = slug.toLowerCase().split(/[-_]/).filter(p => /[a-z]/.test(p) && /\d/.test(p) && p.length >= 6);
  return parts.length ? parts[parts.length - 1] : '';
}
const WOMEN_CODE = /^(?:[a-z]{1,2}\d{2}w|tw\d|ffw|lw\d|rw\d|fbl\d|xfl\d|tala)/;

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const KIDS = W(["junior'?s?", 'juniors', 'kids?', "kid's", 'boys?', "boy's", 'girls?', "girl's", 'infants?', 'baby(?! (?:tees?|tanks?|ringer|t-?shirts?|tops?))', 'toddlers?', 'youth', 'children']);
const WOMEN = W(["women'?s", 'womens', 'ladies', 'skirts?', 'skorts?', 'dress', 'bikini', 'leggings?', 'bralette', 'sports bra', 'cropped', 'crop top', 'bandeau', 'swimsuit', 'body ?suit', 'flared', 'baby (?:tees?|tanks?|ringer|t-?shirts?|tops?)']);

function place(site, n, gpc) {
  if (/shoes/i.test(gpc) || W(['trainers?', 'sneakers?', 'shoes?', 'slides?', 'sliders?', 'sandals?', 'mary jane', 'boots?', 'mules?', 'flip.?flops?', 'pumps?']).test(n)) {
    const sub = W(['slides?', 'sliders?', 'sandals?', 'flip.?flops?', 'mules?']).test(n) ? 'Sandals' : W(['boots?']).test(n) ? 'Boots'
      : W(['trainers?', 'sneakers?', 'runners?']).test(n) ? 'Trainers' : 'Shoes';
    return { siteCategory: 'Shoes', subcategory: sub };
  }
  const acc = site === 'kgw' ? null : 'Bags & Accessories';
  if (W(['caps?', 'beanies?', 'bucket hat', 'hats?', 'visors?', 'headbands?']).test(n) || /hats/i.test(gpc)) return acc ? { siteCategory: acc, subcategory: 'Hats' } : { siteCategory: 'Clothing', subcategory: 'Clothing' };
  if (W(['scarf', 'scarves', 'snood']).test(n)) return acc ? { siteCategory: acc, subcategory: 'Scarves' } : { siteCategory: 'Clothing', subcategory: 'Clothing' };
  if (W(['bags?', 'backpacks?', 'holdall', 'rucksack', 'tote', 'wash bag', 'pouch']).test(n)) return acc ? { siteCategory: acc, subcategory: 'Bags' } : { siteCategory: 'Clothing', subcategory: 'Clothing' };
  if (W(['socks?']).test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (site === 'kgw') {
    if (W(['pyjamas?', 'loungewear']).test(n)) return { siteCategory: 'Clothing', subcategory: 'Nightwear & Loungewear' };
    if (W(['joggers?', 'pants', 'trousers', 'leggings?', 'jeans']).test(n)) return { siteCategory: 'Clothing', subcategory: 'Trousers & Jeans' };
    if (W(['t-?shirts?', 'tees?', 'polos?', 'tops?', 'hoodie', 'sweatshirt']).test(n)) return { siteCategory: 'Clothing', subcategory: 'Shirts & Tops' };
    return { siteCategory: 'Clothing', subcategory: 'Clothing' };
  }
  if (W(['boxers?', 'briefs?', 'trunks', 'underwear', 'bras?(?! ?let)']).test(n) && !/sports bra/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Underwear' };
  const women = site === 'wgw';
  const rules = [
    [['tracksuits?'], women ? 'Activewear' : 'Tracksuits'],
    [['sports bras?', 'bralette', 'crop top'], women ? 'Sports Bras & Tops' : 'Vests'],
    [['dress(?:es)?'], women ? 'Dresses' : 'Clothing'],
    [['skirts?', 'skorts?'], women ? 'Skirts' : 'Shorts'],
    [['leggings?', 'tights'], women ? 'Leggings' : 'Trousers'],
    [['jackets?', 'track tops?', 'coats?', 'gilets?', 'puffer', 'windbreaker', 'anorak', 'parka', 'shell'], women ? 'Jackets & Coats' : 'Jackets'],
    [['hoodies?', 'hooded'], 'Hoodies'],
    [['sweatshirts?', 'crew ?neck sweat', '1/4 zip', 'quarter zip', 'half zip', 'sweater'], 'Sweatshirts'],
    [['shorts', 'short(?! ?sleeve)', 'swim shorts?'], 'Shorts'],
    [['knit', 'knitted', 'jumper', 'cardigan', 'roll neck'], 'Knitwear'],
    [['joggers?', 'jogger pants', 'sweatpants?', 'track ?pants?', 'trousers?', 'pants?', 'chinos?', 'jeans', 'flares?', 'bottoms'], 'Trousers'],
    [['unitard', 'catsuit', 'jumpsuit', 'playsuit'], women ? 'Activewear' : 'Clothing'],
    [['bikini', 'swimsuit', 'swimwear', 'bandeau'], women ? 'Clothing' : 'Shorts'],
    [['polos?', 'polo shirts?', 'overshirts?', 'shirts?(?! ?dress)'], women ? 'Tops & Blouses' : 'Shirts'],
    [['t-?shirts?', 'tees?', 'longsleeve', 'long sleeve top'], 'T-Shirts'],
    [['tank tops?', 'vests?', 'tanks?', 'tops?', 'crew'], women ? 'Tops & Blouses' : 'T-Shirts']
  ];
  for (const [words, sub] of rules) if (W(words).test(n)) return { siteCategory: 'Clothing', subcategory: sub };
  return { siteCategory: 'Clothing', subcategory: 'Clothing' };
}

export function classify({ name, feedCategory = '', url = '' }) {
  const n = displayName(name).replace(/[\u2018\u2019]/g, "'");
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher|speaker|gift set/i.test(n)) return { reject: 'gift set or not clothing' };
  const site = KIDS.test(n) ? 'kgw' : (WOMEN.test(n) || WOMEN_CODE.test(styleCode(url)) ? 'wgw' : 'mgw');
  return { site, ...place(site, n, feedCategory) };
}
