import { useCallback, useEffect, useState } from 'react';

import { getDealsData } from './api';
import { parseDeals, parseSeasonsOn, SEASONS_ON_DEFAULT, type Deal, type SeasonsOn } from './seasons';

// The Hub's deals, read once and shared by the home screen and the world screens (read again after 10 minutes,
// or when the person pulls down to refresh the home screen).
const FRESH_MS = 10 * 60 * 1000;
// The same file carries the Hub's season switches ("seasons_on"), so a season opens in the app when the owner opens
// it on the Hub; without them the app keeps its own copy of the Hub's switches (lessons L107).
type DealsData = { deals: Deal[]; seasonsOn: SeasonsOn };
let cache: ({ at: number } & DealsData) | null = null;
let pending: Promise<DealsData> | null = null;

function fetchDeals(force: boolean): Promise<DealsData> {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache);
  if (!pending) {
    pending = getDealsData()
      .then(data => { const d = { deals: parseDeals(data), seasonsOn: parseSeasonsOn(data) }; cache = { at: Date.now(), ...d }; return d; })
      .catch(() => cache ?? { deals: [], seasonsOn: SEASONS_ON_DEFAULT })
      .finally(() => { pending = null; });
  }
  return pending;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>(() => cache?.deals ?? []);
  const [seasonsOn, setSeasonsOn] = useState<SeasonsOn>(() => cache?.seasonsOn ?? SEASONS_ON_DEFAULT);
  const [loaded, setLoaded] = useState(cache !== null);
  const load = useCallback((force = false) => {
    fetchDeals(force).then(d => { setDeals(d.deals); setSeasonsOn(d.seasonsOn); setLoaded(true); });
  }, []);
  useEffect(() => { load(false); }, [load]);
  return { deals, seasonsOn, loaded, reload: () => load(true) };
}
