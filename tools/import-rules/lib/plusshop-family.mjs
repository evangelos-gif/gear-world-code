// Shared import rules for Plusshop UK (Awin 69306) and Bazta UK (Awin 116097): two shops of the same Danish group with
// the same catalogue and different prices. Both go on the sites, so a visitor can compare the two prices (owner's
// choice, 23 Oct 2026). One plan places each product on ONE site:
//   WGW Beauty & Fragrances, MGW Grooming & Fragrances (and Watches), HGW Cleaning & Laundry, Kitchen & Dining,
//   Home Decor (home fragrance), Bedding & Bath, Smart Home, KGW Toys & Games, Baby & Toddler, Kids Tech,
//   School & Backpacks, Sports & Outdoors, Accessories, GGW garden tools, watering, BBQ.
// Feed facts (awin-feed-sample of 23 Oct 2026, 19,918 / 19,894 rows in three feeds each):
//   - the same product is in two or three feeds (89999/90001 and 111951 for Plusshop): the product key is the shop
//     address without its query ("?gsnp"), so it becomes one card;
//   - merchant_product_category_path says who it is for: "Men > Personal Care > Fragrances > Eau de toilette",
//     "Women > Personal care > Makeup > Foundation", "Men > Women > Personal care > ..." (both),
//     "Children > Baby & children products > ...", "Home > Household > Cleaning > ...", with sale tags such as
//     "SUMMER DEALS" mixed in. merchant_category is only the last part ("Eau de parfum"), category_name is Awin's;
//   - adult products (Intimate, lubricants, vibrators), pet products (Hunter), car products (Car & bike), dental and
//     medical products, Christmas cards and electronics accessories are in the same feed: never on these sites.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { gardenPlace } from './garden.mjs';
import {
  FRAGRANCE_NAME, HOME_SCENT, MEN, MEN_LINES, WOMEN, UNISEX, CJK, NOT_BEAUTY, NAME_SUBS, SMART_HOME, NOT_SMART_HOME,
  WOMEN_GROOMING, MEN_TOOLS, menSubcategory
} from '../joybuy.mjs';

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

export function makeRules({ key, advertiserId, retailer, host }) {
  return {
    key,
    advertiserId,
    retailer,
    currency: 'GBP',
    shop: new RegExp(`^https:\\/\\/(uk\\.)?${host.replace(/\./g, '\\.')}\\/`, 'i'),
    sites: ['wgw', 'mgw', 'hgw', 'kgw', 'ggw'],
    maxPrice: 1500,
    // A 29p Christmas card or a 42p phone cover is not worth a card on the site.
    minPrice: 1
  };
}

// The shop address without "?gsnp": the same product in two feeds is one product.
export function productKey(get) {
  const link = String(get('merchant_deep_link') || '').trim();
  try {
    const slug = new URL(link).pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (/^[a-z0-9][a-z0-9._\-/]{1,200}$/.test(slug)) return slug;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

// The full category path goes to the rules through the Awin category (it is not stored on the site).
export function field(c, column) {
  if (c === 'category_name') return [column('merchant_product_category_path'), column('category_name')].filter(Boolean).join(' || ');
  return column(c);
}

// Sale tags and repeats in the path say nothing about the product.
const NOISE = /^(summer deals|hot deals|black friday|black week|cyber monday|outlet|sale|new|news|deals?|offers?)$/i;
export function pathParts(text) {
  const [path] = String(text || '').split(' || ');
  const seen = new Set();
  const parts = [];
  for (const raw of path.split('>')) {
    const s = raw.trim();
    if (!s || NOISE.test(s) || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    parts.push(s);
  }
  return parts;
}

// ---------- never on these sites ----------
const ADULT_PATH = /(^|>|\|)\s*(Intimate|Intimate play|Adult Toys|Erotic|Sex toys?|Lube|Lubricant & gels|Condoms?)\s*(>|\||$)/i;
const ADULT_NAME = words(['vibrator', 'vibrators', 'vibrating egg', 'dildo', 'dildos', 'stroker', 'strokers', 'masturbator', 'masturbators', 'lubricant', 'lubricants',
  'lube', 'condom', 'condoms', 'bondage', 'handcuffs', 'nipple clamps', 'anal', 'orgasm', 'penis', 'clitoral', 'sex', 'erotic', 'kinky', 'fetish',
  'g-spot', 'cock ring', 'butt plug', 'delay spray', 'arousal', 'libido', 'pjur', 'easyglide', 'easytoys', 'blowyo', 'billy boy', 'durex', 'satisfyer', 'womanizer',
  'we-vibe', 'shots toys', 'fifty shades', 'love egg', 'massage wand', 'wand massager']);
const ADULT_BRAND = /^(easytoys|easyglide|pjur|blowyo|sex & mischief|billy boy|durex|satisfyer|womanizer|we-vibe|shots|lelo|fun factory|doc johnson|bathmate|system jo|swede|rimba)$/i;
// Names only outside the children's part of the feed ("Keel Toys Cuddle Puppies Dog" is a soft toy); no "cat" alone ("Cat Eye" mascara).
const PET = words(['pet', 'pets', 'dog', 'dogs', 'puppy', 'puppies', 'kitten', 'kittens', 'cat litter', 'cat toy', 'cat toys', 'cat food', 'cat bed', 'cat tree',
  'scratching post', 'for cats', 'for dogs', 'aquarium', 'hamster', 'bird cage', 'dog bowl', 'chew toy']);
const CAR = /(^|\s)(Car & bike|Auto|Car accessories|Car care)(\s|$)/i;
const HEALTH = words(['toothpaste', 'toothbrush', 'toothbrushes', 'mouthwash', 'mouth wash', 'floss', 'dental', 'denture', 'dentures', 'whitening strips',
  'teeth whitening', 'condom', 'pregnancy', 'ovulation', 'tampon', 'tampons', 'sanitary', 'pantyliner', 'pantyliners', 'panty liners', 'incontinence', 'always ultra',
  'supplement', 'supplements', 'multivitamin', 'multivitamins', 'gummies', 'medicine', 'plaster', 'plasters', 'bandage', 'bandages', 'thermometer', 'hearing aid',
  'contact lens', 'lice', 'nits', 'ear wax', 'cold sore', 'painkiller', 'paracetamol', 'ibuprofen', 'antiseptic', 'first aid', 'compression', 'massager', 'massage gun',
  'tissues', 'toilet roll', 'toilet paper', 'kitchen roll', 'cotton buds', 'cotton pads']);
const HEALTH_PATH = /(^|\s)(Dental care|Toothbrushes|Mouth wash & dental floss|Massage & well-being|First aid|Medicine|Medical|Pharmacy)(\s|$)/i;
const SEASONAL = words(['christmas card', 'christmas cards', 'gift wrap', 'wrapping paper', 'gift tag', 'gift tags', 'gift bag', 'gift bags', 'cracker', 'crackers', 'tinsel', 'bauble',
  'baubles', 'christmas tree', 'halloween costume', 'party balloons', 'balloons']);
const ELECTRONICS_PATH = /^(Electronics & accessories|Electronics|Computer|Mobile|Phone)/i;
const PEST = words(['raid', 'insect', 'insects', 'ant', 'ants', 'cockroach', 'cockroaches', 'fly spray', 'flies', 'mosquito', 'mosquitoes', 'wasp', 'wasps', 'mouse trap',
  'mice', 'rat', 'rats', 'slug', 'slugs', 'weed killer', 'pesticide', 'insecticide', 'repellent', 'moth', 'moths']);

// ---------- watches (MGW, WGW, KGW) ----------
const WATCH_PATH = /(^|\s)(Wristwatches|Analog watches|Analogue watches|Digital watches|Sports watches|Children's watches|Watches)(\s|$)/i;
const SMART_WEAR = words(['smartwatch', 'smart watch', 'activity tracker', 'fitness tracker', 'smart band', 'fitness band', 'heart rate']);
const KID_WORDS = words(['kids', 'kid', "kid's", 'children', "children's", 'childrens', 'child', 'junior', 'toddler', 'baby', 'boys', 'girls', 'peppa pig', 'paw patrol',
  'disney', 'frozen', 'spider-man', 'spiderman', 'minnie', 'mickey', 'pokemon', 'unicorn', 'bluey', 'kidizoom']);

// ---------- beauty (WGW) and men's grooming (MGW) ----------
const BEAUTY_LEAF_SUBS = [
  [/^(Fragrances?|Eau de parfum|Eau de toilette|Eau de cologne|Perfume|Body mist|Deodorant)$/i, 'Fragrance'],
  [/^Gift sets?$/i, 'Gift sets'],
  [/^(Makeup|Foundation|Lipstick|Lipgloss|Lip gloss|Eyeshadow|Blush|Bronzer|Concealer & corrector|Pencil & eyeliner|Mascara|Lashes & brows|Face|Powder|Primer|Highlighter)$/i, 'Make-up'],
  [/^(Nails|Nail polish|Manicure & pedicure|Nail care)$/i, 'Nails'],
  [/^(Makeup accessories|Brushes|Brushes & sponges|Mirrors?)$/i, 'Beauty tools'],
  [/^(Shaving & hair removal|Hair removal|Wax strips)$/i, 'Hair removal'],
  [/^(Hair care & styling|Hair care|Shampoo & balsam|Shampoo & conditioner|Balsam|Styling|Care products|Hair accessories)$/i, 'Hair care'],
  [/^(Face & skin care|Face care|Face cream|Facial cleaners & masks|Skin care|Sunscreen & aftersun|Serum|Eye care)$/i, 'Skincare'],
  [/^(Body care|Bodyshampoo & shower gel|Bodywash & shower gel|Hygiene|Hand wash|Toilet and bathroom|Cream & lotion|Bath|Soap)$/i, 'Bath & body']
];
const BEAUTY_PATH = /(^|\s)(Personal care|Personal Care|Makeup|Fragrances|Face & skin care|Hair care & styling|Hygiene|Body care|Nails|Lashes & brows|Shaving & hair removal|Shaving & hair-cutting)(\s|$)/i;
const BEAUTY_NAME = words(['eau de parfum', 'eau de toilette', 'perfume', 'parfum', 'cologne', 'body mist', 'shampoo', 'conditioner', 'shower gel', 'body wash', 'body lotion',
  'hand cream', 'face cream', 'serum', 'moisturiser', 'moisturizer', 'cleanser', 'toner', 'face mask', 'sheet mask', 'mascara', 'lipstick', 'lip gloss', 'foundation',
  'concealer', 'eyeliner', 'eyeshadow', 'nail polish', 'deodorant', 'antiperspirant', 'anti-perspirant', 'aftershave', 'after shave', 'beard', 'razor', 'razors',
  'blades', 'shaving', 'hair spray', 'hairspray', 'hair dye', 'bath bomb', 'body scrub', 'sunscreen', 'spf', 'lashes', 'false eyelashes', 'brow', 'makeup', 'make-up',
  'cosmetic', 'cosmetics', 'beauty case']);
// Men's shaving that often has no "men" in the name.
const MEN_SHAVING = /\b(gillette|mach ?3|fusion ?5|proglide|proshield|skinguard|razor blades|shaving (foam|gel|cream|soap|brush)|after ?shave|wilkinson sword (hydro|quattro|xtreme))\b/i;

function beautySub(n, leaf) {
  if (/\b(eyelash curler|lash curler|tweezers)\b/i.test(n)) return 'Beauty tools';
  for (const [re, sub] of NAME_SUBS) if (re.test(n)) return sub;
  for (const [re, sub] of BEAUTY_LEAF_SUBS) if (re.test(leaf)) return sub;
  return 'Beauty & Fragrances';
}

// ---------- home (HGW) ----------
const CLEAN_PATH = /(^|\s)(Cleaning|Clean, iron & dry|Cleaning products|Laundry|Steam mop & cleaner|Vacuum cleaners|Dishwasher|Washing up|Detergent|Fabric softener)(\s|$)/i;
const CLEAN_NAME = words(['clean', 'cleaner', 'cleaners', 'cleaning', 'detergent', 'washing powder', 'washing liquid', 'laundry', 'fabric softener', 'fabric conditioner',
  'softener', 'rinse aid', 'bleach', 'disinfectant', 'antibacterial', 'degreaser', 'grease remover', 'limescale', 'descaler', 'stain remover', 'mop', 'mops', 'duster',
  'dusters', 'sponge', 'sponges', 'scourer', 'scourers', 'microfibre', 'microfiber', 'cloth', 'cloths', 'wipes', 'dishwasher', 'dishwashing', 'washing up', 'washing-up',
  'scrub daddy', 'scrub mummy', 'swiffer', 'vacuum', 'hoover', 'lint', 'ironing', 'airer', 'pegs', 'bin bags', 'polish', 'toilet cleaner', 'oven cleaner']);
const HOME_SCENT_NAME = words(['air freshener', 'air fresheners', 'room spray', 'plug-in', 'plug in', 'reed diffuser', 'diffuser', 'wax melt', 'wax melts', 'scented candle',
  'candle', 'candles', 'febreze', 'glade', 'air wick', 'airwick', 'airpure', 'freshmatic', 'scented bag', 'scented sachet']);
const KITCHEN_PATH = /(^|\s)(Kitchen|Wine & cocktail|Cutting boards|Cookware & Utensils|Cutlery|Kitchen utensils|Baking)(\s|$)/i;
const BATH_PATH = /(^|\s)(Bathroom accessories|Bathroom)(\s|$)/i;

function cleaningSubPS(n, parts) {
  const p = parts.join(' > ');
  if (/fabric softener|fabric conditioner|\bsoftener\b/i.test(n) || /Fabric softener/i.test(p)) return 'Fabric Softener';
  if (/dishwasher|dishwashing|washing[- ]up|dish soap|rinse aid/i.test(n)) return 'Dishwashing';
  if (/detergent|washing (powder|liquid|gel|pods|capsules)|laundry (liquid|gel|pods|capsules|sheets)|colour catcher|color catcher|stain remover|vanish|woolwash/i.test(n)) return 'Laundry Detergent';
  if (/robot vacuum|vacuum cleaner|cordless vacuum|stick vacuum|handheld vacuum/i.test(n) && !/bag|filter|brush|tyre|spare|parts?\b|replacement/i.test(n)) return 'Vacuum Cleaner';
  if (/vacuum|hoover|irobot|roomba|\bvac\b/i.test(n)) return 'Vacuum Accessories';
  if (/duster|dusting/i.test(n)) return 'Duster';
  if (/\bmops?\b|swiffer|steam mop/i.test(n)) return 'Mop';
  if (/\bbrush(es)?\b/i.test(n)) return 'Cleaning Brush';
  if (/cloths?\b|sponges?\b|scourers?\b|scrub (daddy|mummy)|microfib|wipes|eraser|erase away|cleaning pads?/i.test(n)) return 'Cloths & Sponges';
  if (/\biron\b|ironing|steamer|lint|clothes brush|fabric shaver/i.test(n)) return 'Ironing & Clothes Care';
  if (/airer|drying rack|pegs?\b|washing line/i.test(n)) return 'Clothes Airer';
  if (/laundry (basket|bag|hamper)|hamper/i.test(n)) return 'Laundry Basket';
  if (/\bbins?\b|bin bags|rubbish/i.test(n)) return 'Bins & Bin Bags';
  if (/gloves?/i.test(n)) return 'Cleaning Gloves';
  return 'Cleaning Products';
}

function kitchenSubPS(n) {
  if (/cocktail|wine|corkscrew|uncorker|bottle opener|bar set|shaker|gin|decanter|vacu vin/i.test(n)) return 'Bar Accessories';
  if (/chopping board|cutting board|serving board/i.test(n)) return 'Chopping Board';
  if (/knife|knives|sharpener/i.test(n)) return 'Kitchen Knives';
  if (/\bpans?\b|\bpots?\b|wok|saucepan|casserole|frying/i.test(n)) return 'Cookware';
  if (/\bmugs?\b|\bcups?\b|glass|glasses|tumbler|bottle|flask/i.test(n)) return 'Drinkware';
  if (/\bbowls?\b|\bplates?\b|dinner set|tableware|cutlery|spoons?|forks?/i.test(n)) return 'Tableware';
  if (/storage|container|jar|lunch box|food box/i.test(n)) return 'Food Storage';
  return 'Kitchen Utensil';
}

// ---------- kids (KGW) ----------
const CHILD_PATH = /(^|\s)(Children|Baby & children products|Baby toys|Kids)(\s|$)/i;
const KIDS_TECH_NAME = /\b(cameras?|smart ?watch(es)?|walkie[- ]?talkies?|headphones?|earbuds?|earphones?|tablets?|karaoke|microphones?|kidizoom|projector|instant print)\b/i;
const NOT_KIDS_TECH_NAME = /\b(case|cover|bag|strap|play-?doh|playmobil|lego|duplo|mega bloks|rattle|teether|toy kitchen|doll|dolls|stroller|pram|sticker|stickers)\b/i;
const SCHOOL_NAME = /\b(school ?bags?|book ?bags?|backpacks?|rucksacks?|pencil ?cases?|lunch ?(box|boxes|bag|bags)|pe bag|gym bag|satchel)\b/i;
const STATIONERY_NAME = /\b(crayons?|colouring|coloring|coloured pencils|colored pencils|pencils?|markers?|felt tips?|pens?|eraser|rulers?|sharpener|notebooks?|stationery|glue|scissors)\b/i;
const OUTDOOR_NAME = /\b(scooter|scooters|trampoline|swing|swings|slide|sandpit|sand pit|paddling pool|pool|inflatable|bike|bicycle|helmet|life ?jacket|swim|swimming|armbands|goal|croquet|kite|kites|football|basketball|frisbee|water gun|garden game|outdoor game|bubbles?)\b/i;

function kidsTechSub(n) {
  if (/walkie/i.test(n)) return 'Walkie-talkies';
  if (/tablet/i.test(n)) return 'Kids Tablets';
  if (/camera|instant print/i.test(n)) return 'Kids Cameras';
  if (/watch|kidizoom/i.test(n)) return 'Kids Smartwatches';
  if (/headphone|earbud|earphone/i.test(n)) return 'Headphones';
  if (/karaoke|microphone/i.test(n)) return 'Karaoke & Microphones';
  return 'Kids Tech';
}

function babySub(n, p) {
  if (/soother|pacifier|dummy|dummies/i.test(n)) return 'Baby Soothers';
  if (/teether|teething/i.test(n)) return 'Dummies & Teethers';
  if (/teats?|nipples?/i.test(n) && /bottle/i.test(n + p)) return 'Baby Bottle Teats & Liners';
  if (/bottle/i.test(n) || /Bottles & accessories/i.test(p)) return 'Baby Bottles';
  if (/\bbibs?\b/i.test(n)) return 'Bibs';
  if (/sippy|beaker|cup/i.test(n)) return 'Sippy Cups';
  if (/bowl|plate|spoon|feeding|food/i.test(n) || /Eat & drink/i.test(p)) return 'Nursing & Feeding';
  if (/wipes/i.test(n)) return 'Baby Wipes';
  if (/nappy|nappies|diaper/i.test(n)) return 'Nappies';
  if (/changing/i.test(n) || /Changing/i.test(p)) return 'Changing Mats & Trays';
  if (/bath (seat|chair|tub|ring)|bathtub|bath support/i.test(n)) return 'Baby Bathtubs & Bath Seats';
  if (/potty|toilet seat|toilet trainer|step stool/i.test(n)) return 'Potty Training';
  if (/corner protector|safety|gate|lock|guard|socket cover/i.test(n)) return 'Baby Safety';
  if (/thermometer|nasal|aspirator/i.test(n)) return 'Baby Health';
  if (/shampoo|lotion|oil|wash|soap|cream|sunscreen|sun cream|bath/i.test(n) || /Bathroom & care/i.test(p)) return 'Baby Bathing';
  if (/rattle/i.test(n)) return 'Rattles';
  if (/bath toy/i.test(n)) return 'Bath Toys';
  if (/Baby toys/i.test(p) || /activity|play ?gym|mobile|stacking|sorting|push|pull/i.test(n)) return 'Baby Activity Toys';
  return 'Baby & Toddler';
}

function toySub(n, p) {
  const t = `${n} ${p}`;
  if (/\b(lego|duplo|mega bloks|megabloks|bricks)\b|Building & construction/i.test(t)) return 'Construction Set Toys';
  if (/\bplaymobil\b/i.test(n)) return 'Dolls, Playsets & Toy Figures';
  if (/\b(barbie|dolls?|baby born|tiny toes|happy friend|reborn|polly pocket|lol surprise)\b/i.test(n) || /Dolls/i.test(p)) return 'Dolls';
  if (/\b(schleich|figures?|action figure|jurassic|transformers|dc universe|marvel|avengers|wwe)\b/i.test(n) || /Figures & action heroes/i.test(p)) return 'Action & Toy Figures';
  if (/\b(jigsaw|puzzles?)\b/i.test(n)) return 'Jigsaw Puzzles';
  if (/\b(card game|playing cards|uno|top trumps)\b/i.test(n)) return 'Card Games';
  if (/\b(board game|game|games|dominoes|four in a row|connect 4|chess|monopoly|cluedo|twister|jenga)\b/i.test(n) || /(^|\s)Games(\s|$)/i.test(p)) return 'Board Games';
  if (/\b(nerf|blasters?|darts?|toy guns?|target)\b/i.test(n) || /Toy weapons/i.test(p)) return 'Toy Weapons & Gadgets';
  if (/\b(track|race track|raceway)\b/i.test(n) && /\b(hot wheels|cars?|racing)\b/i.test(n)) return 'Toy Racing Car & Track Sets';
  if (/\b(remote control|remote controlled|rc car|radio controlled)\b/i.test(n)) return 'Remote Control Cars & Lorries';
  if (/\b(hot wheels|matchbox|toy cars?|die-?cast|monster trucks?|vehicles?|trucks?|tractors?|diggers?|fire engine|police car)\b/i.test(n)) return 'Toy Cars';
  if (/\b(slime|play-?doh|clay|putty|dough|kinetic sand)\b/i.test(n)) return 'Play Dough & Putty';
  if (/\b(crayola|colouring|coloring|paint|painting|drawing|craft|crafts|stickers?|beads|art set|sketch)\b/i.test(n) || /Creative toys|Drawing & painting/i.test(p)) return 'Toy Craft Kits';
  if (/\b(plush|teddy|soft toy|cuddly|cuddle|keel toys|squishmallows?|stuffed)\b/i.test(n)) return 'Stuffed Animals & Cuddly Toys';
  if (/\b(toy kitchen|play food|tea set|cooking set|shopping trolley|cash register)\b/i.test(n)) return 'Toy Kitchens & Play Food';
  if (/\b(xylophone|drums?|piano|keyboard|guitar|musical|maracas|tambourine)\b/i.test(n)) return 'Musical Toys';
  if (/\bbath\b/i.test(n)) return 'Bath Toys';
  if (/\b(science|experiment|microscope|telescope|magnifying)\b/i.test(n)) return 'Science & Exploration Sets';
  if (/\btrains?\b/i.test(n)) return 'Toy Trains & Train Sets';
  if (/\b(vtech|leapfrog|learning|educational|alphabet|counting)\b/i.test(n)) return 'Educational Toys';
  return 'Toys & Games';
}

function outdoorSub(n) {
  if (/pool|swim|life ?jacket|armbands|inflatable|water gun|water play/i.test(n)) return 'Water Play Equipment';
  if (/scooter/i.test(n)) return 'Riding Scooters';
  if (/bike|bicycle|helmet/i.test(n)) return 'Bicycles';
  if (/trampoline/i.test(n)) return 'Trampolines';
  if (/swing|slide/i.test(n)) return 'Play Swings';
  if (/bubble/i.test(n)) return 'Bubble Blowing Toys';
  return 'Outdoor Games';
}

// ---------- garden (GGW) ----------
const GARDEN_PATH = /(^|\s)(Garden tools|Tools and garden appliances|Garden|Water hoses and accessories|Grill & accessories|Barbecue|BBQ)(\s|$)/i;
const WATERING = /\b(hose|hoses|hosepipe|spray gun|spray nozzle|nozzle|sprinkler|sprinklers|watering can|watering|hose reel|hose connector|irrigation)\b/i;
const GARDEN_TOOL = /\b(pruning|pruner|pruners|secateurs|shears|loppers|hedge|trowel|fork|rake|hoe|spade|shovel|cultivator|weeder|dibber|saw|hacksaw|garden gloves|planting|planter|kneeler|leaf grabber|transplanter)\b/i;

function gardenToolSub(n) {
  if (/pruning|pruner|secateurs|shears|loppers|hedge|saw/i.test(n)) return 'Pruning & Cutting';
  if (/gloves|kneeler|knee pad/i.test(n)) return 'Garden Gloves & Accessories';
  return 'Hand Tools';
}

// gardenPlace calls everything with "BBQ" in the name a barbecue: wipes, steak sets and brushes are accessories.
function bbqFix(place, n) {
  if (place && place.siteCategory === 'BBQ & Outdoor Cooking' && place.subcategory === 'BBQs'
    && /\b(wipes|cleaner|cleaning|set|steak|knife|knives|tools?|tongs|brush|thermometer|cover|skewers?|apron|gloves?|board|spatula|fork)\b/i.test(n)) {
    return { ...place, subcategory: 'BBQ accessories' };
  }
  return place;
}
const CAR_NAME = /\b(turtle wax|car wash|car shampoo|car wax|wheel cleaner|alloy wheel|tyre|tyres|dashboard|windscreen|car interior|car seat|sunshades?|for cars?)\b/i;

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '', awinCategory = '', brand = '' }) {
  const n = String(name || '').trim();
  const leaf = String(feedCategory || '').trim();
  const parts = pathParts(awinCategory);
  const p = parts.join(' > ');
  const awin = String(awinCategory || '').split(' || ')[1] || '';
  const all = `${p} > ${leaf} > ${awin}`;
  if (CJK.test(n)) return { reject: 'name not in English' };
  if (ADULT_PATH.test(all) || ADULT_NAME.test(n) || ADULT_BRAND.test(String(brand || '').trim()) || /Adult Toys/i.test(awin)) return { reject: 'adult product' };
  if (/(^|\s)Pet accessories(\s|$)/i.test(p)) return { reject: 'pet product' };
  if (CAR.test(p) || CAR_NAME.test(n) || (/^Car Accessories$/i.test(awin) && /\bcar\b/i.test(n))) return { reject: 'car or bike product (not on these sites)' };
  if (SEASONAL.test(n) || /Christmas cards|gift wrap/i.test(p)) return { reject: 'cards, gift wrap or party items' };

  const pathMen = parts.includes('Men');
  const pathWomen = parts.includes('Women');
  const children = CHILD_PATH.test(p);

  // Watches: kids -> KGW, smartwatches -> Technology (later), women -> WGW, others -> MGW.
  if (WATCH_PATH.test(`${p} > ${leaf}`) && /\bwatch(es)?\b|kidizoom/i.test(n)) {
    if (KID_WORDS.test(n) || children) {
      if (/smart|kidizoom/i.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Smartwatches' };
      return { site: 'kgw', siteCategory: 'Accessories', subcategory: 'Kids Watches' };
    }
    if (SMART_WEAR.test(n)) return { reject: 'smartwatch or fitness tracker (Technology Gear World, later)' };
    if (WOMEN.test(n) || /\blady\b|ladies/i.test(n) || (pathWomen && !pathMen)) return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' };
    return { site: 'mgw', siteCategory: 'Watches', subcategory: 'Watches' };
  }

  // Children: KGW. Kids' shampoo, school bags, toys, baby feeding and kids' tech.
  if (children) {
    if (HEALTH.test(n) && !/toothbrush/i.test(n)) return { reject: 'health or dental product' };
    if (/toothbrush|toothpaste/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby Health & Grooming Kits' };
    if (KIDS_TECH_NAME.test(n) && !NOT_KIDS_TECH_NAME.test(n) && !/toy camera|camera toy|play camera/i.test(n)) {
      return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: kidsTechSub(n) };
    }
    if (SCHOOL_NAME.test(n) || /School bags/i.test(p)) {
      const sub = /lunch/i.test(n) ? 'Lunch Boxes & Bags' : /pencil ?case/i.test(n) ? 'Pencil Cases' : 'School Bags';
      return { site: 'kgw', siteCategory: 'School & Backpacks', subcategory: sub };
    }
    if (/School accessories/i.test(p) && STATIONERY_NAME.test(n) && !/Creative toys/i.test(leaf)) {
      return { site: 'kgw', siteCategory: 'School & Backpacks', subcategory: 'Stationery & Art Supplies' };
    }
    if (/(^|\s)(Baby toys|Bottles & accessories|Eat & drink|Changing|Bathroom & care|Decor & children's room|Baby bath)(\s|$)/i.test(`${p} > ${leaf}`)
      || /\b(soother|pacifier|dummy|teether|baby bottle|nappy|nappies|bibs?)\b/i.test(n)) {
      return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: babySub(n, p) };
    }
    if (/Outdoor toys|Outdoor play|Sport/i.test(p) || OUTDOOR_NAME.test(n)) return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: outdoorSub(n) };
    if (/(^|\s)(Activities & play time|Toys|Creative toys|Figures & action heroes|Dolls & accessories|Barbie dolls|Games|Toy weapons|Remote controlled toys|Baby & children products)(\s|$)/i.test(`${p} > ${leaf}`)) {
      return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: toySub(n, p) };
    }
    return { reject: "children's product not in these plans" };
  }

  if (PET.test(n)) return { reject: 'pet product' };
  if (HEALTH_PATH.test(p) || HEALTH_PATH.test(leaf) || (/^Medical$/i.test(awin) && !BEAUTY_NAME.test(n))) return { reject: 'health or dental product' };

  // Beauty and grooming.
  const fragranceName = FRAGRANCE_NAME.test(n) && !HOME_SCENT.test(n);
  if (BEAUTY_PATH.test(p) || BEAUTY_PATH.test(leaf) || fragranceName || BEAUTY_LEAF_SUBS.some(([re]) => re.test(leaf))
    || ((pathWomen || /^Women$/i.test(leaf)) && BEAUTY_NAME.test(n))) {
    if (/dishwash|washing[- ]up|laundry|detergent/i.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
    const healthText = fragranceName ? n.replace(/\btoy\b/gi, ' ') : n;
    if (NOT_BEAUTY.test(healthText) || HEALTH.test(healthText)) return { reject: 'health, dental or hygiene product (not beauty)' };
    if (/\b(toiletry bag|wash bag|washbag|cosmetic bag|makeup bag|make-up bag|vanity case|beauty case)\b/i.test(n)) {
      return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
    }
    const women = WOMEN.test(n) || WOMEN_GROOMING.test(n);
    const unisex = UNISEX.test(n);
    const men = MEN.test(n) || MEN_LINES.test(n);
    const shaving = MEN_SHAVING.test(n) || MEN_TOOLS.test(n) || /Shaving & hair-cutting/i.test(`${p} > ${leaf}`);
    if (!women && !unisex && (men || shaving || (pathMen && !pathWomen))) {
      return { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: menSubcategory(n) };
    }
    return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: beautySub(n, leaf) };
  }

  // Sunglasses and fashion accessories in "Accessories".
  if (/\bsunglasses\b/i.test(n)) {
    const site = WOMEN.test(n) || /\blady\b|ladies/i.test(n) || (pathWomen && !pathMen) ? 'wgw' : 'mgw';
    return { site, siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses' };
  }

  if (ELECTRONICS_PATH.test(p) || /^(Cables|Mobile Phone Accessories|Accessories for phones and tablets|Covers, cases & holders|Power banks and batteries|Headphones & headset|Computer & gaming accessories|Game Console|PC & TV accessories|Electronics|Electronics & accessories)$/i.test(leaf)) {
    if (SMART_HOME.test(n) && !NOT_SMART_HOME.test(n) && !/fake|dummy/i.test(n)) return homeSmart(n);
    return { reject: 'electronics accessory (Technology Gear World, later)' };
  }
  if (/(^|\s)(Sport & fitness|Training accessories|Fitness)(\s|$)/i.test(`${p} > ${leaf}`)) return { reject: 'sport and fitness (no site for it yet)' };

  // Garden: furniture, lighting, BBQ (gardenPlace has its own "no" list), then hand tools and watering.
  const garden = bbqFix(gardenPlace(n, ''), n);
  if (garden) return { site: 'ggw', ...garden };
  if (GARDEN_PATH.test(`${p} > ${leaf}`)) {
    if (PEST.test(n)) return { reject: 'pest control' };
    if (WATERING.test(n)) return { site: 'ggw', siteCategory: 'Watering & Irrigation', subcategory: /hose/i.test(n) ? 'Hoses & Reels' : 'Spray Guns & Nozzles' };
    if (GARDEN_TOOL.test(n)) return { site: 'ggw', siteCategory: 'Garden Tools', subcategory: gardenToolSub(n) };
    return { reject: 'tools, not garden (not in these plans)' };
  }

  // Home: smart home, home fragrance, cleaning, kitchen, bathroom.
  if (/Home security/i.test(`${p} > ${leaf} > ${awin}`) || (SMART_HOME.test(n) && !NOT_SMART_HOME.test(n))) {
    if (/fake|dummy|imitation/i.test(n)) return { reject: 'fake security camera' };
    return homeSmart(n);
  }
  if (PEST.test(n)) return { reject: 'pest control' };
  if (HOME_SCENT_NAME.test(n) && !/car\b/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Home Fragrance' };
  if (KITCHEN_PATH.test(`${p} > ${leaf} > ${awin}`)) {
    if (CLEAN_NAME.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
    return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: kitchenSubPS(n) };
  }
  if (CLEAN_PATH.test(`${p} > ${leaf}`) || (/^Household$/i.test(leaf) && CLEAN_NAME.test(n)) || /^(Cleaning|Vacuum Cleaners)$/i.test(awin) && CLEAN_NAME.test(n)) {
    if (/\b(toilet roll|kitchen roll|tissues)\b/i.test(n)) return { reject: 'paper consumables' };
    return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
  }
  if (BATH_PATH.test(`${p} > ${leaf}`)) {
    if (/\b(tissues|toilet roll|toilet paper|kleenex)\b/i.test(n)) return { reject: 'paper consumables' };
    return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: /towel/i.test(n) ? 'Towel' : 'Bathroom Accessories' };
  }
  return { reject: 'not in these plans (beauty, grooming, watches, home, cleaning, kids, garden)' };
}

function homeSmart(n) {
  const sub = /doorbell/i.test(n) ? 'Video Doorbell' : /camera|cctv/i.test(n) ? 'Security Camera' : /bulb|light/i.test(n) ? 'Smart Bulb'
    : /plug|socket/i.test(n) ? 'Smart Plug' : /sensor|alarm/i.test(n) ? 'Motion Sensor' : 'Smart Home Accessories';
  return { site: 'hgw', siteCategory: 'Smart Home', subcategory: sub };
}
