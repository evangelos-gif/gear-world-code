// Pets Gear World (ZGW, petsgearworld.com): which feed products are pet products, and in which category (lessons L14,
// L42, L65). Used by the pets feed scan (tools/pets-feed-scan.mjs); the import plan will use the same rules, so a dry
// run sorts products exactly as the scan counted them.
//
// The owner (1 Nov 2026) bought petsgearworld.com for a 13th Gear World: dogs, cats, small pets, birds, fish and
// reptiles, chickens. Code ZGW ("Zoo"): PGW is Gaming, GGW is Garden. No live animals, no prescription medicines, no
// health claims. Pet products now on Home (HGW) and Kids' (KGW) are copied here first; those sites delete nothing.
//
// First version (1 Nov 2026), before the first scan on the owner's PC. How a product is classified:
//   1. NO: look-alike names ("Hush Puppies" shoes, "Cat 6" cables, Caterpillar workwear, "hot dog", "kitten heels",
//      PET plastic), pest control, live animals and prescription medicines.
//   2. A pet word in the name ("dog", "kitten", "aquarium", "PawHut") or a pet shop category ("Pet Supplies").
//   3. Products of another Gear World site go apart: children's toys and costumes (KGW), wild birds and pest
//      deterrents (Garden), vacuums and pet-hair cleaners (Home), dog-print clothing, mugs and decor (Men's, Women's,
//      Home), horse and riding gear (not in the plan yet: the owner decides).
//   4. A clear name ("dog bed", "cat litter", "Royal Canin"), unless the name says another category's product word; then
//      the product word with a pet word ("PawHut ... crate").
//   5. A pet shop product without a category word: "other pet products". Otherwise: not a pet product.

// A list of regex fragments -> one regex with word edges (L42: "cat" must not match "category").
const words = list => new RegExp(`(?<![a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Pet brands: a product of these brands is a pet product even without the word "dog" or "cat".
export const PET_BRAND = words(['pawhut', 'petsafe', 'kong', 'trixie', 'ancol', 'rosewood pet', 'kurgo', 'ruffwear', 'julius-?k9', 'halti', 'furminator', 'sureflap', 'surefeed', 'surepet(?:care)?',
  'catit', 'omlet', 'eglu', 'royal canin', 'purina', 'pro plan', 'pedigree', 'whiskas', 'felix', 'iams', "hill'?s science", "lily'?s kitchen", 'harringtons', 'burns pet', 'applaws', 'james wellbeloved',
  'eukanuba', "butcher'?s", "wainwright'?s", 'bakers complete', 'dreamies', 'webbox', 'sheba', 'gourmet gold', 'seresto', 'bob martin', "johnson'?s veterinary", 'beaphar', 'yumove', 'petface', 'furbo',
  'petkit', 'tetra', 'fluval', 'juwel', 'exo terra', 'zoo med', 'burgess', 'oxbow', 'versele-?laga', 'barking heads', 'meowing heads', 'forthglade', 'arden grange', 'scrumbles',
  'good boy', 'petstages', 'chuckit!?', 'nylabone', 'dentastix', 'gimcat', 'catsan', "world'?s best cat litter", 'cats best', 'pooch (?:and|&) mutt']);

// Words in a name that say "pet". Not "fish" alone (fishing, fish fingers), "bird" alone (wild birds are Garden), "mouse"
// or "rat" (pest control, computers), "duck" (duvets, food flavours), "litter" alone (litter pickers).
export const PET_CTX = words(['dogs?', "dog'?s", 'doggy', 'doggie', 'pupp(?:y|ies)', 'pups?', 'cats?', "cat'?s", 'kittens?', 'kitty', 'pets?', "pet'?s", 'canine', 'feline', 'rabbits?', 'bunny', 'bunnies',
  'guinea pigs?', 'hamsters?', 'gerbils?', 'ferrets?', 'chinchillas?', 'degus?', 'parrots?', 'budgies?', 'budgerigars?', 'canar(?:y|ies)', 'cockatiels?', 'lovebirds?', 'aviar(?:y|ies)',
  'aquariums?', 'fish ?tanks?', 'aquatics?', 'tropical fish', 'goldfish', 'koi', 'betta', 'reptiles?', 'tortoises?', 'snakes?', 'lizards?', 'geckos?', 'bearded dragons?', 'vivariums?', 'terrariums?',
  'chickens?', 'hens?', 'poultry', 'paws?', 'catnip', 'kibble', 'horses?', 'equestrian', 'pon(?:y|ies)']);
// A shop category that says pets (the shop's own path, or Awin's / Google's category).
export const PET_SHOP = words(['pets?', 'pet supplies', 'pet care', 'pet products', 'animals? (?:and|&) pet supplies', 'dog (?:supplies|accessories|food|toys)', 'cat (?:supplies|accessories|food|toys)',
  'dogs', 'cats', 'small animals?', 'small pets?', 'aquatics?', 'aquariums?', 'reptiles?', 'bird supplies', 'poultry']);

// Never pet products, even with a pet word.
export const NO = words(['hush puppies', 'caterpillar', 'cat (?:boots?|footwear|workwear|safety|s\\d{2}|b\\d{2}|phones?)', 'cat ?[5-8]a?e?', 'cat ?[5-8]a?e? (?:cables?|patch|ethernet|network|leads?)',
  'ethernet', 'network cables?', 'patch cables?', 'bulldog clips?', 'hot ?dogs?', 'corn ?dogs?', 'dogtooth', 'houndstooth', 'kitten heels?', 'cat[- ]eyes?', 'cat eye (?:sunglasses|glasses|frames?)',
  'watch dogs', 'snoop dogg', 'sea dog', 'mad dog', 'black cat fireworks?', 'copycat', 'cat in the hat', 'fishing', 'fish fingers', 'pet (?:bottles?|plastic|film|strapping|preforms?)', 'petg',
  'rpet', 'recycled pet', 'puppy (?:love|fat)', 'rat traps?', 'mouse traps?', 'rodent', 'rodenticide', 'poison', 'pest control', 'fly (?:sprays?|traps?|killers?)', 'ant (?:killers?|bait)', 'wasp',
  'slug (?:pellets?|killers?)', 'weed ?killers?', 'live (?:animals?|fish|insects?|food|crickets|mealworms|locusts)', 'prescription', 'pom-?v', 'vet prescription', 'insurance', 'gift cards?', 'vouchers?',
  'snakes and ladders', 'king kong', 'tetra ?pak', 'flexi ?hoses?', 'turtle beach', 'cobra (?:golf|clubs?)', 'jaguar', 'puma', 'lynx (?:africa|body|deodorant)', 'mustang', 'red bull', 'tiger (?:balm|sheds?)', 'shark (?:vacuum|steam|flexstyle|hair)', 'snake ?(?:plants?|skin|print)',
  'python', 'gecko (?:tape|grip)', 'bunny (?:ears|costume)', 'chicken (?:breasts?|fillets?|thighs?|wings?|stock|soup|noodles?)', 'rotisserie', 'egg (?:cups?|cookers?|poachers?)']);

// Proposed ZGW categories. Every category has:
//   sure - a name that is always this kind of pet product ("dog bed", "cat litter", "aquarium filter");
//   ctx  - a product word that counts only with a pet word ("bed" in "PawHut ... bed");
//   type - the product word itself: a name that says another category's product word is not this one.
// First match wins: walking (leads) before toys ("tug toy" is a toy, "lead" with "toy" in it stays a lead only by type).
export const CATEGORIES = [
  {
    key: 'beds-crates', label: 'Beds, crates & kennels',
    sure: words(['(?:dog|cat|pet|puppy|kitten) (?:beds?|baskets?|cushions?|mattress(?:es)?|sofas?|blankets?|caves?|igloos?|crates?|cages?|kennels?|houses?|pens?|playpens?|gates?|steps|stairs|ramps? for (?:beds?|sofas?))',
      '(?:dog|puppy) (?:crate|kennel) (?:covers?|mats?|beds?)', 'calming (?:dog |cat |pet )?beds?', 'orthopaedic (?:dog |pet )?beds?', 'donut (?:dog |cat |pet )?beds?', 'dog crate furniture', 'pet playpens?', 'puppy (?:pens?|play ?pens?)',
      'whelping (?:box|pens?)', 'pet (?:doors?|gates?)', 'dog (?:flaps?|doors?)']),
    ctx: words(['beds?', 'baskets?', 'cushions?', 'mattress(?:es)?', 'blankets?', 'crates?', 'kennels?', 'playpens?', 'gates?', 'houses?']),
    type: words(['beds?(?! (?:linen|sheets?|frames?|throws?|spreads?))', 'baskets?', 'crates?', 'kennels?', 'playpens?', 'pet gates?', 'dog houses?', 'cat houses?'])
  },
  {
    key: 'walking', label: 'Leads, collars, harnesses & coats',
    sure: words(['(?:dog|puppy|pet|cat) (?:leads?|leash(?:es)?|collars?|harness(?:es)?|muzzles?|coats?|jackets?|jumpers?|raincoats?|boots?|bandanas?|costumes?|pyjamas|life ?jackets?|whistles?)', 'retractable (?:dog )?(?:leads?|leash(?:es)?)',
      'slip leads?', 'training leads?', 'long lines? for dogs', 'no[- ]pull harness(?:es)?', 'harness for (?:dogs?|cats?|puppies)', 'poo(?:p)? bags?', 'dog waste bags?', 'poo bag (?:holders?|dispensers?)',
      'collar (?:tags?|lights?)', 'pet (?:id )?tags?', 'dog (?:walking|training) (?:bags?|pouches?)', 'treat (?:pouches?|bags?)', 'flexi (?:leads?|new)', 'halti', 'julius-?k9', 'ruffwear']),
    ctx: words(['leads?', 'leash(?:es)?', 'collars?', 'harness(?:es)?', 'muzzles?', 'coats?', 'jackets?', 'jumpers?', 'raincoats?', 'bandanas?', 'tags?']),
    type: words(['leads?(?! (?:free|acid))', 'leash(?:es)?', 'collars?', 'harness(?:es)?', 'muzzles?'])
  },
  {
    key: 'toys', label: 'Toys & training',
    sure: words(['(?:dog|cat|pet|puppy|kitten|parrot|bird|rabbit|hamster) (?:toys?|balls?|chews?|ropes?|frisbees?|tug(?:s| toys?)?|puzzles?|teasers?|wands?|tunnels?)', 'chew toys?', 'squeaky (?:dog |pet )?toys?', 'tug (?:toys?|ropes?)',
      'ball (?:launchers?|throwers?)', 'chuckit!?', 'kong (?:classic|extreme|puppy|wobbler|kickeroo|toys?)', 'catnip(?: toys?)?', 'cat (?:wands?|teasers?|tunnels?|laser)', 'snuffle mats?', 'lick mats?', 'treat (?:puzzles?|balls?|dispensers?)',
      'interactive (?:dog |cat |pet )?toys?', 'training clickers?', 'dog (?:agility|training) (?:sets?|kits?|equipment)', 'nylabone', 'petstages']),
    ctx: words(['toys?', 'balls?', 'chews?', 'frisbees?', 'puzzles?', 'clickers?']),
    type: words(['toys?', 'balls?', 'frisbees?', 'clickers?'])
  },
  {
    key: 'food', label: 'Food & treats',
    sure: words(['(?:dog|cat|puppy|kitten|pet|rabbit|guinea pig|hamster|bird|parrot|fish|reptile|tortoise) (?:food|treats?|biscuits?|kibble|snacks?|chews?|pouches|nuggets|pellets|flakes|seed|mix|nibbles)',
      '(?:wet|dry|grain[- ]free|complete|senior|adult|puppy|kitten|hypoallergenic) (?:dog |cat )?food', 'dental (?:sticks?|chews?)', 'dentastix', 'rawhide', 'pigs? ears', 'bully sticks?', 'jerky (?:for|dog|cat)',
      'royal canin', 'purina', 'pro plan', 'pedigree', 'whiskas', 'felix', 'iams', "hill'?s science", "lily'?s kitchen", 'harringtons', 'burns pet', 'applaws', 'james wellbeloved', 'eukanuba', "butcher'?s",
      "wainwright'?s", 'bakers complete', 'dreamies', 'webbox', 'sheba', 'gourmet gold', 'barking heads', 'meowing heads', 'forthglade', 'arden grange', 'scrumbles', 'timothy hay', 'meadow hay', 'mealworms? (?:dried)?',
      'suet (?:for|pellets)', 'fish flakes', 'tetra ?min', 'versele-?laga', 'burgess excel', 'oxbow']),
    ctx: words(['food', 'treats?', 'biscuits?', 'kibble', 'snacks?', 'chews?', 'hay']),
    type: words(['food(?! (?:bowls?|storage|containers?|bins?|dispensers?|feeders?|mats?|scoops?))', 'treats?', 'biscuits?', 'kibble'])
  },
  {
    key: 'cats', label: 'Cat trees, litter & scratchers',
    sure: words(['cat (?:trees?|towers?|condos?|scratchers?|scratching (?:posts?|boards?|pads?|mats?)|litter(?: trays?| boxes?| mats?| scoops?| bags?| liners?)?|flaps?|shelves|hammocks?|activity centres?|climbing)', 'scratching posts?',
      'kitten (?:litter|trees?)', 'litter (?:trays?|boxes?|mats?|scoops?|liners?)', 'self[- ]cleaning litter', 'clumping (?:cat )?litter', 'catsan', "world'?s best cat litter", 'cats best', 'sureflap', 'microchip cat flaps?', 'catit']),
    ctx: words(['trees?', 'towers?', 'condos?', 'scratchers?', 'scratching', 'litter', 'flaps?', 'hammocks?']),
    type: words(['cat trees?', 'cat towers?', 'scratch(?:ers?|ing posts?)', 'litter(?! pickers?)', 'cat flaps?'])
  },
  {
    key: 'grooming', label: 'Grooming & care',
    sure: words(['(?:dog|cat|pet|puppy|kitten|horse) (?:shampoos?|conditioners?|brush(?:es)?|combs?|grooming|clippers?|nail (?:clippers?|grinders?|trimmers?)|wipes|toothbrush(?:es)?|toothpaste|dental (?:kits?|care)|ear cleaners?|eye wipes?|deodori[sz]ers?|colognes?|perfumes?|towels?|dryers?|hair dryers?|nappies|diapers|pads)',
      'puppy (?:pads|training pads)', 'grooming (?:tables?|arms?|kits?|gloves?|brush(?:es)?|scissors|shears|tools?)', 'deshedding (?:tools?|brush(?:es)?)', 'furminator', 'flea (?:combs?|collars?|treatments?|sprays?|shampoos?)', 'tick (?:removers?|twisters?|collars?)', 'seresto', 'bob martin',
      "johnson'?s veterinary", 'beaphar', 'yumove', 'paw (?:balm|wax|cleaners?|washers?)', 'joint (?:supplements?|care) for (?:dogs?|cats?)', 'pet hair (?:removers?|rollers?|brush(?:es)?)']),
    ctx: words(['shampoos?', 'conditioners?', 'brush(?:es)?', 'combs?', 'clippers?', 'grooming', 'wipes', 'toothbrush(?:es)?', 'toothpaste', 'supplements?', 'vitamins?']),
    type: words(['shampoos?', 'conditioners?', 'brush(?:es)?', 'combs?', 'clippers?', 'grooming', 'wipes', 'toothbrush(?:es)?', 'nail (?:clippers?|grinders?)', 'flea', 'tick (?:collars?|removers?|twisters?)', 'seresto'])
  },
  {
    key: 'feeding', label: 'Bowls, feeders & smart gadgets',
    sure: words(['(?:dog|cat|pet|puppy|kitten) (?:bowls?|dishes|feeders?|water (?:fountains?|dispensers?|bottles?)|fountains?|food (?:storage|containers?|bins?|scoops?|mats?)|feeding (?:stations?|mats?)|cameras?|trackers?|gps|monitors?)',
      'slow feeders?', 'automatic (?:pet |cat |dog )?feeders?', 'raised (?:dog |pet )?bowls?', 'elevated (?:dog |pet )?(?:bowls?|feeders?)', 'pet (?:water )?fountains?', 'surefeed', 'microchip (?:pet )?feeders?', 'furbo', 'petkit',
      'gps (?:dog |pet |cat )?trackers?', '(?:dog|cat|pet) gps', 'airtag (?:dog |cat |pet )?collars?', 'treat (?:cameras?|tossing cameras?)']),
    ctx: words(['bowls?', 'dishes', 'feeders?', 'fountains?', 'cameras?', 'trackers?', 'gps', 'water bottles?']),
    type: words(['bowls?', 'feeders?', 'fountains?', 'trackers?', 'gps', 'food (?:storage|containers?|bins?|scoops?|dispensers?)'])
  },
  {
    key: 'travel', label: 'Travel, car & carriers',
    sure: words(['(?:pet|cat|dog|puppy|kitten|rabbit|small animal) (?:carriers?|carrier bags?|travel bags?|backpacks?|slings?|strollers?|prams?|buggies|car seats?|seat (?:covers?|belts?)|seatbelts?|boot liners?|car (?:harness(?:es)?|ramps?|barriers?|guards?)|ramps?|travel (?:bowls?|bottles?|crates?|beds?))',
      'cat carriers?', 'pet carriers?', 'dog car seats?', 'dog seat covers?', 'car boot liners? for dogs', 'dog guards? (?:for cars?)?', 'dog ramps?', 'pet strollers?', 'dog strollers?', 'pet travel (?:bags?|crates?|kits?)', 'kurgo']),
    ctx: words(['carriers?', 'strollers?', 'prams?', 'car seats?', 'seat covers?', 'boot liners?', 'ramps?', 'backpacks?']),
    type: words(['carriers?', 'strollers?', 'car seats?', 'seat covers?', 'boot liners?', 'dog guards?'])
  },
  {
    key: 'small-pets', label: 'Small pets, birds, fish & reptiles',
    sure: words(['(?:rabbit|guinea pig|hamster|gerbil|ferret|chinchilla|small animal|bird|parrot|budgie|canary|cockatiel) (?:hutch(?:es)?|cages?|runs?|houses?|bedding|hides?|wheels?|bottles?|perches?|swings?|baths?|stands?|tunnels?)', 'rabbit (?:hutch(?:es)?|runs?)', 'hutch(?:es)?',
      'guinea pig', 'hamster', 'small animal', 'bird ?cages?', 'parrot (?:cages?|stands?|perches?)', 'aviar(?:y|ies)', 'aquariums?', 'fish ?tanks?', 'aquarium (?:filters?|heaters?|lights?|gravel|plants?|decorations?|pumps?)',
      'water conditioners? (?:for )?(?:aquariums?|fish)', 'tetra', 'fluval', 'juwel', 'vivariums?', 'terrariums?', 'reptile (?:heat|uv|lamps?|bulbs?|mats?|hides?|substrates?|tanks?)', 'heat mats? for reptiles', 'exo terra', 'zoo med',
      'tortoise (?:tables?|houses?|food)', 'pond (?:fish|food)', 'koi (?:food|pellets?)', 'burgess', 'oxbow']),
    ctx: words(['hutch(?:es)?', 'cages?', 'runs?', 'bedding', 'hides?', 'wheels?', 'perches?', 'filters?', 'heaters?', 'substrates?', 'gravel', 'tanks?']),
    type: words(['hutch(?:es)?', 'cages?', 'aquariums?', 'fish ?tanks?', 'vivariums?', 'terrariums?', 'perches?'])
  },
  {
    key: 'outdoor', label: 'Chicken coops & outdoor',
    sure: words(['chicken (?:coops?|houses?|runs?|feeders?|drinkers?|waterers?|fencing|netting|nesting boxes?|perches?)', 'hen (?:houses?|coops?|runs?)', 'poultry (?:feeders?|drinkers?|houses?|netting|fencing|runs?)', 'coops?', 'eglu', 'omlet',
      'dog (?:runs?|fences?|fencing|pens? outdoor|kennels? outdoor|houses? outdoor|pools?|paddling pools?)', 'outdoor (?:dog |cat |pet )?(?:kennels?|houses?|runs?|enclosures?|pens?)', 'pet (?:enclosures?|fences?|fencing|runs?)', 'catios?', 'cat (?:enclosures?|runs?|fences?|fencing)',
      'nesting boxes? for (?:hens|chickens)', 'egg incubators?']),
    ctx: words(['coops?', 'runs?', 'fences?', 'fencing', 'enclosures?', 'netting', 'drinkers?', 'incubators?']),
    type: words(['coops?', 'enclosures?', 'incubators?', 'catios?'])
  }
];
export const OTHER = { key: 'other-pet', label: 'Other pet products' };

// Products that go to another Gear World site (or wait for the owner). Checked before the pet categories, only with a
// pet word or a pet shop. A pet word for the animal ("for dogs", "dog toy", "chew") keeps a product here.
const FOR_PETS = words(['for (?:dogs?|cats?|pupp(?:y|ies)|kittens?|pets?|rabbits?|guinea pigs?|hamsters?|birds?|parrots?)', '(?:dog|cat|pet|puppy|kitten) toys?', 'chew(?:s|ing)?', 'squeak(?:y|er|ers)', 'catnip', 'tug',
  'fetch', '(?:dog|puppy|pet) (?:coats?|jumpers?|jackets?|bandanas?|boots?|costumes?|raincoats?|pyjamas)', '(?:dog|cat|pet|puppy|kitten) (?:carriers?|leads?|leash(?:es)?|collars?|harness(?:es)?|beds?|bowls?|feeders?|crates?|kennels?|litter|food|treats?)',
  'pet carriers?', 'pawhut', 'kong', 'good boy', 'petstages', 'trixie', 'rosewood pet', 'ancol']);
export const OVERLAPS = [
  // Named for children: always Kids' ("Kids Dog Costume"), unless it is for the animal ("baby gate for dogs").
  { key: 'kids', label: 'Children\'s toys, costumes & books with animals (Kids\' Gear World, KGW)', re: words(['kids?', "kid'?s", 'children', "children'?s", 'childrens', 'toddlers?', 'baby', 'babies', 'paw patrol', 'gabby', 'peppa']),
    unless: words(['for (?:dogs?|cats?|pets?|pupp(?:y|ies)|kittens?)']) },
  { key: 'kids', label: 'Children\'s toys, costumes & books with animals (Kids\' Gear World, KGW)', re: words(['paw patrol', 'soft toys?', 'plush(?:ies)?', 'stuffed (?:animals?|toys?)', 'cuddly toys?', 'teddy', 'kids?', "kid'?s", 'children', "children'?s", 'childrens',
    'baby', 'babies', 'toddlers?', 'gabby', 'peppa', 'squishmallows?', 'jellycat', 'lego', 'playmobil', 'sylvanian', 'figures?', 'figurines?', 'colouring', 'jigsaws?', 'puzzles? for kids', 'story ?books?', 'picture books?',
    'books?', 'rocking horses?', 'ride[- ]on', 'hobby horses?', 'my little pony', 'interactive (?:pets?|puppy|kitten) toys? for kids', 'robot (?:dog|cat|pet)s?', 'fingerlings', 'furreal', 'tamagotchi']), unless: FOR_PETS },
  { key: 'garden', label: 'Wild birds, wildlife & pest deterrents (Garden Gear World, GGW)', re: words(['wild birds?', 'bird ?feeders?', 'bird (?:baths?|boxes?|tables?|seed|food)', 'nest(?:ing)? boxes?', 'suet', 'fat balls?', 'niger seed', 'sunflower hearts', 'hedgehog', 'bee hotels?', 'insect hotels?',
    'bug hotels?', 'squirrels?', 'repell(?:ers?|ents?)', 'scarers?', 'deterrents?', 'ultrasonic', 'pet[- ](?:safe|friendly) (?:weed|lawn|slug|grass|artificial grass|fertili[sz]ers?)', 'artificial grass', 'lawn']),
    unless: words(['parrots?', 'budgies?', 'canar(?:y|ies)', 'cockatiels?', 'cages?', 'aviar(?:y|ies)', 'chickens?', 'hens?', 'poultry', 'hamsters?', 'rabbits?']) },
  { key: 'home', label: 'Vacuums, cleaners & home appliances "for pet hair" (Home Gear World, HGW)', re: words(['vacuums?', 'vacuum cleaners?', 'hoovers?', 'robot vacuums?', 'carpet cleaners?', 'carpet washers?', 'steam (?:mops?|cleaners?)', 'mops?', 'air purifiers?',
    'washing machines?', 'tumble dryers?', 'dehumidifiers?', 'sofas? (?:for (?:living|home))', 'stain (?:and|&) odou?r (?:removers?|eliminators?)', 'odou?r eliminators?', 'disinfectants?', 'bins?', 'laundry']),
    unless: words(['dog bins?', 'food (?:storage )?bins?', 'pet food bins?', 'litter bins?', 'poo bins?', 'dog waste bins?']) },
  { key: 'merch', label: 'Dog and cat themed clothing, gifts & decor for people (Men\'s, Women\'s, Home)', re: words(["men'?s", "women'?s", 'mens', 'womens', 'ladies', 'unisex', 't-?shirts?', 'tees?', 'hoodies?', 'sweatshirts?', 'socks', 'slippers?', 'pyjamas?', 'nightwear',
    'dresses?', 'leggings', 'scarf', 'scarves', 'mugs?', 'cups?', 'tea towels?', 'aprons?', 'cushion covers?', 'cushions?', 'throws?', 'bedding', 'bed linen', 'duvet(?: covers?| sets?)?', 'pillowcases?', 'rugs?', 'doormats?',
    'wall art', 'canvas', 'prints?', 'posters?', 'framed', 'ornaments?', 'decorations?', 'baubles?', 'christmas cards?', 'greeting cards?', 'birthday cards?', 'wrapping paper', 'gift bags?', 'jewellery', 'necklaces?', 'pendants?',
    'earrings?', 'bracelets?', 'charms?', 'rings?', 'keyrings?', 'key ?chains?', 'tote bags?', 'handbags?', 'backpacks?', 'purses?', 'wallets?', 'phone cases?', 'calendars?', 'diar(?:y|ies)', 'notebooks?', 'stickers?', 'candles?', 'lamps?', 'night lights?']),
    unless: FOR_PETS },
  { key: 'horse', label: 'Horse & riding gear (not in the ZGW plan yet: the owner decides)', re: words(['horses?', 'equestrian', 'equine', 'pon(?:y|ies)', 'riding', 'saddles?', 'saddle ?pads?', 'bridles?', 'numnahs?', 'girths?', 'stirrups?', 'hay ?nets?', 'horse rugs?', 'fly masks?',
    'jodhpurs', 'hoof', 'hooves']), unless: words(['dogs?', 'cats?', 'pupp(?:y|ies)', 'kittens?', 'chews?']) }
];

const low = s => String(s || '').toLowerCase().replace(/&amp;/g, ' and ').replace(/&/g, ' and ').replace(/[’`]/g, "'").replace(/[™®]/g, ' ').replace(/[ \s]+/g, ' ').trim();

// The category whose product word comes FIRST in the name, or null ("PawHut Dog Crate Furniture with Cushion" is a crate).
function typeOf(n) {
  let best = null, at = Infinity;
  for (const k of CATEGORIES) {
    const i = n.search(k.type);
    if (i >= 0 && i < at) { at = i; best = k.key; }
  }
  return best;
}

// The pets classifier shared by the feed scan and (later) the import plan. shopCat: the shop's category path (and Awin's).
//   { cat }                 a ZGW product in that category
//   { overlap, cat }        a product of another Gear World site (or horse gear, which waits for the owner)
//   { why: 'no-list' }      never a ZGW product (look-alike names, pest control, live animals, prescription medicines)
//   {}                      not a pet product
export function classifyPets(name, shopCat = '', opts = {}) {
  const n = low(name), c = low(shopCat);
  if (!n || NO.test(n)) return { why: 'no-list' };
  const petShop = PET_SHOP.test(c) || Boolean(opts.petShop);
  const brand = PET_BRAND.test(n);
  const ctxName = PET_CTX.test(n) || brand;
  if (!ctxName && !petShop) return {};
  for (const o of OVERLAPS) {
    if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
      let cat = null;
      for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
      return { overlap: o.key, cat };
    }
  }
  const type = typeOf(n);
  let cat = null;
  // 1. A clear name, unless the name says another category's product word first.
  for (const k of CATEGORIES) if (k.sure.test(n) && (!type || type === k.key)) { cat = k.key; break; }
  // 2. The product word, with a pet word in the name or a pet shop ("PawHut ... crate", "Pet Supplies > ... bowl").
  if (!cat && type) cat = type;
  if (!cat) for (const k of CATEGORIES) if (k.ctx.test(n)) { cat = k.key; break; }
  // 3. A pet product without a category word: only from a pet shop or a pet brand (a name with just "dog" in it is not enough).
  if (!cat && (petShop || brand)) cat = OTHER.key;
  if (!cat) return {};
  return { cat };
}
