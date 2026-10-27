// Home Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'HGW',
  name: 'Home Gear World',
  shortName: 'Home Gear World',
  domain: 'homegearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-28-hgw-season-1',
  promos: promosFor('HGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'hgw',

  // The site keeps the database it already has (lessons L28); the Hub import router keeps writing to it.
  // Product addresses stay the same as on the old site: /product/<name>-<id>/.
  database: {
    layout: 'legacy',
    categories: {
      furniture: ['Furniture'],
      'kitchen-dining': ['Kitchen & Dining'],
      'home-appliances': ['Home Appliances'],
      'bedding-bath': ['Bedding & Bath'],
      'home-decor': ['Home Decor'],
      lighting: ['Lighting'],
      'storage-organisation': ['Storage & Organisation'],
      'cleaning-laundry': ['Cleaning & Laundry'],
      'smart-home': ['Smart Home'],
      'home-office': ['Home Office']
    },
    retailerNames: {
      'Joybuy UK': 'Joybuy'
    }
  },

  // Same product (same EAN) from several retailers: one card, and a price table on its page.
  groupOffers: true,

  languages: [
    { code: 'en-GB', label: 'English' },
    { code: 'el-GR', label: 'Ελληνικά' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'it-IT', label: 'Italiano' },
    { code: 'es-ES', label: 'Español' },
    { code: 'pt-PT', label: 'Português' },
    { code: 'nl-NL', label: 'Nederlands' },
    { code: 'sq-AL', label: 'Shqip' },
    { code: 'ro-RO', label: 'Română' },
    { code: 'ru-RU', label: 'Русский' }
  ],
  // Where the retailers deliver (lessons L62): every product card and product page says it, so a visitor from
  // any country sees at once whether they can order. default: every retailer not named in retailers.
  // Country codes: src/lib/delivery.js. All the retailers here are UK shops.
  deliversTo: { default: ['GB'] },
  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
  voiceSearch: true,

  // Gear World family look in midnight navy with warm gold, like the Home Gear World logo and photos.
  themeColor: '#07101d',
  cssColorMap: {
    '#0a1222': '#07101d',
    '#060b16': '#050b15',
    '#0f1b30': '#0b1f33',
    '#14243f': '#102a44',
    '#22344f': '#1d3a5c',
    '#e8edf5': '#eef2f7',
    '#a9b6c8': '#aeb9c7',
    '#6cc8ff': '#7cc0ff',
    '#f2b84b': '#d6a94c',
    '#ffd27a': '#f0cf82',
    '#1747d1': '#1667d8',
    '#0d1e3b': '#0b1f33',
    '#10284d': '#08275f',
    'rgba(6, 11, 22,': 'rgba(5, 11, 21,',
    'rgba(10, 18, 34,': 'rgba(7, 16, 29,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for your home',
  // The old site's hero is a small banner with its logo printed on it, so the hero uses the theme only.
  // Category photos are the site's own images, without their printed titles (docs/IMAGE-CREDITS.md).
  heroImage: null,
  categoryImages: true,

  homeTitle: 'Home Gear World | Compare Furniture, Appliances, Lighting & Home Essentials',
  homeDescription:
    'Compare prices on furniture, kitchen and dining, home appliances, bedding, decor, lighting, storage, cleaning, smart home and home office from trusted retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare home gear prices in one place',
  heroText: 'Furniture, appliances, lighting, bedding, decor and home office in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search sofas, lamps, air fryers...',
  topic: 'home gear',
  topicTitle: 'Home Gear',
  topicLong: 'home',

  contactEmail: 'contact@homegearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  categories: [
    {
      slug: 'furniture', name: 'Furniture', nav: 'Furniture', short: 'furniture', icon: 'home',
      intro: 'Sofas, chairs, tables, beds, shelving and outdoor furniture. Compare prices across retailers before you buy.',
      description: 'Compare prices on sofas, chairs, tables, beds, shelving and outdoor furniture from trusted retailers.'
    },
    {
      slug: 'kitchen-dining', name: 'Kitchen & Dining', nav: 'Kitchen', short: 'kitchen and dining', icon: 'home',
      intro: 'Cookware, knives, tableware, glasses, kitchen storage and small kitchen helpers.',
      description: 'Compare prices on cookware, knives, tableware, glasses and kitchen storage from trusted retailers.'
    },
    {
      slug: 'home-appliances', name: 'Home Appliances', nav: 'Appliances', short: 'home appliances', icon: 'plug',
      intro: 'Air fryers, kettles, coffee machines, vacuum cleaners, fans and heaters.',
      description: 'Compare prices on air fryers, kettles, coffee machines, vacuum cleaners, fans and heaters from trusted retailers.'
    },
    {
      slug: 'bedding-bath', name: 'Bedding & Bath', nav: 'Bedding', short: 'bedding and bath', icon: 'home',
      intro: 'Duvets, pillows, bed linen, throws, towels and bathroom accessories.',
      description: 'Compare prices on duvets, pillows, bed linen, throws, towels and bathroom accessories from trusted retailers.'
    },
    {
      slug: 'home-decor', name: 'Home Decor', nav: 'Decor', short: 'home decor', icon: 'home',
      intro: 'Cushions, mirrors, wall art, vases, candles, clocks and artificial plants.',
      description: 'Compare prices on cushions, mirrors, wall art, vases, candles and clocks from trusted retailers.'
    },
    {
      slug: 'lighting', name: 'Lighting', nav: 'Lighting', short: 'lighting', icon: 'home',
      intro: 'Ceiling lights, table and floor lamps, LED strips, wall lights and outdoor lighting.',
      description: 'Compare prices on ceiling lights, table and floor lamps, LED strips and outdoor lighting from trusted retailers.'
    },
    {
      slug: 'storage-organisation', name: 'Storage & Organisation', nav: 'Storage', short: 'storage and organisation', icon: 'home',
      intro: 'Boxes, baskets, shelves, wardrobe organisers, shoe racks and hooks.',
      description: 'Compare prices on storage boxes, baskets, shelves, wardrobe organisers and shoe racks from trusted retailers.'
    },
    {
      slug: 'cleaning-laundry', name: 'Cleaning & Laundry', nav: 'Cleaning', short: 'cleaning and laundry', icon: 'home',
      intro: 'Mops, brushes, laundry baskets, airers, ironing boards and cleaning tools.',
      description: 'Compare prices on mops, brushes, laundry baskets, airers, ironing boards and cleaning tools from trusted retailers.'
    },
    {
      slug: 'smart-home', name: 'Smart Home', nav: 'Smart Home', short: 'smart home gear', icon: 'plug',
      intro: 'Smart plugs, bulbs, cameras, doorbells, sensors and thermostats.',
      description: 'Compare prices on smart plugs, bulbs, cameras, doorbells, sensors and thermostats from trusted retailers.'
    },
    {
      slug: 'home-office', name: 'Home Office', nav: 'Office', short: 'home office gear', icon: 'home',
      intro: 'Desks, office chairs, monitor stands, desk lamps, stationery and storage.',
      description: 'Compare prices on desks, office chairs, monitor stands, desk lamps, stationery and storage from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'MGW', 'WGW', 'KGW', 'TGW', 'GGW', 'CGW',
    'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'trade or profession'
  ]
};
