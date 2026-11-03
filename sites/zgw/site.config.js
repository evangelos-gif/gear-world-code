// Pets Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.
// Site code ZGW ("Zoo": PGW is Gaming, GGW is Garden; owner, 1 Nov 2026). Clickref on Awin: zgw-<product id>.
// Owner (1 Nov 2026): dogs, cats, small pets, birds, fish and reptiles, chickens, and horse and riding gear (11th
// category). No live animals, no prescription medicines, no health claims. Pet products now on Home and Kids' are copied
// here first; those sites delete nothing.

import { promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';

export default {
  code: 'ZGW',
  name: 'Pets Gear World',
  shortName: 'Pets Gear World',
  domain: 'petsgearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-11-03-zgw-ads-1',
  promos: promosFor('ZGW'),
  awinPublisherId: AWIN_PUBLISHER_ID,
  storagePrefix: 'zgw',

  // A new site with its own database (sites/zgw/migrations), like TGW, AGW, VGW, SGW, BGW and PGW.
  // The same product from several retailers (Plusshop UK and Bazta UK, one catalogue): one card, and a price table on its
  // page (dry run of 1 Nov 2026: 43 products at both shops).
  groupOffers: true,

  // All the first shops sell in pounds; a later shop in euros would keep its euro prices, with "≈ £…" next to them.
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

  // Where the retailers deliver (lessons L62): every product card and product page says it. All the first shops (Joybuy UK,
  // Plusshop UK, Bazta UK, Coes) are UK shops. The texts say "retailers in the UK and Europe", never "UK retailers"
  // (international visitors, as on the other sites).
  deliversTo: { default: ['GB'] },

  displayCurrencies: ['GBP', 'EUR', 'ALL', 'RON', 'RUB'],
  cart: { name: 'Gear Cart', maxItems: 30, maxQuantity: 99 },
  voiceSearch: true,

  // Colour 3 chosen by the owner (1 Nov 2026): brown with cream and light blue. The owner has a colour vision deficiency:
  // light blue on dark brown and dark brown text on cream stay easy to tell apart without red or green (L35). On the dark
  // header the blue is light (#8fd0ff); on cream it is a deep blue (#1d5a94), so that every text passes 4.5:1.
  themeColor: '#2a1d14',
  cssColorMap: {
    '#0a1222': '#2a1d14',
    '#060b16': '#1a120c',
    '#0f1b30': '#35261b',
    '#14243f': '#3f2e21',
    '#22344f': '#54402f',
    '#e8edf5': '#f6eee2',
    '#a9b6c8': '#d2c1ab',
    '#6cc8ff': '#a9dcff',
    '#f2b84b': '#8fd0ff',
    '#ffd27a': '#bfe4ff',
    '#f3f5f8': '#f8f1e6',
    '#dde3ea': '#e8dcc8',
    '#111a28': '#2b2018',
    '#4b5666': '#5e4c3d',
    '#1747d1': '#1d5a94',
    '#0d1e3b': '#1a120c',
    '#10284d': '#3f2e21',
    '#050912': '#140d08',
    '#dbe3ee': '#ebdfcc',
    '#c9d3e0': '#dccdb6',
    '#c3cdda': '#d6c6ae',
    '#b6c2d2': '#cbb99f',
    '#fff6e0': '#eaf5ff',
    '#fff8e8': '#f0f8ff',
    '%23f2b84b': '%238fd0ff',
    'rgba(6, 11, 22,': 'rgba(26, 18, 12,',
    'rgba(10, 18, 34,': 'rgba(42, 29, 20,',
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
/* The small line above the hero title in cream: easier to read on the photo. */
.hero .eyebrow { color: #f6eee2; }
/* 11 categories: 2 per row on tablets, 4 per row on wide screens (rows of 4, 4 and 3). */
@media (min-width: 720px) and (max-width: 1099px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .cat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
/* Birds: the row of subcategory links above the products (chickens, canaries, budgies...). */
.sub-nav .chip-list { margin: 0 0 14px; }
.sub-nav a[aria-current="page"] { background: var(--gold); border-color: var(--gold); color: var(--ink); }`,
  brandAccent: 'Gear World',
  heroEyebrow: 'Independent price comparison for pet owners',
  // Photos: Pexels licence (free for commercial use), brand marks removed. Sources in docs/IMAGE-CREDITS.md.
  heroImage: { src: 'img/hero-1920.webp', small: 'img/hero-960.webp', width: 1920, height: 1280 },
  categoryImages: true, // public/assets/img/cat-<slug>.webp, 720 x 480

  homeTitle: 'Pets Gear World | Compare Pet Food, Dog Beds, Cat Trees, Leads & Toys',
  homeDescription:
    'Compare prices on dog and cat food, treats, beds and crates, leads and collars, toys, cat trees and litter, grooming, bowls, carriers, small pet, bird and fish supplies and horse riding gear from trusted retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare pet supplies prices in one place',
  heroText: 'Food and treats, beds, leads, toys, cat trees and litter, grooming, bowls and carriers for dogs, cats, small pets, birds, fish and horses from retailers in the UK and Europe. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search dog beds, cat litter, dog food...',
  topic: 'pet supplies',
  topicTitle: 'Pet Supplies',
  topicLong: 'pet',

  contactEmail: 'contact@petsgearworld.com',
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
    { name: 'Sporty Gear World', url: 'https://sportygearworld.com/' },
    { name: 'Biker Gear World', url: 'https://bikergearworld.com/' },
    { name: 'Gaming Gear World', url: 'https://gaminggearworld.com/' }
  ],

  // 11 categories (owner, 1 Nov 2026: dogs, cats, small pets and fish, Birds with a subcategory per kind of bird, and horse
  // and riding as the 11th). Products are sorted into them by category-rules.js (the same order). A category with no products yet is
  // noindex and left out of the sitemap.
  categories: [
    {
      slug: 'beds-crates', name: 'Beds, Crates & Kennels', nav: 'Beds & Crates', short: 'pet beds and crates', icon: 'home',
      intro: 'Dog and cat beds, calming and orthopaedic beds, blankets, crates, playpens and pet gates.',
      description: 'Compare prices on dog and cat beds, calming beds, blankets, crates, playpens and pet gates from trusted retailers.'
    },
    {
      slug: 'walking', name: 'Leads, Collars & Coats', nav: 'Leads & Collars', short: 'leads, collars and dog coats', icon: 'globe',
      intro: 'Dog leads and harnesses, collars and ID tags, poo bags, and coats and jumpers for dogs.',
      description: 'Compare prices on dog leads, harnesses, collars, ID tags, poo bags and dog coats from trusted retailers.'
    },
    {
      slug: 'toys', name: 'Toys & Training', nav: 'Toys', short: 'pet toys', icon: 'gamepad',
      intro: 'Chew and squeaky toys, balls and launchers, cat wands and catnip toys, puzzle feeders and training aids.',
      description: 'Compare prices on dog chew toys, balls, cat toys, catnip, puzzle feeders and training aids from trusted retailers.'
    },
    {
      slug: 'food', name: 'Food & Treats', nav: 'Food & Treats', short: 'pet food and treats', icon: 'cart',
      intro: 'Dry and wet food, treats and dental chews for dogs and cats, and food for small pets and birds.',
      description: 'Compare prices on dry and wet dog and cat food, treats, dental chews and small pet food from trusted retailers.'
    },
    {
      slug: 'cats', name: 'Cat Trees, Litter & Scratchers', nav: 'Cat Trees & Litter', short: 'cat trees and litter', icon: 'home',
      intro: 'Cat trees and towers, scratching posts, cat litter, litter trays and automatic litter boxes.',
      description: 'Compare prices on cat trees, scratching posts, cat litter, litter trays and automatic litter boxes from trusted retailers.'
    },
    {
      slug: 'grooming', name: 'Grooming & Care', nav: 'Grooming', short: 'pet grooming', icon: 'watch',
      intro: 'Shampoos, brushes and combs, nail clippers, pet dryers, flea and tick treatments and supplements.',
      description: 'Compare prices on pet shampoos, brushes, nail clippers, pet dryers and flea and tick treatments from trusted retailers.'
    },
    {
      slug: 'feeding', name: 'Bowls, Feeders & Smart Gadgets', nav: 'Bowls & Feeders', short: 'pet bowls and feeders', icon: 'router',
      intro: 'Dog and cat bowls, slow feeders, automatic feeders, water fountains, pet cameras and GPS trackers.',
      description: 'Compare prices on dog and cat bowls, slow feeders, automatic feeders, water fountains and pet trackers from trusted retailers.'
    },
    {
      slug: 'travel', name: 'Travel, Car & Carriers', nav: 'Travel', short: 'pet carriers', icon: 'globe',
      intro: 'Pet carriers and backpacks, dog car seats and seat covers, strollers, ramps and travel bowls.',
      description: 'Compare prices on pet carriers, pet backpacks, dog car seats, seat covers and strollers from trusted retailers.'
    },
    {
      slug: 'small-pets', name: 'Small Pets, Fish & Reptiles', nav: 'Small Pets', short: 'small pet supplies', icon: 'home',
      intro: 'Hutches and cages, bedding, bottles and hides for rabbits, guinea pigs and hamsters, aquariums and vivariums.',
      description: 'Compare prices on hutches, small animal cages and bedding, aquariums and vivariums from trusted retailers.'
    },
    {
      // Owner (1 Nov 2026): one Birds category with a subcategory per kind of bird, no "chicken coops" category. The names
      // are the ones category-rules.js writes in the products' subcategory (BIRDS.subs).
      slug: 'birds', name: 'Birds', nav: 'Birds', short: 'bird supplies', icon: 'home',
      intro: 'Everything for chickens and poultry, canaries and finches, budgies and parrots: cages, food, perches, toys, feeders and drinkers.',
      description: 'Compare prices on supplies for chickens, canaries, budgies and parrots: cages, food, perches, toys, feeders and drinkers from trusted retailers.',
      subcategories: [
        { slug: 'chickens', name: 'Chickens & Poultry' },
        { slug: 'canaries', name: 'Canaries & Finches' },
        { slug: 'parrots', name: 'Budgies & Parrots' },
        { slug: 'other', name: 'Other Cage Birds' }
      ]
    },
    {
      slug: 'horse', name: 'Horse & Riding', nav: 'Horse & Riding', short: 'horse and riding gear', icon: 'globe',
      intro: 'Horse rugs, saddle pads, grooming kits, treats, fly masks and riding wear.',
      description: 'Compare prices on horse rugs, saddle pads, grooming kits, horse treats, fly masks and riding wear from trusted retailers.'
    }
  ],

  // Words that must never appear on this site's pages outside the network links block (lessons L01).
  foreignMarkers: [
    'TGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'AGW', 'VGW', 'SGW', 'BGW', 'PGW',
    'Home Gear', 'Garden Gear', 'Technology Gear', 'Tech Gear', 'Kids Gear', "Kids' Gear", 'Construction Gear',
    "Men's Gear", "Women's Gear", 'Car Gear', 'Travel Gear', 'Sporty Gear', 'Biker Gear', 'Gaming Gear', 'trade or profession'
  ]
};
