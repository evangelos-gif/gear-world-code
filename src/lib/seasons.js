// Seasonal banners (owner, 27/10/2026): a short muted video loop with its text on top, on the deals pages of every
// site. The files live on the Hub (gearworldhub.com/seasonal/, from the gearworld-media repo): one copy for all 11,
// answered with byte ranges for iPhone Safari and cached for a year (the address carries ?v=).
// The calendar repeats every year by itself, in UK days (the same as the Hub's sites/gwh/public/hub-v2.js):
//   Halloween 20/10-31/10
//   Black Friday from 7 days before to 4 days after Black Friday (2026: 20/11-1/12), with a countdown to the Monday
//   after it at 23:59 UK time (2026: 30/11; November is always GMT, so 23:59 UK = 23:59 UTC)
//   Christmas 2/12-24/12
// Outside these days there is no banner.
import { ukToday } from './promos.js';

export const SEASON_MEDIA_BASE = 'https://gearworldhub.com/seasonal/';
export const SEASON_MEDIA_VERSION = '29bd24c';

// Black Friday: the day after the 4th Thursday of November.
export function blackFridayDay(year) {
  const firstDay = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = 1 + ((4 - firstDay + 7) % 7);
  return firstThursday + 22;
}

const isoDay = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

export function seasonsOf(year) {
  const bf = blackFridayDay(year);
  return [
    { id: 'halloween', start: `${year}-10-20`, end: `${year}-10-31`, file: 'halloween', name: 'Halloween', title: 'Halloween offers', mirror: true },
    { id: 'black-friday', start: isoDay(year, 11, bf - 7), end: isoDay(year, 11, bf + 4), file: 'black-friday', name: 'Black Friday', title: 'Black Friday offers', countdownTo: `${isoDay(year, 11, bf + 3)}T23:59:00Z` },
    { id: 'christmas', start: `${year}-12-02`, end: `${year}-12-24`, file: 'christmas', name: 'Christmas', title: 'Christmas offers', mirror: true }
  ];
}

export function seasonFor(now = Date.now()) {
  const today = ukToday(now);
  return seasonsOf(Number(today.slice(0, 4))).find(s => s.start <= today && today <= s.end) || null;
}

export function seasonMedia(season, ext) {
  return `${SEASON_MEDIA_BASE}${season.file}.${ext}?v=${SEASON_MEDIA_VERSION}`;
}

// What is left until the countdown ends: { d, h, m } in whole minutes, or null when it is over (or has no countdown).
export function countdownLeft(season, now = Date.now()) {
  if (!season || !season.countdownTo) return null;
  const left = Date.parse(season.countdownTo) - now;
  if (!(left > 0)) return null;
  const mins = Math.floor(left / 60000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}
