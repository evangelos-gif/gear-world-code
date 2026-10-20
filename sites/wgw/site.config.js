// Women's Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'WGW',
  name: "Women's Gear World",
  shortName: "Women's Gear World",
  domain: 'womensgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-20-wgw-2',
  promos: promosFor('WGW'),
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
    retailerNames: {
      'Watch Enclave Affiliate Programme': 'Watch Enclave',
      'Joybuy UK': 'Joybuy',
      'Opulensi Perfumes Lattafa Sapil Anfar': 'Opulensi Perfumes'
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
  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
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
    "Compare prices on women's clothing, jewellery, watches, shoes, bags and beauty from trusted retailers. Independent price comparison: find the deal, then buy direct.",
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
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  categories: [
    {
      slug: 'clothing', name: 'Clothing', nav: 'Clothing', short: 'clothing', icon: 'home',
      intro: 'Tops, dresses, jeans, jackets, knitwear and socks. Compare prices across retailers before you buy.',
      description: "Compare prices on women's tops, dresses, jeans, jackets, knitwear and socks from trusted retailers."
    },
    {
      slug: 'watches', name: 'Watches', nav: 'Watches', short: 'watches', icon: 'watch',
      intro: 'Dress watches, everyday watches and smartwatches. See the price at each retailer before you choose.',
      description: "Compare women's watch and smartwatch prices from trusted retailers."
    },
    {
      slug: 'jewellery', name: "Women's Jewellery", nav: 'Jewellery', short: 'jewellery', icon: 'home',
      intro: 'Necklaces, bracelets, earrings and rings in gold, silver and crystal.',
      description: "Compare prices on women's necklaces, bracelets, earrings and rings from trusted retailers."
    },
    {
      slug: 'shoes', name: 'Shoes', nav: 'Shoes', short: 'shoes', icon: 'home',
      intro: 'Trainers, everyday shoes, boots and slippers.',
      description: "Compare prices on women's trainers, shoes, boots and slippers from trusted retailers."
    },
    {
      slug: 'bags-accessories', name: 'Bags & Accessories', nav: 'Bags', short: 'bags and accessories', icon: 'home',
      intro: 'Handbags, totes, backpacks, sunglasses and other accessories.',
      description: "Compare prices on women's handbags, totes, backpacks and sunglasses from trusted retailers."
    },
    {
      slug: 'beauty-fragrances', name: 'Beauty & Fragrances', nav: 'Beauty', short: 'beauty and fragrances', icon: 'home',
      intro: 'Perfume, eau de parfum, perfume oils and beauty tools.',
      description: "Compare prices on women's perfume, eau de parfum and beauty tools from trusted retailers."
    },
    {
      slug: 'everyday-essentials', name: 'Everyday Essentials', nav: 'Essentials', short: 'everyday essentials', icon: 'plug',
      intro: 'Torches, multi-tools and handy gear for home, travel and every day.',
      description: 'Compare prices on torches, multi-tools and everyday gear from trusted retailers.'
    },
    {
      slug: 'gifts-for-her', name: 'Gifts for Her', nav: 'Gifts', short: 'gifts', icon: 'home',
      intro: 'Gift ideas from £15 to £150: jewellery, watches, perfume and bags, plus gift sets. Compare prices across retailers before you buy.',
      description: "Gift ideas for her from £15 to £150: women's jewellery, watches, perfume, bags and gift sets from trusted retailers.",
      // A collection: products from these categories in this price range, plus anything named "gift".
      collection: { from: ['jewellery', 'watches', 'beauty-fragrances', 'bags-accessories'], minPrice: 15, maxPrice: 150, words: ['gift'] }
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'KGW', 'HGW', 'TGW', 'GGW', 'WGW', 'CGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", 'trade or profession', 'everyday carry'
  ]
};
