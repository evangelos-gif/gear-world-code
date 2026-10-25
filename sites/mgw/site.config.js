// Men's Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'MGW',
  name: "Men's Gear World",
  shortName: "Men's Gear World",
  domain: 'mensgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-25-mgw-ship-1',
  promos: promosFor('MGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'mgw',

  // The site keeps the database it already has (lessons L28); the Hub import router keeps writing to it.
  // The old site had no category pages (categories were buttons on the home page), so these addresses are new.
  database: {
    layout: 'legacy',
    categories: {
      clothing: ['Clothing'],
      watches: ['Watches'],
      jewellery: ["Men's Jewellery"],
      shoes: ['Shoes'],
      'everyday-carry': ['Everyday Carry / EDC'],
      'bags-accessories': ['Bags & Accessories'],
      'grooming-fragrances': ['Grooming & Fragrances']
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
  // Where the retailers deliver (lessons L62): every product card and product page says it, so a visitor from
  // any country sees at once whether they can order. default: every retailer not named in retailers.
  // Country codes: src/lib/delivery.js. All the retailers here are UK shops except Wavytalk:
  // wavytalk.com sells in US dollars and ships within the United States; only a few products go abroad
  // (wavytalk.com/policies/shipping-policy, 25 Oct 2026).
  deliversTo: { default: ['GB'], retailers: { Wavytalk: ['US'] } },
  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
  voiceSearch: true,

  // Gear World family look in black and gold, like the Men's Gear World logo.
  themeColor: '#0b0b0d',
  cssColorMap: {
    '#0a1222': '#0b0b0d',
    '#060b16': '#060607',
    '#0f1b30': '#151518',
    '#14243f': '#1c1c21',
    '#22344f': '#2e2c28',
    '#e8edf5': '#f1eee8',
    '#a9b6c8': '#bdb6a8',
    '#6cc8ff': '#f0d9a0',
    '#f3f5f8': '#f6f4ef',
    '#dde3ea': '#e4dfd4',
    '#111a28': '#16140f',
    '#4b5666': '#5a554b',
    '#1747d1': '#8a6417',
    '#0d1e3b': '#17140c',
    '#10284d': '#2a2210',
    '#050912': '#050505',
    '#dbe3ee': '#e8e2d6',
    '#c9d3e0': '#d6cfc2',
    '#c3cdda': '#cfc8ba',
    '#b6c2d2': '#c4bcac',
    'rgba(6, 11, 22,': 'rgba(6, 6, 7,',
    'rgba(10, 18, 34,': 'rgba(11, 11, 13,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for men',
  // Hero and category photos: the site's own images (docs/IMAGE-CREDITS.md).
  heroImage: { src: 'img/hero-1672.webp', small: 'img/hero-960.webp', width: 1672, height: 941 },
  categoryImages: true,

  homeTitle: "Men's Gear World | Compare Men's Clothing, Watches, Jewellery & Grooming",
  homeDescription:
    "Compare prices on men's clothing, watches, jewellery, shoes, grooming and everyday carry from trusted retailers. Independent price comparison: find the deal, then buy direct.",
  heroTitle: "Compare men's gear prices in one place",
  heroText: 'Clothing, watches, jewellery, shoes, grooming and everyday carry in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search watches, jackets, rings...',
  topic: "men's gear",
  topicTitle: "Men's Gear",
  topicLong: "men's",

  contactEmail: 'contact@mensgearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  categories: [
    {
      slug: 'clothing', name: 'Clothing', nav: 'Clothing', short: 'clothing', icon: 'home',
      intro: 'T-shirts, hoodies, shirts, trousers, jackets and socks, from streetwear to workwear. Compare prices across retailers before you buy.',
      description: "Compare prices on men's T-shirts, hoodies, shirts, trousers, jackets and socks from trusted retailers."
    },
    {
      slug: 'watches', name: 'Watches', nav: 'Watches', short: 'watches', icon: 'watch',
      intro: 'Chronographs, dress watches, sports watches and smartwatches. See the price at each retailer before you choose.',
      description: "Compare men's watch prices: chronographs, dress watches, sports watches and smartwatches from trusted retailers."
    },
    {
      slug: 'jewellery', name: "Men's Jewellery", nav: 'Jewellery', short: 'jewellery', icon: 'home',
      intro: 'Rings, wedding bands, chains, bracelets and necklaces in gold, silver and steel.',
      description: "Compare prices on men's rings, wedding bands, chains, bracelets and necklaces from trusted retailers."
    },
    {
      slug: 'shoes', name: 'Shoes', nav: 'Shoes', short: 'shoes', icon: 'home',
      intro: 'Trainers, running shoes, boots and slippers.',
      description: "Compare prices on men's trainers, running shoes, boots and slippers from trusted retailers."
    },
    {
      slug: 'everyday-carry', name: 'Everyday Carry / EDC', nav: 'EDC', short: 'everyday carry', icon: 'plug',
      intro: 'Torches, multi-tools, wallets and pocket gear for every day.',
      description: 'Compare prices on EDC torches, multi-tools, wallets and pocket gear from trusted retailers.'
    },
    {
      slug: 'bags-accessories', name: 'Bags & Accessories', nav: 'Bags', short: 'bags and accessories', icon: 'home',
      intro: 'Bags, wallets, sunglasses, belts and other accessories.',
      description: "Compare prices on men's bags, wallets, sunglasses and belts from trusted retailers."
    },
    {
      slug: 'grooming-fragrances', name: 'Grooming & Fragrances', nav: 'Grooming', short: 'grooming and fragrances', icon: 'home',
      intro: 'Shavers, trimmers, aftershave, perfume and perfume oils.',
      description: "Compare prices on men's shavers, trimmers, aftershave and perfume from trusted retailers."
    },
    {
      slug: 'gifts-for-him', name: 'Gifts for Him', nav: 'Gifts', short: 'gifts', icon: 'home',
      intro: 'Gift ideas from £15 to £150: watches, jewellery, fragrances, everyday carry and bags, plus gift sets. Compare prices across retailers before you buy.',
      description: "Gift ideas for him from £15 to £150: men's watches, jewellery, fragrances, everyday carry, bags and gift sets from trusted retailers.",
      // A collection: products from these categories in this price range, plus anything named "gift".
      collection: { from: ['watches', 'jewellery', 'grooming-fragrances', 'everyday-carry', 'bags-accessories'], minPrice: 15, maxPrice: 150, words: ['gift'] }
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'KGW', 'HGW', 'TGW', 'GGW', 'WGW', 'CGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Women's Gear", 'trade or profession'
  ]
};
