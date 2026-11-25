import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { translate } from '@/i18n';
import type { LocaleCode } from '@/i18n/core';
import type { PriceAlert } from './alerts';
import { formatDay, formatPrice } from './format';

// Local notifications only (version 1.0.2): made on the phone, never sent through a server, so the app has no push
// keys and asks for nothing at start. The permission is asked only when the person turns on a price alert.
export const ALERT_CHANNEL = 'price-alerts';

// A notification that arrives while the app is open is shown too, without sound or app badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
});

async function ensureChannel(locale: LocaleCode): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: translate(locale, 'alertChannel'),
    importance: Notifications.AndroidImportance.DEFAULT
  });
}

/** true when notifications may be shown; asks the phone once if it has not been asked yet. */
export async function allowNotifications(locale: LocaleCode): Promise<boolean> {
  try {
    // Android 13+ shows the question only after the app has a channel.
    await ensureChannel(locale);
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    if (!now.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function canNotify(): Promise<boolean> {
  try { return (await Notifications.getPermissionsAsync()).granted; } catch { return false; }
}

/** One notification per new price: the retailer, the product, the price and the day it was checked. */
export async function showPriceAlerts(alerts: PriceAlert[], locale: LocaleCode): Promise<void> {
  if (!alerts.length || !(await canNotify())) return;
  await ensureChannel(locale).catch(() => undefined);
  for (const a of alerts) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: translate(locale, 'alertTitle', { retailer: a.retailer || a.key.slice(0, 3) }),
        body: translate(locale, 'alertBody', {
          name: a.name.slice(0, 120),
          price: formatPrice(a.price, a.currency, locale),
          date: formatDay(a.checked, locale, 'short')
        }),
        data: { key: a.key }
      },
      trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : null
    }).catch(() => undefined);
  }
}
