import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { C } from '@/theme';
import { safeHttps } from './api';

/**
 * Retailer and site links open in the phone's own browser (Safari / Chrome), so the Awin referral and the
 * shopper's retailer login stay in the same browser (owner's decision, v1).
 */
export async function openInBrowser(url: string): Promise<void> {
  const safe = safeHttps(url);
  if (!safe) return;
  try {
    await Linking.openURL(safe);
  } catch {
    /* nothing to do: the phone has no browser */
  }
}

/** Legal pages open inside the app, in a browser sheet with a close button. */
export async function openSheet(url: string): Promise<void> {
  const safe = safeHttps(url);
  if (!safe) return;
  try {
    await WebBrowser.openBrowserAsync(safe, { toolbarColor: C.bgDeep, controlsColor: C.gold });
  } catch {
    await openInBrowser(safe);
  }
}

export async function openEmail(address: string): Promise<void> {
  try {
    await Linking.openURL(`mailto:${address}`);
  } catch {
    /* no mail app */
  }
}
