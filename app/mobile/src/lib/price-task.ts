import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { storedLocale } from '@/i18n';
import { checkAlerts, keepSaved, parseAlerts, type AlertMap } from './alerts';
import { productsById, type Product } from './api';
import { showPriceAlerts } from './notify';
import { idsByWorld, parseSaved } from './saved';
import { loadStoredSettings } from './settings-context';

// The background price check of version 1.0.2. The phone runs it now and then (Android about every 6 hours,
// iPhone when iOS allows it, often at night). It reads only the saved products with an alert on, asks their sites
// for the newest price, one request per world, and shows a notification for a lower price that is checked and fresh.
export const PRICE_TASK = 'gw-price-alerts';
export const SAVED_KEY = 'gw-saved-v1';
export const ALERTS_KEY = 'gw-price-alerts-v1';

/** The phone's own day (YYYY-MM-DD), the same day the Saved tab uses. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function readAlerts(): Promise<AlertMap> {
  try { return parseAlerts(await AsyncStorage.getItem(ALERTS_KEY)); } catch { return {}; }
}

export async function writeAlerts(map: AlertMap): Promise<void> {
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(map)).catch(() => undefined);
}

/** Compares the given newest prices with the stored ones, stores the result and shows what is new. */
export async function tellNewPrices(latest: Product[], savedKeys: string[]): Promise<void> {
  // Read just before writing, so an alert turned on or off a moment ago is kept.
  const map = keepSaved(await readAlerts(), savedKeys);
  const r = checkAlerts(map, latest, localDay());
  await writeAlerts(r.map);
  if (r.alerts.length) await showPriceAlerts(r.alerts, await storedLocale());
}

export async function backgroundCheck(): Promise<void> {
  await loadStoredSettings();
  const saved = parseSaved(await AsyncStorage.getItem(SAVED_KEY));
  const alerts = keepSaved(await readAlerts(), saved.map(x => x.key));
  const withAlert = saved.filter(x => x.key in alerts);
  if (!withAlert.length) return;
  const latest: Product[] = [];
  for (const [worldKey, ids] of Object.entries(idsByWorld(withAlert))) {
    const sample = withAlert.find(x => x.worldKey === worldKey);
    if (!sample) continue;
    try {
      latest.push(...(await productsById({ key: worldKey, name: sample.worldName, base: sample.base }, ids)).found);
    } catch { /* this site did not answer: try again next time */ }
  }
  await tellNewPrices(latest, saved.map(x => x.key));
}

// Defined when the app's code loads (src/app/_layout.tsx imports this file), as the phone needs it in the background.
TaskManager.defineTask(PRICE_TASK, async () => {
  try {
    await backgroundCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** The background check runs only while at least one saved product has an alert on. */
export async function syncBackgroundTask(on: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(PRICE_TASK);
    if (on && !registered) await BackgroundTask.registerTaskAsync(PRICE_TASK, { minimumInterval: 6 * 60 });
    if (!on && registered) await BackgroundTask.unregisterTaskAsync(PRICE_TASK);
  } catch { /* background work not available on this phone: the check still runs when the app opens */ }
}
