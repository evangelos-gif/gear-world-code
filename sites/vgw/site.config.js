// Travel Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code VGW ("Voyage": TGW is Technology Gear World, GGW is Garden Gear World). Clickref on Awin: vgw-<product id>.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'VGW',
  name: 'Travel Gear World',
  shortName: 'Travel Gear World',
  domain: 'travelgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-22-vgw-1',
  promos: promosFor('VGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'vgw',

  // A new site with its own database (sites/vgw/migrations), like TGW and AGW.
  // The same product from several retailers (same EAN, e.g. one suitcase at two luggage shops): one card,
  // and a price table on its page.
  groupOffers: true,

  // Retailers from other countries are welcome: their prices stay in their own currency, with "≈ £…" next
  // to them, and a small flag next to the retailer name (as on Car Gear World).
  convertForeignPrices: true,
  retailerCountries: { VEVOR: 'NL' },
  retailersFromEurope: true,

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

  // Ocean blue and sunset orange (22 Oct 2026). The owner has a colour vision deficiency: blue and orange stay
  // easy to tell apart for red-green colour blindness, and every text keeps strong contrast, so nothing relies on
  // colour alone (lessons L35).
  themeColor: '#0d3349',
  cssColorMap: {
    '#0a1222': '#0d3349',
    '#060b16': '#08263a',
    '#0f1b30': '#124260',
    '#14243f': '#174d6e',
    '#22344f': '#2a6283',
    '#e8edf5': '#eef6fb',
    '#a9b6c8': '#c4dceb',
    '#6cc8ff': '#9fdcff',
    '#f2b84b': '#ff9f2e',
    '#ffd27a': '#ffbe6b',
    '#f3f5f8': '#f2f7fa',
    '#dde3ea': '#dbe7ef',
    '#111a28': '#0f1e28',
    '#4b5666': '#46596a',
    '#1747d1': '#0b5c9e',
    '#0d1e3b': '#08263a',
    '#10284d': '#5a3a12',
    '#050912': '#061d2c',
    '#dbe3ee': '#dce8f0',
    '#c9d3e0': '#c8d9e4',
    '#c3cdda': '#c2d4e0',
    '#b6c2d2': '#b3c9d7',
    '#fff6e0': '#fff2e2',
    '#fff8e8': '#fff7ec',
    '%23f2b84b': '%23ff9f2e',
    'rgba(6, 11, 22,': 'rgba(8, 38, 58,',
    'rgba(10, 18, 34,': 'rgba(13, 51, 73,',
    // No red/green pairs (lessons L35): price-drop tag in burnt orange, "in stock" in blue, warnings in light orange.
    '#d7263d': '#b23a0e',
    '#1d7a43': '#0a6aa1',
    '#5ee08f': '#7fd4ff',
    '#e9f7ee': '#e6f3fb',
    '#ff8a98': '#ffb36b'
  },
  extraCss: `
.flag { display: inline-block; width: 18px; height: 12px; margin-left: 6px; vertical-align: -1px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .15); }
.fx-base { display: inline-block; margin-left: 6px; font-family: var(--font-body); font-weight: 600; font-size: .85rem; color: var(--ink-2); white-space: nowrap; }
.shelf-price .fx-base { font-size: 1.05rem; align-self: center; }
/* The small line above the hero title in white: easier to read on the photo. */
.hero .eyebrow { color: #fff; }
/* 8 categories: two full rows of 4 on wide screens, 2 per row on tablets (no half-empty last row). */
@media (min-width: 720px) and (max-width: 979px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 980px) { .cat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for travellers',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Travel Gear World | Compare Luggage, Travel Bags, Accessories & Camping Gear',
  homeDescription:
    'Compare prices on suitcases, cabin bags, travel backpacks, packing cubes, travel adapters and camping gear from retailers in the UK and Europe. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare travel gear prices in one place',
  heroText: 'Suitcases, cabin bags, backpacks, travel accessories and camping gear from retailers around the world. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search cabin bags, packing cubes, travel adapters...',
  topic: 'travel gear',
  topicTitle: 'Travel Gear',
  topicLong: 'travel',

  contactEmail: 'contact@travelgearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' },
    { name: 'Car Gear World', url: 'https://cargearworld.com/' }
  ],

  // 8 categories (22 Oct 2026, first version: may change after the travel feed scan).
  // Products are sorted into them by category-rules.js.
  categories: [
    {
      slug: 'luggage-suitcases', name: 'Luggage & Suitcases', nav: 'Luggage', short: 'suitcases and luggage', icon: 'globe',
      intro: 'Cabin bags, large and medium suitcases, hard shell spinners, luggage sets and underseat bags.',
      description: 'Compare prices on cabin bags, suitcases, hard shell spinners and luggage sets from trusted retailers.'
    },
    {
      slug: 'travel-bags-backpacks', name: 'Travel Bags & Backpacks', nav: 'Bags & Backpacks', short: 'travel bags and backpacks', icon: 'home',
      intro: 'Travel backpacks, duffel bags, holdalls, weekend bags, garment bags and daypacks.',
      description: 'Compare prices on travel backpacks, duffel bags, holdalls and weekend bags from trusted retailers.'
    },
    {
      slug: 'travel-accessories', name: 'Travel Accessories', nav: 'Accessories', short: 'travel accessories', icon: 'search',
      intro: 'Packing cubes, toiletry bags, luggage scales and tags, travel bottles, towels and umbrellas.',
      description: 'Compare prices on packing cubes, toiletry bags, luggage scales, luggage tags and travel bottles from trusted retailers.'
    },
    {
      slug: 'comfort-sleep', name: 'Comfort & Sleep', nav: 'Comfort', short: 'travel comfort', icon: 'headphones',
      intro: 'Neck pillows, eye masks, ear plugs, flight socks and travel blankets for long journeys.',
      description: 'Compare prices on travel neck pillows, eye masks, ear plugs and flight socks from trusted retailers.'
    },
    {
      slug: 'documents-security', name: 'Documents & Security', nav: 'Security', short: 'travel documents and security', icon: 'watch',
      intro: 'Passport holders, RFID travel wallets, money belts, TSA locks and luggage trackers.',
      description: 'Compare prices on passport holders, RFID travel wallets, TSA locks and luggage trackers from trusted retailers.'
    },
    {
      slug: 'travel-tech', name: 'Travel Tech', nav: 'Travel Tech', short: 'travel tech', icon: 'plug',
      intro: 'Universal travel adapters, power banks, travel chargers, headphones and action cameras.',
      description: 'Compare prices on universal travel adapters, power banks, travel chargers and noise cancelling headphones from trusted retailers.'
    },
    {
      slug: 'camping-outdoor', name: 'Camping & Outdoor', nav: 'Camping', short: 'camping and outdoor gear', icon: 'camera',
      intro: 'Tents, sleeping bags and mats, camping stoves, head torches, dry bags and hiking gear.',
      description: 'Compare prices on tents, sleeping bags, camping stoves, head torches and dry bags from trusted retailers.'
    },
    {
      slug: 'beach-holiday', name: 'Beach & Holiday', nav: 'Beach', short: 'beach and holiday gear', icon: 'phone',
      intro: 'Beach bags and towels, beach shelters, snorkel sets, waterproof phone pouches and sun hats.',
      description: 'Compare prices on beach bags, beach towels, beach shelters, snorkel sets and waterproof phone pouches from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'AGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'Car Gear', 'trade or profession'
  ]
};
