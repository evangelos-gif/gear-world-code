// Import rules for Defender Security Products (Adtraction programme 1974721411 "Defender UK",
// defendersecurityproducts.co.uk, pounds) on Home Gear World. Massive import, wave 1 UK, Adtraction (chat 7 sheet
// «Εγκρίσεις», approved 23 Nov 2026, lessons L225).
// Feed of 24 Nov 2026: 71 products, all in stock, from £2.50 to £279: cameras and a video doorbell, door, window and
// shed alarms, key safes and door locks, plug timers and smart plugs, torches and LED bulbs, and personal items
// (attack alarms, RFID card blockers, signal-blocking pouches, drink test strips).
//  - Home security to HGW Smart Home (subcategories the site already has, L56): cameras to Security Camera, the doorbell to
//    Video Doorbell, door/window/shed alarms to Smart Sensor, the carbon monoxide alarm to Smoke Alarm, smart plugs to Smart
//    Plug, remote sockets and plug timers to Smart Socket, key safes, door braces, locks and the fake TV to Smart Home
//    Accessories; LED bulbs to Lighting > Light Bulb and solar security lights to Lighting > Outdoor Light.
//  - Left out: personal safety items carried on the person (attack and panic alarms, torches, RFID card holders, Faraday
//    pouches, phone cables, drink strips, privacy kits), bike lights and locks and the number plate kit (not home products).
export const RULES = {
  key: 'defender-uk',
  network: 'adtraction',
  advertiserId: 1974721411,
  retailer: 'Defender',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?defendersecurityproducts\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 1000,
  minPrice: 2
};

// The feed's brand column says "Co" for every row (not a brand); the brand is not shown.
export function displayBrand() { return ''; }

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').replace(/\s+[–-]\s+/g, ' - ').trim();
}

const SMART = sub => ({ site: 'hgw', siteCategory: 'Smart Home', subcategory: sub });
// [test, place] - the first match wins. Personal items before the alarms: a "Personal Attack Alarm" is not a door alarm.
const PLACES = [
  [/personal(?! safe)|attack alarm|panic alarm|wrist worn|torch|head-?lite|jump-?lite|work-?lite|peg-?lite|card defender|rfid|faraday|signal blocker|phone defender|anti-snatch|check your drink|privacy kit|bike|d-lock|number plate|cable tie lock|glow-in-dark/i, null],
  [/doorbell/i, SMART('Video Doorbell')],
  [/camera|cctv/i, SMART('Security Camera')],
  [/carbon monoxide|smoke alarm/i, SMART('Smoke Alarm')],
  [/alarm|memo minder/i, SMART('Smart Sensor')],
  [/smart plug/i, SMART('Smart Plug')],
  [/remote control socket|timer/i, SMART('Smart Socket')],
  [/simulated tv|key safe|keyguard|safe\b|door brace|swiftlock|jammer|letter plate|door lock|lock\b/i, SMART('Smart Home Accessories')],
  [/solar security light/i, { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Outdoor Light' }],
  [/\bbulbs?\b/i, { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Light Bulb' }]
];

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  for (const [re, place] of PLACES) {
    if (!re.test(n)) continue;
    if (!place) return { reject: 'a personal safety item, bike or car item, not a home product' };
    return { ...place, name: n };
  }
  return { reject: 'not a home security product the site has a place for' };
}
