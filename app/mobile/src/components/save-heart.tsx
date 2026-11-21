import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { useI18n } from '@/i18n';
import type { Product } from '@/lib/api';
import { useOnPhone } from '@/lib/on-phone';
import { SAVED_MAX } from '@/lib/saved';
import { C, R } from '@/theme';

/** Saves the product on this phone, or takes it off the saved list. Full heart = saved (the label says it too). */
export function useToggleSaved() {
  const { t } = useI18n();
  const { toggleSaved } = useOnPhone();
  return (product: Product) => {
    if (toggleSaved(product) === 'full') Alert.alert(t('savedTitle'), t('savedFull', { max: SAVED_MAX }));
  };
}

/** The heart on a product card. */
export function SaveHeart({ product }: { product: Product }) {
  const { t } = useI18n();
  const { isSaved } = useOnPhone();
  const toggle = useToggleSaved();
  const saved = isSaved(product.key);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? t('unsave') : t('save')} accessibilityState={{ selected: saved }}
      hitSlop={10} onPress={() => toggle(product)} style={({ pressed }) => [s.heart, pressed && s.pressed]}>
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={C.gold} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  heart: { position: 'absolute', top: 6, right: 6, width: 40, height: 40, borderRadius: R.pill, backgroundColor: 'rgba(3,10,31,0.78)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 }
});
