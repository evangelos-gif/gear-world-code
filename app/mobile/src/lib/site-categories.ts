// Categories for the world screens.
// 1. The 7 newer sites (TGW, AGW, VGW, SGW, BGW, PGW, ZGW): the Hub registry gives no categories for them yet, so the
//    app uses each site's own list (SITE_CATEGORIES below, from its site.config.js). Once the Hub gives them, the Hub wins.
// 2. The 6 older sites: four registry slugs are not the names the site's own product API uses, so choosing them showed
//    every product (checked 4 Nov 2026: CGW "safety-boots" gave all 80,640). They are corrected here; the two "gifts"
//    categories have no filter on the older sites and are left out until the sites have them.
import type { Category, World } from './api';

const FIX: Record<string, Record<string, string | null>> = {
  CGW: { 'safety-boots': 'safety-footwear' },
  MGW: { 'mens-jewellery': 'jewellery', 'everyday-carry-edc': 'everyday-carry', 'gifts-for-men': null },
  WGW: { 'womens-jewellery': 'jewellery', 'everyday-carry-edc': 'everyday-essentials', 'gifts-for-women': null }
};

/** The slug the site's product API understands; `null` = this category cannot be filtered on that site. */
export function apiSlug(worldKey: string, slug: string): string | null {
  const fix = FIX[worldKey.toUpperCase()];
  if (fix && slug in fix) return fix[slug];
  return slug;
}

/** The categories to offer on a world screen, with slugs the site understands. */
export function categoriesFor(world: Pick<World, 'key' | 'categories'>): Category[] {
  const own = world.categories
    .map(c => ({ ...c, slug: apiSlug(world.key, c.slug) }))
    .filter((c): c is Category => typeof c.slug === 'string' && c.slug.length > 0);
  if (own.length) return own;
  const list: unknown = SITE_CATEGORIES[world.key.toUpperCase()];
  if (!Array.isArray(list)) return [];
  return list
    .map(c => c as { slug?: unknown; name?: unknown })
    .filter(c => typeof c.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(c.slug) && typeof c.name === 'string')
    .map(c => ({ key: String(c.slug), name: String(c.name), slug: String(c.slug) }));
}

// Categories of the 7 newer Gear World sites, from sites/<code>/site.config.js (gear-world-code ffe4220, 4 Nov 2026). Used only while the Hub registry gives no categories for a world. Every slug was checked against <site>/api/products?category=<slug> on 4 Nov 2026 (all have products).
export const SITE_CATEGORIES: Record<string, { slug: string; name: string }[]> = {
  "TGW": [
    {
      "slug": "laptops-computing",
      "name": "Laptops & Computing"
    },
    {
      "slug": "phones-smartwatches",
      "name": "Phones & Smartwatches"
    },
    {
      "slug": "audio",
      "name": "Headphones & Audio"
    },
    {
      "slug": "gaming",
      "name": "Gaming"
    },
    {
      "slug": "cameras-drones",
      "name": "Cameras & Drones"
    },
    {
      "slug": "tv-home-cinema",
      "name": "TV & Home Cinema"
    },
    {
      "slug": "smart-home-wifi",
      "name": "Smart Home & Wi-Fi"
    },
    {
      "slug": "accessories-storage",
      "name": "Accessories & Storage"
    }
  ],
  "AGW": [
    {
      "slug": "garage-tools-equipment",
      "name": "Garage Tools & Equipment"
    },
    {
      "slug": "diagnostics-battery",
      "name": "Diagnostics & Battery"
    },
    {
      "slug": "parts-maintenance",
      "name": "Parts & Maintenance"
    },
    {
      "slug": "tyres-wheels",
      "name": "Tyres & Wheels"
    },
    {
      "slug": "car-care-detailing",
      "name": "Car Care & Detailing"
    },
    {
      "slug": "car-electronics",
      "name": "Car Electronics"
    },
    {
      "slug": "interior-comfort",
      "name": "Interior & Comfort"
    },
    {
      "slug": "roof-towing-exterior",
      "name": "Roof, Towing & Exterior"
    },
    {
      "slug": "ev-charging",
      "name": "EV Charging"
    },
    {
      "slug": "safety-winter",
      "name": "Safety & Winter"
    }
  ],
  "VGW": [
    {
      "slug": "luggage-suitcases",
      "name": "Luggage & Suitcases"
    },
    {
      "slug": "travel-bags-backpacks",
      "name": "Travel Bags & Backpacks"
    },
    {
      "slug": "travel-accessories",
      "name": "Travel Accessories"
    },
    {
      "slug": "comfort-sleep",
      "name": "Comfort & Sleep"
    },
    {
      "slug": "documents-security",
      "name": "Documents & Security"
    },
    {
      "slug": "travel-tech",
      "name": "Travel Tech"
    },
    {
      "slug": "camping-outdoor",
      "name": "Camping & Outdoor"
    },
    {
      "slug": "beach-holiday",
      "name": "Beach & Holiday"
    }
  ],
  "SGW": [
    {
      "slug": "fitness-gym",
      "name": "Fitness & Gym"
    },
    {
      "slug": "running",
      "name": "Running"
    },
    {
      "slug": "cycling",
      "name": "Cycling"
    },
    {
      "slug": "football-team-sports",
      "name": "Football & Team Sports"
    },
    {
      "slug": "racket-sports",
      "name": "Racket Sports"
    },
    {
      "slug": "water-sports",
      "name": "Water Sports & Swimming"
    },
    {
      "slug": "hiking-climbing-winter",
      "name": "Hiking, Climbing & Winter"
    },
    {
      "slug": "nutrition-hydration",
      "name": "Nutrition & Hydration"
    },
    {
      "slug": "sportswear-shoes-bags",
      "name": "Sportswear, Shoes & Bags"
    },
    {
      "slug": "golf-skate-more",
      "name": "Golf, Skate & More"
    }
  ],
  "BGW": [
    {
      "slug": "helmets",
      "name": "Motorbike Helmets"
    },
    {
      "slug": "jackets-trousers",
      "name": "Jackets & Trousers"
    },
    {
      "slug": "boots-gloves",
      "name": "Boots & Gloves"
    },
    {
      "slug": "parts-maintenance",
      "name": "Parts & Maintenance"
    },
    {
      "slug": "luggage-security",
      "name": "Luggage, Locks & Covers"
    },
    {
      "slug": "electronics",
      "name": "Intercoms, Cameras & Mounts"
    },
    {
      "slug": "electric-scooters",
      "name": "Electric Scooters"
    },
    {
      "slug": "kick-scooters",
      "name": "Kick Scooters"
    },
    {
      "slug": "electric-motorbikes",
      "name": "Electric Motorbikes & Mopeds"
    },
    {
      "slug": "protection",
      "name": "Protection & Hi-Vis"
    }
  ],
  "PGW": [
    {
      "slug": "games-cards",
      "name": "Games & Gift Cards"
    },
    {
      "slug": "controllers",
      "name": "Controllers, Wheels & Sticks"
    },
    {
      "slug": "consoles",
      "name": "Consoles & Handhelds"
    },
    {
      "slug": "pcs-laptops",
      "name": "Gaming PCs & Laptops"
    },
    {
      "slug": "monitors",
      "name": "Gaming Monitors"
    },
    {
      "slug": "mice-keyboards",
      "name": "Mice, Keyboards & Mouse Pads"
    },
    {
      "slug": "headsets",
      "name": "Headsets & Gaming Audio"
    },
    {
      "slug": "chairs-desks",
      "name": "Gaming Chairs & Desks"
    },
    {
      "slug": "streaming",
      "name": "Streaming: Cameras, Mics & Lights"
    },
    {
      "slug": "components",
      "name": "PC Components"
    }
  ],
  "ZGW": [
    {
      "slug": "beds-crates",
      "name": "Beds, Crates & Kennels"
    },
    {
      "slug": "walking",
      "name": "Leads, Collars & Coats"
    },
    {
      "slug": "toys",
      "name": "Toys & Training"
    },
    {
      "slug": "food",
      "name": "Food & Treats"
    },
    {
      "slug": "cats",
      "name": "Cat Trees, Litter & Scratchers"
    },
    {
      "slug": "grooming",
      "name": "Grooming & Care"
    },
    {
      "slug": "feeding",
      "name": "Bowls, Feeders & Smart Gadgets"
    },
    {
      "slug": "travel",
      "name": "Travel, Car & Carriers"
    },
    {
      "slug": "small-pets",
      "name": "Small Pets, Fish & Reptiles"
    },
    {
      "slug": "birds",
      "name": "Birds"
    },
    {
      "slug": "horse",
      "name": "Horse & Riding"
    }
  ]
};
