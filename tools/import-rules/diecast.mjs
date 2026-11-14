// Import rules for Diecast Models Wholesale (CJ Affiliate advertiser 2357926, diecastmodelswholesale.com) on Kids' Gear
// World. Joined on CJ 13 Nov 2026 (also on Awin 87779: one network only, CJ, so the same model is never shown twice).
// Feed facts (14 Nov 2026): about 9,000 rows in USD (one per model), USD 3-1,299; brands Jada, Motormax, Greenlight,
// Maisto, Auto World, Solido, New Ray, Mini GT; sections like "Ford|Pickup|Motormax|1 > 24|Automotive".
// Delivery: the 48 mainland US states only (L62 check of 13 Nov 2026): deliversTo US on KGW (round 2b, lessons L107).
export const RULES = {
  key: 'diecast',
  network: 'cj',
  advertiserId: 2357926,
  retailer: 'Diecast Models Wholesale',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?diecastmodelswholesale\.com\//i,
  sites: ['kgw'],
  maxPrice: 1500,
  minPrice: 5
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  const t = n + ' | ' + String(feedCategory || '');
  if (!n) return { reject: 'no name' };
  if (/gift card|display case only|shipping protection/i.test(n)) return { reject: 'gift card or display case' };
  const toy = sub => ({ site: 'kgw', siteCategory: 'Toys & Games', subcategory: sub });
  // A car "with Driver Figure" or "with ... Diecast Figure" is a car, and "by American Diorama" is a maker, not a diorama
  // (local check of 14 Nov 2026: 169 cars with a figure and about 40 American Diorama cars went to the figures).
  const own = n.replace(/\bby American Diorama\b/gi, ' ').replace(/\bwith\b[^"]*?\bfigur(?:e|es|ine|ines)\b/gi, ' ');
  if (W(['model kit', 'skill \\d', 'plastic model kit']).test(t)) return toy('Construction Set Toys');
  if (W(['figures?', 'figurines?']).test(own)) return toy('Action & Toy Figures');
  // Dioramas, canopies and other scene pieces for scale models.
  if (W(['dioramas?', 'accessory sets?']).test(own) || (W(['canopy', 'canopies']).test(own) && /for 1[/:]\d+ scale models/i.test(own))) return toy('Toys & Games');
  // No plain "jet": "Cobra Jet" and "Jet Black" are cars.
  if (W(['aircraft', 'airplane', 'aeroplane', 'airliner', 'jetliner', 'fighter jet', 'jet fighter', 'business jet', 'helicopter', 'cessna', 'boeing', 'airbus']).test(t)) return toy('Toy Aeroplanes');
  if (W(['motorcycles?', 'motorbikes?', 'scooter']).test(t)) return toy('Toy Motorcycles');
  // Trains only by name ("Railway Express Agency" is a pickup, "Hamilton Street Railway" a bus, "Grain Train" a trailer).
  if (W(['train sets?', 'locomotives?', 'railcars?', 'passenger cars?', 'freight cars?']).test(n) || /\btrain\b(?! wheel)/i.test(n.replace(/grain train|a-train/gi, ''))) return toy('Toy Trains & Train Sets');
  if (W(['trucks?', 'tractors?', 'semi', 'trailer', 'bulldozer', 'excavator', 'loader', 'construction', 'agriculture', 'farming', 'peterbilt', 'kenworth', 'caterpillar', 'john deere']).test(t)) return toy('Toy Lorries & Construction Vehicles');
  return toy('Toy Cars');
}
