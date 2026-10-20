// Garden Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'GGW',
  name: 'Garden Gear World',
  shortName: 'Garden Gear World',
  domain: 'gardengearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-20-ggw-3',
  // Discount codes and sales from retailers (promos/promos.js, lessons L32), with the Awin publisher id
  // used for their links. The id is public: it is part of every Awin link.
  promos: promosFor('GGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'ggw',

  // The site keeps the database it already has (lessons L28). The Hub import router keeps writing to it
  // the same way; this site only reads it, and adds a row to affiliate_clicks for each retailer click.
  // categories: page address -> the category name(s) the router writes into products.site_category.
  database: {
    layout: 'legacy',
    categories: {
      'garden-tools': ['Garden Tools'],
      'power-garden-tools': ['Power Garden Tools'],
      'garden-furniture-outdoor-living': ['Garden Furniture & Outdoor Living'],
      'bbq-outdoor-cooking': ['BBQ & Outdoor Cooking'],
      'garden-buildings-fencing-storage': ['Garden Buildings, Fencing & Storage'],
      'watering-irrigation': ['Watering & Irrigation'],
      'plants-growing-garden-care': ['Plants, Growing & Garden Care'],
      'outdoor-lighting-garden-electrical': ['Outdoor Lighting & Garden Electrical']
    }
  },

  // The same product (same EAN) from several retailers is one card with "2 retailers", and its page lists
  // every retailer's price. Tooled Up and My Tool Shed sell many of the same products.
  groupOffers: true,

  // Retailer links in this database are plain shop addresses, which earn no commission. /out/<id> turns them
  // into Awin links for the retailers below (lessons L29). Awin publisher 3057233 is public: it is in every
  // Awin link. Advertiser ids: Awin > Advertisers > My Programmes.
  awin: {
    publisherId: 3057233,
    advertisers: { 'Tooled Up': 496, 'My Tool Shed': 49385 }
  },

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

  // Gear World family look in garden green. tools/theme-site.mjs recolours the TGW stylesheet with this map.
  themeColor: '#0c1a12',
  cssColorMap: {
    '#0a1222': '#0c1a12',
    '#060b16': '#07110b',
    '#0f1b30': '#11251a',
    '#14243f': '#173120',
    '#22344f': '#284732',
    '#e8edf5': '#ecf2ea',
    '#a9b6c8': '#b4c6b5',
    '#6cc8ff': '#9fe08c',
    '#f3f5f8': '#f4f7f2',
    '#dde3ea': '#dce6d8',
    '#111a28': '#13201a',
    '#4b5666': '#4d5c52',
    '#1747d1': '#1d7434',
    '#0d1e3b': '#10301c',
    '#10284d': '#143a22',
    '#050912': '#050c07',
    '#dbe3ee': '#dde8da',
    '#c9d3e0': '#cbd8c8',
    '#c3cdda': '#c5d3c2',
    '#b6c2d2': '#b8c8b6',
    'rgba(6, 11, 22,': 'rgba(7, 17, 11,',
    'rgba(10, 18, 34,': 'rgba(12, 26, 18,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent garden price comparison',
  // Hero photo: Pexels licence. Category photos: the site's own images. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true,

  homeTitle: 'Garden Gear World | Compare Garden Tools, Mowers, Watering & Garden Care',
  homeDescription:
    'Compare prices on garden tools, lawn mowers, trimmers, watering and garden care from trusted retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare garden prices in one place',
  heroText: 'Garden tools, power tools, watering and garden care in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search mowers, trimmers, hoses...',
  topic: 'garden',
  topicTitle: 'Garden',
  topicLong: 'garden',

  contactEmail: 'contact@gardengearworld.com',
  operatorName: 'Gear World',
  // Empty: no newsletter or rewards form yet. Members will be kept in one place, in Gear World Hub (step 2).
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  // Same 8 categories and addresses as before the move, so links that Google and the Hub know keep working.
  categories: [
    {
      slug: 'garden-tools', name: 'Garden Tools', nav: 'Garden Tools', short: 'garden hand tools', icon: 'home',
      intro: 'Spades, forks, rakes, hoes, shears, secateurs, loppers and pruning saws. Compare prices across retailers before you buy.',
      description: 'Compare prices on spades, forks, rakes, shears, secateurs and other garden hand tools from trusted retailers.'
    },
    {
      slug: 'power-garden-tools', name: 'Power Garden Tools', nav: 'Power Tools', short: 'power garden tools', icon: 'plug',
      intro: 'Lawn mowers, grass trimmers, hedge trimmers, leaf blowers, chainsaws and pressure washers, cordless, electric and petrol.',
      description: 'Compare lawn mower, grass trimmer, hedge trimmer, leaf blower, chainsaw and pressure washer prices from trusted retailers.'
    },
    {
      slug: 'garden-furniture-outdoor-living', name: 'Garden Furniture & Outdoor Living', nav: 'Furniture', short: 'garden furniture', icon: 'home',
      intro: 'Garden tables and chairs, benches, sun loungers, parasols and outdoor heating for patios and gardens.',
      description: 'Compare garden furniture, bench, sun lounger and parasol prices from trusted retailers.'
    },
    {
      slug: 'bbq-outdoor-cooking', name: 'BBQ & Outdoor Cooking', nav: 'BBQ', short: 'barbecues', icon: 'home',
      intro: 'Charcoal and gas barbecues, pizza ovens, fire pits and barbecue tools and covers.',
      description: 'Compare barbecue, pizza oven and fire pit prices from trusted retailers.'
    },
    {
      slug: 'garden-buildings-fencing-storage', name: 'Garden Buildings, Fencing & Storage', nav: 'Sheds & Storage', short: 'sheds and storage', icon: 'home',
      intro: 'Sheds, garden storage boxes, greenhouses, fence panels, gates and trellis.',
      description: 'Compare shed, garden storage, greenhouse and fencing prices from trusted retailers.'
    },
    {
      slug: 'watering-irrigation', name: 'Watering & Irrigation', nav: 'Watering', short: 'watering', icon: 'home',
      intro: 'Garden hoses and reels, spray guns, sprinklers, watering cans, water butts and pumps.',
      description: 'Compare garden hose, sprinkler, watering can, water butt and pump prices from trusted retailers.'
    },
    {
      slug: 'plants-growing-garden-care', name: 'Plants, Growing & Garden Care', nav: 'Garden Care', short: 'garden care', icon: 'home',
      intro: 'Seeds, compost, plant food, lawn care, pots and planters, and pest control for a healthy garden.',
      description: 'Compare prices on compost, plant food, lawn care, planters and garden care products from trusted retailers.'
    },
    {
      slug: 'outdoor-lighting-garden-electrical', name: 'Outdoor Lighting & Garden Electrical', nav: 'Lighting', short: 'outdoor lighting', icon: 'plug',
      intro: 'Solar and mains garden lights, security lights, outdoor sockets and extension reels.',
      description: 'Compare outdoor lighting, solar light and garden electrical prices from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'KGW', 'HGW', 'TGW', 'MGW', 'WGW', 'CGW',
    'Home Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'everyday carry', 'trade or profession', 'laptops'
  ]
};
