// Gear World colours (same family as gearworldhub.com). Light text on dark, gold for actions,
// blue for information. Meaning is never carried by colour alone (owner is colour-blind, lessons L35).
export const C = {
  bg: '#08111F',
  bgDeep: '#030A1F',
  card: '#132238',
  cardHigh: '#1B2E4A',
  border: 'rgba(255,255,255,0.12)',
  text: '#F5F7FB',
  muted: '#C9D4E3',
  faint: '#93A4BC',
  gold: '#FFC23D',
  goldDark: '#E5A400',
  onGold: '#08111F',
  blue: '#7CC4FF'
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const MAX_WIDTH = 760;
