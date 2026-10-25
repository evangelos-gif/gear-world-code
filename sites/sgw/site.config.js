// Sporty Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code SGW ("Sport": checked on 25 Oct 2026, no other site, branch or Hub file uses it). Clickref on Awin: sgw-<product id>.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'SGW',
  name: 'Sporty Gear World',
  shortName: 'Sporty Gear World',
  domain: 'sportygearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-25-sgw-1',
  promos: promosFor('SGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'sgw',

  // A new site with its own database (sites/sgw/migrations), like TGW, AGW and VGW.
  // The same product from several retailers (same EAN, e.g. one football at Coes and at Joybuy): one card,
  // and a price table on its page.
  groupOffers: true,

  // Retailers from other countries are welcome (VEVOR NL comes in the second wave): their prices stay in their own
  // currency, with "≈ £…" next to them.
  convertForeignPrices: true,
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

  // Where the retailers deliver (lessons L62): every product card and product page says it. default: every retailer
  // not named in retailers. All the first-wave retailers are UK shops (Coes, Joybuy UK, Plusshop UK, Bazta UK and
  // Beyond Shakers, the same as on the other Gear World sites). A retailer from another country is added to retailers,
  // from its own delivery page, before its first import.
  deliversTo: { default: ['GB'] },

  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
  voiceSearch: true,

  // Royal blue and sun yellow (25 Oct 2026, option 1). The owner has a colour vision deficiency: blue and yellow stay easy to tell apart for
  // red-green colour blindness, and every text keeps strong contrast, so nothing relies on colour alone (lessons L35).
  themeColor: '#0f2a6b',
  cssColorMap: {
    '#0a1222': '#0f2a6b',
    '#060b16': '#0a1f54',
    '#0f1b30': '#163680',
    '#14243f': '#1c4194',
    '#22344f': '#2f55b0',
    '#e8edf5': '#f2f5fc',
    '#a9b6c8': '#c9d5f2',
    '#6cc8ff': '#9fd0ff',
    '#f2b84b': '#ffcd2e',
    '#ffd27a': '#ffdf6e',
    '#f3f5f8': '#f3f6fc',
    '#dde3ea': '#dbe3f3',
    '#111a28': '#111a33',
    '#4b5666': '#46536e',
    '#1747d1': '#1b4fbf',
    '#0d1e3b': '#0a1f54',
    '#10284d': '#163680',
    '#050912': '#081845',
    '#dbe3ee': '#dbe3f3',
    '#c9d3e0': '#c8d3ea',
    '#c3cdda': '#c2cde6',
    '#b6c2d2': '#b4c2e0',
    '#fff6e0': '#fff6d6',
    '#fff8e8': '#fff9e3',
    '%23f2b84b': '%23ffcd2e',
    'rgba(6, 11, 22,': 'rgba(10, 31, 84,',
    'rgba(10, 18, 34,': 'rgba(15, 42, 107,',
    // No red/green pairs (lessons L35): price-drop tag in burnt orange, "in stock" in blue, warnings in light orange.
    '#d7263d': '#a8410c',
    '#1d7a43': '#0b5aa8',
    '#5ee08f': '#9fd0ff',
    '#e9f7ee': '#e6f0fb',
    '#ff8a98': '#ffb36b'
  },
  extraCss: `
.flag { display: inline-block; width: 18px; height: 12px; margin-left: 6px; vertical-align: -1px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .15); }
.fx-base { display: inline-block; margin-left: 6px; font-family: var(--font-body); font-weight: 600; font-size: .85rem; color: var(--ink-2); white-space: nowrap; }
.shelf-price .fx-base { font-size: 1.05rem; align-self: center; }
/* The small line above the hero title in white: easier to read on the photo. */
.hero .eyebrow { color: #fff; }
/* 10 categories: two full rows of 5 on wide screens, 2 per row on tablets (no half-empty last row). */
@media (min-width: 720px) and (max-width: 1099px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .cat-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for sport and fitness',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Sporty Gear World | Compare Fitness, Running, Cycling, Football & Sports Gear',
  homeDescription:
    'Compare prices on gym equipment, running shoes, bikes, football boots, tennis rackets, kayaks, sports nutrition and sportswear from trusted retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare sports gear prices in one place',
  heroText: 'Gym and fitness equipment, running, cycling, football, tennis, water sports, sports nutrition and sportswear from retailers around the world. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search dumbbells, running shoes, footballs...',
  topic: 'sports gear',
  topicTitle: 'Sports Gear',
  topicLong: 'sport',

  contactEmail: 'contact@sportygearworld.com',
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
    { name: 'Car Gear World', url: 'https://cargearworld.com/' },
    { name: 'Travel Gear World', url: 'https://travelgearworld.com/' }
  ],

  // 10 categories (owner, 25 Oct 2026, after the sports feed scan). Products are sorted into them by category-rules.js.
  categories: [
    {
      slug: 'fitness-gym', name: 'Fitness & Gym', nav: 'Fitness & Gym', short: 'fitness and gym equipment', icon: 'home',
      intro: 'Dumbbells, kettlebells, benches, treadmills, exercise bikes, yoga mats, resistance bands and boxing gear.',
      description: 'Compare prices on dumbbells, kettlebells, weight benches, treadmills, exercise bikes and yoga mats from trusted retailers.'
    },
    {
      slug: 'running', name: 'Running', nav: 'Running', short: 'running gear', icon: 'watch',
      intro: 'Running shoes and clothing, hydration vests, running belts, armbands and athletics gear.',
      description: 'Compare prices on running shoes, running clothing, hydration vests and running belts from trusted retailers.'
    },
    {
      slug: 'cycling', name: 'Cycling', nav: 'Cycling', short: 'cycling gear', icon: 'globe',
      intro: 'Bikes and e-bikes, helmets, bike lights and locks, pumps and tools, cycling clothing and turbo trainers.',
      description: 'Compare prices on bikes, e-bikes, cycling helmets, bike lights, locks and turbo trainers from trusted retailers.'
    },
    {
      slug: 'football-team-sports', name: 'Football & Team Sports', nav: 'Team Sports', short: 'football and team sports gear', icon: 'gamepad',
      intro: 'Football boots and balls, goals and shin pads, plus basketball, rugby, American football, cricket and hockey gear.',
      description: 'Compare prices on football boots, footballs, goals, basketballs, rugby balls and cricket gear from trusted retailers.'
    },
    {
      slug: 'racket-sports', name: 'Racket Sports', nav: 'Racket Sports', short: 'racket sports gear', icon: 'search',
      intro: 'Tennis, padel, badminton, squash, pickleball and table tennis rackets, balls, shoes and nets.',
      description: 'Compare prices on tennis rackets, padel rackets, badminton sets, pickleball paddles and table tennis gear from trusted retailers.'
    },
    {
      slug: 'water-sports', name: 'Water Sports & Swimming', nav: 'Water Sports', short: 'water sports and swimming gear', icon: 'camera',
      intro: 'Kayaks, paddle boards, wetsuits, swimming goggles and caps, snorkelling and diving gear.',
      description: 'Compare prices on kayaks, stand up paddle boards, wetsuits and swimming goggles from trusted retailers.'
    },
    {
      slug: 'hiking-climbing-winter', name: 'Hiking, Climbing & Winter', nav: 'Hiking & Winter', short: 'hiking, climbing and winter sports gear', icon: 'router',
      intro: 'Walking boots, trekking poles, climbing harnesses and carabiners, skis, snowboards and ski goggles.',
      description: 'Compare prices on walking boots, trekking poles, climbing gear, skis, snowboards and ski goggles from trusted retailers.'
    },
    {
      slug: 'nutrition-hydration', name: 'Nutrition & Hydration', nav: 'Nutrition', short: 'sports nutrition', icon: 'plug',
      intro: 'Protein, creatine, pre-workout, electrolytes and energy gels, plus protein shakers and sports bottles.',
      description: 'Compare prices on protein powder, creatine, pre-workout, electrolytes, shakers and sports bottles from trusted retailers.'
    },
    {
      slug: 'sportswear-shoes-bags', name: 'Sportswear, Shoes & Bags', nav: 'Sportswear', short: 'sportswear, sports shoes and bags', icon: 'headphones',
      intro: 'Training shoes, sports bras, leggings, base layers, tracksuits, gym bags and kit bags.',
      description: 'Compare prices on training shoes, sports bras, leggings, base layers, tracksuits and gym bags from trusted retailers.'
    },
    {
      slug: 'golf-skate-more', name: 'Golf, Skate & More', nav: 'More Sports', short: 'golf, skate and more sports', icon: 'tv',
      intro: 'Golf balls, clubs and trolleys, skateboards and skates, fishing rods, darts, snooker and table games.',
      description: 'Compare prices on golf balls and trolleys, skateboards, inline skates, fishing rods and dartboards from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'AGW', 'VGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'Car Gear', 'Travel Gear', 'trade or profession'
  ]
};
