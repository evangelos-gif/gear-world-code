// Import rules for Joybuy UK (Awin advertiser 123932) on the older Gear World sites.
// Joybuy is a big general shop: one plan places its products on five sites (one site per product):
//   WGW Beauty & Fragrances (done 21 Oct 2026), MGW Grooming & Fragrances (men's), GGW garden categories that were
//   empty, HGW Smart Home and Cleaning & Laundry, KGW Kids Tech and School & Backpacks.
//
// Joybuy UK is ALREADY on WGW, MGW, HGW and KGW (written by the Hub import router, retailer name 'Joybuy UK',
// awin_product_id '123932:<merchant_product_id>', merchant_product_id = the shop's product number). So:
//   - the product key is the feed's merchant_product_id, the router's id: a product already on a site is UPDATED,
//     never added twice (MGW/WGW by awin_product_id, KGW/HGW/GGW by retailer + merchant id);
//   - keepCategory: a product already on a site keeps its category; only new products get these categories;
//   - the plan is ADD-ONLY (addOnly): it covers only part of Joybuy, so the other Joybuy products on a site stay
//     as they are (legacy-import.ps1 hides nothing for an add-only plan);
//   - the link keeps the query part of the shop address, like the products already on the sites.
// Feed facts (gw-feed-gaps report, 21 Oct 2026): 28,990 rows, one row per product, prices in GBP, Google-style
// categories ("Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne"). Joybuy also files perfumes under
// "Home & Garden > Decor > Candles & Home Fragrances > Fragrance Oils", so a perfume NAME counts too.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { gardenPlace } from './lib/garden.mjs';

export const RULES = {
  key: 'joybuy',
  advertiserId: 123932,
  retailer: 'Joybuy UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?joybuy\.co\.uk\//i,
  sites: ['wgw', 'mgw', 'ggw', 'hgw', 'kgw'],
  maxPrice: 2000,
  addOnly: true,
  keepQuery: true,
  keepCategory: true
};

// The router's id for a Joybuy product: merchant_product_id (the number at the end of the shop address).
export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

// Joybuy writes both 'Hair Care' and 'Haircare'.
const BEAUTY_CATEGORY = /^Health & Beauty > Personal Care > (Cosmetics|Hair ?care)\b/i;
const DEODORANT_CATEGORY = /^Health & Beauty > Personal Care > Deodorant/i;
const SHAVING_CATEGORY = /^Health & Beauty > Personal Care > Shaving & Grooming/i;
export const FRAGRANCE_NAME = words(['eau de parfum', 'eau de toilette', 'eau de cologne', 'edp', 'edt', 'parfum', 'perfume', 'perfumes', 'extrait', 'body mist', 'fragrance mist', 'hair mist']);
// Perfume words that are not something you wear.
export const HOME_SCENT = words(['candle', 'candles', 'diffuser', 'diffusers', 'reed', 'reeds', 'room spray', 'home fragrance', 'wax melt', 'wax melts', 'air freshener',
  'car freshener', 'incense', 'oil burner', 'laundry', 'detergent', 'fabric softener', 'washing']);
export const MEN = words(['men', "men's", 'mens', 'man', 'male', 'for him', 'pour homme', 'homme', 'gents', 'gentleman', 'gentlemen', 'aftershave', 'after shave',
  'beard', 'shaving', 'shave', 'boyfriend']);
// Well-known men's perfume lines that often have no "men" in the name.
export const MEN_LINES = words(['sauvage', 'bleu de chanel', 'aventus', 'acqua di gio', 'acqua di giò', 'eros', 'invictus', '1 million', 'one million', 'le male', 'boss bottled',
  'terre d\'hermes', 'terre d’hermès', 'stronger with you', 'spicebomb', 'the one for men', 'dylan blue', 'phantom', 'wanted', 'fahrenheit', 'allure homme', 'ultra male',
  'polo blue', 'polo red', 'y eau de parfum', 'l\'homme', 'pour lui', 'bad boy', 'luna rossa', 'aqva', 'cool water man', 'toy boy',
  'uomo', 'montblanc legend', 'legend spirit', 'montblanc explorer', 'burberry hero', 'myslf', 'only the brave', 'boss the scent', 'le beau', 'kouros', 'aramis',
  'egoiste', 'azzaro chrome', 'davidoff', 'cool water', 'club de nuit intense', 'lattafa asad', 'asad', 'aqua di gio', 'k by dolce', 'ombre nomade man']);
export const WOMEN = words(['women', "women's", 'womens', 'woman', 'ladies', 'lady', 'female', 'for her', 'pour femme', 'femme', 'girl']);
export const UNISEX = words(['unisex']);
export const KIDS = words(['baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'kids', 'kid', "kid's", 'children', "children's", 'child', 'childs', 'junior', 'newborn', 'nappy']);
export const NOT_BEAUTY = words(['toothpaste', 'toothbrush', 'toothbrushes', 'mouthwash', 'floss', 'dental', 'denture', 'dentures', 'condom', 'condoms', 'lubricant', 'pregnancy',
  'ovulation', 'tampon', 'tampons', 'sanitary', 'incontinence', 'supplement', 'supplements', 'multivitamin', 'multivitamins', 'gummies', 'medicine', 'plaster', 'plasters',
  'bandage', 'bandages', 'thermometer', 'hearing aid', 'contact lens', 'contact lenses', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'toy', 'toys', 'doll', 'dolls', 'lice', 'nits',
  'tattoo machine', 'gift card', 'voucher', 'otoscope', 'ear wax', 'ear cleaner', 'ear camera']);
// Names in Chinese, Japanese or Korean script: the site is in English.
export const CJK = /[぀-ヿ㐀-鿿가-힯]/;

// Subcategory from the NAME first (Joybuy files many creams and serums under "Make-Up"), then from the feed category.
// Order matters: "tinted moisturiser" is make-up, "hair mask" is hair care, "brush set" is a beauty tool.
export const NAME_SUBS = [
  [FRAGRANCE_NAME, 'Fragrance'],
  [words(['gift set', 'gift sets', 'beauty set', 'advent calendar', 'gift box', 'skincare set', 'skin care set', 'starter kit', 'discovery set']), 'Gift sets'],
  [words(['hair dryer', 'hairdryer', 'straightener', 'straighteners', 'curler', 'curlers', 'curling wand', 'curling tong', 'curling tongs', 'hair styler',
    'multi-styler', 'airwrap', 'hot brush', 'hot air brush', 'crimper', 'waver']), 'Hair tools'],
  [words(['shampoo', 'conditioner', 'hair mask', 'hair oil', 'hair serum', 'dry shampoo', 'hair spray', 'hairspray', 'mousse', 'hair colour', 'hair color',
    'hair dye', 'root touch', 'heat protect', 'heat protection', 'leave-in', 'leave in', 'scalp', 'hair gel', 'hair wax', 'curl cream', 'peroxide',
    'grey coverage', 'permanent colour', 'semi permanent', 'texturising', 'texturizing', 'styling clay', 'texture clay', 'hair towel']), 'Hair care'],
  [words(['nail polish', 'nail varnish', 'gel polish', 'nail lacquer', 'nail art', 'nail file', 'top coat', 'base coat', 'cuticle', 'press-on nails',
    'false nails', 'nail', 'nails']), 'Nails'],
  [words(['epilator', 'epilators', 'ipl', 'razor', 'razors', 'dermaplaning', 'dermaplaner', 'hair removal', 'wax strips', 'bikini trimmer', 'lady shaver']), 'Hair removal'],
  [words(['makeup brush', 'make-up brush', 'makeup brushes', 'brush set', 'beauty blender', 'makeup sponge', 'eyelash curler', 'tweezers', 'makeup mirror',
    'vanity mirror', 'makeup bag', 'cosmetic bag']), 'Beauty tools'],
  [words(['lipstick', 'lip gloss', 'lip liner', 'lip stain', 'lip tint', 'lip oil', 'mascara', 'foundation', 'concealer', 'eyeliner', 'eyeshadow', 'eye shadow',
    'palette', 'blusher', 'blush', 'bronzer', 'highlighter', 'primer', 'setting spray', 'setting powder', 'pressed powder', 'loose powder', 'brow', 'eyebrow',
    'false lashes', 'eyelashes', 'lashes', 'bb cream', 'cc cream', 'tinted moisturiser', 'tinted moisturizer', 'contour', 'kohl', 'kajal', 'glitter']), 'Make-up'],
  [words(['serum', 'moisturiser', 'moisturizer', 'moisturising', 'moisturizing', 'cleanser', 'cleansing', 'face cream', 'night cream', 'day cream', 'eye cream',
    'face mask', 'sheet mask', 'mask', 'toner', 'essence', 'sunscreen', 'spf', 'retinol', 'hyaluronic', 'niacinamide', 'micellar', 'exfoliating', 'exfoliator',
    'exfoliant', 'peel', 'facial', 'face oil', 'dry oil', 'skin care', 'skincare', 'anti-ageing', 'anti-aging', 'wrinkle', 'acne', 'lip balm', 'face wash',
    'ampoule', 'pad', 'pads', 'liquid care', 'hydrator', 'blemish', 'pore', 'pores']), 'Skincare'],
  [words(['body lotion', 'body butter', 'body wash', 'shower gel', 'shower cream', 'bath', 'bath oil', 'body oil', 'body scrub', 'hand cream', 'hand wash', 'hand lotion', 'soap',
    'deodorant', 'anti-perspirant', 'antiperspirant', 'bubble bath', 'body cream']), 'Bath & body']
];
const CATEGORY_SUBS = [
  [/Perfume & Cologne/i, 'Fragrance'], [/Cosmetic Sets|Gift Sets/i, 'Gift sets'], [/Nail Care|Nail Polish/i, 'Nails'],
  [/Cosmetic Tools|Makeup Tools|Make-Up Tools/i, 'Beauty tools'], [/Hair Styling Tools/i, 'Hair tools'], [/Hair ?care/i, 'Hair care'],
  [/Skin Care/i, 'Skincare'], [/Bath & Body|Deodorant/i, 'Bath & body'], [/Shaving & Grooming|Hair Removal/i, 'Hair removal'], [/Make-?Up/i, 'Make-up']
];
// Words that make a name clearly beauty. A product placed only because of its feed category is listed for checking (L14).
export const BEAUTY_WORDS = words(['beauty', 'cosmetic', 'cosmetics', 'makeup', 'make-up', 'skin', 'face', 'body', 'hair', 'lip', 'lips', 'eye', 'eyes', 'lash', 'cream',
  'oil', 'balm', 'gel', 'wash', 'lotion', 'scent', 'fragrance', 'spray', 'powder', 'wax', 'comb', 'brush', 'sponge', 'mirror', 'wig', 'wigs', 'extensions', 'perfume']);

export function subcategoryOf(name, feedCategory) {
  for (const [re, sub] of NAME_SUBS) if (re.test(name)) return sub;
  for (const [re, sub] of CATEGORY_SUBS) if (re.test(feedCategory)) return sub;
  return 'Beauty';
}

// Women's hair removal often has no "women" in the name.
export const WOMEN_GROOMING = words(['venus', 'silk-épil', 'silk-epil', 'silk epil', 'epilator', 'epilators', 'ipl', 'dermaplaning', 'dermaplaner', 'lady shaver',
  'ladyshave', 'bikini', 'satinelle', 'lumea']);
export const MEN_TOOLS = words(['trimmer', 'trimmers', 'multigroom', 'multi-groom', 'clipper', 'clippers', 'shaver', 'shavers', 'beard']);
// Deodorant brands and lines for men.
const MEN_DEODORANT = words(['lynx', 'right guard', 'old spice', 'brut', 'axe', 'mitchum men']);

// Men's grooming on MGW: subcategory from the name.
// Order matters: a "grooming kit" with a clipper or shaver is a device, not a gift set; "Gillette Mach 3" is a razor.
const MEN_SUBS = [
  [FRAGRANCE_NAME, 'Fragrance'],
  [words(['cologne', 'aftershave', 'after shave']), 'Fragrance'],
  [words(['trimmer', 'trimmers', 'clipper', 'clippers', 'multigroom', 'multi-groom']), 'Trimmers & clippers'],
  [words(['razor', 'razors', 'blade', 'blades', 'shaving', 'shave', 'shaver', 'shavers', 'mach3', 'mach 3', 'fusion5', 'fusion', 'proglide', 'oneblade']), 'Shaving'],
  [words(['gift set', 'gift sets', 'grooming kit', 'grooming set']), 'Gift sets'],
  [words(['deodorant', 'anti-perspirant', 'antiperspirant', 'body spray', 'bodyspray']), 'Deodorant'],
  [words(['beard']), 'Beard care'],
  [/gillette/i, 'Shaving'],
  [words(['shower gel', 'body wash', '3 in 1', '3-in-1']), 'Grooming'],
  [words(['shampoo', 'conditioner', 'hair wax', 'hair clay', 'pomade', 'hair gel', 'styling']), 'Hair care'],
  [words(['moisturiser', 'moisturizer', 'face wash', 'cream', 'serum', 'cleanser', 'scrub', 'eye', 'spf', 'balm', 'skin', 'fluid', 'sunscreen']), 'Skincare'],
  [/\bspf\s?\d/i, 'Skincare']
];
export function menSubcategory(n) {
  for (const [re, sub] of MEN_SUBS) if (re.test(n)) return sub;
  return 'Grooming';
}

// Beauty (WGW) or men's grooming (MGW). Returns a place, a reject, or null when it is not beauty at all.
function beautyPlace(n, c) {
  const fragranceName = FRAGRANCE_NAME.test(n) && !HOME_SCENT.test(n);
  const beautyCategory = BEAUTY_CATEGORY.test(c) || DEODORANT_CATEGORY.test(c) || SHAVING_CATEGORY.test(c);
  if (!beautyCategory && !fragranceName) return null;
  // A hair dryer "with diffuser" is not a home scent.
  if (HOME_SCENT.test(n) && !/\bhair\b/i.test(n) && !/Hair ?care/i.test(c)) return { reject: 'home scent (candles, diffusers), not beauty' };
  // Perfume names: "Cherry Baby" and "Moschino Toy 2" are perfumes for women, not baby products or toys.
  const kidsText = fragranceName ? n.replace(/\bbaby\b/gi, ' ') : n;
  if (KIDS.test(kidsText)) return { reject: "baby or children's product" };
  const healthText = fragranceName ? n.replace(/\btoy\b/gi, ' ') : n;
  if (NOT_BEAUTY.test(healthText)) return { reject: 'health, dental or other personal care, not beauty' };
  const women = WOMEN.test(n), unisex = UNISEX.test(n);
  const men = MEN.test(n) || MEN_LINES.test(n) || /Men's|Mens\b/i.test(c);
  const mens = { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: menSubcategory(n) };
  if (men && !women && !unisex) return mens;
  if (SHAVING_CATEGORY.test(c) && !women && !WOMEN_GROOMING.test(n)) return mens;
  if (DEODORANT_CATEGORY.test(c) && MEN_DEODORANT.test(n) && !women) return mens;
  if (/Hair ?care > (Hair Clippers|Shaving)/i.test(c)) return mens;
  // "Philips 11-in-1 Trimmer 5000 ... MG5941" is a men's multigroom, even under a cosmetics category.
  if (MEN_TOOLS.test(n) && !women && !WOMEN_GROOMING.test(n)) return mens;
  const subcategory = subcategoryOf(n, c);
  const clear = NAME_SUBS.some(([re]) => re.test(n)) || BEAUTY_WORDS.test(n);
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory, ...(clear ? {} : { doubt: true }) };
}

// ---------- Home Gear World: Smart Home, Cleaning & Laundry ----------
export const SMART_HOME = words(['smart plug', 'smart plugs', 'smart bulb', 'smart bulbs', 'smart light', 'smart lights', 'smart lighting', 'smart thermostat',
  'smart speaker', 'smart display', 'smart lock', 'smart locks', 'smart hub', 'smart sensor', 'smart switch', 'smart radiator valve', 'smart blinds', 'smart curtain',
  'smart doorbell', 'smart alarm', 'smart smoke alarm', 'smart home', 'video doorbell', 'video doorbells', 'doorbell camera', 'security camera', 'security cameras',
  'indoor camera', 'outdoor camera', 'home camera', 'wifi camera', 'wi-fi camera', 'wireless camera', 'cctv', 'amazon alexa', 'with alexa', 'works with alexa',
  'echo dot', 'echo show', 'echo pop', 'google nest', 'google home', 'nest hub', 'nest cam', 'ring doorbell', 'ring camera', 'ring alarm', 'hive thermostat',
  'tado', 'philips hue', 'hue bulb', 'lightstrip', 'lightstrips', 'wifi plug', 'wi-fi plug', 'wifi bulb', 'wi-fi bulb', 'eufycam', 'eufy security', 'arlo',
  'blink outdoor', 'blink mini', 'switchbot', 'meross', 'govee', 'tapo', 'kasa']);
export const NOT_SMART_HOME = words(['smart tv', 'smart tvs', 'smartphone', 'smartphones', 'smart watch', 'smartwatch', 'case', 'cases', 'cover', 'covers', 'screen protector',
  'toy', 'toys', 'baby monitor', 'baby monitors', 'bracket', 'brackets', 'mount', 'mounts', 'hanger', 'accessory', 'accessories', 'replacement', 'strap', 'straps',
  'dash cam', 'car', 'kids', 'vacuum', 'phone', 'iphone', 'ipad', 'cooler', 'gaming']);
// A feed category alone is not enough (Joybuy files rugs, blankets and toilet rolls under cleaning): the name needs one of these too.
const CLEAN_HINT = words(['clean', 'cleaner', 'cleaners', 'cleaning', 'vacuum', 'vac', 'hoover', 'mop', 'mops', 'steam', 'steamer', 'laundry', 'washing', 'wash',
  'detergent', 'bleach', 'disinfectant', 'degreaser', 'descaler', 'limescale', 'sponge', 'sponges', 'scrubber', 'scourer', 'scourers', 'duster', 'cloth', 'cloths',
  'wipes', 'bin', 'bins', 'trash can', 'iron', 'ironing', 'airer', 'tumble dryer', 'washing machine', 'washer dryer', 'polish', 'stain remover', 'lint', 'fabric']);
const CLEANING_CATEGORY = /Household Appliances > (Vacuums|Floor & Steam Cleaners|Floor & Carpet|Laundry Appliances|Carpet)|Household Supplies > (Household Cleaning Supplies|Laundry Supplies)/i;
const CLEANING = words(['vacuum cleaner', 'vacuum cleaners', 'robot vacuum', 'robot vacuums', 'robot mop', 'cordless vacuum', 'stick vacuum', 'handheld vacuum',
  'upright vacuum', 'wet and dry vacuum', 'wet & dry vacuum', 'steam mop', 'steam cleaner', 'carpet cleaner', 'carpet washer', 'spot cleaner', 'window vac',
  'window vacuum', 'window cleaner', 'mop', 'mops', 'mop bucket', 'duster', 'dusters', 'microfibre cloths', 'cleaning cloths', 'cleaning spray', 'cleaning brush',
  'laundry basket', 'laundry baskets', 'laundry hamper', 'laundry bag', 'clothes airer', 'airer', 'airers', 'ironing board', 'steam iron', 'steam generator', 'garment steamer',
  'clothes steamer', 'washing powder', 'washing pods', 'washing capsules', 'laundry detergent', 'laundry liquid', 'fabric conditioner', 'fabric softener', 'washing up liquid',
  'dishwasher tablets', 'pedal bin', 'kitchen bin', 'recycling bin', 'sensor bin']);
const NOT_CLEANING = words(['flask', 'flasks', 'vacuum sealer', 'vacuum seal', 'vacuum storage', 'vacuum bags', 'vacuum insulated', 'insulated', 'cup', 'mug', 'tumbler',
  'bottle', 'car', 'pool', 'pressure washer', 'leaf', 'gutter', 'toy', 'toys', 'kids', 'jewellery', 'bracelet', 'test kit', 'pet hair remover glove',
  'hair dryer', 'hairdryer', 'hair straightener', 'hair clipper', 'hair removal', 'hair brush', 'hairbrush', 'skin', 'face', 'facial', 'makeup', 'make-up',
  'toilet tissue', 'toilet roll', 'kitchen roll', 'tissues', 'blanket', 'hoodie', 'runner', 'rug', 'rugs', 'duvet', 'pillow', 'towel', 'towels']);

// Order matters: a "Hoover" washing machine and a garment steamer are laundry; "washing up liquid" is kitchen cleaning.
function cleaningSub(n) {
  if (/robot/i.test(n) && /vacuum|\bmops?\b|hoover|deebot|roomba|roborock/i.test(n)) return 'Robot vacuums';
  if (/washing machine|washer dryer|tumble dryer|heat pump dryer|\bdryer\b/i.test(n)) return 'Laundry & ironing';
  if (/garment steamer|clothes steamer|handheld steamer|\bsteamer\b|\birons?\b|ironing/i.test(n)) return 'Laundry & ironing';
  if (/washing[ -]up|dish/i.test(n)) return 'Cleaning';
  if (/vacuum|\bvac\b|hoover/i.test(n)) return 'Vacuum cleaners';
  if (/steam|carpet|\bmops?\b|floor/i.test(n)) return 'Floor cleaning';
  if (/airer|laundry|washing|fabric|detergent|\blint\b/i.test(n)) return 'Laundry & ironing';
  if (/\bbins?\b|trash can/i.test(n)) return 'Bins';
  return 'Cleaning';
}

function homePlace(n, c) {
  if (/^(Food, Beverages|Toys & Games|Baby & Toddler|Apparel|Clothing & Accessories|Health & Beauty)/i.test(c)) return null;
  if (SMART_HOME.test(n) && !NOT_SMART_HOME.test(n)) {
    const sub = /camera|cctv|doorbell|eufycam|arlo|blink|\bring (doorbell|camera|alarm)/i.test(n) ? 'Security cameras & doorbells'
      : /bulb|light|lighting|lightstrip|hue/i.test(n) ? 'Smart lighting' : /plug|switch|socket/i.test(n) ? 'Smart plugs & switches' : 'Smart home';
    return { site: 'hgw', siteCategory: 'Smart Home', subcategory: sub };
  }
  if ((CLEANING.test(n) || (CLEANING_CATEGORY.test(c) && CLEAN_HINT.test(n))) && !NOT_CLEANING.test(n)) {
    return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSub(n) };
  }
  return null;
}

// ---------- Kids' Gear World: Kids Tech, School & Backpacks ----------
const KID_CONTEXT = words(['kids', 'kid', "kid's", 'children', "children's", 'childrens', 'child', 'junior', 'toddler', 'toddlers', 'boys', 'girls', 'paw patrol',
  'peppa', 'bluey', 'spider-man', 'frozen', 'disney', 'marvel', 'pokemon', 'minecraft', 'unicorn', 'dinosaur']);
const KIDS_TECH = words(['kids tablet', "kids' tablet", 'kids camera', 'kids smartwatch', 'kids smart watch', 'kids headphones', 'kids earbuds', 'kids projector',
  'children tablet', "children's tablet", 'children camera', "children's camera", 'children headphones', "children's headphones", 'instant camera', 'instant print camera',
  'digital camera', 'smartwatch', 'smart watch', 'headphones', 'walkie talkie', 'walkie talkies', 'walkie-talkie', 'walkie-talkies', 'karaoke', 'microphone', 'vtech',
  'leapfrog', 'kidizoom', 'toniebox', 'tonies', 'yoto', 'kids edition', 'tablet']);
const NOT_KIDS_TECH = words(['baby monitor', 'baby monitors', 'monitor', 'case', 'cases', 'cover', 'covers', 'screen protector', 'strap', 'straps', 'replacement',
  'lcd screen', 'rattle', 'soother', 'comforter', 'nursery', 'colouring', 'coloring', 'painting', 'drawing', 'adult', 'adults', 'baby camera', 'teether']);
// A VTech or LeapFrog product counts only when the name says what tech it is (not a slide, teether or stand).
const TECH_WORDS = words(['tablet', 'laptop', 'computer', 'watch', 'smartwatch', 'smart watch', 'camera', 'walkie', 'headphones', 'earbuds', 'microphone', 'speaker', 'learning', 'interactive',
  'electronic', 'game', 'games', 'console', 'phone', 'remote', 'radio', 'torch', 'projector', 'karaoke', 'globe', 'reader', 'pen', 'kidizoom', 'leapstart', 'leappad',
  'toniebox', 'tonies', 'yoto', 'player', 'robot', 'coding']);
const SCHOOL = words(['school bag', 'school bags', 'schoolbag', 'school backpack', 'book bag', 'lunch bag', 'lunch bags', 'lunch box', 'lunch boxes', 'lunchbox',
  'pencil case', 'pencil cases', 'pe bag']);
const BACKPACK = words(['backpack', 'backpacks', 'rucksack', 'rucksacks', 'satchel', 'gym bag', 'trolley bag']);
const NOT_SCHOOL = words(['drink', 'drinks', 'juice', 'pouches', 'snack', 'snacks', 'yoghurt', 'crisps', 'festool', 'makita', 'dewalt', 'milwaukee', 'tool', 'tools',
  'adult', 'adults', 'women', 'men', 'laptop', 'changing bag', 'nappy', 'baby carrier', 'thermos', 'food jar', 'business', 'hanger', 'hangers', 'blind bag',
  'keyring', 'keychain']);

function kidsPlace(n, c) {
  if (/^(Food, Beverages|Health & Beauty)/i.test(c)) return null;
  const kidsBrand = /\b(vtech|leapfrog|kidizoom|toniebox|tonies|yoto)\b/i.test(n);
  if (KIDS_TECH.test(n) && (KID_CONTEXT.test(n) || kidsBrand) && TECH_WORDS.test(n) && !NOT_KIDS_TECH.test(n)) {
    // "Kids' Tablet ... 5 MP rear camera" is a tablet.
    const sub = /walkie/i.test(n) ? 'Walkie-talkies' : /tablet/i.test(n) ? 'Kids tablets' : /camera/i.test(n) ? 'Kids cameras' : /watch/i.test(n) ? 'Kids smartwatches'
      : /headphone|earbud/i.test(n) ? 'Kids headphones' : 'Learning tech';
    return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: sub };
  }
  if ((SCHOOL.test(n) || (BACKPACK.test(n) && KID_CONTEXT.test(n))) && !NOT_SCHOOL.test(n) && (KID_CONTEXT.test(n) || /school|pencil/i.test(n))) {
    const sub = /lunch/i.test(n) ? 'Lunch bags & boxes' : /pencil/i.test(n) ? 'Pencil cases' : 'School bags & backpacks';
    return { site: 'kgw', siteCategory: 'School & Backpacks', subcategory: sub };
  }
  return null;
}

// Decide where one product goes. Returns { site, siteCategory, subcategory, doubt? } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const c = String(feedCategory || '');
  if (CJK.test(n)) return { reject: 'name not in English' };
  const beauty = beautyPlace(n, c);
  if (beauty) return beauty;
  const garden = gardenPlace(n, c);
  if (garden) return { site: 'ggw', ...garden };
  const home = homePlace(n, c);
  if (home) return home;
  const kids = kidsPlace(n, c);
  if (kids) return kids;
  return { reject: 'not in these plans (beauty, men\'s grooming, garden, smart home, cleaning, kids tech, school bags)' };
}
