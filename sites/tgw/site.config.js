// Technology Gear World - everything that is specific to this site lives here.
// The shared engine in src/ must never contain a site name, domain or colour.

export default {
  code: 'TGW',
  name: 'Technology Gear World',
  shortName: 'Tech Gear World',
  domain: 'technologygearworld.com',
  lang: 'en-GB',
  locale: 'en-GB',
  currency: 'GBP',
  assetVersion: '2026-10-18-4',

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
    'Compare prices on laptops, phones, headphones, gaming, TVs and smart home tech from UK retailers. Independent price comparison: find the deal, then buy direct.',
  heroTitle: 'Compare tech prices from UK retailers',
  heroText: 'Laptops, phones, audio, gaming and smart home in one place. Find the deal, then buy direct from the retailer.',
  searchPlaceholder: 'Search laptops, headphones, TVs...',

  // Required before launch: the QA gate fails while any of these are empty.
  contactEmail: '',
  operatorName: '',
  turnstileSiteKey: '',
  cloudflareAnalyticsToken: '',

  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', tagline: 'One Hub. Every Gear World.' },
  network: [
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/' },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/' },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
    { name: 'Home Gear World', url: 'https://homegearworld.com/' },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/' }
  ],

  categories: [
    {
      slug: 'computers-laptops', name: 'Computers & Laptops', nav: 'Laptops & PCs', icon: 'laptop',
      intro: 'Laptops, desktop PCs, monitors, keyboards and mice. Compare specs and prices across UK retailers before you buy.',
      description: 'Compare laptop, desktop PC and monitor prices from UK retailers. Filter by brand and price, then buy direct.'
    },
    {
      slug: 'phones-tablets', name: 'Phones & Tablets', nav: 'Phones & Tablets', icon: 'phone',
      intro: 'SIM-free smartphones, iPads and Android tablets, new and refurbished, from retailers that deliver in the UK.',
      description: 'Compare SIM-free phone and tablet prices, new and refurbished, from UK retailers.'
    },
    {
      slug: 'audio', name: 'Headphones & Audio', nav: 'Audio', icon: 'headphones',
      intro: 'Headphones, earbuds, Bluetooth speakers and soundbars. See the current price at each retailer in one list.',
      description: 'Compare headphones, earbuds, speakers and soundbar prices from UK retailers.'
    },
    {
      slug: 'gaming', name: 'Gaming', nav: 'Gaming', icon: 'gamepad',
      intro: 'Consoles, controllers, gaming headsets, keyboards and chairs for PlayStation, Xbox, Nintendo and PC.',
      description: 'Compare prices on consoles, controllers, gaming headsets and accessories from UK retailers.'
    },
    {
      slug: 'tv-projectors', name: 'TV & Projectors', nav: 'TV', icon: 'tv',
      intro: 'Smart TVs, projectors and streaming devices. Compare screen sizes and prices before you choose.',
      description: 'Compare smart TV, projector and streaming device prices from UK retailers.'
    },
    {
      slug: 'cameras-drones', name: 'Cameras & Drones', nav: 'Cameras', icon: 'camera',
      intro: 'Digital and instant cameras, action cams, dash cams, drones, lenses and gimbals.',
      description: 'Compare camera, action cam, dash cam and drone prices from UK retailers.'
    },
    {
      slug: 'smart-home', name: 'Smart Home', nav: 'Smart Home', icon: 'home',
      intro: 'Smart plugs and bulbs, video doorbells, security cameras, smart speakers and robot vacuums.',
      description: 'Compare smart plugs, doorbells, security cameras and smart speakers from UK retailers.'
    },
    {
      slug: 'wearables', name: 'Wearables', nav: 'Wearables', icon: 'watch',
      intro: 'Smartwatches and fitness trackers from Apple, Samsung, Garmin, Fitbit and more.',
      description: 'Compare smartwatch and fitness tracker prices from UK retailers.'
    },
    {
      slug: 'networking-storage', name: 'Networking & Storage', nav: 'Networking', icon: 'router',
      intro: 'Wi-Fi routers, mesh systems, SSDs, external drives, memory cards and USB sticks.',
      description: 'Compare Wi-Fi router, mesh, SSD and storage prices from UK retailers.'
    },
    {
      slug: 'printers-office', name: 'Printers & Office Tech', nav: 'Printers', icon: 'printer',
      intro: 'Printers, ink and toner, scanners and label printers for home and office.',
      description: 'Compare printer, ink, toner and scanner prices from UK retailers.'
    },
    {
      slug: 'charging-accessories', name: 'Charging & Accessories', nav: 'Charging', icon: 'plug',
      intro: 'Chargers, power banks, cables, cases and screen protectors for phones, tablets and laptops.',
      description: 'Compare chargers, power banks, cables and phone accessories from UK retailers.'
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
