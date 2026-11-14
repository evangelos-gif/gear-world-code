// Gear World Group - the company page for retailers and affiliate networks (gearworldgroup.com).
// It lists the Gear World sites and how we promote retailers. No products, no database, no cookies.

export default {
  name: 'Gear World Group',
  domain: 'gearworldgroup.com',
  // Owner's decision, 7 Nov 2026 (Google Ads review, lessons L101): the person who runs the network and the country,
  // never a home address.
  operatorName: 'Evangelos Kalogerakis, United Kingdom',
  // Shown on the page. Must be an address that receives mail (gearworldgroup.com uses Google Workspace).
  contactEmail: 'evangelos@gearworldgroup.com',
  awinPublisherId: 3057233,
  assetVersion: '2026-11-14-group-9',
  // Countries where affiliate programmes have approved us but their products are not on the sites yet (lessons L130):
  // the countries list says "More coming" next to them. Only countries with a real approval; the retailers chat
  // ("3 · Retailers & Feeds") keeps it up to date with the retailer list. 14 Nov 2026: Rakuten PREMIUM BANDAI USA and
  // CJ TikTok Shop US (US); Lunzo (DE, AT, PL, CZ, RO, HU); Uhrcenter (DE); Lapert (CZ); Laboratoire Laurent (FR);
  // Pneumatici IT (IT); Neumaticos (ES); 4kidsonly and Daisycon (NL); iRepairshop BE (BE).
  coming: ['US', 'DE', 'AT', 'PL', 'CZ', 'RO', 'HU', 'FR', 'IT', 'ES', 'NL', 'BE'],
  hub: { name: 'Gear World Hub', url: 'https://gearworldhub.com/', text: 'One search across every Gear World site, in 11 languages.' },
  // stats: true = the site answers /api/stats; its live product count is added up on the page.
  sites: [
    { name: 'Technology Gear World', url: 'https://technologygearworld.com/', text: 'Laptops, phones, audio, gaming, TV and smart home.', stats: true },
    { name: "Men's Gear World", url: 'https://mensgearworld.com/', text: 'Clothing, watches, jewellery, shoes, grooming and everyday carry.', stats: true },
    { name: "Women's Gear World", url: 'https://womensgearworld.com/', text: 'Clothing, watches, jewellery, shoes, bags and beauty.', stats: true },
    { name: 'Home Gear World', url: 'https://homegearworld.com/', text: 'Furniture, kitchen, appliances, bedding, lighting and storage.', stats: true },
    { name: 'Garden Gear World', url: 'https://gardengearworld.com/', text: 'Garden tools, power tools, watering and garden care.', stats: true },
    { name: "Kids' Gear World", url: 'https://kidsgearworld.com/', text: 'Toys, baby gear, clothing and gifts for children.', stats: true },
    { name: 'Construction Gear World', url: 'https://constructiongearworld.com/', text: 'Power tools, hand tools, workwear and site equipment.', stats: true },
    { name: 'Car Gear World', url: 'https://cargearworld.com/', text: 'Garage tools, car parts, car care, dash cams and EV charging.', stats: true },
    { name: 'Travel Gear World', url: 'https://travelgearworld.com/', text: 'Luggage, travel bags, travel accessories and camping gear.', stats: true },
    { name: 'Sporty Gear World', url: 'https://sportygearworld.com/', text: 'Gym and fitness, running, cycling, team and racket sports, sports nutrition and sportswear.', stats: true },
    { name: 'Biker Gear World', url: 'https://bikergearworld.com/', text: 'Motorbike helmets, riding gear, parts and tools, luggage and locks, intercoms, electric scooters, kick scooters and electric motorbikes.', stats: true },
    { name: 'Gaming Gear World', url: 'https://gaminggearworld.com/', text: 'Consoles and games, gaming PCs and laptops, gaming monitors, keyboards and mice, headsets, gaming chairs, streaming gear and PC components.', stats: true },
    { name: 'Pets Gear World', url: 'https://petsgearworld.com/', text: 'Pet food and treats, beds and crates, leads and collars, toys, cat trees and litter, grooming, bowls, carriers, small pets, birds and horse riding gear.', stats: true }
  ]
};
