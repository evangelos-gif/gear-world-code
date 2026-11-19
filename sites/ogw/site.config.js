// Mega Stores Gear World (megastoresgearworld.com, code OGW): gift guides that link to the big marketplaces and to the
// Gear World sites. Owner's decision, 17 Nov 2026 (chat 7, Amazon Associates): guides only; no price tracking, price
// history or price alerts on this site (Amazon Associates Operating Agreement 6(y)); no Amazon prices or photos (no
// Product Advertising API yet, so "See prices on Amazon"); Amazon links go straight to amazon.co.uk with the Associates
// ID (never through /out/), with the Amazon statement on every page. No database, no cookies, no forms.
// An idea's `q` is the search on the marketplace; `gw` and `cat` are the Gear World site (promos/network.js) and its
// category page for the same kind of product (a category page always has products; a site search for several words
// often has none). Ideas name a kind of product, never a product we have not seen: the marketplace shows the
// products, prices and sellers.
// Wording (lessons L101, L103, L107): we compare, we do not sell. No "shop", "cart", "buy now", "deals", "sale",
// "save", "lowest price", "free delivery" or "partner"; Black Friday only as a countdown, never a promise of discounts.

// Languages (owner, 18 Nov 2026: "all the languages", lessons L24, L175, L194): the dictionaries are
// sites/ogw/i18n/<code>.json (keyed by the English text, like the sites' public/assets/i18n files), written into the
// Worker when it is built. The Black Friday block reads the Hub's own file (lessons L188, L194).
import DICTIONARIES from './i18n.js';
import EARLY_BLACK_FRIDAY from '../gwh/black-friday/black-friday.json' with { type: 'json' };

// No `code` field on purpose: tools that list the shop sites by code (tools/gwh-deals.mjs) must not count this site;
// its code OGW is used only by tools/ogw-site.ps1 and the reports.
export default {
  name: 'Mega Stores Gear World',
  domain: 'megastoresgearworld.com',
  // Owner's decision, 7 Nov 2026 (lessons L101): who runs the site and the country, never a home address.
  operatorName: 'Evangelos Kalogerakis, United Kingdom',
  // An address that receives mail (the Hub's; megastoresgearworld.com has no email).
  contactEmail: 'contact@gearworldhub.com',
  assetVersion: '2026-11-19-ogw-3',
  // The 12 languages of the 13 Gear World sites, the same codes and the same order as their menu (lessons L162, L194).
  languages: [
    { code: 'en-GB', label: 'English' },
    { code: 'el-GR', label: 'Ελληνικά' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'it-IT', label: 'Italiano' },
    { code: 'es-ES', label: 'Español' },
    { code: 'pt-PT', label: 'Português' },
    { code: 'nl-NL', label: 'Nederlands' },
    { code: 'pl-PL', label: 'Polski' },
    { code: 'sq-AL', label: 'Shqip' },
    { code: 'ro-RO', label: 'Română' },
    { code: 'ru-RU', label: 'Русский' }
  ],
  dictionaries: DICTIONARIES,
  // The Hub link in the header and the footer of every page, like the sites (owner, 18 Nov 2026, L174, L194).
  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/' },
  // The marketplaces a guide links to, in this order. Amazon UK: Associates ID gearworld04-21 (owner, 15 Nov 2026). The
  // live Worker shows the Amazon links only with AMAZON_LINKS=on, which tools/ogw-site.ps1 sets only after the owner's
  // phrase that the site is in his Associates account ("Websites and mobile apps"); the test Worker links to Amazon
  // without the ID (AMAZON_LINKS=preview). eBay, AliExpress, Joybuy and Temu are added here when chat 7 has their link
  // format and IDs (eBay Partner Network campaign, Admitad AliExpress, Awin Joybuy search page).
  // linkImage: an optional image under /assets/ that Amazon itself supplies to Associates. Amazon Trademark Guidelines:
  // an Amazon mark only next to an Amazon Special Link, unchanged, never implying sponsorship. So it shows only on
  // /stores/amazon/ next to the Amazon buttons, with AMAZON_LINKS=on; everywhere else Amazon is text only. Empty until
  // the Manager adds the file Amazon gives.
  // blackFriday: Amazon's own Black Friday page, a button of the Black Friday block (only with Amazon links, L194).
  amazon: { host: 'www.amazon.co.uk', tag: 'gearworld04-21', linkImage: '', blackFriday: '/blackfriday' },
  // The stores bar (owner, 18 Nov 2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L191): one page per store at
  // /stores/<slug>/, in this order, above the gift guides. Amazon shows only with AMAZON_LINKS on or preview, text only
  // (no logo). The other stores are the UK retailers listed on the Gear World sites: `name` is the `retailer` value of
  // the sites' /api/products, `sites` the Gear World sites with its products (codes of promos/network.js; the page reads
  // the first 6), `deliversTo` where it delivers. Their products (photo, name, brand, the Gear World product page) are
  // read live from those sites and kept 1 hour in the Worker's cache: never in this repo (no Awin feed data), never a
  // price, never an /out/ or /go/ link. `line`: what it sells, no claims. `logo`: the store's own logo file as it gives
  // it to affiliates (Awin advertiser profile, copied unchanged), shown on a white tile, never redrawn; without one a
  // text badge with the name.
  stores: [
    { slug: 'amazon', name: 'Amazon', amazon: true, line: 'Searches on amazon.co.uk for the ideas in our gift guides.' },
    { slug: 'joybuy', name: 'Joybuy', sites: ['WGW', 'TGW', 'MGW', 'HGW', 'KGW', 'ZGW', 'SGW', 'AGW', 'PGW', 'VGW', 'CGW', 'BGW'], deliversTo: ['GB'],
      line: 'Tech, home, beauty, toys, pet and sports products.', logo: 'logos/joybuy.png', logoSize: [168, 168] },
    { slug: 'tooled-up', name: 'Tooled Up', sites: ['CGW', 'AGW', 'GGW', 'BGW'], deliversTo: ['GB'],
      line: 'Power tools, hand tools, workshop and garden equipment.', logo: 'logos/tooled-up.png', logoSize: [168, 61] },
    { slug: 'my-tool-shed', name: 'My Tool Shed', sites: ['CGW', 'GGW'], deliversTo: ['GB'],
      line: 'Power tools, hand tools and garden equipment.', logo: 'logos/my-tool-shed.png', logoSize: [168, 61] },
    { slug: 'pchub-uk', name: 'PCHUB.UK', sites: ['TGW', 'PGW'], deliversTo: ['GB'],
      line: 'Computer parts, PCs and accessories.', logo: 'logos/pchub-uk.png', logoSize: [168, 57] },
    { slug: 'gs-workwear', name: 'GS Workwear', sites: ['CGW', 'AGW'], deliversTo: ['GB'],
      line: 'Workwear and safety clothing.', logo: 'logos/gs-workwear.jpg', logoSize: [168, 168] },
    { slug: 'back-to-the-office', name: 'Back to the Office', sites: ['TGW', 'PGW', 'HGW', 'CGW', 'MGW', 'WGW'], deliversTo: ['GB'],
      line: 'Office supplies, office furniture and desk accessories.', logo: 'logos/back-to-the-office.png', logoSize: [168, 168] },
    { slug: 'dhgate', name: 'DHgate', sites: ['KGW'], deliversTo: ['GB'],
      line: 'Toys, games and children\'s items from many independent sellers.', logo: '' }
  ],
  // Black Friday 2026 (Friday 27 Nov), Cyber Monday (Monday 30 Nov) and Christmas: the countdown line and the Black Friday
  // block of the home page (until the end of Cyber Monday). Never a promise of discounts.
  blackFriday: '2026-11-27',
  cyberMonday: '2026-11-30',
  christmas: '2026-12-25',
  // The retailers that have started their Black Friday and their codes: the Hub's black-friday.json (L188, L194).
  earlyBlackFriday: EARLY_BLACK_FRIDAY,
  guides: [
    {
      slug: 'christmas-gift-ideas-for-him',
      title: 'Christmas gift ideas for him',
      teaser: 'Grooming, watches, warm layers and things he will use every day.',
      intro: 'Useful gifts are the ones that get used. These are ideas, not picks: each button opens a page with current models, so you can compare models, sellers and prices yourself.',
      ideas: [
        { name: 'Beard trimmer', why: 'Cordless with a few comb lengths covers most beards. Check the battery time and whether it can be rinsed.', q: 'cordless beard trimmer', gw: 'MGW', cat: 'grooming-fragrances' },
        { name: 'Automatic watch', why: 'No battery to change. Check the case size against a watch he already wears.', q: 'automatic watch men', gw: 'MGW', cat: 'watches' },
        { name: 'Leather wallet', why: 'Slim card holders suit a front pocket. Check how many cards it takes.', q: 'slim leather wallet men', gw: 'MGW', cat: 'bags-accessories' },
        { name: 'Wool beanie and scarf', why: 'Merino or lambswool is warm without being bulky.', q: 'wool beanie scarf set men', gw: 'MGW', cat: 'clothing' },
        { name: 'Multi-tool', why: 'Pliers, screwdrivers and a blade in one. UK law: in public, only a folding blade up to 3 inches that does not lock, unless there is a good reason. Not sold to under-18s.', q: 'multi tool pliers', gw: 'MGW', cat: 'everyday-carry' },
        { name: 'Wireless earbuds', why: 'For the gym or the commute. Check the fit options and how long the case charge lasts.', q: 'wireless earbuds', gw: 'TGW', cat: 'audio' },
        { name: 'Aftershave or eau de parfum', why: 'A smaller bottle of a scent he likes is better than a big bottle of a guess.', q: 'eau de parfum men', gw: 'MGW', cat: 'grooming-fragrances' },
        { name: 'Backpack for work', why: 'A padded laptop sleeve and a water-resistant fabric matter more than the brand.', q: 'laptop backpack water resistant', gw: 'VGW', cat: 'travel-bags-backpacks' }
      ]
    },
    {
      slug: 'christmas-gift-ideas-for-her',
      title: 'Christmas gift ideas for her',
      teaser: 'Beauty tools, jewellery, cosy home gifts and everyday bags.',
      intro: 'A short list of gift ideas that are easy to choose and easy to wrap. Each button opens a page with the current models, so you see the sellers and prices yourself.',
      ideas: [
        { name: 'Hair styler', why: 'Stylers with several heat settings let you use less heat. Check the plug is a UK plug.', q: 'hair styler uk plug', gw: 'WGW', cat: 'beauty-fragrances' },
        { name: 'Silver jewellery', why: 'Sterling silver (925) studs or a pendant are a safe size choice.', q: 'sterling silver necklace women', gw: 'WGW', cat: 'jewellery' },
        { name: 'Skincare gift set', why: 'Check the skin type on the box and any ingredients she avoids.', q: 'skincare gift set', gw: 'WGW', cat: 'beauty-fragrances' },
        { name: 'Cashmere or wool scarf', why: 'Natural fibres are warmer and softer. Check the fibre mix on the label.', q: 'cashmere scarf women', gw: 'WGW', cat: 'clothing' },
        { name: 'Scented candle', why: 'Check the wax, the scent notes and the burn time.', q: 'scented candle gift', gw: 'HGW', cat: 'home-decor' },
        { name: 'Crossbody bag', why: 'Hands-free for town and travel. Check the strap length and inside pockets.', q: 'crossbody bag women', gw: 'WGW', cat: 'bags-accessories' },
        { name: 'Fitness tracker', why: 'Step, sleep and heart-rate tracking in a light band. Check which phones it works with.', q: 'fitness tracker women', gw: 'TGW', cat: 'phones-smartwatches' },
        { name: 'Pyjama set', why: 'Cotton or modal for comfort. Sizes vary by brand, so check the size guide.', q: 'pyjama set women', gw: 'WGW', cat: 'clothing' }
      ]
    },
    {
      slug: 'christmas-gift-ideas-for-kids',
      title: 'Christmas gift ideas for kids',
      teaser: 'For parents: building sets, creative kits, outdoor play and books.',
      intro: 'Written for parents and relatives. Always check the age on the box and the safety marks (UKCA or CE) before you choose.',
      ideas: [
        { name: 'Building bricks set', why: 'Pick the age range on the box; sets for younger children have bigger pieces.', q: 'building bricks set kids', gw: 'KGW', cat: 'toys-games' },
        { name: 'Arts and crafts kit', why: 'Washable paints and pens are easier to clean up. Check the age range.', q: 'arts and crafts kit kids', gw: 'KGW', cat: 'toys-games' },
        { name: 'Board game for families', why: 'Games for 2 to 6 players get played most. Check the playing time and age.', q: 'family board game', gw: 'KGW', cat: 'toys-games' },
        { name: 'Science kit', why: 'Kits for 8 and over need an adult nearby. Read the warnings on the box.', q: 'science kit kids', gw: 'KGW', cat: 'toys-games' },
        { name: 'Kids headphones', why: 'Look for a volume limit of about 85 dB for young ears.', q: 'kids headphones volume limit', gw: 'KGW', cat: 'kids-tech' },
        { name: 'Scooter and helmet', why: 'A helmet that fits matters more than the scooter. Check the rider weight limit.', q: 'kids scooter helmet', gw: 'KGW', cat: 'sports-outdoors' },
        { name: 'Soft toy', why: 'For babies and toddlers, choose toys marked for 0+ with no small parts.', q: 'soft toy baby 0+', gw: 'KGW', cat: 'baby-toddler' },
        { name: 'Winter boots for kids', why: 'Waterproof with a warm lining. Measure their feet first: sizes run differently by brand.', q: 'kids winter boots waterproof', gw: 'KGW', cat: 'shoes' }
      ]
    },
    {
      slug: 'tech-gift-ideas',
      title: 'Tech gift ideas',
      teaser: 'Chargers, speakers, smart home and small gadgets that get used.',
      intro: 'Tech gifts work best when they fit what someone already has. Check which phone or system the gift works with before you choose.',
      ideas: [
        { name: 'Portable charger', why: 'About 10,000 mAh charges most phones one and a half to two times. Check it has the same port as their phone.', q: 'power bank 10000mah usb c', gw: 'TGW', cat: 'accessories-storage' },
        { name: 'Bluetooth speaker', why: 'Water-resistant speakers (IPX5 or more) can go to the garden or the beach.', q: 'bluetooth speaker waterproof', gw: 'TGW', cat: 'audio' },
        { name: 'Smart plug', why: 'Turns a lamp or fairy lights on from the phone or on a timer. Check the maximum load, and never use one with a heater.', q: 'smart plug uk', gw: 'TGW', cat: 'smart-home-wifi' },
        { name: 'E-reader', why: 'A light, glare-free screen for books. Check the storage and which e-book store it uses.', q: 'e-reader', gw: 'TGW', cat: 'laptops-computing' },
        { name: 'Wireless charging pad', why: 'Only for phones with wireless charging. Check the phone model.', q: 'wireless charger pad', gw: 'TGW', cat: 'accessories-storage' },
        { name: 'Webcam', why: '1080p with a built-in microphone is enough for most calls.', q: 'webcam 1080p microphone', gw: 'TGW', cat: 'laptops-computing' },
        { name: 'Dash cam', why: 'Front camera with a parking mode. Check the memory card it needs.', q: 'dash cam front', gw: 'AGW', cat: 'car-electronics' },
        { name: 'Smartwatch', why: 'Check it works with their phone (iPhone or Android) before anything else.', q: 'smartwatch', gw: 'TGW', cat: 'phones-smartwatches' }
      ]
    },
    {
      slug: 'gift-ideas-for-gamers',
      title: 'Gift ideas for gamers',
      teaser: 'Controllers, headsets, keyboards and gaming chairs.',
      intro: 'Gamers are particular about their setup. Check the platform (PC, PlayStation, Xbox or Switch) before you choose any of these.',
      ideas: [
        { name: 'Gaming headset', why: 'Check the platform and whether it is wired or wireless.', q: 'gaming headset', gw: 'PGW', cat: 'headsets' },
        { name: 'Mechanical keyboard', why: 'For PC players. Quiet switches suit shared rooms.', q: 'mechanical keyboard', gw: 'PGW', cat: 'mice-keyboards' },
        { name: 'Gaming mouse', why: 'A light mouse with side buttons. Check left- or right-handed.', q: 'gaming mouse', gw: 'PGW', cat: 'mice-keyboards' },
        { name: 'Extra controller', why: 'Check the console it is made for.', q: 'wireless controller', gw: 'PGW', cat: 'controllers' },
        { name: 'Gaming chair', why: 'Check the seat height and the weight limit.', q: 'gaming chair', gw: 'PGW', cat: 'chairs-desks' },
        { name: 'Large mouse mat', why: 'A desk-size mat for keyboard and mouse.', q: 'large desk mouse mat', gw: 'PGW', cat: 'mice-keyboards' },
        { name: 'Console storage stand', why: 'Keeps controllers and games tidy. Check the console model.', q: 'console stand controller charger', gw: 'PGW', cat: 'consoles' },
        { name: 'Gift card for their platform', why: 'When you are not sure which game: a gift card for the store they use.', q: 'gaming gift card', gw: 'PGW', cat: 'games-cards' }
      ]
    },
    {
      slug: 'home-and-kitchen-gift-ideas',
      title: 'Home and kitchen gift ideas',
      teaser: 'Air fryers, coffee, bedding and cosy evenings in.',
      intro: 'Home gifts that make winter evenings easier. Check the size against the space at home before you choose.',
      ideas: [
        { name: 'Air fryer', why: 'A 4 to 6 litre drawer suits most households. Check the space on the worktop.', q: 'air fryer', gw: 'HGW', cat: 'home-appliances' },
        { name: 'Coffee machine', why: 'Pods are simple; bean-to-cup suits coffee lovers. Check the cost of pods or beans.', q: 'coffee machine', gw: 'HGW', cat: 'home-appliances' },
        { name: 'Electric blanket or heated throw', why: 'Check the safety marks, the timer and the washing instructions.', q: 'heated throw', gw: 'HGW', cat: 'bedding-bath' },
        { name: 'Bedding set', why: 'Check the bed size and the fabric (cotton, linen or brushed cotton for winter).', q: 'duvet cover set', gw: 'HGW', cat: 'bedding-bath' },
        { name: 'Knife set', why: 'Three good knives are better than a block of twelve.', q: 'kitchen knife set', gw: 'HGW', cat: 'kitchen-dining' },
        { name: 'Slow cooker', why: 'A 3.5 litre pot feeds about four people.', q: 'slow cooker', gw: 'HGW', cat: 'home-appliances' },
        { name: 'Throw and cushions', why: 'An easy way to change a room. Check the washing instructions.', q: 'throw blanket sofa', gw: 'HGW', cat: 'home-decor' },
        { name: 'Indoor herb kit', why: 'A windowsill kit for the cook who has everything.', q: 'indoor herb garden kit', gw: 'GGW', cat: 'plants-growing-garden-care' }
      ]
    },
    {
      slug: 'diy-and-garage-gift-ideas',
      title: 'DIY and garage gift ideas',
      teaser: 'Cordless tools, socket sets, workwear and car care.',
      intro: 'For people who fix things. Cordless tools of one brand share batteries, so check which battery system they already use.',
      ideas: [
        { name: 'Cordless drill driver', why: 'Check the battery system (18V or 12V) and whether a battery is included.', q: 'cordless drill driver', gw: 'CGW', cat: 'power-tools' },
        { name: 'Socket set', why: 'A set with 1/4 and 1/2 inch drives covers most car and home jobs.', q: 'socket set', gw: 'AGW', cat: 'garage-tools-equipment' },
        { name: 'Work gloves', why: 'Check the size and the cut level for the work they do.', q: 'work gloves', gw: 'CGW', cat: 'ppe' },
        { name: 'Head torch', why: 'Rechargeable, so no batteries to buy. Check the brightness (lumens).', q: 'rechargeable head torch', gw: 'CGW', cat: 'site-equipment' },
        { name: 'Tool bag', why: 'An open-top bag shows everything at a glance.', q: 'tool bag', gw: 'CGW', cat: 'hand-tools' },
        { name: 'Car care kit', why: 'Wash, wax and microfibre cloths for winter cleaning.', q: 'car care kit', gw: 'AGW', cat: 'car-care-detailing' },
        { name: 'Laser measure', why: 'Faster than a tape for rooms. Check the range in metres.', q: 'laser distance measure', gw: 'CGW', cat: 'hand-tools' },
        { name: 'Thermal work socks', why: 'A small gift that gets worn all winter.', q: 'thermal work socks', gw: 'CGW', cat: 'workwear' }
      ]
    },
    {
      slug: 'gift-ideas-for-pet-lovers',
      title: 'Gift ideas for pet lovers',
      teaser: 'Beds, toys, grooming and walks in the dark.',
      intro: 'Gifts for the pet and its owner. Check the size of the pet against the product size before you choose.',
      ideas: [
        { name: 'Dog bed', why: 'Measure the dog lying down and add a little. Removable covers are easier to wash.', q: 'washable dog bed', gw: 'ZGW', cat: 'beds-crates' },
        { name: 'Cat tree', why: 'Check the height and how stable the base is.', q: 'cat tree', gw: 'ZGW', cat: 'cats' },
        { name: 'LED dog collar', why: 'For winter walks in the dark. Check the neck size.', q: 'led dog collar rechargeable', gw: 'ZGW', cat: 'walking' },
        { name: 'Treat puzzle toy', why: 'Slows down fast eaters and keeps them busy.', q: 'dog puzzle toy', gw: 'ZGW', cat: 'toys' },
        { name: 'Grooming brush', why: 'Check the coat type on the brush (short, long or double coat).', q: 'pet grooming brush', gw: 'ZGW', cat: 'grooming' },
        { name: 'Pet carrier', why: 'For trips to the vet. Check the size against the pet and how the door opens.', q: 'pet carrier', gw: 'ZGW', cat: 'travel' },
        { name: 'Cat toys set', why: 'Wands and balls keep indoor cats active.', q: 'cat toys set', gw: 'ZGW', cat: 'toys' },
        { name: 'Dog coat', why: 'For short-coated dogs in winter. Measure the back length.', q: 'dog coat winter', gw: 'ZGW', cat: 'walking' }
      ]
    },
    {
      slug: 'stocking-filler-ideas',
      title: 'Stocking filler ideas',
      teaser: 'Small gifts for everyone: socks, gadgets, games and treats.',
      intro: 'Small gifts that fit in a stocking. Each button opens a page with current models, so you choose the model and see the price yourself.',
      ideas: [
        { name: 'Novelty socks', why: 'A safe size choice for most people.', q: 'christmas socks', gw: 'MGW', cat: 'clothing' },
        { name: 'Card game', why: 'Quick games for after Christmas dinner. Check the number of players.', q: 'card game family', gw: 'KGW', cat: 'toys-games' },
        { name: 'Lip balm set', why: 'Small, useful in winter.', q: 'lip balm gift set', gw: 'WGW', cat: 'beauty-fragrances' },
        { name: 'Keyring torch', why: 'A tiny rechargeable torch for keys or a bag.', q: 'keyring torch rechargeable', gw: 'MGW', cat: 'everyday-carry' },
        { name: 'Phone stand', why: 'For video calls and recipes in the kitchen.', q: 'phone stand desk', gw: 'TGW', cat: 'accessories-storage' },
        { name: 'Hand warmers', why: 'Rechargeable ones last many winters.', q: 'rechargeable hand warmer', gw: 'SGW', cat: 'hiking-climbing-winter' },
        { name: 'Puzzle cube', why: 'A classic that keeps hands busy.', q: 'speed cube puzzle', gw: 'KGW', cat: 'toys-games' },
        { name: 'Luggage tags', why: 'For the traveller in the family.', q: 'luggage tags', gw: 'VGW', cat: 'travel-accessories' }
      ]
    },
    {
      slug: 'cold-weather-essentials',
      title: 'Cold weather essentials',
      teaser: 'Warm layers, the car in winter, and a warmer home.',
      intro: 'Ideas for the cold months, for you or as a gift. Check sizes and safety marks before you choose.',
      ideas: [
        { name: 'Thermal base layers', why: 'A thin layer under clothes keeps you warm without bulk.', q: 'thermal base layer', gw: 'SGW', cat: 'hiking-climbing-winter' },
        { name: 'Waterproof jacket', why: 'Check the waterproof rating and the hood.', q: 'waterproof jacket', gw: 'MGW', cat: 'clothing' },
        { name: 'Ice scraper and de-icer', why: 'For frosty mornings. Keep them in the car.', q: 'ice scraper de-icer', gw: 'AGW', cat: 'safety-winter' },
        { name: 'Car jump starter', why: 'Starts a car with a flat battery without a second car. Check the engine size it supports.', q: 'car jump starter', gw: 'AGW', cat: 'diagnostics-battery' },
        { name: 'Draught excluder', why: 'A simple way to keep a room warmer.', q: 'draught excluder', gw: 'HGW', cat: 'home-decor' },
        { name: 'Heated gloves', why: 'For cyclists and riders. Check the battery time.', q: 'heated gloves', gw: 'BGW', cat: 'boots-gloves' },
        { name: 'Thermal flask', why: 'Keeps a drink hot for hours on a cold walk.', q: 'thermal flask', gw: 'VGW', cat: 'camping-outdoor' },
        { name: 'Winter walking boots', why: 'Check they are waterproof and have a good grip.', q: 'waterproof walking boots', gw: 'SGW', cat: 'hiking-climbing-winter' }
      ]
    }
  ],
  // An article, not a list of ideas: how to check a price before you choose, on Black Friday or any day. It promises no
  // discounts and does not say we track prices on this site.
  checks: {
    slug: 'black-friday-checks-before-you-choose',
    title: 'Black Friday: 7 checks before you choose',
    teaser: 'How to tell whether a price is good, wherever you compare.',
    intro: 'These checks take a few minutes and work on any marketplace, on Black Friday or any other day of the year.',
    steps: [
      { name: 'Compare the same model', text: 'Search for the exact model number, not just the name. Two products with the same name can be different models.' },
      { name: 'Look at who sells it', text: 'On a marketplace, the seller can be the marketplace itself or another business. The product page says who sells it and who sends it.' },
      { name: 'Add delivery to the price', text: 'Compare the total with delivery, not only the item price.' },
      { name: 'Read the returns policy', text: 'Check how many days you have to return it and who pays for the return. Gifts often have longer returns at Christmas: check the dates.' },
      { name: 'Check the warranty', text: 'Electrical products usually come with a warranty. Check how long and who gives it.' },
      { name: 'Read recent reviews', text: 'Sort reviews by the most recent. A product can change over time.' },
      { name: 'Compare on more than one site', text: 'Search the same model on another marketplace and on the Gear World sites, where each product shows the retailer that sells it and where it delivers.' }
    ]
  }
};
