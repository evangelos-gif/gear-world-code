// Seasons, campaigns and deals of the home screen, the same as the Hub's home page (gearworldhub.com, hub-v2.js,
// 4/11/2026). No React or native code, so it can be tested with plain Node.
// Rules kept from the Hub: shopping seasons only (never "new site" news); every deal comes from the Hub's
// hub-deals.json with its end date; the app never shows a code and never links to /go/ or /out/ (the button opens
// the retailer page of a Gear World site); all days are UK days (lessons L32).

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const isoUtc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Last Sunday of a month (1-12), as the day of the month. */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** UK time is GMT, or BST (+1 h) from the last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC. */
export function ukDay(ms: number): string {
  const y = new Date(ms).getUTCFullYear();
  const bstStart = Date.UTC(y, 2, lastSunday(y, 3), 1);
  const bstEnd = Date.UTC(y, 9, lastSunday(y, 10), 1);
  const local = new Date(ms + (ms >= bstStart && ms < bstEnd ? 3600000 : 0));
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** Black Friday: the day after the fourth Thursday of November. */
export function blackFridayDay(year: number): number {
  const firstDay = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = 1 + ((4 - firstDay + 7) % 7);
  return firstThursday + 22;
}

/** Where a button takes the person. The app has no gift finder yet, so gift buttons go to the worlds. */
export type Target = 'deals' | 'newsletter' | 'worlds' | { world: string };

export type Season = {
  id: 'halloween' | 'black-friday' | 'christmas';
  start: string; end: string; file: string; name: string; title: string; mirror: boolean; gifts: boolean;
  countdownTo: string | null;
};

/**
 * The seasonal pictures of the Hub (the same calendar every year, UK days). One change from the Hub: the Christmas
 * picture says "Gifts for everyone, from 13 Gear Worlds", not "Christmas offers", because no retailer has sent
 * Christmas offers yet and its button goes to the worlds (owner, 4/11/2026: the title promised offers that were not there).
 */
export function seasonsOf(year: number): Season[] {
  const bf = blackFridayDay(year);
  return [
    { id: 'halloween', start: `${year}-10-20`, end: `${year}-10-31`, file: 'halloween', name: 'seasonHalloween', title: 'halloweenTitle', mirror: true, gifts: false, countdownTo: null },
    { id: 'black-friday', start: isoUtc(year, 11, bf - 7), end: isoUtc(year, 11, bf + 4), file: 'black-friday', name: 'seasonBlackFriday', title: 'bfTitle', mirror: false, gifts: false, countdownTo: `${isoUtc(year, 11, bf + 3)}T23:59:00Z` },
    { id: 'christmas', start: `${year}-11-01`, end: `${year}-12-24`, file: 'christmas', name: 'xmasEyebrow', title: 'xmasTitle', mirror: true, gifts: true, countdownTo: null }
  ];
}

export function seasonFor(day: string): Season | null {
  return seasonsOf(Number(day.slice(0, 4))).find(s => s.start <= day && day <= s.end) ?? null;
}

export type Campaign = {
  id: string; start: string; end: string; art: string; eyebrow: string; title: string; text: string; cta: string; target: Target;
};

// The drawn campaign slides of the Hub. Gift buttons ("Find a gift") become "Choose a world" here, because the app
// has no gift finder yet; their text is then the matching one ("Choose a world or search them all at once").
// The dates repeat every year (Black Friday from its own date), so the banner never runs out and needs no new app
// version for these campaigns (owner, 8/11/2026). The Hub (hub-v2.js) still writes the 2026 dates by hand.
export function campaignsOf(year: number): Campaign[] {
  const bf = blackFridayDay(year);
  return [
    { id: 'halloween', start: `${year}-10-20`, end: `${year}-10-31`, art: 'halloween', eyebrow: 'halloweenEyebrow', title: 'halloweenTitle', text: 'halloweenText', cta: 'bfCta', target: 'deals' },
    { id: 'black-friday', start: isoUtc(year, 11, bf), end: isoUtc(year, 11, bf + 3), art: 'black-friday', eyebrow: 'bfEyebrow', title: 'bfTitle', text: 'bfText', cta: 'bfCta', target: 'deals' },
    { id: 'black-friday-soon', start: isoUtc(year, 11, bf - 14), end: isoUtc(year, 11, bf - 1), art: 'black-friday-soon', eyebrow: 'soonEyebrow', title: 'soonTitle', text: 'soonText', cta: 'soonCta', target: 'newsletter' },
    { id: 'christmas', start: `${year}-11-01`, end: `${year}-12-24`, art: 'christmas', eyebrow: 'xmasEyebrow', title: 'xmasTitle', text: 'allText', cta: 'allCta', target: 'worlds' },
    { id: 'winter-sales', start: `${year}-12-26`, end: `${year + 1}-01-15`, art: 'winter-sales', eyebrow: 'salesEyebrow', title: 'salesTitle', text: 'bfText', cta: 'bfCta', target: 'deals' },
    { id: 'new-year-fitness', start: `${year}-01-01`, end: `${year}-01-31`, art: 'new-year-fitness', eyebrow: 'fitnessEyebrow', title: 'fitnessTitle', text: 'fitnessText', cta: 'fitnessCta', target: { world: 'SGW' } },
    { id: 'valentines-day', start: `${year}-02-01`, end: `${year}-02-14`, art: 'valentines-day', eyebrow: 'valEyebrow', title: 'valTitle', text: 'allText', cta: 'allCta', target: 'worlds' }
  ];
}

/** This year's campaigns (their texts are the same every year). */
export const CAMPAIGNS: Campaign[] = campaignsOf(2026);

export const FALLBACK_CAMPAIGN: Campaign = {
  id: 'all-worlds', start: '', end: '', art: '', eyebrow: 'allEyebrow', title: 'allTitle', text: 'allText', cta: 'allCta', target: 'worlds'
};

/** The campaigns running on a UK day. Last year's list is included for the sales that run over New Year. */
export function activeCampaigns(day: string): Campaign[] {
  const year = Number(day.slice(0, 4));
  const list = [...campaignsOf(year - 1), ...campaignsOf(year)]
    .filter(c => DAY.test(c.start) && DAY.test(c.end) && c.start <= day && day <= c.end);
  return list.length ? list : [FALLBACK_CAMPAIGN];
}

export type Slide = { kind: 'season'; id: string; season: Season } | { kind: 'campaign'; id: string; campaign: Campaign };

// The seasonal picture first (in its days), then the other running campaigns, without the drawn slide of the same season.
const SEASON_REPLACES: Record<Season['id'], string[]> = {
  halloween: ['halloween'], 'black-friday': ['black-friday', 'black-friday-soon'], christmas: ['christmas']
};

export function heroSlides(ms: number): Slide[] {
  const day = ukDay(ms);
  const season = seasonFor(day);
  const list = activeCampaigns(day);
  const toSlide = (c: Campaign): Slide => ({ kind: 'campaign', id: c.id, campaign: c });
  if (!season) return list.map(toSlide);
  const rest = list.filter(c => c !== FALLBACK_CAMPAIGN && !SEASON_REPLACES[season.id].includes(c.id));
  return [{ kind: 'season', id: `season-${season.id}`, season }, ...rest.map(toSlide)];
}

/** Days, hours and minutes left, or `null` when the season has no countdown or it is over. */
export function countdownParts(season: Season, ms: number): { d: number; h: number; m: number } | null {
  if (!season.countdownTo) return null;
  const left = Date.parse(season.countdownTo) - ms;
  if (!(left > 0)) return null;
  const mins = Math.floor(left / 60000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

// ---------- deals (gearworldhub.com/hub-deals.json, made by the Hub from the retailers' own offers)

export type Deal = {
  id: string; retailer: string; kind: 'code' | 'sale'; campaign: string; currency: string; sites: string[];
  start: string; end: string; link: string; off: number; minSpend: number; upTo: number;
};

const LINK = /^https:\/\/[a-z0-9.-]+\/discount-codes\/[a-z0-9-]+\/$/;
const text = (v: unknown, max: number) => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max);
const amount = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

/** The Hub's deals file, checked (never trusted): only the fields the app shows, and only site links. */
export function parseDeals(data: unknown): Deal[] {
  const list = (data as { deals?: unknown } | null)?.deals;
  if (!Array.isArray(list)) return [];
  const out: Deal[] = [];
  for (const raw of list) {
    const d = (raw ?? {}) as Record<string, unknown>;
    const link = text(d.link, 200);
    const deal: Deal = {
      id: text(d.id, 80), retailer: text(d.retailer, 60), kind: d.kind === 'code' ? 'code' : 'sale', campaign: text(d.campaign, 40),
      currency: /^[A-Z]{3}$/.test(text(d.currency, 3).toUpperCase()) ? text(d.currency, 3).toUpperCase() : 'GBP',
      sites: Array.isArray(d.sites) ? d.sites.map(s => text(s, 6).toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s)) : [],
      start: text(d.start, 10), end: text(d.end, 10), link, off: amount(d.off), minSpend: amount(d.minSpend), upTo: amount(d.upTo)
    };
    if (deal.id && deal.retailer && DAY.test(deal.start) && DAY.test(deal.end) && LINK.test(link)) out.push(deal);
  }
  return out;
}

/** The deals that run today: codes first (smaller minimum spend first), then sales (bigger saving first). */
export function activeDeals(deals: Deal[], day: string): Deal[] {
  return deals
    .filter(d => d.start <= day && day <= d.end)
    .filter(d => (d.kind === 'code' ? d.off > 0 : d.upTo > 0))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'code' ? -1 : 1) ||
      (a.kind === 'code' ? a.minSpend - b.minSpend : b.upTo - a.upTo));
}

const SEASON_WORDS: Partial<Record<Season['id'], RegExp>> = {
  halloween: /halloween/i, 'black-friday': /black ?friday|cyber ?monday/i, christmas: /christmas|xmas/i
};

/** The campaign name of a deal ("Halloween"), but not once that season is over (the code itself still runs). */
export function campaignLabel(deal: Deal, day: string): string {
  for (const s of seasonsOf(Number(day.slice(0, 4)))) {
    if (SEASON_WORDS[s.id]?.test(deal.campaign) && day > s.end) return '';
  }
  return deal.campaign;
}

export const DEALS_SHOWN = 4;
