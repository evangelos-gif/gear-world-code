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
// "Palmolive Aquarium Hand Soap" is a soap scent and "Disiclin Pet‑Friendly Multi‑Surface Cleaner" a cleaner (dry run, 23 Oct 2026).
const petText = n => n.replace(/\bpet[\s\-‐‑–]?friendly\b/gi, ' ').replace(/\baquarium(?=\s+(hand soap|hand wash|liquid soap|soap|shower gel))/gi, ' ');
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
const SMART_WEAR = words(['smartwatch', 'smart watch', 'activity tracker', 'fitness tracker', 'smart band', 'fitness band', 'heart rate', 'apple watch', 'galaxy watch',
  'garmin', 'fitbit', 'amazfit', 'ticwatch', 'huawei watch', 'gps watch']);
// "Apple Watch 42/44 mm Silicone Strap", "Garmin Fenix 6 Strap 22 mm" and "Aluminium Watch Box - 5 Watches" are not watches;
// "Casio ... Digital Watch - Black Resin Strap" is.
const SMART_STRAP = /\b(apple watch|galaxy watch|garmin|fenix|fitbit|ticwatch|amazfit|huawei watch|mi band)\b/i;
function watchAccessory(n) {
  return (SMART_STRAP.test(n) && /\b(straps?|bands?|cases?|covers?|chargers?|protectors?)\b/i.test(n))
    || /\bwatch (box|boxes|winders?|stands?|holders?|straps?|bands?|tools?|cases?)\b/i.test(n)
    || (/\b(straps?|bands?)\b/i.test(n) && !/\bwatch(es)?\b/i.test(n))
    // "Repair kit for watches" (second dry run, 24 Oct 2026).
    || /\b(for watch(es)?|repair kits?|tool kits?|link removers?|case openers?|spring bars?)\b/i.test(n);
}
// Watch names often give only the brand and the model number: "A|X Armani Exchange AX5900 ZOE", "Kenneth Cole 10022939".
const WATCH_MODEL = /\b[A-Z]{0,5}[- ]?\d{4,8}[A-Z0-9-]*\b/;
const KID_WORDS = words(['kids', 'kid', "kid's", 'children', "children's", 'childrens', 'child', 'junior', 'toddler', 'baby', 'boys', 'girls', 'peppa pig', 'paw patrol',
  'disney', 'frozen', 'spider-man', 'spiderman', 'minnie', 'mickey', 'pokemon', 'unicorn', 'bluey', 'kidizoom']);

// ---------- beauty (WGW) and men's grooming (MGW) ----------
const BEAUTY_LEAF_SUBS = [
  // A deodorant is body care, not a perfume (WGW has no deodorant subcategory).
  [/^(Fragrances?|Eau de parfum|Eau de toilette|Eau de cologne|Perfume|Body mist)$/i, 'Fragrance'],
  [/^Gift sets?$/i, 'Gift sets'],
  [/^(Makeup|Foundation|Lipstick|Lipgloss|Lip gloss|Eyeshadow|Blush|Bronzer|Concealer & corrector|Pencil & eyeliner|Mascara|Lashes & brows|Face|Powder|Primer|Highlighter)$/i, 'Make-up'],
  [/^(Nails|Nail polish|Manicure & pedicure|Nail care)$/i, 'Nails'],
  [/^(Makeup accessories|Brushes|Brushes & sponges|Mirrors?)$/i, 'Beauty tools'],
  [/^(Shaving & hair removal|Hair removal|Wax strips)$/i, 'Hair removal'],
  [/^(Hair care & styling|Hair care|Shampoo & balsam|Shampoo & conditioner|Balsam|Styling|Care products|Hair accessories)$/i, 'Hair care'],
  [/^(Face & skin care|Face care|Face cream|Facial cleaners & masks|Skin care|Sunscreen & aftersun|Serum|Eye care)$/i, 'Skincare'],
  [/^(Body care|Bodyshampoo & shower gel|Bodywash & shower gel|Hygiene|Hand wash|Toilet and bathroom|Cream & lotion|Bath|Soap|Deodorants?)$/i, 'Bath & body']
];
const BEAUTY_PATH = /(^|\s)(Personal care|Personal Care|Makeup|Fragrances|Face & skin care|Hair care & styling|Hygiene|Body care|Nails|Lashes & brows|Shaving & hair removal|Shaving & hair-cutting)(\s|$)/i;
const BEAUTY_NAME = words(['eau de parfum', 'eau de toilette', 'perfume', 'parfum', 'cologne', 'body mist', 'shampoo', 'conditioner', 'shower gel', 'body wash', 'body lotion',
  'hand cream', 'face cream', 'serum', 'moisturiser', 'moisturizer', 'cleanser', 'toner', 'face mask', 'sheet mask', 'mascara', 'lipstick', 'lip gloss', 'foundation',
  'concealer', 'eyeliner', 'eyeshadow', 'nail polish', 'deodorant', 'antiperspirant', 'anti-perspirant', 'aftershave', 'after shave', 'beard', 'razor', 'razors',
  'blades', 'shaving', 'hair spray', 'hairspray', 'hair dye', 'bath bomb', 'body scrub', 'sunscreen', 'spf', 'lashes', 'false eyelashes', 'brow', 'makeup', 'make-up',
  'cosmetic', 'cosmetics', 'beauty case',
  // Shower and soap products Awin files under "Medical" ("Nivea Cream Care Shower", dry run of 23 Oct 2026).
  'shower', 'shower cream', 'shower oil', 'shower foam', 'bath foam', 'bubble bath', 'hand soap', 'hand wash', 'handwash', 'liquid soap', 'soap', 'body cream',
  'body butter', 'body oil', 'roll-on', 'body spray']);
// Men's shaving that often has no "men" in the name.
const MEN_SHAVING = /\b(gillette|mach ?3|fusion ?5|proglide|proshield|skinguard|razor blades|shaving (foam|gel|cream|soap|brush)|after ?shave|wilkinson sword (hydro|quattro|xtreme))\b/i;
// Nail clippers and pedicure tools are for everyone: WGW Nails, not men's "Trimmers & clippers".
const NAIL_TOOL = /\b(nail|nails|pedicure|manicure|cuticle)\b/i;
// Home cleaning products the feed files under personal care ("Domestos ... Toilet Rim Block" under Hygiene).
// No "bleach" here: "Jolen Creme Bleach" is a facial hair bleach.
const HOME_CLEAN_NAME = /\b(dishwash(er|ing)?|washing[- ]up|dish ?soap|laundry|detergent|toilet (blocks?|gel|cleaner|rim)|rim blocks?|wc (gel|blocks?|cleaner)|toilet duck|domestos|harpic)\b/i;
// "Sesderma ... Intimate Velvet Care Gel" is intimate hygiene, not beauty.
const INTIMATE_CARE = /\b(intimate|feminine (wash|hygiene)|vaginal|femigel)\b/i;
// Creams and serums "with Multivitamins" are skincare, not supplements.
const SKIN_FORM = /\b(cream|serum|lotion|moisturi[sz]er|balm|mask|cleanser|toner|face oil|body oil|spf)\b/i;
const TOILETRY_BAG = /\b(toiletry bag|wash bag|washbag|cosmetic bag|makeup bag|make-up bag|vanity case|beauty case)\b/i;

// Sorting of 24 Oct 2026: products that were in the general "Beauty & Fragrances" group or on the wrong page, with real
// names from the WGW database. Self-tan is skin care ("Dove Body Love Gradual Tanning Mousse" was hair care because of
// "mousse"); its mitts and applicators are tools.
const TAN_TOOL = /\b(tanning|tan|self[- ]?tan\w*) (mitts?|gloves?|applicators?)\b|\bapplicator mitts?\b/i;
const SELF_TAN = /\b(self[- ]?tan\w*|tanning (mousse|foam|lotion|oil|spray|elixir|water|drops|gel|cream|mist)|gradual tan\w*|tan (mousse|lotion|drops|water|extender)|bronzing (water|mousse|lotion|drops))\b/i;
// Hair-only brands: "Pantene ... Sorbet Mask" and "Olaplex No. 8 ... Moisture Mask" are hair care, not face masks.
const HAIR_BRAND = /\b(pantene|tresemm[eé]|olaplex|lee stafford|head & shoulders|herbal essences|aussie|elvive|fructis|timotei|got2b|batiste|k[eé]rastase|redken)\b/i;
// Perfumes named without "eau de parfum": "Dolce & Gabbana Light Blue Intense 50ML".
const DESIGNER_PERFUME = /^(dolce & gabbana|d&g|hugo boss|calvin klein|giorgio armani|emporio armani|armani|versace|paco rabanne|rabanne|carolina herrera|jean paul gaultier|yves saint laurent|ysl|lanc[oô]me|gucci|burberry|chlo[eé]|marc jacobs|viktor & rolf|mugler|davidoff|azzaro|issey miyake|kenzo|givenchy|prada|valentino|bvlgari|bulgari|montblanc|tommy hilfiger|ralph lauren|jimmy choo|michael kors|dkny|elie saab|narciso rodriguez|cartier|herm[eè]s|dior|chanel|tom ford)\b.*\b\d{2,3} ?ml\b/i;
// Feed folders ("merchant_category") that had no page yet.
const BEAUTY_LEAF_MORE = [
  [/^(Blackhead & pimple removers|Face moisturisers & serum|Scrubs & cleansers)$/i, 'Skincare'],
  [/^(Body lotion|Hand ?cream & oil|Hand creme & oil|Hand soap & disinfectant|Hand wash & disinfectant)$/i, 'Bath & body'],
  [/^(Conditioner|Hair treatments, oil & serum|Hairspray)$/i, 'Hair care'],
  [/^(Hair ?brushes)$/i, 'Hair tools'],
  [/^(Eyes|Highlighter & contour|Lipliner|Lips)$/i, 'Make-up'],
  [/^(Mirrors & organi[sz]ers|Organi[sz]ers|Sponges|Cotton & cotton swabs)$/i, 'Beauty tools'],
  [/^(Foot & nail files)$/i, 'Nails']
];

function beautySub(n, leaf) {
  if (/\b(eyelash curler|lash curler|tweezers)\b/i.test(n)) return 'Beauty tools';
  // "e.l.f. Angled Foundation Brush", "Revlon Essentials Flat Brush", "Kashoki Brush Case": tools, not make-up.
  if (/\b(foundation|flat|kabuki|blending|powder|contour|blush|blusher|bronzer|eyeshadow|eye shadow|concealer|angled|stippling|buffing|fan|liner|brow|lip|makeup|make-up|oval) brush(es)?\b|\bbrush (set|kit|case|cleaner|holder)\b/i.test(n)) return 'Beauty tools';
  if (TAN_TOOL.test(n)) return 'Beauty tools';
  if (SELF_TAN.test(n)) return 'Skincare';
  // Women's razors and shaving gels ("Gillette Women Simply Venus", "Gillette Satin Care Sensitive Gel") are hair removal on WGW.
  if (/\b(venus|satin care|shav(e|ing) (gel|foam|cream))\b/i.test(n)) return 'Hair removal';
  if (/\b(thermal protect\w*|heat protect\w*|hair clips?|hair grips?|hair ties|hair bands?|bobbles|scrunchies?|hair ?pins?|bobby pins?)\b/i.test(n)) return 'Hair care';
  // "Vaseline Pure Petroleum Original Jelly" too.
  if (/\b(make-?up remover|cleansing wipes|facial wipes|petroleum)\b/i.test(n)) return 'Skincare';
  // "La Roche-Posay Anthelios SPF50 Anti-Shine Mist" is sun care; "Revlon Large Round Hair Brush" a hair tool.
  if (/\bspf ?\d+|\bsun (protect\w*|cream|milk|spray|mist|lotion)\b|\bafter ?sun\b|\banthelios\b/i.test(n)) return 'Skincare';
  if (/\b(hair ?brush(es)?|round brush(es)?|paddle brush(es)?|detangling brush(es)?|hair combs?)\b/i.test(n)) return 'Hair tools';
  // Other brushes ("London Pride Pro Eyebrow Brush", "Real Techniques Brush Crush Blush") are make-up tools.
  if (/\bbrush(es)?\b/i.test(n) && !/\b(nail|nails|body|bath|shower|back|foot|feet|tooth|cleaning)\b/i.test(n)) return 'Beauty tools';
  // "Nuxe Rêve de Miel Hand & Nail Cream" is hand care; a filled bag of them is a gift.
  if (/\bhands? (&|and) nails?\b/i.test(n)) return /\b(bags?|sets?|kits?|gifts?)\b/i.test(n) ? 'Gift sets' : 'Bath & body';
  if (/\bfoot (cream|balm|lotion|mask|soak|spray|scrub)\b/i.test(n)) return 'Bath & body';
  // "Nivea Cashmere & Cottonseed Body Shampoo", "Palmolive Aroma Essence ... Shower Gel": body care, unless a perfume set.
  if (/\bbody shampoo\b|\bshower (gel|cream|oil|foam|milk|scrub|cream-gel)\b|\bbody wash\b/i.test(n) && !/\b(gifts?|sets?|calendar|advent|eau de|parfum|perfume|edp|edt)\b/i.test(n)) return 'Bath & body';
  const hairTool = /\b(dryers?|straighteners?|curlers?|stylers?|brush(es)?|combs?|tongs|wands?)\b/i;
  if (HAIR_BRAND.test(n) && !hairTool.test(n) && !/\b(body|shower|face|gifts?|sets?|calendar|advent)\b/i.test(n)) return 'Hair care';
  // "Australian Bodycare Hair Loss Serum", "Got2b Curlz Moisturizing Hair Detangler": hair, not skin.
  if (!FRAGRANCE_NAME.test(n) && !hairTool.test(n) && /\bhair\b.{0,25}\b(serum|treatment|tonic|oil|mask|spray|lotion|detangler|loss|growth)\b/i.test(n)
    && !/\b(remov\w*|body|face|facial|skin|bleach|wax)\b/i.test(n)) return 'Hair care';
  for (const [re, sub] of NAME_SUBS) if (re.test(n)) return sub;
  // Name words the general list has not got.
  if (/\beau de parfume?\b|\bscent spray\b/i.test(n)) return 'Fragrance';
  if (/^elizabeth arden green tea\b/i.test(n) && !/\b(deodorant|lotion|cream|shower|body|gel|soap|wash|bath)\b/i.test(n)) return 'Fragrance';
  if (DESIGNER_PERFUME.test(n) && !/\b(gifts?|sets?|lotion|cream|gel|wash|deo|deodorant|balm|oil|shower|soap)\b/i.test(n)) return 'Fragrance';
  if (/\b(applicators?|sharpeners?|swabs?|organi[sz]ers?|ogranizer|(make-?up|make up|spa) .{0,6}head ?band)\b/i.test(n)) return 'Beauty tools';
  if (/(?<!(lash|brow) )\bcombs?\b|\bair styler\b/i.test(n)) return 'Hair tools';
  if (/\b(foot files?|pedicure|callus)\b/i.test(n)) return 'Nails';
  if (/\b(christmas|beauty) calendar\b|\bdays of beauty\b|\b(vanity|beauty) bags?\b|\bportrait case\b/i.test(n)) return 'Gift sets';
  if (/\bshower\b/i.test(n)) return 'Bath & body';
  if (/\bhead ?bands?\b/i.test(n)) return 'Hair care';
  for (const [re, sub] of BEAUTY_LEAF_SUBS) if (re.test(leaf)) return sub;
  for (const [re, sub] of BEAUTY_LEAF_MORE) if (re.test(leaf)) return sub;
  // Last: sets of several products are gifts ("Technic Glam Squad Makeup Collection Set"), a plain cream is skin care.
  if (/\b(makeup|make-up|make up|beauty|care|pamper|bath|haul|collection|journal|boutique)\b.*\b(sets?|kits?)\b/i.test(n)) return 'Gift sets';
  if (/\baloe vera\b|\bcr[eè]mes?\b|\bcreams?\b/i.test(n)) return 'Skincare';
  return 'Beauty & Fragrances';
}

// ---------- home (HGW) ----------
const CLEAN_PATH = /(^|\s)(Cleaning|Clean, iron & dry|Cleaning products|Laundry|Steam mop & cleaner|Vacuum cleaners|Dishwasher|Washing up|Detergent|Fabric softener)(\s|$)/i;
const CLEAN_NAME = words(['clean', 'cleaner', 'cleaners', 'cleaning', 'detergent', 'washing powder', 'washing liquid', 'laundry', 'fabric softener', 'fabric conditioner',
  'softener', 'rinse aid', 'bleach', 'disinfectant', 'antibacterial', 'degreaser', 'grease remover', 'limescale', 'descaler', 'stain remover', 'mop', 'mops', 'duster',
  'dusters', 'sponge', 'sponges', 'scourer', 'scourers', 'microfibre', 'microfiber', 'cloth', 'cloths', 'wipes', 'dishwasher', 'dishwashing', 'washing up', 'washing-up',
  'scrub daddy', 'scrub mummy', 'swiffer', 'vacuum', 'hoover', 'lint', 'ironing', 'airer', 'pegs', 'bin bags', 'polish', 'toilet cleaner', 'oven cleaner',
  // Kitchen-shelf cleaning products (dry run of 23 Oct 2026): "Palmolive Ultra Original Dish Soap", "Cif Original Scouring Cream",
  // "Kilrock Bathroom & Kitchen Drain Unblocker", "Flash Spray Wipe Done Multi Surface Spray".
  'dish soap', 'scouring', 'unblocker', 'drain cleaner', 'drain unblocker', 'multi surface', 'multi-surface', 'surface spray', 'spray wipe',
  // Second dry run (24 Oct 2026): "Stardrops The Pink Stuff Squeezy Scrubber", "Cif Power & Shine Kitchen Spray", "Bref Power Lime & Dirt Remover".
  'scrubber', 'scrubbers', 'kitchen spray', 'bathroom spray', 'cif', 'remover']);
const HOME_SCENT_NAME = words(['air freshener', 'air fresheners', 'room spray', 'plug-in', 'plug in', 'reed diffuser', 'diffuser', 'wax melt', 'wax melts', 'scented candle',
  'candle', 'candles', 'febreze', 'glade', 'air wick', 'airwick', 'airpure', 'freshmatic', 'scented bag', 'scented sachet']);
// Cleaning and laundry products "with Febreze" are cleaning products, not home fragrance:
// "Swiffer Duster ... Refills with Febreze Scent", "Ariel Platinum + Febreze Odour Defence Laundry Pods".
const SCENTED_CLEANING = words(['duster', 'dusters', 'swiffer', 'mop', 'mops', 'laundry', 'detergent', 'washing powder', 'washing liquid', 'washing capsules', 'pods',
  'fabric conditioner', 'fabric softener', 'softener', 'scent booster', 'cleaner', 'cleaning', 'disinfectant', 'bleach', 'toilet', 'rim block', 'dishwasher',
  'washing up', 'washing-up', 'wipes']);
const KITCHEN_PATH = /(^|\s)(Kitchen|Wine & cocktail|Cutting boards|Cookware & Utensils|Cutlery|Kitchen utensils|Baking)(\s|$)/i;
const BATH_PATH = /(^|\s)(Bathroom accessories|Bathroom)(\s|$)/i;
// Food is not on these sites ("La Baleine Coarse Sea Salt Shaker - 250 g"); a salt mill or a sugar jar is kitchenware.
const FOOD = words(['sea salt', 'coarse salt', 'table salt', 'rock salt', 'salt flakes', 'peppercorns', 'coffee beans', 'ground coffee', 'instant coffee', 'tea bags',
  'loose tea', 'sugar', 'honey', 'chocolate', 'sweets', 'candy', 'crisps', 'biscuits', 'olive oil', 'spices', 'seasoning', 'syrup']);
const FOOD_TOOL = words(['grinder', 'grinders', 'mill', 'mills', 'jar', 'jars', 'tin', 'tins', 'canister', 'canisters', 'container', 'containers', 'dispenser',
  'holder', 'machine', 'maker', 'scoop', 'thermometer', 'mould', 'mold', 'pot', 'caddy', 'cellar', 'shaker set', 'bowl', 'bowls', 'dish', 'dipper', 'fountain',
  'sprayer', 'bottle', 'pourer', 'rack', 'organiser', 'organizer', 'spoon', 'tongs']);
const DETERGENT_NAME = /detergent|washing (powder|liquid|gel|pods|capsules)|laundry (liquid|gel|pods|capsules|sheets)|colour catcher|color catcher|stain remover|vanish|woolwash/i;
// Toilet blocks and gels are cleaning products, not bathroom accessories ("Bloo ... Toilet Rim Block", "Duck Deep Action Citrus Toilet Gel").
const TOILET_CLEAN = /\b(toilet (blocks?|gel|cleaner|rim|tablets?)|rim blocks?|wc (gel|blocks?|cleaner)|toilet duck|domestos|harpic|bleach)\b/i;
const BATH_BODY_NAME = /\b(hand soap|hand wash|handwash|liquid soap|soap|soaps|bath soak|muscle soak|bath foam|bubble bath|bath salts?|shower gel|body wash)\b/i;

function cleaningSubPS(n, parts) {
  const p = parts.join(' > ');
  // The name first: "Classic Forever Black Laundry Detergent" is in the feed's fabric softener folder.
  if (/fabric softener|fabric conditioner|\bsoftener\b|scent booster/i.test(n)) return 'Fabric Softener';
  if (/dishwasher|dishwashing|washing[- ]up|dish ?soap/i.test(n)) return 'Dishwashing';
  if (DETERGENT_NAME.test(n)) return 'Laundry Detergent';
  // "Lenor ... Rinse Aid" is a fabric conditioner (the feed's own folder says so); "Finish Rinse Aid" is for the dishwasher.
  if (/Fabric softener/i.test(p)) return 'Fabric Softener';
  if (/rinse aid/i.test(n)) return 'Dishwashing';
  // A mop cloth, dust cup or nozzle for a robot vacuum is an accessory, not a vacuum cleaner.
  if (/robot vacuum|vacuum cleaner|cordless vacuum|stick vacuum|handheld vacuum/i.test(n)
    && !/\b(bags?|filters?|brush(es)?|tyres?|spare|parts?|replacement|mop|cloths?|pads?|cups?|nozzles?|heads?|kits?|holders?|mounts?|chargers?|batter(y|ies)|tanks?|containers?|wheels?|rollers?|hepa|accessor(y|ies))\b/i.test(n)) return 'Vacuum Cleaner';
  if (/vacuum|hoover|irobot|roomba|\bvac\b/i.test(n)) return 'Vacuum Accessories';
  if (/duster|dusting/i.test(n)) return 'Duster';
  if (/\bmops?\b|swiffer|steam mop/i.test(n)) return 'Mop';
  if (/\bbrush(es)?\b/i.test(n)) return 'Cleaning Brush';
  if (/cloths?\b|sponges?\b|scourers?\b|scrub (daddy|mummy)|microfib|wipes|eraser|erase away|cleaning pads?/i.test(n)) return 'Cloths & Sponges';
  if (/\biron\b|ironing|steamer|lint|clothes brush|fabric shaver/i.test(n)) return 'Ironing & Clothes Care';
  if (/airer|drying rack|pegs?\b|washing line/i.test(n)) return 'Clothes Airer';
  if (/laundry (basket|bag|hamper)|hamper/i.test(n)) return 'Laundry Basket';
  // "YUGOU Bag It Scented Drawstring Bag" is a bin bag.
  if (/\bbins?\b|bin bags|bin liners?|rubbish|refuse sacks?|drawstring bags?/i.test(n)) return 'Bins & Bin Bags';
  if (/gloves?/i.test(n)) return 'Cleaning Gloves';
  return 'Cleaning Products';
}

// Word boundaries matter: "gin" is in "Original" ("Bacofoil The Original Kitchen Foil" is not a bar accessory) and a salt
// shaker is not a cocktail shaker. Existing HGW subcategories are reused: Frying Pan, Saucepan, Cutlery, Glassware.
function kitchenSubPS(n) {
  if (/\b(cocktails?|wine|corkscrews?|uncorker|bottle openers?|bar set|cocktail shakers?|gin|decanters?|vacu ?vin|foil cutters?|wine pourers?|bottle stoppers?)\b/i.test(n)) return 'Bar Accessories';
  if (/\b(chopping|cutting|serving) boards?\b/i.test(n)) return 'Chopping Board';
  if (/\b(knife|knives|sharpeners?)\b/i.test(n)) return 'Kitchen Knives';
  if (/\b(coffee makers?|espresso makers?|moka|stovetop|cafeti[eè]res?|french press|percolators?|tea ?pots?)\b/i.test(n)) return 'Cookware';
  if (/\b(frying pans?|skillets?)\b/i.test(n)) return 'Frying Pan';
  if (/\bsauce ?pans?\b/i.test(n)) return 'Saucepan';
  if (/\b(pans?|pots?|woks?|casseroles?|stockpots?|roasting tins?|dutch ovens?)\b/i.test(n)) return 'Cookware';
  if (/\bcutlery (holders?|trays?|organi[sz]ers?|drainers?|caddy|baskets?|inserts?)\b|\bdrawer organi[sz]ers?\b/i.test(n)) return 'Kitchen Utensil';
  if (/\b(cutlery|teaspoons?|dessert spoons?|forks?)\b/i.test(n)) return 'Cutlery';
  if (/\b(wine glass(es)?|glasses|tumblers?|champagne flutes?|highball|shot glass(es)?)\b/i.test(n)) return 'Glassware';
  if (/\b(mugs?|cups?|bottles?|flasks?)\b/i.test(n)) return 'Drinkware';
  if (/\b(bowls?|plates?|dinner sets?|tableware|platters?|dishes)\b/i.test(n)) return 'Tableware';
  if (/\b(storage|containers?|jars?|lunch ?box(es)?|food box(es)?|food bags?|freezer bags?|cling film)\b/i.test(n)) return 'Food Storage';
  return 'Kitchen Utensil';
}

// ---------- kids (KGW) ----------
const CHILD_PATH = /(^|\s)(Children|Baby & children products|Baby toys|Kids)(\s|$)/i;
const KIDS_TECH_NAME = /\b(cameras?|smart ?watch(es)?|walkie[- ]?talkies?|headphones?|earbuds?|earphones?|tablets?|karaoke|microphones?|kidizoom|projector|instant print)\b/i;
const NOT_KIDS_TECH_NAME = /\b(case|cover|bag|strap|play-?doh|playmobil|lego|duplo|mega bloks|rattle|teether|toy kitchen|doll|dolls|stroller|pram|sticker|stickers|holders?|stands?)\b/i;
const SCHOOL_NAME = /\b(school ?bags?|book ?bags?|backpacks?|rucksacks?|pencil ?cases?|lunch ?(box|boxes|bag|bags)|pe bag|gym bag|satchel)\b/i;
const STATIONERY_NAME = /\b(crayons?|colouring|coloring|coloured pencils|colored pencils|pencils?|markers?|felt tips?|pens?|eraser|rulers?|sharpener|notebooks?|stationery|glue|scissors)\b/i;
const OUTDOOR_NAME = /\b(scooter|scooters|trampoline|swing|swings|slide|sandpit|sand pit|paddling pool|pool|inflatable|bike|bicycle|helmet|life ?jacket|swim|swimming|armbands|goal|croquet|kite|kites|football|basketball|frisbee|water gun|garden game|outdoor game|bubbles?(?! tea))\b/i;
// Toys that share a word with outdoor play ("Fisher Price Imaginext ... Batman Bicycle", "Bicycle Bourbon Playing Cards",
// "Power Play Table Top Pool Table", "Barbie Pop Reveal Bubble Tea"): toys, not bikes, pools or bubbles.
const NOT_OUTDOOR = /\b(imaginext|playmobil|lego|duplo|figures?|playsets?|action figure|playing cards|card games?|board games?|pool table|snooker|billiards?|table ?top|table football|foosball|air hockey)\b|bubble tea/i;
// Bath toys (KGW already has "Baby & Toddler > Bath Toys"): "Tomy Toomies Bath Activity Octopus", "Munchkin ... Squirts", "Crackle Baff Colours Bath Powder".
const BATH_TOY = /\b(bath toys?|bath (activity|squirters?|squirts|book|books|crayons|puzzles?|stickers|boats?|ducks?|powder|fizzers?)|squirts|squirters?|rubber ducks?|crackle baff|gelli baff)\b|\bbath\b.*\b(octopus|whale|boat|fish|frog|turtle)\b/i;
// Dressing-up helmets and hats ("HTI Police Helmet") are role play, not cycling.
const ROLE_PLAY = /\b(police|fire ?fighter|firefighter|fireman|knight|soldier|astronaut|pirate|builder)\s+(helmet|hat|costume|uniform)\b/i;
const TOY_WEAPON = /\b(nerf|dart ?guns?|blasters?|foam darts|cap guns?|toy guns?|shooting (set|game)s?|target set)\b/i;
// A product only in the general "Baby & children products" folder is a toy only when its name says so
// ("Frosch Baby Cleanser" and "We Made Me Imagine Baby Carrier" were toys in the first dry run).
const TOY_PATH = /(^|\s)(Activities & play time|Toys|Creative toys|Figures & action heroes|Dolls & accessories|Barbie dolls|Games|Toy weapons|Remote controlled toys)(\s|$)/i;
const TOY_NAME = /\b(toys?|games?|puzzles?|dolls?|figures?|figurines?|playsets?|play sets?|plush|teddy|lego|duplo|playmobil|barbie|hot wheels|nerf|slime|dough|stickers?|colouring|crayons?|blocks|bricks)\b/i;
// Plurals too: "Philips Avent Ultra Air ... Pacifiers – 2 pcs" was left out in the second dry run.
const BABY_NAME = /\b(soothers?|pacifiers?|dumm(y|ies)|teethers?|baby bottles?|nappy|nappies|bibs?|swaddle|swaddling|baby carriers?|breast ?pumps?|breast pads?|pampers|huggies|changing bags?|nappy bags?|sterili[sz]ers?|pushchairs?|prams?|rain covers?|footmuffs?|high chairs?|booster seats?|grobag|sleeping bags?|sippy|beakers?|trainer cups?|training spoons?|feeding spoons?|weaning|sunscreen|sun cream)\b/i;

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
  // The pages KGW already has (live database, 24 Oct 2026), before the feed's own folders decide.
  if (/\bsterili[sz]ers?\b|\bbottle warmers?\b/i.test(n)) return 'Bottle Warmers & Sterilisers';
  if (/teats?|nipples?/i.test(n) && /bottle/i.test(n + p)) return 'Baby Bottle Teats & Liners';
  // "Philips Avent ... Breast Pump with 3 Cups" is not a sippy cup.
  if (/breast ?pumps?/i.test(n)) return 'Breast Pumps';
  if (/\b(high chairs?|booster seats?)\b/i.test(n)) return 'High Chairs & Boosters Seats';
  if (/\b(pushchairs?|prams?|buggy|rain covers?|footmuffs?)\b/i.test(n)) return 'Baby Pushchair & Pram Accessories';
  if (/\b(grobag|sleeping bags?|sleep ?bags?)\b/i.test(n)) return 'Baby & Toddler Sleepwear';
  // Nappy bins and their refill cassettes ("Angelcare nappy pail & 5 refill cassettes", "Tommee Tippee Sangenic Refill Cassette").
  if (/\bnappy (pail|bin|bucket|disposal)s?\b|\bsangenic\b|\brefill cassettes?\b|\btwist & click\b/i.test(n)) return 'Nappy Buckets';
  // "Swaddle Me Original" is in the feed's changing folder.
  if (/swaddle|swaddling/i.test(n)) return 'Swaddling Blankets';
  if (/bottle/i.test(n) || /Bottles & accessories/i.test(p)) return 'Baby Bottles';
  if (/\bbibs?\b/i.test(n)) return 'Bibs';
  // "Kikka Boo Silicone Spoons with Suction Cup" is for feeding; "Lamaze Pile & Play Cups" is a stacking toy;
  // "LeapFrog ... Smoothie Toy Cup" is a toy.
  if (/\b(spoons?|forks?|bowls?|plates?|feeding|food|breast pads?|nursing)\b/i.test(n)) return 'Nursing & Feeding';
  if (/\b(stacking|nesting|pile & play|sorting|shape sorter)\b/i.test(n)) return 'Sorting & Stacking Toys';
  if (/sippy|beaker|\bcups?\b/i.test(n) && !/\btoys?\b/i.test(n)) return 'Sippy Cups';
  if (/Eat & drink/i.test(p)) return 'Nursing & Feeding';
  if (/wipes/i.test(n)) return 'Baby Wipes';
  // "Pampers Baby-Dry Size 7" has no "nappies" in its name; "Snappy Baby Shampoo" is not a nappy.
  if (/\bnapp(y|ies)\b|\bdiapers?\b|\bpampers\b|\bhuggies\b|pull-?ups|baby-dry/i.test(n)) return 'Nappies';
  if (/changing bag|nappy bag|diaper bag/i.test(n)) return 'Nappy Bags';
  if (/changing/i.test(n) || /Changing/i.test(p)) return 'Changing Mats & Trays';
  if (/bath (seat|chair|tub|ring)|bathtub|bath support/i.test(n)) return 'Baby Bathtubs & Bath Seats';
  if (/potty|toilet seat|toilet trainer|step stool/i.test(n)) return 'Potty Training';
  if (/corner protector|safety|gate|lock|guard|socket cover/i.test(n)) return 'Baby Safety';
  if (/thermometer|nasal|aspirator/i.test(n)) return 'Baby Health';
  if (/baby carrier|\bcarrier\b|\bsling\b/i.test(n)) return 'Baby Carriers';
  // Insect repellents for children ("Relec Mosquito Repellent for Children") are health, not bathing.
  if (/\b(insect|mosquito) (spray|repellent|lotion|roll-on)\b|\brepellent\b/i.test(n)) return 'Baby Health';
  if (/shampoo|lotion|oil|wash|soap|cream|sunscreen|sun cream|bath/i.test(n) || /Bathroom & care/i.test(p)) return 'Baby Bathing';
  if (/rattle/i.test(n)) return 'Rattles';
  if (/Baby toys/i.test(p) || /activity|play ?gym|mobile|stacking|sorting|push|pull/i.test(n)) return 'Baby Activity Toys';
  if (/blanket/i.test(n)) return 'Receiving Blankets';
  // "DANPOL Buckwheat Mattress 120x60cm", "Mothercare Mosquito Net For Crib", "Träumeland Tencel layers".
  if (/\b(mosquito nets?|mattress(es)?|mattress protectors?|tencel|cot (sheets?|bumpers?)|crib (sheets?|bumpers?)|bed rails?)\b/i.test(n)) return 'Cot & Toddler Bed Accessories';
  return 'Baby & Toddler';
}

function toySub(n, p) {
  const t = `${n} ${p}`;
  // Puzzles, card games and colouring or sticker books first: "Janod WWF Animal Puzzle" is in the construction folder,
  // and "Barbie Finger Painting Book" or "Hot Wheels ... Colouring Book" are craft, whoever is on the cover.
  if (/\b(jigsaw|puzzles?)\b/i.test(n)) return 'Jigsaw Puzzles';
  if (/\b(card games?|playing cards|uno|top trumps)\b/i.test(n)) return 'Card Games';
  if (/\b(colouring|coloring|painting|sticker|stickers|activity book|craft|crafts|beads|art set|sketch|stencils?)\b/i.test(n)) return 'Toy Craft Kits';
  if (/\b(lego|duplo|mega bloks|megabloks|bricks)\b|Building & construction/i.test(t)) return 'Construction Set Toys';
  if (/\bplaymobil\b/i.test(n)) return 'Dolls, Playsets & Toy Figures';
  if (/\b(barbie|dolls?|baby born|tiny toes|happy friend|reborn|polly pocket|lol surprise)\b/i.test(n) || /Dolls/i.test(p)) return 'Dolls';
  if (/\b(schleich|figures?|action figure|jurassic|transformers|dc universe|marvel|avengers|wwe|imaginext|super friends|batman)\b/i.test(n) || /Figures & action heroes/i.test(p)) return 'Action & Toy Figures';
  if (/\b(board game|game|games|dominoes|four in a row|connect 4|chess|monopoly|cluedo|twister|jenga)\b/i.test(n) || /(^|\s)Games(\s|$)/i.test(p)) return 'Board Games';
  if (/\b(nerf|blasters?|darts?|toy guns?|target)\b/i.test(n) || /Toy weapons/i.test(p)) return 'Toy Weapons & Gadgets';
  // "SpeedWay Electric Force Racetrack", "Rastar R/C Porsche 918 Spyder 1:24".
  if ((/\b(track|race track|raceway)\b/i.test(n) && /\b(hot wheels|cars?|racing)\b/i.test(n)) || /\bracetracks?\b/i.test(n)) return 'Toy Racing Car & Track Sets';
  if (/\b(remote control|remote controlled|rc car|radio controlled)\b|\br\/c\b/i.test(n)) return 'Remote Control Cars & Lorries';
  // "Thomas & Friends Edward Diecast Push-Along Toy Train" is a train, not a toy car.
  if (/\b(thomas & friends|thomas the tank|toy trains?|train sets?)\b/i.test(n)) return 'Toy Trains & Train Sets';
  // Sorting of 24 Oct 2026: toy tool kits ("Construction Machines Toolbox") are toy tools; lorries, tractors and construction
  // vehicles have their own KGW page ("Teamsterz JCB Wheel Loader Truck"); a monster truck is a car.
  if (TOY_TOOL.test(n)) return 'Toy Tools';
  if (BUILD_VEHICLE.test(n) && !/\bmonster trucks?\b/i.test(n)) return 'Toy Lorries & Construction Vehicles';
  if (/\b(hot wheels|matchbox|toy cars?|die-?cast|monster trucks?|vehicles?|trucks?|tractors?|diggers?|fire engine|police car)\b/i.test(n)) return 'Toy Cars';
  if (/\b(slime|play-?doh|clay|putty|dough|kinetic sand)\b/i.test(n)) return 'Play Dough & Putty';
  // "Bontempi Baby Melody Desk" is in the creative-toys folder but is a musical toy.
  if (/\b(xylophone|drums?|piano|keyboard|guitar|musical|maracas|tambourine|melody|bontempi)\b/i.test(n)) return 'Musical Toys';
  if (/\b(crayola|paint|drawing)\b/i.test(n) || /Creative toys|Drawing & painting/i.test(p)) return 'Toy Craft Kits';
  if (/\b(plush|teddy|soft toy|cuddly|cuddle|keel toys|squishmallows?|stuffed)\b/i.test(n)) return 'Stuffed Animals & Cuddly Toys';
  if (/\b(toy kitchen|play food|tea set|cooking set|shopping trolley|cash register)\b/i.test(n)) return 'Toy Kitchens & Play Food';
  if (/\bbath\b/i.test(n)) return 'Bath Toys';
  if (/\b(science|experiment|microscope|telescope|magnifying)\b/i.test(n)) return 'Science & Exploration Sets';
  if (/\btrains?\b/i.test(n)) return 'Toy Trains & Train Sets';
  if (/\b(vtech|leapfrog|learning|educational|alphabet|counting)\b/i.test(n)) return 'Educational Toys';
  return 'Toys & Games';
}

// Sorting of 24 Oct 2026: toys the list above leaves in the general "Toys & Games" group (real names from the KGW
// database), on pages KGW already has. Used only for those, so a product already on a page stays there.
const ACTIVITY_TOY = /\b(squish\w*|squeez\w*|fidget\w*|anti-?stress|stress (balls?|toys?|relief)|stretchy|stretch|pop it|push poppers?|decompression|slow[- ]?ris\w*|yo[- ]?yos?|bouncers?|bouncy|bungee balls?|spinning tops?|spinners?|beyblade|whirly|scrunchems)\b/i;
const PLAY_KITCHEN = /\b(play kitchens?|kitchen playsets?|toy kitchens?|play food|tea (play )?sets?|tea party|breakfast sets?|pastry sets?|pizza (play )?sets?|sushi (play )?sets?|lunch time|waffles?|cr[eê]pes?|fruit (&|and) vegetables?|green market|(?<!cement )mixers?|cooking sets?)\b/i;
const TOY_TOOL = /\b(tool ?kits?|tool ?box(es)?|toolbox(es)?|tool sets?|work ?bench(es)?)\b/i;
const BUILD_VEHICLE = /\b(jcb|excavators?|diggers?|bulldozers?|backhoe|loaders?|skid steer|dumpers?|tippers?|cranes?|cement mixers?|construction machines?|transporters?|lorry|lorries|trucks?|tractors?)\b/i;
const TOY_CAR = /\b(cars?|vans?|ambulances?|jeeps?|buses|bus|taxis?|teamsterz|maisto|bburago|motor max|majorette|siku|welly)\b|\b1:\d{2,3}\b/i;
const NIGHT_LIGHT = /\b(night ?lights?|star projectors?|soother projectors?|cot light|projectors? with melodies|groclock|sleep trainer)\b/i;

function toyRefine(n) {
  const toys = sub => ({ siteCategory: 'Toys & Games', subcategory: sub });
  const baby = sub => ({ siteCategory: 'Baby & Toddler', subcategory: sub });
  if (/\b(baby walkers?|walk-behind)\b/i.test(n)) return baby('Baby Walkers & Entertainers');
  // "Taf Toys Koala In Car Play Centre Seat Activity Mirror Toy" is a baby toy for the car seat.
  if (/\b(activity (toys?|mirror)|in car play|play centre|kick car)\b/i.test(n)) return baby('Baby Activity Toys');
  if (/\b(stacking|nesting|shape sorter)\b/i.test(n)) return baby('Sorting & Stacking Toys');
  // Squishy, fidget and stretchy toys, yo-yos and spinning tops: Google's "Activity Toys".
  if (ACTIVITY_TOY.test(n)) return toys('Activity Toys');
  if (TOY_TOOL.test(n)) return toys('Toy Tools');
  if (PLAY_KITCHEN.test(n)) return toys('Toy Kitchens & Play Food');
  if (/\b(play money|cash registers?|shopping trolley|shop till)\b/i.test(n)) return toys('Pretend Shopping & Grocery');
  if (/\b(story ?books?|books?)\b/i.test(n)) return toys('Reading Toys');
  if (/\b(boules|p[eé]tanque|croquet|skittles|bowling sets?)\b/i.test(n)) return { siteCategory: 'Sports & Outdoors', subcategory: 'Outdoor Games' };
  if (/\b(soft balls?|footballs?|beach ?balls?|play ?balls?|playground balls?)\b/i.test(n)) return toys('Playground Balls');
  if (/\b(care bears?|knuffel|pehmolelu|forever friends|soft toys?|plush\w*|cuddly|teddy)\b/i.test(n)) return toys('Stuffed Animals & Cuddly Toys');
  if (/\b(robots?|robotic|electronic (toys?|pets?)|interactive (pets?|toys?))\b/i.test(n)) return toys('Robotic Toys');
  if (/\b(blind ?bags?|surprise bags?|mystery (bags?|box(es)?)|lucky bags?)\b/i.test(n)) return toys('Toy Gift Baskets');
  if (/\b(strollers?|prams?|buggy|pushchairs?)\b/i.test(n)) return toys('Doll & Action Figure Accessories');
  if (BUILD_VEHICLE.test(n)) return toys('Toy Lorries & Construction Vehicles');
  if (/\b(motorbikes?|motorcycles?|harley)\b/i.test(n)) return toys('Toy Motorcycles');
  if (/\bhelicopters?\b/i.test(n)) return toys('Toy Helicopters');
  if (/\b(jets?|aeroplanes?|airplanes?|planes?)\b/i.test(n)) return toys('Toy Aeroplanes');
  // KGW keeps PAW Patrol vehicles with their figures ("Paw Patrol True Metal Off Road Mud - Chase").
  if (/\bpaw patrol\b/i.test(n)) return toys('Action & Toy Figures');
  if (TOY_CAR.test(n)) return toys('Toy Cars');
  if (/\b(little people|playsets?|play sets?)\b/i.test(n)) return toys('Dolls, Playsets & Toy Figures');
  return toys('Toys & Games');
}

function outdoorSub(n) {
  if (/\b(pool|pools|paddling|swim|swimming|life ?jacket|armbands|inflatable|water|snorkel\w*|goggles|diving|float\w*|bathing rings?|swim rings?|splash\w*)\b/i.test(n)) return 'Water Play Equipment';
  // KGW already has "Cycling Helmets"; only real bikes, balance bikes and trikes are "Bicycles".
  if (/\b(bike|cycle|cycling|bicycle|skate|scooter) helmets?\b|\bhelmet\b.*\b\d{2} ?- ?\d{2} ?cm\b/i.test(n)) return 'Cycling Helmets';
  if (/scooter/i.test(n)) return 'Riding Scooters';
  if (/\b(balance bikes?|bikes?|bicycles?|tricycles?|trikes?)\b/i.test(n)) return 'Bicycles';
  if (/trampoline/i.test(n)) return 'Trampolines';
  if (/\b(swings?|slides?)\b/i.test(n)) return 'Play Swings';
  if (/bubble(?! tea)/i.test(n)) return 'Bubble Blowing Toys';
  return 'Outdoor Games';
}

// ---------- garden (GGW) ----------
const GARDEN_PATH = /(^|\s)(Garden tools|Tools and garden appliances|Garden|Water hoses and accessories|Grill & accessories|Barbecue|BBQ)(\s|$)/i;
const WATERING = /\b(hose|hoses|hosepipe|spray gun|spray nozzle|nozzle|sprinkler|sprinklers|watering can|watering|hose reel|hose connector|irrigation)\b/i;
const GARDEN_TOOL = /\b(pruning|pruner|pruners|secateurs|shears|loppers|hedge|trowel|fork|rake|hoe|spade|shovel|cultivator|weeder|dibber|saw|hacksaw|garden gloves|planting|planter|kneeler|leaf grabber|transplanter)\b/i;

// The subcategories GGW already has (live database, 23 Oct 2026): a new product joins its existing page.
function wateringSub(n) {
  if (/sprinklers?/i.test(n)) return 'Garden Sprinklers';
  if (/\breels?\b/i.test(n)) return 'Hose Reels & Storage';
  if (/\b(connectors?|adaptors?|adapters?|couplings?)\b/i.test(n)) return 'Hose Adaptors & Connectors';
  if (/\bhose(s|pipes?)?\b/i.test(n)) return 'Hose Pipes';
  if (/pressure sprayer/i.test(n)) return 'Pressure Sprayers & Accessories';
  if (/\btimers?\b/i.test(n)) return 'Water Timers';
  if (/\b(drip|irrigation)\b/i.test(n)) return 'Irrigation Systems';
  if (/\b(spray|guns?|nozzles?|lances?)\b/i.test(n)) return 'Spray Nozzles & Guns';
  return 'Watering Accessories';
}

function gardenToolSub(n) {
  if (/\b(secateurs|pruning shears|pruners?)\b/i.test(n)) return 'Secateurs';
  if (/\bloppers?\b/i.test(n)) return 'Loppers';
  if (/\b(hedge|shrub) shears\b/i.test(n)) return 'Shrub Shears';
  if (/\bshears\b/i.test(n)) return 'Garden Shears';
  if (/\b(saws?|hacksaws?)\b/i.test(n)) return 'Pruning Saws';
  if (/\b(trowels?|hand forks?|planting shovels?|transplanters?)\b/i.test(n)) return 'Hand Forks & Trowels';
  if (/\b(cultivators?|weeders?|grubbers?)\b/i.test(n)) return 'Cultivators & Grubbers';
  if (/\brakes?\b/i.test(n)) return 'Rakes';
  if (/\bhoes?\b/i.test(n)) return 'Hoes';
  if (/\b(spades?|shovels?)\b/i.test(n)) return 'Spades';
  if (/\bforks?\b/i.test(n)) return 'Garden Forks';
  if (/\b(dibbers?|bulb planters?)\b/i.test(n)) return 'Bulb Planters & Dibbers';
  return 'Other Garden Accessories';
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
  // Many watch names have no "watch" but a case size: "GANT Sevenhill GT062006 - 41mm", "Timberland 15518JLU 46mm".
  if (WATCH_PATH.test(`${p} > ${leaf}`) && (/\bwatch(es)?\b|kidizoom/i.test(n) || /\b\d{2} ?mm\b/i.test(n) || WATCH_MODEL.test(n))) {
    if (watchAccessory(n)) return { reject: 'watch strap or box (not a watch)' };
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
    // "Vileda Multi Latex Disposable Gloves" in the feed's changing folder are cleaning gloves.
    if (/\bgloves?\b/i.test(n) && /\b(disposable|latex|nitrile|vinyl)\b/i.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Cleaning Gloves' };
    if (BATH_TOY.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Bath Toys' };
    // "Red LCD Graphic Drawing Tablet" is a drawing toy and "Planet Buddies ... Tablet Holder" a holder, not tablets.
    if (/\b(lcd (writing|drawing)|graphic drawing|drawing tablets?|writing tablets?|doodle (board|pad))\b/i.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Toy Drawing Tablets' };
    if (/\btablet (holders?|stands?|pillows?)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Tech' };
    // Night lights and star projectors ("VTech Sleepy Sloth Cot Light Projector", "Tommee Tippee Groclock") have their own
    // KGW page; "myFirst iPad Cover" is a case, not a toy.
    if (NIGHT_LIGHT.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Night Lights & Ambient Lighting' };
    if (/\b(ipad|tablet) (covers?|cases?)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'PDA Cases' };
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
      || BABY_NAME.test(n)) {
      const sub = babySub(n, p);
      // "Paw Patrol Blue Party Stickers" in the children's-room folder: stickers, like the pink ones on the toy page.
      if (sub === 'Baby & Toddler' && /\bstickers?\b/i.test(n)) return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Toy Craft Kits' };
      return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: sub };
    }
    if (/\bplaying cards\b/i.test(n)) return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Card Games' };
    if (ROLE_PLAY.test(n)) return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Pretend Professions & Role Playing' };
    // "Beast Blitz Dino Battle Dart Guns" in the outdoor folder is a toy weapon; a bubble or water blaster is outdoor play.
    if (TOY_WEAPON.test(n) && !/\b(bubbles?|water|aqua|squirt)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Toy Weapons & Gadgets' };
    if ((/Outdoor toys|Outdoor play|Sport/i.test(p) || OUTDOOR_NAME.test(n)) && !NOT_OUTDOOR.test(n)) return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: outdoorSub(n) };
    const pl = `${p} > ${leaf}`;
    if (TOY_PATH.test(pl) || (/Baby & children products/i.test(pl) && (TOY_NAME.test(n) || NOT_OUTDOOR.test(n) || toySub(n, p) !== 'Toys & Games'))) {
      const sub = toySub(n, p);
      if (sub !== 'Toys & Games') return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: sub };
      return { site: 'kgw', ...toyRefine(n) };
    }
    return { reject: "children's product not in these plans" };
  }

  if (PET.test(petText(n))) return { reject: 'pet product' };
  if (HEALTH_PATH.test(p) || HEALTH_PATH.test(leaf) || (/^Medical$/i.test(awin) && !BEAUTY_NAME.test(n))) return { reject: 'health or dental product' };

  // Beauty and grooming.
  const fragranceName = FRAGRANCE_NAME.test(n) && !HOME_SCENT.test(n);
  if (BEAUTY_PATH.test(p) || BEAUTY_PATH.test(leaf) || fragranceName || BEAUTY_LEAF_SUBS.some(([re]) => re.test(leaf))
    || ((pathWomen || /^Women$/i.test(leaf)) && BEAUTY_NAME.test(n))) {
    // Tissues and the Always sanitary range in the personal-care folders ("Kleenex Family Maxi Pack", "Always Dailies Long",
    // "Always Classic Maxi 9 pcs") are not beauty. A "Tissue Mask" or "Tissue Eye Patches" is.
    if (/\b(kleenex|tissues|toilet roll|toilet paper)\b/i.test(n)) return { reject: 'paper consumables' };
    if (/^always\b|\bpanty ?liners?\b|\bsanitary (towels?|pads?)\b/i.test(n)) return { reject: 'health, dental or hygiene product (not beauty)' };
    if (HOME_CLEAN_NAME.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
    // "Scandinavia Bathroom Toothbrush Holder" and "Toothbrush mug" hold a toothbrush: bathroom accessories.
    if (/\btoothbrush (holders?|stands?|mugs?|cups?|tumblers?)\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathroom Accessories' };
    let healthText = fragranceName ? n.replace(/\btoy\b/gi, ' ') : n;
    if (SKIN_FORM.test(n)) healthText = healthText.replace(/\b(multi-?)?vitamins?\b/gi, ' ');
    if (NOT_BEAUTY.test(healthText) || HEALTH.test(healthText) || (INTIMATE_CARE.test(n) && !fragranceName)) return { reject: 'health, dental or hygiene product (not beauty)' };
    // "Gillette Satin Care" is the women's shaving gel.
    const women = WOMEN.test(n) || WOMEN_GROOMING.test(n) || /\bsatin care\b/i.test(n);
    const unisex = UNISEX.test(n);
    const men = MEN.test(n) || MEN_LINES.test(n);
    // Toiletry bags and wash-bag gift sets: a men's one goes to MGW ("Technic Man' Stuff Toiletry Bag Gift Box",
    // "Baylis & Harding Wellness For Men ... Wash Bag Gift Set"); a filled one is a gift set, an empty one a bag.
    if (TOILETRY_BAG.test(n)) {
      const forMen = !women && (men || (pathMen && !pathWomen));
      if (/\b(gifts?|calendar|advent|set|sets|kit|kits)\b/i.test(n)) {
        return forMen ? { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Gift sets' } : { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Gift sets' };
      }
      return { site: forMen ? 'mgw' : 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
    }
    const shaving = (MEN_SHAVING.test(n) || MEN_TOOLS.test(n) || /Shaving & hair-cutting/i.test(`${p} > ${leaf}`)) && !NAIL_TOOL.test(n);
    if (!women && !unisex && (men || shaving || (pathMen && !pathWomen && !NAIL_TOOL.test(n)))) {
      // "Axe Black Deo Spray" is a deodorant.
      const menSub = /\bdeo\b/i.test(n) && !fragranceName ? 'Deodorant' : menSubcategory(n);
      return { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: menSub };
    }
    // "Aviator AVGSR 635BK Sunglasses" in the women's folder: a fashion accessory on the same site.
    if (/\bsunglasses\b/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses' };
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
    // "Dangrill Grill Spade - 45cm" is a barbecue tool, not a garden spade.
    if (/\b(grill|bbq|barbecue)\b/i.test(n)) return { site: 'ggw', siteCategory: 'BBQ & Outdoor Cooking', subcategory: 'BBQ accessories' };
    if (WATERING.test(n)) return { site: 'ggw', siteCategory: 'Watering & Irrigation', subcategory: wateringSub(n) };
    if (GARDEN_TOOL.test(n)) return { site: 'ggw', siteCategory: 'Garden Tools', subcategory: gardenToolSub(n) };
    return { reject: 'tools, not garden (not in these plans)' };
  }

  // Home: smart home, home fragrance, cleaning, kitchen, bathroom.
  if (/Home security/i.test(`${p} > ${leaf} > ${awin}`) || (SMART_HOME.test(n) && !NOT_SMART_HOME.test(n))) {
    if (/fake|dummy|imitation/i.test(n)) return { reject: 'fake security camera' };
    // "Perel lamp - 20W" is in the feed's home-security folder but is not a smart or security device.
    if (!SECURITY_DEVICE.test(n)) return { reject: 'not a smart home or security device' };
    return homeSmart(n);
  }
  if (PEST.test(n)) return { reject: 'pest control' };
  if (HOME_SCENT_NAME.test(n) && !/car\b/i.test(n) && !SCENTED_CLEANING.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Home Fragrance' };
  if (KITCHEN_PATH.test(`${p} > ${leaf} > ${awin}`)) {
    if (FOOD.test(n) && !FOOD_TOOL.test(n)) return { reject: 'food or drink (not on these sites)' };
    if (CLEAN_NAME.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
    return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: kitchenSubPS(n) };
  }
  if (CLEAN_PATH.test(`${p} > ${leaf}`) || (/^Household$/i.test(leaf) && CLEAN_NAME.test(n)) || /^(Cleaning|Vacuum Cleaners)$/i.test(awin) && CLEAN_NAME.test(n)) {
    if (/\b(toilet roll|kitchen roll|tissues)\b/i.test(n)) return { reject: 'paper consumables' };
    return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: cleaningSubPS(n, parts) };
  }
  // The bathroom folder holds toilet cleaners, soaps and a toiletry advent calendar as well as mirrors and scales.
  // A holder or dispenser ("Toilet Roll Holder", "Soap Dispenser") is a bathroom accessory, whatever it holds.
  if (BATH_PATH.test(`${p} > ${leaf}`)) {
    const holder = /\b(holders?|stands?|dispensers?|organi[sz]ers?|mugs?|tumblers?|caddy|racks?|trays?|dish|dishes)\b/i.test(n);
    if (!holder && /\b(tissues|toilet roll|toilet paper|kleenex)\b/i.test(n)) return { reject: 'paper consumables' };
    if (!holder && HEALTH.test(n)) return { reject: 'health, dental or hygiene product (not beauty)' };
    if (TOILET_CLEAN.test(n) && !/\bbrush/i.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Cleaning Products' };
    if (/\b(advent ?calendar|adventskalend[ae]r|gift sets?|gift box)\b/i.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Gift sets' };
    if (!holder && BATH_BODY_NAME.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Bath & body' };
    return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: /towel/i.test(n) ? 'Towel' : 'Bathroom Accessories' };
  }
  return { reject: 'not in these plans (beauty, grooming, watches, home, cleaning, kids, garden)' };
}

// A product in the feed's home-security folder needs one of these words to be a smart home or security device.
const SECURITY_DEVICE = /\b(cameras?|cctv|doorbells?|chimes?|alarms?|sensors?|detectors?|sirens?|keypads?|smart|wi-?fi|wireless|locks?|plugs?|sockets?|bulbs?|thermostats?|hubs?)\b/i;

// Subcategories: HGW already has Video Doorbell, Security Camera, Motion Sensor, Smart Sensor, Smart Bulb, Smart Plug.
// "Smartwares ... Smoke Alarm" is not a motion sensor and "Nedis Wireless Doorbell Set" (a chime) is not a video doorbell.
function homeSmart(n) {
  const sub = /video doorbell|doorbell camera|smart doorbell|wi-?fi.{0,20}doorbell/i.test(n) ? 'Video Doorbell'
    : /doorbell|door chime/i.test(n) ? 'Wireless Doorbell'
    : /camera|cctv/i.test(n) ? 'Security Camera'
    : /smoke|carbon monoxide|\bco alarm|heat alarm|fire alarm/i.test(n) ? 'Smoke Alarm'
    : /motion|\bpir\b/i.test(n) ? 'Motion Sensor'
    : /sensor|detector/i.test(n) ? 'Smart Sensor'
    : /bulb|light/i.test(n) ? 'Smart Bulb'
    : /plug|socket/i.test(n) ? 'Smart Plug'
    : 'Smart Home Accessories';
  return { site: 'hgw', siteCategory: 'Smart Home', subcategory: sub };
}
