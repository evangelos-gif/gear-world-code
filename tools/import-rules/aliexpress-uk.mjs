// Import rules for AliExpress UK (Awin advertiser 7035, www.aliexpress.com in pounds), first wave on four of the older
// sites: Women's, Men's, Kids' and Home Gear World. Owner, 27 Nov 2026 (lessons L239): «Να ελεγχθεί σήμερα και να μπει
// αύριο με το all updates», with the UK, Ireland, Greece and Cyprus as the markets to fill first.
// Feed facts (download of 26 Nov 2026, read 27 Nov 2026): 15 feeds, about 2.8 GB; every row in GBP, English names,
// product pages on www.aliexpress.com/item/<number>.html with AliExpress's own affiliate query (kept: keepQuery).
// The first wave reads three feeds that Awin refreshed this week (263,000 rows); the big ones (200 to 300 MB each) wait
// for a second wave with its own dry run, and the old ones (last refreshed in 2025 or August 2026) are never read.
// - One card per AliExpress item (its page number); at most 300 cards a subcategory, fewer where a site's category is
//   already full (L164, L183), so a marketplace adds variety without burying the other shops.
// - Never: adult products, smoking and vaping, weapons, medicines and supplements, tattoos, contact lenses, costumes,
//   real fur, replicas; never a well-known brand or licensed character in the name (on a marketplace listing that is
//   often an imitation), so the card can only be a no-brand product or the maker's own brand.
// - Kids' Gear World: no collector figures, blind boxes, anime goods or figures made for adults; no car seats, prams,
//   safety gates or other safety products.
// - Home Gear World: home products only (lib/wave-a.mjs hgwPlace); appliances and lamps only with a UK plug or none named.
// - The Technology, Car, Sporty, Biker, Pets, Gaming and Travel sites, Garden and Construction come in a later wave.
import { join } from 'node:path';
import { rulesOf, noSale, SERVICE, PART, hgwPlace, wgwFashion, mgwFashion, audience, shoeSub, W, clean } from './lib/wave-a.mjs';

// The feeds of the first wave (data_feed_id): only ones Awin refreshed in the last days (download report of 27 Nov 2026:
// 103140 and 103143 on 27 Nov, 115677 on 24 Nov). Feed 102500 (last refreshed by Awin on 3 Nov 2025) and 97499 (14 Aug
// 2026) are old copies whose prices are not true now, so they stay out (L238: only true prices).
export const FEEDS = Object.freeze([103140, 103143, 115677]);
export const OLD_FEEDS = Object.freeze([102500, 102509, 97499]);

export const RULES = rulesOf({
  key: 'aliexpress-uk', advertiserId: 7035, retailer: 'AliExpress UK', currency: 'GBP',
  // Only AliExpress's own product pages.
  shop: /^https:\/\/www\.aliexpress\.com\/item\/\d{6,20}\.html/i,
  sites: ['wgw', 'mgw', 'kgw', 'hgw'],
  // Under £3 the feed has single buttons, stickers and spare parts; over £1,500 the prices look wrong for these sites.
  minPrice: 3, maxPrice: 1500,
  maxPerSubcategory: 300,
  // Categories that are already very full on their site get fewer cards a subcategory (L183).
  maxPerSubcategoryIn: { "Women's Jewellery": 60, 'Home Decor': 60, 'Clothing': 150 },
  // The link keeps AliExpress's own query (aff_fsk, src): Awin's tracking for this shop needs it (as AliExpress PL).
  keepQuery: true
});

export function feedFiles(archive) {
  return FEEDS.map(f => join(archive, `AWIN_7035_${f}.csv.gz`));
}

// One card per AliExpress item: the number of its page (each colour and size is a row of its own).
export function productKey(get) {
  const m = /\/item\/(\d{6,20})\.html/i.exec(get('merchant_deep_link') || '');
  return m ? m[1] : '';
}

const g = re => new RegExp(re.source, 'gi');
// Seller words that are not part of what the product is, and L107 words (no "sale" on a card).
const JUNK = W(['hot sale', 'hot selling', 'new arrivals?', 'free shipping', 'fast shipping', 'fast delivery', 'drop ?shipping', 'wholesale',
  'best sellers?', 'best selling', 'top quality', 'high quality', 'newest', 'brand new', 'new 20\\d\\d', '20\\d\\d new', 'in stock', 'sale', 'clearance',
  'discount', 'cheap', 'promotion']);

// Long marketplace names: the card keeps about the first 110 characters, cut at a word.
export function displayName(name) {
  const n = noSale(clean(name).replace(/_/g, ' ').replace(g(JUNK), ' ').replace(/\s*[,;/|]\s*(?=[,;/|])/g, '').replace(/\s{2,}/g, ' '))
    .replace(/^[\s,;:/|\-–]+|[\s,;:/|\-–]+$/g, '');
  if (n.length <= 110) return n;
  const cut = n.slice(0, 110);
  const at = cut.lastIndexOf(' ');
  return (at > 60 ? cut.slice(0, at) : cut).replace(/[\s,;:/|\-–(]+$/, '');
}

// Never on the sites, whatever the folder.
export const NEVER = W(['sex', 'sexy', 'sexual', 'erotic\\w*', 'vibrators?', 'dildos?', 'bdsm', 'fetish\\w*', 'adult toys?', 'masturbat\\w*', 'penis', 'vagina',
  'nipples?', 'strap-?on', 'butt plugs?', 'anal', 'lingerie sets? sexy', 'e-?cigs?', 'e-?cigarettes?', 'vapes?', 'vaping', 'vapori[sz]ers?', 'hookahs?',
  'shisha', 'bongs?', 'herb grinders?', 'tobacco', 'cigarettes?', 'smoking pipes?', 'rolling papers?', 'knuckles?', 'crossbows?', 'slingshots?',
  'catapults?', 'airsoft', 'bb guns?', 'gel blasters?', 'gel ball blasters?', 'pistols?', 'rifles?', 'shotguns?', 'ammo', 'ammunition', 'holsters?',
  'tactical', 'katanas?', 'swords?', 'machetes?', 'daggers?', 'switchblades?', 'butterfly knife', 'balisong', 'hunting knife', 'combat knife',
  'throwing knives', 'stun guns?', 'tasers?', 'pepper spray', 'handcuffs?', 'spy cameras?', 'hidden cameras?', 'medicines?', 'medical', 'pills?',
  'supplements?', 'viagra', 'steroids?', 'syringes?', 'tattoo\\w*', 'contact lens(?:es)?', 'colou?red contacts?', 'lottery', 'casino', 'replicas?',
  '1:1', 'super copy', 'fake', 'counterfeit', 'dupes?', 'inspired by', 'costumes?', 'cosplay', 'halloween', 'roleplay', 'role play', 'real fur',
  'genuine fur', 'mink fur', 'fox fur', 'rabbit fur', 'nazi', 'swastika', 'confederate', 'bunny girls?', 'hentai', 'ecchi', 'waifu', 'oppai',
  'personali[sz]ed', 'personali[sz]ation', 'custom (?:photos?|names?|text|faces?|pictures?|logos?)', 'your (?:photos?|faces?|names?|logos?)', 'custom made to order']);

// Well-known brands and licensed characters: on a marketplace listing they are often imitations, so they stay out.
export const KNOWN = W(['disney', 'marvel', 'avengers', 'spider-?man', 'batman', 'superman', 'wonder woman', 'dc comics', 'barbie', 'hello kitty', 'sanrio',
  'kuromi', 'my melody', 'cinnamoroll', 'pochacco', 'paw patrol', 'minions?', 'peppa', 'pokemon', 'pokémon', 'pikachu', 'star wars', 'mandalorian',
  'harry potter', 'hogwarts', 'mickey', 'minnie', 'toy story', 'bluey', 'cocomelon', 'elsa', 'lilo', 'stitch (?:plush|doll|figure|toy)', 'sonic',
  'mario', 'zelda', 'nintendo', 'playstation', 'xbox', 'minecraft', 'fortnite', 'roblox', 'among us', 'squid game', 'naruto', 'one piece (?:anime|manga|luffy|zoro|figures?)', 'luffy',
  'dragon ball', 'demon slayer', 'jujutsu kaisen', 'attack on titan', 'my hero academia', 'genshin', 'labubu', 'pop mart', 'bandai', 'gundam',
  'transformers', 'lego', 'duplo', 'technic', 'hot wheels', 'nerf', 'fisher-?price', 'vtech', 'care bears', 'sylvanian', 'lol surprise',
  'squishmallows?', 'jellycat', 'beanie boos?', 'funko', 'nike', 'adidas', 'jordan', 'yeezy', 'puma', 'new balance', 'converse', 'vans', 'reebok',
  'asics', 'under armour', 'north face', 'moncler', 'canada goose', 'stone island', 'gucci', 'louis vuitton', 'lv', 'chanel', 'dior', 'prada',
  'versace', 'balenciaga', 'burberry', 'fendi', 'herm[eè]s', 'givenchy', 'saint laurent', 'ysl', 'bottega', 'celine', 'loewe', 'valentino',
  'off-?white', 'supreme', 'palm angels', 'fear of god', 'ralph lauren', 'polo ralph', 'lacoste', 'tommy hilfiger', 'calvin klein', 'hugo boss',
  'armani', 'michael kors', 'coach bags?', 'coach handbags?', 'kate spade', 'ugg', 'uggs', 'crocs', 'birkenstock', 'dr\\.? ?martens', 'timberland',
  "levi'?s", 'zara', 'shein', 'rolex', 'cartier', 'omega seamaster', 'omega speedmaster', 'patek', 'audemars', 'tag heuer', 'g-?shock', 'casio',
  'apple', 'iphone', 'airpods', 'samsung', 'pandora', 'tiffany', 'swarovski', 'van cleef', 'bvlgari', 'bulgari', 'chopard', 'ray-?ban', 'oakley',
  'stanley', 'yeti', 'owala', 'dyson', 'ghd', 'olaplex', 'charlotte tilbury', 'le creuset', 'smeg', 'kitchenaid', 'nespresso', 'dolce gusto',
  'nexpresso', 'tassimo', 'keurig', 'ikea', 'philips hue', 'sonos', 'bose', 'jbl', 'beats', 'anime', 'manga', 'merch', 'merchandise', 'fandom',
  'for fans', 'fan art', 'moc', 'star ?destroyer', 'millennium falcon', 'death star', 'jedi', 'stormtroopers?', 'darth', 'yoda', 'grogu',
  'needoh', 'nee doh', 'bad bunny', 'taylor swift', 'k-?pop', 'bts', 'blackpink', 'wednesday addams', 'stranger things', 'squishmallow', 'bearbrick',
  'stokke', 'singers?', 'rappers?', 'tour', 'tours', 'album', 'concert', 'band tee', 'wrestl\\w*', 'video games?', 'game t-?shirt', 'gamers? tee',
  'movies?', 'films?', 'tv shows?', 'tv series', 'cartoon characters?', 'celebrit(?:y|ies)', 'beatles', 'elvis', 'marilyn monroe', 'nestle',
  'robocar', 'poli']);

// Sellers hide a brand or a title with a letter and a hyphen ("W-Wobbly Life", "O-Oliver-S"); the usual style words are fine.
const STYLE_WORDS = /^(?:shirts?|neck|line|shaped?|ring|rings|back|bar|neckline|type|frame|hook|bolt|lock|clip|cut|strap|sleeve|pin|top|tops|shirt|bag|bags|bottom|belt)$/i;
export function hiddenName(raw) {
  const re = /(?:^|[\s("'])([A-Z])-([A-Z][a-z]{2,})/g;
  let m;
  while ((m = re.exec(String(raw || '')))) if (!STYLE_WORDS.test(m[2])) return true;
  return false;
}

export function displayBrand(brand) {
  const b = clean(brand);
  if (!b || /^(none|other|others|oem|odm|no ?brand|unbranded|generic|n\/a)$/i.test(b) || KNOWN.test(b)) return 'AliExpress';
  return b.slice(0, 40);
}

// Kids' Gear World: figures and goods made for adult collectors.
const NOT_FOR_KIDS = W(['bunny girls?', 'bikini', 'swimsuit girls?', '18\\+', 'r-?18', 'ecchi', 'hentai', 'waifu', 'oppai', 'nude', 'naked', 'lingerie',
  'bishoujo', 'anime girls?', 'gk statues?', 'resin statues?', 'garage kits?', 'dakimakura', 'for adults', 'adults?', 'wine', 'beer', 'shot glass(?:es)?',
  'lighters?', 'knives', 'knife']);
// Plug words of another country: not for a UK home.
// Kids' Gear World: products where safety rules matter (sleep, car, gates, walkers): never from a marketplace listing.
const KGW_SAFETY = W(['safety', 'playpens?', 'play yards?', 'walkers?', 'jumper chairs?', 'doorway jumpers?', 'jumpers? (?:chair|seat)', 'bumpers?',
  'baby nests?', 'loungers?', 'sleep(?:ing)? (?:bags?|sacks?|pods?)', 'sleepsacks?', 'crib (?:fences?|rails?|bumpers?)', 'bed rails?', 'cribs?', 'cots?',
  'car seats?', 'harness(?:es)?', 'reins', 'teethers?', 'teething', 'pacifiers?', 'dummies', 'dummy', 'bottle warmers?', 'sterili[sz]ers?', 'magnets?',
  'magnetic balls?', 'water beads?', 'button batter(?:y|ies)', 'spa', 'hot tubs?']);
// Parts of something else (a board of a fan, a filter of a vacuum): not a product of these sites.
const PART_MORE = W(['driver boards?', 'control boards?', 'pcb', 'motherboards?', 'modules?', 'detectors?', 'motors?', 'replacement', 'spare parts?',
  'accessories for', 'compatible with', 'suitable for', 'for (?:dyson|xiaomi|roborock|ecovacs|shark|irobot|roomba)']);
const FOREIGN_PLUG = /european standard|\beu (?:standard|version)\b|\b(?:eu|us|au|jp|kr|br|cn|eur?)\s*-?\s*plugs?\b|\b110\s*-?\s*1[12]0?\s*v\b|\b110\s*v\b/i;

const at = (site, siteCategory, subcategory, name, extra = {}) => ({ site, siteCategory, subcategory, name, ...extra });
const OUT = reason => ({ reject: reason });
const LATER = 'not in the first AliExpress UK wave (Technology, Car, Sporty, Biker, Pets, Gaming, Travel, Garden and Construction come later)';

// The feed's folder: "Home & Garden , Home Textile , Cushion Cover" or "Home & Garden > Lighting" (Google style).
export function folders(feedCategory) {
  return String(feedCategory || '').split(/\s+,\s+|\s*>\s*/).map(s => s.trim()).filter(Boolean);
}

// The first eight words of a long marketplace name: what the product is, before the seller's extra words.
export const headWords = n => String(n || '').split(/\s+/).slice(0, 8).join(' ');
const SHOE_WORD = /\b(?:shoes?|boots?|booties|sandals?|heels?|pumps?|trainers?|sneakers?|slippers?|loafers?|mules?|flats|slides|wedges?|clogs?|espadrilles?|oxfords?|brogues?|moccasins?)\b/i;

// Women's or men's Gear World for a fashion product; `who` is the folder's or the name's audience.
function fashion(n, who, text) {
  // The first words of the name first ("8XL Men Parkas Jacket ... Detachable Hat" is a jacket), then the whole name, then
  // the folder: an AliExpress seller's folder is often wrong ("T-shirt" in "Sweaters & Jumpers").
  const head = headWords(n);
  if (who === 'women') { const p = wgwFashion(head, '') || wgwFashion(n, '') || wgwFashion(n, text); return p ? at('wgw', p.siteCategory, p.subcategory, n) : OUT("no place on Women's Gear World for this product"); }
  if (who === 'men') { const p = mgwFashion(head, '') || mgwFashion(n, '') || mgwFashion(n, text); return p ? at('mgw', p.siteCategory, p.subcategory, n) : OUT("no place on Men's Gear World for this product"); }
  if (who === 'kids') return kidsClothes(n, text);
  return OUT('not clearly for women, men or children');
}

// Bracelets before necklaces: "Cuban Chain Bracelet" is a bracelet.
const JEWEL = [['Bracelets', W(['bracelets?', 'bangles?', 'anklets?'])], ['Earrings', W(['earrings?', 'ear studs?', 'hoops?', 'ear cuffs?'])],
  ['Rings', W(['rings?'])], ['Necklaces', W(['necklaces?', 'pendants?', 'chokers?', 'chains?'])]];
function jewellery(n, who) {
  if (/making|beads? for|findings|packaging|display|boxes?|tools?|keychains?|key ?rings?|charms? for|shoe charms?|phone (?:chains?|charms?)|bag charms?/i.test(n)) return OUT('jewellery making, boxes, tools, keyrings or charms');
  const head = headWords(n);
  for (const [sub, re] of JEWEL) if (re.test(head)) return who === 'men' ? at('mgw', "Men's Jewellery", sub, n) : at('wgw', "Women's Jewellery", sub, n);
  for (const [sub, re] of JEWEL) if (re.test(n)) return who === 'men' ? at('mgw', "Men's Jewellery", sub, n) : at('wgw', "Women's Jewellery", sub, n);
  return OUT('no jewellery kind in the name');
}

// ---------------------------------------------------------------------------------------------------------------- KGW
const BABY = W(['baby', 'babies', 'newborns?', 'infants?', 'toddlers?', 'months?', '\\d+-\\d+m', '0-3m', 'nb']);
function kidsClothes(n, text = '') {
  const t = `${n} ${text}`;
  if (/\bsocks?\b|tights/i.test(n)) return at('kgw', 'Clothing', 'Socks', n);
  if (/pajamas?|pyjamas?|sleepwear|nightgowns?|nightdress|robes?|sleepsuits?|onesies? pajama/i.test(n)) return at('kgw', 'Clothing', 'Nightwear & Loungewear', n);
  if (/dance|leotards?|ballet|tutu/i.test(n)) return at('kgw', 'Clothing', 'Dancewear', n);
  if (/sneakers?|trainers?|running shoes?|sports shoes?/i.test(t)) return at('kgw', 'Shoes', 'Trainers', n);
  if (/snow boots?|winter boots?|\bboots?\b/i.test(n)) return at('kgw', 'Shoes', 'Winter Boots', n);
  if (/shoes?|sandals?|slippers?|loafers?|clogs?/i.test(n)) return at('kgw', 'Shoes', 'Shoes', n);
  if (/backpacks?|school bags?|schoolbags?/i.test(n)) return at('kgw', 'School & Backpacks', 'School Bags', n);
  if (/\b(?:dress(?:es)?|gowns?|skirts?|rompers?|jumpsuits?|outfits?|sets?)\b/i.test(headWords(n))) return at('kgw', 'Clothing', 'Clothing', n);
  if (/\b(?:hats?|caps?|beanies?|gloves?|mittens?|scarf|scarves|hair clips?|headbands?|hair bows?)\b/i.test(n)) return at('kgw', 'Accessories', 'Accessories', n);
  return at('kgw', 'Clothing', 'Clothing', n);
}

// Toys: [folder or name regex, category, subcategory], first match wins (read on "<folder> | <name>").
const TOYS = [
  [/jigsaw|puzzles?(?! box)/i, 'Toys & Games', 'Jigsaw Puzzles'],
  [/board games?|chess|checkers|monopoly|ludo/i, 'Toys & Games', 'Board Games'],
  [/card games?|playing cards|uno\b/i, 'Toys & Games', 'Card Games'],
  [/building (?:blocks?|bricks?|sets?|kits?)|construction toys?|\bbricks?\b|magnetic tiles?|magnetic blocks?/i, 'Toys & Games', 'Construction Set Toys'],
  [/remote control|\brc\b|r\/c/i, 'Toys & Games', 'Remote Control Cars & Lorries'],
  [/plush|stuffed|cuddly|teddy|soft toys?/i, 'Toys & Games', 'Stuffed Animals & Cuddly Toys'],
  [/doll ?house|dollhouse/i, 'Toys & Games', 'Dolls, Playsets & Toy Figures'],
  [/dolls? (?:clothes|accessor|shoes|outfits?)/i, 'Toys & Games', 'Doll & Action Figure Accessories'],
  [/\bdolls?\b/i, 'Toys & Games', 'Dolls'],
  [/aeroplanes?|airplanes?|planes?\b|jets?\b|gliders?/i, 'Toys & Games', 'Toy Aeroplanes'],
  [/trains?\b|railway|train sets?/i, 'Toys & Games', 'Toy Trains & Train Sets'],
  [/excavators?|diggers?|trucks?|lorr(?:y|ies)|tractors?|cranes?|construction vehicles?/i, 'Toys & Games', 'Toy Lorries & Construction Vehicles'],
  [/die-?cast|toy cars?|model cars?|alloy cars?|race cars?|pull back cars?|vehicles?\b|cars?\b/i, 'Toys & Games', 'Toy Cars'],
  [/play ?dough|slime|putty|clay\b/i, 'Toys & Games', 'Play Dough & Putty'],
  [/kitchen|play food|cooking set|tea set/i, 'Toys & Games', 'Toy Kitchens & Play Food'],
  [/musical|piano|xylophone|drums?\b|guitar/i, 'Toys & Games', 'Musical Toys'],
  [/craft|diy|painting|drawing|colou?ring|sticker books?|beads? kit|arts? (?:&|and) crafts?/i, 'Toys & Games', 'Toy Craft Kits'],
  [/robots?\b|robotic/i, 'Toys & Games', 'Robotic Toys'],
  [/science|experiment|microscope|telescope|stem\b|educational|learning|montessori|alphabet|numbers?\b|flash ?cards?/i, 'Toys & Games', 'Educational Toys'],
  [/bubbles?/i, 'Sports & Outdoors', 'Bubble Blowing Toys'],
  [/water (?:toys?|guns?|play)|pools?\b|paddling|sprinklers?|beach toys?|sand toys?/i, 'Sports & Outdoors', 'Water Play Equipment'],
  [/kites?|frisbee|outdoor games?|garden games?|skipping|hula hoops?|stilts|bean ?bags?/i, 'Sports & Outdoors', 'Outdoor Games'],
  [/fidget|squishy|stress relief|pop it|spinners?/i, 'Toys & Games', 'Activity Toys'],
  [/rattles?/i, 'Baby & Toddler', 'Rattles'],
  [/stacking|sorting|shape sorters?|stackers?/i, 'Baby & Toddler', 'Sorting & Stacking Toys'],
  [/baby|toddler|infant|newborn/i, 'Baby & Toddler', 'Baby Activity Toys']
];
function toy(n, sec, folderText) {
  if (/action (?:&|and) toy figures|trendy blind box|blind box|hobby (?:&|and) collectibles|acg goods|novelty (?:&|and) gag|animation derivatives|movies (?:&|and) tv|model building kits?|scale models?/i.test(folderText)) return OUT('collector figures, blind boxes, anime goods and licensed merchandise stay out');
  if (/figures?\b|figurines?|blind ?box|statues?|collectibles?|model kits?|gashapon|acrylic stands?|keychains?|badges?\b|pins?\b/i.test(n)) return OUT('figures, collectibles and fan goods stay out');
  if (/\bstickers?\b|\bdecals?\b|\b1\/\d{2,3}\b|scale models?|assembly models?|military|\btanks?\b|\bfor\s+(?:1\/\d+|rc)\b|\binserts?\b|\btires?\b|\btyres?\b|crawlers? parts/i.test(n)) return OUT('stickers, scale models, military models and RC parts stay out');
  const t = `${folderText} | ${n}`;
  for (const [re, cat, sub] of TOYS) if (re.test(n)) return at('kgw', cat, sub, n);
  for (const [re, cat, sub] of TOYS) if (re.test(t)) return at('kgw', cat, sub, n, { doubt: true });
  return at('kgw', 'Toys & Games', 'Toys & Games', n, { doubt: true });
}

// Mother & Kids folders.
function motherKids(n, sec, folderText) {
  if (/strollers?|prams?|car seats?|safety|baby care|baby furniture|sterili[sz]|diaper|nappy|wipes|maternity|pregnancy|souvenirs?/i.test(sec)) return OUT('prams, car seats, safety, care and maternity products stay out');
  if (/feeding/i.test(sec)) return at('kgw', 'Baby & Toddler', /bibs?/i.test(n) ? 'Bibs' : (/bottles?/i.test(n) ? 'Baby Bottles' : 'Nursing & Feeding'), n);
  if (/bedding/i.test(sec)) return /swaddl/i.test(n) ? at('kgw', 'Baby & Toddler', 'Swaddling Blankets', n) : at('kgw', 'Bedroom & Home', 'Bedroom & Home', n);
  if (/activity (?:&|and) gear/i.test(sec)) return at('kgw', 'Baby & Toddler', /play ?mats?|play gyms?/i.test(n) ? 'Play Gyms' : 'Baby Activity Toys', n);
  if (/shoes/i.test(sec)) return kidsClothes(n, 'shoes');
  if (/clothing|accessories/i.test(sec)) return kidsClothes(n, folderText);
  return OUT('a Mother & Kids folder that is not in the first wave');
}

// ---------------------------------------------------------------------------------------------------------------- HGW
function home(n, feedCategory, sec) {
  if (FOREIGN_PLUG.test(n)) return OUT('not a UK plug');
  const p = hgwPlace(n, feedCategory);
  if (p.reject) return OUT(p.reject);
  // Appliances and desks wait for a wave of their own: in the dry run of 27 Nov 2026 their names were too often a part,
  // a bag or a gadget ("Vacuum Food Bags", "Shoe Dryer", "Remote Control Organizer"), and a plug is rarely named.
  if (p.siteCategory === 'Home Appliances' || p.siteCategory === 'Home Office') return OUT('appliances and home office wait for a later AliExpress UK wave (UK plug and model checks)');
  return at('hgw', p.siteCategory, p.subcategory, n, p.doubt ? { doubt: true } : {});
}

function place({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return OUT('no name');
  if (SERVICE.test(n)) return OUT('gift card or service');
  const raw = clean(name);
  if (NEVER.test(raw)) return OUT('never on the sites (adult, smoking, weapons, medical, costumes, real fur or replicas)');
  if (KNOWN.test(raw) || hiddenName(raw)) return OUT('a well-known brand or licensed character in a marketplace listing (could be an imitation)');
  const f = folders(feedCategory);
  const top = (f[0] || '').toLowerCase();
  const sec = (f[1] || '').toLowerCase();
  const folderText = f.join(' > ');
  const who = audience(raw);

  // The folder's audience unless the name clearly says another one ("Men's Fleece Hoodie" in "Women's Clothing").
  if (top === "women's clothing") return fashion(n, who === 'men' || who === 'kids' ? who : 'women', folderText);
  if (top === "men's clothing") return fashion(n, who === 'women' || who === 'kids' ? who : 'men', folderText);
  if (top === 'underwear') return fashion(n, /^men/.test(sec) ? 'men' : 'women', folderText);
  if (top === 'shoes') {
    // A seller puts jackets and hats in "Women's Shoes" too: only a name with a shoe word is a shoe.
    const sw = /^women/.test(sec) ? 'women' : (/^men/.test(sec) ? 'men' : '');
    if (!sw) return OUT('shoe accessories');
    if (!SHOE_WORD.test(headWords(n))) return fashion(n, sw, '');
    return at(sw === 'women' ? 'wgw' : 'mgw', 'Shoes', shoeSub(n, sw === 'women' ? 'wgw' : 'mgw'), n);
  }
  if (top === 'apparel accessories') {
    if (/eyewear/i.test(sec)) return OUT('glasses and sunglasses wait (eye protection is not checked)');
    return fashion(n, who === 'kids' ? 'kids' : who, folderText);
  }
  if (top === 'luggage & bags') {
    if (/women'?s handbags/i.test(sec)) return fashion(n, 'women', 'bags');
    if (/men'?s bags/i.test(sec)) return fashion(n, 'men', 'bags');
    if (/kids'? bags|school bags/i.test(sec)) return at('kgw', 'School & Backpacks', 'School Bags', n);
    if (/wallets/i.test(sec) && (who === 'women' || who === 'men')) return fashion(n, who, 'wallets');
    return OUT('travel bags and luggage wait for Travel Gear World');
  }
  if (top === 'jewelry & accessories') {
    if (/fashion jewelry|fine jewelry/i.test(sec)) return jewellery(n, who === 'men' ? 'men' : 'women');
    return OUT('jewellery making, packaging and tools');
  }
  if (top === 'apparel & accessories') {
    if (/costumes/i.test(sec)) return OUT('costumes');
    if (/jewelry/i.test(sec)) return jewellery(n, who === 'men' ? 'men' : 'women');
    if (/handbags/i.test(sec)) return fashion(n, who === 'men' ? 'men' : 'women', 'bags');
    return fashion(n, who, folderText);
  }
  if (top === 'mother & kids') return motherKids(n, sec, folderText);
  if (top === 'toys & hobbies' || top === 'toys & games') {
    if (NOT_FOR_KIDS.test(raw)) return OUT('made for adults, not for Kids\' Gear World');
    return toy(n, sec, folderText);
  }
  if (top === 'home & garden') {
    if (/arts,? ?crafts|festive|party|pet products|security|garden supplies|garden/i.test(sec)) return OUT(LATER);
    return home(n, feedCategory, sec);
  }
  if (top === 'lights & lighting') {
    if (/indoor lighting|led lighting|night lights|bulbs|smart lighting|novelty lighting/i.test(sec)) return home(n, feedCategory, sec);
    return OUT('outdoor, portable, commercial and holiday lighting wait');
  }
  if (top === 'furniture') {
    if (/home furniture|office furniture|cabinets|furniture accessories/i.test(sec) || !sec) return home(n, feedCategory, sec);
    return OUT('outdoor, commercial, bar and children\'s furniture and parts wait');
  }
  if (top === 'home appliances') {
    if (/household|kitchen appliances|cleaning/i.test(sec)) return home(n, feedCategory, sec);
    return OUT('appliance parts, personal care and large appliances wait');
  }
  return OUT(LATER);
}

// The place, then the checks every site shares: only a clear place (never one from the folder alone), no part of
// something else, and on Kids' Gear World no product where safety rules matter.
export function classify(input) {
  const c = place(input);
  if (c.reject) return c;
  if (c.doubt) return OUT('no clear word in the name (a marketplace folder alone is not enough)');
  const raw = clean(input.name);
  if ((c.site === 'kgw' || c.site === 'hgw') && (PART.test(headWords(raw)) || PART_MORE.test(raw))) return OUT('a part or accessory of another product');
  if (c.site === 'kgw' && KGW_SAFETY.test(raw)) return OUT('a product where safety rules matter (sleep, car, gates, walkers, small magnets): not from a marketplace listing');
  // A seller's "Mother & Kids" or "Toys" folder with a product for grown-ups ("Women's Crossbody Bag", "Men's Wedding Shoes").
  if (c.site === 'kgw' && (audience(raw) === 'women' || audience(raw) === 'men')) return OUT("for grown-ups, not for Kids' Gear World");
  // Covers, films, mats and stickers of furniture, appliances or windows are not the furniture or the appliance.
  if (c.site === 'hgw' && /^(?:Furniture|Home Appliances|Lighting|Home Decor)$/.test(c.siteCategory) && !/^(?:Throw|Cushion|Curtain|Blinds|Rug)$/.test(c.subcategory) &&
    /\b(?:covers?|slipcovers?|protectors?|films?|stickers?|decals?|mats?|liners?|skins?|wraps?|strips?|tapes?)\b/i.test(headWords(raw))) return OUT('a cover, film, mat or sticker for another product');
  return c;
}
