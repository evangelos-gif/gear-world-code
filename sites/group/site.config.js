// Gear World Group - the company page for retailers and affiliate networks (gearworldgroup.com).
// It lists the Gear World sites and how we promote retailers. No products, no database, no cookies.

export default {
  name: 'Gear World Group',
  domain: 'gearworldgroup.com',
  operatorName: 'Gear World',
  // Shown on the page. Must be an address that receives mail (gearworldgroup.com uses Google Workspace).
  contactEmail: 'evangelos@gearworldgroup.com',
  awinPublisherId: 3057233,
  assetVersion: '2026-10-22-group-3',
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
    { name: 'Travel Gear World', url: 'https://travelgearworld.com/', text: 'Luggage, travel bags, travel accessories and camping gear.', stats: true }
  ]
};
