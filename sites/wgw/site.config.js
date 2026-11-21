// Women's Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';
import { networkFor } from '../../promos/network.js';
// bol.com (NL and BE only, Dutch names, lessons L204): sites/_shared/bol.js.
import { bolDelivery, BOL_SITES } from '../_shared/bol.js';
import { LINKWISE_GR } from './linkwise-gr.js';
import guides from './guides.js';

const BOL = bolDelivery(BOL_SITES.wgw);

export default {
  code: 'WGW',
  name: "Women's Gear World",
  shortName: "Women's Gear World",
  domain: 'womensgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-11-21-wgw-au-1',
  promos: promosFor('WGW'),
  // Buying guides (/guides/, lessons L82): words in guides.js, prices and stock live from the database.
  guides,
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'wgw',

  // The site keeps the database it already has (lessons L28); the Hub import router keeps writing to it.
  // The old site had no category pages (categories were buttons on the home page), so these addresses are new.
  database: {
    layout: 'legacy',
    categories: {
      clothing: ['Clothing'],
      watches: ['Watches', 'Jewellery & Watches'],
      jewellery: ["Women's Jewellery"],
      shoes: ['Shoes'],
      'bags-accessories': ['Bags & Accessories', 'Bags'],
      'beauty-fragrances': ['Beauty & Fragrances'],
      'everyday-essentials': ['Everyday Carry / EDC']
    },
    // The same shop comes in under two names from two feeds; shown once, with its usual name.
    // "100 Percent Pure": the database name of 100% PURE has no "%", which the import tools cannot pass to wrangler (lessons
    // L63); visitors see the shop's real name.
    retailerNames: {
      'Watch Enclave Affiliate Programme': 'Watch Enclave',
      'Joybuy UK': 'Joybuy',
      'Opulensi Perfumes Lattafa Sapil Anfar': 'Opulensi Perfumes',
      '100 Percent Pure': '100% PURE'
    }
  },

  // Same product (same EAN) from several retailers: one card, and a price table on its page.
  groupOffers: true,

  // Countries that see only the retailers that deliver there instead of the UK view with its bar (lessons L107); none yet.
  strictCountries: [],
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
  // Where the retailers deliver (lessons L62): every product card and product page says it, so a visitor from
  // any country sees at once whether they can order. default: every retailer not named in retailers.
  // Country codes: src/lib/delivery.js. The other retailers are UK shops. 100% PURE (100percentpure.de, lessons L63)
  // delivers to Germany and nearly all of the EU, Switzerland and Norway, not to the UK (100percentpure.de/Versand-Lieferung,
  // read 25 Oct 2026). The key is the name visitors see (after retailerNames).
  // Massive import round 2b (14 Nov 2026, lessons L107): European shops, each with the countries of its own shipping page (L62).
  // US: shops whose shipping page (read 13-14 Nov 2026, L62) ships within the United States only; the US view (L141).
  // MASON New York (about 200 countries) and Needs No Label (the UK, 10 EU countries, Norway, the US, Canada, Australia,
  // New Zealand) ship to the UK and the US: both views. Needs No Label's EU countries are not listed yet (one more page copy
  // per country group, L107); its cards say the UK and the US.
  // Ireland: Bazta IE and Plusshop IE (ie.bazta.com, ie.plusshop.com, read 14 Nov 2026: "only delivered to addresses in
  // Ireland"; round 2c, L144).
  // Uhrcenter (uhrcenter.de ships to the UK, the EU and more, not the US; read 14 Nov 2026): its names are German, so only
  // where German is spoken (round 2c, L144).
  // Invicta Stores (invictastores.eu, Daisycon, euros; read 15 Nov 2026): Europe but Spain and Portugal; kept out of the UK
  // view because the shop is "not responsible for any customs duties or taxes" outside the EU (round 3, L147).
  // AliExpress PL (Awin 12044, pl.aliexpress.com, Polish names, prices in zloty): Poland only, so only the Poland view
  // shows it (owner, 15 Nov 2026, lessons L157); its prices get "≈ £…" (foreignCurrencies PLN).
  // Uhrcenter's feed is in German: only visitors from the German-speaking countries it delivers to see it (lessons L165).
  deliversTo: { default: ['GB'], retailers: { 'AliExpress PL': ['PL'], 'Bazta IE': ['IE'], 'Plusshop IE': ['IE'], Uhrcenter: ['DE', 'AT', 'CH', 'LI', 'LU'], '100% PURE': ['EU', 'CH', 'NO'], FOREO: ['EU'], Jeulia: ['US'], 'Dream Pairs': ['US'],
    'Invicta Stores': ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'RO', 'SE', 'SI', 'SK', 'CH', 'NO', 'IS'],
    'MASON New York': ['GB', 'US'], 'Needs No Label': ['GB', 'US'],
    // Mass import round 2 (15 Nov 2026, lessons L164): US shops and TEMU's US feed only to the US; Xpluswear (euros) only to the EU.
    TEMU: ['US'], 'Dima Eyewear': ['US'], 'Grey State': ['US'], Kixies: ['US'], Xpluswear: ['EU'],
    // Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171): the US shops only to the US.
    PandaHall: ['US'], Lensmart: ['US'], Ublins: ['US'], Deluvia: ['US'], 'FragranceShop.com': ['US'],
    Perfumania: ['US'], 'Fragrance Outlet': ['US'], eCosmetics: ['US'], 'Amore Mall': ['US'], eFootwear: ['US'],
    'NORTIV 8': ['US'], 'TSAR BOMBA': ['US'], Chamaripa: ['US'],
    // Linkwise (Greece and Cyprus, lessons L199): ./linkwise-gr.js.
    ...LINKWISE_GR.retailers, ...BOL.retailers }, languages: { Uhrcenter: 'de', ...LINKWISE_GR.languages, ...BOL.languages } },
  // 100% PURE sells in euros: its prices stay in euros, with "≈ £…" next to them (lessons L25, L63). MASON New York sells
  // in US dollars and is in the UK view: foreignCurrencies fetches that rate too ("≈ £…", as GRABO on CGW).
  convertForeignPrices: true,
  foreignCurrencies: ['USD', 'PLN'],
  // Lessons L107: a UK visitor sees UK retailers only, so the texts no longer say "retailers in the UK and Europe".
  retailersFromEurope: false,
  displayCurrencies: ['GBP', 'EUR', 'PLN', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Saved list', maxItems: 30 },
  voiceSearch: true,

  // Gear World family look in deep plum and rose gold.
  themeColor: '#1a0f18',
  cssColorMap: {
    '#0a1222': '#1a0f18',
    '#060b16': '#10080f',
    '#0f1b30': '#241521',
    '#14243f': '#2e1b2a',
    '#22344f': '#4a2e43',
    '#e8edf5': '#f6edf0',
    '#a9b6c8': '#cdb6c1',
    '#6cc8ff': '#f5b8c8',
    '#f2b84b': '#eeae8f',
    '#ffd27a': '#f7cdb7',
    '#f3f5f8': '#faf4f5',
    '#dde3ea': '#ecdde2',
    '#111a28': '#24141f',
    '#4b5666': '#6a5462',
    '#1747d1': '#a2456a',
    '#0d1e3b': '#2a1424',
    '#10284d': '#3a1c33',
    '#050912': '#0a0509',
    '#dbe3ee': '#efe2e8',
    '#c9d3e0': '#e0cfd7',
    '#c3cdda': '#dbc8d1',
    '#b6c2d2': '#d0bcc6',
    'rgba(6, 11, 22,': 'rgba(16, 8, 15,',
    'rgba(10, 18, 34,': 'rgba(26, 15, 24,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for women',
  // No hero photo yet (the old site used the Men's Gear World one, lessons L13). Category photos: the site's own.
  heroImage: null,
  categoryImages: true,

  homeTitle: "Women's Gear World | Compare Women's Clothing, Jewellery, Watches & Beauty",
  homeDescription:
    "Compare prices on women's clothing, jewellery, watches, shoes, bags and beauty across retailers. Independent price comparison: find the deal, then buy direct.",
  heroTitle: "Compare women's fashion prices in one place",
  heroText: 'Clothing, jewellery, watches, shoes, bags and beauty in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search dresses, necklaces, perfume...',
  topic: "women's fashion",
  topicTitle: "Women's Fashion",
  topicLong: "women's",

  contactEmail: 'contact@womensgearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  // The other 12 Gear World sites, from the one shared list (promos/network.js, lessons L99).
  network: networkFor('WGW'),

  categories: [
    {
      slug: 'clothing', name: 'Clothing', nav: 'Clothing', short: 'clothing', icon: 'home',
      intro: 'Tops, dresses, jeans, jackets, knitwear and socks. Compare prices across retailers before you buy.',
      description: "Compare prices on women's tops, dresses, jeans, jackets, knitwear and socks across retailers."
    },
    {
      slug: 'watches', name: 'Watches', nav: 'Watches', short: 'watches', icon: 'watch',
      intro: 'Dress watches, everyday watches and smartwatches. See the price at each retailer before you choose.',
      description: "Compare women's watch and smartwatch prices across retailers."
    },
    {
      slug: 'jewellery', name: "Women's Jewellery", nav: 'Jewellery', short: 'jewellery', icon: 'home',
      intro: 'Necklaces, bracelets, earrings and rings in gold, silver and crystal.',
      description: "Compare prices on women's necklaces, bracelets, earrings and rings across retailers."
    },
    {
      slug: 'shoes', name: 'Shoes', nav: 'Shoes', short: 'shoes', icon: 'home',
      intro: 'Trainers, everyday shoes, boots and slippers.',
      description: "Compare prices on women's trainers, shoes, boots and slippers across retailers."
    },
    {
      slug: 'bags-accessories', name: 'Bags & Accessories', nav: 'Bags', short: 'bags and accessories', icon: 'home',
      intro: 'Handbags, totes, backpacks, sunglasses and other accessories.',
      description: "Compare prices on women's handbags, totes, backpacks and sunglasses across retailers."
    },
    {
      slug: 'beauty-fragrances', name: 'Beauty & Fragrances', nav: 'Beauty', short: 'beauty and fragrances', icon: 'home',
      intro: 'Perfume, eau de parfum, perfume oils and beauty tools.',
      description: "Compare prices on women's perfume, eau de parfum and beauty tools across retailers."
    },
    {
      slug: 'everyday-essentials', name: 'Everyday Essentials', nav: 'Essentials', short: 'everyday essentials', icon: 'plug',
      intro: 'Torches, multi-tools and handy gear for home, travel and every day.',
      description: 'Compare prices on torches, multi-tools and everyday gear across retailers.'
    },
    {
      slug: 'gifts-for-her', name: 'Gifts for Her', nav: 'Gifts', short: 'gifts', icon: 'home',
      intro: 'Gift ideas from £15 to £150: jewellery, watches, perfume and bags, plus gift sets. Compare prices across retailers before you buy.',
      description: "Gift ideas for her from £15 to £150: women's jewellery, watches, perfume, bags and gift sets, with prices across retailers.",
      // A collection: products from these categories in this price range, plus anything named "gift".
      collection: { from: ['jewellery', 'watches', 'beauty-fragrances', 'bags-accessories'], minPrice: 15, maxPrice: 150, words: ['gift'] }
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'KGW', 'HGW', 'TGW', 'GGW', 'WGW', 'CGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", 'trade or profession'
  ]
};
