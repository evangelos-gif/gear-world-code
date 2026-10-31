// General category rules for Men's Gear World (MGW) and Women's Gear World (WGW), the same kind of rules the newer sites
// have (sites/<site>/category-rules.js): the product NAME decides, the shop's section helps (lessons L14, L65).
//
// Owner (31 Oct 2026): every product comes in through the Hub and goes to every site and category it belongs to, with the
// same logic on all 11 sites. MGW and WGW used rules written per shop (tools/import-rules/coes.mjs, viaduct, opulensi ...).
// These rules are tuned against the products both sites show today (31 Oct 2026: 15,850 on MGW, 23,178 on WGW) with
// tools/legacy-rules-compare.mjs, so a shop keeps its place when it moves to the shared import.
//
// How a product is placed:
//   1. Not fashion, beauty, watches, jewellery or everyday carry: left out (DENY, then no rule matches).
//   2. Children's products go to Kids' Gear World.
//   3. Who it is for: the NAME first ("Men's", "Ladies", "pour Homme", a dress, cufflinks), then the shop's section
//      ("Menswear", "Womenswear"). A shop's section only counts for shops that file men and women apart: Cronjager files
//      men's rings under "Women's Jewellery" and Watch Enclave women's watches under "Men's Watches" (live sites, 31 Oct 2026).
//   4. Nobody named (unisex): the product goes to both sites, as today (Stan Ray workwear, torches, watches), except where
//      one site is the natural home: earrings and make-up on WGW, cufflinks and shaving on MGW.
//   5. The FIRST category rule whose words match the name wins; the subcategory is the first of its list that matches.

import { fixMojibake } from '../../src/db.js';

export const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// ---------- Who it is for ----------
const MEN = words(["men'?s", 'mens', 'men', 'man', 'gents?', "gent'?s", 'male', 'homme', 'pour homme', 'for him', 'him', 'masculine', 'uomo', 'herren', 'boyfriend']);
const WOMEN = words(["women'?s", 'womens', 'women', 'woman', 'ladies', "ladies'", 'lady', 'female', 'femme', 'pour femme', 'for her', 'her', 'feminine', 'donna', 'damen', 'girlfriend', 'maternity']);
const UNISEX = words(['unisex', 'men and women', 'men & women', 'men/women', 'mens & womens', 'for him and her', 'for her and him', 'his and hers', 'his & hers']);
const KIDS = words(['kids?', "kid'?s", 'children', "children'?s", 'child', 'childs', 'toddlers?', 'babies', 'baby', 'infants?', 'boys?', "boys'", 'girls?', "girls'", 'junior', 'juniors', 'jnr', 'youth', 'newborn']);
// Things only women wear or use (a name without "women" still goes to WGW only).
const WOMEN_ITEMS = words(['dress(?:es)?', 'skirts?', 'blouses?', 'bras?', 'bralettes?', 'sports bras?', 'bikinis?', 'swimsuits?', 'tankini', 'leggings', 'jeggings', 'camisoles?',
  'cami', 'nightie', 'nightdress', 'kaftan', 'kimono', 'playsuit', 'jumpsuit', 'culottes', 'tights', 'stockings', 'heels', 'stilettos?', 'court shoes?', 'ballet flats?',
  'ballerinas?', 'mary janes?', 'handbags?', 'clutch(?: bag)?', 'purses?', 'earrings?', 'ear cuffs?', 'studs?', 'hoops?', 'brooch(?:es)?', 'anklets?', 'hair ?bands?', 'scrunchies?',
  'hair clips?', 'hair ?slides?', 'tiaras?', 'lipsticks?', 'lip gloss', 'mascara', 'eyeliner', 'eyeshadow', 'eye shadow', 'blush(?:er)?', 'bronzer', 'foundation', 'concealer',
  'primer', 'highlighter', 'nail (?:polish|varnish|lacquer|gel|art|file)s?', 'nails', 'false lashes', 'lashes', 'brows?', 'eyebrow', 'make-?up', 'cosmetics?', 'epilators?',
  'bikini trimmer', 'ladyshave', 'curling (?:iron|wand|tongs)', 'hair ?straighteners?']);
// Things for men (a name without "men" still goes to MGW only).
const MEN_ITEMS = words(['cufflinks?', 'cuff links?', 'tie clips?', 'tie bars?', 'tie pins?', 'lapel pins?', 'pin badges?', 'bow ties?', 'neck ?ties?', 'ties', 'tie', 'pocket squares?', 'boxer(?:s| shorts| briefs)?', 'signet', 'dog tags?',
  'beard', 'moustache', 'mustache', 'lynx', 'old spice', 'gillette(?! (?:venus|satin|women))', 'american crew', 'proraso', 'bulldog', 'king c', 'wilkinson sword(?! (?:intuition|lady))', 'aftershave', 'after shave', 'after-shave', 'shaving', 'shave', 'shaver', 'razor', 'beard trimmer', 'cologne', 'barber', 'fred bennett']);

// Shops that file men and women apart: their section says who a product is for when the name does not.
const MEN_FEED = /(?:^|[^a-z])(?:menswear|men'?s(?:wear)?|mens|men|gents|male|homme)(?![a-z])/i;
const WOMEN_FEED = /(?:^|[^a-z])(?:womenswear|women'?s(?:wear)?|womens|women|ladies|ladieswear|female|femme)(?![a-z])/i;

// ---------- Not for these sites ----------
// Office, printer, network and computer parts: wherever they are in the name, they belong to Technology Gear World (shadow
// catalogue 31 Oct 2026: PcNova, GamingKit and PCHUB.UK "Toner black", "Transfer Belt", "Fuser kit", "networking cable",
// "Computer case Fan" went to beauty, belts, home decor and garden electrical). Shared by the fashion and home/garden rules.
export const OFFICE_PARTS = words(['toner (?:black|cyan|magenta|yellow|cartridges?|waste|twin|kits?|contract|collector)', 'toner waste', 'waste toner',
  'printheads?', 'print heads?', 'fuser(?: kits?| units?| assembly)?', 'transfer (?:belts?|kits?|rollers?|units?)', 'drum (?:units?|kits?|cartridges?)',
  'printer(?:/scanner)? (?:spare parts?|labels?|ribbons?|consumables?)', 'ink cartridges?', 'ink (?:multipack|ribbons?)', 'separation pads?', 'maintenance kits? for',
  'networking cables?', 'patch cables?', '(?:power|telephone|audio|lightning|usb(?:-c)?|hdmi|displayport|ethernet|network|sata|vga|dvi|serial|parallel|dc) cables?(?! (?:reels?|ties?))', 'serial cables?', 'parallel cables?', 'cat ?[5-8]e?a? (?:cables?|patch|u\\/utp|f\\/utp|s\\/utp)', '[usf]\\/utp', 'cable kit\\. splitter',
  'intercom', 'keyfobs?', 'proximity (?:cards?|fobs?)', 'computer cases?', '(?:computer )?case fans?', 'pwm fans?', 'midi tower', 'serial ata', 'nand', 'ssd',
  'laptop (?:cable )?locks?', 'cable locks?', 'gas struts?', 'microsoft office', 'office professional', 'barcode (?:printers?|scanners?|readers?|labels?)', 'bar code (?:printers?|scanners?|readers?|labels?)', 'label printers?', 'stamp tape', 'directlabel']);
const HARD_DENY = words(['gift cards?', 'gift vouchers?', 'e-?vouchers?', 'vouchers?']);
// re: words that mark another kind of product when they come AFTER the product type in the name ("Black Cat Cufflinks"
// stay, "... Pocket Watch Holster" is decided by its last word). anywhere: phrases that decide wherever they are ("Torch for Cats").
const DENY = [
  { re: /$^/, anywhere: OFFICE_PARTS, label: 'office or computer part (Technology Gear World)' },
  { re: words(['pets?', 'pet supplies', 'dog (?:leads?|collars?|beds?|bowls?|toys?|harness(?:es)?|coats?)', 'cat (?:litter|toys?|trees?|scratch\\w*)', 'poop', 'aquariums?', 'kittens?', 'puppy']),
    anywhere: words(['for (?:dogs?|cats?|pets?|puppies)', 'pet (?:supplies|stains?|toys?)', 'dog urine', 'cat toy']), label: 'pet item (Home Gear World)' },
  { re: words(['phone cases?', 'iphone', 'ipad', 'samsung galaxy', 'airpods', 'screen protectors?', 'usb hub', 'keypad phone', 'mobile phone', 'phone covers?', 'mobile covers?', 'flex cable']),
    anywhere: words(['for iphone', 'for ipad', 'for samsung', 'flex cable']), label: 'phone or computer item (Technology Gear World)' },
  { re: words(['candles?', 'diffusers?', 'reed diffuser', 'mugs?', 'scatter cushions?', 'cushion covers?', 'blankets?', 'throws?', 'rugs?', 'coasters?', 'tea towels?', 'vases?', 'photo frames?', 'wall mirrors?', 'vanity mirrors?', 'wall art', 'posters?', 'wall clocks?', 'table lamps?', 'bedding', 'duvets?', 'pillow ?cases?', 'fridge magnets?', 'shoe (?:box|rack|storage)']),
    label: 'home item (Home Gear World)' },
  { re: words(['jigsaw', 'puzzles?', 'board games?', 'playing cards', 'toys?', 'toy figures?', 'lego', 'nerf', 'blasters?', 'books?', 'notebooks?', 'greeting cards?', 'stickers?', 'chocolates?', 'sweets', 'wine glass(?:es)?']),
    anywhere: words(['toy figure', 'pretend play', 'role play']), label: 'toy, book or gift (not fashion)' },
  { re: words(['shoe polish', 'shoe cream', 'shoe care', 'shoe trees?', 'shoe brush', 'insoles?', 'laces', 'shoelaces', 'shoe horn', 'waterproofer', 'reproofer', 'cleaning gel', 'shoe cleaner']), label: 'shoe care (not shown on these sites)' },
  { re: words(['water bottles?', 'footballs?', 'rackets?', 'racquets?', 'shin pads?', 'shin guards?', 'mouth ?guards?', 'gum shield', 'hockey sticks?', 'golf (?:balls|clubs?|tees)', 'yoga mats?', 'dumbbells?', 'kettlebells?', 'resistance bands?', 'ball arm']),
    label: 'sports equipment (Sporty Gear World)' },
  { re: words(['tents?', 'sleeping bags?', 'camping chairs?', 'camping stoves?', 'gas stoves?', 'cool ?box', 'barbecues?', 'bbq grills?']), label: 'camping gear (Travel Gear World)' },
  { re: words(['suitcases?', 'luggage', 'cabin bags?', 'trolley bags?', 'trolley backpacks?', 'packing cubes?', 'passport (?:cover|holder|case)s?', 'luggage tags?']), label: 'luggage (Travel Gear World)' },
  { re: words(['supplements?', 'protein', 'capsules', 'tablets', 'condoms?', 'pregnancy tests?', 'thermometers?', 'plasters', 'first aid', 'medicines?', 'hearing aids?', 'reading glasses', 'contact lens(?:es)?', 'toothpaste', 'tooth ?brush(?:es)?', 'mouthwash', 'floss', 'dental', 'denture', 'tampons?', 'sanitary', 'incontinence']),
    label: 'health product (not fashion)' },
  { re: words(['cordless', 'drill (?:bits?|drivers?|sets?)', 'combi drills?', 'hammer drills?', 'screwdrivers?', 'spanners?', 'hammers?', 'saws?', 'sanders?', 'grinders?', 'chainsaws?', 'pliers', 'wrench(?:es)?', 'socket sets?', 'tool ?(?:box|bag|kits?|sets?)', 'workbench', 'ladders?', 'crimpers?', 'crimp', 'multimeter']),
    label: 'tool (Construction Gear World)' },
  { re: words(['flash ?light (?:bracket|bracker)', 'camera lens', 'solar fan', 'battery holder', 'battery charger', 'searchlight', 'cn plug']), label: 'electronics part (not fashion)' }
];
// Well-known men's perfume lines that often have no "men" in the name (from tools/import-rules/joybuy.mjs, 27 Oct 2026).
const MEN_LINES = words(['sauvage', 'bleu de chanel', 'aventus', 'acqua di gio', 'acqua di giò', 'aqua di gio', 'eros', 'invictus', '1 million', 'one million', 'le male', 'boss bottled',
  "terre d'hermes", 'terre d’hermès', 'stronger with you', 'spicebomb', 'the one for men', 'dylan blue', 'phantom', 'wanted', 'fahrenheit', 'allure homme', 'ultra male',
  'polo blue', 'polo red', 'y eau de parfum', "l'homme", 'pour lui', 'bad boy', 'luna rossa', 'aqva', 'cool water', 'toy boy', 'uomo', 'montblanc legend', 'legend spirit',
  'montblanc explorer', 'burberry hero', 'myslf', 'only the brave', 'boss the scent', 'le beau', 'kouros', 'aramis', 'egoiste', 'azzaro chrome', 'davidoff', 'club de nuit intense',
  'lattafa asad', 'asad', 'k by dolce', 'ombre nomade man', 'odyssey homme', 'hawas', 'blue jeans']);

// ---------- Categories (first match wins) ----------
// Each rule: the site category slug on MGW and on WGW, the words, words that stop it, and subcategories in order.
// sub: [MGW/WGW subcategory name, words] - the first that matches; none: the category's own default.
const RULES = [
  { key: 'edc', mgw: 'everyday-carry', wgw: 'everyday-essentials',
    include: words(['torch(?:es)?', 'flash ?lights?', 'head ?lamps?', 'head ?torch(?:es)?', 'multi[- ]?tools?', 'multitools?', 'pocket knife', 'pocket knives', 'penknife', 'pen knife', 'edc', 'key ?organi[sz]ers?', 'lantern']),
    exclude: words(['necklace', 'pendant', 'earrings?', 'charm', 'cufflinks?']),
    subs: [] },
  { key: 'watches', mgw: 'watches', wgw: 'watches',
    include: words(['watch(?:es)?', 'wristwatch(?:es)?', 'smartwatch(?:es)?', 'iwatch', 'chronograph', 'timepiece']),
    exclude: words(['watch-?caps?', 'watchman', 'neighbourhood watch', 'stopwatch(?:es)?(?! .*\\bwatch\\b)']),
    subs: [['Watch accessories', words(['watch (?:straps?|bands?|winders?|box(?:es)?|cases?|stand|tools?|charger|holster|pouch)', 'loops?', 'straps?'])]] },
  { key: 'jewellery', mgw: 'jewellery', wgw: 'jewellery',
    include: words(['cufflinks?', 'cuff links?', 'tie clips?', 'tie bars?', 'tie pins?', 'lapel pins?', 'pin badges?', 'rings?', 'wedding bands?', 'bands? ring', 'necklaces?', 'pendants?', 'chains?',
      'bracelets?', 'bangles?', 'earrings?', 'ear cuffs?', 'ear bars?', 'huggies?', 'studs?', 'hoops?', 'brooch(?:es)?', 'anklets?', 'charms?', 'chokers?', 'lockets?', 'jewell?ery(?! (?:box|boxes|case|cases|stand|organi[sz]er|roll|tray|dish))',
      'jewelry(?! (?:box|boxes|case|stand))', 'signet', 'dog tags?', 'bead(?:ed|s)? (?:bracelets?|necklaces?|earrings?)', 'gemstones?', 'diamond', 'sapphire', 'emerald', 'amethyst', 'opal', 'pearl(?:s)?(?! (?:white|grey|button))', 'tiaras?']),
    exclude: words(['key ?rings?', 'ring binders?', 'ring light', 'teething', 'ring sling', 'tea ?light', 'chain ?saw', 'chain ?lube', 'chain oil', 'bike chain', 'snow chains?', 'tyre chains?',
      'ball studs?', 'stud (?:brackets?|walls?|finders?|bolts?)', 'whetstones?', 'sharpening', 'diamond (?:blades?|discs?|core|drill)', 'phone cases?', 'iphone', 'shower ring', 'curtain rings?', 'onion rings?', 'o-?rings?', 'ring spanner', 'boxing ring', 'charm bracelet kit', 'bead(?:ed)? (?:cushion|curtain)', 'jewell?ery (?:box|boxes|case|cases|stand|organi[sz]er|roll|tray|dish)']),
    subs: [['Cufflinks', words(['cufflinks?', 'cuff links?'])], ['Earrings', words(['earrings?', 'ear cuffs?', 'ear bars?', 'huggies?', 'studs?', 'hoops?'])], ['Rings', words(['rings?', 'signet', 'wedding bands?'])],
      ['Necklaces', words(['necklaces?', 'pendants?', 'chains?', 'chokers?', 'lockets?', 'dog tags?'])], ['Bracelets', words(['bracelets?', 'bangles?', 'anklets?'])]] },
  { key: 'fragrance', mgw: 'grooming-fragrances', wgw: 'beauty-fragrances',
    include: words(['eau de (?:parfum|toilette|cologne)', 'edp', 'edt', 'extrait(?: de parfum)?', 'parfums?', 'perfumes?', 'travel spray', 'atomi[sz]ers?', 'perfume oils?', 'attar', 'oud', 'fragrances?', 'colognes?', 'body mists?', 'body sprays?', 'aftershave', 'after shave', 'after-shave']),
    exclude: words(['candles?', 'diffusers?', 'room spray', 'home fragrance', 'air freshener', 'car freshener']),
    subs: [['Gift sets', words(['gift sets?', 'sets?', 'coffret'])], ['Fragrance', /./]] },
  { key: 'grooming', mgw: 'grooming-fragrances', wgw: 'beauty-fragrances', beauty: true,
    include: words(['deodorants?', 'deo', 'anti-?perspirant', 'roll-?on', 'shav(?:e|er|ers|ing)', 'razors?', 'blades?', 'beard', 'moustache', 'trimmers?', 'clippers?', 'epilators?', 'ipl', 'hair removal', 'wax strips?',
      'shampoos?', 'conditioners?', 'hair (?:oil|mask|serum|spray|gel|wax|cream|dye|colou?r|treatment|tonic|clay|paste|pomade)s?', 'pomade', 'dry shampoo', 'hair ?dryers?', 'hair ?straighteners?', 'curling (?:iron|wand|tongs)', 'hot brush', 'air ?styler', 'hair ?brush(?:es)?', 'combs?',
      'moisturi[sz](?:er|ers|ing)', 'serums?', 'cleansers?', 'cleansing', 'toners?', 'face (?:wash|mask|cream|oil|mist|scrub)s?', 'facial', 'sheet masks?', 'masks?(?! (?:fancy|halloween))', 'sunscreen', 'spf', 'sun cream', 'eye cream', 'night cream', 'day cream', 'creams?', 'balms?', 'lotions?', 'skin ?care', 'retinol', 'hyaluronic', 'niacinamide', 'vitamin c', 'exfoliat\\w*',
      'shower gels?', 'body wash', 'bath (?:oil|salts?|bombs?|foam)', 'shower steamers?', 'soaps?', 'body (?:butter|scrub|oil|lotion)s?', 'hand cream', 'lip balm', 'toothpaste', 'tooth ?brush(?:es)?', 'mouthwash',
      'lipsticks?', 'lip gloss', 'mascara', 'eyeliner', 'eyeshadow', 'eye shadow', 'palettes?', 'blush(?:er)?', 'bronzer', 'foundation', 'concealer', 'primer', 'highlighter', 'setting spray', 'make-?up', 'cosmetics?',
      'nail (?:polish|varnish|lacquer|gel|art|file|kit)s?', 'nails', 'false lashes', 'lashes', 'eyebrow', 'brow (?:pencil|gel|pomade)', 'tweezers?', 'grooming', 'manicure', 'pedicure', 'beauty', 'tanning', 'self tan', 'fake tan', 'lip ?(?:liners?|tints?|plumpers?|glaze|mud|scrub|stain|oil|sticks?|gloss)', 'tints?', 'contour', 'glitter (?:gel|stick)s?', 'cushion (?:foundation|compact)', 'hair colou?rs?', 'permanent colou?r', 'glossing colou?r', 'detangl\\w+', 'brushes', 'hand wash', 'shea butter', 'hair towels?', 'turbans?',
      'face care', 'body care', 'skin care', 'hair care', 'personal care', 'hygiene', 'styling', 'fragrances?', 'gift box(?:es)?', 'gift sets?']),
    exclude: words(['toner(?:-kit| cartridges?| kits?| bottles?| powder)', 'cartridges?', 'drum kits?', 'printers?', 'brushes? for (?:paint|walls?|files?)', 'texturing brush', 'file cleaning', 'paint ?brush(?:es)?', 'car shampoo', 'shampoo detergent', 'car wash', 'blades? of', 'saw blades?', 'wiper blades?', 'blade sharpener', 'lawn', 'pet', 'dog', 'horse', 'clippers? for (?:dogs?|pets?|horses?)', 'hedge trimmer', 'grass trimmer', 'string trimmer', 'strimmer', 'nail (?:gun|nails)', 'nail ?gun', 'masks? (?:ffp|n95|dust)', 'dust masks?', 'face masks? (?:disposable|surgical)', 'snorkel', 'welding']),
    subs: [['Shaving', words(['shav(?:e|er|ers|ing)', 'razors?', 'blades?'])], ['Trimmers & clippers', words(['trimmers?', 'clippers?'])], ['Beard care', words(['beard', 'moustache'])],
      ['Deodorant', words(['deodorants?', 'deo', 'anti-?perspirant', 'roll-?on'])], ['Hair removal', words(['epilators?', 'ipl', 'hair removal', 'wax strips?'])],
      ['Hair tools', words(['hair ?dryers?', 'hair ?straighteners?', 'curling (?:iron|wand|tongs)', 'hot brush', 'air ?styler'])],
      ['Hair care', words(['shampoos?', 'conditioners?', 'hair', 'pomade'])], ['Make-up', words(['lipsticks?', 'lip gloss', 'mascara', 'eyeliner', 'eyeshadow', 'eye shadow', 'palettes?', 'blush(?:er)?', 'bronzer', 'foundation', 'concealer', 'primer', 'highlighter', 'make-?up', 'lashes', 'eyebrow', 'brow'])],
      ['Nails', words(['nails?', 'manicure', 'pedicure'])], ['Bath & body', words(['shower', 'bath', 'soaps?', 'body', 'hand cream'])], ['Gift sets', words(['gift sets?', 'sets?'])],
      ['Skincare', /./]] },
  { key: 'shoes', mgw: 'shoes', wgw: 'shoes',
    include: words(['shoes?', 'trainers?', 'sneakers?', 'boots?', 'sandals?', 'slippers?', 'loafers?', 'brogues?', 'oxford (?:shoes?|brogues?)', 'derby (?:shoes?|boots?)', 'derbies', 'moccasins?', 'espadrilles?', 'flip[- ]?flops?', 'sliders? (?:sandals?|shoes?)', 'pool sliders?', 'slides',
      'mules?', 'clogs?', 'wellies', 'welly', 'wellingtons?', 'heels', 'stilettos?', 'court shoes?', 'pumps', 'ballet flats?', 'ballerinas?', 'mary janes?', 'plimsolls?', 'chelsea', 'chukkas?', 'deck shoes?', 'boat shoes?', 'footwear']),
    exclude: words(['shoe (?:polish|cream|care|trees?|brush|horn|bags?|rack|storage|cleaner|laces?)', 'boot (?:polish|cream|care|trees?|brush|bags?|rack|jack|dryer|socks?)', 'boot ?socks?', 'car boot', 'boot liner', 'boot organi[sz]er', 'slipper socks?', 'pump(?:s)? (?:air|bike|tyre|foot)', 'air pump', 'breast pump', 'water pump', 'sneaker (?:cleaner|protector)', 'trainer (?:cleaner|socks?)', 'shoe ?bags?', 'chelsea (?:fc|football)', 'brake shoes?', 'gas struts?', 'tailgate', 'boot (?:struts?|lid|mats?|liners?|tidy|organi[sz]ers?)', 'safety (?:boots?|shoes?|wellingtons?)', 'steel toe', 'toe ?cap', 's1p', 's3', 'sb p', 'work ?boots?', 'rigger boots?']),
    subs: [['Trainers', words(['trainers?', 'sneakers?', 'running shoes?', 'plimsolls?'])], ['Boots', words(['boots?', 'wellies', 'welly', 'wellingtons?', 'chelsea', 'chukkas?'])],
      ['Sandals', words(['sandals?', 'flip[- ]?flops?', 'pool sliders?', 'sliders? (?:sandals?|shoes?)', 'slides', 'espadrilles?', 'mules?', 'clogs?'])], ['Slippers', words(['slippers?', 'moccasins?'])], ['Shoes', /./]] },
  { key: 'bags', mgw: 'bags-accessories', wgw: 'bags-accessories',
    include: words(['bags?', 'backpacks?', 'rucksacks?', 'handbags?', 'totes?', 'clutch (?:bags?|purses?)', 'clutch(?:es)?$', 'satchels?', 'holdalls?', 'duffles?', 'duffels?', 'crossbody', 'cross-body', 'shoulder bags?', 'bum bags?', 'waist bags?', 'fanny packs?', 'briefcases?', 'messenger',
      'wallets?', 'purses?', 'card ?holders?', 'card cases?', 'coin pouch', 'money clips?', 'key ?rings?', 'keyrings?', 'key ?chains?', 'keychains?', 'key fobs?', 'bag charms?',
      'belts?', 'braces', 'suspenders', 'hats?', 'caps?', 'beanies?', 'berets?', 'fedoras?', 'trilby', 'flat caps?', 'baker boy', 'bucket hats?', 'snapbacks?', 'balaclavas?', 'headbands?', 'hair ?bands?', 'scrunchies?', 'hair clips?', 'hair ?slides?', 'hair accessories',
      'scarf', 'scarves', 'snoods?', 'shawls?', 'wraps?(?! dress)', 'stoles?', 'ponchos?', 'gloves?', 'mittens?', 'ear ?muffs?', 'neck ?warmers?',
      'sunglasses', 'sun glasses', 'glasses cases?', 'glasses sleeve', 'eyewear', 'umbrellas?', 'ties', 'tie', 'neck ?ties?', 'bow ties?', 'pocket squares?', 'handkerchief(?:s)?', 'hankies',
      'jewell?ery (?:box|boxes|case|cases|stand|organi[sz]er|roll|tray|dish)', 'trinket (?:box|dish)', 'valet (?:box|tray)', 'hip flasks?', 'fans?']),
    exclude: words(['bags? (?:for|of) (?:compost|soil|sand|cement|rubbish|waste)', 'bin bags?', 'freezer bags?', 'sandwich bags?', 'vacuum bags?', 'tea bags?', 'bean ?bags?', 'sleeping bags?', 'punch(?:ing)? bags?', 'golf bags?', 'tool ?bags?', 'camera bags?', 'laptop sleeves?',
      'caps? (?:valve|lens|tyre|petrol|fuel|end|bottle)', 'lens caps?', 'valve caps?', 'bottle caps?', 'hub ?caps?', 'gloves? (?:nitrile|latex|disposable|work|gardening|garden|welding|boxing|goalkeeper|cycling|golf)', '(?:nitrile|latex|disposable|work|gardening|garden|welding|boxing|goalkeeper|cycling|golf|oven|bbq) gloves?',
      'hard hats?', 'safety helmets?', 'cable ties?', 'zip ties?', 'transfer belts?', 'fan belts?', 'v-?belts?', '(?:test|filler|radiator|oil|end|dust|pressure|fuel) caps?', 'shredder bags?', 'leaf (?:collection )?bags?', 'collection bags?', 'riggers? gloves?', 'chrome palm', 'pins? for', 'fans? (?:heater|tower|desk|pedestal|ceiling|cooling)', '(?:desk|tower|pedestal|ceiling|electric|usb|cooling|neck|handheld) fans?', 'fan heaters?', 'belt (?:sander|drive|conveyor)', 'drive belts?', 'seat belts?', 'tool belts?', 'timing belts?', 'conveyor']),
    subs: [['Ties', words(['ties', 'tie', 'neck ?ties?', 'bow ties?'])], ['Hats', words(['hats?', 'caps?', 'beanies?', 'berets?', 'fedoras?', 'trilby', 'snapbacks?', 'balaclavas?'])], ['Belts', words(['belts?', 'braces', 'suspenders'])],
      ['Scarves', words(['scarf', 'scarves', 'snoods?', 'shawls?', 'wraps?', 'stoles?'])], ['Gloves', words(['gloves?', 'mittens?'])], ['Sunglasses', words(['sunglasses', 'sun glasses', 'eyewear'])],
      ['Wallets & Purses', words(['wallets?', 'purses?', 'card ?holders?', 'card cases?', 'money clips?', 'coin pouch'])], ['Bags', words(['bags?', 'backpacks?', 'rucksacks?', 'handbags?', 'totes?', 'clutch(?:es)?', 'satchels?', 'holdalls?', 'duffles?', 'duffels?', 'crossbody', 'cross-body', 'briefcases?', 'messenger'])],
      ['Accessories', /./]] },
  { key: 'clothing', mgw: 'clothing', wgw: 'clothing',
    include: words(['t-?shirts?', 'tees?', 'tops?', 'tank tops?', 'singlets?', 'vests?', 'polos?', 'polo shirts?', 'shirts?', 'blouses?', 'tunics?', 'jumpers?', 'sweaters?', 'pullovers?', 'cardigans?', 'knit(?:ted|wear)?', 'crew necks?', 'crewnecks?', 'roll necks?', 'turtle ?necks?',
      'hoodies?', 'hoody', 'sweatshirts?', 'sweats?', 'fleeces?', 'jackets?', 'coats?', 'parkas?', 'anoraks?', 'gilets?', 'bodywarmers?', 'body warmers?', 'blazers?', 'waistcoats?', 'overshirts?', 'shackets?', 'cagoules?', 'raincoats?', 'macs?', 'trench(?: coats?)?', 'puffers?', 'bombers?', 'windbreakers?',
      'trousers', 'pants?', 'chinos?', 'jeans', 'denims?', 'joggers?', 'sweatpants', 'track ?pants', 'cargos?', 'cords', 'corduroys?', 'slacks', 'fatigues?', 'shorts', 'leggings', 'jeggings', 'tights', 'skirts?', 'dress(?:es)?', 'shorts?(?! sleeves?)', 'crews?', 'hoods?', 'jumpsuits?', 'playsuits?', 'dungarees', 'overalls?', 'boiler ?suits?', 'coveralls?',
      'suits?', 'tuxedos?', 'tracksuits?', 'track tops?', 'socks?', 'underwear', 'boxers?', 'briefs', 'trunks', 'knickers', 'thongs?', 'bras?', 'bralettes?', 'lingerie', 'pyjamas?', 'pajamas?', 'pjs', 'nightwear', 'nightie', 'nightdress', 'dressing gowns?', 'robes?', 'loungewear', 'lounge pants',
      'bikinis?', 'swimsuits?', 'swim ?shorts', 'swimwear', 'tankini', 'kaftans?', 'kimonos?', 'camisoles?', 'cami', 'bodysuits?', 'culottes', 'activewear', 'sports bras?', 'base ?layers?', 'thermal (?:underwear|tops?|leggings|socks|vests?|base ?layers?)', 'smocks?', 'jerseys?', 'clothing', 'apparel', 'outfits?', 'onesies?']),
    exclude: words(['work ?tops?', 'top jig', 'thermal[- ]?(?:transfer|ribbons?|paper|labels?|printers?|cameras?|imaging|pads?|paste|compound)', 'ribbons?', 'hi-?vis', 'high visibility', 'coveralls? disposable', 'disposable', 'welding', 'chainsaw (?:trousers|jackets?)', 'knee pads?', 'tool vests?', 'dress(?:ing)? up', 'fancy dress', 'shirt (?:studs?|stays?|collar stays?)', 'dress (?:shirt )?studs?', 'tee ?shirt dress', 'golf tees?', 'tool ?kits?', 'repair kits?', 'first aid kits?', 'socket', 'suit(?:able|ed)? for', 'suits? (?:all|most)', 'wet ?suits?', 'dry ?suits?', 'bin', 'tops? (?:up|soil)', 'table ?tops?', 'worktops?', 'laptop', 'desktop', 'tops? (?:of|for) (?:the )?(?:range|bottle)', 'box ?tops?', 'tank (?:for|with)', 'coat (?:hooks?|hangers?|stands?|racks?)', 'coat ?hangers?', 'paint', 'varnish', 'top ?coat', 'base ?coat', 'undercoat', 'pants? (?:hangers?|press)', 'trouser press', 'sock (?:dryer|hangers?|organi[sz]er)', 'jersey sheets?']),
    subs: [['Suits', words(['suits?', 'tuxedos?', 'blazers?', 'waistcoats?'])], ['Jackets & Coats', words(['jackets?', 'coats?', 'parkas?', 'anoraks?', 'gilets?', 'bodywarmers?', 'body warmers?', 'cagoules?', 'raincoats?', 'macs?', 'trench', 'puffers?', 'bombers?', 'windbreakers?', 'overshirts?', 'shackets?'])],
      ['Dresses', words(['dress(?:es)?', 'jumpsuits?', 'playsuits?', 'kaftans?'])], ['Skirts', words(['skirts?'])], ['Jeans', words(['jeans', 'denims?'])],
      ['Shorts', words(['shorts?(?! sleeves?)', 'swim ?shorts'])], ['Leggings', words(['leggings', 'jeggings', 'tights'])],
      ['Trousers', words(['trousers', 'pants?', 'chinos?', 'joggers?', 'sweatpants', 'track ?pants', 'cargos?', 'cords', 'corduroys?', 'slacks', 'fatigues?', 'culottes', 'dungarees', 'overalls?'])],
      ['Tracksuits', words(['tracksuits?'])], ['Hoodies', words(['hoodies?', 'hoody', 'hoods?'])], ['Sweatshirts', words(['sweatshirts?', 'sweats?', 'crew ?necks?', 'crews?'])],
      ['Knitwear', words(['jumpers?', 'sweaters?', 'pullovers?', 'cardigans?', 'knit(?:ted|wear)?', 'roll necks?', 'turtle ?necks?'])], ['Fleece', words(['fleeces?'])],
      ['Socks', words(['socks?'])], ['Underwear', words(['underwear', 'boxers?', 'briefs', 'trunks', 'knickers', 'thongs?', 'bras?', 'bralettes?', 'lingerie'])],
      ['Nightwear', words(['pyjamas?', 'pajamas?', 'pjs', 'nightwear', 'nightie', 'nightdress', 'dressing gowns?', 'robes?', 'loungewear', 'lounge pants', 'onesies?'])],
      ['Swimwear', words(['bikinis?', 'swimsuits?', 'swimwear', 'tankini'])], ['Activewear', words(['activewear', 'sports bras?', 'base ?layers?', 'thermals?', 'leggings'])],
      ['T-Shirts', words(['t-?shirts?', 'tees?', 'polos?', 'polo shirts?', 'tank tops?', 'singlets?', 'vests?', 'camisoles?', 'cami', 'tops?'])], ['Shirts', words(['shirts?(?! dress)', 'blouses?', 'tunics?'])],
      ['Clothing', /./]] }
];

// Subcategory names that differ between the two sites (the names each site uses today).
const SUB_NAME = {
  mgw: { 'Jackets & Coats': 'Jackets', Dresses: 'Clothing', Skirts: 'Clothing', Leggings: 'Clothing', Activewear: 'Clothing', Swimwear: 'Clothing', Earrings: 'Jewellery', Rings: 'Jewellery', Bags: 'Bags' },
  wgw: { Shirts: 'Tops & Blouses', Tracksuits: 'Clothing', Fleece: 'Clothing', Cufflinks: 'Jewellery', Swimwear: 'Clothing', 'Trimmers & clippers': 'Hair removal', 'Beard care': 'Skincare', Shaving: 'Hair removal', Deodorant: 'Bath & body' }
};

export const CATEGORY_NAMES = {
  mgw: { clothing: 'Clothing', watches: 'Watches', jewellery: "Men's Jewellery", shoes: 'Shoes', 'everyday-carry': 'Everyday Carry / EDC', 'bags-accessories': 'Bags & Accessories', 'grooming-fragrances': 'Grooming & Fragrances' },
  wgw: { clothing: 'Clothing', watches: 'Watches', jewellery: "Women's Jewellery", shoes: 'Shoes', 'everyday-essentials': 'Everyday Carry / EDC', 'bags-accessories': 'Bags & Accessories', 'beauty-fragrances': 'Beauty & Fragrances' }
};

// Who a product is for: 'men', 'women', 'both' (unisex, nobody named) or 'kids'.
export function audience(name, feedCategory = '', source = null) {
  const n = String(name || '');
  if (KIDS.test(n) && !/\b(?:boyfriend|girlfriend|baby ?(?:pink|blue)|kid (?:leather|gloves?|suede)|baker boy|bad boy|toy boy|boy ?london|golden girl|good girl|girl of now|baby blades)\b/i.test(n) && !WOMEN.test(n.replace(KIDS, ' ')) && !MEN.test(n.replace(KIDS, ' '))) return 'kids';
  if (source && (source.audience === 'men' || source.audience === 'women')) return source.audience;
  if (UNISEX.test(n)) return 'both';
  const m = MEN.test(n), w = WOMEN.test(n);
  if (m && !w) return 'men';
  if (w && !m) return 'women';
  if (m && w) return 'both';
  const wi = WOMEN_ITEMS.test(n), mi = MEN_ITEMS.test(n) || MEN_LINES.test(n);
  if (wi && !mi) return 'women';
  if (mi && !wi) return 'men';
  // The shop's section, only for a shop that files men and women apart ("genderSections", sources.json).
  if (!source || source.genderSections !== false) {
    const f = String(feedCategory || '');
    const fm = MEN_FEED.test(f), fw = WOMEN_FEED.test(f);
    if (fm && !fw) return 'men';
    if (fw && !fm) return 'women';
  }
  return 'both';
}

// The last place in a text where a pattern matches (-1: nowhere). The product type is usually the last noun before the
// details: "Work Socks for Steel Toe Boots" are socks, "Oxford Shirt" is a shirt, "Watch Cufflinks" are cufflinks.
export function lastAt(re, text) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let at = -1, m;
  // Overlapping matches count too ("Stick Vacuum Cleaner": "stick vacuum" and "vacuum cleaner"), so the search goes on one
  // character after the start of each match and keeps the furthest end.
  while ((m = g.exec(text))) { at = Math.max(at, m.index + m[0].length); g.lastIndex = m.index + 1; }
  return at;
}
// The part of a name that says what it is: before " for ", " with ", " - ", " | ", " – ", "(" or a comma.
export function headOf(name) {
  const n = String(name || '');
  const cut = n.search(/\s+(?:for|with|that|featuring|incl\.?|including)\s+|\s+w\/\s*|\s[-–|]\s|\(|,|:/i);
  return (cut > 3 ? n.slice(0, cut) : n).trim();
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

export function makeRules(site) {
  if (site !== 'mgw' && site !== 'wgw') throw new Error(`fashion rules: unknown site ${site}`);
  const mine = site === 'mgw' ? 'men' : 'women';
  const other = site === 'mgw' ? 'Women\'s Gear World' : 'Men\'s Gear World';
  const slugs = Object.keys(CATEGORY_NAMES[site]);
  function classify(name, feedCategory = '', paths = '', source = null) {
    const n = String(name || '');
    if (HARD_DENY.test(n)) return { ok: false, reason: 'gift card or voucher' };
    const head = headOf(n);
    // 1. The head of the name, 2. the whole name, 3. the shop's own section ("Watches", "Men's Jewellery"),
    // 4. the shop's usual category (sources.json "defaultCategory": Stan Ray names only the model, "Wide 5 (Washed Black)").
    let hit = bestRule(head), where = head, from = 'name';
    if (!hit) { hit = bestRule(n); where = n; }
    if (!hit) {
      // The shop's whole section path ("Health & Beauty > Personal Care > Cosmetics > Makeup"), unless its sections are
      // unreliable (sources.json "sectionHints": false).
      // A list ("sectionHints": ["Health & Beauty"]) trusts only those top sections (Joybuy's beauty sections are right,
      // its fashion sections are not: suitcases under "Shoelaces", plan of 22 Oct 2026 on VGW).
      const hints = source ? source.sectionHints : true;
      const top = String(feedCategory || '').split('>')[0].trim().toLowerCase();
      const trusted = hints !== false && (!Array.isArray(hints) || hints.some(h => String(h).toLowerCase() === top));
      if (trusted) hit = bestRule(String(feedCategory || '').replace(MEN_FEED, ' ').replace(WOMEN_FEED, ' '));
      from = 'section';
      if (!hit && source && source.defaultCategory) { const r = RULES.find(x => x.key === source.defaultCategory); if (r) { hit = { rule: r, at: n.length }; from = 'shop'; } }
    }
    for (const d of DENY) {
      if (d.anywhere && d.anywhere.test(n)) return { ok: false, reason: d.label };
      if (from === 'shop') continue;
      // Placed by its name: a word of another kind of product AFTER the product type ("Pocket Watch Labrador Dogs" stays,
      // "Watch Box" is a box). Placed by the shop's section only: any such word in the name leaves it out.
      if (from === 'section' || !hit ? d.re.test(n) : lastAt(d.re, where) > hit.at) return { ok: false, reason: d.label };
    }
    if (!hit) return { ok: false, reason: 'not fashion, beauty, watches, jewellery or everyday carry' };
    const rule = hit.rule;
    const who = audience(n, `${feedCategory || ''} | ${paths || ''}`, source);
    if (who === 'kids') return { ok: false, reason: "children's product (Kids' Gear World)" };
    if (who !== 'both' && who !== mine) return { ok: false, reason: `for ${who} (${other})` };
    // Unisex: both sites, except where one site is the natural home.
    if (who === 'both') {
      if (site === 'mgw' && (rule.key === 'grooming' || rule.key === 'fragrance') && !MEN_ITEMS.test(n) && !UNISEX.test(n)) return { ok: false, reason: 'beauty or perfume with no men\'s word (Women\'s Gear World)' };
      if (site === 'mgw' && rule.key === 'jewellery' && WOMEN_ITEMS.test(n)) return { ok: false, reason: 'jewellery for women (Women\'s Gear World)' };
      if (site === 'mgw' && rule.key === 'jewellery' && !MEN_ITEMS.test(n) && !UNISEX.test(n) && !(source && source.menJewellery)) return { ok: false, reason: 'jewellery with no men\'s word (Women\'s Gear World)' };
      if (site === 'wgw' && rule.key === 'jewellery' && MEN_ITEMS.test(n) && !UNISEX.test(n)) return { ok: false, reason: 'men\'s jewellery (Men\'s Gear World)' };
    }
    const slug = rule[site];
    // The subcategory: the one whose words come last in the head ("Tuxedo Blouse" is a blouse), else in the whole name,
    // else the rule's catch-all, else the category itself.
    const pickSub = text => {
      let best = null, at = -1;
      for (const [label, re] of rule.subs) { if (re.source === '.') continue; const i = lastAt(re, text); if (i > at) { best = label; at = i; } }
      return best;
    };
    const subName = pickSub(head) || pickSub(n) || (rule.subs.find(([, re]) => re.source === '.') || [])[0];
    const sub = subName ? (SUB_NAME[site][subName] || subName) : CATEGORY_NAMES[site][slug];
    return { ok: true, slug, subcategory: sub, category: CATEGORY_NAMES[site][slug], audience: who };
  }
  return { classify, CATEGORY_SLUGS: slugs };
}

// Feed names: promotions in front and a size at the end go (one card per product, at its lowest price).
export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\])\s*/g, '')
    .replace(/\s*\|\s*(?:size:?\s*)?(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|\d{1,2}(?:\.5)?|one size|os)\s*(?=\||$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Minimum quality for any product to be imported (L14). Prices in pounds, or euros for a shop the site already shows in euros
// (100% PURE on WGW; a new shop outside the UK is not offered by the Hub, lessons L79).
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 2,
  maxPrice: 20000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};
