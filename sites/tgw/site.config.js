// Technology Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';
import { networkFor } from '../../promos/network.js';

export default {
  code: 'TGW',
  name: 'Technology Gear World',
  shortName: 'Tech Gear World',
  domain: 'technologygearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-11-08-tgw-cleanup-1',
  // Key prefix for what a visitor's browser remembers (compare list, cart, language, currency).
  // Discount codes and sales from retailers (promos/promos.js, lessons L32), with the Awin publisher id
  // used for their links. The id is public: it is part of every Awin link.
  promos: promosFor('TGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'tgw',

  // 11 languages, the same as Gear World Hub. Pages are written in English by the server; the site
  // script swaps the text using one small file per language (public/assets/i18n/<code>.json), loaded
  // only when a visitor picks that language (lessons L24). Product names stay as the retailer wrote them.
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

  // 5 display currencies, the same as the other Gear World sites. Retailers charge in GBP, so the GBP
  // price always stays on the page and the converted price is shown next to it as "≈" (lessons L25).
  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],

  // Saved list (the Gear Cart until 7 Nov 2026, lessons L101): a list kept in the visitor's browser. Every buy button goes through /out/<id> (lessons L26).
  cart: { name: 'Saved list', maxItems: 30 },

  // Microphone button in every search box, like the other Gear World sites. The browser turns speech into
  // text (Chrome uses Google's service, Safari uses Apple's); the site only receives the text. Camera search
  // is planned: when it comes, allow camera=(self) in src/lib/http.js the same way.
  voiceSearch: true,

  // Look of the Gear World family: dark page, gold headings, photo hero and photo category tiles.
  themeColor: '#0a1222',
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent tech price comparison',
  // Photos: Pexels licence (free for commercial use). Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  // Shown in <title> of the home page and in social previews.
  homeTitle: 'Technology Gear World | Compare Laptops, Phones, Audio & Smart Tech',
  homeDescription:
    'Compare prices on laptops, phones, headphones, gaming, TVs and smart home tech across retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare tech prices in one place',
  heroText: 'Laptops, phones, audio, gaming and smart home in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search laptops, headphones, TVs...',
  // Words used inside sentences of the shared pages.
  topic: 'tech',
  topicTitle: 'Tech',
  topicLong: 'technology',

  // Required before launch: the QA gate fails while any of these are empty.
  contactEmail: 'contact@technologygearworld.com',
  operatorName: 'Gear World',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  // The other 12 Gear World sites, from the one shared list (promos/network.js, lessons L99).
  network: networkFor('TGW'),

  // 8 categories, like Garden and Men's Gear World: clean 4 x 2 grid and well-filled categories.
  categories: [
    {
      slug: 'laptops-computing', name: 'Laptops & Computing', nav: 'Laptops & Computing', short: 'laptops, tablets, PCs and printers', icon: 'laptop',
      intro: 'Laptops, tablets and iPads, desktop PCs, monitors, keyboards, printers and ink. Compare prices across retailers before you buy.',
      description: 'Compare laptop, tablet, desktop PC, monitor and printer prices across retailers. Filter by brand and price, then buy direct.',
      // Mini PCs (owner, 6 Nov 2026, lessons L97): found by words in the product name, because the feeds file them under
      // "Computers" or "PC's & Workstations". Their own page (?sub=mini-pcs, in the sitemap) and a link in the menu.
      // Checked on the live database (6 Nov 2026): 140 mini PCs; the words below leave out Tiny-In-One monitors, power
      // adapters "for mini PC" and the D-Link "Nuclias" products.
      subcategories: [
        {
          slug: 'mini-pcs', name: 'Mini PCs', nav: 'Mini PCs', index: true, menu: true,
          title: 'Mini PCs',
          intro: 'Small desktop computers that fit behind a monitor or under a TV: Intel NUC, Lenovo Tiny, HP and Dell mini PCs and more. Compare prices across retailers before you buy.',
          description: 'Compare mini PC prices across retailers: Intel NUC, Lenovo Tiny, HP and Dell mini desktops and more. Filter by brand and price, then buy direct.',
          match: ['mini pc', 'mini pcs', 'minipc', 'mini computer', 'mini desktop', 'micro pc', 'nuc', 'chromebox', 'tiny'],
          exclude: ['dock', 'docking', 'mount', 'bracket', 'stand', 'case', 'cable', 'adapter', 'charger', 'inverter', 'power supply',
            'keyboard', 'mouse', 'controller', 'memory', 'enclosure', 'tiny in one', 'monitor']
        }
      ]
    },
    {
      slug: 'phones-smartwatches', name: 'Phones & Smartwatches', nav: 'Phones & Watches', short: 'phones and smartwatches', icon: 'phone',
      intro: 'SIM-free smartphones, smartwatches and fitness trackers, new and refurbished.',
      description: 'Compare SIM-free phone, smartwatch and fitness tracker prices, new and refurbished, across retailers.'
    },
    {
      slug: 'audio', name: 'Headphones & Audio', nav: 'Audio', short: 'headphones and speakers', icon: 'headphones',
      intro: 'Headphones, earbuds, Bluetooth speakers and soundbars. See the current price at each retailer in one list.',
      description: 'Compare headphones, earbuds, speakers and soundbar prices across retailers.'
    },
    {
      slug: 'gaming', name: 'Gaming', nav: 'Gaming', short: 'gaming', icon: 'gamepad',
      intro: 'Consoles, controllers, gaming headsets, keyboards and chairs for PlayStation, Xbox, Nintendo and PC.',
      description: 'Compare prices on consoles, controllers, gaming headsets and accessories across retailers.'
    },
    {
      slug: 'cameras-drones', name: 'Cameras & Drones', nav: 'Cameras', short: 'cameras and drones', icon: 'camera',
      intro: 'Digital and instant cameras, action cams, dash cams, drones, lenses and gimbals.',
      description: 'Compare camera, action cam, dash cam and drone prices across retailers.'
    },
    {
      slug: 'tv-home-cinema', name: 'TV & Home Cinema', nav: 'TV', short: 'TVs and projectors', icon: 'tv',
      intro: 'Smart TVs, projectors and streaming devices. Compare screen sizes and prices before you choose.',
      description: 'Compare smart TV, projector and streaming device prices across retailers.'
    },
    {
      slug: 'smart-home-wifi', name: 'Smart Home & Wi-Fi', nav: 'Smart Home', short: 'smart home and Wi-Fi', icon: 'home',
      intro: 'Smart plugs and bulbs, video doorbells, security cameras, smart speakers, Wi-Fi routers and mesh systems.',
      description: 'Compare smart home, video doorbell, security camera, router and mesh Wi-Fi prices across retailers.'
    },
    {
      slug: 'accessories-storage', name: 'Accessories & Storage', nav: 'Accessories', short: 'accessories and storage', icon: 'plug',
      intro: 'Chargers, power banks, cables, cases and screen protectors, plus SSDs, memory cards and USB sticks.',
      description: 'Compare charger, power bank, cable, case, SSD and memory card prices across retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block.
  // The QA gate uses this list to catch text copied from another site (lessons L01).
  foreignMarkers: [
    'KGW', 'HGW', 'GGW', 'MGW', 'WGW', 'CGW',
    'Home Gear', 'Garden Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'everyday carry', 'trade or profession'
  ]
};
