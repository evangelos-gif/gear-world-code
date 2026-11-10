// Gaming Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code PGW ("Play": GGW is Garden; checked on 31 Oct 2026, no other site, branch or Hub file uses PGW). Clickref on
// Awin: pgw-<product id>.
// Owner (31 Oct 2026): consoles, games, controllers, gaming PCs and laptops, monitors, mice and keyboards, headsets, chairs
// and desks, streaming gear and PC components. Everyday laptops, phones and office gear stay on Technology Gear World.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';
import { networkFor } from '../../promos/network.js';

export default {
  code: 'PGW',
  name: 'Gaming Gear World',
  shortName: 'Gaming Gear World',
  domain: 'gaminggearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-11-10-pgw-codes-1',
  promos: promosFor('PGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'pgw',

  // A new site with its own database (sites/pgw/migrations), like TGW, AGW, VGW, SGW and BGW.
  // The same product from several retailers (same EAN, e.g. one headset at Back to the Office and at PCHUB.UK): one card,
  // and a price table on its page (dry run of 31 Oct 2026: 1,056 products at two retailers).
  groupOffers: true,

  // A retailer that sells in euros keeps its euro prices, with "≈ £…" next to them.
  convertForeignPrices: true,
  retailersFromEurope: true,

  // Countries that see only the retailers that deliver there instead of the UK view with its bar (lessons L107); none yet.
  strictCountries: [],
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

  // Where the retailers deliver (lessons L62): every product card and product page says it. All the first shops (Joybuy UK,
  // Back to the Office, PCHUB.UK, PcNova, Plusshop UK, Bazta UK) are UK shops. VEVOR (second wave): the Dutch shop vevor.nl.
  // VEVOR (vevor.nl) delivers to the EU and the EEA, not to the UK (owner, 9 Nov 2026, lessons L107).
  deliversTo: { default: ['GB'], retailers: { VEVOR: ['EU', 'IS', 'LI', 'NO'] } },

  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Saved list', maxItems: 30 },
  voiceSearch: true,

  // Colour 2 chosen by the owner (31 Oct 2026): black with electric blue and white. The owner has a colour vision
  // deficiency: blue on black stays easy to tell apart without red or green, and every text keeps strong contrast (L35).
  // On the dark page the blue is a touch lighter (#4d82ff) so that it passes 4.5:1; on white it is a touch darker (#2457e0).
  themeColor: '#0a0b12',
  cssColorMap: {
    '#0a1222': '#0a0b12',
    '#060b16': '#06070c',
    '#0f1b30': '#141726',
    '#14243f': '#1b1f33',
    '#22344f': '#2c3150',
    '#e8edf5': '#eef1fb',
    '#a9b6c8': '#b8bfd6',
    '#6cc8ff': '#9fbcff',
    '#f2b84b': '#4d82ff',
    '#ffd27a': '#86a9ff',
    '#f3f5f8': '#f4f5f9',
    '#dde3ea': '#dfe2ec',
    '#111a28': '#10121c',
    '#4b5666': '#4a5068',
    '#1747d1': '#2457e0',
    '#0d1e3b': '#06070c',
    '#10284d': '#1b1f33',
    '#050912': '#050609',
    '#dbe3ee': '#dde0ea',
    '#c9d3e0': '#ccd0de',
    '#c3cdda': '#c6cad9',
    '#b6c2d2': '#b9bed0',
    '#fff6e0': '#eaf0ff',
    '#fff8e8': '#f0f4ff',
    '%23f2b84b': '%234d82ff',
    'rgba(6, 11, 22,': 'rgba(6, 7, 12,',
    'rgba(10, 18, 34,': 'rgba(10, 11, 18,',
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
/* 10 categories: two full rows of 5 on wide screens, 2 per row on tablets (no half-empty last row). */
@media (min-width: 720px) and (max-width: 1099px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .cat-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for gamers',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Gaming Gear World | Compare Consoles, Gaming PCs, Monitors, Headsets & Chairs',
  homeDescription:
    'Compare prices on consoles, games, controllers, gaming PCs and laptops, gaming monitors, keyboards and mice, headsets, gaming chairs, streaming gear and PC components across retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare gaming gear prices in one place',
  heroText: 'Consoles and games, gaming PCs and laptops, monitors, keyboards, mice, headsets, chairs, streaming gear and PC components from retailers in the UK and Europe. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search consoles, headsets, graphics cards...',
  topic: 'gaming gear',
  topicTitle: 'Gaming Gear',
  topicLong: 'gaming',

  contactEmail: 'contact@gaminggearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  // The other 12 Gear World sites, from the one shared list (promos/network.js, lessons L99).
  network: networkFor('PGW'),

  // 10 categories (owner, 31 Oct 2026: consoles, gaming PCs and laptops, monitors, mice and keyboards, headsets, chairs and
  // desks, controllers, games and gift cards, streaming, and PC components). Everyday laptops, phones and office gear stay
  // on Technology Gear World. Products are sorted into them by category-rules.js (the same order). A category with no
  // products yet is noindex and left out of the sitemap.
  categories: [
    {
      slug: 'games-cards', name: 'Games & Gift Cards', nav: 'Games', short: 'video games and gift cards', icon: 'gamepad',
      intro: 'PlayStation, Xbox, Nintendo Switch and PC games, special editions and gaming gift cards.',
      description: 'Compare prices on PlayStation, Xbox, Nintendo Switch and PC games, special editions and gaming gift cards across retailers.'
    },
    {
      slug: 'controllers', name: 'Controllers, Wheels & Sticks', nav: 'Controllers', short: 'controllers and racing wheels', icon: 'gamepad',
      intro: 'Wireless and pro controllers, racing wheels and pedals, flight sticks, charging docks and thumb grips.',
      description: 'Compare prices on wireless and pro controllers, racing wheels, flight sticks and charging docks across retailers.'
    },
    {
      slug: 'consoles', name: 'Consoles & Handhelds', nav: 'Consoles', short: 'consoles and handhelds', icon: 'tv',
      intro: 'Home consoles, handheld gaming PCs, VR headsets and console accessories such as storage, cases and stands.',
      description: 'Compare prices on consoles, handheld gaming PCs, VR headsets and console storage, cases and stands across retailers.'
    },
    {
      slug: 'pcs-laptops', name: 'Gaming PCs & Laptops', nav: 'PCs & Laptops', short: 'gaming PCs and laptops', icon: 'laptop',
      intro: 'Gaming laptops and desktop PCs with dedicated graphics, and compact gaming mini PCs.',
      description: 'Compare prices on gaming laptops, gaming desktop PCs and gaming mini PCs across retailers.'
    },
    {
      slug: 'monitors', name: 'Gaming Monitors', nav: 'Monitors', short: 'gaming monitors', icon: 'tv',
      intro: 'Fast gaming monitors from 144 Hz to 500 Hz and more: IPS, VA and OLED, flat, curved and ultrawide.',
      description: 'Compare prices on fast gaming monitors, OLED, curved and ultrawide screens across retailers.'
    },
    {
      slug: 'mice-keyboards', name: 'Mice, Keyboards & Mouse Pads', nav: 'Mice & Keyboards', short: 'gaming mice and keyboards', icon: 'laptop',
      intro: 'Gaming mice, mechanical and magnetic-switch keyboards, keycaps and mouse pads.',
      description: 'Compare prices on gaming mice, mechanical keyboards, keycaps and mouse pads across retailers.'
    },
    {
      slug: 'headsets', name: 'Headsets & Gaming Audio', nav: 'Headsets', short: 'gaming headsets', icon: 'headphones',
      intro: 'Wired and wireless gaming headsets for PC and consoles, gaming earbuds and gaming soundbars.',
      description: 'Compare prices on gaming headsets for PC, PlayStation, Xbox and Switch, gaming earbuds and soundbars across retailers.'
    },
    {
      slug: 'chairs-desks', name: 'Gaming Chairs & Desks', nav: 'Chairs & Desks', short: 'gaming chairs and desks', icon: 'home',
      intro: 'Gaming chairs, gaming desks, racing seats and sim racing cockpits.',
      description: 'Compare prices on gaming chairs, gaming desks and sim racing cockpits across retailers.'
    },
    {
      slug: 'streaming', name: 'Streaming: Cameras, Mics & Lights', nav: 'Streaming', short: 'streaming gear', icon: 'mic',
      intro: 'Webcams, USB and XLR microphones, mic arms, capture cards, stream decks and lights for streamers.',
      description: 'Compare prices on webcams, streaming microphones, capture cards, stream decks and lights across retailers.'
    },
    {
      slug: 'components', name: 'PC Components', nav: 'Components', short: 'PC components', icon: 'plug',
      intro: 'Graphics cards, processors, motherboards, memory, NVMe SSDs, CPU coolers, PC cases and power supplies.',
      description: 'Compare prices on graphics cards, processors, motherboards, memory, SSDs, coolers, cases and power supplies across retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'AGW', 'VGW', 'SGW', 'BGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'Car Gear', 'Travel Gear', 'Sporty Gear', 'Biker Gear', 'trade or profession'
  ]
};
