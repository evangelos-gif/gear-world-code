// Construction Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';
import guides from './guides.js';

export default {
  code: 'CGW',
  name: 'Construction Gear World',
  shortName: 'Construction Gear World',
  domain: 'constructiongearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-29-cgw-guides-2',
  promos: promosFor('CGW'),
  // Buying guides (/guides/, lessons L82): words in guides.js, prices and stock live from the database.
  guides,
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'cgw',

  // The site keeps the database it already has (lessons L28); the Hub import router keeps writing to it.
  // Category addresses (/category/<slug>/) and product addresses (/product/<name>-<id>/) stay the same as on the old site.
  // Its other tables (customers, rewards, Awin transactions, backups) are never read or changed by the engine.
  database: {
    layout: 'legacy',
    categories: {
      'safety-footwear': ['Safety Boots'],
      workwear: ['Workwear'],
      ppe: ['PPE'],
      'power-tools': ['Power Tools'],
      'hand-tools': ['Hand Tools'],
      'site-equipment': ['Site Equipment']
    },
    retailerNames: {
      'Joybuy UK': 'Joybuy',
      'Vevor NL': 'VEVOR',
      'Red Gorilla International': 'Red Gorilla'
    },
    // The import already matched the same product at different retailers (product_groups / product_group_offers).
    groupTable: 'product_group_offers'
  },

  // Same product from several retailers: one card, and a price table on its page.
  groupOffers: true,

  // Two retailers sell in euros from other countries and GRABO in US dollars: their prices stay in their currency,
  // with "≈ £…" next to them. foreignCurrencies: rates fetched for that, besides the visitor's display currencies.
  convertForeignPrices: true,
  foreignCurrencies: ['USD'],
  retailersFromEurope: true,

  // Where the retailers deliver (lessons L62): every product card and product page says it, so a visitor from
  // any country sees at once whether they can order. default: every retailer not named in retailers.
  // Country codes: src/lib/delivery.js. The other retailers are UK shops. Reidl: "Die Lieferung erfolgt
  // innerhalb Deutschlands und nach Österreich" (reidl.de/shop/zahlungversand, 25 Oct 2026). VEVOR: the Dutch shop vevor.nl.
  // GRABO (order.grabo.com, lessons L63): "Worldwide Shipping, fulfilled by our authorized dealers" (read 25 Oct 2026).
  deliversTo: { default: ['GB'], retailers: { Reidl: ['DE', 'AT'], VEVOR: ['NL'], GRABO: ['WORLD'] } },

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

  // Gear World family look in charcoal and safety yellow, like a site helmet.
  themeColor: '#141310',
  cssColorMap: {
    '#0a1222': '#141310',
    '#060b16': '#0b0a08',
    '#0f1b30': '#1d1b17',
    '#14243f': '#26231d',
    '#22344f': '#3b362b',
    '#e8edf5': '#f3f0e8',
    '#a9b6c8': '#c4bba8',
    '#6cc8ff': '#ffd54a',
    '#f2b84b': '#ffc21a',
    '#ffd27a': '#ffd75e',
    '#f3f5f8': '#f7f5ef',
    '#dde3ea': '#e6e0d2',
    '#111a28': '#1a1813',
    '#4b5666': '#5b5545',
    '#1747d1': '#8a5a00',
    '#0d1e3b': '#1f1c14',
    '#10284d': '#2e2914',
    '#050912': '#060504',
    '#dbe3ee': '#ebe5d8',
    '#c9d3e0': '#d9d1c0',
    '#c3cdda': '#d3cab8',
    '#b6c2d2': '#c7bda8',
    'rgba(6, 11, 22,': 'rgba(11, 10, 8,',
    'rgba(10, 18, 34,': 'rgba(20, 19, 16,'
  },
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for trades and DIY',
  // Hero and category photos: the site's own hero image (docs/IMAGE-CREDITS.md).
  heroImage: { src: 'img/hero-1774.webp', small: 'img/hero-960.webp', width: 1774, height: 887 },
  categoryImages: true,

  homeTitle: 'Construction Gear World | Compare Power Tools, Hand Tools, Workwear & PPE',
  homeDescription:
    'Compare prices on power tools, hand tools, workwear, safety boots, PPE and site equipment from retailers in the UK and Europe. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare construction gear prices in one place',
  heroText: 'Power tools, hand tools, workwear, safety boots, PPE and site equipment from retailers in the UK and Europe. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search drills, safety boots, hi-vis...',
  topic: 'construction gear',
  topicTitle: 'Construction Gear',
  topicLong: 'construction',

  contactEmail: 'contact@constructiongearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  categories: [
    {
      slug: 'power-tools', name: 'Power Tools', nav: 'Power Tools', short: 'power tools', icon: 'plug',
      intro: 'Drills, impact drivers, saws, grinders, sanders, generators and batteries. Compare prices across retailers before you buy.',
      description: 'Compare prices on drills, impact drivers, saws, grinders, generators and power tool batteries from trusted retailers.'
    },
    {
      slug: 'hand-tools', name: 'Hand Tools', nav: 'Hand Tools', short: 'hand tools', icon: 'home',
      intro: 'Spanners, sockets, screwdrivers, pliers, hammers, measuring tools and tool storage.',
      description: 'Compare prices on spanners, sockets, screwdrivers, pliers, hammers and tool storage from trusted retailers.'
    },
    {
      slug: 'safety-footwear', name: 'Safety Footwear', nav: 'Safety Boots', short: 'safety footwear', icon: 'home',
      intro: 'Safety boots, safety trainers and rigger boots with toe caps and midsole protection.',
      description: 'Compare prices on safety boots, safety trainers and rigger boots from trusted retailers.'
    },
    {
      slug: 'workwear', name: 'Workwear', nav: 'Workwear', short: 'workwear', icon: 'home',
      intro: 'Hi-vis jackets, work trousers, coveralls, fleeces and work gloves.',
      description: 'Compare prices on hi-vis jackets, work trousers, coveralls, fleeces and work gloves from trusted retailers.'
    },
    {
      slug: 'ppe', name: 'PPE', nav: 'PPE', short: 'PPE', icon: 'home',
      intro: 'Hard hats, safety glasses, ear defenders, masks and respirators.',
      description: 'Compare prices on hard hats, safety glasses, ear defenders, masks and respirators from trusted retailers.'
    },
    {
      slug: 'site-equipment', name: 'Site Equipment', nav: 'Site Equipment', short: 'site equipment', icon: 'home',
      intro: 'Ladders, work lights, wheelbarrows, mixers, pumps and site storage.',
      description: 'Compare prices on ladders, work lights, wheelbarrows, mixers, pumps and site storage from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'MGW', 'WGW', 'KGW', 'HGW', 'TGW', 'GGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear",
    "Men's Gear", "Women's Gear", 'trade or profession'
  ]
};
