// Biker Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code BGW ("Biker": checked on 31 Oct 2026, no other site, branch or Hub file uses it). Clickref on Awin: bgw-<product id>.
// Owner (29 Oct 2026): motorbikes and scooters. Bicycles and e-bikes stay on Sporty Gear World.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'BGW',
  name: 'Biker Gear World',
  shortName: 'Biker Gear World',
  domain: 'bikergearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-31-bgw-1',
  promos: promosFor('BGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'bgw',

  // A new site with its own database (sites/bgw/migrations), like TGW, AGW, VGW and SGW.
  // The same product from several retailers (same EAN, e.g. one paddock stand at Tooled Up and at My Tool Shed): one
  // card, and a price table on its page.
  groupOffers: true,

  // VEVOR sells from the Netherlands in euros: its prices stay in euros, with "≈ £…" next to them.
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
  // not named in retailers (Tooled Up, My Tool Shed and Joybuy UK are UK shops). VEVOR: the Dutch shop vevor.nl, as on
  // the other Gear World sites.
  deliversTo: { default: ['GB'], retailers: { VEVOR: ['NL'] } },

  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
  voiceSearch: true,

  // Night black and lilac, with amber links (proposal, 31 Oct 2026). The owner has a colour vision deficiency: lilac and
  // amber stay easy to tell apart for red-green colour blindness, and every text keeps strong contrast (lessons L35).
  themeColor: '#17131f',
  cssColorMap: {
    '#0a1222': '#17131f',
    '#060b16': '#0f0c15',
    '#0f1b30': '#211b2c',
    '#14243f': '#2a2338',
    '#22344f': '#3b3249',
    '#e8edf5': '#f0edf5',
    '#a9b6c8': '#cbc3d6',
    '#6cc8ff': '#ffb35c',
    '#f2b84b': '#c39bff',
    '#ffd27a': '#dcc4ff',
    '#f3f5f8': '#f5f4f7',
    '#dde3ea': '#e3e0e8',
    '#111a28': '#18141f',
    '#4b5666': '#504a5c',
    '#1747d1': '#5a2fb0',
    '#0d1e3b': '#0f0c15',
    '#10284d': '#2a2338',
    '#050912': '#0b0910',
    '#dbe3ee': '#e0dce6',
    '#c9d3e0': '#d0cbd8',
    '#c3cdda': '#c9c3d2',
    '#b6c2d2': '#bdb6c8',
    '#fff6e0': '#f2ebff',
    '#fff8e8': '#f6f1ff',
    '%23f2b84b': '%23c39bff',
    'rgba(6, 11, 22,': 'rgba(15, 12, 21,',
    'rgba(10, 18, 34,': 'rgba(23, 19, 31,',
    // No red/green pairs (lessons L35): price-drop tag in burnt orange, "in stock" in blue, warnings in light orange.
    '#d7263d': '#b23a0e',
    '#1d7a43': '#0a5fa8',
    '#5ee08f': '#8ad8ff',
    '#e9f7ee': '#e6f3fb',
    '#ff8a98': '#ffb36b'
  },
  extraCss: `
.flag { display: inline-block; width: 18px; height: 12px; margin-left: 6px; vertical-align: -1px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .15); }
.fx-base { display: inline-block; margin-left: 6px; font-family: var(--font-body); font-weight: 600; font-size: .85rem; color: var(--ink-2); white-space: nowrap; }
.shelf-price .fx-base { font-size: 1.05rem; align-self: center; }
/* The small line above the hero title in white: easier to read on the photo. */
.hero .eyebrow { color: #fff; }
/* The UK rule for private e-scooters, on the Electric Scooters page (category note). */
.category-note { padding: 10px 14px; border-left: 4px solid var(--gold); background: var(--panel); }
/* 10 categories: two full rows of 5 on wide screens, 2 per row on tablets (no half-empty last row). */
@media (min-width: 720px) and (max-width: 1099px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .cat-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for motorbike and scooter riders',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Biker Gear World | Compare Motorbike Helmets, Riding Gear, Parts & Scooters',
  homeDescription:
    'Compare prices on motorbike helmets, riding gear, parts, luggage and locks, intercoms, electric scooters and kick scooters from trusted retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare motorbike and scooter gear prices in one place',
  heroText: 'Helmets, riding gear, parts and tools, luggage and locks, intercoms, electric scooters, kick scooters and mopeds from retailers in the UK and Europe. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search helmets, disc locks, scooters...',
  topic: 'motorbike and scooter gear',
  topicTitle: 'Motorbike & Scooter Gear',
  topicLong: 'motorbike and scooter',

  contactEmail: 'contact@bikergearworld.com',
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
    { name: 'Travel Gear World', url: 'https://travelgearworld.com/' },
    { name: 'Sporty Gear World', url: 'https://sportygearworld.com/' }
  ],

  // 10 categories (owner, 29 Oct 2026: motorbikes and scooters; bicycles stay on Sporty Gear World). Products are
  // sorted into them by category-rules.js. A category with no products yet is noindex and left out of the sitemap.
  categories: [
    {
      slug: 'helmets', name: 'Motorbike Helmets', nav: 'Helmets', short: 'motorbike helmets', icon: 'globe',
      intro: 'Full face, flip front, open face and motocross helmets, visors and Pinlock inserts.',
      description: 'Compare prices on full face, flip front, open face and motocross helmets, visors and Pinlock inserts from trusted retailers.'
    },
    {
      slug: 'jackets-trousers', name: 'Jackets & Trousers', nav: 'Jackets', short: 'motorbike jackets and trousers', icon: 'home',
      intro: 'Textile and leather motorbike jackets, riding jeans and trousers, one-piece suits and waterproof over-suits.',
      description: 'Compare prices on motorbike jackets, riding jeans, leather suits and waterproof over-suits from trusted retailers.'
    },
    {
      slug: 'boots-gloves', name: 'Boots & Gloves', nav: 'Boots & Gloves', short: 'motorbike boots and gloves', icon: 'watch',
      intro: 'Touring, sport and motocross boots, summer and winter riding gloves, heated gloves and handlebar muffs.',
      description: 'Compare prices on motorbike boots, riding gloves, heated gloves and handlebar muffs from trusted retailers.'
    },
    {
      slug: 'parts-maintenance', name: 'Parts & Maintenance', nav: 'Parts', short: 'motorbike parts and tools', icon: 'plug',
      intro: 'Paddock stands and lifts, chain lube and cleaners, oil, batteries and chargers, tyre tools and workshop tools.',
      description: 'Compare prices on paddock stands, motorbike lifts, chain lube, oil, batteries and workshop tools from trusted retailers.'
    },
    {
      slug: 'luggage-security', name: 'Luggage, Locks & Covers', nav: 'Luggage & Locks', short: 'motorbike luggage and locks', icon: 'router',
      intro: 'Top boxes, panniers, tank and tail bags, disc locks, chains and ground anchors, and motorbike covers.',
      description: 'Compare prices on top boxes, panniers, tank bags, disc locks, chains and motorbike covers from trusted retailers.'
    },
    {
      slug: 'electronics', name: 'Intercoms, Cameras & Mounts', nav: 'Intercoms', short: 'motorbike intercoms and mounts', icon: 'headphones',
      intro: 'Helmet intercoms, phone mounts and chargers, helmet and dash cameras, and sat nav for riders.',
      description: 'Compare prices on helmet intercoms, motorbike phone mounts, helmet cameras and sat nav from trusted retailers.'
    },
    {
      slug: 'electric-scooters', name: 'Electric Scooters', nav: 'E-Scooters', short: 'electric scooters', icon: 'phone',
      intro: 'Electric kick scooters for adults and teens, plus e-scooter tyres, chargers, locks and bags.',
      description: 'Compare prices on electric scooters and e-scooter tyres, chargers, locks and bags from trusted retailers.',
      note: 'In the UK, a privately owned e-scooter may only be ridden on private land with the owner\'s permission, not on public roads or pavements. Only rental e-scooters from the official trials may be used on public roads.'
    },
    {
      slug: 'kick-scooters', name: 'Kick Scooters', nav: 'Kick Scooters', short: 'kick scooters', icon: 'gamepad',
      intro: 'Folding kick scooters for adults, stunt scooters, three-wheel scooters for children and scooter parts.',
      description: 'Compare prices on kick scooters for adults and children, stunt scooters and scooter parts from trusted retailers.'
    },
    {
      slug: 'electric-motorbikes', name: 'Electric Motorbikes & Mopeds', nav: 'Mopeds', short: 'electric motorbikes and mopeds', icon: 'tv',
      intro: 'Electric motorbikes and mopeds, 50cc and 125cc scooters, pit bikes and quad bikes.',
      description: 'Compare prices on electric motorbikes, mopeds, 125cc scooters and pit bikes from trusted retailers.'
    },
    {
      slug: 'protection', name: 'Protection & Hi-Vis', nav: 'Protection', short: 'rider protection and hi-vis', icon: 'camera',
      intro: 'Back and chest protectors, body armour, airbag vests, knee sliders, hi-vis vests and reflective gear.',
      description: 'Compare prices on back protectors, body armour, airbag vests and hi-vis gear for riders from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'AGW', 'VGW', 'SGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'Car Gear', 'Travel Gear', 'Sporty Gear', 'trade or profession'
  ]
};
