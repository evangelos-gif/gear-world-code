// Sporty Gear World: which feed products belong on this site, and in which category (lessons L14, L65).
//
// The owner (25 Oct 2026): anything to do with sport belongs here: fitness and gym, bodybuilding, supplements, sports
// shoes, running, cycling, football and team sports (basketball, rugby, NFL, cricket, hockey), racket sports, water
// sports (kayak, SUP, swimming), hiking, climbing and winter sports, golf, skate and more. Rules approved with the
// categories on 25 Oct 2026.
//
// How a product is classified (by tools/sgw-import-plan.mjs):
//   1. The SHOP decides first (sites/sgw/sources.json, "allowPaths"): only products from a shop's sport sections come
//      in. A sport word in the name of a tool or tech shop's product is not enough (lessons L65: "MMA" welders,
//      "Marathon" band-saw blades, "SUP" support contracts, "Scuba" safety shoes).
//   2. DENY rules on the PRODUCT NAME send things to the right Gear World or leave them out: kids' and junior items
//      (Kids'), fashion swimwear (Men's / Women's), smartwatches, fitness trackers, headphones and action cameras
//      (Technology), tents, sleeping bags and luggage (Travel), car racks (Car), pools, trampolines and hot tubs
//      (Garden), safety and work shoes and workwear (Construction), toys, video games, jewellery, costumes and
//      supplements that are not for sport.
//   3. The FIRST rule whose `include` matches the NAME and whose `exclude` does not wins. Order matters: the sport
//      of a shoe or a bag wins over the general "Sportswear, Shoes & Bags" (running shoes are Running, football
//      boots are Football, a cycling helmet is Cycling). General words ("mat", "gloves", "bottle") count only with
//      a sport word in the name or a sport section of the shop (ctx).
//   4. Second chance: the shop's own sport section names the sport ("Sporting Goods > Outdoor Recreation > Cycling").
//   5. No match: rejected as "not sport".

import { fixMojibake } from '../../src/db.js';

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// A shop section that is about sport (Coes "Sports", Joybuy "Sporting Goods", Plusshop/Bazta "Sport & fitness").
const SPORT_FEED = /sport|fitness|exercise|athletic|gym|cycling|bicycle|outdoor recreation|water sports|winter sports|racquet|racket|golf|yoga|boxing|martial arts|team sports|climbing|skate/i;
const HEALTH_FEED = /health ?(?:&|and)? ?beauty|health ?care|pharmacy|vitamins? (?:&|and) supplements/i;
// Words that name sport gear, for a product in a sport section whose name has no sport word (step 4).
const GEAR_WORDS = words(['balls?', 'mats?', 'bands?', 'gloves?', 'shoes?', 'trainers?', 'boots?', 'bottles?', 'bags?', 'nets?', 'goals?', 'boards?',
  'helmets?', 'pads?', 'guards?', 'grips?', 'weights?', 'bars?', 'benches?', 'racks?', 'ropes?', 'poles?', 'paddles?', 'rods?', 'reels?',
  'skates?', 'scooters?', 'targets?', 'cones?', 'ladders?', 'hurdles?', 'whistles?', 'goggles', 'caps?', 'rackets?', 'racquets?', 'bats?',
  'clubs?', 'tees?', 'wetsuits?', 'harness(?:es)?', 'carabiners?', 'jerseys?', 'shorts', 'leggings', 'tops?', 'jackets?', 'socks?', 'shirts?']);
const SPORT_WORDS = words(['sports?', 'sporting', 'gym', 'fitness', 'workouts?', 'training', 'exercises?', 'athletic', 'athletics',
  'running', 'runners?', 'jogging', 'cycling', 'cyclists?', 'bikes?', 'bicycles?', 'football', 'soccer', 'rugby', 'cricket', 'hockey',
  'basketball', 'netball', 'volleyball', 'tennis', 'badminton', 'squash', 'padel', 'pickleball', 'golf', 'yoga', 'pilates', 'crossfit',
  'boxing', 'mma', 'martial arts', 'karate', 'judo', 'taekwondo', 'kickboxing', 'swim', 'swimming', 'triathlon', 'marathon', 'ski',
  'skiing', 'snowboard(?:ing)?', 'hiking', 'trekking', 'climbing', 'bouldering', 'kayak(?:ing)?', 'surf(?:ing)?', 'paddle ?board(?:ing)?',
  'weightlifting', 'bodybuilding', 'powerlifting', 'cardio', 'hiit', 'nfl', 'skate ?board(?:ing)?', 'fishing', 'angling']);

export const DENY = [
  { label: 'kids\' or junior item (Kids\' Gear World)', re: words(['kids?', "kid's", 'children', "children'?s", 'child', "child'?s", 'junior', 'juniors', 'jnr', 'boys?', "boy'?s", 'girls?', "girl'?s", 'toddlers?', 'baby', 'babies', 'infants?', 'youth', 'balance bikes?', 'trikes?', 'tricycles?', 'stabilisers?', '(?:12|14|16|18) ?(?:inch|in|") (?:wheels? )?bikes?', 'paddling pools?', 'play ?houses?', 'swing sets?', 'royal ?baby', 'youngstar', 'pogo (?:jumpers?|sticks?)']) },
  // Coes marks junior sizes with letters at the end of the name: "Runfalcon 5 J", "Duramo Sl2 El C Trainers" (plan, 25 Oct 2026).
  { label: 'kids\' or junior item (Kids\' Gear World)', re: /\s(?:J|EL|El|EL [CI]|El [CI]|C|I)(?:\s+(?:Boots?|Trainers?|Shoes?))?$/ },
  { label: 'fashion swimwear (Men\'s / Women\'s Gear World)', re: words(['bikinis?', 'swimsuits?(?! for (?:training|competition))', 'swimming costumes?', 'swim (?:shorts?|boxers?|trunks|dress(?:es)?|briefs)', 'shaping', '(?:1|one)[- ]?piece', 'board ?shorts', 'tankinis?', 'beach ?wear', 'kaftans?', 'sarongs?', 'cover-?ups?']) },
  { label: 'smartwatch, fitness tracker or tech (Technology Gear World)', re: words(['smart ?watch(?:es)?', 'fitness (?:trackers?|bands?|watch(?:es)?)', 'activity (?:trackers?|bands?)', 'gps (?:sports? )?watch(?:es)?', 'sports? watch(?:es)?', 'running watch(?:es)?', 'heart rate (?:monitors?|straps?|sensors?|watch(?:es)?)', 'apple watch', 'galaxy watch', 'fitbit', 'garmin (?:forerunner|fenix|venu|vivoactive|vivosmart|instinct|epix|enduro)', 'smart rings?', 'watch (?:bands?|straps?|loops?)', '(?:sport|solo) (?:band|loop)', 'earbuds', 'ear ?phones?(?! bags?)', 'head ?phones?', 'headsets?', 'bluetooth speakers?', 'action cam(?:era)?s?', '(?<!dual )cameras?', '(?<!fishing )gimbals?', '(?<!for )mobile phones?', 'smartphones?', 'iphone \\d+(?: pro| plus| max)*(?! (?:armband|holder|mount))', 'phone (?:cases?|covers?)', 'screen protectors?', 'nokia', 'dual ?sim', '[45]g (?:lte|phone|mobile)\\w*', 'ta-\\d{4}', 'tablets? (?:pc|cases?)', 'e-?scooters?', 'electric scooters?', 'video games?', 'consoles?', 'ps5', 'xbox', 'nintendo', 'power stations?', 'flashlights?']) },
  { label: 'camping or travel gear (Travel Gear World)', re: words(['tents?', 'sleeping (?:bags?|mats?|pads?)', 'camping (?:chairs?|tables?|stoves?|beds?|lanterns?|kitchens?|cookware|gas|mats?)', 'air ?beds?', 'cool ?box(?:es)?', 'gazebos?', 'hammocks?', 'suitcases?', 'luggage', 'cabin (?:bags?|cases?)', '(?<!golf (?:club )?)travel (?:bags?|adapters?|pillows?)', 'bell tent', 'awnings?',
    'toiletry bags?', 'wash bags?', 'picnic\\w*', '(?:folding|foldable|beach|camping|garden) (?:carts?|wagons?)', 'carts? with wheels', 'stoves?', 'cooking systems?',
    'moka pots?', 'grill pans?', 'camping lamps?', 'lanterns?', 'air ?mattress(?:es)?', 'inflatable mattress(?:es)?', 'nap beds?', 'lounge chairs?',
    '(?:folding|portable|outdoor|camping) (?:chairs?|tables?)', 'folding tables?', 'outdoor gear storage', 'camping organi[sz]ers?', 'ground spikes?', 'head scarf']) },
  { label: 'car rack or car part (Car Gear World)', re: words(['(?:bike|cycle|bicycle|ski|snowboard|kayak|canoe|sup|surf ?board) (?:racks?|carriers?) for (?:cars?|vehicles?|suvs?|vans?|tow ?bars?|towbars?)', 'tow ?bars?', 'towbars?', 'hitch (?:mount|bike|cycle)\\w*', 'roof (?:bars?|racks?|boxes?|carriers?)', '(?:roof|rear|boot|tailgate|spare wheel) (?:mounted )?(?:bike|cycle|ski|kayak) (?:racks?|carriers?)', 'car (?:seat|boot|roof)\\w*', 'motorbikes?', 'motorcycles?', 'motocross', 'mopeds?', 'quad bikes?', 'dirt bikes?', 'pit bikes?']) },
  // A rebounder or a fitness trampoline is gym equipment (Fitness & Gym); a garden trampoline is for Garden Gear World.
  { label: 'pool, trampoline or hot tub (Garden Gear World)', re: /^(?!.*(?:rebounder|fitness|exercise|workout))(?:.*[^a-z0-9])?trampolines?(?![a-z0-9])/i },
  { label: 'pool, trampoline or hot tub (Garden Gear World)', re: words(['(?:swimming|above ground|frame|garden|inflatable|family|play) pools?', 'splash (?:ramps?|slides?)',
    'bbq', 'barbecue', 'grill (?:baskets?|tools?|sets?)', 'skewers?', 'kent (?:and|&) stowe', 'garden(?:ing)? gloves?', 'pool (?:covers?|pumps?|ladders?|filters?|heaters?|chemicals?|chlorine|liners?|vacuums?|cleaners?|floats?|loungers?)', 'hot tubs?', 'spa (?:pools?|covers?)', 'lazy ?spa', 'garden (?:games?|swings?)']) },
  { label: 'safety or work wear (Construction Gear World)', re: words(['safety (?:shoes?|boots?|trainers?|sandals?)', 'work (?:shoes?|boots?|trainers?|wear|trousers|jackets?)', 'workwear', 'steel toe\\w*', 'composite toe\\w*', 's1p?', 's3', 'src', 'esd', 'hi-?vis', 'high visibility', 'bib (?:and|&) brace', 'coveralls?', 'overalls?', 'safety (?:goggles|glasses|spectacles|helmets?|gloves?)']) },
  { label: 'toy, game, gift or jewellery', re: words(['toys?', 'dolls?', 'barbie', 'lego', 'puzzles?', 'jigsaws?', 'board games?', 'card games?', 'playing cards?', '(?<!score )books?', 'posters?', 'wall art', 'stickers?', 'decals?', 'mugs?', 'keyrings?', 'key ?chains?', 'fridge magnets?', 'greeting cards?', 'gift cards?', 'vouchers?', 'costumes?', 'fancy dress', 'party', 'balloons?', 'cake toppers?', 'birthday', 'bedding', 'duvet(?: covers?)?', 'pillowcases?', 'curtains?', 'figurines?', 'charms?', '(?<!sports? )bracelets?', 'bangles?', 'necklaces?', 'earrings?', 'pendants?', 'jewell?ery', 'christmas', 'fairy lights', 'novelty', 'toy guns?', 'nerf', 'water guns?', 'darts? guns?', 'pink panther', 'paw patrol', 'disney', 'marvel', 'avengers', 'peppa', 'frozen', 'spider-?man', 'minnie', 'mickey', 'pokemon', 'hello kitty', 'minions', 'sonic', 'bluey', 'cocomelon']) },
  { label: 'health product, not sport nutrition', re: words(["women'?s health", "men'?s health", 'menopause', 'fertility', 'pregnancy', 'prenatal', 'digestive', 'gut health', 'probiotics?', 'detox', 'activated charcoal', 'multi ?vitamins?', 'elderberry', 'ashwagandha', 'sunscreen', 'skin base', 'daily wellness', 'sleep (?:aid|support)', 'hair (?:growth|vitamins?)', 'skin (?:care|vitamins?)', 'beauty', 'weight loss', 'fat burn(?:er|ing)', 'slimming', 'appetite', 'diet pills?', 'cbd', 'hemp', 'kratom', 'red clover', 'zeolite', 'medical', 'medicine', 'tablets? for (?:pain|cold)', 'make-?up', 'cosmetic\\w*', 'shampoo', 'shower gel', 'deodorants?', 'perfumes?', 'fragrances?']) },
  { label: 'service, spare part or not allowed', re: words(['warranty', 'installation', 'support contract', 'train the trainer', 'manuals?', 'knife', 'knives', 'machete', 'crossbows?', 'air (?:rifles?|pistols?|guns?)', 'bb guns?', 'pepper spray', 'stun gun', 'taser', 'vape', 'e-?cig\\w*', 'welders?', 'welding', 'band ?saw\\w*', 'saw ?blades?', 'band ?s(?:ä|ae)ge\\w*', 's(?:ä|ae)gebl(?:ä|ae|a)tt\\w*']) },
  { label: 'not sport', re: words(['ray-?ban', 'waist trainers?', 'slippers?', 'tote bags?']) },
  { label: 'not new (no "Used" label on the site)', re: words(['\\(used\\)', 'used - (?:like new|very good|good|acceptable)', 'pre-?owned', 'second-?hand', 'refurb(?:ished)?', 'renewed', 'open[- ]box', 'ex[- ]display', 'b-?grade', 'preloved']) }
];

// ctx: true = only with a sport word in the name or a sport section of the shop.
export const RULES = [
  {
    slug: 'nutrition-hydration',
    include: words(['protein (?:powders?|bars?|shakes?|snacks?|cookies?|pancakes?|bites|crisps|puddings?|water)', 'whey(?: protein)?', 'casein', 'creatine', 'pre[- ]?workouts?', 'carb(?:ohydrate)? (?:energy )?(?:powders?|drinks?|gels?)', 'energy powders?', 'fast chews', 'salt ?stick',
      'hydration (?:support )?(?:water )?bottles?', 'hydro ?flask', 'weight gain(?:ers?| support)?', 'critical mass', 'protein nutrition', 'clear protein',
      'hydration (?:sachets?|stick packs?)', 'recovery (?:sachets?|powders?|drinks?|shakes?)', 'myprotein', 'cadence (?:core|race|recovery)', 'energy shots?',
      'applied nutrition (?:abe|body ?fuel|critical|endurance|clear|iso-?xp|pump|aakg|beef-?xp|bcaa|eaa|creatine|whey|protein)\\w*', 'awesome (?:endure|hydrate|power|strength|scoops|creatine|protein|shaker|recovery)', 'bcaas?', 'eaas?', 'amino acids?', 'mass gainers?', 'weight gainers?', 'energy (?:gels?|chews?|bars?)', 'electrolytes?', 'isotonic', 'hydration (?:tablets?|powders?|drinks?|mix)', 'beta-?alanine', 'glutamine', 'l-?carnitine', 'citrulline', 'sports nutrition', 'protein shakers?', 'shaker (?:bottles?|cups?)', 'blender bottles?', 'sports (?:water )?bottles?', 'gym (?:water )?bottles?', '(?:water|drinks?) bottles? (?:for )?(?:sport|gym|cycling|running)', 'hydration (?:bladders?|reservoirs?)']),
    exclude: words(['bike bottle cage', 'bottle (?:cages?|holders?)'])
  },
  {
    slug: 'nutrition-hydration',
    include: words(['supplements?', 'tumblers?', 'twist$', 'magnesium', 'zinc', 'omega ?3', 'collagen', 'capsules', 'gummies', 'recovery drinks?', 'joint support', 'protein', 'shakers?', '(?:water )?bottles?']),
    ctx: true,
    exclude: words(['bottle (?:cages?|holders?)', 'bottle openers?', 'bottle warmers?'])
  },
  {
    slug: 'running',
    include: words(['running (?:shoes?|trainers?|jackets?|vests?|belts?|shorts|tights|tops?|socks?|caps?|gloves?|backpacks?|packs?|hats?|t-?shirts?|leggings|lights?|headlamps?|armbands?|jumpers?)', 'trail (?:running|shoes?|runners?)', 'road running', 'hydration (?:vests?|packs?)', 'race (?:vests?|belts?)', 'number belts?', 'phone armbands?', 'running armbands?', 'marathon', 'parkrun', 'track (?:spikes?|and field)', 'athletics (?:spikes?|shoes?)', 'spikes? for (?:running|athletics|sprint\\w*)', 'discus', 'javelin', 'shot put', 'starting blocks?', 'relay batons?', 'hurdles?', 'running',
      // Running models and running brands in the shops' sport sections (plan, 25 Oct 2026).
      'singlets?', 'run (?:tanks?|tights?|shorts?|tees?|t-?shirts?|hats?|caps?|jackets?|pants|singlets?|gloves?|beanies?|vests?)', 'own the run', 'run essentials?',
      'raceday', 'race ?day', '(?:2|two) ?in ?(?:1|one) shorts?', 'twin shorts?', 'speedcross',
      'cloud(?:monster|surfer|flyer|pulse|runner|stratus|boom|eclipse|vista|ultra|tilt|go|swift|nova|spark|sight)\\w*',
      'brooks (?:ghost|glycerin|adrenaline|hyperion|launch|levitate|cascadia|caldera|catamount|divide|dash|chaser|journey|spark|sherpa|run)\\w*', 'saucony', 'endorphine?\\w*',
      'hoka (?:clifton|bondi|mach|arahi|speedgoat|rincon|rocket|challenger|gaviota|skyward|skyflow|cielo|airolite|everyrun|glide|novafly|run)\\w*', 'speedgoat',
      'adizero', 'adios pro', 'ultraboost', 'ultrarun', 'runfalcon', 'duramo', 'supernova', 'solarglide', 'fortarun', 'pegasus', 'vomero',
      'gel-?(?:nimbus|kayano|cumulus|excite|contend|pulse)', 'novablast', 'new balance (?:fresh foam|fuelcell|1080|880|860|520|680|410)\\w*',
      'ronhill', 'compressport', 'hilly', 'calf (?:sleeves?|guards?)', 'adv skin', 'skin \\d+ sets?', 'pulse belts?', 'soft ?flasks?', 'free belts?',
      'sports? belts?', 'sports? bracelets?', 'phone arm ?(?:bands?|sleeves?)', 'armbands?']),
    exclude: words(['running (?:boards?|water|lights? for cars?)', 'daytime running', 'hockey', 'astros?', 'cricket', '22 ?yds', 'howzat', 'football', 'rugby',
      'tennis', 'padel', 'treadmills?', 'walking pads?', 'running machines?', 'swim\\w* armbands?', 'inflatable armbands?'])
  },
  {
    slug: 'cycling',
    include: words(['bicycles?', '(?:road|mountain|gravel|hybrid|folding|electric|commuter|city|touring|trekking|fat ?tyre|fat ?tire|cargo|bmx) bikes?', 'e-?bikes?', 'mtb', 'bmx', 'cycl(?:e|ing) helmets?', 'bike helmets?', 'bike (?:lights?|lock|locks|pumps?|computers?|saddles?|seats?|tyres?|tires?|tubes?|chains?|bags?|baskets?|bells?|mirrors?|stands?|tools?|gloves?|shoes?|shorts|jerseys?|jackets?|glasses|mudguards?|fenders?|panniers?|grips?|pedals?|bottle cages?)', 'cycling (?:jerseys?|jackets?|shorts|tights|shoes?|gloves?|glasses|sunglasses|socks?|caps?|vests?|gilets?|bibs?|computers?|helmets?|lights?|bags?|backpacks?|overshoes)', 'bib (?:shorts|tights)', 'cycle computers?', 'inner tubes?', 'track pumps?', 'chain (?:lubes?|oil|cleaners?)', 'derailleurs?', 'chainrings?', 'cranksets?', 'clipless pedals?', 'turbo trainers?', 'smart trainers?', 'bike trainers?', 'puncture repair(?: kits?)?', 'tubeless', 'frame bags?', 'handlebar (?:bags?|tape|grips?)', 'saddle bags?', 'panniers?', 'kickstands?', 'bottle cages?', 'cycling', 'handlebar (?:mounts?|bags?|tape|grips?)', 'bike (?:phone )?(?:mounts?|holders?)']),
    exclude: words(['exercise bikes?', 'spin(?:ning)? bikes?', 'indoor cycling bikes?', 'magnetic bikes?', 'recumbent bikes?', 'air bikes?', 'bike (?:racks?|carriers?) for (?:cars?|tow\\w*)', 'bike sheds?', 'bike (?:covers?|storage) (?:shed|tent)'])
  },
  {
    slug: 'football-team-sports',
    include: words(['football boots?', 'astro ?turf(?: trainers?| boots?)?', 'shin (?:pads?|guards?)', 'goal ?keeper gloves?', 'goalie gloves?', '(?:football|soccer|futsal|pop ?up|training|mini) goals?', 'football (?:nets?|kits?|shirts?|shorts|socks|training)', 'training cones?', 'agility (?:ladders?|hurdles?|poles?)', 'rugby', 'scrum caps?', 'tackle (?:bags?|pads?|shields?)', 'basketball', 'netball', 'volleyball', 'handball', 'cricket', 'batting gloves?', 'wicket ?keeping gloves?', '(?:field )?hockey', 'baseball', 'softball', 'lacrosse', 'american football', 'nfl', 'gridiron', 'referee (?:whistles?|cards?|kits?)', 'tactics boards?', 'footballs?', 'soccer', 'futsal', 'rounders', 'gaelic', 'hurling', 'pitching (?:nets?|targets?)', 'rebounders? for football',
      // Boots, pads and brands of football, rugby, cricket and hockey (plan, 25 Oct 2026: Coes sells them without the sport's name).
      'shin ?guards?', 'shinguards?', 'shin ?liners?', 'shinliners?', 'stick (?:sleeves?|bags?)', 'stickbags?', 'astros?', 'firm ground', 'soft ground',
      'multi ground', 'flexible ground', 'artificial (?:ground|grass)', 'predator', 'f50', 'copa (?:pure|mundial|gloro)', 'x crazyfast', 'mercurial',
      'phantom (?:gx|luna|gt|6)', 'tiempo', 'future (?:ultimate|match|play|pro)', 'furon', 'tekela', 'kakari', 'rs-?15', 'speed falcon', 'stampede', 'canterbury',
      'head ?guards?', 'mouth ?guards?', 'batting (?:pads?|inners?|gloves?)', 'wicket ?keeping (?:pads?|inners?|gloves?)', 'wicketkeeping\\w*',
      'thigh (?:guards?|protectors?|pads?)', 'abdo(?:minal)? guards?', 'pro abdo', 'forearm protectors?', 'toe protectors?', 'stumps?', 'stumpsets?',
      'bails', 'bowlers? markers?', 'umpires? counters?', 'scorebooks?', 'bat (?:covers?|grips?|repair kits?|tape)', 'gunn (?:&|and) moore', 'gray[- ]nicolls',
      'kookaburra', 'aero (?:p1|quicktech)', 'new balance (?:dc|tc|wk) ?\\d+', 'masuri', '22 ?yds', 'howzat', 'grays', 'y1', 'osaka', 'tk (?:shin\\w*|total\\w*)',
      'replica (?:shirts?|jerseys?)', '(?:home|away|third) (?:replica )?(?:shirts?|jerseys?)', '(?:castore|umbro) (?:england|scotland|wales|ireland)',
      'england (?:home|away|training|travel|bobble)', 'match balls?', 'club balls?', 'league balls?', 'ucl', 'champions league', 'pace balls?', 'studs']),
    exclude: words(['table football', 'foosball', 'football (?:games?|cards?|stickers?)', 'fairy lights?', 'baseball caps?', 'sunglasses', 'table tennis',
      'ping ?pong', 'boxing', 'sparring', 'mma', 'martial arts'])
  },
  {
    slug: 'racket-sports',
    include: words(['tennis', 'badminton', 'shuttlecocks?', 'squash (?:rackets?|racquets?|balls?|shoes?)', 'padel', 'pickleball', 'table tennis', 'ping ?pong', 'rackets?', 'racquets?', 'overgrips?', 'racket strings?', 'tennis ball (?:machines?|baskets?|carts?)',
      'k-?swiss', 'babolat', 'yonex', 'tecnifibre', 'aura grip', 'dampeners?', 'dampners?', 'skorts?',
      'head (?:prime|hydrosorb|championship|stage|foam|tour|pro|radical|speed|boom|gravity|extreme|instinct|padel|tennis|graphene)\\w*',
      'dunlop (?:fort|australian|cx|fx|sx|tristorm|club|team|d tb)\\w*', 'wilson (?:pro|premier|profile|padel|clash|blade|ultra|burn|us open|triniti)\\w*']),
    exclude: words(['tennis (?:bracelets?|necklaces?|chains?|bangles?)', 'racket (?:wall plugs?|fixings?)'])
  },
  {
    slug: 'water-sports',
    include: words(['kayaks?', 'canoes?', 'paddle ?boards?', 'sup boards?', 'stand ?up paddle(?: ?boards?)?', 'isup', 'kayak paddles?', '(?:sup|kayak|canoe) (?:paddles?|seats?|pumps?|leashes?|outriggers?)', 'wetsuits?', 'shortie wetsuits?', 'swim(?:ming)? (?:goggles|caps?|fins|training|buoys?|bags?|paddles?|snorkels?)', 'swimming goggles', 'kick ?boards?', 'pull buoys?', 'diving (?:masks?|fins|computers?|torches?)', 'dive (?:masks?|computers?|fins|torches?)', 'scuba (?:masks?|fins|sets?|gear)', 'freediving', 'snorkel(?:l?ing)? (?:sets?|masks?)', 'surf ?boards?', 'body ?boards?', 'boogie ?boards?', 'skim ?boards?', 'kite ?surf(?:ing)?', 'wind ?surf(?:ing)?', 'wake ?boards?', 'water ?skis?', 'buoyancy aids?', 'life ?jackets?', 'rash (?:vests?|guards?)', 'water shoes?', 'aqua shoes?', 'swimrun', 'open water', 'tow floats?', 'dry ?robes?', 'changing robes?', 'surf ponchos?', '(?:training|competition|racing) swimsuits?', 'swimsuits? for (?:training|competition)', 'jammers?',
      'swim ?caps?', 'swimcaps?', 'swim hats?', 'ear ?plugs?', 'nose ?clips?', 'aqua ?shorts?', 'water ?shorts?', 'medalist', 'swimming suits?', 'speedo',
      'skatinger', 'dry (?:bags?|sacks?)']),
    exclude: words(['scuba (?:safety|shoes?|boots?)', 'dog life ?jackets?'])
  },
  {
    slug: 'hiking-climbing-winter',
    include: words(['hiking (?:boots?|shoes?|socks?|poles?|backpacks?|rucksacks?|trousers|pants?|jackets?|sticks?|sandals?)', 'hike', 'walking (?:footwear|shoes?)',
      'gore-?tex', 'gtx', 'anacapa', 'kaha', 'trailblazer', 'ski(?: snow)? goggles', 'snow goggles', '(?:winter|snow) (?:helmets?|goggles?)', 'winter (?:helmet )?liners?', 'mips (?:carbon )?winter', 'walking boots?', 'trekking (?:poles?|boots?|shoes?)', 'walking poles?', 'nordic walking', 'climbing (?:harness(?:es)?|shoes?|ropes?|chalk|holds?|helmets?)', 'carabiners?', 'quickdraws?', 'belay(?: devices?)?', 'chalk bags?', 'bouldering', 'crash pads?', 'crampons?', 'ice axes?', 'via ferrata', 'mountaineering', 'approach shoes?', 'gaiters', 'skis', 'ski (?:boots?|poles?|goggles|helmets?|gloves?|mittens|jackets?|trousers|pants|socks?|bags?|masks?|wax|bindings?|suits?)', 'salopettes', 'snowboards?', 'snowboard(?:ing)? (?:boots?|bindings?|jackets?|pants|trousers|helmets?|gloves?|goggles|bags?|wax)', 'snow ?shoes', 'ice skates?', 'figure skates?', 'cross ?country skis?', 'touring skis?', 'avalanche (?:beacons?|probes?|shovels?|transceivers?)', 'sledges?', 'toboggans?']),
    exclude: words(['ski (?:racks?|carriers?|roof\\w*)', 'carabiner (?:bit|card|key)\\w*', 'carabiners? (?:bit|card)\\w*', 'poop bags?', 'stair climbing', 'climbing (?:spikes?|plants?|frames?)'])
  },
  {
    slug: 'golf-skate-more',
    include: words(['golf (?:balls?|clubs?|bags?|trolleys?|carts?|shoes?|gloves?|tees?|umbrellas?|rangefinders?|nets?|mats?|sets?|drivers?|irons?|putters?|wedges?)', 'putters?', 'rangefinders? for golf', 'divot tools?', 'skate ?boards?', 'longboards?', 'cruiser boards?', 'roller ?skates?', 'inline skates?', 'roller ?blades?', 'stunt scooters?', 'skate (?:helmets?|pads?|shoes?)', 'fishing (?:rods?|reels?|lines?|lures?|tackle|nets?|chairs?|bags?)', 'tackle box(?:es)?', 'dart ?boards?', 'darts', 'snooker', 'pool (?:tables?|cues?|balls?)', 'billiards?', 'table football', 'foosball', 'air hockey', 'shuffleboard\\w*', 'archery', 'bows? and arrows?', 'horse riding', 'equestrian', 'riding (?:hats?|boots?|gloves?)',
      'ecooda', 'lures?', 'jigs?', 'inchiku', 'fish grippers?', 'fishing', 'stunt(?:ed)? scooters?', 'putting (?:greens?|mats?)', 'inline skat\\w*',
      'skating helmets?', 'golf (?:club )?travel bags?', 'golf stand bags?']),
    exclude: words(['golf (?:6|7|gti|gtd|tdi|tsi|mk ?\\d)', 'vw golf', 'golf baseball caps? (?:by|from) (?:festool|makita|dewalt)', 'powershot golf'])
  },
  {
    slug: 'fitness-gym',
    include: words(['dumbbells?', 'kettlebells?', 'barbells?', '(?:weight|bumper|olympic|disc) plates?', 'olympic bars?', 'ez ?(?:curl )?bars?', '(?:weights?|gym|workout|adjustable|flat|incline|utility|sit ?up|ab|preacher) bench(?:es)?', 'power (?:racks?|cages?|towers?)', 'squat (?:racks?|stands?)', 'smith machines?', 'cable (?:machines?|crossovers?)', 'multi ?gyms?', 'home gyms?', 'resistance bands?', 'loop bands?', 'booty bands?', 'pull ?ups? bars?', 'chin ?ups? bars?', 'dip (?:stations?|bars?|stands?)', 'push ?ups? (?:bars?|boards?|handles?)', 'ab (?:rollers?|wheels?)', 'foam rollers?', 'massage guns?', 'yoga (?:mats?|blocks?|bricks?|straps?|wheels?|bolsters?|balls?|sets?|swings?|hammocks?|blankets?|cushions?)', 'pilates (?:rings?|balls?|reformers?|bars?|mats?|sets?|machines?)', '(?:exercise|fitness|gym|workout|training) mats?', '(?:exercise|gym|swiss|stability|balance) balls?', '(?:medicine|slam|wall) balls?', 'battle ropes?', 'skipping ropes?', 'jump ropes?', 'speed ropes?', 'treadmills?', 'walking pads?', '(?:exercise|spin|spinning|indoor cycling|magnetic|recumbent|air) bikes?', 'rowing machines?', 'rowers?', 'cross ?trainers?', 'elliptical(?: trainers?)?', '(?:mini |fitness |exercise |twist |step |side )?steppers?(?! (?:motors?|drivers?))', 'stair ?climbers?', 'vibration plates?', 'plyo(?:metric)? (?:box(?:es)?|jump ?box(?:es)?)', 'jump ?box(?:es)?', '(?:aerobic|fitness) steps?', 'step platforms?', 'weighted vests?', 'weight vests?', '(?:ankle|wrist) weights?', 'hand grips?', 'grip strengtheners?', '(?:weight ?)?lifting (?:belts?|straps?|gloves?)', 'wrist wraps?', 'knee sleeves?', 'gym gloves?', 'suspension trainers?', 'rebounders?', 'fitness trampolines?', 'mini trampolines?', 'balance boards?', 'gymnastics mats?', 'hyperextension(?: benches?)?', 'trap bars?', 'hex bars?', 'landmine', 'weight (?:sets?|racks?|trees?)', 'bodybuilding', 'powerlifting', 'weightlifting', 'calisthenics', 'crossfit', 'boxing', 'punch(?:ing)? bags?', 'speed bags?', 'focus (?:pads?|mitts?)', 'punch mitts?', 'hand wraps?', 'kick (?:pads?|shields?)', 'thai pads?', 'mma (?:gloves?|shorts|gear)', 'sparring', 'gum ?shields?', 'head ?guards?', 'karate', 'judo', 'taekwondo', 'jiu ?jitsu', 'bjj', 'kickboxing', 'martial arts', 'gym equipment', 'exercise equipment',
      'running machines?', 'kinesiology tape', 'support sleeves?', 'compression support\\w*', '(?:knee|ankle|elbow|wrist|back|calf) (?:supports?|braces?)',
      'massage (?:balls?|sticks?|rollers?)', 'foot massage rollers?', 'power loops?', 'mini (?:power )?loops?', 'resistance (?:tubes?|loops?)', 'exercise bands?',
      'training elastics?', 'cardio discs?', 'abdominal (?:training )?wheels?', 'push ?ups? grips?', 'fitness balls?', 'yoga (?:belts?|rings?|full blocks?)',
      'magic circles?', 'gym (?:training systems?|flooring|floor(?:ing)? (?:mats?|tiles?)|tiles?)', 'fitness mad', 'bumbbells?', 'sauna (?:effect|belts?|suits?)',
      'sweat (?:belts?|suits?)']),
    exclude: words(['bench (?:grinders?|vices?|drills?|saws?)', 'workbench\\w*', 'tool (?:benches?|rollers?)', 'lifting (?:slings?|chains?|gear|jacks?|tables?)', 'boxing day', 'gift box(?:es)?', 'mma (?:welders?|electrode\\w*|adhesive\\w*)', 'trx (?:star|bits?|sockets?)', 'foam rollers? for (?:paint|decorating)', 'drawstring',
      'backpacks?', 'duffels?', 'holdalls?', 'gym ?(?:bags?|sacks?)'])
  },
  {
    slug: 'sportswear-shoes-bags',
    include: words(['sports? bras?', 'gym (?:leggings|shorts|tops?|t-?shirts?|vests?|wear|hoodies?|joggers|bags?|backpacks?|duffels?|holdalls?|towels?)', 'workout (?:leggings|shorts|tops?|clothes|wear|sets?)', 'training (?:shoes?|trainers?|tops?|t-?shirts?|shorts|pants|jackets?|tights|jerseys?|bibs?)', 'compression (?:tops?|shirts?|shorts|tights|leggings|sleeves?|socks?)', 'base ?layers?', 'track ?suits?', 'track (?:pants|tops?|jackets?)', 'activewear', 'sportswear', 'athletic (?:shorts|shoes?|socks?|wear|joggers|pants)', 'sports (?:shorts|tops?|t-?shirts?|socks?|shoes?|leggings|jackets?|vests?|caps?|bags?|holdalls?|backpacks?|towels?)', 'performance (?:t-?shirts?|tees?|tops?|socks?|shorts)', 'cross ?training shoes?', 'indoor court shoes?', 'kit bags?', 'boot bags?', 'sports? holdalls?', 'cooling towels?', 'sweat ?bands?', 'yoga sports? sets?', 'yoga (?:leggings|pants|tops?|bras?|shorts|capris)', 'jogging bottoms',
      'track(?:suit)? bottoms', 'gymsacks?', 'gym ?sacks?', 'waist (?:packs?|bags?)', 'bum bags?', 'fanny packs?', 'sports? sunglasses', 'oakley', 'goodr', 'insoles?',
      '(?:elastic )?laces', 'heel (?:hole )?(?:protectors?|preventers?)', 'athletic slides?', 'recovery (?:sandals?|slides?)', 'oofos', 'adilette', '(?:nike|adidas|asics|new balance|puma|reebok|under armour|hoka|salomon|brooks|saucony|mizuno|on running|altra|inov-?8|umbro|kappa|diadora|joma|lonsdale|everlast)[^|]{0,60}(?:trainers?|sneakers?|shoes?|leggings|shorts|tops?|t-?shirts?|tights|jackets?|hoodies?|joggers|socks?|bags?|backpacks?)']),
    exclude: words(['safety', 'work (?:shoes?|boots?|trainers?)', 'socks? (?:for )?(?:diabetics?|compression stockings?)'])
  },
  {
    slug: 'cycling',
    include: words(['bikes?', 'bicycles?']),
    ctx: true,
    exclude: words(['exercise bikes?', 'spin(?:ning)? bikes?', 'indoor cycling bikes?', 'magnetic bikes?', 'recumbent bikes?', 'air bikes?', 'bike shorts?', 'bike (?:racks?|carriers?)'])
  },
  {
    slug: 'golf-skate-more',
    include: words(['golf']),
    ctx: true,
    exclude: words(['golf (?:6|7|gti|gtd|tdi|tsi|mk ?\\d)', 'vw golf'])
  },
  {
    slug: 'sportswear-shoes-bags',
    include: words(['leggings', 'joggers', 'trainers?', 'sneakers?', 'shorts?', 'socks?', 'hoodies?', 'jackets?', 'vests?', 't-?shirts?', 'tops?', 'caps?', 'headbands?', 'wristbands?', 'backpacks?', 'holdalls?', 'duffels?', 'duffle bags?', 'drawstring bags?', 'towels?', 'bras?', 'tights?', 'shoes?',
      'tanks?', 'tank tops?', 'tees?', 'polos?', 'pants?', 'trousers?', 'sweatpants', 'capris?', 'leggings?', 'sleeveless', 'windbreakers?', 'skirts?', 'beanies?', 'hats?', 'visors?', 'neck (?:tubes?|gaiters?|warmers?)',
      'hairbands?', 'gloves?', 'midlayers?', '(?:1/4|1/2|quarter|half) zips?', 'slipovers?', 'jerseys?', 'shirts?', 'slides?', 'sliders?', 'sandals?', 'sunglasses',
      'rucksacks?', 'sling bags?', 'duffles?']),
    ctx: true,
    exclude: words(['safety', 'work (?:shoes?|boots?|trainers?)', 'thermal underwear', 'school', 'formal', 'heels?', 'stilettos?', 'sandals? (?:for )?(?:women|ladies)', 'ray-?ban'])
  }
];

// Second chance (step 4): the shop's own sport section names the sport. Checked in this order on the shop's path.
export const SECTION_RULES = [
  { slug: 'nutrition-hydration', re: /sports? nutrition|fitness (?:&|and) nutrition|protein|supplements? for sport/i },
  { slug: 'running', re: /running|athletics|track (?:&|and) field|jogging/i },
  { slug: 'cycling', re: /cycling|bicycles?|bikes?/i },
  { slug: 'football-team-sports', re: /football|soccer|team sports|basketball|rugby|cricket|hockey|volleyball|baseball|netball/i },
  { slug: 'racket-sports', re: /racquet|racket|tennis|badminton|squash|padel|pickleball|table tennis/i },
  { slug: 'water-sports', re: /water ?sports|watersport|swimming|swim|diving|snorkel|surf|kayak|canoe|paddle|boating/i },
  { slug: 'hiking-climbing-winter', re: /climbing|hiking|trekking|mountaineering|winter sports|skiing|snowboard|ice skat/i },
  { slug: 'golf-skate-more', re: /golf|skate|skating|scooters|fishing|angling|darts|snooker|billiard|games room|archery|equestrian/i },
  { slug: 'fitness-gym', re: /exercise|fitness|gym|strength|cardio|yoga|pilates|weight ?lifting|boxing|martial arts|sport (?:&|and) fitness|training accessories|fitness equipment/i },
  { slug: 'sportswear-shoes-bags', re: /sportswear|activewear|sports? (?:clothing|shoes|footwear|apparel|bags)|athletic (?:clothing|shoes|footwear)/i }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['fitness-gym', 'running', 'cycling', 'football-team-sports', 'racket-sports', 'water-sports', 'hiking-climbing-winter', 'nutrition-hydration', 'sportswear-shoes-bags', 'golf-skate-more'];

// Minimum quality for any product to be imported (L14). Prices in pounds or euros (euro prices get "≈ £").
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 6000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
export function classify(name, feedCategory = '', paths = '', source = null) {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`;
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  // A health section ("Health & Beauty > Health Care > Fitness & Nutrition") is not a sport section: there, a vitamin or a
  // supplement comes in only when its name says sport (approved rules, 25 Oct 2026). Sports nutrition names count anyway.
  const sportFeed = SPORT_FEED.test(cat) && !HEALTH_FEED.test(cat);
  const ctx = sportFeed || SPORT_WORDS.test(n);
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    if (r.include.test(n) && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  // A real sport section of the shop names the sport (the name already passed the DENY rules).
  // Only for a name that says sport or names sport gear: a shop's "Sport & fitness" section also holds toys.
  // Not for shops whose sections are unreliable (sources.json "sectionHints": false): Coes puts every sport product under
  // the Awin category "Fitness", and Joybuy's sub-sections are often wrong (running shoes under "Ice Screws", plan 25 Oct 2026).
  const hints = !source || source.sectionHints !== false;
  if (hints && sportFeed && (SPORT_WORDS.test(n) || GEAR_WORDS.test(n))) for (const s of SECTION_RULES) if (s.re.test(cat)) return { ok: true, slug: s.slug };
  return { ok: false, reason: sportFeed ? 'not matched (shop says sport)' : 'not sport' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]", and some end with the
// size the visitor picks on the shop's page ("... - Black | Size: S").
// Sizes in the name (Joybuy, plan 25 Oct 2026: "EU43 Li-Ning ...", "... Gloves Orange XL", "Yoga sports set - Classic black - M",
// "Helmet Black M 54-58cm") are taken out, so every size is one card at its lowest price (owner's rule for duplicates).
// A lone S, M or L counts only after a colour ("Tee M" stays: there M means men's).
const COLOURS = '(?:black|white|gr[ae]y|blue|red|green|pink|orange|yellow|purple|brown|navy|khaki|beige|lilac|mint|camo|silver|gold|cream|ivory|olive|teal|maroon|burgundy|charcoal|coral|peach|tan|sand|stone|(?:dark|light|deep|sky|royal) \\w+)';
const SIZE_AFTER_COLOUR = new RegExp(`(\\b${COLOURS})\\s+(?:S|M|L)(?:\\s+\\d{2}-\\d{2}\\s?cm)?$`, 'i');
const SHOE = /\b(?:shoes?|boots?|trainers?|sneakers?|sandals?)\b/i;

export function cleanProductName(name) {
  let n = fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s*\|\s*Size:\s*[^|]{1,20}$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^EU ?\d{2}(?:\.5| [12]\/3)?\s+/i, '');
  for (let i = 0; i < 2; i++) {
    n = n
      .replace(/[\s,]+(?:size:?\s*)?(?:XXS|XS|XXL|XXXL|[2-5]XL|XL)(?:\s+\d{2}-\d{2}\s?cm)?(?:\s+size)?$/i, '')
      .replace(/[\s,]+size:?\s*(?:S|M|L)$/i, '')
      .replace(/\s+(?:S|M|L)\s+size$/i, '')
      .replace(SIZE_AFTER_COLOUR, '$1')
      .replace(/\s+-\s+(?:EU\s?)?(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i, '')
      .replace(/(\b(?:helmets?|[A-Z]{1,4}-\d{2,4}[A-Z]?(?:-\d+)?))\s+(?:S|M|L)$/i, '$1')
      .replace(/\s*\((?:EU\s?)?\d{2}(?:\.5)?\)$/i, '')
      .replace(/\s+EU ?\d{2}(?:\.5| [12]\/3)?$/i, '');
    if (SHOE.test(n)) n = n.replace(/\s+(?:3[4-9]|4[0-9])(?:\.5)?$/, '');
  }
  return n.replace(/[\s,\-–]+$/, '').trim();
}
