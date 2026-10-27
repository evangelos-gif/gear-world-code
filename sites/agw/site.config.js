// Car Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code AGW ("CGW" is Construction Gear World). Clickref on Awin: agw-<product id>.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'AGW',
  name: 'Car Gear World',
  shortName: 'Car Gear World',
  domain: 'cargearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-28-agw-season-1',
  promos: promosFor('AGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'agw',

  // A new site with its own database (sites/agw/migrations), like TGW.
  // The same product from several retailers (same EAN, e.g. a Sealey jack at two tool shops): one card,
  // and a price table on its page.
  groupOffers: true,

  // Retailers from other countries are welcome: their prices stay in their own currency, with "≈ £…" next
  // to them, and a small flag next to the retailer name (as on Construction Gear World).
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

  // Gear World family look in light steel grey and racing red (owner's choice 21 Oct 2026: lighter than the first graphite, option 2).
  themeColor: '#3a4049',
  cssColorMap: {
    '#0a1222': '#3a4049',
    '#060b16': '#2f343c',
    '#0f1b30': '#474e58',
    '#14243f': '#525a65',
    '#22344f': '#636c79',
    '#e8edf5': '#eceef1',
    '#a9b6c8': '#d3d7dd',
    '#6cc8ff': '#ff9a90',
    '#f2b84b': '#ff5a4e',
    '#ffd27a': '#ff8a7f',
    '#f3f5f8': '#f4f5f7',
    '#dde3ea': '#e1e3e7',
    '#111a28': '#16181c',
    '#4b5666': '#535862',
    '#1747d1': '#b8291f',
    '#0d1e3b': '#2f343c',
    '#10284d': '#4a2f2d',
    '#050912': '#262a31',
    '#dbe3ee': '#e2e4e8',
    '#c9d3e0': '#cfd3da',
    '#c3cdda': '#c9cdd4',
    '#b6c2d2': '#bcc1c9',
    '#fff6e0': '#ffecea',
    '#fff8e8': '#fff3f1',
    '%23f2b84b': '%23ff5a4e',
    'rgba(6, 11, 22,': 'rgba(47, 52, 60,',
    'rgba(10, 18, 34,': 'rgba(58, 64, 73,'
  },
  extraCss: `
.flag { display: inline-block; width: 18px; height: 12px; margin-left: 6px; vertical-align: -1px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .15); }
.fx-base { display: inline-block; margin-left: 6px; font-family: var(--font-body); font-weight: 600; font-size: .85rem; color: var(--ink-2); white-space: nowrap; }
.shelf-price .fx-base { font-size: 1.05rem; align-self: center; }
/* The small line above the hero title in white: red is hard to read on the photo. */
.hero .eyebrow { color: #fff; }
/* 10 categories: two full rows of 5 on wide screens, 2 per row on tablets (no half-empty last row). */
@media (min-width: 720px) and (max-width: 979px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 980px) { .cat-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for drivers and home mechanics',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Car Gear World | Compare Garage Tools, Car Parts, Car Care & Accessories',
  homeDescription:
    'Compare prices on garage tools, car parts, tyres, car care, dash cams and car accessories from retailers in the UK and Europe. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare car gear prices in one place',
  heroText: 'Garage tools, parts, car care, dash cams and accessories from retailers around the world. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search trolley jacks, dash cams, wiper blades...',
  topic: 'car gear',
  topicTitle: 'Car Gear',
  topicLong: 'car',

  contactEmail: 'contact@cargearworld.com',
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
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/' }
  ],

  // 10 categories, approved by the owner on 21 Oct 2026. Products are sorted into them by category-rules.js.
  categories: [
    {
      slug: 'garage-tools-equipment', name: 'Garage Tools & Equipment', nav: 'Garage Tools', short: 'garage tools', icon: 'home',
      intro: 'Trolley jacks, axle stands, creepers, socket sets and specialist tools for brakes, engines and bodywork.',
      description: 'Compare prices on trolley jacks, axle stands, creepers, socket sets and specialist car repair tools from trusted retailers.'
    },
    {
      slug: 'diagnostics-battery', name: 'Diagnostics & Battery', nav: 'Diagnostics', short: 'diagnostics and battery care', icon: 'plug',
      intro: 'OBD scanners and code readers, battery chargers and testers, jump starters and jump leads.',
      description: 'Compare prices on OBD scanners, code readers, battery chargers, jump starters and jump leads from trusted retailers.'
    },
    {
      slug: 'parts-maintenance', name: 'Parts & Maintenance', nav: 'Parts', short: 'car parts', icon: 'home',
      intro: 'Wiper blades, bulbs, filters, engine oil, brake parts, gas struts and other service parts.',
      description: 'Compare prices on wiper blades, bulbs, filters, engine oil, brake parts and gas struts from trusted retailers.'
    },
    {
      slug: 'tyres-wheels', name: 'Tyres & Wheels', nav: 'Tyres & Wheels', short: 'tyres and wheels', icon: 'globe',
      intro: 'Tyre inflators, pressure gauges and monitors, puncture repair, wheel tools and locking wheel nuts.',
      description: 'Compare prices on tyre inflators, tyre pressure monitors, puncture repair kits and wheel tools from trusted retailers.'
    },
    {
      slug: 'car-care-detailing', name: 'Car Care & Detailing', nav: 'Car Care', short: 'car care', icon: 'home',
      intro: 'Shampoo and snow foam, wax and polish, microfibre cloths, brushes, polishers and interior cleaners.',
      description: 'Compare prices on car shampoo, snow foam, wax, polish, microfibre cloths and polishers from trusted retailers.'
    },
    {
      slug: 'car-electronics', name: 'Car Electronics', nav: 'Electronics', short: 'car electronics', icon: 'phone',
      intro: 'Dash cams, CarPlay and Android Auto screens, reversing cameras, parking sensors, phone holders and chargers.',
      description: 'Compare prices on dash cams, CarPlay screens, reversing cameras, parking sensors and car phone holders from trusted retailers.'
    },
    {
      slug: 'interior-comfort', name: 'Interior & Comfort', nav: 'Interior', short: 'interior accessories', icon: 'home',
      intro: 'Seat covers, floor and boot mats, organisers, sun shades and handheld car vacuums.',
      description: 'Compare prices on seat covers, car mats, boot liners, organisers and car vacuums from trusted retailers.'
    },
    {
      slug: 'roof-towing-exterior', name: 'Roof, Towing & Exterior', nav: 'Roof & Towing', short: 'roof and towing gear', icon: 'home',
      intro: 'Roof bars and boxes, bike carriers, tow balls and towing electrics, car covers and number plate fittings.',
      description: 'Compare prices on roof bars, roof boxes, bike carriers, tow balls and car covers from trusted retailers.'
    },
    {
      slug: 'ev-charging', name: 'EV Charging', nav: 'EV Charging', short: 'EV charging', icon: 'plug',
      intro: 'Home wallboxes, portable EV chargers and Type 2 charging cables for electric and plug-in hybrid cars.',
      description: 'Compare prices on home wallboxes, portable EV chargers and Type 2 charging cables from trusted retailers.'
    },
    {
      slug: 'safety-winter', name: 'Safety & Winter', nav: 'Safety & Winter', short: 'safety and winter gear', icon: 'home',
      intro: 'De-icer and ice scrapers, snow chains, warning triangles, first aid and emergency kits.',
      description: 'Compare prices on de-icer, ice scrapers, snow chains, warning triangles and car emergency kits from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'trade or profession'
  ]
};
