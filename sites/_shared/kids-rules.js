// General category rules for Kids' Gear World (KGW): the same kind of rules as the newer sites and the other old ones
// (sites/_shared/fashion-rules.js, home-garden-rules.js). Owner, 31 Oct 2026: every product through the Hub, the same logic
// on all 11 sites. Tuned against the products KGW showed that day (7,470) with tools/legacy-rules-compare.mjs, and on the
// per-shop rules KGW had before (tools/import-rules/lib/plusshop-family.mjs, coes-kids.mjs, joybuy.mjs).
//
// How a product is placed:
//   1. Toys, games and baby items are for children by themselves. Clothes, shoes, bags, watches, bedroom things, tech
//      and sport need a sign that they are for children: a word ("Kids", "Junior", "Girls'", "Baby", "Age 3-5"), a
//      children's brand (VTech, PAW Patrol, Peppa Pig), or a children's section of the shop ("Toys & Games", "Baby toys").
//      Without it they belong to another Gear World ("Women's Dress" to WGW, "Adult Scooter" to Biker).
//   2. The category whose words come LAST in the head of the name wins (fashion-rules.js headOf / lastAt).
//   3. Adult, alcohol, tobacco, pet and video-game products never go to a children's site, wherever the word is.
//   4. No word in the name: the shop's section, if the shop's sections are reliable (sectionHints).
//   5. The subcategory is the shop's own leaf section when KGW already uses it ("Baby & Toddler > Nursing & Feeding >
//      Baby Bottles"), else the type word that comes last in the name, with the names KGW already uses.

import { fixMojibake } from '../../src/db.js';
import { words, lastAt, headOf, OFFICE_PARTS } from './fashion-rules.js';

// ---------- Is it for children? ----------
const KID = words(['kids?', "kid'?s", "kids'", 'children', "children'?s", "childrens'?", 'child', 'childs', 'toddlers?', "toddler'?s", 'babies', 'baby', "baby'?s",
  'infants?', 'newborns?', 'boys?', "boy'?s", "boys'", 'girls?', "girl'?s", "girls'", 'junior', 'juniors', 'jnr', 'youth', 'little ones?', 'nursery', 'preschool', 'pre-school',
  'unicorn', 'dinosaurs?', 'princess(?:es)?', 'superhero(?:es)?', 'fairy',
  '\\d{1,2} ?(?:-|to|–) ?\\d{1,2} ?(?:years?|yrs?|months?|mths?)', '\\d{1,2} ?(?:years?|yrs?|months?) ?(?:old|\\+)', 'ages? \\d{1,2}', 'age \\d', '\\d{1,2} ?y(?:ea)?rs? ?\\+', '\\d{1,2}\\+ ?(?:years?|yrs?)',
  '0-\\d{1,2} ?months?', '\\d{1,2}m\\+']);
// Words that look like a children's word but are not ("Baby Pink", "Boyfriend Jeans", "Kid Leather Gloves", "Baby Oil").
const NOT_KID = /\b(?:baby bio|boyfriend|girlfriend|baby ?(?:pink|blue|oil|soft|lips?|blades?|liss|bump|shower)|kid (?:leather|gloves?|suede|mohair)|baker boy|bad boy|toy boy|boy ?london|golden girl|good girl|girl of now|girl power|it girl|spice girls|beach boys|the boys|nobody'?s child|child of (?:light|the)|lazy princess|princess (?:cut|diamond)|fairy lights?|tooth fairy|youth (?:serum|cream|boost))\b/gi;
const KID_BRANDS = words(['paw patrol', 'peppa(?: pig)?', 'bluey', 'cocomelon', 'hey duggee', 'gabby\'?s dollhouse', 'frozen', 'disney princess', 'barbie', 'l\\.?o\\.?l\\.? surprise', 'hot wheels',
  'vtech', 'leapfrog', 'kidizoom', 'toniebox', 'tonies', 'yoto', 'xplora', 'myfirst', 'fisher[- ]price', 'playmobil', 'lego', 'duplo', 'mega bloks', 'little tikes', 'tomy', 'play-?doh',
  'chicco', 'tommee tippee', 'mam', 'philips avent', 'nuby', 'munchkin', 'pampers', 'huggies', 'baby born', 'baby annabell', 'pj masks', 'teletubbies', 'thomas (?:&|and) friends',
  'cbeebies', 'in the night garden', 'squishmallows?', 'jellycat', 'melissa (?:&|and) doug', 'micro scooters?', 'mini micro', 'maxi micro', 'pinkfong', 'baby shark', 'minecraft',
  'pokemon', 'pokémon', 'spidey', 'sonic the hedgehog', 'nerf', 'schleich', 'sylvanian families', 'my little pony', 'hatchimals', 'ravensburger', 'orchard toys', 'galt', 'brio',
  'smoby', 'kinderkraft', 'crayola', 'bontempi', 'my first', 'my 1st', 'angelcare', 'cloud b', 'clippasafe', 'callowesse', 'aiyaplay', 'zonekiz', 'galt', 'clementoni', 'lexibook', 'grobag', 'gro company', 'joie', 'maxi-cosi', 'cybex', 'silver cross', 'ickle bubba', 'mamas (?:&|and) papas']);
// Products that are for children by themselves (a "Paddling Pool", "Balance Bike", "Bubble Machine").
const INHERENT = words(['toys?', 'dolls?', 'plush', 'teddy', 'teddies', 'cuddly', 'playsets?', 'play ?sets?', 'ride[- ]?ons?', 'balance bikes?', 'trikes?', 'tricycles?', 'paddling pools?',
  'sand ?pits?', 'sandboxes?', 'bubbles?', 'bubble (?:machines?|wands?|guns?)', 'water (?:guns?|pistols?|blasters?)', 'space hoppers?', 'swingball', 'pogo sticks?', 'play ?(?:houses?|tents?|mats?|gyms?)',
  'climbing frames?', 'scooters? for kids', 'school (?:bags?|uniforms?|shoes?)', 'book ?bags?', 'pe (?:bags?|kits?)', 'nappy', 'nappies', 'onesies?', 'babygrows?', 'sleepsuits?', 'rompers?',
  'dungarees', 'snowsuits?', 'puddle suits?', 'colouring', 'coloring', 'crayons?', 'stickers?', 'sticker books?', 'fancy dress', 'dress[- ]up', 'costumes?', 'wellies', 'light[- ]up shoes',
  'velcro', 'night lights?', 'height charts?', 'bunk beds?', 'cabin beds?', 'toddler beds?', 'mid sleepers?', 'high sleepers?']);
// Sections of the shops that are for children ("Toys & Games > ...", Plusshop "Baby toys", Joybuy "Baby & Toddler Clothing").
const KID_SECTION = /(?:^|>|\s)(?:toys & games|baby & toddler|toys|baby toys|creative toys|activities & play time|baby & children products|figures & action heroes|action heroes|dolls(?: & accessories)?|barbie dolls|games|remote controlled toys|r\/c toys|toy weapons|building & construction toys|developmental toys|sensory toys|teaching & activity toys|outdoor toys|water toys|play dough|minifigures|children|children's watches|kids|kids'|kidswear|childrenswear|girls|boys|baby|decor & children's room|bikes, ride-ons and scooters|baby & toddler clothing|school accessories|potty training|dummy & accessories|baby bottles|baby bath & bath accessories|bottles & accessories|changing|eat & drink|bibs|service & bibs|sterilisator)(?:\s|>|$)/i;

export function forChildren(name, feedCategory = '', source = null) {
  const n = String(name || '').replace(NOT_KID, ' ');
  if (source && source.kidsShop) return true;
  return KID.test(n) || KID_BRANDS.test(n) || INHERENT.test(n) || KID_SECTION.test(String(feedCategory || ''));
}

// ---------- Not for a children's site ----------
const HARD_DENY = words(['gift cards? (?:worth|value|£ ?\\d+|\\d+)', 'e-?gift cards?', 'digital gift cards?', 'gift vouchers?', 'e-?vouchers?', 'vouchers?']);
// Wherever the word is: adult products, alcohol, tobacco, weapons, pets, video games and office parts.
const DENY = [
  { re: /$^/, anywhere: OFFICE_PARTS, label: 'office or computer part (Technology Gear World)' },
  { re: /$^/, anywhere: words(['sex', 'sexy', 'erotic', 'vibrators?', 'dildos?', 'lingerie', 'condoms?', 'lubricants?', 'bondage', 'fetish', '18\\+', 'adults? only', 'for adults(?! (?:and|&|or) (?:kids|children|teens))',
    'adult (?:sizes?|costumes?|onesies?|colouring|coloring|card games?|party games?)', 'drinking games?', 'hen (?:party|night|do)', 'stag (?:party|night|do)', 'naughty']), label: 'adult product (not for a children\'s site)' },
  { re: /$^/, anywhere: words(['alcohol', 'wines?(?! (?:glass|gums))', 'beers?', 'gin', 'vodka', 'whisk(?:e)?y', 'rum', 'prosecco', 'champagne', 'cocktails?', 'vapes?', 'vaping', 'e-?cigs?', 'e-?liquids?',
    'cigarettes?', 'cigars?', 'tobacco', 'nicotine', 'cbd', 'shisha', 'hookah', 'lighters?', 'casino', 'poker (?:sets?|chips)', 'gambling', 'soft drinks?', 'juice drinks?', 'energy drinks?', 'fizzy drinks?']), label: 'alcohol, tobacco or gambling (not for a children\'s site)' },
  { re: /$^/, anywhere: words(['air ?soft', 'bb guns?', 'pellet guns?', 'air (?:rifles?|pistols?)', 'crossbows?', 'pocket knives?', 'hunting knives?', 'kitchen knives', 'machetes?', 'hatchets?',
    'pepper spray', 'stun guns?', 'tasers?']), label: 'weapon (not for a children\'s site)' },
  { re: /$^/, anywhere: words(['for (?:dogs?|cats?|pets?|puppies|kittens)', 'dog (?:toys?|beds?|bowls?|leads?|collars?|harness(?:es)?|treats?|food|chews?)', 'cat (?:toys?|beds?|litter|trees?|scratch\\w*|food|treats?)',
    'pet (?:toys?|beds?|bowls?|food|treats?|carriers?|grooming|supplies)', 'puppy (?:pads?|training)', 'fish tanks?', 'bird ?cages?']), label: 'pet item (not shown yet)' },
  { re: /$^/, anywhere: words(['playstation', 'ps[345]', 'xbox', 'nintendo switch(?! (?:carry|cases?))', 'video games?', 'pc games?', 'gaming (?:chairs?|headsets?|mouse|mice|keyboards?|monitors?|desks?|pcs?|laptops?)',
    'graphics cards?', 'processors?', 'motherboards?']), label: 'video games or computer (Technology Gear World)' },
  { re: /$^/, anywhere: words(['supplements?', 'vitamin (?:tablets|gummies|capsules|supplements?)', 'protein (?:powder|shakes?|bars?)', 'paracetamol', 'ibuprofen', 'antihistamines?', 'pregnancy tests?', 'ovulation tests?',
    'hair (?:dye|colou?r)', 'anti-?ageing', 'anti-?wrinkle', 'botox', 'tanning', 'razors?(?! (?:scooters?|crest|e\\d))', 'shaving']), label: 'health or adult beauty (not for a children\'s site)' },
  { re: /$^/, anywhere: words(['car (?:chargers?|wash|wax|polish|shampoo|mats?|batter(?:y|ies)|covers?|vacuums?)', 'dash ?cams?', 'motorcycle (?:helmets?|jackets?|gloves?|boots?)', 'motorbike (?:helmets?|jackets?)', 'tyres? (?:for cars?|for vans?)', 'alloy wheels?']),
    label: 'car or motorbike product (Car / Biker Gear World)' },
  { re: words(['chocolates?', 'sweets', 'crisps', 'sauce', 'coffee (?:beans|pods|capsules)', 'ground coffee', 'tea bags', 'biscuits']), label: 'food or drink (not shown)' }
];

// ---------- Categories ----------
// needsKid: only with a sign that it is for children (rule 1); adult: where it belongs without one.
const RULES = [
  { key: 'kids-tech', slug: 'kids-tech', needsKid: true, adult: 'tech product (Technology Gear World)',
    include: words(['tablets?', 'cameras?', 'instant (?:print )?cameras?', 'smart ?watch(?:es)?', 'walkie[- ]?talkies?', 'headphones?', 'headsets?', 'earbuds?', 'earphones?', 'karaoke(?: machines?| sets?)?', 'lcd pads?',
      'microphones?', 'kidizoom', 'toniebox', 'tonies', 'yoto(?: player| mini)?', 'mp3 players?', 'radios?', 'projectors?', 'learning laptops?', 'toy laptops?', 'drawing tablets?', 'writing tablets?',
      'lcd (?:writing|drawing) (?:tablets?|boards?|pads?)', 'doodle (?:boards?|pads?)', 'smart glasses', 'tablet (?:cases?|covers?|stands?|holders?)', 'ipad (?:cases?|covers?)']),
    exclude: words(['play-?doh', 'playmobil', 'lego', 'duplo', 'mega bloks', 'rattle', 'teether', 'toy kitchen', 'dolls?', 'stroller', 'pram', 'stickers?', 'dishwasher tablets?', 'water tablets?',
      'camera (?:bags?|straps?)', 'monitors?', 'night ?lights?', 'nightlights?']),
    subs: [['Kids Cameras', words(['cameras?', 'kidizoom (?:camera|duo|print|snap)', 'instant print'])], ['Kids Smartwatches', words(['smart ?watch(?:es)?', 'kidizoom smartwatch'])],
      ['Kids Tablets', words(['tablets?(?! (?:cases?|covers?|stands?|holders?))', 'learning laptops?', 'toy laptops?'])], ['Headphones', words(['headphones?', 'earbuds?', 'earphones?'])],
      ['Karaoke & Microphones', words(['karaoke', 'microphones?'])], ['Toy Drawing Tablets', words(['drawing tablets?', 'writing tablets?', 'lcd (?:writing|drawing)', 'doodle'])],
      ['PDA Cases', words(['tablet (?:cases?|covers?)', 'ipad (?:cases?|covers?)'])], ['Smart Glasses', words(['smart glasses'])], ['Kids Tech', /./]] },
  { key: 'school-backpacks', slug: 'school-backpacks', needsKid: true, adult: 'bag (Men\'s / Women\'s / Travel Gear World)',
    include: words(['school ?bags?', 'book ?bags?', 'backpacks?', 'rucksacks?', 'pencil ?cases?', 'pencil (?:pots?|tins?)', 'lunch ?(?:box(?:es)?|bags?)', 'pe bags?', 'gym ?sacks?', 'satchels?',
      'stationery(?: sets?)?', 'pencils?', 'pens', 'rulers?', 'erasers?', 'rubbers', 'sharpeners?', 'notebooks?', 'exercise books?', 'glue sticks?', 'scissors', 'geometry sets?', 'highlighters?']),
    exclude: words(['make-?up', 'eyeliner', 'lip', 'brow', 'nail scissors', 'grooming scissors', 'baby scissors']),
    subs: [['Pencil Cases', words(['pencil ?cases?', 'pencil (?:pots?|tins?)'])], ['Lunch Boxes & Bags', words(['lunch'])], ['School Bags', words(['school ?bags?', 'book ?bags?', 'backpacks?', 'rucksacks?', 'pe bags?', 'gym ?sacks?', 'satchels?'])],
      ['Stationery & Art Supplies', /./]] },
  { key: 'baby-toddler', slug: 'baby-toddler',
    include: words(['baby bottles?', 'feeding bottles?', 'anti-?colic', 'bottle teats?', 'teats?', 'soothers?', 'pacifiers?', 'dumm(?:y|ies)', 'teethers?', 'teething(?: rings?| toys?)?', 'sterili[sz]ers?',
      'bottle (?:warmers?|makers?|prep)', 'breast ?pumps?', 'breast (?:pads?|milk)', 'nursing (?:pillows?|covers?|bras?|pads?)', 'feeding (?:pillows?|sets?|spoons?|bowls?|cups?)', 'weaning(?: sets?| spoons?| bowls?)?',
      'suction (?:bowls?|plates?)', 'sippy(?: cups?)?', 'beakers?', 'trainer cups?', 'straw cups?', '(?:baby|bandana|weaning|feeding|dribble|pelican|silicone|muslin|coverall) bibs?', 'bibs? (?:sets?|packs?)', '\\d+ ?(?:pack|pk) bibs?', 'burp cloths?', 'muslins?', 'swaddl\\w*', 'receiving blankets?',
      'baby (?:bath(?:s|tubs?)?|wash|lotion|shampoo|cream|wipes?|monitors?|carriers?|slings?|gyms?|walkers?|bouncers?|swings?|rockers?|nests?|food|formula|snacks?|toys?|blankets?|sleeping bags?|towels?|gates?|safety|grooming)',
      'bath (?:seats?|supports?)', 'hooded towels?', 'top ?and ?tail', 'nappies', 'nappy(?: (?:bags?|bins?|buckets?|liners?|covers?|wraps?|cream|caddy|changing))?', 'diapers?', 'wet bags?', 'water ?wipes',
      'changing (?:mats?|units?|tables?|trays?|bags?|stations?)', 'potty(?: training)?', 'toilet (?:training seats?|trainers?)', 'trainer seats?', '(?:toddler|kids|potty) step stools?',
      'high ?chairs?', 'booster seats?', 'car seats?', 'isofix', 'car seat (?:accessories|covers?|mirrors?|inserts?|organi[sz]ers?)', 'pushchairs?', 'prams?', 'strollers?', 'buggies', 'buggy',
      'travel systems?', 'footmuffs?', 'rain ?covers?', 'cots?', 'cot beds?', 'cribs?', 'cradles?', 'moses baskets?', 'bassinets?', 'bedside cribs?', 'travel cots?', 'playpens?', 'play ?pens?',
      'safety gates?', 'stair gates?', 'cupboard locks?', 'corner (?:guards?|protectors?)', 'socket covers?', 'door stoppers?', 'baby monitors?', 'nasal aspirators?', 'grobags?', 'sleeping bags? baby',
      'sleepsuits?', 'rattles?', 'play ?gyms?', 'activity (?:gyms?|centres?|mats?)', 'baby walkers?', 'bouncers?', 'jumperoos?', 'shape sorters?', 'stacking (?:cups?|rings?|toys?)', 'pull ?along', 'push ?along',
      'bath (?:toys?|squirters?|crayons?|books?|boats?|tubes|pipes)', 'squirters?', 'rubber ducks?', 'learning towers?', 'formula(?: milk)?', 'follow-?on milk', 'baby food', 'purees?', 'rusks?', 'bath (?:chairs?|seats?)', 'gates? (?:extensions?|spacers?|fixing kits?)', 'gate extensions?', 'baby parasols?', 'pram parasols?',
      'nappy (?:wallets?|clutch(?:es)?)', 'nail scissors', 'grooming scissors', 'night ?lights?', 'nightlights?', 'hooded (?:bath )?towels?', 'splash mats?', 'bed (?:guards?|rails?|guard rails?)', 'moses basket bedding', '(?:cot|baby|musical|crib) mobiles?']),
    exclude: words(['dog', 'puppy', 'cat', 'adult', 'motorbike', 'motorcycle', 'shower curtain', 'garden gate', 'pet gate', 'gate valve', 'rain covers? (?:for (?:bikes?|motorcycles?|scooters?))', 'doll(?:s|\'s)? (?:pram|pushchair|stroller|cot|high ?chair)', 'toy (?:pram|pushchair)']),
    subs: [['Baby Bottles', words(['baby bottles?', 'feeding bottles?', 'anti-?colic', 'bottles?'])], ['Baby Bottle Teats & Liners', words(['teats?', 'liners?'])], ['Baby Soothers', words(['soothers?', 'pacifiers?', 'dumm(?:y|ies)'])],
      ['Dummies & Teethers', words(['teethers?', 'teething'])], ['Bottle Warmers & Sterilisers', words(['sterili[sz]ers?', 'bottle (?:warmers?|makers?|prep)'])], ['Breast Pumps', words(['breast ?pumps?'])],
      ['Nursing Pillows', words(['nursing pillows?', 'feeding pillows?', 'pregnancy pillows?'])], ['Nursing & Feeding', words(['weaning', 'feeding', 'suction', 'bowls?', 'plates?', 'spoons?', 'cutlery', 'food (?:pouches?|makers?|storage)', 'breast (?:pads?|milk)', 'nursing (?:covers?|bras?|pads?)'])],
      ['Sippy Cups', words(['sippy', 'beakers?', 'trainer cups?', 'straw cups?'])], ['Bibs', words(['bibs?'])], ['Burp Cloths', words(['burp cloths?', 'muslins?'])],
      ['Baby Bathing', words(['baby (?:bath|wash|lotion|shampoo|cream|towels?)', 'hooded towels?', 'top ?and ?tail', 'lotion', 'shampoo', 'body wash'])], ['Baby Bathtubs & Bath Seats', words(['bath(?:s|tubs?)', 'bath (?:seats?|supports?)'])],
      ['Changing Mats & Trays', words(['changing'])], ['Nappies', words(['nappies', 'nappy', 'diapers?'])], ['Nappy Wet Bags', words(['wet bags?'])], ['Nappy Buckets', words(['nappy (?:bins?|buckets?)'])],
      ['Baby Wipes', words(['wipes?'])], ['Potty Training', words(['potty', 'toilet', 'trainer seats?', 'step stools?'])], ['High Chairs & Boosters Seats', words(['high ?chairs?', 'booster seats?'])],
      ['Baby & Toddler Car Seats', words(['car seats?', 'isofix'])], ['Baby & Toddler Car Seat Accessories', words(['car seat (?:accessories|covers?|mirrors?|inserts?|organi[sz]ers?)'])],
      ['Pushchairs & Prams', words(['pushchairs?', 'prams?', 'strollers?', 'buggies', 'buggy', 'travel systems?'])], ['Baby Pushchair & Pram Accessories', words(['footmuffs?', 'rain ?covers?', '(?:pushchair|pram|stroller|buggy) (?:\\w+ )?(?:accessories|organi[sz]ers?|hooks?|clips?|fans?|parasols?|liners?|cups? holders?|bags?)'])],
      ['Cribs & Cradles', words(['cots?', 'cot beds?', 'cribs?', 'cradles?', 'moses baskets?', 'bassinets?', 'travel cots?'])], ['Baby & Pet Safety Gates', words(['safety gates?', 'stair gates?', 'baby gates?'])],
      ['Baby Safety', words(['cupboard locks?', 'corner (?:guards?|protectors?)', 'socket covers?', 'door stoppers?', 'baby safety'])], ['Baby Monitors', words(['monitors?'])],
      ['Nasal Aspirators', words(['nasal aspirators?'])], ['Night Lights & Ambient Lighting', words(['night ?lights?', 'nightlights?'])], ['Baby Safety Rails', words(['bed (?:guards?|rails?|guard rails?)'])], ['Baby & Pet Gate Accessories', words(['gates? (?:extensions?|spacers?|fixing kits?)', 'gate extensions?'])], ['Baby Mobiles', words(['mobiles?'])], ['Baby & Toddler Sleepwear', words(['grobags?', 'sleeping bags?', 'sleepsuits?'])], ['Swaddling Blankets', words(['swaddl\\w*', 'receiving blankets?', 'baby blankets?'])],
      ['Baby Carriers', words(['baby carriers?', 'baby slings?'])], ['Rattles', words(['rattles?'])], ['Play Gyms', words(['play ?gyms?', 'activity gyms?', 'baby gyms?'])],
      ['Baby Walkers & Entertainers', words(['walkers?', 'bouncers?', 'jumperoos?', 'baby swings?', 'rockers?'])], ['Sorting & Stacking Toys', words(['shape sorters?', 'stacking'])], ['Push & Pull Toys', words(['pull ?along', 'push ?along'])],
      ['Bath Toys', words(['bath (?:toys?|squirters?|crayons?|books?|boats?|tubes|pipes)', 'squirters?', 'rubber ducks?'])], ['Baby & Toddler Furniture', words(['learning towers?'])], ['Baby Activity Toys', words(['baby toys?', 'activity (?:centres?|mats?)', 'playpens?', 'play ?pens?'])], ['Baby Formula', words(['formula', 'follow-?on milk'])], ['Baby Food', words(['baby food', 'purees?', 'rusks?', 'baby snacks?'])],
      ['Baby Health & Grooming Kits', words(['grooming', 'nail (?:clippers?|files?|scissors)', 'thermometers?', 'toothbrush(?:es)?', 'hairbrush(?:es)?'])], ['Baby & Toddler', /./]] },
  { key: 'toys-games', slug: 'toys-games',
    include: words(['toys?', 'games?', 'board games?', 'card games?', 'playing cards', 'puzzles?', 'jigsaws?', 'lego', 'duplo', 'mega bloks', 'building (?:blocks|bricks|sets?)', 'construction (?:sets?|toys?)',
      'magnetic (?:tiles|blocks)', 'k\'?nex', 'meccano', 'dolls?', 'doll ?(?:houses?|prams?|pushchairs?|accessories)', 'dollhouses?', 'barbie', 'figures?', 'figurines?', 'action figures?', 'playsets?', 'play ?sets?',
      'plush(?:ies)?', 'soft toys?', 'cuddly', 'teddy', 'teddies', 'teddy bears?', 'squishmallows?', 'play-?doh', 'play dough', 'modelling dough', '(?:thinking|play|bouncing) putty', 'slime', 'kinetic sand', 'modelling (?:clay|dough)',
      'craft (?:kits?|sets?)', 'colouring(?: books?| sets?)?', 'coloring(?: books?)?', 'sticker (?:books?|sets?|packs?)', 'stickers?', 'bead (?:kits?|sets?)', 'beads', 'loom bands', 'jewellery making(?: kits?)?',
      'paint (?:sets?|kits?)', 'painting (?:sets?|kits?)', 'activity (?:books?|kits?|sets?|cubes?)', 'scratch art', 'mosaic', 'remote control(?:led)? (?:cars?|trucks?|boats?|helicopters?|drones?|toys?|robots?|vehicles?|dinosaurs?|stunt|tanks?|trains?)', 'rc (?:cars?|trucks?|boats?|helicopters?)', 'r\\/c',
      'toy (?:cars?|trucks?|lorr(?:y|ies)|vehicles?|trains?|tools?|kitchens?|diggers?|tractors?)', 'hot wheels', 'matchbox', 'die-?cast', 'monster trucks?', 'race tracks?',
      'racing (?:tracks?|sets?)', 'scalextric', 'track sets?', 'train sets?', 'railway sets?', 'nerf', 'blasters?', 'dart guns?', 'cap guns?', 'play (?:kitchens?|food|tents?|houses?)', 'tea sets?',
      'cash registers?', 'shopping trolleys?', 'doctors? (?:kits?|sets?)', 'role play', 'pretend play', 'tool (?:benches?|bench)', 'xylophones?', 'musical (?:toys?|instruments?)', 'drum (?:kits?|sets?)',
      'toy (?:pianos?|guitars?|drums?)', 'science (?:kits?|sets?)', 'experiments?', 'stem (?:kits?|toys?)', 'microscopes?', 'telescopes?', 'chemistry sets?', 'crystal growing', 'robots?', 'robotic',
      'educational (?:toys?|games?)', 'learning (?:toys?|games?)', 'flash ?cards?', 'montessori', 'ride[- ]?ons?', 'electric (?:cars?|motorbikes?|quads?|tractors?|jeeps?) for kids', 'pedal (?:cars?|go[- ]?karts?)',
      'go[- ]?karts?', 'hobby horses?', 'rocking horses?', 'fidget(?: toys?)?', 'pop[- ]?its?', 'fidget spinners?', 'yo-?yos?', 'puppets?', 'marionettes?', 'magic sets?', 'snow globes?', 'kaleidoscopes?',
      'balloons?', 'party bags?', 'ball pits?', 'ball ponds?', 'water beads', 'schleich', 'pianos?', 'keyboards? (?:for kids|toy)', 'playhouses?', 'play ?houses?', 'advent calendars?', 'sylvanian', 'hatchimals',
      'lol surprise', 'playmobil', 'teamsterz', 'blind (?:bags?|box(?:es)?)', 'trading cards?', 'collectibles?', 'minifigures?', 'beyblades?', 'gel blasters?', 'jewell?ery (?:making|creation|design)(?: kits?| sets?)?',
      'bracelet (?:making|design) (?:kits?|sets?)', 'juggling (?:rings?|balls?)', 'iron beads?', 'model kits?', 'train (?:\\+|and|&) wagons?', 'doll accessories', 'barbie accessories']),
    exclude: words(['cufflinks?', 'lapel pins?', 'pin badges?', 'suitcases?', 'luggage', 'lanterns?', 'video games?', 'gaming', 'pc games?', 'game (?:controllers?|consoles?|cards? for)', 'dog toys?', 'cat toys?', 'pet toys?', 'sex toys?', 'adult games?', 'drinking games?', 'game of thrones',
      'motorcycle', 'car (?:spare|parts?)', 'figure skating', 'figure-?hugging', 'lawn ?mower', 'tractor (?:parts?|seats?)']),
    subs: [['Construction Set Toys', words(['lego', 'duplo', 'mega bloks', 'building (?:blocks|bricks|sets?)', 'construction (?:sets?|toys?)', 'magnetic (?:tiles|blocks)', 'k\'?nex', 'meccano', 'bricks', 'blocks'])],
      ['Board Games', words(['board games?', 'games?', 'family games?', 'party games?'])], ['Card Games', words(['card games?', 'playing cards', 'trading cards?', 'uno', 'top trumps'])],
      ['Jigsaw Puzzles', words(['jigsaws?', 'puzzles?', '\\d+ ?(?:pc|pcs|piece|pieces)'])], ['Dolls', words(['dolls?', 'barbie', 'baby born', 'baby annabell', 'lol surprise', 'reborn'])],
      ['Doll & Action Figure Accessories', words(['doll ?(?:houses?|prams?|pushchairs?|accessories|clothes|outfits?)', 'dollhouses?', 'figure accessories'])],
      ['Action & Toy Figures', words(['figures?', 'figurines?', 'action figures?', 'playsets?', 'play ?sets?', 'schleich', 'minifigures?', 'sylvanian', 'hatchimals', 'collectibles?', 'blind (?:bags?|box(?:es)?)'])],
      ['Stuffed Animals & Cuddly Toys', words(['plush(?:ies)?', 'soft toys?', 'cuddly', 'teddy', 'teddies', 'teddy bears?', 'squishmallows?', 'jellycat'])],
      ['Play Dough & Putty', words(['play-?doh', 'dough', 'putty', 'slime', 'kinetic sand', 'modelling (?:clay|dough)'])],
      ['Toy Craft Kits', words(['craft (?:kits?|sets?)', 'colouring(?: books?| sets?)?', 'coloring', 'sticker (?:books?|sets?|packs?)', 'stickers?', 'bead (?:kits?|sets?)', 'beads', 'loom bands', 'jewellery making', 'paint (?:sets?|kits?)', 'painting', 'activity (?:books?|kits?)', 'scratch art', 'mosaic'])],
      ['Remote Control Cars & Lorries', words(['remote control(?:led)?', 'rc (?:cars?|trucks?)', 'r\\/c'])], ['Toy Cars', words(['toy cars?', 'hot wheels', 'matchbox', 'die-?cast', 'cars? (?:sets?|packs?)'])],
      ['Toy Lorries & Construction Vehicles', words(['toy (?:trucks?|lorr(?:y|ies))', 'trucks?', 'lorr(?:y|ies)', 'diggers?', 'excavators?', 'tractors?', 'dump', 'fire engines?', 'monster trucks?', 'cranes?'])],
      ['Toy Racing Car & Track Sets', words(['race tracks?', 'racing (?:tracks?|sets?)', 'scalextric', 'track sets?'])], ['Toy Trains & Train Sets', words(['trains?', 'train sets?', 'railway', 'brio'])],
      ['Toy Weapons & Gadgets', words(['nerf', 'blasters?', 'dart guns?', 'cap guns?', 'toy (?:guns?|swords?)', 'swords?', 'gel blasters?'])],
      ['Toy Kitchens & Play Food', words(['toy kitchens?', 'play (?:kitchens?|food)', 'kitchens?', 'tea sets?'])], ['Pretend Shopping & Grocery', words(['cash registers?', 'shopping trolleys?', 'tills?'])],
      ['Pretend Professions & Role Playing', words(['doctors? (?:kits?|sets?)', 'role play', 'pretend play', 'vet (?:kits?|sets?)'])], ['Toy Tools', words(['toy tools?', 'tool (?:benches?|bench|sets?|kits?)'])],
      ['Musical Toys', words(['xylophones?', 'musical', 'drum (?:kits?|sets?)', 'toy (?:pianos?|guitars?|drums?)', 'pianos?', 'guitars?'])],
      ['Science & Exploration Sets', words(['science', 'experiments?', 'stem', 'microscopes?', 'chemistry', 'crystal growing', 'volcano'])], ['Telescopes', words(['telescopes?'])], ['Robotic Toys', words(['robots?', 'robotic'])],
      ['Educational Toys', words(['educational', 'learning', 'flash ?cards?', 'montessori', 'alphabet', 'counting', 'phonics'])], ['Electric Riding Vehicles', words(['ride[- ]?ons?', 'electric (?:cars?|motorbikes?|quads?|tractors?|jeeps?)'])],
      ['Push & Pedal Riding Vehicles', words(['pedal (?:cars?|go[- ]?karts?)', 'go[- ]?karts?'])], ['Hobby Horses', words(['hobby horses?', 'rocking horses?'])], ['Puppets & Marionettes', words(['puppets?', 'marionettes?'])],
      ['Activity Toys', words(['fidget', 'pop[- ]?its?', 'spinners?', 'yo-?yos?', 'activity cubes?', 'magic sets?', 'kaleidoscopes?', 'snow globes?', 'water beads'])], ['Ball Ponds', words(['ball pits?', 'ball ponds?'])],
      ['Bath Toys', words(['bath (?:toys?|squirters?|crayons?|books?)', 'squirters?', 'rubber ducks?'])], ['Toys & Games', /./]] },
  { key: 'sports-outdoors', slug: 'sports-outdoors', needsKid: true, adult: 'sports or outdoor product (Sporty / Garden Gear World)',
    include: words(['scooters?', 'kick scooters?', 'balance bikes?', 'bikes?', 'bicycles?', 'trikes?', 'tricycles?', 'helmets?', 'trampolines?', 'swings?', 'swing sets?', 'slides?', 'climbing frames?', 'sand ?pits?',
      'sandboxes?', 'paddling pools?', 'pools?', 'water (?:guns?|pistols?|blasters?|tables?|play(?: centres?)?|slides?|mats?)', 'splash (?:pads?|mats?)', 'sprinklers?', 'bubbles?', 'bubble (?:machines?|wands?|guns?)',
      'kites?', 'footballs?', 'goals?', 'basketball (?:hoops?|sets?|stands?)', 'swim(?:ming)? (?:aids?|vests?|rings?|floats?|caps?|goggles)', 'armbands', 'rubber rings?', 'inflatables?', 'float(?:s|ies)',
      'outdoor games?', 'garden games?', 'skipping ropes?', 'hula hoops?', 'frisbees?', 'roller ?skates?', 'inline skates?', 'skateboards?', 'wagons?', 'sledges?', 'sleds?', 'boules', 'croquet',
      'swingball', 'pogo sticks?', 'space hoppers?', 'stilts', 'shin (?:pads?|guards?)', 'goalkeeper gloves', 'rackets?', 'racquets?', 'tennis (?:sets?|balls?)', 'cricket sets?', 'golf sets?',
      'boxing (?:gloves?|sets?)', 'trampoline (?:nets?|covers?)', 'beach (?:toys?|sets?)', 'sand (?:toys?|sets?|moulds?)', 'buckets? (?:and|&) spades?', 'play ?tents?', 'tents?', 'tunnels?', 'binoculars?',
      'bathing rings?', 'swim(?:ming)? rings?', 'water bouncers?', 'balance beams?', '(?:elbow|knee|wrist) (?:(?:&|and) (?:elbow|knee|wrist) )?pads?', 'protective gear', 'pickleball', 'paddles?', 'stepping stones?', 'gymnastics (?:bars?|mats?)']),
    exclude: words(['ride[- ]?ons?', 'motorbike', 'motorcycle', 'electric scooters? for adults', 'mobility scooters?', 'pool (?:tables?|cues?|chemicals?|chlorine)', 'chlorine', 'slides? (?:for adults)', 'goal ?setting',
      'bike (?:racks?|carriers?|locks?|lights?|pumps?)', 'football (?:shirts?|kits?|boots?)']),
    subs: [['Water Play Equipment', words(['paddling pools?', 'pools?', 'water', 'splash', 'sprinklers?', 'swim(?:ming)?', 'armbands', 'rubber rings?', 'inflatables?', 'float(?:s|ies)'])],
      ['Bubble Blowing Toys', words(['bubbles?', 'bubble'])], ['Riding Scooters', words(['scooters?'])], ['Bicycles', words(['balance bikes?', 'bikes?', 'bicycles?', 'trikes?', 'tricycles?'])],
      ['Cycling Helmets', words(['helmets?'])], ['Wagons', words(['wagons?'])], ['Kids Riding Vehicles', words(['go[- ]?karts?', 'sledges?', 'sleds?'])],
      ['Outdoor Games', words(['outdoor games?', 'garden games?', 'kites?', 'frisbees?', 'boules', 'croquet', 'swingball', 'skipping ropes?', 'hula hoops?', 'pogo sticks?', 'space hoppers?', 'stilts', 'goals?', 'footballs?'])],
      ['Sports & Outdoors', /./]] },
  { key: 'accessories', slug: 'accessories', needsKid: true, adult: 'accessory (Men\'s / Women\'s Gear World)',
    include: words(['watch(?:es)?', 'sunglasses', 'umbrellas?', 'hair (?:clips?|bows?|bands?|accessories|slides?|bobbles?)', 'headbands?', 'scrunchies?', 'jewell?ery(?: sets?)?', 'necklaces?', 'bracelets?',
      'earrings?', 'rings?(?! (?:binders?|sling))', 'purses?', 'wallets?', 'keyrings?', 'key ?chains?', 'tiaras?', 'crowns?', 'party (?:hats?|masks?)']),
    exclude: words(['smart ?watch(?:es)?', 'watch (?:straps?|bands?) for (?:apple|samsung|garmin)', 'teething rings?', 'swim(?:ming)? rings?', 'rubber rings?', 'stacking rings?', 'face masks?', 'eye masks?', 'snorkel', 'bathing rings?', 'juggling rings?', 'flow rings?', 'kits?', 'making', 'nappy', 'craft']),
    subs: [['Kids Watches', words(['watch(?:es)?'])], ['Sunglasses', words(['sunglasses'])], ['Jewellery Making Kits', words(['jewell?ery making'])], ['Accessories', /./]] },
  { key: 'shoes', slug: 'shoes', needsKid: true, adult: 'shoes (Men\'s / Women\'s Gear World)',
    include: words(['shoes?', 'trainers?', 'sneakers?', 'boots?', 'football boots?', 'sandals?', 'wellies', 'wellingtons?', 'welly', 'slippers?', 'flip ?flops?', 'crocs', 'clogs', 'plimsolls?',
      'pumps', 'moccasins?', 'astros', 'sliders', 'booties']),
    exclude: words(['shoe (?:polish|cream|brush|horn|racks?|storage|bags?)', 'shoe ?laces', 'insoles?', 'boot (?:racks?|trays?|bags?)', 'breast pumps?', 'car boot', 'boot (?:liners?|organi[sz]ers?)', 'skates?', 'skating', 'barbie', 'dolls?', 'balance beams?']),
    subs: [['Trainers', words(['trainers?', 'sneakers?', 'running'])], ['Shoes', /./]] },
  { key: 'clothing', slug: 'clothing', needsKid: true, adult: 'clothing (Men\'s / Women\'s Gear World)',
    include: words(['t-?shirts?', 'tops?', 'tees?', 'shirts?', 'polos?', 'blouses?', 'dress(?:es)?', 'skirts?', 'trousers', 'jeans', 'leggings', 'joggers?', 'jogging bottoms', 'shorts', 'pyjamas?', 'pajamas?',
      'pjs', 'nightwear', 'nighties?', 'nightdress(?:es)?', 'dressing gowns?', 'robes?', 'onesies?', 'sleepsuits? (?:for toddlers?)', 'bodysuits?', 'babygrows?', 'rompers?', 'dungarees', 'jumpers?', 'sweaters?',
      'cardigans?', 'hoodies?', 'hoody', 'sweatshirts?', 'coats?', 'jackets?', 'gilets?', 'fleeces?', 'parkas?', 'raincoats?', 'snowsuits?', 'puddle suits?', 'swimsuits?', 'swimwear', 'swim ?shorts',
      'bikinis?', 'rash vests?', 'tracksuits?', 'socks', 'tights', 'underwear', 'pants', 'knickers', 'boxers', 'briefs', 'vests?', 'hats?', 'beanies?', 'caps?', 'gloves', 'mittens', 'scarf', 'scarves',
      'snoods?', '(?:football|pe|sports?|team|home|away) kits?', 'jerseys?', 'base ?layers?', 'outfits?', 'clothing sets?', 'costumes?', 'fancy dress', 'dress[- ]up(?: sets?| costumes?)?', 'uniforms?', 'bottoms', 'tutus?', 'leotards?']),
    exclude: words(['doll(?:s|\'s)? (?:clothes|outfits?|dress(?:es)?)', 'for dolls', 'barbie (?:clothes|fashion pack)', 'dress[- ]up dolls?', 'pet costumes?', 'dog coats?', 'shower caps?', 'swim caps?', 'bottle caps?',
      'cap guns?', 'oven gloves', 'gardening gloves', 'work gloves', 'kit (?:bags?)', 'first aid kits?', 'craft kits?', 'science kits?', 'repair kits?', 'tool kits?', 'drum kits?', 'doctors? kits?', 'kits? for']),
    subs: [['Socks', words(['socks', 'tights'])], ['Nightwear & Loungewear', words(['pyjamas?', 'pajamas?', 'pjs', 'nightwear', 'nighties?', 'nightdress(?:es)?', 'dressing gowns?', 'robes?', 'onesies?', 'loungewear'])],
      ['Trousers & Jeans', words(['trousers', 'jeans', 'joggers?', 'jogging bottoms', 'leggings'])], ['Shirts & Tops', words(['t-?shirts?', 'tops?', 'tees?', 'shirts?', 'polos?', 'blouses?'])], ['Clothing', /./]] },
  { key: 'bedroom-home', slug: 'bedroom-home', needsKid: true, adult: 'home item (Home Gear World)',
    include: words(['duvet (?:covers?|sets?)', 'duvets?', 'bedding(?: sets?)?', 'bed ?linen', 'bed ?sheets?', 'fitted sheets?', 'pillows?', 'pillowcases?', 'cushions?', 'curtains?', 'blinds?', 'rugs?',
      'wall (?:stickers?|decals?|art|murals?)', 'toy (?:storage|boxes?|box|chests?|organi[sz]ers?)', 'storage (?:boxes?|units?|baskets?|bins?|cubes?)', 'bookcases?', 'book ?shel(?:f|ves)', 'beds?', 'bunk beds?',
      'cabin beds?', 'mid sleepers?', 'high sleepers?', 'toddler beds?', 'mattress(?:es)?', 'mattress protectors?', 'chairs?', 'armchairs?', 'sofas?', 'bean ?bags?', 'tables?', 'table (?:and|&) chairs?',
      'desks?', 'wardrobes?', 'chests? of drawers', 'drawers', 'lamps?', 'night lights?', 'lampshades?', 'height charts?', 'towels?', 'blankets?', 'throws?', 'wall clocks?', 'clocks?', 'mirrors?', 'canopies', 'canopy']),
    exclude: words(['high ?chairs?', 'car seats?', 'booster seats?', 'changing tables?', 'baby (?:blankets?|towels?)', 'hooded towels?', 'nursing pillows?', 'feeding pillows?', 'play tables?', 'water tables?',
      'sand tables?', 'activity tables?', 'doll(?:s|\'s)? (?:beds?|furniture)', 'pet beds?', 'dog beds?', 'cat beds?', 'sunbeds?', 'beds? for (?:dogs?|cats?)', 'garden', 'flower beds?', 'raised beds?']),
    subs: [['Duvet Covers', words(['duvet', 'duvets?', 'bedding', 'bed ?linen', 'bed ?sheets?', 'fitted sheets?', 'pillowcases?'])], ['Armchairs, Recliners & Sleeper Chairs', words(['armchairs?', 'sofas?', 'chairs?(?! (?:and|&) table)', 'bean ?bags?'])],
      ['Toy Chests', words(['toy (?:storage|boxes?|box|chests?|organi[sz]ers?)'])], ['Mattress Protectors', words(['mattress protectors?'])], ['Bedroom & Home', /./]] }
];

export const CATEGORY_NAMES = {
  kgw: { clothing: 'Clothing', 'baby-toddler': 'Baby & Toddler', 'toys-games': 'Toys & Games', 'sports-outdoors': 'Sports & Outdoors', 'kids-tech': 'Kids Tech',
    'bedroom-home': 'Bedroom & Home', accessories: 'Accessories', shoes: 'Shoes', 'gifts-for-kids': 'Gifts for Kids', 'school-backpacks': 'School & Backpacks' }
};

// The subcategories KGW already shows (live database, 31 Oct 2026): a shop's own leaf section with one of these names
// is used as it is ("Toys & Games > Puzzles > Jigsaw Puzzles" -> "Jigsaw Puzzles").
const KNOWN_SUBS = {
  'toys-games': ['Action & Toy Figures', 'Toy Craft Kits', 'Construction Set Toys', 'Dolls', 'Dolls, Playsets & Toy Figures', 'Play Dough & Putty', 'Board Games', 'Toy Weapons & Gadgets', 'Toy Cars',
    'Activity Toys', 'Toy Lorries & Construction Vehicles', 'Jigsaw Puzzles', 'Stuffed Animals & Cuddly Toys', 'Card Games', 'Musical Toys', 'Toy Kitchens & Play Food', 'Electric Riding Vehicles',
    'Educational Toys', 'Remote Control Cars & Lorries', 'Toy Racing Car & Track Sets', 'Science & Exploration Sets', 'Push & Pedal Riding Vehicles', 'Robotic Toys', 'Toy Tools', 'Toy Trains & Train Sets',
    'Doll & Action Figure Accessories', 'Practice Pads', 'Toy Motorcycles', 'Toy Gift Baskets', 'Beach & Sand Toys', 'Hobby Horses', 'Playground Balls', 'Toy Drawing Tablets', 'Bath Toys',
    'Puppets & Marionettes', 'Telescopes', 'Pretend Shopping & Grocery', 'Pretend Professions & Role Playing', 'Play Vehicles', 'Bubble Blowing Toys', 'Ball Ponds', 'Drawing & Painting Kits', 'Reading Toys',
    'Toy Aeroplanes', 'Toy Gliders', 'Outdoor Play Equipment', 'Toy Helicopters', 'Flying Toys', 'Mechanical Puzzles', 'Wooden & Pegged Puzzles', 'Toy Instruments', 'Dollshouses', 'Remote Control Boats & Watercraft'],
  'sports-outdoors': ['Water Play Equipment', 'Outdoor Games', 'Bubble Blowing Toys', 'Bicycles', 'Riding Scooters', 'Push & Pedal Riding Vehicles', 'Cycling Helmets', 'Kids Riding Vehicles', 'Electric Riding Vehicles',
    'Wagons', 'Play Swings', 'Bouncy Castles'],
  accessories: ['Kids Watches', 'Party Supply Kits', 'Jewellery Making Kits', 'Sunglasses'],
  'bedroom-home': ['Armchairs, Recliners & Sleeper Chairs', 'Duvet Covers', 'Mattress Protectors', 'Toy Chests'],
  'baby-toddler': ['Baby Activity Toys', 'Baby Bathing', 'Baby Bottles', 'Baby Soothers', 'Nursing & Feeding', 'Changing Mats & Trays', 'Bath Toys', 'Baby Health & Grooming Kits', 'Rattles', 'Nappy Wet Bags',
    'Nappies', 'Bibs', 'Nursing Pillows', 'Baby Pushchair & Pram Accessories', 'Baby Bathtubs & Bath Seats', 'Dummies & Teethers', 'Sippy Cups', 'Baby Bottle Teats & Liners', 'Baby Wipes', 'Baby Monitors',
    'Bottle Warmers & Sterilisers', 'Cribs & Cradles', 'Baby & Pet Safety Gates', 'Nappy Buckets', 'Baby Safety', 'Baby & Toddler Car Seat Accessories', 'Alphabet Toys', 'Swaddling Blankets',
    'Baby Carrier Accessories', 'Sorting & Stacking Toys', 'Baby Food', 'Night Lights & Ambient Lighting', 'Baby & Pet Gate Accessories', 'Baby Toys & Activity Equipment', 'Baby & Toddler Nappy Covers',
    'Dummy Wipes', 'Baby Health', 'Potty Training', 'Receiving Blankets', 'Cribs & Toddler Beds', 'Breast Pumps', 'Nappy Bags', 'Baby Carriers', 'Baby Formula', 'High Chairs & Boosters Seats',
    'Baby & Toddler Food', 'Baby & Toddler Sleepwear', 'Breastfeeding Covers', 'Cot & Toddler Bed Accessories', 'Nasal Aspirators', 'Push & Pull Toys', 'Changing Mat & Tray Covers', 'Play Gyms', 'Baby Snacks',
    'Nappy Liners', 'Baby Walkers & Entertainers', 'Baby Safety Locks & Guards', 'Baby & Toddler Furniture', 'Baby & Toddler Car Seats', 'Burp Cloths', 'Baby Wipe Dispensers & Warmers', 'Breast Pump Accessories',
    'Baby Safety Harnesses & Reins', 'Baby Drinks', 'Breast-Milk Storage Containers', 'Baby Safety Rails', 'Pushchairs & Prams', 'Nappy Kits', 'Play Mats', 'Baby Jumpers & Swings', 'Baby Mobiles'],
  clothing: ['Socks', 'Shirts & Tops', 'Baby & Toddler Dresses', 'Baby & Toddler Bottoms', 'Baby & Toddler Socks & Tights', 'Nightwear & Loungewear', 'Trousers & Jeans', 'Baby & Toddler Sleepwear'],
  shoes: ['Trainers'],
  'kids-tech': ['Karaoke & Microphones', 'Headphones', 'Kids Smartwatches', 'Toy Drawing Tablets', 'Kids Cameras', 'PDA Cases', 'Smart Glasses', 'Kids Tablets'],
  'school-backpacks': ['Pencil Cases', 'School Bags', 'Lunch Boxes & Bags', 'Stationery & Art Supplies']
};
const knownSub = (slug, feedCategory) => {
  const parts = String(feedCategory || '').split('>').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const leaf = parts[parts.length - 1].toLowerCase();
  return (KNOWN_SUBS[slug] || []).find(s => s.toLowerCase() === leaf) || null;
};

// Shop sections that say the category when the name does not (Plusshop and Bazta "Baby toys", "Creative toys"; Joybuy
// "Baby & Toddler > ..."). Checked from the deepest folder up.
const SECTIONS = [
  ['baby-toddler', /^(?:baby & toddler|bathroom & care|baby toys|bottles & accessories|eat & drink|changing|dental care|care products|decor & children's room|sensory toys|developmental toys|baby bottles|dummy & accessories|toilet & bath accessories|body lotion|bodywash & shower gel|shampoo, lotion & oil|shampoo & balsam|potty training|baby bath & bath accessories|sterilisator|bibs|service & bibs|medicare|mosquito repellent|toothbrushes|teaching & activity toys|baby & children products)$/],
  ['toys-games', /^(?:toys & games|toys|creative toys|figures & action heroes|action heroes|dolls & accessories|dolls|barbie dolls|games|building & construction toys|r\/c toys|remote controlled toys|toy weapons|play dough|cars & other vehicles|minifigures|beads & peg boards|activities & play time|animals & accessories|music|drawing & painting)$/],
  ['sports-outdoors', /^(?:outdoor toys|bikes, ride-ons and scooters|water toys)$/],
  ['accessories', /^(?:analog watches|wristwatches)$/],
  ['kids-tech', /^(?:children's watches|lights, sounds & picture)$/],
  ['school-backpacks', /^(?:school accessories)$/]
];
function sectionRule(feedCategory) {
  const folders = String(feedCategory || '').split('>').map(s => s.trim().toLowerCase()).filter(Boolean).reverse();
  for (const f of folders) for (const [key, re] of SECTIONS) if (re.test(f)) return RULES.find(r => r.key === key);
  return null;
}
// For a baby (0-24 months): a toy, a bedroom thing or a water toy goes to "Baby & Toddler", as KGW shows them ("Baby
// Stacking Rings Toy", "Clippasafe Plug-In Night Light", "Splash Mat").
const BABY = words(['baby', 'babies', 'infants?', 'newborns?', '\\d{1,2} ?(?:-|to|–) ?\\d{1,2} ?(?:months?|mths?|m)', '\\d{1,2} ?(?:months?|mths?|m) ?\\+', '\\d{1,2}m\\+', '0 ?- ?\\d{1,2}', 'first year']);
const NOT_BABY = /\b(?:baby (?:born|annabell|alive|shark|yoda|doll|dolls|dragon|dino|dinosaur|pink|blue|oil)|babies? (?:dolls?)|cry ?babies)\b/gi;
const BABY_TWIN = new Set(['toys-games', 'bedroom-home', 'sports-outdoors']);
function babyContext(name, feedCategory) {
  const sec = sectionRule(feedCategory);
  if (sec && sec.key === 'baby-toddler') return true;
  return BABY.test(String(name || '').replace(NOT_BABY, ' '));
}

// The category rule whose words come last in the text (ties: the earlier rule).
function bestRule(text) {
  let best = null, at = -1;
  for (const r of RULES) {
    const i = lastAt(r.include, text);
    if (i < 0 || (r.exclude && r.exclude.test(text))) continue;
    if (i > at) { best = r; at = i; }
  }
  return best ? { rule: best, at } : null;
}

export function makeRules(site = 'kgw') {
  if (site !== 'kgw') throw new Error(`kids rules: unknown site ${site}`);
  const slugs = Object.keys(CATEGORY_NAMES.kgw);
  function classify(name, feedCategory = '', paths = '', source = null) {
    const n = String(name || '');
    if (HARD_DENY.test(n)) return { ok: false, reason: 'gift card or voucher' };
    for (const d of DENY) if (d.anywhere && d.anywhere.test(n)) return { ok: false, reason: d.label };
    const head = headOf(n);
    let hit = bestRule(head), where = head, from = 'name';
    if (!hit) { hit = bestRule(n); where = n; }
    if (!hit) {
      const hints = source ? source.sectionHints : true;
      const top = String(feedCategory || '').split('>')[0].trim().toLowerCase();
      const trusted = hints !== false && (!Array.isArray(hints) || hints.some(h => String(h).toLowerCase() === top));
      if (trusted) {
        hit = bestRule(String(feedCategory || ''));
        if (!hit) { const r = sectionRule(feedCategory); if (r) hit = { rule: r, at: n.length }; }
      }
      from = 'section';
      if (!hit && source && source.defaultCategory) { const r = RULES.find(x => x.key === source.defaultCategory); if (r) { hit = { rule: r, at: n.length }; from = 'shop'; } }
    }
    for (const d of DENY) {
      if (from === 'shop' || d.re.source === '$^') continue;
      if (from === 'section' || !hit ? d.re.test(n) : lastAt(d.re, where) > hit.at) return { ok: false, reason: d.label };
    }
    if (!hit) return { ok: false, reason: 'not a children\'s product' };
    let rule = hit.rule;
    if (rule.needsKid && !forChildren(n, feedCategory, source)) return { ok: false, reason: rule.adult };
    let babyDefault = null;
    if (BABY_TWIN.has(rule.key) && babyContext(n, feedCategory) && !(rule.key === 'toys-games' && /\b(?:dolls?|doll's)\b/i.test(head))) {
      babyDefault = rule.key === 'toys-games' ? 'Baby Activity Toys' : 'Baby & Toddler';
      rule = RULES.find(r => r.key === 'baby-toddler');
    }
    const pickSub = text => {
      let best = null, at = -1;
      for (const [label, re] of rule.subs) { if (re.source === '.') continue; const i = lastAt(re, text); if (i > at) { best = label; at = i; } }
      return best;
    };
    const sub = knownSub(rule.slug, feedCategory) || pickSub(head) || pickSub(n) || babyDefault || (rule.subs.find(([, re]) => re.source === '.') || [])[0] || CATEGORY_NAMES.kgw[rule.slug];
    return { ok: true, slug: rule.slug, subcategory: sub, category: CATEGORY_NAMES.kgw[rule.slug] };
  }
  return { classify, CATEGORY_SLUGS: slugs };
}

export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\])\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Minimum quality for any product to be imported (L14). Prices in pounds; a cabin bed or an electric ride-on can cost a few hundred.
export const QUALITY = {
  currencies: ['GBP'],
  minPrice: 1,
  maxPrice: 5000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};
