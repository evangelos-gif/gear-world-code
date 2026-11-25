// Idea 17 Α (chat 8, approved by the owner 25/11/2026, version 1.0.2): a warmer app. A greeting for the time of day,
// and each Gear World named with its own icon instead of its code (KGW, MGW...). No React or native code here, so it
// can be tested with plain Node.

/** The icon of each Gear World (Ionicons names, checked by the tests). Shown next to the world's name, never alone. */
export const WORLD_ICONS: Record<string, string> = {
  CGW: 'construct-outline',
  MGW: 'man-outline',
  WGW: 'woman-outline',
  KGW: 'happy-outline',
  HGW: 'home-outline',
  GGW: 'leaf-outline',
  TGW: 'hardware-chip-outline',
  AGW: 'car-outline',
  VGW: 'airplane-outline',
  SGW: 'football-outline',
  BGW: 'speedometer-outline',
  PGW: 'game-controller-outline',
  ZGW: 'paw-outline'
};

export const DEFAULT_WORLD_ICON = 'globe-outline';

export function worldIcon(key: string): string {
  return WORLD_ICONS[key] ?? DEFAULT_WORLD_ICON;
}

export type DayPart = 'greetMorning' | 'greetAfternoon' | 'greetEvening';

/** The phone's own hour: morning 05:00-11:59, afternoon 12:00-17:59, evening 18:00-04:59. */
export function dayPart(hour: number): DayPart {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (h >= 5 && h < 12) return 'greetMorning';
  if (h >= 12 && h < 18) return 'greetAfternoon';
  return 'greetEvening';
}
