// Every Gear World shop, in the order of the Hub home page (gearworldhub.com, 7 Nov 2026), for the "Gear World network"
// links in the footer of every site. One list for all the sites (lessons L99): each site's own list was written by hand,
// so on 7 Nov 2026 the live TGW still showed only the first 6 sites and the Hub. A new site goes in here once, and every
// site shows it at its next update. Kept with the shared promos because the sites' deploys copy this folder (src/ must
// never hold a site name). tests/worker/network.test.mjs checks it against the sites/<code>/site.config.js files.
export const GEAR_WORLDS = [
  { code: 'CGW', name: 'Construction Gear World', url: 'https://constructiongearworld.com/' },
  { code: 'MGW', name: "Men's Gear World", url: 'https://mensgearworld.com/' },
  { code: 'WGW', name: "Women's Gear World", url: 'https://womensgearworld.com/' },
  { code: 'KGW', name: "Kids' Gear World", url: 'https://kidsgearworld.com/' },
  { code: 'HGW', name: 'Home Gear World', url: 'https://homegearworld.com/' },
  { code: 'GGW', name: 'Garden Gear World', url: 'https://gardengearworld.com/' },
  { code: 'TGW', name: 'Technology Gear World', url: 'https://technologygearworld.com/' },
  { code: 'AGW', name: 'Car Gear World', url: 'https://cargearworld.com/' },
  { code: 'VGW', name: 'Travel Gear World', url: 'https://travelgearworld.com/' },
  { code: 'SGW', name: 'Sporty Gear World', url: 'https://sportygearworld.com/' },
  { code: 'BGW', name: 'Biker Gear World', url: 'https://bikergearworld.com/' },
  { code: 'PGW', name: 'Gaming Gear World', url: 'https://gaminggearworld.com/' },
  { code: 'ZGW', name: 'Pets Gear World', url: 'https://petsgearworld.com/' }
];

// The other Gear World sites, for the footer of the site with this code (the Hub link is added by the page itself).
export function networkFor(code) {
  return GEAR_WORLDS.filter(w => w.code !== String(code).toUpperCase()).map(({ name, url }) => ({ name, url }));
}
