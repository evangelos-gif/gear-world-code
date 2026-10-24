// Technology Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by the import tool):
//   1. The feed's top category (the part before the first ">") is checked first:
//      DENY_TOP rejects whole areas (food, clothing, beauty, vehicles, tools ...);
//      ONLY_TOP lets some areas in only for one category (e.g. "Toys & Games" only for gaming).
//   2. DENY rules are checked on the PRODUCT NAME only (not the feed category, which can be wrong:
//      Joybuy files smartwatches under "Electronics > Computers > Smart Glasses").
//   3. Then the FIRST rule whose `include` matches (name + feed categories) and whose `exclude` does not
//      match wins. Several rules can lead to the same category. Order matters.
//   4. No match: rejected as "not tech" (shown separately when the feed itself says Electronics,
//      so missing rules are easy to spot in the report).
// Tuned on the real Joybuy UK feed (dry-run report of 18 Oct 2026).

const words = list => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

// Top-level feed categories that never belong on TGW.
export const DENY_TOP = [
  'Health & Beauty', 'Food, Beverages & Tobacco', 'Apparel & Accessories', 'Vehicles & Parts', 'Furniture',
  'Animals & Pet Supplies', 'Hardware', 'Baby & Toddler', 'Luggage & Bags', 'Mature', 'Religious & Ceremonial',
  'Arts & Entertainment', 'Business & Industrial'
];

// Top-level feed categories that may only feed ONE TGW category (anything else from them is rejected).
export const ONLY_TOP = {
  'Toys & Games': ['gaming'],
  'Home & Garden': ['smart-home-wifi'],
  'Office Supplies': ['laptops-computing'],
  // e.g. a rowing machine "with LCD monitor" must not become a computer monitor
  'Sporting Goods': ['phones-smartwatches', 'audio', 'cameras-drones', 'accessories-storage']
};

// `except`: names that look like the word list but are tech (Back to the Office dry run, 23 Oct 2026): "ARCTIC Freezer 36
// ... Tower CPU Cooler" is a PC part, not a freezer; "ASUS Fragrance MD101 mouse" is a mouse.
export const DENY = [
  { label: 'woodworking or power tool', re: words(['wood router', 'plunge router', 'trim router', 'palm router', 'router bits?', 'router table', 'drill bits?', 'jigsaw', 'circular saw', 'angle grinder', 'sander', 'planer', 'chisel', 'welding', 'welder', 'impact driver', 'combi drill', 'drill driver', 'screwdrivers?']) },
  { label: 'vehicle part', re: words(['brake pads?', 'brake discs?', 'wiper blades?', 'windscreen wipers?', 'spark plugs?', 'tyres?', 'tire inflator', 'alloy wheels?', 'oil filter', 'headlight bulbs?', 'car seat covers?', 'car covers?', 'tow bar', 'roof rack', 'jump starter', 'motorcycle helmet']) },
  { label: 'clothing or beauty', re: words(['t-shirt', 'hoodie', 'dress', 'jacket', 'trousers', 'leggings', 'socks', 'shoes', 'trainers', 'lingerie', 'perfume', 'fragrance', 'lipstick', 'mascara', 'nail polish', 'wig', 'hair extensions?']),
    except: words(['mouse', 'mice', 'keyboards?']) },
  { label: 'personal care', re: words(['shavers?', 'epilators?', 'toothbrush(?:es)?', 'water flossers?', 'hair dryers?', 'straighteners?', 'massagers?']) },
  { label: 'not allowed', re: words(['vape', 'e-?cig(?:arette)?s?', 'airsoft', 'knife', 'knives', 'crossbow', 'erotic', 'spy camera', 'hidden camera']) },
  { label: 'sunglasses (not tech)', re: words(['sunglasses', 'cycling glasses']) },
  { label: 'home appliance (Home Gear World)', re: words(['robot vacuums?', 'robot hoovers?', 'vacuum cleaners?', 'stick vacuum', 'fridge', 'freezer', 'kettle', 'toaster', 'air fryer', 'microwave', 'dehumidifier', 'heater', 'pedestal fan', 'tower fan', 'tumble dryers?', 'washing machines?', 'washer dryers?', 'dishwashers?', 'ovens?', 'hobs?', 'cooker hoods?', 'air conditioners?', 'ice makers?']),
    // "ARCTIC Freezer P12 Pro - 120 mm PWM Fan" (second dry run, 24 Oct 2026) is a PC fan too.
    except: words(['cpu', 'pwm', 'a-?rgb']) },
  { label: 'spare part or service', re: words(['replacement part', 'spare part', 'repair kit', 'warranty extension', 'service plan', 'gift card', 'voucher']) },
  { label: 'consumable, not a gadget', re: words(['a{2,4} batteries', '(?:alkaline|lithium|rechargeable) batteries', 'batteries - (?:pack|value pack)', 'copier paper', 'printer paper', 'label paper', 'thermal paper', 'cleaning brush']) },
  { label: 'toy, not a gadget', re: words(['toy drones?', 'stunt (?:\\w+ )?drones?', 'kids drones?', 'jigsaw puzzles?', 'piggy bank', 'ride on car', 'ball machine']) },
  // Fourth dry run (24 Oct 2026): "HP 125 Wired Mouse (Bulk120)" is 120 mice for a business, at 484.23.
  // "Urban Armor Gear ... Metropolis SE, BULK 33 cm (13\") Cover" (fifth dry run) is one cover: a size is not a quantity.
  // Sixth check (live site, 24 Oct 2026): "DELL 14-16 EcoLoop Briefcase - CC3624 (Pack 10 pcs)" is ten bags.
  { label: 'trade pack (bulk quantity)', re: words(['bulk ?\\d{2,}(?! ?(?:cm|mm|in\\b|inch|"))', 'pack \\d{2,} ?pcs']) },
  { label: 'not for UK buyers (plug or keyboard layout)', re: notForUk() }
];

// TGW is a UK site (fourth dry run, 24 Oct 2026): a charger, adapter or dock with a European, US or other plug ("Sandberg
// USB-C AC Charger PD20W EU", "DELL 65W USB-C AC Adapter with SA Plug"), a keyboard with another country's layout ("CHERRY
// ... USB ES keyboard", "Apple Magic Keyboard ... (MXCK3PO/A)": Apple's UK code ends in B/A) and a laptop set up for another
// country (HP "#ABD" German, Lenovo "21KH00G4GE") do not work the way a UK buyer expects. A UK plug, or a plug used in the UK
// too ("SA/KW/AE/SG/MY/HK" sockets are the UK type), stays.
function notForUk() {
  const other = 'spanish|italian|portuguese|nordic|pan nordic|danish|swedish|norwegian|finnish|dutch|turkish|greek|russian|arabic|hebrew|czech|polish|hungarian|swiss|belgian|german|french|slovenian|croatian|romanian|bulgarian|ukrainian|lithuanian|latvian|estonian|slovak|icelandic';
  return new RegExp([
    // a plug for another country, unless a UK plug comes with it ("Lenovo ... AC Adapter with UK Plug", "UK/EU plugs")
    '^(?!.*\\buk\\b)(?:.*\\b(?:eu|euro|us|usa|sa|au|aus|swiss|ch|dk|jp|kr|br|cn|za|il) ?plugs?\\b|.*\\bwith (?:eu|euro|us|usa|sa|au|aus|swiss|ch|dk|jp|kr|br|cn|za|il)\\b|.*\\bschuko\\b|(?=.*\\b(?:eu|euro)\\b)(?=.*\\b(?:chargers?|adapters?|power|plugs?|cords?|psu|supply|docks?|docking)\\b))',
    // a keyboard with another country's layout: the live site had "Apple Magic Keyboard QWERTZ German", "... for iPad Air
    // 13-inch (M3) - French - Black", "CHERRY KC 6000 Slim keyboard Universal USB US English", "DELL Pro Keyboard - KB700 - US
    // International (QWERTY)" next to the UK ones. A plain "English" layout (international) stays.
    `^(?!.*\\buk\\b)(?=.*\\bkeyboards?\\b)(?=.*(?:\\b(?:qwertz|azerty|${other})\\b|\\bqwerty (?:us|international)\\b|\\bus (?:english|international|layout)\\b|\\(us\\)|\\b(?:es|de|fr|it|pt|nl|be|dk|se|no|fi|cz|pl|hu|gr|ru|tr|us) (?:keyboard|layout)\\b|\\bkeyboards?\\b.{0,40}\\bus\\s*$))`,
    // Apple's country code (UK: B/A; fifth dry run: "MXCK3MG/A" is Hungarian) on a keyboard, a Mac or a power adapter; an iPhone,
    // a MagSafe charger or a cable adapter is the same everywhere
    '^(?=.*\\b(?:keyboards?|macbook|imac|mac mini|mac studio|power adapters?)\\b)(?=.*\\b[a-z0-9]{5}(?:[ac-z]|[a-z]{2})/a\\b)',
    // HP and Lenovo computers and printers set up for another country (UK: HP "#ABU", Lenovo "...UK"); a mouse is the same everywhere
    '^(?=.*\\b(?:laptops?|notebooks?|chromebooks?|elitebook|probook|zbook|pavilion|envy|spectre|omen|victus|dragonfly|thinkpad|thinkbook|ideapad|yoga|legion|loq|desktops?|all-in-one|keyboards?|printers?|laserjet|officejet|deskjet|chargers?|power)\\b)(?:.*#(?:aba|abb|abd|abe|abf|abh|abz|ab9|uug|uuz|b19)\\b|.*\\b(?:20|21|82|83)[a-z0-9]{6}(?:ge|fr|sp|ix|mx|pb|mh|us|ck|pg|mz|iv|sa)\\b)',
    // Sixth check (live site, 24 Oct 2026): an HP computer or keyboard with any country code but the UK's "#ABU" ("HP 320K ...
    // keyboard (9SR37UT#AC0)" is Belgian, "HP Pro Mini 400 G9 ... (C7FX1ET#ABD)" German, "HP ProDesk 4 Mini ... (B6ZA0ET#UUW)").
    // A printer's code is not a keyboard layout (UK shops sell "#BHC" printers), so printers keep the list above; a monitor,
    // a mouse or memory is the same everywhere.
    '^(?!.*\\b(?:printers?|printing|ink|toner|scanners?|laserjet|officejet|deskjet|smart tank)\\b)(?=.*\\b(?:laptops?|notebooks?|chromebooks?|elitebook|probook|zbook|pavilion|envy|spectre|omen|victus|dragonfly|omnibook|desktops?|all-in-one|keyboards?|prodesk|elitedesk|eliteone|proone|(?:pro|elite) (?:mini|tower|sff)|mini pc|workstations?|zgx|ai station)\\b).*#(?!abu\\b)[a-z0-9]{3}\\b'
  ].join('|'));
}

// Several rules can lead to the same category; the first match wins. Accessories come first so
// "iPhone 15 case" is an accessory, and storage comes last so "laptop 512GB SSD" stays a laptop.
export const RULES = [
  {
    slug: 'accessories-storage',
    include: words([
      '(?:iphone|phone|galaxy|pixel|ipad|tablet|kindle|airpods|earbuds|watch|camera|laptop|macbook|switch)\\b[\\w\\s/()-]{0,40}?\\b(?:case|cover|folio|sleeve|skin|protector)s?',
      'chargers?', 'charging (?:cable|station|dock|pad|stand|holder)s?', 'wireless charg(?:er|ing)', 'fast charg(?:er|ing)', 'magsafe',
      'power ?banks?', 'usb-?c (?:cable|hub|adapter|charger)s?', 'lightning cables?', 'hdmi cables?', 'cables?',
      'phone cases?', 'tablet cases?', 'ipad cases?', 'screen protectors?', 'lens protectors?', 'camera protectors?', 'tempered glass',
      'phone (?:holder|mount|stand|grip|pouch|bag)s?', 'laptop (?:bag|sleeve|stand|riser)s?', 'usb hubs?', 'docking stations?',
      // After the second import (24 Oct 2026, lessons L51): "Targus Privacy Screen 22\"W (16:10)", "Fellowes PrivaScreen 35.6 cm (14\")
      // Laptop Frameless display privacy filter" and "Fellowes Office Suites Laptop Riser" are accessories.
      'privacy (?:screens?|filters?)', 'privascreen',
      '(?:watch|sport|silicone|nylon|leather|milanese|loop|solo) (?:bands?|straps?)', 'watch straps?', 'replacement bands?',
      'phone cool(?:er|ing)', 'cooling fan for (?:phone|mobile|live streaming)', 'live streaming cooler',
      'phone lanyards?', 'lanyards?', 'apple pencil', 'stylus(?:es)?', 'i?watch (?:bands?|straps?)', 'airtags?', 'anti-lost', 'find my',
      // PCHUB.UK (24 Oct 2026): "Apple MQEH3ZM/A Smart Wearable Accessories Band" in "smartwatch accessories" is a band, not a
      // watch; "DELL EURO Simple E-Port II Docking" in "Docks & Port Replicators" is a dock (a games console dock stays gaming).
      'smartwatch accessories', 'smart wearable accessories', 'docking', 'port replicators?',
      // TGW dry run with PCHUB.UK (24 Oct 2026): "Belkin F7U017bt Passive holder Mobile phone/Smartphone", "Kensington Car Mount
      // for Smartphones", "Belkin Boost Charge Smartphone Black Cigar lighter Auto", "InvisibleShield Glass Elite Apple iPhone 17e"
      // are phone accessories, not phones.
      '(?:active|passive) holders?', '(?:car|phone|smartphone|mobile) (?:mounts?|holders?)', 'mounts? for (?:smart)?phones?', 'cigar lighter', 'car chargers?',
      'invisibleshield', 'glass elite', 'screen ?guards?',
      // Third dry run (24 Oct 2026): 153 cases from PCHUB's "Mobile & Accessories>Cases & Covers" folder were on the phones page,
      // because their names do not say "case" ("Speck Presidio Perfect Clear + MS Apple iPhone 14 Plus/15 Plus Clear"), and
      // "Verbatim FWC-01 Active holder Mobile phone/Smartphone Black" too. The folder decides.
      'cases & covers',
      // Fourth dry run: Back to the Office names "ZAGG Cases Luxe Snap Apple iPhone 16 Plus Black" and "dbramante1928 Lynge MS ICON -
      // iPhone 18 Pro/iPhone 17 Pro" (one folder for everything): the word "case" comes first, or only the maker says it is a case.
      '(?:case|cover|folio)s? (?:[\\w-]+ ){0,4}(?:for )?(?:apple )?(?:iphone|galaxy|pixel|ipad)',
      'zagg', 'dbramante1928', 'otterbox', 'spigen', 'tech21', 'speck', 'uag', 'urban armor gear', 'case-mate', 'incipio', 'casetify', 'panzerglass', 'popsockets',
      // Mounts and arms (PCHUB.UK, owner 24 Oct 2026: as many as possible): "Arlo Ceiling Adapter Floodlight Mount",
      // "Fellowes Computer Monitor Stand", "ARCTIC Z1 Basic - Desk Mount Monitor Arm". A TV wall mount stays with the TVs.
      'monitor (?:wall )?(?:mounts?|arms?|stands?|risers?|brackets?)', '(?:desk|ceiling|camera|floodlight|pole|vesa|projector) (?:mounts?|brackets?)',
      '(?:helmet|chest|head|handlebar|suction cup|tripod) (?:[\\w+-]+ ){0,3}mounts?',
      // Sixth check (live site, 24 Oct 2026): 65 laptop bags were on the laptops page ("HP Everyday 16-inch Laptop Backpack",
      // "Targus TAR300 laptop case 39.6 cm (15.6\") Briefcase Black", "DELL Pro Briefcase 15"). A bag counts when its name says
      // what it carries (a size, a laptop, a tablet) or its maker makes computer bags (not "computer": Back to the Office files
      // every product under "Computers"), and a laptop sold with a bag ("... Intel Core i5 ... + Backpack") stays a laptop.
      '^(?!.*\\b(?:intel|ryzen|snapdragon|windows 1[01]|chromeos|\\d+ ?gb (?:ram|ssd|memory)|\\d+ ?tb ssd)\\b)(?=.*(?:\\b(?:laptops?|notebooks?|macbook|ultrabook|chromebook|tablets?|ipad|targus|tucano|thule|case logic|kensington|dell|hp|lenovo|acer|asus|samsonite|wenger|mobilis|everki|incase|hyperx|razer)\\b|\\d(?:["”]|-inch| ?inch\\b))).*\\b(?:backpacks?|rucksacks?|briefcases?|messenger (?:bags?|cases?)|sleeve cases?|toploaders?|top loaders?|totes?)'
    ]),
    // Watch listings say "Aluminium Case with Sport Band" and "GPS": those are watches, not accessories. "Apple Studio Display -
    // Nano-texture glass - VESA mount adapter" is the monitor (sixth check), not a mount.
    exclude: words(['ev charger', 'car battery charger', 'trickle charger', 'pencil case', 'suitcase', 'smart tv', 'televisions?', 'gps', '(?:aluminium|aluminum|titanium|stainless steel) case', 'bicycle parts', '(?:brake|gear) cables?',
      'pwm', 'apple (?:studio|pro) display(?: xdr)?(?= -)'])
  },
  {
    slug: 'gaming',
    // "switch 2" is the Nintendo Switch 2, not a "Smart Light Switch 2-Gang".
    include: words([
      'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch 2(?!-)', 'switch oled', 'steam deck', 'video games?',
      'gaming (?:headset|keyboard|mouse|mice|chair|desk|monitor|controller|pc|laptop|console)s?', 'game ?pads?', 'game controllers?',
      'controllers?', 'joysticks?', 'racing wheel', 'vr headset', 'meta quest',
      // Gaming monitors named without "monitor" (fourth dry run): "LG UltraGear 39GX950B evo GX9 39" OLED 5K2K 165Hz", "ASUS 26.5
      // OLED MON ROG SWIFT PG27UCDM" were on the TV page because of "OLED".
      'ultragear', 'rog swift', 'odyssey (?:g\\d+|oled|neo|ark)',
      // Fifth dry run: "Acer Predator X27U F5 27 QD-OLED Quad HD 500 Hz" was on the TV page. 170 Hz and faster is a gaming screen
      // (TVs stop at 144-165 Hz); a speaker's "50-2000Hz" is not a screen.
      '(?=.*\\b(?:qd-oled|oled|ips|va|qhd|uhd|fhd|wqhd|quad hd|full hd|curved|monitors?)\\b).*\\b(?:1[7-9]\\d|[2-9]\\d\\d|[1-9]\\d{3}) ?hz',
      // Sixth check (live site, 24 Oct 2026): "Lenovo Legion Go S 8ARP1 portable game console ... Wi-Fi" was on the Wi-Fi page.
      'game consoles?', '(?:portable|handheld) (?:game |gaming )?consoles?', 'legion go', 'rog ally', 'msi claw'
    ]),
    // A network "gateway/controller ... Mbit/s" (PCHUB.UK "Networking>Routers & Accessories>Controllers") is not a game controller,
    // nor is "Antec ARGB & PWM FAN CONTROLLER fan speed controller".
    exclude: words(['board game', 'card game', 'jigsaw puzzle', 'smart tv', 'televisions?', 'google tv', 'oled tv', 'qled', '\\d{2}["”] (?:bravia|4k)',
      'gateways?', 'mbit/s', '(?:fan|argb|rgb|led|lighting|pwm|midi|dj) (?:speed )?controllers?'])
  },
  {
    slug: 'smart-home-wifi',
    include: words(['smart [\\w\\s-]{0,20}?(?:lights?|strips?|bulbs?|plugs?|keyfobs?|locks?)'])
  },
  {
    slug: 'phones-smartwatches',
    include: words([
      'smartphones?', 'mobile phones?', 'iphone', 'galaxy [asz]\\d+', 'galaxy z (?:fold|flip)', 'pixel \\d+', 'oneplus', 'redmi note', 'xiaomi \\d+',
      'honor (?:magic|\\d+)', 'motorola (?:edge|g\\d+|razr)', 'oppo (?:a\\d+\\w*|find|reno)', 'nokia \\d+', 'nubia', 'sim[- ]free', 'dual sim',
      'smartwatch(?:es)?', 'smart watch(?:es)?', 'fitness trackers?', 'activity trackers?', 'apple watch', 'galaxy watch', 'pixel watch',
      'huawei watch', 'watch gt', 'watch fit', 'fitbit', 'garmin (?:forerunner|venu|fenix|vivoactive|instinct)', 'amazfit', 'smart rings?',
      // Joybuy files smartwatches under "Smart Glasses"; real smart glasses (AR/XR, display) are wearables too
      'smart glasses', 'ai glasses', 'ar glasses', 'xr glasses', 'ar/xr glasses'
    ]),
    // "DJI OM 5 Smartphone camera stabilizer" is a gimbal (cameras), not a phone. Fourth dry run: "Fujifilm Instax Mini Link 3
    // Wireless Smartphone Photo Printer", "Hama FlexPro tripod Smartphone/Action camera" and "OnePlus Nord Buds 2 ... Wireless
    // Earphones" are not phones either.
    exclude: words(['kids toy watch', 'tablets?', 'stabili[sz]ers?', 'gimbals?', 'printers?', 'tripods?', 'earbuds?', 'earphones?', 'headphones?', 'headsets?', 'buds\\d*',
      '(?:oneplus|xiaomi|redmi|oppo|honor|realme|nothing) pad', 'tab [a-z]{0,2}\\d+', 'matepad'])
  },
  {
    slug: 'laptops-computing',
    include: words([
      'laptops?', 'notebook (?:pc|computer)', '\\d+(?:\\.\\d)?["”]? (?:full hd |fhd |hd )?(?:\\(\\d+ x \\d+\\) )?notebook', 'ryzen', 'intel core', 'core i[3579]', 'macbook', 'chromebook', 'ultrabook', 'desktop pc', 'gaming pc', 'mini pc', 'all-in-one pc', 'imac', 'mac mini',
      'tablets?', 'ipad', 'galaxy tab', 'e-?readers?', 'kindle', 'monitors?', 'keyboards?', 'computer mouse', 'wireless mouse', 'mouse',
      'webcams?', 'graphics cards?', 'motherboards?', 'processors?', 'ddr[45] ram', 'pc cases?', 'mice',
      'psu', 'power supply unit', 'cpu[- ](?:water |air |liquid )?coolers?', 'liquid coolers?', 'aio', '(?:case|pc) fans?', 'cooler master',
      // PC parts named without those words (Back to the Office, 23 Oct 2026): "ARCTIC P12 - Pressure-optimised 120 mm Fan",
      // "ARCTIC MX-4 ... Thermal Paste", "ASUS DRW-24D5MT optical disc drive", "Kingston ... ValueRAM memory module ... DDR4".
      '\\d{2,3} ?mm (?:[\\w-]+ ){0,3}fans?', 'thermal paste', 'thermal compound', 'optical (?:disc )?drives?', 'memory modules?', 'ddr[345]',
      // Second dry run: "NVIDIA GeForce GT 730", "ASUS TUF Gaming B550-PLUS AMD B550 Socket AM4 ATX", "Logitech Wireless Combo MK270".
      'geforce', 'radeon', 'socket am[345]', 'lga ?1[1-9]\\d\\d', 'wireless combo', 'keyboard and mouse',
      // PC cases named by their size (PCHUB.UK): "Fractal Design Core 1100 Mini Tower Black", "Corsair 4000D Airflow Midi Tower".
      '(?:mini|midi|mid|full|micro|super)[- ]?tower', 'computer cases?',
      'printers?', 'ink cartridges?', 'ink (?:bottles?|tanks?|refills?)', 'toner', 'scanners?', 'label (?:printer|maker)s?', 'laminators?', 'shredders?', '3d printers?', 'calculators?',
      'fan (?:speed )?controllers?',
      // Fifth dry run: "Lenovo Tab K9 ... Wi-Fi 5" was on the Wi-Fi page and "MSI Prestige N16 Flip AI+ ... 32GB RAM 1TB SSD" with the
      // storage: tablets named "Tab"/"Pad" and computers named by their memory and disk are computing.
      'tab [a-z]{0,2}\\d+', 'matepad', '(?:oneplus|xiaomi|redmi|oppo|honor|realme|nothing) pad', 'fire (?:hd|max) \\d+',
      '\\d+ ?gb (?:ram|memory)\\b[^|]{0,30}?\\b\\d+ ?(?:gb|tb) (?:ssd|hdd|emmc|storage)',
      // Sixth check (live site, 24 Oct 2026): computers and printers whose name says "Wi-Fi" but not what they are were on the
      // Wi-Fi page ("Microsoft Surface Pro 11 Copilot+ PC Snapdragon ... Wi-Fi 7", "Canon PIXMA G3570 Inkjet A4 4800 x 1200 DPI
      // Wi-Fi", "TCL NXTPAPER 11 Plus ... Wi-Fi 5 ... Android 15", "ASUS PRO WS TRX50-SAGE WIFI ... Socket sTR5"), and Apple's
      // monitor "Apple Studio Display - Nano-texture glass - VESA mount adapter" was with the accessories.
      'surface (?:pro|laptop|go|book|studio)', 'copilot\\+? pc', 'nxtpaper', '\\d+ x \\d+ dpi', 'socket (?:s?tr\\d|swrx\\d|lga ?\\d{3,4})',
      'apple (?:studio|pro) display(?: xdr)?(?= -)'
    ]),
    // "Neomounts by Newstar Select tv wall mount" is in PCHUB's "Monitor & TV's" folder: a TV mount, not a monitor. Fourth dry run:
    // "Canon EOS R50 Camera inc RF-S 18-45mm Lens. CP1500 Printer" is a camera kit, an Instax printer goes with the Instax
    // cameras, and "DELL Laptop 7.4v 4500mAh" is a laptop battery.
    exclude: words(['tv (?:wall )?(?:mount|bracket)s?', 'television (?:mount|bracket)s?', 'flat (?:screen|panel) (?:wall )?(?:mount|bracket)s?', 'baby monitor', 'heart rate monitor', 'blood pressure monitor', 'piano keyboard', 'musical keyboard', 'mouse trap', 'mouse mat', 'vitamins?', 'multivitamins?', 'tablets? \\d+ ?mg', 'dishwasher tablets?', 'notebook paper', 'spiral notebook', 'fountain pens?',
      'instax', 'eos', 'mirrorless', '\\d+(?:\\.\\d+)? ?v \\d{3,5} ?mah', 'laptop batter(?:y|ies)',
      // a NAS ("Ugreen DH4300 Plus 8GB RAM 4 Bays SATA Desktop NAS", "Synology DS725neo+ 2 bay ... with Ryzen") goes with the storage
      'nas', '\\d+[- ]?bays?'])
  },
  {
    slug: 'audio',
    include: words([
      'headphones?', 'headsets?', 'earbuds?', 'earphones?', 'airpods', 'buds', 'in-ear', 'over-ear', 'open-ear', 'bone conduction',
      'bluetooth speakers?', 'wireless speakers?', 'portable speakers?', 'speakers?', 'soundbars?', 'subwoofers?', 'hi-?fi', 'turntables?',
      'record players?', 'amplifiers?', 'dab radios?', 'microphones?', 'lavalier', 'voice recorders?', 'dictaphones?', 'audio receivers?',
      'home theat(?:er|re)', '\\d+(?:\\.\\d+){1,2} channels?'
    ]),
    exclude: words(['ear defenders?', 'hearing protection', 'speaker cable', 'smart speaker', 'televisions?', 'smart tvs?'])
  },
  {
    slug: 'tv-home-cinema',
    include: words([
      'televisions?', 'smart tvs?', 'tv', 'oled', 'qled', 'qned', 'mini led', 'projectors?', 'projector screens?', 'streaming (?:stick|device|box)s?',
      'fire tv', 'roku', 'chromecast', 'apple tv', 'tv wall (?:mount|bracket)s?', 'tv (?:mount|bracket)s?', 'television (?:mount|bracket)s?', 'flat (?:screen|panel) (?:wall )?(?:mount|bracket)s?'
    ]),
    exclude: words(['tv stand furniture', 'tv cabinet', 'tv unit', 'tv bed', 'telescopes?', 'microscopes?', 'binoculars?'])
  },
  {
    slug: 'cameras-drones',
    include: words([
      'digital cameras?', 'cameras?', 'stabili[sz]ers?', 'dslr', 'mirrorless', 'polaroid', 'instax', 'gopro', 'osmo', 'insta360', 'action cam(?:era)?s?',
      'dash ?cams?', 'drones?', 'camera lens(?:es)?', 'gimbals?', 'camcorders?', 'vlog',
      // Camera bodies named by type (PCHUB.UK): "Canon EOS R8 ...", "... MILC Body 24.2 MP", "Panasonic Lumix", "Kodak PIXPRO".
      'milc', 'eos', 'lumix', 'pixpro', 'quicksnap'
    ]),
    // "TP-Link Tapo Pan/Tilt Home Security WiFi Camera" and "Tapo Smart Wire-Free Security Battery Camera" (Back to the Office,
    // 23 Oct 2026) are smart-home cameras; so are "D-Link 2 Megapixel H.265 Outdoor Dome Camera" and "Ubiquiti (UVC-G6-INS-W-UK)
    // ... WiFi-connected camera" (fourth dry run).
    exclude: words(['security cameras?', 'surveillance', 'cctv', 'doorbell', 'webcam', 'baby monitor', 'ip cameras?', 'ptz', 'telescopes?', 'binoculars?', 'rangefinders?', 'scopes?',
      'home security', 'wi-?fi cameras?', 'pan/tilt', 'indoor cameras?', 'outdoor cameras?', 'security (?:[\\w-]+ ){1,3}cameras?', 'tapo',
      '(?:dome|bullet|turret) cameras?', 'h\\.26[45]\\+?', 'ubiquiti', 'unifi', 'uvc-\\w+'])
  },
  {
    slug: 'smart-home-wifi',
    include: words([
      'smart (?:plug|bulb|light|lock|thermostat|switch|home|display|hub|sensor|speaker)s?', 'smart light bulbs?', 'alexa', 'echo (?:dot|show|pop)',
      'google nest', 'nest (?:hub|cam|doorbell)', 'video doorbells?', 'doorbells?', 'security cameras?', 'surveillance cameras?', 'outdoor cameras?',
      'ptz cameras?', 'cctv', 'ip cameras?', 'smart smoke alarms?', 'wi-?fi ?\\d?', 'routers?', 'mesh wi-?fi', 'mesh (?:system|router|network)s?', 'range extenders?', 'access points?',
      'network switch(?:es)?', 'desktop switch', 'unmanaged switch', '\\d+-port', 'gigabit', 'poe\\+?', 'ethernet', 'powerline', 'modems?', 'orbi', 'tp-link deco', 'deco [xmse]\\d+',
      // Back to the Office, 23 Oct 2026: "Tapo Smart Wire-Free Security Battery Camera", "TP-Link RE200 network extender Network repeater",
      // "TP-Link Archer T4E Internal WLAN".
      'security (?:[\\w-]+ ){1,3}cameras?', 'tapo', 'repeaters?', 'network extenders?', 'wi-?fi extenders?', 'wlan',
      '(?:dome|bullet|turret) cameras?', 'h\\.26[45]\\+?', 'uvc-\\w+'
    ]),
    // A NAS whose name says "Ethernet LAN" ("QNAP TS-251A NAS Tower Ethernet LAN", "Synology DiskStation DS224+ NAS/storage server
    // Desktop Ethernet LAN") goes with the storage (sixth check, lessons L50).
    exclude: words(['fake camera', 'dummy camera', 'router bits?', 'wood router', 'nas', 'diskstation'])
  },
  {
    slug: 'accessories-storage',
    // "Kingston ... Canvas Select 512GB micSDXC" (Back to the Office) writes microSD without "ro". Sixth check (live site, 24 Oct
    // 2026): drives named by their interface ("Kingston Technology A400 240 GB 2.5\" Serial ATA III TLC", "Western Digital Red WD
    // SA500 SATA SSD ...", "Toshiba 1TB 3.5\" 7.2k SATA ... internal hard drive") were on the computing page: they are storage.
    include: words(['ssds?', 'nvme', 'serial ata', 'sata', 'external hard drives?', 'portable hard drives?', 'hard drives?', 'hdd', 'nas', '\\d+[- ]?bays?', 'diskstation', 'memory cards?', 'micro ?sd(?:xc|hc)?', 'micsd(?:xc|hc)?', 'sd(?:xc|hc)', 'sd cards?', 'usb-bt\\d+', 'bluetooth (?:adapter|dongle)s?', 'usb (?:stick|flash drive)s?', 'flash drives?', 'datatraveler', 'portable ssd', '\\d+ ?tb usb', 'adapters?', 'plugs?']),
    exclude: words(['laptops?', 'desktop pc', 'mini pc', 'console', 'bicycle parts'])
  }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['laptops-computing', 'phones-smartwatches', 'audio', 'gaming', 'cameras-drones', 'tv-home-cinema', 'smart-home-wifi', 'accessories-storage'];

// Minimum quality for any product to be imported (L14). The import tool reports each failure reason.
export const QUALITY = {
  currency: 'GBP',
  minPrice: 1,
  maxPrice: 10000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

const TECH_TOPS = ['Electronics', 'Cameras & Optics', 'Software'];

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// For the dry-run report: the words that made a product "not for UK buyers" (the report cuts long names, so the end of
// "... Windows 11 Home - US Keyboard" would not show).
const UK_HINTS = [
  /\b(?:eu|euro|us|usa|sa|au|aus|swiss|ch|dk|jp|kr|br|cn|za|il) ?plugs?\b/i, /\bwith (?:eu|euro|us|usa|sa|au|aus|swiss|ch|dk|jp|kr|br|cn|za|il)\b/i,
  /\bschuko\b/i, /\b(?:qwertz|azerty)\b/i, /\bqwerty \w+(?: \w+)?/i, /\bus (?:english|international|layout)\b|\(us\)/i,
  /\b(?:spanish|italian|portuguese|nordic|danish|swedish|norwegian|finnish|dutch|turkish|greek|russian|arabic|hebrew|czech|polish|hungarian|swiss|belgian|german|french|slovenian|croatian|romanian|bulgarian|ukrainian|lithuanian|latvian|estonian|slovak|icelandic)\b/i,
  /\b[a-z0-9]{5}(?:[ac-z]|[a-z]{2})\/a\b/i, /#\w{3}\b/, /\b(?:20|21|82|83)[a-z0-9]{8}\b/i, /\b(?:eu|euro)\b/i, /\b\w+ (?:keyboard|layout)\b/i
];
export function notUkHint(name) {
  for (const re of UK_HINTS) {
    const m = String(name || '').match(re);
    if (m) return m[0];
  }
  return '';
}

export function classify(name, feedCategory = '') {
  // "Intel® Core™ i5" is "intel core i5" for the rules (Back to the Office files every laptop under "Computers").
  const n = String(name || '').toLowerCase().replace(/[®™©]/g, '');
  const top = topCategory(feedCategory);
  if (DENY_TOP.includes(top)) return { ok: false, reason: `feed category: ${top}` };
  for (const d of DENY) if (d.re.test(n) && !(d.except && d.except.test(n))) return { ok: false, reason: d.label };
  const text = `${n} ${String(feedCategory || '').toLowerCase()}`;
  const only = ONLY_TOP[top];
  for (const r of RULES) {
    if (only && !only.includes(r.slug)) continue;
    if (r.include.test(text) && !(r.exclude && r.exclude.test(text))) return { ok: true, slug: r.slug };
  }
  return { ok: false, reason: TECH_TOPS.includes(top) ? 'not matched (feed says tech)' : 'not tech' };
}

// Feed names often start with promotions such as "【Black Friday Early Deals】" or "[Back-to-School]".
// Sixth check (live site, 24 Oct 2026): PCHUB.UK names "HP None Intel Core Ultra 9 285HX ..." (an empty series) and
// "HP HP ProBook 460 ...": the brand once, without "None".
export function cleanProductName(name) {
  return String(name || '')
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/^(\s*\S+)\s+(?:none|null|undefined|n\/a)\s+/i, '$1 ')
    .replace(/^(\s*([a-z][a-z0-9]*))\s+\2\b/i, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
