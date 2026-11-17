// Import rules for KidInn (Tradeinn's kids shop, Daisycon 20605) on Kids' Gear World (Wave 3 of Daisycon, chat 9, 17 Nov 2026).
// Feed (download of 16-17 Nov 2026): 74,970 products, all in stock, all in pounds (the GB feed of the programme), English
// names in Tradeinn's pattern "<Brand> <Model> <Type> <Colour>  <For whom>" ("Funko Marvel Shang-chi Razor Fist Figure
// Multicolor  Kids", "Mom Disciple Woman Costume Orange M-L Woman", "Asalvo Basic Giraffe Baby Walker Pink  Kids"),
// Google's English category path ("Toys & Games|Toys|Dolls, Playsets & Toy Figures|Stuffed Animals", "Toys & Games|Games|
// Board Games", "Apparel & Accessories|Costumes & Accessories|Costumes", "Luggage & Bags|Backpacks", "Baby & Toddler|
// Nursing & Feeding"), 1,907 brands (Atosa 7,035 costumes, Funko 5,282, Safta 3,098 school bags ...).
// Tradeinn ships to the UK and prices in pounds: the default GB view, no deliversTo line.
// Only what is for children: the last word of the name ("Kids", "Junior", "Baby", "Boy", "Girl") or a toy/baby folder;
// anything for a woman, a man or an adult stays out (adult costumes, Funko figures sold to adults). The place comes from
// the category path (deepest folder first), with the subcategories Kids' Gear World already has (the rules of chat 3,
// L171: Dolls, Jigsaw Puzzles, Toy Craft Kits ...). At most 400 cards per subcategory (L161): a big catalogue must not bury
// the other shops.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const SHOP_URL = 'https://www.tradeinn.com/kidinn/en/';
export const RULES = {
  key: 'kidinn',
  network: 'daisycon',
  advertiserId: 20605,
  retailer: 'KidInn',
  currency: 'GBP',
  // Tradeinn's own product pages and its partner redirect (the page in the Daisycon link).
  shop: /^https:\/\/(www\.|partners\.)?tradeinn\.com\//i,
  sites: ['kgw'],
  minPrice: 3,
  maxPrice: 600,
  maxPerSubcategory: 400
};
export const field = daisyconField(SHOP_URL);
export const productKey = pageKey;

const words = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');

// "<name>  Kids" -> { name, who: 'Kids' }: Tradeinn puts for whom after two spaces at the end.
export function splitWho(name) {
  const s = String(name || '').replace(/\s+$/, '');
  const m = s.match(/^(.*?)\s{2,}([A-Za-z][A-Za-z ]{1,20})$/);
  if (m) return { name: m[1].replace(/\s{2,}/g, ' ').trim(), who: m[2].trim() };
  return { name: s.replace(/\s{2,}/g, ' ').trim(), who: '' };
}
const KIDS = /^(kids?|junior|juniors|baby|babies|boys?|girls?|infant|toddler|child|children)$/i;
const ADULT = /^(wom[ae]n|m[ae]n|adults?|ladies)$/i;

// Never on a children's site, whatever the folder says.
const NO = words(['sexy', 'lingerie', 'erotic', 'adult', 'adults', 'beer', 'wine', 'vape', 'lighter', 'knife', 'knives', 'airsoft', 'bb gun', 'gift card',
  'gift voucher', 'replacement part', 'spare part']);

// [folder or name words, siteCategory, subcategory]; the first that matches wins (deepest folder first).
const T = 'Toys & Games', B = 'Baby & Toddler', S = 'School & Backpacks', C = 'Clothing';
const PLACES = [
  // Google's folder names that hold several kinds: the general place (a deeper folder or the name says more).
  [words(['dolls, playsets & toy figures']), T, 'Action & Toy Figures'],
  [words(['toys & games']), T, 'Activity Toys'],
  [words(['stuffed animals?', 'plush', 'soft toys?', 'teddy', 'teddies', 'cuddly toys?']), T, 'Stuffed Animals & Cuddly Toys'],
  [words(['dolls?', 'doll houses?', 'dollhouses?', 'doll accessories']), T, 'Dolls'],
  [words(['action figures?', 'toy figures?', 'figures?', 'playsets?', 'play sets?']), T, 'Action & Toy Figures'],
  [words(['jigsaw puzzles?', 'jigsaws?', 'puzzles?']), T, 'Jigsaw Puzzles'],
  [words(['board games?', 'card games?', 'trading cards?', 'dice games?', 'party games?', 'games']), T, 'Board Games'],
  [words(['building toys', 'construction set toys', 'construction sets?', 'building sets?', 'building blocks?', 'blocks']), T, 'Construction Set Toys'],
  [words(['remote control toys', 'remote control', 'rc cars?', 'radio controlled']), T, 'Remote Control Cars & Lorries'],
  [words(['toy vehicles?', 'play vehicles?', 'toy cars?', 'die-?cast', 'toy trains?', 'train sets?']), T, 'Toy Cars'],
  [words(['play kitchens?', 'play food', 'toy kitchens?', 'pretend play', 'tea sets?']), T, 'Toy Kitchens & Play Food'],
  [words(['arts? & crafts?', 'craft kits?', 'crafts?', 'modelling', 'modeling', 'slime', 'play dough', 'playdough', 'clay']), T, 'Toy Craft Kits'],
  [words(['educational toys?', 'science kits?', 'learning toys?', 'stem']), T, 'Educational Toys'],
  [words(['baby walkers?', 'baby activity', 'baby toys?', 'rattles?', 'teethers?', 'activity gyms?', 'baby & toddler toys']), B, 'Baby Activity Toys'],
  [words(['nursing & feeding', 'feeding', 'baby bottles?', 'bottles?', 'bibs?', 'dummies', 'dummy', 'pacifiers?', 'sippy cups?', 'baby tableware']), B, 'Nursing & Feeding'],
  [words(['baby safety', 'baby gates?', 'safety gates?', 'baby monitors?']), B, 'Baby Safety'],
  [words(['backpacks?', 'school bags?', 'rucksacks?', 'trolley bags?']), S, 'Backpacks'],
  [words(['pencil cases?', 'school supplies', 'stationery', 'art supplies', 'colouring', 'coloring', 'markers?', 'crayons?', 'pencils?', 'notebooks?']), S,
    'Stationery & Art Supplies'],
  // "Costumes", not "Fancy Dress": a subcategory with the word "dress" would put costumes next to the dresses of a "dress"
  // search on the Hub, which ranks first by what a product IS (lessons L177, L178).
  [words(['costumes?', 'costumes? & accessories', 'fancy dress', 'dress-up', 'dress up']), C, 'Costumes'],
  [words(['toys']), T, 'Activity Toys']
];

export function displayName(name) {
  return splitWho(name).name;
}

export function classify({ name, feedCategory = '' }) {
  const { name: n, who } = splitWho(name);
  if (!n) return { reject: 'no name' };
  if (ADULT.test(who)) return { reject: `for ${who.toLowerCase()}, not for children` };
  if (NO.test(n)) return { reject: 'not for a children\'s site' };
  const parts = String(feedCategory).split('>')[0].split('|').map(s => s.trim()).filter(Boolean).reverse();
  const top = parts[parts.length - 1] || '';
  // "For whom" missing or "Unisex": only toys, games and baby things (Tradeinn writes "Unisex" for adult goods too).
  if (!KIDS.test(who) && !/^(toys & games|baby & toddler)$/i.test(top)) return { reject: `for "${who || 'anyone'}", not clearly for children` };
  for (const part of parts) for (const [re, cat, sub] of PLACES) if (re.test(part)) return { site: 'kgw', siteCategory: cat, subcategory: sub, name: n };
  // No folder says it: the name, listed under CHECK in the dry run.
  for (const [re, cat, sub] of PLACES) if (re.test(n)) return { site: 'kgw', siteCategory: cat, subcategory: sub, name: n, doubt: true };
  return { reject: 'not sure where it goes on Kids\' Gear World' };
}
