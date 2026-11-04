import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/**
 * Darkens a picture only where the text sits (the bottom), so the picture keeps its own bright colours
 * and the white text stays easy to read (owner, 4/11/2026: the pictures looked dull under a flat dark layer).
 */
export function ImageShade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(3,10,31,0)', 'rgba(3,10,31,0.18)', 'rgba(3,10,31,0.72)', 'rgba(3,10,31,0.92)']}
      locations={[0, 0.35, 0.7, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** A soft dark edge around white text that sits on a picture. */
export const TEXT_ON_PICTURE = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4
} as const;
