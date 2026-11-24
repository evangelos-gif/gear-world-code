// Mega Stores Gear World (megastoresgearworld.com, code OGW): gift guides that link to the big marketplaces and to the
// Gear World sites. Owner's decision, 17 Nov 2026 (chat 7, Amazon Associates): guides only; no price tracking, price
// history or price alerts on this site (Amazon Associates Operating Agreement 6(y)); no Amazon prices or photos (no
// Product Advertising API yet, so "See prices on Amazon"); Amazon links go straight to amazon.co.uk with the Associates
// ID (never through /out/), with the Amazon statement on every page. No database, no cookies, no forms.
// An idea's `q` is the search on the marketplace; `gw` and `cat` are the Gear World site (promos/network.js) and its
// category page for the same kind of product (a category page always has products; a site search for several words
// often has none). Ideas name a kind of product, never a product we have not seen: the marketplace shows the
// products, prices and sellers. A text written for the UK (a UK plug, UK law, the UKCA mark) has `whyAbroad` (or the
// guide's `introAbroad`) for visitors from every other country (owner, 21 Nov 2026, lessons L210).
// Wording (lessons L101, L103, L107): we compare, we do not sell. No "shop", "cart", "buy now", "deals", "sale",
// "save", "lowest price", "free delivery" or "partner"; Black Friday only as a countdown, never a promise of discounts.

// Languages (owner, 18 Nov 2026: "all the languages", lessons L24, L175, L195): the dictionaries are
// sites/ogw/i18n/<code>.json (keyed by the English text, like the sites' public/assets/i18n files), written into the
// Worker when it is built. The Black Friday block reads the Hub's own file (lessons L188, L195).
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
  assetVersion: '2026-11-24-ogw-12',
  // The name of the stores part on every page, never translated (owner, 21 Nov 2026, lessons L208).
  storesLabel: 'Mega Stores',
  // The 12 languages of the 13 Gear World sites, the same codes and the same order as their menu (lessons L162, L195).
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
  // The Hub link in the header and the footer of every page, like the sites (owner, 18 Nov 2026, L174, L195).
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
  // blackFriday: Amazon's own Black Friday page, a button of the Black Friday block (only with Amazon links, L195).
  // deliversTo (owner, 21 Nov 2026, lessons L210): Amazon UK is for UK visitors; every other country gets the pages
  // without Amazon (as with AMAZON_LINKS=off), like each store below, which shows only to the countries it delivers to.
  amazon: { host: 'www.amazon.co.uk', tag: 'gearworld04-21', linkImage: '', blackFriday: '/blackfriday', deliversTo: ['GB'] },
  // The stores bar (owner, 18 Nov 2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L191): one page per store at
  // /stores/<slug>/, in this order, above the gift guides. Amazon shows only with AMAZON_LINKS on or preview, text only
  // (no logo). The other stores are the UK retailers listed on the Gear World sites: `name` is the `retailer` value of
  // the sites' /api/products, `sites` the Gear World sites with its products (codes of promos/network.js; the page reads
  // the first 6), `deliversTo` where it delivers: the store, its products, its codes and its Black Friday entry show
  // only to visitors from those countries (L210). Their products (photo, name, brand, the Gear World product page) are
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
      line: 'Toys, games and children\'s items from many independent sellers.', logo: '' },
    // First on the page of Greece (owner, 24 Nov 2026: «τα μεγάλα καταστήματα πρώτα»), then the 7 Greek stores.
    // The five big Greek stores of Linkwise (owner and Linkwise, 24 Nov 2026, lessons L226): Public, Sephora,
    // e-shop.gr, AB Vasilopoulos and Kotsovolos do not accept comparison sites, so their products are never on the 13
    // sites, the Hub or the app. Julia (Linkwise) agreed on 24 Nov 2026 to their pages here like the 7 below (the
    // programme logo, sets and gift ideas; prices since 24 Nov 2026, see below), with one difference: every idea opens the store's own page
    // through the Linkwise link (never a Gear World product page, never a comparison). Prices (owner and Julia, 24 Nov 2026, L227):
    // only the store's own price from its Linkwise product feed, read on the PC by tools/ogw-prices.mjs and shown with
    // the time it was read, never older than 24 hours, never compared; AB has no product feed, so no prices. `direct.program` is the
    // Linkwise programme, `direct.hosts` the store's own addresses (no other address is ever linked), and the sets and
    // ideas name products as the store gives them in its Linkwise product feed (name, photo, page; read on 24 Nov 2026,
    // in stock), or for AB, which has no product feed, one of its own categories (no photo). The Linkwise link needs
    // our affiliate code, which is never in this repository: it is the Worker secret LINKWISE_CODE (tools/ogw-site.ps1
    // puts it from the PC); without it these five stores are not shown anywhere. Greece only.
    { slug: 'kotsovolos-gr', network: 'linkwise', name: 'Κωτσόβολος', deliversTo: ['GR'], line: 'Electrical appliances, phones, computers and games.', logo: 'logos/kotsovolos-gr.png', logoSize: [120, 60],
      direct: {
        program: 138, hosts: ['www.kotsovolos.gr'],
        sets: [
          { title: { el: 'Η γωνιά του καφέ', en: 'The coffee corner' }, line: { el: 'Μηχανή espresso, συσκευή για αφρόγαλα και μύλος καφέ.', en: 'An espresso machine, a milk frother and a coffee grinder.' }, items: [
            { name: 'Delonghi Magnifica Start ECAM220.30.SB Μηχανή Espresso', image: 'https://assets.kotsovolos.gr/product/273143-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=273143' },
            { name: 'Jura Automatic Milk Frother Hot & Cold Συσκευή για Αφρόγαλα', image: 'https://assets.kotsovolos.gr/product/302616-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=302616' },
            { name: 'Smeg CGF11PGEU Pistachio Green Μύλος Καφέ', image: 'https://assets.kotsovolos.gr/product/320952-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=320952' }] },
          { title: { el: 'Για όποιον έχει PS5', en: 'For someone with a PS5' }, line: { el: 'Χειριστήριο, ακουστικά gaming και κάθετη βάση.', en: 'A controller, a gaming headset and a vertical stand.' }, items: [
            { name: 'Sony DualSense V3 Wireless Controller Grey Camouflage PS5 Gamepad', image: 'https://assets.kotsovolos.gr/product/331486-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=331486' },
            { name: 'Razer Kraken V3 X Gaming Headset', image: 'https://assets.kotsovolos.gr/product/232815-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=232815' },
            { name: 'Sony Vertical Stand for PS5 & PS5 Pro', image: 'https://assets.kotsovolos.gr/product/297019-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=297019' }] }
        ],
        ideas: [
          { title: { el: 'Για την κουζίνα', en: 'For the kitchen' }, line: { el: 'Φριτέζα αέρα.', en: 'An air fryer.' },
            item: { name: 'Xiaomi Smart 6.5L Black Φριτέζα Αέρα', image: 'https://assets.kotsovolos.gr/product/332357-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=332357' } },
          { title: { el: 'Για τη γυμναστική', en: 'For workouts' }, line: { el: 'Smartwatch.', en: 'A smartwatch.' },
            item: { name: 'Garmin Venu 3 Silver SmartWatch', image: 'https://assets.kotsovolos.gr/product/291171-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=291171' } },
          { title: { el: 'Για τη μουσική', en: 'For music' }, line: { el: 'Ασύρματα ακουστικά κεφαλής.', en: 'Wireless headphones.' },
            item: { name: 'JBL Tune 520BT Black Ακουστικά Κεφαλής Bluetooth', image: 'https://assets.kotsovolos.gr/product/279893-l.jpg', url: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=279893' } }
        ]
      } },
    { slug: 'public-gr', network: 'linkwise', name: 'Public', deliversTo: ['GR'], line: 'Technology, music, books and games.', logo: 'logos/public-gr.png', logoSize: [120, 60],
      direct: {
        program: 469, hosts: ['www.public.gr'],
        sets: [
          { title: { el: 'Για τον μουσικόφιλο', en: 'For the music lover' }, line: { el: 'Πικάπ, ηχείο και ακουστικά.', en: 'A turntable, a speaker and headphones.' }, items: [
            { name: 'Πικάπ Sony PS-LX5 BT - Μαύρο', image: 'https://external.webstorage.gr/mmimages/image/67/83/63/62/2181584-SONY-PSLX5BT-hero-800x800.jpg', url: 'https://www.public.gr/product/tileoraseis/pikap-and-axesouar/pikap/pikap-sony-ps-lx5-bt--mauro/2181584' },
            { name: 'Marshall Middleton Φορητό Ηχείο 60W - Μαύρο', image: 'https://external.webstorage.gr/mmimages/image/86/61/51/34/1819878-PORTABLE-SPEAKER-MARSHALL-MIDDLETON-BLACK-hero-800x800.jpg', url: 'https://www.public.gr/product/ihos/hxeia/forita-hxeia/marshall-middleton-forito-ixeio-60w--mauro/1819878' },
            { name: 'Sony WH-CH720N Ασύρματα Ακουστικά Κεφαλής - Μπλε', image: 'https://external.webstorage.gr/mmimages/image/26/6/5/73/1787347-SONY-WH-CH720-BLUE-hero-800x800.jpg', url: 'https://www.public.gr/product/ihos/akoustika/akoystika-kefalis/sony-wh-ch720n-asurmata-akoustika-kefalis--mple/1787347' }] },
          { title: { el: 'Βραδιά παιχνιδιού', en: 'A game night' }, line: { el: 'Nintendo Switch και δύο παιχνίδια για παρέα.', en: 'A Nintendo Switch and two games to play together.' }, items: [
            { name: 'Nintendo Switch OLED Model White', image: 'https://external.webstorage.gr/mmimages/image/12/31/40/59/1629626-NINTENDO-SWITCH-OLED-hero-800x800.jpg', url: 'https://www.public.gr/product/gaming/nintendo/consoles/nintendo-switch-oled-model-white/1629626' },
            { name: 'Super Bomberman Collection – Nintendo Switch', image: 'https://external.webstorage.gr/mmimages/image/37/33/24/63/2180399-NSW-SUPER-BOMBERMAN-COLLECTION-hero-800x800.jpg', url: 'https://www.public.gr/product/gaming/nintendo/games/nintendo-switch/super-bomberman-collection-nintendo-switch/2180399' },
            { name: 'Nickelodeon Extreme Tennis: Next! - Nintendo Switch', image: 'https://external.webstorage.gr/mmimages/image/86/34/46/74/2180406-NSW-NICKELODEON-EXTREME-hero-800x800.jpg', url: 'https://www.public.gr/product/gaming/nintendo/games/nintendo-switch/nickelodeon-extreme-tennis-next--nintendo-switch/2180406' }] }
        ],
        ideas: [
          { title: { el: 'Για στιγμές που μένουν', en: 'For moments to keep' }, line: { el: 'Instant φωτογραφική μηχανή.', en: 'An instant camera.' },
            item: { name: 'Instant Camera Polaroid Now Generation 3 - Coral', image: 'https://external.webstorage.gr/mmimages/image/26/96/90/97/2029041-INSTANT-CAM-POLAROID-NOW-GEN3-CORAL-hero-800x800.jpg', url: 'https://www.public.gr/product/fotografia/fotografikes-mixanes/instant-cameras/instant-camera-polaroid-now-generation-3--coral/2029041' } },
          { title: { el: 'Για τα ταξίδια', en: 'For travel' }, line: { el: 'Ακουστικά κεφαλής με ακύρωση θορύβου.', en: 'Noise-cancelling headphones.' },
            item: { name: 'Ασύρματα Ακουστικά Κεφαλής Bose QuietComfort (2nd Gen) - White Smoke', image: 'https://external.webstorage.gr/mmimages/image/80/38/3/70/2181582-BOSE-0017817859707-hero-800x800.jpg', url: 'https://www.public.gr/product/ihos/akoustika/akoystika-kefalis/asurmata-akoustika-kefalis-bose-quietcomfort-2nd-gen--white-smoke/2181582' } },
          { title: { el: 'Για πάρτι', en: 'For parties' }, line: { el: 'Μεγάλο φορητό ηχείο.', en: 'A big portable speaker.' },
            item: { name: 'JBL Boombox 3 Φορητό Ηχείο 180W - Μαύρο', image: 'https://external.webstorage.gr/mmimages/image/63/14/7/5/1710621-JBL-BOOMBOX+3-hero-800x800.jpg', url: 'https://www.public.gr/product/ihos/hxeia/forita-hxeia/jbl-boombox-3-forito-ixeio-180w--mauro/1710621' } }
        ]
      } },
    { slug: 'sephora-gr', network: 'linkwise', name: 'Sephora', deliversTo: ['GR'], line: 'Make-up, skincare and fragrances.', logo: 'logos/sephora-gr.png', logoSize: [120, 60],
      direct: {
        program: 13026, hosts: ['www.sephora.gr'],
        sets: [
          { title: { el: 'Ρουτίνα για το πρόσωπο', en: 'A face care routine' }, line: { el: 'Gel καθαρισμού, ορός και κρέμα.', en: 'A cleansing gel, a serum and a cream.' }, items: [
            { name: 'Dermalogica - Special Cleansing Gel', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/D/DERMALOGICA/395164/161497-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/special-cleansing-gel-395164.html' },
            { name: 'Clinique - Moisture Surge™ Active Glow Serum - Ορός', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/C/CLINIQUE/760912/364531-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/moisture-surge-active-glow-serum---oros-760912.html' },
            { name: 'Sisley - Black Rose Skin Infusion Cream', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/massivpimupload/S/SISLEY/398259/52065-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/black-rose-skin-infusion-cream-398259.html' }] },
          { title: { el: 'Για μια βραδινή έξοδο', en: 'For an evening out' }, line: { el: 'Κραγιόν, μάσκαρα και παλέτα για τα μάτια.', en: 'A lipstick, a mascara and an eyeshadow palette.' }, items: [
            { name: 'Sisley - Phyto-Lip Twist - Κραγιόν', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/S/SISLEY/363388/9547-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/phyto-lip-twist---kragion-363388.html' },
            { name: 'Estée Lauder - Sumptuous Rebel - Length and Lift Mascara', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/L/LAUDE/482662/139730-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/sumptuous-rebel---length-and-lift-mascara-482662.html' },
            { name: 'Lancôme - Hypnôse 5-Color Eyeshadow Palette', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/L/LANCOME/476611/443626-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/hypnose-high-pigment-5-color-eyeshadow-palette-476611.html' }] }
        ],
        ideas: [
          { title: { el: 'Για εκείνη', en: 'For her' }, line: { el: 'Σετ ταξιδιού με καλλυντικά.', en: 'A travel beauty set.' },
            item: { name: 'Rare Beauty - Rare Beginnings - Σετ ταξιδιού', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/R/RARE_BEAUTY/820799/407317-media_swatch-0.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/rare-beginnings---set-taxidiou-820799.html' } },
          { title: { el: 'Για εκείνον', en: 'For him' }, line: { el: 'Ανδρικό άρωμα.', en: 'A men’s fragrance.' },
            item: { name: 'Dior - Sauvage Eau de Toilette', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/D/DIOR/362059/82265-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/sauvage-eau-de-toilette-362059.html' } },
          { title: { el: 'Μικρό δώρο', en: 'A small gift' }, line: { el: 'Κιτ μακιγιάζ.', en: 'A make-up kit.' },
            item: { name: 'Merci Handy - Kit Let\'s Glow Heroes - Highlighter + Ρουζ', image: 'https://media.sephora.eu/content/dam/gdam/europe/digital/pim/published/M/MERCI_HANDY/760215/367608-media_swatch.jpg?scaleWidth=500&scaleHeight=500&scaleMode=fit', url: 'https://www.sephora.gr/p/kit-let-s-glow-heroes---highlighter-rouz-760215.html' } }
        ]
      } },
    { slug: 'e-shop-gr', network: 'linkwise', name: 'e-shop.gr', deliversTo: ['GR'], line: 'Computers, home appliances, tools and toys.', logo: 'logos/e-shop-gr.jpg', logoSize: [120, 60],
      direct: {
        program: 11754, hosts: ['www.e-shop.gr'],
        sets: [
          { title: { el: 'Γραφείο στο σπίτι', en: 'A home office' }, line: { el: 'Οθόνη, ασύρματο πληκτρολόγιο με ποντίκι και βάση οθόνης.', en: 'A monitor, a wireless keyboard and mouse, and a monitor arm.' }, items: [
            { name: 'ASUS PA247CV 23.8\'\' FULL HD LED BLACK SILVER', image: 'https://images.e-shop.gr/images/PER/PER.171695.jpg', url: 'https://www.e-shop.gr/asus-pa247cv-238-full-hd-led-black-silver-p-PER.171695' },
            { name: 'DELL KEYBOARD AND MOUSE KM7120W GREEK WIRELESS', image: 'https://images.e-shop.gr/images/PER/PER.250551.jpg', url: 'https://www.e-shop.gr/dell-keyboard-and-mouse-km7120w-greek-wireless-p-PER.250551' },
            { name: 'BORMANN BTV1502 ΒΑΣΗ ΟΘΟΝΗΣ ΓΡΑΦΕΙΟΥ ΜΟΝΗ 13\'\'-27\'\'', image: 'https://images.e-shop.gr/images/PER/PER.235131.jpg', url: 'https://www.e-shop.gr/bormann-btv1502-basi-othonis-grafeioy-moni-13-27--p-PER.235131' }] },
          { title: { el: 'Για το καθάρισμα του σπιτιού', en: 'For cleaning the house' }, line: { el: 'Σκούπα ρομπότ, σκούπα στικ και σφουγγαρίστρα ατμού.', en: 'A robot vacuum, a stick vacuum and a steam mop.' }, items: [
            { name: 'IROBOT ROOMBA PLUS 515 COMBO CLEANING ROBOT, WHITE + AUTOWASH DOCKING STATION', image: 'https://images.e-shop.gr/images/HAP/HAP.183377.jpg', url: 'https://www.e-shop.gr/irobot-roomba-plus-515-combo-cleaning-robot-white-autowash-docking-station-p-HAP.183377' },
            { name: 'DYSON V16 PISTON ANIMAL SUBMARINE 2-IN-1 STICK VACUUM HEPA BAGLESS BLACK COPPER', image: 'https://images.e-shop.gr/images/HAP/HAP.180973.jpg', url: 'https://www.e-shop.gr/dyson-v16-piston-animal-submarine-2-in-1-stick-vacuum-hepa-bagless-black-copper-p-HAP.180973' },
            { name: 'KARCHER ΑΤΜΟΚΑΘΑΡΙΣΤΗΣ SC 1 UPRIGHT STEAM MOP 1.513-560.0', image: 'https://images.e-shop.gr/images/HAP/HAP.177589.jpg', url: 'https://www.e-shop.gr/karcher-atmokatharistis-sc-1-upright-steam-mop-1513-5600-p-HAP.177589' }] }
        ],
        ideas: [
          { title: { el: 'Για μικρούς κατασκευαστές', en: 'For young builders' }, line: { el: 'LEGO.', en: 'LEGO.' },
            item: { name: 'LEGO ANIMAL CROSSING 77048 KAPP\'N\'S ISLAND BOAT TOUR', image: 'https://images.e-shop.gr/images/EPI/EPI.20962.jpg', url: 'https://www.e-shop.gr/lego-animal-crossing-77048-kapp-n-s-island-boat-tour-p-EPI.20962' } },
          { title: { el: 'Για το εργαστήρι', en: 'For the workshop' }, line: { el: 'Δραπανοκατσάβιδο μπαταρίας.', en: 'A cordless drill driver.' },
            item: { name: 'ΔΡΑΠΑΝΟΚΑΤΣΑΒΙΔΟ ΜΠΑΤΑΡΙΑΣ BOSCH ADVANCED DRILL 18V BRUSHLESS 13MM + 2.5ΑΗ LI-ION + ΦΟΡΤΙΣΤΗΣ', image: 'https://images.e-shop.gr/images/TLS/TLS.032566.jpg', url: 'https://www.e-shop.gr/drapanokatsabido-mpatarias-bosch-advanced-drill-18v-brushless-13mm-25ai-li-ion-fortistis-p-TLS.032566' } },
          { title: { el: 'Για έξω', en: 'For outdoors' }, line: { el: 'Αδιάβροχο ηχείο bluetooth.', en: 'A waterproof bluetooth speaker.' },
            item: { name: 'JBL FLIP 7 BLUETOOTH SPEAKER 35W IP68 RED', image: 'https://images.e-shop.gr/images/TEL/TEL.234322.jpg', url: 'https://www.e-shop.gr/jbl-flip-7-bluetooth-speaker-35w-ip68-red-p-TEL.234322' } }
        ]
      } },
    { slug: 'ab-gr', network: 'linkwise', name: 'ΑΒ Βασιλόπουλος', deliversTo: ['GR'], line: 'Supermarket: food, personal care and household items.', logo: 'logos/ab-gr.png', logoSize: [120, 60],
      direct: {
        program: 12158, hosts: ['www.ab.gr'],
        sets: [],
        ideas: [
          { title: { el: 'Γλυκά για δώρο', en: 'Sweets to give' }, line: { el: 'Οι σοκολάτες του ΑΒ.', en: 'AB’s chocolates.' }, url: 'https://www.ab.gr/el/eshop/Proino-snacking-and-rofimata/Sokolates/c/009002' },
          { title: { el: 'Για τον λάτρη του καφέ', en: 'For the coffee lover' }, line: { el: 'Ο καφές του ΑΒ.', en: 'AB’s coffee.' }, url: 'https://www.ab.gr/el/eshop/Proino-snacking-and-rofimata/Kafes/c/009011' },
          { title: { el: 'Περιποίηση', en: 'Personal care' }, line: { el: 'Είδη προσωπικής περιποίησης.', en: 'Personal care products.' }, url: 'https://www.ab.gr/el/eshop/Eidi-prosopikis-peripoiisis/c/012' },
          { title: { el: 'Για τα κατοικίδια', en: 'For pets' }, line: { el: 'Τροφές και είδη για κατοικίδια.', en: 'Food and supplies for pets.' }, url: 'https://www.ab.gr/el/eshop/Gia-katoikidia/c/014' }
        ]
      } },
    // Greek stores of the Linkwise network (owner, 21 Nov 2026: "in the email we have many offers for Greece, check and
    // put them all in Mega Stores", lessons L210): the ones that sent offers and are already on the Gear World sites with
    // Greek products, under their names there ("… GR") and the countries of the sites' linkwise-gr.js (checked by chat 3
    // and 7, L199). Shown only to visitors from those countries. Their offers' own texts ("up to -50%") are not shown:
    // no sale or "% off" wording on the sites (L107, L114), and none of them is a code with an end date.
    // Their pages are the showcase Linkwise asked to see (owner, 23 Nov 2026: "with their official logos, as Kotsovolos,
    // Sephora and the rest would go in", "no prices, only bundles and ideas", lessons L221): `logo` is the programme logo
    // of the Linkwise panel (affiliate.linkwi.se, 120x60, its pixels unchanged; only Minipini's XMP text block, which holds
    // ID-like numbers, was left out), and `showcase` gives 2 sets and 3 gift ideas
    // in Greek and English (el / en). Each pick is a search on the store's products on its Gear World site (`site`, else
    // the first of `sites`), tried in order: the first product found, in stock, with a photo, not already on the page.
    // Never a price, a product name we wrote, or an /out/ or /go/ link: every product opens its Gear World product page.
    { slug: 'kouzinika-gr', network: 'linkwise', name: 'Kouzinika GR', sites: ['HGW'], deliversTo: ['GR'], line: 'Kitchenware, tableware and home items.', logo: 'logos/kouzinika-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Το χριστουγεννιάτικο τραπέζι', en: 'The Christmas table' }, line: { el: 'Πιάτα, κούπα και πιατέλα που ταιριάζουν μεταξύ τους.', en: 'Plates, a mug and a platter that go together.' }, picks: [['Χριστουγεννιάτικα Πιάτα', 'Χριστουγεννιάτικο Πιάτο'], ['Χριστουγεννιάτικη Κούπα'], ['Χριστουγεννιάτικη Πιατέλα', 'Χριστουγεννιάτικο Πιατέλα']] },
          { title: { el: 'Πρωινό στο σπίτι', en: 'Breakfast at home' }, line: { el: 'Μεγάλη κούπα, μπολ και γαλατιέρα για το πρώτο γεύμα της μέρας.', en: 'A big mug, a bowl and a milk pan for the first meal of the day.' }, picks: [['Κούπα πρωινού', 'Κούπα'], ['Μπολ Πρωινού', 'Μπολ'], ['Γαλατιέρα']] }
        ],
        ideas: [
          { title: { el: 'Για όποιον παίρνει τον καφέ μαζί του', en: 'For someone who takes their coffee along' }, line: { el: 'Θερμός ποτήρι από ανοξείδωτο ατσάλι.', en: 'A stainless steel travel cup.' }, pick: ['Θερμός Ποτήρι', 'Θερμός'] },
          { title: { el: 'Για όποιον αγαπά το μαγείρεμα', en: 'For someone who loves to cook' }, line: { el: 'Μαντεμένια γάστρα για φαγητά φούρνου.', en: 'A cast-iron pot for oven dishes.' }, pick: ['Lodge Γάστρα', 'Γάστρα Μαντεμένια', 'Γάστρα'] },
          { title: { el: 'Για ένα πιο τακτοποιημένο σπίτι', en: 'For a tidier home' }, line: { el: 'Ψάθινο καλάθι αποθήκευσης.', en: 'A woven storage basket.' }, pick: ['Καλάθι Αποθήκευσης Ψάθινο', 'Καλάθι Ψάθα', 'Καλάθι'] }
        ]
      } },
    { slug: 'katoikein-gr', network: 'linkwise', name: 'Katoikein GR', sites: ['HGW'], deliversTo: ['GR'], line: 'Furniture and home textiles.', logo: 'logos/katoikein-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Ζεστό υπνοδωμάτιο', en: 'A warm bedroom' }, line: { el: 'Φανελένια σεντόνια, παπλωματοθήκη και κουβερλί για τον χειμώνα.', en: 'Flannel sheets, a duvet cover and a quilt for the winter.' }, picks: [['Σεντόνια Φανέλλα', 'Σεντόνια'], ['Παπλωματοθήκη'], ['Κουβερλί']] },
          { title: { el: 'Μπάνιο σαν ξενοδοχείο', en: 'A hotel-style bathroom' }, line: { el: 'Πετσέτες, μπουρνούζι και πατάκι.', en: 'Towels, a bathrobe and a bath mat.' }, picks: [['Σετ πετσέτες μπάνιου', 'Πετσέτα'], ['Μπουρνούζι ενηλ', 'Μπουρνούζι Large', 'Μπουρνούζι'], ['Πατάκι μπάνιου', 'Πατάκι']] }
        ],
        ideas: [
          { title: { el: 'Για τα βράδια στον καναπέ', en: 'For evenings on the sofa' }, line: { el: 'Ριχτάρι για καναπέ ή πολυθρόνα.', en: 'A throw for a sofa or an armchair.' }, pick: ['Ριχτάρι'] },
          { title: { el: 'Για το γιορτινό τραπέζι', en: 'For the festive table' }, line: { el: 'Τραπεζομάντηλο.', en: 'A tablecloth.' }, pick: ['Τραπεζομάντηλο'] },
          { title: { el: 'Για Χριστούγεννα στο σαλόνι', en: 'For Christmas in the living room' }, line: { el: 'Χριστουγεννιάτικο διακοσμητικό μαξιλάρι.', en: 'A Christmas cushion.' }, pick: ['christmas μαξιλαρι', 'μαξιλαρι'] }
        ]
      } },
    { slug: 'minipini-gr', network: 'linkwise', name: 'Minipini GR', sites: ['KGW'], deliversTo: ['GR'], line: 'Toys, puzzles and games for children.', logo: 'logos/minipini-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Παιχνίδι στην κουζίνα', en: 'Play kitchen' }, line: { el: 'Φρούτα, λαχανικά και κουζινικά για παιχνίδι ρόλων.', en: 'Fruit, vegetables and kitchen items for pretend play.' }, picks: [['Σετ λαχανικών'], ['Σετ Φρούτων'], ['Κουζινικ', 'Σετ παγωτά']] },
          { title: { el: 'Ιππότες και νεράιδες', en: 'Knights and fairies' }, line: { el: 'Στολή, κορώνα και ραβδάκι για μεταμφιέσεις.', en: 'A costume, a crown and a wand for dressing up.' }, picks: [['Στολή Ιππότης', 'Στολή'], ['Κορώνα'], ['Ραβδάκι']] }
        ],
        ideas: [
          { title: { el: 'Για μικρούς εξερευνητές', en: 'For little explorers' }, line: { el: 'Ζώνη εξερευνητή για βόλτες στη φύση.', en: 'An explorer belt for walks outdoors.' }, pick: ['ζώνη εξερευνητή', 'Navir'] },
          { title: { el: 'Για ήσυχο ύπνο', en: 'For a calm bedtime' }, line: { el: 'Μουσικό φωτάκι νυκτός.', en: 'A musical night light.' }, pick: ['Night Light'] },
          { title: { el: 'Για όσους αγαπούν τα παζλ', en: 'For puzzle lovers' }, line: { el: 'Παζλ για παιδιά.', en: 'A puzzle for children.' }, pick: ['Παζλ'] }
        ]
      } },
    { slug: 'xxxl-leo-gr', network: 'linkwise', name: 'XXXL Leo GR', sites: ['MGW'], deliversTo: ['GR'], line: 'Men\'s clothing, also in larger sizes.', logo: 'logos/xxxl-leo-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Για το γραφείο', en: 'For the office' }, line: { el: 'Πουκάμισο, παντελόνι chino και γραβάτα, και σε μεγάλα μεγέθη.', en: 'A shirt, chinos and a tie, also in large sizes.' }, picks: [['πουκάμισο μονόχρωμο μακρυμάνικο', 'πουκάμισο'], ['chino παντελόνι', 'chino'], ['γραβάτα']] },
          { title: { el: 'Χαλαρό Σαββατοκύριακο', en: 'An easy weekend' }, line: { el: 'Φούτερ, τζιν και t-shirt.', en: 'A hoodie, jeans and a T-shirt.' }, picks: [['Hoodie', 'φούτερ'], ['Jean'], ['t-shirt']] }
        ],
        ideas: [
          { title: { el: 'Για τον χειμώνα', en: 'For the winter' }, line: { el: 'Πλεκτή μπλούζα.', en: 'A knitted jumper.' }, pick: ['Πλεκτή μπλούζα', 'Πλεκτή'] },
          { title: { el: 'Για κάθε μέρα', en: 'For every day' }, line: { el: 'Μπλούζα polo.', en: 'A polo shirt.' }, pick: ['Polo πικέ', 'Polo'] },
          { title: { el: 'Μικρό δώρο', en: 'A small gift' }, line: { el: 'Βαμβακερές κάλτσες.', en: 'Cotton socks.' }, pick: ['κάλτσα'] }
        ]
      } },
    { slug: 'casualshoes-gr', network: 'linkwise', name: 'CasualShoes GR', sites: ['MGW'], deliversTo: ['GR'], line: 'Shoes and watches.', logo: 'logos/casualshoes-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Ρολόι και αξεσουάρ', en: 'A watch and accessories' }, line: { el: 'Ρολόι, βραχιόλι και μπρελόκ.', en: 'A watch, a bracelet and a key ring.' }, picks: [['Ρολόι'], ['Βραχιόλι'], ['Μπρελόκ', 'KEYRING']] },
          { title: { el: 'Βόλτα στην πόλη', en: 'A walk in town' }, line: { el: 'Sneakers, loafers και σκουφάκι.', en: 'Sneakers, loafers and a beanie.' }, picks: [['SNEAKER'], ['LOAFER'], ['ΣΚΟΥΦΑΚΙ']] }
        ],
        ideas: [
          { title: { el: 'Για τα ταξίδια', en: 'For travel' }, line: { el: 'Σακίδιο πλάτης.', en: 'A backpack.' }, pick: ['Rucksack', 'BACKPACK'] },
          { title: { el: 'Για τον χειμώνα', en: 'For the winter' }, line: { el: 'Ανδρικά μποτάκια.', en: 'Men’s boots.' }, pick: ['ΜΠΟΤΑΚΙ'] },
          { title: { el: 'Για την τσέπη', en: 'For the pocket' }, line: { el: 'Πορτοφόλι.', en: 'A wallet.' }, pick: ['WALLET', 'Πορτοφόλι'] }
        ]
      } },
    { slug: 'parex-gr', network: 'linkwise', name: 'Parex GR', sites: ['MGW'], deliversTo: ['GR', 'CY'], line: 'Shoes, wallets and socks.', logo: 'logos/parex-gr.jpg', logoSize: [120, 60],
      showcase: {
        sets: [
          { title: { el: 'Μικρά δώρα', en: 'Small gifts' }, line: { el: 'Πορτοφόλι, κάλτσες και παντόφλες.', en: 'A wallet, socks and slippers.' }, picks: [['Πορτοφόλι'], ['Happy Socks', 'Κάλτσες'], ['Παντόφλες Σπιτιού', 'Παντόφλες']] },
          { title: { el: 'Δερμάτινα για κάθε μέρα', en: 'Leather for every day' }, line: { el: 'Casual παπούτσια, μποτάκια και loafers από δέρμα.', en: 'Casual shoes, boots and loafers in leather.' }, picks: [['Δερμάτινα Casual Παπούτσια'], ['Δερμάτινα Μποτάκια'], ['Δερμάτινα Loafer', 'Loafer']] }
        ],
        ideas: [
          { title: { el: 'Για τον αθλητικό τύπο', en: 'For a sporty type' }, line: { el: 'Αθλητικά παπούτσια.', en: 'Trainers.' }, pick: ['Skechers', 'Αθλητικά Παπούτσια'] },
          { title: { el: 'Για ξεχωριστές στιγμές', en: 'For special occasions' }, line: { el: 'Δερμάτινα αμπιγιέ παπούτσια.', en: 'Leather dress shoes.' }, pick: ['Αμπιγιέ'] },
          { title: { el: 'Για άνεση', en: 'For comfort' }, line: { el: 'Μοκασίνια.', en: 'Moccasins.' }, pick: ['Μοκασίνια'] }
        ]
      } },
    { slug: 'tsakiris-mallas-gr', network: 'linkwise', name: 'Tsakiris Mallas GR', sites: ['MGW', 'WGW'], deliversTo: ['GR', 'CY'], line: 'Shoes and bags.', logo: 'logos/tsakiris-mallas-gr.png', logoSize: [120, 60],
      showcase: {
        sets: [
          { site: 'WGW', title: { el: 'Για μια βραδινή έξοδο', en: 'For an evening out' }, line: { el: 'Γόβες, τσάντα χειρός και mules.', en: 'Heels, a handbag and mules.' }, picks: [['ΓΟΒΕΣ'], ['ΤΣΑΝΤΕΣ ΧΕΙΡΟΣ'], ['MULES']] },
          { site: 'MGW', title: { el: 'Για εκείνον', en: 'For him' }, line: { el: 'Loafers, τσάντα μέσης και sneakers.', en: 'Loafers, a belt bag and sneakers.' }, picks: [['LOAFERS'], ['ΤΣΑΝΤΑ ΜΕΣΗΣ'], ['SNEAKERS']] }
        ],
        ideas: [
          { site: 'WGW', title: { el: 'Για τον χειμώνα', en: 'For the winter' }, line: { el: 'Γυναικεία μποτάκια.', en: 'Women’s ankle boots.' }, pick: ['ΜΠΟΤΑΚΙΑ'] },
          { site: 'WGW', title: { el: 'Για κάθε μέρα', en: 'For every day' }, line: { el: 'Τσάντα tote.', en: 'A tote bag.' }, pick: ['TOTE'] },
          { site: 'MGW', title: { el: 'Για τα ταξίδια', en: 'For travel' }, line: { el: 'Ανδρική τσάντα χιαστί.', en: 'A men’s cross-body bag.' }, pick: ['CROSS BODY'] }
        ]
      } }
  ],
  // Black Friday 2026 (Friday 27 Nov), Cyber Monday (Monday 30 Nov) and Christmas: the countdown line and the Black Friday
  // block of the home page (until the end of Cyber Monday). Never a promise of discounts.
  blackFriday: '2026-11-27',
  cyberMonday: '2026-11-30',
  christmas: '2026-12-25',
  // The retailers that have started their Black Friday and their codes: the Hub's black-friday.json (L188, L195).
  // The networks whose stores are hidden everywhere on this site until the network approves megastoresgearworld.com as a
  // page that shows its stores (owner, 22 Nov 2026, "we will declare it but we will hide it", lessons L215; their visitors'
  // countries then get "no store listed for your country"). Linkwise approved it on 23 Nov 2026 (email "Your account
  // changes were approved"), so the list is empty: the 7 Greek stores above are back for Greece and Cyprus, and at /gr/.
  hiddenNetworks: [],
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
        { name: 'Multi-tool', why: 'Pliers, screwdrivers and a blade in one. UK law: in public, only a folding blade up to 3 inches that does not lock, unless there is a good reason. Not sold to under-18s.',
          whyAbroad: 'Pliers, screwdrivers and a blade in one. Check the local rules on carrying a blade in public and the minimum age to buy one.', q: 'multi tool pliers', gw: 'MGW', cat: 'everyday-carry' },
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
        { name: 'Hair styler', why: 'Stylers with several heat settings let you use less heat. Check the plug is a UK plug.',
          whyAbroad: 'Stylers with several heat settings let you use less heat. Check the plug fits the sockets where you live.', q: 'hair styler uk plug', gw: 'WGW', cat: 'beauty-fragrances' },
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
      introAbroad: 'Written for parents and relatives. Always check the age on the box and the safety marks before you choose.',
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
