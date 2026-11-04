import { useCallback, useEffect, useState } from 'react';

import { getDealsData } from './api';
import { parseDeals, type Deal } from './seasons';

// The Hub's deals, read once and shared by the home screen and the world screens (read again after 10 minutes,
// or when the person pulls down to refresh the home screen).
const FRESH_MS = 10 * 60 * 1000;
let cache: { at: number; deals: Deal[] } | null = null;
let pending: Promise<Deal[]> | null = null;

function fetchDeals(force: boolean): Promise<Deal[]> {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.deals);
  if (!pending) {
    pending = getDealsData()
      .then(data => { const deals = parseDeals(data); cache = { at: Date.now(), deals }; return deals; })
      .catch(() => cache?.deals ?? [])
      .finally(() => { pending = null; });
  }
  return pending;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>(() => cache?.deals ?? []);
  const [loaded, setLoaded] = useState(cache !== null);
  const load = useCallback((force = false) => {
    fetchDeals(force).then(d => { setDeals(d); setLoaded(true); });
  }, []);
  useEffect(() => { load(false); }, [load]);
  return { deals, loaded, reload: () => load(true) };
}
