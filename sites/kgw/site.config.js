// Kids' Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// A site for parents: products, words and pictures must suit a family audience.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'KGW',
  name: "Kids' Gear World",
  shortName: "Kids' Gear World",
  domain: 'kidsgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-28-kgw-season-1',
  promos: promosFor('KGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'kgw',

  // The site keeps the database it already has (lessons L28); the Hub import router keeps writing to it.
  // Product addresses stay the same as on the old site: /product/<name>-<id>/.
  database: {
    layout: 'legacy',
    categories: {
      clothing: ['Clothing'],
      'baby-toddler': ['Baby & Toddler'],
      'toys-games': ['Toys & Games'],
      'sports-outdoors': ['Sports & Outdoors'],
      'kids-tech': ['Kids Tech'],
      'bedroom-home': ['Bedroom & Home'],
      accessories: ['Accessories'],
      shoes: ['Shoes'],
      'gifts-for-kids': ['Gifts for Kids'],
      'school-backpacks': ['School & Backpacks']
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

  // Gear World family look in deep indigo with sunshine yellow and sky blue, like the Kids' Gear World logo.
  themeColor: '#15123a',
  cssColorMap: {
    '#0a1222': '#15123a',
    '#060b16': '#0c0a26',
    '#0f1b30': '#1e1a4d',
    '#14243f': '#26215c',
    '#22344f': '#3a3475',
    '#e8edf5': '#eeedfb',
    '#a9b6c8': '#bcb9de',
    '#6cc8ff': '#7fd8ff',
    '#f2b84b': '#ffc83d',
    '#ffd27a': '#ffe08a',
    '#f3f5f8': '#f6f5fd',
    '#dde3ea': '#e2e0f2',
    '#111a28': '#17143a',
    '#4b5666': '#4f4b70',
    '#1747d1': '#4a3fd1',
    '#0d1e3b': '#1d1850',
    '#10284d': '#2a2368',
    '#050912': '#07061a',
    '#dbe3ee': '#e4e2f6',
    '#c9d3e0': '#d0cdea',
    '#c3cdda': '#cac7e6',
    '#b6c2d2': '#bdb9de',
    'rgba(6, 11, 22,': 'rgba(12, 10, 38,',
    'rgba(10, 18, 34,': 'rgba(21, 18, 58,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for parents',
  // Hero and category photos: the site's own images, without their printed text (docs/IMAGE-CREDITS.md).
  heroImage: { src: 'img/hero-1672.webp', small: 'img/hero-960.webp', width: 1672, height: 941 },
  categoryImages: true,

  homeTitle: "Kids' Gear World | Compare Kids' Clothing, Toys, Baby Gear & Tech",
  homeDescription:
    "Compare prices on kids' clothing, toys and games, baby and toddler gear, shoes, sports, kids' tech and school bags from trusted retailers. Independent price comparison: find the deal, then buy direct.",
  heroTitle: "Compare kids' gear prices in one place",
  heroText: 'Clothing, toys, baby gear, shoes, sports and school bags in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search toys, hoodies, scooters...',
  topic: "kids' gear",
  topicTitle: "Kids' Gear",
  topicLong: "kids'",

  contactEmail: 'contact@kidsgearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  categories: [
    {
      slug: 'clothing', name: 'Clothing', nav: 'Clothing', short: 'clothing', icon: 'home',
      intro: 'Hoodies, T-shirts, pyjamas, coats, swimwear and socks for babies to teens. Compare prices across retailers before you buy.',
      description: "Compare prices on kids' hoodies, T-shirts, pyjamas, coats, swimwear and socks from trusted retailers."
    },
    {
      slug: 'baby-toddler', name: 'Baby & Toddler', nav: 'Baby', short: 'baby and toddler gear', icon: 'home',
      intro: 'Feeding, bath time, teething, sleep and nursery essentials for babies and toddlers.',
      description: 'Compare prices on baby and toddler feeding, bath, teething, sleep and nursery essentials from trusted retailers.'
    },
    {
      slug: 'toys-games', name: 'Toys & Games', nav: 'Toys', short: 'toys and games', icon: 'gamepad',
      intro: 'Puzzles, building sets, ride-ons, pretend play, outdoor toys and family games.',
      description: 'Compare prices on puzzles, building sets, ride-ons, pretend play toys and family games from trusted retailers.'
    },
    {
      slug: 'sports-outdoors', name: 'Sports & Outdoors', nav: 'Sports', short: 'sports and outdoor gear', icon: 'home',
      intro: 'Scooters, helmets, trampolines, football goals, sandpits and garden play.',
      description: "Compare prices on kids' scooters, helmets, trampolines, football goals and garden play from trusted retailers."
    },
    {
      slug: 'kids-tech', name: 'Kids Tech', nav: 'Tech', short: 'kids tech', icon: 'headphones',
      intro: 'Headphones, kids’ watches, cameras, night lights and learning gadgets.',
      description: "Compare prices on kids' headphones, watches, cameras, night lights and learning gadgets from trusted retailers."
    },
    {
      slug: 'bedroom-home', name: 'Bedroom & Home', nav: 'Bedroom', short: 'bedroom and home', icon: 'home',
      intro: 'Beds, bedding, storage, desks and furniture for kids’ rooms.',
      description: "Compare prices on kids' beds, bedding, storage, desks and furniture from trusted retailers."
    },
    {
      slug: 'accessories', name: 'Accessories', nav: 'Accessories', short: 'accessories', icon: 'home',
      intro: 'Hats, hair accessories, sunglasses, jewellery and party accessories for kids.',
      description: "Compare prices on kids' hats, hair accessories, sunglasses and jewellery from trusted retailers."
    },
    {
      slug: 'shoes', name: 'Shoes', nav: 'Shoes', short: 'shoes', icon: 'home',
      intro: 'Trainers, school shoes, boots, sandals and slippers.',
      description: "Compare prices on kids' trainers, school shoes, boots, sandals and slippers from trusted retailers."
    },
    {
      slug: 'gifts-for-kids', name: 'Gifts for Kids', nav: 'Gifts', short: 'gifts', icon: 'home',
      intro: 'Gift ideas from £10 to £60: toys, games, kids’ tech and accessories, plus gift sets. Compare prices across retailers before you buy.',
      description: 'Gift ideas for kids from £10 to £60: toys, games, kids’ tech, accessories and gift sets from trusted retailers.',
      // A collection: products from these categories in this price range, plus anything named "gift".
      collection: { from: ['gifts-for-kids', 'toys-games', 'kids-tech', 'accessories'], minPrice: 10, maxPrice: 60, words: ['gift'] }
    },
    {
      slug: 'school-backpacks', name: 'School & Backpacks', nav: 'School', short: 'school bags and supplies', icon: 'home',
      intro: 'Backpacks, lunch bags, pencil cases and school supplies.',
      description: "Compare prices on kids' backpacks, lunch bags, pencil cases and school supplies from trusted retailers."
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'MGW', 'WGW', 'HGW', 'TGW', 'GGW', 'CGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Construction Gear',
    "Men's Gear", "Women's Gear", 'trade or profession'
  ]
};
